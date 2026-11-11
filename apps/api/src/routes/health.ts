import { Router } from "express";
import { healthResponseSchema } from "@wanpanel/shared";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  const body = healthResponseSchema.parse({
    status: "ok",
    service: "wanpanel-api",
    timestamp: new Date().toISOString(),
  });

  response.json(body);
});
