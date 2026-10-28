'use client'

import { useState, useEffect } from 'react'
import { ScheduleEvent, FamilyMember } from '@/lib/types'

interface Props {
  initial: ScheduleEvent | null
  members: FamilyMember[]
  onSave: (patch: Partial<ScheduleEvent>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-zinc-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none bg-white border border-gray-200 focus:border-blue-400 transition-colors'

export default function ScheduleEventModal({ initial, members, onSave, onDelete, onClose }: Props) {
  const [v, setV] = useState<Partial<ScheduleEvent>>({})

  useEffect(() => {
    setV(initial ? { ...initial } : {})
  }, [initial])

  const set = (k: keyof ScheduleEvent, val: string | null) => setV(p => ({ ...p, [k]: val }))

  const save = async () => {
    if (!v.title || !v.event_date) return
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
            {initial ? 'ערוך אירוע' : 'הוסף אירוע'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg" style={{ color: '#9CA3AF' }}>✕</button>
        </div>

        <div className="space-y-4">
          <Field label="כותרת *">
            <input className={inputCls} value={v.title || ''} onChange={e => set('title', e.target.value)}
              placeholder="אסיפת הורים / טיול שנתי" autoFocus />
          </Field>

          <Field label="ילד">
            <select className={inputCls} value={v.child_id || ''} onChange={e => set('child_id', e.target.value || null)}>
              <option value="">כל המשפחה</option>
              {members.filter(m => m.is_active).map(m => (
                <option key={m.id} value={m.id}>{m.gender === 'female' ? '👧' : '👦'} {m.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך *">
              <input type="date" className={inputCls} value={v.event_date || ''} onChange={e => set('event_date', e.target.value)} />
            </Field>
            <Field label="שעה">
              <input type="time" className={inputCls} value={v.event_time || ''} onChange={e => set('event_time', e.target.value || null)} />
            </Field>
          </div>

          <Field label="הערות">
            <textarea rows={2} className={inputCls + ' resize-none'} value={v.notes || ''} onChange={e => set('notes', e.target.value || null)} />
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
