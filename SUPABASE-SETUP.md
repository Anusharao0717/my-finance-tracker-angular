# Supabase setup for Angular website
1. Create a project at https://supabase.com.
2. Open SQL Editor and run `supabase-schema.sql`.
3. Copy the Project URL and publishable/anon key from Project Settings → API.
4. Put them into `src/environments/environment.ts` as `supabaseUrl` and `supabaseAnonKey`.
5. Configure Authentication → URL Configuration with your website URL (for local development, add `http://localhost:4200`).
6. Use `npm install` and `npm start`. Build with `npm run build`.

The browser key is a publishable/anon key and is intended for browser use with RLS. Never put the database password or service-role key in the Angular app.


Finance and To-Do records are stored in the user's existing `user_finance_data.app_data` JSONB record, protected by the same per-user RLS policies. Each account's tasks are private to that account. Browser reminders require notification permission and the app to remain open; background push notifications require additional server-side push infrastructure.
