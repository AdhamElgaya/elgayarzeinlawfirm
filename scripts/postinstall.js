import { execSync } from "child_process";
import fs from "fs";

if (process.env.VERCEL) {
  process.exit(0);
}

if (!fs.existsSync("portal-server/package.json")) {
  process.exit(0);
}

execSync("npm install --prefix portal-server", { stdio: "inherit" });
