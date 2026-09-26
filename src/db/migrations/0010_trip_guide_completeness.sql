-- Topic-level completeness tracking for structured trip guides, enabling
-- on-view reconciliation of topics that failed to generate.
--
--   complete         — false when at least one relevant topic failed to
--                      generate (content failure) or a provider failure
--                      short-circuited the run. Incomplete guides are topped
--                      up (missing topics regenerated) on the next view.
--   attempted_topics — the topic ids attempted in the most recent generation
--                      run (jsonb string[]), or null when unknown.
--
-- Existing rows were produced by the previous single-shot generator, so they
-- are treated as complete (no reconciliation needed for them).

ALTER TABLE "trip_guides"
  ADD COLUMN "complete" boolean NOT NULL DEFAULT false,
  ADD COLUMN "attempted_topics" jsonb;

UPDATE "trip_guides" SET "complete" = true;
