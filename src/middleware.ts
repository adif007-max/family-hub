import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = 'pinkleshtein2026'

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get('auth')?.value
  if (cookie === PASSWORD) return NextResponse.next()

  const url = req.nextUrl.clone()
  if (url.pathname === '/login') return NextResponse.next()

  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] }
