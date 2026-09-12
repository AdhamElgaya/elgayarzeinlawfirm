export function composeCaseTitle(caseNumber, opponentName, fallback = "") {
  const number = String(caseNumber || "").trim();
  const opponent = String(opponentName || "").trim();
  if (number && opponent) return `${number} — ${opponent}`;
  return number || opponent || String(fallback || "").trim();
}
