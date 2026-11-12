import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("production environment validation", () => {
  it("reports missing required names without secret values", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "",
        OPENAI_API_KEY: "",
        OPENAI_MODEL: "",
      }),
    ).toThrow(
      "Missing required production environment variables: DATABASE_URL, OPENAI_API_KEY, OPENAI_MODEL.",
    );
  });

  it("accepts hosting-platform production variables", () => {
    const parsed = parseEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://example.invalid/database",
      OPENAI_API_KEY: "server-secret",
      OPENAI_MODEL: "structured-output-model",
      PORT: "10000",
    });

    expect(parsed).toMatchObject({
      NODE_ENV: "production",
      PORT: 10_000,
      OPENAI_MODEL: "structured-output-model",
    });
  });

  it("keeps local and test configuration optional", () => {
    expect(parseEnv({ NODE_ENV: "test" }).NODE_ENV).toBe("test");
  });
});
