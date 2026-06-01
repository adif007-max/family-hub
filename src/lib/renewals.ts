// Upcoming renewals — vehicles + subscriptions — for any time window.
// Used by bot "מה עומד לפוג?" and health check.
import { supabaseAdmin } from './supabase-admin'
import { israelToday, daysFromToday } from './digest'
import { nextBillingDate } from './billingDate'

export type RenewalKind = 'vehicle_test' | 'vehicle_insurance' | 'sub_monthly' | 'sub_yearly'

export interface RenewalItem {
  kind: RenewalKind
  label: string
  date: string
  daysLeft: number
  amount?: number | null
  currency?: string
}

export async function getUpcomingRenewals(
  familyId: string,
  windowDays = 60
): Promise<RenewalItem[]> {
  const today = israelToday()
  const todayD = new Date(today + 'T00:00:00')

  const [vehiclesRes, subsRes] = await Promise.all([
    supabaseAdmin
      .from('vehicles')
      .select('make,model,test_expiry_date,insurance_renewal_date')
      .eq('family_id', familyId),
    supabaseAdmin
      .from('subscriptions')
      .select('name,monthly_cost,currency,billing_type,billing_day_of_month,renewal_date')
      .eq('family_id', familyId),
  ])

  const items: RenewalItem[] = []

  for (const v of vehiclesRes.data || []) {
    const name = [v.make, v.model].filter(Boolean).join(' ')
    if (v.test_expiry_date) {
      const d = daysFromToday(v.test_expiry_date, today)
      if (d >= -1 && d <= windowDays)
        items.push({ kind: 'vehicle_test', label: `טסט — ${name}`, date: v.test_expiry_date, daysLeft: d })
    }
    if (v.insurance_renewal_date) {
      const d = daysFromToday(v.insurance_renewal_date, today)
      if (d >= -1 && d <= windowDays)
        items.push({ kind: 'vehicle_insurance', label: `ביטוח — ${name}`, date: v.insurance_renewal_date, daysLeft: d })
    }
  }

  for (const s of subsRes.data || []) {
    const kind: RenewalKind = (s.billing_type || 'yearly') === 'monthly' ? 'sub_monthly' : 'sub_yearly'
    const billDate = nextBillingDate(s, today)
    if (!billDate) continue
    const d = daysFromToday(billDate, today)
    if (d >= 0 && d <= windowDays)
      items.push({ kind, label: s.name as string, date: billDate, daysLeft: d, amount: s.monthly_cost as number | null, currency: (s.currency || '₪') as string })
  }

  return items.sort((a, b) => a.daysLeft - b.daysLeft)
}
