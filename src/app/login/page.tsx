'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  const login = async () => {
    const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ password }), headers: { 'Content-Type': 'application/json' } })
    if (res.ok) { router.push('/') }
    else { setError(true); setTimeout(() => setError(false), 2000) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#0f0f1a' }}>
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full pointer-events-none opacity-10"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
      <div className="fixed bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none opacity-10"
        style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

      <div className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4">✨</div>
        <div className="text-2xl font-black mb-1">משפחת פינקלשטיין</div>
        <div className="text-gray-500 text-sm mb-8">הזן סיסמה להמשך</div>

        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="סיסמה..."
            autoFocus
            className="w-full px-4 py-3 rounded-2xl text-center text-white outline-none text-lg tracking-widest"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'}`,
              transition: 'border-color 0.2s'
            }}
          />
          {error && <div className="text-red-400 text-sm">סיסמה שגויה ❌</div>}
          <button
            onClick={login}
            className="w-full py-3 rounded-2xl font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 8px 30px rgba(124,58,237,0.3)' }}
          >
            כניסה →
          </button>
        </div>
      </div>
    </div>
  )
}
