/**
 * philosophy_state.js — 哲学深度维度与属性倍率映射
 * 对应架构文档 §8.5 哲学深度维度属性映射
 *
 * 提供 PhilosophyState 命名空间，包含 5 大哲学维度的深度层级定义与属性乘法映射系数。
 */
(function (global) {
  "use strict";

  // ===== 5 大哲学维度定义 =====
  var PHILOSOPHY_DIMENSIONS = {
    phenomenology: {
      key: "phenomenology",
      label: "现象学",
      desc: "关注人的直接经验和意识，回到事物本身",
      primaryAttrs: ["insight", "awareness"],
    },
    hermeneutics: {
      key: "hermeneutics",
      label: "诠释学",
      desc: "理解与解释的艺术，意义的生成与对话",
      primaryAttrs: ["knowledge", "judgment"],
    },
    existential: {
      key: "existential",
      label: "存在哲学",
      desc: "直面存在的基本议题：自由、死亡、孤独、意义",
      primaryAttrs: ["humanity", "resilience"],
    },
    eastern: {
      key: "eastern",
      label: "东方心学",
      desc: "东方文化与心灵实践：禅、道、正念",
      primaryAttrs: ["awareness", "philosophy"],
    },
    postmodern: {
      key: "postmodern",
      label: "后现代批判",
      desc: "解构与重构认知框架，多元视角与叙事",
      primaryAttrs: ["insight", "judgment"],
    },
  };

  // ===== 哲学深度等级倍率 =====
  // 按 levelIndex [0, 20] 映射，共 21 级
  var PHILOSOPHY_LEVEL_RATIOS = (function () {
    var ratios = [];
    // 学徒 (level 0-2): 0.02
    ratios[0] = 0.02; ratios[1] = 0.02; ratios[2] = 0.02;
    // 实习 (level 3-5): 0.05
    ratios[3] = 0.05; ratios[4] = 0.05; ratios[5] = 0.05;
    // 初级 (level 6-8): 0.08
    ratios[6] = 0.08; ratios[7] = 0.08; ratios[8] = 0.08;
    // 资深 (level 9-11): 0.12
    ratios[9] = 0.12; ratios[10] = 0.12; ratios[11] = 0.12;
    // 专家 (level 12-14): 0.18
    ratios[12] = 0.18; ratios[13] = 0.18; ratios[14] = 0.18;
    // 大师 (level 15-17): 0.25
    ratios[15] = 0.25; ratios[16] = 0.25; ratios[17] = 0.25;
    // 心灵哲学家 (level 18-20): 0.50
    ratios[18] = 0.50; ratios[19] = 0.50; ratios[20] = 0.50;
    return ratios;
  })();

  // ===== 获取维度信息 =====
  function getDimension(dimKey) {
    return PHILOSOPHY_DIMENSIONS[dimKey] || null;
  }

  function getDimensionLabel(dimKey) {
    var dim = getDimension(dimKey);
    return dim ? dim.label : dimKey;
  }

  function getLevelRatio(levelIndex) {
    if (levelIndex < 0 || levelIndex >= PHILOSOPHY_LEVEL_RATIOS.length) return 0;
    return PHILOSOPHY_LEVEL_RATIOS[levelIndex];
  }

  // ===== 计算属性加成 =====
  // 公式: 属性基础值 × (1 + depth × ratio)
  function getAttributeBonus(dimensionKey, depth, levelIndex) {
    var dim = getDimension(dimensionKey);
    if (!dim) return {};
    var ratio = getLevelRatio(levelIndex);
    var bonus = {};
    dim.primaryAttrs.forEach(function (attr) {
      bonus[attr] = 1 + depth * ratio;
    });
    return bonus;
  }

  // ===== 批量计算所有维度加成 =====
  function computeAllPhilosophyBonuses(philosophyDepth, levelIndex) {
    var result = {};
    var keys = Object.keys(PHILOSOPHY_DIMENSIONS);
    keys.forEach(function (dimKey) {
      var depth = philosophyDepth && typeof philosophyDepth[dimKey] === "number"
        ? philosophyDepth[dimKey]
        : (philosophyDepth && typeof philosophyDepth[dimKey] === "number" ? philosophyDepth[dimKey] : 0);
      // 也支持中文键名
      if (depth === 0 && philosophyDepth) {
        var dim = PHILOSOPHY_DIMENSIONS[dimKey];
        if (dim) depth = philosophyDepth[dim.label] || 0;
      }
      if (depth > 0) {
        var bonus = getAttributeBonus(dimKey, depth, levelIndex);
        var dim = getDimension(dimKey);
        dim.primaryAttrs.forEach(function (attr) {
          if (!result[attr]) result[attr] = 1;
          result[attr] *= bonus[attr];
        });
      }
    });
    return result;
  }

  // ===== 暴露 API =====
  global.PhilosophyState = {
    PHILOSOPHY_DIMENSIONS: PHILOSOPHY_DIMENSIONS,
    PHILOSOPHY_LEVEL_RATIOS: PHILOSOPHY_LEVEL_RATIOS,
    getDimension: getDimension,
    getDimensionLabel: getDimensionLabel,
    getLevelRatio: getLevelRatio,
    getAttributeBonus: getAttributeBonus,
    computeAllPhilosophyBonuses: computeAllPhilosophyBonuses,
  };
})(typeof window !== "undefined" ? window : globalThis);
