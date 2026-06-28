import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "portal", "api-config.js");

const raw = String(process.env.PORTAL_API_BASE || "").trim();

if (process.env.VERCEL && !raw) {
  console.error(
    "PORTAL_API_BASE is required on Vercel (e.g. https://your-app.up.railway.app/api)"
  );
  process.exit(1);
}

const base = raw ? raw.replace(/\/$/, "") : "";

const contents = `// Generated at deploy time. Do not edit on Vercel — set PORTAL_API_BASE instead.
window.PORTAL_API_BASE = ${JSON.stringify(base)};
`;

fs.writeFileSync(outPath, contents);
console.log(`[portal] api-config.js → ${base || "(same-origin /api)"}`);
