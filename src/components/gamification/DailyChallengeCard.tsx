"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function DailyChallengeCard() {
  const [challengeMeta, setChallengeMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    fetch("/api/daily-challenge")
      .then((res) => res.json())
      .then((data) => {
        if (data.active) {
          setChallengeMeta(data);
          setTimeRemaining(data.timeRemainingMs);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => setTimeRemaining((t) => Math.max(0, t - 1000)), 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  if (loading) {
    return (
      <Card className="border-l-4 border-l-primary/50 opacity-60">
        <CardContent className="p-4 h-[160px] flex items-center justify-center text-sm text-muted-foreground">
          Loading challenge...
        </CardContent>
      </Card>
    );
  }

  if (!challengeMeta) {
    return (
      <Card className="border-l-4 border-l-border/50">
        <CardContent className="p-4 h-[160px] flex flex-col justify-center text-center">
          <p className="text-muted-foreground text-sm">No active challenge today.</p>
        </CardContent>
      </Card>
    );
  }

  const { challenge, hasCompleted } = challengeMeta;
  const underHour = timeRemaining < 3600000;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const timerMotionProps = underHour && !shouldReduceMotion
    ? {
        animate: { scale: [1, 1.05, 1], color: ["hsl(var(--destructive))", "hsl(var(--foreground))", "hsl(var(--destructive))"] },
        transition: { duration: 10, repeat: Infinity }
      }
    : {};

  return (
    <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
      <CardContent className="p-4 flex flex-col h-[160px] relative">
        <div className="flex justify-between items-start mb-2">
          <div className="overflow-hidden mr-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5 flex-wrap">
              Daily Challenge
              <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-1 py-0.5 rounded leading-none">
                +{challenge.bonusXP} XP
              </span>
            </div>
            <h3 className="font-semibold text-base leading-tight truncate">{challenge.topicName}</h3>
          </div>
          <span className={`text-[9px] font-semibold px-2 py-1 rounded capitalize shrink-0
            ${challenge.difficulty === 'hard' ? 'bg-destructive/10 text-destructive' : ''}
            ${challenge.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-600' : ''}
            ${challenge.difficulty === 'easy' ? 'bg-green-500/10 text-green-600' : ''}
          `}>
            {challenge.difficulty}
          </span>
        </div>

        {hasCompleted ? (
          <div className="flex flex-col flex-1 justify-center bg-muted/30 rounded-lg p-3 text-center border mt-2">
            <p className="text-sm font-medium mb-1">Challenge Completed! 🎉</p>
            <p className="text-xs text-muted-foreground">Global Avg: <strong className="text-foreground">{Math.round(challenge.globalAverageScore)}%</strong></p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 justify-end h-full mt-2 relative">
            <div className="flex items-center gap-2 text-xs mb-3 absolute top-0">
              <span className="text-muted-foreground">Ends in:</span>
              <motion.span 
                className={`font-mono font-medium ${underHour ? "text-destructive font-bold" : ""}`}
                {...timerMotionProps}
              >
                {formatTime(timeRemaining)}
              </motion.span>
            </div>
            <Button size="sm" className="w-full" onClick={() => router.push("/daily-challenge")}>
              Play Challenge →
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
