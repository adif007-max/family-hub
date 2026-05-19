'use client'

import { useState, useEffect, useCallback } from 'react'
import { Task, Category, CATEGORIES } from '@/lib/types'
import TaskModal from '@/components/TaskModal'
import DailyDashboard from '@/components/DailyDashboard'
import TaskBoard from '@/components/TaskBoard'
import QuickInbox from '@/components/QuickInbox'
import WeeklyReview from '@/components/WeeklyReview'
import MiluimMode from '@/components/MiluimMode'

type Tab = 'today' | 'tasks' | 'inbox' | 'weekly' | 'miluim'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today',   label: 'היום',    icon: '☀️' },
  { id: 'tasks',   label: 'מטלות',   icon: '✅' },
  { id: 'inbox',   label: 'Inbox',   icon: '📥' },
  { id: 'weekly',  label: 'שבועי',   icon: '📊' },
  { id: 'miluim',  label: 'מילואים', icon: '🪖' },
]

const SEED_TASKS: Task[] = [
  { id:'1', created_at:'', text:'לחדש מרשם — עוז',             category:'medical', assignee:'adi',   priority:'urgent', due_date:'2026-05-21', recur:'', note:'', done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'2', created_at:'', text:'תור לרופא — הלל',             category:'medical', assignee:'tahel', priority:'soon',   due_date:'2026-05-25', recur:'', note:'', done:true,  done_at:null, stuck_since:null, family_id:'fink' },
  { id:'3', created_at:'', text:'תור לאורתופד — רחל',          category:'medical', assignee:'tahel', priority:'normal', due_date:'2026-05-28', recur:'', note:'קופת חולים', done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'4', created_at:'', text:'לתקן את הברז במטבח',          category:'home',    assignee:'adi',   priority:'urgent', due_date:'2026-05-20', recur:'', note:'', done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'5', created_at:'', text:'לקנות מצרכים',                category:'home',    assignee:'both',  priority:'normal', due_date:null,          recur:'weekly', note:'', done:true, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'6', created_at:'', text:'לשלם חשבון חשמל',             category:'home',    assignee:'adi',   priority:'soon',   due_date:'2026-05-31', recur:'monthly', note:'', done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'7', created_at:'', text:'עבודה בהיסטוריה',             category:'studies', assignee:'adi',   priority:'urgent', due_date:'2026-05-28', recur:'', note:'להגיש דיגיטלית', done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'8', created_at:'', text:'לחזור על חומר לבוחן',         category:'studies', assignee:'adi',   priority:'soon',   due_date:'2026-06-01', recur:'', note:'', done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'9', created_at:'', text:'אסיפת הורים — הלל',           category:'formal',  assignee:'both',  priority:'urgent', due_date:'2026-05-22', recur:'', note:'', done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'10',created_at:'', text:'טופס קייטנה — רחל',           category:'formal',  assignee:'tahel', priority:'soon',   due_date:'2026-05-25', recur:'', note:'', done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'11',created_at:'', text:'שכר לימוד יוני — נעמי',       category:'formal',  assignee:'adi',   priority:'normal', due_date:'2026-06-01', recur:'monthly', note:'', done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'12',created_at:'', text:'תור ריפוי בעיסוק — רחל',      category:'hobbies', assignee:'tahel', priority:'urgent', due_date:'2026-05-23', recur:'', note:"ד\"ר לוי", done:false, done_at:null, stuck_since:null, family_id:'fink' },
  { id:'13',created_at:'', text:'להרשים לשחייה — הלל',         category:'hobbies', assignee:'adi',   priority:'soon',   due_date:'2026-05-30', recur:'', note:'', done:true,  done_at:null, stuck_since:null, family_id:'fink' },
  { id:'14',created_at:'', text:'לשלם ביטוח לאומי',            category:'finance', assignee:'adi',   priority:'soon',   due_date:'2026-05-31', recur:'monthly', note:'', done:false, done_at:null, stuck_since:null, family_id:'fink' },
]

function loadTasks(): Task[] {
  if (typeof window === 'undefined') return SEED_TASKS
  try { return JSON.parse(localStorage.getItem('famTasksV2') || 'null') || SEED_TASKS }
  catch { return SEED_TASKS }
}
function saveTasks(tasks: Task[]) {
  if (typeof window !== 'undefined') localStorage.setItem('famTasksV2', JSON.stringify(tasks))
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [defaultCat, setDefaultCat] = useState<Category>('home')

  useEffect(() => { setTasks(loadTasks()) }, [])

  const updateTasks = useCallback((next: Task[]) => { setTasks(next); saveTasks(next) }, [])

  const toggleDone = useCallback((id: string) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, done: !t.done, done_at: !t.done ? new Date().toISOString() : null } : t)
      saveTasks(next); return next
    })
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => { const next = prev.filter(t => t.id !== id); saveTasks(next); return next })
  }, [])

  const openAdd = (cat?: Category) => { setEditTask(null); setDefaultCat(cat || 'home'); setModalOpen(true) }
  const openEdit = (task: Task) => { setEditTask(task); setModalOpen(true) }

  const saveTask = (task: Task) => {
    setTasks(prev => {
      const next = prev.find(t => t.id === task.id) ? prev.map(t => t.id === task.id ? task : t) : [...prev, task]
      saveTasks(next); return next
    })
    setModalOpen(false)
  }

  const addFromInbox = (task: Task) => {
    setTasks(prev => { const next = [...prev, task]; saveTasks(next); return next })
  }

  const urgentCount = tasks.filter(t => t.priority === 'urgent' && !t.done).length
  const todayStr = new Date().toISOString().split('T')[0]
  const todayCount = tasks.filter(t => t.due_date === todayStr && !t.done).length

  return (
    <div className="min-h-screen pb-24">
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full pointer-events-none opacity-10 -z-10"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
      <div className="fixed bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none opacity-10 -z-10"
        style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

      <header className="sticky top-0 z-50 border-b" style={{ background: 'rgba(15,15,26,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="text-lg font-black">
            משפחת{' '}
            <span className="bg-gradient-to-l from-purple-400 to-pink-400 bg-clip-text text-transparent">פינקלשטיין ✨</span>
          </div>
          <div className="flex gap-2 items-center">
            {urgentCount > 0 && (
              <div className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                🔥 {urgentCount}
              </div>
            )}
            <button onClick={() => openAdd()} className="text-sm font-bold px-3 py-1.5 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>＋</button>
          </div>
        </div>
        <div className="flex overflow-x-auto px-4 pb-3 gap-2" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={tab === t.id
                ? { background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }
                : { border: '1px solid transparent', color: '#6b7280' }}>
              <span>{t.icon}</span><span>{t.label}</span>
              {t.id === 'today' && todayCount > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{todayCount}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 py-4">
        {tab === 'today'  && <DailyDashboard tasks={tasks} onToggle={toggleDone} onEdit={openEdit} onAdd={() => openAdd()} />}
        {tab === 'tasks'  && <TaskBoard      tasks={tasks} onToggle={toggleDone} onEdit={openEdit} onDelete={deleteTask} onAdd={openAdd} onUpdate={updateTasks} />}
        {tab === 'inbox'  && <QuickInbox     onAdd={addFromInbox} />}
        {tab === 'weekly' && <WeeklyReview   tasks={tasks} />}
        {tab === 'miluim' && <MiluimMode />}
      </main>

      <button onClick={() => openAdd()}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 font-bold text-white px-6 py-3.5 rounded-2xl flex items-center gap-2 text-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}>
        ＋ מטלה חדשה
      </button>

      {modalOpen && <TaskModal task={editTask} defaultCategory={defaultCat} onSave={saveTask} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
