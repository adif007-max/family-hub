// Telegram-specific Hebrew formatters for digest, renewals, health, weekly.
import type { DigestData, DigestLesson } from './digest'
import type { RenewalItem } from './renewals'
import type { WeekSummaryData } from './weekSummary'
import { fmtDateHeb } from './digest'

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Priority icon ─────────────────────────────────────────────────────────────

const PRI: Record<string, string> = { urgent: '🔥', soon: '⏰', normal: '·', low: '·' }

function priIcon(p: string) { return PRI[p] || '·' }

// ── Task line ─────────────────────────────────────────────────────────────────

function taskLine(t: { text: string; priority: string; due_date?: string | null }, today?: string): string {
  const icon = priIcon(t.priority)
  const date = t.due_date && t.due_date !== today ? ` · 📅 ${fmtDateHeb(t.due_date, today)}` : ''
  return `${icon} ${esc(t.text)}${date}`
}

// ── Daily digest ──────────────────────────────────────────────────────────────

export function formatDigest(d: DigestData): string {
  const lines: string[] = []

  lines.push(`🌅 <b>בוקר טוב! יום ${d.dayHeb} · ${fmtDate(d.date)}</b>`)

  // Lessons grouped by child
  if (d.lessonsToday.length > 0) {
    const byChild: Record<string, DigestLesson[]> = {}
    for (const l of d.lessonsToday) {
      ;(byChild[l.childName] = byChild[l.childName] || []).push(l)
    }
    lines.push('')
    lines.push('📚 <b>מערכת שעות היום</b>')
    for (const [child, lessons] of Object.entries(byChild)) {
      const last = lessons[lessons.length - 1]
      lines.push(`  ${child}: ${lessons[0].start_time}–${last.end_time} · סיום ${last.end_time}`)
    }
  }

  // Activities
  if (d.activitiesToday.length > 0) {
    lines.push('')
    lines.push('🎯 <b>פעילויות היום</b>')
    for (const a of d.activitiesToday) {
      const child = a.childName ? ` · ${a.childName}` : ''
      const time = a.start_time ? ` ${a.start_time}` : ''
      lines.push(`  · ${esc(a.activityName)}${time}${child}`)
    }
  }

  // Tasks due today
  if (d.todayTasks.length > 0) {
    lines.push('')
    lines.push('✅ <b>מטלות להיום</b>')
    for (const t of d.todayTasks) lines.push(`  ${taskLine(t, d.date)}`)
  }

  // Overdue
  if (d.overdueTasks.length > 0) {
    lines.push('')
    lines.push(`⚠️ <b>באיחור (${d.overdueTasks.length})</b>`)
    for (const t of d.overdueTasks.slice(0, 5)) lines.push(`  ${taskLine(t, d.date)}`)
    if (d.overdueTasks.length > 5) lines.push(`  ... ועוד ${d.overdueTasks.length - 5}`)
  }

  // Urgent (not today)
  if (d.urgentTasks.length > 0) {
    lines.push('')
    lines.push(`🔥 <b>דחוף (${d.urgentTasks.length})</b>`)
    for (const t of d.urgentTasks.slice(0, 3)) lines.push(`  ${taskLine(t, d.date)}`)
  }

  // Upcoming bills
  if (d.upcomingBills.length > 0) {
    lines.push('')
    lines.push('💳 <b>חיובים קרובים</b>')
    for (const b of d.upcomingBills) {
      const when = b.daysLeft === 0 ? 'היום' : b.daysLeft === 1 ? 'מחר' : `בעוד ${b.daysLeft} ימים`
      const amt = b.amount ? ` · ${b.amount}${b.currency}` : ''
      lines.push(`  · ${esc(b.name)} — ${when}${amt}`)
    }
  }

  // Vehicle dates
  if (d.vehicleDates.length > 0) {
    lines.push('')
    lines.push('🚗 <b>תאריכים לרכב</b>')
    for (const v of d.vehicleDates) {
      const when = v.daysLeft <= 0 ? '⚠️ עבר!' : v.daysLeft <= 7 ? `🔴 בעוד ${v.daysLeft} ימים` : `בעוד ${v.daysLeft} ימים`
      lines.push(`  · ${esc(v.label)} — ${when}`)
    }
  }

  if (lines.length === 1) {
    lines.push('')
    lines.push('🎉 הכל שקט — אין מטלות, שיעורים, או תאריכים קרובים.')
  }

  return lines.join('\n')
}

// ── Renewals ──────────────────────────────────────────────────────────────────

export function formatRenewals(items: RenewalItem[], windowDays: number): string {
  if (!items.length) return `✅ אין תאריכי חידוש/פקיעה בחודשיים הקרובים.`

  const lines: string[] = [`📋 <b>חידושים בחלון ${windowDays} הימים הקרובים (${items.length})</b>`, '']

  const vehicles = items.filter(i => i.kind.startsWith('vehicle'))
  const subs = items.filter(i => i.kind.startsWith('sub'))

  if (vehicles.length) {
    lines.push('🚗 <b>רכב</b>')
    for (const v of vehicles) {
      const urgency = v.daysLeft <= 0 ? '🔴 עבר!' : v.daysLeft <= 7 ? '🔴' : v.daysLeft <= 14 ? '🟠' : '🟡'
      lines.push(`  ${urgency} ${esc(v.label)} — ${fmtDateHeb(v.date)} (בעוד ${v.daysLeft} ימים)`)
    }
    lines.push('')
  }

  if (subs.length) {
    lines.push('💳 <b>מנויים</b>')
    for (const s of subs) {
      const urgency = s.daysLeft === 0 ? '🔴 היום!' : s.daysLeft <= 3 ? '🔴' : s.daysLeft <= 7 ? '🟠' : '·'
      const amt = s.amount ? ` · ${s.amount}${s.currency || '₪'}` : ''
      lines.push(`  ${urgency} ${esc(s.label)} — ${fmtDateHeb(s.date)}${amt}`)
    }
  }

  return lines.join('\n')
}

// ── Health check ──────────────────────────────────────────────────────────────

export interface HealthData {
  staleCount: number     // open tasks > 14 days with no due date
  overdueCount: number
  urgentUnassigned: number
  overloadedAssignee: string | null  // 'adi' or 'tahel' if > 8 tasks
  subscriptionsMissingCost: string[]
  renewalsUrgent: RenewalItem[]
}

export function formatHealth(h: HealthData): string {
  const issues: string[] = []

  if (h.overdueCount > 0)
    issues.push(`⏰ <b>${h.overdueCount} מטלות באיחור</b> — נפלו בין הכיסאות`)

  if (h.urgentUnassigned > 0)
    issues.push(`🔥 <b>${h.urgentUnassigned} דחופות</b> בלי תאריך יעד`)

  if (h.staleCount > 0)
    issues.push(`📦 <b>${h.staleCount} מטלות ישנות</b> (14+ ימים, בלי תאריך)`)

  if (h.overloadedAssignee)
    issues.push(`👤 <b>${h.overloadedAssignee === 'adi' ? 'עדי' : 'תהלה'}</b> עמוס/ה (8+ מטלות פתוחות)`)

  if (h.subscriptionsMissingCost.length)
    issues.push(`💳 מנויים בלי עלות: ${h.subscriptionsMissingCost.map(esc).join(', ')}`)

  for (const r of h.renewalsUrgent)
    issues.push(`🚨 ${esc(r.label)} — פג/יפוג בעוד ${r.daysLeft} ימים`)

  if (!issues.length) return '✅ <b>הכל תקין!</b> אין פריטים שנופלים בין הכיסאות.'

  return [`🔍 <b>בדיקת בריאות</b>`, '', ...issues].join('\n')
}

// ── Weekly summary ────────────────────────────────────────────────────────────

export function formatWeekSummary(s: WeekSummaryData): string {
  const [, wm, wd] = s.weekStart.split('-')
  const [, em, ed] = s.weekEnd.split('-')
  const lines: string[] = [`📊 <b>סיכום שבוע · ${wd}/${wm} – ${ed}/${em}</b>`, '']

  lines.push(`✅ <b>הושלמו:</b> ${s.completedTasks.length}`)
  for (const t of s.completedTasks.slice(0, 8)) lines.push(`  · ${esc(t.text)}`)
  if (s.completedTasks.length > 8) lines.push(`  ... ועוד ${s.completedTasks.length - 8}`)

  lines.push('')
  lines.push(`📋 <b>פתוחות: ${s.openTasks.length}</b>${s.urgentOpen ? ` · 🔥 ${s.urgentOpen} דחופות` : ''}`)
  for (const t of s.openTasks.slice(0, 6)) {
    const due = t.due_date ? ` · 📅 ${fmtDateHeb(t.due_date)}` : ''
    lines.push(`  ${PRI[t.priority] || '·'} ${esc(t.text)}${due}`)
  }
  if (s.openTasks.length > 6) lines.push(`  ... ועוד ${s.openTasks.length - 6}`)

  if (s.overdueTasks.length) {
    lines.push('')
    lines.push(`⚠️ <b>באיחור: ${s.overdueTasks.length}</b>`)
    for (const t of s.overdueTasks.slice(0, 4)) lines.push(`  · ${esc(t.text)} (${fmtDateHeb(t.due_date)})`)
  }

  if (s.renewalsNext14.length) {
    lines.push('')
    lines.push('🗓 <b>חידושים ב-14 ימים הקרובים</b>')
    for (const r of s.renewalsNext14) lines.push(`  · ${esc(r.label)} — ${fmtDateHeb(r.date)}`)
  }

  return lines.join('\n')
}

// ── /done task list ───────────────────────────────────────────────────────────

export function formatDoneList(tasks: { id: string; text: string; priority: string; due_date: string | null }[], today: string): string {
  if (!tasks.length) return '🎉 אין מטלות פתוחות כרגע.'
  const lines = [`📋 <b>סמן כבוצע — שלח מספר:</b>`, '']
  tasks.forEach((t, i) => {
    const due = t.due_date && t.due_date < today ? ` ⚠️` : t.due_date === today ? ' · היום' : ''
    lines.push(`${i + 1}. ${priIcon(t.priority)} ${esc(t.text)}${due}`)
  })
  return lines.join('\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}/${iso.slice(0, 4)}`
}
