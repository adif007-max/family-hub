'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Task, Category } from '@/lib/types'
import { useAuth } from '@/lib/useAuth'
import { useTasks } from '@/lib/useTasks'
import { useMembers } from '@/lib/useMembers'
import TaskModal from '@/components/TaskModal'
import TaskBoard from '@/components/TaskBoard'
import QuickInbox from '@/components/QuickInbox'
import MagicLinkLogin from '@/components/MagicLinkLogin'

type Tab = 'inbox' | 'tasks'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox',  icon: '📥' },
  { id: 'tasks', label: 'מטלות', icon: '✅' },
]

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f1a' }}>
      <div className="text-4xl animate-pulse">✨</div>
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

  if (authLoading) return <Loader />
  if (!session) return <MagicLinkLogin />
  if (!familyId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#0f0f1a' }}>
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-lg font-bold mb-2">המייל הזה לא מורשה</div>
        <div className="text-sm text-gray-500 mb-6">פנה לעדי כדי להוסיף אותך למשפחה</div>
        <button onClick={signOut} className="text-xs text-gray-500 underline">התנתק</button>
      </div>
    )
  }

  const openAdd = (cat?: Category) => { setEditTask(null); setDefaultCat(cat || 'home'); setModalOpen(true) }
  const openEdit = (task: Task) => { setEditTask(task); setModalOpen(true) }

  const onSave = (task: Task) => { saveTask(task); setModalOpen(false) }

  const urgentCount = tasks.filter(t => t.priority === 'urgent' && !t.done).length

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
            <Link href="/settings/family" title="הגדרות משפחה" className="text-sm px-2 py-1.5 rounded-xl text-gray-500 hover:text-white transition-all">⚙</Link>
            <button onClick={signOut} title="התנתק" className="text-sm px-2 py-1.5 rounded-xl text-gray-500 hover:text-white transition-all">⏏</button>
          </div>
        </div>
        <div className="flex px-4 pb-3 gap-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all"
              style={tab === t.id
                ? { background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }
                : { border: '1px solid rgba(255,255,255,0.05)', color: '#6b7280' }}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 py-4">
        {tasksLoading ? (
          <div className="text-center py-20 text-gray-600 text-sm animate-pulse">טוען מטלות...</div>
        ) : (
          <>
            {tab === 'inbox' && <QuickInbox onAdd={addTask} familyId={familyId} members={members} />}
            {tab === 'tasks' && <TaskBoard  tasks={tasks} members={members} onToggle={toggleDone} onEdit={openEdit} onDelete={deleteTask} onAdd={openAdd} />}
          </>
        )}
      </main>

      <button onClick={() => openAdd()}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 font-bold text-white px-6 py-3.5 rounded-2xl flex items-center gap-2 text-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}>
        ＋ מטלה חדשה
      </button>

      {modalOpen && <TaskModal task={editTask} defaultCategory={defaultCat} members={members} onSave={onSave} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
