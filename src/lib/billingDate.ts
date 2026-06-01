// Shared billing-date utility — used by digest, renewals, ensureReminders, InfoTab.
// Single source of truth for "next charge date" logic.

export interface BillableSubscription {
  billing_type?: string | null
  billing_day_of_month?: number | null
  renewal_date?: string | null
}

/** Last day of a given year+month (0-indexed month). */
function lastDayOf(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Returns the next billing date ISO string for a subscription, or null if unknown.
 *
 * Monthly: next occurrence of billing_day_of_month on or after todayStr.
 *   - day > max days in month → clamped to last day (e.g. 31 in Feb → 28/29).
 *   - Handles February, leap years, and 30-day months without JS Date overflow.
 * Yearly: returns renewal_date as-is.
 */
export function nextBillingDate(s: BillableSubscription, todayStr: string): string | null {
  const type = s.billing_type || 'yearly'

  if (type === 'monthly') {
    const day = s.billing_day_of_month
    if (!day) return null

    const todayD = new Date(todayStr + 'T00:00:00')
    const y = todayD.getFullYear()
    const m = todayD.getMonth()           // 0-indexed

    // Try this month first
    const thisMonthMax    = lastDayOf(y, m)
    const thisMonthActual = Math.min(day, thisMonthMax)
    const candidate       = new Date(y, m, thisMonthActual)

    if (candidate >= todayD) return candidate.toISOString().split('T')[0]

    // Roll to next calendar month — compute year/month explicitly (no overflow)
    const nextMonth = m === 11 ? 0 : m + 1
    const nextYear  = m === 11 ? y + 1 : y
    const nextMax   = lastDayOf(nextYear, nextMonth)
    const nextDay   = Math.min(day, nextMax)

    return new Date(nextYear, nextMonth, nextDay).toISOString().split('T')[0]
  }

  return s.renewal_date || null
}
