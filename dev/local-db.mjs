// 本地假数据库：只为跑通 routes.mjs 的真实分支，不代表云端 provider 的行为。
// 方法面按 2026-11-18 线上实测收敛：
//   支持 select(cols[, {count}]) / eq / gte / lte / lt / order(可多次) / limit(≤500) / range(a,b) / insert / delete
//   不支持 insertIfAbsent 与 in（注入的客户端会直接抛 database_invalid_operation）
//   insert 撞主键时整批失败，返回 { error: { code: "database_conflict", status: 409 } }

const PAGE_LIMIT = 500;

function invalidOperation() {
  const error = new Error("database_invalid_operation");
  error.code = "database_invalid_operation";
  error.status = 400;
  return error;
}

export function createFakeDb(seed = []) {
  const rows = seed.map(r => ({ ...r }));
  const state = { deleted: 0, insertCalls: 0 };

  const columnsOf = () => ({
    id: "", device_id: "", entry_date: "", kind: "", level_score: null,
    card_id: null, before_score: null, after_score: null, created_at: ""
  });

  function query(table) {
    if (table !== "events") throw new Error(`fake db 里没有表 ${table}`);
    let mode = "select", columns = null, cap = null, window = null, wantCount = false;
    const filters = [], ordering = [];
    let values = null;
    const q = {
      select(value, options = {}) { columns = String(value).split(",").map(s => s.trim()); wantCount = options.count === "exact"; return q; },
      eq(key, value) { filters.push(r => r[key] === value); return q; },
      gte(key, value) { filters.push(r => String(r[key]) >= String(value)); return q; },
      lte(key, value) { filters.push(r => String(r[key]) <= String(value)); return q; },
      lt(key, value) { filters.push(r => String(r[key]) < String(value)); return q; },
      order(key, options = {}) { ordering.push([key, options.ascending !== false]); return q; },
      limit(value) { if (value > PAGE_LIMIT) throw invalidOperation(); cap = value; return q; },
      range(a, b) { if (b - a + 1 > PAGE_LIMIT) throw invalidOperation(); window = [a, b - a + 1]; return q; },
      insert(value) { mode = "insert"; values = Array.isArray(value) ? value : [value]; return q; },
      delete() { mode = "delete"; return q; },
      in() { throw invalidOperation(); },
      then(res, rej) { return run().then(res, rej); },
      catch(rej) { return run().catch(rej); }
    };

    async function run() {
      if (mode === "insert") {
        state.insertCalls++;
        const missing = values.flatMap(item => Object.keys(item).filter(k => !(k in columnsOf())));
        if (missing.length) throw new Error(`fake db 未知列 ${missing}`);
        // 真实 PostgREST 的批量插入是整批成败：任何一行撞主键，这批一行都不写。
        if (values.some(item => rows.some(r => r.id === item.id))) {
          return { data: null, error: { code: "database_conflict", status: 409, message: "duplicate key" } };
        }
        const written = [];
        for (const item of values) {
          rows.push({ ...item });
          written.push(Object.fromEntries((columns || ["id"]).map(k => [k, item[k]])));
        }
        return { data: written, error: null, count: written.length };
      }
      if (mode === "delete") {
        let removed = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (filters.every(f => f(rows[i]))) { rows.splice(i, 1); removed++; }
        }
        state.deleted += removed;
        return { data: [], error: null, count: removed };
      }
      let out = rows.filter(r => filters.every(f => f(r)));
      for (const [key, asc] of ordering.slice().reverse()) {
        out.sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : String(a[key]) > String(b[key]) ? 1 : 0) * (asc ? 1 : -1));
      }
      const total = out.length;
      if (window) out = out.slice(window[0], window[0] + window[1]);
      else if (cap !== null) out = out.slice(0, cap);
      const cols = columns;
      return {
        data: out.map(r => (cols ? Object.fromEntries(cols.map(k => [k, r[k]])) : { ...r })),
        error: null,
        count: wantCount ? total : undefined
      };
    }
    return q;
  }

  return { from: (table) => query(table), _rows: rows, _state: state };
}

export class LocalError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
export const BackendError = LocalError;

export function errorResponse(error, requestId) {
  const status = error instanceof LocalError ? error.status : 500;
  return Response.json({ error: error instanceof LocalError ? error.code : "internal_error", request_id: requestId }, { status });
}
