// Deterministic done-intent detection and task matching.
// No Haiku — pure string scoring.

export interface DoneMatch     { kind: 'single';   taskId: string; taskText: string }
export interface DoneAmbiguous { kind: 'multiple'; tasks: { id: string; text: string; priority: string; due_date: string | null }[] }
export interface DoneNone      { kind: 'none' }
export type DoneResult = DoneMatch | DoneAmbiguous | DoneNone

// ── Patterns ──────────────────────────────────────────────────────────────────

// "I finished X" — prefix before the task description
const DONE_PREFIXES =
  /^(עשיתי|סיימתי|טיפלתי ב|טיפלתי|גמרתי|הושלם|הושלמה|בוצע|בוצעה|עשינו|ביצעתי|ביצענו)\s*/i

// "mark X as done" — "סמן X בוצע/כבוצע"
// Catches: "סמן קניות בוצע", "סמן כבוצע", "סמן אלה בוצעו"
const MARK_DONE_RE =
  /^סמן(\s+.+)?\s+(כ?בוצע[ות]?|כ?הושלמ[ות]?|כ?גמור[ות]?)$/i

// Vague "all of these / show list" — no specific task name
const VAGUE_RE =
  /^(סמן\s+)?(אלה|כולם|הכל|כל\s+ה|שלושה|שניים|ארבעה|חמישה|כל\s+המטלות)([\s,.]*)(בוצע[ות]?|כבוצע[ות]?|הושלמ[ות]?|גמור[ות]?)?$/i

// ── Public API ────────────────────────────────────────────────────────────────

export function isDoneIntent(text: string): boolean {
  return DONE_PREFIXES.test(text) || MARK_DONE_RE.test(text) || VAGUE_RE.test(text)
}

/**
 * When true, the message means "show me the list so I can pick" — no specific task named.
 * Caller should display the /done keyboard instead of trying to match.
 */
export function isVagueDoneIntent(text: string): boolean {
  return VAGUE_RE.test(text) || /^סמן\s*(כ?בוצע[ות]?)?$/i.test(text.trim())
}

export function extractQuery(text: string): string {
  // Strip mark-done suffix ("סמן X בוצע" → "X")
  const withoutSuffix = text
    .replace(/\s+(כ?בוצע[ות]?|כ?הושלמ[ות]?|כ?גמור[ות]?)\s*$/i, '')
    .trim()
  return withoutSuffix
    .replace(DONE_PREFIXES, '')
    .replace(/^סמן\s*/i, '')
    .trim()
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[\s,\-\.]+/).filter(w => w.length > 1)
}

function scoreMatch(query: string, taskText: string): number {
  const q = query.toLowerCase().trim()
  const t = taskText.toLowerCase()
  if (!q) return 0
  if (t.includes(q)) return 1.0

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
  if (tasks.length === 0) return { kind: 'none' }

  const query = extractQuery(text)
  if (!query) return { kind: 'none' }

  const scored = tasks
    .map(t => ({ task: t, score: scoreMatch(query, t.text) }))
    .filter(x => x.score > 0.5)
    .sort((a, b) => b.score - a.score)

  if (!scored.length) return { kind: 'none' }
  if (scored[0].score >= 0.9) return { kind: 'single', taskId: scored[0].task.id, taskText: scored[0].task.text }
  if (scored.length === 1)    return { kind: 'single', taskId: scored[0].task.id, taskText: scored[0].task.text }
  return { kind: 'multiple', tasks: scored.slice(0, 5).map(x => x.task) }
}
