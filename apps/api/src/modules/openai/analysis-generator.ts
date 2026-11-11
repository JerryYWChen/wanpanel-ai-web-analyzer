import OpenAI, {
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";
import { analysisSchema, type Analysis } from "@wanpanel/shared";
import { env } from "../../config/env.js";
import { AnalysisError } from "../analyses/analysis-errors.js";

export interface AnalysisRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface AnalysisGeneration {
  analysis: Analysis;
  model: string;
  latencyMs: number;
}

export interface AnalysisGenerator {
  generate(request: AnalysisRequest): Promise<AnalysisGeneration>;
}

export interface OpenAIAnalysisGeneratorOptions {
  apiKey: string | undefined;
  model: string | undefined;
  timeoutMs: number;
  client?: Pick<OpenAI, "responses">;
}

function findRefusal(response: {
  output: Array<{
    type: string;
    content?: Array<{ type: string; refusal?: string }>;
  }>;
}): string | null {
  for (const item of response.output) {
    if (item.type !== "message") continue;
    const refusal = item.content?.find((content) => content.type === "refusal");
    if (refusal?.refusal) return refusal.refusal;
  }
  return null;
}

export function createOpenAIAnalysisGenerator(
  options: OpenAIAnalysisGeneratorOptions,
): AnalysisGenerator {
  return {
    async generate(request) {
      if (!options.model || (!options.apiKey && !options.client)) {
        throw new AnalysisError(
          "MODEL_CONFIGURATION_ERROR",
          "OpenAI is not configured on the server.",
        );
      }

      const client =
        options.client ??
        new OpenAI({ apiKey: options.apiKey, timeout: options.timeoutMs });
      const startedAt = performance.now();

      let response;
      try {
        response = await client.responses.parse(
          {
            model: options.model,
            input: [
              { role: "system", content: request.systemPrompt },
              { role: "user", content: request.userPrompt },
            ],
            text: {
              format: zodTextFormat(analysisSchema, "webpage_analysis"),
            },
          },
          { timeout: options.timeoutMs },
        );
      } catch (error) {
        if (
          error instanceof APIConnectionTimeoutError ||
          error instanceof APIUserAbortError
        ) {
          throw new AnalysisError(
            "MODEL_TIMEOUT",
            "The AI analysis request timed out.",
            { cause: error },
          );
        }

        if (error instanceof ZodError || error instanceof SyntaxError) {
          throw new AnalysisError(
            "INVALID_MODEL_OUTPUT",
            "The AI returned output that did not match the required schema.",
            { cause: error },
          );
        }

        if (error instanceof APIError) {
          throw new AnalysisError(
            "MODEL_ERROR",
            "The AI provider could not complete the analysis.",
            { cause: error },
          );
        }

        throw new AnalysisError(
          "MODEL_ERROR",
          "The AI provider could not complete the analysis.",
          { cause: error },
        );
      }

      const refusal = findRefusal(response);
      if (refusal) {
        throw new AnalysisError(
          "MODEL_REFUSAL",
          "The AI model refused to analyze this webpage content.",
        );
      }

      if (response.status !== "completed") {
        throw new AnalysisError(
          "MODEL_INCOMPLETE",
          "The AI response ended before the analysis was complete.",
        );
      }

      const parsed = analysisSchema.safeParse(response.output_parsed);
      if (!parsed.success) {
        throw new AnalysisError(
          "INVALID_MODEL_OUTPUT",
          "The AI returned output that did not match the required schema.",
          { cause: parsed.error },
        );
      }

      return {
        analysis: parsed.data,
        model: response.model,
        latencyMs: Math.round(performance.now() - startedAt),
      };
    },
  };
}

export const analysisGenerator = createOpenAIAnalysisGenerator({
  apiKey: env.OPENAI_API_KEY,
  model: env.OPENAI_MODEL,
  timeoutMs: env.OPENAI_TIMEOUT_MS,
});
