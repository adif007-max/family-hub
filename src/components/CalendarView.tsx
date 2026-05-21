'use client'

import { useMemo } from 'react'
import { HDate, HebrewCalendar, gematriya } from '@hebcal/core'
import { Task } from '@/lib/types'

interface Props {
  tasks: Task[]
  selectedDate: Date | null
  onDateSelect: (date: Date | null) => void
  currentMonth: Date
  onMonthChange: (date: Date) => void
}

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const HEB_MONTHS_HE = [
  'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול',
  'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב',
]

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate()
}

function hebrewMonthName(hd: HDate): string {
  const n = hd.getMonth() // 1-13
  return HEB_MONTHS_HE[n - 1] || ''
}

function hebrewHeader(date: Date): string {
  const first = new HDate(new Date(date.getFullYear(), date.getMonth(), 1))
  const last  = new HDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
  const m1 = hebrewMonthName(first)
  const m2 = hebrewMonthName(last)
  const year = gematriya(first.getFullYear())
  return m1 === m2 ? `${m1} ${year}` : `${m1}-${m2} ${year}`
}

const GREG_MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export default function CalendarView({ tasks, selectedDate, onDateSelect, currentMonth, onMonthChange }: Props) {
  const year  = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const today = new Date()

  // Tasks per day map
  const tasksByDay = useMemo(() => {
    const m = new Map<string, number>()
    tasks.forEach(t => {
      if (!t.due_date || t.done) return
      m.set(t.due_date, (m.get(t.due_date) || 0) + 1)
    })
    return m
  }, [tasks])

  // Holidays for this Gregorian month
  const holidaysByDay = useMemo(() => {
    const startDate = new Date(year, month, 1)
    const endDate   = new Date(year, month + 1, 0)
    const events = HebrewCalendar.calendar({
      start: startDate,
      end: endDate,
      noMinorFast: true,
      noRoshChodesh: true,
      noSpecialShabbat: true,
      omer: false,
      candlelighting: false,
      isHebrewYear: false,
    })
    const map = new Map<string, string>()
    events.forEach(ev => {
      const d = ev.getDate().greg()
      const key = ymd(d)
      // Only headline category holidays
      const flags = ev.getFlags()
      // bit flags from hebcal: CHAG (1<<3=8), MAJOR_FAST (1<<5=32), MODERN_HOLIDAY (1<<13=8192), CHOL_HAMOED (1<<2=4)
      // Show: CHAG, MAJOR_FAST, MODERN_HOLIDAY, CHOL_HAMOED
      const show = (flags & 8) || (flags & 32) || (flags & 8192) || (flags & 4)
      if (!show) return
      const desc = ev.render('he') || ev.getDesc()
      const existing = map.get(key)
      // prefer non-Chol HaMoed when both
      if (!existing) map.set(key, desc)
    })
    return map
  }, [year, month])

  // Build grid: first day's weekday (Sun=0..Sat=6), pad to start
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const totalCells   = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  const cells: ({ day: number; date: Date } | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(year, month, d) })
  while (cells.length < totalCells) cells.push(null)

  const goPrev  = () => onMonthChange(new Date(year, month - 1, 1))
  const goNext  = () => onMonthChange(new Date(year, month + 1, 1))
  const goToday = () => { onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1)); onDateSelect(null) }

  const headerHe = hebrewHeader(currentMonth)
  const headerGreg = `${GREG_MONTHS_HE[month]} ${year}`

  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={goPrev} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
          ‹
        </button>
        <div className="text-center">
          <div className="text-sm font-bold">{headerGreg}</div>
          <div className="text-xs text-purple-300/70">{headerHe}</div>
        </div>
        <div className="flex gap-1">
          <button onClick={goToday} className="px-3 h-9 rounded-xl text-xs text-purple-300 hover:bg-purple-500/10 transition-all">
            היום
          </button>
          <button onClick={goNext} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
            ›
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-gray-500 py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="aspect-square min-h-[48px]" />
          const key = ymd(c.date)
          const count = tasksByDay.get(key) || 0
          const holiday = holidaysByDay.get(key)
          const isToday = isSameDay(c.date, today)
          const isSelected = selectedDate && isSameDay(c.date, selectedDate)
          const hd = new HDate(c.date)
          const heDay = gematriya(hd.getDate())
          const isShabbat = c.date.getDay() === 6

          const onClick = () => {
            if (selectedDate && isSameDay(c.date, selectedDate)) onDateSelect(null)
            else onDateSelect(c.date)
          }

          return (
            <button
              key={i}
              onClick={onClick}
              className="aspect-square min-h-[48px] rounded-lg flex flex-col items-center justify-start p-1 transition-all relative"
              style={isSelected
                ? { background: 'rgba(124,58,237,0.25)', border: '1.5px solid rgba(167,139,250,0.7)' }
                : isToday
                  ? { background: 'rgba(124,58,237,0.08)', border: '1.5px solid rgba(167,139,250,0.35)' }
                  : { background: isShabbat ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }
              }
            >
              <div className="flex items-baseline gap-1 leading-none">
                <span className="text-sm font-bold" style={{ color: isToday || isSelected ? '#c4b5fd' : isShabbat ? '#9ca3af' : '#e5e7eb' }}>
                  {c.day}
                </span>
                <span className="text-[9px]" style={{ color: '#a78bfa', opacity: 0.6 }}>
                  {heDay}
                </span>
              </div>
              {holiday && (
                <div className="text-[9px] mt-0.5 leading-tight truncate w-full text-center font-semibold" style={{ color: '#fb923c' }}>
                  {holiday}
                </div>
              )}
              {count > 0 && (
                <div className="absolute bottom-1 left-1 right-1 flex justify-center">
                  <div className="text-[9px] font-bold rounded-full px-1.5 min-w-[18px] text-center" style={{ background: count > 2 ? '#f87171' : '#a78bfa', color: '#0f0f1a' }}>
                    {count}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
