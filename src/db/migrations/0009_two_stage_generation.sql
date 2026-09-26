-- Two-stage generation architecture:
--   stage 1: destination_facts — stable, web-researched baseline facts,
--            cached and reusable across trips, independently refreshable.
--   stage 2: trip_guides — the structured TripGuide generated from those facts
--            for a given trip cache key.
--
-- Both `facts` and `guide` are jsonb payloads validated at the application
-- layer by DestinationFactsSchema / TripGuideSchema (Zod). citext columns keep
-- lookups case-insensitive, consistent with advice_cache.

CREATE TABLE "destination_facts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "destination" citext NOT NULL,
  "country" citext NOT NULL,
  "facts" jsonb NOT NULL,
  "last_researched_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "destination_facts_key_idx" ON "destination_facts" ("destination", "country");

CREATE TABLE "trip_guides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "destination" citext NOT NULL,
  "start_month" citext NOT NULL,
  "end_month" citext NOT NULL,
  "traveller_type" citext NOT NULL,
  "budget_range" text NOT NULL,
  "guide" jsonb NOT NULL,
  "destination_facts_id" uuid REFERENCES "destination_facts"("id") ON DELETE SET NULL,
  "generated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "trip_guides_key_idx" ON "trip_guides" ("destination", "start_month", "end_month", "traveller_type", "budget_range");
