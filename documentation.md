# Study Timer — Setup and User Documentation

Study Timer is a local study workspace with focus cycles, break tracking, statistics, session history, a dated to-do calendar, and administrator-managed accounts. This guide describes the current local SQLite version. See [implementation.md](implementation.md) for architecture, schema, and API details.

## Install and start

Requirements: Node.js 22.13 or newer, npm, and a local copy of this repository. Run commands from the `study_timer` directory containing `package.json`.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Leave the terminal running while using the app. Stop it with Ctrl+C.

The server listens only on this computer's loopback interface. SQLite stores the data locally; no cloud database credentials are required for everyday use. Installing packages requires network access, and audio alerts load from an external host.

### Optional configuration

Copy `.env.example` to `.env` to override the defaults:

```dotenv
PORT=3000
DATABASE_PATH=.data/study-timer.sqlite
```

Restart the server after changing these values. Run the server from the repository root so relative database, setup-code, and production asset paths resolve consistently. Changing `DATABASE_PATH` selects a different database; it does not copy existing accounts or records.

### Existing installation versus a fresh database

The current installation already has migrated accounts and study history. Starting the server opens that database and applies compatible schema additions automatically.

A fresh empty database has no account-creation wizard for its first administrator. The available bootstrap process imports the private snapshot at `.data/supabase-import.json`:

```bash
npm run db:import
npm run dev
```

The import requires an empty users table and the expected administrator account in the snapshot. It preserves original IDs and runs transactionally. Once recorded as completed, repeating the command leaves local changes intact. A custom snapshot path can be supplied with `npm run db:import -- /path/to/snapshot.json`.

The private snapshot is not included in Git. A new clone without an existing database or that snapshot needs an administrator bootstrap implementation or a privately supplied backup/snapshot before users can sign in. The historical import contained 5 accounts, 220 sessions, and 5 settings records; these counts are not ongoing totals.

## Sign in and manage accounts

### First administrator setup

For an imported administrator without a local password, the sign-in page displays setup fields. The migrated administrator is `snlynnoo@gmail.com`.

1. Read the one-time code from `.data/setup-code.txt` on the server computer.
2. Enter the code in the setup form.
3. Choose a password of 10–128 characters and submit.

The server deletes the code after successful setup. The setup code authorizes initial password creation; it is not a normal sign-in password. If setup is already complete, sign in using the administrator's local email and password.

### Add users or reset passwords

Administrators can open **Users** in the sidebar:

- To add an account, enter its name, email, and initial password, then select **Add user**.
- To reset a password, select **Reset password** for that account and enter a replacement password.

Resetting a password signs that user out of all local sessions. Resetting your own administrator password also signs you out. Imported users need a local password set by an administrator because passwords were not imported. New accounts created through this page have the ordinary user role.

Users see their own study sessions, tasks, and settings. Ordinary users cannot open administrator account management. Use the sign-out icon beside your account to end the current sign-in; sign-in cookies otherwise expire after seven days.

### Register your own account

Administrators see a numeric badge on **Users** for unseen self-registrations. Opening Users loads the latest account list and acknowledges the registrations in that list; the selected-page orange dot then returns. Clicking Users again reloads it. Counts refresh on sign-in, when the window regains focus, and every 30 seconds. Seen status is stored per administrator in SQLite. Existing imported accounts and accounts created manually by an administrator do not count as new self-registrations.

After administrator setup is complete, select the **Sign Up** button below **Sign In** on the login page. Enter your name, email, password, and confirmation. Select **Verify** to run the browser security check, then **Create account**. Successful registration signs you in as an ordinary user; submitted administrator roles are ignored. Use **Back to Sign In** to return to the login form.

Local registration opens by default. `REGISTRATION_ENABLED=false` disables it. Production defaults to disabled; `REGISTRATION_ENABLED=true` explicitly enables it. No VPS deployment is part of local feature development; deploy only when explicitly requested by the owner.

Anti-abuse controls combine browser proof of work, a hidden spam trap, single-use challenges valid for ten minutes, and SQLite-backed hourly limits. Limits are 30 challenges and 10 registration submissions per IP, with global limits of 300 challenges and 100 submissions per hour. Failed submissions count, and restarting the app does not clear limits. Only two registration password hashes run concurrently. Proof of work increases automation cost; it does not prove a person is human or stop distributed attacks. Email ownership is not verified in this local version. Review public anti-bot and email-verification controls before enabling public registration.

### Recover your password

Select **Forgot password?**, enter your email, and request a link. The response is the same for existing and unknown accounts. For local testing, messages are written to the private `.data/password-reset-mail/` directory instead of being emailed. Open the newest message for your address and follow its link in the same local app. `RESET_MAIL_DIR` can select another private local folder.

Choose and confirm a new password. Links expire after 30 minutes, can be used once, and revoke all existing sign-ins after success. Requesting a new link invalidates older links. Tokens are stored as hashes in SQLite and are never returned by the public API. Requests are limited to 20 per IP and 100 globally per hour; delivery is capped at three per email per hour. Mailbox files contain sensitive links; do not publish or share the folder, and remove old test messages when no longer needed.

Email delivery is not configured yet. Recovery requests fail closed in production instead of exposing tokens or pretending mail was sent. Configure real email delivery before VPS release. A fresh clone without the private migrated database still needs administrator bootstrap as described above.

### Activate, delete, or restore users

In **Users**, the **Active** checkbox controls sign-in. Deactivation revokes current sign-ins and reset links immediately. Re-activation permits a new sign-in; it does not revive old sessions.

**Delete** requires typing the account's email address. Deleted accounts lose access and disappear from the normal list. Their data is retained for recovery: select **Show deleted accounts**, then **Restore account**. Restored accounts remain inactive until you enable **Active**. Their email remains reserved while deleted. Administrators cannot deactivate or delete their own account. Administrator password resets remain available.

## Use the timer

1. Open **Timer**.
2. Enter the **Main Task / Topic** and **Sub-Task / Topic** for your session.
3. Select **Work**, then **Start focus**.
4. Pause/resume as needed. Reset restarts the selected interval; an unfinished focus is not added to completed history.

Both Main Task / Topic and Sub-Task / Topic are required before starting or resuming focus. If either is blank (including spaces only), the timer stays paused and highlights the first missing field. Enter the details, then select **Start focus** or **Resume session** again. Breaks do not require task details.

Defaults are 25 minutes of work, a 5-minute short break, and a 15-minute long break. Saved account settings may differ.

After a focus finishes, the app records it and selects a paused break. Press **Start break** when ready. The cycle indicator progresses from `1 / 4` to `4 / 4`. After the fourth completed focus, the app displays **You need a long break now.** Selecting **Okay** switches to Long Break; start it when ready. Completing that long break resets the cycle.

The timer preserves its progress per account in this browser. Paused time and task metadata survive a reload. A running timer accounts for elapsed time when the page returns, but the app does not automatically run future intervals while closed. Keep one timer tab active per account; tabs do not coordinate concurrent timers.

### Understand focus and break records

Recent sessions and History show focus duration beside actual active break minutes. Paused break time is excluded. Partial breaks are saved when paused, reset, or switched away, and link to the preceding completed focus session.

`Break —` means the original break time is unknown, as with historical imports or manually inserted sessions. `Break 0 min` means no active break time has been recorded for a timer-created session. Very short nonzero breaks may display `<0.1 min`.

Pending timer saves retry automatically if the API is temporarily unavailable. Keep the browser's site data until pending saves finish: clearing it removes unsaved timer events and progress. Successfully saved records remain in SQLite.

## View statistics and history

**Timer** shows today's focus time, today's completed session count, all-time focus, and recent sessions. **Stats** provides charts and aggregate study information.

Open **History** to review records:

- **Insert Session** adds a manual record with date, task/topic, and 24-hour start/end times. Duration is calculated from those times; an end earlier than the start is treated as crossing midnight.
- The pencil edits a record; the remove action deletes it.
- **Download CSV** opens date-range selection. Choose the inclusive range, then generate the file.

The CSV contains Date, Start time, End time, Main task, Topic, Duration (min), and Break (min). Unknown break duration exports as an empty field. CSV exports contain study records only; they are not full backups of accounts, tasks, or settings.

Both **Insert Session** and the History edit form include **Break time (minutes)**. Decimal minutes are accepted and stored to the nearest second. Enter `0` for no break, or leave the field blank for unknown. Manual edits can correct a break duration upward or downward; saving other fields keeps the existing break duration. Failed edits stay open so you can retry.

Start/end time controls keep the colon visible between separate hour/minute inputs, even when both are cleared. Type digits only; two hour digits advance to minutes. You can also paste `0930`, `930`, or `09:30`. Single digits are padded on leaving a segment, and saving requires a complete valid 24-hour time. Duration updates automatically, including sessions crossing midnight.

Stats uses a horizontal distribution chart with a separate row for every category, showing focus time and its percentage of the selected total. Use **Main**/**Sub** to choose the grouping; the category-count KPI uses the same caption. The sort icon immediately before these buttons toggles ascending/descending focus time. Long category names wrap, and large lists scroll rather than hiding categories. Time-range and activity-chart filters also apply to the distribution.

## Plan tasks in To-do

Open **To-do**, select a date, and use **Add task**. Tasks support a title, notes, a date, and completion status. Edit to update details or move a task to another date. The remove action asks for confirmation.

Dates with unfinished tasks show only the number still to do below the date; completing a task reduces that number. Dates whose tasks are all complete show an olive checkmark without a count. Red indicators mean no tasks have been completed on that date; green indicators mean at least one has been completed, while the number still shows only the remaining tasks. Use the month arrows to browse and **Today** to return to the current date. Tasks are saved per account.

Drag the grip on the left of a task up or down to change its position within that date. You can also focus the grip and press the Up/Down arrow keys. The order is saved to your account and survives reloads; newly added tasks and tasks moved to another date appear at the end.

## Track task achievement

The **Task achievement** panel below the To-do calendar follows the displayed month. **Plan vs achieved** shows daily planned and currently completed task counts. **Achievement %** switches to daily completion percentages. Planned counts use muted teal (#779FA1), and achieved counts and percentages use Tech Blue (#3D62A4). Select the information button in the top-right corner for the calculation details. The cards summarize tasks due through today in that month: planned, achieved, and the overall rate (`completed ÷ planned × 100`). Future scheduled tasks are listed separately and do not lower this rate. Historical months include the whole month; future-only plans show no achievement score yet.

Completing/reopening, adding, editing, moving, or removing a task updates the panel after a successful save. Each task has equal weight; the overall rate is based on task totals, not the average of daily percentages. Days without planned tasks have no percentage, rather than counting as failures.

Completed tasks are grouped by their scheduled date. This reflects the current plan and completion state; it does not claim when a task was actually completed or whether it was finished on time. Deleting or rescheduling a task changes the plan used in these calculations.

## Send feedback and read the administrator inbox

Open **Feedback** directly below **Settings**. Ordinary users can enter a subject (up to 200 characters) and a message (up to 5,000 characters), then select **Send feedback**. A confirmation appears after the message is saved. Up to ten messages can be submitted per account in a rolling hour.

Administrators see an **Inbox** on the same page. Select a message to read its full text, sender name/email, and submission date/time. Use **Mark read** or **Mark unread** to update its status, **Refresh** for new messages, and the page controls to browse older messages. Read status is shared between administrators. Ordinary users cannot access the inbox or other users' feedback, including through the API.

Messages are stored in the server's SQLite database and included in database backups. They appear directly in the app; this feature does not send email notifications. Development remains local until deployment is explicitly requested.

Administrators also see the unread message count beside **Feedback** in the sidebar. It refreshes on sign-in, when the window regains focus, and every 30 seconds. Opening/refreshing the inbox and marking messages read or unread updates the badge. When no unread messages remain, the selected Feedback tab shows its normal orange dot. Ordinary users do not see an inbox count.

## Adjust appearance and alerts

**Settings**, directly below Users for administrators, opens as a workspace page and saves changes automatically. You can configure work/short/long durations, dark appearance while the timer runs, mode colors, sound enablement, alert sound, repeat count, and volume. Duration controls accept 1–1440 minutes. Changing a duration does not resize a session already started.

Use the header's **Text size** controls to increase/decrease text size or **Reset** to 100%. This browser preference applies to sign-in and workspace views. The available base size is 14–22 pixels, with 16 pixels as the default.

The header clock uses local time in 24-hour `HH:mm` format. The Guide explains the focus cycle using your configured durations. Sounds require the external audio asset to load and browser playback to be allowed; desktop notifications require previously granted browser permission.

## Data locations and backups

The default `.data` directory contains private local data:

- `study-timer.sqlite`: users, password hashes, study sessions, tasks, settings, and sign-in sessions.
- `study-timer.sqlite-wal` and `study-timer.sqlite-shm`: SQLite working files when present.
- `setup-code.txt`: temporary administrator setup code, only while setup is pending.
- `supabase-import.json`: private historical import snapshot, if supplied.

These files are ignored by Git. The development server blocks `.data` paths. Keep database copies and snapshots private.

### Back up

1. Pause any timer and allow pending saves to finish.
2. Stop the server with Ctrl+C.
3. Copy the entire `.data` directory to a private backup location, including any SQLite working files still present. If using `DATABASE_PATH`, back up that database and its matching working files as well.
4. Restart the app.

Browser timer snapshots and the text-size preference are separate from the database backup. For study records, complete their saves before backing up.

### Restore

1. Stop the app.
2. Preserve a separate copy of the current data before replacing anything.
3. Restore the backed-up directory, or the custom database and matching working files, as one consistent set. Do not mix working files from another database copy.
4. Confirm `.env` points to the restored database and start the server.

A restored snapshot contains the accounts and password hashes present at backup time. Avoid replaying stale unsaved browser timer events against an older restored database; preserve any needed current work before clearing that browser's site data.

## Run a production build locally

```bash
npm run lint
npm test
npm run build
NODE_ENV=production npm run dev
```

The last command starts Express and serves the built `dist` assets together with the database API. Stop an existing server on the same port before starting it. `npm run preview` serves only a frontend preview and is insufficient for authentication and database operations.

The older [README_DEPLOY.md](README_DEPLOY.md) covers a previous Firebase/Vercel implementation. Its cloud environment variables and static deployment instructions do not configure the current local database app. Hosting this version elsewhere requires a deployment design for the Node server, persistent storage, authentication transport, and access controls.

## Troubleshooting

- **Port already in use:** stop the other app/server or set another `PORT`, restart, and open that port in the browser.
- **Incorrect email/password after migration:** ask the administrator to set a local password through Users. The old service password is not imported.
- **Setup code missing:** it is created only for an existing administrator without a password. Completed setup removes it. An empty new database has no administrator to set up.
- **Too many sign-in attempts:** wait for the 15-minute attempt window to expire.
- **No users/history after changing paths:** check `DATABASE_PATH` and the directory from which the server was launched. A different path opens a separate database.
- **Changes are not saving:** keep the page open, confirm the local server is running, and check the displayed error. Timer events retry; verify other failed edits after restoring connectivity.
- **Audio does not play:** confirm sound is enabled, increase volume, use a preview control, and check network access/browser audio permissions.
- **API errors under preview/static hosting:** use the Express server command above so `/api` is available.

For development conventions and verification coverage, see [implementation.md](implementation.md) and [AGENTS.md](AGENTS.md).
