'use client'

import { useState, useEffect } from 'react'
import { useSubscriptions } from '@/lib/useFacts'
import { useVehicles } from '@/lib/useFacts'
import { Subscription } from '@/lib/types'

// ─── Types from health-tracker ───────────────────────────────────────────────

interface HTransaction {
  id: number | string
  date: string
  description?: string
  merchant?: string
  amount: number
  category?: string
  type?: string
  [key: string]: unknown
}

interface SubMatch {
  sub: Subscription
  matched: HTransaction[]
  status: 'ok' | 'amount_mismatch' | 'missing' | 'stopped'
  lastCharge: HTransaction | null
  expectedAmount: number
  actualAmount: number | null
}

interface CarCost {
  category: string
  label: string
  amount: number
  count: number
  transactions: HTransaction[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const CAR_KEYWORDS = ['דלק', 'פז', 'סונול', 'דלקן', 'fuel', 'petrol', 'מוסך', 'מכונית', 'רכב', 'ביטוח', 'טסט', 'חניה', 'parking', 'car', 'auto']
const CAR_CATEGORIES = ['fuel', 'דלק', 'car', 'vehicle', 'רכב', 'insurance', 'ביטוח', 'garage', 'מוסך', 'parking', 'חניה']

const SUB_KEYWORDS: Record<string, string[]> = {
  'קלוד':      ['claude', 'anthropic'],
  'claude':    ['claude', 'anthropic'],
  'בזק':       ['bezeq', 'בזק'],
  'ספוטיפיי':  ['spotify'],
  'spotify':   ['spotify'],
  '019':       ['019'],
  'רימון':     ['rimon', 'רימון', 'internet'],
  'אינטרנט':   ['rimon', 'רימון', 'internet'],
}

function subKeywords(name: string): string[] {
  const lower = name.toLowerCase()
  for (const [key, kws] of Object.entries(SUB_KEYWORDS)) {
    if (lower.includes(key.toLowerCase())) return kws
  }
  return [lower.split(' ')[0]]
}

function txText(t: HTransaction): string {
  return ((t.description || '') + ' ' + (t.merchant || '')).toLowerCase()
}

function isCarRelated(t: HTransaction): boolean {
  const text = txText(t)
  const cat = (t.category || '').toLowerCase()
  return CAR_KEYWORDS.some(k => text.includes(k.toLowerCase())) ||
         CAR_CATEGORIES.some(k => cat.includes(k.toLowerCase()))
}

function carLabel(category: string): string {
  const c = category.toLowerCase()
  if (c.includes('דלק') || c.includes('fuel') || c.includes('פז') || c.includes('סונול')) return 'דלק'
  if (c.includes('מוסך') || c.includes('garage')) return 'מוסך'
  if (c.includes('ביטוח') || c.includes('insurance')) return 'ביטוח'
  if (c.includes('חניה') || c.includes('parking')) return 'חניה'
  return 'אחר'
}

function groupCarCosts(txs: HTransaction[]): CarCost[] {
  const map = new Map<string, CarCost>()
  for (const t of txs) {
    const label = carLabel(t.category || txText(t))
    if (!map.has(label)) map.set(label, { category: label, label, amount: 0, count: 0, transactions: [] })
    const g = map.get(label)!
    g.amount += Math.abs(t.amount)
    g.count += 1
    g.transactions.push(t)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

function matchSubs(subs: Subscription[], txs: HTransaction[]): SubMatch[] {
  const now = new Date()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000)

  return subs.map(sub => {
    const kws = subKeywords(sub.name)
    const matched = txs.filter(t => kws.some(k => txText(t).includes(k)))
    const expected = sub.monthly_cost || 0

    if (!matched.length) {
      // check if sub billing_day was in last 60 days — if yes, flag missing
      return { sub, matched: [], status: 'missing', lastCharge: null, expectedAmount: expected, actualAmount: null }
    }

    // sort by date desc
    const sorted = [...matched].sort((a, b) => b.date.localeCompare(a.date))
    const last = sorted[0]
    const actual = Math.abs(last.amount)
    const diff = Math.abs(actual - expected)
    const pct = expected > 0 ? diff / expected : 0

    // check if last charge was recent (within last 35 days)
    const lastDate = new Date(last.date)
    const daysSinceLast = (now.getTime() - lastDate.getTime()) / 86400000

    let status: SubMatch['status'] = 'ok'
    if (daysSinceLast > 45 && expected > 0) status = 'stopped'
    else if (pct > 0.1 && diff > 2) status = 'amount_mismatch'

    return { sub, matched: sorted, status, lastCharge: last, expectedAmount: expected, actualAmount: actual }
  })
}

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  ok:             { bg: 'rgba(34,197,94,0.08)',  text: '#16A34A', border: 'rgba(34,197,94,0.2)',  icon: '✓' },
  amount_mismatch:{ bg: 'rgba(249,115,22,0.08)', text: '#EA580C', border: 'rgba(249,115,22,0.2)', icon: '⚠' },
  missing:        { bg: 'rgba(239,68,68,0.08)',  text: '#DC2626', border: 'rgba(239,68,68,0.2)',  icon: '✗' },
  stopped:        { bg: 'rgba(107,114,128,0.08)', text: '#6B7280', border: 'rgba(107,114,128,0.2)', icon: '—' },
}

const STATUS_LABEL: Record<string, string> = {
  ok:             'תקין',
  amount_mismatch:'סכום שונה',
  missing:        'לא נמצא חיוב',
  stopped:        'הופסק?',
}

const CAR_ICON: Record<string, string> = {
  'דלק': '⛽',
  'מוסך': '🔧',
  'ביטוח': '🛡',
  'חניה': '🅿',
  'אחר': '🚗',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinanceTab({ familyId }: { familyId: string }) {
  const { items: subs, loading: subsLoading } = useSubscriptions(familyId)
  const { items: vehicles } = useVehicles(familyId)

  const [txs, setTxs] = useState<HTransaction[] | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [txLoading, setTxLoading] = useState(true)

  const [section, setSection] = useState<'subs' | 'car'>('subs')
  const [expandedSub, setExpandedSub] = useState<string | null>(null)
  const [expandedCar, setExpandedCar] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health/transactions')
      .then(r => r.json())
      .then((d) => {
        if (d?.error) { setTxError(d.error); setTxLoading(false); return }
        // transactions may be array or { transactions: [...] }
        const arr: HTransaction[] = Array.isArray(d) ? d : (d?.transactions || d?.items || [])
        setTxs(arr)
        setTxLoading(false)
      })
      .catch(() => { setTxError('network'); setTxLoading(false) })
  }, [])

  const vehicle = vehicles[0] // first car
  const carTxs = txs ? txs.filter(isCarRelated) : []
  const carGroups = groupCarCosts(carTxs)
  const carTotal = carGroups.reduce((s, g) => s + g.amount, 0)

  const subMatches = (!subsLoading && txs) ? matchSubs(subs, txs) : []
  const subIssues = subMatches.filter(m => m.status !== 'ok').length
  const subTotal = subs.reduce((s: number, sub: Subscription) => s + (sub.monthly_cost || 0), 0)

  const loading = subsLoading || txLoading

  return (
    <div className="animate-fade-in pb-4">

      {/* ── Section toggle ── */}
      <div className="flex gap-2 mb-5">
        {[
          { id: 'subs' as const, label: '🔄 מנויים', badge: subIssues },
          { id: 'car'  as const, label: '🚗 עלות רכב', badge: 0 },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
            style={section === s.id
              ? { background: 'linear-gradient(135deg,#7C3AED,#A855F7)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }
              : { background: '#fff', color: '#6B7280', border: '1px solid rgba(0,0,0,0.08)' }}>
            {s.label}
            {s.badge > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: section === s.id ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.12)', color: section === s.id ? '#fff' : '#DC2626' }}>
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="flex flex-col items-center py-12 gap-2">
          <div className="text-2xl animate-pulse">💳</div>
          <div className="text-sm" style={{ color: '#9CA3AF' }}>מושך נתוני עסקאות…</div>
        </div>
      )}

      {!loading && txError && (
        <div className="rounded-2xl p-4 text-sm text-center" style={{ background: 'rgba(239,68,68,0.06)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.15)' }}>
          לא הצלחתי לטעון נתוני עסקאות ({txError}).<br />
          <span style={{ color: '#9CA3AF', fontSize: '12px' }}>נתוני מנויים מ-Family Hub מוצגים, אך ללא אימות.</span>
        </div>
      )}

      {/* ── Subscriptions ── */}
      {!loading && section === 'subs' && (
        <div>
          {/* Summary */}
          <div className="rounded-2xl p-4 mb-4 flex justify-between items-center"
            style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(168,85,247,0.07))', border: '1px solid rgba(124,58,237,0.12)' }}>
            <div>
              <div className="text-xs mb-0.5" style={{ color: '#7C3AED' }}>סה״כ מנויים חודשיים</div>
              <div className="text-2xl font-bold" style={{ color: '#111827' }}>₪{subTotal.toFixed(0)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs mb-0.5" style={{ color: '#9CA3AF' }}>{subs.length} מנויים</div>
              {subIssues > 0 && (
                <div className="text-xs font-medium" style={{ color: '#EA580C' }}>{subIssues} דורשים בדיקה</div>
              )}
              {!txs && <div className="text-xs" style={{ color: '#9CA3AF' }}>ללא אימות עסקאות</div>}
            </div>
          </div>

          {/* Sub list */}
          <div className="flex flex-col gap-2">
            {subMatches.map(m => {
              const c = STATUS_COLOR[m.status]
              const expanded = expandedSub === m.sub.id
              return (
                <div key={m.sub.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: '#fff', border: `1px solid ${c.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <button
                    className="w-full flex items-center gap-3 p-3.5 text-right"
                    onClick={() => setExpandedSub(expanded ? null : m.sub.id)}>
                    {/* Status dot */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{ background: c.bg, color: c.text }}>
                      {c.icon}
                    </div>
                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm" style={{ color: '#111827' }}>{m.sub.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: c.text }}>
                        {STATUS_LABEL[m.status]}
                        {m.status === 'amount_mismatch' && m.actualAmount != null &&
                          ` · ₪${m.actualAmount.toFixed(0)} במקום ₪${m.expectedAmount.toFixed(0)}`}
                        {m.lastCharge && m.status === 'ok' &&
                          ` · חויב ${new Date(m.lastCharge.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}`}
                      </div>
                    </div>
                    {/* Amount */}
                    <div className="text-sm font-semibold flex-shrink-0" style={{ color: '#374151' }}>
                      ₪{(m.sub.monthly_cost || 0).toFixed(0)}
                    </div>
                    <div className="text-xs flex-shrink-0" style={{ color: '#9CA3AF' }}>{expanded ? '▲' : '▼'}</div>
                  </button>

                  {expanded && m.matched.length > 0 && (
                    <div className="px-3.5 pb-3.5 flex flex-col gap-1.5"
                      style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <div className="text-xs font-medium pt-2 mb-1" style={{ color: '#9CA3AF' }}>עסקאות אחרונות</div>
                      {m.matched.slice(0, 4).map((t, i) => (
                        <div key={i} className="flex justify-between items-center text-xs py-1"
                          style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                          <span style={{ color: '#6B7280' }}>
                            {new Date(t.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className="flex-1 mx-2 text-center" style={{ color: '#374151' }}>
                            {t.description || t.merchant || '—'}
                          </span>
                          <span className="font-medium" style={{ color: '#111827' }}>₪{Math.abs(t.amount).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {expanded && m.matched.length === 0 && (
                    <div className="px-3.5 pb-3 text-xs" style={{ color: '#9CA3AF', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '10px' }}>
                      לא נמצאו עסקאות תואמות ב-60 הימים האחרונים
                    </div>
                  )}
                </div>
              )
            })}

            {/* Subs without transactions matching logic (fallback when no txs) */}
            {!txs && subs.map((sub: Subscription) => (
              <div key={sub.id} className="rounded-2xl p-3.5 flex items-center gap-3"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontSize: '12px' }}>?</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: '#111827' }}>{sub.name}</div>
                  <div className="text-xs" style={{ color: '#9CA3AF' }}>ביום {sub.billing_day_of_month || '—'}</div>
                </div>
                <div className="text-sm font-semibold" style={{ color: '#374151' }}>₪{(sub.monthly_cost || 0).toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Car cost ── */}
      {!loading && section === 'car' && (
        <div>
          {/* Vehicle info */}
          {vehicle && (
            <div className="rounded-2xl p-4 mb-4 flex gap-3 items-center"
              style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.07),rgba(14,165,233,0.07))', border: '1px solid rgba(59,130,246,0.12)' }}>
              <div className="text-3xl">🚗</div>
              <div>
                <div className="font-bold text-sm" style={{ color: '#111827' }}>{vehicle.make} {vehicle.model}</div>
                <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  {vehicle.license_plate && `${vehicle.license_plate} · `}
                  {vehicle.year && `${vehicle.year}`}
                </div>
              </div>
              <div className="mr-auto text-right">
                <div className="text-xs mb-0.5" style={{ color: '#6B7280' }}>עלות 60 יום</div>
                <div className="text-xl font-bold" style={{ color: '#111827' }}>₪{carTotal.toFixed(0)}</div>
              </div>
            </div>
          )}

          {/* No car txs */}
          {carTxs.length === 0 && txs && (
            <div className="rounded-2xl p-6 text-center"
              style={{ background: '#fff', border: '1px dashed rgba(0,0,0,0.1)' }}>
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-sm font-medium mb-1" style={{ color: '#374151' }}>לא נמצאו עסקאות רכב</div>
              <div className="text-xs" style={{ color: '#9CA3AF' }}>
                מחפש: דלק, מוסך, ביטוח, חניה
              </div>
            </div>
          )}

          {/* Car cost groups */}
          {carGroups.length > 0 && (
            <div className="flex flex-col gap-2">
              {carGroups.map(g => {
                const expanded = expandedCar === g.label
                return (
                  <div key={g.label} className="rounded-2xl overflow-hidden"
                    style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <button className="w-full flex items-center gap-3 p-3.5"
                      onClick={() => setExpandedCar(expanded ? null : g.label)}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: 'rgba(59,130,246,0.09)' }}>
                        {CAR_ICON[g.label] || '🚗'}
                      </div>
                      <div className="flex-1 text-right">
                        <div className="font-semibold text-sm" style={{ color: '#111827' }}>{g.label}</div>
                        <div className="text-xs" style={{ color: '#9CA3AF' }}>{g.count} עסקאות</div>
                      </div>
                      <div className="text-base font-bold" style={{ color: '#1D4ED8' }}>₪{g.amount.toFixed(0)}</div>
                      <div className="text-xs" style={{ color: '#9CA3AF' }}>{expanded ? '▲' : '▼'}</div>
                    </button>

                    {expanded && (
                      <div className="px-3.5 pb-3.5" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                        <div className="text-xs font-medium pt-2 mb-1" style={{ color: '#9CA3AF' }}>פירוט</div>
                        {g.transactions.slice(0, 6).map((t, i) => (
                          <div key={i} className="flex justify-between items-center text-xs py-1.5"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                            <span style={{ color: '#6B7280' }}>
                              {new Date(t.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="flex-1 mx-2 text-center" style={{ color: '#374151' }}>
                              {t.description || t.merchant || t.category || '—'}
                            </span>
                            <span className="font-medium" style={{ color: '#111827' }}>₪{Math.abs(t.amount).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Total card */}
              <div className="rounded-2xl p-4 flex justify-between items-center mt-1"
                style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)' }}>
                <div className="text-sm font-semibold" style={{ color: '#374151' }}>סה״כ עלות רכב (60 יום)</div>
                <div className="text-lg font-bold" style={{ color: '#1D4ED8' }}>₪{carTotal.toFixed(0)}</div>
              </div>
              <div className="text-center text-xs mt-1" style={{ color: '#9CA3AF' }}>
                ≈ ₪{(carTotal / 2).toFixed(0)} לחודש · ₪{(carTotal / 60 * 365 / 12).toFixed(0)} ממוצע שנתי
              </div>
            </div>
          )}

          {/* No txs loaded at all */}
          {!txs && !txError && (
            <div className="text-center py-8 text-sm" style={{ color: '#9CA3AF' }}>
              טוען נתוני עסקאות…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
