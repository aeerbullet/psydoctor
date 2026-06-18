/**
 * doctor_level.js — 心理医生等级基础属性表与临床时数阶梯
 * 对应架构文档 §8.2 等级基础属性表
 *
 * 提供 DoctorLevelState 命名空间，包含完整的 7×3=21 阶段等级表。
 */
(function (global) {
  "use strict";

  // ===== 完整 21 行等级属性表 =====
  // levelIndex 0~20
  var DOCTOR_LEVEL_TABLE = [
    // levelIndex 0: 心理学徒·初窥
    { empathy:10, insight:5, knowledge:10, technique:3, judgment:3, awareness:5, communication:8, resilience:5, humanity:10, philosophy:5, clinicalHoursRequired:0 },
    // levelIndex 1: 心理学徒·践行
    { empathy:15, insight:8, knowledge:18, technique:5, judgment:5, awareness:8, communication:12, resilience:8, humanity:12, philosophy:8, clinicalHoursRequired:50 },
    // levelIndex 2: 心理学徒·贯通
    { empathy:20, insight:12, knowledge:28, technique:8, judgment:8, awareness:12, communication:16, resilience:10, humanity:15, philosophy:10, clinicalHoursRequired:100 },
    // levelIndex 3: 实习咨询师·初窥
    { empathy:28, insight:18, knowledge:38, technique:12, judgment:12, awareness:18, communication:22, resilience:15, humanity:20, philosophy:13, clinicalHoursRequired:200 },
    // levelIndex 4: 实习咨询师·践行
    { empathy:38, insight:25, knowledge:48, technique:18, judgment:18, awareness:25, communication:30, resilience:20, humanity:25, philosophy:18, clinicalHoursRequired:350 },
    // levelIndex 5: 实习咨询师·贯通
    { empathy:50, insight:35, knowledge:60, technique:25, judgment:25, awareness:35, communication:40, resilience:28, humanity:32, philosophy:22, clinicalHoursRequired:500 },
    // levelIndex 6: 初级咨询师·初窥
    { empathy:65, insight:48, knowledge:78, technique:35, judgment:35, awareness:45, communication:52, resilience:35, humanity:40, philosophy:28, clinicalHoursRequired:700 },
    // levelIndex 7: 初级咨询师·践行
    { empathy:82, insight:60, knowledge:95, technique:45, judgment:45, awareness:58, communication:65, resilience:45, humanity:50, philosophy:35, clinicalHoursRequired:1000 },
    // levelIndex 8: 初级咨询师·贯通
    { empathy:100, insight:75, knowledge:115, technique:55, judgment:55, awareness:70, communication:80, resilience:55, humanity:60, philosophy:42, clinicalHoursRequired:1500 },
    // levelIndex 9: 资深咨询师·初窥
    { empathy:125, insight:95, knowledge:140, technique:70, judgment:70, awareness:88, communication:98, resilience:68, humanity:72, philosophy:52, clinicalHoursRequired:2000 },
    // levelIndex 10: 资深咨询师·践行
    { empathy:155, insight:118, knowledge:170, technique:85, judgment:88, awareness:108, communication:120, resilience:85, humanity:88, philosophy:65, clinicalHoursRequired:3000 },
    // levelIndex 11: 资深咨询师·贯通
    { empathy:190, insight:145, knowledge:205, technique:105, judgment:108, awareness:130, communication:145, resilience:105, humanity:105, philosophy:80, clinicalHoursRequired:4500 },
    // levelIndex 12: 治疗专家·初窥
    { empathy:230, insight:175, knowledge:248, technique:128, judgment:135, awareness:155, communication:175, resilience:130, humanity:128, philosophy:98, clinicalHoursRequired:6000 },
    // levelIndex 13: 治疗专家·践行
    { empathy:275, insight:215, knowledge:295, technique:155, judgment:165, awareness:185, communication:210, resilience:160, humanity:155, philosophy:120, clinicalHoursRequired:8000 },
    // levelIndex 14: 治疗专家·贯通
    { empathy:330, insight:260, knowledge:350, technique:188, judgment:200, awareness:220, communication:250, resilience:195, humanity:188, philosophy:145, clinicalHoursRequired:12000 },
    // levelIndex 15: 心理学大师·初窥
    { empathy:400, insight:310, knowledge:410, technique:225, judgment:245, awareness:260, communication:300, resilience:235, humanity:225, philosophy:175, clinicalHoursRequired:16000 },
    // levelIndex 16: 心理学大师·践行
    { empathy:480, insight:370, knowledge:480, technique:270, judgment:295, awareness:310, communication:355, resilience:285, humanity:270, philosophy:210, clinicalHoursRequired:25000 },
    // levelIndex 17: 心理学大师·贯通
    { empathy:570, insight:440, knowledge:560, technique:325, judgment:355, awareness:370, communication:420, resilience:345, humanity:325, philosophy:255, clinicalHoursRequired:40000 },
    // levelIndex 18: 心灵哲学家·初窥
    { empathy:680, insight:520, knowledge:650, technique:390, judgment:425, awareness:440, communication:500, resilience:415, humanity:390, philosophy:310, clinicalHoursRequired:55000 },
    // levelIndex 19: 心灵哲学家·践行
    { empathy:810, insight:620, knowledge:760, technique:470, judgment:510, awareness:530, communication:590, resilience:500, humanity:470, philosophy:380, clinicalHoursRequired:75000 },
    // levelIndex 20: 心灵哲学家·贯通
    { empathy:1200, insight:850, knowledge:900, technique:750, judgment:750, awareness:850, communication:800, resilience:850, humanity:850, philosophy:780, clinicalHoursRequired:100000 },
  ];

  // ===== 大阶段映射 =====
  var MAJOR_STAGES = {
    0: "心理学徒",
    3: "实习咨询师",
    6: "初级咨询师",
    9: "资深咨询师",
    12: "治疗专家",
    15: "心理学大师",
    18: "心灵哲学家",
  };

  // ===== 小阶段映射 =====
  var MINOR_STAGES = ["初窥", "践行", "贯通"];

  // ===== 辅助方法 =====
  function getBaseStats(levelIndex) {
    if (levelIndex < 0 || levelIndex >= DOCTOR_LEVEL_TABLE.length) {
      return null;
    }
    return DOCTOR_LEVEL_TABLE[levelIndex];
  }

  function getClinicalHoursRequired(levelIndex) {
    var stats = getBaseStats(levelIndex);
    return stats ? stats.clinicalHoursRequired : null;
  }

  function getMajorStage(levelIndex) {
    if (levelIndex < 0 || levelIndex > 20) return null;
    var majorIdx = Math.floor(levelIndex / 3) * 3;
    return MAJOR_STAGES[majorIdx] || null;
  }

  function getMinorStage(levelIndex) {
    if (levelIndex < 0 || levelIndex > 20) return null;
    return MINOR_STAGES[levelIndex % 3];
  }

  function getLevelLabel(levelIndex) {
    var major = getMajorStage(levelIndex);
    var minor = getMinorStage(levelIndex);
    if (!major || !minor) return "未知";
    return major + "·" + minor;
  }

  function getMaxLevelIndex() {
    return DOCTOR_LEVEL_TABLE.length - 1;
  }

  // ===== 暴露 API =====
  global.DoctorLevelState = {
    DOCTOR_LEVEL_TABLE: DOCTOR_LEVEL_TABLE,
    MAJOR_STAGES: MAJOR_STAGES,
    MINOR_STAGES: MINOR_STAGES,
    getBaseStats: getBaseStats,
    getClinicalHoursRequired: getClinicalHoursRequired,
    getMajorStage: getMajorStage,
    getMinorStage: getMinorStage,
    getLevelLabel: getLevelLabel,
    getMaxLevelIndex: getMaxLevelIndex,
  };
})(typeof window !== "undefined" ? window : globalThis);
