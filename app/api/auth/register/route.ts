import { NextRequest, NextResponse } from "next/server";

import {
  malformedJsonResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/src/lib/api-errors";
import { registerUser, createSession } from "@/src/features/auth/service";
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

  const user = await registerUser(result.data);

  if (!user) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const sessionToken = await createSession(user.id);
  const response = NextResponse.json({ user }, { status: 201 });
  setSessionCookie(response, sessionToken);

  return response;
}
