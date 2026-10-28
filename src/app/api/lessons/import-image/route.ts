import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const DAY_MAP: Record<string, string> = {
  'ראשון': 'sun', 'א': 'sun', 'sun': 'sun',
  'שני':   'mon', 'ב': 'mon', 'mon': 'mon',
  'שלישי': 'tue', 'ג': 'tue', 'tue': 'tue',
  'רביעי': 'wed', 'ד': 'wed', 'wed': 'wed',
  'חמישי': 'thu', 'ה': 'thu', 'thu': 'thu',
  'שישי':  'fri', 'ו': 'fri', 'fri': 'fri',
  'שבת':   'sat', 'ש': 'sat', 'sat': 'sat',
}

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType, childId, familyId, schoolName } = await req.json()

  if (!imageBase64 || !familyId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    system: 'אתה מחלץ מערכת שעות מתמונה. החזר JSON בלבד ללא backticks.',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 },
        },
        {
          type: 'text',
          text: `חלץ את מערכת השעות מהתמונה. החזר מערך JSON של שיעורים בפורמט זה:
[
  {
    "day_of_week": "sun"/"mon"/"tue"/"wed"/"thu"/"fri"/"sat",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "subject": "שם המקצוע",
    "teacher": "שם המורה או null"
  }
]
ימים בעברית: ראשון=sun, שני=mon, שלישי=tue, רביעי=wed, חמישי=thu, שישי=fri.
אם אין שעת סיום, העריך לפי שעת ההתחלה + 45 דקות.
החזר מערך JSON בלבד.`,
        },
      ],
    }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let lessons: unknown[]
  try {
    lessons = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'parse error', raw }, { status: 422 })
  }

  const rows = (lessons as Record<string, string>[])
    .filter(l => l.subject && l.start_time && l.day_of_week)
    .map(l => ({
      family_id:   familyId,
      child_id:    childId || null,
      school_name: schoolName || null,
      day_of_week: DAY_MAP[l.day_of_week] || l.day_of_week,
      start_time:  l.start_time,
      end_time:    l.end_time || null,
      subject:     l.subject,
      teacher:     l.teacher || null,
    }))

  return NextResponse.json({ rows, count: rows.length })
}
