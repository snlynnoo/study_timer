import {useEffect,useRef,useState} from 'react';
import type {TimerMode,TimerSettings} from '../types';
import {initialTimer,timerStep,cycleStep,type TimerState,type TimerEvent,type TimerAction} from '../lib/timerMachine';

interface Options {userId?:string;ready:boolean;settings:TimerSettings;mainTask:string;topic:string;onEvent:(event:TimerEvent,owner:string)=>Promise<void>;onComplete:(mode:TimerMode)=>void;onRestore?:(state:TimerState)=>void}
interface Stored {version:1;state:TimerState;events:TimerEvent[]}
export function usePomodoroTimer(options:Options){
  const [state,setState]=useState<TimerState>(()=>initialTimer(options.settings));
  const optionsRef=useRef(options);optionsRef.current=options;
  const storeRef=useRef<Stored>({version:1,state,events:[]});
  const ownerRef=useRef<string|undefined>(undefined);
  const flushing=useRef(false);
  const retryAfter=useRef(0);
  const key=(owner:string)=>`study_timer_cycle_v1:${owner}`;
  const persist=()=>{if(ownerRef.current)try{localStorage.setItem(key(ownerRef.current),JSON.stringify(storeRef.current));}catch{/* Keep the running timer usable if browser storage is unavailable. */}};
  const flush=async()=>{
    if(Date.now()<retryAfter.current||flushing.current||!ownerRef.current||!optionsRef.current.ready)return;
    flushing.current=true;const owner=ownerRef.current;
    try{
      while(storeRef.current.events.length&&ownerRef.current===owner&&optionsRef.current.userId===owner){
        const event=storeRef.current.events[0];
        try{await optionsRef.current.onEvent(event,owner);}catch{retryAfter.current=Date.now()+5000;break;}
        if(ownerRef.current!==owner)break;
        storeRef.current.events=storeRef.current.events.filter(item=>item.id!==event.id);persist();
      }
    }finally{flushing.current=false;}
  };
  const act=(action:TimerAction)=>{
    const config=optionsRef.current;
    if(!config.ready||!config.userId||ownerRef.current!==config.userId)return;
    const previous=storeRef.current.state;
    if(action.type==='tick'&&previous.runningSince===null){void flush();return;}
    const result=timerStep(previous,action,config.settings,{mainTask:config.mainTask,topic:config.topic});
    storeRef.current.state=result.state;
    for(const event of result.events){
      if(event.type==='break')storeRef.current.events=storeRef.current.events.filter(item=>item.type!=='break'||item.sessionId!==event.sessionId);
      if(!storeRef.current.events.some(item=>item.id===event.id))storeRef.current.events.push(event);
    }
    persist();setState(result.state);
    if(result.completion)config.onComplete(result.completion);
    void flush();
  };
  useEffect(()=>{
    const owner=options.userId;
    ownerRef.current=owner;
    let stored:Stored={version:1,state:initialTimer(optionsRef.current.settings),events:[]};
    if(owner)try{
      const parsed=JSON.parse(localStorage.getItem(key(owner))||'null');
      if(parsed?.version===1&&['work','shortBreak','longBreak'].includes(parsed.state?.mode)&&Number.isFinite(parsed.state.remainingMs)&&parsed.state.remainingMs>=0&&Number.isInteger(parsed.state.completedFocus)&&parsed.state.completedFocus>=0&&parsed.state.completedFocus<=4&&Array.isArray(parsed.events))stored=parsed;
    }catch{/* Start a fresh cycle if a saved snapshot cannot be read. */}
    storeRef.current=stored;setState(stored.state);
    if(stored.state.focusId)optionsRef.current.onRestore?.(stored.state);
    return()=>{ownerRef.current=undefined;};
  },[options.userId]);
  useEffect(()=>{
    if(options.ready)act({type:'settings',now:Date.now()});
  },[options.ready,options.settings.work,options.settings.shortBreak,options.settings.longBreak]);
  useEffect(()=>{
    if(!options.ready||!options.userId)return;
    const interval=setInterval(()=>{act({type:'tick',now:Date.now()});},1000);
    const checkpoint=()=>act({type:'tick',now:Date.now()});
    window.addEventListener('pagehide',checkpoint);
    return()=>{clearInterval(interval);window.removeEventListener('pagehide',checkpoint);};
  },[options.ready,options.userId]);
  return {mode:state.mode,timeLeft:Math.ceil(state.remainingMs/1000),duration:state.durationMs/60000,isActive:state.runningSince!==null,
    awaitingLongBreak:state.awaitingLongBreak,cycleStep:cycleStep(state),
    toggle:(active:boolean)=>act({type:active?'start':'pause',now:Date.now(),id:crypto.randomUUID()}),
    reset:()=>act({type:'reset',now:Date.now()}),setMode:(mode:TimerMode)=>act({type:'mode',mode,now:Date.now()}),
    acknowledgeLongBreak:()=>act({type:'ack-long-break',now:Date.now()})};
}
