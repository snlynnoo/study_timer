import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import {openDatabase} from '../server/database.ts';
import {createApi} from '../server/api.ts';

test('registration badges are per-administrator, monotonic, and acknowledge only loaded registrations',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'study-badges-')),file=path.join(dir,'db.sqlite');let db=openDatabase(file);
  for(const [id,role] of [['admin','admin'],['admin2','admin'],['member','user'],['new1','user'],['new2','user'],['new3','user']]) {
    db.prepare('INSERT INTO users (id,email,name,role,password_hash,created_at) VALUES (?,?,?,?,?,?)').run(id,`${id}@example.test`,id,role,'initialized',new Date().toISOString());
    db.prepare('INSERT INTO auth_sessions VALUES (?,?,?)').run(createHash('sha256').update(id).digest('hex'),id,Date.now()+3600_000);
  }
  const app=express();app.use(express.json());app.use('/api',createApi(db,path.join(dir,'setup.txt')));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as any).port}/api`;
  const call=async(url:string,owner?:string,body?:any)=>{
    const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(owner?{cookie:`study_session=${owner}`}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,body:await r.json()};
  };
  try {
    assert.equal((await call('/users/registrations')).status,401);
    assert.equal((await call('/users/registrations','member')).status,403);
    assert.equal((await call('/users/registrations/seen','member',{through_id:0})).status,403);
    assert.equal((await call('/users/registrations','admin')).body.count,0);
    db.prepare("INSERT INTO registration_events (user_id) VALUES ('new1'),('new2')").run();
    assert.equal((await call('/users/registrations','admin')).body.count,2);
    const rows=(await call('/users','admin')).body;
    const through=Math.max(...rows.map((row:any)=>row.registration_id??0));assert.equal(through,2);
    // A new event arrives after the list was fetched; acknowledging the old snapshot preserves it.
    db.prepare("INSERT INTO registration_events (user_id) VALUES ('new3')").run();
    assert.equal((await call('/users/registrations/seen','admin',{through_id:through})).status,200);
    assert.equal((await call('/users/registrations','admin')).body.count,1);
    assert.equal((await call('/users/registrations','admin2')).body.count,3);
    await call('/users/registrations/seen','admin',{through_id:1});
    assert.equal((await call('/users/registrations','admin')).body.count,1);
    for(const value of [-1,1.5,4,'3'])assert.equal((await call('/users/registrations/seen','admin',{through_id:value})).status,400);
    assert.equal((await call('/users/registrations/seen','admin',{through_id:3})).status,200);
    assert.equal((await call('/users/registrations','admin')).body.count,0);
    db.prepare("UPDATE users SET deleted_at=? WHERE id='new3'").run(new Date().toISOString());
    assert.equal((await call('/users/registrations','admin2')).body.count,2);
    db.close();db=openDatabase(file);
    assert.equal(db.prepare("SELECT through_id FROM registration_seen WHERE admin_id='admin'").get()!.through_id,3);
    assert.equal(db.prepare('SELECT count(*) AS count FROM registration_events').get()!.count,3);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();rmSync(dir,{recursive:true,force:true});}
});
