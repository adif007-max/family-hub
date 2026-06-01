// Vercel cron endpoint — Morning Digest
// Runs daily at 07:30 Asia/Jerusalem (05:30 UTC in summer, 06:30 UTC in winter).
// vercel.json schedule: "30 5 * * *" (05:30 UTC, adjusts for IDT/IST)
//
// Auth: Bearer CRON_SECRET header (set as Vercel env var).
// Idempotent: won't send twice within 60 minutes (checked via digest_sent_at in DB).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildDailyDigest, israelToday } from '@/lib/digest'
import { formatDigest } from '@/lib/telegramFormatters'

const TG_API = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`

async function sendTelegram(chatId: number, text: string) {
  await fetch(TG_API('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const today = israelToday()

  // Periodic cleanup — runs on every morning digest invocation
  // cron_digest_log: keep 14 days
  const digestCutoff = new Date(today + 'T00:00:00')
  digestCutoff.setDate(digestCutoff.getDate() - 14)
  await supabaseAdmin
    .from('cron_digest_log')
    .delete()
    .lt('log_date', digestCutoff.toISOString().split('T')[0])
    .then(() => {}, () => {}) // non-fatal

  // pending_bot_updates: delete rows older than 30 minutes (belt+suspenders; code expires at 5min)
  const pendingCutoff = new Date()
  pendingCutoff.setMinutes(pendingCutoff.getMinutes() - 30)
  await supabaseAdmin
    .from('pending_bot_updates')
    .delete()
    .lt('created_at', pendingCutoff.toISOString())
    .then(() => {}, () => {}) // non-fatal

  // Get all telegram users
  const { data: tgUsers } = await supabaseAdmin
    .from('telegram_users')
    .select('chat_id, family_id')

  if (!tgUsers?.length) return NextResponse.json({ ok: true, sent: 0 })

  // Deduplicate by family_id — build digest once per family
  const familiesSeen = new Map<string, string>()  // family_id → message
  const results: { chat_id: number; ok: boolean }[] = []

  for (const u of tgUsers) {
    const fid = u.family_id as string
    const chatId = u.chat_id as number

    // Check idempotency: cron_digest_log table (lightweight — just a text flag)
    const { data: existing } = await supabaseAdmin
      .from('cron_digest_log')
      .select('sent_at')
      .eq('family_id', fid)
      .eq('log_date', today)
      .maybeSingle()

    if (existing) {
      // Already sent today — skip
      results.push({ chat_id: chatId, ok: true })
      continue
    }

    let message = familiesSeen.get(fid)
    if (!message) {
      try {
        const digest = await buildDailyDigest(fid)
        message = formatDigest(digest)
        familiesSeen.set(fid, message)
        // Mark as sent
        await supabaseAdmin.from('cron_digest_log').upsert({
          family_id: fid, log_date: today, sent_at: new Date().toISOString(),
        })
      } catch (e) {
        console.error('digest build failed for', fid, e)
        continue
      }
    }

    await sendTelegram(chatId, message)
    results.push({ chat_id: chatId, ok: true })
  }

  return NextResponse.json({ ok: true, sent: results.length, date: today })
}
