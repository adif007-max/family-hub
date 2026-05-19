import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { items } = await req.json()
  if (!items?.length) return NextResponse.json({ error: 'no items' }, { status: 400 })

  const prompt = `אתה עוזר משפחתי לניהול מטלות. סווג כל פריט לקטגוריה ועדיפות.

קטגוריות אפשריות:
- home: בית, קניות, תיקונים, נקיון
- medical: רפואה, תורים, תרופות, חיסונים
- studies: לימודים, עבודה, קורסים, בחינות
- hobbies: חוגים, פעילויות ילדים, טיפולים
- formal: מסגרות חינוך, גן, בית ספר, אסיפות
- finance: כספים, תשלומים, ביטוח, מיסים
- miluim: מילואים, צבא, ציוד

עדיפויות:
- urgent: דחוף מאוד, היום, חירום
- soon: השבוע, בקרוב
- normal: ברירת מחדל

חשוב: אם פריט מכיל מספר מטלות שונות (מופרדות ב-+, פסיק, או "ו"), פצל אותו למספר אובייקטים נפרדים.

ענה ב-JSON בלבד (ללא markdown), מערך של אובייקטים:
[{"text": "...", "cat": "...", "priority": "..."}]

פריטים לסיווג:
${items.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  // strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const parsed = JSON.parse(cleaned)
  // ensure it's always an array
  const result = Array.isArray(parsed) ? parsed : [parsed]
  return NextResponse.json({ result })
}
