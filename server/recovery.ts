import express from 'express';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,chmodSync} from 'node:fs';
import path from 'node:path';
import type {Database} from './database.ts';

const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function createRecoveryRouter(db:Database,options:{hashPassword:(value:string)=>Promise<string>}) {
  const router=express.Router();
  let hashing=0;
  const message='If an active account matches that email, a password reset link will be sent.';
  function quota(key:string,max:number) {
    const time=Date.now();db.prepare('DELETE FROM registration_limits WHERE expires_at<=?').run(time);
    db.prepare('INSERT INTO registration_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,time+3600_000);
    return Number(db.prepare('SELECT count FROM registration_limits WHERE key=?').get(key)!.count)<=max;
  }
  router.use(['/forgot-password','/reset-password'],(req,res,next)=>{
    if(!quota('recovery:global',100)||!quota(`recovery:${digest(req.ip||'local')}`,20)) {
      res.setHeader('Retry-After','3600');res.status(429).json({error:'Too many recovery requests. Please try again in an hour.'});return;
    }
    next();
  });
  router.post('/forgot-password',(req,res,next)=>{
    try {
      // Local mailbox delivery only. Never expose a reset token through a public API response.
      if(process.env.NODE_ENV==='production') {res.status(503).json({error:'Password recovery email delivery has not been configured yet.'});return;}
      const email=typeof req.body.email==='string'?req.body.email.trim().toLowerCase():'';
      if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {res.status(400).json({error:'Enter a valid email address.'});return;}
      if(!quota(`recovery-email:${digest(email)}`,3)){res.json({message});return;}
      const user=db.prepare('SELECT id FROM users WHERE email=? AND is_active=1 AND deleted_at IS NULL').get(email);
      if(user) {
        const token=randomBytes(32).toString('hex'),time=Date.now();
        const origin=`${req.protocol}://${req.get('host')}`;
        const mail=`To: ${email}\nSubject: Reset your Study Timer password\n\nOpen this link within 30 minutes:\n${origin}/#reset-password=${token}\n\nIf you did not request this, ignore this message.\n`;
        const folder=path.resolve(process.env.RESET_MAIL_DIR||'.data/password-reset-mail');
        mkdirSync(folder,{recursive:true,mode:0o700});chmodSync(folder,0o700);
        db.prepare('DELETE FROM password_reset_tokens WHERE expires_at<=?').run(time);
        // Write first; a failed write must not invalidate a previously usable link.
        const filename=path.join(folder,`${time}-${randomBytes(6).toString('hex')}.txt`);
        writeFileSync(filename,mail,{mode:0o600,flag:'wx'});
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').run(user.id);
          db.prepare('INSERT INTO password_reset_tokens VALUES (?,?,?)').run(digest(token),user.id,time+30*60_000);
          db.exec('COMMIT');
        }catch(error){db.exec('ROLLBACK');throw error;}
      }
      res.json({message});
    }catch(error){next(error);}
  });
  router.post('/reset-password',async(req,res,next)=>{
    const {token,password}=req.body;
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||typeof password!=='string'||password.length<10||password.length>128) {
      res.status(400).json({error:'Use a valid reset link and a password between 10 and 128 characters.'});return;
    }
    const tokenHash=digest(token);
    const valid=()=>db.prepare('SELECT r.user_id FROM password_reset_tokens r JOIN users u ON u.id=r.user_id WHERE r.token_hash=? AND r.expires_at>? AND u.is_active=1 AND u.deleted_at IS NULL').get(tokenHash,Date.now());
    if(!valid()){res.status(400).json({error:'This reset link is invalid or expired. Request a new one.'});return;}
    if(hashing>=2){res.status(503).json({error:'Password recovery is busy. Try again shortly.'});return;}
    hashing++;
    try {
      const hash=await options.hashPassword(password);
      db.exec('BEGIN IMMEDIATE');
      try {
        // Recheck inside the transaction so a replay or deactivation during hashing cannot succeed.
        const user=valid();
        if(!user){db.exec('ROLLBACK');res.status(400).json({error:'This reset link is invalid or expired. Request a new one.'});return;}
        db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash,user.user_id);
        db.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').run(user.user_id);
        db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(user.user_id);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      res.json({message:'Password updated. Sign in with your new password.'});
    }catch(error){next(error);}finally{hashing--;}
  });
  return router;
}
