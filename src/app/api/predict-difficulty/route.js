export const dynamic = 'force-dynamic';
import { spawn } from "child_process";
import path from "path";
import { logger } from "@/lib/logger";

export async function POST(request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { score, time_taken, userId, subject } = body;

    // Minimal logging
    logger.debug("predict-difficulty: received", {
      score,
      time_taken,
      userId,
      subject,
    });

    // Validate input
    if (score === undefined || time_taken === undefined) {
      return Response.json(
        { error: "Missing required fields: score and time_taken" },
        { status: 400 }
      );
    }

    if (typeof score !== "number" || typeof time_taken !== "number") {
      return Response.json(
        { error: "Invalid input: score and time_taken must be numbers" },
        { status: 400 }
      );
    }

    if (score < 0 || score > 100 || time_taken < 0) {
      return Response.json(
        {
          error:
            "Invalid ranges: score must be 0-100, time_taken must be positive",
        },
        { status: 400 }
      );
    }

    // First try to use the ML model
    logger.info("🤖 Attempting ML prediction...");
    const mlPrediction = await callPythonMLModel(score, time_taken);

    if (mlPrediction.success) {
      // Use ML model prediction
      const response = {
        success: true,
        predicted_difficulty: mlPrediction.predicted_difficulty,
        confidence: mlPrediction.confidence,
        factors: {
          score: score,
          time_taken: time_taken,
          performance_ratio: mlPrediction.performance_ratio,
        },
        suggestion: getDifficultyExplanation(
          mlPrediction.predicted_difficulty.toLowerCase()
        ),
        model_used: "ML_DecisionTree",
        model_confidence: mlPrediction.confidence,
        debug: {
          ml_prediction_raw: mlPrediction.model_prediction,
          timestamp: new Date().toISOString(),
        },
      };

      logger.info("✅ ML prediction successful");
      return Response.json(response, { status: 200 });
    } else {
      // Fallback to hardcoded logic if ML model fails
      logger.warn(
        "⚠️ ML model failed, using fallback logic:",
        mlPrediction.error
      );
      return getFallbackPrediction(
        score,
        time_taken,
        userId,
        subject,
        mlPrediction.error
      );
    }
  } catch (error) {
    logger.error("❌ Error in predict-difficulty API:", error);

    // Try fallback on any error
    try {
      const body = await request.json();
      const { score, time_taken, userId, subject } = body;
      return getFallbackPrediction(
        score,
        time_taken,
        userId,
        subject,
        error.message
      );
    } catch (fallbackError) {
      return Response.json(
        {
          error: "Internal server error",
          details: error.message,
          fallback_error: fallbackError.message,
        },
        { status: 500 }
      );
    }
  }
}

// Function to call Python ML model
async function callPythonMLModel(score, time_taken) {
  return new Promise((resolve) => {
    try {
      // Path to your Python script (adjust path as needed)
      const pythonScriptPath = path.join(process.cwd(), "ml", "predict.py");

      // Prepare input data for Python script
      const inputData = JSON.stringify({ score, time_taken });

      logger.debug(`🐍 Calling Python script: ${pythonScriptPath}`);
      logger.debug(`📝 Input data: ${inputData}`);

      // Try different Python commands
      const pythonCommands = ["python3", "python", "py"];
      let currentCommandIndex = 0;

      function tryNextPythonCommand() {
        if (currentCommandIndex >= pythonCommands.length) {
          resolve({
            success: false,
            error:
              "No working Python interpreter found. Tried: " +
              pythonCommands.join(", "),
          });
          return;
        }

        const pythonCmd = pythonCommands[currentCommandIndex];
        logger.debug(`🔄 Trying Python command: ${pythonCmd}`);

        const pythonProcess = spawn(pythonCmd, [pythonScriptPath, inputData]);

        let output = "";
        let errorOutput = "";

        pythonProcess.stdout.on("data", (data) => {
          output += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        pythonProcess.on("close", (code) => {
          logger.debug(`🏁 Python process closed with code: ${code}`);
          if (errorOutput) logger.debug(`🚨 Python errors: ${errorOutput}`);

          if (code === 0 && output.trim()) {
            try {
              const result = JSON.parse(output.trim());
              if (result.success) {
                logger.debug("✅ ML model prediction successful");
                resolve({ success: true, ...result });
              } else {
                logger.debug("❌ ML model returned error:", result.error);
                resolve({
                  success: false,
                  error: result.error || "ML model returned error",
                });
              }
            } catch (parseError) {
              logger.error("❌ Failed to parse Python output:", parseError);
              resolve({
                success: false,
                error: "Failed to parse ML model output",
              });
            }
          } else {
            // Try next Python command
            currentCommandIndex++;
            tryNextPythonCommand();
          }
        });

        pythonProcess.on("error", (error) => {
          logger.error(
            `❌ Failed to start Python process with ${pythonCmd}:`,
            error.message
          );
          currentCommandIndex++;
          tryNextPythonCommand();
        });
      }

      tryNextPythonCommand();
    } catch (error) {
      logger.error("❌ Exception in callPythonMLModel:", error);
      resolve({ success: false, error: error.message });
    }
  });
}

// Fallback function with original hardcoded logic
function getFallbackPrediction(score, time_taken, userId, subject, mlError) {
  logger.info("🔄 Using fallback prediction logic");

  let predicted_difficulty = "Medium"; // default
  let confidence = 70;

  // Calculate performance ratio (score per minute)
  const performance_ratio = score / Math.max(1, time_taken / 60);

  // Enhanced difficulty determination logic
  if (score >= 85 && time_taken <= 300) {
    predicted_difficulty = "Hard";
    confidence = 85;
  } else if (score >= 80 && performance_ratio > 2.5) {
    predicted_difficulty = "Hard";
    confidence = 80;
  } else if (score >= 90) {
    predicted_difficulty = "Hard";
    confidence = 88;
  } else if (score >= 70 && time_taken <= 600 && performance_ratio > 1.8) {
    predicted_difficulty = "Medium";
    confidence = 75;
  } else if (score >= 60 && performance_ratio > 1.5) {
    predicted_difficulty = "Medium";
    confidence = 72;
  } else if (score <= 50 || time_taken >= 900) {
    predicted_difficulty = "Easy";
    confidence = 78;
  } else {
    predicted_difficulty = "Easy";
    confidence = 65;
  }

  const response = {
    success: true,
    predicted_difficulty: predicted_difficulty,
    confidence: confidence,
    factors: {
      score: score,
      time_taken: time_taken,
      performance_ratio: Math.round(performance_ratio * 100) / 100,
    },
    suggestion: getDifficultyExplanation(predicted_difficulty.toLowerCase()),
    model_used: "Fallback_Rules",
    ml_error: mlError,
    debug: {
      fallback_reason: "ML model unavailable or failed",
      timestamp: new Date().toISOString(),
    },
  };

  logger.debug("📋 Sending fallback response");
  return Response.json(response, { status: 200 });
}

// Helper function for explanations
function getDifficultyExplanation(difficulty) {
  const explanations = {
    easy: "Based on your performance, an easier test will help build confidence and reinforce fundamental concepts. Focus on mastering the basics before moving to harder challenges.",
    medium:
      "Your performance suggests you're ready for a moderate challenge that will push your skills further. This level should provide good learning opportunities without being overwhelming.",
    hard: "Your strong performance indicates you're ready for a challenging test that will test advanced concepts and problem-solving skills. You've demonstrated mastery of the fundamentals.",
  };

  return explanations[difficulty.toLowerCase()] || explanations.medium;
}

// Handle GET requests - provide API information
export async function GET() {
  return Response.json(
    {
      message: "AI Difficulty Prediction API",
      version: "2.0",
      methods: ["POST"],
      required_fields: ["score", "time_taken"],
      optional_fields: ["userId", "subject"],
      models: {
        primary: "ML_DecisionTree",
        fallback: "Rule_Based_Logic",
      },
      input_ranges: {
        score: "0-100",
        time_taken: "positive number (seconds)",
      },
      description:
        "Predicts optimal test difficulty using trained ML model with intelligent fallback",
      endpoints: {
        "POST /predict-difficult": "Get difficulty prediction",
        "GET /predict-difficult": "API information",
      },
    },
    { status: 200 }
  );
}
