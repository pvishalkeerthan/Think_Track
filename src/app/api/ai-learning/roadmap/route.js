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
    const { topic, time, knowledge_level } = await request.json();

    if (!topic || !time || !knowledge_level) {
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
        responseMimeType: "application/json",
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
      systemInstruction: `You are an expert educational consultant and curriculum designer with 15+ years of experience in creating comprehensive learning paths. Your expertise spans across all domains including technology, sciences, arts, business, and practical skills.

CRITICAL REQUIREMENTS:
1. Create a structured, progressive learning path that builds knowledge systematically
2. Each subtopic must be specific, actionable, and measurable
3. Time estimates should be realistic based on the complexity and learner's level
4. Include practical applications and real-world examples
5. Ensure proper sequencing - prerequisites before advanced topics
6. Consider different learning styles (visual, auditory, kinesthetic)
7. Include assessment checkpoints and practice opportunities

OUTPUT FORMAT (strict JSON):
{
  "week 1": {
    "topic": "Foundation Topic Name",
    "subtopics": [
      {
        "subtopic": "Specific Learning Objective",
        "time": "X hours/days",
        "description": "Detailed learning goals, what to practice, key concepts to master, and expected outcomes"
      }
    ]
  }
}

GUIDELINES:
- For beginners: Start with fundamentals, include hands-on practice
- For intermediate: Build on existing knowledge, focus on application
- For advanced: Deep dive into complex concepts, real-world projects
- Time allocation: 60% theory, 40% practice
- Include both conceptual understanding and practical skills
- Make descriptions actionable with clear learning objectives

Keep all keys lowercase: subtopics, topic, time, description`,
    };

    const prompt = `Create a comprehensive, personalized learning roadmap for "${topic}" with the following specifications:

LEARNER PROFILE:
- Topic: ${topic}
- Available Time: ${time}
- Current Knowledge Level: ${knowledge_level}
- Weekly Study Time: 16 hours (distributed across 4-5 days)

REQUIREMENTS:
1. Create a progressive curriculum that builds from fundamentals to advanced concepts
2. Each week should have 3-5 focused subtopics with clear learning objectives
3. Include hands-on practice, projects, and real-world applications
4. Provide specific time estimates for each subtopic (be realistic)
5. Ensure proper prerequisite sequencing
6. Include both theoretical understanding and practical skills
7. Consider the learner's current level and adapt complexity accordingly

For ${knowledge_level} level learners, focus on:
- ${
      knowledge_level === "Absolute Beginner"
        ? "Foundational concepts, basic terminology, and simple hands-on exercises"
        : knowledge_level === "Beginner"
        ? "Building on basics with practical applications and guided projects"
        : knowledge_level === "Moderate"
        ? "Intermediate concepts with real-world projects and problem-solving"
        : "Advanced topics with complex projects, research, and mastery-level applications"
    }

Generate a detailed, actionable roadmap that will take the learner from their current level to proficiency in ${topic} within ${time}.`;

    // Try generating with fallback models
    const responseText = await generateWithFallback(prompt, modelConfig);
    const roadmap = JSON.parse(responseText);

    return NextResponse.json(roadmap);
  } catch (error) {
    console.error("Error generating roadmap:", error);
    
    // Provide more detailed error information
    const errorMessage = error.message || "Failed to generate roadmap";
    const statusCode = error.status || error.statusCode || 500;
    
    return NextResponse.json(
      { 
        error: "Failed to generate roadmap",
        details: errorMessage,
        ...(isRetryableError(error) && {
          suggestion: "All available models have exceeded their quota. Please try again later or check your API billing."
        })
      },
      { status: statusCode }
    );
  }
}
