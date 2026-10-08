export class FailClosed extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "FailClosed";
    this.code = code;
  }
}
