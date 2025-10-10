"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTest } from "@/actions/testActions";
import toast from "react-hot-toast";
import Link from "next/link";
// import Lottie from 'lottie-react';  // TEMPORARILY COMMENTED OUT
// import loadingAnimation from '../../../public/loading2.json';  // TEMPORARILY COMMENTED OUT
// import loadingAnimationDark from '../../../public/loading.json';  // TEMPORARILY COMMENTED OUT

const TestStartPage = () => {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [userPerformanceData, setUserPerformanceData] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [aiServiceStatus, setAiServiceStatus] = useState("checking"); // 'checking', 'available', 'fallback'
  const router = useRouter();

  const [testDetails, setTestDetails] = useState({
    title: "",
    description: "",
    numQuestions: 10,
    difficulty: "medium",
    timeLimit: 30,
    tags: "",
  });

  // Simple client-side check
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Function to fetch user's performance data
  const fetchUserPerformance = async () => {
    try {
      const res = await fetch("/api/user-performance", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch performance data: ${res.status}`);
      }

      const data = await res.json();
      console.log("User Performance Data:", data);

      if (data.success) {
        setUserPerformanceData(data.data);
        return data.data;
      } else {
        throw new Error("Invalid response format from performance API");
      }
    } catch (err) {
      console.error("Failed to fetch user performance:", err);
      return {
        averageScore: 65,
        averageTimePerQuestion: 45,
        totalTests: 0,
        difficultyPerformance: {},
        performanceTrends: { improving: false, stable: true, declining: false },
      };
    }
  };

  // Function to fetch AI predicted difficulty
  const fetchAIPredictedDifficulty = async (performanceData) => {
    setIsLoadingAI(true);
    try {
      const requestData = {
        score: performanceData.averageScore || 65,
        time_taken: performanceData.averageTimePerQuestion || 45,
        userId: session?.user?.id || null,
        subject: testDetails.tags || "general",
        totalTests: performanceData.totalTests || 0,
        difficultyPerformance: performanceData.difficultyPerformance || {},
        performanceTrends: performanceData.performanceTrends || {
          stable: true,
        },
        learningPattern: performanceData.learningPattern || "balanced_learner",
        recommendedDifficulty: performanceData.recommendedDifficulty,
      };

      const res = await fetch("/api/predict-difficulty", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.predicted_difficulty) {
        setAiServiceStatus("available");
        setTestDetails((prev) => ({
          ...prev,
          difficulty: data.predicted_difficulty.toLowerCase(),
        }));

        // Show success message with confidence and reasoning
        const confidenceText = data.confidence
          ? ` (${data.confidence}% confidence)`
          : "";
        const reasoningText = data.suggestion ? ` - ${data.suggestion}` : "";

        // Show toast with SSR safety
        if (typeof window !== "undefined") {
          toast.success(
            `AI suggested "${data.predicted_difficulty}" difficulty${confidenceText}${reasoningText}`,
            {
              position: "top-center",
              duration: 5000,
            }
          );
        }
      }
    } catch (err) {
      console.error("AI prediction failed:", err);
      setAiServiceStatus("fallback");
      const fallbackDifficulty = getFallbackDifficulty(performanceData);
      if (fallbackDifficulty !== testDetails.difficulty) {
        setTestDetails((prev) => ({
          ...prev,
          difficulty: fallbackDifficulty,
        }));
        if (typeof window !== "undefined") {
          toast.success(
            `Based on your performance, we recommend "${fallbackDifficulty}" difficulty`,
            {
              position: "top-center",
              duration: 4000,
            }
          );
        }
      } else {
        if (typeof window !== "undefined") {
          toast.error(
            "Failed to get AI difficulty suggestion. Using your current selection.",
            {
              position: "top-center",
              duration: 3000,
            }
          );
        }
      }
    } finally {
      setIsLoadingAI(false);
    }
  };

  const getFallbackDifficulty = (performanceData) => {
    if (!performanceData || performanceData.totalTests === 0) {
      return "medium";
    }

    if (performanceData.recommendedDifficulty) {
      return performanceData.recommendedDifficulty;
    }

    const avgScore = performanceData.averageScore;
    if (avgScore >= 80) {
      return "hard";
    } else if (avgScore >= 60) {
      return "medium";
    } else {
      return "easy";
    }
  };

  useEffect(() => {
    if (!isClient) return;

    if (status === "unauthenticated") {
      if (typeof window !== "undefined") {
        toast.error("Please log in to create a test", {
          duration: 3000,
          position: "top-center",
        });
      }
      router.push("/signin");
      return;
    }

    if (status === "authenticated") {
      fetchUserPerformance().then((performanceData) => {
        fetchAIPredictedDifficulty(performanceData);
      });
    }
  }, [status, router, isClient]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTestDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await createTest(testDetails);

      if (response.success) {
        console.log("Test created successfully with ID:", response.testId);
        if (typeof window !== "undefined") {
          toast.success(response.message || "Test created successfully!", {
            position: "top-center",
            duration: 3000,
          });
        }
        router.push(`/test/${response.testId}`);
      } else {
        if (typeof window !== "undefined") {
          // Show more specific error messages
          const errorMessage =
            response.error || "Failed to create test. Please try again.";
          toast.error(errorMessage, {
            position: "top-center",
            duration: 5000,
          });
        }
      }
    } catch (error) {
      console.error("Error creating test:", error);
      if (typeof window !== "undefined") {
        // Check if it's an API-related error
        const errorMessage =
          error.message?.includes("overloaded") ||
          error.message?.includes("503")
            ? "AI service is temporarily busy. Your test will use fallback questions."
            : "An unexpected error occurred. Please try again.";

        toast.error(errorMessage, {
          position: "top-center",
          duration: 5000,
        });
      }
    }

    setIsLoading(false);
  };

  const refreshAIRecommendation = async () => {
    if (userPerformanceData) {
      await fetchAIPredictedDifficulty(userPerformanceData);
    }
  };

  if (!isClient || status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (isLoading) {
    // SIMPLIFIED LOADING WITHOUT LOTTIE
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-white dark:bg-black fixed top-0 left-0 z-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-lg text-gray-800 dark:text-white">
          Creating test...
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Link href="/dashboard" className="right-4 z-10 flex justify-end">
        <Button
          variant="secondary"
          className="bg-black text-white dark:bg-white dark:text-black"
        >
          Back to Dashboard
        </Button>
      </Link>

      <div className="bg-white dark:bg-black border dark:border-zinc-800 shadow-lg rounded-lg p-6 mt-12">
        <h1 className="text-3xl font-bold mb-6">Initialize Test</h1>

        {/* AI Service Status Indicator */}
        <div className="mb-6 p-3 rounded-lg border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  aiServiceStatus === "checking"
                    ? "bg-yellow-500 animate-pulse"
                    : aiServiceStatus === "available"
                    ? "bg-green-500"
                    : "bg-orange-500"
                }`}
              ></div>
              <span className="text-sm font-medium">
                {aiServiceStatus === "checking"
                  ? "Checking AI service..."
                  : aiServiceStatus === "available"
                  ? "AI service available"
                  : "Using fallback mode"}
              </span>
            </div>
            {aiServiceStatus === "fallback" && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                AI temporarily unavailable
              </span>
            )}
          </div>
        </div>

        {userPerformanceData && userPerformanceData.totalTests > 0 && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-neutral-900 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">
              Your Performance Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Average Score:
                </span>
                <p className="font-medium">
                  {userPerformanceData.averageScore?.toFixed(1)}%
                </p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Tests Taken:
                </span>
                <p className="font-medium">{userPerformanceData.totalTests}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Avg Time/Question:
                </span>
                <p className="font-medium">
                  {userPerformanceData.averageTimePerQuestion}s
                </p>
              </div>
            </div>
            {userPerformanceData.performanceTrends && (
              <div className="mt-2">
                <span className="text-gray-600 dark:text-gray-400">Trend:</span>
                <span
                  className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    userPerformanceData.performanceTrends.improving
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : userPerformanceData.performanceTrends.declining
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  }`}
                >
                  {userPerformanceData.performanceTrends.improving
                    ? "Improving"
                    : userPerformanceData.performanceTrends.declining
                    ? "Needs Focus"
                    : "Stable"}
                </span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="title">Test Title</Label>
            <Input
              id="title"
              name="title"
              value={testDetails.title}
              onChange={handleInputChange}
              required
              className="dark:bg-neutral-800 dark:text-white"
              placeholder="Enter test title"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              value={testDetails.description}
              onChange={handleInputChange}
              required
              className="dark:bg-neutral-800 dark:text-white"
              placeholder="Enter test description"
            />
          </div>

          <div>
            <Label htmlFor="numQuestions">Number of Questions</Label>
            <Input
              type="number"
              id="numQuestions"
              name="numQuestions"
              value={testDetails.numQuestions}
              onChange={handleInputChange}
              min="1"
              max="50"
              required
              className="dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refreshAIRecommendation}
                disabled={isLoadingAI}
                className="text-xs"
              >
                {isLoadingAI ? "Analyzing..." : "Refresh AI Suggestion"}
              </Button>
            </div>
            <select
              id="difficulty"
              name="difficulty"
              value={testDetails.difficulty}
              onChange={handleInputChange}
              className="w-full mt-1 rounded-md border border-gray-300 dark:border-neutral-600 shadow-sm px-4 py-2 bg-white dark:bg-neutral-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              {isLoadingAI
                ? "AI is analyzing your performance..."
                : userPerformanceData && userPerformanceData.totalTests > 0
                ? "AI recommendation based on your test history."
                : "Default difficulty for new users."}
            </p>
          </div>

          <div>
            <Label htmlFor="timeLimit">
              Time Limit (minutes): {testDetails.timeLimit}
            </Label>
            <input
              type="range"
              id="timeLimit"
              name="timeLimit"
              value={testDetails.timeLimit}
              onChange={handleInputChange}
              min="5"
              max="180"
              step="5"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5 min</span>
              <span>180 min</span>
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              name="tags"
              value={testDetails.tags}
              onChange={handleInputChange}
              placeholder="e.g., math, science, history"
              className="dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating test..." : "Create Test With AI"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default TestStartPage;
