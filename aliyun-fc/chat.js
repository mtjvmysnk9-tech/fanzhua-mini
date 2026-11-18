/* 阿里云函数计算 FC 3.0 · Web 函数示例（Node.js 20 运行时）
 *
 * 状态：未部署。这份代码的作用是把 docs/BACKEND-ALIYUN.md 里的契约写成能跑的形状，
 *       等你真的开通 FC + 百炼时，粘进"在线编辑"就能改。
 *
 * 需要的环境变量：
 *   DASHSCOPE_API_KEY   百炼控制台创建
 *   ALLOW_ORIGIN        例如 https://<user>.github.io
 *   DEV_SECRET_PEPPER   你自己随机生成的字符串，用来派生设备签名密钥
 *   MODEL               默认 qwen-plus
 *
 * 无第三方依赖：只用 node:http 与全局 fetch。
 */
"use strict";

const http = require("node:http");

const PORT = process.env.PORT || 9000;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "";
const API_KEY = process.env.DASHSCOPE_API_KEY || "";
const PEPPER = process.env.DEV_SECRET_PEPPER || "change-me";
const MODEL = process.env.MODEL || "qwen-plus";
const ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

/* 危机词：命中即不调模型。与前端 assets/js/data.js 保持同一份。 */
const CRISIS = ["自杀", "想死", "不想活", "活着没意思", "死了算了", "解脱", "割腕", "割手", "自伤", "吞药", "跳下去", "从楼上", "结束自己"];

const SYSTEM = [
  "你是给 12–18 岁中国学生使用的“反刍打断”练习陪练，不是医生、不是治疗师、不是朋友。",
  "1. 不做任何诊断，不提诊断名词，不说“你这是病”。",
  "2. 不建议停药或任何药物剂量，涉及用药一律指向开药的医生。",
  "3. 不承诺保密，不要求对方别告诉家长老师；始终推动他找一个现实中的成年人。",
  "4. 每次回复不超过 60 个汉字，最多一个问题，语气平实，不用感叹号，不用昵称。",
  "5. 只推进当前 stage 的任务，对方还没给出可行动的句子时不要跳到建议。",
  "6. 不编造研究、数据、热线号码；不确定就不说。"
].join("\n");

/* 固定兜底：危机路径与模型失败路径都不允许出现模型生成的句子 */
const HELP_REPLY = "这句我先接住。现在需要你旁边有个真人陪你，先拨 12356，或者把刚才这句话发给一个成年人看。";

const crypto = require("node:crypto");

function verifySignature(req, raw) {
  const sig = String(req.headers["x-rumi-sig"] || "");
  const ts = Number(req.headers["x-rumi-ts"] || 0);
  const dev = String(req.headers["x-rumi-device"] || "");
  if (!sig || !ts || !dev) return false;
  if (Math.abs(Date.now() - ts) > 120000) return false; // 防重放：±120 秒
  const secret = crypto.createHmac("sha256", PEPPER).update(dev).digest("hex");
  const want = crypto.createHmac("sha256", secret).update(raw + ts).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(want, "hex"), Buffer.from(sig, "hex"));
  } catch (e) {
    return false;
  }
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN || "null");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-rumi-sig,x-rumi-ts,x-rumi-device");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Vary", "Origin");
}

function send(res, code, obj) {
  cors(res);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function callModel(messages) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: "Bearer " + API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM }].concat(messages),
      temperature: 0.6,
      max_tokens: 120
    }),
    signal: AbortSignal.timeout(12000)
  });
  if (!r.ok) throw new Error("model " + r.status);
  const j = await r.json();
  return ((j.choices || [])[0] || {}).message || {};
}

/* 输出侧过滤：长度、禁用词、感叹号 */
function sanitize(text) {
  let t = String(text || "").trim().replace(/\s+/g, " ");
  if (/[治疗患抑焦]/.test(t) && /(诊断|治疗|治愈|患者|疗程)/.test(t)) return HELP_REPLY;
  if (t.length > 90) t = t.slice(0, 90);
  return t || HELP_REPLY;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { cors(res); res.writeHead(204); return res.end(); }

  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 65536) req.destroy(); });
  req.on("end", async () => {
    const url = (req.url || "").split("?")[0];
    if (url === "/v1/health") return send(res, 200, { ok: true, model: MODEL });

    if (url !== "/v1/chat") return send(res, 404, { error: "NOT_FOUND" });

    let body;
    try { body = JSON.parse(raw || "{}"); } catch (e) { return send(res, 400, { error: "BAD_BODY" }); }
    if (!verifySignature(req, raw)) return send(res, 401, { error: "SIGNATURE" });

    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && typeof m.content === "string")
      .slice(-6)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content.slice(0, 600) }));

    const last = messages.filter((m) => m.role === "user").pop();
    if (!last) return send(res, 400, { error: "BAD_BODY" });

    /* 危机：不进模型、不写正文日志，只记一次命中类型 */
    if (CRISIS.some((w) => last.content.includes(w))) {
      console.log(JSON.stringify({ ts: Date.now(), deviceId: body.deviceId, safety: "route_help" }));
      return send(res, 200, {
        reply: HELP_REPLY,
        suggestions: ["打开求助页", "把刚才那句话发给一个成年人"],
        safety: { level: "high", action: "route_help" },
        model: "none",
        serverTs: Date.now()
      });
    }

    try {
      const msg = await callModel(messages);
      const reply = sanitize(msg.content);
      console.log(JSON.stringify({ ts: Date.now(), deviceId: body.deviceId, stage: body.stage, safety: "continue", len: reply.length }));
      return send(res, 200, {
        reply,
        suggestions: ["做完再回温度计打一次分", "把这句翻译成今晚的一个动作"],
        safety: { level: "low", action: "continue" },
        model: MODEL,
        serverTs: Date.now()
      });
    } catch (e) {
      console.log(JSON.stringify({ ts: Date.now(), error: String(e.message || e) }));
      return send(res, 502, { error: "MODEL", fallback: "local" });
    }
  });
});

server.listen(PORT, () => console.log("rumi fc listening on " + PORT));
