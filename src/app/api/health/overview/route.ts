import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

const BASE = 'https://health-tracker-summer-meadowbrook-7343.fly.dev'

const fetchOverview = unstable_cache(
  async (): Promise<unknown> => {
    const token = process.env.HEALTH_TRACKER_TOKEN
    if (!token) return { error: 'no_token' }
    const res = await fetch(`${BASE}/api/finance/overview`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })
    if (!res.ok) return { error: `http_${res.status}` }
    return res.json()
  },
  ['health-overview'],
  { revalidate: 300 }
)

export async function GET() {
  try {
    const data = await fetchOverview()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 })
  }
}
