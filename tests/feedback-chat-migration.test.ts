import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openDatabase} from '../server/database.ts';

test('continuous feedback chat preserves existing administrator replies and role on repeated migration',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'feedback-chat-')),filename=path.join(dir,'legacy.sqlite');
  const legacy=new DatabaseSync(filename);
  legacy.exec(`CREATE TABLE feedback_replies (id TEXT PRIMARY KEY,feedback_id TEXT NOT NULL,admin_id TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL);
    INSERT INTO feedback_replies VALUES ('reply','thread','admin','Existing reply','2026-11-27T10:00:00Z');`);
  legacy.close();
  try {
    for(let i=0;i<2;i++){
      const db=openDatabase(filename);
      try {assert.deepEqual({...db.prepare('SELECT * FROM feedback_replies').get()},{id:'reply',feedback_id:'thread',sender_id:'admin',sender_role:'admin',message:'Existing reply',created_at:'2026-11-27T10:00:00Z'});}
      finally{db.close();}
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
