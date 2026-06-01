// Simple text-matching for "עשיתי X" → open task detection.
// No Haiku call — pure deterministic string scoring.

export interface DoneMatch {
  kind: 'single'; taskId: string; taskText: string
}
export interface DoneAmbiguous {
  kind: 'multiple'; tasks: { id: string; text: string; priority: string; due_date: string | null }[]
}
export interface DoneNone { kind: 'none' }

export type DoneResult = DoneMatch | DoneAmbiguous | DoneNone

// Regex patterns that indicate "I finished X"
const DONE_PREFIXES = /^(עשיתי|סיימתי|טיפלתי ב|טיפלתי|גמרתי|הושלם|הושלמה|בוצע|בוצעה|עשינו|ביצעתי|ביצענו)\s*/i

export function isDoneIntent(text: string): boolean {
  return DONE_PREFIXES.test(text)
}

export function extractQuery(text: string): string {
  return text.replace(DONE_PREFIXES, '').trim()
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[\s,\-\.]+/).filter(w => w.length > 1)
}

function scoreMatch(query: string, taskText: string): number {
  const q = query.toLowerCase().trim()
  const t = taskText.toLowerCase()

  // Exact substring → perfect
  if (t.includes(q)) return 1.0

  // Token overlap
  const qTokens = tokenize(q)
  const tTokens = tokenize(t)
  if (!qTokens.length) return 0

  let overlap = 0
  for (const qt of qTokens) {
    if (tTokens.some(tt => tt.includes(qt) || qt.includes(tt))) overlap++
  }
  return overlap / qTokens.length
}

export function matchDoneText(
  text: string,
  tasks: { id: string; text: string; priority: string; due_date: string | null }[]
): DoneResult {
  const query = extractQuery(text)
  if (!query || tasks.length === 0) return { kind: 'none' }

  const scored = tasks
    .map(t => ({ task: t, score: scoreMatch(query, t.text) }))
    .filter(x => x.score > 0.5)
    .sort((a, b) => b.score - a.score)

  if (!scored.length) return { kind: 'none' }
  if (scored[0].score >= 0.9) return { kind: 'single', taskId: scored[0].task.id, taskText: scored[0].task.text }
  if (scored.length === 1) return { kind: 'single', taskId: scored[0].task.id, taskText: scored[0].task.text }
  return { kind: 'multiple', tasks: scored.slice(0, 5).map(x => x.task) }
}
