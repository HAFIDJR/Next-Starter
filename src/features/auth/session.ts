import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./constansts";
import { getUserForSessionToken } from "./service";
import type { AuthenticatedUser } from "./type";

const sessionCookieOptions = {
  httpOnly: true,
  maxAge: SESSION_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export const getCurrentUser = cache(
  async (): Promise<AuthenticatedUser | null> => {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    return getUserForSessionToken(token);
  },
);

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    ...sessionCookieOptions,
    name: SESSION_COOKIE_NAME,
    value: token,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    ...sessionCookieOptions,
    maxAge: 0,
    name: SESSION_COOKIE_NAME,
    value: "",
  });
}
