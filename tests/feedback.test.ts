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

test('feedback submission, administrator inbox, read status, limits and persistence',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'study-feedback-')),file=path.join(dir,'db.sqlite');
  let db=openDatabase(file);
  for(const [id,role] of [['admin','admin'],['member','user'],['other','user']]) {
    db.prepare('INSERT INTO users (id,email,name,role,password_hash,created_at) VALUES (?,?,?,?,?,?)')
      .run(id,`${id}@example.test`,id,role,'initialized',new Date().toISOString());
    db.prepare('INSERT INTO auth_sessions VALUES (?,?,?)').run(createHash('sha256').update(id).digest('hex'),id,Date.now()+3600_000);
  }
  const app=express();app.use(express.json());app.use('/api',createApi(db,path.join(dir,'setup.txt')));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as any).port}/api`;
  const call=async(url:string,method='GET',body?:any,owner?:string,origin?:string)=>{
    const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(owner?{cookie:`study_session=${owner}`} :{}),...(origin?{origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  };
  try {
    assert.equal((await call('/feedback')).status,401);
    assert.equal((await call('/feedback/unread-count')).status,401);
    assert.equal((await call('/feedback','POST',{subject:'Test',message:'Hello'})).status,401);
    const sent=await call('/feedback','POST',{subject:'  Improvement  ',message:'  Please add more sounds.\nThank you.  ',user_id:'other',read_at:'forged'},'member');
    assert.equal(sent.status,201);
    const saved=db.prepare('SELECT * FROM feedback WHERE id=?').get(sent.body.id)!;
    assert.equal(saved.user_id,'member');assert.equal(saved.read_at,null);assert.equal(saved.subject,'Improvement');
    assert.equal(saved.message,'Please add more sounds.\nThank you.');
    for(const owner of ['member','other']) {
      assert.equal((await call('/feedback/unread-count','GET',undefined,owner)).status,403);
      assert.equal((await call('/feedback','GET',undefined,owner)).status,403);
      assert.equal((await call(`/feedback/${saved.id}`,'PATCH',{read:true},owner)).status,403);
    }
    for(const body of [{subject:' ',message:'Hi'},{subject:'Hi',message:' '},{subject:'x'.repeat(201),message:'Hi'},{subject:'Hi',message:'x'.repeat(5001)},{subject:5,message:'Hi'}])
      assert.equal((await call('/feedback','POST',body,'member')).status,400);
    assert.equal((await call('/feedback','POST',{subject:'Cross site',message:'No'},'member','https://evil.example')).status,403);
    assert.equal((await call('/feedback/mine')).status,401);
    assert.equal((await call(`/feedback/${saved.id}/replies`)).status,401);
    assert.equal((await call('/feedback/mine','GET',undefined,'member')).body.items[0].id,saved.id);
    assert.equal((await call('/feedback/mine','GET',undefined,'other')).body.total,0);
    for(const page of ['0','-1','1.5','bad'])assert.equal((await call(`/feedback/mine?page=${page}`,'GET',undefined,'member')).status,400);
    assert.equal((await call(`/feedback/${saved.id}/replies`,'GET',undefined,'other')).status,404);
    assert.equal((await call('/feedback/missing/replies','GET',undefined,'member')).status,404);
    assert.equal((await call(`/feedback/${saved.id}/replies`,'POST',{message:'Forged reply'},'other')).status,404);
    assert.equal((await call('/feedback/missing/replies','POST',{message:'Hello'},'admin')).status,404);
    for(const message of ['', '  ', 42, 'x'.repeat(5001)])assert.equal((await call(`/feedback/${saved.id}/replies`,'POST',{message},'admin')).status,400);
    assert.equal((await call(`/feedback/${saved.id}/replies`,'POST',{message:'Cross site'},'admin','https://evil.example')).status,403);
    const reply=await call(`/feedback/${saved.id}/replies`,'POST',{message:'  Thanks!\nWe will review this. <script>example</script>  ',admin_id:'other',user_id:'other',feedback_id:'missing'},'admin');
    assert.equal(reply.status,201);
    const replies=(await call(`/feedback/${saved.id}/replies`,'GET',undefined,'member')).body.items;
    assert.equal(replies.length,1);assert.equal(replies[0].message,'Thanks!\nWe will review this. <script>example</script>');
    assert.equal(replies[0].sender_name,'admin');assert.equal(replies[0].feedback_id,saved.id);
    assert.ok(!('password_hash' in replies[0]));assert.ok(!('sender_email' in replies[0]));
    assert.equal(db.prepare('SELECT sender_id FROM feedback_replies WHERE id=?').get(reply.body.id)!.sender_id,'admin');
    assert.equal((await call(`/feedback/${saved.id}/replies`,'GET',undefined,'admin')).body.items.length,1);
    assert.equal(replies[0].sender_role,'admin');
    assert.equal((await call('/feedback/unread-count','GET',undefined,'admin')).body.count,0);
    const followup=await call(`/feedback/${saved.id}/replies`,'POST',{message:'Thanks! Here are more details.',sender_id:'admin',sender_role:'admin',feedback_id:'other'},'member');
    assert.equal(followup.status,201);
    const thread=(await call(`/feedback/${saved.id}/replies`,'GET',undefined,'admin')).body.items;
    assert.equal(thread.length,2);assert.equal(thread[1].message,'Thanks! Here are more details.');assert.equal(thread[1].sender_role,'user');assert.equal(thread[1].sender_name,'member');
    assert.equal(db.prepare('SELECT sender_id FROM feedback_replies WHERE id=?').get(followup.body.id)!.sender_id,'member');
    const separate=await call('/feedback','POST',{subject:'Separate topic',message:'This starts a new conversation.'},'member');
    assert.equal(separate.status,201);
    assert.equal((await call(`/feedback/${separate.body.id}/replies`,'GET',undefined,'member')).body.items.length,0);
    assert.equal((await call(`/feedback/${saved.id}/replies`,'GET',undefined,'member')).body.items.length,2);
    const inbox=await call('/feedback','GET',undefined,'admin');
    assert.equal(inbox.status,200);assert.equal(inbox.body.total,2);assert.equal(inbox.body.unread,2);
    assert.deepEqual((await call('/feedback/unread-count','GET',undefined,'admin')).body,{count:2});
    assert.equal(inbox.body.items[0].sender_email,'member@example.test');
    assert.ok(!('password_hash' in inbox.body.items[0]));
    assert.equal((await call(`/feedback/${saved.id}`,'PATCH',{read:'true'},'admin')).status,400);
    assert.equal((await call('/feedback/missing','PATCH',{read:true},'admin')).status,404);
    assert.equal((await call(`/feedback/${separate.body.id}`,'PATCH',{read:true},'admin')).status,200);
    assert.equal((await call(`/feedback/${saved.id}`,'PATCH',{read:true},'admin')).status,200);
    assert.equal((await call('/feedback','GET',undefined,'admin')).body.unread,0);
    assert.deepEqual((await call('/feedback/unread-count','GET',undefined,'admin')).body,{count:0});
    assert.equal((await call(`/feedback/${saved.id}`,'PATCH',{read:false},'admin')).status,200);
    assert.deepEqual((await call('/feedback/unread-count','GET',undefined,'admin')).body,{count:1});
    for(let i=0;i<8;i++)assert.equal((await call('/feedback','POST',{subject:`Note ${i}`,message:'Another suggestion'},'member')).status,201);
    assert.equal((await call('/feedback','POST',{subject:'Too many',message:'Slow down'},'member')).status,429);
    assert.equal((await call('/feedback','POST',{subject:'Different account',message:'Allowed'},'other')).status,201);
    for(const page of ['0','-1','1.5','oops','1000001'])assert.equal((await call(`/feedback?page=${page}`,'GET',undefined,'admin')).status,400);
    for(let i=0;i<45;i++)db.prepare('INSERT INTO feedback (id,user_id,subject,message,created_at) VALUES (?,?,?,?,?)').run(`fixture-${i}`,'other',`Older ${i}`,'History','2026-01-01T00:00:00.000Z');
    const first=(await call('/feedback?page=1','GET',undefined,'admin')).body;
    const second=(await call('/feedback?page=2','GET',undefined,'admin')).body;
    assert.equal(first.items.length,50);assert.equal(second.items.length,6);assert.equal(first.total,56);
    assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,56);
    db.prepare("UPDATE users SET is_active=0 WHERE id='member'").run();
    assert.equal((await call('/feedback','POST',{subject:'No access',message:'Inactive'},'member')).status,401);
    assert.equal((await call(`/feedback/${saved.id}/replies`,'GET',undefined,'member')).status,401);
    assert.equal((await call(`/feedback/${saved.id}/replies`,'POST',{message:'Inactive'},'member')).status,401);
    db.close();db=openDatabase(file);
    assert.equal(db.prepare('SELECT message FROM feedback_replies WHERE id=?').get(reply.body.id)!.message,replies[0].message);
    assert.equal(db.prepare('SELECT count(*) AS count FROM feedback').get()!.count,56);
    assert.equal(db.prepare('SELECT message FROM feedback WHERE id=?').get(saved.id)!.message,saved.message);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();rmSync(dir,{recursive:true,force:true});}
});
