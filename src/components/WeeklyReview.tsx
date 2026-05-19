'use client'

import { Task, CATEGORIES } from '@/lib/types'

interface Props { tasks: Task[] }

export default function WeeklyReview({ tasks }: Props) {
  const pending  = tasks.filter(t => !t.done)
  const done     = tasks.filter(t => t.done)
  const urgent   = tasks.filter(t => t.priority === 'urgent' && !t.done)

  const adiLoad   = tasks.filter(t => (t.assignee === 'adi'   || t.assignee === 'both') && !t.done).length
  const tahelLoad = tasks.filter(t => (t.assignee === 'tahel' || t.assignee === 'both') && !t.done).length

  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    pending: tasks.filter(t => t.category === cat.id && !t.done).length,
    done:    tasks.filter(t => t.category === cat.id && t.done).length,
  })).filter(c => c.pending + c.done > 0).sort((a, b) => b.pending - a.pending)

  const overdue = tasks.filter(t => {
    if (t.done || !t.due_date) return false
    return t.due_date < new Date().toISOString().split('T')[0]
  })

  const imbalance = Math.abs(adiLoad - tahelLoad)

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <div className="text-lg font-extrabold mb-1">📊 סקירה שבועית</div>
        <div className="text-sm text-gray-400">תמונת מצב מלאה של המשפחה</div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { num: pending.length, label: 'ממתינות', color: '#a78bfa' },
          { num: done.length,    label: 'הושלמו',  color: '#34d399' },
          { num: urgent.length,  label: 'דחוף',    color: '#f87171' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-black" style={{ color: c.color }}>{c.num}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Load balance */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-sm font-bold mb-3">⚖️ חלוקת עומס</div>
        {imbalance > 3 && (
          <div className="text-xs mb-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)', color: '#fb923c' }}>
            ⚠️ פער של {imbalance} מטלות — כדאי לאזן
          </div>
        )}
        <div className="space-y-3">
          {[['עדי', adiLoad, '#7c3aed'], ['תהלה', tahelLoad, '#0891b2']].map(([name, count, color]) => (
            <div key={String(name)}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{name}</span>
                <span className="text-gray-400">{count} מטלות</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((Number(count) / Math.max(adiLoad, tahelLoad, 1)) * 100, 100)}%`, background: String(color) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <div className="text-sm font-bold text-red-400 mb-2">⚠️ באיחור ({overdue.length})</div>
          <div className="space-y-1">
            {overdue.map(t => (
              <div key={t.id} className="text-xs text-gray-400">{t.text}</div>
            ))}
          </div>
        </div>
      )}

      {/* By category */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-sm font-bold mb-3">📂 לפי קטגוריה</div>
        <div className="space-y-3">
          {byCategory.map(cat => {
            const pct = cat.pending + cat.done > 0 ? Math.round(cat.done / (cat.pending + cat.done) * 100) : 0
            return (
              <div key={cat.id}>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span>{cat.icon} {cat.name}</span>
                  <span className="text-gray-500">{cat.done}/{cat.pending + cat.done} ({pct}%)</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly meeting */}
      <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(244,114,182,0.07))', border: '1px solid rgba(167,139,250,0.2)' }}>
        <div className="text-sm font-bold mb-1">☕ פגישת בית שבועית</div>
        <div className="text-xs text-gray-400 mb-3">15 דקות ביחד — מה נתקע? מה חשוב השבוע?</div>
        <div className="space-y-1.5 text-xs text-gray-400">
          <div>✓ {urgent.length} מטלות דחופות</div>
          <div>✓ {overdue.length} מטלות באיחור</div>
          <div>✓ עומס עדי: {adiLoad} | תהלה: {tahelLoad}</div>
        </div>
      </div>
    </div>
  )
}
