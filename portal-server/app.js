import "./load-env.js";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import dashboardRoutes from "./routes/dashboard.js";
import sectionsRoutes from "./routes/sections.js";
import libraryRoutes from "./routes/library.js";
import { seedAdmin } from "./seed.js";
import db from "./db.js";
import { isProductionEnv } from "./lib/env.js";
import { applySchemaPatches } from "./lib/schema-patches.js";
import { ensureSections } from "./lib/sections.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

function isAllowedProjectPreview(origin, allowedOrigins) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    return allowedOrigins.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        if (allowedUrl.protocol !== "https:") return false;
        if (url.hostname === allowedUrl.hostname) return true;
        const host = allowedUrl.hostname;
        if (
          (host.endsWith(".pages.dev") || host.endsWith(".workers.dev")) &&
          url.hostname.endsWith(`.${host}`)
        ) {
          return true;
        }
        return false;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function isBlockedStaticPath(reqPath) {
  let normalized = String(reqPath || "/");
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    /* keep raw */
  }
  normalized = path.posix.normalize(normalized.replace(/\\/g, "/")).toLowerCase();
  const blockedPrefixes = [
    "/portal-server",
    "/node_modules",
    "/functions",
    "/workers",
    "/scripts",
    "/.git",
    "/.github",
    "/.cursor",
    "/.env",
  ];
  if (blockedPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return true;
  }
  const blockedFiles = new Set([
    "/.env.example",
    "/.gitignore",
    "/package.json",
    "/package-lock.json",
    "/railway.toml",
    "/wrangler.toml",
    "/deploy.config.json",
  ]);
  return blockedFiles.has(normalized);
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
  const allowedOrigins = [
    "https://www.gzlawfirm.net",
    "https://gzlawfirm.net",
    ...(process.env.ALLOWED_ORIGINS || "").split(","),
  ]
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const uniqueOrigins = [...new Set(allowedOrigins)];
  const localDevOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ];
  const corsOrigins = isProductionEnv()
    ? uniqueOrigins
    : [...new Set([...uniqueOrigins, ...localDevOrigins])];
  const crossOriginApi = uniqueOrigins.length > 0;
  const apiOnly = process.env.API_ONLY === "true" || (isProductionEnv() && crossOriginApi);

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://www.googleapis.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: isProductionEnv() ? ["'self'", "https:"] : ["'self'", "http:", "https:"],
          frameSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          ...(isProductionEnv() ? {} : { upgradeInsecureRequests: null }),
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy:
        apiOnly || process.env.CROSS_ORIGIN_COOKIES === "true"
          ? { policy: "cross-origin" }
          : isProductionEnv()
            ? { policy: "same-origin" }
            : { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
    })
  );

  app.use((req, res, next) => {
    const origin = String(req.headers.origin || "").replace(/\/$/, "");
    let siteHost = "";
    try {
      siteHost = origin ? new URL(origin).hostname : "";
    } catch {
      siteHost = "";
    }
    const allowOrigin =
      Boolean(origin) &&
      (corsOrigins.includes(origin) ||
        isAllowedProjectPreview(origin, corsOrigins) ||
        siteHost === "gzlawfirm.net" ||
        siteHost.endsWith(".gzlawfirm.net") ||
        (!isProductionEnv() && isLanOrLocalOrigin(origin)));
    if (allowOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      return allowOrigin || !origin ? res.sendStatus(204) : res.sendStatus(403);
    }
    next();
  });

  app.use((req, res, next) => {
    const ip = String(req.ip || "").replace(/^::ffff:/, "");
    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      res.on("finish", () => {
        console.log(`[portal] ${req.method} ${req.originalUrl} ${res.statusCode} ${ip}`);
      });
    }
    next();
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/sections", sectionsRoutes);
  app.use("/api/library-attachments", libraryRoutes);

  const healthHandler = async (_req, res) => {
    try {
      if (typeof db.ping === "function") await db.ping();
      res.json({ ok: true });
    } catch (error) {
      console.error("[portal] health db ping failed:", error);
      res.status(503).json({ ok: false });
    }
  };
  app.get("/api/health", healthHandler);
  app.get("/health", healthHandler);

  if (apiOnly) {
    app.get("/", (_req, res) => {
      res.json({ ok: true, service: "gz-portal-api" });
    });
  }

  const portalPages = ["login", "home", "clients", "cases", "archived", "tasks", "calendar", "dashboard", "admin", "profile", "sections", "section"];
  if (!apiOnly) {
    app.get("/", (_req, res, next) => {
      res.sendFile(path.join(rootDir, "index.html"), (err) => (err ? next() : undefined));
    });
    app.get(["/portal", "/portal/"], (_req, res) => {
      res.redirect(302, "/portal/login.html");
    });
    for (const page of portalPages) {
      app.get(`/portal/${page}`, (_req, res, next) => {
        res.sendFile(path.join(rootDir, "portal", `${page}.html`), (err) => (err ? next() : undefined));
      });
    }
    app.get("/portal/section/:id", (_req, res, next) => {
      res.sendFile(path.join(rootDir, "portal", "section.html"), (err) => (err ? next() : undefined));
    });

    app.use((req, res, next) => {
      if (isBlockedStaticPath(req.path)) return res.sendStatus(404);
      next();
    });

    app.use((req, res, next) => {
      if (req.path === "/portal/sw.js") {
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.set("Service-Worker-Allowed", "/portal/");
      }
      if (req.path === "/portal/manifest.json") {
        res.type("application/manifest+json");
        res.set("Cache-Control", "no-cache");
      }
      if (req.path.startsWith("/portal/") && req.path.endsWith(".html")) {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate");
        res.set("Pragma", "no-cache");
      }
      next();
    });

    app.use(express.static(rootDir, { index: false, dotfiles: "deny" }));
  }

  app.use((req, res) => {
    if (apiOnly || req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }
    res.sendStatus(404);
  });

  app.use((error, _req, res, _next) => {
    console.error("[portal] unhandled error:", error);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  });

  try {
    await applySchemaPatches();
    await ensureSections();
    await seedAdmin();
  } catch (error) {
    console.error("[portal] seed admin failed:", error);
    throw error;
  }

  return app;
}
