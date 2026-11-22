import { readFileSync } from 'node:fs';
import { openDatabase } from '../server/database.ts';

const filename = process.argv[2] || '.data/supabase-import.json';
const data = JSON.parse(readFileSync(filename, 'utf8'));
const db = openDatabase();
const migration = 'supabase-initial-import';
if (db.prepare('SELECT 1 FROM migrations WHERE name = ?').get(migration)) {
  console.log('Supabase import already completed; local changes preserved.');
  db.close();
  process.exit(0);
}
if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) throw new Error('Import requires an empty users table.');
if (!data.users.some((u: any) => u.email?.toLowerCase() === 'snlynnoo@gmail.com')) throw new Error('Administrator account missing from export.');
db.exec('BEGIN IMMEDIATE');
try {
  for (const u of data.users) {
    db.prepare('INSERT INTO users (id,email,name,role,created_at,last_sign_in_at) VALUES (?,?,?,?,?,?)').run(
      u.id, u.email.trim().toLowerCase(), u.user_metadata?.full_name || u.user_metadata?.name || u.email.split('@')[0],
      u.email.toLowerCase() === 'snlynnoo@gmail.com' ? 'admin' : 'user', u.created_at, u.last_sign_in_at);
  }
  for (const s of data.sessions) {
    db.prepare('INSERT INTO sessions (id,user_id,date,start_time,end_time,duration,main_task,topic,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(s.id,s.user_id,s.date,s.start_time,s.end_time,s.duration,s.main_task,s.topic,s.created_at,s.updated_at ?? null);
  }
  for (const s of data.user_settings) {
    db.prepare('INSERT INTO user_settings VALUES (?,?,?,?,?)').run(s.user_id,JSON.stringify(s.timer),JSON.stringify(s.theme),JSON.stringify(s.sound),s.updated_at);
  }
  db.prepare('INSERT INTO migrations VALUES (?,?)').run(migration, new Date().toISOString());
  db.exec('COMMIT');
  console.log(JSON.stringify({ users: data.users.length, sessions: data.sessions.length, user_settings: data.user_settings.length }));
} catch (error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
