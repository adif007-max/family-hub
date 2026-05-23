'use client'

import { Task, FamilyMember } from '@/lib/types'

function today() { return new Date().toISOString().split('T')[0] }

function dueDateInfo(due: string | null) {
  if (!due) return null
  if (due < today()) return { label: '⚠ ' + fmt(due), cls: '#f87171' }
  if (due === today()) return { label: '⏰ היום', cls: '#fb923c' }
  const diff = Math.round((new Date(due).getTime() - new Date(today()).getTime()) / 86400000)
  if (diff === 1) return { label: 'מחר', cls: '#fbbf24' }
  if (diff <= 3) return { label: `${diff} ימים`, cls: '#fbbf24' }
  return { label: fmt(due), cls: '#9ca3af' }
}
function fmt(s: string) { const [,m,d] = s.split('-'); return `${d}/${m}` }

function gcalUrl(task: Task) {
  const date = task.due_date!.replace(/-/g, '')
  const next = new Date(task.due_date!)
  next.setDate(next.getDate() + 1)
  const end = next.toISOString().split('T')[0].replace(/-/g, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.text,
    dates: `${date}/${end}`,
    details: task.note || '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

const PRIORITY_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  urgent: { label: '🔴 דחוף',  bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
  soon:   { label: '🟠 השבוע', bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
  normal: { label: 'רגיל',      bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
  low:    { label: 'נמוך',      bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
}
const ASSIGNEE: Record<string, { label: string; bg: string }> = {
  adi:   { label: 'ע', bg: '#7c3aed' },
  tahel: { label: 'ת', bg: '#0891b2' },
  both:  { label: 'שנ', bg: '#065f46' },
}
const RECUR: Record<string, string> = { daily: '🔄 יומי', weekly: '🔄 שבועי', monthly: '🔄 חודשי' }

interface Props {
  task: Task
  members?: FamilyMember[]
  onToggle: (id: string) => void
  onEdit: (task: Task) => void
  onDelete?: (id: string) => void
  compact?: boolean
}

export default function TaskItem({ task, members = [], onToggle, onEdit, onDelete, compact }: Props) {
  const due = dueDateInfo(task.due_date)
  const pri = PRIORITY_STYLES[task.priority]
  const asgn = ASSIGNEE[task.assignee]

  // Resolve children chips: drop orphans (deleted members) and inactive (archived).
  const relatedMembers = task.related_member_ids
    ? task.related_member_ids
        .map(id => members.find(m => m.id === id && m.is_active !== false))
        .filter((m): m is FamilyMember => Boolean(m))
    : []

  // Hierarchical chip visibility — hide if the value is the default ("noise reduction").
  const showPriorityChip = !task.done && task.priority !== 'normal' && task.priority !== 'low'
  const showAssigneeAvatar = task.assignee !== 'both'
  const showDueChip = Boolean(due) && !task.done
  const showRecurChip = Boolean(task.recur)
  const hasAnyChip = showPriorityChip || showDueChip || showRecurChip || relatedMembers.length > 0 || task.done

  return (
    <div
      onClick={() => onToggle(task.id)}
      className="group flex items-start gap-3 py-3 px-1 cursor-pointer transition-colors relative hover:bg-white/[0.02]"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        opacity: task.done ? 0.5 : 1,
      }}
    >
      {task.priority === 'urgent' && !task.done && (
        <div className="absolute right-0 top-2 bottom-2 w-0.5 rounded-full" style={{ background: '#f87171' }} />
      )}

      {/* Checkbox */}
      <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold transition-all"
        style={task.done
          ? { background: '#34d399', border: '2px solid #34d399', color: '#000' }
          : { border: '2px solid rgba(255,255,255,0.2)' }}>
        {task.done && '✓'}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium leading-snug ${task.done ? 'line-through text-gray-500' : ''}`}>
          {task.text}
        </div>
        {!compact && hasAnyChip && (
          <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
            {showPriorityChip && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: pri.bg, color: pri.color }}>{pri.label}</span>}
            {task.done && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>✓ הושלם</span>}
            {showDueChip && <span className="text-xs" style={{ color: due!.cls }}>📅 {due!.label}</span>}
            {showRecurChip && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>{RECUR[task.recur]}</span>}
            {relatedMembers.map(m => (
              <span key={m.id} className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(244,114,182,0.10)', border: '1px solid rgba(244,114,182,0.25)', color: '#f9a8d4' }}>
                {m.gender === 'female' ? '👧' : '👦'} {m.name}
              </span>
            ))}
          </div>
        )}
        {task.note && !compact && <div className="text-xs text-gray-500 mt-1 truncate">💬 {task.note}</div>}
      </div>

      {/* Right side */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <div className="flex gap-0.5 text-zinc-600">
          {task.due_date && !task.done && (
            <a href={gcalUrl(task)} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 hover:text-zinc-200 transition-colors"
              style={{ opacity: 0.6 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
              title="הוסף ליומן גוגל">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </a>
          )}
          <button onClick={e => { e.stopPropagation(); onEdit(task) }}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 hover:text-zinc-200 transition-colors"
            style={{ opacity: 0.6 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
            title="ערוך">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          {onDelete && (
            <button
              onClick={e => {
                e.stopPropagation()
                if (confirm(`למחוק את המטלה "${task.text}"?`)) onDelete(task.id)
              }}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 hover:text-zinc-200 transition-colors"
              style={{ opacity: 0.6 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
              title="מחק">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </button>
          )}
        </div>
        {showAssigneeAvatar && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: asgn.bg }}>
            {asgn.label}
          </div>
        )}
      </div>
    </div>
  )
}
