import { createApp } from "./app.js";
import { dbMode } from "./db.js";
import { storageMode } from "./lib/storage.js";

const port = Number(process.env.PORT || 3000);
const app = await createApp();

app.listen(port, () => {
  console.log(`[portal] Server running at http://localhost:${port}`);
  console.log(`[portal] Database mode: ${dbMode}`);
  console.log(`[portal] Storage mode: ${storageMode}`);
  console.log(`[portal] Lawyer login: http://localhost:${port}/portal/login.html`);
});
