import { createApp } from "./app.js";
import { dbLabel } from "./db.js";
import { storageMode } from "./lib/storage.js";
import { r2Prepare } from "./lib/r2.js";
import { lanIPv4s } from "./lib/lan.js";
import { isPushConfigured } from "./lib/push.js";
import { startTaskReminderScheduler } from "./lib/task-reminders.js";

const port = Number(process.env.PORT || 3000);
const app = await createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`[portal] Server running on port ${port}`);
  console.log(`[portal] Database mode: ${dbLabel}`);
  console.log(`[portal] Storage mode: ${storageMode}`);
  if (storageMode === "r2") {
    r2Prepare()
      .then((result) => {
        console.log(`[portal] R2 bucket ready: ${result.bucket}`);
      })
      .catch((error) => {
        console.error("[portal] R2 bucket check failed:", error.name || error.code || error.message);
      });
  }
  console.log(`[portal] Push notifications: ${isPushConfigured() ? "enabled" : "off (missing VAPID keys)"}`);
  console.log(`[portal] This PC: http://localhost:${port}/portal/login.html`);
  for (const ip of lanIPv4s()) {
    console.log(`[portal] Other devices: http://${ip}:${port}/portal/login.html`);
  }
  startTaskReminderScheduler();
});
