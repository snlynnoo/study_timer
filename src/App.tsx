import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { TimerMode, Session, TimerSettings, ThemeSettings, SoundSettings } from "./types";
import Timer from "./components/Timer";
import Dashboard from "./components/Dashboard";
import SessionList from "./components/SessionList";
import PomodoroInfo from "./components/PomodoroInfo";
import HistoryActions from "./components/HistoryActions";
import SettingsModal from "./components/SettingsModal";
import AuthView from "./components/AuthView";
import { Settings as SettingsIcon, LayoutDashboard, Timer as TimerIcon, List, AlertCircle, LogOut, User as UserIcon, Info, Share2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "./lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";

export default function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [mode, setMode] = useState<TimerMode>("work");
  const [mainTask, setMainTask] = useState<string>(() => {
    return localStorage.getItem("pomo_last_main_task") || "";
  });
  const [topic, setTopic] = useState<string>(() => {
    return localStorage.getItem("pomo_last_topic") || "";
  });
  const [isActive, setIsActive] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [view, setView] = useState<"timer" | "dashboard" | "list" | "info">("timer");
  const [startTime, setStartTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<"success" | "error" | null>(null);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
  const [isSettingsSyncing, setIsSettingsSyncing] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  const [settings, setSettings] = useState<TimerSettings>(() => {
    const saved = localStorage.getItem("pomo_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.darkModeWhenRunning === undefined) parsed.darkModeWhenRunning = false;
      return parsed;
    }
    return { work: 25, shortBreak: 5, longBreak: 15, darkModeWhenRunning: false };
  });

  const [timeLeft, setTimeLeft] = useState(settings[mode] * 60);

  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const saved = localStorage.getItem("pomo_theme");
    return saved ? JSON.parse(saved) : { work: "bg-indigo-900", shortBreak: "bg-yellow-400", longBreak: "bg-green-500" };
  });

  const [sound, setSound] = useState<SoundSettings>(() => {
    const saved = localStorage.getItem("pomo_sound");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.type === "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3") {
        parsed.type = "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3";
      } else if (parsed.type === "https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3") {
        parsed.type = "https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3";
      }
      return parsed;
    }
    return { 
      enabled: true, 
      type: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
      volume: 0.5,
      repeatCount: 1
    };
  });

  const lastLocalChangeRef = useRef<number>(0);

  // Initialize Supabase Auth state & handle popup callback message
  useEffect(() => {
    // Check if we are inside a popup callback with hash params
    if (window.opener && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        try {
          window.opener.postMessage(
            {
              type: "SUPABASE_AUTH_SESSION",
              session: {
                access_token: accessToken,
                refresh_token: refreshToken,
              },
            },
            "*"
          );
        } catch {
          // ignore
        }
        setTimeout(() => {
          try {
            window.close();
          } catch {
            // ignore
          }
        }, 300);
      }
    }

    // Global listener for session messages from popup window
    const handlePopupMessage = async (event: MessageEvent) => {
      if (event.data?.type === "SUPABASE_AUTH_SESSION" && event.data?.session?.access_token) {
        try {
          const { data } = await supabase.auth.setSession({
            access_token: event.data.session.access_token,
            refresh_token: event.data.session.refresh_token,
          });
          if (data.session?.user) {
            setUser(data.session.user);
            setIsAuthReady(true);
            setIsLoading(false);
          }
        } catch (e) {
          console.error("Error setting session from popup:", e);
        }
      }
    };
    window.addEventListener("message", handlePopupMessage);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthReady(true);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsInitialSyncDone(false);
        setSessions([]);
      } else if (window.opener) {
        // If inside popup window, send session tokens to opener
        try {
          window.opener.postMessage(
            {
              type: "SUPABASE_AUTH_SESSION",
              session: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              },
            },
            "*"
          );
        } catch {
          // ignore
        }
        setTimeout(() => {
          try {
            window.close();
          } catch {
            // ignore
          }
        }, 400);
      }
      setIsAuthReady(true);
      setIsLoading(false);
    });

    return () => {
      window.removeEventListener("message", handlePopupMessage);
      subscription.unsubscribe();
    };
  }, []);

  const fetchSessions = async (userId: string, retries = 2) => {
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        if ((error.code === "PGRST303" || error.message?.includes("future")) && retries > 0) {
          setTimeout(() => fetchSessions(userId, retries - 1), 1500);
          return;
        }
        throw error;
      }

      const mapped: Session[] = (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        date: row.date,
        startTime: row.start_time || row.startTime || "",
        endTime: row.end_time || row.endTime || "",
        duration: Number(row.duration) || 0,
        mainTask: row.main_task || row.mainTask || "General",
        topic: row.topic || "General",
        createdAt: row.created_at,
      }));
      setSessions(mapped);
    } catch (err: any) {
      console.error("Error fetching sessions from Supabase:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch and subscribe to sessions
  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }

    fetchSessions(user.id);

    const channel = supabase
      .channel(`public:sessions:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `user_id=eq.${user.id}` },
        () => {
          fetchSessions(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Sync settings from Supabase
  useEffect(() => {
    if (!user) {
      setIsInitialSyncDone(false);
      return;
    }

    const fetchSettings = async (retries = 2) => {
      try {
        const { data, error } = await supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          if ((error.code === "PGRST303" || error.message?.includes("future")) && retries > 0) {
            setTimeout(() => fetchSettings(retries - 1), 1500);
            return;
          }
          if (error.code !== "PGRST116") {
            console.error("Error fetching settings:", error);
          }
        }

        if (data) {
          if (data.timer) {
            setSettings((prev) => {
              const newTimer = { ...data.timer };
              if (newTimer.darkModeWhenRunning === undefined) newTimer.darkModeWhenRunning = false;
              return newTimer;
            });
          }
          if (data.theme) setTheme(data.theme);
          if (data.sound) setSound(data.sound);
        }
      } catch (err) {
        console.error("Settings sync error:", err);
      } finally {
        setIsInitialSyncDone(true);
      }
    };

    fetchSettings();
  }, [user]);

  // Save settings to Supabase
  useEffect(() => {
    if (!user || !isInitialSyncDone) return;
    
    const timer = setTimeout(async () => {
      try {
        setIsSettingsSyncing(true);
        await supabase
          .from("user_settings")
          .upsert({
            user_id: user.id,
            timer: settings,
            theme: theme,
            sound: sound,
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.error("Failed to save settings:", err);
      } finally {
        setIsSettingsSyncing(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, settings, theme, sound, isInitialSyncDone]);

  // Track local changes separately
  useEffect(() => {
    if (isInitialSyncDone) {
      lastLocalChangeRef.current = Date.now();
    }
  }, [settings, theme, sound, isInitialSyncDone]);

  useEffect(() => {
    if (lastSyncStatus === "success") {
      const timer = setTimeout(() => setLastSyncStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncStatus]);

  useEffect(() => {
    localStorage.setItem("pomo_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("pomo_theme", JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("pomo_sound", JSON.stringify(sound));
  }, [sound]);

  useEffect(() => {
    localStorage.setItem("pomo_last_main_task", mainTask);
  }, [mainTask]);

  useEffect(() => {
    localStorage.setItem("pomo_last_topic", topic);
  }, [topic]);

  const saveSession = async (session: Session) => {
    if (!user) return false;
    try {
      setIsSyncing(true);
      setLastSyncStatus(null);
      const { error } = await supabase
        .from("sessions")
        .insert({
          user_id: user.id,
          date: session.date,
          start_time: session.startTime,
          end_time: session.endTime,
          duration: session.duration,
          main_task: session.mainTask,
          topic: session.topic,
        });

      if (error) throw error;
      setLastSyncStatus("success");
      await fetchSessions(user.id);
      return true;
    } catch (err: any) {
      console.error("Error saving session:", err);
      setLastSyncStatus("error");
      setError("Failed to save session to Supabase.");
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const playSound = () => {
    if (sound.enabled) {
      const audio = new Audio(sound.type);
      audio.volume = sound.volume;
      
      let count = 0;
      const play = () => {
        if (count < sound.repeatCount) {
          audio.currentTime = 0;
          audio.play().catch((e) => console.error("Audio playback failed:", e));
          count++;
        }
      };

      audio.onended = play;
      play();
    }
  };

  const showNotification = (mode: TimerMode) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const title = mode === "work" ? "Focus Session Complete!" : "Break Over!";
      const body = mode === "work" ? "Time for a short break." : "Ready to focus again?";
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };

  const handleTimerComplete = React.useCallback(async () => {
    const completedMode = mode;
    const completedMainTask = mainTask;
    const completedTopic = topic;
    const completedStartTime = startTime;
    const completedDuration = settings[mode];

    if (mode === "work") {
      setMode("shortBreak");
    } else {
      setMode("work");
    }
    setIsActive(false);
    setStartTime(null);

    playSound();
    showNotification(completedMode);

    if (completedMode === "work" && user) {
      const endTime = format(new Date(), "HH:mm");
      const newSession: Session = {
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: completedStartTime || format(new Date(Date.now() - completedDuration * 60000), "HH:mm"),
        endTime,
        duration: completedDuration,
        mainTask: completedMainTask,
        topic: completedTopic,
      };
      await saveSession(newSession);
    }
  }, [mode, mainTask, topic, startTime, settings, sound, user]);

  const handleDeleteSession = async (id: string) => {
    try {
      const { error } = await supabase.from("sessions").delete().eq("id", id);
      if (error) throw error;
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      console.error("Error deleting session:", err);
      setError("Failed to delete session.");
    }
  };

  const handleUpdateSession = async (id: string, updates: Partial<Session>) => {
    try {
      const dbUpdates: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
      if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
      if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
      if (updates.mainTask !== undefined) dbUpdates.main_task = updates.mainTask;
      if (updates.topic !== undefined) dbUpdates.topic = updates.topic;

      const { error } = await supabase.from("sessions").update(dbUpdates).eq("id", id);
      if (error) throw error;
      setLastSyncStatus("success");
      if (user) await fetchSessions(user.id);
    } catch (err: any) {
      console.error("Error updating session:", err);
      setError("Failed to update session.");
    }
  };

  const toggleTimer = React.useCallback((active: boolean) => {
    if (active && !startTime) {
      setStartTime(format(new Date(), "HH:mm"));
    }
    setIsActive(active);
  }, [startTime]);

  useEffect(() => {
    if (!isActive) {
      const newTime = settings[mode] * 60;
      setTimeLeft(newTime);
    }
  }, [mode, settings, isActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft <= 0 && isActive) {
      handleTimerComplete();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, handleTimerComplete]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleShare = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    setShowShareTooltip(true);
    setTimeout(() => setShowShareTooltip(false), 2000);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthView onSuccess={() => {}} />;
  }

  const isDarkMode = settings.darkModeWhenRunning && isActive;
  const currentThemeClass = isDarkMode ? "bg-gray-950" : theme[mode];
  const currentTextClass = isDarkMode ? "text-white" : "text-gray-900";
  const userDisplayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User";
  const userAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;

  return (
    <div className={`min-h-screen transition-colors duration-1000 ${currentThemeClass} font-sans ${currentTextClass}`}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center p-2 sm:p-4">
        <div className="flex items-center gap-0.5 sm:gap-1 p-1 bg-white/20 backdrop-blur-lg rounded-2xl border border-white/30 shadow-xl max-w-[98vw] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 px-3 py-1.5 mr-1 border-r border-white/20 shrink-0">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userDisplayName}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-full object-cover border border-white/40"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="hidden lg:block text-xs font-bold text-white whitespace-nowrap max-w-[120px] truncate">
              Hi, {userDisplayName}
            </span>
          </div>

          <NavButton
            active={view === "timer"}
            onClick={() => setView("timer")}
            icon={<TimerIcon className="w-5 h-5" />}
            label="Timer"
          />
          <NavButton
            active={view === "dashboard"}
            onClick={() => setView("dashboard")}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Stats"
          />
          <NavButton
            active={view === "list"}
            onClick={() => setView("list")}
            icon={<List className="w-5 h-5" />}
            label="History"
          />
          <NavButton
            active={view === "info"}
            onClick={() => setView("info")}
            icon={<Info className="w-5 h-5" />}
            label="Guide"
          />
          
          <div className="w-px h-6 bg-white/20 mx-0.5 sm:mx-1 shrink-0" />
          
          <button
            onClick={handleShare}
            className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-white hover:bg-white/10 transition-all shrink-0"
            title="Share App"
          >
            {showShareTooltip ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
            <AnimatePresence>
              {showShareTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg whitespace-nowrap shadow-lg"
                >
                  Link Copied!
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-white hover:bg-white/10 transition-all shrink-0"
          >
            <SettingsIcon className="w-5 h-5" />
            {isInitialSyncDone && (
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-indigo-900 ${isSettingsSyncing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            )}
          </button>
          
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-white hover:bg-white/10 transition-all shrink-0"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="pt-20 sm:pt-24 pb-12 px-4 flex flex-col items-center">

        {error && (
          <div className="mb-8 w-full max-w-md">
            <div className="p-4 bg-white/90 backdrop-blur rounded-2xl border border-rose-200 flex items-center gap-3 text-rose-600 shadow-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-xs font-bold uppercase">Dismiss</button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "timer" && (
            <motion.div
              key="timer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center w-full"
            >
              <div className="mb-8 w-full max-w-md grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-white/70 text-[10px] font-bold uppercase tracking-widest ml-4">
                    Main Task / Module
                  </label>
                  <input
                    type="text"
                    value={mainTask}
                    onChange={(e) => setMainTask(e.target.value)}
                    placeholder="Enter main task"
                    className="w-full px-5 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-base"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-white/70 text-[10px] font-bold uppercase tracking-widest ml-4">
                    Specific Topic
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter specific topic"
                    className="w-full px-5 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-base"
                  />
                </div>
              </div>

              <div className="flex gap-2 mb-8 p-1 bg-black/10 rounded-2xl">
                <ModeButton
                  active={mode === "work"}
                  onClick={() => setMode("work")}
                  label="Work"
                />
                <ModeButton
                  active={mode === "shortBreak"}
                  onClick={() => setMode("shortBreak")}
                  label="Short Break"
                />
                <ModeButton
                  active={mode === "longBreak"}
                  onClick={() => setMode("longBreak")}
                  label="Long Break"
                />
              </div>

              <Timer
                mode={mode}
                duration={settings[mode]}
                timeLeft={timeLeft}
                setTimeLeft={setTimeLeft}
                isActive={isActive}
                setIsActive={toggleTimer}
                theme={theme}
              />

              {isSyncing && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/20"
                >
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Saving to Supabase...</span>
                </motion.div>
              )}

              {lastSyncStatus === "success" && !isSyncing && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-8 flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-full border border-emerald-500/30"
                >
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Session Saved!</span>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full flex flex-col items-center"
            >
              <Dashboard sessions={sessions} isDarkMode={isDarkMode} />
            </motion.div>
          )}

          {view === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full flex flex-col items-center"
            >
              <div className="w-full max-w-2xl mb-2 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSyncing ? "bg-amber-400 animate-pulse" : lastSyncStatus === "error" ? "bg-rose-500" : "bg-emerald-500"}`} />
                  <span className="text-white/60 text-xs font-medium">
                    {isSyncing ? "Syncing..." : lastSyncStatus === "error" ? "Sync Failed" : "Synced with Supabase"}
                  </span>
                </div>
              </div>
              
              <HistoryActions 
                sessions={sessions} 
                onInsert={saveSession} 
                isDarkMode={isDarkMode} 
              />

              <SessionList 
                sessions={sessions} 
                onDelete={handleDeleteSession}
                onUpdate={handleUpdateSession}
                isDarkMode={isDarkMode} 
              />
            </motion.div>
          )}

          {view === "info" && (
            <motion.div
              key="info"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center"
            >
              <PomodoroInfo />
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-20 pb-8 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="space-y-2"
          >
            <p className="text-white/60 text-sm font-medium tracking-wide">
              Made with <span className="text-rose-400 animate-pulse">♥️</span> by <span className="text-white font-bold">Sai</span>, Enjoy!
            </p>
            <div className="flex flex-col items-center gap-1">
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.2em]">
                Productivity • Focus • Discipline
              </p>
              <p className="text-white/20 text-[9px] font-bold tracking-widest">
                VERSION 1.2.0
              </p>
            </div>
          </motion.div>
        </footer>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        theme={theme}
        onThemeChange={setTheme}
        sound={sound}
        onSoundChange={setSound}
        isSyncing={isSettingsSyncing}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all shrink-0 ${
        active ? "bg-white text-gray-900 shadow-lg" : "text-white hover:bg-white/10"
      }`}
    >
      {icon}
      <span className="hidden md:block text-sm font-bold">{label}</span>
    </button>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
        active ? "bg-white/20 text-white" : "text-white/50 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
