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
    const { course, topic, subtopic, description } = await request.json();

    if (!course || !topic || !subtopic || !description) {
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
        maxOutputTokens: 20000,
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
      systemInstruction: `You are an expert educational assessment specialist with 20+ years of experience in creating comprehensive, pedagogically sound quizzes and assessments. Your expertise covers all academic and professional domains.

QUIZ CREATION GUIDELINES:
1. Create questions that test both factual knowledge and conceptual understanding
2. Include questions at different cognitive levels: Remember, Understand, Apply, Analyze, Evaluate, Create
3. Ensure questions are clear, unambiguous, and have only one correct answer
4. Make distractors (wrong options) plausible but clearly incorrect
5. Include practical application questions and real-world scenarios
6. Vary question difficulty to challenge learners appropriately
7. Include questions that require critical thinking and problem-solving

QUESTION TYPES TO INCLUDE:
- Conceptual understanding (30%)
- Practical application (40%)
- Problem-solving scenarios (20%)
- Critical thinking/analysis (10%)

OUTPUT FORMAT (strict JSON):
{
  "questions": [
    {
      "question": "Clear, specific question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0,
      "reason": "Detailed explanation of why this answer is correct and why others are wrong"
    }
  ]
}

QUALITY STANDARDS:
- Questions should be specific to the subtopic content
- Include 5-8 questions for comprehensive coverage
- Each question should test different aspects of the learning material
- Explanations should be educational and help reinforce learning
- Avoid trick questions or overly complex wording`,
    };

    const prompt = `Create a comprehensive quiz for the following learning scenario:

COURSE CONTEXT:
- Course: ${course}
- Current Topic: ${topic}
- Focus Subtopic: ${subtopic}
- Learning Description: ${description}

QUIZ REQUIREMENTS:
1. Create 6-8 high-quality multiple choice questions that thoroughly test understanding of "${subtopic}"
2. Questions should cover both theoretical knowledge and practical application
3. Include questions that test:
   - Core concepts and definitions
   - Practical implementation
   - Problem-solving scenarios
   - Common mistakes and misconceptions
   - Real-world applications

4. Ensure each question has:
   - Clear, unambiguous wording
   - 4 plausible answer options
   - One clearly correct answer
   - Detailed explanation of the correct answer

5. Make questions progressively challenging but appropriate for someone learning this subtopic
6. Include at least one question that requires critical thinking or analysis
7. Focus on practical understanding rather than memorization

Generate questions that will help the learner assess their mastery of "${subtopic}" and identify areas for improvement.`;

    // Try generating with fallback models
    const responseText = await generateWithFallback(prompt, modelConfig);
    const quiz = JSON.parse(responseText);

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error generating quiz:", error);
    
    // Provide more detailed error information
    const errorMessage = error.message || "Failed to generate quiz";
    const statusCode = error.status || error.statusCode || 500;
    
    return NextResponse.json(
      { 
        error: "Failed to generate quiz",
        details: errorMessage,
        ...(isRetryableError(error) && {
          suggestion: "All available models have exceeded their quota. Please try again later or check your API billing."
        })
      },
      { status: statusCode }
    );
  }
}
