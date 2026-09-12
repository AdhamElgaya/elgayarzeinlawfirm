import "./load-env.js";

function onRailwayHost() {
  return Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
}

function requestedDb() {
  const raw = String(process.env.PORTAL_DB || "").trim().toLowerCase();
  if (["local", "json", "file"].includes(raw)) return "local";
  if (["railway", "postgres", "pg", "db"].includes(raw)) return "railway";
  return "";
}

export function resolveDatabaseUrl() {
  const primary = String(process.env.DATABASE_URL || "").trim();
  const publicUrl = String(process.env.DATABASE_PUBLIC_URL || process.env.SUPABASE_DB_URL || "").trim();
  if (primary && !(/\.railway\.internal/i.test(primary) && !onRailwayHost())) {
    return primary;
  }
  return publicUrl || primary;
}

const wantLocal = requestedDb() === "local" && !onRailwayHost();
const usePg = !wantLocal && Boolean(resolveDatabaseUrl());

const db = usePg ? (await import("./db-pg.js")).default : (await import("./db-json.js")).default;

export const dbMode = usePg ? "postgres" : "json";
export const dbLabel = usePg ? "postgres (Railway)" : "json (local file)";
export default db;
