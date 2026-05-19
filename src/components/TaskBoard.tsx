'use client'

import { useState } from 'react'
import { Task, Category, CATEGORIES } from '@/lib/types'
import TaskItem from './TaskItem'

interface Props {
  tasks: Task[]
  onToggle: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onAdd: (cat?: Category) => void
  onUpdate: (tasks: Task[]) => void
}

export default function TaskBoard({ tasks, onToggle, onEdit, onDelete, onAdd, onUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [hideDone, setHideDone] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function today() { return new Date().toISOString().split('T')[0] }

  const filtered = tasks.filter(t => {
    if (hideDone && t.done) return false
    if (filterAssignee === 'adi' && t.assignee !== 'adi') return false
    if (filterAssignee === 'tahel' && t.assignee !== 'tahel') return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.text.toLowerCase().includes(q) && !t.note.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Stuck tasks: pending > 7 days without update
  const stuckTasks = tasks.filter(t => {
    if (t.done) return false
    if (!t.created_at) return false
    const created = new Date(t.created_at).getTime()
    const diff = (Date.now() - created) / 86400000
    return diff > 7
  })

  return (
    <div className="animate-fade-in space-y-4">
      {/* Search + filters */}
      <div className="space-y-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-white"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          placeholder="🔍 חיפוש מטלה..." />
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[['all','הכל'],['adi','עדי'],['tahel','תהלה']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterAssignee(val)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={filterAssignee === val
                ? { background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }
                : { border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
              {lbl}
            </button>
          ))}
          <button onClick={() => setHideDone(!hideDone)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={hideDone
              ? { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }
              : { border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
            הסתר הושלם
          </button>
        </div>
      </div>

      {/* Stuck tasks */}
      {stuckTasks.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
          <div className="text-sm font-bold text-orange-400 mb-2">⏸ מטלות תקועות ({stuckTasks.length})</div>
          <div className="space-y-1.5">
            {stuckTasks.slice(0, 3).map(t => (
              <div key={t.id} className="text-xs text-gray-400 flex justify-between items-center">
                <span>{t.text}</span>
                <button onClick={() => onDelete(t.id)} className="text-red-400 hover:text-red-300">🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const catTasks = filtered.filter(t => t.category === cat.id)
        const allCat = tasks.filter(t => t.category === cat.id)
        const doneCount = allCat.filter(t => t.done).length
        const pct = allCat.length ? Math.round(doneCount / allCat.length * 100) : 0
        const isCollapsed = collapsed[cat.id]

        return (
          <div key={cat.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <button className="w-full px-4 pt-4 pb-2 flex items-center justify-between" onClick={() => setCollapsed(p => ({ ...p, [cat.id]: !p[cat.id] }))}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{cat.icon}</span>
                <div className="text-right">
                  <div className="font-bold text-sm">{cat.name}</div>
                  <div className="text-xs text-gray-500">{doneCount}/{allCat.length} הושלמו</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full text-gray-400" style={{ background: 'rgba(255,255,255,0.07)' }}>{catTasks.length}</span>
                <span className="text-gray-500 text-sm transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
              </div>
            </button>

            {/* Progress bar */}
            <div className="mx-4 mb-3 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
            </div>

            {!isCollapsed && (
              <div className="px-4 pb-4 space-y-2">
                {catTasks.length === 0
                  ? <div className="text-center py-4 text-sm text-gray-600">אין מטלות 🎉</div>
                  : catTasks.map(t => <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)
                }
                <button onClick={() => onAdd(cat.id)}
                  className="w-full py-2 rounded-xl text-xs text-gray-600 transition-all hover:text-purple-400 hover:border-purple-500/30"
                  style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
                  ＋ הוסף מטלה
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
