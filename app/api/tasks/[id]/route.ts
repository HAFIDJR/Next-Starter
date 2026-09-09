import { db } from "@/src/db";
import { tasks } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const taskId = Number(id);

  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Partial<{ title: string; completed: boolean }> = {};
  if (typeof body.completed === "boolean") patch.completed = body.completed;
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(eq(tasks.id, taskId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(tasks)
    .where(eq(tasks.id, taskId))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  return NextResponse.json(deleted);
}
