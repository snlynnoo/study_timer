import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
interface TimerProps {
  mode: 'work' | 'shortBreak' | 'longBreak';
  duration: number;
  timeLeft: number;
  isActive: boolean;
  onToggle: (active:boolean)=>void;
  onReset:()=>void;
  disabled?:boolean;
  theme: {work:string;shortBreak:string;longBreak:string};
}
export default function Timer({mode,duration,timeLeft,isActive,onToggle,onReset,disabled}:TimerProps) {
  const progress = Math.max(0,Math.min(1,(duration*60-timeLeft)/(duration*60)));
  const clock = `${Math.floor(timeLeft/60).toString().padStart(2,'0')}:${(timeLeft%60).toString().padStart(2,'0')}`;
  return <div className="focus-timer">
    <div className="timer-dial">
      <svg viewBox="0 0 320 320" aria-hidden="true"><circle className="dial-track" cx="160" cy="160" r="142"/><circle className="dial-ticks" cx="160" cy="160" r="126"/><motion.circle className="dial-progress" cx="160" cy="160" r="142" strokeDasharray={892.21} initial={false} animate={{strokeDashoffset:892.21*progress}} transition={{duration:.5,ease:'linear'}}/></svg>
      <div className="dial-content"><span className="dial-label">{mode==='work' ? 'TIME TO FOCUS' : 'ROOM TO RECHARGE'}</span><span className="dial-time" role="timer" aria-label={`${Math.floor(timeLeft/60)} minutes ${timeLeft%60} seconds remaining`}>{clock}</span><span className="dial-state">{isActive ? 'Stay with this moment.' : progress>0 ? 'Take a breath. Keep going.' : mode==='work' ? 'Make this time yours.' : 'You’ve earned a little pause.'}</span></div>
    </div>
    <div className="timer-controls"><button className="timer-start" disabled={disabled} onClick={()=>onToggle(!isActive)}>{isActive ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}{isActive ? 'Pause session' : progress>0 ? 'Resume session' : mode==='work' ? 'Start focus' : 'Start break'}</button><button className="timer-reset" aria-label="Reset timer" title="Reset timer" disabled={disabled} onClick={onReset}><RotateCcw size={18}/></button></div>
  </div>;
}
