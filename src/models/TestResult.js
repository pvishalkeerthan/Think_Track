import mongoose from "mongoose";

const TestResultSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    correctAnswers: {
      type: Number,
      required: true,
    },
    wrongAnswers: {
      type: Number,
      required: true,
    },
    analysis: {
      type: String,
      required: true,
    },

    // Timing fields — optional for partial results or debugging
    timeStarted: {
      type: Date,
    },
    timeCompleted: {
      type: Date,
    },
    totalTimeSpent: {
      type: Number, // in seconds
    },
    averageTimePerQuestion: {
      type: Number, // in seconds
    },

    // Optional per-question timing breakdown
    questionTimings: [
      {
        questionIndex: {
          type: Number,
        },
        timeSpent: {
          type: Number, // in seconds
        },
      },
    ],

    questions: [
      {
        questionText: {
          type: String,
          required: true,
        },
        options: {
          type: [String],
          required: true,
        },
        correctAnswer: {
          type: String,
          required: true,
        },
        userAnswer: {
          type: String,
          required: true,
        },
        isCorrect: {
          type: Boolean,
          required: true,
        },
        explanation: {
          type: String,
          required: true,
        },
        timeSpent: {
          type: Number, // in seconds
          default: 0,
        },
      },
    ],

    userAnswers: {
      type: Map,
      of: String,
      required: true,
    },

    // Optional: Generated after calculation
    performanceMetrics: {
      accuracyRate: {
        type: Number, // percentage
      },
      speedScore: {
        type: Number, // questions per minute
      },
      consistencyScore: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

// Indexes
TestResultSchema.index({ userId: 1, createdAt: -1 });
TestResultSchema.index({ userId: 1, difficulty: 1 });

// Metric calculation method
TestResultSchema.methods.calculatePerformanceMetrics = function () {
  const totalQuestions = this.correctAnswers + this.wrongAnswers;
  const accuracyRate = (this.correctAnswers / totalQuestions) * 100;
  const speedScore = totalQuestions / (this.totalTimeSpent / 60); // questions per minute

  const timings = this.questions.map((q) => q.timeSpent || 0).filter((t) => t > 0);
  let consistencyScore = 100;

  if (timings.length > 1) {
    const avgTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
    const variance = timings.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);
    consistencyScore = Math.max(0, 100 - (stdDev / avgTime) * 100);
  }

  this.performanceMetrics = {
    accuracyRate: Math.round(accuracyRate * 100) / 100,
    speedScore: Math.round(speedScore * 100) / 100,
    consistencyScore: Math.round(consistencyScore * 100) / 100,
  };

  return this.performanceMetrics;
};

export default mongoose.models.TestResult ||
  mongoose.model("TestResult", TestResultSchema);
