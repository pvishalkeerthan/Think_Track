export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Try to import Groq SDK (optional fallback)
let Groq;
try {
  Groq = require('groq-sdk');
} catch (e) {
  console.warn("Groq SDK not installed. Install with: npm install groq-sdk");
}

// Fallback models in order of preference
const FALLBACK_MODELS = [
  'gemini-2.5-flash',           // Best: Mid-size, 1M tokens, stable
  'gemini-2.5-pro',             // Most capable, 1M tokens, stable
  'gemini-2.0-flash-001',       // Fast & versatile, stable
  'gemini-2.5-flash-lite',      // Lighter version of 2.5 Flash
  'gemini-1.5-flash',           // Alternative stable model
  'gemini-1.5-pro',             // Pro version alternative
  'gemini-pro',                 // Legacy pro model
];

// Helper function to check if error is retryable (quota, rate limit, or service unavailable)
function isRetryableError(error) {
  if (!error) return false;
  
  const status = error.status || error.statusCode;
  const message = error.message || '';
  
  // Check for retryable HTTP status codes
  // 429 = Too Many Requests (quota/rate limit)
  // 503 = Service Unavailable (overloaded)
  // 500 = Internal Server Error (temporary)
  // 502 = Bad Gateway (temporary)
  if (status === 429 || status === 503 || status === 500 || status === 502) {
    return true;
  }
  
  // Check error message for quota/overload-related keywords
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
async function tryGroqFallback(prompt, systemInstruction, modelConfig) {
  if (!Groq || !process.env.GROQ_API_KEY) {
    return null;
  }

  try {
    console.log("🔄 All Gemini models failed, trying Groq API as final fallback...");
    
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const messages = [
      {
        role: "system",
        content: systemInstruction || "You are a helpful AI assistant that provides accurate and detailed responses.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    // Try different Groq models in order
    const groqModels = [
      "llama-3.1-70b-instruct",  // Best quality (updated from decommissioned versatile)
      "llama-3.1-8b-instant",    // Fast fallback
      "mixtral-8x7b-32768",      // Alternative
    ];

    for (const model of groqModels) {
      try {
        console.log(`Attempting Groq model: ${model}`);
        
        const completion = await groq.chat.completions.create({
          messages,
          model,
          temperature: modelConfig?.generationConfig?.temperature || 0.7,
          max_tokens: modelConfig?.generationConfig?.maxOutputTokens || 4096,
          response_format: modelConfig?.generationConfig?.responseMimeType === "application/json" 
            ? { type: "json_object" } 
            : undefined,
        });

        const text = completion.choices[0]?.message?.content;
        if (text) {
          console.log(`✅ Successfully generated with Groq model: ${model}`);
          return text;
        }
      } catch (groqError) {
        console.warn(`❌ Groq model ${model} failed:`, groqError.message);
        if (model !== groqModels[groqModels.length - 1]) {
          continue; // Try next Groq model
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Groq API fallback failed:", error.message);
    return null;
  }
}

// Helper function to try multiple models with fallback
async function generateWithFallback(prompt, modelConfig, models = FALLBACK_MODELS) {
  let lastError = null;
  
  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    
    try {
      console.log(`Attempting to generate with model: ${modelName}`);
      
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...modelConfig,
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log(`✅ Successfully generated with model: ${modelName}`);
      return text;
      
    } catch (error) {
      lastError = error;
      const status = error.status || error.statusCode;
      console.warn(`❌ Model ${modelName} failed:`, error.message, `(Status: ${status})`);
      
      // If it's a retryable error (quota, overload, service unavailable) and there are more models to try, continue
      if (isRetryableError(error) && i < models.length - 1) {
        const errorType = status === 429 ? 'quota exceeded' : status === 503 ? 'overloaded' : 'service error';
        console.log(`🔄 Model ${modelName} ${errorType}, trying next model...`);
        continue;
      }
      
      // If it's not a retryable error or it's the last model, throw immediately
      if (!isRetryableError(error)) {
        throw error;
      }
    }
  }
  
  // If we get here, all Gemini models failed with retryable errors
  // Try Groq as final fallback
  if (isRetryableError(lastError)) {
    const groqResponse = await tryGroqFallback(prompt, modelConfig?.systemInstruction, modelConfig);
    if (groqResponse) {
      return groqResponse;
    }
  }
  
  throw lastError;
}

export async function POST(request) {
  try {
    const { course, knowledge_level, description, time } = await request.json();

    if (!course || !knowledge_level || !description || !time) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const modelConfig = {
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
      systemInstruction: `You are an expert educational content creator and instructional designer with 20+ years of experience in creating comprehensive, engaging learning materials. Your expertise spans all domains and you excel at making complex topics accessible and practical.

CONTENT CREATION GUIDELINES:
1. Create comprehensive, well-structured learning materials
2. Use clear, engaging language appropriate for the learner's level
3. Include practical examples, real-world applications, and hands-on exercises
4. Provide step-by-step guidance with actionable instructions
5. Include visual aids descriptions and learning checkpoints
6. Address common misconceptions and learning challenges
7. Make content interactive and engaging

CONTENT STRUCTURE:
- Learning Objectives (what they'll achieve)
- Prerequisites (what they need to know first)
- Core Concepts (detailed explanations)
- Practical Examples (real-world applications)
- Hands-on Exercises (practice activities)
- Common Pitfalls (mistakes to avoid)
- Next Steps (what to learn next)
- Additional Resources (further learning)

FORMATTING:
- Use clear headings and subheadings
- Include bullet points and numbered lists
- Add emphasis for key concepts
- Use code blocks for technical content
- Include practical tips and best practices
- Make content scannable and digestible

Create content that is educational, practical, and immediately actionable for the learner.`,
    };

    const prompt = `Create comprehensive, high-quality learning resources for the following scenario:

LEARNING CONTEXT:
- Course: ${course}
- Knowledge Level: ${knowledge_level}
- Specific Topic: ${description}
- Expected Learning Time: ${time}

RESOURCE REQUIREMENTS:
1. Create detailed, structured learning materials that cover "${description}" comprehensively
2. Tailor content complexity and depth to ${knowledge_level} level
3. Include practical, hands-on learning activities
4. Provide clear learning objectives and outcomes
5. Include real-world examples and applications
6. Address common learning challenges and misconceptions
7. Make content engaging and immediately actionable

CONTENT SHOULD INCLUDE:
- Clear learning objectives and prerequisites
- Step-by-step explanations with examples
- Practical exercises and hands-on activities
- Real-world applications and use cases
- Common pitfalls and how to avoid them
- Assessment checkpoints and progress indicators
- Additional resources for deeper learning
- Tips for effective learning and retention

FORMAT: Use clear markdown formatting with headings, bullet points, code blocks (if applicable), and emphasis for key concepts.

Create content that will help a ${knowledge_level} learner master "${description}" effectively within ${time}.`;

    // Try generating with fallback models
    const resources = await generateWithFallback(prompt, modelConfig);

    return NextResponse.json({ content: resources });
  } catch (error) {
    console.error("Error generating resources:", error);
    
    // Provide more detailed error information
    const errorMessage = error.message || "Failed to generate resources";
    const statusCode = error.status || error.statusCode || 500;
    
    return NextResponse.json(
      { 
        error: "Failed to generate resources",
        details: errorMessage,
        ...(isRetryableError(error) && {
          suggestion: "All available models have exceeded their quota. Please try again later or check your API billing."
        })
      },
      { status: statusCode }
    );
  }
}
