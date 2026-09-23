# Taskly

A small, private task manager. One account, one list, no shared boards.

Built on the App Router with reads in Server Components and writes through JSON route
handlers — the client never imports database code. Postgres is accessed with Drizzle,
and one Zod schema per feature is shared by the browser and the server so validation
rules can't drift apart.

| | |
| --- | --- |
| Runtime | Next.js `16.3.4`, React `19.2.8`, App Router, `src/` directory |
| Data | `drizzle-orm ^0.45.2` + `pg ^8.23.0`, on any supported Postgres (nothing beyond `timestamptz` and `ILIKE`) |
| Validation | `zod ^4.5.4` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`, no `tailwind.config`), CSS custom properties |
| Language | TypeScript strict, alias `@/*` |
| Lint | `eslint 9` + `eslint-config-next` (`next lint` was removed in Next 16 — the `lint` script calls `eslint` directly) |

## Quick start

```bash
npm install
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/taskly
npm run dev
```

Then open <http://localhost:3000>, register an account, and you're in. There is no
`.env.example` to copy — `DATABASE_URL` is the only variable the app reads, and
`src/db/index.ts` throws at first use if it is missing in `pg` mode.

### Without a Postgres server

```bash
npm run dev:pglite
```

Applies every `drizzle/*.sql` to an in-process [PGlite](https://pglite.dev) cluster under
`.pgdata/` (gitignored) and starts the dev server against it. Nothing else in the app
knows about it: `src/db/index.ts` picks a driver from `DB_DRIVER`. Dev-only — a bundled
`next start` logs a warning if you leave `DB_DRIVER=pglite` set, and
`scripts/prepare-pglite.mjs` + that branch are all you need to delete if you'd rather not
carry it.

## Configuration

| Variable | Used by | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `src/db/index.ts` | Postgres connection string. Required unless `DB_DRIVER=pglite`. |
| `DB_DRIVER` | `src/db/index.ts` | `postgres` (default) or `pglite`. |
| `PGLITE_DATA_DIR` | `src/db/index.ts`, `scripts/prepare-pglite.mjs` | Where the pglite cluster lives. Defaults to `./.pgdata`. |
| `NODE_ENV` | `src/features/auth/session.ts` | `production` makes the session cookie `secure`. |

`drizzle.config.json` holds its own local URL for `drizzle-kit` only — the app never reads
it, so point it at whichever database you run `db:push` / `db:migrate` against.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | `next dev` (Turbopack) |
| `npm run dev:pglite` | prepare the pglite cluster, then `next dev` against it |
| `npm run build` | `next build` |
| `npm start` | `next start` |
| `npm run lint` | `eslint` |
| `npm run db:prepare:pglite` | apply `drizzle/*.sql` to `.pgdata` without starting the server |
| `npx drizzle-kit generate` / `push` | migrations from `src/db/schema.ts` (not wired as npm scripts) |

## Layout

```
app/                        routing only — components and data live in src/
  page.tsx                  the task list; reads searchParams, renders TaskManager
  layout.tsx                <html> attributes for theme/density, the no-flash script
  globals.css               tokens (@theme inline), density rules, prose styles
  about/ login/ register/   public pages
  tasks/[id]/               detail page + loading.tsx + not-found.tsx
  api/
    auth/{login,register,logout}/route.ts
    tasks/route.ts          GET (list, filters in the query string) + POST
    tasks/[id]/route.ts     GET · PATCH · DELETE (?permanent=1)
    tasks/[id]/restore/route.ts
    health/route.ts         select 1, for deploys
components/                 client components used by app/ (TaskManager, TaskItem, …)
proxy.ts                    Next 16's middleware file: security headers + a cheap
                            cookie check that answers 401 for API routes
src/
  db/                       schema.ts (drizzle tables), index.ts (driver choice)
  features/
    auth/                   password hashing, sessions, requireCurrentUser, zod rules
    tasks/                  service (all queries), validation (all schemas), due-date.ts,
                            types.ts (DTO + filter types), constants.ts
    preferences/            the theme/density/timezone cookie: read, apply, script
  lib/                      api-errors (response helpers), api-client (fetch + errors),
                            service-errors, markdown.tsx, timezone.ts
scripts/prepare-pglite.mjs  dev-only migration runner for the pglite cluster
drizzle/                    generated SQL migrations + meta/ snapshots
```

Every route in the app is dynamic (`ƒ` in the `next build` output): pages read cookies, and
the data routes say `export const dynamic = "force-dynamic"`.

## Conventions

Adding a feature means following the shape that's already there:

- **`src/features/<name>/`** holds the service, the Zod schemas, the types and the
  constants for that feature. `app/` files stay thin: parse input, call one service
  function, map to a DTO.
- **Service functions are user-scoped and named `…ForUser`** (`listTasksForUser`,
  `updateTaskForUser`, `countTrashForUser`). `userId` is always an argument, never
  trusted from the request body, and ownership is the *first* condition in every query.
- **One schema, two consumers.** `src/features/tasks/validation.ts` is imported by the
  route handlers *and* by client components, so the browser's rules are the server's
  rules. `parseTaskListQuery` / `buildTaskListQuery` are the same idea for the URL.
- **Errors are data, not strings.** Services throw `InputRejectedError`
  (`src/lib/service-errors.ts`); routes translate it with the helpers in
  `src/lib/api-errors.ts` (`badRequestResponse`, `notFoundResponse`,
  `validationErrorResponse`, …) into `{ error, fieldErrors }`; the client reads that
  shape through `ApiError` in `src/lib/api-client.ts`.
- **`cache()` for per-request reads.** `getCurrentUser` and `getPreferences` are wrapped,
  so a page and its children hit the database once.
- **Client state is optimistic, then refreshed.** Mutations update local state, call
  `router.refresh()`, and adopt the server snapshot once nothing is in flight. The
  signature is `id:updatedAt`, which is what `updatedAt` on the table is for.
- **Alias gotcha:** `@/*` maps to the **repository root**, not to `src/`. So
  `@/src/lib/markdown` and `@/components/TaskItem` are correct, and `@/lib/markdown`
  resolves to nothing.

## Data model

`src/db/schema.ts`, table names in backticks:

| Table | Columns |
| --- | --- |
| `users` | `id`, `email` (unique), `password_hash`, `created_at` |
| `sessions` | `id`, `user_id → users` (cascade), `token_hash` (unique), `expires_at`, `created_at`, indexed on `user_id` and `expires_at` |
| `task` | `id`, `user_id → users` (nullable, cascade), `title`, `notes`, `due_at`, `completed`, `deleted_at`, `created_at`, `updated_at`, indexed on `(user_id, created_at)`, `(user_id, deleted_at)`, `(user_id, due_at)` |

`task.userId` is nullable — a leftover from the pre-auth version of the app, where rows
existed without an owner. Every read and write still filters on it, so a `NULL` row is
unreachable rather than public. Timestamps are `withTimezone`; `updated_at` is written by
drizzle via `$onUpdate`.

Migration history, in order: `0000` created the `task` table (before there were accounts),
`0001` added `users` + `sessions` and retro-fitted `user_id` and its foreign key onto
`task`, `0002` added `notes`, `due_at`, `deleted_at`, `updated_at` and two indexes. That
history is why `task.userId` is still nullable. Regenerate with
`npx drizzle-kit generate` after editing the schema, then `npx drizzle-kit push`.

## HTTP API

Auth — `app/api/auth/*`:

| Method | Path | Behaviour |
| --- | --- | --- |
| `POST` | `/api/auth/register` | `{ email, password }` → `201 { user }` + session cookie; `409` if the email is taken; `400` with `fieldErrors` |
| `POST` | `/api/auth/login` | → `200 { user }` + session cookie; `401` on bad credentials |
| `POST` | `/api/auth/logout` | clears the cookie and the session row → `{ ok: true }` |

Tasks — all four check the session themselves:

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/tasks` | bare array of `TaskDto`; `?q=` (matches title **and** notes), `?filter=all\|active\|completed\|today\|overdue`, `?trash=1` |
| `POST` | `/api/tasks` | `{ draft }` (parsed for a due date) **or** `{ title }`, plus `notes?`, `dueAt?`, `completed?` → `201` |
| `GET` | `/api/tasks/:id` | live rows only; a trashed id is a `404` |
| `PATCH` | `/api/tasks/:id` | any subset of the above; `notes: ""` and `dueAt: null` clear; trashed rows `404`; empty body `400` |
| `DELETE` | `/api/tasks/:id` | soft delete → `200`; `?permanent=1` removes the row (refused unless it is already trashed) |
| `POST` | `/api/tasks/:id/restore` | only succeeds for trashed rows, otherwise `404` |

Limits (`src/features/tasks/validation.ts`): title 120 chars, notes 4000, search term 80
(`draft` gets 160 so the date phrase can be stripped without truncating the title). A
request body with unknown keys is accepted; `updateTaskSchema` requires at least one key.

## Authentication

- Passwords: `scrypt` with a random 16-byte base64url salt and a 64-byte key, stored as
  `scrypt$<salt>$<base64 hash>`; verification uses `timingSafeEqual`
  (`src/features/auth/password.ts`).
- Sessions: a `randomBytes(32)` base64url token, sent to the browser and **stored only as
  its SHA-256 hex digest** in `sessions.token_hash`, with `expires_at` 7 days out. The
  cookie is `taskly_session`, `httpOnly`, `sameSite=lax`, `path=/`, `secure` in production.
- Pages call `requireCurrentUser()`, which `redirect("/login")`s. Route handlers call
  `getCurrentUser()` and answer `401`. `proxy.ts` only short-circuits API requests that
  carry no session cookie at all — it is a cheap filter, not the security boundary.
- `createSession` deletes **every** expired session row before inserting — not just the
  caller's — so expired rows never accumulate and there is no cleanup job to remember. The
  delete and the insert are two separate statements, not a transaction.
- Registration also signs you in: `POST /api/auth/register` inserts the user (via
  `on conflict do nothing`, which is how a duplicate email becomes a `409`), then creates
  a session and attaches the cookie in the same response. Those are two round trips, not
  one transaction, so a failed session insert would leave an account with no cookie —
  worth wrapping if that ever matters.

## Feature notes

### Search and filters live in the URL

`/?q=&filter=&trash=1` is the whole state; there is no mirror in React. Views are
shareable, survive reload, and work with Back. Search escapes `%` and `_` before the
`ILIKE`, so `100%` is a literal. Unknown `filter` values fall back to `all`. `/` focuses
the field, `Esc` clears it.

### Due dates

`src/features/tasks/due-date.ts` is a pure parser used twice: by `TaskItem` for the live
preview under the input, and by the service as the authority (the client cannot skip it).

| Input | Becomes |
| --- | --- |
| `pay rent friday 9am` | title `pay rent`, due Friday 09:00 in the viewer's zone |
| `email the client tomorrow` / `tmrw` / `next week` | tomorrow 23:59 / +7 days 23:59 |
| `standup today 9pm`, `tonight`, `noon`, `midnight`, `at 9:30pm`, `@18:30` | same day, that clock time |
| `ship in 3d`, `in 5 hours`, `in two days` | now + offset |
| `file taxes 20/9`, `2026-09-20`, `20 sep`, `sep 20` | that date at 23:59 |
| `read a book` | unchanged, `dueAt: null` |

Rules worth knowing: a date with **no clock time is stored at 23:59 in the viewer's
zone**, so "today" isn't instantly overdue; the matched phrase is stripped from the title
(a trailing `due`/`by`/`for`/`on`/`at` goes with it); if stripping would leave the title
empty the input is returned untouched as the title; labels come from `describeDue()`
(`Today`, `Tomorrow`, `3 days overdue`, `Fri`, `Oct 2`, `Oct 2 2027` across years, plus
`· 09:00` when a time was given) and are computed from a single `now` prop so no two rows
disagree at midnight. Zone arithmetic is `Intl`-only (`src/lib/timezone.ts`) — no
`date-fns-tz` — and day boundaries are found by stepping the calendar and reading the
offset back, so no fixed DST assumption.

### Notes

Markdown subset rendered by `src/lib/markdown.tsx`: `#`–`###` headings (as styled `<p>`,
so note headings never fight the page's outline), `-`/`1.` lists, `>` quotes, fenced code,
`---` rules, `**bold**`, `_italic_`, `~~strike~~`, `` `code` ``, `[label](https://…)`.

It parses into React elements rather than an HTML string — no `dangerouslySetInnerHTML`,
no sanitizer dependency, and `<script>` in a note renders as literal text. `javascript:`
and `data:` links are demoted to inert text; real links get `rel="noopener noreferrer
nofollow"`. Keys are index-derived so the server tree and the client tree match (no
hydration churn). Task rows show `stripMarkdown()` text as a one-line preview.

### Theme, density, timezone

One non-httpOnly cookie, `taskly_prefs`, holds `{ theme, density, timeZone }`
(`src/features/preferences/`).

- Server side: `getPreferences()` (cached per request) decides `<html class="dark">` and
  `data-density`, and the zone used for `today`/`overdue` and every date label.
- Client side: a ~2 kB inline script in `<head>` re-applies the value — and
  `prefers-color-scheme` when the theme is `system` — before first paint, then records
  `Intl.DateTimeFormat().resolvedOptions().timeZone` for the *next* request. That's the
  whole zero-flash trick; `suppressHydrationWarning` covers the one attribute that may
  legitimately differ.
- The cookie is untrusted input: Zod with a `.catch()` per key against the default, so one
  bad key never replaces the object and a hand-written value can't inject a class.

Colour and spacing come from custom properties in `app/globals.css`, re-exported to
Tailwind through `@theme inline`: `canvas`, `surface`, `surface-raised`, `sunken`, `line`,
`line-soft`, `line-strong`, `ink`, `muted`, `faint`, `accent`, `accent-soft`,
`accent-contrast`, `danger`, `danger-soft`, `success`, `success-soft`, `warning`,
`warning-soft`, plus the rhythm variables `--row-pad-y/-x`, `--row-gap`, `--row-font`,
`--list-gap`, `--chip-pad-y/-x`; `html[data-density="compact"]` overrides all seven (row
padding 0.75rem → 0.375rem, font 0.875rem → 0.8125rem), so density is one attribute on
`<html>` rather than a class on every row. Dark mode is a token swap,
which is why there is no `dark:` sprinkled through the components.

### Trash

`DELETE` sets `deleted_at`. A toast offers undo for 8s (`UNDO_TOAST_DURATION_MS`; hover or
focus pauses it, and the CSS countdown pauses with it) which calls the restore endpoint —
so an ignored toast is a decision to keep the deletion. `?trash=1` lists what's waiting,
with Restore and Delete forever. `purgeExpiredTrash()` deletes rows older than
`TRASH_RETENTION_DAYS` (30) from an `after()` callback inside the DELETE handler, so
cleanup never delays a response and its own errors are swallowed — nothing awaits it.

## Status of the code

Nothing here is a demo stub: sign-up, sessions, listing, editing, trash and the four
filters all work end to end. Verified with `npx tsc --noEmit`, `npx eslint .`,
`npx next build`, 70 end-to-end HTTP assertions against a running dev server (including
cross-account isolation and hostile-cookie input) and 58 unit assertions over the date
parser and the Markdown renderer.

There is **no test runner configured** — those checks were driven from throwaway scripts.
If you want them kept, `npm i -D vitest` and move `parseDueText` / `renderMarkdown`
assertions into `src/**/*.test.ts`; both are already pure, so they need no harness.

## Known quirks

Deliberate or minor, but they will bite a newcomer:

- `src/features/auth/constansts.ts` is misspelled (three importers). Rename it when you
  next touch auth.
- `proxy.ts` builds `loginUrl` with a `?next=` deep link and then returns
  `NextResponse.next()`, so the redirect actually happens in `requireCurrentUser()` and
  the `next` param is dropped. Doing the redirect in `proxy.ts` would restore it — and
  also restore real `307`/`404` statuses on `/tasks/[id]`, which currently answer `200`
  with the not-found UI because `app/tasks/[id]/loading.tsx` commits the status before
  `notFound()` runs (the 404 travels in the RSC payload).
- No `error.tsx`, `global-error.tsx` or root `not-found.tsx`; a thrown render error shows
  Next's default screen. `typedRoutes` is off, so `Link` hrefs are untyped strings.
- `src/features/tasks/types.ts` (plural, DTO + filters) coexists with
  `src/features/auth/type.ts` (singular, matching that feature's own naming).
- The 7-day session lifetime is written twice — `SESSION_MAX_AGE_SECONDS` in
  `src/features/auth/constansts.ts` (the cookie) and `SESSION_LIFETIME_MS` in
  `src/features/auth/service.ts` (the row). They agree today; if only one changes, the
  cookie outlives its row and the user is silently logged out mid-session. Derive both
  from the constant in `constansts.ts` when you next touch auth.
- `.pgdata` and `.next` are gitignored; `AGENTS.md`'s fenced block is written and re-added
  by `next dev` and is meant to be committed with your work.

## Ideas not built yet

Lists/projects and drag-to-reorder, subtasks, a Today/Upcoming/Anytime view, labels,
weekly completion stats, `⌘K` quick capture, and email verification / password reset /
magic links. Realtime sync (SSE) and multi-workspace roles would each want their own
design pass.
