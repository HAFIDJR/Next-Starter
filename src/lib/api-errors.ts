import { NextResponse } from "next/server";
import type { ZodError } from "zod";

type FieldErrors = Record<string, string[]>;

export async function readJsonBody(
  request: Request,
): Promise<{ data: unknown } | null> {
  try {
    return { data: await request.json() };
  } catch {
    return null;
  }
}

export function authenticationRequiredResponse() {
  return NextResponse.json(
    { error: "Authentication required." },
    { status: 401 },
  );
}

export function malformedJsonResponse() {
  return NextResponse.json(
    {
      error: "Request body must be valid JSON.",
      fieldErrors: { form: ["Request body must be valid JSON."] },
    },
    { status: 400 },
  );
}

export function validationErrorResponse(error: ZodError) {
  const fieldErrors = error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path.map(String).join(".") || "form";
    errors[field] ??= [];
    errors[field].push(issue.message);
    return errors;
  }, {});

  return NextResponse.json(
    {
      error: "Validation failed.",
      fieldErrors,
    },
    { status: 400 },
  );
}

/** Service-layer rejections (e.g. a draft whose parsed title is too long) → 400. */
export function inputRejectedResponse(message: string, field = "form") {
  return NextResponse.json(
    {
      error: message,
      fieldErrors: { [field]: [message] },
    },
    { status: 400 },
  );
}

export function notFoundResponse(message = "Not found.") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequestResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}