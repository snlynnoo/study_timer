import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {openDatabase} from '../server/database.ts';
import {createApi} from '../server/api.ts';

test('self-registration validates proof, blocks abuse, isolates users and survives limiter restarts',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'study-register-'));
  const db=openDatabase(path.join(dir,'db.sqlite'));
  db.prepare("INSERT INTO users (id,email,name,role,password_hash,created_at) VALUES ('admin','admin@example.test','Admin','admin','initialized',?)").run(new Date().toISOString());
  const app=express();app.use(express.json());app.use('/api',createApi(db,path.join(dir,'setup.txt')));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as any).port}/api`;
  const call=async(url:string,body?:any,cookie?:string,origin?:string)=>{
    const response=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(origin?{origin}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],retry:response.headers.get('retry-after')};
  };
  const proof=async()=>{
    const {body}=await call('/auth/register/challenge');
    db.prepare('UPDATE registration_challenges SET issued_at=issued_at-3000 WHERE id=?').run(body.id);
    let nonce=0;while(!createHash('sha256').update(`${body.id}:${nonce}`).digest('hex').startsWith('0000'))nonce++;
    return {challengeId:body.id,nonce};
  };
  const account={name:'New Member',email:'new@example.test',password:'LocalPassword123!',role:'admin',user_id:'admin'};
  const originalEnabled=process.env.REGISTRATION_ENABLED;
  process.env.REGISTRATION_ENABLED='true';
  try {
    assert.equal((await call('/auth/setup')).body.registrationEnabled,true);
    assert.equal((await call('/auth/register',account)).status,400);
    const p=await proof();
    const created=await call('/auth/register',{...account,...p});
    assert.equal(created.status,201);assert.equal(created.body.user.role,'user');assert.ok(created.cookie);
    assert.equal(db.prepare('SELECT count(*) AS count FROM registration_events WHERE user_id=?').get(created.body.user.id)!.count,1);
    assert.equal('password_hash' in created.body.user,false);
    assert.equal((await call('/auth/me',undefined,created.cookie)).body.user.email,account.email);
    assert.equal((await call('/users',undefined,created.cookie)).status,403);
    assert.deepEqual((await call('/sessions',undefined,created.cookie)).body,[]);
    assert.match(String(db.prepare('SELECT password_hash FROM users WHERE email=?').get(account.email)!.password_hash),/^scrypt:/);
    assert.equal((await call('/auth/register',{...account,...p,email:'replay@example.test'})).status,400);
    assert.equal((await call('/auth/register',{...account,...await proof(),website:'spam.example'})).status,400);
    const expired=await proof();db.prepare('UPDATE registration_challenges SET expires_at=0 WHERE id=?').run(expired.challengeId);
    assert.equal((await call('/auth/register',{...account,...expired})).status,400);
    const tooFast=await proof();db.prepare('UPDATE registration_challenges SET issued_at=? WHERE id=?').run(Date.now()+5000,tooFast.challengeId);
    assert.equal((await call('/auth/register',{...account,...tooFast})).status,400);
    const originalHash=db.prepare('SELECT password_hash FROM users WHERE email=?').get(account.email)!.password_hash;
    const duplicate=await call('/auth/register',{...account,...await proof(),email:'NEW@example.test',password:'DifferentPassword123!'});
    assert.equal(duplicate.status,409);assert.match(duplicate.body.error,/already registered/);assert.match(duplicate.body.error,/Forgot password/);
    assert.equal(db.prepare('SELECT password_hash FROM users WHERE email=?').get(account.email)!.password_hash,originalHash);
    assert.equal(db.prepare('SELECT count(*) AS count FROM registration_events').get()!.count,1);
    assert.equal((await call('/auth/register',{...account,...await proof(),password:'short'})).status,400);
    const mismatch=await proof();db.prepare("UPDATE registration_challenges SET ip_hash='different' WHERE id=?").run(mismatch.challengeId);
    assert.equal((await call('/auth/register',{...account,...mismatch})).status,400);
    assert.equal((await call('/auth/register',account,undefined,'https://evil.example')).status,403);
    assert.equal((await call('/auth/register',account)).status,400);
    const limited=await call('/auth/register',account);assert.equal(limited.status,429);assert.equal(limited.retry,'3600');
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get()!.n,2);
    // A second API instance uses the same persisted quota rather than resetting it.
    const again=express();again.use(express.json());again.use('/api',createApi(db,path.join(dir,'setup.txt')));
    const second=again.listen(0,'127.0.0.1');await once(second,'listening');
    try {
      assert.equal((await fetch(`http://127.0.0.1:${(second.address() as any).port}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,429);
    } finally {await new Promise<void>(resolve=>second.close(()=>resolve()));}
    for(let i=0;i<30;i++)await call('/auth/register/challenge');
    assert.equal((await call('/auth/register/challenge')).status,429);
    process.env.REGISTRATION_ENABLED='false';
    assert.equal((await call('/auth/setup')).body.registrationEnabled,false);
    assert.equal((await call('/auth/register/challenge')).status,403);
    assert.equal((await call('/auth/register',account)).status,403);
    delete process.env.REGISTRATION_ENABLED;
    const environment=process.env.NODE_ENV;process.env.NODE_ENV='production';
    try {assert.equal((await call('/auth/register',account)).status,403);}
    finally {if(environment===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=environment;}
    process.env.REGISTRATION_ENABLED='true';db.prepare("UPDATE users SET password_hash=NULL WHERE id='admin'").run();
    assert.equal((await call('/auth/register/challenge')).status,403);
  } finally {
    if(originalEnabled===undefined)delete process.env.REGISTRATION_ENABLED;else process.env.REGISTRATION_ENABLED=originalEnabled;
    await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();rmSync(dir,{recursive:true,force:true});
  }
});
