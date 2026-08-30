/**
 * Export AI advice for recently-created trips to a printable HTML file (one
 * trip per page). Open the file in a browser and use "Print → Save as PDF"
 * (or print to paper) to review LLM response quality.
 *
 * Each page contains, for one trip:
 *   - Trip metadata (destination, dates, party, budget, activities, etc.)
 *   - Category group headline tips (the "_group_tips" record)
 *   - Every category with its full question/answer pairs
 *
 * Usage:
 *   npm run export-advice -- --weeks 4              # trips created in last 4 weeks
 *   npm run export-advice -- --days 10
 *   npm run export-advice -- --months 3
 *   npm run export-advice -- --weeks 2 --by generated   # filter by advice generatedAt instead of trip createdAt
 *   npm run export-advice -- --weeks 4 --out advice-review.html
 *
 * Defaults: --weeks 4, --by created, --out advice-export-<timestamp>.html
 *
 * Requires DATABASE_URL in .env.local.
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { writeFile } from 'fs/promises'
import path from 'path'

// ─── Arg parsing ────────────────────────────────────────────────────────────

interface Options {
  windowMs: number
  windowLabel: string
  by: 'created' | 'generated'
  out: string
}

function parseArgs(argv: string[]): Options {
  const args = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      args.set(key, val)
    }
  }

  const DAY = 86_400_000
  let windowMs = 4 * 7 * DAY
  let windowLabel = 'last 4 weeks'

  if (args.has('days')) {
    const n = Number(args.get('days'))
    windowMs = n * DAY
    windowLabel = `last ${n} day${n !== 1 ? 's' : ''}`
  } else if (args.has('weeks')) {
    const n = Number(args.get('weeks'))
    windowMs = n * 7 * DAY
    windowLabel = `last ${n} week${n !== 1 ? 's' : ''}`
  } else if (args.has('months')) {
    const n = Number(args.get('months'))
    windowMs = n * 30 * DAY
    windowLabel = `last ${n} month${n !== 1 ? 's' : ''}`
  }

  const by = args.get('by') === 'generated' ? 'generated' : 'created'
  const out = args.get('out') ?? `advice-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.html`

  return { windowMs, windowLabel, by, out }
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const GROUP_TIPS_CATEGORY = '_group_tips'

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  const { db } = await import('../src/db')
  const { trips, adviceCache } = await import('../src/db/schema')
  const { gte, desc } = await import('drizzle-orm')
  const { AdviceStore, deriveMonthRange } = await import('../src/lib/advice-store')
  const { derivebudgetRange } = await import('../src/lib/validators')
  const { CATEGORIES, getSubQuestions } = await import('../src/lib/destinations')
  const { findAnswer } = await import('../src/lib/answer-lookup')
  const { groupSections, getGroupQuestions, cleanSubLabel } = await import('../src/lib/category-groups')
  const { fmtDate, nightCount } = await import('../src/lib/format-date')

  const since = new Date(Date.now() - opts.windowMs)

  // ─── Select the trips in the window ─────────────────────────────────────────
  type TripRow = typeof trips.$inferSelect
  let selectedTrips: TripRow[]

  if (opts.by === 'generated') {
    // Find advice rows generated in the window, then resolve their trips.
    // advice_cache has no tripId, so we match trips whose derived cache key
    // matches a recently-generated advice row.
    const recentAdvice = await db
      .select()
      .from(adviceCache)
      .where(gte(adviceCache.generatedAt, since))

    if (recentAdvice.length === 0) {
      selectedTrips = []
    } else {
      const allTrips = await db.select().from(trips)
      const recentKeys = new Set(
        recentAdvice.map((a) =>
          [a.destination, a.startMonth, a.endMonth, a.travellerType, a.budgetRange]
            .map((s) => String(s).toLowerCase())
            .join('|')
        )
      )
      selectedTrips = allTrips.filter((t) => {
        const { startMonth, endMonth } = deriveMonthRange(t.startDate, t.endDate)
        const key = [
          t.destination.toLowerCase(),
          startMonth,
          endMonth,
          t.travelMode.toLowerCase(),
          derivebudgetRange(t.budgetUsd),
        ].join('|')
        return recentKeys.has(key)
      })
    }
  } else {
    selectedTrips = await db
      .select()
      .from(trips)
      .where(gte(trips.createdAt, since))
      .orderBy(desc(trips.createdAt))
  }

  console.log(`\nExporting advice for ${selectedTrips.length} trip(s) (${opts.windowLabel}, by ${opts.by})…\n`)

  const categoriesWithQuestions = CATEGORIES.filter((c) => getSubQuestions(c).length > 0)
  const groupDefs = getGroupQuestions()

  const pages: string[] = []

  for (const trip of selectedTrips) {
    const records = await AdviceStore.getForTrip(trip.id)

    // Split out the group-tips record from the per-category records.
    const groupTipRecord = records.find((r) => r.category === GROUP_TIPS_CATEGORY)
    const groupTips = (groupTipRecord?.answers as Record<string, string> | undefined) ?? {}

    // Build CategorySection[] (same shape the app uses) for grouping.
    const byCategory = new Map<string, Record<string, string>>()
    for (const r of records) {
      if (r.category === GROUP_TIPS_CATEGORY) continue
      byCategory.set(r.category, (r.answers as Record<string, string>) ?? {})
    }

    const sections = categoriesWithQuestions.map((category) => {
      const answers = byCategory.get(category) ?? null
      return { category, conciseTip: null, answers, subQuestions: getSubQuestions(category) }
    })

    const groups = groupSections(sections, groupTips)

    const nights = nightCount(trip.startDate, trip.endDate)
    const meta = [
      ['Trip ID', trip.id],
      ['Destination', trip.destination],
      ['Dates', `${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)} (${nights} night${nights !== 1 ? 's' : ''})`],
      ['Party', trip.travelMode],
      ['Transport', trip.transportMode ?? '—'],
      ['From', trip.startingLocation ?? '—'],
      ['Budget', `$${trip.budgetUsd.toLocaleString()} (${derivebudgetRange(trip.budgetUsd)})${trip.transportCostIncluded ? ', transport incl.' : ', transport excl.'}`],
      ['Travel style', trip.travelStyle || '—'],
      ['Activities', trip.activityPreferences?.join(', ') || '—'],
      ['Trip created', trip.createdAt ? fmtDate(new Date(trip.createdAt).toISOString().slice(0, 10)) : '—'],
    ]

    // ─── Group headline tips block ────────────────────────────────────────────
    const groupTipsRows = groupDefs
      .map((g) => {
        const tip = groupTips[g.id]
        return `<tr><td class="k">${esc(g.name)}</td><td class="v">${tip ? esc(tip) : '<span class="missing">— not generated —</span>'}</td></tr>`
      })
      .join('')

    // ─── Per-category Q&A blocks ──────────────────────────────────────────────
    const categoryBlocks = groups
      .map((group) => {
        const sources = group.sources
        const sourceBlocks = sources
          .map((src) => {
            const subLabel = sources.length > 1 ? `<h4 class="sub">${esc(cleanSubLabel(src.category))}</h4>` : ''
            const qaRows = src.subQuestions
              .map((q) => {
                const a = findAnswer(src.answers, q)
                return `<div class="qa"><p class="q">${esc(q)}</p><p class="a">${a ? esc(a) : '<span class="missing">— no answer —</span>'}</p></div>`
              })
              .join('')
            return `${subLabel}${qaRows}`
          })
          .join('')
        return `<section class="cat"><h3>${esc(group.name)}</h3>${sourceBlocks}</section>`
      })
      .join('')

    const page = `
    <article class="trip-page">
      <header class="trip-head">
        <h1>${esc(trip.destination)}</h1>
        <p class="trip-sub">Trip ${esc(trip.id)}</p>
      </header>

      <table class="meta">
        ${meta.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('')}
      </table>

      <h2>Category group tips</h2>
      <table class="tips">${groupTipsRows}</table>

      <h2>Detailed advice by category</h2>
      ${categoryBlocks || '<p class="missing">No category advice found for this trip.</p>'}
    </article>`

    pages.push(page)
    console.log(`  ✓ ${trip.destination} (${trip.id}) — ${byCategory.size} categories, ${Object.keys(groupTips).length} group tips`)
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AI Advice Export — ${esc(opts.windowLabel)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111318; font-size: 12px; line-height: 1.5; margin: 0; }
  .cover { padding: 40px; }
  .cover h1 { font-size: 24px; margin: 0 0 8px; }
  .cover p { color: #6B7280; margin: 2px 0; }
  .trip-page { padding: 8px 4px; page-break-after: always; }
  .trip-page:last-child { page-break-after: auto; }
  .trip-head { border-bottom: 2px solid #1A5568; padding-bottom: 8px; margin-bottom: 12px; }
  .trip-head h1 { font-size: 20px; margin: 0; color: #1A5568; }
  .trip-sub { margin: 2px 0 0; color: #6B7280; font-size: 11px; font-family: monospace; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #1A5568; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; margin: 18px 0 8px; }
  table.meta, table.tips { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.meta td, table.tips td { vertical-align: top; padding: 3px 6px; border-bottom: 1px solid #F0F0F0; }
  td.k { width: 130px; color: #6B7280; font-weight: 600; }
  td.v { color: #111318; }
  section.cat { margin-bottom: 14px; page-break-inside: avoid; }
  section.cat h3 { font-size: 13px; margin: 0 0 6px; color: #111318; background: #F3F6F7; padding: 4px 8px; border-left: 3px solid #1A5568; }
  h4.sub { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7280; margin: 8px 0 4px; }
  .qa { margin: 0 0 8px; padding-left: 8px; page-break-inside: avoid; }
  .qa .q { font-weight: 600; margin: 0 0 2px; color: #374151; }
  .qa .a { margin: 0; color: #111318; }
  .missing { color: #B91C1C; font-style: italic; }
  @media print { .cover { page-break-after: always; } }
</style>
</head>
<body>
  <div class="cover">
    <h1>AI Advice Quality Review</h1>
    <p>Window: ${esc(opts.windowLabel)} (filtered by ${opts.by === 'generated' ? 'advice generated date' : 'trip created date'})</p>
    <p>Trips: ${selectedTrips.length}</p>
    <p>Generated: ${esc(new Date().toLocaleString('en-GB'))}</p>
    <p style="margin-top:16px;color:#9CA3AF;">Each following page is one trip. Use your browser's Print → Save as PDF.</p>
  </div>
  ${pages.join('\n')}
</body>
</html>`

  const outPath = path.isAbsolute(opts.out) ? opts.out : path.join(process.cwd(), opts.out)
  await writeFile(outPath, html, 'utf8')

  console.log(`\nWrote ${outPath}`)
  console.log('Open it in a browser and print to PDF (each trip is one page).')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
