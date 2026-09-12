import { NextRequest, NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  malformedJsonResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/src/lib/api-errors";
import { getCurrentUser } from "@/src/features/auth/session";
import {
  createTaskForUser,
  listTasksForUser,
} from "@/src/features/tasks/service";
import { createTaskSchema } from "@/src/features/tasks/validation";

export const dynamic = "force-dynamic";

// GET /api/tasks -> list all tasks
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return authenticationRequiredResponse();
  }
  const tasks = await listTasksForUser(user.id);

  return NextResponse.json(tasks);
}

// POST /api/tasks -> create a task
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const body = await readJsonBody(request);

  if (!body) {
    return malformedJsonResponse();
  }

  const result = createTaskSchema.safeParse(body.data);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const created = await createTaskForUser(user.id, result.data);

  return NextResponse.json(created, { status: 201 });
}
