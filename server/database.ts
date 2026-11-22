import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';

export function openDatabase(filename = process.env.DATABASE_PATH || path.resolve('.data/study-timer.sqlite')) {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  chmodSync(filename, 0o600);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL, password_hash TEXT, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
      created_at TEXT NOT NULL, last_sign_in_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), date TEXT NOT NULL,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, duration INTEGER NOT NULL CHECK(duration >= 0),
      main_task TEXT NOT NULL, topic TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS sessions_user_created ON sessions(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id), timer TEXT NOT NULL, theme TEXT NOT NULL,
      sound TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), date TEXT NOT NULL,
      title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS todos_user_date ON todos(user_id, date, created_at);
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
  `);
  const columns=db.prepare('PRAGMA table_info(sessions)').all();
  if(!columns.some(column=>column.name==='break_seconds')) db.exec('ALTER TABLE sessions ADD COLUMN break_seconds INTEGER CHECK(break_seconds IS NULL OR break_seconds >= 0)');
  return db;
}
export type Database = ReturnType<typeof openDatabase>;
