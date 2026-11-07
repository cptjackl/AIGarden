import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { HealthResponseSchema, type HealthResponse } from "@loregarden/shared";
import type { Db } from "./db/client.js";
import { authPlugin } from "./auth/plugin.js";
import { authRoutes } from "./routes/auth.js";
import { worldRoutes } from "./routes/worlds.js";

export const APP_VERSION = "0.1.0";

export interface AppOptions {
  db: Db;
  logger?: boolean;
}

export async function buildApp({ db, logger = false }: AppOptions) {
  const app = Fastify({ logger });

  await app.register(cookie);
  await app.register(authPlugin, { db });

  app.get("/api/health", async (): Promise<HealthResponse> => {
    return HealthResponseSchema.parse({ status: "ok", version: APP_VERSION });
  });

  await app.register(authRoutes, { db, prefix: "/api/auth" });
  await app.register(worldRoutes, { db, prefix: "/api/worlds" });

  return app;
}
