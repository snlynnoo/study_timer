import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase} from '../server/database.ts';
import {createApi} from '../server/api.ts';

test('task ordering persists, preserves task status, appends moved/new tasks and rejects incomplete or foreign lists',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'todo-order-')),filename=path.join(dir,'test.sqlite'),setup=path.join(dir,'setup.txt');
  const db=openDatabase(filename);
  db.prepare('INSERT INTO users (id,email,name,role,created_at) VALUES (?,?,?,?,?)').run('owner','owner@example.test','Owner','admin',new Date().toISOString());
  const app=express();app.use(express.json());app.use('/api',createApi(db,setup));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as any).port}/api`;
  const call=async(url:string,method='GET',body?:unknown,cookie?:string)=>{
    const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    const auth=await call('/auth/setup','POST',{code:readFileSync(setup,'utf8').trim(),password:'OwnerPassword123'}),cookie=auth.cookie!;
    await call('/users','POST',{name:'Member',email:'member@example.test',password:'MemberPassword123'},cookie);
    const member=(await call('/auth/login','POST',{email:'member@example.test',password:'MemberPassword123'})).cookie!;
    const create=async(title:string,date='2026-11-25',owner=cookie)=>(await call('/todos','POST',{title,date},owner)).data.id as string;
    const a=await create('A'),b=await create('B'),c=await create('C'),foreign=await create('Foreign','2026-11-25',member),otherDate=await create('Other date','2026-11-26');
    const read=async()=>(await call('/todos?from=2026-11-25&to=2026-11-25','GET',undefined,cookie)).data.map((t:any)=>t.id);
    const reorder=(ids:unknown,owner=cookie)=>call('/todos/order','PUT',{date:'2026-11-25',ids},owner);
    assert.equal((await call('/todos/order','PUT',{date:'2026-11-25',ids:[c,a,b]})).status,401);
    assert.equal((await reorder([c,a,b])).status,200);assert.deepEqual(await read(),[c,a,b]);
    for(const ids of [[a,a,c],null,[1,2,3]])assert.equal((await reorder(ids)).status,400);
    for(const ids of [[a,b],[a,b,foreign],[a,b,otherDate],[a,b,'missing']])assert.equal((await reorder(ids)).status,409);
    assert.equal((await reorder([c,a,b],member)).status,409);assert.deepEqual(await read(),[c,a,b]);
    await call(`/todos/${a}`,'PATCH',{completed:true,title:'Edited A'},cookie);assert.deepEqual(await read(),[c,a,b]);
    const d=await create('D');assert.deepEqual(await read(),[c,a,b,d]);
    await call(`/todos/${c}`,'PATCH',{date:'2026-11-26'},cookie);
    await call(`/todos/${c}`,'PATCH',{date:'2026-11-25'},cookie);assert.deepEqual(await read(),[a,b,d,c]);
    assert.equal((await reorder([d,c,b,a])).status,200);
    await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();
    const reopened=openDatabase(filename);
    try {
      assert.deepEqual(reopened.prepare('SELECT id FROM todos WHERE user_id=? AND date=? ORDER BY sort_order,created_at,id').all('owner','2026-11-25').map(t=>t.id),[d,c,b,a]);
      assert.equal(reopened.prepare('SELECT completed FROM todos WHERE id=?').get(a)!.completed,1);
    }finally{reopened.close();}
  }finally{if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));if(db.isOpen)db.close();rmSync(dir,{recursive:true,force:true});}
});

test('task-order migration keeps existing tasks and their creation order',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'todo-order-migration-')),filename=path.join(dir,'legacy.sqlite');
  const legacy=new DatabaseSync(filename);
  legacy.exec(`CREATE TABLE users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT,role TEXT NOT NULL,created_at TEXT NOT NULL,last_sign_in_at TEXT);
    CREATE TABLE todos (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,date TEXT NOT NULL,title TEXT NOT NULL,notes TEXT NOT NULL,completed INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    INSERT INTO users VALUES ('owner','owner@example.test','Owner',NULL,'admin','2026-11-25',NULL);
    INSERT INTO todos VALUES ('a','owner','2026-11-25','A','',1,'2026-11-25T10:00:00Z','2026-11-25T10:00:00Z'),('b','owner','2026-11-25','B','',0,'2026-11-25T11:00:00Z','2026-11-25T11:00:00Z');`);
  legacy.close();const db=openDatabase(filename);
  try {assert.deepEqual(db.prepare('SELECT id,completed,sort_order FROM todos ORDER BY sort_order,created_at,id').all().map(t=>({...t})),[{id:'a',completed:1,sort_order:0},{id:'b',completed:0,sort_order:0}]);}
  finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
