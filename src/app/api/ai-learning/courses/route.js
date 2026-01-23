import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "@/lib/logger";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Try to import Groq SDK (optional fallback)
let Groq;
try {
  Groq = require('groq-sdk');
} catch (e) {
  logger.warn("Groq SDK not installed. Install with: npm install groq-sdk");
}

// Fallback models in order of preference
const FALLBACK_MODELS = [
  'gemini-2.5-flash',           // Best: Mid-size, 1M tokens, stable
  'gemini-2.5-pro',             // Most capable, 1M tokens, stable
  'gemini-2.0-flash-001',      // Fast & versatile, stable
  'gemini-1.5-flash',           // Alternative stable model
  'gemini-1.5-pro',             // Pro version alternative
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
    logger.info("🔄 All Gemini models failed, trying Groq API as final fallback...");
    
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
      "llama-3.1-70b-versatile",  // Best quality
      "llama-3.1-8b-instant",    // Fast fallback
      "mixtral-8x7b-32768",      // Alternative
    ];

    for (const model of groqModels) {
      try {
        logger.info(`Attempting Groq model: ${model}`);
        
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
          logger.info(`✅ Successfully generated with Groq model: ${model}`);
          return text;
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

// Helper function to try multiple models with fallback
async function generateWithFallback(prompt, modelConfig, models = FALLBACK_MODELS) {
  let lastError = null;
  
  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    
    try {
      logger.info(`Attempting to generate with model: ${modelName}`);
      
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...modelConfig,
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      logger.info(`✅ Successfully generated with model: ${modelName}`);
      return text;
      
    } catch (error) {
      lastError = error;
      const status = error.status || error.statusCode;
      logger.warn(`❌ Model ${modelName} failed:`, error.message, `(Status: ${status})`);
      
      // If it's a retryable error (quota, overload, service unavailable) and there are more models to try, continue
      if (isRetryableError(error) && i < models.length - 1) {
        const errorType = status === 429 ? 'quota exceeded' : status === 503 ? 'overloaded' : 'service error';
        logger.info(`🔄 Model ${modelName} ${errorType}, trying next model...`);
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

// Enhanced JSON cleaning function with robust error handling
function cleanAndParseJSON(text) {
  const originalText = text;
  logger.debug("Raw text before cleaning, length:", text.length);

  // Remove markdown code blocks (```json ... ```)
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  
  // Remove markdown formatting
  text = text.replace(/```json\n?/g, "").replace(/\n?```/g, "");

  // Remove any leading or trailing whitespace and newlines
  text = text.trim();

  // Try to find JSON object in the text - look for the outermost object
  let jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  } else {
    // If no object found, try to find array
    jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
  }

  logger.debug("Cleaned text prepared, length:", text.length);

  try {
    const parsed = JSON.parse(text);
    
    // Validate structure
    if (parsed && typeof parsed === 'object') {
      // If it's an array, wrap it in courses
      if (Array.isArray(parsed)) {
        return { courses: parsed };
      }
      // If it has courses property, return as is
      if (parsed.courses && Array.isArray(parsed.courses)) {
        return parsed;
      }
    }
    
    return parsed;
  } catch (error) {
    // Enhanced error logging with context
    const errorPosition = error.message.match(/position (\d+)/);
    const position = errorPosition ? parseInt(errorPosition[1]) : null;
    
    logger.error("JSON parsing failed:", {
      error: error.message,
      position: position,
      textLength: text.length,
      problematicText: position 
        ? text.substring(Math.max(0, position - 100), Math.min(text.length, position + 100))
        : text.substring(0, 500),
      fullText: text.substring(0, 2000), // First 2000 chars for debugging
    });
    
    // Try to fix common JSON issues
    try {
      // Remove trailing commas before closing braces/brackets
      let fixedText = text.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix unescaped quotes in strings (basic attempt)
      fixedText = fixedText.replace(/([{,]\s*"[^"]*)"([^"]*"[^"]*":)/g, '$1\\"$2');
      
      const parsed = JSON.parse(fixedText);
      logger.info("Successfully parsed after fixing common issues");
      
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed)) {
          return { courses: parsed };
        }
        if (parsed.courses && Array.isArray(parsed.courses)) {
          return parsed;
        }
      }
      
      return parsed;
    } catch (fixError) {
      logger.error("Failed to fix JSON, throwing original error");
      throw new Error(`JSON parsing error at position ${position || 'unknown'}: ${error.message}. Problematic text: ${position ? text.substring(Math.max(0, position - 50), Math.min(text.length, position + 50)) : 'see logs'}`);
    }
  }
}

export async function POST(request) {
  // Declare variables outside try block so they're accessible in catch
  let topic, knowledge_level, time;
  
  try {
    const body = await request.json();
    topic = body.topic;
    knowledge_level = body.knowledge_level;
    time = body.time;

    if (!topic || !knowledge_level || !time) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const modelConfig = {
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 4096,
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
      systemInstruction: `You are an expert educational consultant and course recommendation specialist with extensive knowledge of online learning platforms, courses, and educational resources. You help learners find the best courses for their specific needs and learning goals.

COURSE RECOMMENDATION GUIDELINES:
1. Provide specific, real courses from major platforms (Coursera, Udemy, edX, Khan Academy, YouTube, etc.)
2. Include courses appropriate for the learner's knowledge level
3. Consider course duration, cost, and quality ratings
4. Provide diverse options (free and paid, different teaching styles)
5. Include both structured courses and supplementary resources
6. Focus on courses that match the learner's time constraints

OUTPUT FORMAT (strict JSON only, no markdown, no code blocks, no explanations):
{
  "courses": [
    {
      "title": "Course Title",
      "platform": "Platform Name (e.g., Coursera, Udemy, edX)",
      "instructor": "Instructor Name",
      "duration": "X weeks/hours",
      "cost": "Free/Paid ($X)",
      "rating": "X.X/5",
      "description": "Brief course description",
      "courseUrl": "https://real-course-url.com (must be a valid URL)",
      "level": "Beginner/Intermediate/Advanced",
      "features": ["Feature 1", "Feature 2", "Feature 3"]
    }
  ]
}

CRITICAL: Output ONLY valid JSON. No markdown, no code blocks, no explanations before or after the JSON. The courseUrl field must be a real, accessible URL to the course on the platform.

QUALITY STANDARDS:
- Recommend 6-8 high-quality courses
- Include mix of free and paid options
- Consider different learning styles
- Include both beginner and advanced options
- Provide specific course details and ratings`,
    };

    const prompt = `Find and recommend the best online courses for learning "${topic}" at ${knowledge_level} level. The learner has ${time} available for learning.

REQUIREMENTS:
1. Find courses from major platforms (Coursera, Udemy, edX, Khan Academy, YouTube, LinkedIn Learning, etc.)
2. Include courses appropriate for ${knowledge_level} level
3. Consider the ${time} time constraint
4. Provide mix of free and paid options
5. Include courses with good ratings and reviews
6. Focus on practical, hands-on learning
7. Include both structured courses and supplementary resources
8. For each course, provide a real, accessible URL in the courseUrl field (use platform search URLs if exact course URLs aren't available)

SEARCH CRITERIA:
- Topic: ${topic}
- Level: ${knowledge_level}
- Time Available: ${time}
- Focus on: Practical application, real-world projects, industry-relevant content

Provide specific course recommendations with details about content, instructors, duration, cost, and why each course is suitable for this learner. Each course must include a valid courseUrl field with a real URL.`;

    // Try generating with fallback models
    const responseText = await generateWithFallback(prompt, modelConfig);
    logger.debug("Received AI response for courses");

    try {
      const courses = cleanAndParseJSON(responseText);
      logger.info("Successfully parsed courses");
      return NextResponse.json(courses);
    } catch (parseError) {
      logger.error("JSON parsing failed:", parseError);
      logger.debug("Raw response failed to parse");

      // If parsing fails, trigger fallback
      throw new Error("Failed to parse AI response as JSON");
    }
  } catch (error) {
    logger.error("Error finding courses:", error);

    // Fallback response with sample courses
    // Use default values if variables weren't set
    const fallbackTopic = topic || "the subject";
    const fallbackLevel = knowledge_level || "Beginner";
    
    const fallbackCourses = {
      courses: [
        {
          title: "Introduction to " + fallbackTopic,
          platform: "Coursera",
          instructor: "University Professor",
          duration: "4-6 weeks",
          cost: "Free (with paid certificate)",
          rating: "4.5/5",
          description: `A comprehensive introduction to ${fallbackTopic} covering fundamental concepts and practical applications.`,
          courseUrl: "https://www.coursera.org/search?query=" + encodeURIComponent(fallbackTopic),
          level: fallbackLevel,
          features: [
            "Video lectures",
            "Quizzes",
            "Peer assignments",
            "Certificate",
          ],
        },
        {
          title: fallbackTopic + " Fundamentals",
          platform: "Udemy",
          instructor: "Industry Expert",
          duration: "8-10 hours",
          cost: "Paid ($29.99)",
          rating: "4.7/5",
          description: `Learn ${fallbackTopic} from scratch with hands-on projects and real-world examples.`,
          courseUrl: "https://www.udemy.com/courses/search/?q=" + encodeURIComponent(fallbackTopic),
          level: fallbackLevel,
          features: [
            "Lifetime access",
            "Downloadable resources",
            "Mobile app",
            "Certificate",
          ],
        },
        {
          title: "Advanced " + fallbackTopic,
          platform: "edX",
          instructor: "University Faculty",
          duration: "12 weeks",
          cost: "Free (audit) / $99 (verified)",
          rating: "4.6/5",
          description: `Deep dive into advanced ${fallbackTopic} concepts with comprehensive curriculum.`,
          courseUrl: "https://www.edx.org/search?q=" + encodeURIComponent(fallbackTopic),
          level: "Advanced",
          features: [
            "University credit",
            "Professional certificate",
            "Discussion forums",
          ],
        },
      ],
    };

    return NextResponse.json(fallbackCourses);
  }
}
