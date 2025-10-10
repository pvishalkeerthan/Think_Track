"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Clock, Trophy } from "lucide-react";

function QuizContent() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subtopic, setSubtopic] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [timeTaken, setTimeTaken] = useState(null);
  const [numCorrect, setNumCorrect] = useState(0);
  const [numAttempted, setNumAttempted] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const course = searchParams.get("topic");
  const weekNum = searchParams.get("week");
  const subtopicNum = searchParams.get("subtopic");

  useEffect(() => {
    if (!course || !weekNum || !subtopicNum) {
      router.push("/ai-learning");
      return;
    }

    const roadmaps = JSON.parse(localStorage.getItem("aiRoadmaps")) || {};
    if (!roadmaps[course]) {
      router.push("/ai-learning");
      return;
    }

    const week = Object.keys(roadmaps[course])[weekNum - 1];
    setTopic(roadmaps[course][week].topic);
    setSubtopic(roadmaps[course][week].subtopics[subtopicNum - 1].subtopic);
    setDescription(
      roadmaps[course][week].subtopics[subtopicNum - 1].description
    );
  }, [course, weekNum, subtopicNum, router]);

  useEffect(() => {
    if (!course || !topic || !subtopic || !description) return;

    const quizzes = JSON.parse(localStorage.getItem("aiQuizzes")) || {};
    const quizKey = `${course}-${weekNum}-${subtopicNum}`;

    if (quizzes[quizKey]) {
      setQuestions(quizzes[quizKey]);
      setLoading(false);
      setStartTime(Date.now());
      return;
    }

    const fetchQuiz = async () => {
      try {
        const response = await fetch("/api/ai-learning/quiz", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            course,
            topic,
            subtopic,
            description,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate quiz");
        }

        const data = await response.json();
        setQuestions(data.questions);

        // Store quiz in localStorage
        quizzes[quizKey] = data.questions;
        localStorage.setItem("aiQuizzes", JSON.stringify(quizzes));

        setLoading(false);
        setStartTime(Date.now());
      } catch (error) {
        console.error("Error fetching quiz:", error);
        alert(
          "An error occurred while fetching the quiz. Please try again later."
        );
        router.push("/ai-learning");
      }
    };

    fetchQuiz();
  }, [course, topic, subtopic, description, weekNum, subtopicNum, router]);

  const handleAnswerSelect = (questionIndex, selectedIndex) => {
    if (showResults) return;

    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: selectedIndex,
    }));

    if (selectedIndex === questions[questionIndex].answerIndex) {
      setNumCorrect((prev) => prev + 1);
    }

    setNumAttempted((prev) => prev + 1);
  };

  const handleSubmit = () => {
    setTimeTaken(Date.now() - startTime);
    setShowResults(true);

    // Save quiz stats
    const quizStats = JSON.parse(localStorage.getItem("aiQuizStats")) || {};
    quizStats[course] = quizStats[course] || {};
    quizStats[course][weekNum] = quizStats[course][weekNum] || {};
    quizStats[course][weekNum][subtopicNum] = {
      numCorrect,
      numQues: questions.length,
      timeTaken: Date.now() - startTime,
    };
    localStorage.setItem("aiQuizStats", JSON.stringify(quizStats));

    // Update hardness index
    const hardnessIndex =
      parseFloat(localStorage.getItem("hardnessIndex")) || 1;
    const newHardnessIndex =
      hardnessIndex +
      ((questions.length - numCorrect) / (questions.length * 2)) *
        ((Date.now() - startTime) / (5 * 60 * 1000 * questions.length));
    localStorage.setItem("hardnessIndex", newHardnessIndex);
  };

  const Question = ({ questionData, index }) => {
    const isCorrect = userAnswers[index] === questionData.answerIndex;
    const isAnswered = userAnswers[index] !== undefined;

    return (
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          <span className="text-blue-500 mr-2">{index + 1}.</span>
          {questionData.question}
        </h3>

        <div className="space-y-3">
          {questionData.options.map((option, optionIndex) => {
            const isSelected = userAnswers[index] === optionIndex;
            const isCorrectAnswer = optionIndex === questionData.answerIndex;

            let optionClass =
              "p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ";

            if (showResults) {
              if (isCorrectAnswer) {
                optionClass += "border-green-500 bg-green-50 text-green-800";
              } else if (isSelected && !isCorrectAnswer) {
                optionClass += "border-red-500 bg-red-50 text-red-800";
              } else {
                optionClass += "border-gray-200 bg-gray-50 text-gray-600";
              }
            } else {
              optionClass += isSelected
                ? "border-blue-500 bg-blue-50 text-blue-800"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50";
            }

            return (
              <div
                key={optionIndex}
                className={optionClass}
                onClick={() => handleAnswerSelect(index, optionIndex)}
              >
                <div className="flex items-center justify-between">
                  <span className="flex-1">{option}</span>
                  {showResults && (
                    <div className="ml-3">
                      {isCorrectAnswer ? (
                        <CheckCircle size={20} className="text-green-500" />
                      ) : isSelected ? (
                        <XCircle size={20} className="text-red-500" />
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {showResults && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Explanation:</h4>
            <p className="text-blue-700">{questionData.reason}</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">
            Generating Personalized Questions for You...
          </h2>
          <p className="text-gray-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() =>
                  router.push(
                    `/ai-learning/roadmap?topic=${encodeURIComponent(course)}`
                  )
                }
                className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors bg-gray-50 hover:bg-gray-100 rounded-xl font-medium"
              >
                ← Back to Roadmap
              </button>
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center px-4 py-2 bg-indigo-50 rounded-full">
                  <Clock size={16} className="mr-2 text-indigo-600" />
                  {startTime && !showResults && (
                    <span className="font-medium">
                      {Math.floor((Date.now() - startTime) / 1000)}s
                    </span>
                  )}
                </div>
                <div className="flex items-center px-4 py-2 bg-purple-50 rounded-full">
                  <Trophy size={16} className="mr-2 text-purple-600" />
                  <span className="font-medium">
                    {numAttempted}/{questions.length} answered
                  </span>
                </div>
              </div>
            </div>

            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
              {subtopic}
            </h1>
            <p className="text-gray-600 text-lg">{description}</p>
          </div>

          {/* Questions */}
          <div className="space-y-6">
            {questions.map((question, index) => (
              <Question key={index} questionData={question} index={index} />
            ))}
          </div>

          {/* Submit Button */}
          {!showResults && (
            <div className="text-center mt-8">
              <button
                onClick={handleSubmit}
                disabled={numAttempted < questions.length}
                className="px-10 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Submit Quiz
              </button>
            </div>
          )}

          {/* Results */}
          {showResults && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mt-8">
              <div className="text-center">
                <div className="text-6xl mb-4">
                  {numCorrect === questions.length
                    ? "🎉"
                    : numCorrect >= questions.length * 0.7
                    ? "�"
                    : "📚"}
                </div>

                <h2 className="text-3xl font-bold text-gray-800 mb-4">
                  Quiz Complete!
                </h2>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {numCorrect}/{questions.length}
                    </div>
                    <div className="text-blue-800 font-semibold">
                      Correct Answers
                    </div>
                  </div>

                  <div className="bg-green-50 p-6 rounded-lg">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {((numCorrect / questions.length) * 100).toFixed(1)}%
                    </div>
                    <div className="text-green-800 font-semibold">Score</div>
                  </div>

                  <div className="bg-purple-50 p-6 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {(timeTaken / 1000).toFixed(0)}s
                    </div>
                    <div className="text-purple-800 font-semibold">
                      Time Taken
                    </div>
                  </div>
                </div>

                <div className="space-x-4">
                  <button
                    onClick={() =>
                      router.push(
                        `/ai-learning/roadmap?topic=${encodeURIComponent(
                          course
                        )}`
                      )
                    }
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Back to Roadmap
                  </button>
                  <button
                    onClick={() => {
                      setUserAnswers({});
                      setNumCorrect(0);
                      setNumAttempted(0);
                      setShowResults(false);
                      setStartTime(Date.now());
                    }}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Retake Quiz
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading quiz...</div>}>
      <QuizContent />
    </Suspense>
  );
}
