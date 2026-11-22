import express, { type Request, type Response, type NextFunction } from 'express';
import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { Database } from './database.ts';
import {createRegistrationRouter,registrationEnabled} from './registration.ts';
import {createRecoveryRouter} from './recovery.ts';

const scrypt = promisify(scryptCallback);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
type Row = Record<string, any>;
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, value] = stored.split(':');
  if (scheme !== 'scrypt') return false;
  const hash = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(value, 'hex');
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}
const safeUser = (u: Row) => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at,
  last_sign_in_at: u.last_sign_in_at, needs_password: !u.password_hash, is_active:!!u.is_active, deleted_at:u.deleted_at,
  registration_id:u.registration_id??null,
  user_metadata: { name: u.name } });
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const requirePassword = (value: unknown) => {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) throw new HttpError(400, 'Use a password between 10 and 128 characters.');
  return value;
};
const text = (value: unknown, max = 200) => {
  if (typeof value !== 'string' || value.length > max) throw new HttpError(400, 'Invalid text value.');
  return value;
};
const emailValue = (value: unknown) => {
  const email = text(value, 254).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  return email;
};
const dateValue = (value: unknown) => {
  const date = text(value,10);
  const parsed = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) throw new HttpError(400,'Enter a valid date.');
  return date;
};
const dummyPasswordHash = await hashPassword(randomBytes(32).toString('hex'));
const breakValue=(seconds:unknown):number|null=>{
  if(seconds===null)return null;
  if(typeof seconds!=='number'||!Number.isInteger(seconds)||seconds<0||seconds>604800)throw new HttpError(400,'Invalid break duration.');
  return seconds;
};

export function createApi(db: Database, setupFile = path.resolve('.data/setup-code.txt')) {
  const api = express.Router();
  const pendingAdmin = () => db.prepare("SELECT * FROM users WHERE role = 'admin' AND password_hash IS NULL AND is_active=1 AND deleted_at IS NULL LIMIT 1").get() as Row | undefined;
  if (pendingAdmin() && !existsSync(setupFile)) writeFileSync(setupFile, randomBytes(24).toString('hex') + '\n', { mode: 0o600 });
  const attempts = new Map<string, { count: number, until: number }>();
  api.use((_req, res, next) => { res.setHeader('Cache-Control','no-store'); next(); });
  api.use((req, _res, next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      const expectedOrigin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
      if (origin && origin !== expectedOrigin) return next(new HttpError(403, 'Request origin is not allowed.'));
      if (!req.is('application/json')) return next(new HttpError(415, 'JSON request required.'));
    }
    next();
  });
  // Bound failed sign-in/setup attempts without retaining submitted credentials.
  api.use(['/auth/login','/auth/setup'], (req, _res, next) => {
    const key = req.ip || 'local';
    const t = Date.now();
    for (const [k,v] of attempts) if (v.until < t) attempts.delete(k);
    const state = attempts.get(key) || {count:0,until:t + 15*60_000};
    state.count++; attempts.set(key,state);
    next(state.count > 20 ? new HttpError(429,'Too many attempts. Try again in 15 minutes.') : undefined);
  });
  const route = (fn: (req: Request, res: Response) => any) => (req: Request, res: Response, next: NextFunction) => Promise.resolve().then(() => fn(req,res)).catch(next);
  const currentUser = (req: Request) => {
    const cookie = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('study_session='))?.slice(14);
    if (!cookie) return undefined;
    return db.prepare('SELECT u.* FROM auth_sessions a JOIN users u ON u.id=a.user_id WHERE a.token_hash=? AND a.expires_at>? AND u.is_active=1 AND u.deleted_at IS NULL').get(digest(cookie),Date.now()) as Row | undefined;
  };
  const issueSession = (res: Response, user: Row) => {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(Date.now());
    db.prepare('INSERT INTO auth_sessions VALUES (?,?,?)').run(digest(token),user.id,Date.now()+7*86400_000);
    res.setHeader('Set-Cookie', `study_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  };
  api.get('/health', (_req,res) => res.json({ status:'ok', database:'sqlite' }));
  api.get('/auth/setup', (_req,res) => res.json({ required: !!pendingAdmin(), email: pendingAdmin()?.email,
    registrationEnabled:registrationEnabled() && !!db.prepare("SELECT 1 FROM users WHERE role='admin' AND password_hash IS NOT NULL AND is_active=1 AND deleted_at IS NULL").get() }));
  api.use('/auth/register',createRegistrationRouter(db,{hashPassword,safeUser,issueSession}));
  api.use('/auth',createRecoveryRouter(db,{hashPassword}));
  api.post('/auth/setup', route(async (req,res) => {
    const admin = pendingAdmin();
    if (!admin || !existsSync(setupFile)) throw new HttpError(409,'Administrator setup is already complete.');
    const code = text(req.body.code, 100).trim();
    if (!timingSafeEqual(Buffer.from(digest(code)),Buffer.from(digest(readFileSync(setupFile,'utf8').trim())))) throw new HttpError(403,'Incorrect setup code.');
    const hash = await hashPassword(requirePassword(req.body.password));
    const changed = db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash IS NULL').run(hash,admin.id);
    if (!changed.changes) throw new HttpError(409,'Administrator setup is already complete.');
    unlinkSync(setupFile);
    issueSession(res,admin);
    res.json({ user: safeUser({...admin,password_hash:hash}) });
  }));
  api.post('/auth/login', route(async (req,res) => {
    const email = emailValue(req.body.email);
    const password = text(req.body.password,128);
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email) as Row | undefined;
    const valid = await verifyPassword(password,user?.password_hash || dummyPasswordHash);
    if (!user?.password_hash || !valid || !user.is_active || user.deleted_at) throw new HttpError(401,'Incorrect email or password, or account unavailable.');
    db.prepare('UPDATE users SET last_sign_in_at=? WHERE id=?').run(now(),user.id);
    issueSession(res,user);
    attempts.delete(req.ip || 'local');
    res.json({ user:safeUser(user) });
  }));
  api.post('/auth/logout', route((req,res) => {
    const cookie = req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('study_session='))?.slice(14);
    if (cookie) db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(digest(cookie));
    res.setHeader('Set-Cookie',`study_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    res.json({ok:true});
  }));
  api.get('/auth/me', (req,res) => { const user=currentUser(req); res.json({user:user ? safeUser(user) : null}); });
  api.use((req,res,next) => {
    const user=currentUser(req);
    if (!user) return next(new HttpError(401,'Please sign in.'));
    res.locals.user=user; next();
  });
  api.use('/users', (_req,res,next) => next(res.locals.user.role === 'admin' ? undefined : new HttpError(403,'Administrator access required.')));
  api.get('/users/registrations',(_req,res)=>{
    const seen=db.prepare('SELECT through_id FROM registration_seen WHERE admin_id=?').get(res.locals.user.id)?.through_id??0;
    const count=Number(db.prepare('SELECT count(*) AS count FROM registration_events r JOIN users u ON u.id=r.user_id WHERE r.id>? AND u.deleted_at IS NULL').get(seen)!.count);
    res.json({count});
  });
  api.post('/users/registrations/seen',route((req,res)=>{
    const through=req.body.through_id;
    const maximum=Number(db.prepare('SELECT COALESCE(MAX(id),0) AS maximum FROM registration_events').get()!.maximum);
    if(!Number.isSafeInteger(through)||through<0||through>maximum)throw new HttpError(400,'Invalid registration marker.');
    db.prepare('INSERT INTO registration_seen VALUES (?,?) ON CONFLICT(admin_id) DO UPDATE SET through_id=MAX(through_id,excluded.through_id)').run(res.locals.user.id,through);
    res.json({ok:true});
  }));
  api.get('/users', (req,res) => res.json(db.prepare(`SELECT u.*,r.id AS registration_id FROM users u LEFT JOIN registration_events r ON r.user_id=u.id ${req.query.include_deleted==='true'?'':'WHERE u.deleted_at IS NULL'} ORDER BY u.created_at`).all().map(safeUser)));
  const manageableUser=(req:Request,res:Response)=>{
    if(req.params.id===res.locals.user.id)throw new HttpError(400,'You cannot deactivate or delete your own account.');
    const target=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id) as Row|undefined;
    if(!target)throw new HttpError(404,'User not found.');
    return target;
  };
  const revokeUser=(id:string)=>{
    db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').run(id);
  };
  api.patch('/users/:id',route((req,res)=>{
    const target=manageableUser(req,res);
    if(target.deleted_at)throw new HttpError(400,'Restore this account before changing its status.');
    if(typeof req.body.is_active!=='boolean')throw new HttpError(400,'Active status must be true or false.');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE users SET is_active=? WHERE id=?').run(req.body.is_active?1:0,target.id);
      if(!req.body.is_active)revokeUser(target.id);
      db.exec('COMMIT');
    } catch(error){db.exec('ROLLBACK');throw error;}
    res.json({ok:true});
  }));
  api.delete('/users/:id',route((req,res)=>{
    const target=manageableUser(req,res);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE users SET deleted_at=?,is_active=0 WHERE id=?').run(now(),target.id);revokeUser(target.id);
      db.exec('COMMIT');
    } catch(error){db.exec('ROLLBACK');throw error;}
    res.json({ok:true});
  }));
  api.post('/users/:id/restore',route((req,res)=>{
    const target=manageableUser(req,res);
    db.prepare('UPDATE users SET deleted_at=NULL,is_active=0 WHERE id=?').run(target.id);
    res.json({ok:true});
  }));
  api.post('/users', route(async (req,res) => {
    const email=emailValue(req.body.email), name=text(req.body.name).trim() || email.split('@')[0];
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw new HttpError(409,'An account with this email already exists.');
    const hash=await hashPassword(requirePassword(req.body.password));
    const id=randomUUID();
    db.prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)').run(id,email,name,hash,now());
    res.status(201).json(safeUser(db.prepare('SELECT * FROM users WHERE id=?').get(id) as Row));
  }));
  api.post('/users/:id/password', route(async (req,res) => {
    if (!db.prepare('SELECT 1 FROM users WHERE id=? AND deleted_at IS NULL').get(req.params.id)) throw new HttpError(404,'User not found.');
    const hash=await hashPassword(requirePassword(req.body.password));
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash,req.params.id);
      db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(req.params.id);
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').run(req.params.id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    res.json({ok:true});
  }));
  api.get('/sessions', (_req,res) => res.json(db.prepare('SELECT * FROM sessions WHERE user_id=? ORDER BY created_at DESC').all(res.locals.user.id)));
  const sessionValues = (body: Row) => {
    const date=text(body.date,10), start=text(body.start_time,5), end=text(body.end_time,5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) throw new HttpError(400,'Enter a valid date and time.');
    if (!Number.isInteger(body.duration) || body.duration<0 || body.duration>10080) throw new HttpError(400,'Invalid duration.');
    return [date,start,end,body.duration,text(body.main_task,1000),text(body.topic,1000)];
  };
  api.post('/sessions', route((req,res) => {
    if(req.body.owner_id!==undefined&&req.body.owner_id!==res.locals.user.id)throw new HttpError(403,'Account changed. Sign in to the original account to save this session.');
    const values=sessionValues(req.body), id=req.body.id??randomUUID();
    const breakSeconds=req.body.break_seconds===undefined?(req.body.id?0:null):breakValue(req.body.break_seconds);
    if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError(400,'Invalid session ID.');
    const existing=db.prepare('SELECT * FROM sessions WHERE id=?').get(id) as Row|undefined;
    if(existing){
      if(existing.user_id!==res.locals.user.id||[existing.date,existing.start_time,existing.end_time,existing.duration,existing.main_task,existing.topic].some((value,index)=>value!==values[index]))throw new HttpError(409,'A different session already uses this ID.');
      res.json({id});return;
    }
    db.prepare('INSERT INTO sessions (id,user_id,date,start_time,end_time,duration,main_task,topic,created_at,updated_at,break_seconds) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id,res.locals.user.id,...values,now(),now(),breakSeconds);
    res.status(201).json({id});
  }));
  api.put('/sessions/:id/break', route((req,res)=>{
    if(req.body.owner_id!==undefined&&req.body.owner_id!==res.locals.user.id)throw new HttpError(403,'Account changed.');
    const seconds=req.body.seconds;
    if(!Number.isInteger(seconds)||seconds<0||seconds>604800)throw new HttpError(400,'Invalid break duration.');
    const result=db.prepare('UPDATE sessions SET break_seconds=MAX(COALESCE(break_seconds,0),?),updated_at=? WHERE id=? AND user_id=?').run(seconds,now(),req.params.id,res.locals.user.id);
    if(!result.changes)throw new HttpError(404,'Session not found.');
    res.json(db.prepare('SELECT break_seconds FROM sessions WHERE id=? AND user_id=?').get(req.params.id,res.locals.user.id));
  }));
  api.patch('/sessions/:id', route((req,res) => {
    const existing=db.prepare('SELECT * FROM sessions WHERE id=? AND user_id=?').get(req.params.id,res.locals.user.id) as Row;
    if (!existing) throw new HttpError(404,'Session not found.');
    const allowed=['date','start_time','end_time','duration','main_task','topic'];
    const body={...existing};
    for (const k of allowed) if (req.body[k] !== undefined) body[k]=req.body[k];
    const breakSeconds=req.body.break_seconds===undefined?existing.break_seconds:breakValue(req.body.break_seconds);
    db.prepare('UPDATE sessions SET date=?,start_time=?,end_time=?,duration=?,main_task=?,topic=?,break_seconds=?,updated_at=? WHERE id=? AND user_id=?').run(...sessionValues(body),breakSeconds,now(),req.params.id,res.locals.user.id);
    res.json({ok:true});
  }));
  api.delete('/sessions/:id', route((req,res) => {
    const result=db.prepare('DELETE FROM sessions WHERE id=? AND user_id=?').run(req.params.id,res.locals.user.id);
    if (!result.changes) throw new HttpError(404,'Session not found.');
    res.json({ok:true});
  }));
  const safeTodo = (row: Row) => ({...row,completed:!!row.completed});
  const todoValues = (body: Row) => {
    const title=text(body.title,200).trim();
    if (!title) throw new HttpError(400,'Enter a task title.');
    if (body.completed !== undefined && typeof body.completed !== 'boolean') throw new HttpError(400,'Invalid completion status.');
    return [dateValue(body.date),title,text(body.notes ?? '',4000).trim(),body.completed ? 1 : 0];
  };
  api.get('/todos', route((req,res) => {
    const from=dateValue(req.query.from), to=dateValue(req.query.to);
    if (from>to) throw new HttpError(400,'The end date must follow the start date.');
    res.json(db.prepare('SELECT * FROM todos WHERE user_id=? AND date>=? AND date<=? ORDER BY date,created_at,id').all(res.locals.user.id,from,to).map(safeTodo));
  }));
  api.post('/todos', route((req,res) => {
    const id=randomUUID(), values=todoValues(req.body);
    db.prepare('INSERT INTO todos (id,user_id,date,title,notes,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id,res.locals.user.id,...values,now(),now());
    res.status(201).json(safeTodo(db.prepare('SELECT * FROM todos WHERE id=? AND user_id=?').get(id,res.locals.user.id) as Row));
  }));
  api.patch('/todos/:id', route((req,res) => {
    const existing=db.prepare('SELECT * FROM todos WHERE id=? AND user_id=?').get(req.params.id,res.locals.user.id) as Row | undefined;
    if (!existing) throw new HttpError(404,'Task not found.');
    const body: Row={...existing,completed:!!existing.completed};
    for (const field of ['date','title','notes','completed']) if (req.body[field] !== undefined) body[field]=req.body[field];
    db.prepare('UPDATE todos SET date=?,title=?,notes=?,completed=?,updated_at=? WHERE id=? AND user_id=?').run(...todoValues(body),now(),req.params.id,res.locals.user.id);
    res.json(safeTodo(db.prepare('SELECT * FROM todos WHERE id=? AND user_id=?').get(req.params.id,res.locals.user.id) as Row));
  }));
  api.delete('/todos/:id', route((req,res) => {
    if (!db.prepare('DELETE FROM todos WHERE id=? AND user_id=?').run(req.params.id,res.locals.user.id).changes) throw new HttpError(404,'Task not found.');
    res.json({ok:true});
  }));
  api.post('/feedback',route((req,res)=>{
    const subject=text(req.body.subject,200).trim(),message=text(req.body.message,5000).trim();
    if(!subject||!message)throw new HttpError(400,'Enter a subject and feedback message.');
    const recent=db.prepare('SELECT count(*) AS count FROM feedback WHERE user_id=? AND created_at>=?')
      .get(res.locals.user.id,new Date(Date.now()-3600_000).toISOString())!;
    if(Number(recent.count)>=10){res.setHeader('Retry-After','3600');throw new HttpError(429,'You have sent 10 messages in the past hour. Please try again later.');}
    const id=randomUUID();
    db.prepare('INSERT INTO feedback (id,user_id,subject,message,created_at) VALUES (?,?,?,?,?)')
      .run(id,res.locals.user.id,subject,message,now());
    res.status(201).json({id,message:'Your feedback has been sent to the administrator.'});
  }));
  api.get('/feedback/unread-count',route((_req,res)=>{
    if(res.locals.user.role!=='admin')throw new HttpError(403,'Administrator access required.');
    const count=Number(db.prepare('SELECT count(*) AS count FROM feedback WHERE read_at IS NULL').get()!.count);
    res.json({count});
  }));
  api.get('/feedback',route((req,res)=>{
    if(res.locals.user.role!=='admin')throw new HttpError(403,'Administrator access required.');
    const page=Number(req.query.page??1);
    if(!Number.isSafeInteger(page)||page<1||page>1_000_000)throw new HttpError(400,'Invalid inbox page.');
    const total=Number(db.prepare('SELECT count(*) AS count FROM feedback').get()!.count);
    const unread=Number(db.prepare('SELECT count(*) AS count FROM feedback WHERE read_at IS NULL').get()!.count);
    const items=db.prepare(`SELECT f.*,u.name AS sender_name,u.email AS sender_email FROM feedback f
      JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC,f.id DESC LIMIT 50 OFFSET ?`).all((page-1)*50);
    res.json({items,total,unread,page,pageSize:50});
  }));
  api.patch('/feedback/:id',route((req,res)=>{
    if(res.locals.user.role!=='admin')throw new HttpError(403,'Administrator access required.');
    if(typeof req.body.read!=='boolean')throw new HttpError(400,'Read status must be true or false.');
    if(!db.prepare('UPDATE feedback SET read_at=? WHERE id=?').run(req.body.read?now():null,req.params.id).changes)
      throw new HttpError(404,'Feedback not found.');
    res.json({ok:true});
  }));
  api.get('/settings', (_req,res) => {
    const s=db.prepare('SELECT * FROM user_settings WHERE user_id=?').get(res.locals.user.id) as Row | undefined;
    res.json(s ? {timer:JSON.parse(s.timer),theme:JSON.parse(s.theme),sound:JSON.parse(s.sound)} : null);
  });
  api.put('/settings', route((req,res) => {
    const {timer,theme,sound}=req.body;
    if (!timer || !theme || !sound || !['work','shortBreak','longBreak'].every(k => typeof timer[k] === 'number' && timer[k]>0 && timer[k]<=1440 && typeof theme[k] === 'string' && /^bg-[a-z]+-\d{2,3}$/.test(theme[k])) || typeof timer.darkModeWhenRunning !== 'boolean' || typeof sound.enabled !== 'boolean' || typeof sound.type !== 'string' || !sound.type.startsWith('https://') || !Number.isFinite(sound.volume) || sound.volume<0 || sound.volume>1 || !Number.isInteger(sound.repeatCount) || sound.repeatCount<1 || sound.repeatCount>20) throw new HttpError(400,'Invalid settings.');
    db.prepare('INSERT INTO user_settings VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET timer=excluded.timer,theme=excluded.theme,sound=excluded.sound,updated_at=excluded.updated_at').run(res.locals.user.id,JSON.stringify(timer),JSON.stringify(theme),JSON.stringify(sound),now());
    res.json({ok:true});
  }));
  api.use((_req,_res,next) => next(new HttpError(404,'API endpoint not found.')));
  api.use((error: any,_req: Request,res: Response,_next: NextFunction) => {
    if (!(error instanceof HttpError)) console.error('API error:',error.message);
    res.status(error.status || 500).json({error: error instanceof HttpError ? error.message : 'Unable to complete the request.'});
  });
  return api;
}
