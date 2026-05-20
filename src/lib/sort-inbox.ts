// Shared inbox-sort logic — used by /api/sort-inbox AND the Telegram webhook.
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase-admin'

const client = new Anthropic()

export type SortedItem = {
  text: string
  cat: 'home' | 'medical' | 'studies' | 'hobbies' | 'formal' | 'finance' | 'miluim'
  priority: 'urgent' | 'soon' | 'normal'
  assignee: 'adi' | 'tahel' | 'both'
  related_member_ids: string[]
}

type Member = { id: string; name: string; nicknames: string[] }

async function loadMembers(familyId: string): Promise<Member[]> {
  const { data } = await supabaseAdmin
    .from('family_members')
    .select('id,name,nicknames')
    .eq('family_id', familyId)
    .eq('is_active', true)
  return data || []
}

function buildPrompt(items: string[], members: Member[]): string {
  const membersBlock = members.length
    ? `\nילדי המשפחה (לזהות אזכורים בקונטקסט בלבד — אל תזהה false positives כמו "הלל את הקפה"):\n${members.map(m => {
        const nicks = m.nicknames.length ? ` (גם: ${m.nicknames.join(', ')})` : ''
        return `- ${m.name} [id: ${m.id}]${nicks}`
      }).join('\n')}\n`
    : ''

  return `אתה עוזר משפחתי לניהול מטלות. סווג כל פריט.

קטגוריות:
- home: בית, קניות, תיקונים, נקיון
- medical: רפואה, תורים, תרופות
- studies: לימודים, עבודה, קורסים
- hobbies: חוגים, פעילויות, טיפולים
- formal: גן, בית ספר, אסיפות
- finance: כספים, תשלומים, מיסים
- miluim: מילואים, צבא, ציוד

עדיפויות:
- urgent: דחוף, היום, חירום
- soon: השבוע, בקרוב
- normal: ברירת מחדל

הקצאה (מי יבצע) — חובה אחד משלושה ערכים בלבד: "adi", "tahel", "both":
- adi: עדי (אם נאמר "אני אקנה" / "עדי יעשה")
- tahel: תהלה (אם נאמר "תהלה תקבע" / "אשתי תעשה")
- both: ברירת מחדל אם לא ברור

חשוב: ילדים אף פעם לא assignee! גם אם מטלה היא עבור ילד ("תור שיניים לנעמי", "אסיפת הורים להלל") — ה-assignee הוא ההורה שיבצע (adi/tahel/both), והילד נכנס ל-related_member_ids בלבד.
${membersBlock}
חשוב: אם פריט מכיל מספר מטלות שונות (מופרדות ב-+, פסיק, או "ו"), פצל למספר אובייקטים.

ענה ב-JSON בלבד (ללא markdown), מערך של אובייקטים:
[{"text": "...", "cat": "...", "priority": "...", "assignee": "...", "related_member_ids": ["uuid", ...]}]

related_member_ids — מערך של ה-id-ים של הילדים שמוזכרים במטלה. אם אין — מערך ריק [].

פריטים לסיווג:
${items.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
}

export async function sortInbox(items: string[], familyId: string): Promise<SortedItem[]> {
  if (!items?.length) return []

  const members = await loadMembers(familyId)
  const prompt = buildPrompt(items, members)

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const parsed = JSON.parse(cleaned)
  const arr = Array.isArray(parsed) ? parsed : [parsed]

  const VALID_ASSIGNEE = new Set(['adi', 'tahel', 'both'])
  const VALID_PRIORITY = new Set(['urgent', 'soon', 'normal'])
  const VALID_CAT = new Set(['home','medical','studies','hobbies','formal','finance','miluim'])
  const memberIds = new Set(members.map(m => m.id))

  // Normalize: ensure all fields present with safe defaults; reject invalid values
  return arr.map((x: Partial<SortedItem>) => ({
    text: x.text || '',
    cat: (x.cat && VALID_CAT.has(x.cat) ? x.cat : 'home') as SortedItem['cat'],
    priority: (x.priority && VALID_PRIORITY.has(x.priority) ? x.priority : 'normal') as SortedItem['priority'],
    assignee: (x.assignee && VALID_ASSIGNEE.has(x.assignee) ? x.assignee : 'both') as SortedItem['assignee'],
    related_member_ids: Array.isArray(x.related_member_ids)
      ? x.related_member_ids.filter(id => memberIds.has(id))
      : [],
  }))
}
