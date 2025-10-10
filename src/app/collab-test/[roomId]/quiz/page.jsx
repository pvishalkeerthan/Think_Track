"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

export default function QuizPage() {
  const { roomId } = useParams();
  const router = useRouter();

  const [room, setRoom] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch("/api/collab-test/get-room", {
          method: "POST",
          body: JSON.stringify({ roomId }),
          headers: {
            "Content-Type": "application/json",
          },
        });
        const data = await res.json();
        setRoom(data.room);
      } catch (err) {
        toast.error("Failed to load quiz room");
      } finally {
        setLoading(false);
        setStartTime(Date.now());
      }
    };

    fetchRoom();
  }, [roomId]);

  const handleSubmitAnswer = async () => {
    if (!selected) {
      toast.error("Please select an option before submitting");
      return;
    }

    setSubmitting(true);
    const question = room.questions[currentQ];
    const isCorrect = selected === question.correctAnswer;
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    try {
      await fetch("/api/collab-test/submit-answer", {
        method: "POST",
        body: JSON.stringify({
          roomId,
          questionIndex: currentQ,
          userAnswer: selected,
          isCorrect,
          timeSpent,
        }),
      });

      setAnswers([
        ...answers,
        { questionIndex: currentQ, selected, isCorrect, timeSpent },
      ]);

      setSelected("");
      setCurrentQ((prev) => prev + 1);
      setStartTime(Date.now());

      // Remove individual answer feedback toasts - only show final completion message
    } catch (err) {
      toast.error("Failed to submit answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = async () => {
    try {
      await fetch("/api/collab-test/complete-test", {
        method: "POST",
        body: JSON.stringify({ roomId }),
      });
      toast.success("Quiz completed successfully!");
      router.push(`/collab-test/${roomId}/result`);
    } catch (err) {
      toast.error("Failed to complete quiz");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Quiz...</p>
        </div>
      </div>
    );
  }

  if (!room || !room.questions?.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <p className="text-gray-700 font-medium">
            No questions found for this quiz.
          </p>
        </div>
      </div>
    );
  }

  // If all questions are answered, show completion before accessing current question
  if (currentQ >= room.questions.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-green-500 text-6xl mb-6">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Quiz Complete!
          </h2>
          <p className="text-gray-600 mb-6">
            Great job! You've answered all questions.
          </p>
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            onClick={handleFinish}
          >
            View Results
          </button>
        </div>
      </div>
    );
  }

  const question = room.questions[currentQ];
  const progress = (currentQ / room.questions.length) * 100;

  // Removed noisy debug logging

  // Safety check - if question doesn't exist or is malformed
  if (!question || !question.text) {
    // Keep UI feedback; avoid console noise
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <p className="text-gray-700 font-medium">
            Question data is missing or corrupted.
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Please try refreshing the page or contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              Question {currentQ + 1} of {room.questions.length}
            </h2>
            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6 leading-relaxed">
            {question.text}
          </h3>

          <div className="space-y-3 mb-8">
            {question.options.map((option, idx) => (
              <label
                key={idx}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                  selected === option
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="option"
                  value={option}
                  checked={selected === option}
                  onChange={(e) => setSelected(e.target.value)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${
                    selected === option
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-gray-300"
                  }`}
                >
                  {selected === option && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <span className="text-gray-700 font-medium">{option}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleSubmitAnswer}
            disabled={submitting || !selected}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
              submitting || !selected
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg"
            }`}
          >
            {submitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Submitting...
              </div>
            ) : (
              "Submit Answer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
