/**
 * Thrown by the service layer when input passed the schema but cannot be used
 * (e.g. a draft whose parsed title is too long). Route handlers turn this into a
 * 400; Server Components let it bubble to the nearest `error.tsx`.
 */
export class InputRejectedError extends Error {
  readonly field: string;

  constructor(message: string, field = "form") {
    super(message);
    this.name = "InputRejectedError";
    this.field = field;
  }
}

export function isInputRejectedError(error: unknown): error is InputRejectedError {
  return error instanceof InputRejectedError;
}
