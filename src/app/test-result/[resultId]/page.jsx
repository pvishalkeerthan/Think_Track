"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getTestResult } from "@/actions/testActions";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Loader2 } from "lucide-react";

const TestResultPage = ({ params }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [askModal, setAskModal] = useState({
    open: false,
    qIndex: null,
    confusion: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      toast.error("Please log in to view test results");
      router.push("/signin");
    } else if (status === "authenticated") {
      fetchTestResult();
    }
  }, [status, router, params.resultId]);

  const fetchTestResult = async () => {
    if (!session?.user?.id) return;
    const testResult = await getTestResult(params.resultId, session.user.id);
    if (testResult.success) {
      setResult(testResult.data);
    } else {
      toast.error(testResult.error || "Failed to fetch test result");
      router.push("/");
    }
  };

  if (status === "loading" || !result) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative pb-6">
      {" "}
      <div className="absolute top-4 right-4">
        <Link href="/dashboard">
          <Button
            variant="secondary"
            className="bg-black text-white hover:bg-black dark:bg-white dark:text-black"
          >
            Back to Dashboard
          </Button>
        </Link>
      </div>
      {/* Main Content */}
      <div className="container mx-auto max-w-3xl px-6">
        <h1 className="text-3xl font-bold mb-6 p-4">Test Result</h1>
        <div className="flex gap-2 px-4 mb-4">
          <Link href="/doubts">
            <Button
              variant="outline"
              className="border-emerald-500 text-emerald-600 dark:text-emerald-400"
            >
              Browse Doubts
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button
              variant="outline"
              className="border-amber-500 text-amber-600 dark:text-amber-400"
            >
              Leaderboard
            </Button>
          </Link>
        </div>
        <div className="bg-white text-black dark:bg-zinc-900 dark:text-white shadow-md rounded-xl p-6 mb-6">
          <p className="text-2xl font-semibold mb-2">Score: {result.score}%</p>
          <p>Correct Answers: {result.correctAnswers}</p>
          <p>Wrong Answers: {result.wrongAnswers}</p>
        </div>

        <h2 className="text-2xl font-bold mb-4 px-4">Analysis</h2>
        <div className="bg-white text-black dark:bg-zinc-900 dark:text-white shadow-md rounded-xl p-6 mb-6">
          <p>{result.analysis}</p>
        </div>

        <h2 className="text-2xl font-bold mb-1 px-4">Question Details</h2>
        {result.wrongAnswers > 0 && (
          <div className="px-4 mb-4 text-sm text-gray-600 dark:text-gray-300">
            Got {result.wrongAnswers} wrong? Select a question and ask a doubt.
          </div>
        )}

        {result.questions && result.questions.length > 0 ? (
          result.questions.map((question, index) => (
            <div
              key={index}
              className="bg-white text-black dark:bg-zinc-900 dark:text-white shadow-md rounded-xl p-6 mb-6"
            >
              <h3 className="text-xl font-semibold mb-2">
                Question {index + 1}
              </h3>
              <p className="mb-2">{question.questionText}</p>

              {/* Display Options */}
              <div className="mb-4">
                <p className="font-semibold">Options:</p>
                <ul className="list-disc ml-5">
                  {question.options.map((option, idx) => (
                    <li key={idx}>{option}</li>
                  ))}
                </ul>
              </div>

              <p className="mb-1">
                Your Answer:{" "}
                <span className="font-semibold">{question.userAnswer}</span>
              </p>
              <p className="mb-1">
                Correct Answer:{" "}
                <span className="font-semibold">{question.correctAnswer}</span>
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
                {question.isCorrect ? "✓ Correct" : "✗ Incorrect"}
              </p>
              {question.explanation && (
                <p className="mt-2 text-gray-500 dark:text-gray-300">
                  Explanation: {question.explanation}
                </p>
              )}
              {!question.isCorrect && (
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    className="bg-black text-white hover:bg-black dark:bg-white dark:text-black"
                    onClick={() =>
                      setAskModal({ open: true, qIndex: index, confusion: "" })
                    }
                  >
                    Ask a Doubt
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p>No questions found for this test.</p>
        )}
      </div>
      {askModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white text-black dark:bg-zinc-900 dark:text-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-semibold mb-2">Ask a Doubt</h3>
            <p className="text-sm mb-4">
              Describe where you got stuck. We'll generate an instant AI mentor
              response and share it in the community doubts.
            </p>
            <textarea
              className="w-full p-3 rounded border dark:bg-zinc-800"
              rows={4}
              value={askModal.confusion}
              onChange={(e) =>
                setAskModal((m) => ({ ...m, confusion: e.target.value }))
              }
              placeholder="Your confusion (optional but helpful)"
            />
            <div className="mt-4 flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() =>
                  setAskModal({ open: false, qIndex: null, confusion: "" })
                }
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (askModal.qIndex == null) return;
                  setSubmitting(true);
                  try {
                    const q = result.questions[askModal.qIndex];
                    const res = await fetch("/api/doubts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        questionText: q.questionText,
                        userAnswer: q.userAnswer,
                        correctAnswer: q.correctAnswer,
                        confusion: askModal.confusion,
                        relatedTestResultId: result.id,
                        relatedQuestionIndex: askModal.qIndex,
                      }),
                    });
                    const data = await res.json();
                    if (!data.success)
                      throw new Error(data.error || "Failed to post doubt");
                    toast.success(
                      "Doubt posted! AI mentor responded instantly."
                    );
                    router.push(`/doubts/${data.data._id}`);
                  } catch (e) {
                    toast.error(e.message || "Failed to create doubt");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestResultPage;
