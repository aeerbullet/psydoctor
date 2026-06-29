# psydoctor 开发 Schedule 总览（v2.0）

> v2.0 更新（2026-06-26）：AI 管线从双回合架构重构为多角色 AI 架构。排期表据此重新编排。
>
> 旧 Phase 2/3/3B 合并重组为新的 Phase 2（多角色 AI 管线）和 Phase 3（游戏性系统）。

---

## 阶段总览

| 阶段 | 文件 | 目标 | 
|------|------|------|
| Phase 1 | [phase-1-core.md](phase-1-core.md) | 核心框架（可玩原型）✅ |
| **🟢 NOW** | [**phase-2-reconstruct.md**](phase-2-reconstruct.md) | **多角色 AI 管线渐进重构（5 个 Checkpoint）** |
| Phase 2 详细 | [phase-2-ai-pipeline.md](phase-2-ai-pipeline.md) | 完整任务清单与验证标准 |
| Phase 3 | [phase-3-gameplay.md](phase-3-gameplay.md) | 惩罚机制 + 声誉 + 执照 + 风险仪表盘 |
| Phase 4 | [phase-4-polish.md](phase-4-polish.md) | 打磨完善 |

---

## 阶段依赖关系

```
Phase 1 ──── 可玩原型 ✅
  │         角色创建 + AI 对话 + 面板 + 存档 + 个案引擎
  │
  ├── Phase 2 ──── 多角色 AI 管线（NEW）
  │     │         世界 AI + 角色 AI（串行发言）+ speechProfile
  │     │         前缀缓存友好消息结构
  │     │         个案引擎整合新管线
  │     │
  │     ├── Phase 3 ──── 游戏性系统（NEW）
  │     │     │         治疗失误 + 来访者脱落 + 三维声誉
  │     │     │         执照危机 + 风险仪表盘
  │     │     │
  │     │     └── Phase 4 ──── 打磨完善
  │     │                   移动端 + 调优 + 测试
  │     │
  │     └── (Phase 2 完成 = 多角色独立发言可用)
  │
  └── (Phase 1 完成 = 基础游戏可玩)
```

**Phase 2 是本次重构的核心**：将旧的双回合管线（叙事 AI 一人演所有角色）替换为多角色 AI 管线（世界 AI + N 个角色 AI）。Phase 3 的惩罚系统依赖 Phase 2 的新管线才能实现独立角色人格和发言链。

---

## 各阶段文件变更明细

### Phase 1 已完成文件

Phase 1 已基本完成（233/271 ✅），产出文件均在 `js/` 目录下正常运作。剩余 38 项为验证任务和边缘情况处理，在 Phase 4 中统一补完。

### Phase 2 文件变更（多角色 AI 管线 — 12 个文件）

```
新建（5 个）：
  js/ai_server/world_ai.js              — 世界 AI：环境叙事 + speechSchedule 编排
  js/ai_server/role_ai.js               — 角色 AI：独立角色发言 + 串行调用编排
  js/data/role_speech_profile.js        — 发言人格模板（来访者/督导师/同行）
  js/data/theory_state.js               — 理论学习体系数据（旧 Phase 2 遗留）
  js/game/personal_therapy.js           — 个人体验系统（旧 Phase 3 遗留）

改造（7 个）：
  js/ui/mainScreen_chat.js              — 新管线编排：world → role(s) → state
  js/worldbook/preset_content.js        — 规则拆分到世界 AI 和角色 AI
  js/worldbook/preset.js                — 新增角色 AI 预设管理
  js/data/client_templates.js           — 新增 speechProfile 初始化数据
  js/game/client_character_sheet.js     — 新增 speechProfile 字段构建
  js/game/case_session.js               — 整合失误检测基础 + 防御-技术适配表
  js/ai_server/state_generate.js        — 新增 psy_scene_info 等标签解析

废弃（1 个）：
  js/ai_server/story_generate.js        — 被世界 AI + 角色 AI 替代
```

### Phase 3 文件变更（游戏性系统 — 13 个文件）

```
新建（5 个）：
  js/game/treatment_error_tracker.js    — 三级失误追踪引擎
  js/game/reputation_system.js          — 三维声誉计算引擎
  js/game/license_crisis.js             — 执照危机状态机
  js/data/license_state.js              — 执照状态数据表
  js/data/dropout_table.js              — 脱落基础倾向数据表

改造（8 个）：
  js/game/countertransference.js        — 失误→反移情联动
  js/game/ethics_dilemma.js             — Tier 3 伦理性失误 + 声誉影响
  js/game/psychologist_base_runtime.js  — Step 3.5 声誉/执照修正
  js/ui/mainScreen_panel.js             — 失误追踪/声誉/执照数据管理
  js/ui/mainScreen_panel_ui.js          — 风险仪表盘 + 脱落预警 + 回合弹窗
  js/ui/mainScreen_chat.js              — 后处理整合失误/脱落/声誉检查
  js/worldbook/state_rules.js           — 失误/脱落/声誉规则模板
  js/ai_server/state_generate.js        — 新增 psy_treatment_error 等标签
```

### Phase 4 文件变更（打磨 — 全模块）

```
psydoctor/
├── css/
│   ├── main.css                        (移动端适配)
│   └── creation.css                    (移动端适配)
├── js/
│   ├── worldbook/world_book_entries.js (扩充 25+→50+)
│   ├── worldbook/preset_content.js     (调优)
│   ├── worldbook/state_rules.js        (调优)
│   ├── ai_server/*                     (前缀缓存验证 + 模型适配)
│   └── ui/*                            (性能优化 + 边缘情况)
├── silly_tarven/bridge.js              (缓存命中率监控)
└── spec/psydoctor/                     (文档归档)
```

---

## 旧排期与新排期的映射关系

| 旧排期 | 内容 | 新排期 |
|--------|------|--------|
| Phase 2 §2.1 | theory_state.js | → Phase 2 |
| Phase 2 §2.2 | client_templates / case_session / countertransference | → Phase 1 已完成 |
| Phase 2 §2.3 | world_book / preset 扩充 | → Phase 4 |
| Phase 3 §3.1 | ethics_dilemma.js | → Phase 1 已完成（基础版）+ Phase 3 改造 |
| Phase 3 §3.4 | personal_therapy.js | → Phase 2 |
| Phase 3B 全部 | 惩罚机制优化 | → Phase 3（合并） |
| Phase 3 §3.2/3.3/3.5/3.6 | 理论整合/职业事件/督导/传承 | → Phase 4（后续迭代） |

---

## 使用说明

1. **开始一个阶段前**：阅读对应 phase 文件的全部任务清单
2. **完成一个子任务**：将该行的 `- [ ]` 改为 `- [x]`
3. **一个阶段全部完成**：所有 `- [ ]` 均已变为 `- [x]`，将文件重命名为 `phase-{N}-{name}-done.md`
4. **版本控制**：每个阶段完成后 commit 一次
5. **旧排期文件归档**：`phase-2-depth.md`、`phase-3-advanced.md`、`phase-3B-punishment.md` 保留为历史参考

---

*版本：v2.0 | 更新日期：2026-06-26*
*原因：AI 管线从双回合架构重构为多角色 AI 架构*
