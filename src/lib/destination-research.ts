/**
 * Destination Research (stage 1).
 *
 * Establishes the STABLE baseline facts for a destination from EXTERNAL web
 * evidence — it does not treat the LLM's pretrained knowledge as authoritative.
 *
 * Flow:
 *   destination + country
 *     → gather web sources (web-research.ts)
 *     → structured extraction via generateObject (research-only prompt)
 *     → attach provenance from the ACTUAL retrieved sources
 *     → validate against DestinationFactsSchema
 *
 * The research stage is reusable independently of any specific traveller, so
 * the result can be cached and shared across trips (see
 * destination-facts-store.ts).
 *
 * Note: this stage reuses the existing AI SDK setup (generateObject +
 * @ai-sdk/openai) and the existing rate limiter. It does NOT implement the
 * future claim/web-verification pipeline.
 */

import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import {
  ResearchedFactsSchema,
  DestinationFactsSchema,
  type DestinationFacts,
  type Source,
} from '@/lib/schemas/destination-facts'
import { gatherDestinationSources, type WebSource } from '@/lib/web-research'
import { canCallAI, recordAICall, recordAIFailure, getRateLimitStatus } from '@/lib/ai-rate-limiter'
import type { AICallPriority } from '@/lib/ai-rate-limiter'
import { AIRateLimitedError, AdviceTimeoutError } from '@/lib/ai-errors'

// ─── Config ─────────────────────────────────────────────────────────────────

function getModel() {
  const modelId = process.env.AI_MODEL ?? 'gpt-4o-mini'
  return openai(modelId)
}

const RESEARCH_TIMEOUT_MS = parseInt(process.env.AI_RESEARCH_TIMEOUT_MS ?? '60000', 10)

export class DestinationResearchError extends Error {
  constructor(message = 'Destination research failed') {
    super(message)
    this.name = 'DestinationResearchError'
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

/**
 * Build the research-only prompt. The model's role is NOT to write travel
 * advice — only to extract stable destination facts SUPPORTED by the supplied
 * web evidence.
 */
function buildResearchPrompt(destination: string, country: string, sources: WebSource[]): string {
  const evidence = sources
    .map((s, i) => `[Source ${i + 1}] (${s.sourceType}) ${s.title}\n${s.url}\n${s.content}`)
    .join('\n\n')

  return `You are a destination-facts RESEARCH extractor. You are NOT a travel advisor. Your ONLY job is to extract STABLE, baseline destination facts that are SUPPORTED by the web evidence provided below.

DESTINATION: ${destination}
COUNTRY: ${country}

STRICT RULES:
- Extract ONLY facts supported by the evidence. Do not add facts from your own memory.
- Distinguish UNKNOWN from FALSE. If the evidence does not establish whether a transport mode exists, use null (unknown) for that boolean — never guess false. "Not found" is NOT "does not exist".
- For rideHailing, list ONLY brands the evidence establishes as operating there (e.g. ["Grab"]). If none are established, use an empty array. Do not invent brands.
- drivingSide must be "left", "right", or "unknown". Use "unknown" if the evidence does not establish it.
- currency.code should be the ISO 4217 code where the evidence supports it (e.g. "THB"); currency.name is the common name (e.g. "Thai Baht").
- languages: the main languages actually used, per the evidence.
- geography.type: a short descriptor (e.g. "island", "coastal city") or null if unclear. geography.majorAreas: notable areas/districts named in the evidence (may be empty).
- Do NOT include volatile information: no current prices, no opening hours, no current taxi fares, no SIM prices, no current weather.
- Do NOT include recommendations or travel-marketing copy.
- Prefer authoritative sources (government, tourism authority, transport operator, official) over general references when they disagree.

Return ONLY the structured facts object matching the schema. Do not include sources, URLs, or citations in your output — those are attached separately by the application.

WEB EVIDENCE:
${evidence}`
}

// ─── Research ─────────────────────────────────────────────────────────────────

export interface ResearchDestinationParams {
  destination: string
  country: string
  priority?: AICallPriority
  /** Override sources (used by tests to avoid live network calls). */
  sources?: WebSource[]
}

/**
 * Research a destination and return validated DestinationFacts.
 * Throws AIRateLimitedError / DestinationResearchError on failure.
 */
export async function researchDestination(
  params: ResearchDestinationParams
): Promise<DestinationFacts> {
  const { destination, country, priority = 'high' } = params

  // 1. Gather external web evidence (unless provided, e.g. in tests).
  const sources = params.sources ?? (await gatherDestinationSources(destination, country))

  if (sources.length === 0) {
    // No evidence at all → we cannot establish traceable facts. Fail rather
    // than fabricate. (Callers may fall back to the legacy path.)
    throw new DestinationResearchError(
      `No web sources found for "${destination}, ${country}" — cannot establish traceable facts.`
    )
  }

  // 2. Enforce the shared rate limit before the model call.
  if (!canCallAI(priority)) {
    const status = getRateLimitStatus()
    console.log(
      `[destination-research] Rate limited (minute: ${status.minuteCount}/${status.maxPerMinute}, day: ${status.dayCount}/${status.maxPerDay}, cooldown: ${status.inCooldown}). Skipping research.`
    )
    throw new AIRateLimitedError()
  }

  const prompt = buildResearchPrompt(destination, country, sources)

  try {
    recordAICall()

    console.log('[destination-research] ▶ RESEARCH REQUEST:', JSON.stringify({
      model: process.env.AI_MODEL ?? 'gpt-4o-mini',
      destination,
      country,
      sourceCount: sources.length,
      promptLength: prompt.length,
    }, null, 2))

    // 3. Structured extraction. The model returns everything EXCEPT sources.
    const { object: researched } = await generateObject({
      model: getModel(),
      prompt,
      schema: ResearchedFactsSchema,
      abortSignal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS),
    })

    // 4. Attach provenance from the ACTUAL retrieved sources — never trust the
    // model to echo them. This guarantees facts are traceable.
    const provenance: Source[] = sources.map((s) => ({
      url: s.url,
      title: s.title,
      sourceType: s.sourceType,
    }))

    const facts: DestinationFacts = {
      ...researched,
      // Keep the app-supplied destination/country authoritative over the model.
      destination,
      country,
      sources: provenance,
    }

    // 5. Validate the assembled object.
    const validated = DestinationFactsSchema.parse(facts)

    console.log('[destination-research] ◀ RESEARCH RESULT:', JSON.stringify(validated, null, 2))

    return validated
  } catch (error: unknown) {
    recordAIFailure()
    if (error instanceof AIRateLimitedError) throw error
    console.error('[destination-research] Research failed:', error)
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new AdviceTimeoutError('Destination research timed out')
    }
    throw new DestinationResearchError(
      error instanceof Error ? error.message : 'Destination research failed'
    )
  }
}

export const DestinationResearch = { researchDestination }
