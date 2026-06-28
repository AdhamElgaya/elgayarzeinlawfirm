import "./load-env.js";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import dashboardRoutes from "./routes/dashboard.js";
import { seedAdmin } from "./seed.js";
import db, { dbMode } from "./db.js";
import { storageMode } from "./lib/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

export async function createApp() {
  const app = express();
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const crossOriginApi = allowedOrigins.length > 0;
  const apiOnly = process.env.API_ONLY === "true" || crossOriginApi;

  app.set("trust proxy", 1);

  if (crossOriginApi) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      }
      if (req.method === "OPTIONS") return res.sendStatus(204);
      next();
    });
  }

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.get("/api/health", async (_req, res) => {
    const payload = { ok: true, database: dbMode, storage: storageMode };
    if (typeof db.ping === "function") {
      try {
        await db.ping();
        payload.database_ok = true;
      } catch (error) {
        payload.ok = false;
        payload.database_ok = false;
        payload.database_error = error.message;
      }
    }
    res.status(payload.ok ? 200 : 503).json(payload);
  });

  const portalPages = ["login", "home", "clients", "cases", "archived", "tasks", "dashboard", "admin"];
  if (!apiOnly) {
    for (const page of portalPages) {
      app.get(`/portal/${page}`, (_req, res, next) => {
        res.sendFile(path.join(rootDir, "portal", `${page}.html`), (err) => (err ? next() : undefined));
      });
    }

    app.use(express.static(rootDir));
  }

  app.use((error, _req, res, _next) => {
    console.error("[portal] unhandled error:", error);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  });

  try {
    await seedAdmin();
  } catch (error) {
    console.error("[portal] seed admin failed:", error);
    throw error;
  }

  return app;
}
