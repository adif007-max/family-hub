'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/useAuth'

export default function MagicLinkLogin() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!email.trim() || busy) return
    setBusy(true); setError('')
    const { error } = await signIn(email)
    setBusy(false)
    if (error) { setError('שגיאה — נסה שוב'); return }
    setSent(true)
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

        {sent ? (
          <>
            <div className="text-gray-400 text-sm mb-8 mt-3">שלחנו קישור כניסה למייל 📧<br />פתח אותו מהטלפון כדי להיכנס</div>
            <div className="text-5xl mb-2">📬</div>
            <div className="text-xs text-gray-600">לא הגיע? בדוק ספאם או נסה שוב בעוד דקה</div>
          </>
        ) : (
          <>
            <div className="text-gray-500 text-sm mb-8">הזן את המייל שלך — נשלח קישור כניסה</div>
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="המייל שלך..."
                dir="ltr"
                autoFocus
                className="w-full px-4 py-3 rounded-2xl text-center text-white outline-none text-lg"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'}`,
                }}
              />
              {error && <div className="text-red-400 text-sm">{error}</div>}
              <button
                onClick={send}
                disabled={busy}
                className="w-full py-3 rounded-2xl font-bold text-white text-sm transition-opacity"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 8px 30px rgba(124,58,237,0.3)', opacity: busy ? 0.7 : 1 }}
              >
                {busy ? 'שולח...' : 'שלח קישור כניסה →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
