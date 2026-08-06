CREATE TABLE "saved_tips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "trip_id" uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "saved_tips_user_trip_q_idx" ON "saved_tips" ("user_id", "trip_id", "category", "question");
