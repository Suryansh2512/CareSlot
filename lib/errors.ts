export class ClinicError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = "ClinicError"; }
}
export function publicError(error: unknown): { error: string; status: number } {
  if (error instanceof ClinicError) return { error: error.message, status: error.status };
  if (error instanceof Error && error.message.startsWith("Missing environment variable ")) return { error: error.message, status: 503 };
  return { error: "The service is temporarily unavailable. Please try again.", status: 503 };
}
