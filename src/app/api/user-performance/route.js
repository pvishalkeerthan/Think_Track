export const dynamic = 'force-dynamic';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/authOptions';
import TestResult from "@/models/TestResult";
import dbConnect from "@/lib/dbConnect";

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Fetch user's past test results with better sorting and limiting
    const testResults = await TestResult.find({ 
      userId: session.user.id 
    })
    .sort({ createdAt: -1 })
    .limit(50) // Limit to last 50 tests for performance
    .lean(); // Use lean for better performance

    if (testResults.length === 0) {
      return Response.json({ 
        success: true, 
        data: {
          averageScore: null,
          averageTimePerQuestion: null,
          totalTests: 0,
          difficultyPerformance: {},
          recentPerformance: [],
          performanceTrends: {
            improving: false,
            stable: true,
            declining: false
          }
        }
      });
    }

    // Calculate comprehensive performance metrics
    const totalTests = testResults.length;
    const totalScore = testResults.reduce((sum, result) => sum + result.score, 0);
    const averageScore = totalScore / totalTests;

    // Use real timing data if available, otherwise estimate
    const totalTimeSpent = testResults.reduce((sum, result) => {
      if (result.averageTimePerQuestion) {
        return sum + result.averageTimePerQuestion;
      }
      // Fallback estimation based on difficulty
      const estimatedTime = result.difficulty === 'easy' ? 30 : 
      result.difficulty === 'medium' ? 45 : 60;
      return sum + estimatedTime;
    }, 0);
    
    const averageTimePerQuestion = totalTimeSpent / totalTests;

    // Calculate performance by difficulty with more detailed metrics
    const difficultyPerformance = testResults.reduce((acc, result) => {
      if (!acc[result.difficulty]) {
        acc[result.difficulty] = { 
          scores: [], 
          times: [],
          count: 0,
          totalQuestions: 0
        };
      }
      acc[result.difficulty].scores.push(result.score);
      acc[result.difficulty].times.push(result.averageTimePerQuestion || 45);
      acc[result.difficulty].count++;
      acc[result.difficulty].totalQuestions += (result.correctAnswers + result.wrongAnswers);
      return acc;
    }, {});

    // Calculate averages and performance metrics by difficulty
    Object.keys(difficultyPerformance).forEach(difficulty => {
      const data = difficultyPerformance[difficulty];
      data.averageScore = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
      data.averageTime = data.times.reduce((sum, time) => sum + time, 0) / data.times.length;
      data.successRate = data.averageScore / 100; // Convert to rate
      
      // Performance rating based on score and time efficiency
      const timeEfficiency = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 45 : 60;
      const efficiencyRatio = timeEfficiency / data.averageTime;
      data.performanceRating = (data.successRate * 0.7) + (Math.min(efficiencyRatio, 2) * 0.3);
    });

    // Get recent performance trend (last 10 tests)
    const recentTests = testResults.slice(0, 10);
    const recentPerformance = recentTests.map(result => ({
      score: result.score,
      difficulty: result.difficulty,
      timePerQuestion: result.averageTimePerQuestion || 45,
      date: result.createdAt,
      accuracy: result.performanceMetrics?.accuracyRate || ((result.correctAnswers / (result.correctAnswers + result.wrongAnswers)) * 100)
    }));

    // Analyze performance trends
    const performanceTrends = analyzePerformanceTrends(recentTests);

    // Calculate subject-specific performance if tags are available
    const subjectPerformance = calculateSubjectPerformance(testResults);

    // Determine user's learning pattern
    const learningPattern = determineLearningPattern(testResults);

    return Response.json({
      success: true,
      data: {
        averageScore: Math.round(averageScore * 100) / 100,
        averageTimePerQuestion: Math.round(averageTimePerQuestion),
        totalTests,
        difficultyPerformance,
        recentPerformance,
        performanceTrends,
        subjectPerformance,
        learningPattern,
        // Additional insights for AI prediction
        strengthsAndWeaknesses: identifyStrengthsAndWeaknesses(difficultyPerformance),
        recommendedDifficulty: recommendDifficulty(difficultyPerformance, performanceTrends)
      }
    });

  } catch (error) {
    console.error("Error fetching user performance:", error);
    return Response.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

// Helper function to analyze performance trends
function analyzePerformanceTrends(recentTests) {
  if (recentTests.length < 3) {
    return { improving: false, stable: true, declining: false };
  }

  const scores = recentTests.map(test => test.score);
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));

  const firstHalfAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;

  const improvement = secondHalfAvg - firstHalfAvg;
  const improvementThreshold = 5; // 5% improvement threshold

  if (improvement > improvementThreshold) {
    return { improving: true, stable: false, declining: false };
  } else if (improvement < -improvementThreshold) {
    return { improving: false, stable: false, declining: true };
  } else {
    return { improving: false, stable: true, declining: false };
  }
}

// Helper function to calculate subject-specific performance
function calculateSubjectPerformance(testResults) {
  const subjectPerformance = {};
  
  testResults.forEach(result => {
    // You'll need to add subject/tags to your test results
    // For now, we'll use a default approach
    const subject = 'general'; // Replace with actual subject from test data
    
    if (!subjectPerformance[subject]) {
      subjectPerformance[subject] = {
        scores: [],
        count: 0,
        averageScore: 0
      };
    }
    
    subjectPerformance[subject].scores.push(result.score);
    subjectPerformance[subject].count++;
  });

  // Calculate averages
  Object.keys(subjectPerformance).forEach(subject => {
    const data = subjectPerformance[subject];
    data.averageScore = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
  });

  return subjectPerformance;
}

// Helper function to determine learning pattern
function determineLearningPattern(testResults) {
  if (testResults.length < 5) {
    return 'insufficient_data';
  }

  const timeSpentData = testResults.map(result => result.averageTimePerQuestion || 45);
  const scoreData = testResults.map(result => result.score);

  // Calculate correlation between time spent and performance
  const avgTime = timeSpentData.reduce((sum, time) => sum + time, 0) / timeSpentData.length;
  const avgScore = scoreData.reduce((sum, score) => sum + score, 0) / scoreData.length;

  let correlation = 0;
  let numerator = 0;
  let denominator1 = 0;
  let denominator2 = 0;

  for (let i = 0; i < timeSpentData.length; i++) {
    const timeDeviation = timeSpentData[i] - avgTime;
    const scoreDeviation = scoreData[i] - avgScore;
    
    numerator += timeDeviation * scoreDeviation;
    denominator1 += timeDeviation * timeDeviation;
    denominator2 += scoreDeviation * scoreDeviation;
  }

  if (denominator1 * denominator2 > 0) {
    correlation = numerator / Math.sqrt(denominator1 * denominator2);
  }

  // Determine pattern based on correlation
  if (correlation > 0.3) {
    return 'thorough_learner'; // Takes time but performs well
  } else if (correlation < -0.3) {
    return 'quick_learner'; // Fast and accurate
  } else {
    return 'balanced_learner'; // Moderate time and performance
  }
}

// Helper function to identify strengths and weaknesses
function identifyStrengthsAndWeaknesses(difficultyPerformance) {
  const strengths = [];
  const weaknesses = [];

  Object.entries(difficultyPerformance).forEach(([difficulty, data]) => {
    if (data.averageScore > 80) {
      strengths.push(`Strong performance in ${difficulty} questions`);
    } else if (data.averageScore < 60) {
      weaknesses.push(`Needs improvement in ${difficulty} questions`);
    }

    if (data.averageTime < (difficulty === 'easy' ? 25 : difficulty === 'medium' ? 35 : 50)) {
      strengths.push(`Efficient time management in ${difficulty} questions`);
    } else if (data.averageTime > (difficulty === 'easy' ? 40 : difficulty === 'medium' ? 60 : 80)) {
      weaknesses.push(`Could improve speed in ${difficulty} questions`);
    }
  });

  return { strengths, weaknesses };
}

// Helper function to recommend difficulty based on performance
function recommendDifficulty(difficultyPerformance, performanceTrends) {
  // If user is improving, suggest slightly higher difficulty
  if (performanceTrends.improving) {
    if (difficultyPerformance.medium && difficultyPerformance.medium.averageScore > 75) {
      return 'hard';
    } else if (difficultyPerformance.easy && difficultyPerformance.easy.averageScore > 80) {
      return 'medium';
    }
  }

  // If user is declining, suggest slightly lower difficulty
  if (performanceTrends.declining) {
    if (difficultyPerformance.hard && difficultyPerformance.hard.averageScore < 60) {
      return 'medium';
    } else if (difficultyPerformance.medium && difficultyPerformance.medium.averageScore < 60) {
      return 'easy';
    }
  }

  // Default recommendations based on performance
  if (difficultyPerformance.hard && difficultyPerformance.hard.averageScore > 70) {
    return 'hard';
  } else if (difficultyPerformance.medium && difficultyPerformance.medium.averageScore > 70) {
    return 'medium';
  } else {
    return 'easy';
  }
}

