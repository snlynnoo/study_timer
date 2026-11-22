# Study Timer — Implementation

This document describes the implemented application as of November 22, 2026. For installation and user instructions, see [documentation.md](documentation.md).

## Architecture

The app is a React 19 single-page application served by an Express 4 process. Vite supplies development middleware and builds the production frontend. The same Express process serves the `/api` routes and opens a local SQLite database through Node's built-in `node:sqlite` module.

The server binds to `127.0.0.1`. This implementation is designed for local use with persistent storage on the computer running the server. The active application does not require a hosted authentication or database service.

Runtime requirements: Node.js 22.13 or newer and npm. TypeScript runs through `tsx` on the server; Vite compiles the frontend. Styling uses Tailwind CSS, custom CSS, and Lucide icons. Motion handles interface animations, date-fns handles date utilities, and Recharts renders statistics.

## Source layout

- `server.ts`: environment loading, JSON body limit, API mounting, development/production serving, and loopback listener.
- `server/database.ts`: database opening, permissions, schema initialization, indexes, and additive migration of break tracking.
- `server/api.ts`: local authentication, administrator operations, sessions, tasks, settings, validation, and API errors.
- `src/App.tsx`: authentication lifecycle, navigation, account data loading, settings persistence, timer integration, and workspace layout.
- `src/lib/api.ts`: same-origin JSON API client with HTTP error handling.
- `src/lib/timerMachine.ts`: pure timer state machine and emitted persistence events.
- `src/hooks/usePomodoroTimer.ts`: React integration, elapsed-time ticks, per-account browser persistence, and save retries.
- `src/components/Timer.tsx`: timer display, progress ring, start/pause, and reset controls.
- `src/components/LongBreakPrompt.tsx`: fourth-session acknowledgment dialog.
- `src/components/BreakDuration.tsx`: presentation of actual or unknown break duration.
- `src/components/Dashboard.tsx`: study statistics.
- `src/components/SessionList.tsx` and `HistoryActions.tsx`: history, manual insertion, editing/removal, and CSV export.
- `src/components/TodoView.tsx`: calendar navigation and dated task management.
- `src/components/UsersView.tsx`: administrator account creation and password resets.
- `src/components/SettingsPage.tsx`: inline workspace settings with automatic saving.
- `src/components/AuthView.tsx`: local sign-in and initial administrator setup.
- `src/components/PomodoroInfo.tsx`: Guide page using the configured timer durations.
- `src/components/TextSizeControl.tsx` and `LiveClock.tsx`: font scaling and local 24-hour clock.
- `src/lib/palette.ts`, `src/index.css`, and `src/palette.css`: theme definitions and responsive styling. Palette overrides load after the base stylesheet.
- `scripts/import-supabase.ts`: one-time import of an existing private snapshot.
- `tests/`: API integration, timer state transitions, and legacy-schema migration tests.

Legacy cloud client files and dependencies remain in the repository. Their presence does not mean the current app uses cloud authentication or sync. `README_DEPLOY.md` describes an earlier Firebase/Vercel version.

## Database model

The default file is `.data/study-timer.sqlite`. Foreign keys, WAL journaling, and a five-second busy timeout are enabled. The database file is restricted to its owner with mode `0600`; newly created database directories use `0700`.

### Users and authentication

`users` stores `id`, case-insensitive unique `email`, `name`, nullable `password_hash`, `role`, `created_at`, and `last_sign_in_at`. Roles are `admin` and `user`. A missing hash means the account needs a local password.

`auth_sessions` stores a SHA-256 token hash, the owning user ID, and expiry in milliseconds. Raw session tokens are sent only in the `study_session` cookie. The cookie is HttpOnly, SameSite=Strict, scoped to `/`, and valid for seven days. The local HTTP implementation does not set the Secure cookie attribute.

Passwords use scrypt with a random 16-byte salt and a 64-byte derived hash. Password creation/reset requires 10–128 characters. Password reset updates the hash and revokes all local sessions belonging to that user in a transaction.

Initial setup is available only for an existing administrator whose password hash is null. The server creates a private `.data/setup-code.txt`; successful setup consumes the code and signs the administrator in. Starting with a completely empty database does not create an administrator automatically; the existing bootstrap path is the private snapshot import.

### Study sessions

`sessions` stores `id`, `user_id`, `date`, `start_time`, `end_time`, `duration`, `main_task`, `topic`, `created_at`, `updated_at`, and nullable `break_seconds`.

Focus duration is in minutes. Break duration is in seconds. `date` is a date string and start/end times use `HH:mm`; creation/update timestamps are ISO strings. An index supports loading sessions by owner and creation time.

On database opening, the app checks `PRAGMA table_info(sessions)` and adds `break_seconds` if absent. This preserves existing rows. Null means unknown historical or manually inserted break time; zero means a timer-created session has no recorded active break yet.

### Settings, tasks, and migrations

- `user_settings`: one row per user containing JSON strings for timer, theme, and sound settings plus an update timestamp.
- `todos`: owner, date, title, notes, completion flag, and timestamps. An index supports per-user date queries.
- `migrations`: named completed imports and their application timestamps. The one-time import is recorded as `supabase-initial-import`.

## Request and authorization flow

The API reads the cookie, hashes its token, and joins unexpired `auth_sessions` to `users`. Protected endpoints derive ownership from that authenticated user. Session and task queries include `user_id`; administrator role checks protect `/users` operations.

Mutation requests require JSON and reject a supplied Origin that differs from the local HTTP host. API responses use `Cache-Control: no-store`. Sign-in/setup attempt tracking limits repeated requests by IP; this counter is in memory and resets when the process restarts. Errors return JSON with an `error` message.

### API routes

All paths below are prefixed with `/api`.

Public/authentication:

- `GET /health`: server/database status.
- `GET /auth/setup`: whether an existing administrator requires setup.
- `POST /auth/setup`: `{ code, password }` to complete setup.
- `POST /auth/login`: `{ email, password }` to issue a local session cookie.
- `POST /auth/logout`: revoke the current token and clear the cookie.
- `GET /auth/me`: current safe user object or `null`.

Administrator only:

- `GET /users`: list users without password hashes.
- `POST /users`: `{ email, name, password }` to create an ordinary user.
- `POST /users/:id/password`: `{ password }` to reset a password and revoke the user's sign-ins.

Authenticated account data:

- `GET /sessions`: list the current account's sessions.
- `POST /sessions`: create a session from `date`, `start_time`, `end_time`, `duration`, `main_task`, and `topic`. Timer saves also supply a stable UUID `id` and `owner_id`.
- `PATCH /sessions/:id`: update allowed session fields.
- `DELETE /sessions/:id`: remove an owned session.
- `PUT /sessions/:id/break`: `{ seconds, owner_id? }` to checkpoint cumulative active break seconds.
- `GET /todos?from=YYYY-MM-DD&to=YYYY-MM-DD`: list owned tasks in an inclusive date range.
- `POST /todos`: create from `{ date, title, notes?, completed? }`.
- `PATCH /todos/:id`: update date, title, notes, or completion.
- `DELETE /todos/:id`: remove an owned task.
- `GET /settings`: saved `{ timer, theme, sound }` or `null`.
- `PUT /settings`: validate and upsert those three settings objects.

Session creation is idempotent for the same ID, owner, and data; conflicting reuse returns HTTP 409. Break updates use the maximum of the stored and submitted total, so repeated or out-of-order checkpoints cannot add duplicate time or reduce the stored value.

## Timer behavior

The state machine separates timer transitions from React rendering and network requests. State includes mode, remaining and configured duration, running timestamp, focus identity and metadata, cycle count, long-break acknowledgment state, and accumulated break time.

1. Starting work creates a stable focus identity. Pausing accounts for elapsed active time and preserves the remaining duration.
2. A completed focus emits one save event, advances the completed-focus count, and immediately selects a paused short break.
3. The interface shows sessions `1 / 4` through `4 / 4`. After the fourth focus, a modal blocks timer controls until **Okay** selects a paused long break.
4. Starting a break is a user action. Completing the long break resets the cycle; the next work session is `1 / 4`.
5. Resetting an unfinished focus does not create a completed study record. Changing settings does not resize a started session's duration.

Elapsed time uses timestamps rather than assuming every interval fires precisely once per second. A late tick completes the current interval once and does not simulate a chain of unattended future sessions.

Break time links to the preceding completed focus. Only active elapsed break time counts. Checkpoints occur during running breaks and on pause, reset, mode changes, or completion. UI tags show minutes; CSV exports use minute values with up to two decimal places. Unknown break time displays `Break —` and exports as an empty field.

## Browser persistence and saving

`study_timer_cycle_v1:<userId>` in localStorage contains a versioned timer snapshot and pending save events. The hook persists before sending events, saves focus records before dependent break updates, coalesces pending break totals, and retries failed saves after a five-second delay. Owner checks prevent pending events from being submitted as another account.

Paused progress and task metadata survive reload. A running snapshot uses its elapsed timestamp when restored. This is device/browser storage, not a background scheduler or cross-device sync service. Clearing site data removes snapshots and unsaved events; it does not remove records already saved to SQLite. Multiple tabs do not coordinate timer ownership.

Font size uses the separate browser preference `study_font_size`, ranging from 14 to 22 pixels with a 16-pixel reset value. Account settings are persisted through the API.

## Interface and external resources

The workspace contains Timer, Stats, History, To-do, Guide, administrator-only Users, and Settings. Settings render within the workspace. The header displays local date and `HH:mm` time.

The palette uses Tech Blue `#3D62A4`, orange `#F49D37`, muted teal `#779FA1`, rust `#A72608`, and olive `#4B543B`. Rust indicates pending tasks and olive indicates completed tasks. History actions use the orange accent. The Guide uses light cards instead of a solid blue panel.

Sound previews and completion sounds use HTTPS audio assets hosted by Mixkit. Audio availability depends on connectivity and browser playback rules. Browser notifications are sent only when notification permission is already granted.

## Validation and maintenance

Run from the repository root:

```bash
npm run lint
npm test
npm run build
```

`lint` is TypeScript checking, not an ESLint pass. Tests use Node's test runner with `tsx` and isolated SQLite databases. They cover account isolation and password resets, task/session operations, idempotent focus saves, cumulative break updates, schema preservation, four-session transitions, pause/resume, and restored metadata.

Follow `AGENTS.md` when modifying components: declare `useState` hooks first and preserve exactly-once timer completion with immediate mode transition. Keep timer rules in the pure state machine and extend behavior tests when changing them. Use explicit column lists for session inserts so additive migrations remain compatible.

For backup/restore and operational limitations, see [documentation.md](documentation.md). Static frontend hosting alone is insufficient: the current app needs its Node API and persistent SQLite file.
