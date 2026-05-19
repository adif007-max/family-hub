import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = 'pinkleshtein2026'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== PASSWORD) return NextResponse.json({ error: 'wrong' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth', PASSWORD, { httpOnly: true, maxAge: 60 * 60 * 24 * 30, path: '/' })
  return res
}
