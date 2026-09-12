import { NextRequest, NextResponse } from "next/server";

import {
  malformedJsonResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/src/lib/api-errors";
import { authenticateUser, createSession } from "@/src/features/auth/service";
import { setSessionCookie } from "@/src/features/auth/session";
import { credentialsSchema } from "@/src/features/auth/validation";

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body) {
    return malformedJsonResponse();
  }

  const result = credentialsSchema.safeParse(body.data);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const user = await authenticateUser(result.data);

  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const sessionToken = await createSession(user.id);
  const response = NextResponse.json({ user });
  setSessionCookie(response, sessionToken);

  return response;
}
