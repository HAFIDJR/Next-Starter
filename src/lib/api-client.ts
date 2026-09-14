/**
 * Thin wrapper over `fetch` for the app's own JSON endpoints, so every caller
 * reads errors the same way the API writes them (`{ error, fieldErrors }`).
 */

export type ApiFieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: ApiFieldErrors;

  constructor(message: string, status: number, fieldErrors: ApiFieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** Field-level message for a form input, if the API reported one. */
  errorFor(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }
}

async function parsePayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function messageFrom(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

function fieldErrorsFrom(payload: unknown): ApiFieldErrors {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "fieldErrors" in payload &&
    typeof payload.fieldErrors === "object" &&
    payload.fieldErrors !== null
  ) {
    return payload.fieldErrors as ApiFieldErrors;
  }

  return {};
}

export async function apiRequest<T>(
  input: string,
  init: RequestInit & { fallbackError?: string } = {},
): Promise<T> {
  const { fallbackError = "Something went wrong.", ...requestInit } = init;

  const response = await fetch(input, {
    ...requestInit,
    // Route Handlers must never be served from the browser cache after a mutation.
    cache: "no-store",
  });

  const payload = await parsePayload(response);

  if (!response.ok) {
    throw new ApiError(
      messageFrom(payload, fallbackError),
      response.status,
      fieldErrorsFrom(payload),
    );
  }

  return payload as T;
}

export function jsonRequest<T = unknown>(
  input: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
  fallbackError?: string,
): Promise<T> {
  return apiRequest<T>(input, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    fallbackError,
  });
}

export function deleteRequest<T = unknown>(
  input: string,
  fallbackError?: string,
): Promise<T> {
  return apiRequest<T>(input, { method: "DELETE", fallbackError });
}
