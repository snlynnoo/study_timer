import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTaskAchievement} from '../src/lib/taskAchievement.ts';

const month=new Date(2026,10,1),today=new Date(2026,10,22,12);
test('task achievement counts only the displayed month and excludes future dates from the rate',()=>{
  const result=buildTaskAchievement([
    {date:'2026-11-01',completed:true},
    {date:'2026-11-22',completed:false},
    {date:'2026-11-22',completed:true},
    {date:'2026-11-27',completed:false},
    {date:'2026-11-28',completed:true},
    {date:'2026-10-31',completed:true},
    {date:'2026-12-01',completed:false},
  ],month,today);
  assert.equal(result.planned,3);assert.equal(result.achieved,2);assert.equal(result.pending,1);assert.equal(result.rate,66.7);
  assert.equal(result.monthPlanned,5);assert.equal(result.upcoming,2);assert.equal(result.days.length,30);
  const current=result.days.find(day=>day.date==='2026-11-22')!;
  assert.equal(current.planned,2);assert.equal(current.achieved,1);assert.equal(current.rate,50);
  assert.equal(result.days.find(day=>day.date==='2026-11-27')!.achieved,null);
  assert.equal(result.days.find(day=>day.date==='2026-11-28')!.rate,null);
  assert.equal(result.days.find(day=>day.date==='2026-11-02')!.rate,null);
});
test('achievement is weighted by tasks, responds to status changes, and does not invent a score for no plan',()=>{
  const tasks=[{date:'2026-11-01',completed:true},...Array.from({length:9},(_,i)=>({date:'2026-11-02',completed:i===0}))];
  assert.equal(buildTaskAchievement(tasks,month,today).rate,20);
  const updated=tasks.map(task=>({...task,completed:true}));
  assert.equal(buildTaskAchievement(updated,month,today).rate,100);
  assert.equal(buildTaskAchievement([],month,today).rate,null);
  assert.equal(buildTaskAchievement([{date:'2026-12-01',completed:false}],new Date(2026,11,1),today).rate,null);
  const historical=buildTaskAchievement([{date:'2026-11-27',completed:true}],month,new Date(2026,11,10));
  assert.equal(historical.planned,1);assert.equal(historical.rate,100);
});
test('achievement generates the right calendar length for leap-year months',()=>{
  assert.equal(buildTaskAchievement([],new Date(2024,1,1),today).days.length,29);
  assert.equal(buildTaskAchievement([],new Date(2026,1,1),today).days.length,28);
});
