"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ContributePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [gamificationStats, setGamificationStats] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const [topic, setTopic] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState("MCQ");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [approvedQuestions, setApprovedQuestions] = useState<any[]>([]);
  const [isVetting, setIsVetting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    } else if (status === "authenticated") {
      fetch("/api/user/gamification")
        .then(res => res.json())
        .then(data => setGamificationStats(data))
        .catch(console.error);
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    
    // Fetch user's own submissions
    fetch("/api/community/questions")
      .then((res) => res.json())
      .then((data) => setSubmissions(data?.data || []))
      .catch(() => {});

    // Fetch pending queue if user is reputable or special admin
    const isSpecialAdmin = session?.user?.email === "v@gmail.com";
    if (gamificationStats?.level >= 5 || isSpecialAdmin) {
      fetch("/api/community/questions?pending=true")
        .then((res) => res.json())
        .then((data) => setPendingQueue(data?.data || []))
        .catch(() => {});
    }

    // Fetch all approved questions
    fetch("/api/community/questions?approved=true")
      .then((res) => res.json())
      .then((data) => setApprovedQuestions(data?.data || []))
      .catch(() => {});
  }, [status, gamificationStats?.level, session?.user?.email]);

  const handleVote = async (questionId: string, type: 'approve' | 'reject') => {
    setIsVetting(true);
    try {
      const res = await fetch("/api/ai-learning/contribution/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, type })
      });
      if (res.ok) {
        toast.success(`Vote registered: ${type}`);
        setPendingQueue(prev => prev.filter(q => q._id !== questionId));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to vote");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
    setIsVetting(false);
  };

  const handleOptionChange = (idx: number, val: string) => {
    const newOptions = [...options];
    newOptions[idx] = val;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !questionText || !correctAnswer) {
      toast.error("Please fill all required fields");
      return;
    }

    if (questionType === "MCQ" && options.some(opt => !opt.trim())) {
      toast.error("Please fill all 4 options for MCQ");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/community/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.toLowerCase().replace(/\s+/g, '-'),
          questionText,
          questionType,
          options: questionType === "MCQ" ? options : [],
          correctAnswer
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Question submitted successfully!");
        setSubmissions((prev) => [data.question, ...prev]);
        
        setQuestionText("");
        setOptions(["", "", "", ""]);
        setCorrectAnswer("");
        if (gamificationStats) {
          setGamificationStats({
            ...gamificationStats,
            questionsContributed: (gamificationStats.questionsContributed || 0) + 1
          });
        }
      } else {
        toast.error(data.error || "Failed to submit");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
    setIsSubmitting(false);
  };

  if (status === "loading") {
    return <div className="flex justify-center mt-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <Link href="/dashboard">
        <Button variant="outline" className="mb-6 h-10 px-6 font-bold">
          Back to Dashboard
        </Button>
      </Link>
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b pb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Community Contributions</h1>
          <p className="text-muted-foreground mt-2">Scale the collective intelligence of ThinkTrack</p>
        </div>
        
        <div className="flex gap-4">
          <Card className="min-w-[140px] border-none shadow-none bg-muted/30">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contributions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold">{gamificationStats?.questionsContributed || 0}</div>
            </CardContent>
          </Card>
          <Card className="min-w-[140px] border-none shadow-none bg-muted/30">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Impact</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold">{gamificationStats?.learnersHelped || 0} 🌟</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Submission Form */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Submit a New Question</CardTitle>
              <CardDescription>All submissions are peer-reviewed by Level 5+ contributors before going live.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Topic</label>
                    <Input 
                      placeholder="e.g. Next.js App Router" 
                      value={topic} 
                      onChange={e => setTopic(e.target.value)} 
                      required 
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Question Type</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={questionType}
                      onChange={e => {
                        setQuestionType(e.target.value);
                        setCorrectAnswer("");
                      }}
                    >
                      <option value="MCQ">Multiple Choice</option>
                      <option value="True/False">True / False</option>
                      <option value="Fill in the Blank">Fill in the Blank</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Question Content</label>
                  <textarea 
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Enter your question clearly..."
                    value={questionText}
                    onChange={e => setQuestionText(e.target.value)}
                    required
                  />
                </div>

                {questionType === "MCQ" && (
                  <div className="space-y-4 p-6 border rounded-xl bg-muted/20">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Answer Options</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {options.map((opt, idx) => (
                        <Input 
                          key={idx} 
                          placeholder={`Option ${idx + 1}`} 
                          value={opt} 
                          onChange={e => handleOptionChange(idx, e.target.value)}
                          required
                          className="bg-background"
                        />
                      ))}
                    </div>
                    <div className="space-y-2 pt-4">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Correct Selection</label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={correctAnswer}
                        onChange={e => setCorrectAnswer(e.target.value)}
                        required
                      >
                        <option value="" disabled>Choose the correct answer</option>
                        {options.map((opt, idx) => (
                          <option key={idx} value={opt} disabled={!opt.trim()}>{opt || `Option ${idx + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {questionType === "True/False" && (
                  <div className="space-y-2 max-w-xs">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Correct Answer</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={correctAnswer}
                      onChange={e => setCorrectAnswer(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select True/False</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </div>
                )}

                {questionType === "Fill in the Blank" && (
                  <div className="space-y-2 max-w-sm">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expected Answer</label>
                    <Input 
                      placeholder="Exact text expected" 
                      value={correctAnswer} 
                      onChange={e => setCorrectAnswer(e.target.value)} 
                      required 
                      className="h-10"
                    />
                  </div>
                )}

                <Button type="submit" className="h-12 w-full text-lg font-bold" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Submit Question
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Vetting Queue (Reputation Locked / Admin Override) */}
          {(gamificationStats?.level >= 5 || session?.user?.email === "v@gmail.com") && (
            <Card className="border-emerald-500/30 bg-emerald-50/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="p-1 px-2 bg-emerald-500 text-white text-[10px] rounded font-bold uppercase">Reputation Unlock</span>
                  Vetting Queue
                </CardTitle>
                <CardDescription>As a high-reputation member, you can vet pending community questions. 1 approval makes it live!</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingQueue.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl">
                      <p className="text-muted-foreground italic">No questions currently awaiting review.</p>
                    </div>
                  ) : (
                    pendingQueue.map((q) => (
                      <div key={q._id} className="p-6 border rounded-xl bg-card shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-0.5 border rounded">
                            {q.topic}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">{q.questionType}</span>
                        </div>
                        <p className="font-medium text-lg">{q.questionText}</p>
                        
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 h-9 px-4"
                            onClick={() => handleVote(q._id, 'approve')}
                            disabled={isVetting}
                          >
                            Approve
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 h-9 px-4"
                            onClick={() => handleVote(q._id, 'reject')}
                            disabled={isVetting}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-6 space-y-6">
            <h3 className="text-lg font-bold tracking-tight">Your Contributions</h3>
            <div className="space-y-3">
              {submissions.length === 0 ? (
                <div className="p-6 border-2 border-dashed rounded-xl text-center">
                  <p className="text-xs text-muted-foreground">No submissions yet.</p>
                </div>
              ) : (
                submissions.map((sub, i) => (
                  <Card key={i} className="border-none shadow-sm bg-muted/20">
                    <CardContent className="p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{sub.topic}</p>
                      <p className="text-sm font-medium line-clamp-2 mb-3">{sub.questionText}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-background border">
                          {sub.questionType}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sub.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {sub.approved ? "Live" : "Pending"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <h3 className="text-lg font-bold tracking-tight pt-6">Approved Library</h3>
            <div className="space-y-3">
              {approvedQuestions.length === 0 ? (
                <div className="p-6 border rounded-xl text-center bg-muted/5">
                  <p className="text-xs text-muted-foreground">No community approved questions yet.</p>
                </div>
              ) : (
                approvedQuestions.map((sub, i) => (
                  <Card key={i} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{sub.topic}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Live</span>
                      </div>
                      <p className="text-sm font-medium line-clamp-2">{sub.questionText}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
