# AI Lore

A small project I started to experiment with AI agent driven development. It's definitely a work in progress and a study tool more than a finished app at this point

A worldbuilding app for TTRPG players and Game Masters to create and manage lore.

## Structure

- `client/` - React + Vite + TypeScript frontend
- `server/` - Fastify API
- `shared/` - Zod schemas and types shared by client and server

## Development

Requires Node.js 22+.

```sh
npm install
npm run dev        # server on http://127.0.0.1:3000, client on http://localhost:5173
npm test           # server tests
npm run typecheck  # typecheck all packages
npm run build      # production build of all packages
```

The Vite dev server proxies `/api` requests to the API server.

## Configuration

- `PORT` / `HOST`: API bind address (default `3000` / `127.0.0.1`)
- `DATABASE_PATH`: SQLite file (default `data/loregarden.sqlite`). Migrations in `server/drizzle/` run automatically on startup.
- Schema changes: edit `server/src/db/schema.ts`, then run `npm run db:generate -w @loregarden/server`.
