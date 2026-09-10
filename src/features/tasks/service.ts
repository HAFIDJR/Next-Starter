import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { tasks, type Task } from "@/src/db/schema";

import type { CreateTaskInput, UpdateTaskInput } from "./validation";

export async function listTasks(): Promise<Task[]> {
  return db.select().from(tasks).orderBy(desc(tasks.createdAt));
}

export async function getTaskById(id: number): Promise<Task | null> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);

  return task ?? null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const [created] = await db
    .insert(tasks)
    .values({
      title: input.title,
      completed: input.completed ?? false,
    })
    .returning();

  if (!created) {
    throw new Error("Task could not be created.");
  }

  return created;
}

export async function updateTask(
  id: number,
  input: UpdateTaskInput,
): Promise<Task | null> {
  const [updated] = await db
    .update(tasks)
    .set(input)
    .where(eq(tasks.id, id))
    .returning();

  return updated ?? null;
}

export async function deleteTask(id: number): Promise<Task | null> {
  const [deleted] = await db
    .delete(tasks)
    .where(eq(tasks.id, id))
    .returning();

  return deleted ?? null;
}
