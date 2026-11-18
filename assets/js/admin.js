/* 全站匿名汇总页：只读 GET /api/report，不写任何数据、不放任何脚本第三方 */
(function () {
  "use strict";
  var CFG = window.RUMI_CONFIG || {};
  var D = window.RUMI_DATA || { cards: [] };
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var cardName = function (id) {
    var c = D.cards.filter(function (x) { return x.id === id; })[0];
    return c ? c.title : id;
  };
  var days = 14;

  function kpis(r) {
    var items = [
      [r.devices, "开启上传的设备"],
      [r.person_days, "人·日样本"],
      [r.events, "收到事件"],
      [r.mean_level === null ? "—" : r.mean_level, "平均强度 /10"],
      [r.mean_drop === null ? "—" : r.mean_drop, "打断后平均降分"]
    ];
    $("#kpis").innerHTML = items.map(function (p) {
      return '<div class="akpi"><b>' + esc(p[0]) + "</b><span>" + esc(p[1]) + "</span></div>";
    }).join("");
  }

  function trend(r) {
    var list = r.per_day || [];
    if (list.length < 2) { $("#trend").innerHTML = '<div class="aempty">天数不足 2 天，画不出走势。</div>'; return; }
    var W = 960, H = 180, P = 26, n = list.length;
    var x = function (i) { return P + i * (W - 2 * P) / (n - 1); };
    var y = function (v) { return H - P - (v / 10) * (H - 2 * P); };
    var pts = [];
    list.forEach(function (d, i) { if (d.mean_level !== null) pts.push({ cx: x(i), cy: y(d.mean_level) }); });
    var maxB = Math.max(1, list.reduce(function (a, d) { return Math.max(a, d.breaks || 0); }, 0));
    var bw = (W - 2 * P) / n * 0.5;
    var bars = list.map(function (d, i) {
      var h = (d.breaks || 0) / maxB * (H - 2 * P) * 0.4;
      return h > 0 ? '<rect x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + (H - P - h).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="var(--primary)" opacity=".22"/>' : "";
    }).join("");
    var line = pts.length > 1 ? '<polyline points="' + pts.map(function (p) { return p.cx.toFixed(1) + "," + p.cy.toFixed(1); }).join(" ") +
      '" fill="none" stroke="var(--primary)" stroke-width="2.4" stroke-linejoin="round"/>' : "";
    var dots = pts.map(function (p) { return '<circle cx="' + p.cx.toFixed(1) + '" cy="' + p.cy.toFixed(1) + '" r="3.6" fill="var(--primary)"/>'; }).join("");
    var ticks = [0, Math.floor(n / 2), n - 1].filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (i) {
      return '<text x="' + x(i).toFixed(1) + '" y="' + (H - 4) + '" font-size="11" fill="var(--muted)" text-anchor="' +
        (i === 0 ? "start" : i === n - 1 ? "end" : "middle") + '">' + esc(list[i].day) + "</text>";
    }).join("");
    var grid = [5, 10].map(function (v) {
      return '<line x1="' + P + '" y1="' + y(v) + '" x2="' + (W - P) + '" y2="' + y(v) + '" stroke="var(--line)" stroke-dasharray="3 4"/>' +
        '<text x="' + (P - 8) + '" y="' + (y(v) + 4) + '" font-size="11" fill="var(--muted)" text-anchor="end">' + v + "</text>";
    }).join("") + '<text x="' + (P - 8) + '" y="' + (y(0) + 4) + '" font-size="11" fill="var(--muted)" text-anchor="end">0</text>';
    $("#trend").innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="每日平均强度折线与打断次数柱状" style="width:100%;height:auto">' +
      grid + bars + '<line x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '" stroke="var(--line)"/>' +
      line + dots + ticks + "</svg>" +
      '<p style="margin:8px 0 0;font-size:var(--fs-xs);color:var(--muted)">实线＝全站当日平均强度（左轴 0–10）；浅色柱＝当日打断次数（只比相对高低）。</p>';
  }

  function hist(r) {
    var h = r.level_hist || [];
    if (!h.some(function (v) { return v > 0; })) { $("#hist").innerHTML = '<div class="aempty">这段时间没有强度打分。</div>'; return; }
    var max = Math.max.apply(null, h.concat([1]));
    $("#hist").innerHTML = '<div class="abars">' + h.map(function (v, i) {
      return '<div class="abar"><span>' + i + " 分</span><span class=\"track\"><i class=\"fill\" style=\"width:" +
        Math.round(v / max * 100) + '%"></i></span><span class="val">' + v + "</span></div>";
    }).join("") + "</div>";
  }

  function cardsTable(r) {
    var list = r.cards || [];
    if (!list.length) { $("#cards").innerHTML = '<div class="aempty">这段时间没有带打分的打断记录。</div>'; return; }
    $("#cards").innerHTML = '<table class="atable"><thead><tr><th>卡片</th><th class="n">使用</th><th class="n">平均降分</th></tr></thead><tbody>' +
      list.map(function (c) {
        return "<tr><td>" + esc(cardName(c.id)) + '</td><td class="n">' + esc(c.uses) +
          "</td><td class=\"n\">" + (c.mean_drop === null ? "—" : esc(c.mean_drop)) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function notes(r) {
    var base = [
      "<b>来源</b>：只有在本机「我的 → 数据与隐私」里主动开启上传的设备才会贡献数字；默认是关闭的。",
      "<b>字段</b>：日期、强度 0–10、卡片编号、打断前后各几分、随机设备代号。库里<b>没有任何文字</b>——日志、书写、量表答题、陪练对话都不会进入这些数字。",
      "<b>门槛</b>：开启上传的设备少于 5 台时，接口只回总数，不再生成分日、分组和卡片明细，避免小样本反推到个人。",
      "<b>保留</b>：超过 30 天的记录由接口在写入时顺手清理，不做永久留存。",
      "<b>不做</b>：没有排行、没有个体查询接口，这一页也无法看到任何一台设备的单独数据。"
    ];
    if (r && r.truncated) base.push("<b>注意</b>：本期数据量超过了单次读取上限（2000 条），下面的数字是按截断后的样本算的，会偏低。");
    if (r && r.insufficient) base.push("<b>当前状态</b>：样本不足，明细分组未生成。");
    $("#notes").innerHTML = base.map(function (t) { return "<li>" + t + "</li>"; }).join("");
  }

  function status(text, bad) {
    var el = $("#status");
    el.className = "astatus" + (bad ? " bad" : "");
    el.textContent = text;
  }

  function load() {
    if (!CFG.apiBase) {
      status("这个地址（" + location.hostname + "）是静态演示，没有汇总接口。要看真实数字请用正式站点。", true);
      $("#kpis").innerHTML = ""; $("#trend").innerHTML = ""; $("#hist").innerHTML = ""; $("#cards").innerHTML = "";
      notes(null);
      return;
    }
    status("正在读取……");
    var ctl = ("AbortController" in window) ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, CFG.timeoutMs || 8000) : null;
    fetch(CFG.apiBase + "/api/report?days=" + days, { headers: { accept: "application/json" }, signal: ctl ? ctl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("http " + res.status);
        return res.json();
      })
      .then(function (r) {
        kpis(r); trend(r); hist(r); cardsTable(r); notes(r);
        status("近 " + r.days + " 天 · 生成于 " + String(r.generated_at || "").slice(0, 16).replace("T", " ") + " UTC" +
          (r.insufficient ? " · 样本不足，明细未生成" : ""), false);
      })
      .catch(function (e) {
        status("汇总接口没响应（" + e.message + "）。稍后点右上角刷新。", true);
        notes(null);
      })
      .then(function () { if (timer) clearTimeout(timer); });
  }

  $("#range").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-days]");
    if (!b) return;
    days = +b.dataset.days;
    Array.prototype.forEach.call(this.querySelectorAll("[data-days]"), function (x) { x.classList.toggle("on", x === b); });
    load();
  });
  $("#refresh").addEventListener("click", load);
  load();
})();
