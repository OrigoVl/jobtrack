CREATE TABLE "enrichment_cache" (
	"k" text PRIMARY KEY NOT NULL,
	"v" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website" text;--> statement-breakpoint
CREATE INDEX "enrichment_cache_created_at_idx" ON "enrichment_cache" USING btree ("created_at");