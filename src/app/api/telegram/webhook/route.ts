import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sortInbox } from '@/lib/sort-inbox'
import { processBotMessage, BotAction } from '@/lib/bot-intent'

const CONFIRM_RE = /^(כן|אישור|אשר|אשר?י|yes|y|ok|אוקיי)\.?$/i

async function getPending(chatId: number): Promise<{ action: BotAction; reply: string } | null> {
  const { data } = await supabaseAdmin
    .from('pending_bot_updates')
    .select('action, reply, created_at')
    .eq('chat_id', chatId)
    .maybeSingle()
  if (!data) return null
  const ageMs = Date.now() - new Date(data.created_at).getTime()
  if (ageMs > 5 * 60 * 1000) {
    await supabaseAdmin.from('pending_bot_updates').delete().eq('chat_id', chatId)
    return null
  }
  return { action: data.action as BotAction, reply: data.reply as string }
}

async function clearPending(chatId: number) {
  await supabaseAdmin.from('pending_bot_updates').delete().eq('chat_id', chatId)
}

async function savePending(chatId: number, action: BotAction, reply: string) {
  await supabaseAdmin.from('pending_bot_updates').upsert({
    chat_id: chatId, action, reply, created_at: new Date().toISOString(),
  })
}

async function executeAction(action: BotAction, familyId: string): Promise<{ ok: boolean; error?: string }> {
  if (action.op === 'insert') {
    const { error } = await supabaseAdmin.from(action.table).insert({ ...action.fields, family_id: familyId })
    if (error) return { ok: false, error: error.message }
  } else {
    if (!action.row_id) return { ok: false, error: 'row_id חסר' }
    const { error } = await supabaseAdmin.from(action.table)
      .update({ ...action.fields, updated_at: new Date().toISOString() })
      .eq('id', action.row_id)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}

// Telegram Update payload shape (only fields we use)
interface TgMessage {
  message_id: number
  text?: string
  chat: { id: number; type: string }
}
interface TgUpdate {
  update_id: number
  message?: TgMessage
}

const TG_API = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`

async function sendMessage(chatId: number, text: string) {
  await fetch(TG_API('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
}

const CAT_LABEL: Record<string, string> = {
  medical: 'רפואי 🏥', home: 'בית 🏠', studies: 'לימודים 📚',
  formal: 'מסגרות 🏫', hobbies: 'חוגים 🎨', finance: 'כספים 💰', miluim: 'מילואים 🪖',
}
const PRI_ICON: Record<string, string> = { urgent: '🔥', soon: '⏰', normal: '📌', low: '· ' }
const ASGN_LABEL: Record<string, string> = { adi: 'עדי', tahel: 'תהלה', tehila: 'תהלה', both: 'שנינו' }

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const t = new Date().toISOString().split('T')[0]
  if (iso === t) return 'היום'
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  if (iso === tomorrow.toISOString().split('T')[0]) return 'מחר'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type Task = {
  id: string
  text: string
  category: string
  priority: string
  due_date: string | null
  assignee: string
  done: boolean
  related_member_ids: string[]
}

type Member = { id: string; name: string; gender: string | null }

function formatTaskList(title: string, tasks: Task[], members: Member[]): string {
  if (!tasks.length) return `🎉 אין מטלות ${title}`
  const memberLabel = (id: string) => {
    const m = members.find(x => x.id === id)
    if (!m) return ''
    return (m.gender === 'female' ? '👧' : '👦') + ' ' + m.name
  }
  const lines = tasks.map(t => {
    const icon = PRI_ICON[t.priority] || '·'
    const parts: string[] = [`📁 ${CAT_LABEL[t.category] || t.category}`]
    if (t.related_member_ids?.length) {
      const kids = t.related_member_ids.map(memberLabel).filter(Boolean).join(' ')
      if (kids) parts.push(kids)
    }
    if (t.due_date) parts.push(`📅 ${fmtDate(t.due_date)}`)
    parts.push(`👤 ${ASGN_LABEL[t.assignee] || t.assignee}`)
    return `${icon} <b>${escapeHtml(t.text)}</b>\n   ${parts.join(' · ')}`
  })
  return `📋 <b>${title}</b> (${tasks.length} מטלות)\n\n${lines.join('\n\n')}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function queryTasks(familyId: string, filter: 'today' | 'week' | 'urgent' | 'list', role: 'adi' | 'tahel') {
  const today = new Date().toISOString().split('T')[0]
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  let q = supabaseAdmin
    .from('tasks')
    .select('id, text, category, priority, due_date, assignee, done, related_member_ids')
    .eq('family_id', familyId)
    .eq('done', false)

  // Assignee filter — bot is owned by `role`. Default to user's tasks + shared.
  if (filter !== 'urgent') {
    q = q.in('assignee', [role, 'both'])
  }

  if (filter === 'today') {
    q = q.or(`due_date.eq.${today},due_date.lt.${today}`)
  } else if (filter === 'week') {
    q = q.not('due_date', 'is', null).lte('due_date', weekEndStr)
  } else if (filter === 'urgent') {
    q = q.eq('priority', 'urgent')
  }

  const order = filter === 'list'
    ? [{ col: 'priority', asc: true }, { col: 'due_date', asc: true, nullsFirst: false }]
    : [{ col: 'due_date', asc: true, nullsFirst: false }]

  for (const o of order) q = q.order(o.col, { ascending: o.asc, nullsFirst: o.nullsFirst })

  const { data } = await q.limit(30)
  return (data || []) as Task[]
}

async function loadMembers(familyId: string): Promise<Member[]> {
  const { data } = await supabaseAdmin
    .from('family_members')
    .select('id, name, gender')
    .eq('family_id', familyId)
    .eq('is_active', true)
  return (data || []) as Member[]
}

const HELP_TEXT = `👋 שלום! אני בוט ניהול המטלות של המשפחה.

<b>פקודות:</b>
/today — מטלות להיום + מטלות באיחור
/week — מטלות לשבוע הקרוב
/urgent — מטלות דחופות
/list — כל המטלות הפתוחות שלי

<b>הוספת מטלה:</b>
פשוט שלח טקסט — אני אסווג אותו אוטומטית ואוסיף ל-Inbox.

דוגמה: <i>תור שיניים לנעמי השבוע</i>`

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true }) // silently drop
  }

  let update: TgUpdate
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const msg = update.message
  if (!msg) return NextResponse.json({ ok: true })

  const chatId = msg.chat.id

  // Look up chat → user/family
  const { data: tgUser } = await supabaseAdmin
    .from('telegram_users')
    .select('user_id, family_id, member_role')
    .eq('chat_id', chatId)
    .maybeSingle()

  if (!tgUser) {
    // unauthorized chat — silently ignore
    return NextResponse.json({ ok: true })
  }

  const text = (msg.text || '').trim()
  if (!text) {
    await sendMessage(chatId, 'אני תומך רק בטקסט בינתיים 📝')
    return NextResponse.json({ ok: true })
  }

  // Normalize commands: strip @bot_username suffix and lowercase
  // (Telegram clients append @bot_name when picking from the bot menu)
  const isCmd = text.startsWith('/')
  const cmd = isCmd ? text.split(/[\s@]/)[0].toLowerCase() : ''

  // Commands
  if (cmd === '/start' || cmd === '/help') {
    await sendMessage(chatId, HELP_TEXT)
    return NextResponse.json({ ok: true })
  }

  const role = tgUser.member_role as 'adi' | 'tahel'

  if (cmd === '/today') {
    const tasks = await queryTasks(tgUser.family_id, 'today', role)
    const members = await loadMembers(tgUser.family_id)
    await sendMessage(chatId, formatTaskList('היום + באיחור', tasks, members))
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/week') {
    const tasks = await queryTasks(tgUser.family_id, 'week', role)
    const members = await loadMembers(tgUser.family_id)
    await sendMessage(chatId, formatTaskList('השבוע הקרוב', tasks, members))
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/urgent') {
    const tasks = await queryTasks(tgUser.family_id, 'urgent', role)
    const members = await loadMembers(tgUser.family_id)
    await sendMessage(chatId, formatTaskList('דחוף 🔥', tasks, members))
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/list') {
    const tasks = await queryTasks(tgUser.family_id, 'list', role)
    const members = await loadMembers(tgUser.family_id)
    await sendMessage(chatId, formatTaskList('כל המטלות שלי', tasks, members))
    return NextResponse.json({ ok: true })
  }

  if (isCmd) {
    await sendMessage(chatId, 'פקודה לא מוכרת. שלח /help לרשימת פקודות.')
    return NextResponse.json({ ok: true })
  }

  // Confirmation shortcut: if user says "כן" and there's a pending update — execute it.
  if (CONFIRM_RE.test(text)) {
    const pending = await getPending(chatId)
    if (!pending) {
      await sendMessage(chatId, 'אין מה לאשר כרגע.')
      return NextResponse.json({ ok: true })
    }
    const res = await executeAction(pending.action, tgUser.family_id)
    await clearPending(chatId)
    if (res.ok) {
      // Replace the "האם לעדכן?" prefix in the original reply with "✅ עודכן"
      const ack = pending.reply.replace(/^[^\n]*\n/, '✅ עודכן\n')
      await sendMessage(chatId, ack)
    } else {
      await sendMessage(chatId, `⚠️ העדכון נכשל: ${res.error}`)
    }
    return NextResponse.json({ ok: true })
  }

  // New message — clear any stale pending so we don't confuse follow-ups
  await clearPending(chatId)

  // Free-text → Bot brain (intent + reply + optional action)
  try {
    const result = await processBotMessage(text, tgUser.family_id)

    // Path 1: create a task — route through sortInbox (existing pipeline)
    if (result.create_task) {
      const sorted = await sortInbox([text], tgUser.family_id)
      if (!sorted.length) {
        await sendMessage(chatId, '⚠️ לא הצלחתי לסווג את המטלה. נסה שוב.')
        return NextResponse.json({ ok: true })
      }
      const inserts = sorted.map(s => ({
        family_id: tgUser.family_id,
        text: s.text,
        category: s.cat,
        assignee: s.assignee,
        priority: s.priority,
        related_member_ids: s.related_member_ids,
      }))
      await supabaseAdmin.from('tasks').insert(inserts)

      const members = await loadMembers(tgUser.family_id)
      const replyLines = sorted.map(s => {
        const kids = s.related_member_ids
          .map(id => members.find(m => m.id === id))
          .filter(Boolean)
          .map(m => (m!.gender === 'female' ? '👧' : '👦') + ' ' + m!.name)
          .join(' ')
        const parts = [
          `📁 ${CAT_LABEL[s.cat] || s.cat}`,
          `${PRI_ICON[s.priority]} ${s.priority === 'urgent' ? 'דחוף' : s.priority === 'soon' ? 'השבוע' : 'רגיל'}`,
          `👤 ${ASGN_LABEL[s.assignee]}`,
        ]
        if (kids) parts.push(kids)
        return `✅ <b>${escapeHtml(s.text)}</b>\n   ${parts.join(' · ')}`
      })
      await sendMessage(chatId, replyLines.join('\n\n'))
      return NextResponse.json({ ok: true })
    }

    // Path 2: action that needs confirmation — store + ask
    if (result.action && result.action.needs_confirmation) {
      await savePending(chatId, result.action, result.reply)
      await sendMessage(chatId, result.reply)
      return NextResponse.json({ ok: true })
    }

    // Path 3: action without confirmation (create/insert or minor update) — execute now
    if (result.action) {
      const res = await executeAction(result.action, tgUser.family_id)
      if (res.ok) {
        await sendMessage(chatId, result.reply)
      } else {
        await sendMessage(chatId, `⚠️ הפעולה נכשלה: ${res.error}`)
      }
      return NextResponse.json({ ok: true })
    }

    // Path 4: read or unknown — Haiku already wrote the reply
    await sendMessage(chatId, result.reply)
  } catch (e) {
    console.error('telegram free-text error', e)
    await sendMessage(chatId, '⚠️ שגיאה בהוספת המטלה. נסה שוב.')
  }

  return NextResponse.json({ ok: true })
}
