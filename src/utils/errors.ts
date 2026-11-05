export class AppError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string, technicalMessage?: string) {
    super(technicalMessage ?? userMessage);
    this.name = "AppError";
    this.userMessage = userMessage;
  }
}

export function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.userMessage;
  if (error instanceof Error && isSafeUserError(error.message)) {
    return error.message;
  }
  return fallback;
}

function isSafeUserError(message: string): boolean {
  return (
    message.length > 0 &&
    message.length < 180 &&
    !message.includes("at ") &&
    !message.includes("http") &&
    !/stack|undefined is not|cannot read/i.test(message)
  );
}
