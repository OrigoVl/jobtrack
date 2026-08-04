CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "vacancies_embedding_idx" ON "vacancies" USING hnsw ("embedding" vector_cosine_ops);