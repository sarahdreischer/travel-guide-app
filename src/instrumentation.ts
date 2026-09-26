/**
 * Next.js instrumentation hook — runs once when the server starts.
 * This is the correct place for long-running background tasks.
 * Only executes at runtime, never during `next build`.
 *
 * Currently a no-op: the legacy background advice reconciler was removed with
 * the move to the structured two-stage pipeline (which generates on demand at
 * trip creation and on first view). Add future server-start tasks here.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // No background tasks to start.
}
