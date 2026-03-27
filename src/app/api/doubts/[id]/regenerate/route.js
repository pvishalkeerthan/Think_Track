export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Doubt from "@/models/Doubt";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/authOptions';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "@/lib/logger";
import { recordUsage, getRemaining } from "@/lib/quota";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Try to import Groq SDK (optional fallback)
let Groq;
try {
  Groq = require('groq-sdk');
} catch (e) {
  logger.warn("Groq SDK not installed. Install with: npm install groq-sdk");
}

async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1200) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fn();
      logger.debug("[Regenerate] Attempt", attempt, "success");
      return res;
    } catch (e) {
      logger.warn("[Regenerate] Attempt", attempt, "failed:", e?.message || e);
      if (attempt === maxRetries) throw e;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
}

// Helper function to check if error is retryable
function isRetryableError(error) {
  if (!error) return false;
  
  const status = error.status || error.statusCode;
  const message = error.message || '';
  
  if (status === 429 || status === 503 || status === 500 || status === 502) {
    return true;
  }
  
  const retryableKeywords = [
    'quota',
    'rate limit',
    'too many requests',
    'exceeded',
    'limit: 0',
    'overloaded',
    'service unavailable',
    'try again later'
  ];
  
  return retryableKeywords.some(keyword => 
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

// Helper function to try Groq API as final fallback
async function tryGroqFallback(prompt, systemInstruction = null) {
  if (!Groq || !process.env.GROQ_API_KEY) {
    return null;
  }

  try {
    logger.info("🔄 All Gemini models failed, trying Groq API as final fallback...");
    
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const messages = [];
    if (systemInstruction) {
      messages.push({
        role: "system",
        content: systemInstruction,
      });
    }
    messages.push({
      role: "user",
      content: prompt,
    });

    // Try different Groq models in order
    const groqModels = [
      "llama-3.1-70b-instruct",  // Best quality (updated from decommissioned versatile)
      "llama-3.1-8b-instant",    // Fast fallback
      "mixtral-8x7b-32768",      // Alternative
    ];

    for (const model of groqModels) {
      try {
        logger.info(`Attempting Groq model: ${model}`);
        
        const completion = await groq.chat.completions.create({
          messages,
          model,
          temperature: 0.7,
          max_tokens: 512, // Shorter for mentor answers
        });

        const text = completion.choices[0]?.message?.content;
        if (text) {
          logger.info(`✅ Successfully generated with Groq model: ${model}`);
          return text.replace(/```[\s\S]*?```/g, "").trim();
        }
      } catch (groqError) {
        logger.warn(`❌ Groq model ${model} failed:`, groqError.message);
        if (model !== groqModels[groqModels.length - 1]) {
          continue; // Try next Groq model
        }
      }
    }

    return null;
  } catch (error) {
    logger.error("Groq API fallback failed:", error.message);
    return null;
  }
}

async function generateAIMentorAnswer(d) {
  const systemInstruction = "You are a friendly AI mentor. Provide clear, student-friendly explanations that help learners understand concepts deeply.";
  
  const prompt = `You are a friendly AI mentor. Explain the correct reasoning for the following multiple-choice question.
Question: ${d.questionText}
Student's Answer: ${d.userAnswer || "(not provided)"}
Correct Answer: ${d.correctAnswer || "(not provided)"}
Student's confusion: ${d.confusion || "(not provided)"}

Write a concise, student-friendly explanation with:
- Why the correct answer is correct
- Why the student's answer may seem plausible but is incorrect
- A simple analogy or example
- A 3-5 step breakdown to arrive at the correct answer
Keep it under 180-220 words.`;

  const modelCandidates = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-001",
    "gemini-2.0-flash-lite",
  ];
  
  let lastError = null;
  
  // Try multiple Gemini models
  for (const modelName of modelCandidates) {
    try {
      const text = await retryWithBackoff(async () => {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return await response.text();
      });
      return text.replace(/```[\s\S]*?```/g, "").trim();
    } catch (e) {
      lastError = e;
      // If it's not a retryable error, break to try Groq
      if (!isRetryableError(e)) {
        break;
      }
      continue;
    }
  }
  
  // If all Gemini models failed with retryable errors, try Groq
  if (isRetryableError(lastError)) {
    logger.info("🔄 All Gemini models failed, trying Groq API...");
    const groqResponse = await tryGroqFallback(prompt, systemInstruction);
    if (groqResponse) {
      return groqResponse;
    }
  }
  
  // Final fallback
  return "AI mentor is temporarily unavailable. Reason it out: 1) Identify the tested concept. 2) Discard options contradicting it. 3) Contrast your choice vs correct option and find the key difference. 4) Re-derive step-by-step. Try regenerate again shortly.";
}

export async function POST(_req, { params }) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const doubt = await Doubt.findById(params.id);
  if (!doubt)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );

  logger.info("[Regenerate] Start for doubt", params.id);
  const ai = await generateAIMentorAnswer(doubt);
  // Estimate remaining Gemini requests if GEMINI_HOURLY_QUOTA is set
  recordUsage("gemini", 1);
  const remaining = getRemaining("gemini", "GEMINI_HOURLY_QUOTA");
  if (remaining !== null) {
    logger.info(`Gemini estimated remaining this hour: ${remaining}`);
  }
  doubt.aiAnswer = ai;
  doubt.aiAnswerPending =
    !ai || ai.toLowerCase().startsWith("ai mentor is temporarily unavailable");
  await doubt.save();
  logger.info("[Regenerate] Done, length:", ai?.length || 0);
  return NextResponse.json({ success: true, data: { aiAnswer: ai } });
}
