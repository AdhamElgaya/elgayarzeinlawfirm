const ARABIC_NAME_USERNAME = /^(\p{Script=Arabic}+) (\p{Script=Arabic}+)$/u;
const ENGLISH_NAME_USERNAME = /^([A-Za-z]+) ([A-Za-z]+)$/;

function twoPartName(username, pattern) {
  const match = username.match(pattern);
  if (!match) return null;
  const [, first, last] = match;
  if (first.length < 2 || last.length < 2) return null;
  return { first, last };
}

export function normalizeUsername(value) {
  const trimmed = String(value || "").trim();
  if (ENGLISH_NAME_USERNAME.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

export function isValidNewUsername(username) {
  return Boolean(twoPartName(username, ARABIC_NAME_USERNAME) || twoPartName(username, ENGLISH_NAME_USERNAME));
}

export const USERNAME_RULES_MESSAGE =
  "اسم المستخدم يجب أن يكون اسمين فقط مفصولين بمسافة واحدة: بالعربية مثل أحمد محمد، أو بالإنجليزية مثل John Smith";
