# Phase 2: 多角色 AI 管线

> 目标：将旧双回合管线（叙事 AI → 状态 AI）重构为多角色 AI 管线（世界 AI → 角色 AI(s) → 状态 AI）。这是 v2.0 架构的核心变更。
>
> 参考：architecture.md §5（多角色 AI 管线）+ architecture.md §12（惩罚系统架构）+ architecture.md §5.6（前缀缓存）

---

## 2.1 世界 AI（World AI）

### 2.1.1 核心模块

- [ ] 创建 `js/ai_server/world_ai.js`
  - [ ] 实现 `buildWorldAiMessages(G, fc, userText, priorContext)`：
    - [ ] system 消息 = 叙事规则 + 世界设定 + 发言编排规则（~3000 tokens，固定常量）
    - [ ] user 消息 = 玩家输入 + 游戏状态摘要 + 前文上下文（变化）
    - [ ] ⚠️ system prompt 中不含时间戳、随机数、动态模板变量
  - [ ] 实现 `sendWorldAiTurn(userText, G, fc, callbacks)`：
    - [ ] 流式调用，onChunk → 追加到聊天区
    - [ ] 解析 `<psy_scene_info>` 提取 speechSchedule
    - [ ] 返回 `{ narrativeText, speechSchedule, actionSuggestions }`
  - [ ] 实现 `parseSceneInfo(text)`：
    - [ ] 提取 `<psy_scene_info>` JSON
    - [ ] 校验 sceneType、speechSchedule 结构
    - [ ] speechSchedule 为空数组 → 纯环境叙事回合（N=0）
  - [ ] 暴露 `PsyDoctorWorldAI` 全局命名空间

### 2.1.2 世界 AI 预设

- [ ] 在 `preset_content.js` 中新增世界 AI 规则：
  - [ ] `worldNarrativeRules` — 叙事风格 + 环境描写规范 + 心理学世界设定
  - [ ] `speechScheduleRules` — 发言顺序表编排规则
    - [ ] 场景类型 → 默认发言者映射（咨询室→来访者优先；督导室→来访者+督导师）
    - [ ] 同一角色可多次出现（来访说了 → 督导回应 → 来访再回）
    - [ ] 发言长度建议（50-200 字/人）
  - [ ] `sceneTypeDefinitions` — 场景类型枚举与到场角色规则
    - [ ] therapy_session / supervision / daily_life / academic / conference / crisis
- [ ] 在 `preset.js` 中新增世界 AI 预设获取方法：
  - [ ] `getWorldAiSystemPrompt()` — 拼接世界 AI 的完整 system prompt

### 2.1.3 验证

- [ ] 发送日常对话 → 确认世界 AI 流式输出环境叙事
- [ ] speechSchedule 含 1 个来访者 → 确认后续调用角色 AI
- [ ] speechSchedule 为空 → 确认纯环境叙事，不调角色 AI
- [ ] system prompt 不含 {{worldTimeString}} 等动态变量 → 确认缓存友好
- [ ] 多次调用世界 AI → 确认 `prompt_cache_hit_tokens` 逐次增长

---

## 2.2 角色发言人格数据（speechProfile）

### 2.2.1 数据层

- [ ] 创建 `js/data/role_speech_profile.js`
  - [ ] 定义 `CLIENT_SPEECH_PROFILES` — 按案例类型×依恋模式×防御风格组合的人格模板：
    - [ ] 每种组合包含：basePersonality（性格描述）+ speechPattern（说话模式）+ emotionalRange（情感范围）+ defenseManifestation（防御在语言中的体现）
    - [ ] ~20 种常见组合的预设模板
  - [ ] 定义 `SUPERVISOR_SPEECH_PROFILES` — 按理论取向×教学风格的模板：
    - [ ] 6 种督导师类型（严格精神分析师/温暖CBT/人本倾听者/系统家庭/存在主义/整合博学者）
  - [ ] 定义 `COLLEAGUE_SPEECH_PROFILES` — 按关系类型模板：
    - [ ] 友好型 / 竞争型 / 导师型
  - [ ] 实现 `buildRoleSystemPrompt(speechProfile)`：
    - [ ] 输入 speechProfile 对象 → 输出该角色的固定 system prompt 文本
    - [ ] 相同的 speechProfile → 相同 system prompt（确定序列化）
  - [ ] 暴露 `RoleSpeechProfile` 全局命名空间

### 2.2.2 集成到现有档案

- [ ] 改造 `client_templates.js`：
  - [ ] 每个 CLIENT_CASE_TYPES 条目新增 `defaultSpeechProfile` 字段
  - [ ] 包含对应的人格模板引用 + 默认说话习惯
- [ ] 改造 `client_character_sheet.js`：
  - [ ] `createNewClient()` 中自动初始化 `speechProfile`
  - [ ] `normalizeCharacter()` 中处理 NPC 的 speechProfile 字段
  - [ ] 新增 `updateSpeechHabits(client, newText)` — 从发言中提取说话习惯更新
- [ ] 在 `init_state_generate.js` 中：
  - [ ] 开局配置 AI 输出中新增初始 NPC 的 speechProfile 建议

### 2.2.3 验证

- [ ] 创建存在危机型/安全型/理智化的来访者 → 确认 speechProfile 正确生成
- [ ] 相同参数的来访者 → 确认 buildRoleSystemPrompt 输出完全一致
- [ ] 创建精神分析取向督导师 → 确认 speechProfile 包含理论取向描述
- [ ] `updateSpeechHabits` → 确认说话习惯字段更新

---

## 2.3 角色 AI（Role AI）

### 2.3.1 核心模块

- [ ] 创建 `js/ai_server/role_ai.js`
  - [ ] 实现 `callSingleRoleAI(roleProfile, context, G)`：
    - [ ] system = `buildRoleSystemPrompt(roleProfile.speechProfile)`（固定 → 命中 prefix cache）
    - [ ] user = 场景上下文 + 前文摘要 + [前一发言者原文]
    - [ ] 流式调用，追加到聊天区（标记 `[角色名]`）
    - [ ] 返回 `{ text, roleId }`
  - [ ] 实现 `runRoleAiPhase(speechSchedule, worldAiNarrative, G)`：
    - [ ] 遍历 speechSchedule，串行调用 `callSingleRoleAI`
    - [ ] 每个角色调用前注入前一个角色的发言原文
    - [ ] 累积所有发言文本
    - [ ] 返回 `{ speeches[], combinedText }`
  - [ ] 实现 `findRoleById(id)`：
    - [ ] 从 G.currentClients 查找（来访者）
    - [ ] 从 G.nearbyPeople 查找（督导师/同行）
    - [ ] 返回角色完整对象（含 speechProfile）
  - [ ] 暴露 `PsyDoctorRoleAI` 全局命名空间

### 2.3.2 前缀缓存约束

- [ ] system prompt 构建遵循前缀缓存规则（参见 architecture.md §5.6）：
  - [ ] 固定内容在前：姓名 + 案例类型 + 依恋 + 防御 + 说话习惯
  - [ ] 零动态变量：system prompt 中不出现时间、状态数字
  - [ ] 变化内容在 user message 中：场景 + 前文 + 前一发言
- [ ] 相同 speechProfile 的角色 → 完全相同 system prompt → 共享缓存
- [ ] 在 bridge.js 中记录缓存命中率日志 `[psy:cache]`

### 2.3.3 验证

- [ ] speechSchedule 含 2 个角色 → 确认串行调用，角色 2 知道角色 1 说了什么
- [ ] 同一角色同回合发言 2 次 → 确认第二次调用延迟明显低于第一次（缓存命中）
- [ ] 不同角色（不同 system prompt）→ 各自命中自己的缓存
- [ ] 缓存命中率日志正常输出
- [ ] 角色发言追加到聊天区时正确标记 `[角色名]`

---

## 2.4 主聊天管线改造

### 2.4.1 mainScreen_chat.js 改造

- [ ] `handleChatSend()` 重写：
  - [ ] Step 2 替换为 `PsyDoctorWorldAI.sendWorldAiTurn()`
  - [ ] 新增 Step 3 `PsyDoctorRoleAI.runRoleAiPhase(speechSchedule, narrative, G)`
  - [ ] Step 4 状态 AI —— 输入改为世界AI叙事 + 角色AI发言拼接
  - [ ] 保留 Step 1 校验 + Step 5 后处理 + Step 6 UI 刷新
- [ ] 流式渲染适配：
  - [ ] 世界 AI 流式（正文区追加）
  - [ ] 角色 AI 流式（发言区追加，每个角色独立段落）
- [ ] 异常处理：
  - [ ] 角色 AI 调用失败 → 跳过该角色，继续下一个
  - [ ] 世界 AI 调用失败 → 保持旧架构兜底（用 story_generate.js）

### 2.4.2 废弃旧模块

- [ ] `story_generate.js` 保留但标记为废弃（兜底用）
- [ ] 在 main.html 中不再加载 story_generate.js（改为 world_ai.js + role_ai.js）
- [ ] 旧规则预设中仅世界 AI 和角色 AI 相关的保留，其余归档

### 2.4.3 验证

- [ ] 完整回合：玩家输入 → 世界 AI 叙事 → 来访者发言 → 状态 AI → UI 刷新
- [ ] speechSchedule 空 → 世界 AI 叙事 → 直接到状态 AI（无角色发言阶段）
- [ ] speechSchedule 含 3 个角色 → 串行发言均在聊天区正确显示
- [ ] 异常时旧架构兜底正常工作
- [ ] 个案会话中的来访者发言使用角色 AI（非世界 AI）

---

## 2.5 个人体验系统（旧 Phase 3 遗留）

- [ ] 创建 `js/game/personal_therapy.js`
  - [ ] 实现 `startPersonalTherapySession(G)`：触发叙事，玩家作为来访者
  - [ ] 实现 `computePersonalTherapyEffect(G, sessionQuality)`：自觉性 +1~3，反移情 -5~8
  - [ ] 实现 `checkPersonalTherapyRequirement(G, levelTransition)`：晋升时的个人体验门槛
  - [ ] 暴露 `PersonalTherapySystem` 全局命名空间

---

## 2.6 Phase 2 完成标准

- [ ] **世界 AI 正常运作**：流式环境叙事 + speechSchedule 编排正确
- [ ] **角色 AI 正常运作**：串行发言 + 对话感 + prefix cache 命中
- [ ] **speechProfile 完整**：来访者/督导师/同行各有人格模板 + 自动生成
- [ ] **管线切换**：mainScreen_chat.js 使用新管线，旧 story_generate.js 兜底
- [ ] **前缀缓存验证**：角色 AI system prompt 固定 → 命中独立缓存
- [ ] **理论体系数据**：theory_state.js 完整（旧 Phase 2 遗留）
- [ ] **个人体验系统**：基本可用

> **完成后**：将本文件重命名为 `phase-2-ai-pipeline-done.md`

---

*基于：architecture.md §5（多角色 AI 管线）+ architecture.md §5.6（前缀缓存）*
*依赖：Phase 1 完成（个案引擎 + 基础 UI + bridge.js）*
*创建日期：2026-06-26*
