# Taskly

A private task manager on the Next.js App Router: Server Components for reads, JSON
route handlers for writes, Drizzle + PostgreSQL for storage, and one Zod schema shared
by both sides of the wire.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### No Postgres handy?

```bash
npm run dev:pglite
```

That applies `drizzle/*.sql` to a local, in-process Postgres
([PGlite](https://pglite.dev)) under `.pgdata/` and starts the dev server against it.
It is a dev convenience only — `src/db/index.ts` picks the driver from `DB_DRIVER`, and
production keeps using `pg` + `DATABASE_URL`. Left on in a production build it logs a
warning — the in-process WASM instance is not something `next start` should be asked to
run.

## Environment

| Variable          | Required  | Meaning                                                        |
| ----------------- | --------- | -------------------------------------------------------------- |
| `DATABASE_URL`    | `pg` mode | Postgres connection string.                                     |
| `DB_DRIVER`       | no        | `postgres` (default) or `pglite`.                               |
| `PGLITE_DATA_DIR` | no        | Where the pglite dev cluster lives. Defaults to `./.pgdata`.    |

Schema changes: edit `src/db/schema.ts`, then `npx drizzle-kit generate` and apply with
`npx drizzle-kit push` (or re-run `node scripts/prepare-pglite.mjs` in pglite mode).

## Features

**Search and filters live in the URL.** `/`, `/?filter=overdue`, `/?q=printer&filter=today`,
`/?trash=1` — the query string is the single source of truth, so a filtered view is
shareable, survives reload, and works with the back button. `GET /api/tasks` accepts the
same parameters. Search hits titles *and* notes, case-insensitively, with `%`/`_` escaped
so a term like `100%` is literal. `/` focuses the field, `Esc` clears it.

**Natural-language due dates.** `pay rent friday 9am`, `email the client tomorrow`,
`ship in 3d`, `file taxes 20/9 at 8am`, `standup tonight` all parse. The parser is one
pure module (`src/features/tasks/due-date.ts`) used twice: on the client for the live
preview under the input, and on the server as the authoritative parse. Dates without a
time are stored at 23:59 *in the viewer's zone*, so they are not instantly overdue; day
boundaries for "today"/"overdue" are computed in that same zone.

**Markdown notes per task.** Edited on the task page with an edit/preview toggle,
rendered by a small renderer (`src/lib/markdown.tsx`) that builds React elements instead
of emitting HTML — no sanitizer dependency, and `javascript:` links are demoted to text.
Lists show a stripped single-line preview.

**Theme and density, with no flash.** One non-httpOnly cookie (`taskly_prefs`) holds
`{ theme, density, timeZone }`. The server reads it to render `<html class="dark">` and
`data-density`, and a ~1 kB inline script in `<head>` re-applies it (including
`prefers-color-scheme`) before paint. Every color and spacing value in the UI comes from
CSS custom properties, so the theme is a token swap rather than a pile of `dark:`
variants. The cookie also carries the browser's IANA zone, which is what lets the server
answer "what is due today?" correctly — it is a display hint, never an authorization
input.

**Delete is undoable.** `DELETE /api/tasks/:id` sets `deleted_at`; a toast with an 8-second
undo appears, `POST /api/tasks/:id/restore` brings the row back, `?trash=1` lists them,
and `?permanent=1` really deletes. Rows older than 30 days are purged from an `after()`
callback in the delete handler, so cleanup never delays a response.

## API

| Method   | Path                        | Notes                                            |
| -------- | --------------------------- | ------------------------------------------------ |
| `GET`    | `/api/tasks`                | `?q=`, `?filter=all\|active\|completed\|today\|overdue`, `?trash=1` |
| `POST`   | `/api/tasks`                | `{ draft }` (parsed) or `{ title }`, plus `notes`, `dueAt`, `completed` |
| `PATCH`  | `/api/tasks/:id`            | any subset of the above; `notes: ""` and `dueAt: null` clear fields |
| `DELETE` | `/api/tasks/:id`            | soft delete; `?permanent=1` to remove the row     |
| `POST`   | `/api/tasks/:id/restore`    | only succeeds for trashed rows                    |

Every route checks the session itself — `proxy.ts` is a convenience guard, not the
security boundary. Errors come back as `{ error, fieldErrors }`, which the client reads
through `src/lib/api-client.ts`.
