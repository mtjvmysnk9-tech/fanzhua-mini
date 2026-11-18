// 反刍打断 · 上报与聚合接口
// 依赖全部由 index.ts 注入（db / BackendError），本地测试注入假实现。
// 这个模块从不读取浏览器提交的设备身份以外的任何标识，也从不接收文本字段。

// 只收这两种：日常打分（check）和打断前后对比（break）。
// 量表结果、危机词命中、任何文字——前端不发，这里也不认。
const KINDS = ["check", "break"];
const CARDS = ["land", "breath", "camera", "move", "place", "worrytime", "count", "next"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_EVENTS = 50;
// 云端 DB 客户端单次最多回 500 行（实测 .limit(2000) 报 database_invalid_operation），
// 所以按 500 一页翻，最多 4 页 = 2000 行上限。
const PAGE_ROWS = 500;
const MAX_PAGES = 4;
const MAX_ROWS = PAGE_ROWS * MAX_PAGES;
const RETENTION_DAYS = 30;
// 样本太小时分组统计可能反推出个人，只回总数。
const MIN_DEVICES = 5;

function shiftDay(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}
// entry_date 是用户本地日；UTC+8 的早上 8 点前，本地日会比 UTC 日大 1。
// 窗口取 [今天-45, 明天UTC]，这样本地"今天"不会被当成未来日期丢掉。
const DAY_MIN_OFFSET = -45;
const DAY_MAX_OFFSET = 1;
const RETENTION_TZ_SLACK = 2;

export function application({ db, BackendError }) {
  const fail = (code, status) => { throw new BackendError(code, status); };
  const settle = async promise => {
    try { return await promise; }
    // 注入的客户端大多把失败包成 { error }，少数直接抛；两种都当成同一种结果处理。
    catch (error) { return { data: null, error: { code: error?.code, status: error?.status } }; }
  };
  const rows = async promise => {
    const result = await settle(promise);
    if (result.error) fail(result.error.code || "database_unavailable", result.error.status || 503);
    return result.data || [];
  };
  const int = (v, min, max) =>
    v === null || v === undefined ? null
      : Number.isInteger(v) && v >= min && v <= max ? v : undefined;

  async function jsonBody(request, limit) {
    const type = request.headers.get("content-type") || "";
    if (!type.startsWith("application/json")) fail("invalid_input", 400);
    const reader = request.body?.getReader();
    if (!reader) fail("invalid_input", 400);
    let size = 0;
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel().catch(() => {}); fail("payload_too_large", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let parsed;
    try {
      parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch { fail("invalid_input", 400); }
    if (!parsed || typeof parsed !== "object") fail("invalid_input", 400);
    return parsed;
  }

  // 逐条校验：只认白名单字段，任何多余字段直接丢弃，绝不入库。
  function normalize(raw, deviceId) {
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.id !== "string" || !ID_RE.test(raw.id)) return null;
    if (typeof raw.day !== "string" || !DAY_RE.test(raw.day)) return null;
    if (raw.day > shiftDay(DAY_MAX_OFFSET) || raw.day < shiftDay(DAY_MIN_OFFSET)) return null;
    if (KINDS.indexOf(raw.kind) === -1) return null;
    const level = int(raw.level, 0, 10); if (level === undefined) return null;
    const before = int(raw.before, 0, 10); if (before === undefined) return null;
    const after = int(raw.after, 0, 10); if (after === undefined) return null;
    // 每种事件都有自己的必填数值，缺了就不算这条。
    if (raw.kind === "check" && level === null) return null;
    if (raw.kind === "break" && (before === null || after === null)) return null;
    if (raw.card_id !== null && raw.card_id !== undefined && CARDS.indexOf(raw.card_id) === -1) return null;
    // 入库时间只认服务器时钟；客户端时间戳一律丢弃（entry_date 已承载"哪天发生"）。
    return {
      id: raw.id, device_id: deviceId, entry_date: raw.day, kind: raw.kind,
      level_score: level, card_id: raw.card_id || null,
      before_score: before, after_score: after, created_at: new Date().toISOString()
    };
  }

  function aggregate(list, days) {
    const perDay = {}, devices = {}, kinds = {}, hist = new Array(11).fill(0), cards = {};
    let levels = 0, levelN = 0, drops = 0, dropN = 0;
    for (const e of list) {
      const key = e.device_id + "|" + e.entry_date;
      (perDay[e.entry_date] ||= { persons: {}, breaks: 0, levels: [], checks: 0 }).persons[key.split("|")[0]] = 1;
      devices[e.device_id] = 1;
      kinds[e.kind] = (kinds[e.kind] || 0) + 1;
      if (e.kind === "check") {
        perDay[e.entry_date].checks++;
        if (e.level_score !== null) { perDay[e.entry_date].levels.push(e.level_score); levels += e.level_score; levelN++; hist[e.level_score]++; }
      }
      if (e.kind === "break") {
        perDay[e.entry_date].breaks++;
        if (e.card_id) {
          const c = (cards[e.card_id] ||= { uses: 0, drop: 0, dropN: 0 });
          c.uses++;
          if (e.before_score !== null && e.after_score !== null) { c.drop += e.before_score - e.after_score; c.dropN++; }
        }
        if (e.before_score !== null && e.after_score !== null) { drops += e.before_score - e.after_score; dropN++; }
      }
    }
    const dayList = Object.keys(perDay).sort().map(d => {
      const v = perDay[d];
      const n = v.levels.length;
      return {
        day: d, persons: Object.keys(v.persons).length, checks: v.checks, breaks: v.breaks,
        mean_level: n ? Math.round(v.levels.reduce((a, b) => a + b, 0) / n * 10) / 10 : null
      };
    });
    return {
      days, generated_at: new Date().toISOString(),
      person_days: Object.keys(perDay).reduce((a, d) => a + Object.keys(perDay[d].persons).length, 0),
      devices: Object.keys(devices).length,
      events: list.length,
      kinds, level_hist: hist,
      mean_level: levelN ? Math.round(levels / levelN * 10) / 10 : null,
      mean_drop: dropN ? Math.round(drops / dropN * 10) / 10 : null,
      cards: Object.keys(cards).sort((a, b) => cards[b].uses - cards[a].uses)
        .map(id => ({ id, uses: cards[id].uses, mean_drop: cards[id].dropN ? Math.round(cards[id].drop / cards[id].dropN * 10) / 10 : null })),
      per_day: dayList
    };
  }

  return async ctx => {
    const request = ctx.request;
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
    if (!match) fail("not_found", 404);
    const path = match[1] || "/";

    if (path === "/api/health" && request.method === "GET") {
      return Response.json({ ok: true, service: "rumi-report", retention_days: RETENTION_DAYS });
    }

    if (path === "/api/report" && request.method === "GET") {
      const raw = Number(url.searchParams.get("days") || 14);
      const days = Number.isInteger(raw) && raw >= 1 && raw <= 30 ? raw : 14;
      const from = shiftDay(-(days - 1));
      const cols = "device_id,entry_date,kind,level_score,card_id,before_score,after_score";
      const found = [];
      let truncated = false;
      for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await rows(db.from("events")
          .select(cols)
          .gte("entry_date", from)
          .order("entry_date", { ascending: false })
          .order("id", { ascending: false })
          .range(page * PAGE_ROWS, page * PAGE_ROWS + PAGE_ROWS - 1));
        found.push(...batch);
        if (batch.length < PAGE_ROWS) break;
        truncated = page === MAX_PAGES - 1;
      }
      const report = aggregate(found, days);
      report.truncated = truncated;
      if (report.devices < MIN_DEVICES) {
        report.insufficient = true;
        report.person_days = 0; report.kinds = {}; report.level_hist = [];
        report.mean_level = null; report.mean_drop = null;
        report.cards = []; report.per_day = []; report.truncated = false;
        report.min_devices = MIN_DEVICES;
      }
      return Response.json(report, { headers: { "cache-control": "no-store" } });
    }

    if (path === "/api/events/batch" && request.method === "POST") {
      // 来源校验由平台网关负责（function 里拿到的 url.host 是内网地址，无法比对）。
      const body = await jsonBody(request, 64 * 1024);
      if (typeof body.device_id !== "string" || !DEVICE_RE.test(body.device_id)) fail("invalid_device", 400);
      if (!Array.isArray(body.events) || !body.events.length) fail("empty_batch", 400);
      if (body.events.length > MAX_EVENTS) fail("batch_too_large", 413);

      const clean = [];
      for (const raw of body.events) {
        const e = normalize(raw, body.device_id);
        if (e) clean.push(e);
      }
      if (!clean.length) fail("no_valid_event", 422);

      // 客户端生成 id 当主键：整批重发只会撞主键，撞了就说明「这一条早就收过了」。
      const bulk = await settle(db.from("events").insert(clean).select("id"));
      let accepted = bulk.error ? 0 : (bulk.data || []).length;
      let stored = accepted;
      if (bulk.error) {
        accepted = 0; stored = 0;
        for (const row of clean) {
          const one = await settle(db.from("events").insert(row).select("id"));
          if (one.error) {
            if (one.error.code === "database_conflict") { stored++; continue; }
            fail(one.error.code || "database_unavailable", one.error.status || 503);
          }
          accepted++; stored++;
        }
      }

      if (Math.random() < 0.05) {
        try {
          await db.from("events").delete().lt("created_at", shiftDay(-(RETENTION_DAYS + RETENTION_TZ_SLACK)) + "T00:00:00.000Z");
        } catch { /* 清理失败不影响本次写入 */ }
      }
      return Response.json({ ok: true, received: clean.length, accepted, stored }, { status: 201 });
    }

    if (request.method !== "GET" && request.method !== "POST") fail("method_not_allowed", 405);
    fail("not_found", 404);
  };
}
