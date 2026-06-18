# Phase 3: 高级机制

> 目标：伦理困境系统 + 理论整合执行 + 职业生涯事件 + 个人体验系统 + 督导深度 + 流派传承
>
> 参考：architecture.md §23 第三阶段 + logic-flow.md §6.3, §7.2, §9 + requirements.md §8, §14.2-§14.5

---

## 3.1 伦理困境引擎

### 3.1.1 困境定义与决策树

- [ ] 创建 `js/game/ethics_dilemma.js`
  - [ ] 定义 5 大类困境（`ETHICAL_DILEMMA_TYPES`）：
    - [ ] `dualRelationship` — 双重关系（≥3 个场景）
      - [ ] 来访者是你孩子的老师
      - [ ] 来访者邀请你参加他的婚礼
      - [ ] 来访者恰好是你同事的配偶
    - [ ] `confidentialityException` — 保密例外（≥3 个场景）
      - [ ] 来访者透露有自伤计划但要求保密
      - [ ] 来访者家属来电询问治疗进展
      - [ ] 法院传票要求提供咨询记录
    - [ ] `competenceBoundary` — 能力边界（≥3 个场景）
      - [ ] 来访者问题明显超出你的专业领域
      - [ ] 来访者要求使用你不熟悉的疗法
      - [ ] 来访者出现精神病性症状
    - [ ] `valueConflict` — 价值观冲突（≥3 个场景）
      - [ ] 来访者的行为与你的个人价值观严重冲突
      - [ ] 来访者持与你相反的宗教/政治立场
      - [ ] 来访者的生活方式你无法认同
    - [ ] `interestConflict` — 利益冲突（≥2 个场景）
      - [ ] 来访者希望邀请你去他的公司做付费培训
      - [ ] 来访者送你贵重礼物
  - [ ] 每个场景含 3-4 个选项，每选项含：
    - [ ] `label` — 选项中文描述
    - [ ] `effects` — { reputation, judgment, awareness, resilience, clientWelfare }
    - [ ] `description` — 选择后叙事提示
    - [ ] `ethicalAlignment` — 伦理倾向（strict/flexible/autonomous）
  - [ ] 暴露 `EthicsDilemmaEngine` 全局命名空间

### 3.1.2 困境触发与解析

- [ ] 实现 `triggerDilemma(G, dilemmaType, sceneId)`：
  - [ ] 从 `ETHICAL_DILEMMA_TYPES[dilemmaType].scenes` 匹配场景
  - [ ] 构建 `activeEthicalDilemma` 对象
  - [ ] 写入 `G.activeEthicalDilemma`
- [ ] 实现 `resolveDilemma(G, choiceIndex)`（按 logic-flow.md §9.2）：
  - [ ] 读取玩家选择 + 应用 effects
  - [ ] `G.reputation += chosen.effects.reputation`（钳制 [0,1000]）
  - [ ] `G.psychologistBase.judgment += chosen.effects.judgment`
  - [ ] `G.psychologistBase.awareness += chosen.effects.awareness`
  - [ ] `clientWelfare` 应用到当前来访者的 symptomLevel
  - [ ] 反移情联动（边界问题→ethicalBlurring+2, 价值冲突→defensiveDistancing+1）
  - [ ] 记录决策历史到 `G.careerHistory`（type: "ethical_decision"）
  - [ ] 清理 `G.activeEthicalDilemma = null`
- [ ] 实现 `getEthicalProfile(G)`：
  - [ ] 统计历史决策中的伦理倾向分布（strict/flexible/autonomous）
  - [ ] 生成职业伦理成熟度评分

### 3.1.3 伦理困境 UI

- [ ] 在 `mainScreen_panel_ui.js` 中新增 `bindEthicalDilemmaModalUi()`：
  - [ ] 全屏模态（中断所有其他操作）
  - [ ] 困境类型图标 + 名称（如"⚠️ 双重关系"）
  - [ ] 场景描述（大字体叙述性文字）
  - [ ] 上下文背景段落
  - [ ] 选项按钮（3-4 个，竖向排列）：
    - [ ] 每个选项显示文本 + 预估影响（绿色正面/红色负面标签）
    - [ ] hover 时高亮
  - [ ] 无时间限制提示
- [ ] 在 `mainScreen_chat.js` 后处理中集成本困境触发：
  - [ ] `G.activeEthicalDilemma !== null` → 弹出困境模态
  - [ ] 玩家选择后 → 调用 `resolveDilemma` → 触发叙事 AI 衔接

### 3.1.4 验证

- [ ] 触发 dualRelationship/scene_001 → 确认模态弹出 + 3 个选项
- [ ] 选择"转介给同事" → 确认 reputation+2, judgment+5, clientWelfare=0
- [ ] 选择后确认决策记录写入 careerHistory
- [ ] 确认反移情 ethicalBlurring 在边界选择后 +2
- [ ] 确认模态关闭后叙事 AI 正常衔接

---

## 3.2 理论整合执行系统

### 3.2.1 整合执行引擎

- [ ] 在 `js/game/psychologist_base_runtime.js`（或新建专用模块）中新增整合功能：
  - [ ] 实现 `checkIntegrationConditions(G)`：
    - [ ] 遍历 `THEORY_INTEGRATION_TABLE`
    - [ ] 检查 theoryA.stage ≥ 4 && theoryB.stage ≥ 4
    - [ ] 检查 requirements 中的哲学深度 ≥ 要求
    - [ ] 返回满足条件的整合选项列表
  - [ ] 实现 `executeIntegration(G, integrationKey)`：
    - [ ] 校验整合条件
    - [ ] 创建新条目 `G.theoryMastery[resultName] = { stage: 1, hours: 0, integratedFrom: [A, B], learningSpeed: 1.5 }`
    - [ ] 原两个理论保留（stage 不变，标记为已整合）
    - [ ] 触发叙事 AI："你开始尝试将 X 与 Y 整合..."
    - [ ] 记录到 `G.careerHistory`（type: "theory_integration"）
  - [ ] 实现 `getIntegratedTheoryBonus(G, theoryName)`：
    - [ ] 若 theory 是整合取向 → 计算 bonus 时包含原两个理论的各 50% 贡献
    - [ ] 阶段系数使用整合取向的阶段
    - [ ] learningSpeed 加成（stage 提升所需时数 × 0.67）

### 3.2.2 整合 UI

- [ ] 在 `mainScreen_panel_ui.js` 中新增整合面板：
  - [ ] 理论列表中添加整合标识（已整合的理论显示 🔗 图标）
  - [ ] 满足整合条件时 → 显示「整合」按钮
  - [ ] 点击整合 → 弹出确认模态（显示整合结果 + 原理论 + 代价说明）
  - [ ] 确认后 → 显示动画效果 → 刷新理论面板

### 3.2.3 验证

- [ ] 手动设置 CBT stage=4 + 正念 stage=4 → 确认"MBCT"整合选项出现
- [ ] 执行整合 → 确认新条目 "正念认知治疗(MBCT)" 创建 + stage=1 + learningSpeed=1.5
- [ ] 确认原 CBT 和正念条目保留但标记为已整合
- [ ] 确认整合取向的理论 bonus 计算正确（原两个理论各 50%）
- [ ] 确认 learningSpeed=1.5 生效（10h 入门只需 6.7h）

---

## 3.3 职业生涯事件系统

### 3.3.1 职业事件引擎

- [ ] 在 `js/game/psychologist_base_runtime.js`（或新建专用模块）中新增：
  - [ ] 定义 `CAREER_EVENT_TYPES`：
    - [ ] `exam` — 资格考试
    - [ ] `conference` — 学术会议
    - [ ] `publication_deadline` — 论文截止
    - [ ] `job_offer` — 转职机会
    - [ ] `supervision_change` — 更换督导
    - [ ] `client_referral` — 重要转介
    - [ ] `award_nomination` — 奖项提名
    - [ ] `media_invitation` — 媒体邀请
  - [ ] 实现 `createCareerEvent(G, eventType, details)`：
    - [ ] 创建 event 对象（eventType/description/requirements/deadline/status）
    - [ ] 推入 `G.activeCareerEvents[]`（同类型去重）
    - [ ] 若 deadline 在 30 回合内 → 设置为"临近"
  - [ ] 实现 `checkEventDeadlines(G)`：
    - [ ] 遍历 `activeCareerEvents`
    - [ ] deadline 已过 → 标记为 "expired"
    - [ ] deadline 5 回合内 → 显示提醒
    - [ ] 移入 `careerHistory`（type: "career_event_expired"）
  - [ ] 实现 `completeCareerEvent(G, eventId, result)`：
    - [ ] 根据 eventType 应用奖励
    - [ ] exam 通过 → 临床时数 + 资格认证
    - [ ] conference 参加 → 理论时数 +5, 人脉 + reputation
    - [ ] publication 完成 → 研究积分 +50, reputation +10
    - [ ] job_offer 接受 → 工作场景切换
    - [ ] 记录到 `careerHistory`

### 3.3.2 职业事件 UI

- [ ] 在 `mainScreen_panel_ui.js` 中新增：
  - [ ] 右栏顶部新增「职业事件」面板
  - [ ] 活跃事件以卡片形式展示（事件类型图标 + 描述 + 截止日期倒计时）
  - [ ] 过期/完成事件以灰色显示
  - [ ] 点击事件卡片 → 展开详情

### 3.3.3 大阶段晋升完善

- [ ] 完善大阶段资格考试/答辩流程（按 logic-flow.md §6.3）：
  - [ ] 6 个大阶段跨越各一个考试/答辩场景模板（共6个）：
    - [ ] 心理学徒（贯通）→ 实习咨询师（初窥）："执业资格考试"
    - [ ] 实习咨询师（贯通）→ 初级咨询师（初窥）："独立执业资格申请"
    - [ ] 初级咨询师（贯通）→ 资深咨询师（初窥）："专家认证评估"
    - [ ] 资深咨询师（贯通）→ 治疗专家（初窥）："临床成果答辩"
    - [ ] 治疗专家（贯通）→ 心理学大师（初窥）："理论体系论证"
    - [ ] 心理学大师（贯通）→ 心灵哲学家（初窥）："终极哲学思辨"
  - [ ] 触发条件：当前 levelIndex 为 2, 5, 8, 11, 14, 17（即各大阶段的"贯通"阶段）
  - [ ] AI 生成考官/评审的提问（2-4 轮问答）
  - [ ] 引擎评估：硬性条件检查（临床时数/督导时数/理论掌握/个人体验）+ 叙事表现评定
  - [ ] 结果处理：通过 → 跨越一个大阶段（levelIndex 从 2→3 或 5→6 等），同时切换工作场景
  - [ ] 结果处理：未通过 → 保留原等级，获得"经验洞察"bonus（insight +3）
  - [ ] 冷却时间：30 次正常回合后可重试
  - [ ] 注意：此机制与自动的小阶段晋升（"初窥→践行→贯通"）是分开的、独立的两套系统

### 3.3.4 验证

- [ ] 手动触发 careerEvent(conference) → 确认事件出现在右栏
- [ ] 设置 deadline 为 3 回合后 → 确认提醒弹窗
- [ ] deadline 过期 → 确认事件标记为 expired
- [ ] 完成论文事件 → 确认研究积分 +50 + reputation +10
- [ ] 触发初级咨询师（贯通）→ 资深咨询师（初窥）的晋升考试 → 确认 2-4 轮问答流程
- [ ] 晋升未通过 → 确认 insight +3 经验洞察 + 30 回合冷却

---

## 3.4 个人体验系统

### 3.4.1 个人体验引擎

- [ ] 创建 `js/game/personal_therapy.js`（或集成到现有模块）：
  - [ ] 实现 `startPersonalTherapySession(G)`：
    - [ ] 触发叙事 AI：玩家作为「来访者」接受自己的治疗
    - [ ] 叙事视角切换（从咨询师→来访者）
    - [ ] 叙事约束：聚焦于玩家的个人议题而非职业议题
  - [ ] 实现 `computePersonalTherapyEffect(G, narrativeQuality)`：
    - [ ] 自觉性 +1~3
    - [ ] 指定类型反移情 -5~8
    - [ ] 个人体验时数 +1
    - [ ] 心理韧 +1~2
    - [ ] 疲劳度 -10
  - [ ] 实现 `checkPersonalTherapyRequirement(G, levelTransition)`：
    - [ ] 初级→资深：需 ≥ 50h 个人体验
    - [ ] 资深→专家：需 ≥ 100h
    - [ ] 专家→大师：需 ≥ 200h
    - [ ] 大师→心灵哲学家：需 ≥ 500h
  - [ ] 暴露 `PersonalTherapySystem` 全局命名空间

### 3.4.2 个人体验 UI

- [ ] 在 `mainScreen_panel_ui.js` 中新增：
  - [ ] 左栏新增个人体验时数显示
  - [ ] 「接受个人体验」按钮（消耗 1 回合，触发个人体验叙事）
  - [ ] 个人体验记录面板（每次体验的日期 + 议题 + 收获）

### 3.4.3 验证

- [ ] 触发个人体验 → 确认叙事视角切换为来访者
- [ ] 完成个人体验 → 确认自觉性 +2, 反移情 -6, 疲劳度 -10
- [ ] 确认个人体验时数累加
- [ ] 晋升检查时确认个人体验时数门槛生效

---

## 3.5 督导深度系统

### 3.5.1 督导引擎完善

- [ ] 完善督导反馈生成：
  - [ ] 根据督导师理论取向生成不同风格的反馈
  - [ ] 严格精神分析师 → 注重框架/中立/深度诠释 + insight
  - [ ] 温暖 CBT 取向者 → 注重结构/目标/技能 + technique
  - [ ] 人本主义倾听者 → 注重共情/无条件接纳 + empathy
  - [ ] 系统家庭治疗师 → 注重关系/代际模式 + communication
  - [ ] 存在主义导师 → 注重哲学深度/终极关怀 + humanity
  - [ ] 整合取向博学者 → 灵活多变/博采众长 + knowledge
- [ ] 督导时数累积与督导师关系发展：
  - [ ] 督导时数达到阈值 → 督导师关系阶段提升
  - [ ] 关系阶段影响督导反馈深度和 bonus 加成
  - [ ] 可申请更换督导师（叙事中自然过渡）

### 3.5.2 验证

- [ ] 不同理论取向的督导师给出不同风格的反馈
- [ ] 督导时数累积后关系阶段提升
- [ ] 更换督导师流程正常工作

---

## 3.6 流派传承系统（大师级以上）

### 3.6.1 传承引擎

- [ ] 在 `mainScreen_panel.js` 中新增传承功能（仅大师级以上可用）：
  - [ ] 实现 `startMentoring(G, menteeName)`：
    - [ ] 创建被督导者 NPC（后辈咨询师）
    - [ ] 进入师徒关系叙事
  - [ ] 实现 `computeMentoringEffect(G, sessionQuality)`：
    - [ ] 沟通力 +1~3
    - [ ] 论断力 +1~2
    - [ ] 理论时数 +5（教学是最好的学习）
    - [ ] reputation +2~5
  - [ ] 实现 `publishBook(G, bookTitle, theory)`：
    - [ ] 需理论掌握 ≥ stage 5
    - [ ] 触发著作写作叙事（多个回合）
    - [ ] 出版后 reputation +20~50
    - [ ] 该理论 stage 可能提升至 6（创新）
  - [ ] 实现 `checkLegacyMilestones(G)`：
    - [ ] 培养 5+ 后辈 → "桃李满天下"
    - [ ] 出版 3+ 著作 → "著作等身"
    - [ ] 开创整合取向 → "学派创始人"
    - [ ] 以上全达成 → 心灵哲学家突破加分

### 3.6.2 验证

- [ ] 达到大师级 → 确认传承功能可用
- [ ] 创建被督导者 → 确认师徒 NPC 加入 nearbyPeople
- [ ] 出版著作 → 确认 reputation 增长 + 理论可能提升至创新

---

## 3.7 Phase 3 完成标准

- [ ] **伦理困境完整**：5 类 × ≥14 个场景 + 决策→评估→叙事衔接
- [ ] **理论整合可用**：8 条路线 + 条件检查 + 执行 + bonus 计算 + 加速学习
- [ ] **职业事件系统工作**：8 种事件类型 + 提醒 + 完成奖励
- [ ] **个人体验系统工作**：触发→叙事→自觉性增长→反移情化解→晋升要求
- [ ] **督导深度系统工作**：6 种督导师风格 + 关系发展
- [ ] **传承系统可用**（大师级以上）：导师/著作/学派

> **完成后**：将本文件重命名为 `phase-3-advanced-done.md`

---

*基于：architecture.md §23 第三阶段 + logic-flow.md §6.3, §7.2, §9 + requirements.md §8, §14.2-§14.5*
