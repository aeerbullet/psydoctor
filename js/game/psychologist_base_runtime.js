/**
 * psychologist_base_runtime.js — 心理医生属性计算引擎
 * 对应架构文档 §8.1-§8.5 属性计算管线
 *
 * 提供 PsychologistBaseRuntime 命名空间，实现 6 步属性计算管线。
 */
(function (global) {
  "use strict";

  // ===== 理论学习阶段系数 =====
  var THEORY_STAGE_COEFFICIENTS = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.5];

  // ===== 反移情惩罚映射 =====
  var CT_PENALTIES = {
    low: {},
    medium: { awareness: 0.90, empathy: 0.95 },
    high: { awareness: 0.75, judgment: 0.85, empathy: 0.90 },
    critical: { empathy: 0.70, insight: 0.70, knowledge: 0.70, technique: 0.70, judgment: 0.70, awareness: 0.70, communication: 0.70, resilience: 0.70, humanity: 0.70, philosophy: 0.70 },
  };

  // ===== 倦怠惩罚级别 =====
  var FATIGUE_PENALTIES = [
    { max: 30, effects: {} },
    { max: 60, effects: { empathy: 0.95, communication: 0.95 } },
    { max: 85, effects: { empathy: 0.85, insight: 0.90, resilience: 0.90 } },
    { max: 100, effects: { empathy: 0.80, insight: 0.80, knowledge: 0.80, technique: 0.80, judgment: 0.80, awareness: 0.80, communication: 0.80, resilience: 0.80, humanity: 0.80, philosophy: 0.80 } },
  ];

  // ===== 理论属性贡献（需要在运行时从 TheoryState 获取，兜底定义）=====
  var FALLBACK_THEORY_CONTRIBUTIONS = {
    "来访者中心治疗": { empathy: 15, communication: 10, awareness: 8 },
    "认知治疗": { insight: 12, technique: 10, judgment: 8 },
    "经典精神分析": { insight: 15, judgment: 8, awareness: 7 },
    "存在主义治疗": { humanity: 12, empathy: 8, philosophy: 10 },
    "家庭治疗": { communication: 12, insight: 8, technique: 5 },
    "正念减压": { awareness: 10, resilience: 8, empathy: 5 },
    "辩证行为治疗": { technique: 12, judgment: 8, resilience: 10 },
    "叙事治疗": { communication: 10, insight: 10, philosophy: 5 },
    "情绪聚焦治疗": { empathy: 12, communication: 8, awareness: 5 },
    "接纳承诺治疗": { insight: 10, resilience: 10, awareness: 8 },
    "心理动力治疗": { insight: 12, judgment: 10, awareness: 8 },
    "人际心理治疗": { communication: 12, empathy: 8, insight: 5 },
    "图式治疗": { insight: 10, technique: 10, judgment: 8 },
    "正念认知治疗": { insight: 12, awareness: 10, technique: 6 },
    "EMDR": { technique: 12, insight: 8, resilience: 5 },
    "动机式访谈": { communication: 8, empathy: 8, technique: 5 },
    "沙盘治疗": { empathy: 8, communication: 6, technique: 5 },
    "艺术治疗": { empathy: 8, humanity: 8, technique: 5 },
    "格式塔治疗": { awareness: 12, empathy: 8, technique: 5 },
    "依恋理论": { insight: 10, empathy: 8, judgment: 5 },
    "客体关系理论": { insight: 12, judgment: 8, empathy: 5 },
  };

  // ===== Step 1: 读取等级基础值 =====
  function readLevelBase(G) {
    var DoctorLevelState = global.DoctorLevelState;
    if (!DoctorLevelState || !DoctorLevelState.getBaseStats) return null;
    return DoctorLevelState.getBaseStats(G.levelIndex);
  }

  // ===== Step 2: 平面加成合并 =====
  function applyFlatBonuses(stats, G, fc) {
    var result = {};
    var attrKeys = global.CharacterAttribute ? global.CharacterAttribute.ATTRIBUTE_KEYS : ["empathy","insight","knowledge","technique","judgment","awareness","communication","resilience","humanity","philosophy"];

    // 深拷贝基础值
    attrKeys.forEach(function (k) {
      result[k] = typeof stats[k] === "number" ? stats[k] : 0;
    });

    // 教育背景 bonus
    if (fc && fc.education) {
      var PsyDoctorCreationConfig = global.PsyDoctorCreationConfig;
      var edu = PsyDoctorCreationConfig ? PsyDoctorCreationConfig.getEducationByKey(fc.education) : null;
      if (edu && edu.bonus) {
        attrKeys.forEach(function (k) {
          if (edu.bonus[k]) result[k] += edu.bonus[k];
        });
      }
    }

    // 入行契机 bonus
    if (fc && fc.motivation) {
      var PsyDoctorCreationConfig2 = global.PsyDoctorCreationConfig;
      var mot = PsyDoctorCreationConfig2 ? PsyDoctorCreationConfig2.getMotivationByKey(fc.motivation) : null;
      if (mot && mot.bonus) {
        attrKeys.forEach(function (k) {
          if (mot.bonus[k]) result[k] += mot.bonus[k];
        });
      }
    }

    // 个人特质 bonus
    if (fc && fc.traits && fc.traits.length > 0) {
      fc.traits.forEach(function (trait) {
        var bonus = trait.bonus;
        if (bonus) {
          attrKeys.forEach(function (k) {
            if (bonus[k]) result[k] += bonus[k];
          });
        }
      });
    }

    // 理论学习深度 bonus
    var theoryBonusTotal = 0;
    if (G.theoryMastery) {
      var theoryNames = Object.keys(G.theoryMastery);
      theoryNames.forEach(function (tn) {
        var mastery = G.theoryMastery[tn];
        if (!mastery || !mastery.stage || mastery.stage < 1) return;
        var stage = mastery.stage;
        var coeff = THEORY_STAGE_COEFFICIENTS[stage] || 0;
        var contributions = FALLBACK_THEORY_CONTRIBUTIONS[tn];
        if (!contributions) {
          // 尝试从 TheoryState 获取
          var TheoryState = global.TheoryState;
          if (TheoryState && TheoryState.getTheoryContributions) {
            contributions = TheoryState.getTheoryContributions(tn);
          }
        }
        if (contributions) {
          var isActive = tn === G.activeTheoryOrientation;
          var activeMultiplier = isActive ? 1.0 : 0.5;
          var contribKeys = Object.keys(contributions);
          contribKeys.forEach(function (ck) {
            var addVal = contributions[ck] * coeff * activeMultiplier;
            if (attrKeys.indexOf(ck) !== -1) {
              result[ck] += addVal;
              theoryBonusTotal += addVal;
            }
          });
        }
      });
    }
    // 理论 bonus 上限 200
    if (theoryBonusTotal > 200) {
      var scale = 200 / theoryBonusTotal;
      var keys = Object.keys(result);
      keys.forEach(function (k) {
        result[k] *= scale;
      });
    }

    // 哲学思辨 bonus
    if (G.philosophyDepth && G.levelIndex !== undefined) {
      var PhilosophyState = global.PhilosophyState;
      if (PhilosophyState && PhilosophyState.computeAllPhilosophyBonuses) {
        var bonusMap = PhilosophyState.computeAllPhilosophyBonuses(G.philosophyDepth, G.levelIndex);
        var bonusKeys = Object.keys(bonusMap);
        bonusKeys.forEach(function (bk) {
          if (result[bk] !== undefined) {
            result[bk] *= bonusMap[bk];
          }
        });
      }
    }

    return result;
  }

  // ===== Step 3: 反移情惩罚 =====
  function applyCountertransferencePenalty(stats, G) {
    var ct = G.countertransference;
    if (!ct) return stats;
    var riskLevel = ct.overallRiskLevel || "low";
    var penalties = CT_PENALTIES[riskLevel] || CT_PENALTIES.low;
    var result = {};
    var keys = Object.keys(stats);
    keys.forEach(function (k) {
      result[k] = stats[k];
      if (penalties[k] !== undefined) {
        result[k] = stats[k] * penalties[k];
      }
    });
    return result;
  }

  // ===== Step 4: 哲学维度乘法加成（已在 Step 2 中通过 computeAllPhilosophyBonuses 实现）=====
  // 注意：哲学加成的计算在 Step 2 中已通过 computeAllPhilosophyBonuses 处理
  // Step 4 在这里作为占位，实际计算逻辑已融合到 Step 2

  // ===== Step 5: 倦怠惩罚 =====
  function applyFatiguePenalty(stats, G) {
    var result = {};
    var keys = Object.keys(stats);
    keys.forEach(function (k) {
      result[k] = stats[k];
    });

    // 疲劳度惩罚
    var fatigue = G.currentFatigue || 0;
    var fatigueLevel = 0;
    if (fatigue > 30) fatigueLevel = 1;
    if (fatigue > 60) fatigueLevel = 2;
    if (fatigue > 85) fatigueLevel = 3;
    var penalty = FATIGUE_PENALTIES[fatigueLevel];
    if (penalty && penalty.effects) {
      var eff = penalty.effects;
      keys.forEach(function (k) {
        if (eff[k] !== undefined) {
          result[k] *= eff[k];
        }
      });
    }

    // 倦怠等级惩罚（每级全属性 ×0.98）
    var burnout = G.burnoutLevel || 0;
    if (burnout > 0) {
      var burnoutFactor = Math.pow(0.98, burnout);
      if (burnoutFactor < 0.80) burnoutFactor = 0.80;
      keys.forEach(function (k) {
        result[k] *= burnoutFactor;
      });
    }

    return result;
  }

  // ===== Step 6: 收尾（取整 + 钳制） =====
  function finalizeStats(stats) {
    var result = {};
    var keys = Object.keys(stats);
    keys.forEach(function (k) {
      var val = Math.round(stats[k]);
      if (k === "humanity" || k === "philosophy") {
        if (val < 0) val = 0;
        if (val > 100) val = 100;
      } else {
        if (val < 1) val = 1;
        if (val > 999) val = 999;
      }
      result[k] = val;
    });
    return result;
  }

  // ===== 计算反移情风险等级 =====
  function computeRiskLevel(G) {
    var ct = G.countertransference;
    if (!ct) return "low";
    var types = ["overIdentification", "defensiveDistancing", "saviorComplex", "professionalArrogance", "burnoutNumbness", "ethicalBlurring"];
    var maxVal = 0;
    types.forEach(function (t) {
      if (typeof ct[t] === "number" && ct[t] > maxVal) maxVal = ct[t];
    });
    if (maxVal > 50) return "critical";
    if (maxVal > 30) return "high";
    if (maxVal > 15) return "medium";
    return "low";
  }

  // ===== 核心算法：6 步管线 =====
  function computePsychologistBase(G, fc) {
    if (!G) return null;

    // 确保 levelIndex 有效
    if (G.levelIndex === undefined || G.levelIndex === null) G.levelIndex = 0;

    // Step 1: 等级基础值
    var baseStats = readLevelBase(G);
    if (!baseStats) {
      // 兜底
      baseStats = { empathy:10, insight:5, knowledge:10, technique:3, judgment:3, awareness:5, communication:8, resilience:5, humanity:10, philosophy:5 };
    }

    // Step 2: 平面加成合并（含理论 bonus + 哲学思辨 bonus）
    var afterBonuses = applyFlatBonuses(baseStats, G, fc || G.fateChoice);

    // Step 3: 反移情惩罚
    var afterCT = applyCountertransferencePenalty(afterBonuses, G);

    // Step 4: 哲学维度乘法加成（已包含在 Step 2 中）

    // Step 5: 倦怠惩罚
    var afterFatigue = applyFatiguePenalty(afterCT, G);

    // Step 6: 收尾
    var final = finalizeStats(afterFatigue);

    // 同时更新 riskLevel
    if (G.countertransference) {
      G.countertransference.overallRiskLevel = computeRiskLevel(G);
    }

    G.psychologistBase = final;
    return final;
  }

  // ===== NPC 属性计算 =====
  function computePsychologistBaseFromCharacterSheet(sheet, options) {
    if (!sheet) return null;
    // 根据 characterSheet 计算 NPC 的 8+2 属性
    // 暂用等级查表法，若 sheet 提供 levelIndex 则使用，否则按默认值
    var levelIndex = (options && options.levelIndex !== undefined) ? options.levelIndex : 3;
    var DoctorLevelState = global.DoctorLevelState;
    var base = DoctorLevelState ? DoctorLevelState.getBaseStats(levelIndex) : null;
    if (!base) base = { empathy:28, insight:18, knowledge:38, technique:12, judgment:12, awareness:18, communication:22, resilience:15, humanity:20, philosophy:13 };

    var result = {};
    var keys = Object.keys(base);
    keys.forEach(function (k) {
      result[k] = base[k];
    });

    // 应用来访者模板的修正
    if (sheet.caseType && sheet.symptomLevel !== undefined) {
      result.empathy = Math.round(result.empathy * (1 + (100 - sheet.symptomLevel) / 200));
    }

    return finalizeStats(result);
  }

  // ===== 来访者难度计算 =====
  function computeCaseDifficulty(clientSheet) {
    if (!clientSheet) return 0;
    var defStr = clientSheet.defenseProfile ? (clientSheet.defenseProfile.defenseStrength || 0) : 0;
    var resist = clientSheet.therapeuticResistance || 0;
    var insight = clientSheet.insightCapacity || 50;
    // 难度 ≈ 防御强度 + 阻抗 - 洞察潜力/2
    return Math.round(defStr + resist - insight / 2);
  }

  // ===== 暴露 API =====
  global.PsychologistBaseRuntime = {
    computePsychologistBase: computePsychologistBase,
    computePsychologistBaseFromCharacterSheet: computePsychologistBaseFromCharacterSheet,
    computeCaseDifficulty: computeCaseDifficulty,
    computeRiskLevel: computeRiskLevel,
    // 内部步骤暴露用于测试
    readLevelBase: readLevelBase,
    applyFlatBonuses: applyFlatBonuses,
    applyCountertransferencePenalty: applyCountertransferencePenalty,
    applyFatiguePenalty: applyFatiguePenalty,
    finalizeStats: finalizeStats,
  };
})(typeof window !== "undefined" ? window : globalThis);
