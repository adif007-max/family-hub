'use client'

import { useState, useEffect } from 'react'
import { Lesson, FamilyMember } from '@/lib/types'

interface Props {
  initial: Lesson | null
  members: FamilyMember[]
  familyId: string
  onSave: (patch: Partial<Lesson>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

const DAY_OPTIONS = [
  { val: 'sun', label: 'א\'' },
  { val: 'mon', label: 'ב\'' },
  { val: 'tue', label: 'ג\'' },
  { val: 'wed', label: 'ד\'' },
  { val: 'thu', label: 'ה\'' },
  { val: 'fri', label: 'ו\'' },
  { val: 'sat', label: 'ש' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-zinc-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none bg-white border border-gray-200 focus:border-blue-400 transition-colors'

export default function LessonModal({ initial, members, onSave, onDelete, onClose }: Props) {
  const [v, setV] = useState<Partial<Lesson>>({})

  useEffect(() => {
    setV(initial ? { ...initial } : {})
  }, [initial])

  const set = (k: keyof Lesson, val: string | null) => setV(p => ({ ...p, [k]: val }))

  const save = async () => {
    if (!v.subject || !v.day_of_week || !v.start_time) return
    await onSave(v)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-xl p-6 pb-8 animate-slide-up overflow-y-auto max-h-[90vh]"
        style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium tracking-tight" style={{ color: '#111827' }}>
            {initial ? 'ערוך שיעור' : 'הוסף שיעור'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg" style={{ color: '#9CA3AF' }}>✕</button>
        </div>

        <div className="space-y-4">
          <Field label="ילד">
            <select className={inputCls} value={v.child_id || ''} onChange={e => set('child_id', e.target.value || null)}>
              <option value="">—</option>
              {members.filter(m => m.is_active).map(m => (
                <option key={m.id} value={m.id}>{m.gender === 'female' ? '👧' : '👦'} {m.name}</option>
              ))}
            </select>
          </Field>

          <Field label="שם בית הספר / מסגרת">
            <input className={inputCls} value={v.school_name || ''} onChange={e => set('school_name', e.target.value || null)}
              placeholder="ת&quot;ת נוה / בית ספר..." />
          </Field>

          <Field label="יום">
            <div className="flex gap-1">
              {DAY_OPTIONS.map(d => {
                const active = v.day_of_week === d.val
                return (
                  <button key={d.val} type="button" onClick={() => set('day_of_week', d.val as Lesson['day_of_week'])}
                    className="flex-1 py-2 rounded-lg text-xs transition-colors"
                    style={active
                      ? { background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.4)', color: '#3B82F6' }
                      : { border: '1px solid rgba(0,0,0,0.1)', color: '#6B7280' }}>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="מקצוע *">
            <input className={inputCls} value={v.subject || ''} onChange={e => set('subject', e.target.value)} placeholder="תורה / מתמטיקה / ריקוד" autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="שעת התחלה *">
              <input type="time" className={inputCls} value={v.start_time || ''} onChange={e => set('start_time', e.target.value)} />
            </Field>
            <Field label="שעת סיום">
              <input type="time" className={inputCls} value={v.end_time || ''} onChange={e => set('end_time', e.target.value || null)} />
            </Field>
          </div>

          <Field label="מורה / מדריך">
            <input className={inputCls} value={v.teacher || ''} onChange={e => set('teacher', e.target.value || null)} />
          </Field>
        </div>

        <div className="flex gap-3 mt-7">
          {initial && onDelete && (
            <button onClick={async () => { if (confirm('למחוק?')) { await onDelete(); onClose() } }}
              className="px-3 py-2.5 rounded-lg text-xs text-zinc-500 hover:text-red-400 transition-colors">🗑 מחק</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm" style={{ color: '#6B7280' }}>ביטול</button>
          <button onClick={save} className="px-5 py-2.5 rounded-lg text-sm text-white" style={{ background: '#3B82F6' }}>שמור</button>
        </div>
      </div>
    </div>
  )
}
