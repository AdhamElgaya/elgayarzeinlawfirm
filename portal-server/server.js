import os from "os";
import { createApp } from "./app.js";
import { dbMode } from "./db.js";
import { storageMode } from "./lib/storage.js";
import { startTaskReminderScheduler } from "./lib/task-reminders.js";

const port = Number(process.env.PORT || 3000);
const app = await createApp();

function lanIPv4s() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      addresses.push(net.address);
    }
  }
  const ranked = addresses.sort((a, b) => {
    const score = (ip) =>
      ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : ip.startsWith("172.") ? 2 : 3;
    return score(a) - score(b);
  });
  return ranked;
}

app.listen(port, "0.0.0.0", () => {
  console.log(`[portal] Server running on port ${port}`);
  console.log(`[portal] Database mode: ${dbMode}`);
  console.log(`[portal] Storage mode: ${storageMode}`);
  console.log(`[portal] This PC: http://localhost:${port}/portal/login.html`);
  for (const ip of lanIPv4s()) {
    console.log(`[portal] Other devices: http://${ip}:${port}/portal/login.html`);
  }
  startTaskReminderScheduler();
});
