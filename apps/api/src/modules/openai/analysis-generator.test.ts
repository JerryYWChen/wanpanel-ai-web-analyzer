import type OpenAI from "openai";
import {
  APIConnectionTimeoutError,
  APIError,
} from "openai";
import { describe, expect, it, vi } from "vitest";
import { createOpenAIAnalysisGenerator } from "./analysis-generator.js";

const validAnalysis = {
  title: "Example",
  summary: "Summary",
  keyFindings: [{ finding: "Fact", evidence: "Exact evidence." }],
  entities: [],
  datesOrNumbers: [],
  missingInformation: [],
};

function mockedClient(parse: ReturnType<typeof vi.fn>) {
  return {
    responses: { parse },
  } as unknown as Pick<OpenAI, "responses">;
}

function generatorFor(parse: ReturnType<typeof vi.fn>) {
  return createOpenAIAnalysisGenerator({
    apiKey: undefined,
    model: "test-model",
    timeoutMs: 100,
    client: mockedClient(parse),
  });
}

describe("OpenAI analysis generator", () => {
  it("returns a Zod-validated completed response", async () => {
    const generator = generatorFor(
      vi.fn().mockResolvedValue({
        status: "completed",
        model: "test-model-2026",
        output: [],
        output_parsed: validAnalysis,
      }),
    );

    const result = await generator.generate({
      systemPrompt: "system",
      userPrompt: "user",
    });

    expect(result.analysis).toEqual(validAnalysis);
    expect(result.model).toBe("test-model-2026");
  });

  it("maps provider timeouts", async () => {
    const generator = generatorFor(
      vi.fn().mockRejectedValue(new APIConnectionTimeoutError()),
    );

    await expect(
      generator.generate({ systemPrompt: "system", userPrompt: "user" }),
    ).rejects.toMatchObject({ code: "MODEL_TIMEOUT" });
  });

  it("maps provider API failures", async () => {
    const generator = generatorFor(
      vi
        .fn()
        .mockRejectedValue(
          new APIError(500, { message: "provider failed" }, "failed", new Headers()),
        ),
    );

    await expect(
      generator.generate({ systemPrompt: "system", userPrompt: "user" }),
    ).rejects.toMatchObject({ code: "MODEL_ERROR" });
  });

  it("detects model refusals", async () => {
    const generator = generatorFor(
      vi.fn().mockResolvedValue({
        status: "completed",
        model: "test-model",
        output_parsed: null,
        output: [
          {
            type: "message",
            content: [{ type: "refusal", refusal: "Cannot comply." }],
          },
        ],
      }),
    );

    await expect(
      generator.generate({ systemPrompt: "system", userPrompt: "user" }),
    ).rejects.toMatchObject({ code: "MODEL_REFUSAL" });
  });

  it("detects incomplete responses", async () => {
    const generator = generatorFor(
      vi.fn().mockResolvedValue({
        status: "incomplete",
        model: "test-model",
        output: [],
        output_parsed: null,
      }),
    );

    await expect(
      generator.generate({ systemPrompt: "system", userPrompt: "user" }),
    ).rejects.toMatchObject({ code: "MODEL_INCOMPLETE" });
  });

  it("rejects missing or invalid parsed output", async () => {
    const generator = generatorFor(
      vi.fn().mockResolvedValue({
        status: "completed",
        model: "test-model",
        output: [],
        output_parsed: { title: "Only one field" },
      }),
    );

    await expect(
      generator.generate({ systemPrompt: "system", userPrompt: "user" }),
    ).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });
});
