/**
 * Web research / retrieval abstraction (server-side only).
 *
 * This is the SINGLE web-search/retrieval abstraction for the app's research
 * needs. It follows the same env-driven, graceful-fallback pattern as
 * `destination-image.ts` (optional API key, degrade cleanly when absent).
 *
 * It exists because `@ai-sdk/openai@1.0.7` exposes only chat/completion models
 * (no native web-search tool / Responses API), so destination research must
 * retrieve external evidence itself rather than relying on the LLM's
 * pretrained knowledge.
 *
 * Providers (in priority order, all optional/pluggable):
 *  1. A generic Tavily-compatible search API when `WEB_SEARCH_API_KEY` is set
 *     (endpoint overridable via `WEB_SEARCH_API_URL`). Tavily returns ranked
 *     results with page content, which suits authoritative fact extraction.
 *  2. Wikipedia REST summary API — keyless, always available, classified as a
 *     `reputable_reference` baseline source.
 *
 * The module returns typed `WebSource[]` with a coarse `sourceType`
 * classification (government / tourism_authority / transport_operator /
 * official / reputable_reference / other) derived from the result URL, so the
 * research stage can prefer authoritative sources.
 */

import type { SourceType } from '@/lib/schemas/destination-facts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebSource {
  url: string
  title: string
  /** Extracted text content (may be a snippet or a longer excerpt). */
  content: string
  sourceType: SourceType
}

export interface SearchOptions {
  /** Max results to return across all providers. Default 5. */
  maxResults?: number
  /** Per-request timeout in ms. Default 15000. */
  timeoutMs?: number
}

// ─── Source-type classification ────────────────────────────────────────────

/**
 * Classify a source URL into a coarse authority bucket. Deliberately
 * conservative: only well-signalled domains are promoted above `other`.
 */
export function classifySourceType(url: string): SourceType {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'other'
  }

  // Government: *.gov, *.gov.<cc>, *.gouv.*, *.go.<cc>, *.gov.uk etc.
  if (/(^|\.)gov(\.|$)/.test(host) || /(^|\.)gouv\./.test(host) || /(^|\.)go\.[a-z]{2}$/.test(host)) {
    return 'government'
  }

  // Reputable reference works.
  if (/(^|\.)wikipedia\.org$/.test(host) || /(^|\.)wikivoyage\.org$/.test(host) || /(^|\.)britannica\.com$/.test(host)) {
    return 'reputable_reference'
  }

  // Tourism authorities (heuristic — official destination marketing orgs).
  if (/(^|\.)(tourism|visit|tourismthailand|amazingthailand)\./.test(host) || host.startsWith('visit')) {
    return 'tourism_authority'
  }

  // Transport operators (heuristic).
  if (/(^|\.)(railway|rail|metro|transit|transport|airport|airports)\./.test(host)) {
    return 'transport_operator'
  }

  // Other official orgs.
  if (/(^|\.)org$/.test(host) || /(^|\.)int$/.test(host)) {
    return 'official'
  }

  return 'other'
}

/** Rank used to prefer authoritative sources (lower = more authoritative). */
const SOURCE_TYPE_RANK: Record<SourceType, number> = {
  government: 0,
  tourism_authority: 1,
  transport_operator: 2,
  official: 3,
  reputable_reference: 4,
  other: 5,
}

export function sortByAuthority(sources: WebSource[]): WebSource[] {
  return [...sources].sort(
    (a, b) => SOURCE_TYPE_RANK[a.sourceType] - SOURCE_TYPE_RANK[b.sourceType]
  )
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function tavilySearch(query: string, opts: Required<SearchOptions>): Promise<WebSource[]> {
  const apiKey = process.env.WEB_SEARCH_API_KEY
  if (!apiKey) return []

  const endpoint = process.env.WEB_SEARCH_API_URL ?? 'https://api.tavily.com/search'

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: opts.maxResults,
        search_depth: 'basic',
        include_answer: false,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    })

    if (!res.ok) {
      console.error(`[web-research] Search API error: ${res.status} for "${query}"`)
      return []
    }

    const data = (await res.json()) as {
      results?: Array<{ url?: string; title?: string; content?: string }>
    }

    return (data.results ?? [])
      .filter((r): r is { url: string; title?: string; content?: string } => typeof r.url === 'string')
      .map((r) => ({
        url: r.url,
        title: r.title ?? r.url,
        content: (r.content ?? '').slice(0, 2000),
        sourceType: classifySourceType(r.url),
      }))
  } catch (err) {
    console.error(`[web-research] Search API request failed for "${query}":`, err)
    return []
  }
}

async function wikipediaSummary(topic: string, opts: Required<SearchOptions>): Promise<WebSource[]> {
  try {
    const title = encodeURIComponent(topic.trim().replace(/\s+/g, '_'))
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'travel-guide-app/1.0 (destination research)' },
      signal: AbortSignal.timeout(opts.timeoutMs),
    })

    if (!res.ok) return []

    const data = (await res.json()) as {
      title?: string
      extract?: string
      content_urls?: { desktop?: { page?: string } }
      type?: string
    }

    if (!data.extract || data.type === 'disambiguation') return []

    const pageUrl =
      data.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${title}`

    return [
      {
        url: pageUrl,
        title: data.title ?? topic,
        content: data.extract.slice(0, 2000),
        sourceType: 'reputable_reference',
      },
    ]
  } catch (err) {
    console.error(`[web-research] Wikipedia lookup failed for "${topic}":`, err)
    return []
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a single search query across the configured providers and return typed,
 * authority-sorted sources. Never throws — returns [] on total failure so
 * callers degrade gracefully.
 */
export async function searchWeb(query: string, options: SearchOptions = {}): Promise<WebSource[]> {
  const opts: Required<SearchOptions> = {
    maxResults: options.maxResults ?? 5,
    timeoutMs: options.timeoutMs ?? 15_000,
  }

  const results = await tavilySearch(query, opts)
  const deduped = dedupeByUrl(results).slice(0, opts.maxResults)
  return sortByAuthority(deduped)
}

/**
 * Gather baseline destination sources for research. Combines a general web
 * search (when configured) with keyless Wikipedia lookups for the destination
 * and country, so there is always at least a reputable-reference baseline.
 */
export async function gatherDestinationSources(
  destination: string,
  country: string,
  options: SearchOptions = {}
): Promise<WebSource[]> {
  const opts: Required<SearchOptions> = {
    maxResults: options.maxResults ?? 6,
    timeoutMs: options.timeoutMs ?? 15_000,
  }

  const queries = [
    `${destination} ${country} currency driving side languages public transport official travel information`,
    `${country} currency ISO code driving side`,
  ]

  const searchResults = (
    await Promise.all(queries.map((q) => searchWeb(q, { maxResults: opts.maxResults, timeoutMs: opts.timeoutMs })))
  ).flat()

  const wikiResults = (
    await Promise.all([
      wikipediaSummary(destination, opts),
      wikipediaSummary(country, opts),
    ])
  ).flat()

  const combined = dedupeByUrl([...searchResults, ...wikiResults])
  return sortByAuthority(combined).slice(0, Math.max(opts.maxResults, wikiResults.length))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dedupeByUrl(sources: WebSource[]): WebSource[] {
  const seen = new Set<string>()
  const out: WebSource[] = []
  for (const s of sources) {
    const key = s.url.replace(/#.*$/, '').replace(/\/$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

export const WebResearch = { searchWeb, gatherDestinationSources, classifySourceType, sortByAuthority }
