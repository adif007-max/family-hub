// Vercel cron endpoint — Morning Digest
//
// Scheduled TWICE to handle Israel's seasonal UTC offset:
//   "30 4 * * *" — 07:30 IDT (summer, UTC+3, ~late Mar–late Oct)
//   "30 5 * * *" — 07:30 IST (winter, UTC+2, ~late Oct–late Mar)
//
// Code-side guard: only runs when Asia/Jerusalem local hour is 07–08.
// cron_digest_log (PK: family_id + log_date) ensures exactly-once delivery per day.
//
// Auth: Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildDailyDigest, israelToday } from '@/lib/digest'
import { formatDigest } from '@/lib/telegramFormatters'

const TG_API = (m: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`

async function sendTelegram(chatId: number, text: string) {
  await fetch(TG_API('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
}

/** Returns current hour (0-23) in Asia/Jerusalem. */
function israelHour(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10
  )
}

export async function GET(req: NextRequest) {
  // Auth
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Time-window guard — only run during 07:00–08:59 Asia/Jerusalem.
  // If the cron fires outside this window (wrong season), skip silently.
  const hour = israelHour()
  if (hour < 7 || hour >= 9) {
    return NextResponse.json({ ok: true, skipped: `outside window (hour=${hour} IL)` })
  }

  const today = israelToday()

  // ── Periodic cleanup (non-fatal) ────────────────────────────────────────────

  const digestCutoff = new Date(today + 'T00:00:00')
  digestCutoff.setDate(digestCutoff.getDate() - 14)
  await supabaseAdmin
    .from('cron_digest_log')
    .delete()
    .lt('log_date', digestCutoff.toISOString().split('T')[0])
    .then(() => {}, () => {})

  const pendingCutoff = new Date()
  pendingCutoff.setMinutes(pendingCutoff.getMinutes() - 30)
  await supabaseAdmin
    .from('pending_bot_updates')
    .delete()
    .lt('created_at', pendingCutoff.toISOString())
    .then(() => {}, () => {})

  // ── Send digests ────────────────────────────────────────────────────────────

  const { data: tgUsers } = await supabaseAdmin
    .from('telegram_users')
    .select('chat_id, family_id')

  if (!tgUsers?.length) return NextResponse.json({ ok: true, sent: 0 })

  const familyCache = new Map<string, string>()  // family_id → formatted message
  let sent = 0

  for (const u of tgUsers) {
    const fid    = u.family_id as string
    const chatId = u.chat_id as number

    // Exactly-once per family per day
    const { data: already } = await supabaseAdmin
      .from('cron_digest_log')
      .select('sent_at')
      .eq('family_id', fid)
      .eq('log_date', today)
      .maybeSingle()

    if (already) continue  // already sent today (possibly by the other cron tick)

    let message = familyCache.get(fid)
    if (!message) {
      try {
        const digest = await buildDailyDigest(fid)
        message = formatDigest(digest)
        familyCache.set(fid, message)
        // Mark sent BEFORE delivering — idempotency on retry
        await supabaseAdmin.from('cron_digest_log').upsert({
          family_id: fid, log_date: today, sent_at: new Date().toISOString(),
        })
      } catch (e) {
        console.error('[morning-digest] build failed for', fid, e)
        continue
      }
    }

    await sendTelegram(chatId, message)
    sent++
  }

  return NextResponse.json({ ok: true, sent, date: today, hour })
}
