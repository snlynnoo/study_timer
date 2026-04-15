import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Coffee, Brain, Settings } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TimerProps {
  mode: "work" | "shortBreak" | "longBreak";
  duration: number; // in minutes
  onComplete: () => void;
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  theme: {
    work: string;
    shortBreak: string;
    longBreak: string;
  };
}

export default function Timer({ mode, duration, onComplete, isActive, setIsActive, theme }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setTimeLeft(duration * 60);
    setIsActive(false);
  }, [duration, mode, setIsActive]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft <= 0 && isActive) {
      console.log("Timer hit zero! Calling onComplete.");
      if (timerRef.current) clearInterval(timerRef.current);
      onCompleteRef.current();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  const modeText = {
    work: "Focus Time",
    shortBreak: "Short Break",
    longBreak: "Long Break",
  };

  const modeIcons = {
    work: <Brain className="w-6 h-6" />,
    shortBreak: <Coffee className="w-6 h-6" />,
    longBreak: <Coffee className="w-6 h-6" />,
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
      <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-white/10 text-white font-medium">
        {modeIcons[mode]}
        <span>{modeText[mode]}</span>
      </div>

      <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 256 256">
          <circle
            cx="128"
            cy="128"
            r="120"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-white/10"
          />
          <motion.circle
            cx="128"
            cy="128"
            r="120"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray="754"
            initial={{ strokeDashoffset: 754 }}
            animate={{ strokeDashoffset: 754 - (754 * progress) / 100 }}
            transition={{ duration: 0.5, ease: "linear" }}
            className={cn("transition-colors duration-500", {
              "text-white": true,
            })}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl sm:text-6xl font-bold text-white tabular-nums">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsActive(!isActive)}
          className={cn(
            "flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg",
            isActive ? "bg-white text-gray-900" : theme[mode] + " text-white border border-white/30"
          )}
        >
          {isActive ? <Pause className="w-6 h-6 sm:w-8 sm:h-8" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 ml-1" />}
        </button>
        <button
          onClick={() => {
            setIsActive(false);
            setTimeLeft(duration * 60);
          }}
          className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
        >
          <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    </div>
  );
}
