import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";
import { recordUsage, getRemaining } from "./quota";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

export async function generateQuestions(testDetails) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const prompt = `Generate ${testDetails.numQuestions} multiple-choice questions for a ${testDetails.difficulty} level test on ${testDetails.tags}. 
  The test title is "${testDetails.title}" and the description is "${testDetails.description}". 
  For each question, provide the following details:
  - 'text': The question text as a string.
  - 'options': An array of 4 distinct answer options (as strings).
  - 'correctAnswer': The correct answer as a string, matching one of the options.

  Format the response as a JSON array of objects, each containing 'text', 'options', and 'correctAnswer'. 
  Do not include any markdown formatting or additional text outside of the JSON array.`;

  try {
    // Try with retry logic
    const result = await retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return await response.text();
    });

    // Clean and validate the response
    const cleanedText = result.trim();
    const parsedQuestions = cleanAndParseJSON(cleanedText);

    // Check if parsedQuestions is a valid array
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new Error("Invalid question format from API");
    }

    recordUsage("gemini", 1);
    logger.info("✅ Successfully generated questions using Gemini API");
    logRateLimitInfo();
    return parsedQuestions;
  } catch (error) {
    logger.error("❌ Gemini API failed:", error.message);

    // Check if it's a service unavailability error
    if (
      error.status === 503 ||
      error.message.includes("overloaded") ||
      error.message.includes("Service Unavailable")
    ) {
      logger.warn("🔄 Gemini API is overloaded, using fallback questions...");

      const fallbackQuestions = generateFallbackQuestions(testDetails);
      logger.info("✅ Generated fallback questions");

      return fallbackQuestions;
    }

    // For other errors, also use fallback
    logger.warn("🔄 API error occurred, using fallback questions...");
    const fallbackQuestions = generateFallbackQuestions(testDetails);
    logger.info("✅ Generated fallback questions");

    return fallbackQuestions;
  }
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

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // Try with retry logic
    const result = await retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return await response.text();
    });

    logger.debug("Gemini API response:", result);
    const parsedResult = cleanAndParseJSON(result);

    recordUsage("gemini", 1);
    logger.info("✅ Successfully verified test using Gemini API");
    logRateLimitInfo();
    return parsedResult;
  } catch (error) {
    logger.error("❌ Gemini API failed for test verification:", error.message);

    // Use fallback verification
    logger.warn("🔄 Using fallback test verification...");
    const fallbackResult = generateFallbackTestVerification(test, userAnswers);
    logger.info("✅ Generated fallback test verification");

    return fallbackResult;
  }
}
