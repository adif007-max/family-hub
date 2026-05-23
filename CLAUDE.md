@AGENTS.md

# Family Hub — Claude Code Working Notes

## Project
Next.js 16 family task manager for עדי ותהלה (family `fink`).
- DB + Auth: Supabase (project: `pwumuvcuvuasbxbawhnc`)
- Hosting: Vercel (`family-hub-five-rouge.vercel.app`)
- AI inbox sort: Claude Haiku via `/api/sort-inbox`

## Architecture
- `src/lib/supabase.ts` — singleton browser client, PKCE flow, persists session in localStorage
- `src/lib/supabase-admin.ts` — **server-only** client using service-role key (Telegram webhook, never import in client code)
- `src/lib/useAuth.ts` — auth state + family_id lookup; exposes `signIn` (magic link), `signInWithGoogle`, `signOut`
- `src/lib/useTasks.ts` — realtime tasks hook (subscribe + CRUD + one-time localStorage migration)
- `src/lib/useMembers.ts` — realtime family_members hook (CRUD + archive)
- `src/lib/sort-inbox.ts` — shared sort logic (Claude Haiku); used by web API + Telegram webhook
- `src/app/page.tsx` — gates on auth, renders 2 tabs (Inbox primary, Tasks)
- `src/components/QuickInbox.tsx` — calls `/api/sort-inbox`; review screen with category/priority/assignee/children edit
- `src/components/TaskBoard.tsx` — view toggle (list/calendar) + filters + load balance (single line)
- `src/components/CalendarView.tsx` — monthly Hebrew/Gregorian calendar with holidays (uses `@hebcal/core`)
- `src/components/TaskItem.tsx` — chips: priority/due/recur/children + GCal button; no per-card background, just dividers
- `src/components/TaskModal.tsx` — edit ALL task fields (text/category/assignee/priority/due/recur/children/note)
- `src/components/InfoTab.tsx` — Info dashboard (vehicles + subscriptions + schedules)
- `src/components/FactModal.tsx` — generic editor for vehicles/subscriptions/schedules
- `src/lib/useFacts.ts` — `useVehicles`, `useSubscriptions`, `useSchedules` hooks (realtime CRUD)
- `src/lib/ensureReminders.ts` — idempotent reminder seeding (runs once per page load; checks expiring dates < 30 days, creates linked tasks)

## Design language (post-round-N polish)
- Background: `#0a0a0f` (near-black, was `#0f0f1a`)
- Borders over fills: `border` everywhere instead of `bg-zinc-800`
- Typography hierarchy: section labels `text-[10px] uppercase tracking-widest text-zinc-500`; titles `text-base font-normal text-zinc-100`; meta `text-xs text-zinc-400`
- No `font-bold`; only `font-normal` (default) and occasional `font-medium`
- Tabs: text + underline only (no chip backgrounds)
- Load balance: single horizontal line of dots + counts (no card, no bars)
- Filter chips: only render when count > 0
- Task items: no per-card background, divider lines only; urgent shows a thin red rail on the right edge
- Modals: dark `#0a0a0f` + subtle border + `rounded-xl` + simple ✕ close in corner
- `src/app/api/sort-inbox/route.ts` — receives { items, familyId }, calls `sortInbox()`
- `src/app/api/telegram/webhook/route.ts` — Telegram bot; secret-token verified; commands + free-text sort
- `src/app/settings/family/page.tsx` — edit/add/archive children
- `supabase-schema.sql` — base schema (RLS, profiles, allowed_emails)
- `supabase-migrations/002_telegram_and_members.sql` — telegram_users, family_members, tasks.related_member_ids

## Data model decisions
- `family_id` is `text` (literal `'fink'`), not uuid → matches existing schema
- `assignee` ('adi'/'tehila'/'both') is reused for the "who does it" feature; no new `assigned_to` column
- `tasks.related_member_ids` is `uuid[]` referencing `family_members.id` — many-to-many via array (no junction table; family is small)
- `telegram_users` has no RLS policy on purpose — only service role can read

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

## Future work (intentionally deferred)
Decided not to build in this round; revisit only if real usage demands them.

- **Full PWA offline mode** — Service Worker + IndexedDB + sync queue + conflict resolution. ~6-10h. Defer until network reliability becomes a real pain point.
- **Google Calendar dual-binding** — currently one-way (we create events). If drift becomes a problem in practice (Tahel moves an event but the task stays), build OAuth + webhook + reconciliation. Until then, app = source of truth, calendar = convenience view.
- **Realtime payload-based cache updates** — replace `refetch()` with payload-driven `setTasks(prev => merge(prev, payload))`. Correct optimization in theory, irrelevant at 2-user scale.
- **Snooze / postpone task** — "do tomorrow" / "next week".
- **History view** — completed last week / month.
- **Per-child dashboard** — currently children are a filter dimension; not a primary view.
- **Multi-family support** — `family_id` is text 'fink' literal; refactor needed for multiple families.

## Environment variables (Vercel)
Client-exposed:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key from Supabase)

Server-only:
- `ANTHROPIC_API_KEY` — Claude Haiku for inbox sort
- `SUPABASE_SERVICE_ROLE_KEY` — required for Telegram webhook to bypass RLS
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_WEBHOOK_SECRET` — random 32-byte hex, verified on every webhook request
