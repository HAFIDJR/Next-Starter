import { z } from "zod";

export const TASK_TITLE_MAX_LENGTH = 120;

export const taskTitleSchema = z
  .string("Task title is required.")
  .trim()
  .min(1, "Task title is required.")
  .max(
    TASK_TITLE_MAX_LENGTH,
    `Task title must be ${TASK_TITLE_MAX_LENGTH} characters or fewer.`,
  );

export const createTaskSchema = z
  .object({
    title: taskTitleSchema,
    completed: z.boolean("Completed must be true or false.").optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: taskTitleSchema.optional(),
    completed: z.boolean("Completed must be true or false.").optional(),
  })
  .strict()
  .refine(
    (task) => task.title !== undefined || task.completed !== undefined,
    "Provide a title or completion status to update.",
  );

export const taskIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Task id must be a positive integer.")
  .transform(Number);

export function parseTaskId(value: string): number | null {
  const result = taskIdSchema.safeParse(value);

  return result.success ? result.data : null;
}

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;