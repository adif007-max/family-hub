'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/useAuth'

export default function MagicLinkLogin() {
  const { signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  const send = async () => {
    if (!email.trim() || busy) return
    setBusy(true); setError('')
    const { error } = await signIn(email)
    setBusy(false)
    if (error) { setError('שגיאה — נסה שוב'); return }
    setSent(true)
  }

  const google = async () => {
    if (googleBusy) return
    setGoogleBusy(true); setError('')
    const { error } = await signInWithGoogle()
    if (error) { setGoogleBusy(false); setError('שגיאה בכניסה עם גוגל') }
    // on success: redirect happens automatically
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
            <div className="text-gray-500 text-sm mb-6">בחרו דרך התחברות</div>

            {/* Google Sign-in (primary) */}
            <button
              onClick={google}
              disabled={googleBusy}
              className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-opacity mb-3"
              style={{
                background: '#fff',
                color: '#1f2937',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                opacity: googleBusy ? 0.7 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {googleBusy ? 'מתחבר...' : 'המשך עם Google'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-xs text-gray-600">או דרך מייל</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Magic Link fallback */}
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="המייל שלך..."
                dir="ltr"
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
