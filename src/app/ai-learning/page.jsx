"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "react-hot-toast";

export default function AILearningPage() {
  const [topic, setTopic] = useState("");
  const [timeInput, setTimeInput] = useState(4);
  const [timeUnit, setTimeUnit] = useState("Weeks");
  const [knowledgeLevel, setKnowledgeLevel] = useState("Absolute Beginner");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const router = useRouter();

  const suggestionList = [
    "Competitive Programming", "Machine Learning", "Quantitative Finance", 
    "Web Development", "Quantum Technology", "Data Science"
  ];

  const handleGenerateRoadmap = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      toast.error("Please enter a topic");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/ai-learning/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: trimmedTopic,
          time: `${timeInput} ${timeUnit}`,
          knowledge_level: knowledgeLevel,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate roadmap");

      const roadmap = await response.json();
      
      // Save roadmap
      const currentRoadmaps = JSON.parse(localStorage.getItem("aiRoadmaps") || "{}");
      localStorage.setItem("aiRoadmaps", JSON.stringify({ ...currentRoadmaps, [trimmedTopic]: roadmap }));
      
      // Save topic details (REQUIRED for roadmap page validation)
      const currentTopics = JSON.parse(localStorage.getItem("aiTopics") || "{}");
      localStorage.setItem("aiTopics", JSON.stringify({ 
        ...currentTopics, 
        [trimmedTopic]: { time: `${timeInput} ${timeUnit}`, knowledge_level: knowledgeLevel } 
      }));

      router.push(`/ai-learning/roadmap?topic=${encodeURIComponent(trimmedTopic)}`);
    } catch (error) {
      toast.error("Failed to generate roadmap. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">AI Learning Assistant</h1>
        <p className="text-muted-foreground text-lg">
          Get personalized learning paths with AI-generated roadmaps and resources.
        </p>
      </div>

      <div className="max-w-xl mx-auto">
        {step === 1 ? (
          <Card className="border shadow-md">
            <CardHeader>
              <CardTitle>What do you want to learn?</CardTitle>
              <CardDescription>Enter a topic to start your personalized journey.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <Input 
                  placeholder="e.g. Machine Learning, React, etc." 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && setStep(2)}
                />
                <Button onClick={() => setStep(2)}>Next</Button>
              </div>
              
              <div className="pt-4">
                <p className="text-sm font-medium mb-3 text-muted-foreground">Popular Topics:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestionList.map((item) => (
                    <Button 
                      key={item} 
                      variant="outline" 
                      size="sm"
                      onClick={() => { setTopic(item); setStep(2); }}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border shadow-md">
            <CardHeader>
              <CardTitle>Learning Details</CardTitle>
              <CardDescription>Topic: <strong>{topic}</strong></CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Input 
                    type="number" 
                    value={timeInput} 
                    onChange={(e) => setTimeInput(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit</label>
                  <select 
                    value={timeUnit} 
                    onChange={(e) => setTimeUnit(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="Weeks">Weeks</option>
                    <option value="Months">Months</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Knowledge Level</label>
                <select 
                  value={knowledgeLevel} 
                  onChange={(e) => setKnowledgeLevel(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Absolute Beginner">Absolute Beginner</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={handleGenerateRoadmap} disabled={loading}>
                  {loading ? "Generating..." : "Start Learning"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
