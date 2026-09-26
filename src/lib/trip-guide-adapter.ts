/**
 * Adapter: structured TripGuide → existing UI model.
 *
 * The existing advice UI (home/[tripId]/page.tsx + AdviceAccordion) consumes
 * `GroupSection[]` built from `CategorySection[]`. Rather than redesign the UI
 * for the new two-stage architecture, this adapter maps a validated TripGuide
 * back onto those shapes so the existing components render unchanged.
 *
 * The TripGuide `topicId` values line up with the display-group ids in
 * category-groups.ts (transport, accommodation, money, ...), so each topic maps
 * to one CategorySection and the existing group headline tips come straight
 * from each topic's summary.
 */

import type { TripGuide, GuideItem } from '@/lib/schemas/trip-guide'
import type { CategorySection, GroupSection } from '@/lib/category-groups'
import { getQuestionById } from '@/lib/question-library'

// Human-readable topic labels for the CategorySection.category field. These
// mirror the display-group names used by category-groups.ts.
const TOPIC_LABELS: Record<string, string> = {
  transport: 'Getting around',
  accommodation: 'Accommodation',
  money: 'Money',
  'food-and-drinks': 'Food & Drinks',
  health: 'Health & safety',
  activities: 'Activities',
  weather: 'Weather',
  connectivity: 'Connectivity',
  culture: 'Culture & Tips',
  'packing-and-preparation': 'Packing & Preparation',
  practicalities: 'Practicalities',
}

/**
 * Render a single GuideItem into the display answer string the accordion shows.
 * Combines the recommendation, the reasoning, and any concrete actions into a
 * single readable paragraph (the existing UI expects a plain string answer).
 */
export function renderGuideItemAnswer(item: GuideItem): string {
  const parts: string[] = []
  if (item.recommendation) parts.push(item.recommendation.trim())
  else if (item.answer) parts.push(item.answer.trim())

  if (item.why) parts.push(item.why.trim())

  if (item.actions.length > 0) {
    parts.push(`Next steps: ${item.actions.map((a) => a.trim()).join('; ')}.`)
  }

  return parts.filter(Boolean).join(' ')
}

/**
 * Resolve the natural-language question text for a GuideItem's questionId,
 * falling back to the id itself if unknown (so nothing is dropped).
 */
function questionTextFor(item: GuideItem): string {
  return getQuestionById(item.questionId)?.question ?? item.questionId
}

/**
 * Convert a TripGuide into CategorySection[] (one section per topic).
 */
export function tripGuideToSections(guide: TripGuide): CategorySection[] {
  return guide.topics
    .map((topic) => {
      const answers: Record<string, string> = {}
      const subQuestions: string[] = []

      for (const item of topic.items) {
        const q = questionTextFor(item)
        const rendered = renderGuideItemAnswer(item)
        if (rendered) {
          answers[q] = rendered
          subQuestions.push(q)
        }
      }

      const section: CategorySection = {
        category: TOPIC_LABELS[topic.topicId] ?? topic.topicId,
        conciseTip: topic.summary.headline || topic.summary.recommendation || null,
        answers: Object.keys(answers).length > 0 ? answers : null,
        subQuestions,
      }
      return section
    })
    .filter((s) => s.subQuestions.length > 0)
}

/**
 * Convert a TripGuide directly into GroupSection[] for the accordion.
 *
 * Because each topic already corresponds to a display group, we build one
 * GroupSection per topic (using the topic summary as the key tip) rather than
 * re-running the category→group collapse. Group ids equal topic ids so the
 * accordion's per-group icons keep working.
 */
export function tripGuideToGroups(guide: TripGuide): GroupSection[] {
  return guide.topics
    .map((topic) => {
      const answers: Record<string, string> = {}
      const subQuestions: string[] = []
      for (const item of topic.items) {
        const q = questionTextFor(item)
        const rendered = renderGuideItemAnswer(item)
        if (rendered) {
          answers[q] = rendered
          subQuestions.push(q)
        }
      }

      const source: CategorySection = {
        category: TOPIC_LABELS[topic.topicId] ?? topic.topicId,
        conciseTip: topic.summary.headline || null,
        answers: Object.keys(answers).length > 0 ? answers : null,
        subQuestions,
      }

      const group: GroupSection = {
        id: topic.topicId,
        name: TOPIC_LABELS[topic.topicId] ?? topic.topicId,
        question: topic.summary.headline || '',
        keyTip: topic.summary.recommendation || topic.summary.headline || null,
        sources: [source],
      }
      return group
    })
    .filter((g) => g.sources.some((s) => s.subQuestions.length > 0))
}
