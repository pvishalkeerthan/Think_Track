"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";

export default function StreakWidget({
  streak = 0,
  longestStreakEver = 0,
  atRisk = false,
}: {
  streak?: number;
  longestStreakEver?: number;
  atRisk?: boolean;
}) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const pulseAnimation =
    atRisk && !shouldReduceMotion
      ? {
          boxShadow: [
            "0 0 0px 0px hsl(var(--destructive) / 0.5)",
            "0 0 0px 8px hsl(var(--destructive) / 0)",
          ],
          borderColor: "hsl(var(--destructive))",
        }
      : {};

  const handleNavigate = () => {
    // Take users to their existing test history to reduce friction.
    // If they have no tests yet, fall back to the test configuration page.
    (async () => {
      try {
        const res = await fetch("/api/user-performance");
        const data = await res.json();
        const totalTests = data?.data?.totalTests ?? 0;
        router.push(totalTests > 0 ? "/dashboard" : "/test-start");
      } catch {
        // If we can't determine history, don't drop them into a blank create flow.
        router.push("/community");
      }
    })();
  };

  return (
    <motion.div
      onClick={handleNavigate}
      className={`cursor-pointer rounded-xl border bg-card text-card-foreground shadow-sm ${
        atRisk ? "border-destructive border-2" : ""
      }`}
      animate={pulseAnimation}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <CardContent className="p-4 flex flex-col items-center justify-center h-full text-center">
        {streak === 0 ? (
          <div>
            <div className="text-4xl mb-2 text-orange-500 flex justify-center">
              <Zap size={32} />
            </div>
            <p className="font-semibold text-sm">Start your streak today!</p>
            <p className="text-xs text-muted-foreground mt-1">Complete a quiz to begin.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={24} className="text-orange-500 fill-orange-500" />
              <h3 className="text-3xl font-bold">{streak}</h3>
            </div>
            
            <p className="text-sm font-medium">Day Streak</p>

            {longestStreakEver > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Longest: {longestStreakEver}</p>
            )}

            {streak >= 7 && (
              <div className="mt-2 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded-full">
                Week Warrior
              </div>
            )}
            
            {atRisk && (
              <p className="text-destructive text-xs mt-2 font-medium">
                Complete a quiz today to keep your streak alive.
              </p>
            )}
          </>
        )}
      </CardContent>
    </motion.div>
  );
}
