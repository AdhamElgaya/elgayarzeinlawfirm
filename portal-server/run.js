import "./load-env.js";

const mode = String(process.argv[2] || "").trim().toLowerCase();
if (mode === "local" || mode === "railway") {
  process.env.PORTAL_DB = mode;
}

await import("./server.js");
