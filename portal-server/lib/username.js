const ARABIC_NAME_USERNAME = /^(\p{Script=Arabic}+) (\p{Script=Arabic}+)$/u;

export function normalizeUsername(value) {
  const trimmed = String(value || "").trim();
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

export function isValidNewUsername(username) {
  const match = username.match(ARABIC_NAME_USERNAME);
  if (!match) return false;

  const [, first, last] = match;
  return first.length >= 2 && last.length >= 2;
}

export const USERNAME_RULES_MESSAGE =
  "اسم المستخدم يجب أن يكون اسمين عربيين فقط (الاسم الأول والأخير) مفصولين بمسافة واحدة، مثل: أحمد محمد";
