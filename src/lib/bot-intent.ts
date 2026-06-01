// Two-call bot architecture:
//   Call 1 (extractIntent)  — structured JSON decision only, no reply text
//   Call 2 (generateReply)  — conversational reply only, no tools=, knows actual outcome
//
// Read queries use only Call 1 (context already loaded → answer in read_reply).
// Write operations use both: Call 1 decides, TypeScript executes, Call 2 narrates.

import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase-admin'

const client = new Anthropic()

// ── Public types ──────────────────────────────────────────────────────────────

export type BotIntent = 'read' | 'create' | 'update' | 'unknown'
export type BotModule = 'tasks' | 'vehicles' | 'subscriptions' | 'schedules' | null

export interface BotAction {
  table: 'vehicles' | 'subscriptions' | 'schedules' | 'tasks'
  op: 'insert' | 'update' | 'done_pick'
  row_id: string | null         // single-row update
  row_ids?: string[]            // multi-row batch update (tasks only)
  fields: Record<string, unknown>
  needs_confirmation: boolean
  task_ids?: string[]           // done_pick list
  user_text?: string            // stored in pending for Call 2 narration
}

/** Result of Call 1 — NO reply text for write intents */
export interface BotDecision {
  intent: BotIntent
  module: BotModule
  action: BotAction | null
  create_task: boolean
  /** Populated only for intent='read'. Bypass Call 2. */
  read_reply?: string
}

/** What actually happened — passed to Call 2 */
export interface ActionOutcome {
  op: 'insert' | 'update' | 'create_task' | 'none'
  success: boolean
  error?: string
  /** Brief JSON of the record(s) touched — helps Call 2 be specific */
  snapshot?: string
}

// ── Context loader ────────────────────────────────────────────────────────────

interface Ctx {
  vehicles: unknown[]
  subscriptions: unknown[]
  schedules: unknown[]
  lessons: unknown[]
  members: unknown[]
  tasks: unknown[]
  recentTasks: unknown[]   // last 8 by created_at — for "מטלות קודמות/אחרונות"
}

async function loadContext(familyId: string): Promise<Ctx> {
  const [v, s, sc, les, m, t, recent] = await Promise.all([
    supabaseAdmin.from('vehicles').select('*').eq('family_id', familyId),
    supabaseAdmin.from('subscriptions').select('*').eq('family_id', familyId),
    supabaseAdmin.from('schedules').select('*').eq('family_id', familyId),
    supabaseAdmin.from('lessons').select('*').eq('family_id', familyId)
      .order('day_of_week').order('start_time'),
    supabaseAdmin.from('family_members').select('*').eq('family_id', familyId).eq('is_active', true),
    supabaseAdmin.from('tasks')
      .select('id,text,category,priority,due_date,assignee,done,related_member_ids')
      .eq('family_id', familyId).eq('done', false)
      .order('due_date', { nullsFirst: false }).limit(40),
    supabaseAdmin.from('tasks')
      .select('id,text,category,priority,due_date,assignee,done,related_member_ids,created_at')
      .eq('family_id', familyId).eq('done', false)
      .order('created_at', { ascending: false }).limit(8),
  ])
  return {
    vehicles:      v.data      || [],
    subscriptions: s.data      || [],
    schedules:     sc.data     || [],
    lessons:       les.data    || [],
    members:       m.data      || [],
    tasks:         t.data      || [],
    recentTasks:   recent.data || [],
  }
}

// ── Call 1: Intent extraction ─────────────────────────────────────────────────

function buildIntentPrompt(text: string, ctx: Ctx): string {
  const today       = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
  const todayDate   = new Date(today + 'T12:00:00')
  const tomorrowD   = new Date(today + 'T12:00:00'); tomorrowD.setDate(tomorrowD.getDate() + 1)
  const DAYS        = ['sun','mon','tue','wed','thu','fri','sat']
  const HEB_LONG    = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
  const todayDow    = DAYS[todayDate.getDay()]
  const tomorrowDow = DAYS[tomorrowD.getDay()]

  return `אתה מנוע החלטה של בוט משפחתי. תפקידך: לנתח את הכוונה ולהחזיר JSON בלבד.
אל תנסח תשובה — Python נפרד מטפל בזה.

תאריך: ${today} (יום ${HEB_LONG[todayDate.getDay()]}, dow="${todayDow}")
מחר: ${HEB_LONG[tomorrowD.getDay()]} (dow="${tomorrowDow}")

נתוני המשפחה:
רכבים: ${JSON.stringify(ctx.vehicles, null, 1)}
מנויים: ${JSON.stringify(ctx.subscriptions, null, 1)}
לו"ז: ${JSON.stringify(ctx.schedules, null, 1)}
מערכת שעות (day_of_week=sun/mon/tue/wed/thu/fri): ${JSON.stringify(ctx.lessons, null, 1)}
ילדים: ${JSON.stringify(ctx.members, null, 1)}
מטלות פתוחות: ${JSON.stringify(ctx.tasks, null, 1)}
מטלות שנוספו לאחרונה (לפי created_at, מהחדש לישן): ${JSON.stringify(ctx.recentTasks, null, 1)}

הודעה: "${text}"

החזר JSON בלבד — ללא backticks:
{
  "intent": "read" | "create" | "update" | "unknown",
  "module": "tasks" | "vehicles" | "subscriptions" | "schedules" | null,
  "action": null | {
    "table": "vehicles" | "subscriptions" | "schedules" | "tasks",
    "op": "insert" | "update",
    "row_id": "uuid — לעדכון שורה בודדת. null אם מעדכן כמה שורות",
    "row_ids": ["uuid1", "uuid2"] | null,  // לעדכון כמה מטלות בבת אחת
    "fields": { ... },
    "needs_confirmation": true | false
  },
  "create_task": true | false,
  "read_reply": "תשובה בעברית — רק עבור intent=read, אחרת null"
}

כללים:
1. read — שלוף ופרמט ב-read_reply. action=null, create_task=false.
   שאלות לוח שעות: סנן lessons לפי child_id + day_of_week, מיין start_time.
   פורמט: <b>שם · יום X · בית ספר</b>\\nHH:MM–HH:MM · מקצוע\\nסיום ב-HH:MM
2. create + מטלה: create_task=true, action=null, read_reply=null.
3. create + רכב/מנוי/לו"ז: action.op="insert". אל תכלול family_id. read_reply=null.
   מנוי חודשי: billing_type="monthly", billing_day_of_month=N.
   מנוי שנתי: billing_type="yearly", renewal_date=ISO.
4. update שורה בודדת: action.op="update", row_id=uuid. needs_confirmation=true אם שינוי משמעותי. read_reply=null.
   update כמה מטלות: table="tasks", row_id=null, row_ids=["uuid1","uuid2",...]. מצא את ה-ids מ"מטלות שנוספו לאחרונה" או מהרשימה.
   "מטלות קודמות/אחרונות/שהוספתי" → השתמש ב-row_ids מ-recentTasks (שדה created_at הכי גדול).
   assignee מותר: "adi" | "tahel" | "both".
5. מעורפל / לא קיים: intent="read", read_reply=שאלה/הסבר קצר. action=null.
6. לא הבנתי: intent="unknown", read_reply=הצעות קצרות.

פורמט תאריכים: DD/MM/YYYY. סיכומי כספים — כלול שנתי.
חישוב ימים מ-${today}.`
}

// ── Call 2: Reply generation ──────────────────────────────────────────────────

const REPLY_SYSTEM = `אתה עוזר משפחתי. פעולה כבר בוצעה — תפקידך רק לנסח תגובה.

כללים:
- 1-2 משפטים בעברית. לא יותר.
- אשר את מה שנעשה בפועל (לפי snapshot שקיבלת).
- הוסף הקשר שימושי אם יש: תאריך קרוב, עלות, שם ילד.
- אם נכשל — הסבר קצר מה קרה + הצעה לפעולה.
- טון: חבר קצר, לא רובוט. אפשר להיות חם.
- אין סימני קריאה. אין מילות שבח ("מצוין", "אחלה").
- אין לשאול "האם לשמור?" — כבר נשמר.`

function buildReplyPrompt(userText: string, outcome: ActionOutcome): string {
  const parts = [`הודעת משתמש: "${userText}"`]

  if (outcome.success) {
    parts.push(`הפעולה הצליחה (${outcome.op})`)
    if (outcome.snapshot) parts.push(`נתונים שנשמרו: ${outcome.snapshot}`)
  } else {
    parts.push(`הפעולה נכשלה: ${outcome.error || 'שגיאה לא ידועה'}`)
  }

  parts.push('כתוב תגובה קצרה למשתמש.')
  return parts.join('\n')
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function extractIntent(
  text: string,
  familyId: string,
  timeoutMs = 5000
): Promise<BotDecision> {
  const ctx  = await loadContext(familyId)
  const prompt = buildIntentPrompt(text, ctx)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await client.messages.create(
      {
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: [{ type: 'text', text: 'החזר JSON בלבד. ללא backticks, ללא הסברים.', cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: controller.signal }
    )
  } finally {
    clearTimeout(timer)
  }

  const raw     = (response.content[0] as { type: string; text: string }).text.trim()
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: Partial<BotDecision & { read_reply?: string | null }> = {}
  try { parsed = JSON.parse(cleaned) } catch {
    return { intent: 'unknown', module: null, action: null, create_task: false,
             read_reply: 'לא הצלחתי לעבד. נסה שוב.' }
  }

  return {
    intent:      (parsed.intent || 'unknown') as BotIntent,
    module:      (parsed.module ?? null) as BotModule,
    action:      (parsed.action as BotAction) ?? null,
    create_task: Boolean(parsed.create_task),
    read_reply:  parsed.read_reply || undefined,
  }
}

export async function generateReply(
  userText: string,
  outcome: ActionOutcome,
  timeoutMs = 3000
): Promise<string> {
  const prompt = buildReplyPrompt(userText, outcome)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await client.messages.create(
      {
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        system: REPLY_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: controller.signal }
    )
  } catch {
    return outcome.success ? 'נשמר' : 'שגיאה'
  } finally {
    clearTimeout(timer)
  }

  return (response.content[0] as { type: string; text: string }).text.trim()
}

// ── Legacy shim — keeps existing webhook compiling during transition ──────────
// Remove once webhook is fully migrated.
export interface BotResult {
  intent: BotIntent
  module: BotModule
  reply: string
  action: BotAction | null
  create_task: boolean
}

/** @deprecated Use extractIntent + generateReply instead */
export async function processBotMessage(
  text: string,
  familyId: string,
  timeoutMs = 6000
): Promise<BotResult> {
  const decision = await extractIntent(text, familyId, timeoutMs)
  return {
    intent:      decision.intent,
    module:      decision.module,
    reply:       decision.read_reply || '',
    action:      decision.action,
    create_task: decision.create_task,
  }
}
