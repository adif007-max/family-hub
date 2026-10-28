'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Task, Category, Vehicle, Subscription } from '@/lib/types'
import { useAuth } from '@/lib/useAuth'
import { useTasks } from '@/lib/useTasks'
import { useMembers } from '@/lib/useMembers'
import { supabase } from '@/lib/supabase'
import { ensureReminders } from '@/lib/ensureReminders'
import TaskModal from '@/components/TaskModal'
import TaskBoard from '@/components/TaskBoard'
import QuickInbox from '@/components/QuickInbox'
import InfoTab from '@/components/InfoTab'
import MagicLinkLogin from '@/components/MagicLinkLogin'

type Tab = 'inbox' | 'tasks' | 'info'

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #fdf4ff 60%, #fff0f6 100%)' }}>
      <div className="text-4xl animate-pulse">✨</div>
    </div>
  )
}

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

export default function Home() {
  const { session, familyId, loading: authLoading, signOut } = useAuth()
  const { tasks, loading: tasksLoading, addTask, saveTask, toggleDone, deleteTask } = useTasks(familyId)
  const { members } = useMembers(familyId)

  const [tab, setTab] = useState<Tab>('inbox')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [defaultCat, setDefaultCat] = useState<Category>('home')

  const remindedRef = useRef(false)
  useEffect(() => {
    if (!familyId || tasksLoading || remindedRef.current) return
    remindedRef.current = true
    ;(async () => {
      const [{ data: v }, { data: s }] = await Promise.all([
        supabase.from('vehicles').select('*').eq('family_id', familyId),
        supabase.from('subscriptions').select('*').eq('family_id', familyId),
      ])
      await ensureReminders(familyId, tasks, (v || []) as Vehicle[], (s || []) as Subscription[])
    })()
  }, [familyId, tasksLoading, tasks])

  if (authLoading) return <Loader />
  if (!session) return <MagicLinkLogin />
  if (!familyId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'linear-gradient(135deg, #f0f4ff, #fdf4ff)' }}>
        <div className="text-3xl mb-3">🔒</div>
        <div className="text-base font-medium mb-2" style={{ color: '#374151' }}>המייל הזה לא מורשה</div>
        <div className="text-sm mb-6" style={{ color: '#9CA3AF' }}>פנה לעדי כדי להוסיף אותך למשפחה</div>
        <button onClick={signOut} className="text-sm underline" style={{ color: '#9CA3AF' }}>התנתק</button>
      </div>
    )
  }

  const openAdd = (cat?: Category) => { setEditTask(null); setDefaultCat(cat || 'home'); setModalOpen(true) }
  const openEdit = (task: Task) => { setEditTask(task); setModalOpen(true) }
  const onSave = (task: Task) => { saveTask(task); setModalOpen(false) }

  const urgentCount   = tasks.filter(t => t.priority === 'urgent' && !t.done).length
  const openCount     = tasks.filter(t => !t.done).length

  const now     = new Date()
  const dayName = HEB_DAYS[now.getDay()]
  const dateStr = `${now.getDate()} ${HEB_MONTHS[now.getMonth()]}`

  const TABS = [
    { id: 'inbox' as Tab, label: '📥 Inbox',  badge: 0 },
    { id: 'tasks' as Tab, label: '✅ מטלות', badge: openCount },
    { id: 'info'  as Tab, label: '📋 מידע',   badge: 0 },
  ]

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(160deg, #f0f4ff 0%, #faf4ff 45%, #fff0f9 100%)' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(240,244,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-0">
          {/* Top row */}
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="text-xl font-bold" style={{ color: '#111827' }}>
                משפחת <span style={{ color: '#7C3AED' }}>פינקלשטיין</span> ✨
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>יום {dayName}, {dateStr}</div>
            </div>
            <div className="flex items-center gap-2">
              {urgentCount > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                  🔴 {urgentCount} דחוף
                </div>
              )}
              <Link href="/settings/family"
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED' }}>⚙</Link>
              <button onClick={signOut}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.05)', color: '#9CA3AF' }}>⏏</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex-1 py-2.5 rounded-t-xl text-sm font-medium transition-all relative flex items-center justify-center gap-1.5"
                  style={active
                    ? { background: '#fff', color: '#7C3AED', boxShadow: '0 -2px 8px rgba(124,58,237,0.08)', borderBottom: '2px solid #7C3AED' }
                    : { background: 'transparent', color: '#9CA3AF' }}>
                  {t.label}
                  {t.badge > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: active ? 'rgba(124,58,237,0.12)' : 'rgba(0,0,0,0.07)', color: active ? '#7C3AED' : '#6B7280' }}>
                      {t.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-2xl mx-auto px-4 py-5">
        {tasksLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-3xl animate-pulse">✨</div>
            <div className="text-sm" style={{ color: '#9CA3AF' }}>טוען…</div>
          </div>
        ) : (
          <>
            {tab === 'inbox' && <QuickInbox onAdd={addTask} familyId={familyId} members={members} tasks={tasks} />}
            {tab === 'tasks' && <TaskBoard  tasks={tasks} members={members} onToggle={toggleDone} onEdit={openEdit} onDelete={deleteTask} onAdd={openAdd} />}
            {tab === 'info'  && <InfoTab    familyId={familyId} members={members} />}
          </>
        )}
      </main>

      {/* ── FAB ── */}
      <button onClick={() => openAdd()}
        className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl text-white transition-transform active:scale-95"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)', boxShadow: '0 6px 20px rgba(124,58,237,0.45)' }}>
        ＋
      </button>

      {modalOpen && <TaskModal task={editTask} defaultCategory={defaultCat} members={members} onSave={onSave} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
