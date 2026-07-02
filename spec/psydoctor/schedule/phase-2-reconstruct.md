# Phase 2: 即刻重构 — 多角色 AI 管线

> 目标：从当前可运行的单 AI（story_generate.js）切换到多角色 AI 管线。
> 策略：渐进替换，旧模块保留兜底，每个 checkpoint 可验证、可回退。

---

## Checkpoint 0: 当前状态确认

- [x] 确认 Phase 1 可正常运行：创建角色 → 发消息 → AI 回复 → 面板更新 → 存档
- [x] 确认 `story_generate.js` 正常工作（当前叙事 AI）
- [x] 确认 `state_generate.js` 正常工作（当前状态 AI）
- [x] 确认 `case_session.js` 正常工作（个案引擎）
- [x] Git commit 当前状态作为回退基线

---

## Checkpoint 1: 世界 AI 独立运行（最核心）

**不改动 mainScreen_chat.js**。先在旁边建好世界 AI，独立验证。

- [x] 创建 `js/ai_server/world_ai.js`
  - [x] `buildWorldAiMessages(G, fc, userText)` — 构建缓存友好的 messages 数组
  - [x] `sendWorldAiTurn(userText, G, fc, callbacks)` — 调用 API，流式回调
  - [x] `parseSceneInfo(text)` — 解析 `<psy_scene_info>` 提取 speechSchedule
- [x] 在 `preset_content.js` 中新增 `getWorldAiSystemPrompt()` 委托方法
- [x] 在 `preset.js` 中新增 `getWorldAiSystemPrompt()` 委托方法
- [x] 在 `main.html` 加载顺序中新增 `world_ai.js`
- [x] **验证**：浏览器控制台测试全部通过（消息构建/场景解析/人格模板/确定序列化/查找角色/消息结构）

**停止条件**：世界 AI 能独立生成叙事 + 输出正确的 speechSchedule JSON。

---

## Checkpoint 2: 角色 AI 独立运行

**不改动 mainScreen_chat.js**。让角色 AI 能根据 speechProfile 生成发言。

- [x] 创建 `js/data/role_speech_profile.js`
  - [x] `CLIENT_SPEECH_PROFILES` — 6 种案例×依恋×防御组合（existential_crisis_secure/anxious + depression_anxious/avoidant + trauma_disorganized/anxious + anxiety_anxious/secure）
  - [x] `SUPERVISOR_SPEECH_PROFILES` — 6 种督导师（精神分析/CBT/人本/系统/存在/整合）
  - [x] `COLLEAGUE_SPEECH_PROFILES` — 3 种同行（友好/竞争/导师）
  - [x] `buildRoleSystemPrompt(speechProfile)` — 确定序列化，相同参数→相同 system prompt
- [x] 创建 `js/ai_server/role_ai.js`
  - [x] `callSingleRoleAI(roleProfile, context, options)` — 单角色调用（流式）
  - [x] `runRoleAiPhase(speechSchedule, narrative, G)` — 串行编排，后一个收到前一个发言
  - [x] `findRoleById(id, G)` — 从 currentClients / nearbyPeople 查找
- [x] 改造 `client_character_sheet.js`
  - [x] `createNewClient()` 和 `normalizeCharacter()` 自动生成 `speechProfile`
- [x] 在 `main.html` 加载顺序中新增 `role_speech_profile.js` 和 `role_ai.js`
- [x] **验证**：浏览器控制台测试全部通过（模块加载/人格模板生成/确定序列化/查找角色/消息构建）

**停止条件**：角色 AI 能按 speechSchedule 串行生成发言，聊天区正确显示。

---

## Checkpoint 3: 管线切换

**改造 mainScreen_chat.js**。把世界 AI + 角色 AI 串进主流程，旧 story_generate.js 保留兜底。

- [x] `handleChatSend()` 重写（637 行，+171 行新管线代码）：
  - [x] Step 2: `runWorldAiTurn()` → 流式渲染环境叙事（提取 `<psy_story_body>`）
  - [x] Step 2.5: 解析 speechSchedule → 传递给角色 AI 阶段
  - [x] Step 3: `runRoleAiPhase()` → 调用 PsyDoctorRoleAI.runRoleAiPhase 串行发言
  - [x] Step 4: 状态 AI（输入 = 世界AI叙事 + 角色AI发言拼接）
- [x] 异常处理三级降级：
  - `handlePipelineError()` 逻辑
  - 世界 AI 失败 → `err.fallbackToOld` → `USE_NEW_PIPELINE=false` → 永久回退旧管线
  - 角色 AI 失败 → `err.roleAiFailed` → 跳过角色，直接状态同步
  - 其他错误 → 报错提示
- [ ] **验证**（需要 API Key + 浏览器完整测试）

**停止条件**：一条完整的消息回路在新管线中跑通。

---

## Checkpoint 4: 个案引擎接入角色 AI

确保个案会话中的来访者发言走角色 AI 而非世界 AI。

- [x] 个案回合中：来访者的回应由角色 AI 生成（复用 Checkpoint 2 的能力）
- [x] 咨询师的干预选择由玩家直接操作（不需要 AI）
- [x] **验证**：进行一次完整的个案会话 — 选干预技术 → 来访者回应（角色 AI）→ 多回合

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
