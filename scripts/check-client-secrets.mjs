import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(".next/static");
let count = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else if (/\.(js|json|map|html)$/.test(entry.name)) {
      const content = await readFile(file, "utf8"); count++;
      if (/SUPABASE_SECRET_KEY|GEMINI_API_KEY|careslot-confirmation:/.test(content)) throw new Error("Server-only credential/signing code appeared in a client asset: " + path.relative(root, file));
      for (const name of ["SUPABASE_SECRET_KEY", "GEMINI_API_KEY", "APP_PASSCODE"]) {
        const value = process.env[name];
        if (value && value.length >= 8 && content.includes(value)) throw new Error("A configured secret appeared in a client asset. Value withheld.");
      }
    }
  }
}
await inspect(root);
console.log("Passed: " + count + " client assets scanned; no server-secret identifiers or signing code found.");
if (!process.env.SUPABASE_SECRET_KEY || !process.env.GEMINI_API_KEY) console.log("Live credential values are absent; only source/bundle boundary checks were possible.");
