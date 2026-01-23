import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";
import { recordUsage, getRemaining } from "./quota";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Try to import Groq SDK (optional fallback)
let Groq;
try {
  Groq = require('groq-sdk');
} catch (e) {
  logger.warn("Groq SDK not installed. Install with: npm install groq-sdk");
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

function cleanAndParseJSON(text) {
  // Remove markdown formatting
  text = text.replace(/```json\n?|\n?```/g, "").trim();
  // Remove any leading or trailing whitespace and newlines
  text = text.replace(/^\s+|\s+$/g, "");
  return JSON.parse(text);
}

// Sleep function for retry delays
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fallback question generator
function generateFallbackQuestions(testDetails) {
  const { numQuestions, difficulty, tags, title, description } = testDetails;
  const questions = [];

  const difficultyLevels = {
    easy: { complexity: "basic", time: "quick", score: "simple" },
    medium: {
      complexity: "intermediate",
      time: "moderate",
      score: "challenging",
    },
    hard: { complexity: "advanced", time: "detailed", score: "complex" },
  };

  const level = difficultyLevels[difficulty] || difficultyLevels.medium;
  const subject = tags || "general knowledge";

  for (let i = 0; i < numQuestions; i++) {
    const questionNumber = i + 1;
    questions.push({
      text: `This is a ${level.complexity} question about ${subject}. Question ${questionNumber}: What is the most appropriate answer for a ${difficulty} level test on ${title}?`,
      options: [
        "Option A: The first possible answer",
        "Option B: The second possible answer",
        "Option C: The correct answer",
        "Option D: The fourth possible answer",
      ],
      correctAnswer: "Option C: The correct answer",
    });
  }

  return questions;
}

// Retry wrapper function
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);

      // Check if it's a retryable error (503, 429, 500, etc.)
      const isRetryable =
        error.status >= 500 || error.status === 429 || error.status === 503;

      if (attempt === maxRetries || !isRetryable) {
        throw error;
      }

      // Exponential backoff
      const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
      logger.info(`Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

function logRateLimitInfo(note) {
  // The Google Generative AI SDK does not expose rate-limit headers.
  // We provide a best-effort message so developers know where to look.
  const remaining = getRemaining("gemini", "GEMINI_HOURLY_QUOTA");
  if (remaining !== null) {
    logger.info(`Gemini estimated remaining this hour: ${remaining}`);
  } else {
    logger.info(
      note ||
        "Gemini SDK does not expose remaining quota headers. Optionally set GEMINI_HOURLY_QUOTA to estimate."
    );
  }
}

// Helper function to check if error is retryable (quota, rate limit, or service unavailable)
function isRetryableError(error) {
  if (!error) return false;
  
  const status = error.status || error.statusCode;
  const message = error.message || '';
  
  // Check for retryable HTTP status codes
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
          max_tokens: 4096,
          response_format: { type: "json_object" }, // Force JSON for questions
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

export async function generateQuestions(testDetails) {
  // Fallback models in order of preference
  const FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-001',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash-lite',
  ];

  const systemInstruction = `You are an expert educational assessment specialist. Generate high-quality multiple-choice questions that test both factual knowledge and conceptual understanding.`;

  const prompt = `Generate ${testDetails.numQuestions} multiple-choice questions for a ${testDetails.difficulty} level test on ${testDetails.tags}. 
  The test title is "${testDetails.title}" and the description is "${testDetails.description}". 
  For each question, provide the following details:
  - 'text': The question text as a string.
  - 'options': An array of 4 distinct answer options (as strings).
  - 'correctAnswer': The correct answer as a string, matching one of the options.

  Format the response as a JSON array of objects, each containing 'text', 'options', and 'correctAnswer'. 
  Do not include any markdown formatting or additional text outside of the JSON array.`;

  let lastError = null;

  // Try multiple Gemini models
  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const modelName = FALLBACK_MODELS[i];
    
    try {
      logger.info(`Attempting to generate with model: ${modelName}`);
      
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean and validate the response
      const cleanedText = text.trim();
      const parsedQuestions = cleanAndParseJSON(cleanedText);

      // Check if parsedQuestions is a valid array
      if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
        throw new Error("Invalid question format from API");
      }

      recordUsage("gemini", 1);
      logger.info(`✅ Successfully generated questions using ${modelName}`);
      logRateLimitInfo();
      return parsedQuestions;
      
    } catch (error) {
      lastError = error;
      const status = error.status || error.statusCode;
      logger.warn(`❌ Model ${modelName} failed:`, error.message, `(Status: ${status})`);
      
      // If it's a retryable error and there are more models to try, continue
      if (isRetryableError(error) && i < FALLBACK_MODELS.length - 1) {
        const errorType = status === 429 ? 'quota exceeded' : status === 503 ? 'overloaded' : 'service error';
        logger.info(`🔄 Model ${modelName} ${errorType}, trying next model...`);
        continue;
      }
      
      // If it's not a retryable error, throw immediately
      if (!isRetryableError(error)) {
        break; // Exit loop to try Groq or fallback
      }
    }
  }

  // If we get here, all Gemini models failed with retryable errors
  // Try Groq as final fallback
  if (isRetryableError(lastError)) {
    logger.info("🔄 All Gemini models failed, trying Groq API...");
    const groqResponse = await tryGroqFallback(prompt, systemInstruction);
    if (groqResponse) {
      try {
        const cleanedText = groqResponse.trim();
        const parsedQuestions = cleanAndParseJSON(cleanedText);
        
        if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
          logger.info("✅ Successfully generated questions using Groq API");
          return parsedQuestions;
        }
      } catch (parseError) {
        logger.warn("Failed to parse Groq response:", parseError.message);
      }
    }
  }

  // Final fallback: use hardcoded questions
  logger.warn("🔄 All AI APIs failed, using fallback questions...");
  const fallbackQuestions = generateFallbackQuestions(testDetails);
  logger.info("✅ Generated fallback questions");
  return fallbackQuestions;
}

// Fallback test verification
function generateFallbackTestVerification(test, userAnswers) {
  const questions = test.questions || [];
  const totalQuestions = questions.length;

  let correctAnswers = 0;
  const questionResults = [];

  // Simple answer verification
  questions.forEach((question, index) => {
    const userAnswer = userAnswers[question._id] || userAnswers[index];
    const isCorrect = userAnswer === question.correctAnswer;

    if (isCorrect) correctAnswers++;

    questionResults.push({
      isCorrect,
      explanation: isCorrect
        ? "Correct answer! Well done."
        : `Incorrect. The correct answer is "${question.correctAnswer}".`,
    });
  });

  const wrongAnswers = totalQuestions - correctAnswers;
  const score = Math.round((correctAnswers / totalQuestions) * 100);

  return {
    score,
    correctAnswers,
    wrongAnswers,
    analysis: `You answered ${correctAnswers} out of ${totalQuestions} questions correctly (${score}%). ${
      score >= 80
        ? "Excellent performance!"
        : score >= 60
        ? "Good job, but there's room for improvement."
        : "Keep practicing to improve your knowledge."
    }`,
    questionResults,
  };
}

export async function verifyTestWithGemini(test, userAnswers) {
  logger.info("Verifying test with Gemini...");

  const prompt = `
    Analyze the following test results:
    Test: ${JSON.stringify(test)}
    User Answers: ${JSON.stringify(userAnswers)}

    Please provide:
    1. The score (percentage of correct answers)
    2. Number of correct answers
    3. Number of wrong answers
    4. A brief analysis of the user's performance, including topics they need to improve
    5. For each question, provide:
       - Whether the user's answer was correct or not
       - A brief explanation of why it was correct or incorrect

    Format the response as a JSON object with the following structure:
    {
      "score": number,
      "correctAnswers": number,
      "wrongAnswers": number,
      "analysis": string,
      "questionResults": [
        {
          "isCorrect": boolean,
          "explanation": string
        },
        ...
      ]
    }
  `;

  // Fallback models in order of preference
  const FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-001',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash-lite',
  ];

  let lastError = null;

  // Try multiple Gemini models
  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const modelName = FALLBACK_MODELS[i];
    
    try {
      logger.info(`Attempting to verify with model: ${modelName}`);
      
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.debug("API response:", text);
      const parsedResult = cleanAndParseJSON(text);

      recordUsage("gemini", 1);
      logger.info(`✅ Successfully verified test using ${modelName}`);
      logRateLimitInfo();
      return parsedResult;
      
    } catch (error) {
      lastError = error;
      const status = error.status || error.statusCode;
      logger.warn(`❌ Model ${modelName} failed:`, error.message, `(Status: ${status})`);
      
      // If it's a retryable error and there are more models to try, continue
      if (isRetryableError(error) && i < FALLBACK_MODELS.length - 1) {
        const errorType = status === 429 ? 'quota exceeded' : status === 503 ? 'overloaded' : 'service error';
        logger.info(`🔄 Model ${modelName} ${errorType}, trying next model...`);
        continue;
      }
      
      // If it's not a retryable error, break to try Groq or fallback
      if (!isRetryableError(error)) {
        break;
      }
    }
  }

  // If we get here, all Gemini models failed with retryable errors
  // Try Groq as final fallback
  if (isRetryableError(lastError)) {
    logger.info("🔄 All Gemini models failed, trying Groq API...");
    const groqResponse = await tryGroqFallback(prompt, "You are an expert educational assessment analyzer.");
    if (groqResponse) {
      try {
        const parsedResult = cleanAndParseJSON(groqResponse);
        logger.info("✅ Successfully verified test using Groq API");
        return parsedResult;
      } catch (parseError) {
        logger.warn("Failed to parse Groq response:", parseError.message);
      }
    }
  }

  // Final fallback: use hardcoded verification
  logger.warn("🔄 All AI APIs failed, using fallback test verification...");
  const fallbackResult = generateFallbackTestVerification(test, userAnswers);
  logger.info("✅ Generated fallback test verification");
  return fallbackResult;
}
