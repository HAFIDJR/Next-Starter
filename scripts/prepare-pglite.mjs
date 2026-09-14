#!/usr/bin/env node
/**
 * One-shot setup for the `DB_DRIVER=pglite` dev mode: creates the data directory
 * and applies every `drizzle/*.sql` migration in order. Safe to re-run — it skips
 * migrations whose journal row already exists.
 *
 * Not used by the `postgres` driver at all.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const dataDir = resolve(process.env.PGLITE_DATA_DIR ?? "./.pgdata");
const migrationsDir = resolve("drizzle");

const { PGlite } = await import("@electric-sql/pglite");

const client = new PGlite({ dataDir });

async function tableExists(name) {
  const result = await client.query(
    "select 1 from information_schema.tables where table_name = $1 limit 1",
    [name],
  );

  return result.rows.length > 0;
}

// A tiny stand-in for drizzle's __drizzle_migrations table: this file's job is to
// get a scratch database to the current schema, not to replace drizzle-kit.
await client.exec(`
  create table if not exists "__arena_pglite_migrations" (
    "name" text primary key,
    "applied_at" timestamp with time zone not null default now()
  );
`);

const applied = new Set(
  (await client.query("select name from __arena_pglite_migrations")).rows.map(
    (row) => row.name,
  ),
);

const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.warn("[pglite] no migrations found in ./drizzle");
  process.exit(0);
}

let ran = 0;

for (const file of files) {
  if (applied.has(file)) {
    continue;
  }

  const statements = readFileSync(join(migrationsDir, file), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    try {
      await client.exec(statement);
    } catch (error) {
      // Re-running against a schema that already has the column is expected.
      const message = String(error?.message ?? error);

      if (!/already exists|duplicate column/i.test(message)) {
        throw new Error(`${file}: ${message}`, { cause: error });
      }
    }
  }

  await client.query("insert into __arena_pglite_migrations (name) values ($1) on conflict do nothing", [file]);
  ran += 1;
  console.log(`[pglite] applied ${file}`);
}

const users = (await client.query("select count(*)::int as count from users")).rows[0].count;
const hasTasks = await tableExists("task");

console.log(
  `[pglite] ${ran === 0 ? "already up to date" : `${ran} migration(s) applied`} · ` +
    `data dir ${dataDir}${existsSync(dataDir) ? "" : " (created)"} · ${users ?? 0} user(s)`,
);

if (!hasTasks) {
  console.warn("[pglite] warning: the task table is missing after migrations");
}

await client.close();
