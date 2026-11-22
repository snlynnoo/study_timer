import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBreakMinutes} from '../src/lib/breakMinutes.ts';
import {buildDistribution} from '../src/lib/distribution.ts';
import type {Session} from '../src/types';

test('break minutes distinguish unknown, zero and fractional time and reject invalid ranges',()=>{
  assert.equal(parseBreakMinutes(''),null);assert.equal(parseBreakMinutes('  '),null);
  assert.equal(parseBreakMinutes('0'),0);assert.equal(parseBreakMinutes('2.5'),150);
  assert.equal(parseBreakMinutes('0.05'),3);assert.equal(parseBreakMinutes('10080'),604800);
  for(const value of ['-1','10080.01','NaN','Infinity','oops'])assert.throws(()=>parseBreakMinutes(value));
});
test('distribution groups normalized categories and sorts all entries by total time in either direction',()=>{
  const session=(mainTask:string,topic:string,duration:number):Session=>({mainTask,topic,duration,date:'2026-11-22',startTime:'09:00',endTime:'09:25'});
  const rows=[session(' Math ','Algebra',25),session('math','Geometry',15),session('Science','Biology',10),session('','',0)];
  assert.deepEqual(buildDistribution(rows,'mainTask','desc'),[{name:'Math',minutes:40},{name:'Science',minutes:10},{name:'Unspecified',minutes:0}]);
  assert.deepEqual(buildDistribution(rows,'mainTask','asc').map(item=>item.minutes),[0,10,40]);
  assert.deepEqual(buildDistribution(rows,'topic','desc').map(item=>item.name),['Algebra','Geometry','Biology','Unspecified']);
  assert.deepEqual(buildDistribution([],'topic','asc'),[]);
  assert.equal(buildDistribution(Array.from({length:35},(_,i)=>session(`Task ${i}`,'Shared topic',i)),'mainTask','desc').length,35);
});
