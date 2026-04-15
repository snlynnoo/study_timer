export interface Session {
  id?: string;
  userId?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  mainTask: string;
  topic: string;
  createdAt?: any;
}

export type TimerMode = "work" | "shortBreak" | "longBreak";

export interface TimerSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  darkModeWhenRunning: boolean;
}

export interface ThemeSettings {
  work: string;
  shortBreak: string;
  longBreak: string;
}

export interface SoundSettings {
  enabled: boolean;
  type: string;
  volume: number;
  repeatCount: number;
}
