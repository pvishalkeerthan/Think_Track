"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import TestQuestion from "@/components/TestQuestion";
import CountdownTimer from "@/components/ui/CountdownTimer";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { MultiStepLoader } from "@/components/ui/multi-step-loader";

export default function DailyChallengePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [challenge, setChallenge] = useState<any>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyCompletedData, setAlreadyCompletedData] = useState<any>(null);

  const loadingStates = [
    { text: "Verifying daily challenge..." },
    { text: "Validating your answers..." },
    { text: "Calculating bonus XP..." },
    { text: "Challenge submitted successfully!" },
  ];

  useEffect(() => {
    if (status === "unauthenticated") {
      toast.error("Please log in to take the daily challenge");
      router.push("/signin");
    } else if (status === "authenticated") {
      fetchChallenge();
    }
  }, [status, router]);

  const fetchChallenge = async () => {
    try {
      const res = await fetch("/api/daily-challenge/start");
      const data = await res.json();

      if (res.status === 403) {
        setAlreadyCompletedData(data.challenge);
        return;
      }

      if (res.status !== 200 || !data.challenge) {
        toast.error(data.error || "Failed to load daily challenge");
        router.push("/dashboard");
        return;
      }

      setChallenge(data.challenge);
    } catch (err) {
      toast.error("An error occurred loading the challenge");
      router.push("/");
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!session || !session.user) {
      toast.error("Please log in to submit");
      return;
    }

    const unansweredQuestions = challenge.questions.filter(
      (question: any) => !userAnswers[question._id || question.questionText]
    );

    if (unansweredQuestions.length > 0) {
      toast.error("You must answer all questions");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/daily-challenge/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge._id,
          userAnswers
        })
      });
      const result = await res.json();
      setIsSubmitting(false);

      if (res.ok) {
        toast.success("Daily challenge completed!");
        router.push(`/test-result/${result.resultId}?daily=true`);
      } else {
        toast.error(result.error || "Failed to submit challenge");
      }
    } catch(e) {
      setIsSubmitting(false);
      toast.error("An error occurred");
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < challenge.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleTimeUp = () => {
    toast.error("Time's up! Submitting your challenge.");
    handleSubmit();
  };

  if (status === "loading" || (!challenge && !alreadyCompletedData)) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (alreadyCompletedData) {
    return (
      <div className="container mx-auto max-w-3xl p-6 text-center mt-20">
        <h1 className="text-3xl font-bold mb-4">Challenge Already Completed</h1>
        <p className="mb-4 text-muted-foreground">You have already completed today's challenge: {alreadyCompletedData.topicName}</p>
        <div className="bg-muted p-6 rounded-xl border max-w-sm mx-auto">
          <p className="text-sm font-medium mb-1">Global Average Score</p>
          <p className="text-4xl font-bold text-primary">{Math.round(alreadyCompletedData.globalAverageScore)}%</p>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={() => router.push("/dashboard")} className="sm:w-auto w-full">
            Back to Dashboard
          </Button>
          <Button onClick={() => router.push("/test-start")} className="sm:w-auto w-full">
            Start a regular test
          </Button>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const currentQuestion = challenge.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === challenge.questions.length - 1;
  const questionId = currentQuestion._id || currentQuestion.questionText;

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Daily Challenge</span>
          <h1 className="text-3xl font-bold">{challenge.topicName}</h1>
          <div className="mt-2 text-sm text-muted-foreground">
            <strong>Difficulty:</strong> <span className="capitalize">{challenge.difficulty}</span> &nbsp;|&nbsp; 
            <strong>Bonus:</strong> {challenge.bonusXP} XP
          </div>
        </div>
        <CountdownTimer timeLimit={10} onTimeUp={handleTimeUp} />
      </div>

      <div className="space-y-8">
        <TestQuestion
          key={questionId}
          question={{...currentQuestion, text: currentQuestion.questionText, _id: questionId}}
          index={currentQuestionIndex}
          onChange={(answer: string) => handleAnswerChange(questionId, answer)}
          userAnswer={userAnswers[questionId]}
        />
      </div>

      <div className="mt-8 flex justify-between">
        {currentQuestionIndex > 0 && (
          <Button onClick={handlePrevious} className="w-1/2 mr-2 border">
            Previous
          </Button>
        )}
        {!isLastQuestion ? (
          <Button onClick={handleNext} className={currentQuestionIndex === 0 ? "w-full" : "w-1/2 ml-2"}>
            Next Question
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={currentQuestionIndex === 0 ? "w-full" : "w-1/2 ml-2"}
          >
            {isSubmitting ? "Submitting..." : "Submit Challenge"}
          </Button>
        )}
      </div>

      <MultiStepLoader
        loading={isSubmitting}
        loadingStates={loadingStates}
        duration={2000}
        loop={false}
      />
    </div>
  );
}
