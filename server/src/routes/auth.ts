import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  LoginInputSchema,
  RegisterInputSchema,
  type User,
} from "@loregarden/shared";
import type { Db } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "../auth/session.js";
import { requireUser, type AuthUser } from "../auth/plugin.js";

export function toUser(row: AuthUser): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
  };
}

export const authRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  const secureCookies = process.env.NODE_ENV === "production";

  function setSessionCookie(reply: FastifyReply, token: string) {
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
  }

  app.post("/register", async (request, reply) => {
    const parsed = RegisterInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { email, displayName, password } = parsed.data;

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return reply.code(409).send({ error: "An account with that email already exists" });
    }

    const [user] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        email,
        displayName,
        passwordHash: await hashPassword(password),
        createdAt: new Date(),
      })
      .returning();

    const session = await createSession(db, user.id);
    setSessionCookie(reply, session.token);
    return reply.code(201).send(toUser(user));
  });

  app.post("/login", async (request, reply) => {
    const parsed = LoginInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Email and password are required" });
    }
    const { email, password } = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.email, email));
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const session = await createSession(db, user.id);
    setSessionCookie(reply, session.token);
    return toUser(user);
  });

  app.post("/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await deleteSession(db, token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: requireUser }, async (request) => {
    return toUser(request.user!);
  });
};
