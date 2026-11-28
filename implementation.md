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

## Self-registration and account lifecycle

`server/registration.ts` implements `GET /api/auth/register/challenge` and `POST /api/auth/register`. `src/lib/registration.worker.ts` solves a SHA-256 puzzle off the main thread; the server independently verifies four leading hexadecimal zeroes for `challengeId:nonce`. Challenges are random, IP-bound, single-use, expire in ten minutes, and require a minimum two-second age. The hidden `website` field must be empty. Persistent `registration_limits` counters enforce per-IP and global hourly quotas, and `registration_challenges` stores challenge issuance/expiry. Verification happens before expensive scrypt work; registration hashing concurrency is capped at two.

Registration defaults to enabled locally after an active administrator has completed setup, and disabled when `NODE_ENV=production`. `REGISTRATION_ENABLED` explicitly overrides this. Accounts always receive the `user` role. Duplicate emails do not modify existing users. This version does not verify email ownership. Proof of work is an automation-cost control, not human verification; public release needs a review of distributed abuse and email delivery/verification.

`users` now includes `is_active` (default 1) and nullable `deleted_at`, added through compatible startup migrations. Authentication rejects inactive/deleted accounts. Administrator endpoints are `PATCH /api/users/:id` with `{ is_active }`, `DELETE /api/users/:id` for recoverable deletion, and `POST /api/users/:id/restore`. `GET /api/users?include_deleted=true` includes deleted accounts. Deactivation/deletion transactionally revoke authentication and recovery tokens. Restore leaves the account inactive. Self-deactivation and self-deletion are rejected on the server; existing user data and email uniqueness are preserved.

## Self-service password recovery

`server/recovery.ts` implements `POST /api/auth/forgot-password` with `{ email }` and `POST /api/auth/reset-password` with `{ token, password }`. `PasswordRecoveryView.tsx` renders request and completion forms. Reset links use a fragment (`#reset-password=...`), so the token is not sent in the initial page request. The UI removes the fragment from browser history after reading it and can open recovery even if an existing sign-in cookie is present.

Tokens are 32 random bytes, stored only as SHA-256 hashes in `password_reset_tokens`, expire in 30 minutes, and are rechecked/consumed transactionally after password hashing. Success changes the password, deletes all reset tokens for that user, and revokes every local sign-in. Inactive/deleted accounts cannot recover access through this flow. Administrator resets also revoke recovery tokens.

Local delivery writes mode-0600 plaintext messages inside a mode-0700 `.data/password-reset-mail` directory, overridable with `RESET_MAIL_DIR`. API responses never include the token and return the same request message for known and unknown emails. Persistent hourly quotas cap global/IP requests and per-email delivery; reset hashing concurrency is capped at two. Production recovery requests return 503 until a real email transport is implemented. No SMTP credentials are required for local tests, and no emails are sent externally.

The local development workflow includes no automatic deployment. VPS release remains a separate owner-requested step. Tests cover registration privilege enforcement, replay/expiry/spam/rate limits, token hashing and revocation, and account activation/deletion/restore.

## Feedback

Self-registration also transactionally inserts a monotonic event into `registration_events`. `registration_seen` stores each administrator's acknowledged event ID. `GET /api/users/registrations` returns the unseen count; administrator-only `POST /api/users/registrations/seen` accepts `{ through_id }` and advances that marker monotonically. User-list rows include their registration event ID so acknowledgment covers the fetched list without swallowing registrations that arrived after the fetch. Deleted users are excluded from the count. No events are backfilled for imported or manually added accounts. The Users badge refreshes every 30 seconds and on window focus; opening the list acknowledges its snapshot.

`FeedbackView.tsx` renders a composer for ordinary users and an inbox for administrators. Navigation appears immediately after Settings. The server stores messages in `feedback` with `id`, authenticated `user_id`, `subject`, `message`, `created_at`, and nullable `read_at`. Indexes support inbox ordering and per-user submission quotas. Sender names/emails are joined from `users` for administrator responses; client-supplied sender identity and read status are ignored on submission.

- `POST /api/feedback`: authenticated submission with `{ subject, message }`; trims values, requires nonblank text, limits lengths to 200/5,000 characters, and caps successful submissions at ten per account per rolling hour.
- `GET /api/feedback?page=1`: administrator-only inbox with 50 messages per page, total and unread counts, newest first with ID as a stable ordering tie-breaker.
- `GET /api/feedback/unread-count`: administrator-only lightweight unread total for the sidebar badge, polled every 30 seconds and on window focus. Inbox fetches also update the badge; request sequencing prevents an older poll from overwriting a newer inbox count.
- `PATCH /api/feedback/:id`: administrator-only `{ read: boolean }` update. Read status is shared across administrators.

The composer clears only after a successful save; errors preserve the draft while the page stays open. React renders feedback as plain text, preserving line breaks without interpreting HTML. Inbox fetches ignore late responses after navigation. Feedback remains associated with recoverably deleted users, whose database rows are retained. No external mail transport is used. Integration tests cover authorization, forged sender fields, validation, limits, pagination, read status, inactive accounts, and persistence.


## Manual break editing and ranked distribution

Session creation and `PATCH /api/sessions/:id` accept optional `break_seconds`: null for unknown or an integer from 0 to 604,800. Omission preserves existing values on update. Manual patches replace the total (allowing corrections downward); automatic `PUT /api/sessions/:id/break` checkpoints retain their monotonic maximum behavior. Both routes enforce account ownership. `src/lib/breakMinutes.ts` converts optional minute input to nullable integer seconds. History awaits save confirmation before closing an edit and retains the draft on failure.

`src/lib/distribution.ts` groups trimmed task/topic names case-insensitively and sorts total focus minutes in either direction, with a name tie-breaker. Dashboard renders every category as a horizontal bar row with its time and share of the filtered total. Bar lengths scale to the largest category, while percentage labels use the full selected total. A keyboard-focusable scrolling region handles large lists. Existing date/activity filters apply to these rows. Calendar date badges count only unfinished tasks and use a checkmark when all are complete.


`TimeInput.tsx` shares fixed-colon hour/minute controls between History editing and Insert Session. The separator is a separate non-editable element. Segments accept digits, advance from two-digit hours to minutes, pad single digits on blur, and support validated numeric or HH:mm paste. `src/lib/timeInput.ts` validates complete 24-hour values and calculates duration across midnight; incomplete input never produces NaN or saves a malformed time.


## Task achievement panel

`TaskAchievement.tsx` renders account task progress below the To-do calendar/list using the already fetched task array. `src/lib/taskAchievement.ts` builds one row per day of the displayed month and excludes adjacent-month calendar cells. Counts and percentages are recomputed after successful task mutations and month navigation; no new database schema or endpoint is required.

Planned/achieved summary totals include scheduled dates through today; future plans are shown separately. Achievement is the ratio of total completed due tasks to total due tasks, rounded to one decimal, with null for an empty denominator. The count chart shows future planned tasks but omits future achieved values; the percentage chart uses null for future days and days without a plan. Completed status is attributed to scheduled dates because the task schema does not retain completion timestamps/history. These are current-plan statistics, not an on-time completion audit. Loading/fetch failures do not present fabricated scores. Tests cover month boundaries, weighted percentages, task-status changes, future plans, empty plans, and leap years.


## Task ordering

`todos.sort_order` is added by an idempotent SQLite migration. Existing tasks retain creation order through the `created_at,id` tie-breaker. New tasks and tasks moved to another date append after the current maximum position. Editing and completion preserve the position.

`PUT /api/todos/order` accepts `{date, ids}` for the authenticated account. It validates the exact set of tasks for that day, rejects duplicates and stale/foreign/cross-date IDs, then updates all positions atomically. The client uses Motion Reorder with grip-only pointer dragging, touch support, and Up/Down keys; optimistic changes roll back on save failure. Integration tests cover persistence, migration, ownership, validation, and preserving order through task mutations.


## Running dark mode, optional sub-tasks, and feedback replies

Running dark mode now covers the document background, navigation selection, header, and account dropdown. The workspace establishes a formatting context so the header's top margin cannot collapse outside the themed app. Native controls and scrollbars follow the dark color scheme. Focus start/resume validation requires only the main task; sub-task is optional and may remain an empty string in session storage.

`feedback_replies` stores each follow-up with its parent feedback ID, sender ID, sender-role snapshot, message, and timestamp. Existing `admin_id` columns are renamed to `sender_id`; historical replies receive the administrator role without losing their content. The migration is idempotent. `GET /api/feedback/mine` paginates the current user's own submissions. `GET /api/feedback/:id/replies` permits only administrators and the original sender. `POST /api/feedback/:id/replies` permits administrators and the original sender, validates nonempty text up to 5,000 characters, and limits senders to 60 follow-up messages per hour. Sender/recipient IDs supplied in the body are ignored; the parent feedback determines the recipient. Existing feedback inbox and read-state APIs retain their administrator-only permissions.

The Feedback page shows users their own feedback history beneath the composer; both roles can select a thread and continue chatting through a per-thread draft and message composer. New feedback explicitly starts a separate conversation. Open threads poll every five seconds and on window focus; background updates do not clear drafts. Follow-ups retain the same feedback ID. User messages and administrator replies atomically update the shared unread/read state; history is ranked by latest activity. Message order uses creation time and insertion order to avoid random UUID tie-breaking. React renders message text without interpreting HTML. Failed saves preserve drafts, and cancelled/stale fetches do not overwrite the selected thread. API tests cover authentication, account isolation, input validation, forged ownership/roles, origin rejection, inactive accounts, conversation separation, read-state changes, reply persistence, and preservation of historical replies during migration.
