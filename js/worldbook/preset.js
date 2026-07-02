/**
 * psydoctor（心理医生成长记）· AI 预设管理器
 *
 * PsyDoctorAiPreset —— AI 叙事预设/规则管理逻辑层。
 * 继承 mortal_journey 的 AI 预设架构，负责：
 *   1. 管理活跃叙事预设与规则预设
 *   2. 模板变量填充 {{VAR}} → 运行时值
 *   3. 组装完整的 system prompt（预设 + 规则）
 *   4. 预设选择/切换
 *
 * 依赖：PsyDoctorPresetContent（须先加载）
 *
 * 引用架构：§13 AI 预设系统
 *   §13.1 双层预设结构
 *   §13.3 模板变量
 */
(function (global) {
  "use strict";

  // ================================================================
  // 私有状态
  // ================================================================

  /** 当前激活的叙事预设 ID */
  var _activePresetId = null;

  /** 自定义预设存储键 */
  var CUSTOM_PRESET_KEY = "psy_ai_presets_v1";
  var ACTIVE_PRESET_KEY = "psy_active_preset_id_v1";

  // ================================================================
  // 辅助函数
  // ================================================================

  /** 安全获取预设内容数据 */
  function getContent() {
    return global.PsyDoctorPresetContent || null;
  }

  // ================================================================
  // 活跃预设管理
  // ================================================================

  /** 获取当前活跃的叙事预设对象 */
  function getActivePreset() {
    var content = getContent();
    if (!content) return null;

    // 尝试获取已设置的活跃预设
    if (_activePresetId) {
      var preset = content.getPresetById(_activePresetId);
      if (preset) return preset;
    }

    // 尝试从 localStorage 恢复
    try {
      var savedId = localStorage.getItem(ACTIVE_PRESET_KEY);
      if (savedId) {
        var savedPreset = content.getPresetById(savedId);
        if (savedPreset) {
          _activePresetId = savedId;
          return savedPreset;
        }
      }
    } catch (_e) { /* 忽略 */ }

    // 返回默认预设
    var defaultPreset = content.getDefaultPreset();
    if (defaultPreset) {
      _activePresetId = defaultPreset.id;
    }
    return defaultPreset;
  }

  /** 设置活跃叙事预设 */
  function setActivePreset(presetId) {
    var content = getContent();
    if (!content) return false;

    var preset = content.getPresetById(presetId);
    if (!preset) return false;

    _activePresetId = presetId;

    // 持久化到 localStorage
    try {
      localStorage.setItem(ACTIVE_PRESET_KEY, presetId);
    } catch (_e) { /* 忽略 */ }

    return true;
  }

  /** 获取预设列表（供 UI 选择器使用） */
  function getPresetList() {
    var content = getContent();
    if (!content) return [];
    return content.presets || [];
  }

  // ================================================================
  // 获取活跃规则预设列表
  // ================================================================

  /** 获取当前活跃的规则预设列表 */
  function getActiveRulePresets() {
    var content = getContent();
    if (!content) return [];
    return content.getActiveRulePresets ? content.getActiveRulePresets() : [];
  }

  /**
   * 获取规则预设内容（按 PSY_STORY_RULE_PRESET_IDS 顺序）
   * @param {boolean} includeHeader 是否包含每条规则的标题头
   * @return {string[]} 规则预设内容数组
   */
  function getActiveRulePresetContents(includeHeader) {
    var presets = getActiveRulePresets();
    var contents = [];
    for (var i = 0; i < presets.length; i++) {
      var text = presets[i].content || "";
      if (includeHeader && presets[i].name) {
        text = "【" + presets[i].name + "】\n" + text;
      }
      contents.push(text);
    }
    return contents;
  }

  /**
   * 获取拼接后的规则预设文本
   * @param {string} separator 规则之间的分隔符（默认两条换行）
   * @return {string}
   */
  function getActiveRulePresetsText(separator) {
    var sep = separator || "\n\n";
    var contents = getActiveRulePresetContents(true);
    return contents.join(sep);
  }

  // ================================================================
  // 模板变量填充
  // （§13.3 模板变量表）
  // ================================================================

  /**
   * 填充模板变量
   * @param {string} template 含 {{VAR}} 占位符的文本
   * @param {object} G 当前 PsyDoctorGame 状态
   * @param {object} fc 命运抉择对象
   * @return {string} 替换后的文本
   */
  function fillTemplateVars(template, G, fc) {
    if (!template) return "";
    if (!G && !fc) return template;

    var result = template;
    var game = G || {};
    var fate = fc || (game.fateChoice) || {};

    // {{PLAYER_NAME}}
    result = replaceVar(result, "PLAYER_NAME", function () {
      return fate.playerName || "咨询师";
    });

    // {{DOCTOR_LEVEL}}
    result = replaceVar(result, "DOCTOR_LEVEL", function () {
      var level = game.doctorLevel;
      if (!level) return "心理学徒·初窥";
      var major = level.major || "心理学徒";
      var minor = level.minor || "初窥";
      return major + "·" + minor;
    });

    // {{CLINICAL_HOURS}}
    result = replaceVar(result, "CLINICAL_HOURS", function () {
      var h = game.clinicalHours;
      if (h === undefined || h === null) return "0";
      return String(Math.round(h));
    });

    // {{THEORY_ORIENTATION}}
    result = replaceVar(result, "THEORY_ORIENTATION", function () {
      return game.activeTheoryOrientation || fate.initialTheory || "来访者中心治疗";
    });

    // {{CURRENT_CLIENTS_SUMMARY}}
    result = replaceVar(result, "CURRENT_CLIENTS_SUMMARY", function () {
      return buildClientsSummary(game);
    });

    // {{PSYCHOLOGIST_BASE_STATS}}
    result = replaceVar(result, "PSYCHOLOGIST_BASE_STATS", function () {
      return buildStatsSummary(game);
    });

    // {{COUNTERTRANSFERENCE_STATUS}}
    result = replaceVar(result, "COUNTERTRANSFERENCE_STATUS", function () {
      return buildCountertransferenceSummary(game);
    });

    // {{ACTIVE_CAREER_EVENTS}}
    result = replaceVar(result, "ACTIVE_CAREER_EVENTS", function () {
      return buildCareerEventsSummary(game);
    });

    // {{BOOKSHELF_SUMMARY}}
    result = replaceVar(result, "BOOKSHELF_SUMMARY", function () {
      return buildBookShelfSummary(game);
    });

    return result;
  }

  /**
   * 替换单个变量（支持多次出现）
   */
  function replaceVar(text, varName, getter) {
    var re = new RegExp("\\{\\{" + varName + "\\}\\}", "g");
    var value = getter();
    return text.replace(re, value);
  }

  // ================================================================
  // 模板变量构建函数（供 fillTemplateVars 内部调用）
  // ================================================================

  /** 构建来访者摘要 */
  function buildClientsSummary(game) {
    var clients = game.currentClients;
    if (!clients || !clients.length) return "当前无来访者";

    var parts = [];
    for (var i = 0; i < clients.length && i < 4; i++) {
      var c = clients[i];
      var phase = "";
      switch (c.treatmentPhase) {
        case "initial": phase = "初始阶段"; break;
        case "middle": phase = "中间阶段"; break;
        case "termination": phase = "结案阶段"; break;
        default: phase = c.treatmentPhase || "初始阶段";
      }
      parts.push(c.displayName + "(" + (c.chiefComplaint || "主诉待补充") + ", " + phase + ")");
    }
    if (clients.length > 4) {
      parts.push("等共" + clients.length + "位来访者");
    }
    return parts.join("；");
  }

  /** 构建 8+2 属性摘要 */
  function buildStatsSummary(game) {
    var base = game.psychologistBase;
    if (!base) return "待计算";
    var parts = [];
    var keys = ["empathy", "insight", "knowledge", "technique", "judgment", "awareness", "communication", "resilience", "humanity", "philosophy"];
    var labels = {
      empathy: "共情力", insight: "洞察力", knowledge: "理论知识", technique: "技术力",
      judgment: "论断力", awareness: "自觉性", communication: "沟通力", resilience: "心理韧",
      humanity: "人文素养", philosophy: "哲学思辨",
    };
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (base[k] !== undefined && base[k] !== null) {
        parts.push((labels[k] || k) + ":" + base[k]);
      }
    }
    return parts.join(" ");
  }

  /** 构建反移情状态摘要 */
  function buildCountertransferenceSummary(game) {
    var ct = game.countertransference;
    if (!ct) return "无";

    var parts = [];
    var types = [
      { key: "overIdentification", label: "过度认同" },
      { key: "defensiveDistancing", label: "防御性疏离" },
      { key: "saviorComplex", label: "救世主情结" },
      { key: "professionalArrogance", label: "专业傲慢" },
      { key: "burnoutNumbness", label: "倦怠麻木" },
      { key: "ethicalBlurring", label: "伦理模糊" },
    ];

    var hasNonZero = false;
    for (var i = 0; i < types.length; i++) {
      var val = ct[types[i].key];
      if (val > 0) {
        parts.push(types[i].label + ":" + val);
        hasNonZero = true;
      }
    }

    if (!hasNonZero) {
      parts.push("各项反移情处于低水平");
    }

    var risk = ct.overallRiskLevel || "low";
    var riskLabel = risk === "low" ? "低风险" : risk === "medium" ? "中风险" : risk === "high" ? "高风险" : "危急";
    parts.push("整体风险:" + riskLabel);

    return parts.join(" ");
  }

  /** 构建职业生涯事件摘要 */
  function buildCareerEventsSummary(game) {
    var events = game.activeCareerEvents;
    if (!events || !events.length) return "无活跃事件";
    var parts = [];
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      parts.push(e.eventType || e.description || ("事件" + (i + 1)));
      if (e.deadline) parts.push("(截止:" + e.deadline + ")");
    }
    return parts.join("；");
  }

  /** 构建藏书摘要 */
  function buildBookShelfSummary(game) {
    var books = game.bookShelf;
    if (!books || !books.length) return "无藏书";
    var total = books.length;
    var names = [];
    for (var i = 0; i < books.length && i < 5; i++) {
      names.push(books[i].name || books[i].title || "未命名");
    }
    var summary = "共" + total + "本：" + names.join("、");
    if (total > 5) summary += "等";
    return summary;
  }

  // ================================================================
  // 构建完整 system prompt
  // ================================================================

  /**
   * 构建完整的 system prompt
   * @param {object} G 当前游戏状态
   * @param {object} fc 命运抉择对象
   * @param {string} [presetId] 可选预设 ID，默认使用活跃预设
   * @param {object} [options] 其他选项
   * @return {string} 完整 system prompt
   */
  function buildSystemPrompt(G, fc, presetId, options) {
    var opts = options || {};

    // 获取叙事预设
    var preset = null;
    if (presetId) {
      var content = getContent();
      if (content) preset = content.getPresetById(presetId);
    }
    if (!preset) {
      preset = getActivePreset();
    }
    if (!preset) return "";

    // 填充模板变量
    var systemPrompt = fillTemplateVars(preset.systemPrompt || "", G, fc);

    // 拼接规则预设
    var includeRules = opts.includeRules !== false; // 默认包含
    if (includeRules) {
      var rulesText = getActiveRulePresetsText("\n\n");
      if (rulesText) {
        systemPrompt += "\n\n" + rulesText;
      }
    }

    // 知识基底摘录（如果外部提供）
    if (opts.knowledgeBaseText) {
      systemPrompt += "\n\n" + opts.knowledgeBaseText;
    }

    return systemPrompt;
  }

  // ================================================================
  // 自定义预设管理
  // ================================================================

  /** 保存自定义预设到 localStorage */
  function saveCustomPresets(presets) {
    try {
      localStorage.setItem(CUSTOM_PRESET_KEY, JSON.stringify(presets));
      return true;
    } catch (_e) {
      return false;
    }
  }

  /** 从 localStorage 加载自定义预设 */
  function loadCustomPresets() {
    try {
      var raw = localStorage.getItem(CUSTOM_PRESET_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_e) { /* 忽略 */ }
    return [];
  }

  // ================================================================
  // 世界 AI 预设获取（v2.0 新增）
  // ================================================================

  /** 获取世界 AI 的固定 system prompt（委托给 PsyDoctorPresetContent） */
  function getWorldAiSystemPrompt() {
    var content = getContent();
    if (content && typeof content.getWorldAiSystemPrompt === "function") {
      return content.getWorldAiSystemPrompt();
    }
    return "你是心理医生成长记的世界叙事AI。";
  }

  // ================================================================
  // 对外暴露 API
  // ================================================================
  global.PsyDoctorAiPreset = {
    /** 预设管理 */
    getActivePreset: getActivePreset,
    setActivePreset: setActivePreset,
    getPresetList: getPresetList,

    /** 规则预设管理 */
    getActiveRulePresets: getActiveRulePresets,
    getActiveRulePresetContents: getActiveRulePresetContents,
    getActiveRulePresetsText: getActiveRulePresetsText,

    /** 世界 AI 预设（v2.0） */
    getWorldAiSystemPrompt: getWorldAiSystemPrompt,

    /** 模板变量 */
    fillTemplateVars: fillTemplateVars,

    /** 构建完整的 system prompt */
    buildSystemPrompt: buildSystemPrompt,

    /** 自定义预设 */
    saveCustomPresets: saveCustomPresets,
    loadCustomPresets: loadCustomPresets,

    /** 模板变量构建工具（对外暴露以便独立使用） */
    buildClientsSummary: buildClientsSummary,
    buildStatsSummary: buildStatsSummary,
    buildCountertransferenceSummary: buildCountertransferenceSummary,
    buildCareerEventsSummary: buildCareerEventsSummary,
    buildBookShelfSummary: buildBookShelfSummary,
  };
})(typeof window !== "undefined" ? window : globalThis);
