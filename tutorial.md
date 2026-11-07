# LoreGarden Development Tutorial

This tutorial walks through how the app was built in **Phase 1** (project scaffold) and **Phase 2** (accounts and worlds). It explains each step and why it was done, so you can continue the project yourself.

It assumes you know TypeScript and React. Other tools are introduced where they first appear.

---

## Part 0: The big picture

LoreGarden is a worldbuilding app for tabletop RPG players and game masters. It has two running programs:

| Piece | Folder | Runs in | Job |
|---|---|---|---|
| Client | `client/` | Browser | The UI: pages, forms, navigation |
| Server | `server/` | Node.js | The API: auth, data, validation, database |
| Shared | `shared/` | Both | Types and Zod schemas that both sides agree on |

The client and server talk over HTTP with JSON. A **monorepo** (one git repository holding several packages) keeps all three in one place. npm **workspaces** link the packages together so `server` can `import` from `@loregarden/shared` without publishing it.

```
LoreGarden2/
├── package.json          # root: workspaces and top-level scripts
├── tsconfig.base.json    # TypeScript settings shared by all packages
├── README.md             # quick commands and configuration
├── shared/
│   └── src/              # Zod schemas and types used by client and server
├── server/
│   ├── drizzle/          # generated SQL migrations
│   ├── drizzle.config.ts # drizzle-kit settings
│   └── src/
│       ├── app.ts        # builds the Fastify app (routes and plugins)
│       ├── index.ts      # starts the server, reads environment variables
│       ├── app.test.ts   # API tests
│       ├── auth/         # passwords, sessions, the request-user plugin
│       ├── db/           # database schema and connection
│       └── routes/       # HTTP endpoints
└── client/
    ├── vite.config.ts    # dev server and API proxy
    └── src/
        ├── main.tsx      # React entry point, providers
        ├── App.tsx       # renders the router
        ├── router.tsx    # URL to page mapping
        ├── Layout.tsx    # top bar and route guard
        ├── api.ts        # fetch wrapper with validation
        ├── auth/hooks.ts    # sign-in, register, sign-out queries
        ├── worlds/hooks.ts  # world queries and mutations
        └── pages/           # screens
```

---

## Part 1: Phase 1, project scaffold

**Goal:** a monorepo where the client, server, and shared packages build, type-check, and talk to each other. The browser shows a live result from the server.

### Step 1.1: Create the root `package.json` with workspaces

The root `package.json` declares the three packages as workspaces:

```json
"workspaces": ["shared", "server", "client"]
```

**Why:** running `npm install` at the root installs every package's dependencies into one shared `node_modules/`, and links `@loregarden/shared` to the local `shared/` folder. Any change to `shared` is visible to the other packages immediately.

Set `"private": true` so npm never publishes the root by accident. Set `"engines": { "node": ">=22" }` so people know which Node version to use.

### Step 1.2: Create the shared TypeScript config

`tsconfig.base.json` holds settings every package needs:

- `"strict": true`: turns on the full type-checking rules.
- `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`: match how Node resolves ES modules. This is why imports inside `shared` and `server` end in `.js`, even though the source file is `.ts`. TypeScript requires this because Node needs the real file name at runtime.

Each package has its own `tsconfig.json` that extends this base. The client overrides module settings for Vite (see Step 1.5).

### Step 1.3: Create the `shared` package

`shared/` is the contract between client and server. It holds Zod schemas.

**What is Zod?** A library that defines a schema once and gives you both a runtime validator and a TypeScript type:

```ts
import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
```

`HealthResponseSchema.parse(data)` throws if the data doesn't match. `z.infer` gives you the matching TypeScript type. One definition gives you both checks.

**Why shared:** the server validates incoming data with the schema, and the client validates responses with the same schema. If the two drift apart, the type checker or the runtime check catches it.

Build settings: `shared` compiles to `shared/dist/` with `tsc`. Other packages import the compiled output, so **`shared` must be built before anything that depends on it.** The root scripts handle this (see Step 1.7).

### Step 1.4: Create the `server` package with Fastify

Install the dependencies in the server workspace:

```bash
npm install fastify -w server
```

**What is Fastify?** A Node.js web framework, similar to Express, with built-in schema-based validation and fast routing. It is the layer that receives HTTP requests and sends responses.

**The app factory pattern.** `server/src/app.ts` exports `buildApp()`, which creates and configures the Fastify instance but does not start listening. Separating these lets tests build the app in memory without opening a port. `server/src/index.ts` is the thin entry point that calls `buildApp()` and calls `listen()`.

The first endpoint was a health check:

```ts
app.get("/api/health", async () => HealthResponseSchema.parse({ status: "ok", version: APP_VERSION }));
```

Health checks give you a fast way to confirm the server is running and reachable.

### Step 1.5: Create the `client` package with Vite and React

The client is scaffolded with Vite, a dev server and bundler. Its `client/vite.config.ts` includes a **proxy**:

```ts
server: {
  proxy: {
    "/api": { target: `http://127.0.0.1:${process.env.PORT ?? 3000}`, changeOrigin: true },
  },
},
```

**Why a proxy:** in development the browser loads the page from `localhost:5173` (Vite) and calls `/api/...` on that same origin. Vite forwards those calls to the API server on port 3000. The browser sees a single origin, so cookies work without CORS setup.

### Step 1.6: Connect the client to the server

`client/src/main.tsx` wraps the app in `QueryClientProvider`. That's TanStack Query, which we use for server data.

**What is TanStack Query?** A library for data fetched from a server. It handles caching, loading and error states, refetching, and sharing data between components. It is not an ORM (the database layer is Drizzle, covered in Part 2).

Phase 1 used a single query to call `/api/health` and display the result. This confirmed the proxy, the shared schema, and the server all worked together.

### Step 1.7: Root scripts

The root `package.json` has the scripts you'll use every day:

| Script | What it does |
|---|---|
| `npm run dev` | Builds `shared`, then runs the server and client dev servers together |
| `npm run build` | Builds `shared`, then `server`, then `client` (production output) |
| `npm test` | Builds `shared`, then runs server tests |
| `npm run typecheck` | Builds `shared`, then type-checks `server` and `client` |

**Why `shared` is built first:** `server` and `client` import `@loregarden/shared` from its compiled `dist/` folder. If `dist/` is missing or stale, you get "cannot find module" errors. The `predev` hook and the scripts above avoid that.

`concurrently` (a root dev dependency) runs the two dev servers in one terminal with labelled output.

### Step 1.8: Verify Phase 1

Phase 1 was complete when all of these passed:

1. `npm run typecheck` exits cleanly.
2. `npm run build` produces `dist/` output for each package.
3. `npm run dev`, then opening `http://localhost:5173` shows the health status from the server.

**Habit to keep:** verify each phase before starting the next one. A broken foundation makes every later bug harder to find.

---

## Part 2: Phase 2, accounts and worlds

**Goal:** users can register, sign in, sign out, and create and edit their own worlds. Data is stored in a database and protected per user.

### Step 2.1: Pick a database layer

Install the server dependencies:

```bash
npm install drizzle-orm better-sqlite3 @fastify/cookie fastify-plugin -w server
npm install -D drizzle-kit @types/better-sqlite3 -w server
```

What each one is:

- **better-sqlite3:** a synchronous SQLite driver for Node. SQLite is a database stored in a single file. It needs no separate server, which suits self-hosting.
- **drizzle-orm:** a TypeScript database library. You describe tables in TypeScript and write typed queries. The SQL it generates is visible and predictable. Drizzle is an ORM in the sense that it maps tables to TypeScript objects, but it runs on the server only.
- **drizzle-kit:** the command-line tool that generates migration files from your schema.
- **@fastify/cookie:** reads and writes cookies on the server for sessions.
- **fastify-plugin:** a helper so a Fastify plugin can share decorations (like `request.user`) with the rest of the app instead of being scoped to one child.

### Step 2.2: Define the schema

`server/src/db/schema.ts` describes three tables:

- **`users`:** id, email (unique), display name, password hash, created time.
- **`sessions`:** a token hash as the primary key, the user it belongs to, and an expiry.
- **`worlds`:** id, name, description, owner id, created and updated times.

Two details matter:

- **Foreign keys with `onDelete: "cascade"`.** Deleting a user deletes their sessions and worlds automatically.
- **Session tokens are not stored raw.** The cookie holds a random token. The database stores only its SHA-256 hash, so a leaked database does not let anyone sign in.

### Step 2.3: Generate and run migrations

A **migration** is a versioned SQL file that changes the database. Instead of writing SQL by hand, you change `schema.ts` and let drizzle-kit generate the SQL:

```bash
npm run db:generate -w @loregarden/server
```

This creates `server/drizzle/0000_init.sql` and a snapshot in `server/drizzle/meta/`. Commit both.

**Why not edit the database by hand?** Migrations are repeatable. Every developer and every deployment ends up with the same schema, and the history of changes is in git.

`server/src/db/client.ts` opens the database and applies pending migrations at startup. It also turns on two SQLite settings:

- **WAL mode** (`journal_mode = WAL`): lets reads and writes happen at the same time, which is better for a web server.
- **Foreign keys on** (`foreign_keys = ON`): SQLite does not enforce foreign keys unless you enable them.

If you change the schema later, run the generate command again and restart the server. If it reports "No schema changes, nothing to migrate", the database and schema match.

### Step 2.4: Hash passwords

`server/src/auth/password.ts` stores passwords with **scrypt**, a deliberately slow hashing function from Node's built-in `crypto` module.

- Each password gets a random salt, so identical passwords produce different hashes.
- The stored format is `scrypt$N$r$p$salt$hash`, so the parameters travel with the hash and can change later.
- Verification uses a constant-time comparison (`timingSafeEqual`) so an attacker can't learn the hash bit by bit from response timing.

**Why not argon2?** It's a good choice too, but it needs a native build step. scrypt keeps the install simple.

### Step 2.5: Create sessions

`server/src/auth/session.ts` handles sign-in state:

1. On login, generate 32 random bytes and encode them as the token.
2. Store the SHA-256 hash of the token with the user id and a 30-day expiry.
3. Send the raw token to the browser in a cookie named `lg_session`.
4. On each request, hash the cookie value and look it up.

The cookie is set with:

- `httpOnly`: JavaScript in the page cannot read it, which limits damage from cross-site scripting (XSS).
- `sameSite: "lax"`: the browser won't send it on most cross-site requests, which limits cross-site request forgery (CSRF).
- `secure` only when `NODE_ENV=production`: browsers only send `secure` cookies over HTTPS. Local development uses plain HTTP, so it is off there. **For a self-hosted HTTPS deployment, set `NODE_ENV=production`.**

### Step 2.6: Attach the signed-in user to every request

`server/src/auth/plugin.ts` runs an `onRequest` hook. For every request it reads the session cookie and sets `request.user` to the matching user, or `null`.

The TypeScript declaration merges a new field into Fastify's request type:

```ts
declare module "fastify" {
  interface FastifyRequest { user: AuthUser | null; }
}
```

This is **declaration merging**: it tells TypeScript that every `FastifyRequest` has a `user` property, so route code gets autocomplete and type checking.

`requireUser` is a **preHandler** that returns `401` when `request.user` is null. Routes that need a signed-in user add it to their options.

### Step 2.7: Write the auth routes

`server/src/routes/auth.ts` provides:

| Method and path | Purpose | Success | Failure |
|---|---|---|---|
| `POST /api/auth/register` | Create account, sign in | `201` | `409` if email exists, `400` if invalid |
| `POST /api/auth/login` | Sign in | `200` | `401` (same message for bad email or password) |
| `POST /api/auth/logout` | Delete session, clear cookie | `204` | |
| `GET /api/auth/me` | Current user | `200` | `401` |

Each route validates its body with the shared Zod schema (`RegisterInputSchema`, `LoginInputSchema`) before doing anything else.

**The login error is deliberately vague.** Returning "no such email" would let attackers discover which emails have accounts.

### Step 2.8: Write the world routes

`server/src/routes/worlds.ts` provides `GET /`, `POST /`, `GET /:id`, and `PATCH /:id`. All of them run `requireUser`, and every query filters by `ownerId`. A user asking for another user's world gets `404`, not `403`, so the existence of that world isn't revealed.

Phase 5 (sharing) will change these ownership checks, so keep them in one place.

### Step 2.9: Add the shared schemas for worlds and auth

`shared/src/schemas.ts` now contains the request and response shapes for auth and worlds: `EmailSchema`, `RegisterInputSchema`, `LoginInputSchema`, `UserSchema`, `CreateWorldInputSchema`, `UpdateWorldInputSchema`, `WorldSchema`, `ApiErrorSchema`. Both sides use them, so the API contract lives in one file.

Remember to rebuild `shared` after changing it (`npm run build -w shared`, or run any root script that does it for you).

### Step 2.10: Test the server

`server/src/app.test.ts` runs 12 tests with Vitest:

- Health check.
- Register, login, `/me`, and logout.
- World create, list, read, update.
- Users cannot see each other's worlds.
- Invalid input returns `400`.

The tests use an **in-memory SQLite database** (`:memory:`) via `createDb(":memory:")`, so they are fast and leave nothing on disk. `buildApp()` also runs in memory, so no port is opened.

Run them with:

```bash
npm test
```

### Step 2.11: Build the client

**API helper.** `client/src/api.ts` wraps `fetch`. It:

- Sends JSON and includes cookies.
- Validates the response with a Zod schema, so bad data fails loudly.
- Throws an `ApiError` carrying the HTTP status for non-2xx responses.
- Returns `undefined` for `204 No Content`.

**Query hooks.** These sit on top of TanStack Query.

- `client/src/auth/hooks.ts`: `useCurrentUser` (a query for `/me`; `null` on `401`), `useLogin`, `useRegister`, and `useLogout` (mutations). Logout clears cached world data so the next account on the same browser never sees it.
- `client/src/worlds/hooks.ts`: `useWorlds`, `useWorld` (queries), `useCreateWorld`, `useUpdateWorld` (mutations). Mutations invalidate the matching query so the UI refreshes.

**Queries vs mutations:** a query reads data and is cached. A mutation changes data and usually triggers a cache refresh.

**Pages.** `client/src/pages/AuthPages.tsx` has login and register forms. `client/src/pages/WorldPages.tsx` has the world list with a create form, and a world page with view and edit modes.

### Step 2.12: Set up routing

**What is React Router?** The library that maps URLs to components. In v7 and later the package is imported from `react-router`.

`client/src/router.tsx` uses `createBrowserRouter` with a route tree:

- A top-level `Layout` wraps every page (top bar and sign-out button).
- `/login` and `/register` are public.
- A pathless route with `RequireAuth` wraps `/` and `/worlds/:worldId`. If the user is not signed in, `RequireAuth` returns `<Navigate to="/login" />`.

`client/src/App.tsx` renders `<RouterProvider router={router} />`.

**Why a pathless route for auth?** It groups protected pages under one guard without adding a URL segment.

### Step 2.13: Verify Phase 2

Phase 2 was complete when all of these passed:

1. `npm run typecheck`: clean.
2. `npm test`: 12 passing.
3. `npm run build`: client and server build.
4. `npm run db:generate -w @loregarden/server`: reports "No schema changes".
5. A browser check on `http://localhost:5173`:
   - Signed out, `/` redirects to `/login`.
   - Register lands on the world list.
   - Create a world, open it, edit the name, and see it saved.
   - Sign out returns to `/login`, and signing in again works.
6. With curl, after logout the old cookie returns `401` from `/api/auth/me`.

To run the app locally:

```bash
DATABASE_PATH=./data/dev.sqlite npm run dev
```

Then open `http://localhost:5173`. The API runs on port 3000, and Vite proxies `/api` to it.

---

## Part 3: Things that tripped us up

These are worth knowing before you hit them yourself.

- **"Cannot find module @loregarden/shared".** `shared` hasn't been built. Run `npm run build -w shared`, or use a root script, which builds it first.
- **Schema changed but the app still behaves the old way.** Run `npm run db:generate -w @loregarden/server`, then restart the server. Migrations run at startup.
- **Using the wrong workspace name.** npm workspace commands need the package name, not the folder. `npm run db:generate -w server` fails. Use `-w @loregarden/server`.
- **A stray file breaks tests.** An empty `vitest.config.ts` in `server/` made Vitest fail. Remove stray config files.
- **Overwriting existing files.** When creating files, check whether they already exist first. Editing an existing file is safer than recreating it.
- **Cookies don't stick in production.** Behind HTTPS, set `NODE_ENV=production` so cookies are marked `secure`.
- **Stale dev servers.** Use `ps` to find the PIDs of old `tsx`/`vite` processes and stop them before starting new ones, or the new server fails to bind.

---

## Part 4: Known open items

- **npm audit:** 8 advisories (2 critical, 1 high, 5 moderate). Most are in test and dev tooling (vitest, tinypool, esbuild via drizzle-kit). The zod advisory affects runtime validation. Do **not** run `npm audit fix --force` blindly: it proposes downgrading drizzle-kit.
- **Git:** the project is not yet a git repository. Initialise one and commit after each phase.
- **Docker:** deliberately deferred. The app already runs with plain Node, so Docker can wrap it later.

---

## Part 5: Coming next

**Phase 3: entries with TipTap.** Add an `entries` table, a world page with a list of entries, an entry editor using TipTap (stored as JSON with a schema version), and image embeds by URL. Each phase follows the same loop: schema, migration, shared schema, server route, tests, client hook, page, verify.
