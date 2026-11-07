import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";
import { createDb } from "./db/client.js";

async function setup() {
  const db = createDb(":memory:");
  const app = await buildApp({ db });
  return app;
}

function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const header = res.headers["set-cookie"];
  const raw = Array.isArray(header) ? header[0] : String(header);
  return raw.split(";")[0];
}

const alice = { email: "alice@example.com", displayName: "Alice", password: "correct-horse" };

describe("GET /api/health", () => {
  it("returns status ok with the app version", async () => {
    const app = await setup();
    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", version: "0.1.0" });
    await app.close();
  });
});

describe("auth", () => {
  it("registers, sets a session cookie, and returns the user", async () => {
    const app = await setup();
    const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: alice });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ email: "alice@example.com", displayName: "Alice" });
    expect(res.json()).not.toHaveProperty("passwordHash");
    expect(res.headers["set-cookie"]).toMatch(/lg_session=.+HttpOnly/);
    await app.close();
  });

  it("normalizes email case on register and login", async () => {
    const app = await setup();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...alice, email: "  Alice@Example.com " },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "alice@example.com", password: alice.password },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("rejects duplicate emails with 409", async () => {
    const app = await setup();
    await app.inject({ method: "POST", url: "/api/auth/register", payload: alice });
    const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: alice });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("rejects short passwords", async () => {
    const app = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...alice, password: "short" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("logs in with the right password and rejects the wrong one", async () => {
    const app = await setup();
    await app.inject({ method: "POST", url: "/api/auth/register", payload: alice });

    const ok = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: alice.email, password: alice.password },
    });
    const bad = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: alice.email, password: "wrong-password" },
    });

    expect(ok.statusCode).toBe(200);
    expect(bad.statusCode).toBe(401);
    expect(bad.json()).toEqual({ error: "Invalid email or password" });
    await app.close();
  });

  it("returns the current user from a valid session and 401 without one", async () => {
    const app = await setup();
    const reg = await app.inject({ method: "POST", url: "/api/auth/register", payload: alice });
    const cookie = sessionCookie(reg);

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const anon = await app.inject({ method: "GET", url: "/api/auth/me" });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: alice.email });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });

  it("invalidates the session on logout", async () => {
    const app = await setup();
    const reg = await app.inject({ method: "POST", url: "/api/auth/register", payload: alice });
    const cookie = sessionCookie(reg);

    const out = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });

    expect(out.statusCode).toBe(204);
    expect(me.statusCode).toBe(401);
    await app.close();
  });
});

describe("worlds", () => {
  async function signedInCookie(app: Awaited<ReturnType<typeof setup>>, who = alice) {
    const reg = await app.inject({ method: "POST", url: "/api/auth/register", payload: who });
    return sessionCookie(reg);
  }

  it("requires sign-in", async () => {
    const app = await setup();
    const res = await app.inject({ method: "GET", url: "/api/worlds" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("creates, lists, fetches, and updates the user's worlds", async () => {
    const app = await setup();
    const cookie = await signedInCookie(app);

    const created = await app.inject({
      method: "POST",
      url: "/api/worlds",
      headers: { cookie },
      payload: { name: "Ashfall", description: "A volcanic continent" },
    });
    expect(created.statusCode).toBe(201);
    const world = created.json();
    expect(world).toMatchObject({ name: "Ashfall", description: "A volcanic continent" });

    const list = await app.inject({ method: "GET", url: "/api/worlds", headers: { cookie } });
    expect(list.json()).toHaveLength(1);

    const one = await app.inject({ method: "GET", url: `/api/worlds/${world.id}`, headers: { cookie } });
    expect(one.statusCode).toBe(200);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/worlds/${world.id}`,
      headers: { cookie },
      payload: { name: "Ashfall Reborn" },
    });
    expect(patched.json()).toMatchObject({ name: "Ashfall Reborn", description: "A volcanic continent" });
    await app.close();
  });

  it("hides other users' worlds", async () => {
    const app = await setup();
    const aliceCookie = await signedInCookie(app);
    const bobCookie = await signedInCookie(app, {
      email: "bob@example.com",
      displayName: "Bob",
      password: "another-pass",
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/worlds",
      headers: { cookie: aliceCookie },
      payload: { name: "Private" },
    });
    const id = created.json().id;

    const bobList = await app.inject({ method: "GET", url: "/api/worlds", headers: { cookie: bobCookie } });
    const bobGet = await app.inject({ method: "GET", url: `/api/worlds/${id}`, headers: { cookie: bobCookie } });
    const bobPatch = await app.inject({
      method: "PATCH",
      url: `/api/worlds/${id}`,
      headers: { cookie: bobCookie },
      payload: { name: "Hacked" },
    });

    expect(bobList.json()).toEqual([]);
    expect(bobGet.statusCode).toBe(404);
    expect(bobPatch.statusCode).toBe(404);
    await app.close();
  });

  it("rejects an empty world name", async () => {
    const app = await setup();
    const cookie = await signedInCookie(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/worlds",
      headers: { cookie },
      payload: { name: "   " },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
