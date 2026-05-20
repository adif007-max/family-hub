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
}

type TimeFilter = 'all' | 'today' | 'week' | 'overdue' | 'urgent'

function today() { return new Date().toISOString().split('T')[0] }
function plusDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export default function TaskBoard({ tasks, onToggle, onEdit, onDelete, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterTime, setFilterTime] = useState<TimeFilter>('all')
  const [hideDone, setHideDone] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const todayStr = today()
  const weekEnd = plusDays(7)

  const filtered = tasks.filter(t => {
    if (hideDone && t.done) return false
    if (filterAssignee === 'adi' && t.assignee !== 'adi' && t.assignee !== 'both') return false
    if (filterAssignee === 'tahel' && t.assignee !== 'tahel' && t.assignee !== 'both') return false

    if (filterTime === 'today' && t.due_date !== todayStr) return false
    if (filterTime === 'week') {
      if (!t.due_date) return false
      if (t.due_date < todayStr || t.due_date > weekEnd) return false
    }
    if (filterTime === 'overdue') {
      if (t.done) return false
      if (!t.due_date || t.due_date >= todayStr) return false
    }
    if (filterTime === 'urgent' && t.priority !== 'urgent') return false

    if (search) {
      const q = search.toLowerCase()
      if (!t.text.toLowerCase().includes(q) && !t.note.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Quick stats
  const pending = tasks.filter(t => !t.done)
  const urgentCount  = pending.filter(t => t.priority === 'urgent').length
  const todayCount   = pending.filter(t => t.due_date === todayStr).length
  const overdueCount = pending.filter(t => t.due_date && t.due_date < todayStr).length
  const adiLoad      = pending.filter(t => t.assignee === 'adi'   || t.assignee === 'both').length
  const tahelLoad    = pending.filter(t => t.assignee === 'tahel' || t.assignee === 'both').length
  const maxLoad      = Math.max(adiLoad, tahelLoad, 1)

  const timeChips: { id: TimeFilter; label: string; count?: number; color?: string }[] = [
    { id: 'all',     label: 'הכל' },
    { id: 'today',   label: '⏰ היום',     count: todayCount,   color: '#fb923c' },
    { id: 'week',    label: '📅 השבוע' },
    { id: 'overdue', label: '⚠ באיחור',    count: overdueCount, color: '#f87171' },
    { id: 'urgent',  label: '🔥 דחוף',     count: urgentCount,  color: '#f87171' },
  ]

  return (
    <div className="animate-fade-in space-y-4">
      {/* Compact stats */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex justify-between items-center mb-3">
          <div className="text-xs text-gray-400 font-semibold">⚖️ עומס</div>
          <div className="text-xs text-gray-500">{pending.length} ממתינות</div>
        </div>
        <div className="space-y-2">
          {[['עדי', adiLoad, '#7c3aed'], ['תהלה', tahelLoad, '#0891b2']].map(([name, count, color]) => (
            <div key={String(name)}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{name}</span>
                <span className="text-gray-400">{count}</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(Number(count) / maxLoad) * 100}%`, background: String(color) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-white"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
        placeholder="🔍 חיפוש מטלה..." />

      {/* Time filters */}
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {timeChips.map(c => (
          <button key={c.id} onClick={() => setFilterTime(c.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={filterTime === c.id
              ? { background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }
              : { border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
            <span>{c.label}</span>
            {c.count && c.count > 0 && (
              <span className="text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" style={{ background: c.color, color: '#000' }}>{c.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Assignee + hide done */}
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {[['all','הכל'],['adi','עדי'],['tahel','תהלה']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilterAssignee(val)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs transition-all"
            style={filterAssignee === val
              ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e5e7eb' }
              : { border: '1px solid rgba(255,255,255,0.05)', color: '#6b7280' }}>
            {lbl}
          </button>
        ))}
        <button onClick={() => setHideDone(!hideDone)}
          className="flex-shrink-0 px-3 py-1 rounded-full text-xs transition-all"
          style={hideDone
            ? { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }
            : { border: '1px solid rgba(255,255,255,0.05)', color: '#6b7280' }}>
          {hideDone ? '👁 הראה הושלמו' : 'הסתר הושלמו'}
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-sm">אין מטלות לפי הסינון הזה</div>
        </div>
      )}

      {/* Categories */}
      {filtered.length > 0 && CATEGORIES.map(cat => {
        const catTasks = filtered.filter(t => t.category === cat.id)
        if (catTasks.length === 0) return null
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

            <div className="mx-4 mb-3 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
            </div>

            {!isCollapsed && (
              <div className="px-4 pb-4 space-y-2">
                {catTasks.map(t => <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)}
                <button onClick={() => onAdd(cat.id)}
                  className="w-full py-2 rounded-xl text-xs text-gray-600 transition-all hover:text-purple-400"
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
