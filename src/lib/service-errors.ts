export class InputRejectedError extends Error {
  readonly field: string;

  constructor(messsage: string, field = "form") {
    super(messsage);
    this.name = "InputRejectedError";
    this.field = field;
  }
}

export function isInputRejectedError(error : unknown) : error is InputRejectedError{
    return error instanceof InputRejectedError;
}
