import { isValidAttachment, normalizeAttachment } from "./attachments.js";

export const CLIENT_SELECT_COLUMNS =
  "id, name, phone, email, address, poa_document, id_document, created_at";

export function parseClientDocument(raw) {
  if (!raw) return null;
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const normalized = normalizeAttachment(value);
  return isValidAttachment(normalized) ? normalized : null;
}

export function clientDocumentFilenames(row) {
  return [parseClientDocument(row?.poa_document), parseClientDocument(row?.id_document)]
    .map((doc) => doc?.filename)
    .filter(Boolean);
}

export function publicClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || null,
    email: row.email || null,
    address: row.address || null,
    poa_document: parseClientDocument(row.poa_document),
    id_document: parseClientDocument(row.id_document),
    created_at: row.created_at,
  };
}
