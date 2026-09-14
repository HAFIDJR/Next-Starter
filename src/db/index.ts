import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Two drivers behind one `db` object:
 *
 * - `postgres` (default) — `pg` + `DATABASE_URL`, what production uses.
 * - `pglite` — `DB_DRIVER=pglite` runs Postgres in-process so the app (and this
 *   repo's live preview) works without a database server. `node
 *   scripts/prepare-pglite.mjs` applies `drizzle/*.sql` to the same data dir;
 *   this module stays side-effect free.
 *
 * Nothing else in the app knows which one is active.
 */
const usePglite = process.env.DB_DRIVER === "pglite";

const pgliteDataDir = process.env.PGLITE_DATA_DIR ?? "./.pgdata";

type AppDatabase = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDatabase?: AppDatabase;
};

function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  // Reusing one pool across hot reloads keeps the connection count flat in dev.
  globalForDb.__arenaNextJsPostgresqlPool ??= new Pool({
    connectionString: databaseUrl,
  });

  return globalForDb.__arenaNextJsPostgresqlPool;
}

export const pool = usePglite ? undefined : getPool();

function createDatabase(): AppDatabase {
  if (usePglite) {
    if (process.env.NODE_ENV === "production") {
      // Warn, don't throw: `next build` runs with NODE_ENV=production and imports
      // this module while collecting page data, so throwing would break the build
      // for anyone who left DB_DRIVER set. PGlite is an in-process WASM Postgres and
      // is not usable in a bundled server; unset DB_DRIVER for real deploys.
      console.warn(
        "[db] DB_DRIVER=pglite is a dev-only mode; use pg + DATABASE_URL in production.",
      );
    }

    // Required lazily, on single lines, so the pglite package never loads in
    // production and the disable comments stay attached to the right statement.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");

    const client = new PGlite({ dataDir: pgliteDataDir });

    // Same SQL dialect and same query builder; only the transport differs.
    return drizzle(client, { schema }) as unknown as AppDatabase;
  }

  return drizzleNodePg(getPool(), { schema });
}

export const db: AppDatabase =
  process.env.NODE_ENV === "production"
    ? createDatabase()
    : (globalForDb.__arenaNextJsDatabase ??= createDatabase());
