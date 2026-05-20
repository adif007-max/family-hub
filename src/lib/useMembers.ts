'use client'

import { useState, useEffect, useCallback } from 'react'
import { FamilyMember } from './types'
import { supabase } from './supabase'

export function useMembers(familyId: string | null) {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!familyId) return
    const { data } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
    setMembers((data || []) as FamilyMember[])
    setLoading(false)
  }, [familyId])

  useEffect(() => {
    if (!familyId) return
    refetch()
    const channel = supabase
      .channel(`members-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_members', filter: `family_id=eq.${familyId}` },
        () => refetch()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [familyId, refetch])

  const addMember = useCallback(async (m: Partial<FamilyMember>) => {
    if (!familyId) return
    await supabase.from('family_members').insert({
      family_id: familyId,
      name: m.name,
      nicknames: m.nicknames ?? [],
      birth_date: m.birth_date ?? null,
      gender: m.gender ?? null,
      is_active: true,
    })
  }, [familyId])

  const updateMember = useCallback(async (id: string, patch: Partial<FamilyMember>) => {
    await supabase.from('family_members').update(patch).eq('id', id)
  }, [])

  const archiveMember = useCallback(async (id: string) => {
    await supabase.from('family_members').update({ is_active: false }).eq('id', id)
  }, [])

  return { members, loading, addMember, updateMember, archiveMember }
}
