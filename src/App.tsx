import React, { useState, useEffect, useRef } from "react";
import {APP_LABEL} from './lib/appInfo';
import { format } from "date-fns";
import { TimerMode, Session, TimerSettings, ThemeSettings, SoundSettings } from "./types";
import Timer from "./components/Timer";
import Dashboard from "./components/Dashboard";
import SessionList from "./components/SessionList";
import PomodoroInfo from "./components/PomodoroInfo";
import HistoryActions from "./components/HistoryActions";
import SettingsPage from "./components/SettingsPage";
import AuthView from "./components/AuthView";
import { Settings as SettingsIcon, LayoutDashboard, Timer as TimerIcon, List, AlertCircle, User as UserIcon, Info, Check, ArrowUpRight, Clock3, Target, Flame, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api, type LocalUser } from "./lib/api";
import UsersView from "./components/UsersView";
import TextSizeControl from "./components/TextSizeControl";
import TodoView from "./components/TodoView";
import LiveClock from "./components/LiveClock";
import UserMenu from "./components/UserMenu";
import { normalizeTimerTheme, timerColor } from "./lib/palette";
import { usePomodoroTimer } from "./hooks/usePomodoroTimer";
import type { TimerEvent } from "./lib/timerMachine";
import LongBreakPrompt from "./components/LongBreakPrompt";
import BreakDuration from "./components/BreakDuration";
import FeedbackView from './components/FeedbackView';
import {MessageSquare} from 'lucide-react';

export default function App() {
  const [fontSize, setFontSize] = useState(() => {
    const saved = Number(localStorage.getItem('study_font_size'));
    return Number.isFinite(saved) && saved >= 14 && saved <= 22 ? saved : 16;
  });
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [mainTask, setMainTask] = useState("");
  const [topic, setTopic] = useState("");
  const [taskDetailsRequested,setTaskDetailsRequested]=useState(false);
  const [newRegistrations,setNewRegistrations]=useState(0);
  const [unreadFeedback,setUnreadFeedback]=useState(0);
  const [usersListVersion,setUsersListVersion]=useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [view, setView] = useState<"timer" | "dashboard" | "list" | "info" | "users" | "todos" | "settings" | "feedback">("timer");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<"success" | "error" | null>(null);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
  const [isSettingsSyncing, setIsSettingsSyncing] = useState(false);


  const [settings, setSettings] = useState<TimerSettings>({ work: 25, shortBreak: 5, longBreak: 15, darkModeWhenRunning: false });
  const [theme, setTheme] = useState<ThemeSettings>({ work: "bg-indigo-900", shortBreak: "bg-yellow-400", longBreak: "bg-green-500" });
  const [sound, setSound] = useState<SoundSettings>({ enabled: true, type: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3", volume: 0.5, repeatCount: 1 });
  const lastLocalChangeRef = useRef<number>(0);
  const currentUserId = useRef(user?.id);
  const mainTaskInput=useRef<HTMLInputElement>(null);
  const topicInput=useRef<HTMLInputElement>(null);
  const feedbackCountRequest=useRef(0);
  currentUserId.current = user?.id;
  const refreshRegistrationCount=()=>{
    const owner=user?.id;
    if(user?.role!=='admin')return;
    api<{count:number}>('/users/registrations').then(({count})=>{if(currentUserId.current===owner)setNewRegistrations(count);}).catch(()=>{});
    const request=++feedbackCountRequest.current;
    api<{count:number}>('/feedback/unread-count').then(({count})=>{
      if(currentUserId.current===owner&&request===feedbackCountRequest.current)setUnreadFeedback(count);
    }).catch(()=>{});
  };
  const updateFeedbackCount=(count:number)=>{
    if(user?.role==='admin'&&currentUserId.current===user.id){feedbackCountRequest.current++;setUnreadFeedback(count);}
  };
  useEffect(()=>{
    setNewRegistrations(0);
    setUnreadFeedback(0);feedbackCountRequest.current++;
    if(user?.role!=='admin')return;
    refreshRegistrationCount();
    const interval=setInterval(refreshRegistrationCount,30_000);
    window.addEventListener('focus',refreshRegistrationCount);
    return()=>{clearInterval(interval);window.removeEventListener('focus',refreshRegistrationCount);};
  },[user?.id,user?.role]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem('study_font_size', String(fontSize));
  }, [fontSize]);

  const signedIn = (account: LocalUser) => {
    setIsInitialSyncDone(false);
    setSettings({work:25,shortBreak:5,longBreak:15,darkModeWhenRunning:false});
    setTheme({work:"bg-indigo-900",shortBreak:"bg-yellow-400",longBreak:"bg-green-500"});
    setSound({enabled:true,type:"https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",volume:0.5,repeatCount:1});
    setView("timer"); setMainTask(""); setTopic(""); setTaskDetailsRequested(false); setError(null); setUser(account);
  };

  useEffect(() => {
    if(window.location.hash.startsWith('#reset-password=')){setIsAuthReady(true);setIsLoading(false);return;}
    api('/auth/me').then(({user}) => { if (user) signedIn(user); })
      .catch(e => setError(e.message))
      .finally(() => {setIsAuthReady(true);setIsLoading(false);});
  }, []);

  const fetchSessions = async (userId: string) => {
    try {
      const data = await api('/sessions');
      if (currentUserId.current !== userId) return;
      setSessions(data.map((row: any) => ({
        id:row.id,userId:row.user_id,date:row.date,startTime:row.start_time,endTime:row.end_time,
        duration:row.duration,breakSeconds:row.break_seconds,mainTask:row.main_task,topic:row.topic,createdAt:row.created_at,
      })));
    } catch (e: any) { setError(e.message); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (!user) { setSessions([]); return; }
    fetchSessions(user.id);
  }, [user]);

  useEffect(() => {
    if (!user) {setIsInitialSyncDone(false); return;}
    let cancelled = false;
    api('/settings').then(data => {
      if (cancelled) return;
      if (data?.timer) setSettings({...data.timer,darkModeWhenRunning:data.timer.darkModeWhenRunning ?? false});
      if (data?.theme) setTheme(normalizeTimerTheme(data.theme));
      if (data?.sound) setSound(data.sound);
      setIsInitialSyncDone(true);
    }).catch(e => {if (!cancelled) setError('Unable to load settings: ' + e.message);});
    return () => {cancelled=true;};
  }, [user]);

  useEffect(() => {
    if (!user || !isInitialSyncDone) return;
    const timer = setTimeout(async () => {
      setIsSettingsSyncing(true);
      try { await api('/settings',{method:'PUT',body:JSON.stringify({timer:settings,theme,sound})}); }
      catch (e: any) { setError('Unable to save settings: ' + e.message); }
      finally {setIsSettingsSyncing(false);}
    }, 800);
    return () => clearTimeout(timer);
  }, [user,settings,theme,sound,isInitialSyncDone]);

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

  const saveSession = async (session: Session) => {
    if (!user) return false;
    try {
      setIsSyncing(true);
      setLastSyncStatus(null);
      await api('/sessions', {method:'POST',body:JSON.stringify({
        date:session.date,start_time:session.startTime,end_time:session.endTime,
        duration:session.duration,main_task:session.mainTask,topic:session.topic,break_seconds:session.breakSeconds,
      })});
      setLastSyncStatus("success");
      await fetchSessions(user.id);
      return true;
    } catch (err: any) {
      console.error("Error saving session:", err);
      setLastSyncStatus("error");
      setError("Failed to save session to the local database.");
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
      const body = mode === "work" ? "Your focus session is complete. Time to take a break." : "Ready to focus again?";
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };

  const handleTimerEvent = async (event:TimerEvent,owner:string) => {
    if(currentUserId.current!==owner)throw new Error('Account changed.');
    setIsSyncing(true);
    try {
      if(event.type==='focus'){
        await api('/sessions',{method:'POST',body:JSON.stringify({id:event.sessionId,owner_id:owner,
          date:format(new Date(event.startedAt),'yyyy-MM-dd'),start_time:format(new Date(event.startedAt),'HH:mm'),
          end_time:format(new Date(event.endedAt),'HH:mm'),duration:event.duration,main_task:event.mainTask||'General',topic:event.topic||'General'})});
      }else await api(`/sessions/${event.sessionId}/break`,{method:'PUT',body:JSON.stringify({seconds:event.seconds,owner_id:owner})});
      if(currentUserId.current===owner){setLastSyncStatus('success');await fetchSessions(owner);}
    }catch(e:any){
      if(currentUserId.current===owner){setLastSyncStatus('error');setError('Unable to save timer progress. It is kept on this device and will retry automatically.');}
      throw e;
    }finally{setIsSyncing(false);}
  };
  const timer=usePomodoroTimer({userId:user?.id,ready:isInitialSyncDone,settings,mainTask,topic,onEvent:handleTimerEvent,
    onComplete:(completedMode)=>{playSound();showNotification(completedMode);},
    onRestore:state=>{setMainTask(state.focusTask||'');setTopic(state.focusTopic||'');}});
  const {mode,timeLeft,isActive,setMode,toggle:toggleTimer,reset:resetTimer}=timer;
  const startOrPauseTimer=(active:boolean)=>{
    if(active&&mode==='work'&&(!mainTask.trim()||!topic.trim())) {
      setTaskDetailsRequested(true);
      const input=!mainTask.trim()?mainTaskInput.current:topicInput.current;
      input?.focus();input?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    setTaskDetailsRequested(false);
    toggleTimer(active);
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await api(`/sessions/${id}`, {method:"DELETE"});
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
      if (updates.breakSeconds !== undefined) dbUpdates.break_seconds = updates.breakSeconds;

      await api(`/sessions/${id}`, {method:"PATCH",body:JSON.stringify(dbUpdates)});
      setLastSyncStatus("success");
      if (user) await fetchSessions(user.id);
      return true;
    } catch (err: any) {
      console.error("Error updating session:", err);
      setError("Failed to update session.");
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      toggleTimer(false);
      await api('/auth/logout',{method:'POST',body:'{}'});
      setIsInitialSyncDone(false);setUser(null);setSessions([]);setView('timer');setError(null);
    } catch (e: any) {setError(e.message);}
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthView onSuccess={signedIn} fontSize={fontSize} onFontSizeChange={setFontSize} />;
  }

  const isDarkMode = settings.darkModeWhenRunning && isActive;
  const userDisplayName = user.name || user.email.split('@')[0];
  const todaySessions = sessions.filter(session => session.date === format(new Date(), 'yyyy-MM-dd'));
  const todayMinutes = todaySessions.reduce((total, session) => total + session.duration, 0);
  const totalMinutes = sessions.reduce((total, session) => total + session.duration, 0);


  return (
    <div className={`study-app ${isDarkMode ? 'study-dark' : ''}`} style={{'--mode-accent':timerColor(theme[mode])} as React.CSSProperties}>
      <aside className="app-sidebar" inert={timer.awaitingLongBreak}>
        <a className="brand" href="/" aria-label="Study Timer home"><span className="brand-icon"><TimerIcon size={23}/></span><span>study<span className="brand-light">timer</span></span><span className="brand-dot"/></a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <NavButton active={view === 'timer'} onClick={()=>setView('timer')} icon={<TimerIcon size={19}/>} label="Timer"/>
          <NavButton active={view === 'dashboard'} onClick={()=>setView('dashboard')} icon={<LayoutDashboard size={19}/>} label="Stats"/>
          <NavButton active={view === 'list'} onClick={()=>setView('list')} icon={<List size={19}/>} label="History"/>
          <NavButton active={view === 'todos'} onClick={()=>setView('todos')} icon={<CalendarDays size={19}/>} label="To-do"/>
          <NavButton active={view === 'info'} onClick={()=>setView('info')} icon={<Info size={19}/>} label="Guide"/>
          {user.role === 'admin' && <NavButton active={view === 'users'} onClick={()=>{setView('users');setUsersListVersion(value=>value+1);}} icon={<UserIcon size={19}/>} label="Users" badge={newRegistrations}/>}
          <NavButton active={view === 'settings'} onClick={()=>setView('settings')} icon={<SettingsIcon size={19}/>} label="Settings"/>
          <NavButton active={view === 'feedback'} onClick={()=>setView('feedback')} icon={<MessageSquare size={19}/>} label="Feedback" badge={user.role==='admin'?unreadFeedback:0} badgeLabel={`${unreadFeedback} unread feedback messages`}/>
        </nav>
      </aside>
      <div className="workspace" inert={timer.awaitingLongBreak}>
        <header className="workspace-header"><TextSizeControl value={fontSize} onChange={setFontSize}/><div className="header-actions"><LiveClock/><UserMenu name={userDisplayName} role={user.role} onLogout={handleLogout}/></div></header>
        <main className="workspace-main">
        {error && (
          <div className="mb-8 w-full max-w-md">
            <div role="alert" className="p-4 bg-white/90 backdrop-blur rounded-2xl border border-teal-200 flex items-center gap-3 text-teal-600 shadow-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-xs font-bold uppercase">Dismiss</button>
            </div>
          </div>
        )}

        {view === 'settings' && <SettingsPage
        settings={settings}
        onSettingsChange={setSettings}
        theme={theme}
        onThemeChange={setTheme}
        sound={sound}
        onSoundChange={setSound}
        isSyncing={isSettingsSyncing}
        isDarkMode={isDarkMode}
        />}
        {view === 'todos' && <TodoView key={user.id}/> }
        {view === 'feedback' && <FeedbackView isAdmin={user.role==='admin'} onUnreadChange={updateFeedbackCount}/>}
        {view === 'users' && user.role === 'admin' && <UsersView refreshVersion={usersListVersion} currentUserId={user.id} onRegistrationsSeen={refreshRegistrationCount} onOwnPasswordReset={() => {toggleTimer(false);setUser(null);setSessions([]);setIsInitialSyncDone(false);setView('timer');}} />}
        <AnimatePresence mode="wait">
          {view === "timer" && (
            <motion.div
              key="timer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="focus-home"
            >
              <div className="daily-metrics">
                <div><span className="metric-icon metric-teal"><Clock3 size={19}/></span><span><small>Focus today</small><strong className="spaced-duration"><span>{Math.floor(todayMinutes/60)} <em>h</em></span><span>{todayMinutes%60} <em>m</em></span></strong></span><span className="metric-caption">Time well spent</span></div>
                <div><span className="metric-icon metric-indigo"><Target size={19}/></span><span><small>Sessions today</small><strong>{todaySessions.length.toString().padStart(2,'0')}</strong></span><span className="metric-caption">One at a time</span></div>
                <div><span className="metric-icon metric-amber"><Flame size={19}/></span><span><small>All-time focus</small><strong className="spaced-duration"><span>{Math.floor(totalMinutes/60)} <em>h</em></span><span>{totalMinutes%60} <em>m</em></span></strong></span><span className="metric-caption">It all adds up</span></div>
              </div>
              <div className="focus-grid">
                <section className="timer-stage">
                  <div className="timer-topline"><span><span className={isActive ? 'live-dot active' : 'live-dot'}/>{isActive ? 'IN THE FLOW' : 'YOUR NEXT FOCUS SESSION'}</span><span className="timer-number">SESSION {timer.cycleStep} / 4</span></div>
                  <div className="mode-tabs" role="group" aria-label="Timer mode">
                    <ModeButton active={mode==='work'} onClick={()=>setMode('work')} label="Work"/>
                    <ModeButton active={mode==='shortBreak'} onClick={()=>setMode('shortBreak')} label="Short Break"/>
                    <ModeButton active={mode==='longBreak'} onClick={()=>setMode('longBreak')} label="Long Break"/>
                  </div>
                  <Timer mode={mode} duration={timer.duration} timeLeft={timeLeft} isActive={isActive} onToggle={startOrPauseTimer} onReset={resetTimer} disabled={!isInitialSyncDone||timer.awaitingLongBreak} theme={theme}/>
                  {(isSyncing||lastSyncStatus==='error')&&<div className="timer-bottomline" role="status"><span className="timer-bottom-dot"/>{isSyncing?'Saving your session…':'Could not save your session'}</div>}
                </section>
                <div className="focus-side">
                  <section className="intention-card">
                    <div className="card-heading"><span className="small-icon"><BookIcon/></span><h2>Current task</h2></div>
                    {taskDetailsRequested&&(!mainTask.trim()||!topic.trim())&&<p className="task-details-prompt" role="alert">Enter your main task/topic and sub-task/topic, then select Start focus.</p>}
                    <label htmlFor="main-task">Main Task / Topic</label>
                    <input ref={mainTaskInput} id="main-task" value={mainTask} onChange={e=>setMainTask(e.target.value)} placeholder="What are you working on?" maxLength={1000} aria-required="true" aria-invalid={taskDetailsRequested&&!mainTask.trim()} aria-describedby={taskDetailsRequested&&!mainTask.trim()?'main-task-error':undefined}/>
                    {taskDetailsRequested&&!mainTask.trim()&&<p id="main-task-error" className="task-field-error">Please enter a main task/topic.</p>}
                    <label htmlFor="topic">Sub-Task / Topic</label>
                    <input ref={topicInput} id="topic" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Break it into something small" maxLength={1000} aria-required="true" aria-invalid={taskDetailsRequested&&!topic.trim()} aria-describedby={taskDetailsRequested&&!topic.trim()?'topic-error':undefined}/>
                    {taskDetailsRequested&&!topic.trim()&&<p id="topic-error" className="task-field-error">Please enter a sub-task/topic.</p>}
                  </section>
                </div>
              </div>
              <section className="recent-section"><div className="recent-heading"><h3>Recent sessions <span>{sessions.length}</span></h3><button onClick={()=>setView('list')}>View history <ArrowUpRight size={15}/></button></div>{sessions.length ? <div className="recent-rows">{sessions.slice(0,3).map(session=><div className="recent-row" key={session.id}><span className="recent-session-icon"><Check size={16}/></span><div><strong>{session.mainTask || 'Focus session'}</strong><small>{session.topic || 'General'}</small></div><span className="recent-date">{format(new Date(session.date+'T12:00:00'),'MMM d')}</span><div className="session-durations"><span className="duration-tag">{session.duration} min focus</span><BreakDuration seconds={session.breakSeconds}/></div></div>)}</div> : <div className="recent-empty"><span><Target size={21}/></span><div><strong>Your first session starts here.</strong><p>Choose a task and press start. We’ll take care of the rest.</p></div></div>}</section>
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
              {(isSyncing || lastSyncStatus === "error") && <div className="w-full max-w-2xl mb-2 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSyncing ? "bg-amber-400 animate-pulse" : lastSyncStatus === "error" ? "bg-red-800" : "bg-emerald-500"}`} />
                  <span className="text-slate-500 text-xs font-medium">
                    {isSyncing ? "Syncing..." : lastSyncStatus === "error" ? "Sync Failed" : ""}
                  </span>
                </div>
              </div>}
              
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
              <PomodoroInfo settings={settings} />
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="workspace-footer"><span>Made with <span className="footer-heart">♥</span> by Sai</span><span>{APP_LABEL}</span></footer>
      </main>
      </div>
      {timer.awaitingLongBreak && <LongBreakPrompt minutes={settings.longBreak} onOkay={timer.acknowledgeLongBreak}/>}
    </div>
  );
}

function NavButton({ active, onClick, icon, label,badge=0,badgeLabel }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string;badge?:number;badgeLabel?:string }) {
  return <button onClick={onClick} className={`nav-button ${active ? 'selected' : ''}`} aria-current={active ? 'page' : undefined} aria-label={label}>{icon}<span>{label}</span>{badge>0?<span className="nav-count" role="status" aria-label={badgeLabel??`${badge} new registrations`}>{badge}</span>:active&&<span className="nav-active-dot"/>}</button>;
}
function ModeButton({active,onClick,label}: {active:boolean;onClick:()=>void;label:string}) {
  return <button onClick={onClick} className={active ? 'mode-button selected' : 'mode-button'} aria-pressed={active}>{label}</button>;
}
function BookIcon() {return <List size={17}/>;}
