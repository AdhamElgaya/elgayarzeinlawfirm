import rateLimit from "express-rate-limit";
import { normalizeUsername } from "./username.js";

const BRUTE_WINDOW_MS = 10 * 60 * 1000;
const BRUTE_MAX = 5;

function clientIp(req) {
  return String(req.ip || "").replace(/^::ffff:/, "") || "unknown";
}

const bruteForceHandler = (_req, res) => {
  res.status(429).json({ error: "محاولات كثيرة. يمكنك المحاولة مرة أخرى بعد 10 دقائق." });
};

export const loginLimiter = rateLimit({
  windowMs: BRUTE_WINDOW_MS,
  max: BRUTE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${clientIp(req)}:${normalizeUsername(req.body?.username)}`,
  validate: false,
  handler: bruteForceHandler,
});

export const passwordActionLimiter = rateLimit({
  windowMs: BRUTE_WINDOW_MS,
  max: BRUTE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: bruteForceHandler,
});
