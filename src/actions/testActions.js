"use server";

import { generateQuestions, verifyTestWithGemini } from "@/lib/gemini";

import Test from "@/models/Test";
import TestResult from "@/models/TestResult";
import dbConnect from "@/lib/dbConnect";
import { awardXP, calculateXP, processTestCompletion } from "@/lib/gamification";
import User from "@/models/user.model";

export async function createTest(testDetails) {
  try {
    await dbConnect();

    let questions = await generateQuestions(testDetails);
    // Reduced console noise

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Invalid questions generated");
    }

    // Normalize AI outputs to ensure they match our schema ("text")
    questions = questions.map(q => ({
      text: q.text || q.questionText || q.question || "Generated question (Error mapping text)",
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer || q.answer || q.correct_answer || ""
    }));

    const newTest = new Test({
      ...testDetails,
      questions: questions,
    });

    await newTest.save();
    // Reduced console noise

    return {
      success: true,
      testId: newTest._id.toString(),
      message: "Test created successfully!",
    };
  } catch (error) {
    // Avoid console noise; return structured error
    return {
      success: false,
      error: error.message || "Failed to create test. Please try again.",
    };
  }
}

export async function getTestById(testId) {
  try {
    await dbConnect();
    if (testId.toString().startsWith("community-")) {
      const topic = testId.replace("community-", "");
      const CommunityQuestion = (await import("@/models/CommunityQuestion")).default;
      const questions = await CommunityQuestion.find({ topic, approved: true }).lean();
      if (questions.length === 0) return null;

      return {
        _id: testId,
        title: `Community: ${topic.replace(/-/g, " ")}`,
        description: `Curated questions from the community about ${topic}.`,
        difficulty: "medium",
        timeLimit: questions.length * 2,
        tags: [topic],
        questions: questions.map(q => ({
          _id: q._id.toString(),
          text: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer
        }))
      };
    }

    const test = await Test.findById(testId);
    // Removed unnecessary debug log
    if (!test) {
      return null;
    }

    return JSON.parse(JSON.stringify(test));
  } catch (error) {
    // Let caller handle fetch error
    return null;
  }
}

export async function submitTest(testId, userAnswers, userId) {
  try {
    await dbConnect();
    let test;
    if (testId.toString().startsWith("community-")) {
      const topic = testId.replace("community-", "");
      const CommunityQuestion = (await import("@/models/CommunityQuestion")).default;
      const questions = await CommunityQuestion.find({ topic, approved: true }).lean();
      
      test = {
        _id: testId,
        difficulty: "medium",
        tags: [topic],
        questions: questions.map(q => ({
          _id: q._id.toString(),
          text: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer
        }))
      };
    } else {
      test = await Test.findById(testId);
    }

    if (!test) {
      // Avoid console noise for normal not-found condition
      return { success: false, error: "Test not found" };
    }

    // Reduced console noise
    let geminiResult;
    try {
      geminiResult = await verifyTestWithGemini(test, userAnswers);
      // Reduced console noise
    } catch (error) {
      // Return structured error
      return { success: false, error: "Failed to verify test results" };
    }

    // Normalize questionsFormat to ensure no undefined fields
    const questionsFormat = test.questions.map((question, index) => ({
      questionText: question.text || "Question text unavailable",
      options: question.options || [],
      correctAnswer: question.correctAnswer || "Unavailable",
      userAnswer: userAnswers[question._id] || "No answer",
      isCorrect: geminiResult?.questionResults?.[index]?.isCorrect ?? false,
      explanation: geminiResult?.questionResults?.[index]?.explanation ?? "No explanation available",
    }));
    // Removed debug print

    const testResult = new TestResult({
      userId: userId,
      testId: testId,
      difficulty: test.difficulty, // Include difficulty level
      score: geminiResult.score,
      correctAnswers: geminiResult.correctAnswers,
      wrongAnswers: geminiResult.wrongAnswers,
      analysis: geminiResult.analysis,
      questions: questionsFormat,
      userAnswers: userAnswers,
    });
    // Reduced console noise
    await testResult.save();

    // Derive the quiz topic slug (lowercase + hyphens) for mastery tracking.
    const parsedTags =
      typeof test.tags === "string"
        ? test.tags.split(",")[0].trim()
        : Array.isArray(test.tags)
          ? test.tags[0]
          : "general";
    const topicSlug = (parsedTags || "general")
      .toLowerCase()
      .replace(/\s+/g, "-");

    // Update mastery + streak first, so any streak milestone XP is computed correctly.
    try {
      console.log("[processTestCompletion] inputs:", {
        userId,
        topicSlug,
        score: geminiResult?.score,
      });
      await processTestCompletion(userId, geminiResult.score, topicSlug);
    } catch (e) {
      console.error("Mastery tracking error:", e);
      throw e;
    }

    // Post-call verification: ensure streak + topic mastery updated.
    const verificationUser = await User.findById(userId).lean();
    const topicMasteryAny = verificationUser?.topicMasteryMap || {};
    const hasTopicMastery = Boolean(
      (topicMasteryAny.get && topicMasteryAny.get(topicSlug)) ||
        topicMasteryAny[topicSlug]
    );
    if (!verificationUser?.streak || !hasTopicMastery) {
      throw new Error(
        "processTestCompletion verification failed: streak or topicMasteryMap not updated"
      );
    }

    // Award XP using unified formula (base + daily bonus + streak milestones).
    // Note: Streak milestones are calculated based on the updated `user.streak`.
    try {
      const updatedUser = await User.findById(userId).lean();
      const badgeCodes = new Set((updatedUser?.badges || []).map((b) => b.code));
      const streakMilestone7 =
        (updatedUser?.streak || 0) >= 7 && !badgeCodes.has("STREAK_7");
      const streakMilestone30 =
        (updatedUser?.streak || 0) >= 30 && !badgeCodes.has("STREAK_30");

      const xp = calculateXP({
        score: geminiResult.score,
        isDailyChallenge: false,
        streakMilestone7,
        streakMilestone30,
      });

      const awarded = await awardXP(userId, xp);
      if (awarded) {
        testResult.xpEarned = awarded.xpEarned;
        testResult.bonusXP = awarded.bonusXP;
        await testResult.save();
      }
    } catch (e) {
      // Non-fatal; avoid noisy console
    }

    return { success: true, resultId: testResult._id.toString() };
  } catch (error) {
    // Return structured error
    return { success: false, error: error.message || "Failed to submit test" };
  }
}

export async function getTestResult(resultId, userId) {
  try {
    await dbConnect();

    const testResult = await TestResult.findOne({
      _id: resultId,
      userId: userId,
    })
    .populate({
      path: "testId",
      select: "title questions",
    })
    .populate({
      path: "dailyChallengeId",
      select: "topicName questions",
    });

    if (!testResult) {
      return { success: false, error: "Test result not found" };
    }

    // Combine test result data with test questions
    const combinedData = {
      id: testResult._id.toString(),
      title: testResult.testId?.title || testResult.dailyChallengeId?.topicName || "Daily Challenge",
      date: testResult.createdAt,
      score: testResult.score,
      xpEarned: testResult.xpEarned || 0,
      bonusXP: testResult.bonusXP || 0,
      correctAnswers: testResult.correctAnswers,
      wrongAnswers: testResult.wrongAnswers,
      analysis: testResult.analysis,
      topicSlug: testResult.topicSlug,
      questions: testResult.questions.map((question, index) => ({
        questionText: question.questionText,
        options: question.options,
        userAnswer: question.userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: question.isCorrect,
        explanation: question.explanation,
      })),
      userAnswers: Array.from(testResult.userAnswers.entries()), 
    };

    return {
      success: true,
      data: combinedData,
    };
  } catch (error) {
    // Let caller handle error
    return { success: false, error: "Failed to fetch test result" };
  }
}

export const getUserTests = async (userId) => {
  try {
    await dbConnect();
    const testResults = await TestResult.find({ userId: userId })
      .populate("testId", "title")
      .sort({ createdAt: -1 });

    if (testResults.length === 0) {
      // No console noise for empty state
    }

    return testResults.map((result) => ({
      id: result._id.toString(),
      title: result.testId?.title || "Untitled Test",
      date: result.createdAt,
      score: result.score,
    }));
  } catch (error) {
    // Let caller handle error
    return [];
  }
};

export async function getAllTests() {
  try {
    await dbConnect();
    const tests = await Test.find(
      { isDeleted: { $ne: true } },
      {
        _id: 1,
        title: 1,
        description: 1,
        duration: 1,
        difficulty: 1,
        numQuestions: { $size: "$questions" },
      }
    ).sort({ createdAt: -1 });

    return JSON.parse(JSON.stringify(tests));
  } catch (error) {
    // Throw for upstream handling
    throw new Error("Failed to fetch tests");
  }
}

export const getTestStats = async (userId) => {
  try {
    await dbConnect();

    const stats = await TestResult.aggregate([
      { $match: { userId: userId } },
      {
        $lookup: {
          from: "tests",
          localField: "testId",
          foreignField: "_id",
          as: "testDetails",
        },
      },
      { $unwind: "$testDetails" },
      {
        $group: {
          _id: "$testDetails.difficulty",
          count: { $sum: 1 },
        },
      },
    ]);

    const easyCount = stats.find((stat) => stat._id === "easy")?.count || 0;
    const mediumCount = stats.find((stat) => stat._id === "medium")?.count || 0;
    const hardCount = stats.find((stat) => stat._id === "hard")?.count || 0;

    return {
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
    };
  } catch (error) {
    // Let caller handle error
    return { easy: 0, medium: 0, hard: 0 };
  }
};
