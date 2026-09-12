import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";

import { db } from "@/src/db";
import { sessions, users } from "@/src/db/schema";

import { hashPassword, verifyPassword } from "./password";
import type { AuthenticatedUser } from "./type";
import type { CredentialsInput } from "./validation";
import { email } from "zod";

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7;

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthenticatedUser(user: {
  id: number;
  email: string;
}): AuthenticatedUser {
  return { id: user.id, email: user.email };
}

export async function registerUser(
  credentials: CredentialsInput,
): Promise<AuthenticatedUser | null> {
  const passwordHash = await hashPassword(credentials.password);
  const [user] = await db
    .insert(users)
    .values({
      email: credentials.email,
      passwordHash,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({
      id: users.id,
      email: users.email,
    });

  return user ? toAuthenticatedUser(user) : null;
}

export async function authenticateUser(
    credentials : CredentialsInput
): Promise <AuthenticatedUser | null>{
    const [user] = await db.select({
        id : users.id,
        email : users.email,
        passwordHash : users.passwordHash
    })
    .from(users)
    .where(eq(users.email, credentials.email))
    .limit(1);

    if (!user || !(await verifyPassword(credentials.password, user.passwordHash))) {
    return null;
  }

  return toAuthenticatedUser(user);
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return token;
}

export async function getUserForSessionToken(
  token: string | undefined,
): Promise<AuthenticatedUser | null> {
  if (!token) {
    return null;
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return user ? toAuthenticatedUser(user) : null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) {
    return;
  }

  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)));
}
