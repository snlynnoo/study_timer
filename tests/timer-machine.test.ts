import test from 'node:test';
import assert from 'node:assert/strict';
import {initialTimer,timerStep,cycleStep,type TimerState,type TimerEvent} from '../src/lib/timerMachine.ts';
const settings={work:1,shortBreak:1,longBreak:3,darkModeWhenRunning:false};

test('four focus sessions trigger one reminder; Okay selects long break, then a new cycle',()=>{
  let state=initialTimer(settings), now=0;
  const events:TimerEvent[]=[];
  for(let session=1;session<=4;session++){
    assert.equal(cycleStep(state),session);
    state=timerStep(state,{type:'start',now,id:`focus-${session}`},settings).state;
    now+=60_000;
    const finished=timerStep(state,{type:'tick',now},settings,{mainTask:'Math',topic:'Algebra'});
    state=finished.state;events.push(...finished.events);
    assert.equal(finished.completion,'work');assert.equal(state.mode,'shortBreak');assert.equal(state.runningSince,null);
    assert.equal(state.completedFocus,session);assert.equal(cycleStep(state),session);
    assert.equal(finished.events.filter(event=>event.type==='focus').length,1);
    assert.equal(timerStep(state,{type:'tick',now:now+1},settings).events.length,0);
    if(session<4){
      assert.equal(state.awaitingLongBreak,false);
      state=timerStep(state,{type:'start',now},settings).state;now+=60_000;
      const rested=timerStep(state,{type:'tick',now},settings);state=rested.state;events.push(...rested.events);
      assert.equal(state.mode,'work');assert.equal(state.runningSince,null);
    }
  }
  assert.equal(state.awaitingLongBreak,true);assert.equal(state.completedFocus,4);
  assert.equal(timerStep(state,{type:'start',now,id:'must-not-start'},settings).state.runningSince,null);
  assert.equal(timerStep(state,{type:'mode',mode:'work',now},settings).state.mode,'shortBreak');
  state=timerStep(state,{type:'ack-long-break',now},settings).state;
  assert.equal(state.mode,'longBreak');assert.equal(state.remainingMs,180_000);assert.equal(state.awaitingLongBreak,false);
  assert.equal(state.runningSince,null);assert.equal(cycleStep(state),4);
  state=timerStep(state,{type:'start',now},settings).state;now+=180_000;
  const rested=timerStep(state,{type:'tick',now},settings);state=rested.state;
  assert.equal(state.mode,'work');assert.equal(state.completedFocus,0);assert.equal(cycleStep(state),1);
  assert.deepEqual(rested.events,[{id:'break:focus-4:180',type:'break',sessionId:'focus-4',seconds:180}]);
  assert.equal(events.filter(event=>event.type==='focus').length,4);
});

test('pause preserves remaining work and paused settings changes do not restart it',()=>{
  let state=timerStep(initialTimer(settings),{type:'start',now:0,id:'focus'},settings).state;
  state=timerStep(state,{type:'pause',now:20_000},settings).state;
  assert.equal(state.remainingMs,40_000);
  state=timerStep(state,{type:'tick',now:90_000},settings).state;assert.equal(state.remainingMs,40_000);
  const changed={...settings,work:2};state=timerStep(state,{type:'settings',now:90_000},changed).state;
  assert.equal(state.remainingMs,40_000);assert.equal(state.durationMs,60_000);
  state=timerStep(state,{type:'start',now:90_000,id:'ignored-new-id'},changed).state;
  const done=timerStep(state,{type:'tick',now:130_000},changed);
  assert.equal(done.events[0].type,'focus');assert.equal((done.events[0] as any).duration,1);
  assert.equal((done.events[0] as any).sessionId,'focus');assert.equal((done.events[0] as any).startedAt,0);
});

test('break accounting excludes pauses and records actual partial time on pause, reset and mode switch',()=>{
  let state=timerStep(initialTimer(settings),{type:'start',now:0,id:'focus'},settings).state;
  state=timerStep(state,{type:'tick',now:60_000},settings).state;
  state=timerStep(state,{type:'start',now:60_000},settings).state;
  let result=timerStep(state,{type:'pause',now:75_000},settings);state=result.state;
  assert.equal(state.remainingMs,45_000);assert.equal((result.events[0] as any).seconds,15);
  state=timerStep(state,{type:'tick',now:175_000},settings).state;assert.equal(state.breakTotalMs,15_000);
  state=timerStep(state,{type:'start',now:175_000},settings).state;
  result=timerStep(state,{type:'reset',now:185_000},settings);state=result.state;
  assert.equal((result.events[0] as any).seconds,25);assert.equal(state.remainingMs,60_000);assert.equal(state.breakTotalMs,25_000);
  state=timerStep(state,{type:'start',now:185_000},settings).state;
  result=timerStep(state,{type:'mode',mode:'work',now:190_000},settings);state=result.state;
  assert.equal((result.events[0] as any).seconds,30);assert.equal(state.mode,'work');assert.equal(result.completion,undefined);
});

test('a late tick or restored snapshot completes a run exactly once without inventing breaks',()=>{
  const running=timerStep(initialTimer(settings),{type:'start',now:1000,id:'focus'},settings).state;
  const restored=JSON.parse(JSON.stringify(running)) as TimerState;
  const done=timerStep(restored,{type:'tick',now:1_000_000},settings);
  assert.equal(done.events.length,1);assert.equal((done.events[0] as any).endedAt,61_000);
  assert.equal(done.state.completedFocus,1);assert.equal(done.state.breakTotalMs,0);
  assert.equal(timerStep(done.state,{type:'tick',now:1_000_001},settings).events.length,0);
  const aborted=timerStep(running,{type:'mode',mode:'shortBreak',now:2000},settings);
  assert.equal(aborted.events.length,0);assert.equal(aborted.completion,undefined);
});

test('idle settings changes update duration; resetting unfinished work does not count a session',()=>{
  let state=timerStep(initialTimer(settings),{type:'settings',now:0},{...settings,work:2}).state;
  assert.equal(state.remainingMs,120_000);
  state=timerStep(state,{type:'start',now:0,id:'aborted'},settings).state;
  const reset=timerStep(state,{type:'reset',now:20_000},settings);
  assert.equal(reset.state.completedFocus,0);assert.equal(reset.events.length,0);assert.equal(reset.state.focusId,null);
});

test('restoring a focus run keeps its task metadata when no replacement context is supplied',()=>{
  let state=timerStep(initialTimer(settings),{type:'start',now:0,id:'restored-focus'},settings,{mainTask:'German',topic:'Grammar'}).state;
  state=timerStep(state,{type:'pause',now:20_000},settings).state;
  state=JSON.parse(JSON.stringify(state));
  state=timerStep(state,{type:'start',now:30_000,id:'ignored'},settings).state;
  const done=timerStep(state,{type:'tick',now:70_000},settings);
  assert.equal((done.events[0] as any).mainTask,'German');assert.equal((done.events[0] as any).topic,'Grammar');
});
