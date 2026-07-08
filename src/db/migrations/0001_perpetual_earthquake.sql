DROP INDEX "advice_cache_key_idx";--> statement-breakpoint
ALTER TABLE "advice_cache" ADD COLUMN "start_month" "citext" NOT NULL;--> statement-breakpoint
ALTER TABLE "advice_cache" ADD COLUMN "end_month" "citext" NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "advice_cache_key_idx" ON "advice_cache" USING btree ("destination","start_month","end_month","traveller_type","budget_range","category");--> statement-breakpoint
ALTER TABLE "advice_cache" DROP COLUMN "month";