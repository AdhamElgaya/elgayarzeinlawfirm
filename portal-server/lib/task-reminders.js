import db from "../db.js";
import { taskDueHasTime } from "./task-datetime.js";
import { sendPushToUser, isPushConfigured, getNotificationRecipient } from "./push.js";
import {
  formatReminderDueLabel,
  getReminderTriggerMs,
  shouldAbandonReminder,
} from "./task-datetime.js";

const REMINDER_MINUTES = Number(process.env.TASK_REMINDER_MINUTES || 45);
const DATE_ONLY_REMINDER_HOUR = Number(process.env.TASK_DATE_ONLY_REMINDER_HOUR || 6);
const TICK_MS = 60 * 1000;

let running = false;

async function markReminderSent(taskId) {
  await db
    .prepare(`UPDATE tasks SET reminder_sent_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), taskId);
}

async function processReminders() {
  if (running || !isPushConfigured()) return;
  running = true;

  try {
    const rows = await db
      .prepare(
        `SELECT t.id, t.title, t.due_at, t.assigned_to, c.title AS case_title
         FROM tasks t
         LEFT JOIN cases c ON c.id = t.case_id
         WHERE t.status = 'open' AND t.deleted_at IS NULL
         AND t.due_at IS NOT NULL AND t.reminder_sent_at IS NULL
         AND t.assigned_to IS NOT NULL`
      )
      .all();

    const now = Date.now();
    const windowMs = TICK_MS + 5000;

    for (const task of rows) {
      const triggerMs = getReminderTriggerMs(task.due_at, REMINDER_MINUTES);
      if (!Number.isFinite(triggerMs)) continue;

      // Not yet time to remind.
      if (now < triggerMs) continue;

      if (taskDueHasTime(task.due_at)) {
        const dueMs = new Date(task.due_at).getTime();
        // Task already due or overdue — skip without notifying.
        if (!Number.isFinite(dueMs) || now >= dueMs) {
          await markReminderSent(task.id);
          continue;
        }
      } else if (shouldAbandonReminder(task.due_at, now, triggerMs, windowMs)) {
        await markReminderSent(task.id);
        continue;
      }

      const recipient = await getNotificationRecipient(task.assigned_to);
      if (!recipient) continue;

      const dueLabel = formatReminderDueLabel(task.due_at);
      const result = await sendPushToUser(recipient.id, {
        title: task.title,
        body: `الموعد: ${dueLabel}\nاضغط لعرض تفاصيل المهمة`,
        taskId: task.id,
        dueLabel,
        url: `/portal/tasks.html?task=${task.id}`,
      });

      if (result.sent > 0 || result.subscriptions === 0) {
        await markReminderSent(task.id);
      } else {
        console.warn(`[portal] reminder not marked for task ${task.id} — push failed, will retry`);
      }
    }
  } catch (error) {
    console.error("[portal] task reminder tick failed:", error);
  } finally {
    running = false;
  }
}

export function startTaskReminderScheduler() {
  processReminders();
  setInterval(processReminders, TICK_MS);
  console.log(
    `[portal] Task reminders: ${REMINDER_MINUTES} min before timed tasks; date-only at ${DATE_ONLY_REMINDER_HOUR}:00 (tick every ${TICK_MS / 1000}s)`
  );
}
