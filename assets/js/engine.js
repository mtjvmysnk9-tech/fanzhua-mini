/* 纯逻辑层：分流规则、危机识别、教练脚本、统计。可单独在控制台里测。 */
window.RUMI_ENGINE = (function (D) {

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function findWords(text, list) {
    var t = String(text || ""), hits = [];
    list.forEach(function (w) { if (t.indexOf(w) !== -1 && hits.indexOf(w) === -1) hits.push(w); });
    return hits;
  }

  /* 把一段自述分成“重复”还是“可行动”。规则完全透明，命中词会显示出来。 */
  function classify(text) {
    var r = findWords(text, D.lexicon.repeat);
    var a = findWords(text, D.lexicon.action);
    var kind, reason;
    if (r.length && !a.length) { kind = "repeat"; reason = "只有重复标记"; }
    else if (a.length && !r.length) { kind = "action"; reason = "只有行动标记"; }
    else if (a.length && r.length) { kind = "mixed"; reason = "两种都有：重复 " + r.length + " 处、行动 " + a.length + " 处"; }
    else { kind = "unknown"; reason = "没抓到标记词，可以自己改"; }
    return { kind: kind, repeat: r, action: a, reason: reason };
  }

  var KIND_LABEL = { repeat: "在重复", action: "可行动", mixed: "半重复半行动", unknown: "看不准" };

  function isCrisis(text) {
    return findWords(text, D.crisisWords);
  }

  function levelBand(level) {
    var bands = D.levelBands;
    for (var i = 0; i < bands.length; i++) if (level <= bands[i].max) return bands[i];
    return bands[bands.length - 1];
  }

  function dayKey(ts) {
    var d = new Date(ts || Date.now());
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }

  function lastNDays(n) {
    var out = [], now = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      out.push(dayKey(d.getTime()));
    }
    return out;
  }

  /* 建议：温度计 + 自述 → 推荐 2 张卡 */
  function suggest(level, text) {
    var c = classify(text || "");
    var picks = [];
    if (isCrisis(text || "").length) return { crisis: true, cards: ["land"], kind: c.kind };
    if (level >= 8) picks.push("land", "breath");
    else if (level >= 6) picks.push("breath", "move");
    else if (level >= 4) picks.push("place", "count");
    else picks.push("next");
    if (c.kind === "action" && picks.indexOf("next") === -1) picks.push("next");
    if (c.kind === "repeat" && picks.indexOf("count") === -1) picks.push("count");
    return { crisis: false, cards: picks.slice(0, 2), kind: c.kind };
  }

  /* ---------- 教练脚本（本地预设，不是 AI） ----------
     每个节点: { id, ask, expect, next(text) }  */
  var coach = {
    start: "s1",
    nodes: {
      s1: {
        ask: "两句话说清楚：这次让你绕圈的事，具体是什么？（时间、人、事，别写评价）",
        hint: "例：今天数学小测最后一题没写完，回家路上我一直在想这事。",
        check: function (t) {
          if (t.trim().length < 6) return "retry_short";
          return "s2";
        }
      },
      s2: {
        ask: "看着你刚写的这句，判断一下：它是在重复同一句结论，还是在说出一个新信息？",
        hint: "“我就是这样的人”“完了”= 重复；“其实我错在没看清题干要求”= 新信息。",
        check: function (t) {
          var c = classify(t);
          if (c.kind === "repeat") return "s3_repeat";
          if (c.kind === "action") return "s5_action";
          return "s3_mixed";
        }
      },
      s3_repeat: {
        ask: "这就是反刍的样子，不是你笨。这一轮我们不讲道理——先做一件 30 秒的事：写下 3 个你现在看得见的东西。写完发给我。",
        hint: "这是把注意力从“过去的自己”搬回当下，不用想通也可以。",
        check: function (t) {
          return t.trim().length >= 4 ? "s4" : "retry_short";
        }
      },
      s3_mixed: {
        ask: "你写了两种东西：有重复的结论，也有一点新信息。把它们分开——单独写一行：这里面哪一句是可以动手的？",
        check: function (t) {
          var c = classify(t);
          return c.action.length ? "s5_action" : "s5_forced";
        }
      },
      s4: {
        ask: "好一点了。现在换个机位：用你的名字当第三人称，写一句“今天___遇到的事是___”。",
        hint: "研究和实践里，叫自己名字比说“我为什么”更容易降温。",
        check: function (t) {
          if (t.indexOf("我") === -1) return "s5_action";
          if (t.trim().length >= 8) return "s5_action_ish";
          return "s5_action";
        }
      },
      s5_action_ish: {
        ask: "那句还是第一人称。改成“她/他 + 名字”再写一次，或者直接进下一步——你想先做哪个？",
        check: function () { return "s6"; }
      },
      s5_forced: {
        ask: "我找不出可动手的那句，说明这事现在确实没有你能改的部分。那我们就练“把它放一会儿”：给它定一个时间（比如明天 19:30 想 15 分钟），现在去做一件身体上的小事。你要定几点？",
        check: function (t) { return t.trim().length >= 2 ? "s6" : "retry_short"; }
      },
      s5_action: {
        ask: "好。把它缩成一个今天就能做的最小动作——必须带动词、有时间、能判断做没做完。你写的是哪个？",
        hint: "❌“把数学提上去” ✅“今晚 20:30 重做小测最后那道题的前两问，15 分钟”",
        check: function (t) {
          var c = classify(t);
          if (c.action.length || t.trim().length >= 10) return "s6";
          return "retry_vague";
        }
      },
      s6: {
        ask: "最后一个问题：做完这个动作以后，什么信号会让你知道“今天不用再多想了”？",
        check: function (t) { return t.trim().length >= 4 ? "done" : "retry_short"; }
      }
    },
    responses: {
      retry_short: { text: "太短了，我抓不到东西。再多写两句，具体到人和事就行，不用写得漂亮。" },
      retry_vague: { text: "这句还是太大了，像愿望不像动作。加一个时间点，加一个动词，重发一次。" },
      done: { text: "可以。这一轮我存下来了：你从“绕圈”走到了“一个动作 + 一个停止信号”。现在去做那个动作，做完回今天页打一次分。", finish: true }
    }
  };

  /* 走一步：返回下一个节点，或一条 retry / 结束回应。危机词由调用方先拦。 */
  function coachStep(nodeId, input) {
    var node = coach.nodes[nodeId];
    if (!node) return { node: coach.start, say: coach.nodes[coach.start].ask, hint: coach.nodes[coach.start].hint };
    var to = node.check(input || "");
    if (coach.responses[to]) {
      var r = coach.responses[to];
      return { node: nodeId, stay: true, say: r.text, finish: !!r.finish };
    }
    var n = coach.nodes[to];
    return { node: to, say: n.ask, hint: n.hint };
  }

  return {
    esc: esc, classify: classify, isCrisis: isCrisis, levelBand: levelBand,
    dayKey: dayKey, lastNDays: lastNDays, suggest: suggest, coach: coach,
    coachStep: coachStep, KIND_LABEL: KIND_LABEL, findWords: findWords
  };
})(window.RUMI_DATA);
