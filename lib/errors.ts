export class ClinicError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = "ClinicError"; }
}
export class OpenRouterError extends Error {
  constructor(public status: number) { super(`OpenRouter request failed (HTTP ${status}).`); this.name = "OpenRouterError"; }
}
export function publicAgentError(error: unknown): { error: string; status: number } {
  if (!(error instanceof OpenRouterError)) return publicGeminiError(error);
  const messages: Record<number, string> = {
    400: "OpenRouter requires an explicitly configured free model ID ending in :free.",
    401: "OpenRouter rejected the API key. Check OPENROUTER_API_KEY privately.",
    402: "OpenRouter reported insufficient credits. No paid model was selected.",
    403: "OpenRouter denied access. Check model availability and provider privacy permissions.",
    404: "The configured OpenRouter model is unavailable. Check OPENROUTER_MODEL.",
    429: "OpenRouter free-model rate limit reached. Please wait before retrying.",
    502: "OpenRouter returned an invalid or incomplete response. Please try again.",
    503: "The configured OpenRouter model is temporarily unavailable. Please try again shortly.",
    504: "OpenRouter exceeded the request deadline. Please try again.",
  };
  return { error: `${messages[error.status] ?? "OpenRouter is temporarily unavailable."} (HTTP ${error.status})`, status: error.status === 429 ? 429 : 503 };
}
export function publicError(error: unknown): { error: string; status: number } {
  if (error instanceof ClinicError) return { error: error.message, status: error.status };
  if (error instanceof Error && error.message.startsWith("Missing environment variable ")) return { error: error.message, status: 503 };
  return { error: "The service is temporarily unavailable. Please try again.", status: 503 };
}

// Whitelist actionable provider failures without exposing raw SDK bodies or URLs.
export function publicGeminiError(error: unknown): { error: string; status: number } {
  if (error instanceof ClinicError) return publicError(error);
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : undefined;
  if (status === 429) return { error: "Gemini quota reached (HTTP 429). Wait before retrying or check your project quota.", status: 429 };
  if (status === 503) return { error: "The configured Gemini model is experiencing high demand (HTTP 503). Please try again shortly.", status: 503 };
  if (status === 504) return { error: "The configured Gemini model exceeded the request deadline (HTTP 504). Please try again.", status: 504 };
  if (status === 404) return { error: "The configured Gemini model is unavailable for this API key (HTTP 404). Check GEMINI_MODEL and model access.", status: 503 };
  if (status === 401 || status === 403) return { error: `Gemini rejected access (HTTP ${status}). Check the API key and project permissions privately.`, status: 503 };
  if (status === 400) return { error: "Gemini rejected the request (HTTP 400). Check the configured model and supported function-calling options.", status: 503 };
  return publicError(error);
}
