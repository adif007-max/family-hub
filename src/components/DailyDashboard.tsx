'use client'

import { Task, CATEGORIES } from '@/lib/types'
import TaskItem from './TaskItem'

interface Props {
  tasks: Task[]
  onToggle: (id: string) => void
  onEdit: (task: Task) => void
  onAdd: () => void
}

function today() { return new Date().toISOString().split('T')[0] }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'לילה טוב 🌙'
  if (h < 12) return 'בוקר טוב ☀️'
  if (h < 17) return 'צהריים טובים 🌤'
  if (h < 21) return 'ערב טוב 🌇'
  return 'לילה טוב 🌙'
}

export default function DailyDashboard({ tasks, onToggle, onEdit, onAdd }: Props) {
  const todayStr = today()

  const todayTasks   = tasks.filter(t => t.due_date === todayStr && !t.done)
  const urgentTasks  = tasks.filter(t => t.priority === 'urgent' && !t.done && t.due_date !== todayStr)
  const overdue      = tasks.filter(t => t.due_date && t.due_date < todayStr && !t.done)
  const doneToday    = tasks.filter(t => t.done_at && t.done_at.startsWith(todayStr))

  // Load balance
  const adiPending   = tasks.filter(t => (t.assignee === 'adi' || t.assignee === 'both') && !t.done).length
  const tahelPending = tasks.filter(t => (t.assignee === 'tahel' || t.assignee === 'both') && !t.done).length
  const totalPending = tasks.filter(t => !t.done).length

  const d = new Date()
  const dateStr = d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="animate-fade-in space-y-5">
      {/* Greeting */}
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(244,114,182,0.1))', border: '1px solid rgba(167,139,250,0.2)' }}>
        <div className="text-xl font-black mb-1">{getGreeting()}</div>
        <div className="text-gray-400 text-sm">{dateStr}</div>
        <div className="flex gap-3 mt-4">
          <div className="text-center">
            <div className="text-2xl font-black text-purple-400">{totalPending}</div>
            <div className="text-xs text-gray-500">ממתינות</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-black text-green-400">{doneToday.length}</div>
            <div className="text-xs text-gray-500">הושלמו היום</div>
          </div>
          {overdue.length > 0 && <>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-black text-red-400">{overdue.length}</div>
              <div className="text-xs text-gray-500">באיחור</div>
            </div>
          </>}
        </div>
      </div>

      {/* Load balance */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-xs text-gray-400 mb-3 font-semibold">⚖️ עומס השבוע</div>
        <div className="space-y-2">
          {[['ע', 'עדי', adiPending, '#7c3aed'], ['ת', 'תהלה', tahelPending, '#0891b2']].map(([init, name, count, color]) => (
            <div key={String(name)} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: String(color) }}>{init}</div>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{name}</span>
                  <span className="text-gray-400">{count} מטלות</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((Number(count) / Math.max(adiPending, tahelPending, 1)) * 100, 100)}%`, background: String(color) }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <Section title="⚠️ באיחור" count={overdue.length} color="#f87171">
          {overdue.map(t => <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} />)}
        </Section>
      )}

      {/* Today */}
      <Section title="📅 להיום" count={todayTasks.length} color="#fb923c" empty="אין מטלות ליום היום 🎉">
        {todayTasks.map(t => <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} />)}
      </Section>

      {/* Urgent (not today) */}
      {urgentTasks.length > 0 && (
        <Section title="🔥 דחוף" count={urgentTasks.length} color="#f87171">
          {urgentTasks.map(t => <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} />)}
        </Section>
      )}

      {/* Done today */}
      {doneToday.length > 0 && (
        <Section title="✅ הושלמו היום" count={doneToday.length} color="#34d399">
          {doneToday.map(t => <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} />)}
        </Section>
      )}

      {/* Empty */}
      {todayTasks.length === 0 && urgentTasks.length === 0 && overdue.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🎉</div>
          <div className="text-lg font-bold mb-1">הכל מסודר!</div>
          <div className="text-gray-500 text-sm mb-6">אין מטלות דחופות להיום</div>
          <button onClick={onAdd} className="px-6 py-3 rounded-2xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
            ＋ הוסף מטלה
          </button>
        </div>
      )}
    </div>
  )
}

function Section({ title, count, color, children, empty }: { title: string; count: number; color: string; children: React.ReactNode; empty?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-bold text-sm">{title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${color}20`, color }}>{count}</span>
      </div>
      <div className="space-y-2">
        {count === 0 && empty ? <div className="text-center py-4 text-sm text-gray-500">{empty}</div> : children}
      </div>
    </div>
  )
}
