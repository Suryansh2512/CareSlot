import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";

// Run locally only. Never print credential values, including the generated passcode.
let localText = await readFile(".env.local", "utf8");
const templateText = await readFile(".env.example", "utf8");
const local = parseEnv(localText), template = parseEnv(templateText);
const selectedModel = process.argv.find(a => a.startsWith("--openrouter-model="))?.split("=")[1];
if (selectedModel) {
  const catalog = JSON.parse(await readFile("test-results/openrouter/models.json", "utf8")).data;
  const entry = catalog.find(m => m.id === selectedModel);
  if (!entry?.supported_parameters?.includes("tools") || Number(entry.pricing.prompt) !== 0 || Number(entry.pricing.completion) !== 0 || !selectedModel.endsWith(":free")) {
    throw new Error("Only a catalog-verified free tool-capable model can be selected.");
  }
  for (const [name, value] of Object.entries({ AI_PROVIDER: "openrouter", OPENROUTER_MODEL: selectedModel })) {
    localText = localText.replace(new RegExp(`^${name}=.*$`, "gm"), "");
    localText += `\n${name}=${value}\n`;
  }
  console.log(`Selected verified free OpenRouter model: ${selectedModel}`);
}
for (const [name, value] of Object.entries(template)) {
  if (!value.trim()) continue;
  if (local[name]?.trim() && local[name] !== value) {
    throw new Error(`Conflicting values for ${name}; both files preserved. Resolve privately.`);
  }
  if (!local[name]?.trim()) {
    localText = localText.replace(new RegExp(`^${name}=.*$`, "m"), "");
    localText += `\n${name}=${JSON.stringify(value)}\n`;
  }
}
if (!parseEnv(localText).APP_PASSCODE?.trim()) {
  localText = localText.replace(/^APP_PASSCODE=.*$/m, "");
  localText += `\nAPP_PASSCODE=${randomBytes(24).toString("base64url")}\n`;
  console.log("Generated a private APP_PASSCODE in .env.local; value withheld.");
}
await writeFile(".env.local", localText);
const verified = parseEnv(await readFile(".env.local", "utf8"));
for (const [name, value] of Object.entries(template)) {
  if (value.trim() && verified[name] !== value) throw new Error(`Copy verification failed for ${name}.`);
}
await writeFile(".env.example", templateText.replace(/^([A-Z][A-Z0-9_]*\s*=).*$/gm, "$1"));
for (const name of ["AI_PROVIDER", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_PASSCODE"]) {
  console.log(`${name}: ${verified[name]?.trim() ? "configured" : "MISSING"}`);
}
