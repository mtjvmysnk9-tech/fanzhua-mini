/* 内容层：工具卡、量表、词表、来源。改文案只动这里，逻辑在 app.js / engine.js */
window.RUMI_DATA = {
  version: "1.0.0",
  storageKey: "fanzhua.v1",

  triggers: ["考试/成绩", "和同学朋友", "老师", "爸妈/家里", "外貌/身材", "手机/网络", "关于未来", "说不清"],

  // 0–10 温度计的解释语
  levelBands: [
    { max: 2, label: "基本停得住", tip: "不用打断，去做一件具体的事就行。" },
    { max: 5, label: "在绕圈，但还能觉知", tip: "现在打断，成本最低。" },
    { max: 7, label: "绕了好几圈", tip: "先动身体或换地方，再想事情。" },
    { max: 10, label: "整颗脑子被占住", tip: "这一轮不建议讲道理，只做着陆和呼吸。" }
  ],

  /* ============ 打断卡片 ============ */
  cards: [
    {
      id: "land", glyph: "5", tone: "", title: "5-4-3-2-1 感官着陆", time: "约 2 分钟",
      for: "脑子空转、越想越慌、要马上回到当下",
      why: "反刍是把注意力锁在“过去的自己”上；把感觉通道占满，是最快把注意力搬回来的办法之一。",
      steps: [
        "说出（或在心里写）你此刻看到的 5 样东西",
        "听 4 种声音，越细小越好（风扇、楼下、自己呼吸）",
        "摸 3 处：桌面、衣服缝、自己的手腕",
        "闻 2 种气味",
        "尝 1 种味道，或说 1 件今天吃到嘴里的东西"
      ],
      refs: ["常用于焦虑/创伤情境下的稳定化技术（grounding），是正念与 CBT 练习中的标准做法"]
    },
    {
      id: "breath", glyph: "◌", tone: "b", title: "4-6 呼吸（呼气比吸气长）", time: "2 分钟",
      for: "胸口发紧、睡前停不下来",
      why: "延长呼气会抬高迷走神经张力，是这套工具里唯一“身体先进、脑子后进”的动作；反刍越到晚上越凶时最好用。",
      breath: { inhale: 4, exhale: 6, seconds: 120 },
      steps: ["鼻子吸气 4 秒", "停一下下就好，不用硬憋", "嘴慢慢呼气 6 秒，像吹凉一勺汤", "跟着圈走，走神了回来就行"],
      refs: ["呼吸练习对自主神经与情绪调节的作用有大量研究，但短时练习的效果量因人而异，别指望一次治好"]
    },
    {
      id: "camera", glyph: "镜", tone: "a", title: "换个机位：用“她/他”重述这件事", time: "3 分钟",
      for: "一件事翻来覆去、每遍都是同一个角度",
      why: "用自己的名字或第三人称跟自己说话，会制造出一点心理距离，让人更像在处理“一个人的事”，而不是“我的灾难”。",
      steps: [
        "写下：今天____（你的名字）遇到了什么事",
        "接着写：她/他为什么会难受，她/他想要的是什么",
        "最后写：如果朋友遇到这件事，你会对她说什么",
        "写完回看一遍，找出一句你愿意试的东西"
      ],
      refs: ["Ayduk & Kross (2010, JPSP)；Kross 等 (2014, JPSP)；Moser 等 (2017, Scientific Reports)：第三人称自我对话降低情绪反应且不太耗认知控制。成人实验室证据较强，青少年证据仍在补"]
    },
    {
      id: "move", glyph: "动", tone: "", title: "身体先动 60 秒", time: "1–5 分钟",
      for: "坐着躺着想、想到发麻也起不来",
      why: "反刍常和“不动”绑在一起。心率和肌肉一动，注意力被身体事件打断；行为激活路线正是把“先做再感觉”，而不是“先有心情再做”。",
      steps: ["起身，原地 20 个开合跳 / 高抬腿 30 秒 / 快走下楼再上来", "只给自己一个要求：先离开现在这个姿势", "做完给自己打个分，再回到温度计"],
      refs: ["行为激活（BA）用于抑郁的证据综述：Ekers 等 (2014, PLoS ONE) 荟萃分析", "针对缓解期青少年的反刍聚焦 CBT 研究显示行为激活水平上升：Feldhaus 等 (2020, J Child Fam Stud)"]
    },
    {
      id: "place", glyph: "换", tone: "b", title: "离开这个位置", time: "5 分钟",
      for: "在床上/书桌前/房间里越坐越沉",
      why: "同一个空间会变成反刍的“舞台”。换个场景等于换一个外部线索集，让大脑不再顺原路重播。",
      steps: ["物理上离开这个房间（客厅、走廊、楼下都算）", "手里拿个东西：水杯、外套、作业", "给自己定 5 分钟，不要求“想通”，只要求待在新地方"],
      refs: ["场景与线索依赖的情绪记忆是环境提示干预的实践基础；本工具把它拆成最小动作"]
    },
    {
      id: "worrytime", glyph: "约", tone: "a", title: "给“想”约一个时间", time: "今天不用做",
      for: "一天里随时随地都会被拽进去",
      why: "不是压制念头，而是推迟：把“反复想”收进固定的 15 分钟，其余时间只做“记一下，到点再想”。临床上叫担忧/反刍的时间推迟，常与刺激控制配合。",
      steps: ["选一个固定时段（如 19:30），别贴着睡觉时间", "到点前冒出来的念头：只记一行标题，不展开", "到点后按清单想 15 分钟，时间到就停", "结束后写一句：哪一条其实是可以动手的"],
      refs: ["推迟担忧/反刍时段来自担忧与反刍的元认知与 CBT 处理流程；Topper 等 (2017, Behav Res Ther) 针对过度担忧与反刍的青少年干预即属此类路线"]
    },
    {
      id: "count", glyph: "算", tone: "", title: "给注意力派一个活", time: "2 分钟",
      for: "内容赶不走，就先占掉工作记忆",
      why: "反刍需要语言与工作记忆一起干活。让它抢资源，重复的密度就下来了。这也是分散注意（distraction）在反应风格理论里被视为适应性反应的原因。",
      steps: ["从 100 连续减 7 报数（100 / 93 / 86…）", "或：30 秒内找出房间里所有蓝色的东西", "或：倒着背自己手机号/学号后 6 位"],
      refs: ["Nolen-Hoeksema 反应风格理论：反刍 vs 分心 vs 问题解决（Nolen-Hoeksema, Wisco & Lyubomirsky, 2008, Perspectives on Psychological Science）", "儿童青少年中情绪聚焦反刍与分心的荟萃分析：Rood 等 (2009, Clinical Psychology Review)"]
    },
    {
      id: "next", glyph: "→", tone: "b", title: "把“为什么”换成“下一步”", time: "3 分钟",
      for: "已经绕到第 N 圈，但仍必须面对这件事",
      why: "反刍的特点是抽象、被动、以“为什么”结尾；可行动的思考是具体、现在时、以动词开头。这张卡是把前者翻译到后者。",
      steps: [
        "一句话写下这件事里“已经定死了、不能改”的部分",
        "一句话写下“还在我手里”的部分",
        "写一个今天就能做的最小动作（带动词、有时间、能判断做没做完）",
        "把手机放一边，先做那个动作 5 分钟"
      ],
      refs: ["反刍聚焦 CBT（RFCBT, Edward Watkins）核心：把“为什么型/抽象”处理转成“怎么做型/具体”处理", "Langenecker 等 (2021 前后系列) RFCBT 降低青少年反刍的随机试验报告"]
    }
  ],

  /* ============ 表达性书写 ============ */
  writing: [
    { day: 1, title: "只写事实", prompt: "像监控录像一样写：这件事里发生了什么、几点、有谁、说了哪句话。不写评价。" },
    { day: 2, title: "写最深的感受", prompt: "允许写得难看、允许前后矛盾。写下当时的情绪，以及现在想起它时身体的感觉。" },
    { day: 3, title: "写它连上了什么", prompt: "这件事和谁有关、和你以前的哪些经历像、它碰到了你在意的什么东西。" },
    { day: 4, title: "写现在的看法", prompt: "隔了几天再看，你对这件事的解释变了吗？你从“我当时很糟”往“我下次可以”移动了多少？" }
  ],
  writingNote: "表达性书写源于 Pennebaker & Beall (1986, JPSP) 的范式：连续几天、每次 15–20 分钟写最深的想法。成人研究里对情绪与躯体指标有小到中等效应；青少年、以及正处于高强度痛苦中的样本，结果并不一致，也有人写完更难受。所以这个练习在本工具里是“可选项”，不是任务；写了更糟就停，并考虑找专业人士。",

  /* ============ 自评：RRS 条目（教育版） ============ */
  scale: {
    name: "反刍风格自评（教育版，10 题）",
    stem: "最近一个月，当你心情低落、难受的时候，你有多常做下面这些事？",
    options: [
      { label: "从不", v: 1 }, { label: "有时", v: 2 }, { label: "常常", v: 3 }, { label: "几乎总是", v: 4 }
    ],
    items: [
      { t: "我常常想：我究竟做了什么会导致这样", d: "brood" },
      { t: "我常常想：为什么我总是要面对这些问题，别人却没有", d: "brood" },
      { t: "我常常想：我为什么不能把事情处理得更好", d: "brood" },
      { t: "我常常想：我为什么总是这样反应", d: "brood" },
      { t: "我常常想：我是多么消极被动、对做任何事都提不起劲", d: "brood" },
      { t: "我常常写下自己正在想的事情并加以分析", d: "reflect" },
      { t: "我常常分析自己的性格，以便理解为什么感到压抑", d: "reflect" },
      { t: "我常常分析最近发生的事，以便理解自己为什么难受", d: "reflect" },
      { t: "我常常思考现状，希望它有所好转", d: "reflect" },
      { t: "我常常想各种能让自己感觉好一些的办法", d: "reflect" }
    ],
    bands: [
      { max: 8, label: "忧思偏低", tip: "偶尔绕圈，正常。把“绕圈”这件事说出来就够了。" },
      { max: 13, label: "有明显绕圈倾向", tip: "重点练“打断”那一栏，一周内做满 5 次。" },
      { max: 20, label: "忧思占主导", tip: "这通常不只是“意志力”问题，建议同时找学校心理老师或做专业评估。" }
    ],
    bandNote: "分级只看忧思那一半（5–20 分）：研究里与抑郁症状更稳定相关的是忧思，不是反省。反省高不等于有病，所以总分只作参考。",
    credit: "条目取自 Nolen-Hoeksema & Morrow (1991) 的 RRS 短形式条目池，二因子结构（忧思 brooding / 反省 reflection）来自 Treynor, Gonzalez & Nolen-Hoeksema (2003, Cognitive Therapy and Research)，中文措辞参考韩秀、杨宏飞 (2009, 中国临床心理学杂志 17(5):550-551) 的中文修订版。",
    disclaimer: "这不是诊断。它是让你看清“我在做哪种想”的教学镜子：忧思那一半越高越值得练打断；反省那一半高不一定是坏事，它更接近主动分析。分数只存在本机，不上传。"
  },

  /* ============ 日志分流词表（真实跑的规则） ============ */
  lexicon: {
    repeat: ["为什么", "为什么我", "总是", "每次", "一直", "反复", "一遍又一遍", "是不是我的问题", "都怪", "要是当时", "早知道", "反正", "没救", "我就是这样", "想不通", "丢人", "完蛋", "别人怎么看", "我是不是很差", "停不下来"],
    action: ["下一步", "今天", "明天", "先", "第一步", "我可以", "我去", "试试", "需要", "计划", "具体", "时间点", "问一下", "查一下", "改", "做", "发条消息", "约", "列出来", "写完"]
  },

  crisisWords: ["自杀", "想死", "不想活", "活着没意思", "死了算了", "解脱", "割腕", "割手", "自伤", "吞药", "跳下去", "从楼上", "结束自己"],

  help: {
    lines: [
      { name: "全国统一心理援助热线", num: "12356", tel: "tel:12356", note: "由国家卫健委与工信部设置的全国统一号码，2025 年 5 月 1 日前各地已全部接通；北京等地为 24 小时，由精神科医师、心理治疗师接听。" },
      { name: "紧急情况", num: "120 / 110", tel: "tel:120", note: "已经受伤、或马上就要做点什么——先打 120，或直接去最近的医院急诊。" }
    ],
    steps: [
      "现在就发一条消息给一个活的成年人：爸妈、亲戚、班主任、心理老师、朋友都行，只写“我现在很不好，能陪我说两句吗”",
      "如果联系不上任何人，拨 12356，接通前不要一个人待在能伤到自己的地方",
      "把能立刻伤害到自己的东西放到够不着的地方",
      "这不是靠“想通”能过去的，是需要人来搭一段。要专业帮助不丢人。"
    ]
  },

  /* ============ 家长 / 老师 ============ */
  parent: {
    intro: "如果孩子回家一直在绕同一件事，你多半试过讲道理、也试过让他别想。这两种通常都失败，因为反刍不是懒、不是矫情，而是“注意力卡在抽象解释上”的习惯。",
    dont: [
      { t: "“别想了 / 有什么好想的”", w: "反刍不是开关，命令停用等于给自己再加一层“我连想都控制不了”的证据。" },
      { t: "“我们为你付出这么多”", w: "把议题从“他的事”换成“你的牺牲”，通常会直接加深自责型忧思。" },
      { t: "陪他把同一件事分析到第三遍", w: "这叫共同反刍（co-rumination，Rose 2002, Child Development）。在青少年尤其是女孩身上，它和更多抑郁焦虑症状相关——出于好意，但在给火添柴。" }
    ],
    do: [
      { t: "先只回一句：“这个听起来真挺难受的，你愿意多讲两句吗”", w: "被听见会降温；讲完再由他自己决定要不要建议。" },
      { t: "把问题从“为什么”挪到“接下来”", w: "问他“这里面还有哪一小块是你能动的”，然后一起做那件小事，比如一起把作业拆成两栏。" },
      { t: "约一个固定的 15 分钟“专门想”", w: "其余时间冒出来就记一行，到点再聊。你在旁边做的是不插话、不评价。" },
      { t: "拉他出门动一动", w: "走路、扔垃圾、买东西——身体先动，情绪经常跟在后面。行为激活在青少年抑郁干预里是有效成分之一。" },
      { t: "出现自伤念头、连续两周起不来床、成绩断崖：直接约专业评估", w: "拨打 12356 或去精神科/心理科门诊。工具替代不了评估。" }
    ],
    signs: [
      "夜里躺很久还在反复讲同一件过去的事",
      "写作业前坐在原位数十分钟不动",
      "一次考试失利之后，好几周把自我评价压到极低",
      "开始回避朋友、原来的爱好也停了"
    ]
  },

  /* ============ 来源清单 ============ */
  sources: [
    { t: "Nolen-Hoeksema, S. (1991). Responses to depression and its effects on the duration of depressive episodes. J Abnorm Psychol, 100(4), 569-582.", u: "https://doi.org/10.1037/0021-843X.100.4.569", w: "反应风格理论的起点：反刍延长抑郁发作。" },
    { t: "Nolen-Hoeksema, S., Wisco, B. E., & Lyubomirsky, S. (2008). Rethinking rumination. Perspectives on Psychological Science, 3(5), 400-424.", u: "https://doi.org/10.1111/j.1745-6924.2008.00088.x", w: "反刍分 adaptive/blinking 与 maladaptive 的综合评论。" },
    { t: "Treynor, W., Gonzalez, R., & Nolen-Hoeksema, S. (2003). Rumination reconsidered: A psychometric analysis. Cogn Ther Res, 27(3), 247-259.", u: "https://doi.org/10.1023/A:1025478818180", w: "把 RRS 精简成 10 题两因子：忧思与反省，自评卡的骨架。" },
    { t: "韩秀、杨宏飞 (2009). Nolen-Hoeksema 反刍思维量表在中国的试用. 中国临床心理学杂志, 17(5), 550-551+549.", u: "https://xueshu.baidu.com/usercenter/paper/show?paperid=1m6n0000tn5w06d0fp2u08k0h2661165", w: "中文修订版 22 条目，α=0.91；本自评的中文措辞来源。" },
    { t: "Rood, L., Roelofs, J., Bögels, S. M., Haugan, A., & van Oost, R. (2009). The influence of emotion-focused rumination and distraction on depressive symptoms in non-clinical youth: A meta-analytic review. Clin Psychol Rev, 29(7), 607-616.", u: "https://doi.org/10.1016/j.cpr.2009.08.001", w: "儿童青少年里情绪聚焦反刍与抑郁症状、分心的元分析。" },
    { t: "Muris, P., Fokke, M., & Kwik, D. (2009). The ruminative response style in adolescents: An examination of its specific link to symptoms of depression. Cogn Ther Res, 33(1), 21-32.", u: "https://doi.org/10.1007/s10615-008-0141-8", w: "反刍与抑郁症状的关联并非只靠负性情绪效应。" },
    { t: "Burwell, R. A., & Shirk, S. R. (2007). Subtypes of rumination in adolescence: Associations between brooding, reflection, depressive symptoms, and coping. J Clin Child Adolesc Psychol, 36(1), 56-65.", u: "https://doi.org/10.1080/15374410709333319", w: "青少年里忧思更毒、反省更中性，是这张卡“不反对思考”的依据。" },
    { t: "Topper, M., Emmelkamp, P. M. G., Watkins, E., & Ehring, T. (2017). Prevention of anxiety disorders and depression by targeting excessive worry and rumination in adolescents and young adults: A randomized controlled trial. Behav Res Ther, 90, 123-136.", u: "https://doi.org/10.1016/j.brat.2016.12.003", w: "针对青少年反刍/担忧的短程预防干预 RCT，本工具干预路线的主要依据。" },
    { t: "Feldhaus, C. G. 等 (2020). Rumination-focused cognitive behavioral therapy decreases anxiety and increases behavioral activation among remitted adolescents. J Child Fam Stud, 29, 1982-1991.", u: "https://doi.org/10.1007/s10826-020-01711-7", w: "缓解期青少年 RFCBT 后行为激活上升。" },
    { t: "Ayduk, Ö., & Kross, E. (2010). Analyzing bad experiences from a self-distancing perspective. Psychol Sci, 21(11), 1656-1663.", u: "https://doi.org/10.1177/0956797610385816", w: "自我抽离重述降低负面感受。" },
    { t: "Kross, E. 等 (2014). Self-talk as a regulatory mechanism: How you do it, and what you say, matter. J Pers Soc Psychol, 106(5), 745-762.", u: "https://doi.org/10.1037/a0035323", w: "用名字+第二人称对话比“我为什么……”更好用。" },
    { t: "Rose, A. J. (2002). Co-rumination in the friendships of girls and boys. Child Development, 73(6), 1830-1843.", u: "https://doi.org/10.1111/1467-8624.00499", w: "一起反复想并不总是支持，它和更多内化症状有关。家长页的依据。" },
    { t: "Ekers, D., Webster, L., Van Straten, A., Cuijpers, P., Richards, D., & Riper, H. (2014). Behavioural activation for depression: an update of meta-analysis of effectiveness and subgroup analysis. PLoS ONE, 9(6), e100100.", u: "https://doi.org/10.1371/journal.pone.0100100", w: "行为激活有效性的元分析更新。" },
    { t: "Pennebaker, J. W., & Beall, S. K. (1986). Confronting a traumatic event: Toward an understanding of inhibition and disease. J Pers Soc Psychol, 50(3), 556-562.", u: "https://doi.org/10.1037/0022-3514.50.3.556", w: "表达性书写范式的原始报告，书写页的出处。" },
    { t: "国家卫生健康委 (2024-12-25) 关于应用“12356”全国统一心理援助热线电话号码的通知", u: "https://baike.baidu.com/item/12356心理援助热线平台/67243261", w: "求助页里的号码、接通时间与运行口径来源；截至 2025-05-01 各地均已开通。" },
    { t: "中科院心理所《中国国民心理健康发展报告（2019—2020）》青少年部分", u: "http://people.com.cn/GB/review/20210817.html", w: "青少年抑郁症状检出率 24.6%（重度 7.4%），小学约一成、初中约三成、高中接近四成；筛查阳性 ≠ 确诊。" }
  ],

  limits: [
    "本工具是自我调节的辅助镜，不是诊断、不是治疗、不是治疗师。它有“做不到”的边界：如果反刍伴随长期失眠、自伤念头、成绩与人际断崖式下滑，需要专业评估。",
    "工具卡里的动作来自有证据的干预路线（RFCBT、行为激活、自我抽离、短时正念），但把它们做成一张卡片并不代表等效于 8 次正式治疗。",
    "“陪练”是本地预设脚本，不会学习，也不会真的理解你。它只能按流程推问题；默认不联网、不上传。",
    "短时自我报告受当晚状态影响很大，趋势比单点更可信。"
  ]
};
