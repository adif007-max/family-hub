// Vercel cron endpoint — Weekly Summary
// Runs every Friday at 12:00 Asia/Jerusalem (10:00 UTC summer, 11:00 UTC winter).
// vercel.json schedule: "0 10 * * 5"
//
// Auth: Bearer CRON_SECRET header.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildWeekSummary } from '@/lib/weekSummary'
import { formatWeekSummary } from '@/lib/telegramFormatters'
import { israelToday } from '@/lib/digest'

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
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const today = israelToday()

  const { data: tgUsers } = await supabaseAdmin
    .from('telegram_users')
    .select('chat_id, family_id')

  if (!tgUsers?.length) return NextResponse.json({ ok: true, sent: 0 })

  const familiesSeen = new Map<string, string>()

  for (const u of tgUsers) {
    const fid = u.family_id as string
    const chatId = u.chat_id as number

    let message = familiesSeen.get(fid)
    if (!message) {
      const summary = await buildWeekSummary(fid)
      message = formatWeekSummary(summary)
      familiesSeen.set(fid, message)
    }

    await sendTelegram(chatId, message)
  }

  return NextResponse.json({ ok: true, date: today })
}
