/**
 * ethics_dilemma.js — 伦理困境决策引擎
 * 对应架构文档 §11 伦理困境系统
 *
 * 提供 EthicsDilemmaEngine 命名空间，定义困境类型结构，实现决策评估逻辑。
 */
(function (global) {
  "use strict";

  // ===== 伦理困境类型定义 =====
  var ETHICAL_DILEMMA_TYPES = {
    dualRelationship: {
      label: "双重关系",
      description: "来访者与你存在咨询关系之外的社会联系",
      scenes: [
        {
          id: "dual_001",
          scene: "来访者恰好是你孩子学校的班主任老师。TA 在咨询中透露了自己在教育孩子方面的困惑，而你的孩子正好在 TA 班上。",
          context: "你每周给这位来访者做咨询已有 3 个月，治疗联盟良好。",
          options: [
            { label: "转介给同事", effects: { judgment: 5, reputation: 2 }, description: "遵守伦理规范，但来访者可能感到被抛弃" },
            { label: "与来访者坦诚讨论，共同决定", effects: { judgment: 3, awareness: 5, reputation: -1 }, description: "尊重来访者自主权，但存在边界模糊风险" },
            { label: "继续治疗但严格保持边界", effects: { judgment: -2, resilience: -5 }, description: "理论上不建议，实际中可能勉强可行" },
          ],
        },
      ],
    },
    confidentialityException: {
      label: "保密例外",
      description: "面临保密义务与保护责任的冲突",
      scenes: [
        {
          id: "conf_001",
          scene: "你的来访者告诉你 TA 有严重的自杀意念，并已经制定了详细的计划。TA 恳求你保密，不想让任何人知道。",
          context: "你们已建立了牢固的治疗联盟，TA 告诉你这件事正是因为信任你。",
          options: [
            { label: "启动危机干预，通知紧急联系人", effects: { judgment: 5, awareness: 3, clientWelfare: 5 }, description: "保护生命优先，但可能破坏治疗联盟" },
            { label: "与来访者制定安全计划，暂不透露", effects: { judgment: -2, awareness: 2, clientWelfare: -2 }, description: "尊重来访者意愿，但存在安全风险" },
            { label: "咨询督导后决定", effects: { judgment: 4, awareness: 4 }, description: "最稳妥的选择，但需要时间" },
          ],
        },
      ],
    },
    competenceBoundary: {
      label: "能力边界",
      description: "面临超出专业能力的个案时如何决策",
      scenes: [
        {
          id: "comp_001",
          scene: "一位患有严重进食障碍的来访者找到你。你的理论取向对此类问题的经验有限，但附近没有合适的转介资源。",
          context: "来访者非常信任你，且已经等待了很长时间才约到咨询。",
          options: [
            { label: "坦诚说明能力边界，协助寻找转介", effects: { judgment: 5, awareness: 3, reputation: 2 }, description: "符合伦理，但来访者可能感到失望" },
            { label: "接受个案，同时紧急补充相关培训", effects: { technique: 3, knowledge: 3, clientWelfare: -2 }, description: "积极进取，但存在风险" },
            { label: "接受个案并在督导下工作", effects: { judgment: 3, awareness: 2, resilience: 2 }, description: "折中方案，需要强有力的督导支持" },
          ],
        },
      ],
    },
    valueConflict: {
      label: "价值观冲突",
      description: "来访者的价值观与咨询师个人价值观发生冲突",
      scenes: [
        {
          id: "value_001",
          scene: "你的来访者是一位虔诚的信徒，TA 希望你能在咨询中为 TA 的信仰祷告。你的个人立场是不信教的。",
          context: "来访者的信仰是 TA 重要的应对资源，但参与宗教活动超出了你的舒适区。",
          options: [
            { label: "温和地设定边界，聚焦心理咨询", effects: { judgment: 3, awareness: 2 }, description: "保持专业边界，但来访者可能感到不被理解" },
            { label: "尊重来访者的请求，在咨询框架内包容", effects: { empathy: 3, communication: 2, judgment: -1 }, description: "以来访者为中心，但可能模糊专业边界" },
            { label: "转介给价值观更匹配的同事", effects: { judgment: 4, reputation: 1 }, description: "最安全的选择，但来访者可能觉得被拒绝" },
          ],
        },
      ],
    },
    interestConflict: {
      label: "利益冲突",
      description: "来访者利益与第三方利益之间的冲突",
      scenes: [
        {
          id: "int_001",
          scene: "你在一家机构工作，机构要求你缩短每位来访者的咨询次数以提高效率。但你的来访者正处于治疗的关键阶段，减少次数可能影响效果。",
          context: "机构的政策与专业判断之间存在张力。",
          options: [
            { label: "按专业判断继续当前频率", effects: { judgment: 4, resilience: -3, reputation: -2 }, description: "以来访者利益为先，但可能影响工作关系" },
            { label: "与机构协商争取更多资源", effects: { communication: 4, judgment: 3 }, description: "积极沟通，但不确定能否成功" },
            { label: "缩短次数但高效利用每次咨询", effects: { technique: 2, judgment: -1, clientWelfare: -2 }, description: "实用主义的折中方案" },
          ],
        },
      ],
    },
  };

  // ===== 触发伦理困境 =====
  function createDilemma(dilemmaType, sceneId) {
    var typeDef = ETHICAL_DILEMMA_TYPES[dilemmaType];
    if (!typeDef) return null;

    var scene = null;
    if (typeDef.scenes) {
      for (var i = 0; i < typeDef.scenes.length; i++) {
        if (typeDef.scenes[i].id === sceneId) {
          scene = typeDef.scenes[i];
          break;
        }
      }
    }
    if (!scene && typeDef.scenes && typeDef.scenes.length > 0) {
      scene = typeDef.scenes[0];
    }
    if (!scene) return null;

    return {
      dilemmaType: dilemmaType,
      typeLabel: typeDef.label,
      typeDescription: typeDef.description,
      sceneId: scene.id,
      scene: scene.scene,
      context: scene.context || "",
      options: scene.options.map(function (opt, idx) {
        return {
          index: idx,
          label: opt.label,
          description: opt.description,
          effects: opt.effects || {},
        };
      }),
    };
  }

  // ===== 解析 AI 标签中的困境信息 =====
  function parseDilemmaTag(tagContent) {
    if (!tagContent) return null;
    try {
      var parsed = JSON.parse(tagContent);
      var dilemmaType = parsed.dilemmaType || parsed.type || "dualRelationship";
      var sceneId = parsed.sceneId || (dilemmaType + "_001");
      return createDilemma(dilemmaType, sceneId);
    } catch (e) {
      return null;
    }
  }

  // ===== 决策评估 =====
  function resolveDilemma(G, choiceIndex) {
    if (!G || !G.activeEthicalDilemma) return null;

    var dilemma = G.activeEthicalDilemma;
    if (choiceIndex < 0 || choiceIndex >= dilemma.options.length) return null;

    var chosen = dilemma.options[choiceIndex];
    var effects = chosen.effects || {};

    // 应用效果
    var changes = {};

    if (effects.judgment) {
      var oldJudgment = G.psychologistBase ? G.psychologistBase.judgment : 50;
      G.psychologistBase.judgment = clamp(oldJudgment + effects.judgment, 1, 999);
      changes.judgment = effects.judgment;
    }
    if (effects.awareness) {
      var oldAwareness = G.psychologistBase ? G.psychologistBase.awareness : 50;
      G.psychologistBase.awareness = clamp(oldAwareness + effects.awareness, 1, 999);
      changes.awareness = effects.awareness;
    }
    if (effects.reputation) {
      G.reputation = clamp((G.reputation || 0) + effects.reputation, 0, 1000);
      changes.reputation = effects.reputation;
    }
    if (effects.resilience) {
      var oldResilience = G.psychologistBase ? G.psychologistBase.resilience : 50;
      G.psychologistBase.resilience = clamp(oldResilience + effects.resilience, 1, 999);
      changes.resilience = effects.resilience;
    }
    if (effects.technique) {
      var oldTechnique = G.psychologistBase ? G.psychologistBase.technique : 10;
      G.psychologistBase.technique = clamp(oldTechnique + effects.technique, 1, 999);
      changes.technique = effects.technique;
    }
    if (effects.communication) {
      var oldComm = G.psychologistBase ? G.psychologistBase.communication : 10;
      G.psychologistBase.communication = clamp(oldComm + effects.communication, 1, 999);
      changes.communication = effects.communication;
    }
    if (effects.empathy) {
      var oldEmp = G.psychologistBase ? G.psychologistBase.empathy : 10;
      G.psychologistBase.empathy = clamp(oldEmp + effects.empathy, 1, 999);
      changes.empathy = effects.empathy;
    }
    if (effects.knowledge) {
      var oldKn = G.psychologistBase ? G.psychologistBase.knowledge : 10;
      G.psychologistBase.knowledge = clamp(oldKn + effects.knowledge, 1, 999);
      changes.knowledge = effects.knowledge;
    }
    if (effects.clientWelfare) {
      // 应用到当前来访者的症状
      changes.clientWelfare = effects.clientWelfare;
    }

    // 反移情联动
    var ctChanges = [];
    if (dilemma.dilemmaType === "dualRelationship" || dilemma.dilemmaType === "interestConflict") {
      if (G.countertransference) {
        G.countertransference.ethicalBlurring = (G.countertransference.ethicalBlurring || 0) + 2;
        ctChanges.push("伦理模糊 +2");
      }
    }
    if (dilemma.dilemmaType === "valueConflict") {
      if (G.countertransference) {
        G.countertransference.defensiveDistancing = (G.countertransference.defensiveDistancing || 0) + 1;
        ctChanges.push("防御性疏离 +1");
      }
    }

    // 记录决策历史
    if (!G.careerHistory) G.careerHistory = [];
    G.careerHistory.push({
      type: "ethical_decision",
      dilemmaType: dilemma.dilemmaType,
      sceneId: dilemma.sceneId,
      choiceIndex: choiceIndex,
      choiceLabel: chosen.label,
      timestamp: G.worldTimeString || "",
      effects: effects,
    });

    // 清理
    G.activeEthicalDilemma = null;

    return {
      chosen: chosen,
      changes: changes,
      ctChanges: ctChanges,
      effects: effects,
    };
  }

  // ===== 工具函数 =====
  function clamp(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
  }

  // ===== 暴露 API =====
  global.EthicsDilemmaEngine = {
    ETHICAL_DILEMMA_TYPES: ETHICAL_DILEMMA_TYPES,
    createDilemma: createDilemma,
    parseDilemmaTag: parseDilemmaTag,
    resolveDilemma: resolveDilemma,
  };
})(typeof window !== "undefined" ? window : globalThis);
