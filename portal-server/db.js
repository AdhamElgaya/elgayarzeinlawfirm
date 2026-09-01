import "./load-env.js";

const usePg = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

const db = usePg ? (await import("./db-pg.js")).default : (await import("./db-json.js")).default;

export const dbMode = usePg ? "postgres" : "json";
export default db;
