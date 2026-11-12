import "server-only";

/**
 * Reads an environment variable and stops with a clear message if it is missing.
 * All keys are read on the server only. They never reach the browser.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (and to Vercel project settings).`
    );
  }
  return value.trim();
}

// Read lazily so builds do not need runtime secrets. Never silently change models.
export function getGeminiModel(): string { return requireEnv("GEMINI_MODEL"); }

export function getAIProvider(): "gemini" | "openrouter" {
  const provider = process.env.AI_PROVIDER?.trim() || "gemini";
  if (provider !== "gemini" && provider !== "openrouter") throw new Error("AI_PROVIDER must be gemini or openrouter.");
  return provider;
}
export function getAIModel(): string {
  return requireEnv(getAIProvider() === "openrouter" ? "OPENROUTER_MODEL" : "GEMINI_MODEL");
}
