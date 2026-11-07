import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

export const SESSION_COOKIE = "lg_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: Db, userId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    createdAt: now,
    expiresAt,
  });
  return { token, expiresAt };
}

/** Returns the user for a valid, unexpired session token, or null. */
export async function findUserBySession(db: Db, token: string, now = new Date()) {
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashToken(token)));

  const row = rows[0];
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  return row.user;
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function deleteExpiredSessions(db: Db, now = new Date()) {
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}
