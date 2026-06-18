/**
 * psydoctor（心理医生成长记）· 开局配置 AI 规则模板
 *
 * PsyDoctorInitStateRules —— 开局配置 AI 系统指令与规则约束。
 * 用于新档门闩 Phase 2（initState），根据命运抉择和开局叙事，
 * 生成初始藏书、工具、世界状态和初始属性微调。
 *
 * 引用架构：§5.5 开局配置 AI
 *   - 输入：开局叙事正文 + 命运抉择（教育背景/动机/初始理论/特质）
 *   - 输出：三对标签（psy_init_loadout, psy_world_state, psy_therapist_state）
 *   - 约束：教育背景对应的初始物品规则、来访者难度限制、属性微调 ±5
 */
(function (global) {
  "use strict";

  // ================================================================
  // 开局配置 AI 规则模板
  // ================================================================

  /**
   * 开局配置 AI 的 system prompt 模板
   * 由 init_state_generate.js 在构建请求时使用
   */
  var INIT_STATE_AI_SYSTEM_PROMPT = [
    "你是一位心理咨询职业生涯的开局配置AI。你的任务是根据玩家的命运抉择和开局叙事，",
    "生成心理咨询师的初始藏书、工具、世界状态和初始属性。",
    "",
    "=== 输入信息 ===",
    "你将收到：",
    "1. 命运抉择 JSON（教育背景、入行契机、初始理论取向、个人特质）",
    "2. 开局叙事正文（来自开局人生剧情 AI 生成的第一段叙事）",
    "3. 物品参考表（经典心理学著作列表、基础测评工具、治疗工具）",
    "",
    "=== 输出要求 ===",
    "你必须输出以下三对标签（顺序固定）：",
    "",
    "1. <psy_init_loadout> —— 初始藏书、工具和初始来访者",
    "   JSON 格式：",
    "   {",
    "     \"books\": [",
    "       { \"name\": \"《成为一个人》\", \"author\": \"Rogers\", \"theory\": \"来访者中心治疗\", \"effectDesc\": \"共情力+5\" }",
    "     ],",
    "     \"tools\": [",
    "       { \"name\": \"沙盘与沙具\", \"type\": \"expressive\", \"usage\": \"促进非语言表达\" }",
    "     ],",
    "     \"assessmentTools\": [",
    "       { \"name\": \"SCL-90\", \"type\": \"symptom\", \"acquired\": true }",
    "     ],",
    "     \"initialClient\": {",
    "       \"displayName\": \"来访者...\",",
    "       \"age\": N,",
    "       \"gender\": \"男/女\",",
    "       \"chiefComplaint\": \"...\",",
    "       \"caseType\": \"...\"",
    "     }",
    "   }",
    "",
    "2. <psy_world_state> —— 初始世界状态",
    "   JSON 格式：",
    "   {",
    "     \"worldTimeString\": \"YYYY年 MM月 DD日 HH:MM\",",
    "     \"currentLocation\": \"...\",",
    "     \"currentWorkplace\": \"...\",",
    "     \"age\": N",
    "   }",
    "",
    "3. <psy_therapist_state> —— 初始 8+2 属性微调",
    "   JSON 格式：",
    "   {",
    "     \"empathy\": N, \"insight\": N, \"knowledge\": N, \"technique\": N,",
    "     \"judgment\": N, \"awareness\": N, \"communication\": N, \"resilience\": N,",
    "     \"humanity\": N, \"philosophy\": N",
    "   }",
    "",
    "=== 教育背景特殊规则 ===",
    "",
    "根据不同教育背景，初始藏书和工具有以下约束：",
    "",
    "【心理学本科】",
    "- 必须包含至少一本《普通心理学》或同类基础教材",
    "- 必须包含罗杰斯的《成为一个人》",
    "- 初始理论取向默认：来访者中心治疗",
    "- 可选额外书籍：1-2 本理论相关读物",
    "- 初始测评工具：无（尚未接受测评培训）",
    "",
    "【跨专业转行】",
    "- 必须包含一本跨专业相关的心理学入门书籍",
    "- 推荐包含《心理咨询师：入门到实践》或同类",
    "- 初始理论取向：可选多种（可能比心理学本科灵活）",
    "- 可能有前任专业相关的书籍（如计算机/文学/管理类书籍，非心理学但符合角色背景）",
    "",
    "【精神科医生】",
    "- 必须包含 DSM-5 或 ICD-11 诊断手册",
    "- 必须包含 MMPI-2 和 SCL-90 测评工具",
    "- 初始理论取向：偏向认知行为治疗或精神分析",
    "- 可选：精神药理学相关参考书籍",
    "- 属性微调：医学背景应体现在更高的理论知识和技术力上",
    "",
    "【社工出身】",
    "- 必须包含《社会工作概论》或同类基础读物",
    "- 推荐包含《家庭治疗》或社区心理相关书籍",
    "- 初始理论取向：偏向系统式治疗或来访者中心",
    "- 可选：社区心理、危机干预相关工具书",
    "- 属性微调：更高的沟通力和共情力",
    "",
    "【哲学学者】",
    "- 必须包含至少一本哲学著作（如《存在与时间》《现象学》等）",
    "- 推荐包含《存在主义心理治疗》(Yalom)",
    "- 初始理论取向：偏向存在主义治疗",
    "- 哲学思辨(philosophy)初始值应 +3（相较于其他背景）",
    "- 可选：心理学哲学相关读物",
    "",
    "【亲历者转型】",
    "- 可包含一本亲历者回忆录类的自我成长书籍",
    "- 推荐包含《当尼采哭泣》(Yalom 心理治疗小说)",
    "- 初始理论取向：偏向人本主义或存在主义",
    "- 属性微调：更高的共情力和自觉性",
    "- 初始来访者的困难程度应偏低",
    "",
    "=== 全局约束 ===",
    "",
    "1. 初始来访者难度不应超过玩家当前等级对应的能力范围",
    "   - 心理学徒阶段的咨询师不应接诊高难度/复杂创伤型来访者",
    "   - 初始来访者应以轻度适应问题或发展性问题为主",
    "2. 初始藏书数量：3-6 本（含必修和选修）",
    "3. 初始治疗工具数量：0-2 件",
    "4. 初始测评工具数量：0-2 件（精神科医生背景除外）",
    "5. 属性微调范围：不得超过 ±5（相对于教育背景默认属性）",
    "6. 世界时间应与角色年龄匹配",
    "7. 工作场景应与教育背景和等级匹配",
    "8. 初始来访者的治疗联盟初始值固定为 50",
    "9. 若开局叙事中未自然引入来访者，则 initialClient 可为 null",
    "10. 每本书的 effectDesc 应简要描述其对咨询师属性的增益方向",
  ].join("\n");

  // ================================================================
  // 教育背景初始配置模板
  // ================================================================

  /** 教育背景对应的初始藏书模板 */
  var EDUCATION_BOOK_TEMPLATES = {
    "心理学本科": {
      mandatory: [
        { name: "《普通心理学》", author: "彭聃龄", theory: "基础心理学", effectDesc: "心理学基础知识+3" },
        { name: "《成为一个人》", author: "Rogers", theory: "来访者中心治疗", effectDesc: "共情力+5，无条件接纳理解+20" },
      ],
      recommended: [
        { name: "《心理咨询面谈技术》", author: "Sommerville", theory: "通用技术", effectDesc: "沟通力+3" },
        { name: "《精神分析引论》", author: "Freud", theory: "经典精神分析", effectDesc: "洞察力+4" },
      ],
    },
    "跨专业转行": {
      mandatory: [
        { name: "《心理咨询师：入门到实践》", author: "中国心理学会", theory: "通用技术", effectDesc: "技术力+4" },
      ],
      recommended: [
        { name: "《津巴多普通心理学》", author: "Zimbardo", theory: "基础心理学", effectDesc: "理论知识+3" },
        { name: "《改变心理学的40项研究》", author: "Hock", theory: "基础心理学", effectDesc: "洞察力+3" },
      ],
    },
    "精神科医生": {
      mandatory: [
        { name: "《DSM-5 精神障碍诊断与分类手册》", author: "APA", theory: "诊断框架", effectDesc: "论断力+6，诊断知识+5" },
        { name: "《精神病学》", author: "郝伟", theory: "精神医学", effectDesc: "理论知识+5" },
      ],
      recommended: [
        { name: "《认知治疗：基础与应用》", author: "Beck", theory: "认知治疗", effectDesc: "技术力+4，理论知识+4" },
        { name: "《简明精神药理学》", author: "Stahl", theory: "精神医学", effectDesc: "理论知识+3" },
      ],
    },
    "社工出身": {
      mandatory: [
        { name: "《社会工作概论》", author: "王思斌", theory: "社会工作原理", effectDesc: "沟通力+3，人文素养+3" },
      ],
      recommended: [
        { name: "《家庭治疗概论》", author: "Goldberg", theory: "结构式家庭治疗", effectDesc: "沟通力+4，洞察力+2" },
        { name: "《危机干预策略》", author: "James", theory: "危机干预", effectDesc: "判断力+3，技术力+3" },
      ],
    },
    "哲学学者": {
      mandatory: [
        { name: "《存在与时间》", author: "Heidegger", theory: "存在哲学", effectDesc: "哲学思辨+6，人文素养+5" },
        { name: "《存在主义心理治疗》", author: "Yalom", theory: "存在主义治疗", effectDesc: "洞察力+5，共情力+3" },
      ],
      recommended: [
        { name: "《疯癫与文明》", author: "Foucault", theory: "后现代批判", effectDesc: "哲学思辨+4，洞察力+3" },
      ],
    },
    "亲历者转型": {
      mandatory: [
        { name: "《当尼采哭泣》", author: "Yalom", theory: "存在主义治疗", effectDesc: "共情力+4，人文素养+3" },
      ],
      recommended: [
        { name: "《身体从未忘记》", author: "van der Kolk", theory: "创伤治疗", effectDesc: "自觉性+4，洞察力+3" },
        { name: "《正念：此刻是一枝花》", author: "Kabat-Zinn", theory: "正念减压", effectDesc: "自觉性+3，心理韧+2" },
      ],
    },
  };

  /** 教育背景初始测评工具映射 */
  var EDUCATION_TOOL_TEMPLATES = {
    "心理学本科": {
      tools: [],
      assessments: [],
    },
    "跨专业转行": {
      tools: [],
      assessments: [],
    },
    "精神科医生": {
      tools: [
        { name: "临床观察记录表", type: "observation", usage: "系统记录来访者行为观察" },
      ],
      assessments: [
        { name: "MMPI-2", type: "personality", acquired: true, prerequisite: "精神科培训" },
        { name: "SCL-90", type: "symptom", acquired: true, prerequisite: "精神科培训" },
      ],
    },
    "社工出身": {
      tools: [
        { name: "家庭关系图绘制工具", type: "assessment", usage: "绘制家庭结构图" },
      ],
      assessments: [
        { name: "家庭环境量表(FES)", type: "family", acquired: true },
      ],
    },
    "哲学学者": {
      tools: [],
      assessments: [],
    },
    "亲历者转型": {
      tools: [],
      assessments: [],
    },
  };

  /** 教育背景→初始工作场景映射 */
  var EDUCATION_WORKPLACE_MAP = {
    "心理学本科": "大学校园",
    "跨专业转行": "大学/跨专业培训机构",
    "精神科医生": "精神卫生中心/综合医院精神科",
    "社工出身": "社区心理服务站",
    "哲学学者": "大学人文学院",
    "亲历者转型": "心理咨询机构（实习）",
  };

  /** 教育背景→初始地点映射 */
  var EDUCATION_LOCATION_MAP = {
    "心理学本科": "北京",
    "跨专业转行": "上海",
    "精神科医生": "广州",
    "社工出身": "深圳",
    "哲学学者": "北京",
    "亲历者转型": "杭州",
  };

  // ================================================================
  // 初始属性微调约束
  // ================================================================

  /** 属性微调最大偏移量 */
  var MAX_STAT_ADJUSTMENT = 5;

  /** 有效属性键列表 */
  var VALID_STAT_KEYS = [
    "empathy", "insight", "knowledge", "technique",
    "judgment", "awareness", "communication", "resilience",
    "humanity", "philosophy",
  ];

  // ================================================================
  // 对外暴露 API
  // ================================================================
  global.PsyDoctorInitStateRules = {
    /** system prompt 模板 */
    templates: {
      systemPrompt: INIT_STATE_AI_SYSTEM_PROMPT,
    },

    /** 教育背景初始藏书模板 */
    EDUCATION_BOOK_TEMPLATES: EDUCATION_BOOK_TEMPLATES,

    /** 教育背景初始工具模板 */
    EDUCATION_TOOL_TEMPLATES: EDUCATION_TOOL_TEMPLATES,

    /** 教育背景→工作场景 */
    EDUCATION_WORKPLACE_MAP: EDUCATION_WORKPLACE_MAP,

    /** 教育背景→初始地点 */
    EDUCATION_LOCATION_MAP: EDUCATION_LOCATION_MAP,

    /** 属性微调上限 */
    MAX_STAT_ADJUSTMENT: MAX_STAT_ADJUSTMENT,

    /** 有效属性键 */
    VALID_STAT_KEYS: VALID_STAT_KEYS,

    /**
     * 获取指定教育背景的初始藏书列表
     * @param {string} education 教育背景名称
     * @return {{ mandatory: Array, recommended: Array }}
     */
    getBooksForEducation: function (education) {
      return EDUCATION_BOOK_TEMPLATES[education] || { mandatory: [], recommended: [] };
    },

    /**
     * 获取指定教育背景的初始工具
     */
    getToolsForEducation: function (education) {
      return EDUCATION_TOOL_TEMPLATES[education] || { tools: [], assessments: [] };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
