// Weekly summary builder — used by /week command and Friday cron.
import { supabaseAdmin } from './supabase-admin'
import { israelToday } from './digest'
import { getUpcomingRenewals } from './renewals'

export interface WeekSummaryData {
  weekStart: string   // ISO "2026-06-01"
  weekEnd: string
  completedTasks: { text: string; done_at: string | null }[]
  openTasks: { id: string; text: string; priority: string; due_date: string | null }[]
  overdueTasks: { text: string; due_date: string }[]
  urgentOpen: number
  renewalsNext14: { label: string; date: string; daysLeft: number }[]
}

export async function buildWeekSummary(familyId: string): Promise<WeekSummaryData> {
  const today = israelToday()
  const todayD = new Date(today + 'T00:00:00')

  // Week boundaries: Sunday → Saturday containing today
  const weekStartD = new Date(todayD)
  weekStartD.setDate(todayD.getDate() - todayD.getDay())
  const weekEndD = new Date(weekStartD)
  weekEndD.setDate(weekStartD.getDate() + 6)

  const weekStart = weekStartD.toISOString().split('T')[0]
  const weekEnd = weekEndD.toISOString().split('T')[0]

  const [doneRes, openRes, renewals] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select('text,done_at')
      .eq('family_id', familyId)
      .eq('done', true)
      .gte('done_at', weekStart + 'T00:00:00')
      .order('done_at', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('tasks')
      .select('id,text,priority,due_date')
      .eq('family_id', familyId)
      .eq('done', false)
      .order('priority')
      .order('due_date', { nullsFirst: false }),
    getUpcomingRenewals(familyId, 14),
  ])

  const open = (openRes.data || []) as { id: string; text: string; priority: string; due_date: string | null }[]

  return {
    weekStart,
    weekEnd,
    completedTasks: (doneRes.data || []) as { text: string; done_at: string | null }[],
    openTasks: open.filter(t => !t.due_date || t.due_date >= today),
    overdueTasks: open.filter(t => t.due_date && t.due_date < today).map(t => ({ text: t.text, due_date: t.due_date! })),
    urgentOpen: open.filter(t => t.priority === 'urgent').length,
    renewalsNext14: renewals.map(r => ({ label: r.label, date: r.date, daysLeft: r.daysLeft })),
  }
}
