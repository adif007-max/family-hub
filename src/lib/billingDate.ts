// Shared billing-date utility — used by digest, renewals, ensureReminders, InfoTab.
// Single source of truth for "next charge date" logic.

export interface BillableSubscription {
  billing_type?: string | null
  billing_day_of_month?: number | null
  renewal_date?: string | null
}

/**
 * Returns the next billing date ISO string for a subscription, or null if unknown.
 * For monthly: next occurrence of billing_day_of_month from todayStr (inclusive if today).
 * For yearly: renewal_date as-is.
 */
export function nextBillingDate(s: BillableSubscription, todayStr: string): string | null {
  const type = s.billing_type || 'yearly'
  if (type === 'monthly') {
    const day = s.billing_day_of_month
    if (!day) return null
    const todayD = new Date(todayStr + 'T00:00:00')
    // candidate = this month's billing day
    let candidate = new Date(todayD.getFullYear(), todayD.getMonth(), day)
    // clamp to end of month (e.g. day=31 in February → last valid day)
    const maxDay = new Date(todayD.getFullYear(), todayD.getMonth() + 1, 0).getDate()
    if (day > maxDay) candidate = new Date(todayD.getFullYear(), todayD.getMonth(), maxDay)
    // if candidate is before today, roll to next month
    if (candidate < todayD) {
      candidate = new Date(todayD.getFullYear(), todayD.getMonth() + 1, day)
      const maxDay2 = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()
      if (day > maxDay2) candidate = new Date(candidate.getFullYear(), candidate.getMonth(), maxDay2)
    }
    return candidate.toISOString().split('T')[0]
  }
  return s.renewal_date || null
}
