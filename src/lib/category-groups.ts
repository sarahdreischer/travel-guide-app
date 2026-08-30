/**
 * Frontend grouping layer for the 17 backend advice categories.
 *
 * The backend generates raw categories (Transportation – Driving,
 * Transportation - Car Rental, etc.). This module collapses them into 8
 * display groups so the advice page fits on one screen.
 *
 * To change groupings: edit GROUP_DEFS. The backend is untouched.
 */

import type { CategorySection } from '@/app/(app)/home/[tripId]/page'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroupSection {
  id: string
  name: string
  /** One-line key tip shown in the collapsed row (AI-generated from group question) */
  keyTip: string | null
  /** The question used to generate the key tip */
  question: string
  /** The source CategorySections that belong to this group */
  sources: CategorySection[]
}

// ─── Group definitions ────────────────────────────────────────────────────────

const GROUP_DEFS: Array<{
  id: string
  name: string,
  question: string,
  match: (cat: CategorySection) => boolean
}> = [
  {
    id: 'transport',
    name: 'Getting around',
    question: 'What is the best way to get around as a tourist?',
    match: (c) => c.category.toLowerCase().includes('transportation'),
  },
  {
    id: 'accommodation',
    name: 'Accommodation',
    question: 'What is the best accommodation for a tourist?',
    match: (c) => ['Recommended Areas', 'Hotels', 'Hostels', 'Holiday Rentals'].includes(c.category),
  },
  {
    id: 'money',
    name: 'Money',
    question: 'What is the preferred payment method in this location?',
    match: (c) => c.category === 'Money',
  },
  {
    id: 'food-and-drinks',
    name: 'Food & Drinks',
    question: 'What food is a must try and within weekly budget?',
    match: (c) =>
      ['Food & Tipping Culture', 'Groceries & Drinking Water', 'Alcoholic Drinks'].includes(c.category),
  },
  {
    id: 'health',
    name: 'Health & safety',
    question: 'What health and safety aspects are most important?',
    match: (c) => ['Health', 'Safety'].includes(c.category),
  },
  {
    id: 'activities',
    name: 'Activities',
    question: 'Which activities are the available in the area according to my preferences?',
    match: (c) => c.category === 'Activities',
  },
  {
    id: 'weather',
    name: 'Weather',
    question: 'What is the weather going to be like?',
    match: (c) => c.category === 'Weather',
  },
  {
    id: 'connectivity',
    name: 'Connectivity',
    question: 'Which mobile connectivity options are widely available?',
    match: (c) => c.category === 'WiFi & Mobile Data',
  },
  {
    id: 'culture',
    name: 'Culture & Tips',
    question: 'What cultural activities are a must do?',
    match: (c) => ['Local Etiquette', 'Miscellaneous'].includes(c.category),
  },
  {
    id: 'packing-and-preparation',
    name: 'Packing & Preparation',
    question: 'How should I pack for the trip?',
    match: (c) => ['Clothing & Accessories'].includes(c.category),
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    question: 'Which services are widely availalbe for maintenance (e.g. laundry)?',
    match: (c) => ['Laundry'].includes(c.category),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip the group prefix from a sub-category name so it reads cleanly.
 * "Transportation – Driving" → "Self Driving"
 * "Transportation - Car Rental"  → "Car Rental"
 */
export function cleanSubLabel(name: string): string {
  return name.replace(/^[^–\-]+[–\-]\s*/, '').trim() || name
}

// ─── Exported helpers ─────────────────────────────────────────────────────────

/**
 * Returns the group question definitions for use with the LLM adapter.
 * Each entry has id, name, and the question to ask AI.
 */
export function getGroupQuestions(): Array<{ id: string; name: string; question: string }> {
  return GROUP_DEFS.map((d) => ({ id: d.id, name: d.name, question: d.question }))
}

/**
 * Split categories into priority (first N groups shown above the fold on the home
 * page) and the rest, based on GROUP_DEFS order. Used by the two-phase advice
 * generation so the most-visible groups are generated first.
 *
 * @param categories - all category names to split
 * @param priorityGroupCount - how many leading groups count as "priority" (default 5)
 */
export function splitCategoriesByGroupPriority(
  categories: string[],
  priorityGroupCount = 5
): { priority: string[]; remaining: string[] } {
  const priorityDefs = GROUP_DEFS.slice(0, priorityGroupCount)
  const isPriority = (category: string) => {
    // Build a minimal CategorySection-like object for the matcher
    const stub = { category } as CategorySection
    return priorityDefs.some((def) => def.match(stub))
  }

  const priority: string[] = []
  const remaining: string[] = []
  for (const c of categories) {
    if (isPriority(c)) priority.push(c)
    else remaining.push(c)
  }
  return { priority, remaining }
}

// ─── Main grouping function ───────────────────────────────────────────────────

/**
 * Collapse 17 raw CategorySections into 8 DisplayGroups.
 * Categories not matched by any GROUP_DEF appear as their own group at the end.
 *
 * @param sections - The 17 raw category sections from the advice store
 * @param groupTips - Optional AI-generated tips keyed by group id. When provided,
 *   these override the derived key tip from sources.
 */
export function groupSections(
  sections: CategorySection[],
  groupTips?: Record<string, string>
): GroupSection[] {
  const used = new Set<string>()
  const groups: GroupSection[] = []

  for (const def of GROUP_DEFS) {
    const matched = sections.filter((s) => !used.has(s.category) && def.match(s))
    if (matched.length === 0) continue
    matched.forEach((s) => used.add(s.category))
    groups.push({
      id: def.id,
      name: def.name,
      question: def.question,
      keyTip: groupTips?.[def.id] ?? null,
      sources: matched,
    })
  }

  // Any category not matched by a group definition gets its own entry
  sections
    .filter((s) => !used.has(s.category) && s.subQuestions.length > 0)
    .forEach((s) => {
      groups.push({
        id: s.category,
        name: s.category,
        question: '',
        keyTip: s.conciseTip,
        sources: [s],
      })
    })

  return groups
}
