import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/src/features/auth/constansts";
import { deleteSession } from "@/src/features/auth/service";
import { clearSessionCookie } from "@/src/features/auth/session";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  await deleteSession(sessionToken);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  return response;
}