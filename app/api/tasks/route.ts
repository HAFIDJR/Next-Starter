import { NextRequest, NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  inputRejectedResponse,
  malformedJsonResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/src/lib/api-errors";
import { isInputRejectedError } from "@/src/lib/service-errors";
import { getCurrentUser } from "@/src/features/auth/session";
import { preferencesTimeZone, getPreferences } from "@/src/features/preferences/read";
import { listTasksForUser, createTaskForUser } from "@/src/features/tasks/service";
import { parseTaskListQuery, createTaskSchema } from "@/src/features/tasks/validation";

export const dynamic = "force-dynamic";

// GET /api/tasks -> list the caller's tasks, honouring ?q= &filter= &trash=
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const preferences = await getPreferences();
  const filters = parseTaskListQuery(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  const tasks = await listTasksForUser(user.id, filters, {
    timeZone: preferencesTimeZone(preferences),
  });

  // Same array shape the endpoint has always returned, so existing callers keep working.
  return NextResponse.json(tasks);
}

// POST /api/tasks -> create a task from a title or a natural-language draft
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

  const preferences = await getPreferences();

  try {
    const created = await createTaskForUser(user.id, result.data, {
      timeZone: preferencesTimeZone(preferences),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (isInputRejectedError(error)) {
      return inputRejectedResponse(error.message, error.field);
    }

    throw error;
  }
}
