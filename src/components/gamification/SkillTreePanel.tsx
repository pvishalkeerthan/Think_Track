"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function SkillTreePanel({ masteryMap = [] }: { masteryMap: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const getBarColor = (score: number) => {
    if (score < 40) return "bg-destructive";
    if (score < 70) return "bg-amber-500";
    if (score < 90) return "bg-blue-500";
    return "bg-green-500";
  };

  const formatTitle = (slug: string) => {
    return slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="border rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden my-6">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <h3 className="font-semibold text-lg">Skill Tree Mastery</h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1, height: 'auto' } : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1, height: 'auto' } : { height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0, height: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t"
          >
            <div className="p-4 space-y-5 flex flex-col gap-2">
              {masteryMap.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No skills mastered yet.</p>
                  <p className="text-sm mt-1">Complete quizzes to level up your topics!</p>
                </div>
              ) : (
                masteryMap.map((topic) => (
                  <div key={topic.slug} className="flex flex-col gap-1.5 w-full">
                    <div className="flex justify-between items-center text-sm w-full">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatTitle(topic.slug)}</span>
                        {topic.decayApplied && (
                          <span className="text-[9px] uppercase tracking-wider bg-destructive/10 text-destructive px-1.5 py-0.5 rounded hidden sm:inline-block">
                            Needs Review
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold w-8 text-right">{Math.round(topic.score)}%</span>
                        <span 
                          className="text-primary text-xs cursor-pointer hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/test?topic=${topic.slug}`);
                          }}
                        >
                          Practice
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full ${getBarColor(topic.score)} rounded-full`}
                        initial={shouldReduceMotion ? { width: `${topic.score}%` } : { width: 0 }}
                        animate={{ width: `${topic.score}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
