import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  badRequestResponse,
  inputRejectedResponse,
  malformedJsonResponse,
  notFoundResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/src/lib/api-errors";
import { isInputRejectedError } from "@/src/lib/service-errors";
import { getCurrentUser } from "@/src/features/auth/session";
import { preferencesTimeZone, getPreferences } from "@/src/features/preferences/read";
import {
  deleteTaskForUser,
  permanentlyDeleteTaskForUser,
  purgeExpiredTrash,
  updateTaskForUser,
} from "@/src/features/tasks/service";
import {
  parseTaskId,
  updateTaskSchema,
} from "@/src/features/tasks/validation";

export const dynamic = "force-dynamic";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

async function getTaskId({ params }: TaskRouteContext): Promise<number | null> {
  const { id } = await params;

  return parseTaskId(id);
}

export async function PATCH(request: NextRequest, context: TaskRouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const taskId = await getTaskId(context);

  if (!taskId) {
    return badRequestResponse("Invalid task id.");
  }

  const body = await readJsonBody(request);

  if (!body) {
    return malformedJsonResponse();
  }

  const result = updateTaskSchema.safeParse(body.data);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const preferences = await getPreferences();

  try {
    const updated = await updateTaskForUser(taskId, user.id, result.data, {
      timeZone: preferencesTimeZone(preferences),
    });

    if (!updated) {
      return notFoundResponse("Task not found.");
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (isInputRejectedError(error)) {
      return inputRejectedResponse(error.message, error.field);
    }

    throw error;
  }
}

/**
 * DELETE /api/tasks/:id -> soft delete (undo-able from the trash).
 * `?permanent=1` wipes the row for good and is only offered inside the trash.
 */
export async function DELETE(request: NextRequest, context: TaskRouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const taskId = await getTaskId(context);

  if (!taskId) {
    return badRequestResponse("Invalid task id.");
  }

  const permanent = request.nextUrl.searchParams.get("permanent") === "1";

  const removed = permanent
    ? await permanentlyDeleteTaskForUser(taskId, user.id)
    : await deleteTaskForUser(taskId, user.id);

  if (!removed) {
    return notFoundResponse("Task not found.");
  }

  // Trash cleanup is off the response path: the user already has their answer.
  // Fire-and-forget work must swallow its own failures — nothing is awaiting it,
  // so a throw here would surface as an unhandled rejection instead of a log line.
  after(async () => {
    try {
      const purged = await purgeExpiredTrash();

      if (purged > 0) {
        console.info(`[tasks] purged ${purged} expired trash row(s)`);
      }
    } catch (error) {
      console.error("[tasks] trash cleanup failed", error);
    }
  });

  return NextResponse.json(removed);
}
