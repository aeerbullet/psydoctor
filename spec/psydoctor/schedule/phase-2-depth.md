# Phase 2: 心理学深度系统

> 目标：完整的咨询个案流程 + 理论学习体系 + 来访者档案管理 + 反移情机制 + 开局剧情与配置完善
>
> 参考：architecture.md §23 第二阶段 + logic-flow.md §5, §7, §8, §10

---

## 2.1 理论体系数据（完整版）

### 2.1.1 理论状态数据

- [ ] 创建 `js/data/theory_state.js`
  - [ ] 定义 5 大流派（精神分析/认知行为/人本存在/系统关系/身体体验）
  - [ ] 定义 32+ 具体理论，每种理论含：
    - [ ] `name` — 理论中文名
    - [ ] `tradition` — 所属流派
    - [ ] `founder` — 创始人/代表人物
    - [ ] `coreConcepts` — 核心概念列表
    - [ ] `applicableDomains` — 适用领域（哪些来访者类型）
    - [ ] `attributeContributions` — 对 8+2 属性的贡献权重
    - [ ] `learningStages` — 6 阶段每阶段所需小时数
  - [ ] 数据与 requirements.md §4.1 完全一致（32 个具体理论）
  - [ ] 定义 `THEORY_INTEGRATION_TABLE`（8 条预设整合路线，按 architecture.md §10.2）：
    - [ ] CBT + 正念 → MBCT
    - [ ] 精神分析 + 依恋 → 心理动力学
    - [ ] 存在主义 + 东方心学(≥5) → 东方存在治疗
    - [ ] 结构家庭 + 叙事 → 家庭叙事治疗
    - [ ] EFT + 依恋 → EFT-C
    - [ ] 格式塔 + 正念 → 正念格式塔
    - [ ] 图式 + 客体关系 → 图式动力学
    - [ ] ACT + DBT → ACT-DBT 整合
  - [ ] 暴露 `TheoryState` 全局命名空间

### 2.1.2 验证

- [ ] 确认 32 个理论数据完整（name/tradition/founder/coreConcepts/attributeContributions 全部非空）
- [ ] 确认 8 条整合路线的 theoryA/theoryB 在理论列表中均存在
- [ ] 确认 `attributeContributions` 值合理（总和 ≤ 50）

---

## 2.2 来访者案例模板

### 2.2.1 来访者类型数据

- [ ] 创建 `js/data/client_templates.js`
  - [ ] 定义 10 种来访者案例类型（按 requirements.md §6.1.2）：
    - [ ] 焦虑型来访（含 defenseProfile/primaryDefense/defenseStrength/therapeuticResistance/insightCapacity）
    - [ ] 抑郁型来访
    - [ ] 创伤型来访
    - [ ] 人格障碍型
    - [ ] 存在危机型
    - [ ] 关系困扰型
    - [ ] 成瘾型来访
    - [ ] 心身障碍型
    - [ ] 复杂性创伤
    - [ ] 危机干预型
  - [ ] 每种类型含：
    - [ ] `caseType` — 类型标识
    - [ ] `label` — 中文标签
    - [ ] `typicalChiefComplaints` — 典型主诉
    - [ ] `defaultSymptomLevel` — 初始症状严重度 [0,100]
    - [ ] `defenseProfile` — 防御机制配置（primaryDefense/defenseStrength/flexibility）
    - [ ] `therapeuticResistance` — 阻抗强度 [0,100]
    - [ ] `insightCapacity` — 洞察潜力 [0,100]
    - [ ] `typicalAttachmentStyle` — 典型依恋模式
    - [ ] `recommendedApproaches` — 推荐的理论取向
    - [ ] `therapistRequirements` — 对咨询师属性的最低要求
  - [ ] 暴露 `ClientTemplates` 全局命名空间

### 2.2.2 验证

- [ ] 确认 10 种类型数据完整
- [ ] 确认 defaultSymptomLevel 在 [30, 90] 范围内合理分布
- [ ] 确认 defenseStrength + therapeuticResistance 不重复叠加（≤150）

---

## 2.3 来访者档案规范化

### 2.3.1 ClientCharacterSheet

- [ ] 创建 `js/game/client_character_sheet.js`
  - [ ] 实现 `normalizeClientSheet(rawClient)`：
    - [ ] 补全缺失字段（symptomLevel=60, therapeuticAlliance=50, treatmentPhase="initial"）
    - [ ] 字段类型校验（数字/字符串/对象）
    - [ ] 值域校验（symptomLevel [0,100], alliance [0,100]）
    - [ ] `defenseProfile` 子对象规范化（primaryDefense/defenseStrength/flexibility）
  - [ ] 实现 `applyClientTemplate(caseType)` → 从 ClientTemplates 克隆模板
  - [ ] 实现 `buildClientSummary(client)` → 生成来访者摘要（姓名+主诉+治疗阶段+联盟）
  - [ ] 实现 `checkTerminationCondition(client)` → 判定结案条件
  - [ ] 暴露 `ClientCharacterSheet` 全局命名空间

### 2.3.2 验证

- [ ] 传入不完整 client 对象 → 确认 normalizeClientSheet 补全所有缺失字段
- [ ] 传入非法值（symptomLevel=999）→ 确认被钳制到 100
- [ ] 确认 `applyClientTemplate("焦虑型来访")` 返回完整的模板数据

---

## 2.4 咨询个案引擎（Case Session Engine）

### 2.4.1 个案启动与主循环

- [ ] 创建 `js/game/case_session.js`
  - [ ] 实现 `startCaseSession(payload)`（按 logic-flow.md §5.2）：
    - [ ] 构建来访者档案（已有来访者匹配 / 新来访者创建）
    - [ ] 应用 `ClientTemplates[caseType]` 模板
    - [ ] 计算咨询师 6 种干预技术的能力值（按 logic-flow.md §5.3 公式）
    - [ ] 应用反移情惩罚（若 riskLevel ≥ high → 自觉性/论断力惩罚）
    - [ ] 设置 `G.activeCaseSession = sessionState`
    - [ ] 进入主循环 `runCaseSession()`
  - [ ] 实现 `runCaseSession(clientSheet, therapistAbilities)`（按 logic-flow.md §5.3）：
    - [ ] 初始化 `sessionState`（round/maxRounds/initialSymptom/initialAlliance/...）
    - [ ] 循环（最多 20 回合）：
      - [ ] **回合开始**：AI 生成来访者当前状态描述 → 渲染到来访者话语区
      - [ ] **玩家选择**：展示 6 个干预按钮（含当前能力值 + 预估效果提示）
      - [ ] **效果计算**：`computeInterventionEffect(techniqueType, clientSheet, sessionState, G)`（6 种技术各有独立公式）
      - [ ] **状态更新**：alliance/symptom/insight/defense 按公式更新
      - [ ] **来访者回应**：AI 根据效果生成来访者言语/情感回应（5 种模式）
      - [ ] **关键转折检测**：alliance 大幅下降/症状大幅改善/首次洞察≥20/联盟降至10以下
      - [ ] **终止条件检查**：symptom≤5 / alliance≤0 / round≥20
    - [ ] 返回 `outcome`
  - [ ] 实现 `computeInterventionEffect(techniqueType, clientSheet, sessionState, G)`：
    - [ ] 每种干预技术的独立效果公式（按 logic-flow.md §5.3 3.3）：
      - [ ] 共情回应：allianceChange +3~8, defenseChange -3~8, symptomChange -1~3
      - [ ] 诠释干预：insightGain +5~15, allianceChange ±, defenseChange 可能 +
      - [ ] 行为技术：symptomChange -3~10, allianceChange +1~4
      - [ ] 体验技术：allianceChange +2~6, insightGain +3~10
      - [ ] 系统干预：symptomChange -2~8, defenseChange -2~8, allianceChange +1~5
      - [ ] 沉默在场：allianceChange +1~5, insightGain +2~8, defenseChange 0
    - [ ] 综合公式：rawEffect = ability × alliance × timing - defense × resistance × 50 + random(±10)
    - [ ] 钳制各维度变化量在合理范围
  - [ ] 实现 `computeSessionOutcome(sessionState)`：
    - [ ] 症状改善率 = (initial - current) / initial × 100
    - [ ] 联盟维持率 = currentAlliance / initialAlliance × 100
    - [ ] 综合评分 = 症状改善率×0.5 + 联盟维持率×0.3 + insight/100×0.2
    - [ ] 评级映射：S(>90%) / A(>70%) / B(>50%) / C(>30%) / D(≤30%)
  - [ ] 实现 `applySessionResultToGame(G, outcome)`（按 logic-flow.md §5.4）：
    - [ ] 临床时数累加（S/A=+2，其他=+1）
    - [ ] 理论时数累加
    - [ ] 来访者档案更新（symptomLevel/alliance/treatmentPhase/sessionCount）
    - [ ] 反移情检查（来访者类型 vs 咨询师个人议题相似度）
    - [ ] 督导记录生成（C/D 评级 → 强制督导提示）
    - [ ] 清理会话状态 + 派发 `psy:session-finished` 事件
  - [ ] 暴露 `CaseSessionEngine` 全局命名空间

### 2.4.2 个案渲染 UI

- [ ] 在 `mainScreen_panel_ui.js` 中新增 `bindCaseSessionUi()`：
  - [ ] 个案会话模态/内嵌界面（6 个干预技术按钮，竖向排列）
  - [ ] 来访者话语区（左对齐，蓝色气泡）
  - [ ] 咨询师干预展示区（右对齐，灰色斜体）
  - [ ] 回合效果摘要（图标化：📈联盟 +X, 📉症状 -Y, 💡洞察 +Z）
  - [ ] 回合计数器（"第 3/20 回合"）
- [ ] 在 `mainScreen_chat.js` 中集成本案触发：
  - [ ] `pendingCaseSession !== null` → 自动调用 `startCaseSession()`
  - [ ] 个案结束后 → `PSY_AUTO_STORY_AFTER_SESSION` 控制自动叙事

### 2.4.3 验证

- [ ] 模拟触发一个焦虑型来访个案 → 确认 6 种干预按钮正常显示
- [ ] 选择"共情回应" → 确认 allianceChange > 0, symptomChange < 0, defenseChange < 0
- [ ] 选择"诠释干预" → 确认 insightGain > 0, allianceChange 可能为负
- [ ] 连续 5 回合选择不同干预 → 确认来访者回应模式变化
- [ ] 手动触发 symptomLevel 降至 0 → 确认结案流程正常
- [ ] 手动触发 alliance 降至 0 → 确认脱落流程正常
- [ ] 确认临床时数在个案结算后正确累加
- [ ] 确认来访者档案在个案后正确更新

---

## 2.5 反移情追踪系统

### 2.5.1 反移情引擎

- [ ] 创建 `js/game/countertransference.js`
  - [ ] 实现 `accumulate(G, triggerSource, caseType)`（按 logic-flow.md §8.1）：
    - [ ] 计算触发强度（来访者 caseType 与咨询师个人特质相似度 [0,10]）
    - [ ] 确定反移情类型（相似度≥7 → overIdentification 60%, 自觉性<30 → professionalArrogance 30%, ...）
    - [ ] 计算累积量：base = 相似度×0.5, 自觉性抗性 = 1-awareness/200, 个人体验抗性 = 1-personalTherapyHours/500
    - [ ] change = base × 自觉性抗性 × 个人体验抗性（钳制 [0.5, 8]）
    - [ ] 写入 `G.countertransference[type] += change`（钳制 [0, 100]）
  - [ ] 实现 `computeRisk(G)`：
    - [ ] 取各类型最大值
    - [ ] max ≤ 15 → "low", 16-30 → "medium", 31-50 → "high", >50 → "critical"
    - [ ] 写入 `G.countertransference.overallRiskLevel`
  - [ ] 实现 `resolve(G, type, method, hours)`（按 logic-flow.md §8.2）：
    - [ ] method="supervision" → 消耗 0.5h 督导 → type -3~5
    - [ ] method="personalTherapy" → 消耗 1h 个人体验 → type -5~8, awareness+2
    - [ ] method="rest" → type 各 -1~2, fatigue -20, burnoutLevel -1
    - [ ] method="time" → type 各 -0.1（回合自然衰减）
  - [ ] 实现 `getAttributePenalty(G)`（按 logic-flow.md §8.3）：
    - [ ] low → {}
    - [ ] medium → { awareness:×0.90, empathy:×0.95 }
    - [ ] high → { awareness:×0.75, judgment:×0.85, empathy:×0.90 }
    - [ ] critical → { 全属性:×0.70 }
  - [ ] 实现 `checkCareerCrisis(G)`：
    - [ ] riskLevel === "critical" → 强制暂停接案（G.activeCaseSession 不可启动）
    - [ ] 弹出警告 UI
  - [ ] 暴露 `CountertransferenceTracker` 全局命名空间

### 2.5.2 反移情 UI

- [ ] 在 `mainScreen_panel_ui.js` 中新增 `bindCountertransferenceUi()`：
  - [ ] 左下角风险指示器（颜色圆点：绿/黄/橙/红对应 low/medium/high/critical）
  - [ ] 反移情详情弹窗（6 种类型的数值条 + 化解建议按钮）
  - [ ] riskLevel 变化时的 toast 提醒
- [ ] 在 `mainScreen_chat.js` 后处理中集成反移情检查：
  - [ ] 每次 `applyStateTurn` 后调用 `CountertransferenceTracker.checkRisk(G)`
  - [ ] riskLevel 升级时弹窗提醒

### 2.5.3 验证

- [ ] 手动设置 countertransference.overIdentification=20 → 确认 riskLevel="medium"、属性惩罚 applied
- [ ] 手动设置 countertransference.overIdentification=55 → 确认 riskLevel="critical"、接案被阻止
- [ ] 执行 `resolve(G, "personalTherapy", "overIdentification", 2)` → 确认数值下降
- [ ] 触发 5 次 D 评级个案 → 确认 burnoutNumbness 累积

---

## 2.6 开局系统完善

### 2.6.1 开局剧情生成完善

- [ ] 完善 `js/ai_server/world_generate.js`
  - [ ] 6 种教育背景各自的开局叙事模板引导
    - [ ] 心理学本科 → 大学新生入学报到
    - [ ] 跨专业转行 → 工作多年后重新走进校园
    - [ ] 精神科医生 → 医院精神科轮转
    - [ ] 社工出身 → 社区心理服务站
    - [ ] 哲学学者 → 哲学系研究生转向心理学
    - [ ] 亲历者转型 → 从自我疗愈走向专业助人
  - [ ] 叙事质量硬约束（禁止引入来访者/禁止重大职业决策/聚焦起点感）

### 2.6.2 开局配置 AI 完善

- [ ] 完善 `js/ai_server/init_state_generate.js`
  - [ ] 6 种教育背景对应的初始物品配置模板
  - [ ] 初始来访者生成规则（仅当教育背景=精神科医生/社工出身/亲历者时允许）
  - [ ] 初始藏书与教育背景匹配规则
  - [ ] 初始理论掌握阶段设定（默认 stage=1，哲学学者给存在哲学 depth=2）

### 2.6.3 验证

- [ ] 测试 6 种教育背景各自的开局剧情 → 确认叙事不雷同
- [ ] 测试心理学本科 → 确认初始藏书含《普通心理学》
- [ ] 测试精神科医生 → 确认获得 MMPI-2 + SCL-90
- [ ] 测试哲学学者 → 确认 philosophy 初值 +3, 存在哲学 depth=2

---

## 2.7 知识基底与预设扩充

### 2.7.1 知识基底条目扩充

- [ ] 扩充 `world_book_entries.js` 从 10 条 → 25+ 条
  - [ ] 精神分析核心概念（无意识/移情/防御/自由联想/阻抗/修通）
  - [ ] CBT 核心概念（认知歪曲/自动思维/核心信念/行为实验）
  - [ ] 存在主义治疗要素（四大终极关怀的临床展开）
  - [ ] 家庭治疗核心概念（家庭结构/子系统/边界/三角化）
  - [ ] 正念核心概念（觉察/非评判/当下/接纳）
  - [ ] 创伤知情照护（触发/解离/安全/赋权）
  - [ ] 自杀风险评估规范
  - [ ] 儿童青少年咨询特殊伦理
  - [ ] 团体治疗基本框架
  - [ ] 跨文化咨询注意事项
  - [ ] 远程心理咨询规范
  - [ ] 职业倦怠预防
  - [ ] 督导关系规范
  - [ ] 心理学研究方法基础
  - [ ] 心理测量学基础

### 2.7.2 AI 预设扩充

- [ ] 扩充 `preset_content.js`
  - [ ] 新增 `therapyNarrative` 规则预设（咨询对话的专业性与真实感规则）
  - [ ] 新增 `caseSessionRules` 规则预设（来访者话语/防御/转机的叙事模式）
  - [ ] 新增 `ethicsGuidelines` 规则预设（边界/保密/知情同意的叙事体现）
  - [ ] 扩充 `theoryRules` 规则预设（各流派术语/框架/干预的准确性规范）
  - [ ] 修订 `outputFormat` 预设（17 种标签的详细说明 + 示例）

### 2.7.3 验证

- [ ] 确认 25+ 条知识基底条目覆盖 5 个分类
- [ ] 测试关键词"认知歪曲"触发 CBT 条目注入
- [ ] 测试关键词"保密例外"触发伦理条目注入
- [ ] 确认 caseSessionRules 预设包含 6 种干预技术的叙事指导

---

## 2.8 Phase 2 完成标准

- [ ] **个案引擎可用**：触发→6 种干预→效果计算→来访者回应→结算→时数累加
- [ ] **32 个理论数据完整**：每个理论可被学习和提升阶段
- [ ] **10 种来访者模板可用**：每个模板可创建完整的来访者档案
- [ ] **反移情系统工作**：累积→风险判定→属性惩罚→化解→危机处理
- [ ] **开局 6 种教育背景各有定制剧情**
- [ ] **知识基底 25+ 条目 + 预设 7+ 规则**

> **完成后**：将本文件重命名为 `phase-2-depth-done.md`

---

*基于：architecture.md §23 第二阶段 + logic-flow.md §5, §7, §8, §10 + requirements.md §4, §6, §8, §14.1*
