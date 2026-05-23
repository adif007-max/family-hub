'use client'

import { useState } from 'react'
import { Task, Category, CATEGORIES, FamilyMember } from '@/lib/types'
import TaskItem from './TaskItem'
import CalendarView from './CalendarView'

interface Props {
  tasks: Task[]
  members: FamilyMember[]
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

export default function TaskBoard({ tasks, members, onToggle, onEdit, onDelete, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterTime, setFilterTime] = useState<TimeFilter>('all')
  const [filterMember, setFilterMember] = useState<string>('all')
  const [hideDone, setHideDone] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const switchView = (mode: 'list' | 'calendar') => {
    setViewMode(mode)
    setSelectedDate(null)
    if (mode === 'calendar') {
      const d = new Date(); setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }

  const selectedYmd = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : null

  const todayStr = today()
  const weekEnd = plusDays(7)

  const filtered = tasks.filter(t => {
    if (hideDone && t.done) return false
    if (filterAssignee === 'adi' && t.assignee !== 'adi' && t.assignee !== 'both') return false
    if (filterAssignee === 'tahel' && t.assignee !== 'tahel' && t.assignee !== 'both') return false
    if (filterMember !== 'all' && !(t.related_member_ids || []).includes(filterMember)) return false

    if (selectedYmd && t.due_date !== selectedYmd) return false

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
  const weekCount    = pending.filter(t => t.due_date && t.due_date >= todayStr && t.due_date <= weekEnd).length
  const adiLoad      = pending.filter(t => t.assignee === 'adi'   || t.assignee === 'both').length
  const tahelLoad    = pending.filter(t => t.assignee === 'tahel' || t.assignee === 'both').length

  // Only show time chips that have content (plus 'all' always)
  const timeChips: { id: TimeFilter; label: string; count: number; tone?: string }[] = (
    [
      { id: 'today',   label: '⏰ היום',     count: todayCount,   tone: '#fb923c' },
      { id: 'week',    label: '📅 השבוע',    count: weekCount },
      { id: 'overdue', label: '⚠ באיחור',    count: overdueCount, tone: '#f87171' },
      { id: 'urgent',  label: '🔥 דחוף',     count: urgentCount,  tone: '#f87171' },
    ] as { id: TimeFilter; label: string; count: number; tone?: string }[]
  ).filter(c => c.count > 0)

  // Children chips — show only those with at least one task
  const childrenWithTasks = members.filter(m =>
    m.is_active && pending.some(t => (t.related_member_ids || []).includes(m.id))
  )

  return (
    <div className="animate-fade-in space-y-5">
      {/* Load balance — single line, no card */}
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="uppercase tracking-widest text-[10px]">עומס</span>
        <span className="text-zinc-600">·</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#a78bfa' }} />
          <span className="text-zinc-300">עדי</span>
          <span className="text-zinc-500">{adiLoad}</span>
        </span>
        <span className="text-zinc-600">·</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22d3ee' }} />
          <span className="text-zinc-300">תהלה</span>
          <span className="text-zinc-500">{tahelLoad}</span>
        </span>
      </div>

      {/* View toggle — text, underline-style */}
      <div className="flex gap-5 text-sm pb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => switchView('list')}
          style={{
            color: viewMode === 'list' ? '#e4e4e7' : '#71717a',
            borderBottom: viewMode === 'list' ? '2px solid #e4e4e7' : '2px solid transparent',
            paddingBottom: '4px',
            marginBottom: '-1px',
          }}>
          רשימה
        </button>
        <button onClick={() => switchView('calendar')}
          style={{
            color: viewMode === 'calendar' ? '#e4e4e7' : '#71717a',
            borderBottom: viewMode === 'calendar' ? '2px solid #e4e4e7' : '2px solid transparent',
            paddingBottom: '4px',
            marginBottom: '-1px',
          }}>
          לוח שנה
        </button>
      </div>

      {/* Calendar */}
      {viewMode === 'calendar' && (
        <CalendarView
          tasks={tasks}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
        />
      )}

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-transparent text-zinc-100 border border-zinc-700 focus:border-zinc-500 transition-colors"
        placeholder="חיפוש מטלה…" />

      {/* Filters — combined chip row, only what's relevant */}
      {(timeChips.length > 0 || childrenWithTasks.length > 0 || filterTime !== 'all' || filterMember !== 'all') && (
        <div className="flex flex-wrap gap-1.5">
          {(filterTime !== 'all' || filterMember !== 'all') && (
            <button onClick={() => { setFilterTime('all'); setFilterMember('all') }}
              className="px-2.5 py-1 rounded-full text-[11px] text-zinc-500 hover:text-zinc-100 transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              ✕ נקה
            </button>
          )}
          {timeChips.map(c => {
            const active = filterTime === c.id
            return (
              <button key={c.id} onClick={() => setFilterTime(active ? 'all' : c.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-colors"
                style={active
                  ? { border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }
                  : { border: '1px solid rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
                <span>{c.label}</span>
                <span style={{ color: c.tone || '#71717a' }}>{c.count}</span>
              </button>
            )
          })}
          {childrenWithTasks.map(m => {
            const active = filterMember === m.id
            const count = pending.filter(t => (t.related_member_ids || []).includes(m.id)).length
            return (
              <button key={m.id} onClick={() => setFilterMember(active ? 'all' : m.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-colors"
                style={active
                  ? { border: '1px solid rgba(244,114,182,0.4)', color: '#f9a8d4' }
                  : { border: '1px solid rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
                <span>{m.gender === 'female' ? '👧' : '👦'} {m.name}</span>
                <span className="text-zinc-500">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Assignee row — only if there are tasks for adi vs tahel split */}
      <div className="flex gap-1.5 text-[11px]">
        {[['all','הכל'],['adi','עדי'],['tahel','תהלה']].map(([val, lbl]) => {
          const active = filterAssignee === val
          return (
            <button key={val} onClick={() => setFilterAssignee(val)}
              className="px-2.5 py-1 transition-colors"
              style={{
                color: active ? '#e4e4e7' : '#71717a',
                borderBottom: active ? '1px solid #e4e4e7' : '1px solid transparent',
              }}>
              {lbl}
            </button>
          )
        })}
        <div className="flex-1" />
        <button onClick={() => setHideDone(!hideDone)}
          className="px-2.5 py-1 text-[11px] transition-colors"
          style={{ color: hideDone ? '#71717a' : '#a1a1aa' }}>
          {hideDone ? 'הראה הושלמו' : 'הסתר הושלמו'}
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-zinc-600 text-sm">
          אין מטלות לפי הסינון
        </div>
      )}

      {/* Categories — quiet */}
      {filtered.length > 0 && CATEGORIES.map(cat => {
        const catTasks = filtered.filter(t => t.category === cat.id)
        if (catTasks.length === 0) return null
        const isCollapsed = collapsed[cat.id]

        return (
          <div key={cat.id}>
            <button className="w-full flex items-baseline justify-between pb-2 mb-1" onClick={() => setCollapsed(p => ({ ...p, [cat.id]: !p[cat.id] }))}>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">{cat.name.split('—')[0].trim()}</span>
                <span className="text-[10px] text-zinc-600">·</span>
                <span className="text-[10px] text-zinc-500">{catTasks.length}</span>
              </div>
              <span className="text-zinc-600 text-xs" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
            </button>

            {!isCollapsed && (
              <div>
                {catTasks.map(t => <TaskItem key={t.id} task={t} members={members} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)}
                <button onClick={() => onAdd(cat.id)}
                  className="w-full py-2 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors text-right">
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
