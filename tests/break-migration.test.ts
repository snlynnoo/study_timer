import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {openDatabase} from '../server/database.ts';

test('break-time migration preserves legacy session data and leaves historical break time unknown',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'study-break-migration-')),filename=path.join(dir,'legacy.sqlite');
  const old=new DatabaseSync(filename);
  old.exec(`CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,date TEXT,start_time TEXT,end_time TEXT,duration INTEGER,main_task TEXT,topic TEXT,created_at TEXT,updated_at TEXT);
    INSERT INTO sessions VALUES('legacy','owner','2026-10-07','10:00','10:25',25,'Math','Algebra','2026-10-07T10:25:00Z',NULL);`);
  old.close();
  try{
    let db=openDatabase(filename);
    const row=db.prepare('SELECT * FROM sessions WHERE id=?').get('legacy')!;
    assert.equal(row.break_seconds,null);assert.equal(row.duration,25);assert.equal(row.main_task,'Math');
    db.close();db=openDatabase(filename);
    assert.equal(db.prepare('PRAGMA table_info(sessions)').all().filter(column=>column.name==='break_seconds').length,1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get()!.n,1);db.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
