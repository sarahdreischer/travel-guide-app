/**
 * Export structured Trip Guides for recently-created trips to a printable HTML
 * file (one trip per page). Open the file in a browser and use
 * "Print → Save as PDF" (or print to paper) to review guide quality.
 *
 * Each page contains, for one trip:
 *   - Trip metadata (destination, dates, party, budget, activities, etc.)
 *   - The researched destination facts summary (currency, driving side, etc.)
 *   - Every topic with its headline + recommendation and each guide item
 *     (recommendation, why, answer, entities, claims, actions)
 *
 * Usage:
 *   npm run export-advice -- --weeks 4               # trips created in last 4 weeks
 *   npm run export-advice -- --days 10
 *   npm run export-advice -- --months 3
 *   npm run export-advice -- --weeks 4 --out guide-review.html
 *
 * Defaults: --weeks 4, --out advice-export-<timestamp>.html
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

  const out = args.get('out') ?? `advice-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.html`

  return { windowMs, windowLabel, out }
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  const { db } = await import('../src/db')
  const { trips } = await import('../src/db/schema')
  const { gte, desc } = await import('drizzle-orm')
  const { derivebudgetRange } = await import('../src/lib/validators')
  const { TripGuideStore, tripGuideKeyForTrip } = await import('../src/lib/trip-guide-store')
  const { DestinationFactsStore } = await import('../src/lib/destination-facts-store')
  const { splitDestination } = await import('../src/lib/destination-parse')
  const { getQuestionById } = await import('../src/lib/question-library')
  const { fmtDate, nightCount } = await import('../src/lib/format-date')

  const since = new Date(Date.now() - opts.windowMs)

  const selectedTrips = await db
    .select()
    .from(trips)
    .where(gte(trips.createdAt, since))
    .orderBy(desc(trips.createdAt))

  console.log(`\nExporting trip guides for ${selectedTrips.length} trip(s) (${opts.windowLabel})…\n`)

  const pages: string[] = []

  for (const trip of selectedTrips) {
    const guide = await TripGuideStore.get(tripGuideKeyForTrip(trip))
    const { destination, country } = splitDestination(trip.destination)
    const facts = await DestinationFactsStore.get(destination, country)

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

    // ─── Destination facts summary ────────────────────────────────────────────
    const factsRows = facts
      ? [
          ['Currency', `${facts.currency.name} (${facts.currency.code})`],
          ['Driving side', facts.drivingSide],
          ['Languages', facts.languages.join(', ') || '—'],
          ['Ride-hailing', facts.transport.rideHailing.join(', ') || '—'],
          ['Geography', [facts.geography.type, facts.geography.majorAreas.join(', ')].filter(Boolean).join(' · ') || '—'],
          ['Sources', String(facts.sources.length)],
        ]
          .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`)
          .join('')
      : ''

    // ─── Topics + items ───────────────────────────────────────────────────────
    const topicBlocks = guide
      ? guide.topics
          .map((topic) => {
            const items = topic.items
              .map((item) => {
                const q = getQuestionById(item.questionId)?.question ?? item.questionId
                const lines: string[] = []
                if (item.recommendation) lines.push(`<p class="a"><strong>Recommendation:</strong> ${esc(item.recommendation)}</p>`)
                if (item.why) lines.push(`<p class="a"><strong>Why:</strong> ${esc(item.why)}</p>`)
                if (item.answer) lines.push(`<p class="a">${esc(item.answer)}</p>`)
                if (item.entities.length) lines.push(`<p class="meta-line">Entities: ${esc(item.entities.map((e) => `${e.name} (${e.entityType})`).join(', '))}</p>`)
                if (item.actions.length) lines.push(`<p class="meta-line">Actions: ${esc(item.actions.join('; '))}</p>`)
                if (item.claims.length) {
                  const claims = item.claims
                    .map((c) => `<li>${esc(c.claim)} <span class="tag">[${esc(c.type)} · risk:${esc(c.risk)} · ${esc(c.volatility)}${c.verificationRequired ? ' · verify' : ''}]</span></li>`)
                    .join('')
                  lines.push(`<ul class="claims">${claims}</ul>`)
                }
                return `<div class="qa"><p class="q">${esc(q)} <span class="tag">[${esc(item.priority)}]</span></p>${lines.join('')}</div>`
              })
              .join('')
            return `<section class="cat"><h3>${esc(topic.topicId)}</h3><p class="headline">${esc(topic.summary.headline)}</p><p class="a"><em>${esc(topic.summary.recommendation)}</em></p>${items}</section>`
          })
          .join('')
      : ''

    const page = `
    <article class="trip-page">
      <header class="trip-head">
        <h1>${esc(trip.destination)}</h1>
        <p class="trip-sub">Trip ${esc(trip.id)}</p>
      </header>

      <table class="meta">
        ${meta.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('')}
      </table>

      ${facts ? `<h2>Researched destination facts</h2><table class="tips">${factsRows}</table>` : '<p class="missing">No researched destination facts found.</p>'}

      <h2>Structured trip guide</h2>
      ${topicBlocks || '<p class="missing">No structured trip guide found for this trip.</p>'}
    </article>`

    pages.push(page)
    console.log(`  ✓ ${trip.destination} (${trip.id}) — ${guide ? guide.topics.length : 0} topics, facts: ${facts ? 'yes' : 'no'}`)
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Trip Guide Export — ${esc(opts.windowLabel)}</title>
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
  section.cat h3 { font-size: 13px; margin: 0 0 4px; color: #111318; background: #F3F6F7; padding: 4px 8px; border-left: 3px solid #1A5568; text-transform: capitalize; }
  .headline { font-weight: 600; margin: 4px 0; }
  .qa { margin: 0 0 8px; padding-left: 8px; page-break-inside: avoid; }
  .qa .q { font-weight: 600; margin: 6px 0 2px; color: #374151; }
  .qa .a { margin: 0 0 2px; color: #111318; }
  .meta-line { margin: 2px 0; color: #6B7280; font-size: 11px; }
  ul.claims { margin: 2px 0 4px 16px; padding: 0; }
  ul.claims li { color: #374151; margin: 1px 0; }
  .tag { color: #6B7280; font-weight: 400; font-size: 10px; }
  .missing { color: #B91C1C; font-style: italic; }
  @media print { .cover { page-break-after: always; } }
</style>
</head>
<body>
  <div class="cover">
    <h1>Trip Guide Quality Review</h1>
    <p>Window: ${esc(opts.windowLabel)} (filtered by trip created date)</p>
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
