// 本地一体化预览：静态 dist/ + 真实 routes.mjs（依赖换成 dev/local-db.mjs 的假实现）。
// 用法：deno run --allow-read --allow-net --allow-env dev/server.mjs   → http://127.0.0.1:8787
import { application } from "../functions/routes.mjs";
import { BackendError, createFakeDb, errorResponse } from "./local-db.mjs";

const port = Number(Deno.env.get("PORT") || 8787);
const root = new URL("../dist/", import.meta.url);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain; charset=utf-8"
};

function pad(n) { return String(n).padStart(2, "0"); }
function dayKey(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function uuid(n) {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  void n;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 15)}-a${hex.slice(16, 18)}-${hex.slice(20)}`;
}

// 假数据：6 台设备 × 7 天，刚过 MIN_DEVICES 门槛，本地预览能直接看到分组明细。
function seed() {
  const CARDS = ["land", "breath", "camera", "move", "next"];
  const rows = [];
  for (let d = 0; d < 7; d++) {
    for (let p = 0; p < 6; p++) {
      if (d % 2 === 1 && p === 5) continue;
      const level = 3 + ((d * 3 + p * 5) % 7);
      rows.push({
        id: uuid(), device_id: `dev${p}`.padEnd(32, "0"), entry_date: dayKey(d), kind: "check",
        level_score: level, card_id: null, before_score: null, after_score: null,
        created_at: new Date(Date.now() - d * 86400000).toISOString()
      });
      const before = level, after = Math.max(0, before - (1 + (p % 3)));
      rows.push({
        id: uuid(), device_id: `dev${p}`.padEnd(32, "0"), entry_date: dayKey(d), kind: "break",
        level_score: null, card_id: CARDS[(d + p) % CARDS.length], before_score: before, after_score: after,
        created_at: new Date(Date.now() - d * 86400000).toISOString()
      });
    }
  }
  return rows;
}

const db = createFakeDb(seed());
const handle = application({ db, BackendError });

async function serveStatic(pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  if (rel.includes("..")) return new Response("bad path", { status: 400 });
  try {
    const file = new URL(rel, root);
    const bytes = await fetch(file).then(r => { if (!r.ok) throw new Error("404"); return r.arrayBuffer(); });
    const ext = "." + rel.split(".").pop().toLowerCase();
    return new Response(bytes, { headers: { "content-type": TYPES[ext] || "application/octet-stream", "cache-control": "no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

console.log(`本地预览 http://127.0.0.1:${port}  ·  接口前缀 /functions/v1/app  ·  假数据 ${db._rows.length} 行`);
Deno.serve({ port, hostname: "127.0.0.1" }, async request => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/functions/v1/") || url.pathname.startsWith("/app")) {
    try { return await handle({ request, requestId: "local" }); }
    catch (error) { return errorResponse(error, "local"); }
  }
  return serveStatic(url.pathname);
});
