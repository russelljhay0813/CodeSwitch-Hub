# Gather

Gather is a Supabase-backed React/Vite social and learning application. It does not seed or display demo records. Without Supabase credentials the app shows a setup guide; with credentials it requires Supabase Auth and reads content from the configured database.

## Run locally

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite.

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the project's URL and publishable key. If the project does not have one yet, create it in **Project Settings → API Keys**. Never put the secret/service-role key in the browser app.
4. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor.
5. Configure Supabase Auth email confirmation, password reset redirect URLs, and the local/deployed site URLs.
6. Restart Vite and create an account.

The migration creates the relational tables, indexes, profile and community-owner triggers, storage buckets, and row-level security policies. Do not add seed or sample rows if you want to keep the project free of non-user content.

If the schema is already installed and the app reports `permission denied for table profiles`, run [`supabase/grant_authenticated.sql`](./supabase/grant_authenticated.sql) in the SQL Editor. It grants the signed-in role table access while the existing RLS policies continue to restrict which rows and operations are allowed. Do not rerun the full schema on an existing database.

## Database-backed features

- Supabase Auth sign-up, sign-in, sign-out, password reset, and password update.
- Profile reads/updates and avatar uploads to Supabase Storage.
- Post feed, image uploads, likes, comments, edits, and deletes.
- Video listing, Storage uploads/playback, likes, and comments.
- Published course discovery, enrollment, lesson navigation, and completion tracking.
- Community discovery, creation, membership, and discussion posts.
- Notification reads and report review, subject to RLS and the signed-in user's role.
- Dashboard counts and admin overview counts queried from Supabase.

The app surfaces query and permission errors rather than substituting local or mock content. Empty database tables render empty states. Admin access is determined by the `profiles.role` value; assign that role securely from the Supabase SQL Editor, not from client-side code.
