/**
 * client_templates.js — 来访者案例类型模板与防御机制数据
 * 对应架构文档 §9.2
 *
 * 提供 ClientTemplates 命名空间，包含 10 种来访者案例类型模板及防御机制数据。
 */
(function (global) {
  "use strict";

  // ===== 10 种来访者案例类型模板 =====
  var CLIENT_CASE_TYPES = [
    {
      caseType: "existential_crisis",
      label: "存在危机型",
      description: "对人生意义、自由与责任的存在性焦虑",
      initialSymptomLevel: 75,
      defenseProfile: { primaryDefense: "理智化", defenseStrength: 55, flexibility: 40 },
      therapeuticResistance: 35,
      insightCapacity: 70,
      attachmentStyle: "secure",
      commonThemes: ["意义感缺失", "选择焦虑", "死亡焦虑", "孤独感"],
      suggestedApproach: "存在主义治疗、人本主义治疗",
    },
    {
      caseType: "anxiety",
      label: "焦虑型",
      description: "广泛性焦虑、社交焦虑或惊恐发作",
      initialSymptomLevel: 80,
      defenseProfile: { primaryDefense: "回避", defenseStrength: 50, flexibility: 35 },
      therapeuticResistance: 40,
      insightCapacity: 55,
      attachmentStyle: "anxious",
      commonThemes: ["过度担忧", "身体紧张", "灾难化思维", "社交回避"],
      suggestedApproach: "CBT、正念减压、接纳承诺治疗",
    },
    {
      caseType: "depression",
      label: "抑郁型",
      description: "持续的情绪低落、丧失兴趣与活力",
      initialSymptomLevel: 82,
      defenseProfile: { primaryDefense: "内射", defenseStrength: 60, flexibility: 30 },
      therapeuticResistance: 30,
      insightCapacity: 60,
      attachmentStyle: "anxious",
      commonThemes: ["自我否定", "无价值感", "睡眠障碍", "社交退缩"],
      suggestedApproach: "认知治疗、行为激活、人际心理治疗",
    },
    {
      caseType: "trauma",
      label: "创伤型",
      description: "经历了重大创伤事件后的应激反应",
      initialSymptomLevel: 85,
      defenseProfile: { primaryDefense: "解离", defenseStrength: 70, flexibility: 25 },
      therapeuticResistance: 50,
      insightCapacity: 45,
      attachmentStyle: "disorganized",
      commonThemes: ["闪回", "噩梦", "高度警觉", "情感麻木"],
      suggestedApproach: "创伤聚焦CBT、EMDR、心理动力治疗",
    },
    {
      caseType: "relationship",
      label: "关系困扰型",
      description: "亲密关系、家庭关系或职场关系中反复出现的困难",
      initialSymptomLevel: 70,
      defenseProfile: { primaryDefense: "投射", defenseStrength: 45, flexibility: 50 },
      therapeuticResistance: 40,
      insightCapacity: 65,
      attachmentStyle: "anxious",
      commonThemes: ["沟通困难", "依赖与独立的冲突", "信任问题", "重复的冲突模式"],
      suggestedApproach: "家庭治疗、依恋理论、情绪聚焦治疗",
    },
    {
      caseType: "personality_disorder",
      label: "人格障碍型",
      description: "持久的、僵化的行为模式与内心体验的偏离",
      initialSymptomLevel: 78,
      defenseProfile: { primaryDefense: "分裂", defenseStrength: 75, flexibility: 20 },
      therapeuticResistance: 70,
      insightCapacity: 35,
      attachmentStyle: "disorganized",
      commonThemes: ["情绪调节困难", "身份认同混乱", "人际冲突循环", "边缘行为"],
      suggestedApproach: "辩证行为治疗(DBT)、图式治疗、移情焦点治疗",
    },
    {
      caseType: "addiction",
      label: "成瘾行为型",
      description: "物质依赖或行为成瘾问题",
      initialSymptomLevel: 80,
      defenseProfile: { primaryDefense: "否认", defenseStrength: 65, flexibility: 25 },
      therapeuticResistance: 65,
      insightCapacity: 30,
      attachmentStyle: "avoidant",
      commonThemes: ["戒断困难", "复发循环", "羞耻感", "社会功能受损"],
      suggestedApproach: "动机式访谈、CBT、12步模型",
    },
    {
      caseType: "cross_cultural",
      label: "跨文化适应型",
      description: "文化迁移带来的适应困难与身份认同冲突",
      initialSymptomLevel: 65,
      defenseProfile: { primaryDefense: "理智化", defenseStrength: 40, flexibility: 55 },
      therapeuticResistance: 30,
      insightCapacity: 75,
      attachmentStyle: "secure",
      commonThemes: ["文化冲击", "身份认同", "归属感缺失", "代际冲突"],
      suggestedApproach: "跨文化心理咨询、叙事治疗",
    },
    {
      caseType: "personal_growth",
      label: "存在成长型",
      description: "寻求自我实现与个人成长，非病理性的发展性困扰",
      initialSymptomLevel: 60,
      defenseProfile: { primaryDefense: "升华", defenseStrength: 35, flexibility: 60 },
      therapeuticResistance: 30,
      insightCapacity: 80,
      attachmentStyle: "secure",
      commonThemes: ["自我实现", "职业迷茫", "人生转折", "潜能开发"],
      suggestedApproach: "积极心理学、人本主义、存在主义治疗",
    },
    {
      caseType: "crisis_intervention",
      label: "危机干预型",
      description: "急性心理危机，需要即时干预与安全评估",
      initialSymptomLevel: 85,
      defenseProfile: { primaryDefense: "行动化", defenseStrength: 60, flexibility: 20 },
      therapeuticResistance: 45,
      insightCapacity: 40,
      attachmentStyle: "disorganized",
      commonThemes: ["自伤/自杀风险", "急性应激", "冲动控制", "安全问题"],
      suggestedApproach: "危机干预、安全计划、稳定化技术",
    },
  ];

  // ===== 防御机制数据 =====
  var DEFENSE_MECHANISMS = [
    { name: "sublimation", label: "升华", level: "成熟", desc: "将不被接受的冲动转化为社会可接受的行为" },
    { name: "humor", label: "幽默", level: "成熟", desc: "用幽默化解焦虑与冲突" },
    { name: "altruism", label: "利他", level: "成熟", desc: "通过帮助他人来缓解自身焦虑" },
    { name: "suppression", label: "压制", level: "成熟", desc: "有意识地推迟处理冲突或情绪" },
    { name: "intellectualization", label: "理智化", level: "神经症性", desc: "用理性思考回避情感体验" },
    { name: "isolation", label: "情感隔离", level: "神经症性", desc: "将情感与认知内容分离" },
    { name: "rationalization", label: "合理化", level: "神经症性", desc: "用看似合理的理由解释不被接受的行为" },
    { name: "reaction_formation", label: "反向形成", level: "神经症性", desc: "表现出与真实感受相反的态度" },
    { name: "projection", label: "投射", level: "神经症性", desc: "将自己的感受归因于他人" },
    { name: "displacement", label: "置换", level: "神经症性", desc: "将情绪从原始对象转移到安全对象" },
    { name: "denial", label: "否认", level: "不成熟", desc: "拒绝接受现实或事实" },
    { name: "splitting", label: "分裂", level: "不成熟", desc: "将事物截然分为全好/全坏" },
    { name: "acting_out", label: "行动化", level: "不成熟", desc: "通过行为而非言语表达内心冲突" },
    { name: "dissociation", label: "解离", level: "不成熟", desc: "意识的暂时性分离或改变" },
    { name: "introjection", label: "内射", level: "不成熟", desc: "将外部对象的特质内化为自身的一部分" },
    { name: "projective_identification", label: "投射性认同", level: "不成熟", desc: "投射后操控对方使其产生被投射的感受" },
  ];

  // ===== 阻抗类型 =====
  var RESISTANCE_TYPES = [
    { name: "silence", label: "沉默", desc: "来访者以沉默抗拒探索" },
    { name: "intellectualization", label: "理智化", desc: "用理论分析回避情感接触" },
    { name: "acting_out", label: "见诸行动", desc: "在会谈外通过行为表达" },
    { name: "avoidance", label: "回避", desc: "回避困难话题" },
    { name: "devaluation", label: "贬低", desc: "贬低治疗或治疗师" },
    { name: "idealization", label: "理想化", desc: "过度理想化治疗师" },
    { name: "as_if", label: "假性配合", desc: "表面配合但无真正投入" },
    { name: "somatization", label: "躯体化", desc: "以身体症状表达心理冲突" },
  ];

  // ===== 依恋类型 =====
  var ATTACHMENT_STYLES = [
    { name: "secure", label: "安全型", desc: "能够信任他人，建立健康的关系" },
    { name: "anxious", label: "焦虑型", desc: "过度担忧关系稳定性，需要持续确认" },
    { name: "avoidant", label: "回避型", desc: "保持情感距离，回避亲密关系" },
    { name: "disorganized", label: "混乱型", desc: "行为矛盾，既渴望又恐惧亲密" },
  ];

  // ===== 查找方法 =====
  function getCaseType(typeKey) {
    for (var i = 0; i < CLIENT_CASE_TYPES.length; i++) {
      if (CLIENT_CASE_TYPES[i].caseType === typeKey) return CLIENT_CASE_TYPES[i];
    }
    return null;
  }

  function getDefenseByName(name) {
    for (var i = 0; i < DEFENSE_MECHANISMS.length; i++) {
      if (DEFENSE_MECHANISMS[i].name === name) return DEFENSE_MECHANISMS[i];
    }
    return null;
  }

  // ===== 暴露 API =====
  global.ClientTemplates = {
    CLIENT_CASE_TYPES: CLIENT_CASE_TYPES,
    DEFENSE_MECHANISMS: DEFENSE_MECHANISMS,
    RESISTANCE_TYPES: RESISTANCE_TYPES,
    ATTACHMENT_STYLES: ATTACHMENT_STYLES,
    getCaseType: getCaseType,
    getDefenseByName: getDefenseByName,
  };
})(typeof window !== "undefined" ? window : globalThis);
