import { NextRequest, NextResponse } from "next/server";

import {
  malformedJsonResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/src/lib/api-errors";
import { createTask, listTasks } from "@/src/features/tasks/service";
import { createTaskSchema } from "@/src/features/tasks/validation";

export const dynamic = "force-dynamic";

// GET /api/tasks -> list all tasks
export async function GET() {
  const allTasks = await listTasks();

  return NextResponse.json(allTasks);
}

// POST /api/tasks -> create a task
export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return malformedJsonResponse();
  }

  const result = createTaskSchema.safeParse(body.data);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const created = await createTask(result.data);

  return NextResponse.json(created, { status: 201 });
}
