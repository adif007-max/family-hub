'use client'

import { useState, useEffect } from 'react'
import { Task, Category, Priority, Assignee, Recur, CATEGORIES, FamilyMember } from '@/lib/types'

interface Props {
  task: Task | null
  defaultCategory: Category
  members: FamilyMember[]
  onSave: (task: Task) => void
  onClose: () => void
}

export default function TaskModal({ task, defaultCategory, members, onSave, onClose }: Props) {
  const [text, setText] = useState('')
  const [cat, setCat] = useState<Category>(defaultCategory)
  const [assignee, setAssignee] = useState<Assignee>('both')
  const [priority, setPriority] = useState<Priority>('normal')
  const [due, setDue] = useState('')
  const [recur, setRecur] = useState<Recur>('')
  const [note, setNote] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])

  useEffect(() => {
    if (task) {
      setText(task.text); setCat(task.category); setAssignee(task.assignee)
      setPriority(task.priority); setDue(task.due_date || ''); setRecur(task.recur); setNote(task.note)
      setMemberIds(task.related_member_ids || [])
    } else {
      setCat(defaultCategory)
      setMemberIds([])
      setAssignee('both')
    }
  }, [task, defaultCategory])

  const toggleMember = (id: string) =>
    setMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const activeMembers = members.filter(m => m.is_active)

  const save = () => {
    if (!text.trim()) return
    const t: Task = {
      id: task?.id || String(Date.now()),
      created_at: task?.created_at || new Date().toISOString(),
      text: text.trim(), category: cat, assignee, priority,
      due_date: due || null, recur, note: note.trim(),
      done: task?.done || false, done_at: task?.done_at || null,
      stuck_since: task?.stuck_since || null, family_id: 'fink',
      related_member_ids: memberIds,
      source_fact_id: task?.source_fact_id ?? null,
      source_fact_table: task?.source_fact_table ?? null,
    }
    onSave(t)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-t-3xl p-6 pb-8 animate-slide-up overflow-y-auto max-h-[90vh]"
        style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 -4px 32px rgba(0,0,0,0.08)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(0,0,0,0.1)' }} />
        <h2 className="text-lg font-bold mb-5" style={{ color: '#111827' }}>{task ? 'עריכת מטלה' : 'מטלה חדשה'}</h2>

        {/* Text */}
        <div className="mb-4">
          <label className="text-xs mb-1.5 block" style={{ color: '#6B7280' }}>תיאור המטלה *</label>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', color: '#111827' }}
            placeholder="לדוגמה: תור לרופא — הלל" autoFocus />
        </div>

        {/* Category */}
        <div className="mb-4">
          <label className="text-xs mb-1.5 block" style={{ color: '#6B7280' }}>קטגוריה</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className="py-2 rounded-xl text-center text-xs font-semibold transition-all"
                style={cat === c.id
                  ? { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.4)', color: '#3B82F6' }
                  : { background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.08)', color: '#6B7280' }}>
                <div className="text-lg mb-0.5">{c.icon}</div>{c.name.split('—')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {/* Assignee */}
        <div className="mb-4">
          <label className="text-xs mb-1.5 block" style={{ color: '#6B7280' }}>אחראי</label>
          <div className="flex gap-2">
            {([['adi','👨 עדי'],['tahel','👩 תהלה'],['both','👫 שניכם']] as [Assignee, string][]).map(([val, lbl]) => (
              <button key={val} onClick={() => setAssignee(val)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={assignee === val
                  ? { background: 'rgba(124,58,237,0.1)', border: '2px solid rgba(124,58,237,0.5)', color: '#7C3AED' }
                  : { background: '#F9FAFB', border: '2px solid rgba(0,0,0,0.08)', color: '#6B7280' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="mb-4">
          <label className="text-xs mb-1.5 block" style={{ color: '#6B7280' }}>עדיפות</label>
          <div className="flex gap-2 flex-wrap">
            {([['urgent','🔥 דחוף','#F97316','rgba(249,115,22,0.12)'],['soon','⏰ השבוע','#3B82F6','rgba(59,130,246,0.12)'],['normal','✅ רגיל','#6B7280','rgba(107,114,128,0.1)'],['low','⚪ נמוך','#9CA3AF','rgba(107,114,128,0.08)']] as [Priority, string, string, string][]).map(([val, lbl, col, bg]) => (
              <button key={val} onClick={() => setPriority(val)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={priority === val
                  ? { background: bg, border: `1px solid ${col}`, color: col }
                  : { background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.08)', color: '#9CA3AF' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Children */}
        {activeMembers.length > 0 && (
          <div className="mb-4">
            <label className="text-xs mb-1.5 block" style={{ color: '#6B7280' }}>שייך לילדים</label>
            <div className="flex flex-wrap gap-1.5">
              {activeMembers.map(m => {
                const active = memberIds.includes(m.id)
                const emoji = m.gender === 'female' ? '👧' : '👦'
                return (
                  <button key={m.id} type="button" onClick={() => toggleMember(m.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={active
                      ? { background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.4)', color: '#EC4899' }
                      : { background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.08)', color: '#9CA3AF' }}>
                    {emoji} {m.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Due + Recur */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: '#6B7280' }}>תאריך יעד</label>
            <input type="date" value={due} onChange={e => setDue(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', color: '#111827' }} />
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: '#6B7280' }}>חזרה</label>
            <select value={recur} onChange={e => setRecur(e.target.value as Recur)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', color: '#111827' }}>
              <option value="">ללא</option>
              <option value="daily">יומי</option>
              <option value="weekly">שבועי</option>
              <option value="monthly">חודשי</option>
            </select>
          </div>
        </div>

        {/* Note */}
        <div className="mb-6">
          <label className="text-xs mb-1.5 block" style={{ color: '#6B7280' }}>הערה</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', color: '#111827' }}
            placeholder="פרטים נוספים..." />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="px-5 py-3 rounded-2xl text-sm font-semibold transition-all"
            style={{ background: '#F3F4F6', border: '1px solid rgba(0,0,0,0.08)', color: '#6B7280' }}>ביטול</button>
          <button onClick={save} className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>שמור מטלה</button>
        </div>
      </div>
    </div>
  )
}
