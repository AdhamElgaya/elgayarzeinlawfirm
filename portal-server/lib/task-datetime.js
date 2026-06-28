const PORTAL_TIMEZONE = process.env.PORTAL_TIMEZONE || "Africa/Cairo";
const DATE_ONLY_REMINDER_HOUR = Number(process.env.TASK_DATE_ONLY_REMINDER_HOUR || 6);

export function taskDueHasTime(dueAt) {
  if (!dueAt) return false;
  return String(dueAt).includes("T");
}

export function taskDueDatePart(dueAt) {
  if (!dueAt) return "";
  const s = String(dueAt);
  return s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
}

/** UTC ms for a local date/time in PORTAL_TIMEZONE (e.g. 6:00 AM Cairo on 2026-06-26). */
export function zonedDateTimeMs(dateStr, hour, minute, timeZone = PORTAL_TIMEZONE) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NaN;
  }

  const [y, m, d] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(utcGuess));
  const pick = (type) => Number(parts.find((p) => p.type === type).value);
  const shown = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second")
  );
  return utcGuess + (utcGuess - shown);
}

export function getReminderTriggerMs(dueAt, reminderMinutesBefore = 45) {
  if (!dueAt) return NaN;

  if (taskDueHasTime(dueAt)) {
    const dueMs = new Date(dueAt).getTime();
    if (!Number.isFinite(dueMs)) return NaN;
    return dueMs - reminderMinutesBefore * 60 * 1000;
  }

  const datePart = taskDueDatePart(dueAt);
  return zonedDateTimeMs(datePart, DATE_ONLY_REMINDER_HOUR, 0);
}

export function shouldAbandonReminder(dueAt, nowMs, triggerMs, windowMs) {
  if (!Number.isFinite(triggerMs)) return true;

  if (nowMs < triggerMs + windowMs) {
    return false;
  }

  if (taskDueHasTime(dueAt)) {
    return true;
  }

  const datePart = taskDueDatePart(dueAt);
  const dayEndMs = zonedDateTimeMs(datePart, 23, 59, 59) + 1000;
  return nowMs >= dayEndMs;
}

export function formatTaskDueTime(dueAtIso, locale = "ar-EG") {
  const d = new Date(dueAtIso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTaskDueDateTime(dueAtIso, locale = "ar-EG") {
  const d = new Date(dueAtIso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatReminderDueLabel(dueAt, locale = "ar-EG") {
  if (!dueAt) return "";

  if (taskDueHasTime(dueAt)) {
    return formatTaskDueTime(dueAt, locale);
  }

  const datePart = taskDueDatePart(dueAt);
  const atSixMs = zonedDateTimeMs(datePart, DATE_ONLY_REMINDER_HOUR, 0);
  const dateLabel = new Date(atSixMs).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeLabel = formatTaskDueTime(new Date(atSixMs).toISOString(), locale);
  return `${dateLabel} — ${timeLabel}`;
}
