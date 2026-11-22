# Study Timer by Sai

A local study timer with email/password accounts, study history, settings, and administrator user management.

## Documentation

- [Setup and user documentation](documentation.md): installation, accounts, timer, tasks, exports, backups, and troubleshooting.
- [Implementation](implementation.md): architecture, source layout, database schema, API, timer state, and validation.
- [VPS deployment](deploy/README.md): Docker, Caddy, DNS, updates, and backups.

`README_DEPLOY.md` describes the earlier Firebase/Vercel version; use the guides above for the current local SQLite app.

## Run locally

Requires Node.js 22.13 or newer (with built-in SQLite).

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The server listens on this computer's loopback interface. The app uses SQLite; it does not require Supabase, Firebase, or Gemini credentials.

## First administrator sign-in

The migrated administrator is `snlynnoo@gmail.com`. On first launch, the sign-in page asks for the one-time setup code from `.data/setup-code.txt` and a new password of at least 10 characters. The code is deleted after setup completes.

Supabase passwords were not exported. Migrated users cannot sign in until the administrator sets a local password for them. Existing Supabase accounts and records are unchanged.

After signing in as administrator, open **Users** to add accounts or reset a user's password. Resetting a password revokes all of that user's local sign-ins, including your own if you reset the administrator password. Ordinary users can access only their own study sessions and settings.

Users can also select **Create an account** and complete the local security check, or use **Forgot password?** for self-service recovery. Local reset messages are saved privately in `.data/password-reset-mail/`; email delivery must be configured before production use. Users now includes **Active**, recoverable **Delete**, and **Restore account** controls. See [documentation.md](documentation.md) for limits, setup, and production restrictions. Development stays local until VPS deployment is explicitly requested.

## Local database and migration

The database is `.data/study-timer.sqlite`. Its tables include `users`, `sessions`, `user_settings`, `todos`, `auth_sessions`, and `migrations`. The `users` table stores password hashes, never plaintext passwords. Database files, setup codes, and the private migration snapshot are ignored by Git and blocked from the development web server.

The initial Supabase snapshot is `.data/supabase-import.json`. It contains profiles, study sessions, and settings, without passwords or authentication tokens. The one-time import preserves original user and session IDs:

```bash
npm run db:import
```

Re-running an already completed import leaves local changes intact. The initial snapshot contains 5 accounts, 220 study sessions, and 5 settings records. It is a point-in-time copy; the local app does not sync with Supabase.

Stop the app before backing up the entire `.data` directory, including any SQLite `-wal` and `-shm` files. Keep the backup private. You can inspect `users` using a SQLite database viewer.

## Validation and production mode

```bash
npm run lint
npm test
npm run build
NODE_ENV=production npm start
```

`npm run preview` only previews the frontend and does not provide the database API; use the server command above for a working production build. `PORT` defaults to `3000`; `DATABASE_PATH` can override the database file. Local runs bind to loopback by default. The Docker deployment configures HTTPS, secure cookies, a fixed allowed origin, and a trusted reverse proxy; see the VPS guide before exposing the server publicly.

## To-do calendar

Open **To-do** above Guide in the sidebar. Select a calendar date to see its tasks, then use **Add task**, the edit pencil, or the remove button. Tasks can include notes, be moved to another date, and be marked complete. Removing a task asks for confirmation. Each account sees only its own tasks, saved in the local SQLite `todos` table.

The header shows the current local date and a live 24-hour clock (`HH:mm`).

## Focus cycles and break time

The timer counts four focus sessions (`1 / 4` through `4 / 4`). After the fourth, acknowledge the reminder with **Okay** to select Long Break. Press **Start break** when ready. Completing the long break begins a new cycle.

Break minutes appear beside focus duration in Recent sessions, History, and CSV exports. Only active break time counts; pauses do not. Partial breaks are recorded when paused, reset, or switched away. Historic sessions show `Break —` because their original break time is unknown. Breaks are linked to the preceding completed focus session.

Timer progress and pending saves are stored per account on this device. Unsaved timer records retry automatically; stable session IDs and absolute break totals prevent retries from duplicating records or break time. The timer retains a paused session and its task across a reload.
