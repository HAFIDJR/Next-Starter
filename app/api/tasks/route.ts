import { db } from "@/src/db";
import { type Task, tasks } from "@/src/db/schema";
import { desc ,eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/tasks -> list all tasks
export async function GET() {
  const all = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  return NextResponse.json(all);
}

//GET /api/tasks/:id -> get detail list

export async function getTaskById (id: number) : Promise <Task | null>{
  const [task] = await db.select().from(tasks).where(eq(tasks.id , id)).limit(1);
  return task ?? null
}

// POST /api/tasks -> create a task
export async function POST(req: NextRequest) {
  const body = await req.json();
  const title =
    typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json(
      { error: "Title is required." },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(tasks)
    .values({ title, completed: Boolean(body.completed) })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
