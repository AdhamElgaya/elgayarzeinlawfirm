export function normalizeDueAt(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Date-only (YYYY-MM-DD) — keep as-is for Postgres DATE/TIMESTAMPTZ midnight UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("موعد المهمة غير صالح.");
    error.statusCode = 400;
    throw error;
  }
  return parsed.toISOString();
}
