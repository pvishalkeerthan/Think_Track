"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function PeerContextBanner() {
  const [stats, setStats] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check dismissal state for today
    const todayStr = new Date().toDateString();
    const dismissedOn = localStorage.getItem("peerBannerDismissed");
    
    if (dismissedOn === todayStr) {
      return;
    }

    fetch("/api/user/peer-stats")
      .then(res => res.json())
      .then(data => {
        if (data.available) {
          setStats(data);
          setIsVisible(true);
        }
      })
      .catch((e) => console.log("Peer stats error:", e));
  }, []);

  const handleDismiss = () => {
    const todayStr = new Date().toDateString();
    localStorage.setItem("peerBannerDismissed", todayStr);
    setIsVisible(false);
  };

  if (!stats) return null;

  const isAbove = stats.userAverage >= stats.peerAverage;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, scale: 0.95, height: 0 }}
          className="mb-6 w-full relative overflow-hidden"
        >
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 items-center justify-between
            ${isAbove ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-input'}`}>
            <div className="flex-1">
              <p className="text-sm text-foreground space-x-1">
                <span>This week, </span>
                <strong className="text-primary">{stats.learnerCount} learners</strong>
                <span> scored an average of </span>
                <strong className="text-primary">{stats.peerAverage}%</strong>
                <span> on </span>
                <span className="font-semibold">{stats.topicName}</span>
                <span>. You scored </span>
                <strong className={isAbove ? "text-green-600 dark:text-green-500" : "text-foreground"}>{stats.userAverage}%</strong>
                <span>.</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {isAbove 
                  ? "You're performing above average — keep it up! 🚀" 
                  : "A few more practice sessions will get you there. 💪"}
              </p>
            </div>
            
            <button 
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
