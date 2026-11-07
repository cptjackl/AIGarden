import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildApp } from "./app.js";
import { createDb } from "./db/client.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const databasePath = process.env.DATABASE_PATH ?? "data/loregarden.sqlite";

mkdirSync(dirname(databasePath), { recursive: true });
const db = createDb(databasePath);
const app = await buildApp({ db, logger: true });

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
