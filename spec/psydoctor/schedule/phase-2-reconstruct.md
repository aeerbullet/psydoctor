# Phase 2: 即刻重构 — 多角色 AI 管线

> 目标：从当前可运行的单 AI（story_generate.js）切换到多角色 AI 管线。
> 策略：渐进替换，旧模块保留兜底，每个 checkpoint 可验证、可回退。

---

## Checkpoint 0: 当前状态确认

- [ ] 确认 Phase 1 可正常运行：创建角色 → 发消息 → AI 回复 → 面板更新 → 存档
- [ ] 确认 `story_generate.js` 正常工作（当前叙事 AI）
- [ ] 确认 `state_generate.js` 正常工作（当前状态 AI）
- [ ] 确认 `case_session.js` 正常工作（个案引擎）
- [ ] Git commit 当前状态作为回退基线

---

## Checkpoint 1: 世界 AI 独立运行（最核心）

**不改动 mainScreen_chat.js**。先在旁边建好世界 AI，独立验证。

- [ ] 创建 `js/ai_server/world_ai.js`
  - [ ] `buildWorldAiMessages(G, fc, userText)` — 构建缓存友好的 messages 数组
  - [ ] `sendWorldAiTurn(userText, G, fc, callbacks)` — 调用 API，流式回调
  - [ ] `parseSceneInfo(text)` — 解析 `<psy_scene_info>` 提取 speechSchedule
- [ ] 在 `preset_content.js` 中新增世界 AI system prompt 内容
- [ ] **验证**：写一个临时测试按钮，单独调世界 AI → 确认输出环境叙事 + `<psy_scene_info>` 标签

**停止条件**：世界 AI 能独立生成叙事 + 输出正确的 speechSchedule JSON。

---

## Checkpoint 2: 角色 AI 独立运行

**不改动 mainScreen_chat.js**。让角色 AI 能根据 speechProfile 生成发言。

- [ ] 创建 `js/data/role_speech_profile.js`
  - [ ] `CLIENT_SPEECH_PROFILES` — 按案例×依恋×防御的组合模板（先做 3 种组合）
  - [ ] `SUPERVISOR_SPEECH_PROFILES` — 按理论取向模板（先做 2 种）
  - [ ] `buildRoleSystemPrompt(speechProfile)` — 确定序列化
- [ ] 改造 `client_character_sheet.js` — `createNewClient()` 自动生成 speechProfile
- [ ] 创建 `js/ai_server/role_ai.js`
  - [ ] `callSingleRoleAI(roleProfile, context)` — 单角色调用
  - [ ] `runRoleAiPhase(speechSchedule, narrative, G)` — 串行编排
- [ ] **验证**：写临时测试按钮，传入假的 speechSchedule → 确认串行发言 + 角色 2 知道角色 1 说了什么

**停止条件**：角色 AI 能按 speechSchedule 串行生成发言，聊天区正确显示。

---

## Checkpoint 3: 管线切换

**改造 mainScreen_chat.js**。把世界 AI + 角色 AI 串进主流程，旧 story_generate.js 保留兜底。

- [ ] `handleChatSend()` 重写 Step 2-4：
  - Step 2: 调世界 AI → 流式渲染环境叙事
  - Step 2.5: 解析 speechSchedule
  - Step 3: 调 role_ai.runRoleAiPhase(speechSchedule, narrative)
  - Step 4: 调状态 AI（输入 = 世界AI叙事 + 角色AI发言拼接）
- [ ] 异常处理：世界 AI 失败 → 回退到 story_generate.js
- [ ] **验证**：完整回合 — 玩家发消息 → 世界叙事 → 来访者说话 → 状态更新 → 面板刷新

**停止条件**：一条完整的消息回路在新管线中跑通。

---

## Checkpoint 4: 个案引擎接入角色 AI

确保个案会话中的来访者发言走角色 AI 而非世界 AI。

- [ ] 个案回合中：来访者的回应由角色 AI 生成（复用 Checkpoint 2 的能力）
- [ ] 咨询师的干预选择由玩家直接操作（不需要 AI）
- [ ] **验证**：进行一次完整的个案会话 — 选干预技术 → 来访者回应（角色 AI）→ 多回合

**停止条件**：个案会话完整跑通，来访者回应体现了角色 AI 的人格。

---

## Checkpoint 5: 前缀缓存验证 + 兜底清理

- [ ] 在 bridge.js 中记录 `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`
- [ ] 连续 10 回合后检查：角色 AI system prompt 是否持续命中缓存
- [ ] `story_generate.js` 保留为兜底，标记 `@deprecated`
- [ ] **验证**：缓存命中率 ≥80%（角色 AI）

---

## 完成标准

- [x] 世界 AI 独立运行 ✅ Checkpoint 1
- [x] 角色 AI 串行发言 ✅ Checkpoint 2
- [x] 主管线切换，旧代码兜底 ✅ Checkpoint 3
- [x] 个案引擎接入角色 AI ✅ Checkpoint 4
- [x] 前缀缓存命中率达标 ✅ Checkpoint 5

完成后将本文件重命名为 `phase-2-reconstruct-done.md`，然后进入 Phase 3（游戏性系统）。

---

*创建日期: 2026-06-26*
*预计: 5 个 Checkpoint，每个可独立验证、可回退*
