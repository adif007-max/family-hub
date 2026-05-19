'use client'

import { useState } from 'react'
import { Task, Category, CATEGORIES } from '@/lib/types'

interface Props { onAdd: (task: Task) => void }

const SUGGESTIONS = [
  'לקנות חלב',
  'תור לרופא — הלל',
  'לשלם ביטוח לאומי',
  'לתקן ברז',
  'אסיפת הורים — רחל',
]

export default function QuickInbox({ onAdd }: Props) {
  const [text, setText] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [processed, setProcessed] = useState<{text: string; cat: Category; priority: 'urgent'|'soon'|'normal'}[]>([])
  const [step, setStep] = useState<'input'|'review'>('input')

  const addItem = (t: string) => {
    if (!t.trim()) return
    setItems(p => [...p, t.trim()])
    setText('')
  }

  const smartSort = () => {
    const result = items.map(text => {
      const lower = text.toLowerCase()
      let cat: Category = 'home'
      let priority: 'urgent'|'soon'|'normal' = 'normal'

      if (/רופא|תור|מרשם|חיסון|ריפוי|אורתופד|ביטוח בריאות/.test(lower)) cat = 'medical'
      else if (/לימוד|עבודה|בוחן|מבחן|קורס/.test(lower)) cat = 'studies'
      else if (/חוג|שחיי|ציור|מוזיקה|ריקוד|טיפול/.test(lower)) cat = 'hobbies'
      else if (/גן|בית ספר|אסיפה|קייטנה|מסגרת/.test(lower)) cat = 'formal'
      else if (/כסף|לשלם|ביטוח לאומי|חשבון|תשלום|מס/.test(lower)) cat = 'finance'
      else if (/מילואים|ציוד|צבא/.test(lower)) cat = 'miluim'

      if (/דחוף|מיד|היום|חירום/.test(lower)) priority = 'urgent'
      else if (/השבוע|בקרוב/.test(lower)) priority = 'soon'

      return { text, cat, priority }
    })
    setProcessed(result)
    setStep('review')
  }

  const confirmAll = () => {
    processed.forEach(p => {
      const task: Task = {
        id: String(Date.now() + Math.random()),
        created_at: new Date().toISOString(),
        text: p.text, category: p.cat,
        assignee: 'adi', priority: p.priority,
        due_date: null, recur: '', note: '',
        done: false, done_at: null, stuck_since: null, family_id: 'fink',
      }
      onAdd(task)
    })
    setItems([]); setProcessed([]); setStep('input')
  }

  const updateProcessed = (i: number, field: 'cat'|'priority', val: string) => {
    setProcessed(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
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
              <div className="flex gap-2 flex-wrap">
                <select value={item.cat} onChange={e => updateProcessed(i, 'cat', e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs outline-none text-white"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <select value={item.priority} onChange={e => updateProcessed(i, 'priority', e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs outline-none text-white"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="urgent">🔴 דחוף</option>
                  <option value="soon">🟠 השבוע</option>
                  <option value="normal">🟣 רגיל</option>
                </select>
              </div>
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
        <div className="text-sm text-gray-400">זרוק מחשבות — ממיין אוטומטית לקטגוריות</div>
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
          <button onClick={smartSort}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white mt-2"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
            ✨ סווג אוטומטית
          </button>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-10 text-gray-600">
          <div className="text-4xl mb-3">📥</div>
          <div className="text-sm">כתוב מה שעל הלב —<br />המערכת תמיין לקטגוריות</div>
        </div>
      )}
    </div>
  )
}
