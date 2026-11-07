import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/client.js";
import type { users } from "../db/schema.js";
import { findUserBySession, SESSION_COOKIE } from "./session.js";

export type AuthUser = typeof users.$inferSelect;

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.user) {
    return reply.code(401).send({ error: "Not signed in" });
  }
};

/** Resolves the signed-in user (if any) from the session cookie onto every request. */
const plugin: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    request.user = token ? await findUserBySession(db, token) : null;
  });
};

export const authPlugin = fp(plugin, { name: "auth-plugin" });
