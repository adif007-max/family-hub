'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Task } from './types'
import { supabase } from './supabase'

type Row = Omit<Task, 'recur' | 'note' | 'related_member_ids'> & {
  recur: string | null
  note: string | null
  related_member_ids: string[] | null
}

function rowToTask(r: Row): Task {
  return {
    ...r,
    id: String(r.id),
    recur: (r.recur || '') as Task['recur'],
    note: r.note || '',
    related_member_ids: r.related_member_ids || [],
  }
}

// strip client-only fields so the DB generates id + created_at
function taskToInsert(t: Partial<Task>, familyId: string) {
  return {
    family_id: familyId,
    text: t.text,
    category: t.category,
    assignee: t.assignee,
    priority: t.priority,
    due_date: t.due_date ?? null,
    recur: t.recur ?? '',
    note: t.note ?? '',
    done: t.done ?? false,
    done_at: t.done_at ?? null,
    stuck_since: t.stuck_since ?? null,
    related_member_ids: t.related_member_ids ?? [],
  }
}

export function useTasks(familyId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const migratedRef = useRef(false)

  const refetch = useCallback(async () => {
    if (!familyId) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
    setTasks((data || []).map(rowToTask))
    setLoading(false)
  }, [familyId])

  // one-time migration of localStorage tasks → Supabase
  const migrate = useCallback(async () => {
    if (migratedRef.current || !familyId) return
    migratedRef.current = true
    if (localStorage.getItem('famMigratedV1')) return
    let local: Task[] = []
    try { local = JSON.parse(localStorage.getItem('famTasksV2') || 'null') || [] } catch { local = [] }
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', familyId)
    if ((count ?? 0) === 0 && local.length > 0) {
      await supabase.from('tasks').insert(local.map(t => taskToInsert(t, familyId)))
    }
    localStorage.setItem('famMigratedV1', '1')
  }, [familyId])

  useEffect(() => {
    if (!familyId) return
    let active = true
    ;(async () => {
      await migrate()
      if (active) await refetch()
    })()

    const channel = supabase
      .channel(`tasks-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `family_id=eq.${familyId}` },
        () => refetch()
      )
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [familyId, migrate, refetch])

  const addTask = useCallback(async (t: Partial<Task>) => {
    if (!familyId) return
    await supabase.from('tasks').insert(taskToInsert(t, familyId))
  }, [familyId])

  const saveTask = useCallback(async (t: Task) => {
    if (!familyId) return
    const exists = tasks.some(x => x.id === t.id)
    if (exists) {
      await supabase.from('tasks').update(taskToInsert(t, familyId)).eq('id', t.id)
    } else {
      await supabase.from('tasks').insert(taskToInsert(t, familyId))
    }
  }, [familyId, tasks])

  const toggleDone = useCallback(async (id: string) => {
    const t = tasks.find(x => x.id === id)
    if (!t) return
    await supabase
      .from('tasks')
      .update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null })
      .eq('id', id)
  }, [tasks])

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      console.error('deleteTask failed', error)
      if (typeof window !== 'undefined') alert(`מחיקה נכשלה: ${error.message}`)
      return
    }
    // optimistic update so the row disappears even before realtime fires
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  return { tasks, loading, addTask, saveTask, toggleDone, deleteTask }
}
