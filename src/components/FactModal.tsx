'use client'

import { useState, useEffect } from 'react'
import { Vehicle, Subscription, Schedule, FamilyMember, ScheduleActivityType } from '@/lib/types'

type FactKind = 'vehicle' | 'subscription' | 'schedule'

interface Props {
  kind: FactKind
  initial: Vehicle | Subscription | Schedule | null
  members: FamilyMember[]
  onSave: (patch: Partial<Vehicle> | Partial<Subscription> | Partial<Schedule>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

const KIND_TITLE: Record<FactKind, string> = {
  vehicle: 'רכב',
  subscription: 'מנוי',
  schedule: 'לו"ז',
}

const DAYS = [
  { val: 'א', label: 'א\'' },
  { val: 'ב', label: 'ב\'' },
  { val: 'ג', label: 'ג\'' },
  { val: 'ד', label: 'ד\'' },
  { val: 'ה', label: 'ה\'' },
  { val: 'ו', label: 'ו\'' },
  { val: 'ש', label: 'ש' },
]

const ACTIVITY_LABEL: Record<ScheduleActivityType, string> = {
  school: 'בית ספר',
  kindergarten: 'גן',
  class: 'חוג',
  meeting: 'פגישה',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-zinc-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none bg-transparent text-zinc-100 border border-zinc-700 focus:border-zinc-500 transition-colors'

export default function FactModal({ kind, initial, members, onSave, onDelete, onClose }: Props) {
  // Generic state — fields are conditional below.
  const [v, setV] = useState<Record<string, string | number | string[] | null>>({})

  useEffect(() => {
    if (initial) {
      const copy: Record<string, string | number | string[] | null> = {}
      Object.entries(initial).forEach(([k, val]) => { copy[k] = val as never })
      setV(copy)
    } else {
      setV(kind === 'schedule' ? { days_of_week: [] } : {})
    }
  }, [initial, kind])

  const set = (k: string, val: string | number | string[] | null) => setV(p => ({ ...p, [k]: val }))

  const toggleDay = (d: string) => {
    const cur = (v.days_of_week as string[]) || []
    set('days_of_week', cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d])
  }

  const save = async () => {
    // Validation: required fields per kind
    if (kind === 'vehicle' && !v.make)         return
    if (kind === 'subscription' && !v.name)    return
    if (kind === 'schedule' && !v.activity_name) return
    const patch: Record<string, unknown> = { ...v }
    // numeric coercion
    if (kind === 'vehicle' && patch.year)         patch.year = Number(patch.year) || null
    if (kind === 'subscription' && patch.monthly_cost !== undefined && patch.monthly_cost !== '') {
      patch.monthly_cost = Number(patch.monthly_cost) || null
    }
    await onSave(patch)
    onClose()
  }

  const isNew = !initial
  const title = `${isNew ? 'הוסף' : 'ערוך'} ${KIND_TITLE[kind]}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-xl p-6 pb-8 animate-slide-up overflow-y-auto max-h-[90vh]" style={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-normal tracking-tight text-zinc-100">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-100 transition-colors">✕</button>
        </div>

        <div className="space-y-4">
          {kind === 'vehicle' && (
            <>
              <Field label="יצרן *">
                <input className={inputCls} value={(v.make as string) || ''} onChange={e => set('make', e.target.value)} placeholder="קיה / טויוטה / מאזדה" autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="דגם"><input className={inputCls} value={(v.model as string) || ''} onChange={e => set('model', e.target.value)} placeholder="ספורטאז" /></Field>
                <Field label="שנה"><input type="number" className={inputCls} value={(v.year as number | string) || ''} onChange={e => set('year', e.target.value)} placeholder="2021" /></Field>
              </div>
              <Field label="מספר רכב"><input className={inputCls} value={(v.license_plate as string) || ''} onChange={e => set('license_plate', e.target.value)} placeholder="12-345-67" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="טסט"><input type="date" className={inputCls} value={(v.test_expiry_date as string) || ''} onChange={e => set('test_expiry_date', e.target.value)} /></Field>
                <Field label="חידוש ביטוח"><input type="date" className={inputCls} value={(v.insurance_renewal_date as string) || ''} onChange={e => set('insurance_renewal_date', e.target.value)} /></Field>
              </div>
              <Field label="מס׳ פוליסה"><input className={inputCls} value={(v.insurance_policy_number as string) || ''} onChange={e => set('insurance_policy_number', e.target.value)} /></Field>
              <Field label="הערות"><textarea rows={2} className={inputCls + ' resize-none'} value={(v.notes as string) || ''} onChange={e => set('notes', e.target.value)} /></Field>
            </>
          )}

          {kind === 'subscription' && (
            <>
              <Field label="שם המנוי *">
                <input className={inputCls} value={(v.name as string) || ''} onChange={e => set('name', e.target.value)} placeholder="ספוטיפיי / נטפליקס" autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="עלות חודשית"><input type="number" className={inputCls} value={(v.monthly_cost as number | string) || ''} onChange={e => set('monthly_cost', e.target.value)} placeholder="35" /></Field>
                <Field label="תאריך חידוש"><input type="date" className={inputCls} value={(v.renewal_date as string) || ''} onChange={e => set('renewal_date', e.target.value)} /></Field>
              </div>
              <Field label="חשבון (מייל)"><input className={inputCls} value={(v.account_email as string) || ''} onChange={e => set('account_email', e.target.value)} /></Field>
              <Field label="הערות"><textarea rows={2} className={inputCls + ' resize-none'} value={(v.notes as string) || ''} onChange={e => set('notes', e.target.value)} /></Field>
            </>
          )}

          {kind === 'schedule' && (
            <>
              <Field label="שם הפעילות *">
                <input className={inputCls} value={(v.activity_name as string) || ''} onChange={e => set('activity_name', e.target.value)} placeholder="בית ספר הלל / חוג שחיה" autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ילד">
                  <select className={inputCls} value={(v.child_id as string) || ''} onChange={e => set('child_id', e.target.value || null)}>
                    <option value="">—</option>
                    {members.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.gender === 'female' ? '👧' : '👦'} {m.name}</option>)}
                  </select>
                </Field>
                <Field label="סוג">
                  <select className={inputCls} value={(v.activity_type as string) || ''} onChange={e => set('activity_type', e.target.value || null)}>
                    <option value="">—</option>
                    {(Object.keys(ACTIVITY_LABEL) as ScheduleActivityType[]).map(t => <option key={t} value={t}>{ACTIVITY_LABEL[t]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="ימים">
                <div className="flex gap-1">
                  {DAYS.map(d => {
                    const active = ((v.days_of_week as string[]) || []).includes(d.val)
                    return (
                      <button key={d.val} type="button" onClick={() => toggleDay(d.val)}
                        className="flex-1 py-2 rounded-lg text-xs transition-colors"
                        style={active
                          ? { background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.5)', color: '#c4b5fd' }
                          : { border: '1px solid rgba(255,255,255,0.08)', color: '#71717a' }}>
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="שעת התחלה"><input type="time" className={inputCls} value={(v.start_time as string) || ''} onChange={e => set('start_time', e.target.value)} /></Field>
                <Field label="שעת סיום"><input type="time" className={inputCls} value={(v.end_time as string) || ''} onChange={e => set('end_time', e.target.value)} /></Field>
              </div>
              <Field label="מיקום"><input className={inputCls} value={(v.location as string) || ''} onChange={e => set('location', e.target.value)} /></Field>
              <Field label="טלפון איש קשר"><input className={inputCls} value={(v.contact_phone as string) || ''} onChange={e => set('contact_phone', e.target.value)} /></Field>
              <Field label="הערות"><textarea rows={2} className={inputCls + ' resize-none'} value={(v.notes as string) || ''} onChange={e => set('notes', e.target.value)} /></Field>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-7">
          {!isNew && onDelete && (
            <button onClick={async () => { if (confirm('למחוק?')) { await onDelete(); onClose() } }}
              className="px-3 py-2.5 rounded-lg text-xs text-zinc-500 hover:text-red-400 transition-colors">🗑 מחק</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 transition-colors">ביטול</button>
          <button onClick={save} className="px-5 py-2.5 rounded-lg text-sm text-zinc-100 transition-colors"
            style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.5)' }}>
            שמור
          </button>
        </div>
      </div>
    </div>
  )
}
