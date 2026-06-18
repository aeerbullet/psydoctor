/**
 * trait_samples.js — 个人特质词条池
 * 对应架构文档 §2.2, §8.3
 *
 * 提供 PsyTraitSamples 命名空间，包含按 5 大类组织的详特质词条池。
 */
(function (global) {
  "use strict";

  // ===== 5 大类特质词条 =====
  var TRAIT_CATEGORIES = {
    healer: {
      label: "疗愈者",
      desc: "天生的共情者，擅长创造安全的疗愈空间",
      traits: [
        { key: "empathy_gift", label: "共情天赋", desc: "你天生能感受到他人的情感", longDesc: "你的共情能力远超常人，能深入理解来访者的内心世界，但也需要注意自我边界的维护。", bonus: { empathy: 3 }, rarity: "rare" },
        { key: "healing_presence", label: "治愈气场", desc: "你的存在本身让人感到安心", longDesc: "你有一种让人放松的特质，即使不说话也能传递温暖与接纳。", bonus: { communication: 2, empathy: 2 }, rarity: "uncommon" },
        { key: "warmth", label: "温暖存在", desc: "你待人温和，让人愿意敞开心扉", longDesc: "你的温和态度降低了来访者的防御，促进了治疗联盟的建立。", bonus: { empathy: 2, resilience: 1 }, rarity: "common" },
        { key: "nurturing", label: "滋养心灵", desc: "你擅长给予情感支持", longDesc: "你像一座安全的港湾，让受伤的心灵得以休憩和恢复。", bonus: { empathy: 1, communication: 1, resilience: 1 }, rarity: "common" },
      ],
    },
    thinker: {
      label: "思想家",
      desc: "热爱思考，善于分析与整合复杂信息",
      traits: [
        { key: "deep_thought", label: "深邃思考", desc: "你喜欢深入思考问题的本质", longDesc: "你不满足于表面现象，总是追问'为什么'，这让你能洞察到问题的深层结构。", bonus: { insight: 3 }, rarity: "rare" },
        { key: "vast_knowledge", label: "知识渊博", desc: "你阅读广泛，知识储备丰富", longDesc: "你的知识面横跨多个学科，这让你在面对复杂个案时有更多的理论资源。", bonus: { knowledge: 3 }, rarity: "uncommon" },
        { key: "theory_sensitivity", label: "理论敏感", desc: "你对理论概念有敏锐的把握", longDesc: "你能快速理解并应用新的理论框架，将抽象概念转化为临床实践。", bonus: { knowledge: 2, judgment: 1 }, rarity: "uncommon" },
        { key: "systematic_thinking", label: "系统思维", desc: "你善于从系统角度理解问题", longDesc: "你总能看到事物之间的关联和模式，适合处理复杂的家庭和系统问题。", bonus: { judgment: 2, insight: 1 }, rarity: "uncommon" },
      ],
    },
    communicator: {
      label: "沟通者",
      desc: "语言精准，善于建立信任关系",
      traits: [
        { key: "precise_language", label: "语言精准", desc: "你用词准确，表达清晰", longDesc: "你能用恰到好处的语言表达复杂的心理现象，这对治疗中的澄清和诠释至关重要。", bonus: { communication: 3 }, rarity: "rare" },
        { key: "listening_gift", label: "倾听天赋", desc: "你不仅听话语，还听沉默", longDesc: "你善于捕捉话语之外的信息——语气的变化、停顿的长短、未说出的话。", bonus: { empathy: 2, communication: 1 }, rarity: "uncommon" },
        { key: "nonverbal_sensitivity", label: "非语言敏感", desc: "你能捕捉微妙的非语言信号", longDesc: "你对面部表情、身体姿态和语音语调的变化极为敏感。", bonus: { awareness: 2, empathy: 1 }, rarity: "uncommon" },
      ],
    },
    guardian: {
      label: "守护者",
      desc: "稳定的存在，为来访者提供安全感",
      traits: [
        { key: "emotional_container", label: "情感容器", desc: "你能容纳来访者的强烈情绪", longDesc: "当来访者被强烈情绪淹没时，你能保持稳定并提供安全的情感容器。", bonus: { resilience: 3 }, rarity: "rare" },
        { key: "clear_boundary", label: "边界清晰", desc: "你有清晰的职业边界意识", longDesc: "你在同理心和专业边界之间保持平衡，这对长期治疗至关重要。", bonus: { judgment: 2, resilience: 1 }, rarity: "uncommon" },
        { key: "stable_presence", label: "稳定存在", desc: "你的稳定性能让来访者感到安全", longDesc: "无论来访者的状态多么动荡，你都能提供一种连续的、可预测的存在。", bonus: { communication: 2, judgment: 1 }, rarity: "common" },
      ],
    },
    pioneer: {
      label: "开创者",
      desc: "勇于创新，打破传统治疗框架",
      traits: [
        { key: "interdisciplinary", label: "跨学科视野", desc: "你善于融合多学科知识", longDesc: "你将心理学与哲学、神经科学、艺术等领域连接，创造独特的治疗视角。", bonus: { knowledge: 2, philosophy: 2 }, rarity: "rare" },
        { key: "innovative_spirit", label: "创新精神", desc: "你总是思考新的治疗可能性", longDesc: "你不满足于既定方法，总是在探索更有效的干预方式。", bonus: { technique: 3 }, rarity: "uncommon" },
        { key: "integration_gift", label: "整合天赋", desc: "你能将不同理论融会贯通", longDesc: "你天然地看到不同治疗流派的共通之处，善于进行理论整合。", bonus: { insight: 2, philosophy: 1 }, rarity: "rare" },
      ],
    },
  };

  // ===== 获取特质 =====
  function getTraitByKey(key) {
    var cats = Object.keys(TRAIT_CATEGORIES);
    for (var ci = 0; ci < cats.length; ci++) {
      var traits = TRAIT_CATEGORIES[cats[ci]].traits;
      for (var ti = 0; ti < traits.length; ti++) {
        if (traits[ti].key === key) return traits[ti];
      }
    }
    return null;
  }

  function getTraitsByCategory(category) {
    return TRAIT_CATEGORIES[category] ? TRAIT_CATEGORIES[category].traits : [];
  }

  function getAllTraits() {
    var all = [];
    var cats = Object.keys(TRAIT_CATEGORIES);
    cats.forEach(function (cat) {
      TRAIT_CATEGORIES[cat].traits.forEach(function (t) {
        all.push(t);
      });
    });
    return all;
  }

  function getCategoryKeys() {
    return Object.keys(TRAIT_CATEGORIES);
  }

  // ===== 暴露 API =====
  global.PsyTraitSamples = {
    TRAIT_CATEGORIES: TRAIT_CATEGORIES,
    getTraitByKey: getTraitByKey,
    getTraitsByCategory: getTraitsByCategory,
    getAllTraits: getAllTraits,
    getCategoryKeys: getCategoryKeys,
  };
})(typeof window !== "undefined" ? window : globalThis);
