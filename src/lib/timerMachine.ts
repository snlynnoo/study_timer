import type { TimerMode, TimerSettings } from '../types';
export interface TimerState {
  mode:TimerMode; remainingMs:number; durationMs:number; runningSince:number|null; started:boolean;
  focusId:string|null; focusStartedAt:number|null; focusTask:string; focusTopic:string; completedFocus:number; awaitingLongBreak:boolean;
  breakTargetId:string|null; breakTotalMs:number; breakRecordedSeconds:number;
}
export type TimerEvent =
  {id:string;type:'focus';sessionId:string;startedAt:number;endedAt:number;duration:number;mainTask:string;topic:string}
  | {id:string;type:'break';sessionId:string;seconds:number};
export interface TimerAction {type:'start'|'pause'|'tick'|'reset'|'mode'|'ack-long-break'|'settings';now:number;mode?:TimerMode;id?:string}
export function initialTimer(settings:TimerSettings):TimerState {
  return {mode:'work',remainingMs:settings.work*60000,durationMs:settings.work*60000,runningSince:null,started:false,
    focusId:null,focusStartedAt:null,focusTask:'',focusTopic:'',completedFocus:0,awaitingLongBreak:false,breakTargetId:null,breakTotalMs:0,breakRecordedSeconds:0};
}
export function timerStep(previous:TimerState,action:TimerAction,settings:TimerSettings,context?:{mainTask:string;topic:string}):{state:TimerState;events:TimerEvent[];completion?:TimerMode} {
  let state={...previous};
  if(state.mode==='work'&&state.focusId&&context){state.focusTask=context.mainTask;state.focusTopic=context.topic;}
  const events:TimerEvent[]=[];let completion:TimerMode|undefined;
  const enter=(mode:TimerMode)=>{state={...state,mode,remainingMs:settings[mode]*60000,durationMs:settings[mode]*60000,runningSince:null,started:false,focusId:null,focusStartedAt:null,focusTask:'',focusTopic:''};};
  const checkpoint=()=>{
    const seconds=Math.floor(state.breakTotalMs/1000);
    if(state.breakTargetId&&seconds>state.breakRecordedSeconds){events.push({id:`break:${state.breakTargetId}:${seconds}`,type:'break',sessionId:state.breakTargetId,seconds});state.breakRecordedSeconds=seconds;}
  };
  if(state.runningSince!==null){
    const elapsed=Math.min(state.remainingMs,Math.max(0,action.now-state.runningSince));
    const endedAt=state.runningSince+elapsed;
    state.remainingMs=Math.max(0,state.remainingMs-elapsed);state.runningSince=action.now;
    if(state.mode!=='work'&&state.breakTargetId)state.breakTotalMs+=elapsed;
    if(state.remainingMs===0){
      const completedMode=state.mode;completion=completedMode;
      if(completedMode==='work'){
        if(state.focusId)events.push({id:`focus:${state.focusId}`,type:'focus',sessionId:state.focusId,startedAt:state.focusStartedAt??endedAt-state.durationMs,endedAt,duration:state.durationMs/60000,mainTask:state.focusTask||'',topic:state.focusTopic||''});
        state.completedFocus=Math.min(4,state.completedFocus+1);
        state.breakTargetId=state.focusId;state.breakTotalMs=0;state.breakRecordedSeconds=0;
        enter('shortBreak');state.awaitingLongBreak=state.completedFocus===4;
      }else{
        checkpoint();if(completedMode==='longBreak')state.completedFocus=0;enter('work');
      }
    }else if(state.mode!=='work'&&Math.floor(state.breakTotalMs/1000)-state.breakRecordedSeconds>=15)checkpoint();
  }
  if(action.type==='ack-long-break'&&state.awaitingLongBreak){state.awaitingLongBreak=false;enter('longBreak');}
  else if(state.awaitingLongBreak)return {state,events,completion};
  else if(action.type==='start'&&state.runningSince===null&&state.remainingMs>0){
    if(state.mode==='work'&&!state.focusId){state.focusId=action.id!;state.focusStartedAt=action.now;state.focusTask=context?.mainTask||'';state.focusTopic=context?.topic||'';}
    state.runningSince=action.now;state.started=true;
  }else if(action.type==='pause') {if(state.mode!=='work')checkpoint();state.runningSince=null;}
  else if(action.type==='reset') {if(state.mode!=='work')checkpoint();enter(state.mode);}
  else if(action.type==='mode'&&action.mode&&action.mode!==state.mode){
    if(state.mode!=='work')checkpoint();
    if(action.mode==='work'&&state.completedFocus===4)state.completedFocus=0;
    enter(action.mode);
  }else if(action.type==='settings'&&!state.started){state.remainingMs=settings[state.mode]*60000;state.durationMs=state.remainingMs;}
  return {state,events,completion};
}
export function cycleStep(state:TimerState){return state.mode==='work'?Math.min(4,state.completedFocus+1):Math.max(1,state.completedFocus);}
