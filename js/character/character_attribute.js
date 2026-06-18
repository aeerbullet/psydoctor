/**
 * character_attribute.js — 属性系统：8+2 维属性键定义、校验、类型
 * 对应架构文档 §2.2, §7.1, §8
 *
 * 提供 CharacterAttribute 命名空间，包含属性键常量、校验函数、中文标签映射。
 */
(function (global) {
  "use strict";

  // ===== 属性键定义 =====
  var ATTRIBUTE_KEYS = [
    "empathy",    // 共情力
    "insight",    // 洞察力
    "knowledge",  // 理论知识
    "technique",  // 技术力
    "judgment",   // 论断力
    "awareness",  // 自觉性
    "communication", // 沟通力
    "resilience", // 心理韧性
    "humanity",   // 人文素养
    "philosophy", // 哲学思辨
  ];

  // ===== 中文标签映射 =====
  var ATTRIBUTE_LABELS = {
    empathy: "共情力",
    insight: "洞察力",
    knowledge: "理论知识",
    technique: "技术力",
    judgment: "论断力",
    awareness: "自觉性",
    communication: "沟通力",
    resilience: "心理韧性",
    humanity: "人文素养",
    philosophy: "哲学思辨",
  };

  // ===== 属性分类 =====
  var ATTRIBUTE_TYPES = {
    empathy: "core",
    insight: "core",
    knowledge: "core",
    technique: "core",
    judgment: "core",
    awareness: "core",
    communication: "core",
    resilience: "core",
    humanity: "humanity",
    philosophy: "humanity",
  };

  // 分组
  var ATTRIBUTE_SECTIONS = {
    core: ["empathy", "insight", "knowledge", "technique", "judgment", "awareness", "communication", "resilience"],
    humanity: ["humanity", "philosophy"],
  };

  // ===== 校验函数 =====
  function isValidAttributeKey(key) {
    return ATTRIBUTE_KEYS.indexOf(key) !== -1;
  }

  function getAttributeLabel(key) {
    return ATTRIBUTE_LABELS[key] || key;
  }

  function getAttributeType(key) {
    return ATTRIBUTE_TYPES[key] || "core";
  }

  // ===== 工具函数 =====
  function createDefaultAttributes() {
    var attrs = {};
    ATTRIBUTE_KEYS.forEach(function (k) {
      attrs[k] = 0;
    });
    return attrs;
  }

  function cloneAttributes(source) {
    var attrs = {};
    ATTRIBUTE_KEYS.forEach(function (k) {
      attrs[k] = source && typeof source[k] === "number" ? source[k] : 0;
    });
    return attrs;
  }

  // ===== 暴露 API =====
  global.CharacterAttribute = {
    ATTRIBUTE_KEYS: ATTRIBUTE_KEYS,
    ATTRIBUTE_LABELS: ATTRIBUTE_LABELS,
    ATTRIBUTE_TYPES: ATTRIBUTE_TYPES,
    ATTRIBUTE_SECTIONS: ATTRIBUTE_SECTIONS,
    isValidAttributeKey: isValidAttributeKey,
    getAttributeLabel: getAttributeLabel,
    getAttributeType: getAttributeType,
    createDefaultAttributes: createDefaultAttributes,
    cloneAttributes: cloneAttributes,
  };
})(typeof window !== "undefined" ? window : globalThis);
