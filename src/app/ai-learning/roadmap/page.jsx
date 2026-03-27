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

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
      setTimeout(() => {
        setConfettiExplode(true);
        // Auto-hide after 2 seconds
        setTimeout(() => setConfettiExplode(false), 2000);
      }, 500);
    } catch (error) {
      console.error("Error generating resources:", error);
      alert("Error generating resources");
    } finally {
      setLoading(false);
    }
  };

  const findCourses = async () => {
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

      if (!response.ok) {
        throw new Error("Failed to find courses");
      }

      const data = await response.json();
      if (data.courses && Array.isArray(data.courses)) {
        setCourses(data.courses);
        setShowCourses(true);
        setResources(null);
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
      <div className="bg-card text-card-foreground rounded-lg p-5 mb-3 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold bg-muted w-6 h-6 rounded-full flex items-center justify-center border">
              {number}
            </span>
            <h3 className="text-lg font-bold capitalize">
              {subtopic.subtopic}
            </h3>
            <span className="text-xs px-2 py-0.5 bg-muted rounded border font-medium">
              {adjustedTime} {timeUnit}
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            {subtopic.description}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
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
            className="flex items-center gap-2"
          >
            <BookOpen size={14} />
            <span>Resources</span>
          </Button>

          {quizStats.timeTaken ? (
            <div className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md text-sm font-medium flex flex-col justify-center items-center h-9">
              <span className="leading-none">
                {((quizStats.numCorrect * 100) / quizStats.numQues).toFixed(0)}%
              </span>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                router.push(
                  `/ai-learning/quiz?topic=${topic}&week=${weekNum}&subtopic=${number}`
                );
              }}
              className="flex items-center gap-2"
            >
              <Play size={14} />
              <span>Start</span>
            </Button>
          )}
        </div>
      </div>
    );
  };

  const TopicBar = ({ week, topic, subtopics, weekNum, quizStats }) => {
    const [open, setOpen] = useState(false);

    return (
      <div className="mb-4">
        <Card 
          className="cursor-pointer hover:bg-muted/30 transition-colors border shadow-sm"
          onClick={() => setOpen(!open)}
        >
          <div className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {week}
              </span>
              <h2 className="text-xl font-bold capitalize tracking-tight">
                {topic}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs px-2 py-1 bg-muted rounded border font-medium">
                {subtopics?.length || 0} Topics
              </span>
              <ChevronRight
                size={20}
                className={`text-muted-foreground transition-transform duration-200 ${
                  open ? "rotate-90 text-foreground" : ""
                }`}
              />
            </div>
          </div>
        </Card>

        {open && (
          <div className="pt-2 pb-4 px-2 space-y-1">
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
    if (!modalOpen) return null;

    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-card text-card-foreground rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border shadow-2xl">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-2xl font-bold">Learning Resources</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setModalOpen(false);
                setResources(null);
                setCourses(null);
                setShowCourses(false);
              }}
            >
              ✕
            </Button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[70vh]">
            {showCourses ? (
              <div className="space-y-6">
                <div className="bg-muted/50 p-6 rounded-xl border border-dashed text-center">
                  <h2 className="text-xl font-bold mb-2">
                    Recommended Courses: {resourceParam.subtopic}
                  </h2>
                  <p className="text-muted-foreground">
                    Best hand-picked online courses
                  </p>
                </div>

                <div className="grid gap-4">
                  {courses && courses.length > 0 ? (
                    courses.map((course, index) => (
                      <div
                        key={index}
                        className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-bold">
                            {course.title}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 border rounded text-primary border-primary/20 bg-primary/5">
                            {course.level}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-6">
                          <div className="space-y-1">
                            <span className="text-muted-foreground block">Platform</span>
                            <span className="font-semibold">{course.platform}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground block">Duration</span>
                            <span className="font-semibold">{course.duration}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground block">Cost</span>
                            <span className="font-semibold">{course.cost}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground block">Rating</span>
                            <span className="font-semibold">⭐ {course.rating}</span>
                          </div>
                        </div>

                        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                          {course.description}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-6">
                          {course.features?.map((feature, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-muted rounded text-[10px] font-bold uppercase tracking-wider"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>

                        {(course.courseUrl || course.url) && (
                          <a
                            href={course.courseUrl || course.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full"
                          >
                            <Button className="w-full">
                              View on {course.platform || "Platform"}
                            </Button>
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No courses found.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : resources ? (
              <div className="prose dark:prose-invert max-w-none">
                <div className="bg-muted p-4 rounded-lg mb-6">
                  <h2 className="text-xl font-bold">
                    {resourceParam.subtopic}
                  </h2>
                </div>
                <div className="whitespace-pre-wrap text-foreground/80 leading-relaxed text-sm">
                  {resources}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">
                    Start Learning: {resourceParam.subtopic}
                  </h3>
                  <p className="text-muted-foreground">Choose your preferred learning method</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Button
                    onClick={generateResources}
                    disabled={loading}
                    variant="outline"
                    className="h-auto py-8 px-6 flex flex-col gap-4 items-center justify-center border-2 hover:border-primary transition-all group"
                  >
                    <div className="p-3 bg-muted rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Bot size={32} />
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-lg">AI Generated</h4>
                      <p className="text-xs text-muted-foreground">Personalized interactive content</p>
                    </div>
                  </Button>

                  <Button
                    onClick={findCourses}
                    disabled={loading}
                    variant="outline"
                    className="h-auto py-8 px-6 flex flex-col gap-4 items-center justify-center border-2 hover:border-primary transition-all group"
                  >
                    <div className="p-3 bg-muted rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <FolderSearch size={32} />
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-lg">Online Courses</h4>
                      <p className="text-xs text-muted-foreground">Best hand-picked certifications</p>
                    </div>
                  </Button>
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground font-medium italic">
                  Personalizing your experience...
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-muted-foreground">
            Constructing roadmap...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 border-b pb-12">
            <div className="space-y-4">
              <h1 className="text-5xl font-extrabold tracking-tight capitalize leading-none">
                {topic}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs px-3 py-1 bg-muted rounded border flex items-center gap-1.5 font-medium">
                  <BookOpen size={14} className="text-muted-foreground" />
                  <span>{topicDetails.time}</span>
                </span>
                <span className="text-xs px-3 py-1 bg-muted rounded border flex items-center gap-1.5 font-medium">
                  <CheckCircle size={14} className="text-muted-foreground" />
                  <span>{topicDetails.knowledge_level}</span>
                </span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => router.push("/ai-learning")}
                variant="outline"
                className="font-bold h-12 px-6"
              >
                New Journey
              </Button>
            </div>
          </div>

          {/* Roadmap */}
          <div className="space-y-4">
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
