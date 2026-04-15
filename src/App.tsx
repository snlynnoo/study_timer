import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { TimerMode, Session, TimerSettings, ThemeSettings, SoundSettings } from "./types";
import Timer from "./components/Timer";
import Dashboard from "./components/Dashboard";
import SessionList from "./components/SessionList";
import PomodoroInfo from "./components/PomodoroInfo";
import HistoryActions from "./components/HistoryActions";
import SettingsModal from "./components/SettingsModal";
import { Settings as SettingsIcon, LayoutDashboard, Timer as TimerIcon, List, AlertCircle, LogIn, LogOut, User, Info, Share2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logout, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  setDoc,
  getDoc
} from "./lib/firebase";
import { User as FirebaseUser } from "firebase/auth";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [mode, setMode] = useState<TimerMode>("work");
  const [mainTask, setMainTask] = useState("Study");
  const [topic, setTopic] = useState("General");
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
  const lastLocalChangeRef = useRef<number>(0);
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

  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const saved = localStorage.getItem("pomo_theme");
    return saved ? JSON.parse(saved) : { work: "bg-indigo-900", shortBreak: "bg-yellow-400", longBreak: "bg-green-500" };
  });

  const [sound, setSound] = useState<SoundSettings>(() => {
    const saved = localStorage.getItem("pomo_sound");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate broken Mixkit URLs
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsInitialSyncDone(false);
      }
      setIsAuthReady(true);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }

    const path = "sessions";
    const q = query(
      collection(db, path),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionData: Session[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Session));
      setSessions(sessionData);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      setError("Failed to sync sessions. Check your connection.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync settings from Firestore
  useEffect(() => {
    if (!user) {
      setIsInitialSyncDone(false);
      return;
    }

    const path = `settings/${user.uid}`;
    const unsubscribe = onSnapshot(doc(db, "settings", user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Migrate broken Mixkit URLs in sound settings
        if (data.sound?.type === "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3") {
          data.sound.type = "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3";
        } else if (data.sound?.type === "https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3") {
          data.sound.type = "https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3";
        }

        // Only update local state if it's different and we're not currently syncing
        // AND if we haven't made a local change in the last 3 seconds
        const now = Date.now();
        if (now - lastLocalChangeRef.current < 3000) {
          console.log("Ignoring server sync because of recent local change");
          return;
        }

        setSettings(prev => {
          const newTimer = { ...data.timer };
          if (newTimer.darkModeWhenRunning === undefined) newTimer.darkModeWhenRunning = false;
          if (JSON.stringify(newTimer) !== JSON.stringify(prev)) return newTimer;
          return prev;
        });
        setTheme(prev => {
          if (JSON.stringify(data.theme) !== JSON.stringify(prev)) return data.theme;
          return prev;
        });
        setSound(prev => {
          if (JSON.stringify(data.sound) !== JSON.stringify(prev)) return data.sound;
          return prev;
        });
      }
      setIsInitialSyncDone(true);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      setIsInitialSyncDone(true);
    });

    return () => unsubscribe();
  }, [user]);

  // Save settings to Firestore
  useEffect(() => {
    if (!user || !isInitialSyncDone) return;
    
    lastLocalChangeRef.current = Date.now();
    
    const timer = setTimeout(async () => {
      const path = `settings/${user.uid}`;
      try {
        setIsSettingsSyncing(true);
        await setDoc(doc(db, "settings", user.uid), {
          timer: settings,
          theme: theme,
          sound: sound,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      } finally {
        setIsSettingsSyncing(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, settings, theme, sound, isInitialSyncDone]);

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

  const saveSession = async (session: Session) => {
    if (!user) return false;
    const path = "sessions";
    try {
      setIsSyncing(true);
      setLastSyncStatus(null);
      await addDoc(collection(db, path), {
        ...session,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      setLastSyncStatus("success");
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      setLastSyncStatus("error");
      setError("Failed to save session to Firestore.");
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
          audio.play().catch(e => console.error("Audio playback failed:", e));
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
    const path = `sessions/${id}`;
    try {
      await deleteDoc(doc(db, "sessions", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      setError("Failed to delete session.");
    }
  };

  const toggleTimer = React.useCallback((active: boolean) => {
    if (active && !startTime) {
      setStartTime(format(new Date(), "HH:mm"));
    }
    setIsActive(active);
  }, [startTime]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login failed:", err);
      // Ignore if user closed the popup
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setError("Login failed: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsLoggingIn(false);
    }
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
    return (
      <div className="min-h-screen bg-rose-500 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <TimerIcon className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Study Timer by Sai</h1>
          <p className="text-gray-500 mb-8">Sign in to track your study sessions and visualize your progress with Firebase.</p>
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg disabled:opacity-50"
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            {isLoggingIn ? "Signing in..." : "Continue with Google"}
          </button>
          
          <div className="mt-12 text-center">
            <p className="text-gray-400 text-xs font-medium tracking-wide">
              Made with <span className="text-rose-500 animate-pulse">♥️</span> by <span className="text-gray-900 font-bold">Sai</span>, Enjoy!
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const isDarkMode = settings.darkModeWhenRunning && isActive;
  const currentThemeClass = isDarkMode ? "bg-gray-950" : theme[mode];
  const currentTextClass = isDarkMode ? "text-white" : "text-gray-900";

  return (
    <div className={`min-h-screen transition-colors duration-1000 ${currentThemeClass} font-sans ${currentTextClass}`}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center p-2 sm:p-4">
        <div className="flex items-center gap-0.5 sm:gap-1 p-1 bg-white/20 backdrop-blur-lg rounded-2xl border border-white/30 shadow-xl max-w-[98vw] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 px-3 py-1.5 mr-1 border-r border-white/20 shrink-0">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || ""} 
                className="w-6 h-6 rounded-full border border-white/40" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="hidden lg:block text-xs font-bold text-white whitespace-nowrap">
              Hi, {user.displayName?.split(" ")[0] || "User"}
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
            onClick={logout}
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
                    placeholder="e.g. Mathematics"
                    className="w-full px-5 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-base"
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
                    placeholder="e.g. Calculus"
                    className="w-full px-5 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-base"
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
                onComplete={handleTimerComplete}
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
                  <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Saving to Firebase...</span>
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
              <div className="w-full max-w-2xl mb-6 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSyncing ? "bg-amber-400 animate-pulse" : lastSyncStatus === "error" ? "bg-rose-500" : "bg-emerald-500"}`} />
                  <span className="text-white/60 text-xs font-medium">
                    {isSyncing ? "Syncing..." : lastSyncStatus === "error" ? "Sync Failed" : "Synced with Firestore"}
                  </span>
                </div>
              </div>
              
              <HistoryActions 
                sessions={sessions} 
                onInsert={saveSession} 
                isDarkMode={isDarkMode} 
              />

              <SessionList sessions={sessions} onDelete={handleDeleteSession} isDarkMode={isDarkMode} />
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
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.2em]">
              Productivity • Focus • Discipline
            </p>
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
