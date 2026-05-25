// Bot brain — one Haiku call per user message. Receives full family context,
// returns a classified intent + user-facing reply + optional DB action.
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase-admin'

const client = new Anthropic()

export type BotIntent = 'read' | 'create' | 'update' | 'unknown'
export type BotModule = 'tasks' | 'vehicles' | 'subscriptions' | 'schedules' | null

export interface BotAction {
  table: 'vehicles' | 'subscriptions' | 'schedules'
  op: 'insert' | 'update'
  row_id: string | null
  fields: Record<string, unknown>
  needs_confirmation: boolean
}

export interface BotResult {
  intent: BotIntent
  module: BotModule
  reply: string
  action: BotAction | null
  create_task: boolean
}

interface Ctx {
  vehicles: unknown[]
  subscriptions: unknown[]
  schedules: unknown[]
  members: unknown[]
  tasks: unknown[]
}

async function loadContext(familyId: string): Promise<Ctx> {
  const [v, s, sc, m, t] = await Promise.all([
    supabaseAdmin.from('vehicles').select('*').eq('family_id', familyId),
    supabaseAdmin.from('subscriptions').select('*').eq('family_id', familyId),
    supabaseAdmin.from('schedules').select('*').eq('family_id', familyId),
    supabaseAdmin.from('family_members').select('*').eq('family_id', familyId).eq('is_active', true),
    supabaseAdmin.from('tasks')
      .select('id,text,category,priority,due_date,assignee,done,related_member_ids')
      .eq('family_id', familyId).eq('done', false).order('due_date', { nullsFirst: false }).limit(40),
  ])
  return {
    vehicles: v.data || [],
    subscriptions: s.data || [],
    schedules: sc.data || [],
    members: m.data || [],
    tasks: t.data || [],
  }
}

function buildPrompt(text: string, ctx: Ctx): string {
  const today = new Date().toISOString().split('T')[0]
  return `אתה עוזר משפחתי לבוט טלגרם של משפחת פינקלשטיין. ענה תמיד בעברית.

תאריך היום: ${today}

נתוני המשפחה:

רכבים:
${JSON.stringify(ctx.vehicles, null, 1)}

מנויים:
${JSON.stringify(ctx.subscriptions, null, 1)}

לו"ז:
${JSON.stringify(ctx.schedules, null, 1)}

ילדים (active):
${JSON.stringify(ctx.members, null, 1)}

מטלות פתוחות (עד 40):
${JSON.stringify(ctx.tasks, null, 1)}

ההודעה שהמשתמש שלח:
"${text}"

נתח את הכוונה והחזר JSON בלבד (בלי backticks, בלי הסבר), במבנה:

{
  "intent": "read" | "create" | "update" | "unknown",
  "module": "tasks" | "vehicles" | "subscriptions" | "schedules" | null,
  "reply": "טקסט בעברית שיוצג למשתמש בטלגרם (HTML של Telegram מותר: <b>, <i>)",
  "action": null או {
    "table": "vehicles" | "subscriptions" | "schedules",
    "op": "insert" | "update",
    "row_id": "uuid מהנתונים שהוצגו לך, או null עבור insert",
    "fields": { ... },
    "needs_confirmation": true | false
  },
  "create_task": true | false
}

כללים:
1. read (שאלה): שלוף מהנתונים, פרמט יפה ב-reply. action=null, create_task=false.
2. create + מטלה: create_task=true, action=null. ה-reply יהיה "✅ מוסיף..." קצר — pipeline חיצוני יטפל בסיווג. module="tasks".
3. create + רכב/מנוי/לו"ז: action.op="insert", table=המודול הנכון. כתוב fields ישירות (אל תכלול family_id, השרת מוסיף). reply = "✅ נוסף..." עם פרטים. needs_confirmation=false (יצירה לא דורשת אישור).
   מנוי חודשי: הכנס billing_type="monthly" ו-billing_day_of_month=<מספר יום>, ואל תכניס renewal_date.
   מנוי שנתי: הכנס billing_type="yearly" ו-renewal_date=<תאריך ISO>, ואל תכניס billing_day_of_month.
4. update: action.op="update", row_id=ה-id מהנתונים שהוצגו לך. fields=רק השדות שמשתנים. needs_confirmation=true אם השינוי משמעותי (תאריך, מחיר, מספר טלפון, סטטוס פוליסה). reply במקרה הזה יציג "האם לעדכן?\n<old> → <new>\nשלח 'כן' לאישור." (שורה נפרדת לכל חלק). needs_confirmation=false רק לתיקוני הקלדה קטנים או notes.
5. שאלה מעורפלת (2+ רשומות אפשריות): intent="read", action=null, reply=מציג רשימה ושואל "איזה?".
6. רשומה לא קיימת ("מתי הטסט?" ואין רכבים): intent="read", reply="אין רכבים במאגר. הוסף דרך לשונית 'מידע' באתר."
7. לא הבנתי: intent="unknown", reply=הצעות (דוגמאות: "מתי הטסט?", "כמה אני משלם על מנויים?", "תוסיף תור שיניים").

פורמט תאריכים בעברית: DD/MM/YYYY. ימים: א, ב, ג, ד, ה, ו, ש. שמות חודשים בעברית כשמתאים.
חישוב "בעוד X ימים" בקפדנות מ-${today}.
לסיכומי כספים — כלול גם שנתי (מחודש × 12).

דוגמאות פורמט reply (העתק את המבנה, החלף ערכים):

🚗 <b>סקודה קודיאק 2019</b>
טסט: 05/07/2026 (בעוד 41 ימים)
ביטוח: 31/07/2026

💳 <b>מנויים פעילים</b>
• ספוטיפיי · 32.90₪/חודש · מחויב ביום 3 בכל חודש
• נטפליקס · 60.00₪/חודש · מחויב ביום 15 בכל חודש
• אנטיוירוס · 120₪/שנה · חידוש 01/09/2026
─────
סה"כ: <b>92.90₪/חודש</b>
שנתי: 1,114.80₪

👧 <b>רחל</b>
🏫 גן חובה
ימים: ב, ג, ד, ה · 07:30-13:00

האם לעדכן?
סקודה קודיאק — טסט: <b>05/07/2026</b> → <b>15/08/2026</b>
שלח "כן" לאישור.

✅ עודכן: סקודה קודיאק
טסט: 15/08/2026`
}

export async function processBotMessage(text: string, familyId: string, timeoutMs = 6000): Promise<BotResult> {
  const ctx = await loadContext(familyId)
  const prompt = buildPrompt(text, ctx)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await client.messages.create(
      { model: 'claude-haiku-4-5', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] },
      { signal: controller.signal }
    )
  } finally {
    clearTimeout(timer)
  }

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const parsed = JSON.parse(cleaned) as Partial<BotResult>

  // Normalize defensively
  return {
    intent: (parsed.intent || 'unknown') as BotIntent,
    module: (parsed.module ?? null) as BotModule,
    reply: parsed.reply || 'לא הצלחתי להבין. נסה שוב.',
    action: parsed.action ?? null,
    create_task: Boolean(parsed.create_task),
  }
}
