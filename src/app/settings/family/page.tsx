'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useMembers } from '@/lib/useMembers'
import { FamilyMember } from '@/lib/types'

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f1a' }}>
      <div className="text-4xl animate-pulse">✨</div>
    </div>
  )
}

export default function FamilyMembersSettings() {
  const { session, familyId, loading: authLoading } = useAuth()
  const { members, loading, addMember, updateMember, archiveMember } = useMembers(familyId)

  const [newName, setNewName]   = useState('')
  const [newGender, setNewGender] = useState<'male' | 'female'>('male')
  const [editing, setEditing]   = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNicks, setEditNicks] = useState('')

  if (authLoading || loading) return <Loader />
  if (!session || !familyId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f1a' }}>
        <Link href="/" className="text-purple-400 underline">חזרה</Link>
      </div>
    )
  }

  const startEdit = (m: FamilyMember) => {
    setEditing(m.id)
    setEditName(m.name)
    setEditNicks((m.nicknames || []).join(', '))
  }

  const saveEdit = async () => {
    if (!editing) return
    await updateMember(editing, {
      name: editName.trim(),
      nicknames: editNicks.split(',').map(s => s.trim()).filter(Boolean),
    })
    setEditing(null)
  }

  const add = async () => {
    if (!newName.trim()) return
    await addMember({ name: newName.trim(), gender: newGender })
    setNewName('')
  }

  const activeMembers   = members.filter(m => m.is_active)
  const archivedMembers = members.filter(m => !m.is_active)

  return (
    <div className="min-h-screen pb-12" style={{ background: '#0f0f1a' }}>
      <header className="sticky top-0 z-50 border-b" style={{ background: 'rgba(15,15,26,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-all">← חזרה</Link>
          <div className="text-lg font-black">👨‍👩‍👧‍👦 בני המשפחה</div>
          <div className="w-12" />
        </div>
      </header>

      <main className="px-4 py-5 max-w-xl mx-auto space-y-5">
        {/* Active members */}
        <div className="space-y-2">
          {activeMembers.map(m => (
            <div key={m.id} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {editing === m.id ? (
                <div className="space-y-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none text-white"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    placeholder="שם" />
                  <input value={editNicks} onChange={e => setEditNicks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none text-white"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    placeholder="כינויים (מופרדים בפסיק)" />
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-xl text-xs text-gray-400"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>ביטול</button>
                    <button onClick={saveEdit} className="flex-1 py-2 rounded-xl text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>שמור</button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{m.gender === 'female' ? '👧' : '👦'}</span>
                    <div>
                      <div className="font-bold text-sm">{m.name}</div>
                      {m.nicknames?.length > 0 && (
                        <div className="text-xs text-gray-500">{m.nicknames.join(', ')}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(m)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-500 hover:text-white transition-all">✏️</button>
                    <button onClick={() => archiveMember(m.id)} title="ארכוב"
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all">📦</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(124,58,237,0.06)', border: '1px dashed rgba(124,58,237,0.3)' }}>
          <div className="text-sm font-bold text-purple-300">＋ הוסף בן/בת משפחה</div>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none text-white"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            placeholder="שם" />
          <div className="flex gap-2">
            <button onClick={() => setNewGender('male')}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={newGender === 'male'
                ? { background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd' }
                : { border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
              👦 בן
            </button>
            <button onClick={() => setNewGender('female')}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={newGender === 'female'
                ? { background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.4)', color: '#f9a8d4' }
                : { border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
              👧 בת
            </button>
          </div>
          <button onClick={add} disabled={!newName.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', opacity: newName.trim() ? 1 : 0.5 }}>
            הוסף
          </button>
        </div>

        {/* Archived */}
        {archivedMembers.length > 0 && (
          <div className="space-y-2 pt-3">
            <div className="text-xs text-gray-500 font-semibold">בארכיון</div>
            {archivedMembers.map(m => (
              <div key={m.id} className="flex justify-between items-center px-4 py-2 rounded-xl opacity-50"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-sm">{m.gender === 'female' ? '👧' : '👦'} {m.name}</span>
                <button onClick={() => updateMember(m.id, { is_active: true })}
                  className="text-xs text-purple-400 hover:text-purple-300">שחזר</button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
