DROP TABLE "enrichment_cache" CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "source" text DEFAULT '' NOT NULL;