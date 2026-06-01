import { NextRequest, NextResponse } from 'next/server'
import { sortInbox } from '@/lib/sort-inbox'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify the caller is an authenticated user whose family matches the requested familyId
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { items?: unknown; familyId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { items, familyId } = body
  if (!Array.isArray(items) || !items.length) return NextResponse.json({ error: 'no items' }, { status: 400 })
  if (!familyId || typeof familyId !== 'string') return NextResponse.json({ error: 'no familyId' }, { status: 400 })

  // Verify the user's profile family_id matches the requested familyId
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.family_id !== familyId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const result = await sortInbox(items as string[], familyId)
    return NextResponse.json({ result })
  } catch (e) {
    console.error('sort-inbox failed', e)
    return NextResponse.json({ error: 'sort failed' }, { status: 500 })
  }
}
