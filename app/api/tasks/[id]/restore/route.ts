import { getCurrentUser } from "@/src/features/auth/session";
import { restoreTaskForUser } from "@/src/features/tasks/service";
import { parseTaskId } from "@/src/features/tasks/validation";
import {
  authenticationRequiredResponse,
  badRequestResponse,
  notFoundResponse,
} from "@/src/lib/api-errors";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RestoreRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: NextRequest,
  context: RestoreRouteContext,
) {
  const user = await getCurrentUser();

  if (!user) {
    return authenticationRequiredResponse();
  }

  const { id } = await context.params;
  const taskId = parseTaskId(id);

  if (!taskId) {
    return badRequestResponse("Invalid task id.");
  }

  const restored = await restoreTaskForUser(taskId, user.id);

  if (!restored) {
    return notFoundResponse("Task is not in the trash.");
  }

  return NextResponse.json(restored);
}
