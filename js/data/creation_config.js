/**
 * creation_config.js — 开局配置：教育背景、入行契机、个人特质配置
 * 对应架构文档 §8.3 教育背景/动机/特质 bonus 映射
 *
 * 提供 PsyDoctorCreationConfig 命名空间。
 */
(function (global) {
  "use strict";

  // ===== 6 种教育背景 =====
  var EDUCATION_OPTIONS = [
    {
      key: "psychology_ba",
      label: "心理学本科",
      initialLevel: { major: "心理学徒", minor: "初窥" },
      initialTheory: "来访者中心治疗",
      bonus: { knowledge: 3, technique: 1 },
      defaultWorkplace: "大学校园/图书馆",
      defaultLocation: "北京",
      age: 18,
      desc: "系统的心理学基础教育，扎实的理论基础与初步的临床训练。",
    },
    {
      key: "career_switch",
      label: "跨专业转行",
      initialLevel: { major: "心理学徒", minor: "初窥" },
      initialTheory: "认知治疗",
      bonus: { resilience: 3, insight: 2 },
      defaultWorkplace: "大学校园/图书馆",
      defaultLocation: "上海",
      age: 22,
      desc: "丰富的人生阅历与多学科视角，对人性有独特的理解。",
    },
    {
      key: "psychiatrist",
      label: "精神科医生",
      initialLevel: { major: "实习咨询师", minor: "初窥" },
      initialTheory: "经典精神分析",
      bonus: { knowledge: 5, judgment: 3 },
      defaultWorkplace: "医院心理科",
      defaultLocation: "广州",
      age: 28,
      desc: "医学背景带来的严谨诊断思维与生物学视角。",
    },
    {
      key: "social_worker",
      label: "社工出身",
      initialLevel: { major: "实习咨询师", minor: "初窥" },
      initialTheory: "家庭治疗",
      bonus: { empathy: 3, communication: 2 },
      defaultWorkplace: "社区心理服务站",
      defaultLocation: "深圳",
      age: 24,
      desc: "丰富的社区实践经验和系统视角，擅长与不同类型的人建立连接。",
    },
    {
      key: "philosophy_scholar",
      label: "哲学学者",
      initialLevel: { major: "心理学徒", minor: "初窥" },
      initialTheory: "存在主义治疗",
      bonus: { philosophy: 5, humanity: 3 },
      defaultWorkplace: "大学校园/图书馆",
      defaultLocation: "南京",
      age: 20,
      desc: "深厚的哲学功底，善于思辨与反思人类存在的根本问题。",
    },
    {
      key: "survivor_turned",
      label: "亲历者转型",
      initialLevel: { major: "实习咨询师", minor: "初窥" },
      initialTheory: "来访者中心治疗",
      bonus: { empathy: 4, awareness: 3 },
      defaultWorkplace: "心理咨询机构",
      defaultLocation: "成都",
      age: 26,
      desc: "亲身经历过心理困扰并从中成长，对来访者有深层的共情。",
    },
  ];

  // ===== 5 种入行契机 =====
  var MOTIVATION_OPTIONS = [
    {
      key: "helping_ideal",
      label: "助人理想",
      bonus: { empathy: 5, awareness: 3 },
      desc: "你从小就渴望帮助他人，心理学是你实现理想的途径。",
    },
    {
      key: "intellectual_curiosity",
      label: "智识好奇",
      bonus: { knowledge: 5, insight: 3 },
      desc: "人类心灵的奥秘深深吸引着你，你想理解为什么人会这样思考、感受和行动。",
    },
    {
      key: "fate_push",
      label: "命运推动",
      bonus: { humanity: 3, philosophy: 3 },
      desc: "某种命运的巧合让你走上了这条路——也许是某本书、某个人、某次偶然。",
    },
    {
      key: "trauma_transformation",
      label: "创伤转化",
      bonus: { awareness: 5, resilience: 3 },
      desc: "你自己的经历让你深刻理解痛苦，你想帮助那些和曾经的你一样的人。",
    },
    {
      key: "mentor_call",
      label: "导师感召",
      bonus: { communication: 5, judgment: 3 },
      desc: "你遇到了一位影响深远的导师，他/她让你看到了心理学的真正意义。",
    },
  ];

  // ===== 5 大类个人特质词条 =====
  var TRAIT_CATEGORIES = {
    healer: {
      label: "疗愈者",
      desc: "天生的共情者，擅长创造安全的疗愈空间",
      traits: [
        { key: "empathy_gift", label: "共情天赋", desc: "你天生能感受到他人的情感", bonus: { empathy: 3 } },
        { key: "healing_presence", label: "治愈气场", desc: "你的存在本身让人感到安心", bonus: { communication: 2, empathy: 2 } },
        { key: "warmth", label: "温暖存在", desc: "你待人温和，让人愿意敞开心扉", bonus: { empathy: 2, resilience: 1 } },
      ],
    },
    thinker: {
      label: "思想家",
      desc: "热爱思考，善于分析与整合复杂信息",
      traits: [
        { key: "deep_thought", label: "深邃思考", desc: "你喜欢深入思考问题的本质", bonus: { insight: 3 } },
        { key: "vast_knowledge", label: "知识渊博", desc: "你阅读广泛，知识储备丰富", bonus: { knowledge: 3 } },
        { key: "theory_sensitivity", label: "理论敏感", desc: "你对理论概念有敏锐的把握", bonus: { knowledge: 2, judgment: 1 } },
        { key: "systematic_thinking", label: "系统思维", desc: "你善于从系统角度理解问题", bonus: { judgment: 2, insight: 1 } },
      ],
    },
    communicator: {
      label: "沟通者",
      desc: "语言精准，善于建立信任关系",
      traits: [
        { key: "precise_language", label: "语言精准", desc: "你用词准确，表达清晰", bonus: { communication: 3 } },
        { key: "listening_gift", label: "倾听天赋", desc: "你不仅听话语，还听沉默", bonus: { empathy: 2, communication: 1 } },
        { key: "nonverbal_sensitivity", label: "非语言敏感", desc: "你能捕捉微妙的非语言信号", bonus: { awareness: 2, empathy: 1 } },
      ],
    },
    guardian: {
      label: "守护者",
      desc: "稳定的存在，为来访者提供安全感",
      traits: [
        { key: "emotional_container", label: "情感容器", desc: "你能容纳来访者的强烈情绪", bonus: { resilience: 3 } },
        { key: "clear_boundary", label: "边界清晰", desc: "你有清晰的职业边界意识", bonus: { judgment: 2, resilience: 1 } },
        { key: "stable_presence", label: "稳定存在", desc: "你的稳定性能让来访者感到安全", bonus: { communication: 2, judgment: 1 } },
      ],
    },
    pioneer: {
      label: "开创者",
      desc: "勇于创新，打破传统治疗框架",
      traits: [
        { key: "interdisciplinary", label: "跨学科视野", desc: "你善于融合多学科知识", bonus: { knowledge: 2, philosophy: 2 } },
        { key: "innovative_spirit", label: "创新精神", desc: "你总是思考新的治疗可能性", bonus: { technique: 3 } },
        { key: "integration_gift", label: "整合天赋", desc: "你能将不同理论融会贯通", bonus: { insight: 2, philosophy: 1 } },
      ],
    },
  };

  // ===== 查找方法 =====
  function getEducationByKey(key) {
    for (var i = 0; i < EDUCATION_OPTIONS.length; i++) {
      if (EDUCATION_OPTIONS[i].key === key) return EDUCATION_OPTIONS[i];
    }
    return null;
  }

  function getMotivationByKey(key) {
    for (var i = 0; i < MOTIVATION_OPTIONS.length; i++) {
      if (MOTIVATION_OPTIONS[i].key === key) return MOTIVATION_OPTIONS[i];
    }
    return null;
  }

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

  // ===== 暴露 API =====
  global.PsyDoctorCreationConfig = {
    EDUCATION_OPTIONS: EDUCATION_OPTIONS,
    MOTIVATION_OPTIONS: MOTIVATION_OPTIONS,
    TRAIT_CATEGORIES: TRAIT_CATEGORIES,
    getEducationByKey: getEducationByKey,
    getMotivationByKey: getMotivationByKey,
    getTraitByKey: getTraitByKey,
    getTraitsByCategory: getTraitsByCategory,
  };
})(typeof window !== "undefined" ? window : globalThis);
