import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidTime,durationBetween,parseTimePaste} from '../src/lib/timeInput.ts';

test('time input accepts numeric paste and validates 24-hour times',()=>{
  for(const [input,result] of [['0930','09:30'],['930','09:30'],['9:30','09:30'],[' 23:59 ','23:59'],['0000','00:00']])assert.equal(parseTimePaste(input),result);
  for(const input of ['24:00','1260','noon',':','12345','-930'])assert.equal(parseTimePaste(input),null);
  assert.equal(isValidTime('00:00'),true);assert.equal(isValidTime('23:59'),true);
  for(const input of [':',':30','09:','9:30','24:00','12:60'])assert.equal(isValidTime(input),false);
});
test('time duration handles midnight and incomplete fields without NaN',()=>{
  assert.equal(durationBetween('09:00','09:25'),25);
  assert.equal(durationBetween('23:50','00:15'),25);
  assert.equal(durationBetween('09:00','09:00'),0);
  assert.equal(durationBetween(':','09:25'),0);
  assert.equal(durationBetween('29:00','09:25'),0);
});
