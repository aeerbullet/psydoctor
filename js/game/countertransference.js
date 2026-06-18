/**
 * countertransference.js — 反移情累积与风险追踪
 * 对应架构文档 §6.4 反移情标签详细设计
 *
 * 提供 CountertransferenceTracker 命名空间，实现反移情的累积/化解机制和风险阈值计算。
 */
(function (global) {
  "use strict";

  // ===== 反移情类型定义 =====
  var CT_TYPES = [
    { key: "overIdentification", label: "过度认同", desc: "来访者经历与咨询师个人经历高度相似" },
    { key: "defensiveDistancing", label: "防御性疏离", desc: "来访者的痛苦反复触及咨询师的未处理创伤" },
    { key: "saviorComplex", label: "救世主情结", desc: "来访者进展缓慢，咨询师感到焦虑和无能" },
    { key: "professionalArrogance", label: "专业傲慢", desc: "咨询师过度相信自己的理论框架与判断" },
    { key: "burnoutNumbness", label: "倦怠麻木", desc: "长期高强度接案，缺乏自我关照" },
    { key: "ethicalBlurring", label: "伦理模糊", desc: "面临边界困境，判断力下降" },
  ];

  // ===== 风险阈值 =====
  var RISK_THRESHOLDS = {
    low: { max: 15, label: "正常", color: "#88cc88" },
    medium: { max: 30, label: "注意", color: "#ccaa44", penalty: { awareness: 0.90, empathy: 0.95 } },
    high: { max: 50, label: "警告", color: "#cc6644", penalty: { awareness: 0.75, judgment: 0.85, empathy: 0.90 } },
    critical: { max: Infinity, label: "危机", color: "#cc3333", penalty: { empathy: 0.70, insight: 0.70, knowledge: 0.70, technique: 0.70, judgment: 0.70, awareness: 0.70, communication: 0.70, resilience: 0.70, humanity: 0.70, philosophy: 0.70 } },
  };

  // ===== 创建初始反移情状态 =====
  function createInitialState() {
    return {
      overIdentification: 0,
      defensiveDistancing: 0,
      saviorComplex: 0,
      professionalArrogance: 0,
      burnoutNumbness: 0,
      ethicalBlurring: 0,
      overallRiskLevel: "low",
    };
  }

  // ===== 计算当前风险等级 =====
  function computeRisk(G) {
    var ct = G && G.countertransference;
    if (!ct) return "low";
    var maxVal = 0;
    CT_TYPES.forEach(function (t) {
      if (typeof ct[t.key] === "number" && ct[t.key] > maxVal) maxVal = ct[t.key];
    });
    if (maxVal > 50) return "critical";
    if (maxVal > 30) return "high";
    if (maxVal > 15) return "medium";
    return "low";
  }

  // ===== 检查反移情风险 =====
  function checkRisk(G) {
    var riskLevel = computeRisk(G);
    if (!G || !G.countertransference) return riskLevel;
    var oldLevel = G.countertransference.overallRiskLevel || "low";
    G.countertransference.overallRiskLevel = riskLevel;

    // 如果风险等级上升，返回变化信息
    var levels = ["low", "medium", "high", "critical"];
    var oldIdx = levels.indexOf(oldLevel);
    var newIdx = levels.indexOf(riskLevel);

    return {
      oldLevel: oldLevel,
      newLevel: riskLevel,
      escalated: newIdx > oldIdx,
      deescalated: newIdx < oldIdx,
      threshold: RISK_THRESHOLDS[riskLevel],
    };
  }

  // ===== 应用反移情变化 =====
  function applyChange(G, type, change) {
    if (!G || !G.countertransference) return false;

    // 校验 type
    var valid = false;
    CT_TYPES.forEach(function (t) {
      if (t.key === type) valid = true;
    });
    if (!valid) return false;

    var ct = G.countertransference;
    ct[type] = (ct[type] || 0) + change;
    if (ct[type] < 0) ct[type] = 0;
    if (ct[type] > 100) ct[type] = 100;

    // 重新计算风险等级
    checkRisk(G);
    return true;
  }

  // ===== 累积反移情（基于触发源） =====
  function accumulate(G, triggerSource, caseType, similarity) {
    if (!G || !G.countertransference) return null;

    var ct = G.countertransference;
    var awareness = (G.psychologistBase && G.psychologistBase.awareness) || 50;
    var personalTherapyHours = G.personalTherapyHours || 0;

    // 计算触发强度
    var simScore = similarity || 5;
    if (caseType === "trauma" && simScore < 5) simScore = 5;
    if (caseType === "existential_crisis") simScore = Math.max(simScore, 4);

    // 确定类型
    var type = "overIdentification";
    if (simScore >= 7) type = "overIdentification";
    else if (awareness < 30) type = "professionalArrogance";
    else if (caseType === "personality_disorder") type = "defensiveDistancing";
    else if (G.activeEthicalDilemma) type = "ethicalBlurring";
    else type = "saviorComplex";

    // 计算累积量
    var base = simScore * 0.5;
    var awarenessResist = 1 - awareness / 200;
    var therapyResist = 1 - Math.min(personalTherapyHours / 500, 0.8);
    var change = base * awarenessResist * therapyResist;
    change = clamp(change, 0.5, 8);

    ct[type] = (ct[type] || 0) + change;
    if (ct[type] > 100) ct[type] = 100;

    var riskResult = checkRisk(G);

    return {
      type: type,
      change: Math.round(change * 10) / 10,
      triggerSource: triggerSource,
      riskLevel: riskResult.newLevel,
      manifestation: getManifestation(type),
    };
  }

  // ===== 化解反移情 =====
  function resolve(G, type, change, method) {
    if (!G || !G.countertransference) return false;

    if (type === "all") {
      // 所有类型减少
      CT_TYPES.forEach(function (t) {
        G.countertransference[t.key] = Math.max(0, (G.countertransference[t.key] || 0) - change);
      });
    } else {
      if (!G.countertransference[type]) return false;
      G.countertransference[type] = Math.max(0, G.countertransference[type] - change);
    }

    // 消耗时数
    if (method === "supervision") {
      G.supervisionHours = (G.supervisionHours || 0) + 0.5;
    } else if (method === "personal_therapy") {
      G.personalTherapyHours = (G.personalTherapyHours || 0) + 1;
      if (G.psychologistBase) G.psychologistBase.awareness = (G.psychologistBase.awareness || 0) + 2;
    } else if (method === "rest") {
      G.currentFatigue = Math.max(0, (G.currentFatigue || 0) - 20);
      G.burnoutLevel = Math.max(0, (G.burnoutLevel || 0) - 1);
    }

    checkRisk(G);
    return true;
  }

  // ===== 随着时间的推移自然化解 =====
  function timeDecay(G) {
    if (!G || !G.countertransference) return;
    var ct = G.countertransference;
    CT_TYPES.forEach(function (t) {
      ct[t.key] = Math.max(0, (ct[t.key] || 0) - 0.1);
    });
    checkRisk(G);
  }

  // ===== 获取风险摘要 =====
  function getRiskSummary(G) {
    var ct = G && G.countertransference;
    if (!ct) return { level: "low", maxValue: 0, types: {} };
    var maxVal = 0;
    var typeValues = {};
    CT_TYPES.forEach(function (t) {
      var v = ct[t.key] || 0;
      typeValues[t.key] = v;
      if (v > maxVal) maxVal = v;
    });
    return {
      level: ct.overallRiskLevel || "low",
      maxValue: maxVal,
      types: typeValues,
    };
  }

  // ===== 获取症状描述 =====
  function getManifestation(type) {
    var manifestations = {
      overIdentification: "你发现自己越来越频繁地想起来访者的事，甚至在咨询时间之外也放不下。",
      defensiveDistancing: "你注意到自己在咨询中不自觉地减少了眼神接触，语气也变得更为正式和疏离。",
      saviorComplex: "你觉得来访者的进展慢得让人焦虑，你开始怀疑自己的专业能力。",
      professionalArrogance: "你越来越确信自己的理论框架是正确的，对不同的观点变得不耐烦。",
      burnoutNumbness: "你发现自己在咨询中有些麻木，来访者的故事不再能触动你。",
      ethicalBlurring: "你在边界问题上越来越模糊，开始怀疑自己是否做出了正确的职业判断。",
    };
    return manifestations[type] || "";
  }

  // ===== 工具函数 =====
  function clamp(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
  }

  // ===== 暴露 API =====
  global.CountertransferenceTracker = {
    CT_TYPES: CT_TYPES,
    RISK_THRESHOLDS: RISK_THRESHOLDS,
    createInitialState: createInitialState,
    computeRisk: computeRisk,
    checkRisk: checkRisk,
    applyChange: applyChange,
    accumulate: accumulate,
    resolve: resolve,
    timeDecay: timeDecay,
    getRiskSummary: getRiskSummary,
    getManifestation: getManifestation,
  };
})(typeof window !== "undefined" ? window : globalThis);
