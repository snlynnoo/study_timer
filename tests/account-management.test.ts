import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtempSync,rmSync,readdirSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {openDatabase} from '../server/database.ts';
import {createApi,hashPassword} from '../server/api.ts';

test('self-service recovery, revocation, account activation, deletion and restore',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'study-accounts-'));
  const db=openDatabase(path.join(dir,'db.sqlite'));
  const previous=process.env.RESET_MAIL_DIR;process.env.RESET_MAIL_DIR=path.join(dir,'mail');
  const add=db.prepare('INSERT INTO users (id,email,name,role,password_hash,created_at) VALUES (?,?,?,?,?,?)');
  add.run('admin','admin@example.test','Admin','admin',await hashPassword('AdminPassword123!'),new Date().toISOString());
  add.run('member','member@example.test','Member','user',await hashPassword('MemberPassword123!'),new Date().toISOString());
  const app=express();app.use(express.json());app.use('/api',createApi(db,path.join(dir,'setup.txt')));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as any).port}/api`;
  const call=async(url:string,method='GET',body?:any,cookie?:string,origin?:string)=>{
    const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(origin?{origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  };
  const login=async(email:string,password:string)=>(await call('/auth/login','POST',{email,password}));
  const forgot=async(email='member@example.test')=>call('/auth/forgot-password','POST',{email});
  const latestToken=()=>{
    const files=readdirSync(process.env.RESET_MAIL_DIR!).sort();
    return readFileSync(path.join(process.env.RESET_MAIL_DIR!,files.at(-1)!),'utf8').match(/reset-password=([a-f0-9]{64})/)![1];
  };
  try {
    const admin=(await login('admin@example.test','AdminPassword123!')).cookie!;
    const member=(await login('member@example.test','MemberPassword123!')).cookie!;
    assert.equal((await call('/users/member','PATCH',{is_active:false},member)).status,403);
    assert.equal((await call('/users/member','DELETE',{},member)).status,403);
    assert.equal((await call('/users/admin','PATCH',{is_active:false},admin)).status,400);
    assert.equal((await call('/users/admin','DELETE',{},admin)).status,400);
    assert.equal((await call('/users/member','PATCH',{is_active:'false'},admin)).status,400);
    const known=await forgot(),unknown=await forgot('missing@example.test');
    assert.equal(known.status,200);assert.deepEqual(known.body,unknown.body);
    assert.equal(readdirSync(process.env.RESET_MAIL_DIR!).length,1);
    assert.equal(statSync(process.env.RESET_MAIL_DIR!).mode&0o777,0o700);
    const token=latestToken();assert.ok(!JSON.stringify(known.body).includes(token));
    const row=db.prepare('SELECT * FROM password_reset_tokens').get()!;
    assert.notEqual(row.token_hash,token);assert.equal(row.token_hash,createHash('sha256').update(token).digest('hex'));
    assert.equal((await call('/auth/reset-password','POST',{token,password:'short'})).status,400);
    assert.equal((await call('/auth/reset-password','POST',{token,password:'NewMemberPassword123!'},undefined,'https://evil.example')).status,403);
    assert.equal((await call('/auth/reset-password','POST',{token,password:'NewMemberPassword123!'})).status,200);
    assert.equal((await call('/auth/me','GET',undefined,member)).body.user,null);
    assert.equal((await call('/auth/reset-password','POST',{token,password:'ReplayPassword123!'})).status,400);
    assert.equal((await login('member@example.test','MemberPassword123!')).status,401);
    const newMember=(await login('member@example.test','NewMemberPassword123!')).cookie!;assert.ok(newMember);
    await forgot();const expired=latestToken();db.prepare('UPDATE password_reset_tokens SET expires_at=0').run();
    assert.equal((await call('/auth/reset-password','POST',{token:expired,password:'AnotherPassword123!'})).status,400);
    await forgot();const deactivated=latestToken();
    db.prepare("INSERT INTO sessions (id,user_id,date,start_time,end_time,duration,main_task,topic,created_at) VALUES ('saved','member','2026-11-22','10:00','10:25',25,'Keep','History',?)").run(new Date().toISOString());
    assert.equal((await call('/users/member','PATCH',{is_active:false},admin)).status,200);
    assert.equal((await call('/sessions','GET',undefined,newMember)).status,401);
    assert.equal((await login('member@example.test','NewMemberPassword123!')).status,401);
    assert.equal((await call('/auth/reset-password','POST',{token:deactivated,password:'AnotherPassword123!'})).status,400);
    assert.equal((await call('/users/member','PATCH',{is_active:true},admin)).status,200);
    const active=(await login('member@example.test','NewMemberPassword123!')).cookie!;
    assert.equal((await call('/users/member','DELETE',{},admin)).status,200);
    assert.equal((await call('/auth/me','GET',undefined,active)).body.user,null);
    assert.equal((await call('/users','GET',undefined,admin)).body.length,1);
    assert.equal((await call('/users?include_deleted=true','GET',undefined,admin)).body.length,2);
    assert.equal((await login('member@example.test','NewMemberPassword123!')).status,401);
    assert.equal((await call('/users/member/restore','POST',{},admin)).status,200);
    assert.equal((await login('member@example.test','NewMemberPassword123!')).status,401);
    await call('/users/member','PATCH',{is_active:true},admin);
    const restored=(await login('member@example.test','NewMemberPassword123!')).cookie!;
    assert.equal((await call('/sessions','GET',undefined,restored)).body[0].main_task,'Keep');
    const environment=process.env.NODE_ENV;process.env.NODE_ENV='production';
    try {assert.equal((await forgot()).status,503);}
    finally {if(environment===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=environment;}
    // Requests are bounded even for unknown accounts.
    let limited=false;for(let i=0;i<25;i++)if((await forgot('missing@example.test')).status===429)limited=true;
    assert.ok(limited);
  }finally{
    if(previous===undefined)delete process.env.RESET_MAIL_DIR;else process.env.RESET_MAIL_DIR=previous;
    await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();rmSync(dir,{recursive:true,force:true});
  }
});
