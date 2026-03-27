"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function MysteryReveal({
  children,
  badgeEarned,
  xpEarned,
  bonusXP,
  streakCount
}: {
  children: React.ReactNode;
  badgeEarned?: { name: string, description: string };
  xpEarned: number;
  bonusXP?: number;
  streakCount?: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => {
      setRevealed(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!revealed) {
    return (
      <div className="w-full h-40 flex items-center justify-center rounded-xl border bg-muted/20">
        <motion.div
          animate={shouldReduceMotion ? {} : { scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full border-4 border-t-primary border-primary/20 animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Calculating your rewards...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="w-full rounded-xl border p-6 bg-card text-card-foreground shadow-lg flex flex-col gap-4 relative overflow-hidden"
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center z-10 w-full space-y-4">
        <h3 className="text-2xl font-bold">Rewards Unlocked! 🎉</h3>
        
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-1">XP Earned</p>
            <p className="text-3xl font-bold flex items-center gap-1">
              +{xpEarned} <span className="text-sm font-medium text-muted-foreground">XP</span>
            </p>
          </div>

          {bonusXP && bonusXP > 0 ? (
             <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
               <p className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-500 font-semibold mb-1">Challenge Bonus</p>
               <p className="text-3xl font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1">
                 +{bonusXP} <span className="text-sm font-medium">XP</span>
               </p>
             </div>
          ) : null}

          {streakCount && streakCount > 0 ? (
            <div className="px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
               <p className="text-xs uppercase tracking-wider text-orange-600 dark:text-orange-500 font-semibold mb-1">Current Streak</p>
               <p className="text-3xl font-bold text-orange-600 dark:text-orange-500 flex items-center justify-center gap-2">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-orange-500"><path d="M11.25 3C11.25 3 2.25 10 7.5 16C9.5 18.285 11.25 15 11.25 15C11.25 15 12.5 17 14 17C17.5 17 21 13.5 16.5 7.5C18.5 10.5 17.5 13 17.5 13C17.5 13 18.5 10 16.5 6.5C14.5 3 11.25 3 11.25 3Z" fill="currentColor"/></svg>
                 {streakCount}
               </p>
            </div>
          ) : null}
        </div>

        {badgeEarned && (
          <motion.div 
            initial={shouldReduceMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 flex flex-col items-center bg-muted/30 p-4 rounded-xl border border-muted"
          >
            <span className="text-4xl mb-2 bg-background shadow p-3 rounded-full inline-flex border">🏅</span>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">New Badge Unlocked!</p>
            <h4 className="text-xl font-bold mt-1">{badgeEarned.name}</h4>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">{badgeEarned.description}</p>
          </motion.div>
        )}

      </div>

      <div className="mt-4 pt-4 border-t z-10">
        {children}
      </div>
    </motion.div>
  );
}
