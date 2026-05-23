'use client'

import { useState, useEffect, useCallback } from 'react'
import { Vehicle, Subscription, Schedule } from './types'
import { supabase } from './supabase'

type FactRow = Vehicle | Subscription | Schedule

function makeHook<T extends FactRow>(table: 'vehicles' | 'subscriptions' | 'schedules') {
  return function useFactList(familyId: string | null) {
    const [items, setItems] = useState<T[]>([])
    const [loading, setLoading] = useState(true)

    const refetch = useCallback(async () => {
      if (!familyId) return
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: true })
      setItems((data || []) as T[])
      setLoading(false)
    }, [familyId])

    useEffect(() => {
      if (!familyId) return
      refetch()
      const channel = supabase
        .channel(`${table}-${familyId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` },
          () => refetch()
        )
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }, [familyId, refetch])

    const add = useCallback(async (m: Partial<T>) => {
      if (!familyId) return
      await supabase.from(table).insert({ ...m, family_id: familyId })
    }, [familyId])

    const update = useCallback(async (id: string, patch: Partial<T>) => {
      const { error } = await supabase.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) console.error(`${table} update failed`, error)
    }, [])

    const remove = useCallback(async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) console.error(`${table} delete failed`, error)
      setItems(prev => prev.filter(x => x.id !== id))
    }, [])

    return { items, loading, add, update, remove }
  }
}

export const useVehicles      = makeHook<Vehicle>('vehicles')
export const useSubscriptions = makeHook<Subscription>('subscriptions')
export const useSchedules     = makeHook<Schedule>('schedules')
