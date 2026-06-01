import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sortInbox } from '@/lib/sort-inbox'
import { processBotMessage, BotAction } from '@/lib/bot-intent'
import { buildDailyDigest, israelToday } from '@/lib/digest'
import { buildWeekSummary } from '@/lib/weekSummary'
import { getUpcomingRenewals } from '@/lib/renewals'
import { formatDigest, formatWeekSummary, formatDoneList, formatRenewals, formatHealth, HealthData, esc } from '@/lib/telegramFormatters'
import { isDoneIntent, matchDoneText } from '@/lib/doneMatcher'

const CONFIRM_RE = /^(כן|אישור|אשר|אשר?י|yes|y|ok|אוקיי)\.?$/i
const NUMBER_RE = /^\d+$/

// ── Pending store ─────────────────────────────────────────────────────────────

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

// ── DB actions ────────────────────────────────────────────────────────────────

async function executeAction(action: BotAction, familyId: string): Promise<{ ok: boolean; error?: string }> {
  if (action.op === 'done_pick') return { ok: false, error: 'done_pick must be handled upstream' }
  if (action.op === 'insert') {
    const { error } = await supabaseAdmin.from(action.table as 'vehicles' | 'subscriptions' | 'schedules').insert({ ...action.fields, family_id: familyId })
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

async function markTaskDone(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('tasks')
    .update({ done: true, done_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Telegram API ──────────────────────────────────────────────────────────────

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
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
}

// ── Formatters (local) ────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = {
  medical: 'רפואי 🏥', home: 'בית 🏠', studies: 'לימודים 📚',
  formal: 'מסגרות 🏫', hobbies: 'חוגים 🎨', finance: 'כספים 💰', miluim: 'מילואים 🪖',
}
const PRI_ICON: Record<string, string> = { urgent: '🔥', soon: '⏰', normal: '📌', low: '· ' }
const ASGN_LABEL: Record<string, string> = { adi: 'עדי', tahel: 'תהלה', tehila: 'תהלה', both: 'שנינו' }

function fmtDateLocal(iso: string | null): string {
  if (!iso) return ''
  const today = israelToday()
  if (iso === today) return 'היום'
  const tomorrowD = new Date(today + 'T00:00:00'); tomorrowD.setDate(tomorrowD.getDate() + 1)
  if (iso === tomorrowD.toISOString().split('T')[0]) return 'מחר'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type Task = {
  id: string; text: string; category: string; priority: string
  due_date: string | null; assignee: string; done: boolean; related_member_ids: string[]
}
type Member = { id: string; name: string; gender: string | null }

function formatTaskList(title: string, tasks: Task[], members: Member[]): string {
  if (!tasks.length) return `🎉 אין מטלות ${title}`
  const memberLabel = (id: string) => {
    const m = members.find(x => x.id === id)
    return m ? (m.gender === 'female' ? '👧' : '👦') + ' ' + m.name : ''
  }
  const lines = tasks.map(t => {
    const icon = PRI_ICON[t.priority] || '·'
    const parts: string[] = [`📁 ${CAT_LABEL[t.category] || t.category}`]
    if (t.related_member_ids?.length) {
      const kids = t.related_member_ids.map(memberLabel).filter(Boolean).join(' ')
      if (kids) parts.push(kids)
    }
    if (t.due_date) parts.push(`📅 ${fmtDateLocal(t.due_date)}`)
    parts.push(`👤 ${ASGN_LABEL[t.assignee] || t.assignee}`)
    return `${icon} <b>${esc(t.text)}</b>\n   ${parts.join(' · ')}`
  })
  return `📋 <b>${title}</b> (${tasks.length} מטלות)\n\n${lines.join('\n\n')}`
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function queryTasks(familyId: string, filter: 'today' | 'week' | 'urgent' | 'list', role: 'adi' | 'tahel') {
  const today = israelToday()
  const weekEnd = new Date(today + 'T00:00:00'); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  let q = supabaseAdmin
    .from('tasks')
    .select('id, text, category, priority, due_date, assignee, done, related_member_ids')
    .eq('family_id', familyId)
    .eq('done', false)

  if (filter !== 'urgent') q = q.in('assignee', [role, 'both'])
  if (filter === 'today') q = q.or(`due_date.eq.${today},due_date.lt.${today}`)
  else if (filter === 'week') q = q.not('due_date', 'is', null).lte('due_date', weekEndStr)
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
  // Prioritise: overdue → today → urgent → recent
  const { data } = await supabaseAdmin
    .from('tasks')
    .select('id, text, priority, due_date, assignee')
    .eq('family_id', familyId)
    .eq('done', false)
    .in('assignee', [role, 'both'])
    .order('due_date', { nullsFirst: false })
    .limit(20)
  const tasks = (data || []) as { id: string; text: string; priority: string; due_date: string | null; assignee: string }[]
  // Sort: overdue first, then today, then by priority
  return tasks.sort((a, b) => {
    const aOver = a.due_date && a.due_date < today ? -1 : 0
    const bOver = b.due_date && b.due_date < today ? -1 : 0
    if (aOver !== bOver) return aOver - bOver
    return 0
  }).slice(0, 12)
}

async function loadMembers(familyId: string): Promise<Member[]> {
  const { data } = await supabaseAdmin
    .from('family_members')
    .select('id, name, gender')
    .eq('family_id', familyId)
    .eq('is_active', true)
  return (data || []) as Member[]
}

// ── Health check ──────────────────────────────────────────────────────────────

async function buildHealthData(familyId: string): Promise<HealthData> {
  const today = israelToday()
  const cutoff = new Date(today + 'T00:00:00'); cutoff.setDate(cutoff.getDate() - 14)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const [tasksRes, subsRes, renewals] = await Promise.all([
    supabaseAdmin.from('tasks')
      .select('id,text,priority,due_date,assignee,created_at')
      .eq('family_id', familyId).eq('done', false),
    supabaseAdmin.from('subscriptions')
      .select('name,monthly_cost')
      .eq('family_id', familyId),
    getUpcomingRenewals(familyId, 7),
  ])

  const tasks = (tasksRes.data || []) as { id: string; text: string; priority: string; due_date: string | null; assignee: string; created_at: string }[]
  const subs = (subsRes.data || []) as { name: string; monthly_cost: number | null }[]

  const overdueCount = tasks.filter(t => t.due_date && t.due_date < today).length
  const staleCount = tasks.filter(t => !t.due_date && t.created_at < cutoffStr + 'T00:00:00').length
  const urgentUnassigned = tasks.filter(t => t.priority === 'urgent' && !t.due_date).length

  const adiCount = tasks.filter(t => t.assignee === 'adi').length
  const tahelCount = tasks.filter(t => t.assignee === 'tahel').length
  const overloadedAssignee = adiCount > 8 ? 'adi' : tahelCount > 8 ? 'tahel' : null

  const subscriptionsMissingCost = subs.filter(s => s.monthly_cost == null).map(s => s.name)
  const renewalsUrgent = renewals.filter(r => r.daysLeft <= 7)

  return { staleCount, overdueCount, urgentUnassigned, overloadedAssignee, subscriptionsMissingCost, renewalsUrgent }
}

// ── Renewals keyword detector ─────────────────────────────────────────────────

const RENEWALS_RE = /מה.*עומד.*לפוג|מה.*צריך.*לחדש|מה.*פוקע|איזה.*מנוי|חידושים.*קרוב|מה.*חייב.*לחדש|תאריכי.*פקיעה|מתי.*ביטוח|מתי.*טסט|מה.*עומד.*לפוג/i

// ── Help text ─────────────────────────────────────────────────────────────────

const HELP_TEXT = `👋 שלום! אני בוט ניהול המשפחה.

<b>פקודות:</b>
/today — מטלות היום + תקציר בוקר
/week — סיכום שבועי
/urgent — מטלות דחופות
/list — כל המטלות הפתוחות שלי
/done — סמן מטלה כבוצעה
/health — בדיקת בריאות — מה נופל בין הכיסאות?

<b>הוספת מטלה:</b>
פשוט שלח טקסט — אני אסווג אוטומטית.
! בהתחלה = קפיצה מיידית ל-Inbox ללא אישור.
דוגמה: <i>!לחדש דרכון לעוז</i>

<b>סימון כבוצע:</b>
"עשיתי קניות" / "סיימתי תור שיניים"

<b>שאלות:</b>
"מה יש להלל היום?" / "מה עומד לפוג?" / "מתי הטסט?"`

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return NextResponse.json({ ok: true })

  let update: TgUpdate
  try { update = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const msg = update.message
  if (!msg) return NextResponse.json({ ok: true })

  const chatId = msg.chat.id

  const { data: tgUser } = await supabaseAdmin
    .from('telegram_users')
    .select('user_id, family_id, member_role')
    .eq('chat_id', chatId)
    .maybeSingle()
  if (!tgUser) return NextResponse.json({ ok: true })

  const text = (msg.text || '').trim()
  if (!text) {
    await sendMessage(chatId, 'אני תומך רק בטקסט בינתיים 📝')
    return NextResponse.json({ ok: true })
  }

  const isCmd = text.startsWith('/')
  const cmd = isCmd ? text.split(/[\s@]/)[0].toLowerCase() : ''
  const role = tgUser.member_role as 'adi' | 'tahel'
  const familyId = tgUser.family_id as string

  // ── Commands ─────────────────────────────────────────────────────────────

  if (cmd === '/start' || cmd === '/help') {
    await sendMessage(chatId, HELP_TEXT)
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/today') {
    try {
      const digest = await buildDailyDigest(familyId)
      await sendMessage(chatId, formatDigest(digest))
    } catch {
      // fallback to simple task list
      const tasks = await queryTasks(familyId, 'today', role)
      const members = await loadMembers(familyId)
      await sendMessage(chatId, formatTaskList('היום + באיחור', tasks, members))
    }
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/week') {
    try {
      const summary = await buildWeekSummary(familyId)
      await sendMessage(chatId, formatWeekSummary(summary))
    } catch {
      const tasks = await queryTasks(familyId, 'week', role)
      const members = await loadMembers(familyId)
      await sendMessage(chatId, formatTaskList('השבוע הקרוב', tasks, members))
    }
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/urgent') {
    const tasks = await queryTasks(familyId, 'urgent', role)
    const members = await loadMembers(familyId)
    await sendMessage(chatId, formatTaskList('דחוף 🔥', tasks, members))
    return NextResponse.json({ ok: true })
  }

  if (cmd === '/list') {
    const tasks = await queryTasks(familyId, 'list', role)
    const members = await loadMembers(familyId)
    await sendMessage(chatId, formatTaskList('כל המטלות שלי', tasks, members))
    return NextResponse.json({ ok: true })
  }

  // /done — show numbered list of open tasks
  if (cmd === '/done') {
    const tasks = await queryDoneCandidates(familyId, role)
    const today = israelToday()
    const reply = formatDoneList(tasks, today)
    if (tasks.length) {
      await savePending(chatId, {
        table: 'tasks', op: 'done_pick', row_id: null, fields: {},
        needs_confirmation: false, task_ids: tasks.map(t => t.id),
      }, reply)
    }
    await sendMessage(chatId, reply)
    return NextResponse.json({ ok: true })
  }

  // /health — family health check
  if (cmd === '/health') {
    const health = await buildHealthData(familyId)
    await sendMessage(chatId, formatHealth(health))
    return NextResponse.json({ ok: true })
  }

  if (isCmd) {
    await sendMessage(chatId, 'פקודה לא מוכרת. שלח /help לרשימת פקודות.')
    return NextResponse.json({ ok: true })
  }

  // ── Pending interactions ──────────────────────────────────────────────────

  // Number reply → pick from done_pick list
  if (NUMBER_RE.test(text)) {
    const pending = await getPending(chatId)
    if (pending && pending.action.op === 'done_pick' && pending.action.task_ids?.length) {
      const idx = parseInt(text) - 1
      const taskIds = pending.action.task_ids
      if (idx >= 0 && idx < taskIds.length) {
        const res = await markTaskDone(taskIds[idx])
        await clearPending(chatId)
        if (res.ok) {
          // Get task text for confirmation
          const { data: td } = await supabaseAdmin.from('tasks').select('text').eq('id', taskIds[idx]).maybeSingle()
          await sendMessage(chatId, `✅ <b>${esc(td?.text || 'מטלה')}</b> — בוצע!`)
        } else {
          await sendMessage(chatId, `⚠️ לא הצלחתי לסמן כבוצע: ${res.error}`)
        }
      } else {
        await sendMessage(chatId, `⚠️ מספר לא תקין. בחר בין 1 ל-${taskIds.length}.`)
      }
      return NextResponse.json({ ok: true })
    }
    // Fall through — could be a real number in free text
  }

  // "כן" confirmation
  if (CONFIRM_RE.test(text)) {
    const pending = await getPending(chatId)
    if (!pending) {
      await sendMessage(chatId, 'אין מה לאשר כרגע.')
      return NextResponse.json({ ok: true })
    }
    const res = await executeAction(pending.action, familyId)
    await clearPending(chatId)
    if (res.ok) {
      const ack = pending.reply
        .replace(/^[^\n]*\n/, '✅ עודכן\n')
        .replace(/\n?שלח ["״'']?כן["״'']? לאישור\.?\s*$/i, '')
        .trim()
      await sendMessage(chatId, ack)
    } else {
      await sendMessage(chatId, `⚠️ העדכון נכשל: ${res.error}`)
    }
    return NextResponse.json({ ok: true })
  }

  // New message — clear stale pending
  await clearPending(chatId)

  // ── Quick capture: "!text" → straight to sortInbox ────────────────────────

  if (text.startsWith('!')) {
    const raw = text.slice(1).trim()
    if (!raw) {
      await sendMessage(chatId, '! — שלח כאן משהו לקפוץ ל-Inbox, למשל: !לחדש דרכון לעוז')
      return NextResponse.json({ ok: true })
    }
    try {
      const items = splitMultipleItems(raw)
      const sorted = await sortInbox(items, familyId)
      if (!sorted.length) {
        await sendMessage(chatId, '⚠️ לא הצלחתי לסווג. נסה שוב.')
        return NextResponse.json({ ok: true })
      }
      const members = await loadMembers(familyId)
      const inserts = sorted.map(s => ({
        family_id: familyId, text: s.text, category: s.cat,
        assignee: s.assignee, priority: s.priority, related_member_ids: s.related_member_ids,
      }))
      await supabaseAdmin.from('tasks').insert(inserts)
      const lines = sorted.map(s => {
        const kids = s.related_member_ids
          .map(id => members.find(m => m.id === id))
          .filter(Boolean)
          .map(m => (m!.gender === 'female' ? '👧' : '👦') + ' ' + m!.name)
          .join(' ')
        return `✅ <b>${esc(s.text)}</b>${kids ? ` · ${kids}` : ''}`
      })
      await sendMessage(chatId, lines.join('\n'))
    } catch (e) {
      console.error('quick capture error', e)
      await sendMessage(chatId, '⚠️ שגיאה. נסה שוב.')
    }
    return NextResponse.json({ ok: true })
  }

  // ── "עשיתי X" done-text matching ─────────────────────────────────────────

  if (isDoneIntent(text)) {
    const candidates = await queryDoneCandidates(familyId, role)
    const match = matchDoneText(text, candidates)

    if (match.kind === 'single') {
      const res = await markTaskDone(match.taskId)
      if (res.ok) {
        await sendMessage(chatId, `✅ <b>${esc(match.taskText)}</b> — בוצע!`)
      } else {
        await sendMessage(chatId, `⚠️ לא הצלחתי לסמן: ${res.error}`)
      }
      return NextResponse.json({ ok: true })
    }

    if (match.kind === 'multiple') {
      const today = israelToday()
      const reply = `מצאתי כמה מטלות תואמות — איזו?\n\n` + formatDoneList(match.tasks, today)
      await savePending(chatId, {
        table: 'tasks', op: 'done_pick', row_id: null, fields: {},
        needs_confirmation: false, task_ids: match.tasks.map(t => t.id),
      }, reply)
      await sendMessage(chatId, reply)
      return NextResponse.json({ ok: true })
    }

    // No match — fall through to Haiku
  }

  // ── Renewals keyword — deterministic, no Haiku ────────────────────────────

  if (RENEWALS_RE.test(text)) {
    const windowDays = text.includes('חודש') ? 30 : text.includes('שנה') ? 365 : 60
    const items = await getUpcomingRenewals(familyId, windowDays)
    await sendMessage(chatId, formatRenewals(items, windowDays))
    return NextResponse.json({ ok: true })
  }

  // ── Free-text → Haiku brain ───────────────────────────────────────────────

  try {
    const result = await processBotMessage(text, familyId)

    if (result.create_task) {
      const items = splitMultipleItems(text)
      const sorted = await sortInbox(items, familyId)
      if (!sorted.length) {
        await sendMessage(chatId, '⚠️ לא הצלחתי לסווג. נסה שוב.')
        return NextResponse.json({ ok: true })
      }
      const members = await loadMembers(familyId)
      const inserts = sorted.map(s => ({
        family_id: familyId, text: s.text, category: s.cat,
        assignee: s.assignee, priority: s.priority, related_member_ids: s.related_member_ids,
      }))
      await supabaseAdmin.from('tasks').insert(inserts)

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
        return `✅ <b>${esc(s.text)}</b>\n   ${parts.join(' · ')}`
      })
      await sendMessage(chatId, replyLines.join('\n\n'))
      return NextResponse.json({ ok: true })
    }

    if (result.action && result.action.needs_confirmation) {
      await savePending(chatId, result.action, result.reply)
      await sendMessage(chatId, result.reply)
      return NextResponse.json({ ok: true })
    }

    if (result.action) {
      const res = await executeAction(result.action, familyId)
      if (res.ok) {
        await sendMessage(chatId, result.reply)
      } else {
        await sendMessage(chatId, `⚠️ הפעולה נכשלה: ${res.error}`)
      }
      return NextResponse.json({ ok: true })
    }

    await sendMessage(chatId, result.reply)
  } catch (e) {
    console.error('telegram free-text error', e)
    await sendMessage(chatId, '⚠️ שגיאה. נסה שוב.')
  }

  return NextResponse.json({ ok: true })
}

// ── Multi-item splitter ───────────────────────────────────────────────────────
// Split "לקנות חלב, לקבוע תור, לשלם ביטוח" into 3 items.
// Only splits when there are clear separators AND multiple meaningful segments.
function splitMultipleItems(text: string): string[] {
  // Split on ", " or " + " or " ו" at start of word, but only if result has 2+ items > 5 chars
  const parts = text
    .split(/,\s*|\s+\+\s+|\s+וגם\s+|\s+וכן\s+/)
    .map(p => p.trim().replace(/^ו/, '').trim())
    .filter(p => p.length > 3)
  return parts.length >= 2 ? parts : [text]
}
