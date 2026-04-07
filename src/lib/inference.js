import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Provider Configuration ---
const PROVIDERS_CONFIG = [
  {
    name: 'Gemini',
    apiKey: process.env.GEMINI_API_KEY,
    models: [
      { id: 'gemini-2.0-flash', context: 1048576 },
      { id: 'gemini-1.5-flash', context: 1048576 },
      { id: 'gemini-pro', context: 30720 }
    ],
    init: (apiKey) => new GoogleGenerativeAI(apiKey),
    execute: async (client, modelInfo, prompt, config) => {
      const model = client.getGenerativeModel({
        model: modelInfo.id,
        systemInstruction: config.systemInstruction,
        generationConfig: config.generationConfig,
        safetySettings: config.safetySettings,
      });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    }
  },
  {
    name: 'Groq',
    apiKey: process.env.GROQ_API_KEY,
    models: [
      { id: 'llama-3.3-70b-versatile', context: 32768 },
      { id: 'gemma2-9b-it', context: 8192 },
      { id: 'llama-3.1-8b-instant', context: 8192 }
    ],
    init: (apiKey) => {
      const GroqSDK = require('groq-sdk');
      return new GroqSDK({ apiKey });
    },
    execute: async (client, modelInfo, prompt, config) => {
      const completion = await client.chat.completions.create({
        model: modelInfo.id,
        messages: [
          { role: "system", content: config.systemInstruction },
          { role: "user", content: prompt }
        ],
        temperature: config.generationConfig?.temperature || 1,
        max_tokens: config.generationConfig?.maxOutputTokens || 4096,
        response_format: config.generationConfig?.responseMimeType === "application/json" 
          ? { type: "json_object" } 
          : undefined,
      });
      return completion.choices[0]?.message?.content;
    }
  }
];

// --- Helpers ---

/**
 * Truncates prompt to stay within model's context window.
 * Heuristic: 1 token ≈ 4 characters.
 */
function trimToContext(prompt, contextLimit) {
  const safetyMargin = 0.9;
  const maxChars = Math.floor(contextLimit * 4 * safetyMargin);
  if (prompt.length > maxChars) {
    console.warn(`[Inference] ⚠️ Truncating prompt from ${prompt.length} to ${maxChars} chars for context window.`);
    return prompt.substring(0, maxChars);
  }
  return prompt;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getErrorStatus(error) {
  return error.status || error.statusCode || (error.response ? error.response.status : null);
}

/**
 * Robust Unified Inference Engine
 * 
 * Supports:
 * - Multi-provider (Gemini -> Groq)
 * - Skip providers with missing keys
 * - Skip providers on Auth Error (401/403)
 * - Skip models on Decommission Error (404/400)
 * - Exponential backoff for Rate Limits (429)
 * - Context-aware prompt trimming
 */
export async function unifiedInference(prompt, config = {}) {
  let lastError = null;

  for (const provider of PROVIDERS_CONFIG) {
    if (!provider.apiKey || provider.apiKey.trim() === "") {
      console.log(`[Inference] ⏩ Skipping ${provider.name}: No API Key found.`);
      continue;
    }

    let client;
    try {
      client = provider.init(provider.apiKey);
    } catch (e) {
      console.error(`[Inference] ❌ Failed to initialize ${provider.name}:`, e.message);
      continue;
    }

    for (const modelInfo of provider.models) {
      let retries = 0;
      const maxRetries = 1;

      while (retries <= maxRetries) {
        try {
          console.log(`[Inference] 🔄 Trying [${provider.name}] model: ${modelInfo.id}`);
          const trimmedPrompt = trimToContext(prompt, modelInfo.context);
          
          const text = await provider.execute(client, modelInfo, trimmedPrompt, config);
          if (!text) throw new Error("Empty response from model");

          console.log(`[Inference] ✅ Successful generation with [${provider.name}] - ${modelInfo.id}`);
          return text;

        } catch (error) {
          lastError = error;
          const status = getErrorStatus(error);
          const msg = error.message.toLowerCase();

          console.warn(`[Inference] ❌ [${provider.name}] ${modelInfo.id} failed:`, error.message, `(Status: ${status})`);

          // 1. Auth Error → Skip whole provider
          if (status === 401 || status === 403 || msg.includes("api key") || msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("unregistered callers")) {
            console.error(`[Inference] 🔒 Auth failure on ${provider.name}. Skipping provider.`);
            retries = maxRetries + 1; // Break while
            break; // Skip models loop
          }

          // 2. Rate Limit → Backoff + Retry once, then try next model
          if (status === 429 || msg.includes("rate") || msg.includes("quota") || msg.includes("too many requests") || msg.includes("tokens per minute")) {
            if (retries < maxRetries) {
              console.log(`[Inference] ⏳ Rate limited or TPM exceeded. Backing off for 2s...`);
              await sleep(2000);
              retries++;
              continue; // Retry same model
            }
            console.log(`[Inference] ⏩ Rate limit persists. Switching to next model.`);
            break; // Move to next model
          }

          // 3. Model Missing/Decommissioned → Skip model
          if (status === 404 || status === 400 || msg.includes("not found") || msg.includes("decommissioned") || msg.includes("deprecated")) {
            console.log(`[Inference] ⏩ Model ${modelInfo.id} is unavailable. Skipping.`);
            break; 
          }

          // 4. Content Filter / Large Prompt
          if (status === 413 || msg.includes("context") || msg.includes("too large") || msg.includes("safety") || msg.includes("rate_limit_exceeded")) {
            // Check if it's actually a TPM limit disguised as 413 (common in Groq)
            if (msg.includes("tokens per minute") || msg.includes("rate_limit_exceeded")) {
              if (retries < maxRetries) {
                console.log(`[Inference] ⏳ TPM limit exceeded (Status 413). Backing off for 2s...`);
                await sleep(2000);
                retries++;
                continue;
              }
              console.log(`[Inference] ⏩ TPM limit persists. Switching to next model.`);
              break;
            }
             console.log(`[Inference] ⏩ Context limit or safety block on ${modelInfo.id}. Skipping.`);
             break;
          }

          // 5. Generic Server Error → Try next model
          break;
        }
      }
    }
  }

  throw lastError || new Error("AI Generation failed across all providers and models.");
}

export function cleanAIJsonResponse(text) {
  if (!text) return "";
  // Removes markdown formatting if present
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}
