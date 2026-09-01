import "./load-env.js";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import dashboardRoutes from "./routes/dashboard.js";
import { seedAdmin } from "./seed.js";
import db, { dbMode } from "./db.js";
import { storageMode } from "./lib/storage.js";
import { isProductionEnv } from "./lib/env.js";
import { applySchemaPatches } from "./lib/schema-patches.js";
import { countPushSubscriptions, isPushConfigured } from "./lib/push.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

function isCloudflarePreviewOrigin(origin) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".pages.dev") || url.hostname.endsWith(".workers.dev"))
    );
  } catch {
    return false;
  }
}

function isLanOrLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return false;
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    if (/^10(?:\.\d{1,3}){3}$/.test(host)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host)) return true;
    if (/^169\.254(?:\.\d{1,3}){2}$/.test(host)) return true;
    if (!host.includes(".") || host.endsWith(".local")) return true;
    return false;
  } catch {
    return false;
  }
}

export async function createApp() {
  const app = express();
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const localDevOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ];
  const corsOrigins = isProductionEnv()
    ? allowedOrigins
    : [...new Set([...allowedOrigins, ...localDevOrigins])];
  const crossOriginApi = allowedOrigins.length > 0;
  const apiOnly = process.env.API_ONLY === "true" || (isProductionEnv() && crossOriginApi);

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: isProductionEnv()
        ? { policy: "same-origin" }
        : { policy: "cross-origin" },
    })
  );

  if (corsOrigins.length > 0 || !isProductionEnv()) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      const allowOrigin =
        Boolean(origin) &&
        (corsOrigins.includes(origin) ||
          isCloudflarePreviewOrigin(origin) ||
          (!isProductionEnv() && isLanOrLocalOrigin(origin)));
      if (allowOrigin) {
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
    const payload = { ok: true, database: dbMode, storage: storageMode, push_configured: isPushConfigured() };
    if (typeof db.ping === "function") {
      try {
        await db.ping();
        payload.database_ok = true;
        if (isPushConfigured()) {
          payload.push_subscriptions = await countPushSubscriptions();
        }
      } catch (error) {
        console.error("[portal] health db ping failed:", error);
        payload.ok = false;
        payload.database_ok = false;
        if (!isProductionEnv()) {
          payload.database_error = error.message;
        }
      }
    }
    res.status(payload.ok ? 200 : 503).json(payload);
  });

  const portalPages = ["login", "home", "clients", "cases", "archived", "tasks", "dashboard", "admin", "profile"];
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
    await applySchemaPatches();
    await seedAdmin();
  } catch (error) {
    console.error("[portal] seed admin failed:", error);
    throw error;
  }

  return app;
}
