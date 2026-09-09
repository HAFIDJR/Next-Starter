import { NextRequest, NextResponse } from "next/server";

import {
  malformedJsonResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/src/lib/api-errors";
import { deleteTask, updateTask } from "@/src/features/tasks/service";
import { parseTaskId, updateTaskSchema } from "@/src/features/tasks/validation";

export const dynamic = "force-dynamic";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

async function getTaskId({ params }: TaskRouteContext): Promise<number | null> {
  const { id } = await params;

  return parseTaskId(id);
}

export async function PATCH(request: NextRequest, context: TaskRouteContext) {
  const taskId = await getTaskId(context);

  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  }

  const body = await readJsonBody(request);

  if (!body) {
    return malformedJsonResponse();
  }

  const result = updateTaskSchema.safeParse(body.data);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const updated = await updateTask(taskId, result.data);

  if (!updated) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  context: TaskRouteContext,
) {
  const taskId = await getTaskId(context);

  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  }

  const deleted = await deleteTask(taskId);

  if (!deleted) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json(deleted);
}
