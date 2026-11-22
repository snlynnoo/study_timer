import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const database = process.env.DATABASE_PATH || path.resolve('.data/study-timer.sqlite');
const directory = path.join(path.dirname(database), 'backups');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const filename = path.join(directory, `study-timer-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
const db = new DatabaseSync(database);
try {
  db.exec(`PRAGMA busy_timeout = 10000; VACUUM INTO '${filename.replaceAll("'", "''")}'`);
} finally {
  db.close();
}
chmodSync(filename, 0o600);
const backups = readdirSync(directory).filter(name => /^study-timer-.*\.sqlite$/.test(name)).sort().reverse();
for (const name of backups.slice(14)) unlinkSync(path.join(directory, name));
console.log(`Database backup created: ${path.basename(filename)}`);
