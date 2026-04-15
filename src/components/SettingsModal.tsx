import React from "react";
import { X, Check, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TimerSettings, ThemeSettings, SoundSettings } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TimerSettings;
  onSettingsChange: (newSettings: TimerSettings) => void;
  theme: ThemeSettings;
  onThemeChange: (newTheme: ThemeSettings) => void;
  sound: SoundSettings;
  onSoundChange: (newSound: SoundSettings) => void;
  isSyncing?: boolean;
  isDarkMode?: boolean;
}

const COLOR_OPTIONS = [
  { name: "Dark Blue", value: "bg-indigo-900" },
  { name: "Yellow", value: "bg-yellow-400" },
  { name: "Green", value: "bg-green-500" },
  { name: "Rose", value: "bg-rose-500" },
  { name: "Teal", value: "bg-teal-500" },
  { name: "Sky", value: "bg-sky-500" },
  { name: "Indigo", value: "bg-indigo-500" },
  { name: "Amber", value: "bg-amber-500" },
  { name: "Emerald", value: "bg-emerald-500" },
  { name: "Slate", value: "bg-slate-700" },
  { name: "Violet", value: "bg-violet-500" },
];

const SOUND_OPTIONS = [
  { name: "Bell", url: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" },
  { name: "Digital", url: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" },
  { name: "Bird", url: "https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3" },
  { name: "Chime", url: "https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3" },
  { name: "Alert", url: "https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3" },
];

const REPEAT_OPTIONS = [1, 2, 3, 5];

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  theme,
  onThemeChange,
  sound,
  onSoundChange,
  isSyncing,
  isDarkMode,
}: SettingsModalProps) {
  console.log("SettingsModal rendering, isOpen:", isOpen);
  if (!isOpen) return null;

  const handleDurationChange = (key: keyof TimerSettings, value: string) => {
    const numValue = parseInt(value) || 0;
    onSettingsChange({ ...settings, [key]: numValue });
  };

  const handleColorChange = (key: keyof ThemeSettings, color: string) => {
    onThemeChange({ ...theme, [key]: color });
  };

  const testSound = (url: string) => {
    const audio = new Audio(url);
    audio.volume = sound.volume;
    audio.play().catch((err) => console.error("Audio playback failed:", err));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden ${
            isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-800"
          }`}
        >
          <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? "border-white/10" : "border-gray-100"}`}>
            <div className="flex items-center gap-3">
              <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>Settings</h2>
              {isSyncing && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Syncing</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
            {/* Timer Settings */}
            <section>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                Timer Durations (Minutes)
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <DurationInput
                  label="Work"
                  value={settings.work}
                  onChange={(v) => handleDurationChange("work", v)}
                />
                <DurationInput
                  label="Short"
                  value={settings.shortBreak}
                  onChange={(v) => handleDurationChange("shortBreak", v)}
                />
                <DurationInput
                  label="Long"
                  value={settings.longBreak}
                  onChange={(v) => handleDurationChange("longBreak", v)}
                />
              </div>

              <div className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? "bg-white/5" : "bg-gray-100"}`}>
                <div className="space-y-0.5">
                  <h4 className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>Dark Mode when running</h4>
                  <p className="text-[10px] text-gray-500 font-medium">Switch to dark theme while timer is active</p>
                </div>
                <button
                  onClick={() => onSettingsChange({ ...settings, darkModeWhenRunning: !settings.darkModeWhenRunning })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.darkModeWhenRunning ? "bg-gray-900" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                      settings.darkModeWhenRunning ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </section>

            {/* Sound Settings */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                  Sound & Notifications
                </h3>
                <button
                  onClick={() => onSoundChange({ ...sound, enabled: !sound.enabled })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    sound.enabled ? "bg-emerald-500" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                      sound.enabled ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {SOUND_OPTIONS.map((opt) => (
                    <div
                      key={opt.url}
                      onClick={() => onSoundChange({ ...sound, type: opt.url })}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer ${
                        sound.type === opt.url
                          ? "bg-gray-900 text-white"
                          : isDarkMode ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <span className="font-bold text-sm">{opt.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            testSound(opt.url);
                          }}
                          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                        {sound.type === opt.url && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500">Repeat Count</label>
                  <div className="flex gap-2">
                    {REPEAT_OPTIONS.map((count) => (
                      <button
                        key={count}
                        onClick={() => onSoundChange({ ...sound, repeatCount: count })}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                          sound.repeatCount === count
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {count}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-gray-500">
                    <span>Volume</span>
                    <span>{Math.round(sound.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={sound.volume}
                    onChange={(e) => onSoundChange({ ...sound, volume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                  />
                </div>
              </div>
            </section>

            {/* Theme Settings */}
            <section>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                Color Themes
              </h3>
              <div className="space-y-6">
                <ThemePicker
                  label="Focus Mode"
                  current={theme.work}
                  onSelect={(c) => handleColorChange("work", c)}
                />
                <ThemePicker
                  label="Short Break"
                  current={theme.shortBreak}
                  onSelect={(c) => handleColorChange("shortBreak", c)}
                />
                <ThemePicker
                  label="Long Break"
                  current={theme.longBreak}
                  onSelect={(c) => handleColorChange("longBreak", c)}
                />
              </div>
            </section>
          </div>

          <div className={`p-6 flex justify-end ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}>
            <button
              onClick={onClose}
              className="px-8 py-3 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all shadow-lg active:scale-95"
            >
              Save & Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function DurationInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-gray-500">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-gray-100 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
      />
    </div>
  );
}

function ThemePicker({
  label,
  current,
  onSelect,
}: {
  label: string;
  current: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-500">{label}</label>
      <div className="flex flex-wrap gap-2">
        {COLOR_OPTIONS.map((color) => (
          <button
            key={color.value}
            onClick={() => onSelect(color.value)}
            className={`w-8 h-8 rounded-full transition-all transform hover:scale-110 active:scale-90 flex items-center justify-center ${color.value} ${
              current === color.value ? "ring-2 ring-offset-2 ring-gray-400" : ""
            }`}
          >
            {current === color.value && <Check className="w-4 h-4 text-white" />}
          </button>
        ))}
      </div>
    </div>
  );
}
