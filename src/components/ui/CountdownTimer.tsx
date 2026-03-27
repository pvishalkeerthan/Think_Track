"use client"
import React, { useState, useEffect } from "react";

interface CountdownTimerProps {
  timeLimit: number;
  onTimeUp?: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ timeLimit, onTimeUp }) => {
  const totalSeconds = timeLimit * 60;
  const [timeLeft, setTimeLeft] = useState(totalSeconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (onTimeUp) onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => (prevTime > 0 ? prevTime - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const percentageLeft = (timeLeft / totalSeconds) * 100;

  return (
    <div
      className={`fixed top-4 bg-white text-black dark:bg-black dark:text-white dark:border right-4 p-2 rounded shadow-lg text-lg ${
        percentageLeft <= 10 ? "bg-red-100 text-red-600 font-bold" : "bg-gray-100 mt-16"
      }`}
    >
      Time Left: {formatTime(timeLeft)}
    </div>
  );
};

export default CountdownTimer;
