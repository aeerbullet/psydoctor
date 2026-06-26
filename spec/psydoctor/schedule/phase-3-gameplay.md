# Phase 3: 游戏性系统（惩罚 + 声誉 + 执照）

> 目标：在 Phase 2 多角色 AI 管线之上，实现治疗失误追踪、来访者脱落、三维声誉、执照危机和风险仪表盘。
>
> 参考：architecture.md §12（惩罚系统架构）+ logic-flow.md §10-§13（惩罚流程）+ architecture.md §8-§11

---

## 3.1 治疗失误追踪引擎

### 3.1.1 核心引擎

- [ ] 创建 `js/game/treatment_error_tracker.js`
  - [ ] 定义 `ERROR_TYPES` — 三级失误 + 判定规则：
    - [ ] Tier 1 技术性：防御-技术冲突 / 低联盟高冲击 / 连续同技术 / 忽视危机 / 过度沉默 / 时机失误
    - [ ] Tier 2 策略性：忽略阻抗 / 疗程停滞 / 忽视脱落信号 / 过度主导
    - [ ] Tier 3 伦理性：边界侵犯 / 保密违规 / 能力越界 / 知情同意缺失 / 忽视自伤 / 双重关系
  - [ ] 实现 `detectSessionError(techniqueType, clientSheet, sessionState, G)`：
    - [ ] 检查 Tier 1 即时判定（防御-技术适配 + 联盟 + 连续使用）
    - [ ] 检查 Tier 2 跨回合模式（阻抗信号、疗程停滞、联盟趋势）
    - [ ] 返回 `null` 或 `{ type, severity, description, suggestions }`
  - [ ] 实现 `detectNarrativeError(G, narrativeContext)`：
    - [ ] 解析 `<psy_treatment_error>` 标签
    - [ ] 检查 Tier 3 伦理红线
  - [ ] 实现 `recordError(G, error)` / `clearSessionErrors(G)` / `computeRiskScore(G)`
  - [ ] 暴露 `TreatmentErrorTracker` 全局命名空间

### 3.1.2 防御-技术适配矩阵

- [ ] 定义 `INTERVENTION_DEFENSE_MATRIX`：
  - [ ] 10 种来访者防御 × 6 种干预技术 = 60 格适配评分
  - [ ] 评分：optimal(+2) / neutral(0) / risky(-1) / dangerous(-2)
  - [ ] 示例：projection+empathic=optimal / dissociation+experiential=dangerous
- [ ] 在 `case_session.js` 的 `computeInterventionEffect()` 中整合适配判定
- [ ] 在 `mainScreen_panel_ui.js` 的干预按钮中展示风险预估（绿色/黄色/红色标记）

### 3.1.3 验证

- [ ] 诠释干预攻击高阻抗来访者 → 确认 防御-技术冲突 检测
- [ ] 连续 3 次共情回应 → 确认 连续同技术 警告
- [ ] alliance<30 选行为技术 → 确认 Tier 1 低联盟失误
- [ ] 连续 5 回合防御增强 → 确认 Tier 2 策略失误
- [ ] 伦理红线触发 → 确认 Tier 3 伦理性失误
- [ ] 连续 3 次失误 → 确认 consecutiveErrors 触发督导警告

---

## 3.2 来访者脱落系统

### 3.2.1 脱落数据与风险计算

- [ ] 创建 `js/data/dropout_table.js`
  - [ ] `DROPOUT_BASE_TABLE`：4 种依恋模式 × 脱落基础倾向 + 10 种案例类型 × 修正系数
- [ ] 改造 `client_character_sheet.js`：
  - [ ] 新增来访者字段 `dropoutBasePropensity` / `dropoutRisk`
  - [ ] 实现 `computeDropoutRisk(client, sessionState, errors)`：
    - [ ] 基础倾向 + 失误惩罚 - 联盟缓冲 → 脱落风险 [0-100]
  - [ ] 实现 `checkDropoutThresholds(G, client)`：
    - [ ] 🟢 green(0-29) / 🟡 yellow(30-60) / 🟠 orange(61-80) / 🔴 red(81-100)

### 3.2.2 脱落执行与恢复

- [ ] 在 `treatment_error_tracker.js` 中实现：
  - [ ] `executeDropout(G, clientId)`：移除来访者 + 声誉惩罚 + 反移情触发
  - [ ] `attemptDropoutRecovery(G, clientId)`：橙灯/红灯时可挽救，需联盟 +5 以上
- [ ] 脱落叙事：世界 AI 的 system prompt 中新增脱落场景叙事规则
- [ ] 脱落预警 UI（在 Phase 3.5 风险仪表盘中统一实现）

### 3.2.3 验证

- [ ] 创建 avoidant 来访者 → 脱落基础倾向 35%
- [ ] 2 次 Tier 2 失误 → 脱落风险 ≥ 60%
- [ ] 橙灯 → 来访者卡片 🟠 警告
- [ ] 红灯 → 最后通牒叙事 + 脱落确认
- [ ] 脱落恢复尝试 → 成功/失败路径正常

---

## 3.3 三维声誉系统

### 3.3.1 声誉引擎

- [ ] 创建 `js/game/reputation_system.js`
  - [ ] 三维模型：`professionalReputation` [0-1000] / `industryStanding` [0-100] / `professionalNetwork` [0-100]
  - [ ] `REPUTATION_EVENT_TABLE`：正面/负面/中性事件 → 三维增减值
  - [ ] 实现 `applyReputationEvent(G, eventType, params)`：
    - [ ] 查表 + 钳制 + 记录到 careerHistory + 阈值检查
  - [ ] 实现 `getReputationLevel(G)`：
    - [ ] crisis(<200) / recovering(200-400) / good(400-700) / excellent(700-900) / legendary(900+)
  - [ ] 实现 `computeReferralQuality(G)`：声誉 → 来访者质量分布
  - [ ] 暴露 `PsyDoctorReputation` 全局命名空间

### 3.3.2 投诉机制

- [ ] 实现 `checkComplaintRisk(G, client, error)` / `processComplaint(G, complaint)`：
  - [ ] 伦理失误 + 来访者受损 → 60% 概率投诉
  - [ ] 脱落 + alliance<20 → 25%
  - [ ] 累计 3+ 投诉 → 触发伦理委员会调查
- [ ] 实现 `processEthicsReview(G, complaints)`：多回合审查 → 无过失/轻微/中度/严重

### 3.3.3 验证

- [ ] A 评级结案 3 个 → 专业声誉 +9~15
- [ ] 投诉触发 → 声誉 -20~50
- [ ] 声誉危机 → 新来访者数量减少
- [ ] 3 次投诉 → 伦理委员会调查触发
- [ ] 审查无过失 → 声誉恢复 + judgment +3

---

## 3.4 执照危机系统

### 3.4.1 执照状态机

- [ ] 创建 `js/data/license_state.js` — 5 态枚举 + 转换条件表
- [ ] 创建 `js/game/license_crisis.js`
  - [ ] 实现 `checkLicenseStatus(G)` — 检查投诉/伦理失误/反移情 → 状态转换
  - [ ] 实现 `transitionLicenseStatus(G, newStatus)` — 应用限制 + 叙事触发
  - [ ] 实现 `processEthicsHearing(G)` — 听证会流程
  - [ ] 实现 `startRebuildingLife(G)` — 执照吊销 → 重建人生分支
  - [ ] 暴露 `LicenseCrisisEngine` 全局命名空间

### 3.4.2 执照危机叙事

- [ ] 在 `preset_content.js` 中新增危机场景预设：
  - [ ] `licenseCrisisNarrative` — 调查中/暂停执业/限制执业各阶段的叙事规则
  - [ ] `ethicsHearingNarrative` — 听证会质询格式
  - [ ] `rebuildingNarrative` — 重建人生叙事规则

### 3.4.3 验证

- [ ] 累计 3 次投诉 → ACTIVE → UNDER_REVIEW
- [ ] UNDER_REVIEW 时接新来访者 → 被限制
- [ ] 听证选"诚实面对" → 有利结果
- [ ] SUSPENDED → 可督导+个人体验，不可接案
- [ ] 严重违规 → 吊销 + 重建人生分支触发

---

## 3.5 风险仪表盘 UI

### 3.5.1 实时反馈

- [ ] 在 `mainScreen_chat.js` 中新增 `showRoundEffectModal(effectResult, error)`：
  - [ ] 个案回合后弹出：来访者回应 + 效果评估 + 失误警告 + 脱落风险变化
  - [ ] 3 秒自动消失 + 颜色分级（绿/黄/红）
- [ ] 在个案回合干预选择时展示风险预估：
  - [ ] 6 个干预按钮旁显示适配评分（绿安全/黄有风险/红不推荐）
  - [ ] 显示具体警告文字 + 预估效果范围

### 3.5.2 风险仪表盘

- [ ] 在 `mainScreen_panel_ui.js` 中新增 `renderRiskDashboard(G)`：
  - [ ] 执业安全度进度条 + 风险评分圆形仪表盘（颜色分级）
  - [ ] 活跃警告列表（最多 5 条）
  - [ ] 声誉三维概览（迷你进度条）
  - [ ] 来访者统计（当前/脱落/结案 + 脱落率）
  - [ ] riskScore > 75 → 全屏警告 + 红色闪烁
- [ ] 来访者卡片新增脱落风险指示器（绿/黄/橙/红圆点 + 边框脉冲）
- [ ] 聊天区顶部新增全局预警条（任何来访者红灯时显示）

### 3.5.3 验证

- [ ] 个案回合结束 → 弹窗正确显示
- [ ] 失误 → 弹窗显示警告 + 正确颜色
- [ ] 仪表盘数据正确 + 实时更新
- [ ] riskScore > 75 → 红色闪烁 + 全屏警告
- [ ] 脱落风险变化 → 卡片指示器更新

---

## 3.6 系统整合

### 3.6.1 AI 标签与叙事

- [ ] `state_generate.js` 新增标签解析：`psy_treatment_error` / `psy_reputation_event` / `psy_complaint_filed`
- [ ] `state_rules.js` 新增规则：errorDetectionRules / reputationChangeRules / dropoutRules
- [ ] `mainScreen_chat.js` 后处理新增：失误检查 / 脱落风险检查 / 声誉事件检查 / 执照状态检查
- [ ] 世界 AI system prompt 中新增失误后果叙事约束
- [ ] prefix cache 验证：新增标签不影响 system prompt 结构

### 3.6.2 现有模块联动

- [ ] `countertransference.js`：`accumulate()` 新增失误触发源参数
- [ ] `ethics_dilemma.js`：`resolveDilemma()` 整合 Tier 3 失误 + 声誉三维影响
- [ ] `psychologist_base_runtime.js`：Step 3.5 声誉状态影响 + 执业状态限制
- [ ] `mainScreen_panel.js`：初始化新状态字段 + `ensureGameRuntimeDefaults()` 补全

### 3.6.3 验证

- [ ] 完整流程：创建角色 → 接案 → 犯错 → 脱落预警 → 声誉下降 → 投诉 → 执照危机
- [ ] AI 叙事正确体现失误后果
- [ ] 状态 AI 正确解析新标签
- [ ] 仪表盘数据在各环节正确刷新
- [ ] 存档恢复后新字段正确初始化
- [ ] 无失误的完美咨询不受新系统负面影响
- [ ] prefix cache 命中率不因新系统下降

---

## 3.7 Phase 3 完成标准

- [ ] **失误追踪完整**：三级失误 + 适配矩阵 + 风险评分 + AI 标签联动
- [ ] **脱落系统可用**：四级预警 + 执行 + 恢复尝试 + UI 指示器
- [ ] **声誉系统可用**：三维模型 + 投诉 + 审查 + 转介质量影响
- [ ] **执照危机可用**：5 态机 + 听证会 + 重建人生分支
- [ ] **风险仪表盘可用**：回合弹窗 + 干预预判 + 仪表盘 + 预警可视化
- [ ] **系统整合完成**：AI 标签扩展 + 叙事反馈 + 现有 4 个模块改造

> **完成后**：将本文件重命名为 `phase-3-gameplay-done.md`

---

*基于：architecture.md §12（惩罚系统架构）+ logic-flow.md §10-§13（惩罚流程）*
*依赖：Phase 2（多角色 AI 管线）*
*创建日期：2026-06-26*
