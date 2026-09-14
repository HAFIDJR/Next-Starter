import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/src/db";
import { tasks, type Task } from "@/src/db/schema";
import { zonedDayRange } from "@/src/lib/timezone";
import { InputRejectedError } from "@/src/lib/service-errors";

import { TRASH_RETENTION_DAYS } from "./constants";
import { parseDueText } from "./due-date";
import {
  DEFAULT_TASK_LIST_FILTERS,
  type TaskDto,
  type TaskListFilters,
} from "./types";
import {
  TASK_TITLE_MAX_LENGTH,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "./validation";

type WriteContext = {
  /** Viewer's zone: what makes "friday" and "today" mean the same thing here as in the browser. */
  timeZone: string;
  now?: Date;
};

function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    dueAt: task.dueAt,
    completed: task.completed,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/** `%` and `_` are wildcards; a search for `100%` must not become "starts with 100". */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function containsTerm(term: string) {
  const pattern = `%${escapeLikeTerm(term)}%`;

  return or(ilike(tasks.title, pattern), ilike(tasks.notes, pattern));
}

function ilike(column: typeof tasks.title | typeof tasks.notes, pattern: string) {
  // Drizzle has no `ilike` helper for nullable text columns, and a plain
  // `like` would be case-sensitive, so this stays close to the metal.
  return sql`${column}::text ILIKE ${pattern}`;
}

function filterCondition(filters: TaskListFilters, context: WriteContext, userId: number) {
  const conditions = [
    // Ownership first: every read is scoped to the caller, no matter which view
    // or filter is active. Everything below narrows inside that subset.
    eq(tasks.userId, userId),
    filters.trash ? isNotNull(tasks.deletedAt) : isNull(tasks.deletedAt),
  ];
  const now = context.now ?? new Date();

  if (filters.q) {
    const term = containsTerm(filters.q);

    if (term) {
      conditions.push(term);
    }
  }

  switch (filters.filter) {
    case "active":
      conditions.push(eq(tasks.completed, false));
      break;
    case "completed":
      conditions.push(eq(tasks.completed, true));
      break;
    case "today": {
      const { start, end } = zonedDayRange(now, context.timeZone);

      conditions.push(
        eq(tasks.completed, false),
        gte(tasks.dueAt, new Date(start)),
        lt(tasks.dueAt, new Date(end)),
      );
      break;
    }
    case "overdue":
      conditions.push(
        eq(tasks.completed, false),
        lt(tasks.dueAt, now),
        isNotNull(tasks.dueAt),
      );
      break;
    case "all":
    default:
      break;
  }

  return and(...conditions);
}

function orderByFor(filters: TaskListFilters) {
  // Date-driven views want soonest-first; everything else keeps the existing
  // newest-first behaviour of the app.
  if (filters.filter === "today" || filters.filter === "overdue") {
    return [asc(tasks.dueAt), desc(tasks.createdAt)];
  }

  if (filters.filter === "all" && !filters.trash && filters.q === "") {
    return [desc(tasks.createdAt)];
  }

  return [
    asc(tasks.completed),
    sql`${tasks.dueAt} is null`,
    asc(tasks.dueAt),
    desc(tasks.createdAt),
  ];
}

export async function listTasksForUser(
  userId: number,
  filters: TaskListFilters = DEFAULT_TASK_LIST_FILTERS,
  context: WriteContext,
): Promise<TaskDto[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(filterCondition(filters, context, userId))
    .orderBy(...orderByFor(filters));

  return rows.map(toTaskDto);
}

export async function getTaskForUser(
  id: number,
  userId: number,
  options: { includeDeleted?: boolean } = {},
): Promise<TaskDto | null> {
  const conditions = [eq(tasks.id, id), eq(tasks.userId, userId)];

  if (!options.includeDeleted) {
    conditions.push(isNull(tasks.deletedAt));
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .limit(1);

  return task ? toTaskDto(task) : null;
}

type DraftInput = {
  title?: string;
  draft?: string;
  dueAt?: Date | null;
  notes?: string | null;
  completed?: boolean;
};

/**
 * One place decides how text becomes a task: the API route, the add form and the
 * row editor all agree because they all land here.
 */
function resolveDraft(input: DraftInput, context: WriteContext) {
  const now = context.now ?? new Date();
  let title = input.title;
  let dueAt = input.dueAt;
  let hasTime = false;

  if (input.draft !== undefined) {
    const parsed = parseDueText(input.draft, {
      now,
      timeZone: context.timeZone,
    });

    title = parsed.title;
    hasTime = parsed.hasTime;

    // An explicit dueAt (from the datetime picker) always beats the phrase.
    if (dueAt === undefined) {
      dueAt = parsed.dueAt;
    }
  }

  if (title === undefined) {
    return { title: undefined, dueAt, hasTime };
  }

  if (title.length === 0) {
    throw new InputRejectedError(
      "Task title is required.",
      "title",
    );
  }

  if (title.length > TASK_TITLE_MAX_LENGTH) {
    throw new InputRejectedError(
      `Task title must be ${TASK_TITLE_MAX_LENGTH} characters or fewer.`,
      "title",
    );
  }

  return { title, dueAt, hasTime };
}

export async function createTaskForUser(
  userId: number,
  input: CreateTaskInput,
  context: WriteContext,
): Promise<TaskDto> {
  const { title, dueAt } = resolveDraft(input, context);

  if (title === undefined) {
    throw new InputRejectedError("A task needs a title.", "title");
  }

  const [created] = await db
    .insert(tasks)
    .values({
      userId,
      title,
      notes: input.notes ?? null,
      dueAt: dueAt ?? null,
      completed: input.completed ?? false,
    })
    .returning();

  if (!created) {
    throw new Error("Task could not be created.");
  }

  return toTaskDto(created);
}

export async function updateTaskForUser(
  id: number,
  userId: number,
  input: UpdateTaskInput,
  context: WriteContext,
): Promise<TaskDto | null> {
  const { title, dueAt } = resolveDraft(input, context);

  // Only defined keys are written, so PATCH never nulls out a field by omission.
  const patch: Partial<typeof tasks.$inferInsert> = {};

  if (title !== undefined) {
    patch.title = title;
  }

  if (dueAt !== undefined) {
    patch.dueAt = dueAt;
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  if (input.completed !== undefined) {
    patch.completed = input.completed;
  }

  if (Object.keys(patch).length === 0) {
    return getTaskForUser(id, userId);
  }

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .returning();

  return updated ? toTaskDto(updated) : null;
}

/** Soft delete: the row survives so the undo toast can win it back. */
export async function deleteTaskForUser(
  id: number,
  userId: number,
  now: Date = new Date(),
): Promise<TaskDto | null> {
  const [deleted] = await db
    .update(tasks)
    .set({ deletedAt: now })
    .where(
      and(
        eq(tasks.id, id),
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt),
      ),
    )
    .returning();

  return deleted ? toTaskDto(deleted) : null;
}

export async function restoreTaskForUser(
  id: number,
  userId: number,
): Promise<TaskDto | null> {
  const [restored] = await db
    .update(tasks)
    .set({ deletedAt: null })
    .where(
      and(
        eq(tasks.id, id),
        eq(tasks.userId, userId),
        isNotNull(tasks.deletedAt),
      ),
    )
    .returning();

  return restored ? toTaskDto(restored) : null;
}

/** Permanent delete, only offered from inside the trash view. */
export async function permanentlyDeleteTaskForUser(
  id: number,
  userId: number,
): Promise<TaskDto | null> {
  const [deleted] = await db
    .delete(tasks)
    .where(
      and(
        eq(tasks.id, id),
        eq(tasks.userId, userId),
        isNotNull(tasks.deletedAt),
      ),
    )
    .returning();

  return deleted ? toTaskDto(deleted) : null;
}

/**
 * Maintenance for the trash. Called from `after()` so it never delays a response,
 * and indexed on `(user_id, deleted_at)` so it stays a cheap range scan.
 */
export async function purgeExpiredTrash(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(
    now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const purged = await db
    .delete(tasks)
    .where(lt(tasks.deletedAt, cutoff))
    .returning({ id: tasks.id });

  return purged.length;
}

export async function countTrashForUser(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNotNull(tasks.deletedAt)));

  return row?.count ?? 0;
}
