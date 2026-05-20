'use client'

import { useState, useEffect } from 'react'
import { Task, Category, Priority, Assignee, Recur, CATEGORIES } from '@/lib/types'

interface Props {
  task: Task | null
  defaultCategory: Category
  onSave: (task: Task) => void
  onClose: () => void
}

export default function TaskModal({ task, defaultCategory, onSave, onClose }: Props) {
  const [text, setText] = useState('')
  const [cat, setCat] = useState<Category>(defaultCategory)
  const [assignee, setAssignee] = useState<Assignee>('adi')
  const [priority, setPriority] = useState<Priority>('normal')
  const [due, setDue] = useState('')
  const [recur, setRecur] = useState<Recur>('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (task) {
      setText(task.text); setCat(task.category); setAssignee(task.assignee)
      setPriority(task.priority); setDue(task.due_date || ''); setRecur(task.recur); setNote(task.note)
    } else {
      setCat(defaultCategory)
    }
  }, [task, defaultCategory])

  const save = () => {
    if (!text.trim()) return
    const t: Task = {
      id: task?.id || String(Date.now()),
      created_at: task?.created_at || new Date().toISOString(),
      text: text.trim(), category: cat, assignee, priority,
      due_date: due || null, recur, note: note.trim(),
      done: task?.done || false, done_at: task?.done_at || null,
      stuck_since: task?.stuck_since || null, family_id: 'fink',
      related_member_ids: task?.related_member_ids || [],
    }
    onSave(t)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-t-3xl p-6 pb-8 animate-slide-up overflow-y-auto max-h-[90vh]"
        style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <h2 className="text-lg font-extrabold mb-5">{task ? 'עריכת מטלה' : 'מטלה חדשה'}</h2>

        {/* Text */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1.5 block">תיאור המטלה *</label>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-white"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            placeholder="לדוגמה: תור לרופא — הלל" autoFocus />
        </div>

        {/* Category */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1.5 block">קטגוריה</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className="py-2 rounded-xl text-center text-xs font-semibold transition-all"
                style={cat === c.id
                  ? { background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#6b7280' }}>
                <div className="text-lg mb-0.5">{c.icon}</div>{c.name.split('—')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {/* Assignee */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1.5 block">אחראי</label>
          <div className="flex gap-2">
            {([['adi','👨 עדי'],['tahel','👩 תהלה'],['both','👫 שניכם']] as [Assignee, string][]).map(([val, lbl]) => (
              <button key={val} onClick={() => setAssignee(val)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={assignee === val
                  ? { background: 'rgba(124,58,237,0.2)', border: '2px solid rgba(124,58,237,0.5)', color: '#c4b5fd' }
                  : { background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.07)', color: '#6b7280' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1.5 block">עדיפות</label>
          <div className="flex gap-2 flex-wrap">
            {([['urgent','🔴 דחוף','#f87171','rgba(248,113,113,0.2)'],['soon','🟠 השבוע','#fb923c','rgba(251,146,60,0.2)'],['normal','🟣 רגיל','#a78bfa','rgba(167,139,250,0.2)'],['low','⚪ נמוך','#94a3b8','rgba(100,116,139,0.2)']] as [Priority, string, string, string][]).map(([val, lbl, col, bg]) => (
              <button key={val} onClick={() => setPriority(val)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={priority === val
                  ? { background: bg, border: `1px solid ${col}`, color: col }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#6b7280' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Due + Recur */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">תאריך יעד</label>
            <input type="date" value={due} onChange={e => setDue(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none text-white"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">חזרה</label>
            <select value={recur} onChange={e => setRecur(e.target.value as Recur)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none text-white"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <option value="">ללא</option>
              <option value="daily">יומי</option>
              <option value="weekly">שבועי</option>
              <option value="monthly">חודשי</option>
            </select>
          </div>
        </div>

        {/* Note */}
        <div className="mb-6">
          <label className="text-xs text-gray-400 mb-1.5 block">הערה</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none text-white resize-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            placeholder="פרטים נוספים..." />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="px-5 py-3 rounded-2xl text-sm font-semibold text-gray-400 transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>ביטול</button>
          <button onClick={save} className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>שמור מטלה</button>
        </div>
      </div>
    </div>
  )
}
