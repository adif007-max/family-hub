// Daily digest builder — reusable across bot /today and morning cron.
// All date logic uses Asia/Jerusalem timezone.
import { supabaseAdmin } from './supabase-admin'

// ── Timezone helpers ─────────────────────────────────────────────────────────

export function israelToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}

export function israelDow(): number {
  // Returns 0=Sun … 6=Sat in Israel time
  const s = israelToday()
  return new Date(s + 'T12:00:00').getDay()
}

const DOW_TO_STR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const HEB_DAY_NAME = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const HEB_DAY_SHORT = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש']

export function dowToHeb(dow: number): string { return HEB_DAY_NAME[dow] }
export function dowStr(dow: number): string { return DOW_TO_STR[dow] }

// ── Shared date helper ────────────────────────────────────────────────────────

export function daysFromToday(isoDate: string, todayStr?: string): number {
  const t = todayStr || israelToday()
  return Math.round(
    (new Date(isoDate + 'T00:00:00').getTime() - new Date(t + 'T00:00:00').getTime()) / 86_400_000
  )
}

export function fmtDateHeb(iso: string, todayStr?: string): string {
  const t = todayStr || israelToday()
  const d = daysFromToday(iso, t)
  if (d === 0) return 'היום'
  if (d === 1) return 'מחר'
  if (d === -1) return 'אתמול'
  const [, m, day] = iso.split('-')
  return `${day}/${m}`
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DigestTask {
  id: string; text: string; category: string; priority: string
  assignee: string; due_date: string | null
}

export interface DigestLesson {
  childName: string; subject: string; start_time: string; end_time: string; teacher: string | null
}

export interface DigestActivity {
  activityName: string; childName?: string; start_time: string | null; end_time: string | null; location?: string | null
}

export interface DigestData {
  date: string          // "2026-06-01"
  dayHeb: string        // "שני"
  todayTasks: DigestTask[]
  overdueTasks: DigestTask[]
  urgentTasks: DigestTask[]
  lessonsToday: DigestLesson[]     // grouped by child, sorted by time
  activitiesToday: DigestActivity[]
  vehicleDates: { label: string; date: string; daysLeft: number }[]
  upcomingBills: { name: string; amount: number | null; currency: string; date: string; daysLeft: number }[]
}

// ── Builder ───────────────────────────────────────────────────────────────────

export async function buildDailyDigest(familyId: string): Promise<DigestData> {
  const today = israelToday()
  const dow = israelDow()
  const todayDow = DOW_TO_STR[dow]
  const todayDowHebShort = HEB_DAY_SHORT[dow]

  const [tasksRes, membersRes, lessonsRes, schedulesRes, vehiclesRes, subsRes] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select('id,text,category,priority,assignee,due_date')
      .eq('family_id', familyId)
      .eq('done', false)
      .order('priority')
      .order('due_date', { nullsFirst: false }),
    supabaseAdmin
      .from('family_members')
      .select('id,name,gender')
      .eq('family_id', familyId)
      .eq('is_active', true),
    supabaseAdmin
      .from('lessons')
      .select('child_id,subject,start_time,end_time,teacher')
      .eq('family_id', familyId)
      .eq('day_of_week', todayDow)
      .order('start_time'),
    supabaseAdmin
      .from('schedules')
      .select('child_id,activity_name,days_of_week,start_time,end_time,location')
      .eq('family_id', familyId),
    supabaseAdmin
      .from('vehicles')
      .select('make,model,test_expiry_date,insurance_renewal_date')
      .eq('family_id', familyId),
    supabaseAdmin
      .from('subscriptions')
      .select('name,monthly_cost,currency,billing_type,billing_day_of_month,renewal_date')
      .eq('family_id', familyId),
  ])

  const memberMap = Object.fromEntries((membersRes.data || []).map(m => [m.id, m.name as string]))

  // Tasks
  const allTasks = (tasksRes.data || []) as DigestTask[]
  const todayTasks = allTasks.filter(t => t.due_date === today)
  const overdueTasks = allTasks.filter(t => t.due_date && t.due_date < today)
  const urgentTasks = allTasks.filter(t =>
    t.priority === 'urgent' && t.due_date !== today && (!t.due_date || t.due_date > today)
  )

  // Lessons today — grouped by child
  const lessonsToday: DigestLesson[] = (lessonsRes.data || []).map(l => ({
    childName: memberMap[l.child_id] || '?',
    subject: l.subject as string,
    start_time: l.start_time as string,
    end_time: l.end_time as string,
    teacher: l.teacher as string | null,
  }))

  // Activities/schedules today — match days_of_week containing today's Hebrew letter or dow string
  const activitiesToday: DigestActivity[] = (schedulesRes.data || [])
    .filter(s =>
      s.days_of_week?.includes(todayDowHebShort) ||
      s.days_of_week?.includes(todayDow)
    )
    .map(s => ({
      activityName: s.activity_name as string,
      childName: s.child_id ? memberMap[s.child_id] : undefined,
      start_time: s.start_time as string | null,
      end_time: s.end_time as string | null,
      location: s.location as string | null,
    }))

  // Vehicle dates < 30 days
  const vehicleDates: DigestData['vehicleDates'] = []
  for (const v of vehiclesRes.data || []) {
    const name = [v.make, v.model].filter(Boolean).join(' ')
    for (const [field, label] of [
      [v.test_expiry_date, `טסט — ${name}`],
      [v.insurance_renewal_date, `ביטוח — ${name}`],
    ] as [string | null, string][]) {
      if (!field) continue
      const d = daysFromToday(field, today)
      if (d >= -1 && d < 30) vehicleDates.push({ label, date: field, daysLeft: d })
    }
  }

  // Upcoming bills ≤ 6 days (for digest; full 60-day window is in renewals.ts)
  const upcomingBills: DigestData['upcomingBills'] = []
  for (const s of subsRes.data || []) {
    let billDate: string | null = null
    if ((s.billing_type || 'yearly') === 'monthly' && s.billing_day_of_month) {
      const todayD = new Date(today + 'T00:00:00')
      const c = new Date(todayD.getFullYear(), todayD.getMonth(), s.billing_day_of_month)
      if (c <= todayD) c.setMonth(c.getMonth() + 1)
      billDate = c.toISOString().split('T')[0]
    } else {
      billDate = s.renewal_date
    }
    if (!billDate) continue
    const d = daysFromToday(billDate, today)
    if (d >= 0 && d <= 6)
      upcomingBills.push({ name: s.name as string, amount: s.monthly_cost as number | null, currency: (s.currency || '₪') as string, date: billDate, daysLeft: d })
  }

  return {
    date: today,
    dayHeb: HEB_DAY_NAME[dow],
    todayTasks,
    overdueTasks,
    urgentTasks,
    lessonsToday,
    activitiesToday,
    vehicleDates,
    upcomingBills,
  }
}
