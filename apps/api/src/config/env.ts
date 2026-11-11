import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

config({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3001),
  EXTRACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  EXTRACTION_MAX_HTML_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 1024 * 1024),
  EXTRACTION_MAX_TEXT_CHARS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  OPENAI_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  OPENAI_MODEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
});

export const env = envSchema.parse(process.env);
