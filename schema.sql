-- 反刍打断 · 匿名上报表（app.events）
-- 只使用迁移 API 支持的子集：CREATE TABLE app.<t> / 普通 CREATE INDEX。
-- 类型限定 boolean|integer|bigint|text|uuid|timestamptz|jsonb（日期用 text YYYY-MM-DD）。
-- 不放 CHECK、不放生成列、不放种子数据；访问权全部由 Function 持有，
-- 迁移计划的 accessPolicies 为空数组，匿名与登录角色都拿不到表权限。

CREATE TABLE app.events (
  id uuid PRIMARY KEY,
  device_id text NOT NULL,
  entry_date text NOT NULL,
  kind text NOT NULL,
  level_score integer,
  card_id text,
  before_score integer,
  after_score integer,
  created_at timestamptz NOT NULL
);

CREATE INDEX events_entry_date_idx ON app.events (entry_date);
CREATE INDEX events_created_at_idx ON app.events (created_at);
