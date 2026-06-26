# Phase 3B: 惩罚机制游戏性优化

> 目标：将被动 AI 驱动的惩罚转换为玩家主动决策驱动的多层后果体系 —— 治疗失误追踪 + 来访者脱落 + 三维声誉 + 执照危机 + 风险仪表盘
>
> 参考：gameplay-punishment-design.md（完整设计文档）+ architecture.md §6.4, §9, §11 + logic-flow.md §5, §8, §9

---

## 3B.1 治疗失误追踪引擎（Treatment Error Tracker）

### 3B.1.1 失误分类与检测规则

- [ ] 创建 `js/game/treatment_error_tracker.js`
  - [ ] 定义 `ERROR_TYPES` 三层失误体系：
    - [ ] Tier 1: 技术性失误（Technical Error）— 6 种判定条件：
      - [ ] 防御-技术冲突：`defenseType` 与 `interventionType` 不匹配
      - [ ] 低联盟高冲击：alliance < 30 时使用 interpretation/behavioralTech
      - [ ] 连续同技术：连续 3 次使用同一干预技术
      - [ ] 忽视危机：回合标记 `treatment_crisis` 后仍选激进技术
      - [ ] 过度沉默：连续 2 次选 silentPresence（逃避干预）
      - [ ] 时机失误：来访者情绪崩溃时选行为技术/诠释干预
    - [ ] Tier 2: 策略性失误（Strategic Error）— 4 种判定条件：
      - [ ] 忽略阻抗信号：来访者连续 3 回合出现防御增强，但未调整策略
      - [ ] 疗程停滞：超过 10 回合症状改善 < 5%，仍坚持原方案
      - [ ] 忽视脱落信号：alliance < 20 且连续 3 回合持续下降，未讨论治疗关系
      - [ ] 过度主导：超过 10 回合从未选择 silentPresence
    - [ ] Tier 3: 伦理性失误（Ethical Error）— 6 种判定条件：
      - [ ] 边界侵犯：叙事中与来访者产生咨询外接触
      - [ ] 保密违规：向第三方透露可识别的来访者信息
      - [ ] 能力越界：接受明显超出自身能力的个案且拒绝转介
      - [ ] 知情同意缺失：在来访者未充分理解的情况下施加干预
      - [ ] 忽视自伤风险：来访者出现自伤信号但未启动危机干预
      - [ ] 双重关系：与来访者建立咨询外的利益关系
  - [ ] 定义防御-技术适配矩阵 `INTERVENTION_DEFENSE_MATRIX`：
    - [ ] 10 种来访者防御 × 6 种干预技术 = 60 格适配评分
    - [ ] 适配评分：`optimal(+2)` / `neutral(0)` / `risky(-1)` / `dangerous(-2)`
    - [ ] 示例：
      - `projection + empathicResponse = optimal`（共情化解投射）
      - `projection + interpretation = risky`（诠释投射可能加剧）
      - `intellectualization + interpretation = optimal`（对理智化用诠释）
      - `dissociation + experientialTech = dangerous`（体验技术可能触发退行）
  - [ ] 暴露 `TreatmentErrorTracker` 全局命名空间

### 3B.1.2 失误检测与记录

- [ ] 实现 `detectSessionError(techniqueType, clientSheet, sessionState, G)`：
  - [ ] 每次个案回合完成后调用
  - [ ] 检查 Tier 1 即时判定规则（防御-技术适配 + 低联盟 + 连续使用）
  - [ ] 检查 Tier 2 跨回合模式（阻抗信号、疗程停滞、联盟趋势）
  - [ ] 返回 `null`（无误）或 `{ type, severity, description, suggestions }`
- [ ] 实现 `detectNarrativeError(G, narrativeContext)`：
  - [ ] 在 AI 叙事回合后调用
  - [ ] 解析叙事中的 `<psy_therapy_misstep>` 标签
  - [ ] 检查 Tier 3 伦理红线条件
  - [ ] 返回失误对象或 null
- [ ] 实现 `recordError(G, error)`：
  - [ ] 写入 `G.treatmentErrorTracker.currentSessionErrors[]`
  - [ ] 更新 `G.treatmentErrorTracker.errorHistory[]`
  - [ ] 更新 `activeWarnings[]`
  - [ ] 更新 `consecutiveErrors`（连续 3 次触发督导警告）
  - [ ] 更新 `errorStats`
- [ ] 实现 `clearSessionErrors(G)`：
  - [ ] 个案结束时清空 `currentSessionErrors`
  - [ ] 重置 `consecutiveErrors`
- [ ] 实现 `computeRiskScore(G)`：
  - [ ] 综合反移情 + 失误 + 脱落风险 + 疲劳 + 声誉 → RiskScore [0-100]
  - [ ] 公式见 gameplay-punishment-design.md §4.2.2

### 3B.1.3 验证

- [ ] 选择诠释干预攻击高阻抗来访者 → 确认防御-技术冲突被检测到
- [ ] 连续 3 次选择共情回应 → 确认"连续同技术"警告触发
- [ ] alliance < 30 时选行为技术 → 确认 Tier 1 低联盟失误检测
- [ ] 来访者连续 5 回合防御增强 → 确认 Tier 2 策略失误检测
- [ ] narrativeError 检测到伦理红线 → 确认 Tier 3 伦理性失误
- [ ] 连续 3 次失误 → 确认 `consecutiveErrors` 触发督导警告
- [ ] computeRiskScore 在良好状态下 < 25，在多失误+高反移情下 > 50

---

## 3B.2 来访者脱落系统（Client Dropout）

### 3B.2.1 脱落倾向数据

- [ ] 扩充 `js/data/client_templates.js`：
  - [ ] 新增 `DROPOUT_BASE_TABLE`：
    - [ ] 4 种依恋模式 × 脱落基础倾向
      - `secure` → 10%, `anxious` → 25%, `avoidant` → 35%, `disorganized` → 40%
    - [ ] 10 种案例类型 × 脱落修正系数
      - 存在危机型 → +0%，人格障碍型 → +15%，创伤型 → +10%
  - [ ] 新增来访者档案字段 `dropoutBasePropensity`
  - [ ] 新增来访者档案字段 `dropoutRisk`（当前脱落风险 [0-100]）

### 3B.2.2 脱落风险计算

- [ ] 在 `js/game/client_character_sheet.js` 中新增：
  - [ ] 实现 `computeDropoutRisk(client, sessionState, errors)`：
    - [ ] 基础脱离倾向 = DROPOUT_BASE_TABLE[attachmentStyle] + 案例难度修正
    - [ ] 失误惩罚 = 近期失误的 severity × 系数之和
    - [ ] 联盟缓冲 = alliance >= 70 ? -20% : alliance >= 50 ? -10% : alliance < 30 ? +15% : 0%
    - [ ] 脱落风险 = 基础倾向 + 失误惩罚 - 联盟缓冲（钳制 [5, 99]）
  - [ ] 实现 `checkDropoutThresholds(G, client)`：
    - [ ] 返回风险等级：`green`(0-29) / `yellow`(30-60) / `orange`(61-80) / `red`(81-100)
    - [ ] 对应当前来访者列表中的预警标记

### 3B.2.3 脱落触发与后果

- [ ] 在 `treatment_error_tracker.js` 中实现 `executeDropout(G, clientId)`：
  - [ ] 从来访者列表移除 `currentClients`
  - [ ] 生成脱落摘要（脱落时的 alliance、symptom、sessionCount）
  - [ ] 写入 `completedCases`（标记为 `terminatedByDropout: true`）
  - [ ] 应用脱落后果：
    - [ ] 声誉 -5~15（根据来访者外传抱怨的概率）
    - [ ] 反移情累积触发（如果来访者类型与咨询师经历有共鸣）
    - [ ] 临床时数：无获得（已投入回合白费）
    - [ ] `errorStats.clientDropouts += 1`
  - [ ] 触发叙事 AI：
    - [ ] 强制下一轮叙事聚焦于"来访者脱落"事件
    - [ ] 如果脱落与失误相关 → 叙事中包含督导/同行反应
- [ ] 实现 `attemptDropoutRecovery(G, clientId)`：
  - [ ] 在橙灯/红灯阈值时，玩家可通过"讨论治疗关系"挽救
  - [ ] 成功条件：下一回合选择共情回应 + allianceChange > +5
  - [ ] 成功 → 风险降至 50%，获得 judgment +2
  - [ ] 失败 → 风险 +15%，加速脱落

### 3B.2.4 验证

- [ ] 创建 avoidant 型来访者 → 确认基础脱落倾向 35%
- [ ] 在一次个案中制造 2 次 Tier 2 失误 → 确认脱落风险 ≥ 60%
- [ ] 脱落风险橙灯 → 确认来访者卡片显示 🟠 警告
- [ ] 脱落风险红灯 → 确认"治疗关系讨论"选项出现
- [ ] 红灯下再次失误 → 确认来访者脱落 + 声誉下降
- [ ] 脱落恢复尝试 → 成功/失败路径均正常工作

---

## 3B.3 三维声誉系统（Reputation System）

### 3B.3.1 声誉引擎

- [ ] 创建 `js/game/reputation_system.js`
  - [ ] 定义三维声誉模型：
    - [ ] `professionalReputation`（专业声誉）[0-1000]
    - [ ] `industryStanding`（行业地位）[0-100]
    - [ ] `professionalNetwork`（人脉网络）[0-100]
  - [ ] 定义 `REPUTATION_EVENT_TABLE`：
    - [ ] 正面事件（成功结案/发表/演讲/好评/转介绍）→ 各维度增减值
    - [ ] 负面事件（脱落/投诉/伦理争议/同行差评）→ 各维度增减值
    - [ ] 中性事件（会议参与/日常咨询）→ 微调值
  - [ ] 实现 `applyReputationEvent(G, eventType, params)`：
    - [ ] 查表获取三维影响值
    - [ ] 应用钳制 [0, max]
    - [ ] 记录到 `G.careerHistory`（type: "reputation_event"）
    - [ ] 触发阈值检查（声誉跨越等级边界时的特殊叙事）
  - [ ] 实现 `getReputationLevel(G)`：
    - [ ] 返回当前声誉等级：`crisis(<200)` / `recovering(200-400)` / `good(400-700)` / `excellent(700-900)` / `legendary(900+)`
    - [ ] 影响：新来访者质量、职业机会出现概率、同行态度
  - [ ] 实现 `computeReferralQuality(G)`：
    - [ ] 基于声誉等级返回转介来访者的难度和价值分布
    - [ ] 声誉越高 → 来访者更多样化、案例质量更高
  - [ ] 暴露 `PsyDoctorReputation` 全局命名空间

### 3B.3.2 来访者投诉机制

- [ ] 在 `reputation_system.js` 中实现投诉系统：
  - [ ] 实现 `checkComplaintRisk(G, client, error)`：
    - [ ] 伦理失误 + 来访者受损 → 60% 投诉概率
    - [ ] 脱落 + alliance < 20 → 25%
    - [ ] 脱落 + alliance < 40 → 10%
    - [ ] 重大失误连续 3+ 次 → 15%
  - [ ] 实现 `processComplaint(G, complaint)`：
    - [ ] 创建投诉记录写入 `G.complaintHistory`
    - [ ] 声誉立即下降
    - [ ] 若 3+ 次投诉 → 触发伦理委员会调查
    - [ ] 叙事 AI 引入投诉相关剧情
  - [ ] 实现 `processEthicsReview(G, complaints)`：
    - [ ] 多回合伦理审查流程（类似大阶段考试）
    - [ ] 审查结果：无过失/轻微过失/中度过失/严重过失
    - [ ] 每级对应不同的声誉和执照后果

### 3B.3.3 验证

- [ ] A 评级结案 3 个来访者 → 确认专业声誉 +9~15
- [ ] 来访者投诉触发 → 确认声誉 -20~50
- [ ] 声誉从 good(500) 降至 crisis(180) → 确认声誉等级切换
- [ ] 声誉 crisis 时 → 确认新来访者数量显著减少
- [ ] 3 次累计投诉 → 确认伦理委员会调查触发
- [ ] 伦理审查"无过失" → 确认声誉恢复 + judgment +3

---

## 3B.4 执照与执业危机系统（License & Career Crisis）

### 3B.4.1 执照状态机

- [ ] 创建 `js/data/license_state.js`
  - [ ] 定义执照状态枚举：
    - [ ] `ACTIVE` — 正常执业
    - [ ] `UNDER_REVIEW` — 调查中（不能接新来访者）
    - [ ] `SUSPENDED` — 暂停执业（停止一切临床工作）
    - [ ] `RESTRICTED` — 限制执业（只能接低风险来访者）
    - [ ] `REVOKED` — 吊销执照（进入"重建人生"分支）
  - [ ] 定义状态转换条件表：
    - [ ] `ACTIVE → UNDER_REVIEW`: 累计 3+ 投诉 或 单次严重伦理失误 或 critical 反移情持续 20+ 回合
    - [ ] `UNDER_REVIEW → ACTIVE`: 调查结果"无过失"
    - [ ] `UNDER_REVIEW → SUSPENDED`: 调查结果"中度过失"
    - [ ] `UNDER_REVIEW → REVOKED`: 调查结果"严重过失"
    - [ ] `SUSPENDED → RESTRICTED`: 暂停期满 + 完成条件（督导时数/个人体验）
    - [ ] `RESTRICTED → ACTIVE`: 评估通过 + 声誉恢复到 ≥ 200
    - [ ] `REVOKED → 重建人生`: 特殊分支（不可逆转回 ACTIVE）
  - [ ] 定义各状态下的限制：
    - [ ] `UNDER_REVIEW`: currentClients max = 现有，不可新增
    - [ ] `SUSPENDED`: currentClients = []，只能督导 + 个人体验 + 理论学习
    - [ ] `RESTRICTED`: currentClients max = 3，病例难度限制为低
    - [ ] `REVOKED`: 进入重建人生模式（研究者/教师/作者路径）

### 3B.4.2 执照危机引擎

- [ ] 创建 `js/game/license_crisis.js`
  - [ ] 实现 `checkLicenseStatus(G)`：
    - [ ] 检查投诉次数 / 伦理失误 / 反移情状态
    - [ ] 判断是否需要状态转换
    - [ ] 返回 `{ statusChanged, newStatus, reason }`
  - [ ] 实现 `transitionLicenseStatus(G, newStatus, reason)`：
    - [ ] 更新 `G.licenseStatus`
    - [ ] 应用新状态的限制（接案数量/案例难度限制）
    - [ ] 记录到 `G.careerHistory`
    - [ ] 触发对应的叙事线
  - [ ] 实现 `processEthicsHearing(G)`：
    - [ ] 伦理委员会听证会（多回合叙事流程）
    - [ ] 需要玩家做出回应（诚实面对/推卸责任/部分承认）
    - [ ] 不同态度影响调查结果
  - [ ] 实现 `startRebuildingLife(G)`：
    - [ ] 执照吊销后的特殊叙事线
    - [ ] 解锁替代职业路径：研究者、教师、作者
    - [ ] 独特的"归来"叙事弧（多年后重新申请执照）
    - [ ] 如果成功重建 → 获得独特称号 + 永久自觉性 bonus
  - [ ] 暴露 `LicenseCrisisEngine` 全局命名空间

### 3B.4.3 执照危机叙事

- [ ] 在 `story_generate.js` 中新增执照危机叙事约束：
  - [ ] 调查中阶段：叙事聚焦于焦虑/等待/同行态度变化
  - [ ] 听证会阶段：叙事为质询-回应格式
  - [ ] 暂停执业阶段：叙事聚焦于自我探索/阅读/反思
  - [ ] 限制执业阶段：叙事聚焦于谨慎重建/重新赢得信任
  - [ ] 重建人生阶段：叙事转向新身份/新路径/可能的归来
- [ ] 在 `preset_content.js` 中新增危机场景预设：
  - [ ] `licenseCrisisNarrative` — 执照危机相关叙事规则
  - [ ] `ethicsHearingNarrative` — 听证会质询格式规则
  - [ ] `rebuildingNarrative` — 重建人生叙事规则

### 3B.4.4 验证

- [ ] 累计 3 次投诉 → 确认状态从 ACTIVE 转为 UNDER_REVIEW
- [ ] UNDER_REVIEW 时尝试接新来访者 → 确认被限制
- [ ] 听证会中选"诚实面对" → 确认结果偏向有利
- [ ] SUSPENDED 期间触发督导/个人体验 → 确认可以执行
- [ ] SUSPENDED 期满 + 条件满足 → 确认转入 RESTRICTED
- [ ] 严重伦理违规 → 确认执照吊销 + 重建人生分支触发
- [ ] 重建人生路径 → 确认替代职业可用
- [ ] 重建成功 → 确认获得"重生"称号 + 自觉性 bonus

---

## 3B.5 实时反馈系统

### 3B.5.1 回合效果弹窗

- [ ] 在 `mainScreen_chat.js` 中新增 `showRoundEffectModal(effectResult, error)`：
  - [ ] 个案每个回合完成后弹出
  - [ ] 显示内容（按 gameplay-punishment-design.md §4.1.1）：
    - [ ] 回合编号 + 选用的干预技术名称
    - [ ] 来访者的话语回应（AI 生成，短句）
    - [ ] 效果评估（洞察/联盟/症状/防御四个指标的变化，带颜色图标）
    - [ ] 失误警告（若有错误，显示类型 + 建议）
    - [ ] 脱落风险变化（当前 vs 上次对比）
  - [ ] 弹窗样式：
    - [ ] 半透明遮罩 + 居中卡片
    - [ ] 绿色/黄色/红色三级颜色系统
    - [ ] 3 秒自动消失（或手动关闭）
    - [ ] 不影响聊天区滚动位置
- [ ] 在 `mainScreen_panel_ui.js` 中新增 `bindRoundEffectModalUi()`：
  - [ ] DOM 元素创建与事件绑定

### 3B.5.2 干预预判提示

- [ ] 在个案回合中展示干预选择时新增预判信息：
  - [ ] 基于来访者当前的 `defenseStrength` / `therapeuticResistance` / `alliance`
  - [ ] 计算每个干预技术的实时风险预估
  - [ ] 用颜色标记：绿色(安全) / 黄色(有风险) / 红色(不推荐)
  - [ ] 显示预估的效果数值范围
  - [ ] 显示特定警告文字（如"⚠️ 防御强，可能触发阻抗"）
- [ ] 在 `mainScreen_panel_ui.js` 中新增 `renderInterventionButtonsWithRisk(abilities, clientState)`：
  - [ ] 替换原有简单的 6 按钮展示

### 3B.5.3 风险仪表盘

- [ ] 在 `mainScreen_panel_ui.js` 中新增 `renderRiskDashboard(G)`：
  - [ ] 左栏底部新增独立面板模块
  - [ ] 显示内容（按 gameplay-punishment-design.md §4.2.1）：
    - [ ] 执业安全度（License Safety）— 进度条 + 百分比
    - [ ] 风险评分（Risk Score 0-100）— 圆形仪表盘 + 颜色分级
    - [ ] 活跃警告列表（图标 + 文字，最多 5 条）
    - [ ] 声誉三维概览（三个迷你进度条）
    - [ ] 来访者统计（当前/脱落/结案 + 脱落率）
    - [ ] 「查看详细风险报告」链接（点击展开详细面板）
  - [ ] 仪表盘颜色随风险评分动态变化：
    - [ ] 0-25 (安全)：绿色主题
    - [ ] 26-50 (注意)：黄色主题
    - [ ] 51-75 (警告)：橙色主题 + 边框脉冲动画
    - [ ] 76-100 (危险)：红色主题 + 边框闪烁动画 + 全屏警告提示
- [ ] 在 `mainScreen_panel.js` 中新增数据准备函数：
  - [ ] `prepareRiskDashboardData(G)` — 聚合仪表盘所需所有数据
  - [ ] `prepareLicenseStatusData(G)` — 执照状态数据
  - [ ] `prepareReputationOverview(G)` — 声誉概览数据

### 3B.5.4 脱落预警 UI

- [ ] 在来访者卡片中新增脱落风险指示器：
  - [ ] 每个来访者卡片右上角显示风险圆点（绿/黄/橙/红）
  - [ ] 橙灯/红灯时卡片边框脉冲
  - [ ] 悬停时显示风险详情 tooltip
- [ ] 在聊天区顶部新增全局预警条：
  - [ ] 任何来访者进入红灯时显示
  - [ ] 文字："⚠️ 张某的脱落风险很高，建议在下次咨询中讨论治疗关系"

### 3B.5.5 验证

- [ ] 个案回合结束 → 确认效果弹窗弹出 + 内容正确
- [ ] 制造一次失误 → 确认弹窗显示失误警告 + 正确颜色
- [ ] 来访者脱落风险变化 → 确认弹窗显示变化对比
- [ ] 打开仪表盘 → 确认所有数据正确显示
- [ ] riskScore > 75 → 确认仪表盘红色闪烁 + 全屏警告
- [ ] 来访者进入橙灯 → 确认卡片边框脉冲 + 右上角橙色圆点
- [ ] 来访者进入红灯 → 确认全局预警条出现

---

## 3B.6 系统整合

### 3B.6.1 AI 标签扩展

- [ ] 在 `state_generate.js` 中新增标签解析：
  - [ ] `<psy_treatment_error>` — 解析 AI 评估的治疗失误
    - [ ] `{ type, severity, description, clientId, round }`
  - [ ] `<psy_reputation_event>` — 解析声誉变化事件
    - [ ] `{ eventType, professionalReputation, industryStanding, professionalNetwork }`
  - [ ] `<psy_complaint_filed>` — 解析投诉触发
    - [ ] `{ source, reason, severity }`
  - [ ] `<psy_dropout_warning>` — 解析 AI 识别的脱落预警
    - [ ] `{ clientId, riskIncrease, narrativeSignal }`
- [ ] 在 `state_rules.js` 中新增规则模板：
  - [ ] `errorDetectionRules` — 失误判定规则（让 AI 知道什么构成失误）
  - [ ] `reputationChangeRules` — 声誉变化规则
  - [ ] `dropoutRules` — 脱落条件与预警规则
  - [ ] `licenseRules` — 执照状态变化规则

### 3B.6.2 叙事反馈整合

- [ ] 在 `story_generate.js` 中新增叙事约束：
  - [ ] 用户消息中注入失误追踪状态摘要
  - [ ] 用户消息中注入脱落风险概况
  - [ ] 系统 prompt 中追加失误后果叙事规则
  - [ ] 系统 prompt 中追加声誉影响叙事规则
- [ ] 在 `preset_content.js` 中新增/扩充预设：
  - [ ] `errorConsequenceNarrative` — 失误后果叙事预设
  - [ ] `dropoutNarrative` — 来访者脱落叙事预设
  - [ ] `reputationNarrative` — 声誉变化叙事预设
  - [ ] `licenseCrisisNarrative` — 执照危机叙事预设（见 §3B.4.3）

### 3B.6.3 现有模块改造

- [ ] `case_session.js`：
  - [ ] `computeInterventionEffect()` 中整合防御-技术适配判定
  - [ ] `runCaseSessionRound()` 中调用失误检测 + 脱落风险计算
  - [ ] `applySessionResultToGame()` 中整合脱落/声誉后果
- [ ] `countertransference.js`：
  - [ ] `accumulate()` 新增失误触发源参数
  - [ ] 失误→反移情联动映射表
  - [ ] Tier 3 伦理性失误 → ethicalBlurring 直接 +5
- [ ] `ethics_dilemma.js`：
  - [ ] `resolveDilemma()` 中整合 Tier 3 失误标记
  - [ ] 困境选项效果增加声誉三维影响
- [ ] `psychologist_base_runtime.js`：
  - [ ] `computePsychologistBase()` Step 3 之后新增 Step 3.5：声誉状态影响（低声誉对自觉性/沟通力有微小负影响，体现社交压力）
  - [ ] 新增执业状态限制检查（SUSPENDED/RESTRICTED 时的属性修正）
- [ ] `mainScreen_panel.js`：
  - [ ] 初始化 `G.treatmentErrorTracker` + `G.licenseStatus` + `G.reputation`
  - [ ] `ensureGameRuntimeDefaults()` 新增字段补全
- [ ] `mainScreen_panel_ui.js`：
  - [ ] 整合风险仪表盘到面板刷新管线
  - [ ] 来访者卡片新增脱落风险指示器
- [ ] `mainScreen_chat.js`：
  - [ ] 个案回合后整合失误检测 + 弹窗调用
  - [ ] 后处理中新增脱落风险检查

### 3B.6.4 验证

- [ ] 完整游戏流程：创建角色 → 接案 → 犯错 → 脱落预警 → 声誉下降 → 投诉 → 执照危机
- [ ] AI 叙事中正确体现了失误后果
- [ ] 状态 AI 正确解析和写入了新增标签
- [ ] 仪表盘数据在各个环节正确刷新
- [ ] 从存档恢复后所有新增字段正确初始化
- [ ] 无失误的完美咨询不受新系统负面影响

---

## 3B.7 Phase 3B 完成标准

- [ ] **失误追踪完整**：Tier 1/2/3 三级失误 + 防御-技术适配矩阵 + 失误记录 + 风险评分
- [ ] **脱落系统可用**：4 种依恋模式 × 10 种案例类型的脱落倾向 + 四级预警 + 脱落执行 + 恢复尝试
- [ ] **声誉系统可用**：三维声誉模型 + 投诉机制 + 伦理审查 + 转介质量影响
- [ ] **执照危机可用**：5 状态机 + 听证会 + 暂停/限制执业 + 重建人生分支
- [ ] **实时反馈可用**：回合效果弹窗 + 干预预判 + 风险仪表盘 + 脱落预警 UI
- [ ] **系统整合完成**：AI 标签扩展 + 叙事反馈 + 现有 6 个模块改造

> **完成后**：将本文件重命名为 `phase-3B-punishment-done.md`

---

*基于：gameplay-punishment-design.md v1.0 (2026-06-25)*
*依赖：Phase 1 (已完成) + Phase 2 (个案引擎/反移情) + Phase 3 (伦理困境/职业事件框架)*
