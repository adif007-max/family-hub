'use client'

import { useState } from 'react'
import { Vehicle, Subscription, Schedule, FamilyMember, ScheduleActivityType } from '@/lib/types'
import { useVehicles, useSubscriptions, useSchedules } from '@/lib/useFacts'
import FactModal from './FactModal'

interface Props {
  familyId: string
  members: FamilyMember[]
}

const ACTIVITY_LABEL: Record<ScheduleActivityType, string> = {
  school: 'בית ספר',
  kindergarten: 'גן',
  class: 'חוג',
  meeting: 'פגישה',
}

function fmtDate(iso: string | null): { label: string; warn: 'red' | 'orange' | null } {
  if (!iso) return { label: '—', warn: null }
  const [, m, d] = iso.split('-')
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(iso); target.setHours(0,0,0,0)
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  let warn: 'red' | 'orange' | null = null
  if (days < 7) warn = 'red'
  else if (days < 30) warn = 'orange'
  return { label: `${d}/${m}/${iso.slice(0,4)}`, warn }
}

function SectionHeader({ label, count, onAdd }: { label: string; count: number; onAdd: () => void }) {
  return (
    <div className="flex justify-between items-baseline pb-2 mb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
        <span className="text-[10px] text-zinc-600">·</span>
        <span className="text-[10px] text-zinc-500">{count}</span>
      </div>
      <button onClick={onAdd}
        className="w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-100 transition-colors text-sm">＋</button>
    </div>
  )
}

export default function InfoTab({ familyId, members }: Props) {
  const { items: vehicles,      add: addV, update: updV, remove: rmV } = useVehicles(familyId)
  const { items: subscriptions, add: addS, update: updS, remove: rmS } = useSubscriptions(familyId)
  const { items: schedules,     add: addSch, update: updSch, remove: rmSch } = useSchedules(familyId)

  const [editing, setEditing] = useState<
    | { kind: 'vehicle'; item: Vehicle | null }
    | { kind: 'subscription'; item: Subscription | null }
    | { kind: 'schedule'; item: Schedule | null }
    | null
  >(null)

  const subsTotal = subscriptions.reduce((a, s) => a + (s.monthly_cost || 0), 0)

  // Compute next billing date for a subscription (ISO string or null)
  function nextBillingDate(s: Subscription): string | null {
    if (s.billing_type === 'monthly' && s.billing_day_of_month) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const day = s.billing_day_of_month
      const candidate = new Date(today.getFullYear(), today.getMonth(), day)
      if (candidate <= today) candidate.setMonth(candidate.getMonth() + 1)
      return candidate.toISOString().split('T')[0]
    }
    return s.renewal_date
  }

  // Sort subs by next billing date ascending (nulls last)
  const sortedSubs = [...subscriptions].sort((a, b) => {
    const da = nextBillingDate(a), db = nextBillingDate(b)
    if (!da) return 1
    if (!db) return -1
    return da.localeCompare(db)
  })

  // Sort schedules by member age (Hillel, Rachel, Naomi, Oz) — by created_at in members
  const memberById = (id: string | null) => id ? members.find(m => m.id === id) : null
  const schedulesByChild = members.reduce<{ member: FamilyMember | null; items: Schedule[] }[]>((acc, m) => {
    const own = schedules.filter(s => s.child_id === m.id)
    if (own.length) acc.push({ member: m, items: own })
    return acc
  }, [])
  const orphanSchedules = schedules.filter(s => !s.child_id || !memberById(s.child_id))
  if (orphanSchedules.length) schedulesByChild.push({ member: null, items: orphanSchedules })

  return (
    <div className="animate-fade-in space-y-7">
      {/* Vehicles */}
      <section>
        <SectionHeader label="רכב" count={vehicles.length} onAdd={() => setEditing({ kind: 'vehicle', item: null })} />
        <div>
          {vehicles.length === 0 && (
            <div className="text-xs text-zinc-600 py-2">אין רכבים. לחץ ＋</div>
          )}
          {vehicles.map(v => {
            const test = fmtDate(v.test_expiry_date)
            const ins  = fmtDate(v.insurance_renewal_date)
            return (
              <button key={v.id} onClick={() => setEditing({ kind: 'vehicle', item: v })}
                className="w-full text-right py-3 border-b border-zinc-800/60 hover:bg-white/[0.02] transition-colors">
                <div className="text-sm text-zinc-100">{[v.make, v.model, v.year].filter(Boolean).join(' ')}</div>
                <div className="text-xs text-zinc-500 mt-1 space-x-3 space-x-reverse">
                  {v.license_plate && <span>מספר {v.license_plate}</span>}
                  {v.test_expiry_date && <span style={{ color: test.warn === 'red' ? '#f87171' : test.warn === 'orange' ? '#fb923c' : undefined }}>
                    טסט: {test.label} {test.warn && '⚠'}
                  </span>}
                  {v.insurance_renewal_date && <span style={{ color: ins.warn === 'red' ? '#f87171' : ins.warn === 'orange' ? '#fb923c' : undefined }}>
                    ביטוח: {ins.label} {ins.warn && '⚠'}
                  </span>}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Subscriptions */}
      <section>
        <SectionHeader label="מנויים" count={subscriptions.length} onAdd={() => setEditing({ kind: 'subscription', item: null })} />
        {subscriptions.length > 0 && (
          <div className="text-xs text-zinc-500 mb-2">סך מנויים · <span className="text-zinc-300">{subsTotal.toFixed(0)}₪/חודש</span></div>
        )}
        <div>
          {subscriptions.length === 0 && (
            <div className="text-xs text-zinc-600 py-2">אין מנויים. לחץ ＋</div>
          )}
          {sortedSubs.map(s => {
            const nbd = nextBillingDate(s)
            const billing = fmtDate(nbd)
            const isMonthly = s.billing_type === 'monthly'
            return (
              <button key={s.id} onClick={() => setEditing({ kind: 'subscription', item: s })}
                className="w-full text-right py-3 border-b border-zinc-800/60 hover:bg-white/[0.02] transition-colors">
                <div className="text-sm text-zinc-100">{s.name}</div>
                <div className="text-xs text-zinc-500 mt-1 space-x-3 space-x-reverse">
                  {s.monthly_cost != null && <span>{s.monthly_cost}₪/חודש</span>}
                  {isMonthly && s.billing_day_of_month && (
                    <span style={{ color: billing.warn === 'red' ? '#f87171' : billing.warn === 'orange' ? '#fb923c' : undefined }}>
                      מחויב ביום {s.billing_day_of_month} בכל חודש {billing.warn && `(${billing.label} ⚠)`}
                    </span>
                  )}
                  {!isMonthly && s.renewal_date && (
                    <span style={{ color: billing.warn === 'red' ? '#f87171' : billing.warn === 'orange' ? '#fb923c' : undefined }}>
                      חידוש {billing.label} {billing.warn && '⚠'}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Schedules */}
      <section>
        <SectionHeader label="לו״ז" count={schedules.length} onAdd={() => setEditing({ kind: 'schedule', item: null })} />
        <div>
          {schedules.length === 0 && (
            <div className="text-xs text-zinc-600 py-2">אין לו״ז. לחץ ＋</div>
          )}
          {schedulesByChild.map(({ member, items }) => (
            <div key={member?.id || 'orphan'} className="mb-3">
              {member && (
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">
                  {member.gender === 'female' ? '👧' : '👦'} {member.name}
                </div>
              )}
              {items.map(s => (
                <button key={s.id} onClick={() => setEditing({ kind: 'schedule', item: s })}
                  className="w-full text-right py-2.5 border-b border-zinc-800/60 hover:bg-white/[0.02] transition-colors">
                  <div className="text-sm text-zinc-100">
                    {s.activity_name}
                    {s.activity_type && <span className="text-xs text-zinc-500 mr-2">· {ACTIVITY_LABEL[s.activity_type]}</span>}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 space-x-3 space-x-reverse">
                    {s.days_of_week?.length > 0 && <span>{s.days_of_week.join(',')}</span>}
                    {s.start_time && <span>{s.start_time}{s.end_time ? `-${s.end_time}` : ''}</span>}
                    {s.location && <span>📍 {s.location}</span>}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      {editing && (
        <FactModal
          kind={editing.kind}
          initial={editing.item}
          members={members}
          onSave={async (patch) => {
            if (editing.kind === 'vehicle') {
              if (editing.item) await updV(editing.item.id, patch as Partial<Vehicle>)
              else await addV(patch as Partial<Vehicle>)
            } else if (editing.kind === 'subscription') {
              if (editing.item) await updS(editing.item.id, patch as Partial<Subscription>)
              else await addS(patch as Partial<Subscription>)
            } else {
              if (editing.item) await updSch(editing.item.id, patch as Partial<Schedule>)
              else await addSch(patch as Partial<Schedule>)
            }
          }}
          onDelete={editing.item ? async () => {
            if (editing.kind === 'vehicle')        await rmV(editing.item!.id)
            else if (editing.kind === 'subscription') await rmS(editing.item!.id)
            else                                       await rmSch(editing.item!.id)
          } : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
