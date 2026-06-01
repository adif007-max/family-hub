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

const TABS: { id: Tab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'tasks', label: 'מטלות' },
  { id: 'info',  label: 'מידע' },
]

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#EEF3FA' }}>
      <div className="text-3xl animate-pulse" style={{ color: '#9CA3AF' }}>✨</div>
    </div>
  )
}

export default function Home() {
  const { session, familyId, loading: authLoading, signOut } = useAuth()
  const { tasks, loading: tasksLoading, addTask, saveTask, toggleDone, deleteTask } = useTasks(familyId)
  const { members } = useMembers(familyId)

  const [tab, setTab] = useState<Tab>('inbox')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [defaultCat, setDefaultCat] = useState<Category>('home')

  // Auto-reminder seeding: once per mount, after tasks are loaded.
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
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#EEF3FA' }}>
        <div className="text-3xl mb-3">🔒</div>
        <div className="text-base text-zinc-300 mb-2">המייל הזה לא מורשה</div>
        <div className="text-xs text-zinc-500 mb-6">פנה לעדי כדי להוסיף אותך למשפחה</div>
        <button onClick={signOut} className="text-xs text-zinc-500 underline">התנתק</button>
      </div>
    )
  }

  const openAdd = (cat?: Category) => { setEditTask(null); setDefaultCat(cat || 'home'); setModalOpen(true) }
  const openEdit = (task: Task) => { setEditTask(task); setModalOpen(true) }
  const onSave = (task: Task) => { saveTask(task); setModalOpen(false) }

  const urgentCount = tasks.filter(t => t.priority === 'urgent' && !t.done).length

  return (
    <div className="min-h-screen pb-24" style={{ background: '#EEF3FA', color: '#111827' }}>
      <header className="sticky top-0 z-50" style={{ background: 'rgba(238,243,250,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="px-4 pt-4 pb-2 flex justify-between items-center">
          <div className="text-base font-normal tracking-tight" style={{ color: '#111827' }}>
            משפחת{' '}<span style={{ color: '#7C3AED' }}>פינקלשטיין</span>
          </div>
          <div className="flex gap-3 items-center">
            {urgentCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F97316' }} />
                <span className="text-xs" style={{ color: '#6B7280' }}>{urgentCount}</span>
              </div>
            )}
            <button onClick={() => openAdd()} title="חדש"
              className="w-7 h-7 text-base transition-colors" style={{ color: '#6B7280' }}>＋</button>
            <Link href="/settings/family" title="הגדרות"
              className="text-sm transition-colors" style={{ color: '#9CA3AF' }}>⚙</Link>
            <button onClick={signOut} title="התנתק"
              className="text-sm transition-colors" style={{ color: '#9CA3AF' }}>⏏</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-6">
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="py-3 text-sm transition-colors relative"
                style={{
                  color: active ? '#111827' : '#9CA3AF',
                  borderBottom: active ? '2px solid #3B82F6' : '2px solid transparent',
                }}>
                {t.label}
              </button>
            )
          })}
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto">
        {tasksLoading ? (
          <div className="text-center py-20 text-zinc-600 text-sm animate-pulse">טוען…</div>
        ) : (
          <>
            {tab === 'inbox' && <QuickInbox onAdd={addTask} familyId={familyId} members={members} />}
            {tab === 'tasks' && <TaskBoard  tasks={tasks} members={members} onToggle={toggleDone} onEdit={openEdit} onDelete={deleteTask} onAdd={openAdd} />}
            {tab === 'info'  && <InfoTab    familyId={familyId} members={members} />}
          </>
        )}
      </main>

      <button onClick={() => openAdd()}
        className="fixed bottom-5 left-5 z-40 w-12 h-12 rounded-full flex items-center justify-center transition-colors"
        style={{ background: '#3B82F6', color: '#fff', boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}
        title="מטלה חדשה">
        <span className="text-xl leading-none">＋</span>
      </button>

      {modalOpen && <TaskModal task={editTask} defaultCategory={defaultCat} members={members} onSave={onSave} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
