import request from "supertest";
import { describe, expect, it } from "vitest";
import { apiErrorEnvelopeSchema } from "@wanpanel/shared";
import { createApp } from "./app.js";

describe("API fallback", () => {
  it("returns an API-style 404 for unknown API routes", async () => {
    const response = await request(createApp()).get("/api/not-a-route");

    expect(response.status).toBe(404);
    expect(apiErrorEnvelopeSchema.parse(response.body)).toEqual({
      error: {
        code: "API_ROUTE_NOT_FOUND",
        message: "The requested API route was not found.",
      },
    });
  });
});
