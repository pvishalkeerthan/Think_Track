"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Clock, Trophy, ChevronLeft, RotateCcw, Send } from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function QuizContent() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subtopic, setSubtopic] = useState("");
  const [description, setDescription] = useState("");
  const [course, setCourse] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [timeTaken, setTimeTaken] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const topicParam = searchParams.get("topic");
  const weekNum = searchParams.get("week");
  const subtopicNum = searchParams.get("subtopic");

  // Derived state for better reliability
  const numAttempted = useMemo(() => Object.keys(userAnswers).length, [userAnswers]);
  
  const numCorrect = useMemo(() => {
    return Object.entries(userAnswers).reduce((count, [index, answerIndex]) => {
      const question = questions[parseInt(index)];
      return count + (question && answerIndex === question.answerIndex ? 1 : 0);
    }, 0);
  }, [userAnswers, questions]);

  useEffect(() => {
    if (!topicParam || !weekNum || !subtopicNum) {
      router.push("/ai-learning");
      return;
    }

    const roadmaps = JSON.parse(localStorage.getItem("aiRoadmaps")) || {};
    if (!roadmaps[topicParam]) {
      router.push("/ai-learning");
      return;
    }

    setCourse(topicParam);
    const weekKey = Object.keys(roadmaps[topicParam])[weekNum - 1];
    const weekData = roadmaps[topicParam][weekKey];
    
    if (weekData && weekData.subtopics && weekData.subtopics[subtopicNum - 1]) {
      setSubtopic(weekData.subtopics[subtopicNum - 1].subtopic);
      setDescription(weekData.subtopics[subtopicNum - 1].description);
    }
  }, [topicParam, weekNum, subtopicNum, router]);

  useEffect(() => {
    if (!course || !subtopic || !description) return;

    const quizzes = JSON.parse(localStorage.getItem("aiQuizzes")) || {};
    const quizKey = `${course}-${weekNum}-${subtopicNum}`;

    if (quizzes[quizKey]) {
      setQuestions(quizzes[quizKey]);
      setLoading(false);
      const now = Date.now();
      setStartTime(now);
      setCurrentTime(now);
      return;
    }

    const fetchQuiz = async () => {
      try {
        const response = await fetch("/api/ai-learning/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course,
            topic: course,
            subtopic,
            description,
          }),
        });

        if (!response.ok) throw new Error("Failed to generate quiz");

        const data = await response.json();
        setQuestions(data.questions);

        quizzes[quizKey] = data.questions;
        localStorage.setItem("aiQuizzes", JSON.stringify(quizzes));

        setLoading(false);
        const now = Date.now();
        setStartTime(now);
        setCurrentTime(now);
      } catch (error) {
        console.error("Error fetching quiz:", error);
        router.push("/ai-learning");
      }
    };

    fetchQuiz();
  }, [course, subtopic, description, weekNum, subtopicNum, router]);

  // Update current time for the display timer
  useEffect(() => {
    if (!startTime || showResults) return;
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, showResults]);

  const handleAnswerSelect = (questionIndex, selectedIndex) => {
    if (showResults) return;
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: parseInt(selectedIndex),
    }));
  };

  const handleSubmit = () => {
    const duration = Date.now() - startTime;
    setTimeTaken(duration);
    setShowResults(true);

    const quizStats = JSON.parse(localStorage.getItem("aiQuizStats")) || {};
    quizStats[course] = quizStats[course] || {};
    quizStats[course][weekNum] = quizStats[course][weekNum] || {};
    quizStats[course][weekNum][subtopicNum] = {
      numCorrect,
      numQues: questions.length,
      timeTaken: duration,
    };
    localStorage.setItem("aiQuizStats", JSON.stringify(quizStats));

    const hardnessIndex = parseFloat(localStorage.getItem("hardnessIndex")) || 1;
    const newHardness = hardnessIndex + 
      ((questions.length - numCorrect) / (questions.length * 2)) * 
      (duration / (5 * 60 * 1000 * questions.length));
    localStorage.setItem("hardnessIndex", newHardness);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <h2 className="text-xl font-medium text-foreground">Analyzing progress & generating quiz...</h2>
          <p className="text-muted-foreground text-sm">Getting your personalized challenge ready</p>
        </div>
      </div>
    );
  }

  const progress = (numAttempted / questions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 pb-20">
      {/* Top Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1.5 bg-muted z-50">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="container mx-auto px-4 pt-12 max-w-4xl">
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="border-none shadow-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => router.push(`/ai-learning/roadmap?topic=${encodeURIComponent(course)}`)}
                    className="pl-0 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back to Roadmap
                  </Button>
                  <CardTitle className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    {subtopic}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {description}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                    <Clock size={16} className="mr-2 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                      {currentTime && !showResults ? 
                        `${Math.floor((currentTime - startTime) / 1000)}s` : 
                        `${Math.floor((timeTaken || 0) / 1000)}s`
                      }
                    </span>
                  </div>
                  <div className="flex items-center px-4 py-2 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/50">
                    <Trophy size={16} className="mr-2 text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold text-purple-700 dark:text-purple-300">
                      {numAttempted}/{questions.length}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Quiz Content */}
          <div className="space-y-6">
            {questions.map((q, qIndex) => (
              <Card 
                key={qIndex} 
                className={cn(
                  "border shadow-md transition-all duration-300",
                  userAnswers[qIndex] !== undefined && !showResults && "border-indigo-200 dark:border-indigo-900"
                )}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-sm shrink-0">
                      {qIndex + 1}
                    </span>
                    <CardTitle className="text-lg font-medium leading-relaxed mt-0.5">
                      {q.question}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    onValueChange={(val) => handleAnswerSelect(qIndex, val)}
                    value={userAnswers[qIndex]?.toString()}
                    disabled={showResults}
                    className="space-y-3"
                  >
                    {q.options.map((option, oIndex) => {
                      const isSelected = userAnswers[qIndex] === oIndex;
                      const isCorrect = oIndex === q.answerIndex;
                      const isWrong = isSelected && !isCorrect;

                      return (
                        <div key={oIndex} className="relative">
                          <RadioGroupItem
                            value={oIndex.toString()}
                            id={`q${qIndex}-o${oIndex}`}
                            className="absolute left-4 top-1/2 -translate-y-1/2 peer hidden"
                          />
                          <Label
                            htmlFor={`q${qIndex}-o${oIndex}`}
                            className={cn(
                              "flex items-center p-4 rounded-xl border-2 transition-all cursor-pointer select-none",
                              !showResults && "hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20",
                              !showResults && isSelected && "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30",
                              !showResults && !isSelected && "border-transparent bg-muted/50",
                              showResults && isCorrect && "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.2)]",
                              showResults && isWrong && "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300",
                              showResults && !isCorrect && !isWrong && "border-transparent bg-muted/30 opacity-60"
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-sm font-medium">{option}</span>
                              {showResults && isCorrect && <CheckCircle className="h-5 w-5 text-green-500" />}
                              {showResults && isWrong && <XCircle className="h-5 w-5 text-red-500" />}
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>
                {showResults && (
                  <CardFooter className="flex flex-col items-start bg-slate-50 dark:bg-zinc-900/50 p-6 rounded-b-xl border-t">
                    <div className="flex items-center gap-2 mb-2 text-primary font-semibold text-sm uppercase tracking-wider">
                      Explanation
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                      {q.reason}
                    </p>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>

          {/* Actions */}
          {!showResults && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Button
                onClick={handleSubmit}
                disabled={numAttempted < questions.length}
                size="lg"
                className="px-12 py-7 text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all h-auto"
              >
                <Send className="mr-2 h-5 w-5" />
                Submit Quiz
              </Button>
              <p className="text-sm text-muted-foreground">
                {numAttempted < questions.length ? 
                  `Please answer all questions (${questions.length - numAttempted} remaining)` : 
                  "Ready to see your results!"}
              </p>
            </div>
          )}

          {/* Results Summary Card */}
          {showResults && (
            <Card className="border-2 border-primary/20 shadow-2xl bg-gradient-to-b from-white to-slate-50 dark:from-zinc-900 dark:to-zinc-950 overflow-hidden">
              <CardHeader className="text-center pb-2">
                <div className="text-6xl mb-4 animate-bounce">
                  {numCorrect === questions.length ? "👑" : numCorrect >= questions.length * 0.7 ? "🌟" : "📖"}
                </div>
                <CardTitle className="text-3xl font-bold">Quiz Results</CardTitle>
                <CardDescription>Topic: {subtopic}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
                  <div className="text-center p-6 rounded-2xl bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
                    <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-1">
                      {numCorrect}/{questions.length}
                    </div>
                    <div className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-widest">Correct</div>
                  </div>
                  <div className="text-center p-6 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                    <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {((numCorrect / questions.length) * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-widest">Score</div>
                  </div>
                  <div className="text-center p-6 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                    <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                      {Math.floor(timeTaken / 1000)}s
                    </div>
                    <div className="text-xs font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-widest">Time Taken</div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  <Button 
                    onClick={() => router.push(`/ai-learning/roadmap?topic=${encodeURIComponent(course)}`)}
                    variant="outline"
                    className="rounded-xl px-8"
                  >
                    Return to Roadmap
                  </Button>
                  <Button 
                    onClick={() => {
                      setUserAnswers({});
                      setShowResults(false);
                      const now = Date.now();
                      setStartTime(now);
                      setCurrentTime(now);
                    }}
                    className="rounded-xl px-8"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-muted rounded-full"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
      </div>
    }>
      <QuizContent />
    </Suspense>
  );
}
