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
}
