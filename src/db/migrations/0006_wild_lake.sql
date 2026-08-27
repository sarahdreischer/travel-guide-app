ALTER TABLE "trips" ADD COLUMN "starting_location" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "transport_cost_included" boolean DEFAULT true NOT NULL;