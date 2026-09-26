-- Question-level coverage tracking for structured trip guides.
--
-- `covered_questions` records the question-library ids a guide was generated
-- against (offered to the model across its topics). When a new question is
-- added to the library, an existing guide whose covered set does not include
-- that id is detected as stale on open and the affected topic is regenerated.
--
-- Nullable: existing rows have unknown coverage. The application treats a null
-- covered set as "covers exactly the question ids already present in the guide"
-- so only genuinely new questions trigger a top-up (no mass regeneration).

ALTER TABLE "trip_guides" ADD COLUMN "covered_questions" jsonb;
