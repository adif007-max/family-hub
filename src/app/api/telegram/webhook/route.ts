import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sortInbox } from '@/lib/sort-inbox'
import { extractIntent, generateReply, BotAction, ActionOutcome } from '@/lib/bot-intent'
import { buildDailyDigest, israelToday } from '@/lib/digest'
import { buildWeekSummary } from '@/lib/weekSummary'
import { getUpcomingRenewals } from '@/lib/renewals'
import { formatDigest, formatWeekSummary, formatRenewals, formatHealth, HealthData, esc } from '@/lib/telegramFormatters'
import { isDoneIntent, isVagueDoneIntent, matchDoneText } from '@/lib/doneMatcher'

const CONFIRM_RE = /^(כן|אישור|אשר|אשר?י|yes|y|ok|אוקיי)\.?$/i
const NUMBER_RE  = /^\d+$/

// ── Types ─────────────────────────────────────────────────────────────────────

interface TgMessage {
  message_id: number
  text?: string
  chat: { id: number }
}
interface TgCallbackQuery {
  id: string
  message: { message_id: number; chat: { id: number } }
  data?: string
}
interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}

// ── Telegram API ──────────────────────────────────────────────────────────────

const TG = (m: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`

async function tgPost(method: string, body: Record<string, unknown>) {
  return fetch(TG(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function sendMessage(chatId: number, text: string) {
  await tgPost('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
}

// sendMessageWithKeyboard — inline keyboard buttons
// buttons: [[{text, data}]] — rows of columns
async function sendWithKeyboard(
  chatId: number,
  text: string,
  buttons: { text: string; data: string }[][]
) {
  await tgPost('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: buttons.map(row =>
        row.map(b => ({ text: b.text, callback_data: b.data }))
      ),
    },
  })
}

async function editMessage(chatId: number, messageId: number, text: string) {
  await tgPost('editMessageText', {
    chat_id: chatId, message_id: messageId, text,
    parse_mode: 'HTML', disable_web_page_preview: true,
  }).catch(() => { /* silently ignore if message too old */ })
}

async function answerCallback(callbackId: string) {
  await tgPost('answerCallbackQuery', { callback_query_id: callbackId }).catch(() => {})
}

// Silent reaction — falls back gracefully if unsupported
async function reactOk(chatId: number, messageId: number) {
  await tgPost('setMessageReaction', {
    chat_id: chatId,
    message_id: messageId,
    reaction: [{ type: 'emoji', emoji: '✅' }],
    is_big: false,
  }).catch(() => { /* reactions not supported or rate-limited — silently ignore */ })
}

// ── Pending store ─────────────────────────────────────────────────────────────

async function getPending(chatId: number): Promise<{ action: BotAction; reply: string } | null> {
  const { data } = await supabaseAdmin
    .from('pending_bot_updates')
    .select('action, reply, created_at')
    .eq('chat_id', chatId)
    .maybeSingle()
  if (!data) return null
  if (Date.now() - new Date(data.created_at).getTime() > 5 * 60_000) {
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

// ── DB actions ────────────────────────────────────────────────────────────────

async function executeAction(action: BotAction, familyId: string): Promise<{ ok: boolean; error?: string }> {
  if (action.op === 'done_pick') return { ok: false, error: 'done_pick handled upstream' }
  if (action.op === 'insert') {
    const { error } = await supabaseAdmin
      .from(action.table as 'vehicles' | 'subscriptions' | 'schedules')
      .insert({ ...action.fields, family_id: familyId })
    if (error) return { ok: false, error: error.message }
  } else {
    if (!action.row_id) return { ok: false, error: 'row_id חסר' }
    const { error } = await supabaseAdmin
      .from(action.table as 'vehicles' | 'subscriptions' | 'schedules')
      .update({ ...action.fields, updated_at: new Date().toISOString() })
      .eq('id', action.row_id)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}

async function markTaskDone(taskId: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  // Fetch text first for ACK
  const { data: td } = await supabaseAdmin.from('tasks').select('text').eq('id', taskId).maybeSingle()
  const { error } = await supabaseAdmin
    .from('tasks')
    .update({ done: true, done_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, text: td?.text }
}

// ── Inline keyboard builders ──────────────────────────────────────────────────

// /done and "עשיתי X" ambiguous — up to 8 tasks, 1 per row, callback "done:ID"
function donePriorityIcon(p: string) {
  return p === 'urgent' ? '🔥' : p === 'soon' ? '⏰' : ''
}

function buildDoneKeyboard(
  tasks: { id: string; text: string; priority: string; due_date: string | null }[],
  today: string
): { text: string; data: string }[][] {
  return tasks.slice(0, 8).map(t => {
    const icon   = donePriorityIcon(t.priority)
    const overdue = t.due_date && t.due_date < today ? ' ⚠' : ''
    const label   = `${icon ? icon + ' ' : ''}${t.text.length > 36 ? t.text.slice(0, 35) + '…' : t.text}${overdue}`
    // callback_data max 64 bytes — "done:" (5) + UUID (36) = 41 bytes, always safe
    const data    = `done:${t.id}`.slice(0, 64)
    return [{ text: label, data }]
  })
}

// confirmation inline keyboard
function buildConfirmKeyboard(): { text: string; data: string }[][] {
  return [[{ text: 'אשר ✓', data: 'confirm' }, { text: 'בטל', data: 'cancel' }]]
}

// ── Reply sanitizer ───────────────────────────────────────────────────────────
// Applied to Haiku free-text replies only (not to structured summaries).
// Structured = contains newlines or HTML tags → leave as-is.

const ENTHUSIASTIC_RE = /(!(?!\s*$|\n))|(\b(אחלה|מצוין|נהדר|פנטסטי|מעולה|כל הכבוד|ברכות|יופי)\b)/gi
const EXCLAIM_TRAIL   = /\s*!+\s*$/g

function sanitizeReply(text: string): string {
  const isStructured = text.includes('\n') || text.includes('<b>') || text.includes('<i>')
  if (isStructured) return text  // structured summaries — do not truncate

  // Strip exclamation marks and enthusiastic phrases
  let s = text
    .replace(ENTHUSIASTIC_RE, '')
    .replace(EXCLAIM_TRAIL, '')
    .trim()

  // Enforce ≤ 200 chars for simple replies (12-ish words in Hebrew)
  if (s.length > 200) s = s.slice(0, 200).replace(/\s+\S*$/, '') + '…'

  return s || text  // never return empty
}

// ── Queries ───────────────────────────────────────────────────────────────────

type Task = {
  id: string; text: string; category: string; priority: string
  due_date: string | null; assignee: string; done: boolean; related_member_ids: string[]
}
type Member = { id: string; name: string; gender: string | null }

async function queryTasks(familyId: string, filter: 'today' | 'week' | 'urgent' | 'list', role: 'adi' | 'tahel') {
  const today = israelToday()
  const weekEnd = new Date(today + 'T00:00:00'); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  let q = supabaseAdmin
    .from('tasks').select('id,text,category,priority,due_date,assignee,done,related_member_ids')
    .eq('family_id', familyId).eq('done', false)

  if (filter !== 'urgent') q = q.in('assignee', [role, 'both'])
  if (filter === 'today')   q = q.or(`due_date.eq.${today},due_date.lt.${today}`)
  else if (filter === 'week')   q = q.not('due_date', 'is', null).lte('due_date', weekEndStr)
  else if (filter === 'urgent') q = q.eq('priority', 'urgent')

  const order = filter === 'list'
    ? [{ col: 'priority', asc: true }, { col: 'due_date', asc: true, nullsFirst: false }]
    : [{ col: 'due_date', asc: true, nullsFirst: false }]
  for (const o of order) q = q.order(o.col, { ascending: o.asc, nullsFirst: o.nullsFirst })
  const { data } = await q.limit(30)
  return (data || []) as Task[]
}

async function queryDoneCandidates(familyId: string, role: 'adi' | 'tahel') {
  const today = israelToday()
  const { data } = await supabaseAdmin
    .from('tasks').select('id,text,priority,due_date,assignee')
    .eq('family_id', familyId).eq('done', false).in('assignee', [role, 'both'])
    .order('due_date', { nullsFirst: false }).limit(20)
  const tasks = (data || []) as { id: string; text: string; priority: string; due_date: string | null; assignee: string }[]
  return tasks.sort((a, b) => {
    const aOver = a.due_date && a.due_date < today ? -1 : 0
    const bOver = b.due_date && b.due_date < today ? -1 : 0
    return aOver - bOver
  }).slice(0, 8)
}

async function loadMembers(familyId: string): Promise<Member[]> {
  const { data } = await supabaseAdmin
    .from('family_members').select('id,name,gender').eq('family_id', familyId).eq('is_active', true)
  return (data || []) as Member[]
}

// ── Formatters (local) ────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = {
  medical: '🏥', home: '🏠', studies: '📚', formal: '🏫', hobbies: '🎨', finance: '💰', miluim: '🪖',
}
const PRI_ICON: Record<string, string> = { urgent: '🔥', soon: '⏰', normal: '', low: '' }
const ASGN_LABEL: Record<string, string> = { adi: 'עדי', tahel: 'תהלה', tehila: 'תהלה', both: 'שנינו' }

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const today = israelToday()
  if (iso === today) return 'היום'
  const t = new Date(today + 'T00:00:00'); t.setDate(t.getDate() + 1)
  if (iso === t.toISOString().split('T')[0]) return 'מחר'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function formatTaskList(title: string, tasks: Task[], members: Member[]): string {
  if (!tasks.length) return `אין מטלות ${title}`
  const memberLabel = (id: string) => {
    const m = members.find(x => x.id === id)
    return m ? (m.gender === 'female' ? '👧' : '👦') + ' ' + m.name : ''
  }
  const lines = tasks.map(t => {
    const icon = PRI_ICON[t.priority]
    const cat = CAT_LABEL[t.category] || ''
    const meta: string[] = []
    if (t.related_member_ids?.length) {
      const kids = t.related_member_ids.map(memberLabel).filter(Boolean).join(' ')
      if (kids) meta.push(kids)
    }
    if (t.due_date) meta.push(fmtDate(t.due_date))
    const assignee = t.assignee !== 'both' ? ASGN_LABEL[t.assignee] || t.assignee : ''
    if (assignee) meta.push(assignee)
    const metaStr = meta.length ? `  <i>${meta.join(' · ')}</i>` : ''
    return `${icon ? icon + ' ' : ''}${cat ? cat + ' ' : ''}<b>${esc(t.text)}</b>${metaStr}`
  })
  return `<b>${title}</b>\n\n${lines.join('\n')}`
}

// ── Health check builder ──────────────────────────────────────────────────────

async function buildHealthData(familyId: string): Promise<HealthData> {
  const today = israelToday()
  const cutoff = new Date(today + 'T00:00:00'); cutoff.setDate(cutoff.getDate() - 14)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const [tasksRes, subsRes, renewals] = await Promise.all([
    supabaseAdmin.from('tasks').select('id,text,priority,due_date,assignee,created_at')
      .eq('family_id', familyId).eq('done', false),
    supabaseAdmin.from('subscriptions').select('name,monthly_cost').eq('family_id', familyId),
    getUpcomingRenewals(familyId, 7),
  ])
  const tasks = (tasksRes.data || []) as { id: string; text: string; priority: string; due_date: string | null; assignee: string; created_at: string }[]
  const subs  = (subsRes.data  || []) as { name: string; monthly_cost: number | null }[]
  const overdueCount     = tasks.filter(t => t.due_date && t.due_date < today).length
  const staleCount       = tasks.filter(t => !t.due_date && t.created_at < cutoffStr + 'T00:00:00').length
  const urgentUnassigned = tasks.filter(t => t.priority === 'urgent' && !t.due_date).length
  const adiCount         = tasks.filter(t => t.assignee === 'adi').length
  const tahelCount       = tasks.filter(t => t.assignee === 'tahel').length
  const overloadedAssignee = adiCount > 8 ? 'adi' : tahelCount > 8 ? 'tahel' : null
  const subscriptionsMissingCost = subs.filter(s => s.monthly_cost == null).map(s => s.name)
  return { staleCount, overdueCount, urgentUnassigned, overloadedAssignee, subscriptionsMissingCost, renewalsUrgent: renewals.filter(r => r.daysLeft <= 7) }
}

const RENEWALS_RE = /מה.*עומד.*לפוג|מה.*צריך.*לחדש|מה.*פוקע|איזה.*מנוי|חידושים.*קרוב|מה.*חייב.*לחדש|תאריכי.*פקיעה|מתי.*ביטוח|מתי.*טסט/i

const HELP_TEXT = `<b>פקודות</b>
/today · /week · /urgent · /list
/done — סמן כבוצע
/health — בדיקת בריאות

<b>הוספה</b>
טקסט חופשי — מסווג אוטומטית
!טקסט — ישירות ל-Inbox

<b>בוצע</b>
"עשיתי X" / "סיימתי X"

<b>שאלות</b>
"מה יש להלל היום?" · "מה עומד לפוג?"`

// ── Callback query handler ────────────────────────────────────────────────────

async function handleCallback(cq: TgCallbackQuery): Promise<void> {
  const chatId = cq.message.chat.id
  const msgId  = cq.message.message_id
  const data   = cq.data || ''

  await answerCallback(cq.id)

  // done:TASK_UUID — mark task done from inline keyboard
  if (data.startsWith('done:')) {
    const taskId = data.slice(5)
    // Verify the task belongs to this chat's family before marking done
    const { data: tgUser } = await supabaseAdmin
      .from('telegram_users').select('family_id').eq('chat_id', chatId).maybeSingle()
    if (!tgUser) { await editMessage(chatId, msgId, 'לא מורשה'); return }
    const { data: taskRow } = await supabaseAdmin
      .from('tasks').select('family_id').eq('id', taskId).maybeSingle()
    if (!taskRow || taskRow.family_id !== tgUser.family_id) {
      await editMessage(chatId, msgId, 'לא נמצא'); return
    }
    const res = await markTaskDone(taskId)
    if (res.ok) {
      await editMessage(chatId, msgId, `✓ <b>${esc(res.text || 'בוצע')}</b>`)
    } else {
      await editMessage(chatId, msgId, `שגיאה: ${res.error || 'לא ידוע'}`)
    }
    return
  }

  // confirm — execute pending action, then Call 2 for the reply
  if (data === 'confirm') {
    const { data: tgUser } = await supabaseAdmin
      .from('telegram_users').select('family_id').eq('chat_id', chatId).maybeSingle()
    if (!tgUser) return
    const pending = await getPending(chatId)
    if (!pending) { await editMessage(chatId, msgId, 'פג תוקף'); return }
    const res = await executeAction(pending.action, tgUser.family_id as string)
    await clearPending(chatId)
    if (res.ok) {
      const userText = pending.action.user_text || ''
      const outcome: ActionOutcome = {
        op: pending.action.op as 'insert' | 'update',
        success: true,
        snapshot: JSON.stringify(pending.action.fields),
      }
      // Call 2: warm reply with actual data
      const reply = userText
        ? await generateReply(userText, outcome).catch(() => 'עודכן')
        : 'עודכן'
      await editMessage(chatId, msgId, reply)
    } else {
      await editMessage(chatId, msgId, `שגיאה: ${res.error}`)
    }
    return
  }

  // cancel
  if (data === 'cancel') {
    await clearPending(chatId)
    await editMessage(chatId, msgId, 'בוטל')
    return
  }

  // Unknown callback — stale or from a previous deploy
  await editMessage(chatId, msgId, 'פג תוקף')
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return NextResponse.json({ ok: true })

  let update: TgUpdate
  try { update = await req.json() } catch { return NextResponse.json({ ok: true }) }

  // ── Callback queries (button taps) ────────────────────────────────────────
  if (update.callback_query) {
    await handleCallback(update.callback_query)
    return NextResponse.json({ ok: true })
  }

  const msg = update.message
  if (!msg) return NextResponse.json({ ok: true })

  const chatId = msg.chat.id
  const msgId  = msg.message_id

  const { data: tgUser } = await supabaseAdmin
    .from('telegram_users').select('user_id,family_id,member_role').eq('chat_id', chatId).maybeSingle()
  if (!tgUser) return NextResponse.json({ ok: true })

  const text = (msg.text || '').trim()
  if (!text) return NextResponse.json({ ok: true })  // silently ignore non-text

  const isCmd    = text.startsWith('/')
  const cmd      = isCmd ? text.split(/[\s@]/)[0].toLowerCase() : ''
  const role     = tgUser.member_role as 'adi' | 'tahel'
  const familyId = tgUser.family_id as string

  // ── Commands ──────────────────────────────────────────────────────────────

  if (cmd === '/start' || cmd === '/help') {
    await sendMessage(chatId, HELP_TEXT)
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/today') {
    try {
      const digest = await buildDailyDigest(familyId)
      await sendMessage(chatId, formatDigest(digest))
    } catch {
      const tasks   = await queryTasks(familyId, 'today', role)
      const members = await loadMembers(familyId)
      await sendMessage(chatId, formatTaskList('היום', tasks, members))
    }
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/week') {
    try {
      const summary = await buildWeekSummary(familyId)
      await sendMessage(chatId, formatWeekSummary(summary))
    } catch {
      const tasks   = await queryTasks(familyId, 'week', role)
      const members = await loadMembers(familyId)
      await sendMessage(chatId, formatTaskList('השבוע', tasks, members))
    }
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/urgent') {
    const tasks   = await queryTasks(familyId, 'urgent', role)
    const members = await loadMembers(familyId)
    await sendMessage(chatId, formatTaskList('דחוף', tasks, members))
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/list') {
    const tasks   = await queryTasks(familyId, 'list', role)
    const members = await loadMembers(familyId)
    await sendMessage(chatId, formatTaskList('מטלות', tasks, members))
    return NextResponse.json({ ok: true })
  }

  // /done — inline keyboard + numeric fallback
  if (cmd === '/done') {
    const tasks = await queryDoneCandidates(familyId, role)
    if (!tasks.length) {
      await sendMessage(chatId, 'אין מטלות פתוחות')
      return NextResponse.json({ ok: true })
    }
    const today    = israelToday()
    const keyboard = buildDoneKeyboard(tasks, today)
    // Save for numeric fallback
    await savePending(chatId, {
      table: 'tasks', op: 'done_pick', row_id: null, fields: {},
      needs_confirmation: false, task_ids: tasks.map(t => t.id),
    }, '')
    await sendWithKeyboard(chatId, 'סמן כבוצע:', keyboard)
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/health') {
    const health = await buildHealthData(familyId)
    await sendMessage(chatId, formatHealth(health))
    return NextResponse.json({ ok: true })
  }

  if (isCmd) {
    await sendMessage(chatId, 'פקודה לא מוכרת. /help')
    return NextResponse.json({ ok: true })
  }

  // ── Numeric reply → done_pick fallback ───────────────────────────────────

  if (NUMBER_RE.test(text)) {
    const pending = await getPending(chatId)
    if (pending?.action.op === 'done_pick' && pending.action.task_ids?.length) {
      const idx     = parseInt(text) - 1
      const taskIds = pending.action.task_ids
      if (idx >= 0 && idx < taskIds.length) {
        const res = await markTaskDone(taskIds[idx])
        await clearPending(chatId)
        if (res.ok) {
          await reactOk(chatId, msgId)
          await sendMessage(chatId, `✓ ${esc(res.text || 'בוצע')}`)
        } else {
          await sendMessage(chatId, `שגיאה: ${res.error}`)
        }
      } else {
        await sendMessage(chatId, `1–${taskIds.length}`)
      }
      return NextResponse.json({ ok: true })
    }
  }

  // ── "כן" → confirm pending Haiku action ──────────────────────────────────
  // Guard: never try to confirm a done_pick — that's handled by number/button only.

  if (CONFIRM_RE.test(text)) {
    const pending = await getPending(chatId)
    if (!pending || pending.action.op === 'done_pick') {
      // No confirmable pending — ignore silently (don't send noise)
      return NextResponse.json({ ok: true })
    }
    const res = await executeAction(pending.action, familyId)
    await clearPending(chatId)
    if (res.ok) {
      await reactOk(chatId, msgId)
      const userText = pending.action.user_text || ''
      const outcome: ActionOutcome = { op: pending.action.op as 'insert' | 'update', success: true, snapshot: JSON.stringify(pending.action.fields) }
      const reply = userText ? await generateReply(userText, outcome).catch(() => 'עודכן') : 'עודכן'
      await sendMessage(chatId, reply)
    } else {
      await sendMessage(chatId, `שגיאה: ${res.error}`)
    }
    return NextResponse.json({ ok: true })
  }

  // New message — clear stale pending
  await clearPending(chatId)

  // ── Quick capture: !text ──────────────────────────────────────────────────

  if (text.startsWith('!')) {
    const raw = text.slice(1).trim()
    if (!raw) { await sendMessage(chatId, '! + טקסט'); return NextResponse.json({ ok: true }) }
    try {
      const items  = splitItems(raw)
      const sorted = await sortInbox(items, familyId)
      if (!sorted.length) { await sendMessage(chatId, 'שגיאה בסיווג'); return NextResponse.json({ ok: true }) }
      await supabaseAdmin.from('tasks').insert(
        sorted.map(s => ({ family_id: familyId, text: s.text, category: s.cat, assignee: s.assignee, priority: s.priority, related_member_ids: s.related_member_ids }))
      )
      await reactOk(chatId, msgId)
      // Short ACK: one line per task
      const members = await loadMembers(familyId)
      const lines = sorted.map(s => {
        const kids = s.related_member_ids
          .map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(', ')
        return `✓ ${esc(s.text)}${kids ? ` · ${kids}` : ''}`
      })
      await sendMessage(chatId, lines.join('\n'))
    } catch { await sendMessage(chatId, 'שגיאה') }
    return NextResponse.json({ ok: true })
  }

  // ── "עשיתי X" → done matching ────────────────────────────────────────────

  if (isDoneIntent(text)) {
    const candidates = await queryDoneCandidates(familyId, role)

    // Vague intent ("סמן אלה בוצעו", "כולם", "הכל") → show full keyboard
    if (isVagueDoneIntent(text)) {
      if (!candidates.length) {
        await sendMessage(chatId, 'אין מטלות פתוחות')
        return NextResponse.json({ ok: true })
      }
      const today    = israelToday()
      const keyboard = buildDoneKeyboard(candidates, today)
      await savePending(chatId, {
        table: 'tasks', op: 'done_pick', row_id: null, fields: {},
        needs_confirmation: false, task_ids: candidates.map(t => t.id),
      }, '')
      await sendWithKeyboard(chatId, 'איזו מטלה?', keyboard)
      return NextResponse.json({ ok: true })
    }

    const match = matchDoneText(text, candidates)

    if (match.kind === 'single') {
      const res = await markTaskDone(match.taskId)
      if (res.ok) {
        await reactOk(chatId, msgId)
        await sendMessage(chatId, `✓ ${esc(match.taskText)}`)
      } else {
        await sendMessage(chatId, `שגיאה: ${res.error}`)
      }
      return NextResponse.json({ ok: true })
    }

    if (match.kind === 'multiple') {
      const today    = israelToday()
      const keyboard = buildDoneKeyboard(match.tasks, today)
      await savePending(chatId, {
        table: 'tasks', op: 'done_pick', row_id: null, fields: {},
        needs_confirmation: false, task_ids: match.tasks.map(t => t.id),
      }, '')
      await sendWithKeyboard(chatId, 'איזו מטלה?', keyboard)
      return NextResponse.json({ ok: true })
    }

    // No text match — show keyboard anyway rather than "לא נמצאה משימה"
    if (candidates.length) {
      const today    = israelToday()
      const keyboard = buildDoneKeyboard(candidates, today)
      await savePending(chatId, {
        table: 'tasks', op: 'done_pick', row_id: null, fields: {},
        needs_confirmation: false, task_ids: candidates.map(t => t.id),
      }, '')
      await sendWithKeyboard(chatId, 'איזו מטלה?', keyboard)
    } else {
      await sendMessage(chatId, 'אין מטלות פתוחות')
    }
    return NextResponse.json({ ok: true })
  }

  // ── Renewals — deterministic ──────────────────────────────────────────────

  if (RENEWALS_RE.test(text)) {
    const windowDays = text.includes('חודש') ? 30 : text.includes('שנה') ? 365 : 60
    const items = await getUpcomingRenewals(familyId, windowDays)
    await sendMessage(chatId, formatRenewals(items, windowDays))
    return NextResponse.json({ ok: true })
  }

  // ── Free-text → Two-call Haiku ───────────────────────────────────────────
  // Call 1: structured decision only (no reply text for write intents)
  // Call 2: warm contextual reply after DB action, no tools=

  try {
    const decision = await extractIntent(text, familyId)

    // Read / unknown — Call 1 already has the answer
    if (decision.intent === 'read' || decision.intent === 'unknown') {
      await sendMessage(chatId, decision.read_reply || 'לא הבנתי')
      return NextResponse.json({ ok: true })
    }

    // create_task → sortInbox → Call 2 narrates
    if (decision.create_task) {
      const items  = splitItems(text)
      const sorted = await sortInbox(items, familyId)
      if (!sorted.length) { await sendMessage(chatId, 'שגיאה בסיווג'); return NextResponse.json({ ok: true }) }
      const members = await loadMembers(familyId)
      await supabaseAdmin.from('tasks').insert(
        sorted.map(s => ({ family_id: familyId, text: s.text, category: s.cat, assignee: s.assignee, priority: s.priority, related_member_ids: s.related_member_ids }))
      )
      await reactOk(chatId, msgId)
      const snapshot = JSON.stringify(sorted.map(s => ({
        text: s.text, priority: s.priority, assignee: s.assignee,
        kids: s.related_member_ids.map(id => members.find(m => m.id === id)?.name).filter(Boolean),
      })))
      const reply = await generateReply(text, { op: 'create_task', success: true, snapshot })
      await sendMessage(chatId, reply)
      return NextResponse.json({ ok: true })
    }

    // Action needs confirmation — store user_text, show deterministic confirm message
    if (decision.action && decision.action.needs_confirmation) {
      const actionWithText = { ...decision.action, user_text: text }
      const confirmMsg = buildConfirmMessage(decision.action)
      await savePending(chatId, actionWithText, confirmMsg)
      await sendWithKeyboard(chatId, confirmMsg, buildConfirmKeyboard())
      return NextResponse.json({ ok: true })
    }

    // Direct action → execute → Call 2 narrates
    if (decision.action) {
      const res     = await executeAction(decision.action, familyId)
      await reactOk(chatId, msgId)
      const outcome: ActionOutcome = {
        op: decision.action.op as 'insert' | 'update',
        success: res.ok,
        error: res.error,
        snapshot: res.ok ? JSON.stringify(decision.action.fields) : undefined,
      }
      const reply = await generateReply(text, outcome)
      await sendMessage(chatId, reply)
      return NextResponse.json({ ok: true })
    }

    await sendMessage(chatId, decision.read_reply || 'לא הבנתי')
  } catch (e) {
    console.error('telegram handler error', e)
    await sendMessage(chatId, 'שגיאה')
  }

  return NextResponse.json({ ok: true })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deterministic confirm message — no Haiku needed for this */
function buildConfirmMessage(action: BotAction): string {
  const fields = action.fields as Record<string, unknown>
  const lines: string[] = ['האם לעדכן?']
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'updated_at') continue
    lines.push(`${k}: ${v}`)
  }
  return lines.join('\n')
}

function splitItems(text: string): string[] {
  const parts = text
    .split(/,\s*|\s+\+\s+|\s+וגם\s+|\s+וכן\s+/)
    .map(p => p.trim().replace(/^ו/, '').trim())
    .filter(p => p.length > 3)
  return parts.length >= 2 ? parts : [text]
}
