'use client'

import { useState, useRef } from 'react'
import { Vehicle, Subscription, Schedule, Lesson, ScheduleEvent, FamilyMember, ScheduleActivityType } from '@/lib/types'
import { useVehicles, useSubscriptions, useSchedules, useLessons, useScheduleEvents } from '@/lib/useFacts'
import { nextBillingDate as calcNextBilling } from '@/lib/billingDate'
import FactModal from './FactModal'
import LessonModal from './LessonModal'
import ScheduleEventModal from './ScheduleEventModal'

interface Props {
  familyId: string
  members: FamilyMember[]
}

const ACTIVITY_LABEL: Record<ScheduleActivityType, string> = {
  school: 'בית ספר',
  kindergarten: 'גן',
  class: 'חוג',
  meeting: 'פגישה',
}

function fmtDate(iso: string | null | undefined): { label: string; warn: 'red' | 'orange' | null } {
  if (!iso) return { label: '—', warn: null }
  const [, m, d] = iso.split('-')
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(iso); target.setHours(0,0,0,0)
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  let warn: 'red' | 'orange' | null = null
  if (days < 7) warn = 'red'
  else if (days < 30) warn = 'orange'
  return { label: `${d}/${m}/${iso.slice(0,4)}`, warn }
}

function SectionHeader({ label, count, onAdd, extra }: { label: string; count: number; onAdd: () => void; extra?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline pb-2 mb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
        <span className="text-[10px] text-zinc-600">·</span>
        <span className="text-[10px] text-zinc-500">{count}</span>
      </div>
      <div className="flex items-center gap-1">
        {extra}
        <button onClick={onAdd} className="w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-100 transition-colors text-sm">＋</button>
      </div>
    </div>
  )
}

const DAY_LABEL: Record<string, string> = { sun: 'א\'', mon: 'ב\'', tue: 'ג\'', wed: 'ד\'', thu: 'ה\'', fri: 'ו\'', sat: 'ש\'' }
const DAY_ORDER: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

export default function InfoTab({ familyId, members }: Props) {
  const { items: vehicles,       add: addV,   update: updV,   remove: rmV }   = useVehicles(familyId)
  const { items: subscriptions,  add: addS,   update: updS,   remove: rmS }   = useSubscriptions(familyId)
  const { items: schedules,      add: addSch, update: updSch, remove: rmSch } = useSchedules(familyId)
  const { items: lessons,        add: addL,   update: updL,   remove: rmL }   = useLessons(familyId)
  const { items: scheduleEvents, add: addEv,  update: updEv,  remove: rmEv }  = useScheduleEvents(familyId)

  const [editing, setEditing] = useState<
    | { kind: 'vehicle'; item: Vehicle | null }
    | { kind: 'subscription'; item: Subscription | null }
    | { kind: 'schedule'; item: Schedule | null }
    | null
  >(null)
  const [editingLesson, setEditingLesson]   = useState<{ item: Lesson | null } | null>(null)
  const [editingEvent, setEditingEvent]     = useState<{ item: ScheduleEvent | null } | null>(null)

  // Import-from-image state
  const [importing, setImporting]           = useState(false)
  const [importChildId, setImportChildId]   = useState<string>('')
  const [importSchool, setImportSchool]     = useState('')
  const [importPreview, setImportPreview]   = useState<{ rows: Partial<Lesson>[]; imageUrl: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const subsTotal = subscriptions.reduce((a, s) => a + (s.monthly_cost || 0), 0)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })

  const sortedSubs = [...subscriptions].sort((a, b) => {
    const da = calcNextBilling(a, today), db = calcNextBilling(b, today)
    if (!da) return 1; if (!db) return -1
    return da.localeCompare(db)
  })

  const memberById = (id: string | null) => id ? members.find(m => m.id === id) : null
  const schedulesByChild = members.reduce<{ member: FamilyMember | null; items: Schedule[] }[]>((acc, m) => {
    const own = schedules.filter(s => s.child_id === m.id)
    if (own.length) acc.push({ member: m, items: own })
    return acc
  }, [])
  const orphanSchedules = schedules.filter(s => !s.child_id || !memberById(s.child_id))
  if (orphanSchedules.length) schedulesByChild.push({ member: null, items: orphanSchedules })

  // Upcoming events (next 60 days, sorted by date)
  const upcomingEvents = [...scheduleEvents]
    .filter(e => e.event_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 10)

  // Lessons by child
  const lessonsByChild = members.reduce<{ member: FamilyMember; lessons: Lesson[] }[]>((acc, m) => {
    const own = lessons.filter(l => l.child_id === m.id)
    if (own.length) acc.push({ member: m, lessons: own })
    return acc
  }, [])

  // Image import handler
  const handleImageFile = async (file: File) => {
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      const base64 = dataUrl.split(',')[1]
      const mimeType = file.type || 'image/jpeg'
      try {
        const res = await fetch('/api/lessons/import-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType, childId: importChildId || null, familyId, schoolName: importSchool || null }),
        })
        const data = await res.json()
        if (data.rows?.length) {
          setImportPreview({ rows: data.rows, imageUrl: dataUrl })
        } else {
          alert('לא נמצאו שיעורים בתמונה')
        }
      } catch {
        alert('שגיאה בייבוא')
      } finally {
        setImporting(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const confirmImport = async () => {
    if (!importPreview) return
    for (const row of importPreview.rows) {
      await addL(row as Partial<Lesson>)
    }
    setImportPreview(null)
    setImportChildId('')
    setImportSchool('')
  }

  return (
    <div className="animate-fade-in space-y-7">
      {/* Vehicles */}
      <section>
        <SectionHeader label="רכב" count={vehicles.length} onAdd={() => setEditing({ kind: 'vehicle', item: null })} />
        <div>
          {vehicles.length === 0 && <div className="text-xs text-zinc-600 py-2">אין רכבים. לחץ ＋</div>}
          {vehicles.map(v => {
            const test = fmtDate(v.test_expiry_date)
            const ins  = fmtDate(v.insurance_renewal_date)
            return (
              <button key={v.id} onClick={() => setEditing({ kind: 'vehicle', item: v })}
                className="w-full text-right py-3 border-b border-zinc-800/60 hover:bg-white/[0.02] transition-colors">
                <div className="text-sm text-zinc-100">{[v.make, v.model, v.year].filter(Boolean).join(' ')}</div>
                <div className="text-xs text-zinc-500 mt-1 space-x-3 space-x-reverse">
                  {v.license_plate && <span>מספר {v.license_plate}</span>}
                  {v.test_expiry_date && <span style={{ color: test.warn === 'red' ? '#f87171' : test.warn === 'orange' ? '#fb923c' : undefined }}>
                    טסט: {test.label} {test.warn && '⚠'}
                  </span>}
                  {v.insurance_renewal_date && <span style={{ color: ins.warn === 'red' ? '#f87171' : ins.warn === 'orange' ? '#fb923c' : undefined }}>
                    ביטוח: {ins.label} {ins.warn && '⚠'}
                  </span>}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Subscriptions */}
      <section>
        <SectionHeader label="מנויים" count={subscriptions.length} onAdd={() => setEditing({ kind: 'subscription', item: null })} />
        {subscriptions.length > 0 && (
          <div className="text-xs text-zinc-500 mb-2">סך מנויים · <span className="text-zinc-300">{subsTotal.toFixed(0)}₪/חודש</span></div>
        )}
        <div>
          {subscriptions.length === 0 && <div className="text-xs text-zinc-600 py-2">אין מנויים. לחץ ＋</div>}
          {sortedSubs.map(s => {
            const nbd = calcNextBilling(s, today)
            const billing = fmtDate(nbd)
            const isMonthly = s.billing_type === 'monthly'
            return (
              <button key={s.id} onClick={() => setEditing({ kind: 'subscription', item: s })}
                className="w-full text-right py-3 border-b border-zinc-800/60 hover:bg-white/[0.02] transition-colors">
                <div className="text-sm text-zinc-100">{s.name}</div>
                <div className="text-xs text-zinc-500 mt-1 space-x-3 space-x-reverse">
                  {s.monthly_cost != null && <span>{s.monthly_cost}₪/חודש</span>}
                  {isMonthly && s.billing_day_of_month && (
                    <span style={{ color: billing.warn === 'red' ? '#f87171' : billing.warn === 'orange' ? '#fb923c' : undefined }}>
                      מחויב ביום {s.billing_day_of_month} בכל חודש {billing.warn && `(${billing.label} ⚠)`}
                    </span>
                  )}
                  {!isMonthly && s.renewal_date && (
                    <span style={{ color: billing.warn === 'red' ? '#f87171' : billing.warn === 'orange' ? '#fb923c' : undefined }}>
                      חידוש {billing.label} {billing.warn && '⚠'}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Schedules (חוגים) */}
      <section>
        <SectionHeader label="לו״ז" count={schedules.length} onAdd={() => setEditing({ kind: 'schedule', item: null })} />
        <div>
          {schedules.length === 0 && <div className="text-xs text-zinc-600 py-2">אין לו״ז. לחץ ＋</div>}
          {schedulesByChild.map(({ member, items }) => (
            <div key={member?.id || 'orphan'} className="mb-3">
              {member && (
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">
                  {member.gender === 'female' ? '👧' : '👦'} {member.name}
                </div>
              )}
              {items.map(s => (
                <button key={s.id} onClick={() => setEditing({ kind: 'schedule', item: s })}
                  className="w-full text-right py-2.5 border-b border-zinc-800/60 hover:bg-white/[0.02] transition-colors">
                  <div className="text-sm text-zinc-100">
                    {s.activity_name}
                    {s.activity_type && <span className="text-xs text-zinc-500 mr-2">· {ACTIVITY_LABEL[s.activity_type]}</span>}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 space-x-3 space-x-reverse">
                    {s.days_of_week?.length > 0 && <span>{s.days_of_week.join(',')}</span>}
                    {s.start_time && <span>{s.start_time}{s.end_time ? `-${s.end_time}` : ''}</span>}
                    {s.location && <span>📍 {s.location}</span>}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming Events (שלב 3) */}
      <section>
        <SectionHeader
          label="אירועים קרובים"
          count={upcomingEvents.length}
          onAdd={() => setEditingEvent({ item: null })}
        />
        <div>
          {upcomingEvents.length === 0 && <div className="text-xs text-zinc-600 py-2">אין אירועים. לחץ ＋ להוספת אסיפה / טיול</div>}
          {upcomingEvents.map(ev => {
            const d = fmtDate(ev.event_date)
            const child = ev.child_id ? members.find(m => m.id === ev.child_id) : null
            return (
              <button key={ev.id} onClick={() => setEditingEvent({ item: ev })}
                className="w-full text-right py-2.5 border-b border-zinc-800/60 hover:bg-white/[0.02] transition-colors">
                <div className="text-sm text-zinc-100">{ev.title}</div>
                <div className="text-xs text-zinc-500 mt-1 space-x-2 space-x-reverse">
                  <span style={{ color: d.warn === 'red' ? '#f87171' : d.warn === 'orange' ? '#fb923c' : undefined }}>
                    {d.label}{ev.event_time ? ` · ${ev.event_time.slice(0,5)}` : ''} {d.warn && '⚠'}
                  </span>
                  {child && <span>· {child.name}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Lessons / School Timetable (שלב 1 + 2) */}
      <section>
        <SectionHeader
          label="מערכת שעות"
          count={lessons.length}
          onAdd={() => setEditingLesson({ item: null })}
          extra={
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              title="ייבוא מתמונה"
              className="w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-100 transition-colors text-sm flex items-center justify-center"
            >
              {importing ? '⏳' : '📷'}
            </button>
          }
        />

        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />

        {/* Import settings (shown when no preview yet) */}
        {!importPreview && (
          <div className="flex gap-2 mb-3">
            <select
              className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-zinc-800/40 text-zinc-400 border border-zinc-700/40 outline-none"
              value={importChildId}
              onChange={e => setImportChildId(e.target.value)}
            >
              <option value="">ילד לייבוא</option>
              {members.filter(m => m.is_active).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <input
              className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-zinc-800/40 text-zinc-400 border border-zinc-700/40 outline-none"
              placeholder="שם מסגרת (רשות)"
              value={importSchool}
              onChange={e => setImportSchool(e.target.value)}
            />
          </div>
        )}

        {/* Import preview confirmation */}
        {importPreview && (
          <div className="mb-4 rounded-xl overflow-hidden border border-zinc-700/40" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="p-3 border-b border-zinc-800">
              <div className="text-xs text-zinc-300 mb-2">נמצאו <span className="text-blue-400 font-medium">{importPreview.rows.length}</span> שיעורים — לאשר ולייבא?</div>
              <div className="text-xs text-zinc-500 max-h-32 overflow-y-auto space-y-0.5">
                {importPreview.rows.map((r, i) => (
                  <div key={i}>{DAY_LABEL[r.day_of_week as string] || r.day_of_week} · {r.start_time}–{r.end_time} · {r.subject}</div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 p-3">
              <button onClick={() => setImportPreview(null)} className="flex-1 py-2 rounded-lg text-xs text-zinc-500">ביטול</button>
              <button onClick={confirmImport} className="flex-1 py-2 rounded-lg text-xs text-white" style={{ background: '#3B82F6' }}>ייבא הכל</button>
            </div>
          </div>
        )}

        <div>
          {lessons.length === 0 && !importPreview && (
            <div className="text-xs text-zinc-600 py-2">אין מערכת שעות. לחץ 📷 לייבוא מתמונה או ＋ להוספה ידנית</div>
          )}
          {lessonsByChild.map(({ member, lessons: ml }) => {
            const byDay = ml.reduce<Record<string, Lesson[]>>((a, l) => {
              ;(a[l.day_of_week] = a[l.day_of_week] || []).push(l)
              return a
            }, {})
            const days = Object.keys(byDay).sort((a, b) => DAY_ORDER[a] - DAY_ORDER[b])
            const schoolName = ml[0]?.school_name
            return (
              <div key={member.id} className="mb-5">
                <div className="text-xs text-zinc-300 mb-2">
                  {member.gender === 'female' ? '👧' : '👦'} <span className="font-medium">{member.name}</span>
                  {schoolName && <span className="text-zinc-500 mr-2">· {schoolName}</span>}
                </div>
                {days.map(day => {
                  const dayLessons = [...byDay[day]].sort((a, b) => a.start_time.localeCompare(b.start_time))
                  const lastEnd = dayLessons[dayLessons.length - 1]?.end_time
                  return (
                    <div key={day} className="mb-2">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">יום {DAY_LABEL[day]}</div>
                      {dayLessons.map(l => (
                        <button key={l.id} onClick={() => setEditingLesson({ item: l })}
                          className="flex justify-between w-full py-1 border-b border-zinc-800/40 text-xs hover:bg-white/[0.02] transition-colors">
                          <span className="text-zinc-400">{l.start_time}–{l.end_time}</span>
                          <span className="text-zinc-200">{l.subject}{l.teacher && <span className="text-zinc-500"> · {l.teacher}</span>}</span>
                        </button>
                      ))}
                      {lastEnd && <div className="text-[10px] text-zinc-600 mt-0.5">סיום {lastEnd}</div>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </section>

      {/* Modals */}
      {editing && (
        <FactModal
          kind={editing.kind}
          initial={editing.item}
          members={members}
          onSave={async (patch) => {
            if (editing.kind === 'vehicle') {
              if (editing.item) await updV(editing.item.id, patch as Partial<Vehicle>)
              else await addV(patch as Partial<Vehicle>)
            } else if (editing.kind === 'subscription') {
              if (editing.item) await updS(editing.item.id, patch as Partial<Subscription>)
              else await addS(patch as Partial<Subscription>)
            } else {
              if (editing.item) await updSch(editing.item.id, patch as Partial<Schedule>)
              else await addSch(patch as Partial<Schedule>)
            }
          }}
          onDelete={editing.item ? async () => {
            if (editing.kind === 'vehicle')           await rmV(editing.item!.id)
            else if (editing.kind === 'subscription') await rmS(editing.item!.id)
            else                                       await rmSch(editing.item!.id)
          } : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      {editingLesson && (
        <LessonModal
          initial={editingLesson.item}
          members={members}
          familyId={familyId}
          onSave={async (patch) => {
            if (editingLesson.item) await updL(editingLesson.item.id, patch as Partial<Lesson>)
            else await addL(patch as Partial<Lesson>)
          }}
          onDelete={editingLesson.item ? async () => rmL(editingLesson.item!.id) : undefined}
          onClose={() => setEditingLesson(null)}
        />
      )}

      {editingEvent && (
        <ScheduleEventModal
          initial={editingEvent.item}
          members={members}
          onSave={async (patch) => {
            if (editingEvent.item) await updEv(editingEvent.item.id, patch as Partial<ScheduleEvent>)
            else await addEv(patch as Partial<ScheduleEvent>)
          }}
          onDelete={editingEvent.item ? async () => rmEv(editingEvent.item!.id) : undefined}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  )
}
