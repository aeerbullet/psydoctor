/**
 * psydoctor（心理医生成长记）· 状态 AI 规则模板
 *
 * PsyDoctorStateRules —— 状态 AI 的系统指令模板与规则约束。
 * 状态 AI 在每次叙事 AI 输出后运行，负责解析叙事内容，
 * 输出结构化标签更新游戏状态。
 *
 * 引用架构：§5.3 状态 AI, §6.2 标签全集
 * 核心约束内容：
 *   - 来访者状态更新规则（±15% 变化约束）
 *   - 临床时数积累规则（不同类型时数不混淆）
 *   - 反移情变化规则（六种类型 + 触发映射）
 *   - 理论学习进步规则（六阶段阈值）
 *   - 物品操作规则（上限、去重、培训前提）
 */
(function (global) {
  "use strict";

  // ================================================================
  // 状态 AI 规则模板
  // ================================================================

  /**
   * 状态 AI 的 system prompt 模板
   * 由 state_generate.js 在构建状态 AI 请求时使用
   */
  var STATE_AI_SYSTEM_PROMPT = [
    "你是一位心理咨询职业生涯的状态管理AI。你的任务是根据叙事内容，精确更新心理咨询师和来访者的各项状态数据。",
    "",
    "=== 核心原则 ===",
    "1. 你只输出结构化 XML 标签，不输出叙事文本。叙事由另一 AI 负责。",
    "2. 每个标签的内容必须是合法的 JSON 格式。",
    "3. 数值变化必须基于叙事内容的合理推断。",
    "4. 如果没有信息表明某字段需要变化，则不要输出该标签。",
    "",
    "=== 你必须遵循的严格规则 ===",
    "",
    "【来访者状态更新规则】",
    "- 单回合症状变化(symptomChange)范围：[-15, +15]",
    "- 治疗联盟变化(allianceChange)范围：[-15, +15]",
    "- 防御变化(defenseChange)范围：[-10, +10]",
    "- 治疗联盟值域：[0, 100]，初始值为 50",
    "- 症状严重度值域：[0, 100]",
    "- 联盟降到 0 表示来访者脱落",
    "- 防御强度值域：[10, 95]",
    "- 治疗阶段(phase)：initial(初期) / middle(中期) / termination(结案) / followup(追踪)",
    "",
    "【临床时数积累规则】",
    "- 一次完整的咨询会话 → 临床时数 +1~2",
    "- 接受督导 → 督导时数 +0.5",
    "- 理论学习/培训/工作坊 → 对应理论的时数 +2~5",
    "- 个人体验（自己接受治疗）→ 个人体验时数 +1",
    "- 案例讨论/同行交流 → 督导时数 +0.5",
    "- 论文写作/学术研究 → 特定理论时数 +10~20",
    "- 不同类型时数不可混淆：临床时数≠督导时数≠理论时数≠个人体验时数",
    "",
    "【反移情变化规则】",
    "- 六种反移情类型：overIdentification(过度认同), defensiveDistancing(防御性疏离)",
    "  saviorComplex(救世主情结), professionalArrogance(专业傲慢)",
    "  burnoutNumbness(倦怠麻木), ethicalBlurring(伦理模糊)",
    "- 各反移情类型数值域：[0, 100]",
    "- 单次 change 范围：[1, 8]（积累）或 [-8, -1]（化解）",
    "- 风险等级判定：最大值 ≤15=low, 16-30=medium, 31-50=high, >50=critical",
    "- 触发源类型：来访者类型共鸣、个人议题共鸣、职业压力",
    "- 化解途径：接受督导(-3~5)、个人体验(-5~8)、休假(-1~2)",
    "",
    "【理论学习进步规则】",
    "- 理论学习阶段阈值（累计时数）：",
    "  未接触(0h) → 通读(10h) → 理解(40h) → 练习(100h) → 掌握(220h) → 整合(460h) → 创新(960h)",
    "- 每阶段需要的累计学习时数：[0, 10, 40, 100, 220, 460, 960]",
    "- 理论学习时数由叙事中的阅读、培训、工作坊、研究积累",
    "- 注意：理论学习时数是特定理论的时数，不是临床时数",
    "",
    "【物品操作规则】",
    "- 书籍可重复获得（不同版本/译本），但同一书名+作者视为已有",
    "- 藏书上限：30 本",
    "- 治疗工具上限：10 件",
    "- 测评工具：需要培训前提（如 MMPI-2 需要特定培训才能获得和使用）",
    "- 可操作类型：book(书籍), tool(治疗工具), assessment(测评工具)",
    "- 操作类型：add(增加), remove(移除)",
    "",
    "=== 输出标签说明 ===",
    "",
    "你可以输出以下标签（每个标签可选，按需输出）：",
    "",
    "1. <psy_world_state>",
    "   格式：{\"worldTimeString\":\"YYYY年 MM月 DD日 HH:MM\", \"currentLocation\":\"...\", \"currentWorkplace\":\"...\", \"age\":N}",
    "",
    "2. <psy_therapist_state>",
    "   格式：{\"currentFatigue\":N, \"burnoutLevel\":N, \"selfAwarenessChange\":N}",
    "",
    "3. <psy_client_state>",
    "   格式：{\"clientId\":\"...\", \"symptomChange\":N, \"allianceChange\":N, \"phaseProgress\":\"...\", \"defenseStatus\":\"...\"}",
    "",
    "4. <psy_clinical_gain>",
    "   格式：{\"clinicalHours\":N, \"supervisionHours\":N, \"personalTherapyHours\":N, \"theoryProgress\":{\"理论名\":N}, \"insightGained\":N}",
    "",
    "5. <psy_supervision_notes>",
    "   格式：{\"supervisorFeedback\":\"...\", \"blindSpotIdentified\":\"...\", \"growthArea\":\"...\"}",
    "",
    "6. <psy_career_event>",
    "   格式：{\"eventType\":\"...\", \"description\":\"...\", \"requirements\":{...}, \"deadline\":\"...\"}",
    "",
    "7. <psy_countertransference>",
    "   格式：{\"type\":\"...\", \"change\":N, \"triggerSource\":\"...\", \"riskLevel\":\"low/medium/high/critical\", \"manifestation\":\"...\"}",
    "",
    "8. <psy_nearby_people>",
    "   格式：[{\"id\":\"...\", \"displayName\":\"...\", \"role\":\"client/supervisor/colleague/mentor\", \"theoryOrientation\":\"...\", \"characterSheet\":{...}}]",
    "",
    "9. <psy_inventory_ops>",
    "   格式：[{\"op\":\"add/remove\", \"name\":\"...\", \"count\":N, \"type\":\"book/tool/assessment\", \"details\":{...}}]",
    "",
    "10. <psy_theory_milestone>",
    "    格式：{\"theoryName\":\"...\", \"milestoneType\":\"stage_advance/integration_ready/innovation_unlocked\", \"description\":\"...\", \"integrationUnlocked\":\"...\"}",
  ].join("\n");

  // ================================================================
  // 规则常量（供 JavaScript 引擎层使用）
  // ================================================================

  /** 单回合变化约束 */
  var CONSTRAINT = {
    symptomChangeMin: -15,
    symptomChangeMax: 15,
    allianceChangeMin: -15,
    allianceChangeMax: 15,
    defenseChangeMin: -10,
    defenseChangeMax: 10,
    fatigueMin: 0,
    fatigueMax: 100,
    burnoutMin: 0,
    burnoutMax: 10,
    allianceMin: 0,
    allianceMax: 100,
    symptomMin: 0,
    symptomMax: 100,
    defenseMin: 10,
    defenseMax: 95,
    ageMin: 18,
    ageMax: 100,
  };

  /** 理论学习阶段阈值（累计时数） */
  var THEORY_STAGE_THRESHOLDS = [
    0,    // Stage 0: 未接触
    10,   // Stage 1: 通读
    40,   // Stage 2: 理解
    100,  // Stage 3: 练习
    220,  // Stage 4: 掌握
    460,  // Stage 5: 整合
    960,  // Stage 6: 创新
  ];

  /** 六种反移情类型 */
  var COUNTERTRANSFERENCE_TYPES = [
    "overIdentification",
    "defensiveDistancing",
    "saviorComplex",
    "professionalArrogance",
    "burnoutNumbness",
    "ethicalBlurring",
  ];

  /** 反移情风险等级阈值 */
  var COUNTERTRANSFERENCE_RISK_THRESHOLDS = {
    low: 15,
    medium: 30,
    high: 50,
    // > 50 = critical
  };

  /** 物品容量上限 */
  var INVENTORY_LIMITS = {
    bookShelfMax: 30,
    therapyToolsMax: 10,
    assessmentToolsMax: 20,
  };

  /** 反移情化解效果 */
  var RESOLUTION_EFFECTS = {
    supervision: { min: 3, max: 5 },   // 接受督导
    personalTherapy: { min: 5, max: 8 }, // 个人体验
    selfCare: { min: 1, max: 2 },        // 休假/自我关照
    timePass: 0.1,                        // 时间推移
  };

  // 反移情中英文对照（供状态 AI 使用）
  var COUNTERTRANSFERENCE_LABELS = {
    overIdentification: "过度认同",
    defensiveDistancing: "防御性疏离",
    saviorComplex: "救世主情结",
    professionalArrogance: "专业傲慢",
    burnoutNumbness: "倦怠麻木",
    ethicalBlurring: "伦理模糊",
  };

  // ================================================================
  // 状态机函数
  // ================================================================

  /**
   * 根据累计时数计算理论阶段
   * @param {number} hours 累计学习时数
   * @return {number} stage [0, 6]
   */
  function getTheoryStageByHours(hours) {
    var h = (hours >= 0) ? hours : 0;
    for (var stage = THEORY_STAGE_THRESHOLDS.length - 1; stage >= 0; stage--) {
      if (h >= THEORY_STAGE_THRESHOLDS[stage]) return stage;
    }
    return 0;
  }

  /**
   * 获取下一阶段所需的累计时数
   * @param {number} currentStage 当前阶段 [0, 5]
   * @return {number} 所需累计时数（当前 stage 为 6 时返回 Infinity）
   */
  function getNextStageThreshold(currentStage) {
    if (currentStage >= THEORY_STAGE_THRESHOLDS.length - 1) return Infinity;
    return THEORY_STAGE_THRESHOLDS[currentStage + 1];
  }

  /**
   * 计算反移情综合风险等级
   * @param {object} countertransference 反移情状态对象
   * @return {string} "low" | "medium" | "high" | "critical"
   */
  function computeOverallRiskLevel(countertransference) {
    if (!countertransference) return "low";

    var maxVal = 0;
    for (var i = 0; i < COUNTERTRANSFERENCE_TYPES.length; i++) {
      var val = countertransference[COUNTERTRANSFERENCE_TYPES[i]];
      if (typeof val === "number" && val > maxVal) {
        maxVal = val;
      }
    }

    if (maxVal > COUNTERTRANSFERENCE_RISK_THRESHOLDS.high) return "critical";
    if (maxVal > COUNTERTRANSFERENCE_RISK_THRESHOLDS.medium) return "high";
    if (maxVal > COUNTERTRANSFERENCE_RISK_THRESHOLDS.low) return "medium";
    return "low";
  }

  /**
   * 获取阶段系数（用于理论学习 bonus 计算）
   * @param {number} stage [0, 6]
   * @return {number} 阶段系数
   */
  function getStageMultiplier(stage) {
    var multipliers = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.5];
    if (stage >= 0 && stage < multipliers.length) return multipliers[stage];
    return 0;
  }

  // ================================================================
  // 对外暴露 API
  // ================================================================
  global.PsyDoctorStateRules = {
    /** system prompt 模板 */
    templates: {
      systemPrompt: STATE_AI_SYSTEM_PROMPT,
    },

    /** 约束常量 */
    CONSTRAINT: CONSTRAINT,

    /** 理论学习阶段阈值 */
    THEORY_STAGE_THRESHOLDS: THEORY_STAGE_THRESHOLDS,

    /** 反移情类型列表 */
    COUNTERTRANSFERENCE_TYPES: COUNTERTRANSFERENCE_TYPES,

    /** 反移情风险阈值 */
    COUNTERTRANSFERENCE_RISK_THRESHOLDS: COUNTERTRANSFERENCE_RISK_THRESHOLDS,

    /** 反移情中文标签 */
    COUNTERTRANSFERENCE_LABELS: COUNTERTRANSFERENCE_LABELS,

    /** 物品容量上限 */
    INVENTORY_LIMITS: INVENTORY_LIMITS,

    /** 化解效果参数 */
    RESOLUTION_EFFECTS: RESOLUTION_EFFECTS,

    /** 根据时数计算理论阶段 */
    getTheoryStageByHours: getTheoryStageByHours,

    /** 获取下一阶段阈值 */
    getNextStageThreshold: getNextStageThreshold,

    /** 计算反移情综合风险等级 */
    computeOverallRiskLevel: computeOverallRiskLevel,

    /** 获取阶段系数 */
    getStageMultiplier: getStageMultiplier,
  };
})(typeof window !== "undefined" ? window : globalThis);
