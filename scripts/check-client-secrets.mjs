import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { execFileSync } from "node:child_process";
try { loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const secretNames = ["SUPABASE_SECRET_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "APP_PASSCODE"];
function checkValues(content, file) {
  for (const name of secretNames) {
    const value = process.env[name];
    if (value && value.length >= 8 && content.includes(value)) throw new Error(`A configured secret appeared in ${file}. Value withheld.`);
  }
  if (/AIza[\w-]{30,}|sb_secret_[\w-]{20,}|sk-or-v1-[\da-f]{32,}|eyJhbGciOi[\w-]{15,}\.[\w-]{20,}\.[\w-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
    throw new Error(`A credential signature appeared in ${file}. Value withheld.`);
  }
}
const root = path.resolve(".next/static");
let count = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else if (/\.(js|json|map|html)$/.test(entry.name)) {
      const content = await readFile(file, "utf8"); count++;
      if (/SUPABASE_SECRET_KEY|GEMINI_API_KEY|OPENROUTER_API_KEY|careslot-confirmation:/.test(content)) throw new Error("Server-only credential/signing code appeared in a client asset: " + path.relative(root, file));
      checkValues(content, path.relative(root, file));
    }
  }
}
await inspect(root);
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
if (tracked.includes(".env.local")) throw new Error(".env.local must never be tracked.");
for (const file of tracked) {
  checkValues(await readFile(file, "utf8"), file);
  checkValues(execFileSync("git", ["show", `:${file}`], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }), `staged ${file}`);
}
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
for (const file of untracked) checkValues(await readFile(file, "utf8"), file);
checkValues(execFileSync("git", ["log", "--all", "--format=", "-p"], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 }), "reachable Git history");
console.log(`Passed: ${count} client assets, ${tracked.length} tracked/staged files, ${untracked.length} untracked files and reachable Git history scanned; no configured secrets, credential signatures or client signing code found.`);
if (!process.env.SUPABASE_SECRET_KEY || !process.env.GEMINI_API_KEY) console.log("Live credential values are absent; only source/bundle boundary checks were possible.");
