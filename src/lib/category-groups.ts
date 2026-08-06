/**
 * Frontend grouping layer for the 17 backend advice categories.
 *
 * The backend generates raw categories (Transportation – Self Driving,
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
  /** One-line key tip shown in the collapsed row */
  keyTip: string | null
  /** The source CategorySections that belong to this group */
  sources: CategorySection[]
}

// ─── Group definitions ────────────────────────────────────────────────────────

const GROUP_DEFS: Array<{
  id: string
  name: string
  match: (cat: CategorySection) => boolean
}> = [
  {
    id: 'transport',
    name: 'Getting around',
    match: (c) => c.category.toLowerCase().includes('transportation'),
  },
  {
    id: 'accommodation',
    name: 'Accommodation',
    match: (c) => c.category === 'Accommodation',
  },
  {
    id: 'money',
    name: 'Money',
    match: (c) => c.category === 'Budget & Money',
  },
  {
    id: 'daily',
    name: 'Food & daily life',
    match: (c) =>
      ['Food', 'Laundry', 'Daily Logistics', 'Connectivity'].includes(c.category),
  },
  {
    id: 'health',
    name: 'Health & safety',
    match: (c) => ['Safety', 'Packing'].includes(c.category),
  },
  {
    id: 'activities',
    name: 'Activities',
    match: (c) => c.category === 'Activities',
  },
  {
    id: 'weather',
    name: 'Weather',
    match: (c) => c.category === 'Weather',
  },
  {
    id: 'culture',
    name: 'Culture & tips',
    match: (c) => ['Local Etiquette', 'Miscellaneous'].includes(c.category),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip the group prefix from a sub-category name so it reads cleanly.
 * "Transportation – Self Driving" → "Self Driving"
 * "Transportation - Car Rental"  → "Car Rental"
 */
export function cleanSubLabel(name: string): string {
  return name.replace(/^[^–\-]+[–\-]\s*/, '').trim() || name
}

/**
 * Derive the key tip for a group from its sources.
 * Uses the first non-null concise tip found across the group's sources.
 */
function deriveKeyTip(sources: CategorySection[]): string | null {
  for (const source of sources) {
    if (source.conciseTip) return source.conciseTip
  }
  return null
}

// ─── Main grouping function ───────────────────────────────────────────────────

/**
 * Collapse 17 raw CategorySections into 8 DisplayGroups.
 * Categories not matched by any GROUP_DEF appear as their own group at the end.
 */
export function groupSections(sections: CategorySection[]): GroupSection[] {
  const used = new Set<string>()
  const groups: GroupSection[] = []

  for (const def of GROUP_DEFS) {
    const matched = sections.filter((s) => !used.has(s.category) && def.match(s))
    if (matched.length === 0) continue
    matched.forEach((s) => used.add(s.category))
    groups.push({
      id: def.id,
      name: def.name,
      keyTip: deriveKeyTip(matched),
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
        keyTip: s.conciseTip,
        sources: [s],
      })
    })

  return groups
}
