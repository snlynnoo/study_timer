import express, {type Response} from 'express';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import type {Database} from './database.ts';

const hash = (value:string) => createHash('sha256').update(value).digest('hex');
const hour = 60 * 60_000;
export const registrationEnabled = () => process.env.REGISTRATION_ENABLED === 'true' ||
  (process.env.REGISTRATION_ENABLED !== 'false' && process.env.NODE_ENV !== 'production');

export function createRegistrationRouter(db:Database, options:{
  hashPassword:(password:string)=>Promise<string>;
  safeUser:(user:any)=>unknown;
  issueSession:(res:Response,user:any)=>void;
}) {
  const router=express.Router();
  let hashing=0;
  // SQLite counters survive restarts; forward headers are used only through Express's configured trust proxy.
  function quota(key:string, maximum:number) {
    const time=Date.now();
    db.prepare('DELETE FROM registration_limits WHERE expires_at<=?').run(time);
    db.prepare(`INSERT INTO registration_limits VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=count+1`).run(key,time+hour);
    return Number(db.prepare('SELECT count FROM registration_limits WHERE key=?').get(key)!.count)<=maximum;
  }
  router.use((req,res,next)=>{
    if(!registrationEnabled()) {res.status(403).json({error:'Self-registration is currently disabled.'});return;}
    if(!db.prepare("SELECT 1 FROM users WHERE role='admin' AND password_hash IS NOT NULL AND is_active=1 AND deleted_at IS NULL").get()) {
      res.status(403).json({error:'An administrator must finish installation before registration opens.'});return;
    }
    const ip=hash(req.ip||'local');
    const challenge=req.method==='GET';
    const globalAllowed=quota(challenge?'challenge:global':'register:global',challenge?300:100);
    const ipAllowed=globalAllowed&&quota(`${challenge?'challenge':'register'}:${ip}`,challenge?30:10);
    if(!globalAllowed||!ipAllowed) {
      res.setHeader('Retry-After','3600');
      res.status(429).json({error:'Too many registration requests. Please try again in an hour.'});return;
    }
    res.locals.registrationIp=ip;next();
  });
  router.get('/challenge',(_req,res)=>{
    const time=Date.now(),id=randomBytes(32).toString('hex');
    db.prepare('DELETE FROM registration_challenges WHERE expires_at<=?').run(time);
    db.prepare('INSERT INTO registration_challenges VALUES (?,?,?,?)').run(id,res.locals.registrationIp,time,time+10*60_000);
    res.json({id,difficulty:4,expiresAt:time+10*60_000});
  });
  router.post('/',async(req,res,next)=>{
    try {
      const {name,email,password,challengeId,nonce,website}=req.body;
      // Consume every submitted challenge, including failed answers, before awaiting password hashing.
      const challenge=typeof challengeId==='string'?db.prepare('DELETE FROM registration_challenges WHERE id=? RETURNING *').get(challengeId):undefined;
      const elapsed=Date.now()-Number(challenge?.issued_at);
      if(!challenge||challenge.ip_hash!==res.locals.registrationIp||Number(challenge.expires_at)<=Date.now()||elapsed<2000||
        (website!==undefined&&website!=='')||!Number.isSafeInteger(nonce)||nonce<0||nonce>2_000_000_000||
        !hash(`${challengeId}:${nonce}`).startsWith('0000')) {
        res.status(400).json({error:'Security check failed or expired. Please run it again.'});return;
      }
      if(typeof name!=='string'||!name.trim()||name.trim().length>200||typeof email!=='string'||email.length>254||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||typeof password!=='string'||password.length<10||password.length>128) {
        res.status(400).json({error:'Enter a name, valid email, and a password between 10 and 128 characters.'});return;
      }
      if(hashing>=2) {res.status(503).json({error:'Registration is busy. Please try again shortly.'});return;}
      hashing++;
      try {
        const passwordHash=await options.hashPassword(password);
        // Use the same response for duplicates without changing any existing account or password.
        if(db.prepare('SELECT 1 FROM users WHERE email=?').get(email.trim().toLowerCase())) {
          res.status(409).json({error:'This email is already registered. Sign in or use Forgot password? to set a new password. If your account is inactive, contact your administrator.'});return;
        }
        const id=randomUUID();
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare("INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,'user',?)")
            .run(id,email.trim().toLowerCase(),name.trim(),passwordHash,new Date().toISOString());
          db.prepare('INSERT INTO registration_events (user_id) VALUES (?)').run(id);
          db.exec('COMMIT');
        }catch(error){db.exec('ROLLBACK');throw error;}
        const user=db.prepare('SELECT * FROM users WHERE id=?').get(id);
        options.issueSession(res,user);
        res.status(201).json({user:options.safeUser(user)});
      } finally {hashing--;}
    } catch(error) {next(error);}
  });
  return router;
}
