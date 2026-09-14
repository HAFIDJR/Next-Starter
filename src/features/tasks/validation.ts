import { z } from "zod";

import { TASK_FILTERS, type TaskListFilters } from "./types";

export const TASK_TITLE_MAX_LENGTH = 120;
export const TASK_NOTES_MAX_LENGTH = 4000;
export const TASK_SEARCH_MAX_LENGTH = 80;

export const taskTitleSchema = z
  .string("Task title is required.")
  .trim()
  .min(1, "Task title is required.")
  .max(
    TASK_TITLE_MAX_LENGTH,
    `Task title must be ${TASK_TITLE_MAX_LENGTH} characters or fewer.`,
  );

/** Notes are stored as Markdown; the empty string clears them. */
export const taskNotesSchema = z
  .string("Notes must be text.")
  .trim()
  .max(
    TASK_NOTES_MAX_LENGTH,
    `Notes must be ${TASK_NOTES_MAX_LENGTH} characters or fewer.`,
  )
  .transform((notes) => (notes.length > 0 ? notes : null));

/**
 * Accepts any absolute timestamp the DB can round-trip (`datetime-local` values
 * are converted to ISO on the client), and normalizes to `null` for "no due date".
 */
export const taskDueAtSchema = z
  .string("Due date must be a valid date or time.")
  .trim()
  .refine(
    (value) => value.length > 0 && !Number.isNaN(Date.parse(value)),
    "Due date must be a valid date or time.",
  )
  .transform((value) => new Date(value))
  .nullable();

/** Raw add-form text: "fix printer friday 9am" → parsed into title + dueAt. */
export const taskDraftSchema = z
  .string("Task title is required.")
  .trim()
  .min(1, "Task title is required.")
  .max(
    TASK_TITLE_MAX_LENGTH + 40,
    `Task title must be ${TASK_TITLE_MAX_LENGTH} characters or fewer.`,
  );

export const createTaskSchema = z
  .object({
    title: taskTitleSchema.optional(),
    draft: taskDraftSchema.optional(),
    notes: taskNotesSchema.optional(),
    dueAt: taskDueAtSchema.optional(),
    completed: z.boolean("Completed must be true or false.").optional(),
  })
  .refine((task) => task.title !== undefined || task.draft !== undefined, {
    message: "A task needs a title.",
    path: ["title"],
  });

export const updateTaskSchema = z
  .object({
    title: taskTitleSchema.optional(),
    draft: taskDraftSchema.optional(),
    notes: taskNotesSchema.optional(),
    dueAt: taskDueAtSchema.optional(),
    completed: z.boolean("Completed must be true or false.").optional(),
  })
  .refine(
    (task) =>
      task.title !== undefined ||
      task.draft !== undefined ||
      task.notes !== undefined ||
      task.dueAt !== undefined ||
      task.completed !== undefined,
    "Provide at least one field to update.",
  );

export const taskIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Task id must be a positive integer.")
  .transform(Number);

export const taskListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(TASK_SEARCH_MAX_LENGTH, `Search must be ${TASK_SEARCH_MAX_LENGTH} characters or fewer.`)
    .optional(),
  filter: z.enum(TASK_FILTERS).optional(),
  trash: z
    .enum(["1", "true", "yes"])
    .optional(),
});

function lastValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[value.length - 1];
  }

  return value;
}

/**
 * URL search params are the single source of truth for search + filters, so this
 * is the only place that decides what a malformed value means (fall back, never throw).
 */
export function parseTaskListQuery(
  input: Record<string, string | string[] | undefined>,
): TaskListFilters {
  const result = taskListQuerySchema.safeParse({
    q: lastValue(input.q) || undefined,
    filter: lastValue(input.filter) || undefined,
    trash: lastValue(input.trash) || undefined,
  });

  if (!result.success) {
    return { q: "", filter: "all", trash: false };
  }

  return {
    q: result.data.q ?? "",
    filter: result.data.filter ?? "all",
    trash: result.data.trash !== undefined,
  };
}

/** Inverse of `parseTaskListQuery`, used by the client to build a URL. Defaults are omitted so `/` stays `/`. */
export function buildTaskListQuery(filters: TaskListFilters): string {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.filter !== "all") {
    params.set("filter", filters.filter);
  }

  if (filters.trash) {
    params.set("trash", "1");
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

export function parseTaskId(value: string): number | null {
  const result = taskIdSchema.safeParse(value);

  return result.success ? result.data : null;
}

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
