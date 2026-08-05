/**
 * Fuzzy answer lookup utility.
 *
 * The AI sometimes reformats or corrects question text in its response keys
 * (e.g. fixing typos, changing punctuation). This utility finds the best
 * matching answer key by normalizing both sides for comparison.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''""]/g, "'")  // normalize quotes
    .replace(/[^\w\s'?]/g, '') // strip punctuation except ? and '
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Look up an answer from the AI response using fuzzy matching on the question text.
 * Falls back to exact match first, then tries normalized comparison.
 */
export function findAnswer(
  answers: Record<string, string> | null | undefined,
  question: string
): string | undefined {
  if (!answers) return undefined

  // Try exact match first (fast path)
  if (question in answers) return answers[question]

  // Try normalized match
  const normalizedQ = normalize(question)
  for (const [key, value] of Object.entries(answers)) {
    if (normalize(key) === normalizedQ) return value
  }

  // Try substring containment (handles cases where AI drops/adds a few words)
  for (const [key, value] of Object.entries(answers)) {
    const nKey = normalize(key)
    if (nKey.includes(normalizedQ) || normalizedQ.includes(nKey)) {
      return value
    }
  }

  return undefined
}
