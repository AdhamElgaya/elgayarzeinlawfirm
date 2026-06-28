import "./load-env.js";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import dashboardRoutes from "./routes/dashboard.js";
import { seedAdmin } from "./seed.js";
import { dbMode } from "./db.js";
import { storageMode } from "./lib/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

export async function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, database: dbMode, storage: storageMode });
  });

  const portalPages = ["login", "home", "clients", "cases", "archived", "tasks", "dashboard", "admin"];
  for (const page of portalPages) {
    app.get(`/portal/${page}`, (_req, res, next) => {
      res.sendFile(path.join(rootDir, "portal", `${page}.html`), (err) => (err ? next() : undefined));
    });
  }

  app.use(express.static(rootDir));

  await seedAdmin();

  return app;
}
