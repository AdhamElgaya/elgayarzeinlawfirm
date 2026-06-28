import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "portal", "api-config.js");

const raw = String(process.env.PORTAL_API_BASE || "").trim();
const base = raw ? raw.replace(/\/$/, "") : "";

const contents = `// Generated for deployment. Local dev uses same-origin /api when empty.
window.PORTAL_API_BASE = ${JSON.stringify(base)};
`;

fs.writeFileSync(outPath, contents);
console.log(`[portal] api-config.js → ${base || "(same-origin /api)"}`);
