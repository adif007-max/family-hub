@AGENTS.md

# Family Hub — Claude Code Working Notes

## Project
Next.js 16 family task manager for עדי ותהלה (family `fink`).
- DB + Auth: Supabase (project: `pwumuvcuvuasbxbawhnc`)
- Hosting: Vercel (`family-hub-five-rouge.vercel.app`)
- AI inbox sort: Claude Haiku via `/api/sort-inbox`

## Architecture
- `src/lib/supabase.ts` — singleton client, PKCE flow, persists session in localStorage
- `src/lib/useAuth.ts` — auth state + family_id lookup; exposes `signIn` (magic link), `signInWithGoogle`, `signOut`
- `src/lib/useTasks.ts` — realtime tasks hook (subscribe + CRUD + one-time localStorage migration)
- `src/app/page.tsx` — gates on auth, renders 2 tabs (Inbox primary, Tasks)
- `src/components/QuickInbox.tsx` — calls `/api/sort-inbox` (Claude Haiku) for categorization
- `src/components/TaskBoard.tsx` — categories + time filters (today/week/overdue/urgent) + load balance
- `supabase-schema.sql` — full schema with RLS, trigger-based profile creation, allowed_emails allowlist

## Auth model
- Allowlist in `allowed_emails` (currently: adif007@gmail.com, tehila1000@gmail.com → family_id `fink`)
- On sign-up trigger creates a profile row IF email is in allowlist; otherwise user sees "not allowed" screen
- RLS on `tasks` filters by `family_id` from caller's profile
- Both Google OAuth and Magic Link share the same trigger/RLS flow

## Working style (autonomous mode)
- Work autonomously. Don't ask for confirmation on each step.
- Make decisions yourself when they're reversible.
- Report at the end, not at every checkpoint.
- Don't present 3 options for every tiny decision — pick one with judgment and note it in the summary.
- Only stop to ask when:
  - You need credentials the user must provide (Client ID/Secret, URLs)
  - There's a truly irreversible decision with major implications
  - You're blocked after 2-3 reasonable attempts

## Common commands
```bash
# build locally
cd C:/Users/adif0/family-hub && npx next build

# deploy: just push to main, Vercel auto-deploys
git add -A && git commit -m "..." && git push
```

## Environment variables (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key from Supabase)
- `ANTHROPIC_API_KEY` (for /api/sort-inbox)
