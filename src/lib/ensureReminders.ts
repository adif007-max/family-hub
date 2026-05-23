// Auto-reminder seeding: looks at vehicle/subscription expiry dates and
// creates a single task per fact when the date is < 30 days away.
// Idempotent — uses source_fact_id to skip facts that already have a reminder.
import { Task, Vehicle, Subscription } from './types'
import { supabase } from './supabase'

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(iso); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

type Plan = {
  source_fact_id: string
  source_fact_table: 'vehicles' | 'subscriptions'
  text: string
  due_date: string
  priority: 'urgent' | 'normal'
}

function planVehicle(v: Vehicle): Plan[] {
  const out: Plan[] = []
  const name = [v.make, v.model].filter(Boolean).join(' ')
  if (v.test_expiry_date) {
    const d = daysUntil(v.test_expiry_date)
    if (d !== null && d < 30 && d >= -1) {
      out.push({
        source_fact_id: v.id,
        source_fact_table: 'vehicles',
        text: `תזכורת: טסט ${name}`,
        due_date: v.test_expiry_date,
        priority: d < 7 ? 'urgent' : 'normal',
      })
    }
  }
  if (v.insurance_renewal_date) {
    const d = daysUntil(v.insurance_renewal_date)
    if (d !== null && d < 30 && d >= -1) {
      out.push({
        source_fact_id: v.id,
        source_fact_table: 'vehicles',
        text: `תזכורת: ביטוח ${name}`,
        due_date: v.insurance_renewal_date,
        priority: d < 7 ? 'urgent' : 'normal',
      })
    }
  }
  return out
}

function planSubscription(s: Subscription): Plan[] {
  if (!s.renewal_date) return []
  const d = daysUntil(s.renewal_date)
  if (d === null || d >= 30 || d < -1) return []
  return [{
    source_fact_id: s.id,
    source_fact_table: 'subscriptions',
    text: `תזכורת: חידוש ${s.name}`,
    due_date: s.renewal_date,
    priority: d < 7 ? 'urgent' : 'normal',
  }]
}

export async function ensureReminders(
  familyId: string,
  tasks: Task[],
  vehicles: Vehicle[],
  subscriptions: Subscription[],
) {
  if (!familyId) return

  // Build the set of (table:id) keys already represented by tasks
  const existing = new Set(
    tasks
      .filter(t => t.source_fact_id && t.source_fact_table)
      .map(t => `${t.source_fact_table}:${t.source_fact_id}:${t.due_date}`)
  )

  const plans: Plan[] = [
    ...vehicles.flatMap(planVehicle),
    ...subscriptions.flatMap(planSubscription),
  ]

  const fresh = plans.filter(p => !existing.has(`${p.source_fact_table}:${p.source_fact_id}:${p.due_date}`))
  if (!fresh.length) return

  const rows = fresh.map(p => ({
    family_id: familyId,
    text: p.text,
    category: 'formal',
    assignee: 'both',
    priority: p.priority,
    due_date: p.due_date,
    recur: '',
    note: '',
    done: false,
    related_member_ids: [],
    source_fact_id: p.source_fact_id,
    source_fact_table: p.source_fact_table,
  }))

  const { error } = await supabase.from('tasks').insert(rows)
  if (error) console.error('ensureReminders insert failed', error)
}
