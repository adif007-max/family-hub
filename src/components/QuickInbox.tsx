'use client'

import { useState } from 'react'
import { Task, Category, CATEGORIES, FamilyMember, Assignee } from '@/lib/types'

interface SortedItem {
  text: string
  cat: Category
  priority: 'urgent' | 'soon' | 'normal'
  assignee: Assignee
  related_member_ids: string[]
  aiPending?: boolean
}

interface Props {
  onAdd: (task: Partial<Task>) => void
  familyId: string
  members: FamilyMember[]
  tasks: Task[]
}

const SUGGESTIONS = [
  'לקנות חלב',
  'תור לרופא — הלל',
  'לשלם ביטוח לאומי',
  'לתקן ברז',
  'אסיפת הורים — רחל',
]

const ASSIGNEE_LABEL: Record<Assignee, string> = { adi: '👨 עדי', tahel: '👩 תהלה', both: '👨‍👩 שנינו' }

const CAT_COLOR: Record<Category, { bg: string; text: string; border: string }> = {
  medical:  { bg: 'rgba(239,68,68,0.08)',   text: '#DC2626', border: 'rgba(239,68,68,0.2)' },
  home:     { bg: 'rgba(245,158,11,0.08)',  text: '#D97706', border: 'rgba(245,158,11,0.2)' },
  studies:  { bg: 'rgba(139,92,246,0.08)',  text: '#7C3AED', border: 'rgba(139,92,246,0.2)' },
  formal:   { bg: 'rgba(59,130,246,0.08)',  text: '#2563EB', border: 'rgba(59,130,246,0.2)' },
  hobbies:  { bg: 'rgba(249,115,22,0.08)',  text: '#EA580C', border: 'rgba(249,115,22,0.2)' },
  finance:  { bg: 'rgba(34,197,94,0.08)',   text: '#16A34A', border: 'rgba(34,197,94,0.2)' },
  miluim:   { bg: 'rgba(100,116,139,0.08)', text: '#475569', border: 'rgba(100,116,139,0.2)' },
}

function StatCard({ icon, label, value, color, sub }: { icon: string; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="flex-1 rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>{label}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{sub}</div>}
    </div>
  )
}

export default function QuickInbox({ onAdd, familyId, members, tasks }: Props) {
  const [text, setText] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [processed, setProcessed] = useState<SortedItem[]>([])
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [loading, setLoading] = useState(false)

  const memberById = (id: string) => members.find(m => m.id === id)

  // Stats from tasks
  const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
  const openTasks = tasks.filter(t => !t.done)
  const urgent    = openTasks.filter(t => t.priority === 'urgent')
  const dueToday  = openTasks.filter(t => t.due_date === today)

  const addItem = (t: string) => {
    if (!t.trim()) return
    setItems(p => [...p, t.trim()])
    setText('')
  }

  const smartSort = async () => {
    if (!items.length) return
    const placeholders: SortedItem[] = items.map(text => ({
      text, cat: 'home', priority: 'normal', assignee: 'both', related_member_ids: [], aiPending: true,
    }))
    setProcessed(placeholders)
    setStep('review')
    setLoading(true)

    const timeout = new Promise<{ ok: false }>(resolve => setTimeout(() => resolve({ ok: false }), 4000))
    const fetchAi = fetch('/api/sort-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, familyId }),
    }).then(async r => r.ok ? { ok: true as const, data: await r.json() } : { ok: false as const })
      .catch(() => ({ ok: false as const }))

    const winner = await Promise.race([fetchAi, timeout])
    if (winner.ok && 'data' in winner) {
      setProcessed((winner.data.result as SortedItem[]).map(x => ({ ...x, aiPending: false })))
    } else {
      setProcessed(items.map(fallbackItem))
    }
    setLoading(false)
  }

  const fallbackItem = (text: string): SortedItem => {
    const lower = text.toLowerCase()
    let cat: Category = 'home'
    let priority: 'urgent' | 'soon' | 'normal' = 'normal'
    if (/רופא|תור|מרשם|חיסון|ריפוי|אורתופד|ביטוח בריאות/.test(lower)) cat = 'medical'
    else if (/לימוד|עבודה|בוחן|מבחן|קורס/.test(lower)) cat = 'studies'
    else if (/חוג|שחיי|ציור|מוזיקה|ריקוד|טיפול/.test(lower)) cat = 'hobbies'
    else if (/גן|בית ספר|אסיפה|קייטנה|מסגרת/.test(lower)) cat = 'formal'
    else if (/כסף|לשלם|ביטוח לאומי|חשבון|תשלום|מס/.test(lower)) cat = 'finance'
    else if (/מילואים|ציוד|צבא/.test(lower)) cat = 'miluim'
    if (/דחוף|מיד|היום|חירום/.test(lower)) priority = 'urgent'
    else if (/השבוע|בקרוב/.test(lower)) priority = 'soon'
    const related = members.filter(m => m.is_active && text.includes(m.name)).map(m => m.id)
    return { text, cat, priority, assignee: 'both', related_member_ids: related, aiPending: false }
  }

  const confirmAll = () => {
    processed.forEach(p => {
      onAdd({
        text: p.text, category: p.cat, assignee: p.assignee, priority: p.priority,
        due_date: null, recur: '', note: '', done: false, related_member_ids: p.related_member_ids,
      })
    })
    setItems([]); setProcessed([]); setStep('input')
  }

  const updateProcessed = <K extends keyof SortedItem>(i: number, field: K, val: SortedItem[K]) =>
    setProcessed(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const toggleMember = (i: number, memberId: string) =>
    setProcessed(p => p.map((item, idx) => {
      if (idx !== i) return item
      const has = item.related_member_ids.includes(memberId)
      return { ...item, related_member_ids: has ? item.related_member_ids.filter(id => id !== memberId) : [...item.related_member_ids, memberId] }
    }))

  if (step === 'review') {
    return (
      <div className="animate-fade-in space-y-4">
        <div>
          <div className="text-lg font-bold mb-0.5" style={{ color: '#111827' }}>סיווג חכם ✨</div>
          <div className="text-sm" style={{ color: '#9CA3AF' }}>בדוק וערוך לפני השמירה</div>
        </div>
        <div className="space-y-3">
          {processed.map((item, i) => {
            const colors = CAT_COLOR[item.cat]
            return (
              <div key={i} className="rounded-2xl p-4 space-y-3"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div className="flex justify-between items-start gap-2">
                  <div className="font-semibold text-sm" style={{ color: '#111827' }}>{item.text}</div>
                  {item.aiPending && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full animate-pulse shrink-0"
                      style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED' }}>⏳ AI...</span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <select value={item.cat} onChange={e => updateProcessed(i, 'cat', e.target.value as Category)}
                    className="px-3 py-1.5 rounded-xl text-xs outline-none font-medium"
                    style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                  <select value={item.priority} onChange={e => updateProcessed(i, 'priority', e.target.value as SortedItem['priority'])}
                    className="px-3 py-1.5 rounded-xl text-xs outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: '#374151' }}>
                    <option value="urgent">🔴 דחוף</option>
                    <option value="soon">🟠 השבוע</option>
                    <option value="normal">🟣 רגיל</option>
                  </select>
                  <select value={item.assignee} onChange={e => updateProcessed(i, 'assignee', e.target.value as Assignee)}
                    className="px-3 py-1.5 rounded-xl text-xs outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: '#374151' }}>
                    {(['adi','tahel','both'] as const).map(a => <option key={a} value={a}>{ASSIGNEE_LABEL[a]}</option>)}
                  </select>
                </div>
                {members.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {members.map(m => {
                      const active = item.related_member_ids.includes(m.id)
                      return (
                        <button key={m.id} onClick={() => toggleMember(i, m.id)}
                          className="px-2.5 py-1 rounded-full text-xs transition-all"
                          style={active
                            ? { background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)', color: '#DB2777' }
                            : { background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: '#9CA3AF' }}>
                          {m.gender === 'female' ? '👧' : '👦'} {m.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setStep('input')}
            className="px-5 py-3 rounded-2xl text-sm font-medium"
            style={{ background: 'rgba(0,0,0,0.05)', color: '#6B7280' }}>חזרה</button>
          <button onClick={confirmAll} disabled={processed.some(p => p.aiPending)}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)', opacity: processed.some(p => p.aiPending) ? 0.5 : 1 }}>
            {processed.some(p => p.aiPending) ? '⏳ ממתין לסיווג...' : `✅ שמור ${processed.length} מטלות`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5">

      {/* ── Stats row ── */}
      <div className="flex gap-3">
        <StatCard icon="✅" label="מטלות פתוחות" value={openTasks.length} color="#7C3AED" />
        <StatCard icon="🔴" label="דחופות" value={urgent.length} color={urgent.length ? '#DC2626' : '#9CA3AF'}
          sub={urgent[0]?.text.slice(0, 18) + (urgent[0] && urgent[0].text.length > 18 ? '…' : '') || undefined} />
        <StatCard icon="📅" label="להיום" value={dueToday.length} color={dueToday.length ? '#2563EB' : '#9CA3AF'} />
      </div>

      {/* ── Urgent tasks preview ── */}
      {urgent.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: '#DC2626' }}>🔴 דחוף עכשיו</div>
          <div className="space-y-1.5">
            {urgent.slice(0, 3).map(t => (
              <div key={t.id} className="text-sm font-medium" style={{ color: '#111827' }}>· {t.text}</div>
            ))}
            {urgent.length > 3 && <div className="text-xs" style={{ color: '#9CA3AF' }}>ועוד {urgent.length - 3}…</div>}
          </div>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.15)', boxShadow: '0 2px 12px rgba(124,58,237,0.08)' }}>
        <div className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>📥 מה על הלב?</div>
        <div className="flex gap-2 mb-3">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem(text)}
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{ background: 'rgba(124,58,237,0.05)', border: '1.5px solid rgba(124,58,237,0.2)', color: '#111827' }}
            placeholder="כתוב מחשבה, מטלה, תזכורת…" autoFocus />
          <button onClick={() => addItem(text)}
            className="px-4 py-3 rounded-xl font-bold text-white text-lg"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>＋</button>
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.filter(s => !items.includes(s)).slice(0, 4).map(s => (
            <button key={s} onClick={() => addItem(s)}
              className="px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#7C3AED' }}>
              + {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Queued items ── */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold" style={{ color: '#6B7280' }}>ממתינות לסיווג ({items.length})</div>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between items-center px-4 py-3 rounded-xl"
              style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>
              <span className="text-sm" style={{ color: '#111827' }}>{item}</span>
              <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                className="text-sm transition-colors" style={{ color: '#D1D5DB' }}
                onMouseOver={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseOut={e => (e.currentTarget.style.color = '#D1D5DB')}>✕</button>
            </div>
          ))}
          <button onClick={smartSort} disabled={loading}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white mt-1 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)', opacity: loading ? 0.7 : 1 }}>
            {loading ? '⏳ מסווג עם AI...' : '✨ סווג אוטומטית'}
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {items.length === 0 && openTasks.length === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-sm font-medium" style={{ color: '#374151' }}>אין מטלות פתוחות</div>
          <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>כתוב למעלה להוסיף</div>
        </div>
      )}
    </div>
  )
}
