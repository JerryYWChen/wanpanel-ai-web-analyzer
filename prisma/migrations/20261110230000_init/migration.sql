-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PromptVersion" AS ENUM ('V1', 'V2');

-- CreateTable
CREATE TABLE "extractions" (
    "id" UUID NOT NULL,
    "requested_url" TEXT NOT NULL,
    "final_url" TEXT NOT NULL,
    "page_title" TEXT,
    "content_text" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "char_count" INTEGER NOT NULL,
    "was_truncated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" UUID NOT NULL,
    "extraction_id" UUID NOT NULL,
    "status" "AnalysisStatus" NOT NULL,
    "prompt_version" "PromptVersion" NOT NULL,
    "model" TEXT NOT NULL,
    "system_prompt_snapshot" TEXT NOT NULL,
    "user_prompt_template_snapshot" TEXT NOT NULL,
    "result_json" JSONB,
    "grounding_json" JSONB,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extractions_content_hash_idx" ON "extractions"("content_hash");

-- CreateIndex
CREATE INDEX "analyses_created_at_idx" ON "analyses"("created_at" DESC);

-- CreateIndex
CREATE INDEX "analyses_extraction_id_idx" ON "analyses"("extraction_id");

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_extraction_id_fkey" FOREIGN KEY ("extraction_id") REFERENCES "extractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
