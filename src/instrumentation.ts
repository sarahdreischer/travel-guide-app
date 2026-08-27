/**
 * Next.js instrumentation hook — runs once when the server starts.
 * This is the correct place for long-running background tasks.
 * Only executes at runtime, never during `next build`.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the Node.js server (not edge runtime, not during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/scheduled-reconciliation')
  }
}
