'use client'

import { useState } from 'react'

const EQUIPMENT_LIST = [
  { item: 'תעודת זהות + ספר מילואים', done: false },
  { item: 'מדים (2 סטים)', done: false },
  { item: 'נעליים צבאיות', done: false },
  { item: 'כובע + חגורה', done: false },
  { item: 'מטען + כבל', done: false },
  { item: 'בגדי ספורט', done: false },
  { item: 'מוצרי היגיינה', done: false },
  { item: 'תרופות קבועות', done: false },
  { item: 'כסף מזומן', done: false },
  { item: 'ספר / אוזניות', done: false },
]

const EMERGENCY_CONTACTS = [
  { name: 'תהלה', phone: '050-XXXXXXX', role: 'בן/בת זוג' },
  { name: 'גן נעמי', phone: '03-XXXXXXX', role: 'גן' },
  { name: 'בית ספר הלל', phone: '03-XXXXXXX', role: 'בית ספר' },
]

export default function MiluimMode() {
  const [equipment, setEquipment] = useState(EQUIPMENT_LIST)
  const [contacts, setContacts] = useState(EMERGENCY_CONTACTS)
  const [newContact, setNewContact] = useState({ name: '', phone: '', role: '' })
  const [addingContact, setAddingContact] = useState(false)
  const [tasks, setTasks] = useState<{text:string; done:boolean}[]>([
    { text: 'לעדכן תהלה על משמרות השבוע', done: false },
    { text: 'להסדיר איסוף ילדים', done: false },
    { text: 'לצלם מסמכים חשובים', done: false },
  ])
  const [newTask, setNewTask] = useState('')

  const packedCount = equipment.filter(e => e.done).length
  const pct = Math.round(packedCount / equipment.length * 100)

  return (
    <div className="animate-fade-in space-y-5">
      <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(100,116,139,0.2), rgba(51,65,85,0.3))', border: '1px solid rgba(148,163,184,0.2)' }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🪖</span>
          <div>
            <div className="text-lg font-extrabold">מצב מילואים</div>
            <div className="text-xs text-gray-400">כל מה שצריך במקום אחד</div>
          </div>
        </div>
      </div>

      {/* Equipment checklist */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex justify-between items-center mb-1">
          <div className="text-sm font-bold">🎒 ציוד ({packedCount}/{equipment.length})</div>
          <div className="text-xs text-gray-400">{pct}%</div>
        </div>
        <div className="h-1.5 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #64748b, #94a3b8)' }} />
        </div>
        <div className="space-y-2">
          {equipment.map((e, i) => (
            <div key={i} onClick={() => setEquipment(p => p.map((x, j) => j === i ? { ...x, done: !x.done } : x))}
              className="flex items-center gap-3 cursor-pointer py-1.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                style={e.done
                  ? { background: '#94a3b8', border: '2px solid #94a3b8', color: '#000' }
                  : { border: '2px solid rgba(255,255,255,0.15)' }}>
                {e.done && '✓'}
              </div>
              <span className={`text-sm ${e.done ? 'line-through text-gray-500' : ''}`}>{e.item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Before-you-go tasks */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-sm font-bold mb-3">📋 לסדר לפני היציאה</div>
        <div className="space-y-2 mb-3">
          {tasks.map((t, i) => (
            <div key={i} onClick={() => setTasks(p => p.map((x, j) => j === i ? { ...x, done: !x.done } : x))}
              className="flex items-center gap-3 cursor-pointer py-1.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                style={t.done
                  ? { background: '#34d399', border: '2px solid #34d399', color: '#000' }
                  : { border: '2px solid rgba(255,255,255,0.15)' }}>
                {t.done && '✓'}
              </div>
              <span className={`text-sm ${t.done ? 'line-through text-gray-500' : ''}`}>{t.text}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { setTasks(p => [...p, { text: newTask.trim(), done: false }]); setNewTask('') } }}
            className="flex-1 px-3 py-2 rounded-xl text-xs outline-none text-white"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
            placeholder="הוסף סידור..." />
          <button onClick={() => { if (newTask.trim()) { setTasks(p => [...p, { text: newTask.trim(), done: false }]); setNewTask('') } }}
            className="px-3 py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: 'rgba(124,58,237,0.5)' }}>＋</button>
        </div>
      </div>

      {/* Emergency contacts */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-sm font-bold mb-3">📞 אנשי קשר חירום</div>
        <div className="space-y-2 mb-3">
          {contacts.map((c, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">{c.role}</div>
              </div>
              <a href={`tel:${c.phone}`} className="text-xs px-3 py-1.5 rounded-xl font-semibold" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                📞 {c.phone}
              </a>
            </div>
          ))}
        </div>
        {addingContact ? (
          <div className="space-y-2">
            {['name','phone','role'].map(f => (
              <input key={f} value={(newContact as any)[f]} onChange={e => setNewContact(p => ({ ...p, [f]: e.target.value }))}
                placeholder={{ name:'שם', phone:'טלפון', role:'תפקיד' }[f]}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
            ))}
            <div className="flex gap-2">
              <button onClick={() => setAddingContact(false)} className="flex-1 py-2 rounded-xl text-xs text-gray-400" style={{ background: 'rgba(255,255,255,0.05)' }}>ביטול</button>
              <button onClick={() => { if (newContact.name) { setContacts(p => [...p, newContact]); setNewContact({ name:'', phone:'', role:'' }); setAddingContact(false) } }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background: 'rgba(124,58,237,0.5)' }}>שמור</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingContact(true)}
            className="w-full py-2 rounded-xl text-xs text-gray-500 transition-all hover:text-purple-400"
            style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
            ＋ הוסף איש קשר
          </button>
        )}
      </div>
    </div>
  )
}
