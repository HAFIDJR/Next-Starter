import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { tasks, type Task } from "@/src/db/schema";

import type { TaskDto } from "./types";
import type { CreateTaskInput, UpdateTaskInput } from "./validation";

function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    completed: task.completed,
    createdAt: task.createdAt,
  };
}

export async function listTasksForUser(userId: number): Promise<TaskDto[]> {
  const userTaks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.createdAt));
  return userTaks.map(toTaskDto);
}

export async function getTaskForUser(
  id: number,
  userId: number,
): Promise<TaskDto | null> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);

  return task ? toTaskDto(task) : null;
}

export async function createTaskForUser(
  userId: number,
  input: CreateTaskInput,
): Promise<TaskDto> {
  const [created] = await db
    .insert(tasks)
    .values({
      userId,
      title: input.title,
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
): Promise<TaskDto | null> {
  const [updated] = await db
    .update(tasks)
    .set(input)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning();

  return updated ? toTaskDto(updated) : null;
}

export async function deleteTaskForUser(id : number , userId : number) : Promise<TaskDto | null>{

  const [deleted] = await db.delete(tasks).where(and(eq(tasks.id , id),eq(tasks.userId , userId))).returning();

  return deleted ? toTaskDto(deleted) : null;
}

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
  const [deleted] = await db.delete(tasks).where(eq(tasks.id, id)).returning();

  return deleted ?? null;
}
