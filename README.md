# My Finance Tracker — Angular responsive website

An Angular standalone application for finance tracking across desktop, laptops, phones, iPads and tablets. Includes responsive layout, month navigation, payment and income CRUD, paid/received checkboxes, due dates, a daily To-Do planner with categories/priorities/completion history, browser reminders, local storage, and optional Supabase email/password authentication with per-user cloud sync.

## Run locally
1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Set `supabaseUrl` and `supabaseAnonKey` in `src/environments/environment.ts` (leave blank to run local-only).
4. Run `npm start`, then open the localhost URL shown in the terminal.
5. Build for deployment with `npm run build`; upload `dist/my-finance-tracker/browser` to a static web host.

## Daily To-Do planner
- Add, edit, and delete tasks with descriptions, categories, priority, and due date/time.
- Filter Today, Pending, Completed, or All tasks.
- Enable browser notifications from the To-Do section. Reminders are checked while the app is open and notifications are allowed; notifications when the browser/app is fully closed require a push-notification service and are not included in this version.
- Each signed-in account has its own private finance and task data. Separate accounts do not automatically share a common family task list.

## Enable multi-user sync
1. Create a Supabase project.
2. Run `supabase-schema.sql` in Supabase SQL Editor.
3. Copy the project URL and publishable/anon key into `src/environments/environment.ts`.
4. In Supabase Authentication settings, configure allowed site URLs and email confirmation as desired.
5. Never place a service-role key in browser code. RLS is required and is enabled by the supplied SQL.

## Notes
- When no Supabase settings are present, the website works in local-only mode.
- This Angular website is a separate web app project, not a conversion of the Android APK itself. The existing Android project can continue to be built separately.
- Local data on one browser/device is not automatically merged into the cloud. Sign in and follow your data migration procedure carefully before using multiple devices.


## Validation notes

- This project uses Angular 19 and TypeScript 5.7; use Node.js 20.19+ or 22.12+.
- Run `npm install` and `npm run build` before deployment.
- Cloud accounts require Supabase URL/key configuration and the SQL schema in `supabase-schema.sql`. The table uses row-level security so authenticated users can access only their own row.
- Task notifications are browser notifications checked while the app is open. Reliable alerts when the browser/app is closed need a push-notification service and service-worker/server setup; this project does not claim background push notifications.
- Task dates use the device's local calendar date for the Today view.

## Productivity and reporting additions

This build also includes task search, category filtering, overdue filtering, recurring daily/weekly/monthly tasks, tags, subtasks, task activity history, task CSV export, finance CSV export, monthly budget and savings-goal fields, task completion statistics, and responsive list/board-style task layouts.

### Important implementation notes
- Browser task notifications require notification permission and the app to remain open. Notifications while the app is closed need a server-side push service and service worker integration.
- Supabase currently stores each account's app data in a private JSON record protected by RLS. It provides separate user accounts and sync, but **not shared family workspaces or task assignment permissions between different accounts** yet; those require a dedicated workspace/membership data model and UI.
- The calendar control currently changes the task presentation style; it is not a full month-grid calendar.
- Before production use, configure Supabase, run the SQL schema, and run the production build plus automated tests in an environment that can download npm dependencies.
