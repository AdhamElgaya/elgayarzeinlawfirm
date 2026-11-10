export function foldSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesSearch(parts, query) {
  const foldedQuery = foldSearch(query);
  if (!foldedQuery) return true;
  const haystack = foldSearch((parts || []).filter((part) => part != null && part !== false).join(" "));
  return foldedQuery.split(" ").every((token) => haystack.includes(token));
}
