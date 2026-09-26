CREATE TABLE "destination_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination" "citext" NOT NULL,
	"country" "citext" NOT NULL,
	"facts" jsonb NOT NULL,
	"last_researched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination" "citext" NOT NULL,
	"start_month" "citext" NOT NULL,
	"end_month" "citext" NOT NULL,
	"traveller_type" "citext" NOT NULL,
	"budget_range" text NOT NULL,
	"guide" jsonb NOT NULL,
	"destination_facts_id" uuid,
	"complete" boolean DEFAULT false NOT NULL,
	"attempted_topics" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_guides" ADD CONSTRAINT "trip_guides_destination_facts_id_destination_facts_id_fk" FOREIGN KEY ("destination_facts_id") REFERENCES "public"."destination_facts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "destination_facts_key_idx" ON "destination_facts" USING btree ("destination","country");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_guides_key_idx" ON "trip_guides" USING btree ("destination","start_month","end_month","traveller_type","budget_range");