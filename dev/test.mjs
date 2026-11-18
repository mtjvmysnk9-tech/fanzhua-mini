// 接口层测试：deno run --allow-read --allow-env dev/test.mjs
// 只证明 routes.mjs 自己的分支逻辑；云端 provider 的权限与原子性由 #10 的真实调用验证。
import { application } from "../functions/routes.mjs";
import { BackendError, createFakeDb, errorResponse } from "./local-db.mjs";

const COLS = ["id", "device_id", "entry_date", "kind", "level_score", "card_id", "before_score", "after_score", "created_at"];
const COLUMNS = new Set(COLS);
const uuid = () => "xxxxxxxx-xxxx-4xxx-axxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
const today = new Date().toISOString().slice(0, 10);
const DEV = "a".repeat(32);

let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
}

function makeContext(rows = []) {
  const db = createFakeDb(rows);
  const handle = application({ db, BackendError });
  const call = async (path, init = {}) => {
    const request = new Request("https://rumi.test/functions/v1/app" + path, init);
    try { return { res: await handle({ request, requestId: "t" }), db }; }
    catch (error) { return { res: errorResponse(error, "t"), db }; }
  };
  return { db, call };
}

function evt(over = {}) {
  return { id: uuid(), day: today, kind: "check", level: 6, before: null, after: null, card_id: null, ...over };
}
// 直接塞库时用列名，别用上传字段名，否则测的是假数据而不是路由。
function dbRow(over = {}) {
  return {
    id: uuid(), device_id: DEV, entry_date: today, kind: "check", level_score: 6,
    card_id: null, before_score: null, after_score: null, created_at: new Date().toISOString(), ...over
  };
}
const post = (device_id, events, headers = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://rumi.test", ...headers },
  body: JSON.stringify({ device_id, events })
});

console.log("健康检查");
{
  const { call } = makeContext();
  const { res } = await call("/api/health");
  const j = await res.json();
  ok("200 且带保留天数", res.status === 200 && j.ok === true && j.retention_days === 30, JSON.stringify(j));
}

console.log("未知路径与方法");
{
  const { call } = makeContext();
  ok("前缀不匹配 → 404", (await call("/nope")).res.status === 404);
  ok("PUT → 405", (await call("/api/report", { method: "PUT" })).res.status === 405);
}

console.log("写入校验");
{
  const { call, db } = makeContext();
  ok("缺 content-type → 400", (await call("/api/events/batch", { method: "POST", body: "{}" })).res.status === 400);
  ok("非法 device_id → 400", (await call("/api/events/batch", post("short", [evt()]))).res.status === 400);
  ok("空批次 → 400", (await call("/api/events/batch", post(DEV, []))).res.status === 400);
  const big = await call("/api/events/batch", post(DEV, Array.from({ length: 51 }, () => evt())));
  ok("51 条 → 413", big.res.status === 413);

  const wrongKind = await call("/api/events/batch", post(DEV, [evt({ kind: "scale" }), evt({ kind: "sos_ack" }), evt({ kind: "check", level: 11 })]));
  ok("量表/危机/越界强度全部丢弃 → 422", wrongKind.res.status === 422, `实际 ${wrongKind.res.status}`);
  ok("丢弃后一行未落库", db._rows.length === 0);
}

console.log("字段白名单（文字永远进不了库）");
{
  const { call, db } = makeContext();
  const dirty = {
    ...evt(), note: "我妈今天说我是废物", trigger: "同学嘲笑我", text: "整篇日志",
    password: "x", extra: { nested: "y" }, __proto__: { polluted: true }
  };
  const { res } = await call("/api/events/batch", post(DEV, [dirty, evt({ kind: "break", level: null, before: 8, after: 3, card_id: "land" })]));
  const j = await res.json();
  ok("两条都被接受", res.status === 201 && j.accepted === 2, JSON.stringify(j));
  ok("库里只有白名单列", db._rows.every(r => Object.keys(r).every(k => COLUMNS.has(k))));
  const blob = JSON.stringify(db._rows);
  ok("文字内容一个字符都没落库", !blob.includes("废物") && !blob.includes("嘲笑") && !blob.includes("整篇日志") && !blob.includes("polluted"));
  ok("原型未被污染", ({}).polluted === undefined);
  const brk = db._rows.find(r => r.kind === "break");
  ok("打断记了前后分与卡号", brk.before_score === 8 && brk.after_score === 3 && brk.card_id === "land");
}

console.log("幂等与保留");
{
  const one = evt({ id: "11111111-2222-4333-8444-555555555555" });
  const { call, db } = makeContext();
  const a = await call("/api/events/batch", post(DEV, [one]));
  const b = await call("/api/events/batch", post(DEV, [one]));
  const aj = await a.res.json(), bj = await b.res.json();
  ok("首次 accepted=1 stored=1", aj.accepted === 1 && aj.stored === 1, JSON.stringify(aj));
  ok("重发同一 id：整批撞主键后逐条兜底，accepted=0 但仍算已存", bj.accepted === 0 && bj.stored === 1 && bj.ok === true, JSON.stringify(bj));
  ok("库中仍只有一行", db._rows.length === 1);

  // 一半新的一半旧的：bulk 整批失败 → 兜底只写新那条
  const mixed = await call("/api/events/batch", post(DEV, [one, evt()]));
  const mj = await mixed.res.json();
  ok("混合重发：新增 1 条、总计 2 条", mj.accepted === 1 && mj.stored === 2 && db._rows.length === 2, JSON.stringify(mj));

  const { call: c2, db: d2 } = makeContext();
  await c2("/api/events/batch", post(DEV, [{ ...evt(), created_at: "2020-01-01T00:00:00.000Z" }]));
  ok("客户端伪造的 created_at 被服务器时间覆盖",
    d2._rows.length === 1 && !d2._rows[0].created_at.startsWith("2020"), JSON.stringify(d2._rows[0]));

  const { call: c3 } = makeContext();
  const { res } = await c3("/api/events/batch", {
    method: "POST", headers: { "content-type": "application/json" },
    body: "{" + "x".repeat(70 * 1024)
  });
  ok("超过 64KB 请求体 → 413", res.status === 413);
  const { res: res2 } = await c3("/api/events/batch", {
    method: "POST", headers: { "content-type": "application/json" }, body: "not json"
  });
  ok("非 JSON 请求体 → 400", res2.status === 400);
}

console.log("本地日 vs UTC 日");
{
  const shift = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const { call, db } = makeContext();
  // UTC+8 的早上 8 点前，用户本地"今天"= UTC 明天，这类打卡必须收进来
  const { res } = await call("/api/events/batch", post(DEV, [evt({ day: shift(1) }), evt({ kind: "break", level: null, before: 5, after: 2, card_id: "move", day: shift(1) })]));
  ok("本地今天（=UTC 明天）→ 201", res.status === 201, String(res.status));
  ok("两行都落库", db._rows.length === 2);
  const future = await call("/api/events/batch", post(DEV, [evt({ day: shift(2) })]));
  ok("UTC 后天 → 422 丢掉", future.res.status === 422, String(future.res.status));
  const stale = await call("/api/events/batch", post(DEV, [evt({ day: shift(-60) })]));
  ok("60 天前 → 422 丢掉", stale.res.status === 422, String(stale.res.status));
  const j = await (await call("/api/report?days=14")).res.json();
  ok("report 窗口含该日（不足 5 台仍只回总数）", j.devices === 1 && j.insufficient === true);
}

console.log("汇总门槛（走真实写入再读汇总）");
{
  const { call, db } = makeContext();
  const pairFor = (n) => ({
    dev: String(n).repeat(32),
    events: [evt({ level: 6 }), evt({ kind: "break", level: null, before: 7, after: 2, card_id: "breath" })]
  });
  for (let i = 0; i < 4; i++) {
    const { dev, events } = pairFor(i);
    const { res } = await call("/api/events/batch", post(dev, events));
    if (res.status !== 201) throw new Error("预置数据写入失败 " + res.status);
  }
  ok("库里 8 行", db._rows.length === 8);
  const j = await (await call("/api/report?days=14")).res.json();
  ok("4 台设备 → insufficient，明细清空", j.insufficient === true && j.devices === 4 && j.per_day.length === 0 && j.cards.length === 0 && j.level_hist.length === 0, JSON.stringify(j).slice(0, 200));
  ok("仍回总数", j.events === 8 && j.devices === 4);

  await call("/api/events/batch", post("9".repeat(32), [evt({ level: 8 })]));
  const j2 = await (await call("/api/report?days=14")).res.json();
  ok("5 台设备 → 明细生成", !j2.insufficient && j2.devices === 5 && j2.per_day.length === 1 && j2.cards.length === 1);
  ok("人·日 = 5", j2.person_days === 5, String(j2.person_days));
  ok("平均降分 = 5", j2.mean_drop === 5, String(j2.mean_drop));
  ok("平均强度含新加入的 8 分", j2.mean_level === 6.4, String(j2.mean_level));
  ok("响应带 no-store", (await call("/api/report?days=14")).res.headers.get("cache-control") === "no-store");

  const bad = await call("/api/report?days=999");
  const j3 = await bad.res.json();
  ok("非法 days 回落 14", j3.days === 14);
}

console.log("翻页读取（注入的客户端单次最多回 500 行）");
{
  const seed = [];
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 90; k++) seed.push(dbRow({ device_id: String(i).repeat(32), level_score: 5 }));
  }
  const { call } = makeContext(seed);
  const j = await (await call("/api/report?days=14")).res.json();
  ok("越过第一页：events = 540", j.events === 540, String(j.events));
  ok("未截断", j.truncated === false);
  ok("设备数 6 → 出明细", j.devices === 6 && !j.insufficient && j.per_day.length === 1);
}

console.log(`\n${pass} 通过 · ${fail} 失败`);
if (fail) Deno.exit(1);
