import React from "react";
import { Check, Volume2 } from "lucide-react";
import { TimerSettings, ThemeSettings, SoundSettings } from "../types";
import { TIMER_THEME_OPTIONS } from "../lib/palette";

interface SettingsPageProps {
  settings: TimerSettings;
  onSettingsChange: (newSettings: TimerSettings) => void;
  theme: ThemeSettings;
  onThemeChange: (newTheme: ThemeSettings) => void;
  sound: SoundSettings;
  onSoundChange: (newSound: SoundSettings) => void;
  isSyncing?: boolean;
  isDarkMode?: boolean;
}

const COLOR_OPTIONS = TIMER_THEME_OPTIONS;

const SOUND_OPTIONS = [
  { name: "Bell", url: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" },
  { name: "Digital", url: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" },
  { name: "Bird", url: "https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3" },
  { name: "Chime", url: "https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3" },
  { name: "Alert", url: "https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3" },
];

const REPEAT_OPTIONS = [1, 2, 3, 5];

export default function SettingsPage({
  settings,
  onSettingsChange,
  theme,
  onThemeChange,
  sound,
  onSoundChange,
  isSyncing,
  isDarkMode,
}: SettingsPageProps) {

  const handleDurationChange = (key: keyof TimerSettings, value: string) => {
    const numValue = parseInt(value) || 0;
    if(numValue>=1&&numValue<=1440)onSettingsChange({ ...settings, [key]: numValue });
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
    <section className={`settings-page settings-panel ${isDarkMode ? 'text-white' : 'text-gray-800'}`} aria-labelledby="settings-heading">
      <header className="settings-page-heading">
        <h1 id="settings-heading">Settings</h1>
        <p role="status" className={isSyncing ? 'settings-save-status saving' : 'settings-save-status'}>
          <span/>{isSyncing ? 'Saving…' : 'Changes save automatically'}
        </p>
      </header>
      <div className="settings-content">
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
                  <p className="text-xs text-gray-500 font-medium">Switch to dark theme while timer is active</p>
                </div>
                <button
                  aria-label="Dark mode when running"
                  role="switch"
                  aria-checked={settings.darkModeWhenRunning}
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
                  aria-label="Enable sound"
                  role="switch"
                  aria-checked={sound.enabled}
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
                          aria-label={`Preview ${opt.name} sound`}
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
                    aria-label="Volume"
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

    </section>
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
        aria-label={`${label} duration in minutes`}
        min="1"
        max="1440"
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
            style={{backgroundColor:color.color}}
            aria-label={`${label}: ${color.name}`}
            aria-pressed={current === color.value}
            onClick={() => onSelect(color.value)}
            className={`w-8 h-8 rounded-full transition-all transform hover:scale-110 active:scale-90 flex items-center justify-center ${color.value} ${
              current === color.value ? "ring-2 ring-offset-2 ring-gray-400" : ""
            }`}
          >
            {current === color.value && <Check className="w-4 h-4" style={{color:color.name === "Orange" || color.name === "Muted teal" ? "#1f3148" : "#fff"}} />}
          </button>
        ))}
      </div>
    </div>
  );
}
