/* 视图层：路由、存储、卡片交互、计时、图表、陪练对话 */
(function (D, E) {
  "use strict";

  /* ---------------- 存储 ---------------- */
  var K = D.storageKey;
  function blank() {
    return { checks: [], breaks: [], journal: [], actions: [], writing: [], scale: null, coach: [], coachState: { node: "s1", done: false }, worry: { time: "19:30", list: "" }, nextCard: { fixed: "", mine: "", act: "" } };
  }
  var S = (function () {
    try {
      var raw = localStorage.getItem(K);
      if (!raw) return blank();
      var s = JSON.parse(raw), b = blank();
      Object.keys(b).forEach(function (k) { if (s[k] === undefined) s[k] = b[k]; });
      return s;
    } catch (e) { return blank(); }
  })();
  function save() {
    try { localStorage.setItem(K, JSON.stringify(S)); }
    catch (e) { toast("存不下了：浏览器可能禁用了本地存储"); }
  }

  /* ---------------- 小工具 ---------------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var view = $("#view"), pageTitle = $("#pageTitle"), pageSub = $("#pageSub"), backBtn = $("#back");

  var TITLES = {
    today: ["今天", "先量一下，再决定要不要接着想"],
    break: ["打断", "8 张卡，挑一张现在就能做的"],
    journal: ["记录", "把“重复”和“可行动”分开存"],
    scale: ["自评", "我常做哪一种“想”"],
    talk: ["陪练", "本地预设流程，不联网"],
    more: ["我的", "数据、求助、来源"],
    help: ["求助", "现在就需要人的时候"],
    parents: ["家长 / 老师", "孩子绕圈时你能做的"],
    sources: ["来源与局限", "哪些话有出处，哪些没有"],
    privacy: ["数据与隐私", "一切都在这台设备上"]
  };

  var flashTimer = null;
  function toast(msg) {
    var f = $(".flash");
    if (!f) { f = document.createElement("div"); f.className = "flash"; document.body.appendChild(f); }
    f.textContent = msg; f.classList.add("on");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { f.classList.remove("on"); }, 1900);
  }

  var timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }
  function every(ms, fn) { timers.push(setInterval(fn, ms)); }
  function fmt(s) { s = Math.ceil(s); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" + (s % 60) : s % 60); }

  /* 每个视图自己注册一个点击委托，切换路由时先清掉，避免监听堆积 */
  var clickHook = null;
  view.addEventListener("click", function (ev) { if (clickHook) clickHook(ev); });

  /* ---------------- 弹层 ---------------- */
  var sheet = $("#sheet"), sheetBody = $("#sheetBody");
  function openSheet(html) {
    sheetBody.innerHTML = '<button class="x" type="button" data-close aria-label="关闭">×</button>' + html;
    sheet.hidden = false; sheetBody.scrollTop = 0;
  }
  function closeSheet() { sheet.hidden = true; sheetBody.innerHTML = ""; clearTimers(); }
  sheet.addEventListener("click", function (ev) { if (ev.target.hasAttribute("data-close")) closeSheet(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !sheet.hidden) closeSheet(); });

  /* ---------------- 图表 ---------------- */
  function last14() {
    var days = E.lastNDays(14);
    return {
      days: days,
      levels: days.map(function (d) {
        var xs = S.checks.filter(function (c) { return c.day === d; });
        return xs.length ? xs.reduce(function (a, c) { return a + c.level; }, 0) / xs.length : null;
      }),
      breaks: days.map(function (d) { return S.breaks.filter(function (b) { return E.dayKey(b.ts) === d; }).length; })
    };
  }
  function spark(days, values, breaks) {
    var W = 320, H = 110, P = 10, n = days.length;
    var x = function (i) { return P + i * (W - 2 * P) / (n - 1); };
    var y = function (v) { return H - P - (v / 10) * (H - 2 * P); };
    var pts = [];
    values.forEach(function (v, i) { if (v !== null) pts.push({ cx: x(i), cy: y(v) }); });
    var barW = (W - 2 * P) / n * 0.55;
    var bars = breaks.map(function (b, i) {
      var h = Math.min(b, 4) / 4 * (H - 2 * P) * 0.45;
      return h > 0 ? '<rect class="barx" x="' + (x(i) - barW / 2).toFixed(1) + '" y="' + (H - P - h).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"/>' : "";
    }).join("");
    var line = pts.length > 1 ? '<polyline class="line" points="' + pts.map(function (p) { return p.cx.toFixed(1) + "," + p.cy.toFixed(1); }).join(" ") + '"/>' : "";
    var dots = pts.map(function (p) { return '<circle class="dot" cx="' + p.cx.toFixed(1) + '" cy="' + p.cy.toFixed(1) + '" r="3.2"/>'; }).join("");
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="最近 14 天：折线为每日反刍强度均值，柱子为每日打断次数">' +
      bars + '<line class="axis" x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '"/>' +
      '<line class="axis" x1="' + P + '" y1="' + y(5) + '" x2="' + (W - P) + '" y2="' + y(5) + '" stroke-dasharray="3 4"/>' + line + dots + "</svg>";
  }
  function trendBlock() {
    var g = last14();
    var vals = g.levels.filter(function (v) { return v !== null; });
    var brkTotal = g.breaks.reduce(function (a, b) { return a + b; }, 0);
    var scored = S.breaks.filter(function (b) { return typeof b.after === "number"; });
    var drop = scored.length ? (scored.reduce(function (a, b) { return a + (b.before - b.after); }, 0) / scored.length).toFixed(1) : "—";
    if (!vals.length && !brkTotal) return '<div class="empty">还没有数据。打一次卡、用一次卡片，这里就有东西。</div>';
    return spark(g.days, g.levels, g.breaks) +
      '<div class="stats"><div class="stat"><b>' + (vals.length ? (vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(1) : "—") + "</b><span>两周平均强度</span></div>" +
      '<div class="stat"><b>' + brkTotal + "</b><span>两周打断次数</span></div>" +
      '<div class="stat"><b>' + drop + "</b><span>每次平均降(分)</span></div></div>";
  }

  /* ---------------- 危机卡 ---------------- */
  function crisisHTML() {
    return '<div class="crisis"><h3>先处理安全，再处理想法</h3><ol>' +
      D.help.steps.map(function (s) { return "<li>" + E.esc(s) + "</li>"; }).join("") + "</ol>" +
      D.help.lines.map(function (l) {
        return '<a class="hotline" href="' + l.tel + '">' + E.esc(l.num) + "</a>" +
          '<p class="tiny">' + E.esc(l.name) + " · " + E.esc(l.note) + "</p>";
      }).join("") + "</div>";
  }

  /* ---------------- 卡片行 ---------------- */
  function cardItem(c) {
    if (!c) return "";
    return '<a class="card item tap" href="#/card/' + c.id + '"><div class="glyph ' + (c.tone || "") + '">' + E.esc(c.glyph) + "</div>" +
      '<div class="grow"><h3>' + E.esc(c.title) + "</h3><p>" + E.esc(c.for) + " · " + E.esc(c.time) + '</p></div><span class="chev">›</span></a>';
  }
  function menu(href, glyph, title, sub, tone) {
    return '<a class="card item tap" href="' + href + '"><div class="glyph ' + (tone || "") + '">' + E.esc(glyph) + "</div>" +
      '<div class="grow"><h3>' + E.esc(title) + "</h3><p>" + E.esc(sub) + '</p></div><span class="chev">›</span></a>';
  }

  /* =========================================================
     今天
  ========================================================= */
  var ACT_SUGGEST = [
    { kind: "愉悦", t: "下楼走 10 分钟，不戴耳机" },
    { kind: "愉悦", t: "放一首以前的歌，听完再干别的" },
    { kind: "愉悦", t: "给一个朋友发条消息，只发一句" },
    { kind: "成就", t: "把最烦的那件事做 10 分钟" },
    { kind: "成就", t: "整理桌面 5 分钟" },
    { kind: "成就", t: "重做昨天错的那道题的前两问" }
  ];

  function vToday() {
    var today = E.dayKey();
    var checks = S.checks.filter(function (c) { return c.day === today; });
    var last = checks[checks.length - 1];
    var level = last ? last.level : 4;
    var band = E.levelBand(level);
    var chosen = last ? last.trigger : "";

    view.innerHTML =
      '<section class="sec"><div class="card pad-lg">' +
      '<div class="row between"><div><span class="small muted">现在脑子里绕圈的强度</span>' +
      '<div class="big" id="lvNum">' + level + '<span class="small" style="font-weight:400"> / 10</span></div>' +
      '<span class="pill" id="lvPill">' + E.esc(band.label) + "</span></div>" +
      '<div style="text-align:right"><span class="small muted">今天打卡</span><div class="big" id="todayCount">' + checks.length + "</div></div></div>" +
      '<input class="slider" type="range" min="0" max="10" step="1" value="' + level + '" id="lv" aria-label="反刍强度 0 到 10">' +
      '<div class="scalelabels"><span>0 很清醒</span><span>5 在绕</span><span>10 全被占住</span></div>' +
      '<p class="small" id="lvTip" style="margin:10px 0 0">' + E.esc(band.tip) + "</p></div></section>" +

      '<section class="sec"><h2>是什么在让你绕</h2><p class="hint">选一个就好，不用准。选完再写下面那句。</p>' +
      '<div class="chips" id="trig">' + D.triggers.map(function (t) {
        return '<span class="chip' + (t === chosen ? " on" : "") + '" data-t="' + E.esc(t) + '">' + E.esc(t) + "</span>";
      }).join("") + "</div>" +
      '<div class="card" style="margin-top:12px"><label class="f" for="said">这两分钟里，脑子里那句话是什么？</label>' +
      '<textarea id="said" rows="3" placeholder="照原样写，包括你觉得最难听的那句。例：考砸了，我是不是就是不行，越想越停不下来"></textarea>' +
      '<div id="saidOut" style="margin-top:10px"></div>' +
      '<div class="btns" style="margin-top:12px"><button class="btn" id="saveCheck" type="button">存下这次打卡</button>' +
      '<a class="btn ghost" href="#/talk">找人聊聊</a></div></div></section>' +

      '<section class="sec" id="suggestBox"></section>' +

      '<section class="sec"><h2>今天的一件小事</h2><p class="hint">反刍的反面常常不是“想通”，是“做了点别的”。挑一个或自己写。</p>' +
      '<div class="chips" id="actChip">' + ACT_SUGGEST.map(function (a, i) {
        return '<span class="chip" data-i="' + i + '">' + E.esc(a.kind) + "：" + E.esc(a.t) + "</span>";
      }).join("") + "</div>" +
      '<div class="card" style="margin-top:12px"><div class="row between"><div class="grow">' +
      '<strong id="actTxt" style="font-size:15px">还没选</strong><p class="tiny" id="actMeta"></p></div>' +
      '<button class="btn sm" id="actSave" type="button">加上</button></div>' +
      '<input type="text" id="actOwn" placeholder="或自己写一件，带动词和时间" style="margin-top:10px"></div>' +
      '<div class="list" style="margin-top:10px" id="actList"></div></section>' +

      '<section class="sec"><h2>最近两周</h2><p class="hint">折线=每日强度均值，柱子=每日打断次数。趋势比某一天重要。</p>' +
      '<div class="card">' + trendBlock() + "</div></section>";

    var lv = $("#lv"), said = $("#said");
    lv.addEventListener("input", function () {
      var b = E.levelBand(+lv.value);
      $("#lvNum").innerHTML = lv.value + '<span class="small" style="font-weight:400"> / 10</span>';
      $("#lvPill").textContent = b.label;
      $("#lvTip").textContent = b.tip;
      renderSaid();
    });
    $("#trig").addEventListener("click", function (ev) {
      var c = ev.target.closest(".chip"); if (!c) return;
      $$("#trig .chip").forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on"); chosen = c.dataset.t;
    });

    function renderSaid() {
      var text = said.value;
      var box = $("#saidOut"), sg = $("#suggestBox");
      if (!text.trim()) { box.innerHTML = ""; sg.innerHTML = ""; return; }
      var crisis = E.isCrisis(text);
      if (crisis.length) {
        box.innerHTML = '<span class="pill warn">我注意到这些词：' + crisis.map(E.esc).join("、") + "</span>";
        sg.innerHTML = "<h2>这一段先交给人</h2>" + crisisHTML() +
          '<p class="tiny" style="margin-top:8px">这一轮不给你卡片。这段文字只存在本机，没有发出去；拨号是你手机自己的动作。</p>';
        return;
      }
      var c = E.classify(text);
      var cls = c.kind === "repeat" ? "acc" : c.kind === "action" ? "" : "blue";
      box.innerHTML = '<span class="pill ' + cls + '">' + E.KIND_LABEL[c.kind] + "</span> " +
        '<span class="tiny">' + E.esc(c.reason) + "</span>" +
        (c.repeat.length ? '<p class="tiny">重复标记：' + c.repeat.map(E.esc).join("、") + "</p>" : "") +
        (c.action.length ? '<p class="tiny">行动标记：' + c.action.map(E.esc).join("、") + "</p>" : "");
      var s = E.suggest(+lv.value, text);
      sg.innerHTML = "<h2>现在最省力的两个动作</h2><div class=\"list\">" +
        s.cards.map(function (id) { return cardItem(D.cards.filter(function (x) { return x.id === id; })[0]); }).join("") + "</div>";
    }
    said.addEventListener("input", renderSaid);
    renderSaid();

    $("#saveCheck").addEventListener("click", function () {
      var text = said.value.trim();
      S.checks.push({ ts: Date.now(), day: E.dayKey(), level: +lv.value, trigger: chosen || "", note: text, kind: text ? E.classify(text).kind : "" });
      save();
      $("#todayCount").textContent = S.checks.filter(function (c) { return c.day === E.dayKey(); }).length;
      said.value = ""; renderSaid();
      toast("已存下：强度 " + lv.value + "/10");
    });

    var picked = null;
    $("#actChip").addEventListener("click", function (ev) {
      var c = ev.target.closest(".chip"); if (!c) return;
      $$("#actChip .chip").forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on");
      picked = { kind: ACT_SUGGEST[+c.dataset.i].kind, t: ACT_SUGGEST[+c.dataset.i].t };
      $("#actTxt").textContent = picked.t;
      $("#actMeta").textContent = picked.kind + " · 今天";
    });
    $("#actOwn").addEventListener("input", function () {
      var v = $("#actOwn").value.trim();
      if (!v) return;
      picked = { kind: "自己写的", t: v };
      $("#actTxt").textContent = v; $("#actMeta").textContent = "自己写的 · 今天";
    });
    $("#actSave").addEventListener("click", function () {
      if (!picked) { toast("先挑一个，或在框里写一句"); return; }
      S.actions.push({ id: Date.now(), day: E.dayKey(), kind: picked.kind, t: picked.t, done: false });
      save(); picked = null;
      $("#actOwn").value = "";
      $$("#actChip .chip").forEach(function (x) { x.classList.remove("on"); });
      $("#actTxt").textContent = "还没选"; $("#actMeta").textContent = "";
      renderActions(); toast("加进今天了");
    });
    function renderActions() {
      var list = S.actions.filter(function (a) { return a.day === E.dayKey(); }).reverse();
      $("#actList").innerHTML = list.length ? list.map(function (a) {
        return '<div class="card item tap" data-id="' + a.id + '"><div class="glyph' + (a.kind === "成就" ? " b" : a.done ? " b" : "") + '">' + (a.done ? "✓" : "·") + "</div>" +
          '<div class="grow"><h3 style="' + (a.done ? "opacity:.55;text-decoration:line-through" : "") + '">' + E.esc(a.t) + "</h3>" +
          '<p class="tiny">' + E.esc(a.kind) + (a.done ? " · 已完成" : " · 点一下算完成") + "</p></div></div>";
      }).join("") : '<div class="empty">今天还没有小动作。强度高的日子，做成一件 5 分钟的事比想通一件事有用。</div>';
    }
    renderActions();
    $("#actList").addEventListener("click", function (ev) {
      var it = ev.target.closest(".item"); if (!it) return;
      var a = S.actions.filter(function (x) { return String(x.id) === it.dataset.id; })[0];
      if (!a) return;
      a.done = !a.done; if (a.done) a.doneTs = Date.now();
      save(); renderActions();
    });

    clickHook = null;
  }

  /* =========================================================
     打断：列表 + 单卡
  ========================================================= */
  function vBreak() {
    var today = E.dayKey();
    var used = S.breaks.filter(function (b) { return E.dayKey(b.ts) === today; });
    var lastCard = used.length ? (D.cards.filter(function (c) { return c.id === used[used.length - 1].cardId; })[0] || {}) : null;
    view.innerHTML =
      '<section class="sec"><div class="card"><strong style="font-size:15px">今天已经打断 ' + used.length + " 次</strong>" +
      '<p class="tiny" style="margin-top:3px">' + (used.length
        ? "最近一次：" + E.esc(lastCard.title || "") + "，" + used[used.length - 1].before + " → " + used[used.length - 1].after + " 分"
        : "从下面挑一张。不用等到最难堪的时候才用。") + "</p>" +
      '<div class="bar" style="margin-top:12px"><i style="width:' + Math.min(used.length / 5 * 100, 100) + '%"></i></div>' +
      '<p class="tiny">一天 3 次就比昨天好，5 次以内都算正常。</p></div></section>' +
      '<section class="sec"><h2>8 张卡</h2><p class="hint">强度 8 以上先做着陆或呼吸，别做要写字的。</p>' +
      '<div class="list">' + D.cards.map(cardItem).join("") + "</div></section>" +
      '<section class="sec"><h2>什么时候用哪张</h2><div class="card"><table style="width:100%;border-collapse:collapse;font-size:13.4px">' +
      [["上课中突然开始绕", "land / count（不出声的两个）"],
      ["放学回家路上反复", "move / place（身体先进）"],
      ["躺床上停不下来", "breath / worrytime（明天再想）"],
      ["一件事想了三遍以上", "camera / next（换机位，再翻译成一个动作）"]].map(function (r) {
        return '<tr><td style="padding:8px 0;border-bottom:1px solid var(--line);color:var(--muted)">' + E.esc(r[0]) +
          '</td><td style="padding:8px 0;border-bottom:1px solid var(--line);text-align:right">' + E.esc(r[1]) + "</td></tr>";
      }).join("") + "</table></div></section>";
    clickHook = null;
  }

  function vCard(id) {
    var c = D.cards.filter(function (x) { return x.id === id; })[0];
    if (!c) { location.hash = "#/break"; return; }
    view.innerHTML =
      '<section class="sec"><div class="card pad-lg"><span class="pill">' + E.esc(c.time) + "</span>" +
      '<h2 style="margin:8px 0 2px;font-size:21px">' + E.esc(c.title) + "</h2>" +
      '<p class="small muted">' + E.esc(c.for) + '</p><p class="why">' + E.esc(c.why) + "</p></div></section>" +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:15.5px">怎么做</h2>' +
      '<ol class="steps">' + c.steps.map(function (s) { return "<li>" + E.esc(s) + "</li>"; }).join("") + "</ol>" +
      '<div id="toolBox" style="margin-top:14px"></div></div></section>' +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 10px;font-size:15.5px">做完记一下</h2>' +
      '<label class="f">做之前 <b class="pill" id="b4v">5</b></label>' +
      '<input class="slider" type="range" min="0" max="10" value="5" id="before" aria-label="做之前强度">' +
      '<label class="f" style="margin-top:10px">做之后 <b class="pill" id="a4v">5</b></label>' +
      '<input class="slider" type="range" min="0" max="10" value="5" id="after" aria-label="做之后强度">' +
      '<button class="btn" id="record" type="button" style="margin-top:12px">存这一条</button>' +
      '<p class="tiny" style="margin-top:8px">降 1 分也算。别为了数字好看把前面打高。</p></div></section>' +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:15.5px">依据</h2>' +
      c.refs.map(function (r) { return '<p class="ref">' + E.esc(r) + "</p>"; }).join("") + "</div></section>" +
      '<div class="btns"><a class="btn ghost" href="#/break">换一张</a><a class="btn soft" href="#/talk">边做边聊</a></div>';

    var box = $("#toolBox");
    clearTimers();
    if (c.breath) breathUI(box, c);
    else if (c.id === "worrytime") worryUI(box);
    else if (c.id === "next") nextUI(box);
    else if (c.id === "land") timerUI(box, 120, "2 分钟");
    else timerUI(box, 60, "60 秒");

    var b = $("#before"), a = $("#after");
    b.addEventListener("input", function () { $("#b4v").textContent = b.value; });
    a.addEventListener("input", function () { $("#a4v").textContent = a.value; });
    $("#record").addEventListener("click", function () {
      S.breaks.push({ ts: Date.now(), cardId: c.id, before: +b.value, after: +a.value });
      save(); toast("存下了，降 " + (+b.value - +a.value) + " 分");
      b.value = a.value; $("#b4v").textContent = a.value;
    });
    clickHook = null;
  }

  function timerUI(box, seconds, label) {
    var left = seconds, running = false;
    box.innerHTML = '<div class="ring"><button class="btn sm" id="tbtn" type="button">开始 ' + E.esc(label) + "</button>" +
      '<span class="num" id="tnum">' + fmt(seconds) + '</span><span class="tiny">做完再打分</span></div><div class="bar"><i id="tbar"></i></div>';
    $("#tbtn", box).addEventListener("click", function () {
      var btn = this;
      if (left <= 0) left = seconds;
      running = !running;
      btn.textContent = running ? "暂停" : "继续";
      if (!running) { clearTimers(); btn.textContent = "继续"; return; }
      every(250, function () {
        left = Math.max(0, left - 0.25);
        $("#tnum").textContent = fmt(left);
        $("#tbar").style.width = ((seconds - left) / seconds * 100) + "%";
        if (left === 0) {
          clearTimers(); running = false;
          btn.textContent = "再来一轮";
          toast("时间到，去打分");
        }
      });
    });
  }

  function breathUI(box, c) {
    var b = c.breath, period = b.inhale + b.exhale, left = b.seconds, on = false, t = 0;
    box.innerHTML = '<div class="breath"><div class="orb" id="orb">准备</div></div>' +
      '<div class="row between" style="margin-top:6px"><button class="btn sm" id="bstart" type="button">开始</button>' +
      '<span class="tiny" id="bleft">共 ' + b.seconds + " 秒 · 吸 " + b.inhale + " / 呼 " + b.exhale + "</span></div>";
    var orb = $("#orb", box), inhaling = null;
    $("#bstart", box).addEventListener("click", function () {
      var btn = this;
      on = !on;
      if (left <= 0) { left = b.seconds; }
      btn.textContent = on ? "停下" : "继续";
      if (!on) { clearTimers(); orb.textContent = "暂停"; orb.className = "orb"; return; }
      every(100, function () {
        t += 0.1; left = Math.max(0, left - 0.1);
        var ph = t % period, nowIn = ph < b.inhale;
        if (nowIn !== inhaling) {
          inhaling = nowIn;
          orb.style.transitionDuration = (nowIn ? b.inhale : b.exhale) + "s";
          orb.className = nowIn ? "orb in" : "orb out";
        }
        orb.textContent = nowIn ? "吸气 " + Math.ceil(b.inhale - ph) : "呼气 " + Math.ceil(period - ph);
        $("#bleft").textContent = "剩余 " + Math.ceil(left) + " 秒 · 吸 " + b.inhale + " / 呼 " + b.exhale;
        if (left === 0) { clearTimers(); on = false; orb.textContent = "好了"; orb.className = "orb"; btn.textContent = "再来一轮"; toast("呼吸练习完成，去打分"); }
      });
    });
  }

  function worryUI(box) {
    box.innerHTML = '<label class="f">把“专门想”约在几点</label><div class="row">' +
      '<input type="text" id="wt" style="flex:1"><button class="btn sm" id="wtsave" type="button">存这一页</button></div>' +
      '<p class="tiny" id="wtnote" style="margin-top:6px"></p><div class="divider"></div>' +
      '<label class="f">到点前冒出来的念头：只写一行标题，不展开</label>' +
      '<textarea id="wtlist" rows="5" placeholder="一行一个"></textarea>';
    $("#wt", box).value = S.worry.time;
    $("#wtlist", box).value = S.worry.list;
    function note() {
      $("#wtnote", box).textContent = "当前约定：" + S.worry.time + " · 已记 " +
        S.worry.list.split("\n").filter(function (x) { return x.trim(); }).length + " 条";
    }
    note();
    $("#wtsave", box).addEventListener("click", function () {
      S.worry.time = $("#wt", box).value.trim() || "19:30";
      S.worry.list = $("#wtlist", box).value;
      save(); note(); toast("约好了");
    });
    $("#wtlist", box).addEventListener("input", function () { S.worry.list = this.value; save(); note(); });
  }

  function nextUI(box) {
    var fields = [
      ["fixed", "已经定死了、改不了的部分", "例：分数已经出来了，改不了"],
      ["mine", "还在我手里的部分", "例：剩下两道题、明天怎么跟老师说"],
      ["act", "今天的最小动作（动词 + 时间 + 能判断做完没）", "例：20:30 做 15 分钟，只做前两问"]
    ];
    box.innerHTML = fields.map(function (f) {
      return '<label class="f">' + E.esc(f[1]) + '</label><input type="text" data-k="' + f[0] + '" value="' + E.esc(S.nextCard[f[0]] || "") + '" placeholder="' + E.esc(f[2]) + '" style="margin-bottom:10px">';
    }).join("") + '<button class="btn sm" id="nextcheck" type="button">检查这三句</button><p class="tiny" id="nextout" style="margin-top:8px"></p>';
    $$("input[data-k]", box).forEach(function (inp) {
      inp.addEventListener("input", function () { S.nextCard[inp.dataset.k] = inp.value; save(); });
    });
    $("#nextcheck", box).addEventListener("click", function () {
      var act = S.nextCard.act || "";
      var c = E.classify(act);
      var hasTime = /\d|今天|明天|晚上|上午|下午|点/.test(act);
      $("#nextout", box).innerHTML = !act.trim() ? "第三句还没写。" :
        (c.action.length && hasTime ? "可以 · 抓到「" + c.action.slice(0, 3).map(E.esc).join("、") + "」。放手机，先做 5 分钟。"
          : "还是偏愿望。缺" + (!hasTime ? "时间点" : "动作词") + "，改一下再存。");
      toast(act.trim() ? (c.action.length && hasTime ? "动作成立" : "再具体一点") : "先写第三句");
    });
  }

  /* =========================================================
     记录
  ========================================================= */
  function jRow(j) {
    var cls = j.kind === "repeat" ? "acc" : j.kind === "action" ? "" : "blue";
    var glyph = j.kind === "repeat" ? "↻" : j.kind === "action" ? "→" : "?";
    return '<div class="card item"><div class="glyph' + (j.kind === "repeat" ? " a" : j.kind === "action" ? " b" : "") + '">' + glyph + "</div>" +
      '<div class="grow"><div class="row between"><span class="pill ' + cls + '">' + E.KIND_LABEL[j.kind] + "</span>" +
      '<span class="tiny">' + new Date(j.ts).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + "</span></div>" +
      '<p style="color:var(--ink);font-size:14px;margin:6px 0 0;white-space:pre-wrap">' + E.esc(j.text) + "</p>" +
      (j.words && j.words.length ? '<p class="tiny">命中：' + j.words.map(E.esc).join("、") + "</p>" : "") +
      (j.why && j.why.indexOf("陪练") > -1 ? '<p class="tiny">来源：陪练最后一步</p>' : "") +
      '<div class="row wrap" style="gap:8px;margin-top:8px">' +
      '<button class="btn sm ghost" type="button" data-set="' + j.ts + '" data-to="repeat">改成“在重复”</button>' +
      '<button class="btn sm ghost" type="button" data-set="' + j.ts + '" data-to="action">改成“可行动”</button>' +
      '<button class="btn sm ghost" type="button" data-del="' + j.ts + '">删</button></div></div></div>';
  }

  function vJournal() {
    view.innerHTML =
      '<section class="sec"><div class="card"><label class="f" for="jtext">刚才绕了一圈的事，写下来</label>' +
      '<textarea id="jtext" rows="4" placeholder="写得越原样越好，包括你觉得丢人的那句"></textarea>' +
      '<div id="jout" style="margin-top:10px"></div>' +
      '<div class="btns" style="margin-top:10px"><button class="btn" id="jsave" type="button">存进记录</button>' +
      '<a class="btn ghost" href="#/talk">聊聊</a></div></div></section>' +
      '<section class="sec"><h2>两周走势</h2><div class="card">' + trendBlock() + "</div></section>" +
      '<section class="sec"><h2>表达性书写（4 天，每次 15–20 分钟）</h2>' +
      '<p class="hint">可选。写了更难受就停 —— 这是本工具里的明确规则，不算失败。</p>' +
      '<div class="list">' + D.writing.map(function (w, i) {
        var done = (S.writing[i] || {}).text;
        return '<div class="card item tap" data-w="' + i + '"><div class="glyph' + (done ? " b" : "") + '">' + (done ? "✓" : w.day) + "</div>" +
          '<div class="grow"><h3>第 ' + w.day + " 天：" + E.esc(w.title) + (done ? ' <span class="pill">写过</span>' : "") + "</h3>" +
          "<p>" + E.esc(w.prompt) + '</p></div><span class="chev">›</span></div>';
      }).join("") + "</div>" +
      '<p class="tiny" style="margin-top:10px">' + E.esc(D.writingNote) + "</p></section>" +
      '<section class="sec"><h2>全部记录（' + S.journal.length + " 条）</h2>" +
      '<p class="hint">分类由词表规则给出，命中词直接显示；判得不准可以手动改。</p>' +
      '<div class="list" id="jlist">' + (S.journal.length ? S.journal.slice().reverse().map(jRow).join("") : '<div class="empty">还没有记录。上面写一条，就能看到规则怎么判。</div>') + "</div></section>";

    var ta = $("#jtext");
    function preview() {
      var t = ta.value;
      if (!t.trim()) { $("#jout").innerHTML = ""; return; }
      var crisis = E.isCrisis(t);
      if (crisis.length) {
        $("#jout").innerHTML = '<span class="pill warn">这些词让我先停下来：' + crisis.map(E.esc).join("、") + "</span>" + crisisHTML();
        return;
      }
      var c = E.classify(t);
      var cls = c.kind === "repeat" ? "acc" : c.kind === "action" ? "" : "blue";
      $("#jout").innerHTML = '<span class="pill ' + cls + '">' + E.KIND_LABEL[c.kind] + "</span> " +
        '<span class="tiny">' + E.esc(c.reason) + "</span>" +
        (c.repeat.length ? '<p class="tiny">重复：' + c.repeat.map(E.esc).join("、") + "</p>" : "") +
        (c.action.length ? '<p class="tiny">行动：' + c.action.map(E.esc).join("、") + "</p>" : "");
    }
    ta.addEventListener("input", preview);
    $("#jsave").addEventListener("click", function () {
      var t = ta.value.trim(); if (!t) { toast("先写两句"); return; }
      var c = E.classify(t);
      S.journal.push({ ts: Date.now(), text: t, kind: c.kind, why: c.reason, words: c.repeat.concat(c.action) });
      save(); ta.value = ""; preview(); vJournal(); toast("已存");
    });

    clickHook = function (ev) {
      var w = ev.target.closest("[data-w]");
      if (w) { openWriting(+w.dataset.w); return; }
      var del = ev.target.closest("[data-del]");
      if (del) {
        var i = S.journal.map(function (x) { return x.ts; }).indexOf(+del.dataset.del);
        if (i > -1) { S.journal.splice(i, 1); save(); vJournal(); }
        return;
      }
      var set = ev.target.closest("[data-set]");
      if (set) {
        var j = S.journal.filter(function (x) { return x.ts === +set.dataset.set; })[0];
        if (j) { j.kind = set.dataset.to; j.why = "手动改成" + E.KIND_LABEL[j.kind]; save(); vJournal(); }
      }
    };
  }

  function openWriting(i) {
    var w = D.writing[i], rec = S.writing[i] || {};
    openSheet('<h2>第 ' + w.day + " 天：" + E.esc(w.title) + '</h2><p class="small muted">' + E.esc(w.prompt) + "</p>" +
      '<textarea id="wtext" rows="10" placeholder="想到什么写什么，不用通顺，不用给别人看">' + E.esc(rec.text || "") + "</textarea>" +
      '<div class="btns" style="margin-top:12px"><button class="btn" id="wsave" type="button">存这一篇</button>' +
      '<button class="btn ghost" type="button" data-close>今天不写</button></div>' +
      '<p class="tiny" style="margin-top:10px">只存在这台设备的 localStorage。写完更难受，先去打断页做 5-4-3-2-1；如果持续变糟，考虑专业帮助。</p>');
    $("#wsave").addEventListener("click", function () {
      S.writing[i] = { day: w.day, title: w.title, text: $("#wtext").value, ts: Date.now() };
      save(); closeSheet(); vJournal(); toast("存下了");
    });
  }

  /* =========================================================
     自评
  ========================================================= */
  function resHTML(r) {
    var band = D.scale.bands.filter(function (b) { return r.brood <= b.max; })[0] || D.scale.bands[D.scale.bands.length - 1];
    var ratio = Math.round(r.brood / (r.brood + r.reflect) * 100);
    return '<div class="card pad-lg"><div class="row between"><div><span class="small muted">总分（只作参考）</span>' +
      '<div class="big">' + r.total + '<span class="tiny" style="font-weight:400"> / 40</span></div>' +
      '<span class="pill acc">忧思分级：' + E.esc(band.label) + "</span></div>" +
      '<div style="text-align:right"><span class="tiny">' + new Date(r.ts).toLocaleDateString("zh-CN") + " 测</span></div></div>" +
      '<div class="divider"></div>' +
      '<p class="small" style="margin:0 0 4px">忧思（被动纠结、拿标准和现状比） ' + r.brood + " / 20</p>" +
      '<div class="bar"><i style="width:' + (r.brood / 20 * 100) + '%;background:var(--accent)"></i></div>' +
      '<p class="small" style="margin:12px 0 4px">反省（主动分析、找办法） ' + r.reflect + " / 20</p>" +
      '<div class="bar"><i style="width:' + (r.reflect / 20 * 100) + '%"></i></div>' +
      '<p class="tiny" style="margin-top:12px">忧思占 ' + ratio + "%。" + E.esc(band.tip) + "</p>" +
      '<p class="ref" style="margin-top:8px">' + E.esc(D.scale.bandNote) + "</p>" +
      '<p class="ref">数据依据：Treynor, Gonzalez &amp; Nolen-Hoeksema (2003) 的 RRS-10 二因子；Burwell &amp; Shirk (2007) 在青少年样本上的跟踪结果。</p></div>';
  }

  function vScale() {
    var sc = D.scale, answers = (S.scale && S.scale.answers) || {};
    view.innerHTML =
      '<section class="sec"><div class="card"><h2 style="margin:0 0 4px;font-size:17px">' + E.esc(sc.name) + "</h2>" +
      '<p class="small muted">' + E.esc(sc.stem) + '</p><p style="margin:8px 0 0"><span class="pill gray">不联网 · 不上传 · 不是诊断</span></p></div></section>' +
      '<section class="sec"><div class="list">' + sc.items.map(function (it, i) {
        return '<div class="card"><p style="margin:0 0 8px;font-size:14.5px">' + (i + 1) + ". " + E.esc(it.t) +
          ' <span class="tiny">（' + (it.d === "brood" ? "忧思" : "反省") + "）</span></p>" +
          '<div class="chips">' + sc.options.map(function (o) {
            return '<span class="chip' + (answers[i] === o.v ? " on" : "") + '" data-i="' + i + '" data-v="' + o.v + '">' + E.esc(o.label) + "</span>";
          }).join("") + "</div></div>";
      }).join("") + "</div>" +
      '<div class="btns" style="margin-top:12px"><button class="btn" id="calc" type="button">算给我看</button>' +
      '<button class="btn ghost" id="cleans" type="button">清空</button></div></section>' +
      '<section class="sec" id="scaleres">' + (S.scale ? resHTML(S.scale) : "") + "</section>" +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:15.5px">出处与免责</h2>' +
      '<p class="ref">' + E.esc(sc.credit) + '</p><p class="ref">' + E.esc(sc.disclaimer) + "</p></div></section>";

    clickHook = function (ev) {
      var c = ev.target.closest(".chip[data-i]"); if (!c) return;
      answers[+c.dataset.i] = +c.dataset.v;
      $$('.chip[data-i="' + c.dataset.i + '"]').forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on");
    };
    $("#calc").addEventListener("click", function () {
      var missing = sc.items.filter(function (_, i) { return !answers[i]; }).length;
      if (missing) { toast("还有 " + missing + " 题没答"); return; }
      var brood = 0, reflect = 0;
      sc.items.forEach(function (it, i) { if (it.d === "brood") brood += answers[i]; else reflect += answers[i]; });
      S.scale = { ts: Date.now(), answers: answers, brood: brood, reflect: reflect, total: brood + reflect };
      save();
      $("#scaleres").innerHTML = resHTML(S.scale);
      $("#scaleres").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#cleans").addEventListener("click", function () { S.scale = null; answers = {}; save(); vScale(); toast("已清空"); });
  }

  /* =========================================================
     陪练
  ========================================================= */
  function vTalk() {
    view.innerHTML =
      '<section class="sec"><div class="card"><div class="row between"><div class="grow">' +
      '<strong style="font-size:15px">本地陪练 · 5 步预设流程</strong>' +
      '<p class="tiny" style="margin-top:4px">说清事件 → 判重复/新信息 → 换机位 → 一个动作 → 停止信号。' +
      "不会学习、不理解你，也不联网。" +
      (window.RUMI_CONFIG && window.RUMI_CONFIG.apiBase ? "（检测到已配置后端地址，可在“我的 → 数据与隐私”查看）" : "") +
      '</p></div><button class="btn sm ghost" id="reset" type="button">重开</button></div></div></section>' +
      '<div class="chat" id="chat"></div>' +
      '<div class="compose"><textarea id="say" rows="1" placeholder="接着写……"></textarea>' +
      '<button class="btn sm" id="go" type="button" style="width:76px">发送</button></div>';

    var box = $("#chat");
    function bubble(role, text, hint) {
      var d = document.createElement("div");
      d.className = "msg " + role; d.textContent = text;
      box.appendChild(d);
      if (hint) { var h = document.createElement("div"); h.className = "msg sys"; h.textContent = hint; box.appendChild(h); }
      d.scrollIntoView({ block: "end" });
      return d;
    }
    function ask(nodeId) {
      var n = E.coach.nodes[nodeId];
      bubble("them", n.ask, n.hint ? "示例：" + n.hint : null);
    }
    function push(role, text) { S.coach.push({ role: role, text: text }); save(); }

    if (!S.coach.length) {
      bubble("sys", "这是本地预设流程，不是 AI，也不是治疗师。命中危机词时它会立刻把求助页推给你，不再往下问。");
      push("sys", "（新开始一轮）");
      ask("s1");
    } else {
      S.coach.forEach(function (m) { bubble(m.role, m.text); });
      if (!S.coachState.done) ask(S.coachState.node);
      else bubble("sys", "这一轮已经走到“一个动作 + 停止信号”。做完动作可以重开一轮，或直接去记录页看趋势。");
    }

    function send() {
      var ta = $("#say"), t = ta.value.trim();
      if (!t) return;
      ta.value = "";
      bubble("me", t); push("me", t);

      var crisis = E.isCrisis(t);
      if (crisis.length) {
        bubble("sys", "我停在这里，不接着问下去了。");
        push("sys", "（命中危机词：" + crisis.join("、") + "）");
        var d = document.createElement("div");
        d.className = "crisis"; d.style.maxWidth = "100%";
        d.innerHTML = "<h3>先处理安全，再处理想法</h3><ol>" +
          D.help.steps.map(function (s) { return "<li>" + E.esc(s) + "</li>"; }).join("") + "</ol>" +
          D.help.lines.map(function (l) { return '<a class="hotline" href="' + l.tel + '">' + E.esc(l.num) + "</a>"; }).join("") +
          '<p class="tiny">这些话只存在这台设备，没有发出去。拨号是你手机自己的动作。</p>' +
          '<a class="btn warn" href="#/help" style="margin-top:10px">打开完整求助页</a>';
        box.appendChild(d); d.scrollIntoView({ block: "end" });
        return;
      }

      var out = E.coachStep(S.coachState.node, t);
      if (out.finish) {
        bubble("them", out.say); push("them", out.say);
        S.coachState.done = true;
        S.journal.push({ ts: Date.now(), text: t, kind: E.classify(t).kind, why: "陪练最后一步", words: [] });
        save();
        var link = document.createElement("a");
        link.className = "btn soft"; link.href = "#/journal"; link.textContent = "去看这一轮的记录";
        link.style.maxWidth = "100%"; box.appendChild(link);
        return;
      }
      if (out.stay) { bubble("them", out.say); push("them", out.say); return; }
      S.coachState.node = out.node; save();
      bubble("them", out.say, out.hint ? "示例：" + out.hint : null);
      push("them", out.say);
    }
    $("#go").addEventListener("click", send);
    $("#say").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    $("#reset").addEventListener("click", function () {
      S.coach = []; S.coachState = { node: "s1", done: false }; save(); vTalk(); toast("重开一轮");
    });
    clickHook = null;
  }

  /* =========================================================
     我的 / 求助 / 家长 / 来源 / 隐私
  ========================================================= */
  function vMore() {
    var cfg = window.RUMI_CONFIG || {};
    var c = { checks: S.checks.length, breaks: S.breaks.length, journal: S.journal.length, me: S.coach.filter(function (m) { return m.role === "me"; }).length };
    view.innerHTML =
      '<section class="sec"><div class="card"><div class="row between"><div><strong style="font-size:16px">这台设备上的数据</strong>' +
      '<p class="tiny" style="margin-top:4px">打卡 ' + c.checks + " · 打断 " + c.breaks + " · 记录 " + c.journal + " · 陪练发言 " + c.me + "</p></div>" +
      '<span class="pill">' + (c.breaks + c.journal > 0 ? "有内容" : "空") + "</span></div>" +
      '<div class="bar" style="margin-top:12px"><i style="width:' + Math.min((c.breaks + c.checks) / 30 * 100, 100) + '%"></i></div>' +
      '<p class="tiny">30 次动作算一轮完整使用；两周平均强度自己会画在记录页。</p></div></section>' +
      '<section class="sec"><div class="list">' +
      menu("#/help", "12356", "求助与热线", "现在就打 · 也教怎么判断该不该找专业帮助", "a") +
      menu("#/parents", "长", "家长 / 老师怎么说", "别陪着一起绕圈（共同反刍）", "b") +
      menu("#/privacy", "隐", "数据与隐私", cfg.apiBase ? "后端已配置：" + cfg.apiBase : "未配置后端 · 纯本地") +
      menu("#/sources", "※", "来源与局限", "每句话的出处，以及做不到什么") +
      "</div></section>" +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:15.5px">这个工具在做什么</h2>' +
      '<p class="small">反刍（rumination）指反复想负面事件的原因、含义和后果，而不去解决问题。它会让情绪低得更久，也和青少年的抑郁、焦虑症状相关。' +
      "本工具只做三件事：让你察觉“我在绕”，给一个马上能做的打断动作，把“为什么”翻译成“下一步”。</p>" +
      '<p class="tiny" style="margin-top:8px">中科院心理所《中国国民心理健康发展报告（2019—2020）》：青少年抑郁症状检出率 24.6%（重度 7.4%）；小学约一成、初中约三成、高中接近四成。这是筛查阳性率，不等于确诊。</p></div></section>';
    clickHook = null;
  }

  function vHelp() {
    view.innerHTML = '<section class="sec">' + crisisHTML() + "</section>" +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:15.5px">打不通 / 不想打电话时</h2><ul class="steps">' +
      "<li>去学校心理咨询室，或直接跟班主任说一句“我需要心理老师”</li>" +
      "<li>拨 12356 时可以问本地的青少年心理资源在哪、怎么挂号</li>" +
      "<li>三甲医院精神科/心理科、当地精神卫生中心，都可以自己挂号</li>" +
      "<li>先在记录页写一句“我现在最害怕的是……”，然后把这段给一个成年人看，比组织语言更省事</li></ul></div></section>" +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:15.5px">什么时候该找专业帮助</h2><ul class="steps">' +
      "<li>情绪低落或停不下来的想，连续两周以上</li><li>睡眠、吃饭、上学受到明显影响</li>" +
      "<li>出现自伤念头，或开始安排东西、写像告别的话</li><li>朋友全断了、原来喜欢的事也不做了</li></ul>" +
      '<p class="tiny">以上任一条成立，都不该只靠这个工具。这里没有“严重到才能求助”的门槛。</p></div></section>';
    clickHook = null;
  }

  function vParents() {
    var p = D.parent;
    view.innerHTML =
      '<section class="sec"><div class="card"><p class="small">' + E.esc(p.intro) + "</p></div></section>" +
      '<section class="sec"><h2>先别说这三句</h2><div class="list">' + p.dont.map(function (x) {
        return '<div class="card item"><div class="glyph a">✕</div><div class="grow"><h3>' + E.esc(x.t) + "</h3><p>" + E.esc(x.w) + "</p></div></div>";
      }).join("") + "</div></section>" +
      '<section class="sec"><h2>有用的动作</h2><div class="list">' + p.do.map(function (x) {
        return '<div class="card item"><div class="glyph b">✓</div><div class="grow"><h3>' + E.esc(x.t) + "</h3><p>" + E.esc(x.w) + "</p></div></div>";
      }).join("") + "</div></section>" +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:15.5px">孩子可能在反刍的信号</h2><ul class="steps">' +
      p.signs.map(function (s) { return "<li>" + E.esc(s) + "</li>"; }).join("") + "</ul></div></section>" +
      '<div class="btns"><a class="btn soft" href="#/help">求助入口</a><a class="btn ghost" href="#/sources">证据来源</a></div>';
    clickHook = null;
  }

  function vSources() {
    view.innerHTML =
      '<section class="sec"><h2>引用</h2><div class="list">' + D.sources.map(function (s) {
        return '<div class="card"><p style="margin:0;font-size:13.6px">' + E.esc(s.t) + "</p>" +
          '<p class="tiny" style="margin-top:5px">' + E.esc(s.w) + '</p><p style="margin:6px 0 0"><a href="' + s.u + '" target="_blank" rel="noopener">打开 ↗</a></p></div>';
      }).join("") + "</div></section>" +
      '<section class="sec"><h2>做不到什么</h2><div class="card stack">' +
      D.limits.map(function (l) { return '<p class="small" style="margin:0">' + E.esc(l) + "</p>"; }).join("") + "</div></section>" +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:15.5px">词表（唯一会“判断”的东西）</h2>' +
      '<p class="tiny">重复标记：' + D.lexicon.repeat.join("、") + "</p>" +
      '<p class="tiny" style="margin-top:6px">行动标记：' + D.lexicon.action.join("、") + "</p>" +
      '<p class="tiny" style="margin-top:6px">危机词：' + D.crisisWords.join("、") + "</p>" +
      '<p class="ref">它不懂语义、也不学习，只做字符串包含匹配。判得不准就在记录里改——这条路径本来就是设计的一部分。</p></div></section>';
    clickHook = null;
  }

  function vPrivacy() {
    var cfg = window.RUMI_CONFIG || {};
    view.innerHTML =
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:16px">默认：一切都在这台设备</h2>' +
      '<p class="small">打卡、卡片记录、日志、书写、量表、对话全部存在浏览器 localStorage（键名 <kbd>' + E.esc(K) + "</kbd>）。" +
      "没有账号、没有上传、没有埋点，也没有第三方脚本或 CDN。</p>" +
      '<p class="tiny" style="margin-top:8px">后端状态：' + E.esc(cfg.apiBase ? cfg.apiBase : "未配置。即使配了地址，也只有你在“我的 → 数据与隐私”里手动打开上传开关，页面才会请求网络。") + "</p></div></section>" +
      '<section class="sec"><div class="list">' +
      '<div class="card item tap" id="exp"><div class="glyph">↓</div><div class="grow"><h3>导出成 JSON</h3><p>复制全部数据，自己存一份</p></div></div>' +
      '<div class="card item tap" id="imp"><div class="glyph a">↑</div><div class="grow"><h3>导入 / 换手机</h3><p>粘贴之前导出的 JSON</p></div></div>' +
      '<div class="card item tap" id="clr"><div class="glyph a">✕</div><div class="grow"><h3>立刻清空全部数据</h3><p>不可撤销</p></div></div>' +
      '<a class="card item tap" href="#/help"><div class="glyph b">☏</div><div class="grow"><h3>如果现在很难受</h3><p>求助入口</p></div></a>' +
      "</div></section>" +
      '<section class="sec"><div class="card"><h2 style="margin:0 0 6px;font-size:15.5px">为什么坚持本地存</h2>' +
      '<p class="small">反刍的内容往往是一个孩子最不愿被别人看到的那部分。把它默认写进云端，等于让工具本身变成风险来源。所以这里默认不联网；真要接后端（趋势分析、真人对话），走 <code>docs/BACKEND-ALIYUN.md</code> 里的授权与数据最小化方案。</p></div></section>';

    $("#exp").addEventListener("click", function () {
      var txt = JSON.stringify(S, null, 2);
      openSheet('<h2>导出</h2><p class="small muted">全选下面这段，自己存好。</p><textarea id="expt" rows="12">' + E.esc(txt) + "</textarea>");
      var done = false;
      try { navigator.clipboard.writeText(txt).then(function () { toast("已复制到剪贴板"); }, function () { toast("已展开，手动复制"); }); done = true; } catch (e) { }
      if (!done) toast("已展开，手动复制");
    });
    $("#imp").addEventListener("click", function () {
      openSheet('<h2>导入</h2><textarea id="impt" rows="12" placeholder="粘贴 JSON"></textarea>' +
        '<button class="btn warn" id="impgo" type="button" style="margin-top:12px">覆盖本机数据</button>');
      $("#impgo").addEventListener("click", function () {
        try {
          var obj = JSON.parse($("#impt").value);
          if (!obj || typeof obj !== "object" || !Array.isArray(obj.checks) || !Array.isArray(obj.breaks)) throw new Error("bad");
          var b = blank();
          Object.keys(b).forEach(function (k) { if (obj[k] === undefined) obj[k] = b[k]; });
          S = obj; save(); closeSheet(); location.hash = "#/today"; toast("导入成功");
        } catch (e) { toast("格式不对，没动你的数据"); }
      });
    });
    $("#clr").addEventListener("click", function () {
      openSheet('<h2>确认清空？</h2><p class="small">这会删掉这台设备上本工具的全部记录：打卡、打断、日志、书写、量表、对话。删完不能恢复。</p>' +
        '<button class="btn warn" id="clrgo" type="button" style="margin-top:12px">确认清空</button>');
      $("#clrgo").addEventListener("click", function () {
        S = blank(); save(); closeSheet(); location.hash = "#/today"; toast("已清空");
      });
    });
    clickHook = null;
  }

  /* ---------------- 路由 ---------------- */
  var ROUTES = { today: vToday, break: vBreak, journal: vJournal, scale: vScale, talk: vTalk, more: vMore, help: vHelp, parents: vParents, sources: vSources, privacy: vPrivacy };
  var TABS = { today: 1, break: 1, journal: 1, scale: 1, more: 1 };

  function render() {
    var seg = (location.hash || "#/today").replace(/^#\//, "").split("/");
    clearTimers();
    if (seg[0] === "card" && seg[1]) {
      vCard(seg[1]);
      var c = D.cards.filter(function (x) { return x.id === seg[1]; })[0];
      pageTitle.textContent = "打断"; pageSub.textContent = c ? c.title : "";
      backBtn.hidden = false; markTab("#/break"); return;
    }
    var name = ROUTES[seg[0]] ? seg[0] : "today";
    var meta = TITLES[name];
    pageTitle.textContent = meta[0]; pageSub.textContent = meta[1];
    backBtn.hidden = !!TABS[name];
    ROUTES[name]();
    markTab(name === "talk" ? "#/more" : "#/" + name);
    window.scrollTo(0, 0);
  }
  function markTab(href) {
    $$("#tabbar a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === href); });
  }
  backBtn.addEventListener("click", function () { history.back(); });
  window.addEventListener("hashchange", render);
  render();
})(window.RUMI_DATA, window.RUMI_ENGINE);
