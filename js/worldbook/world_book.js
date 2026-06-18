/**
 * psydoctor（心理医生成长记）· 世界书知识基底引擎
 *
 * PsyDoctorWorldBook —— 心理学知识基底引擎
 * 在每次 AI 请求时，根据对话上下文中的关键词自动注入相关心理学专业知识，
 * 保持 AI 对心理学概念、治疗规范、伦理准则的准确使用。
 *
 * 依赖：PsyDoctorWorldBookEntries（须先加载）
 *
 * 引用架构：§12 世界书系统（心理学知识基底）
 * - §12.3 selectEntries 选择算法
 * - §12.5 注入格式
 */
(function (global) {
  "use strict";

  // ================================================================
  // 常量
  // ================================================================
  var DEFAULT_MAX_ENTRIES = 8;
  var ENTRY_SEPARATOR = "\n\n· · · 条目分隔 · · ·\n\n";
  var SECTION_TITLE = "【心理学知识基底摘录】\n\n";

  // ================================================================
  // 工具函数
  // ================================================================

  /** 安全获取世界书条目数据源 */
  function getEntries() {
    return (global.PsyDoctorWorldBookEntries && global.PsyDoctorWorldBookEntries.entries) || [];
  }

  /** 将关键词和扫描文本都小写化，做子串匹配 */
  function keyMatches(key, lowerText) {
    return lowerText.indexOf(key.toLowerCase()) !== -1;
  }

  // ================================================================
  // selectEntries — 核心选择算法
  //
  // 流程（详见 §12.3）：
  //   1. 分离 constant 条目（永远入选）
  //   2. 对非常量条目计算命中分
  //   3. 排序：priority 降序 → hits 降序 → id 字典序
  //   4. 去重后按序合并（constant 先于 triggered）
  //   5. 截断到 maxEntries（默认 8）
  // ================================================================
  function selectEntries(scanText, options) {
    if (!scanText) return [];

    var opts = options || {};
    var maxEntries = (opts.maxEntries > 0) ? opts.maxEntries : DEFAULT_MAX_ENTRIES;
    var allEntries = getEntries();
    if (!allEntries.length) return [];

    var lowerText = scanText.toLowerCase();

    // Step 1: 分离 constant 条目
    var constants = [];
    var nonConstants = [];

    for (var i = 0; i < allEntries.length; i++) {
      var entry = allEntries[i];
      if (entry.constant) {
        constants.push(entry);
      } else {
        nonConstants.push(entry);
      }
    }

    // Step 2: 对非常量条目计算命中分
    var scored = [];
    for (var j = 0; j < nonConstants.length; j++) {
      var e = nonConstants[j];
      var keys = e.keys || [];
      var hits = 0;
      for (var k = 0; k < keys.length; k++) {
        if (keyMatches(keys[k], lowerText)) {
          hits++;
        }
      }
      if (hits > 0) {
        scored.push({
          entry: e,
          hits: hits,
        });
      }
    }

    // Step 3: 排序
    // priority 降序 → hits 降序 → id 字典序
    scored.sort(function (a, b) {
      // priority 降序
      var pa = a.entry.priority || 0;
      var pb = b.entry.priority || 0;
      if (pa !== pb) return pb - pa;

      // hits 降序
      if (a.hits !== b.hits) return b.hits - a.hits;

      // id 字典序
      var idA = a.entry.id || "";
      var idB = b.entry.id || "";
      if (idA < idB) return -1;
      if (idA > idB) return 1;
      return 0;
    });

    // Step 4: 按序合并
    var result = constants.slice(); // constant 条目先于 triggered 条目

    // 去重：constant 条目不会被重复加入
    var existingIds = {};
    for (var ci = 0; ci < result.length; ci++) {
      existingIds[result[ci].id] = true;
    }

    for (var si = 0; si < scored.length; si++) {
      var se = scored[si].entry;
      if (!existingIds[se.id]) {
        result.push(se);
        existingIds[se.id] = true;
      }
    }

    // Step 5: 截断到 maxEntries
    if (result.length > maxEntries) {
      result = result.slice(0, maxEntries);
    }

    return result;
  }

  // ================================================================
  // formatForSystem — 格式化为 system prompt 可注入文本
  //
  // 格式（详见 §12.5）：
  //   【心理学知识基底摘录】
  //
  //   【心理治疗基本框架】
  //   保密原则：咨询师必须对来访者信息严格保密，例外情况包括...
  //
  //   · · · 条目分隔 · · ·
  //
  //   【CBT核心概念】
  //   认知歪曲类型：全或无思考、灾难化、过度泛化、心灵过滤...
  // ================================================================
  function formatForSystem(entries) {
    if (!entries || !entries.length) return "";

    var parts = [SECTION_TITLE];

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      parts.push("【" + (e.name || e.id) + "】");
      parts.push(e.content || "");

      if (i < entries.length - 1) {
        parts.push(ENTRY_SEPARATOR);
      }
    }

    return parts.join("\n");
  }

  // ================================================================
  // formatForSystemCompact — 紧凑格式（用于 token 敏感场景）
  // ================================================================
  function formatForSystemCompact(entries) {
    if (!entries || !entries.length) return "";

    var parts = [];

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      // 只取名称和前 200 字
      var content = (e.content || "").substring(0, 200);
      parts.push("【" + (e.name || e.id) + "】" + content);
    }

    return "【知识基底】" + parts.join(" | ");
  }

  // ================================================================
  // syncToBridgeStorage — 同步知识基底到桥接存储
  //
  // 将世界书条目同步到 SillyTavernBridge 的存储键
  // IMMORTAL_ST_BRIDGE_WORLDBOOKS_V1，以便 bridge 层可读取
  // ================================================================
  function syncToBridgeStorage() {
    try {
      var allEntries = getEntries();
      if (!allEntries.length) return;

      // 构建桥梁兼容格式的 worldbook 数据
      var bridgeData = [];
      for (var i = 0; i < allEntries.length; i++) {
        var e = allEntries[i];
        bridgeData.push({
          id: e.id,
          name: e.name,
          keys: e.keys || [],
          content: e.content || "",
          priority: e.priority || 0,
          constant: !!e.constant,
        });
      }

      var storageKey = "IMMORTAL_ST_BRIDGE_WORLDBOOKS_V1";
      var jsonData = JSON.stringify(bridgeData);
      try {
        localStorage.setItem(storageKey, jsonData);
      } catch (_lsErr) {
        // localStorage 可能满或不可用，忽略
      }

      // 也写入 sessionStorage 作为备用
      try {
        sessionStorage.setItem(storageKey, jsonData);
      } catch (_ssErr) {
        // 忽略
      }

      console.log("[psy:ai] world_book synced to bridge storage: " + allEntries.length + " entries");

    } catch (_e) {
      console.warn("[psy:ai] world_book syncToBridgeStorage failed:", _e);
    }
  }

  // ================================================================
  // 辅助方法
  // ================================================================

  /** 一次完成：扫描 → 选择 → 格式化 */
  function selectAndFormat(scanText, options) {
    var entries = selectEntries(scanText, options);
    return formatForSystem(entries);
  }

  /** 获取当前知识基底的摘要信息 */
  function getIndexSummary() {
    var all = getEntries();
    var cats = {};
    var catCounts = {};

    for (var i = 0; i < all.length; i++) {
      var c = all[i].category || "uncategorized";
      cats[c] = true;
      catCounts[c] = (catCounts[c] || 0) + 1;
    }

    var summary = {
      total: all.length,
      categories: Object.keys(cats).sort(),
      categoryCounts: catCounts,
      constants: all.filter(function (e) { return e.constant; }).length,
    };

    return summary;
  }

  // ================================================================
  // 对外暴露 API
  // ================================================================
  global.PsyDoctorWorldBook = {
    /** 核心：根据扫描文本选择匹配条目 */
    selectEntries: selectEntries,

    /** 格式化条目列表为 system prompt 可注入文本 */
    formatForSystem: formatForSystem,

    /** 紧凑格式 */
    formatForSystemCompact: formatForSystemCompact,

    /** 同步到桥接存储 */
    syncToBridgeStorage: syncToBridgeStorage,

    /** 一步完成扫描+选择+格式化 */
    selectAndFormat: selectAndFormat,

    /** 获取索引摘要 */
    getIndexSummary: getIndexSummary,
  };
})(typeof window !== "undefined" ? window : globalThis);
