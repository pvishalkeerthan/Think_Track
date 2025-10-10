"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LibraryBig, Search, Bot, BookOpen } from "lucide-react";

export default function AILearningPage() {
  const [topic, setTopic] = useState("");
  const [timeInput, setTimeInput] = useState(4);
  const [timeUnit, setTimeUnit] = useState("Weeks");
  const [time, setTime] = useState("4 Weeks");
  const [knowledgeLevel, setKnowledgeLevel] = useState("Absolute Beginner");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: topic input, 2: details input
  const router = useRouter();

  const suggestionList = [
    "Competitive Programming",
    "Machine Learning",
    "Quantitative Finance",
    "Web Development",
    "Quantum Technology",
    "Data Science",
    "Mobile App Development",
    "Blockchain Technology",
  ];

  const colors = [
    "#6366F1", // Indigo
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#84CC16", // Lime
  ];

  useEffect(() => {
    setTime(timeInput + " " + timeUnit);
  }, [timeInput, timeUnit]);

  const handleGenerateRoadmap = async () => {
    if (time === "0 Weeks" || time === "0 Months") {
      alert("Please enter a valid time period");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/ai-learning/roadmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          time,
          knowledge_level: knowledgeLevel,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate roadmap");
      }

      const roadmap = await response.json();

      // Store in localStorage for the roadmap page
      const roadmaps = JSON.parse(localStorage.getItem("aiRoadmaps")) || {};
      roadmaps[topic] = roadmap;
      localStorage.setItem("aiRoadmaps", JSON.stringify(roadmaps));

      const topics = JSON.parse(localStorage.getItem("aiTopics")) || {};
      topics[topic] = { time, knowledge_level: knowledgeLevel };
      localStorage.setItem("aiTopics", JSON.stringify(topics));

      router.push(`/ai-learning/roadmap?topic=${encodeURIComponent(topic)}`);
    } catch (error) {
      console.error("Error generating roadmap:", error);
      alert(
        "An error occurred while generating the roadmap. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  const Suggestions = ({ list }) => {
    return (
      <div className="flex flex-wrap gap-3 justify-center">
        {list.map((item, i) => (
          <button
            key={i}
            onClick={() => setTopic(item)}
            className="px-4 py-2 rounded-full text-white font-medium transition-all duration-200 hover:scale-105"
            style={{ backgroundColor: colors[i % colors.length] }}
          >
            {item} <ArrowRight className="inline ml-2" size={20} />
          </button>
        ))}
      </div>
    );
  };

  const TopicInput = () => {
    const [inputVal, setInputVal] = useState("");
    const searchIcon = <Search size={24} color="white" strokeWidth={2} />;
    const arrowIcon = <ArrowRight size={24} color="white" strokeWidth={2} />;
    const [icon, setIcon] = useState(searchIcon);

    return (
      <div className="relative w-full max-w-md mx-auto">
        <div className="flex items-center bg-gray-100 rounded-lg p-4">
          <LibraryBig className="mr-3 text-gray-500" size={24} />
          <input
            type="text"
            placeholder="Enter A Topic"
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value);
              if (e.target.value) {
                setIcon(arrowIcon);
              } else {
                setIcon(searchIcon);
              }
            }}
            className="flex-1 bg-transparent outline-none text-gray-700"
          />
          <button
            onClick={(e) => {
              e.preventDefault();
              if (inputVal) {
                setTopic(inputVal);
                setStep(2);
              }
            }}
            className="ml-2 p-2 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors"
          >
            {icon}
          </button>
        </div>
      </div>
    );
  };

  const TimeInput = () => {
    return (
      <div className="flex gap-4 justify-center items-center">
        <div className="flex flex-col items-center">
          <label className="text-sm text-gray-600 mb-2">Time</label>
          <input
            type="number"
            value={timeInput}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (value >= 0 && value <= 100) {
                setTimeInput(value);
              }
            }}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
            min="1"
            max="100"
          />
        </div>
        <div className="flex flex-col items-center">
          <label className="text-sm text-gray-600 mb-2">Unit</label>
          <select
            value={timeUnit}
            onChange={(e) => setTimeUnit(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="Weeks">Weeks</option>
            <option value="Months">Months</option>
          </select>
        </div>
      </div>
    );
  };

  const KnowledgeLevelInput = () => {
    return (
      <div className="flex flex-col items-center">
        <label className="text-sm text-gray-600 mb-2">Knowledge Level</label>
        <select
          value={knowledgeLevel}
          onChange={(e) => setKnowledgeLevel(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg min-w-[200px]"
        >
          <option value="Absolute Beginner">Absolute Beginner</option>
          <option value="Beginner">Beginner</option>
          <option value="Moderate">Moderate</option>
          <option value="Expert">Expert</option>
        </select>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">
            Generating Your Personalized Learning Roadmap...
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
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur-lg opacity-30"></div>
                <div className="relative bg-white rounded-full p-4 shadow-lg">
                  <Bot className="text-indigo-600" size={48} />
                </div>
              </div>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
              AI Learning Assistant
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Get personalized learning paths with AI-generated roadmaps,
              quizzes, and resources for any topic you want to learn.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              <div
                className={`flex items-center ${
                  step >= 1 ? "text-blue-500" : "text-gray-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step >= 1 ? "bg-blue-500 text-white" : "bg-gray-300"
                  }`}
                >
                  1
                </div>
                <span className="ml-2 font-medium">Choose Topic</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div
                className={`flex items-center ${
                  step >= 2 ? "text-blue-500" : "text-gray-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step >= 2 ? "bg-blue-500 text-white" : "bg-gray-300"
                  }`}
                >
                  2
                </div>
                <span className="ml-2 font-medium">Set Details</span>
              </div>
            </div>
          </div>

          {/* Step 1: Topic Selection */}
          {step === 1 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8 mb-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">
                  What do you want to learn?
                </h2>
                <TopicInput />
                {topic && (
                  <div className="mt-6 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200">
                    <p className="text-indigo-700 font-semibold text-lg mb-3">
                      Selected: {topic}
                    </p>
                    <button
                      onClick={() => setStep(2)}
                      className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      Continue →
                    </button>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-700 mb-6 text-center">
                  Popular Topics:
                </h3>
                <Suggestions list={suggestionList} />
              </div>
            </div>
          )}

          {/* Step 2: Details Input */}
          {step === 2 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">
                  Learning Details
                </h2>
                <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full">
                  <span className="text-gray-700 font-medium">
                    Selected Topic:{" "}
                    <span className="font-bold text-indigo-600">{topic}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-10">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-700 mb-6">
                    How much time do you have to learn it?
                  </h3>
                  <TimeInput />
                </div>

                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-700 mb-6">
                    Your Knowledge Level on the Topic
                  </h3>
                  <KnowledgeLevelInput />
                </div>

                <div className="flex justify-center space-x-6">
                  <button
                    onClick={() => setStep(1)}
                    className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-semibold"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleGenerateRoadmap}
                    className="px-10 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 flex items-center space-x-3 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <BookOpen size={24} />
                    <span>Start Learning</span>
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
