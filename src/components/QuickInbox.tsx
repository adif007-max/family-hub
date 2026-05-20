'use client'

import { useState } from 'react'
import { Task, Category, CATEGORIES, FamilyMember, Assignee } from '@/lib/types'

interface SortedItem {
  text: string
  cat: Category
  priority: 'urgent' | 'soon' | 'normal'
  assignee: Assignee
  related_member_ids: string[]
}

interface Props {
  onAdd: (task: Partial<Task>) => void
  familyId: string
  members: FamilyMember[]
}

const SUGGESTIONS = [
  'לקנות חלב',
  'תור לרופא — הלל',
  'לשלם ביטוח לאומי',
  'לתקן ברז',
  'אסיפת הורים — רחל',
]

const ASSIGNEE_LABEL: Record<Assignee, string> = { adi: '👨 עדי', tahel: '👩 תהלה', both: '👨‍👩 שנינו' }

export default function QuickInbox({ onAdd, familyId, members }: Props) {
  const [text, setText] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [processed, setProcessed] = useState<SortedItem[]>([])
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [loading, setLoading] = useState(false)

  const memberById = (id: string) => members.find(m => m.id === id)

  const addItem = (t: string) => {
    if (!t.trim()) return
    setItems(p => [...p, t.trim()])
    setText('')
  }

  const smartSort = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sort-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, familyId }),
      })
      if (res.ok) {
        const { result } = await res.json()
        setProcessed(result)
        setStep('review')
      } else {
        fallbackSort()
      }
    } catch {
      fallbackSort()
    } finally {
      setLoading(false)
    }
  }

  const fallbackSort = () => {
    const result: SortedItem[] = items.map(text => {
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

      // crude name detection for fallback only
      const related = members.filter(m => text.includes(m.name)).map(m => m.id)
      return { text, cat, priority, assignee: 'both', related_member_ids: related }
    })
    setProcessed(result)
    setStep('review')
  }

  const confirmAll = () => {
    processed.forEach(p => {
      onAdd({
        text: p.text,
        category: p.cat,
        assignee: p.assignee,
        priority: p.priority,
        due_date: null,
        recur: '',
        note: '',
        done: false,
        related_member_ids: p.related_member_ids,
      })
    })
    setItems([]); setProcessed([]); setStep('input')
  }

  const updateProcessed = <K extends keyof SortedItem>(i: number, field: K, val: SortedItem[K]) => {
    setProcessed(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }

  const toggleMember = (i: number, memberId: string) => {
    setProcessed(p => p.map((item, idx) => {
      if (idx !== i) return item
      const has = item.related_member_ids.includes(memberId)
      return {
        ...item,
        related_member_ids: has
          ? item.related_member_ids.filter(id => id !== memberId)
          : [...item.related_member_ids, memberId],
      }
    }))
  }

  if (step === 'review') {
    return (
      <div className="animate-fade-in space-y-4">
        <div>
          <div className="text-lg font-extrabold mb-1">סיווג חכם ✨</div>
          <div className="text-sm text-gray-400">בדוק וערוך לפני השמירה</div>
        </div>
        <div className="space-y-3">
          {processed.map((item, i) => (
            <div key={i} className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="font-semibold text-sm">{item.text}</div>

              {/* Category + Priority + Assignee */}
              <div className="flex gap-2 flex-wrap">
                <select value={item.cat} onChange={e => updateProcessed(i, 'cat', e.target.value as Category)}
                  className="px-3 py-1.5 rounded-xl text-xs outline-none text-white"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <select value={item.priority} onChange={e => updateProcessed(i, 'priority', e.target.value as SortedItem['priority'])}
                  className="px-3 py-1.5 rounded-xl text-xs outline-none text-white"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="urgent">🔴 דחוף</option>
                  <option value="soon">🟠 השבוע</option>
                  <option value="normal">🟣 רגיל</option>
                </select>
                <select value={item.assignee} onChange={e => updateProcessed(i, 'assignee', e.target.value as Assignee)}
                  className="px-3 py-1.5 rounded-xl text-xs outline-none text-white"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {(['adi','tahel','both'] as const).map(a => <option key={a} value={a}>{ASSIGNEE_LABEL[a]}</option>)}
                </select>
              </div>

              {/* Children chips (multi-select) */}
              {members.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {members.map(m => {
                    const active = item.related_member_ids.includes(m.id)
                    const emoji = m.gender === 'female' ? '👧' : '👦'
                    return (
                      <button key={m.id} onClick={() => toggleMember(i, m.id)}
                        className="px-2.5 py-1 rounded-full text-xs transition-all"
                        style={active
                          ? { background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.4)', color: '#f9a8d4' }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                        {emoji} {m.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setStep('input')} className="px-5 py-3 rounded-2xl text-sm font-semibold text-gray-400"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>חזרה</button>
          <button onClick={confirmAll} className="flex-1 py-3 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
            ✅ שמור {processed.length} מטלות
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <div className="text-lg font-extrabold mb-1">📥 Quick Inbox</div>
        <div className="text-sm text-gray-400">זרוק מחשבות — ממיין אוטומטית לקטגוריות וילדים</div>
      </div>

      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem(text)}
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none text-white"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          placeholder="הכנס מחשבה..." autoFocus />
        <button onClick={() => addItem(text)}
          className="px-4 py-3 rounded-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>＋</button>
      </div>

      {/* Suggestions */}
      <div>
        <div className="text-xs text-gray-500 mb-2">הצעות מהירות:</div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.filter(s => !items.includes(s)).slice(0, 4).map(s => (
            <button key={s} onClick={() => addItem(s)}
              className="px-3 py-1.5 rounded-full text-xs text-gray-400 transition-all hover:text-white"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              + {s}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-semibold">ממתינות לסיווג ({items.length})</div>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between items-center px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span>{item}</span>
              <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} className="text-gray-600 hover:text-red-400 transition-all">✕</button>
            </div>
          ))}
          <button onClick={smartSort} disabled={loading}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white mt-2 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', opacity: loading ? 0.7 : 1 }}>
            {loading ? '⏳ מסווג עם AI...' : '✨ סווג אוטומטית'}
          </button>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-10 text-gray-600">
          <div className="text-4xl mb-3">📥</div>
          <div className="text-sm">כתוב מה שעל הלב —<br />המערכת תמיין לקטגוריות וילדים</div>
        </div>
      )}
    </div>
  )
}
