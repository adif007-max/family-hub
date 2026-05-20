import { NextRequest, NextResponse } from 'next/server'
import { sortInbox } from '@/lib/sort-inbox'

export async function POST(req: NextRequest) {
  const { items, familyId } = await req.json()
  if (!items?.length) return NextResponse.json({ error: 'no items' }, { status: 400 })
  if (!familyId)      return NextResponse.json({ error: 'no familyId' }, { status: 400 })

  try {
    const result = await sortInbox(items, familyId)
    return NextResponse.json({ result })
  } catch (e) {
    console.error('sort-inbox failed', e)
    return NextResponse.json({ error: 'sort failed' }, { status: 500 })
  }
}
