import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateWorldInputSchema,
  UpdateWorldInputSchema,
  type World,
} from "@loregarden/shared";
import type { Db } from "../db/client.js";
import { worlds } from "../db/schema.js";
import { requireUser } from "../auth/plugin.js";

type WorldRow = typeof worlds.$inferSelect;

function toWorld(row: WorldRow): World {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const worldRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  // Every world route requires sign-in. Access is limited to the owner for now;
  // member access comes with sharing in Phase 5.
  app.addHook("preHandler", requireUser);

  app.get("/", async (request) => {
    const rows = await db
      .select()
      .from(worlds)
      .where(eq(worlds.ownerId, request.user!.id))
      .orderBy(desc(worlds.updatedAt));
    return rows.map(toWorld);
  });

  app.post("/", async (request, reply) => {
    const parsed = CreateWorldInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const now = new Date();
    const [row] = await db
      .insert(worlds)
      .values({
        id: randomUUID(),
        name: parsed.data.name,
        description: parsed.data.description,
        ownerId: request.user!.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return reply.code(201).send(toWorld(row));
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const [row] = await db
      .select()
      .from(worlds)
      .where(and(eq(worlds.id, request.params.id), eq(worlds.ownerId, request.user!.id)));
    if (!row) return reply.code(404).send({ error: "World not found" });
    return toWorld(row);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const parsed = UpdateWorldInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const [row] = await db
      .update(worlds)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(worlds.id, request.params.id), eq(worlds.ownerId, request.user!.id)))
      .returning();
    if (!row) return reply.code(404).send({ error: "World not found" });
    return toWorld(row);
  });
};
