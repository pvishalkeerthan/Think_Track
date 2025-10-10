"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  Play,
  Bot,
  FolderSearch,
  CheckCircle,
} from "lucide-react";

function RoadmapContent() {
  const [roadmap, setRoadmap] = useState({});
  const [topicDetails, setTopicDetails] = useState({
    time: "-",
    knowledge_level: "-",
  });
  const [quizStats, setQuizStats] = useState({});
  const [resources, setResources] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resourceParam, setResourceParam] = useState({});
  const [confettiExplode, setConfettiExplode] = useState(false);
  const [courses, setCourses] = useState(null);
  const [showCourses, setShowCourses] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");

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

  // Debug useEffect to track state changes
  useEffect(() => {
    console.log(
      "State changed - showCourses:",
      showCourses,
      "courses:",
      courses?.length,
      "modalOpen:",
      modalOpen
    );
  }, [showCourses, courses, modalOpen]);

  useEffect(() => {
    if (!topic) {
      router.push("/ai-learning");
      return;
    }

    const topics = JSON.parse(localStorage.getItem("aiTopics")) || {};
    const roadmaps = JSON.parse(localStorage.getItem("aiRoadmaps")) || {};
    const stats = JSON.parse(localStorage.getItem("aiQuizStats")) || {};

    if (!topics[topic] || !roadmaps[topic]) {
      router.push("/ai-learning");
      return;
    }

    setTopicDetails(topics[topic]);
    setRoadmap(roadmaps[topic]);
    setQuizStats(stats[topic] || {});
  }, [topic, router]);

  const generateResources = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai-learning/resources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resourceParam),
      });

      if (!response.ok) {
        throw new Error("Failed to generate resources");
      }

      const data = await response.json();
      setResources(data.content);
      setTimeout(() => setConfettiExplode(true), 500);
    } catch (error) {
      console.error("Error generating resources:", error);
      alert("Error generating resources");
    } finally {
      setLoading(false);
    }
  };

  const findCourses = async () => {
    console.log("Finding courses with params:", resourceParam);
    setLoading(true);
    try {
      const response = await fetch("/api/ai-learning/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: resourceParam.course,
          knowledge_level: resourceParam.knowledge_level,
          time: resourceParam.time,
        }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error("Failed to find courses");
      }

      const data = await response.json();
      console.log("Courses data received:", data);

      if (data.courses && Array.isArray(data.courses)) {
        console.log("Setting courses:", data.courses);
        setCourses(data.courses);
        setShowCourses(true);
        setResources(null); // Clear any existing resources
        console.log(
          "State updated - showCourses: true, courses:",
          data.courses.length
        );

        // Force a re-render by logging state after a short delay
        setTimeout(() => {
          console.log(
            "State after update - showCourses:",
            showCourses,
            "courses:",
            courses?.length
          );
        }, 100);

        alert(`Found ${data.courses.length} courses! Check the modal.`);
      } else {
        console.error("Invalid courses data:", data);
        alert("Invalid response format from server");
      }
    } catch (error) {
      console.error("Error finding courses:", error);
      alert("Error finding courses");
    } finally {
      setLoading(false);
    }
  };

  const Subtopic = ({ subtopic, number, weekNum, quizStats }) => {
    const hardnessIndex =
      parseFloat(localStorage.getItem("hardnessIndex")) || 1;
    const adjustedTime = (
      parseFloat(subtopic.time.replace(/^\D+/g, "")) * hardnessIndex
    ).toFixed(1);
    const timeUnit = subtopic.time.replace(/[0-9]/g, "");

    return (
      <div className="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                {number}
              </div>
              <h3 className="text-lg font-semibold text-gray-800 capitalize">
                {subtopic.subtopic}
              </h3>
            </div>

            <p className="text-sm text-blue-600 font-medium mb-2">
              {adjustedTime} {timeUnit}
            </p>

            <p className="text-gray-600 text-sm leading-relaxed">
              {subtopic.description}
            </p>
          </div>

          <div className="flex flex-col space-y-2 ml-4">
            <button
              onClick={() => {
                setModalOpen(true);
                setResourceParam({
                  subtopic: subtopic.subtopic,
                  description: subtopic.description,
                  time: subtopic.time,
                  course: topic,
                  knowledge_level: topicDetails.knowledge_level,
                });
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm flex items-center space-x-2"
            >
              <BookOpen size={16} />
              <span>Resources</span>
            </button>

            {quizStats.timeTaken ? (
              <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm text-center">
                <div className="font-semibold">
                  {((quizStats.numCorrect * 100) / quizStats.numQues).toFixed(
                    1
                  )}
                  % Correct
                </div>
                <div className="text-xs">
                  in {(quizStats.timeTaken / 1000).toFixed(0)}s
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  router.push(
                    `/ai-learning/quiz?topic=${topic}&week=${weekNum}&subtopic=${number}`
                  );
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm flex items-center space-x-2"
              >
                <Play size={16} />
                <span>Start Quiz</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TopicBar = ({ week, topic, color, subtopics, weekNum, quizStats }) => {
    const [open, setOpen] = useState(false);

    return (
      <div className="mb-6">
        <div
          className="rounded-lg p-6 shadow-lg cursor-pointer transition-all duration-200 hover:shadow-xl"
          style={{ backgroundColor: color }}
          onClick={() => setOpen(!open)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white capitalize mb-1">
                {week}
              </h3>
              <h2 className="text-2xl font-bold text-white capitalize">
                {topic}
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-white/80 text-sm">
                {subtopics?.length || 0} topics
              </span>
              <ChevronRight
                size={24}
                className={`text-white transition-transform duration-200 ${
                  open ? "rotate-90" : ""
                }`}
              />
            </div>
          </div>
        </div>

        {open && (
          <div className="mt-4 space-y-2">
            {subtopics?.map((subtopic, i) => (
              <Subtopic
                key={i}
                subtopic={subtopic}
                number={i + 1}
                weekNum={weekNum}
                quizStats={quizStats[i + 1] || {}}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const ResourcesModal = () => {
    console.log("ResourcesModal called - modalOpen:", modalOpen);
    if (!modalOpen) return null;

    console.log(
      "Modal state - showCourses:",
      showCourses,
      "courses:",
      courses?.length,
      "resources:",
      !!resources
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">
                Learning Resources
              </h2>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setResources(null);
                  setCourses(null);
                  setShowCourses(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[70vh]">
            {showCourses ? (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h2 className="text-xl font-bold text-gray-800 mb-2">
                    Recommended Courses for: {resourceParam.subtopic}
                  </h2>
                  <p className="text-gray-600">
                    Here are the best online courses to help you learn this
                    topic
                  </p>
                </div>

                <div className="grid gap-4">
                  {courses && courses.length > 0 ? (
                    courses.map((course, index) => (
                      <div
                        key={index}
                        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-lg font-semibold text-gray-800">
                            {course.title}
                          </h3>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            {course.level}
                          </span>
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                          <span className="flex items-center">
                            <span className="font-medium">Platform:</span>{" "}
                            {course.platform}
                          </span>
                          <span className="flex items-center">
                            <span className="font-medium">Duration:</span>{" "}
                            {course.duration}
                          </span>
                          <span className="flex items-center">
                            <span className="font-medium">Cost:</span>{" "}
                            {course.cost}
                          </span>
                          <span className="flex items-center">
                            <span className="font-medium">Rating:</span> ⭐{" "}
                            {course.rating}
                          </span>
                        </div>

                        <p className="text-gray-700 mb-4">
                          {course.description}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {course.features?.map((feature, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>

                        {course.url && (
                          <a
                            href={course.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            View Course
                            <svg
                              className="ml-2 w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">
                        No courses found. Please try again.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : resources ? (
              <div className="prose max-w-none">
                {confettiExplode && (
                  <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <div className="text-6xl">🎉</div>
                  </div>
                )}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h2 className="text-xl font-bold text-gray-800 mb-2">
                    {resourceParam.subtopic}
                  </h2>
                </div>
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {resources}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">
                    Choose your learning resources for: {resourceParam.subtopic}
                  </h3>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={generateResources}
                    disabled={loading}
                    className="p-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50"
                  >
                    <Bot size={32} />
                    <div className="text-left">
                      <div className="font-semibold">
                        AI Generated Resources
                      </div>
                      <div className="text-sm opacity-90">
                        Personalized content
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      findCourses();
                    }}
                    disabled={loading}
                    className="p-6 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg hover:from-green-600 hover:to-teal-700 transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50"
                  >
                    <FolderSearch size={32} />
                    <div className="text-left">
                      <div className="font-semibold">Browse Online Courses</div>
                      <div className="text-sm opacity-90">
                        Find best courses
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  Generating personalized resources...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!topic || Object.keys(roadmap).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">
            Loading your roadmap...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                  {topic}
                </h1>
                <div className="flex items-center space-x-6 text-gray-600">
                  <span className="flex items-center px-4 py-2 bg-indigo-50 rounded-full">
                    <BookOpen size={20} className="mr-2 text-indigo-600" />
                    <span className="font-medium">{topicDetails.time}</span>
                  </span>
                  <span className="flex items-center px-4 py-2 bg-purple-50 rounded-full">
                    <CheckCircle size={20} className="mr-2 text-purple-600" />
                    <span className="font-medium">
                      {topicDetails.knowledge_level}
                    </span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => router.push("/ai-learning")}
                className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                New Learning Path
              </button>
            </div>
          </div>

          {/* Roadmap */}
          <div className="space-y-6">
            {Object.keys(roadmap)
              .sort(
                (a, b) => parseInt(a.split(" ")[1]) - parseInt(b.split(" ")[1])
              )
              .map((week, i) => (
                <TopicBar
                  key={week}
                  weekNum={i + 1}
                  week={week}
                  topic={roadmap[week].topic}
                  subtopics={roadmap[week].subtopics}
                  color={colors[i % colors.length]}
                  quizStats={quizStats[i + 1] || {}}
                />
              ))}
          </div>
        </div>
      </div>

      <ResourcesModal />
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading roadmap...</div>}>
      <RoadmapContent />
    </Suspense>
  );
}
