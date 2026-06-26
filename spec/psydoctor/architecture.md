# psydoctor（心理医生成长记）架构设计文档

> 基于需求文档 v1.0 的架构设计，借鉴 mortal_journey（凡人修仙传）的 IIFE + 全局命名空间 + AI 双回合管线架构，将修仙 RPG 引擎改造为心理学成长 RPG 引擎。本文档聚焦于**如何实现**——模块划分、数据流、算法细节、接口协议、关键设计决策。

---

## 1. 架构概览

psydoctor 是一个**纯前端浏览器端 AI 文字心理医生成长 RPG**，无后端、无模块打包器、无框架。核心架构特征：

- **双页面路由**：`index.html`（启动页/人生选择）→ `main.html`（主游戏界面）
- **IIFE + 全局命名空间**模块化：每个 JS 文件是一个自执行函数，通过 `window.XYZ = {}` 暴露 API
- **AI 驱动叙事**：OpenAI 兼容 API，多角色 AI 管线（世界 AI → 角色 AI(s) → 状态 AI），继承 mortal_journey 的 `silly_tarven/bridge.js`（详见 §5）
- **前缀缓存优化**：消息结构设计确保 DeepSeek 硬盘缓存命中，预期输入成本降低 35-50%（详见 §5.6）
- **XML 标签协议**：AI 通过 `<psy_*>` 标签向游戏引擎传递结构化指令（17 种标签类型）
- **单一状态树**：`window.PsyDoctorGame` 作为全局游戏状态
- **双层持久化**：sessionStorage（当前会话快照）+ localStorage（永久存档）
- **咨询个案引擎**：替代战斗系统，回合制咨询会话 + 治疗效果评估
- **治疗失误追踪系统**：玩家决策驱动的三级失误（技术/策略/伦理）+ 多层后果（来访者脱落/声誉下降/执照危机）。详见 §12
- **反移情系统**：心理咨询特有的职业风险追踪机制
- **伦理困境系统**：多选择伦理决策，无"完美答案"

```
┌──────────────────────────────────────────────────────────────┐
│                    index.html (启动页)                         │
│  API 设置 → 人生选择（教育背景/入行契机/初始理论/个人特质）     │
└───────────────────────┬──────────────────────────────────────┘
                        │ sessionStorage 传递 fateChoice + bootstrap
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                    main.html (主游戏界面)                       │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │ 左栏     │  │ 中央叙事区        │  │ 右栏             │    │
│  │ 医生面板 │  │ AI 人生叙事对话   │  │ 来访者列表        │    │
│  │ 等级/属性│  │ 咨询会话过程      │  │ 同行/督导师       │    │
│  │ 理论掌握 │  │ 督导反馈          │  │ 未读消息/事件     │    │
│  │ 哲学深度 │  │ 职业生涯事件      │  │                  │    │
│  │ 藏书/工具│  │                  │  │                  │    │
│  └──────────┘  └──────────────────┘  └──────────────────┘    │
│                                                               │
│  底层：silly_tarven/bridge.js → OpenAI 兼容 API（复用）        │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 模块架构：IIFE + 全局命名空间

### 2.1 模块模式

所有 JS 文件采用统一的 IIFE（Immediately Invoked Function Expression）模式，与 mortal_journey 完全一致：

```javascript
// 标准模块骨架（以 world_book.js 为例）
(function (global) {
  "use strict";

  // 私有变量与函数
  var PSY_WORLD_BOOK_ENTRIES = loadEntriesFromGlobal();

  function selectEntries(scanText, options) { /* ... */ }

  // 对外暴露 API
  global.PsyDoctorWorldBook = {
    selectEntries: selectEntries,
    formatForSystem: formatForSystem,
    syncToBridgeStorage: syncToBridgeStorage,
  };
})(typeof window !== "undefined" ? window : globalThis);
```

### 2.2 全局命名空间一览

| 命名空间 | 源文件 | 职责 | 对应 mortal_journey |
|---|---|---|---|
| `PsyDoctorGame` | 运行时注入 | 全局游戏状态单例 | `MortalJourneyGame` |
| `PsyDoctorCreationConfig` | `js/data/creation_config.js` | 开局配置（教育背景、动机、初始理论、特质） | `MjCreationConfig` |
| `DoctorLevelState` | `js/data/doctor_level.js` | 心理医生等级基础属性表、临床时数需求表 | `RealmState` |
| `TheoryState` | `js/data/theory_state.js` | 心理学理论体系与效果映射、整合规则 | 无直接对应（新系统） |
| `PhilosophyState` | `js/data/philosophy_state.js` | 哲学深度维度与属性加成映射 | `LeegenState`（类比灵根） |
| `ClientTemplates` | `js/data/client_templates.js` | 来访者案例类型模板与防御机制数据 | 无直接对应（新系统） |
| `PsyTraitSamples` | `js/data/trait_samples.js` | 个人特质词条池 | `TraitSamples` |
| `PsychologistBaseRuntime` | `js/game/psychologist_base_runtime.js` | 心理医生属性计算引擎 | `PlayerBaseRuntime` |
| `ClientCharacterSheet` | `js/game/client_character_sheet.js` | 来访者档案规范化（来访者/NPC/督导师共用） | `MjCharacterSheet` |
| `CaseSessionEngine` | `js/game/case_session.js` | 咨询个案回合引擎 | `MortalJourneyBattle` |
| `EthicsDilemmaEngine` | `js/game/ethics_dilemma.js` | 伦理困境决策引擎 | 无直接对应（新系统） |
| `CountertransferenceTracker` | `js/game/countertransference.js` | 反移情累积与职业危机追踪 | 无直接对应（新系统） |
| `PsyDoctorAiPreset` | `js/worldbook/preset.js` | AI 叙事预设/规则管理 | `MortalJourneyAiPreset` |
| `PsyDoctorPresetContent` | `js/worldbook/preset_content.js` | 预设内容数据 | `MortalJourneyPresetContent` |
| `PsyDoctorWorldBook` | `js/worldbook/world_book.js` | 心理学知识基底引擎（关键词触发上下文注入） | `MortalJourneyWorldBook` |
| `PsyDoctorWorldBookEntries` | `js/worldbook/world_book_entries.js` | 知识基底条目数据 | `MortalJourneyWorldBookEntries` |
| `PsyDoctorStateRules` | `js/worldbook/state_rules.js` | 状态 AI 规则模板 | `MortalJourneyStateRules` |
| `PsyDoctorInitStateRules` | `js/worldbook/init_state_rules.js` | 开局配置 AI 规则模板 | `MortalJourneyInitStateRules` |
| `PsyDoctorWorldGenerate` | `js/ai_server/world_generate.js` | 开局人生剧情 AI 生成 | `MortalJourneyWorldGenerate` |
| `PsyDoctorInitStateGenerate` | `js/ai_server/init_state_generate.js` | 开局配置 AI（教育/初始理论/初始来访者） | `MortalJourneyInitStateGenerate` |
| `PsyDoctorStateGenerate` | `js/ai_server/state_generate.js` | 状态 AI（来访者/职业生涯/时数同步） | `MortalJourneyStateGenerate` |
| `PsyDoctorStoryGenerate` | `js/ai_server/story_generate.js` | ~~人生叙事 AI 生成~~（废弃，由 WorldAI + RoleAI 替代） | `MortalJourneyStoryChat` |
| `PsyDoctorWorldAI` | `js/ai_server/world_ai.js` | 世界 AI — 环境叙事 + 发言顺序表编排 | 新系统 |
| `PsyDoctorRoleAI` | `js/ai_server/role_ai.js` | 角色 AI — 独立角色发言生成 + 串行调用编排 | 新系统 |
| `RoleSpeechProfile` | `js/data/role_speech_profile.js` | 角色发言人格模板（来访者/督导师/同行） | 新系统 |
| `TreatmentErrorTracker` | `js/game/treatment_error_tracker.js` | 治疗失误追踪引擎（三级失误检测） | 新系统 |
| `PsyDoctorReputation` | `js/game/reputation_system.js` | 三维声誉计算引擎 | 新系统 |
| `LicenseCrisisEngine` | `js/game/license_crisis.js` | 执照危机状态机 | 新系统 |
| `PsyMainScreenPanel` | `js/ui/mainScreen_panel.js` | 主界面面板数据逻辑（等级/理论/来访者/存档） | `MjMainScreenPanelRealm` |
| `PsyMainScreenPanelUi` | `js/ui/mainScreen_panel_ui.js` | 主界面面板 UI 渲染（格子/弹窗/左栏） | `MjMainScreenPanel` |
| `PsyMainScreenChat` | `js/ui/mainScreen_chat.js` | 聊天 UI + AI 回合编排 + 个案触发 | `MjMainScreenChat` |
| `PsyMainScreen` | `js/ui/mainScreen.js` | 主界面对外 API + 门闩管线 + 初始化 | `MainScreen` |
| `PsyFateChoiceController` | `js/ui/fateChoiceController.js` | 启动页命运抉择 | `FateChoiceController` |
| `TavernHelper` / `SillyTavernBridge` | `silly_tarven/bridge.js` | OpenAI 兼容 API 调用桥接层（复用，无修改） | 同名 |
| `GameLog` | `js/log/logPanel.js` | 调试日志面板（复用，无修改） | 同名 |
| `CharacterAttribute` | `js/character/character_attribute.js` | 属性键定义与校验 | 同名 |

### 2.3 模块加载顺序

模块间存在隐式依赖，通过 `<script>` 标签的加载顺序保证（在 `main.html` 中声明）：

```
1. 数据层（无依赖，纯静态数据表）
   ├── character/character_attribute.js    ← 属性键定义
   ├── data/doctor_level.js               ← 等级基础属性表 + 临床时数阶梯
   ├── data/theory_state.js               ← 理论体系 + 效果 + 整合规则
   ├── data/philosophy_state.js           ← 哲学维度 + 属性倍率
   ├── data/trait_samples.js              ← 个人特质词条池
   ├── data/client_templates.js           ← 来访者案例类型模板
   └── data/creation_config.js            ← 教育背景/动机/特质配置

2. 游戏引擎层（依赖数据层，计算密集，无 DOM 操作）
   ├── game/psychologist_base_runtime.js  ← 属性计算引擎（核心算法）
   ├── game/client_character_sheet.js     ← 来访者档案规范化
   ├── game/case_session.js              ← 咨询个案回合引擎
   ├── game/ethics_dilemma.js            ← 伦理困境决策引擎
   └── game/countertransference.js       ← 反移情追踪系统

3. 世界书/Preset 层（依赖数据层 + 引擎层部分模块）
   ├── worldbook/world_book_entries.js    ← 心理学知识条目数据
   ├── worldbook/world_book.js            ← 知识基底引擎（关键词匹配）
   ├── worldbook/preset_content.js        ← AI 预设内容数据
   ├── worldbook/preset.js                ← AI 预设管理器
   ├── worldbook/state_rules.js           ← 状态 AI 规则模板
   └── worldbook/init_state_rules.js      ← 开局配置 AI 规则模板

4. AI 服务层（依赖世界书 + 引擎层，prompt 构建 + 响应解析）
   ├── ai_server/world_generate.js        ← 开局人生剧情生成
   ├── ai_server/init_state_generate.js   ← 开局配置 AI
   ├── ai_server/story_generate.js        ← 人生叙事 AI 生成
   └── ai_server/state_generate.js        ← 职业生涯状态 AI 同步

5. UI 层（依赖所有上层模块，DOM 渲染 + 事件绑定）
   ├── ui/mainScreen_panel.js             ← 面板数据逻辑（必须先于 panel_ui）
   ├── ui/mainScreen_panel_ui.js          ← 面板 UI 渲染（必须先于 mainScreen_chat）
   ├── ui/mainScreen_chat.js              ← 聊天 UI + AI 回合编排
   ├── ui/mainScreen.js                   ← 主界面初始化（必须最后加载，调用 DOMContentLoaded）
   └── log/logPanel.js                    ← 调试日志面板（可独立）
```

关键约束：
- `mainScreen_panel.js` 必须先于 `mainScreen_panel_ui.js`
- 两者必须先于 `mainScreen_chat.js`
- `mainScreen.js` 必须最后加载（调用 `DOMContentLoaded` 触发初始化）
- `world_book_entries.js` 必须先于 `world_book.js`

---

## 3. 目录与文件结构

```
psydoctor/
├── index.html                               # 启动页（API 设置 → 人生选择）
├── main.html                                # 主游戏界面
├── css/
│   ├── start_frame.css                      # 启动页样式
│   ├── creation.css                         # 人生选择/创建样式
│   ├── main.css                             # 主游戏界面样式
│   └── logPanel.css                         # 调试日志面板样式（复用）
├── silly_tarven/
│   └── bridge.js                            # OpenAI 兼容 API 桥接层（从 mortal_journey 复用）
└── js/
    ├── character/
    │   └── character_attribute.js           # 属性系统：8+2 维键定义、校验、类型
    ├── data/                                # 静态数据表（纯数据，无业务逻辑）
    │   ├── doctor_level.js                  # 7×3=21 阶段等级基础属性表、临床时数阶梯
    │   ├── theory_state.js                  # 5 大流派 32+ 理论的效果映射、学习阶段、整合规则
    │   ├── philosophy_state.js              # 5 大哲学维度深度层级与属性倍率
    │   ├── creation_config.js               # 6 种教育背景、5 种入行动机、5 类个人特质
    │   ├── client_templates.js              # 10 种来访者案例类型、防御机制、阻抗数据
    │   └── trait_samples.js                 # 个人特质词条池（带 bonus 描述）
    ├── game/                                # 游戏引擎（计算密集，无 DOM 操作）
    │   ├── psychologist_base_runtime.js     # 心理医生属性计算引擎（核心算法）
    │   ├── client_character_sheet.js        # 来访者档案规范化（来访者/NPC/督导师共用）
    │   ├── case_session.js                  # 咨询个案回合引擎（替代战斗引擎）
    │   ├── ethics_dilemma.js                # 伦理困境多选择决策与结果评估
    │   └── countertransference.js           # 反移情累积、检测与职业危机触发
    ├── ai_server/                           # AI 管线（prompt 构建 + 响应解析）
    │   ├── world_generate.js                # 开局人生剧情生成
    │   ├── init_state_generate.js           # 开局配置 AI（学历/理论/初始场景）
    │   ├── story_generate.js                # 人生叙事 AI（日常/咨询/学术/生活事件）
    │   └── state_generate.js                # 状态 AI（来访者/时数/理论/职业同步）
    ├── worldbook/                           # 心理学知识基底与 AI 规则
    │   ├── world_book.js                    # 知识基底引擎（关键词匹配/条目选择）
    │   ├── world_book_entries.js            # 知识基底条目（治疗框架/流派概念/伦理条款）
    │   ├── preset.js                        # AI 预设管理（system prompt 构建/模板变量填充）
    │   ├── preset_content.js                # 预设内容数据（叙事预设/输出格式/规则预设）
    │   ├── state_rules.js                   # 状态 AI 规则模板（来访者/时数/理论/职业）
    │   └── init_state_rules.js              # 开局配置 AI 规则模板（学历/初始来访者）
    ├── ui/                                  # UI 层（DOM 渲染 + 事件绑定）
    │   ├── fateChoiceController.js          # 启动页命运抉择（教育背景/动机/特质选择）
    │   ├── mainScreen.js                    # 主界面入口 init() + 门闩管线 + 对外 API
    │   ├── mainScreen_chat.js               # 聊天 UI + AI 回合编排 + 个案触发
    │   ├── mainScreen_panel.js              # 面板数据逻辑（时数/藏书/来访者/存档/NPC）
    │   └── mainScreen_panel_ui.js           # 面板 UI 渲染（左栏/来访者/工具网格/弹窗）
    └── log/
        └── logPanel.js                      # 调试日志面板（从 mortal_journey 复用）
```

---

## 4. 双页面路由架构

### 4.1 页面跳转机制

与 mortal_journey 完全一致的页面级跳转，通过 sessionStorage 传递启动数据：

```
index.html                               main.html
┌──────────────┐                        ┌──────────────────────┐
│ 1. API 设置  │                        │ 读取                  │
│    写入      │                        │ sessionStorage        │
│ localStorage │                        │ "psydoctor            │
│              │                        │  _bootstrap_v1"       │
│ 2. 人生选择  │                        │                       │
│    教育背景  │─── sessionStorage ──→  │ 恢复 fateChoice      │
│    入行契机  │    (bootstrap)          │ 恢复 PsyDoctorGame   │
│    初始理论  │                        │                       │
│    个人特质  │                        │ 触发门闩管线           │
│    开始人生  │                        │ (新档) / 直接渲染      │
│              │                        │ (读档)                │
│ 3. 读档     │─── localStorage ──────→ │ 从存档槽载入           │
│    读取人生  │    (PSY_SAVE_V1:*)      │                       │
└──────────────┘                        └──────────────────────┘
```

### 4.2 启动页核心流程

1. **API 设置**：写入 `localStorage` 键 `IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1`（复用 bridge.js 的覆盖配置键），bridge.js 优先读取此覆盖配置
2. **人生选择**（阶段式流程，仅 3 步，非 mortal_journey 的复杂选择链）：
   - **Step 1 — 教育背景**：6 选 1（心理学本科/跨专业转行/精神科医生/社工出身/哲学学者/亲历者转型），每个背景预设初始等级、初始理论、初始属性加成
   - **Step 2 — 入行契机**：5 选 1（助人理想/智识好奇/命运推动/创伤转化/导师感召），每个契机提供特定属性加成
   - **Step 3 — 个人特质**：5 选 2（从疗愈者/思想家/沟通者/守护者/开创者 5 大类中各选 1-2 个具体特质），特质提供可成长的属性修饰
3. **初始理论取向**：根据教育背景自动设定，玩家可微调（如心理学本科默认「来访者中心」，可改为「认知治疗」）
4. **开始人生**：
   - 构建 `fateChoice` 对象（含 education、motivation、initialTheory、traits）
   - 写入 sessionStorage 键 `psydoctor_bootstrap_v1`
   - 创建新存档槽（localStorage `PSY_SAVE_V1:{id}`）
   - 跳转 `main.html`

### 4.3 主游戏入口流程

`mainScreen.js` 的 `init()` 是整个主界面的入口（与 mortal_journey 的 `MainScreen.init()` 结构对应）：

```
init()
  ├── 1  绑定 UI 事件（弹窗、等级晋升、来访者详情、伦理困境）
  ├── 2  恢复 Bootstrap：从 sessionStorage 读取 fateChoice + PsyDoctorGame
  ├── 3  ensureGameRuntimeDefaults(G)      → 补全缺失字段、初始化 8+2 属性
  ├── 4  ensureNearbyPeopleArray(G)        → 确保同行/督导师/来访者数组存在
  ├── 5  computePsychologistBase(G)        → 首次属性计算
  ├── 6  applyCountertransferenceCheck(G)  → 检查是否有累积的反移情风险
  ├── 7  runBootstrapAiGateOrSkip()        → 判断是否需要新档门闩
  │      ├── 需要门闩（新档）→ 4 阶段 Bootstrap Gate
  │      └── 不需要（读档）→ runNormalFirstEnterPipeline()
  ├── 8  绑定聊天发送按钮
  ├── 9  绑定聊天行动建议按钮
  ├── 10 绑定手机端面板切换
  ├── 11 启动 4 秒定时自动保存
  └── 12 注册 beforeunload 事件兜底保存
```

---

## 5. AI 管线架构

> **v2.0 更新**（2026-06-26）：原双回合管线（叙事 AI → 状态 AI）已升级为多角色 AI 管线。详见 architecture.md §5。

### 5.1 总体设计：多角色 AI 管线

每次玩家输入触发 **2+N 次** AI 调用（N = 发言角色数，通常 0~3）：

```
玩家输入
    │
    ▼
┌──────────────────────────────────────────────────────┐
│                                                       │
│  ╔══════════════════════════════════════════════════╗  │
│  ║  Phase 1: 世界 AI（World AI）— 1 次调用          ║  │
│  ║  职责：环境叙事 + 氛围描写 + 发言顺序表编排       ║  │
│  ║  输出：流式叙事正文 + <psy_scene_info> 标签       ║  │
│  ║        speechSchedule 决定本回合谁说话            ║  │
│  ╚══════════════════════════╦═══════════════════════╝  │
│                             │                          │
│                             ▼                          │
│  ╔══════════════════════════════════════════════════╗  │
│  ║  Phase 2: 角色发言阶段 — N 次独立调用（N ≥ 0）  ║  │
│  ║                                                  ║  │
│  ║  按 speechSchedule 顺序串行调用：                ║  │
│  ║  ┌→ 角色 AI-1（固定 system prompt, 专属缓存）    ║  │
│  ║  │→ 角色 AI-2（收到前一个角色的发言, 对话感）    ║  │
│  ║  │→ ...                                          ║  │
│  ║  └→ 每个角色独立人格，独立 prefix cache          ║  │
│  ╚══════════════════════════════╦═══════════════════╝  │
│                                 │                      │
│                                 ▼                      │
│  ╔══════════════════════════════════════════════════╗  │
│  ║  Phase 3: 状态 AI（State AI）— 1 次调用          ║  │
│  ║  输入：世界 AI 叙事 + 所有角色发言（拼接）        ║  │
│  ║  输出：结构化标签 → 逐项校验 → 写回 G             ║  │
│  ╚══════════════════════════════════════════════════╝  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**分离原因**：
- **世界 AI** 聚焦场景叙事与氛围，prompt 偏向文学性/心理学世界设定
- **角色 AI** 各自聚焦独立人格表现，各自的 system prompt 固定（命中 prefix cache）
- **状态 AI** 聚焦结构化数据提取，prompt 偏规则/约束/数值化
- 旧「叙事 AI」一人演所有角色的痛点得以解决——来访者、督导师、同行各有独立的 AI 人格
- 旧「咨询师内心活动」不再需要——咨询师就是玩家

### 5.2 世界 AI（world_ai.js）

**入口**：`PsyDoctorWorldAI.buildMessages()` 构建完整 OpenAI messages 数组

**消息结构**（缓存友好，固定在前，变化在后）：
```
messages:
  [0] system — 叙事规则 + 世界设定 + 发言编排规则（~3000 tokens，固定）
  [1..K] 对话历史（只追加，不改写）
  [K+1] user — 玩家输入 + 游戏状态摘要 + 前文上下文

⚠️ system prompt 中**不含**时间戳、随机数、动态模板变量
```

**输出**：
```
玩家可见（流式）：
  环境描写 + 氛围渲染 + 场景推进叙事正文

程序消费：
  <psy_scene_info>
  {
    "sceneType": "therapy_session",
    "speechSchedule": [
      { "id": "client_001", "role": "client", "turn": 1 },
      { "id": "client_001", "role": "client", "turn": 2 },
      { "id": "supv_001",  "role": "supervisor", "turn": 3 }
    ],
    "actionSuggestions": { "aggressive": "...", "neutral": "...", ... }
  }
  </psy_scene_info>
```

speechSchedule 决定了角色发言阶段调用哪些角色 AI、按什么顺序。

### 5.3 角色 AI（role_ai.js）

每个角色一次独立 API 调用，串行执行，后一个角色收到前一个的发言原文。

**消息结构**（每个角色 system prompt 固定 → 独立命中 prefix cache）：
```
messages:
  [0] system — 角色人格描述（~800 tokens，固定，由 speechProfile 构建）
      来访者：姓名 + 案例类型 + 依恋模式 + 防御风格 + 说话习惯
      督导师：姓名 + 理论取向 + 教学风格
      同行：姓名 + 关系类型 + 个性特征
  [1] user — 场景上下文 + 前文摘要 + [前一发言者原文]

⚠️ 同一角色每次调用的 system prompt 完全相同 → 始终命中专属缓存
⚠️ 相同 (caseType, attachment, defense) 组合的角色共享相同 system prompt → 共享缓存
```

**调用编排**（role_ai.js 中的串行循环）：
```
for each turn in speechSchedule:
  result = await callRoleAI(roleProfiles[turn.id], {
    sceneContext: worldAiNarrative,
    previousSpeech: previousTurn?.output,  // 串行：后一个角色知道前一个说了什么
  })
  appendToChat(result.text)
  previousTurn = { id: turn.id, output: result.text }
```

### 5.4 状态 AI（state_generate.js）

保持与旧架构基本一致，输入来源变化：

```
旧：叙事 AI 的完整输出
新：世界 AI 叙事正文 + 所有角色 AI 的发言正文（按 speechSchedule 顺序拼接）
```

**核心逻辑不变**：XML 标签提取 → JSON 解析 → 逐项校验 → 写回 G。

**新增标签**（配合惩罚机制）：

| 标签 | 用途 |
|------|------|
| `<psy_scene_info>` | 解析 sceneType + speechSchedule |
| `<psy_treatment_error>` | 评估治疗失误 |
| `<psy_reputation_event>` | 声誉变化事件 |
| `<psy_speech_habits_update>` | 更新角色说话习惯 |

### 5.5 角色数据模型（speechProfile）

每个可发言 NPC（`nearbyPeople` + `currentClients`）新增 `speechProfile` 字段：

```javascript
speechProfile: {
  roleType: "client" | "supervisor" | "colleague",
  personalityParams: {
    // 来访者专属
    caseType: "existential_crisis",
    attachmentStyle: "secure",
    defenseStyle: "intellectualization",
    // 督导师专属
    theoryOrientation: "classical_psychoanalysis",
    teachingStyle: "strict_profound",
  },
  // 演化字段（状态 AI 更新）
  speechHabits: "倾向于用哲学性语言，说话时经常停顿",
  attitudeToPlayer: "信任但有微妙的距离感",
}
```

### 5.6 前缀缓存设计约束

所有 AI 调用的消息结构必须遵循**固定前置、变化后置**原则，确保 DeepSeek 硬盘缓存命中。核心机制：系统自动检测请求前缀与历史请求的重合部分，重合部分从缓存读取（价格降至 1/10）。

**缓存三层策略**：

| 层 | 原理 | 实现 |
|----|------|------|
| 请求前缀缓存 | DeepSeek 自动匹配相同前缀，读取 NVMe 硬盘缓存 | 无需代码 |
| 消息结构缓存 | 每个 AI 的固定内容放在 system prompt 位置 | messages[0] = system |
| 内容模板缓存 | 相同参数的角色共享 system prompt | buildRoleSystemPrompt 确定序列化 |

**黄金规则**：
```
固定部分（参与缓存）：
  messages[0]: { role: "system", content: "固定的 system prompt" }
变化部分（不参与缓存）：
  messages[1..N-1]: 对话历史（只追加，不改写）
  messages[N]: { role: "user", content: "本次用户消息" }
```

**各 AI 的消息结构**：

| AI | System Prompt（固定） | User Message（变化） | 缓存命中率（稳态） |
|----|----------------------|---------------------|-------------------|
| 世界 AI | 叙事规则 + 发言编排规则（~3000 tokens） | 玩家输入 + 游戏状态 + 前文 | 50-65% |
| 角色 AI | 该角色人格描述（~800 tokens） | 场景 + 前文 + 前一发言 | 40-50%（同角色 100%） |
| 状态 AI | 状态规则模板（~2000 tokens） | 完整叙事 + 游戏快照 | 45-55% |

**绝对禁忌**：
- system prompt 中插入 `{{worldTimeString}}`、`Math.random()`、trace ID
- 改写已有的对话历史消息
- 非确定序列化的 JSON（`JSON.stringify` 不传 `sort_keys`）
- 同一角色的不同调用使用不同的 system prompt

**角色 AI 缓存优化**：
- 同角色每次调用的 system prompt 完全固定 → 始终命中专属缓存
- 相同 `(caseType, attachmentStyle, defenseStyle)` 组合 → 完全相同 prompt → 共享缓存
- 同角色同回合第二次发言（speechSchedule 同一 id 出现 2 次）→ 延迟明显低于第一次

**监控**：在 `bridge.js` 中记录每次调用的 `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`，日志频道 `[psy:cache]`。

**预期效果**：稳态下输入成本降低 35-50%，角色 AI system prompt 命中率 100%。

### 5.7 新档门闩：4 阶段 Bootstrap Gate

（保持与旧架构一致的结构，Phase 1 开局剧情 AI 保持不变，使用 `world_generate.js`）
（Phase 2/3 与旧架构一致，后续可迁移到世界 AI + 角色 AI 管线）

---

## 6. 标签协议：AI ↔ 引擎通信

### 6.1 协议设计原则

继承 mortal_journey 的 XML 标签协议设计：

- AI 不直接修改游戏状态，通过 `<psy_*>` 标签输出结构化指令
- JavaScript 正则提取 + JSON.parse 解析后，逐项校验并写入 `PsyDoctorGame`
- 叙事正文直接展示，标签内容程序消费（不可见）
- 部分标签失败不影响其他标签（渐进式解析，容错设计）

```
AI 输出文本
    │
    ├── 叙事正文（直接展示给玩家）
    │
    └── <psy_*> 标签（程序解析，不可见）
          │
          ▼
applyStateTurnFromAssistantText()
          │
          ├── 正则提取标签对内容
          ├── JSON.parse() 解析
          ├── 逐项校验字段类型与值域
          ├── 写入 PsyDoctorGame
          └── 刷新 UI 面板
```

### 6.2 标签全集（17 种）

**叙事 AI 输出标签**（嵌入叙事文本，6 种）：

| 标签 | 解析位置 | 是否必须 | 说明 |
|---|---|---|---|
| `<psy_story_body>` | `story_generate.js` | ✅ 必须 | 提取纯净叙事正文，去除标签噪声 |
| `<psy_theory_insight>` | `story_generate.js` | 可选 | 理论洞见：`{theoryName, stageGain, content}` |
| `<psy_philosophy_reflection>` | `story_generate.js` | 可选 | 哲学反思：`{dimension, insight, depthGain}` |
| `<psy_action_suggestions>` | `mainScreen.js` | ✅ 必须 | 四级行动建议按钮文本 |
| `<psy_case_session_trigger>` | `mainScreen_chat.js` | 可选 | 个案触发：`{clientId, caseType, initialAssessment}` |
| `<psy_ethical_dilemma>` | `mainScreen_chat.js` | 可选 | 伦理困境触发：`{dilemmaType, scene, options[]}` |

**状态 AI 输出标签**（独立于叙事外，7 种）：

| 标签 | 解析位置 | 说明 |
|---|---|---|
| `<psy_world_state>` | `state_generate.js` | 世界时间/地点/工作场景/年龄写回 |
| `<psy_therapist_state>` | `state_generate.js` | 咨询师疲劳/倦怠/自觉性数值写回 |
| `<psy_client_state>` | `state_generate.js` | 来访者症状变化/治疗联盟/治疗阶段写回 |
| `<psy_clinical_gain>` | `state_generate.js` | 临床时数/督导时数/理论进度/洞察获得写回 |
| `<psy_supervision_notes>` | `state_generate.js` | 督导反馈/盲点/成长方向记录 |
| `<psy_career_event>` | `state_generate.js` | 职业生涯事件触发器（资格考试/论文/转职） |
| `<psy_countertransference>` | `state_generate.js` | 反移情类型、变化量、风险等级写回 |
| `<psy_nearby_people>` | `state_generate.js` | 周围人物完整列表替换 |
| `<psy_inventory_ops>` | `state_generate.js` | 藏书/工具/测评工具增删 |
| `<psy_theory_milestone>` | `state_generate.js` | 理论学习阶段里程碑 |

### 6.3 标签解析策略

`state_generate.js` 中的 `applyStateTurnFromAssistantText()` 是状态应用的核心，采用多级容错解析：

```
applyStateTurnFromAssistantText(assistantText, G)
  ├── Step 1: 正则提取 — 遍历所有已知标签名，用 /<psy_xxx>([\s\S]*?)<\/psy_xxx>/g 提取
  ├── Step 2: JSON 解析 — 对每个提取的内容尝试 JSON.parse()
  │     ├── 成功 → 进入 Step 3 校验
  │     └── 失败 → 尝试修复（trim 空白、补全括号、移除注释），再次 parse
  │           └── 仍失败 → 记录日志、跳过此标签，继续处理其他标签
  ├── Step 3: 字段校验
  │     ├── 类型校验（string/number/array/object 与预期是否一致）
  │     ├── 值域校验（临床时数 ≥0、治疗联盟 [0,100]、症状变化 [-15,+15]）
  │     └── 必填字段校验（缺少关键字段则拒绝该标签）
  ├── Step 4: 写回 PsyDoctorGame
  │     ├── 直接字段赋值（worldTimeString、clinicalHours 等）
  │     ├── 合并写回（clientState 合并到已有来访者档案）
  │     ├── 全量替换（nearbyPeople 完整替换 NPC 列表）
  │     └── 增量操作（inventoryOps 逐条 add/remove）
  └── Step 5: 后处理触发器
        ├── 反移情风险检查（riskLevel === "high" → 触发职业危机警告）
        ├── 职业生涯事件检查（有 deadline → 设置提醒倒计时）
        └── 理论里程碑检查（阶段提升 → 解锁理论整合选项）
```

### 6.4 反移情标签详细设计

反移情标签 `<psy_countertransference>` 是 psydoctor 特有的核心标签：

```json
{
  "type": "overIdentification",       // 反移情类型
  "change": 5,                        // 变化量（正=积累，负=在督导/体验中化解）
  "triggerSource": "client_zhang",    // 触发源（来访者ID / 个人议题 / 职业压力）
  "riskLevel": "medium",              // 当前风险等级：low / medium / high / critical
  "manifestation": "你发现自己最近总是提前10分钟等待张某的到来…"
}
```

六种反移情类型及其属性关联：

| type | 中文 | 关联属性 | 典型触发场景 |
|---|---|---|---|
| `overIdentification` | 过度认同 | 自觉性↓ 共情力↑(虚假) | 来访者经历与咨询师个人经历高度相似 |
| `defensiveDistancing` | 防御性疏离 | 共情力↓ 沟通力↓ | 来访者的痛苦反复触及咨询师的未处理创伤 |
| `saviorComplex` | 救世主情结 | 论断力↓ 技术力↓ | 来访者进展缓慢，咨询师感到焦虑和无能 |
| `professionalArrogance` | 专业傲慢 | 自觉性↓ 洞察力↓ | 咨询师过度相信自己的理论框架与判断 |
| `burnoutNumbness` | 倦怠麻木 | 共情力↓ 心理韧↓ | 长期高强度接案，缺乏自我关照 |
| `ethicalBlurring` | 伦理模糊 | 论断力↓ 自觉性↓ | 面临边界困境，判断力下降 |

**反移情累积与化解机制**：

```
反移情累积
  ├── 触发：叙事 AI 判定（来访者类型与咨询师个人议题共鸣）
  ├── 累积量：由状态 AI 的 change 字段写入，单次 +1~+8
  ├── 化解途径：
  │     ├── 接受督导 → 减少 3-5 点（需消耗督导时数）
  │     ├── 个人体验 → 减少 5-8 点（需消耗个人体验时数）
  │     └── 休假/自我关照 → 减少 1-2 点（时间推移）
  └── 风险阈值：
        ├── riskLevel "low"（0-15）：正常范围，无影响
        ├── riskLevel "medium"（16-30）：属性计算时自觉性 -10%，共情力 -5%
        ├── riskLevel "high"（31-50）：触发职业危机警告，属性计算时自觉性 -25%，论断力 -15%
        └── riskLevel "critical"（>50）：强制暂停接案，需完成个人体验才可恢复
```

---

## 7. 状态管理架构

### 7.1 全局状态树：PsyDoctorGame

`window.PsyDoctorGame` 是唯一的运行时状态容器，结构如下：

```javascript
PsyDoctorGame = {
  // === 命运抉择快照（来自启动页，只读参考） ===
  fateChoice: {
    education: "心理学本科",              // 教育背景
    motivation: "助人理想",              // 入行契机
    initialTheory: "来访者中心",          // 初始理论取向
    traits: [                            // 个人特质
      { name: "共情天赋", category: "疗愈者", desc: "...", bonus: {...} },
      { name: "语言精准", category: "沟通者", desc: "...", bonus: {...} },
    ],
    playerName: "...",
    gender: "...",
  },

  // === 等级与属性 ===
  doctorLevel: { major: "心理学徒", minor: "初窥" },
  levelIndex: 0,                         // 等级索引 [0,20]（7×3-1）
  psychologistBase: {                    // 8+2 维计算后最终属性
    empathy: 10, insight: 5, knowledge: 10,
    technique: 3, judgment: 3, awareness: 5,
    communication: 8, resilience: 5,
    humanity: 10, philosophy: 5,
  },
  currentFatigue: 0,                     // 当前疲劳度 [0,100]
  burnoutLevel: 0,                       // 职业倦怠等级 [0,10]

  // === 成长积累（核心"修为"） ===
  clinicalHours: 0,                      // 临床个案时数
  supervisionHours: 0,                   // 督导时数
  personalTherapyHours: 0,               // 个人体验时数
  researchPoints: 0,                     // 研究积分

  // === 理论学习状态 ===
  theoryMastery: {                       // 各理论掌握程度
    "来访者中心治疗": { stage: 2, hours: 45 },   // stage: 1通读 2理解 3练习 4掌握 5整合 6创新
    "经典精神分析": { stage: 1, hours: 8 },
    "认知治疗": { stage: 0, hours: 0 },
    // ... 32+ 条目
  },
  activeTheoryOrientation: "来访者中心",  // 当前主要理论取向（影响 AI 叙事视角）
  philosophyDepth: {                     // 各哲学维度深度 [0,10]
    "现象学": 1,
    "诠释学": 0,
    "存在哲学": 2,
    "东方心学": 0,
    "后现代批判": 0,
  },

  // === 当前执业场景 ===
  currentWorkplace: "大学心理咨询中心",
  currentLocation: "北京",
  worldTimeString: "2024年 09月 01日 08:00",
  worldTimeStack: [],                    // 时间历史栈（用于单调性校验）
  age: 22,

  // === 来访者与职业关系 ===
  currentClients: [                      // 当前在案的来访者（最多同时 8 人）
    {
      id: "client_001",
      displayName: "来访者张某",
      age: 20,
      gender: "男",
      chiefComplaint: "找不到人生方向，存在焦虑",
      caseType: "存在危机型",
      sessionCount: 0,
      symptomLevel: 75,                  // 症状严重度 [0,100]，0=完全康复
      therapeuticAlliance: 50,           // 治疗联盟 [0,100]
      treatmentPhase: "initial",         // initial/middle/termination/followup
      defenseStatus: "理智化",           // 当前主要防御机制
      clientSheet: { /* 完整来访者档案 */ },
    },
  ],
  completedCases: [...],                 // 已结案的来访者摘要
  nearbyPeople: [                        // 周围人物（来访者/督导师/同行）
    {
      id: "person_001",
      displayName: "李督导",
      role: "supervisor",               // supervisor / colleague / client / mentor
      theoryOrientation: "经典精神分析",
      characterSheet: { /* 人物档案 */ },
    },
  ],

  // === 反移情状态 ===
  countertransference: {
    overIdentification: 0,              // 过度认同
    defensiveDistancing: 0,             // 防御性疏离
    saviorComplex: 0,                   // 救世主情结
    professionalArrogance: 0,           // 专业傲慢
    burnoutNumbness: 0,                 // 倦怠麻木
    ethicalBlurring: 0,                 // 伦理模糊
    overallRiskLevel: "low",            // 综合风险等级
  },

  // === 职业生涯 ===
  careerHistory: [                       // 职业经历记录
    { time: "2024-09", event: "入学心理学本科", type: "education" },
  ],
  publications: [...],                   // 发表成果
  reputation: 0,                         // 行业声誉 [0,1000]
  activeCareerEvents: [],                // 当前活跃的职业生涯事件

  // === 物品 ===
  bookShelf: [                           // 藏书（最多 30 本）
    { name: "《成为一个人》", author: "Rogers", theory: "来访者中心",
      effectDesc: "共情力+5，无条件接纳理解+20", effectData: {...} },
  ],
  assessmentTools: [                     // 测评工具
    { name: "SCL-90", type: "symptom", acquired: true },
  ],
  therapyTools: [                        // 治疗工具（最多 10 件）
    { name: "沙盘与沙具", type: "expressive", effect: "促进非语言表达" },
  ],
  consultationRoomItems: [               // 咨询室布置物品
    { name: "舒适的沙发", effect: "提升来访者安全感 +5" },
  ],

  // === 对话与叙事 ===
  chatHistory: [                         // 人生叙事对话历史（OpenAI messages 格式子集）
    { role: "user", content: "..." },
    { role: "assistant", content: "..." },
  ],
  chatActionSuggestions: {               // 当前行动建议
    aggressive: "主动约来访者进行一次深度会谈",
    neutral: "整理个案记录，准备督导材料",
    cautious: "阅读来访者中心治疗的相关文献",
    veryCautious: "给自己放半天假，整理思绪",
  },

  // === 个案会话状态 ===
  pendingCaseSession: null,              // 待处理的个案会话触发
  activeCaseSession: null,               // 正在进行的个案会话状态
  caseSessionHistory: [],                // 历史个案会话记录

  // === 伦理困境 ===
  activeEthicalDilemma: null,            // 当前面临的伦理困境

  // === 门闩状态 ===
  psyInitStateAiApplied: true,           // 开局配置 AI 是否已执行
};
```

### 7.2 状态变更流

```
用户输入 / AI 响应 / 个案结算 / 伦理决策
        │
        ▼
  PsyMainScreen API（mainScreen.js 对外暴露的方法）
        │
        ├── setClinicalHours(n)
        ├── setTheoryProgress(theoryName, newStage, hours)
        ├── addBookToShelf(book)
        ├── removeBookFromShelf(bookIndex)
        ├── setClientState(clientId, updates)
        ├── setNearbyPeople(list)
        ├── setCurrentLocation(label, workplace)
        ├── setCountertransference(type, change)
        ├── resolveEthicalDilemma(choiceIndex)
        │
        ▼
  PsyMainScreenPanel（数据逻辑层，mainScreen_panel.js）
        │
        ├── 修改 PsyDoctorGame 字段
        ├── persistBootstrapSnapshot()  → 写入 sessionStorage + localStorage 镜像
        ├── computePsychologistBase()   → 重新计算 8+2 属性
        └── render*Panel()             → 刷新对应 DOM
```

### 7.3 PsyDoctorGame 与 morta_journey Game 的关键差异

| 维度 | MortalJourneyGame | PsyDoctorGame |
|---|---|---|
| 属性系统 | 8 维（HP/MP/物攻/物防/法攻/法防/脚力/神识）+ 魅力/气运 | 8+2 维（共情/洞察/理论知/技术力/论断力/自觉性/沟通力/心理韧 + 人文素养/哲学思辨） |
| 修为/时数 | xiuwei（累计数值）+ cultivationProgress（百分比） | clinicalHours + supervisionHours + personalTherapyHours（三个独立维度） |
| 物品系统 | 储物袋（装备/功法/丹药/灵石），带品阶 | 藏书/测评工具/治疗工具/咨询室物品，不带品阶但带理论归属 |
| 战斗/个案 | pendingBattle + 战斗状态字段 | pendingCaseSession + activeCaseSession + countertransference |
| 世界书 | 修仙世界设定 | 心理学专业知识基底 |
| NPC | 修仙 NPC（道友/敌人/路人），带境界 | 来访者/督导师/同行/"精神对话"，带理论取向 |
| 特殊系统 | 灵石炼化 + 突破概率 | 反移情追踪 + 伦理困境 + 理论整合 |

---

## 8. 心理医生属性计算引擎

### 8.1 计算管线

`PsychologistBaseRuntime.computePsychologistBase()` 是整个角色系统的核心算法，借鉴 mortal_journey 的 7 步管线，改造为 6 步心理学版本：

```
等级基础属性表 (DoctorLevelState.getBaseStats)
        │
        ▼
  ┌──────────────────────────┐
  │ Step 1: 等级基础值读取     │
  │                          │
  │ 从 DOCTOR_LEVEL_TABLE    │
  │ 按 levelIndex[0,20] 读取 │
  │ 8+2 维基础属性           │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ Step 2: 平面加成合并      │
  │                          │
  │ + 等级基础值              │
  │ + 教育背景 bonus（固定）   │
  │ + 入行契机 bonus（固定）   │
  │ + 个人特质 bonus（可成长） │
  │ + 理论学习深度 bonus      │
  │   (当前取向理论掌握阶段    │
  │    × 理论属性加成系数)    │
  │ + 哲学思辨 bonus          │
  │   (各哲学维度深度         │
  │    × 维度属性映射系数)    │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ Step 3: 反移情惩罚         │
  │                          │
  │ 根据 countertransference  │
  │ 综合风险等级，对特定属性   │
  │ 施加百分比惩罚：          │
  │ low → 无惩罚             │
  │ medium → 自觉性-10%,     │
  │          共情力-5%        │
  │ high → 自觉性-25%,      │
  │        论断力-15%,       │
  │        共情力-10%        │
  │ critical → 全属性-30%   │
  │          强制暂停接案     │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ Step 4: 哲学维度乘法加成  │
  │                          │
  │ 类比灵根乘法，各哲学维度  │
  │ 深度 × 等级倍率作用于    │
  │ 对应属性：               │
  │ 现象学 → insight,        │
  │          awareness       │
  │ 诠释学 → knowledge,      │
  │          judgment        │
  │ 存在哲学 → humanity,     │
  │            resilience    │
  │ 东方心学 → awareness,    │
  │            philosophy    │
  │ 后现代批判 → insight,    │
  │              judgment    │
  │                          │
  │ 等级倍率：               │
  │ 学徒: ×1.02              │
  │ 实习: ×1.05              │
  │ 初级: ×1.08              │
  │ 资深: ×1.12              │
  │ 专家: ×1.18              │
  │ 大师: ×1.25              │
  │ 心灵哲学家: ×1.50        │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ Step 5: 倦怠惩罚          │
  │                          │
  │ 疲劳度 currentFatigue     │
  │ [0,30] → 无影响          │
  │ [31,60] → 共情力-5%,     │
  │           沟通力-5%       │
  │ [61,85] → 共情力-15%,   │
  │           洞察力-10%,    │
  │           心理韧-10%     │
  │ [86,100] → 全属性-20%   │
  │            需休假恢复     │
  │                          │
  │ 倦怠等级 burnoutLevel     │
  │ 每级全属性额外-2%         │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ Step 6: 收尾              │
  │                          │
  │ 8+2 维取整 (Math.round)  │
  │ 人文素养钳制 [0, 100]    │
  │ 哲学思辨钳制 [0, 100]    │
  │ 其他 8 维钳制 [1, 999]   │
  └──────────────────────────┘
```

### 8.2 等级基础属性表（doctor_level.js）

完整 7×3=21 阶段属性表（基于需求文档 3.3 节的数值）：

```javascript
// DOCTOR_LEVEL_TABLE[levelIndex] → { empathy, insight, knowledge, technique,
//                                     judgment, awareness, communication,
//                                     resilience, humanity, philosophy,
//                                     clinicalHoursRequired }
var DOCTOR_LEVEL_TABLE = [
  // levelIndex 0: 心理学徒·初窥
  { empathy:10, insight:5, knowledge:10, technique:3, judgment:3,
    awareness:5, communication:8, resilience:5,
    humanity:10, philosophy:5, clinicalHoursRequired: 0 },
  // levelIndex 1: 心理学徒·践行
  { empathy:15, insight:8, knowledge:18, technique:5, judgment:5,
    awareness:8, communication:12, resilience:8,
    humanity:12, philosophy:8, clinicalHoursRequired: 50 },
  // levelIndex 2: 心理学徒·贯通
  { empathy:20, insight:12, knowledge:28, technique:8, judgment:8,
    awareness:12, communication:16, resilience:10,
    humanity:15, philosophy:10, clinicalHoursRequired: 100 },
  // ... 共 21 行，最高 levelIndex 20: 心灵哲学家·贯通
  { empathy:1200, insight:850, knowledge:900, technique:750, judgment:750,
    awareness:850, communication:800, resilience:850,
    humanity:850, philosophy:780, clinicalHoursRequired: 100000 },
];
```

### 8.3 教育背景/动机/特质 bonus 映射（creation_config.js）

```javascript
var EDUCATION_BONUS_MAP = {
  "心理学本科":    { knowledge: 3, technique: 1 },
  "跨专业转行":    { resilience: 3, insight: 2 },     // 生活经验丰富
  "精神科医生":    { knowledge: 5, judgment: 3 },     // 医学背景
  "社工出身":      { empathy: 3, communication: 2 },  // 实践经验
  "哲学学者":      { philosophy: 5, humanity: 3 },    // 哲学思辨深厚
  "亲历者转型":    { empathy: 4, awareness: 3 },      // 深度共情
};

var MOTIVATION_BONUS_MAP = {
  "助人理想":      { empathy: 5, awareness: 3 },
  "智识好奇":      { knowledge: 5, insight: 3 },
  "命运推动":      { humanity: 3, philosophy: 3 },
  "创伤转化":      { awareness: 5, resilience: 3 },
  "导师感召":      { communication: 5, judgment: 3 },
};
```

### 8.4 理论学习深度 bonus

当前主要理论取向的掌握阶段提供属性加成：

```
理论属性加成 = 该理论定义的属性贡献 × 阶段系数

阶段系数：
  通读(stage 1) → ×0.2
  理解(stage 2) → ×0.4
  练习(stage 3) → ×0.6
  掌握(stage 4) → ×0.8
  整合(stage 5) → ×1.0
  创新(stage 6) → ×1.5
```

例如：「来访者中心治疗」定义属性贡献为 `{empathy: 15, communication: 10, awareness: 8}`
- 掌握阶段 → empathy +12, communication +8, awareness +6.4

多个理论同时提供加成（不只是当前取向），但非取向理论的阶段系数减半。

### 8.5 哲学深度维度属性映射

与 mortal_journey 灵根五行→属性映射完全类比：

| 哲学维度 | 主属性1 | 主属性2 | 等级倍率 |
|---------|--------|--------|---------|
| 现象学 | insight × (1 + depth×ratio) | awareness × (1 + depth×ratio) | 学徒×0.02 → 心灵哲学家×0.50 |
| 诠释学 | knowledge × (1 + depth×ratio) | judgment × (1 + depth×ratio) | 同上 |
| 存在哲学 | humanity × (1 + depth×ratio) | resilience × (1 + depth×ratio) | 同上 |
| 东方心学 | awareness × (1 + depth×ratio) | philosophy × (1 + depth×ratio) | 同上 |
| 后现代批判 | insight × (1 + depth×ratio) | judgment × (1 + depth×ratio) | 同上 |

其中 `depth` 为各维度深度 [0,10]，`ratio` 为当前等级对应的哲学倍率。

### 8.6 来访者/NPC 属性计算

来访者和督导师/同行 NPC 共用同一套计算逻辑（`PsychologistBaseRuntime.computePsychologistBaseFromCharacterSheet()`），与 mortal_journey 中 NPC 使用 `computePlayerBaseFromCharacterSheet()` 的设计一致：

```
来访者 characterSheet { caseType, symptomLevel, defenseProfile, ... }
        │
        ▼
  根据 caseType 从 ClientTemplates 读取基础属性
        │
        ▼
  computeCaseDifficulty()  ← 计算来访者的"难度"（对应敌人强度）
        │
        ▼
  写回 characterSheet.difficulty / defenseStrength / therapeuticResistance
```

督导师和同行 NPC 则使用与主角完全相同的 `computePsychologistBase()`，传入其 doctorLevel + theoryMastery 计算。

---

## 9. 咨询个案引擎（Case Session Engine）

### 9.1 设计概述

个案引擎是战斗引擎的心理学对应物。与战斗系统不同，咨询个案的核心不是「打败」来访者，而是「陪伴」来访者度过心理困扰——这在架构上体现为**治疗联盟（Therapeutic Alliance）**作为核心状态变量，而非 HP。

```
战斗引擎（mortal_journey）                个案引擎（psydoctor）
─────────────────────────              ──────────────────────────
回合制战斗（攻击/防御）     ──→          回合制咨询（干预/回应）
HP / MP                    ──→          治疗联盟 / 症状严重度
物攻/法攻 vs 物防/法防      ──→          干预力 vs 防御强度/阻抗
功法选择策略               ──→          干预技术选择策略
击杀判定                   ──→          症状缓解判定 / 结案判定
战利品掉落                 ──→          临床时数 + 洞察获得
战后自动剧情               ──→          咨询后督导反思
```

### 9.2 个案会话流程

`CaseSessionEngine.startCaseSession(payload)` 是个案入口：

```
startCaseSession(payload)
  ├── 1  构建来访者档案
  │       ├── 从 payload.clientId 匹配已有来访者
  │       │   或从 payload.newClient 创建新来访者档案
  │       ├── 应用来访者案例类型模板（ClientTemplates）
  │       └── 计算来访者难度属性
  │             ├── defenseProfile（防御强度）：[0, 100]
  │             ├── therapeuticResistance（阻抗）：[0, 100]
  │             ├── insightCapacity（洞察潜力）：[0, 100]
  │             └── attachmentStyle（依恋模式）：secure/anxious/avoidant/disorganized
  │
  ├── 2  确定咨询师当前能力
  │       ├── 读取 PsyDoctorGame.psychologistBase (8+2)
  │       ├── 读取当前理论取向与掌握阶段
  │       └── 计算各干预技术的能力值
  │             ├── 共情回应 = empathy × (1 + 当前取向阶段系数)
  │             ├── 诠释干预 = insight × (1 + 当前取向阶段系数)
  │             ├── 行为技术 = technique × (1 + 理论匹配度)
  │             ├── 体验技术 = awareness × (1 + 哲学深度系数)
  │             ├── 系统干预 = communication × (1 + 当前取向阶段系数)
  │             └── 沉默在场 = humanity × (1 + awareness/100)
  │
  ├── 3  个案主循环 runCaseSession()（最多 20 回合，对应约 50 分钟咨询）
  │       for each 回合:
  │         ├── 3.1 AI 生成来访者当前状态描述（基于症状/防御/联盟变化）
  │         ├── 3.2 玩家选择干预技术（6 选 1）
  │         │       共情回应 / 诠释干预 / 行为技术 /
  │         │       体验技术 / 系统干预 / 沉默在场
  │         ├── 3.3 引擎计算干预效果
  │         │       effect = computeInterventionEffect(technique, client, G)
  │         ├── 3.4 AI 生成来访者回应（开放/阻抗/宣泄/转化/退行）
  │         ├── 3.5 更新会话状态
  │         │       ├── 治疗联盟变化 (allianceChange)
  │         │       ├── 症状改善程度 (symptomReduction)
  │         │       ├── 洞察深度变化 (insightGain)
  │         │       ├── 移情/反移情浮现
  │         │       └── 会话回合计数器 +1
  │         └── 3.6 检查会话终止条件
  │               ├── 症状严重度降至 0 → 结案判定
  │               ├── 治疗联盟降至 0 → 来访者脱落
  │               ├── 达到最大回合数 → 正常结束
  │               └── 触发性事件（危机/突破）→ 特殊分支
  │
  ├── 4  会话结算
  │       ├── computeSessionOutcome()
  │       │     ├── 症状改善率 = (初始症状 - 当前症状) / 初始症状
  │       │     ├── 联盟维持率 = 最终联盟 / 初始联盟
  │       │     ├── 综合评分 = 症状改善率×0.5 + 联盟维持率×0.3 + 洞察获得/100×0.2
  │       │     └── 评级：S(>90%) A(>70%) B(>50%) C(>30%) D(else)
  │       ├── 临床时数获得 = 1 + (综合评分 > 70% ? 1 : 0)
  │       ├── 反移情检查：根据来访者类型与咨询师个人议题相似度
  │       └── applySessionResultToGame() → 更新 PsyDoctorGame
  │
  └── 5  渲染会话记录到聊天区
          ├── 来访者话语（左对齐）
          ├── 咨询师干预与内心活动（右对齐/灰色斜体）
          └── 回合效果摘要（图标化显示）
```

### 9.3 干预效果公式

```
干预效果 = 技术能力值 × 治疗联盟系数 × 时机恰当度 - 来访者防御强度 × 阻抗系数 + 随机因素(±10%)

其中：
  技术能力值 = 根据所选干预技术类型，读取咨询师对应属性加权值
  治疗联盟系数 = therapeuticAlliance / 100
  时机恰当度 = 1.0（默认）→ AI 根据叙事上下文判定（由状态 AI 调整 ±20%）
  来访者防御强度 = defenseProfile 的当前值
  阻抗系数 = therapeuticResistance / 100
```

各干预技术的能力值计算公式：

| 干预技术 | 能力值公式 | 对防御的影响 |
|---------|----------|------------|
| 共情回应 | empathy × 0.8 + communication × 0.2 | 降低防御 5×effect |
| 诠释干预 | insight × 0.7 + knowledge × 0.3 | 可能触发阻抗 +5（若时机不当） |
| 行为技术 | technique × 0.7 + judgment × 0.3 | 降低防御 3×effect |
| 体验技术 | awareness × 0.6 + empathy × 0.4 | 降低防御 2×effect，自身情感波动 |
| 系统干预 | communication × 0.6 + insight × 0.4 | 降低防御 4×effect（关系模式重构） |
| 沉默在场 | humanity × 0.5 + awareness × 0.5 | 不改变防御，增加联盟 +3~5 |

### 9.4 个案触发来源

个案可由两个来源触发（类比战斗的双来源触发）：

- **叙事 AI**：在人生叙事中输出 `<psy_case_session_trigger>` 标签（来访者预约/主动安排咨询）
- **状态 AI**：在状态同步中输出 `<psy_case_session_trigger>` 标签（突发事件/转介到来/危机干预）

`triggerKind` 区分：
- `"scheduled"` — 常规预约咨询
- `"emergency"` — 危机干预（来访者有自伤风险）
- `"intake"` — 新来访者首次接案
- `"followup"` — 结案后的追踪回访

### 9.5 个案后自动接续

个案会话结束后，`PSY_AUTO_STORY_AFTER_SESSION` 控制是否自动发起新一轮 AI 回合：

```
psy:session-finished 事件
        │
        ▼
  构建个案后上下文（会话记录 + 效果评分 + 督导建议）
        │
        ▼
  自动调用 PsyMainScreenChat.handleChatSend() → 叙事 AI → 状态 AI
```

用户消息自动填充：
> 以上为程序给出的本节咨询会话结算与来访者状态。请据此直接写下衔接叙事：咨询师在咨询后的内心活动、来访者离开后的氛围、下次咨询的安排；文末照常输出个案标签、理论洞见与四级行动建议。

---

## 10. 理论学习与整合系统

### 10.1 学习阶段机制

每种理论包含 6 个学习阶段，阶段提升需要满足**学习时数 + 前置条件**：

```
理论学习状态机：
  stage 0: 未接触
    │ 获得该理论相关书籍/参加入门课程
    ▼
  stage 1: 通读（需 10h）
    │ 阅读核心文献 + 基础理解
    ▼
  stage 2: 理解（需 30h，累计 40h）
    │ 深入理解核心机制 + 案例分析
    ▼
  stage 3: 练习（需 60h，累计 100h）
    │ 在督导下运用理论进行个案概念化
    ▼
  stage 4: 掌握（需 120h，累计 220h）
    │ 灵活运用处理复杂个案
    ▼
  stage 5: 整合（需 240h，累计 460h）
    │ 与其他理论整合，形成个人风格
    ▼
  stage 6: 创新（需 500h，累计 960h）
    │ 对该理论做出原创性贡献（著书/新疗法）
```

理论学习时数由状态 AI 根据叙事内容写入 `<psy_clinical_gain>` 的 `theoryProgress` 字段。

### 10.2 理论整合机制

理论整合是心理医生成长记的特有系统（无 mortal_journey 对应物）。当两个不同理论都达到 `stage ≥ 4（掌握）`时，可能解锁整合选项：

**预设整合路线表（theory_state.js）**：

| 理论A（≥掌握） | 理论B（≥掌握） | 整合结果 | 特殊效果 |
|--------------|--------------|---------|---------|
| 认知治疗 | 正念减压 | 正念认知治疗(MBCT) | technique +15%, insight +10% |
| 经典精神分析 | 依恋理论 | 心理动力学治疗 | insight +20%, empathy +10% |
| 存在主义治疗 | 道家智慧(东方心学≥5) | 东方存在治疗 | humanity +25%, philosophy +15% |
| 结构式家庭治疗 | 叙事治疗 | 家庭叙事治疗 | communication +20%, insight +15% |
| 情绪聚焦治疗 | 依恋理论 | 情感聚焦夫妻治疗(EFT-C) | empathy +15%, technique +10% |
| 格式塔治疗 | 正念减压 | 正念格式塔治疗 | awareness +20%, technique +10% |
| 图式治疗 | 客体关系理论 | 图式动力学治疗 | insight +20%, judgment +10% |
| 接纳承诺治疗 | 辩证行为治疗 | ACT-DBT 整合 | technique +15%, resilience +10% |

**整合触发条件**：
1. 两个理论均达到 stage ≥ 4
2. 相关哲学维度深度 ≥ 3（作为理论基础支撑）
3. 状态 AI 在叙事中判定「整合时机成熟」→ 输出 `<psy_theory_milestone>` 标签
4. 整合后，原两个理论合并为一个「整合取向」条目，stage 重置为 1（重新开始学习阶段，但学习速度 ×1.5）
5. 整合取向不可再次与其他理论整合（每个理论最多参与一次整合）

### 10.3 理论取向切换

玩家可在任何时刻切换「当前主要理论取向」：

```
切换理论取向
  └── 无惩罚（与修仙功法不同，心理医生应博采众长）
  └── 但 AI 叙事视角会随之改变（认知取向的咨询师说话方式不同于人本取向）
  └── 在个案会话中切换被视为「整合性干预」，效果取决于新取向的理论掌握阶段
```

---

## 11. 伦理困境系统

### 11.1 设计概述

伦理困境是 psydoctor 特有的决策系统，不定期触发，**无完美答案**——每个选择都有代价和收益。

### 11.2 困境类型与决策树

```javascript
// ethics_dilemma.js 中的困境定义结构
var ETHICAL_DILEMMA_TYPES = {
  dualRelationship: {
    label: "双重关系",
    description: "来访者与你存在咨询关系之外的社会联系",
    scenes: [
      {
        id: "dual_001",
        scene: "来访者恰好是你孩子学校的班主任老师...",
        options: [
          {
            label: "转介给同事",
            effects: { reputation: 2, judgment: 5, clientWelfare: 0 },
            description: "遵守伦理规范，但来访者可能感到被抛弃"
          },
          {
            label: "与来访者坦诚讨论，共同决定",
            effects: { judgment: 3, awareness: 5, reputation: -1 },
            description: "尊重来访者自主权，但边界模糊"
          },
          {
            label: "继续治疗但严格保持边界",
            effects: { judgment: -2, resilience: -5, clientWelfare: -3 },
            description: "理论上不建议，实际中可能勉强可行"
          },
        ],
      },
    ],
  },
  confidentialityException: { /* 保密例外场景 */ },
  competenceBoundary: { /* 能力边界场景 */ },
  valueConflict: { /* 价值观冲突场景 */ },
  interestConflict: { /* 利益冲突场景 */ },
};
```

### 11.3 伦理困境触发与解析

```
伦理困境生命周期：
  ├── 触发：叙事/状态 AI 输出 <psy_ethical_dilemma> 标签
  ├── 展示：全屏模态弹窗，呈现场景描述 + 3-4 个选项
  ├── 决策：玩家选择 → resolveEthicalDilemma(choiceIndex)
  ├── 评估：引擎计算各维度的变化
  │     ├── judgment 属性（正或负）
  │     ├── reputation 行业声誉
  │     ├── clientWelfare 来访者福祉影响
  │     ├── awareness 自觉性
  │     └── countertransference 反移情可能增加
  └── 叙事：AI 根据选择生成后续叙事
```

- 无时间限制（与真实伦理决策一样，允许深思熟虑）
- 选择后无法撤销（但后果可由后续叙事/督导部分修复）
- 积累的伦理决策记录影响「大师」和「心灵哲学家」突破判定
- Tier 3 伦理性失误（边界侵犯/保密违规/能力越界等）可触发伦理调查，联动声誉和执照系统（见 §12.1）

---

## 12. 游戏性惩罚系统架构

> 心理医生的"失败"不是被怪物打死，而是在临床工作中犯错。以下系统将治疗失误转化为有深度的游戏叙事。

### 12.1 治疗失误追踪引擎

三级失误体系，由引擎规则和 AI 标签联合判定：

| 层级 | 类型 | 判定方式 | 频率 | 后果 |
|------|------|---------|------|------|
| 🟡 Tier 1 | 技术性失误 | 引擎规则：防御-技术适配矩阵 + 联盟安全线 + 连续使用检测 | 高频 | 联盟波动、脱落风险微增 |
| 🟠 Tier 2 | 策略性失误 | 跨回合模式检测：阻抗信号忽视、疗程停滞、过度主导 | 中频 | 脱落风险显著升高、需督导 |
| 🔴 Tier 3 | 伦理性失误 | AI 标签 `<psy_treatment_error>` + 伦理红线规则 | 低频 | 声誉大幅下降、投诉、执照危机 |

**核心数据结构**（`G.treatmentErrorTracker`）：`currentSessionErrors[]` / `errorHistory[]` / `activeWarnings[]` / `consecutiveErrors` / `errorStats` / `currentRiskScore [0-100]`

**防御-技术适配矩阵**：10 种来访者防御 × 6 种干预技术 = 60 格适配评分（optimal / neutral / risky / dangerous）。在个案回合中，引擎根据当前来访者防御和玩家选择的干预技术查表，判定是否存在 Tier 1 失误。

### 12.2 来访者脱落系统

```
脱落风险 = 基础脱离倾向（依恋模式 + 案例难度） + 失误惩罚 - 联盟缓冲

基础脱离倾向：
  secure → 10%, anxious → 25%, avoidant → 35%, disorganized → 40%
  每 10 点案例难度 +2%

失误惩罚：
  Tier 1 失误 → +5~15%, Tier 2 失误 → +20~30%, Tier 3 失误 → +40~60%

联盟缓冲：
  alliance ≥ 70 → -20%, alliance < 30 → +15%
```

**四级预警**：🟢 绿灯(<30%) → 🟡 黄灯(30-60%，来访者出现不满信号) → 🟠 橙灯(60-80%，来访者表达脱落意向) → 🔴 红灯(>80%，最后通牒，下回合处理不当则脱落确认)。

**脱落后果**：临床时数损失 + 声誉 -5~15 + 反移情累积触发 + AI 叙事中的"失去与反思"故事线。

### 12.3 三维声誉系统

| 维度 | 范围 | 来源 | 影响 |
|------|------|------|------|
| 专业声誉 | [0-1000] | 成功结案 +3~5，投诉 -20~50，伦理争议 -15~30 | 来访者质量、转介数量 |
| 行业地位 | [0-100] | 学术贡献、协会参与、流派影响力 | 晋升资格、教学资格 |
| 人脉网络 | [0-100] | 同行/督导师关系深度 | 危机缓冲、转介多样性 |

**来访者投诉机制**：伦理失误→60%概率投诉，脱落+alliance<20→25%概率。累计 3+ 投诉触发伦理委员会调查（多回合审查流程：无过失/轻微过失/中度过失/严重过失）。

### 12.4 执照危机系统

五态状态机：

```
ACTIVE ──(3+投诉 / 严重伦理失误)──→ UNDER_REVIEW ──(中度过失)──→ SUSPENDED
  ↑                                      │                        │
  │                                      │(无过失)                 │(期满+条件)
  │                                      ↓                        ↓
  └────────────────────────────────  RESTRICTED ←─────────────────┘
                                         │
                                         │(通过评估)
                                         ↓
                                      ACTIVE

严重过失 → REVOKED → "重建人生"叙事分支
```

**各状态限制**：UNDER_REVIEW（不可接新来访者）、SUSPENDED（停止临床工作，只能督导+个人体验）、RESTRICTED（只能接低风险来访者，max 3 人）、REVOKED（进入替代职业路径：研究者/教师/作者）。

**执照危机叙事弧**：跌落（The Fall）→ 面对（The Reckoning，伦理听证会）→ 重建（The Rebuilding，重新执业或新人生）。

### 12.5 风险仪表盘

左栏底部新增模块，实时可视化：

- 执业安全度（进度条 + 百分比）
- 风险评分（圆形仪表盘，🟢0-25 / 🟡26-50 / 🟠51-75 / 🔴76-100，>75 全屏警告+红色闪烁）
- 活跃警告列表（最多 5 条）
- 声誉三维概览（迷你进度条）
- 来访者统计（当前/脱落/结案 + 脱落率）

**回合级反馈**：个案回合后的效果弹窗（来访者回应 + 效果评估 + 失误警告 + 脱落风险变化）+ 干预选择前的风险预估。

---

## 13. 世界书系统（心理学知识基底）

### 12.1 设计目的

在每次 AI 请求时，根据对话上下文中的关键词自动注入相关心理学专业知识，保持 AI 对心理学概念、治疗规范、伦理准则的准确使用。

与 mortal_journey 世界书的关键差异：psydoctor 的知识基底更偏重**专业概念准确性**而非世界观一致性——来访者的诊断需要符合 DSM/ICD 标准，干预技术需要符合理论规范，伦理判断需要符合专业守则。

### 12.2 条目结构

```javascript
{
  id: "psychoanalytic_core",
  name: "精神分析核心概念",
  constant: false,
  keys: ["无意识", "移情", "防御机制", "自由联想", "释梦", "阻抗", "修通"],
  content: "精神分析治疗的核心概念：无意识包含被压抑的欲望与记忆...\n"
         + "防御机制分类：原始防御（分裂/投射性认同/否认...）vs 成熟防御（升华/幽默/利他...）\n"
         + "移情现象：来访者将对过去重要人物的情感投射到咨询师身上...",
  priority: 30,
  category: "theory",  // theory / ethics / technique / diagnosis / philosophy
}
```

### 12.3 选择算法

与 mortal_journey 世界书完全一致的算法：

```
selectEntries(scanText, options)
  ├── 扫描文本 = 用户输入 + 近期对话 + 状态摘要 + 来访者档案
  ├── 分离 constant 条目（永远入选，如"心理治疗基本框架"、"伦理准则"）
  ├── 对非常量条目计算命中分
  │     └── scanText.toLowerCase() 中检查每个 key 是否出现
  ├── 排序：priority 降序 → hits 降序 → id 字典序
  ├── 去重后按序合并（constant 条目先于 triggered 条目）
  └── 截断到 maxEntries（默认 8）
```

### 12.4 知识基底条目分类

| 分类 | 条目数 | 示例条目 |
|------|-------|---------|
| theory（理论概念） | 20+ | 精神分析核心概念、CBT 认知歪曲清单、存在主义四大终极关怀 |
| ethics（伦理规范） | 10+ | 知情同意、保密与保密例外、双重关系、专业能力边界 |
| technique（治疗技术） | 15+ | 共情回应规范、苏格拉底式提问、空椅技术、系统脱敏 |
| diagnosis（诊断框架） | 10+ | DSM-5 抑郁障碍、焦虑障碍、人格障碍、PTSD 诊断要点 |
| philosophy（哲学背景） | 10+ | 现象学悬置、诠释学循环、存在主义自由与责任、禅宗不二 |

### 12.5 注入格式

```
【心理学知识基底摘录】

【心理治疗基本框架】
保密原则：咨询师必须对来访者信息严格保密，例外情况包括...

· · · 条目分隔 · · ·

【CBT核心概念】
认知歪曲类型：全或无思考、灾难化、过度泛化、心灵过滤...
```

---

## 14. AI 预设系统

### 13.1 双层预设结构

```
preset_content.js（纯数据）              preset.js（逻辑层）
──────────────────────────────          ──────────────────────
PsyDoctorPresetContent            ←──   PsyDoctorAiPreset
  .presets[]                            ├── 解析预设列表
    ├── 叙事预设（system prompt）         ├── 分离规则预设 vs 叙事预设
    ├── outputFormat（输出格式）          ├── 模板变量填充 {{VAR}}
    ├── therapyNarrative（治疗叙事规则）  ├── 构建运行时 rules 列表
    ├── theoryRules（理论使用规则）       └── 组装最终 system prompt
    ├── ethicsGuidelines（伦理指导）
    ├── supervisionGuidelines（督导指导）
    ├── action_suggestions（建议规则）
    ├── caseSessionRules（个案会话规则）
    ├── careerEventRules（职业事件规则）
    └── story_snapshot（故事快照规则）
```

### 13.2 规则预设（PSY_STORY_RULE_PRESET_IDS）

N 个规则预设独立于叙事预设，始终拼接在 system prompt 尾部：

| 预设 ID | 用途 | 类比 mortal_journey |
|---|---|---|
| `outputFormat` | XML 标签输出格式规范（13 种标签的详细说明） | `outputFormat` |
| `therapyNarrative` | 治疗叙事规则（咨询对话的专业性与真实感） | `bagNarrative`（物品叙事） |
| `theoryRules` | 理论使用规则（各流派术语/框架/干预的准确性） | `stuff_rules`（物品规则） |
| `ethicsGuidelines` | 伦理指导规则（边界/保密/知情同意的叙事体现） | 新增 |
| `supervisionGuidelines` | 督导指导规则（督导师说话方式/反馈形式） | 新增 |
| `action_suggestions` | 四级行动建议规则 | `action_suggestions` |
| `caseSessionRules` | 个案会话规则（来访者话语/防御/转机的叙事模式） | 新增 |
| `careerEventRules` | 职业生涯事件规则（资格考试/会议/转职） | 新增 |
| `story_snapshot` | 故事快照/摘要规则 | `story_snapshot` |
| `countertransferenceRules` | 反移情叙事规则（如何呈现咨询师的内心挣扎） | 新增 |

新增的 5 个规则预设是 psydoctor 特有的，对应心理咨询的专业性要求。

### 13.3 模板变量

`preset.js` 的 `fillTemplateVars()` 支持 `{{VARIABLE}}` 占位符替换，psydoctor 扩展的变量：

| 变量 | 替换内容 |
|------|---------|
| `{{PLAYER_NAME}}` | 玩家姓名 |
| `{{DOCTOR_LEVEL}}` | 当前等级（如"初级心理咨询师·践行"） |
| `{{CLINICAL_HOURS}}` | 当前临床总时数 |
| `{{THEORY_ORIENTATION}}` | 当前主要理论取向 |
| `{{CURRENT_CLIENTS_SUMMARY}}` | 当前来访者列表摘要（姓名+主诉+治疗阶段） |
| `{{PSYCHOLOGIST_BASE_STATS}}` | 8+2 属性面板 |
| `{{COUNTERTRANSFERENCE_STATUS}}` | 反移情状态摘要 |
| `{{ACTIVE_CAREER_EVENTS}}` | 当前活跃的职业事件 |
| `{{BOOKSHELF_SUMMARY}}` | 藏书摘要 |

---

## 15. API 桥接层

### 14.1 复用策略

`silly_tarven/bridge.js` 从 mortal_journey**完全复用，零修改**。这是刻意为之的设计决策——bridge.js 是一个独立的 OpenAI 兼容 API 客户端，不包含任何 mortal_journey 或 psydoctor 的业务逻辑。

**核心能力**（与 mortal_journey 完全一致）：
- OpenAI `/v1/chat/completions` 兼容 API 调用
- 支持流式（SSE）与非流式两种模式
- API 配置三级优先级：
  1. localStorage `IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1`（用户设置）
  2. `FIXED_PRESET`（代码默认）
  3. `DEFAULT_CFG.defaultPresetTemplate`（兜底）
- 超时：非流式 300s，流式 chunk 间隔 300s

### 14.2 TavernHelper 接口

psydoctor 各 AI 模块统一通过 `TavernHelper.generateFromMessages()` 调用：

```javascript
// story_generate.js 中的典型调用
TavernHelper.generateFromMessages({
  messages: [...],             // OpenAI 格式消息数组
  onChunk: function(text) {},  // 流式回调（渲染打字效果）
  signal: AbortSignal,         // 取消信号（用户中止）
})
// 返回 Promise<{ text: string }>
```

### 14.3 psydoctor 的 API 调用模式

psydoctor 中 API 调用的几种场景：

| 调用场景 | 模块 | 流式？ | 超时 | 说明 |
|---------|------|--------|------|------|
| 开局剧情生成 | `world_generate.js` | 否 | 120s | 需要完整文本后一次性展示 |
| 开局配置 AI | `init_state_generate.js` | 否 | 60s | 仅解析标签，不需展示 |
| 叙事 AI 回合 | `story_generate.js` | 是 | 300s | 流式渲染到聊天区（打字效果） |
| 状态 AI 回合 | `state_generate.js` | 否 | 60s | 仅解析标签，不需展示 |
| 个案会话中 AI 生成来访者话语 | `story_generate.js` | 是 | 120s | 流式渲染（模拟来访者说话） |
| 个案会话中 AI 生成咨询师内心活动 | `story_generate.js` | 否 | 60s | 咨询师的"专业思考" |

---

## 16. UI 渲染架构

### 15.1 面板分层

与 mortal_journey 一样，UI 代码分为数据逻辑层与 UI 渲染层：

```
mainScreen_panel.js（数据逻辑层）
  └── PsyMainScreenPanel
      ├── STORAGE_KEY, SAVE_INDEX_KEY, SAVE_PREFIX
      ├── BOOKSHELF_SLOT_MAX(30), TOOL_SLOT_MAX(10)
      ├── 临床时数/督导时数/研究积分累积计算
      ├── 理论学习进度递增（通读→理解→...→创新）
      ├── 理论整合判定（检查两个理论是否满足整合条件）
      ├── 伦理困境选项评估
      ├── 反移情风险阈值检测
      ├── 来访者列表合并去重（保留已有 profile，新来访者完整规范化）
      ├── 藏书/工具增删改（去重/排序/上限检查）
      └── 存档管理（save/load/delete）

mainScreen_panel_ui.js（UI 渲染层）
  └── PsyMainScreenPanelUi
      ├── renderLeftPanel()            → 左栏：等级/8+2 属性/理论掌握/哲学深度
      ├── renderBookShelfGrid()        → 藏书网格
      ├── renderTherapyToolGrid()      → 治疗工具网格
      ├── renderRightPanel()           → 右栏：来访者列表/同行/督导师
      ├── renderClientCard(client)     → 单个来访者卡片
      ├── renderBootstrapOverview()    → 开局总览
      ├── bindTheoryDetailModalUi()    → 理论详情弹窗
      ├── bindClientDetailModalUi()    → 来访者档案详情弹窗
      ├── bindSupervisionModalUi()     → 督导记录弹窗
      ├── bindEthicalDilemmaModalUi()  → 伦理困境决策弹窗
      ├── bindCountertransferenceUi()  → 反移情状态弹窗
      ├── bindCaseSessionUi()          → 个案会话 UI（回合选择按钮）
      └── bindMajorLevelUpUi()         → 大阶段晋升弹窗（资格考试/个案答辩）
```

### 15.2 渲染策略

继承 mortal_journey 的设计模式：
- **全量重绘**：每次数据变更后，调用完整的 `render*` 函数重新生成 DOM
- **innerHTML 替换**：面板内容通过设置容器 `innerHTML` 实现更新
- **数据驱动**：渲染函数无副作用，只读取 `PsyDoctorGame` 生成 HTML
- **条件保护**：弹窗打开时不触发面板重绘（避免弹窗状态丢失）

### 15.3 弹窗系统

```
弹窗打开 → document.body.style.overflow = "hidden"
弹窗关闭 → psycheClearBodyOverflowIfNoModal()
           → 检查所有弹窗 DOM 是否隐藏
           → 全部隐藏时恢复 body overflow
```

### 15.4 移动端适配

- 左右侧栏通过 CSS class `psy-mobile-open` 控制滑入/滑出
- `Escape` 键关闭所有移动面板
- 聊天建议区域可折叠
- 个案会话回合选择按钮在移动端堆叠显示（竖向排列而非横向）

---

## 17. 职业生涯发展与突破系统

### 16.1 临床时数积累

心理医生的核心「修为」是临床时数。与修仙的「灵石炼化→修为」不同，临床时数是**叙事驱动积累**的：

```
临床时数来源：
  ├── 直接接案（每完成一次咨询会话）：+1~2（基础 1 + 综合评分 >70% 时额外 +1）
  ├── 接受督导（每次督导会话）：督导时数 +0.5，自觉性/论断力微增
  ├── 理论学习（阅读/培训/工作坊）：理论时数 +2~5（取决于叙事强度）
  ├── 个人体验（作为来访者接受治疗）：个人体验时数 +1，自觉性大幅提升+反移情化解
  ├── 案例讨论（同行交流/学术会议）：洞察力微增，研究积分增加
  ├── 论文写作：理论知识大量提升（+10~20h），研究积分增加
  └── 教学带教（指导新手）：沟通力微增，论断力微增
```

与灵石的差异：
- 灵石炼化是玩家主动操作（消耗物品 → 获得修为）
- 临床时数是 AI 在叙事中根据内容自动积累（状态 AI 输出 `<psy_clinical_gain>` 标签）
- 没有「兑换比例」——临床时数是不可交易、不可积累后一次性消耗的资源

### 16.2 小阶段晋升（Minor Level Up）

临床时数达到当前小阶段要求时，**自动晋升**（与修仙小境界突破一致）：

```
心理学徒·初窥 (临床时数 ≥50) → 心理学徒·践行 (≥100) → 心理学徒·贯通 (≥200)
→ 实习咨询师·初窥 (≥300) → ...
```

晋升时：
- `psychologistBase` 自动更新为基础属性表的下一级数值
- 无失败概率（小阶段晋升是累积式的，不涉及资格考试）
- UI 弹出晋升提示

### 16.3 大阶段晋升：资格考试/答辩（Major Level Up）

大阶段之间需要「资格考验」（类比大境界突破，但机制不同——不是概率突破，而是**挑战式突破**）：

```
大阶段晋升流程：
  ├── 1  触发条件：临床时数 + 督导时数 + 理论掌握阶段 满足晋升门槛
  ├── 2  AI 叙事生成「资格考试/答辩」场景
  │       学徒→实习：毕业考试 / 实习申请面试
  │       实习→初级：执业资格考试 / 个案报告答辩
  │       初级→资深：独立执业评估 / 复杂个案处理能力评估
  │       资深→专家：学术论文答辩 / 流派深耕成果认证
  │       专家→大师：著作评审 / 行业影响力评估
  │       大师→心灵哲学家：哲学思辨深度论证
  ├── 3  玩家参与「考试/答辩」叙事（AI 提出问题/场景，玩家回应）
  ├── 4  引擎评估通过条件：
  │       ├── 临床时数 ≥ 门槛（硬性条件，不满足无法触发）
  │       ├── 督导时数 ≥ 门槛（硬性条件）
  │       ├── 理论掌握阶段 ≥ 要求（硬性条件）
  │       ├── 个人体验时数 ≥ 要求（从初级→资深开始需要）
  │       └── 答辩/考试表现（软性条件，由状态 AI 根据玩家回答评估）
  ├── 5  通过 → 晋升 + 新等级对应属性 + 新工作场景
  │     未通过 → 时数保留，可重新挑战（无回落惩罚，与修仙突破不同）
  └── 6  叙事 AI 生成晋升后的生活变化叙事
```

**与修仙大境界突破的差异**：
- 无概率性失败——未通过可重试
- 无属性回落惩罚——心理医生的成长没有「走火入魔」
- 失败后获得「经验」——下次重试时有额外洞察 bonus
- 需要多个维度同时达标（临床时数 + 督导时数 + 理论 + 个人体验）——比修仙的单维度修为要求更复杂

### 16.4 工作场景演化

等级晋升伴随工作场景的自动切换：

```
心理学徒 → 大学校园/图书馆/实验室
实习咨询师 → 大学心理咨询中心/社区心理服务站
初级咨询师 → 心理咨询机构/EAP公司
资深咨询师 → 私人执业诊所/医院心理科
治疗专家 → 多学科合作团队/学术会议/研究所
心理学大师 → 培训中心/国际会议/著作写作
心灵哲学家 → 无固定场所—在心灵最深处工作（叙事场景自由切换）
```

工作场景切换时触发叙事 AI 生成新环境的引入剧情。

---

## 18. 持久化架构

### 17.1 双层存储 + 自动保存

继承 mortal_journey 的持久化设计：

```
sessionStorage                          localStorage
─────────────────────────────          ─────────────────────────────
psydoctor_bootstrap_v1                 PSY_SAVES_INDEX_V1           ← 存档索引
  └── 当前会话的快照                       └── ["save_001", "save_002"]

                                       PSY_SAVE_V1:save_001         ← 存档槽
                                         └── 完整 PsyDoctorGame JSON
                                       PSY_ACTIVE_SAVE_ID_V1        ← 当前活跃存档 ID

psydoctor_last_session_v1              IMMORTAL_ST_BRIDGE_API_      ← API 覆盖配置
  └── sessionStorage 的镜像备份          OVERRIDE_V1               （复用 bridge 键名）

                                       IMMORTAL_ST_BRIDGE_          ← Bridge 预设
                                         PRESETS_V1                 （复用）
```

**存储键命名规范**：
- psydoctor 专属键使用 `psy*` 前缀
- API 相关键沿用 `IMMORTAL_ST_BRIDGE*`（与 bridge.js 保持一致，确保复用无修改）

**自动保存**：
- 4 秒定时器（`setInterval 4000ms`）
- `beforeunload` 事件兜底
- 保存时同时写入 sessionStorage + localStorage 镜像 + 当前活跃存档槽

### 17.2 存档管理

存档操作（与 mortal_journey 一致的接口）：

```
PsyMainScreen 对外存档 API：
  ├── saveGame(saveId)     → 序列化 PsyDoctorGame → localStorage
  ├── loadGame(saveId)     → 从 localStorage 反序列化 → 替换当前 G
  ├── deleteSave(saveId)   → 移除 localStorage 中的存档槽
  ├── listSaves()          → 读取 PSY_SAVES_INDEX_V1，返回存档列表
  └── autoSave()           → 定时器触发，写入当前活跃存档槽
```

### 17.3 读档时的状态恢复

```
loadGame(saveId)
  ├── 1  从 localStorage 读取存档 JSON
  ├── 2  JSON.parse() 反序列化
  ├── 3  校验存档版本兼容性（V1 key + 结构完整性检查）
  ├── 4  ensureGameRuntimeDefaults(G) → 补全可能缺失的新增字段
  ├── 5  computePsychologistBase(G)   → 重算属性（确保公式更新后正确）
  ├── 6  applyCountertransferenceCheck(G) → 检查反移情状态
  ├── 7  写入 sessionStorage（镜像）
  ├── 8  设为当前活跃存档
  └── 9  runNormalFirstEnterPipeline() → 渲染 UI + 启动 AI（如需要）
```

---

## 19. 调试日志系统

### 18.1 复用策略

`js/log/logPanel.js` 从 mortal_journey**完全复用**。它是一个可折叠的调试面板，通过劫持 `console.log/warn/error` 来捕获日志。

psydoctor 中的日志分类：

| 日志类别 | 颜色 | 说明 |
|---------|------|------|
| `[psy:ai]` | 蓝色 | AI 请求/响应（prompt 摘要、token 数、耗时） |
| `[psy:state]` | 绿色 | 状态变更（属性变化、时数增加、等级晋升） |
| `[psy:session]` | 紫色 | 个案会话（回合技术选择、效果计算、联盟变化） |
| `[psy:ethics]` | 橙色 | 伦理困境（触发、选择、后果） |
| `[psy:counter]` | 红色 | 反移情（累积、阈值告警、化解） |
| `[psy:save]` | 灰色 | 存档操作（保存/读取/删除） |

---

## 20. 关键设计决策与权衡

### 19.1 完全复用 bridge.js（零修改）

**决策**：`silly_tarven/bridge.js` 不从 mortal_journey 做任何修改，直接复制使用。

**原因**：
- bridge.js 的 API 接口是通用的 OpenAI 兼容协议，不包含任何业务逻辑
- psydoctor 使用相同的 API 覆盖键名 `IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1`，用户无需重新配置
- 两个游戏可共享同一 API 设置（如果同一浏览器运行）
- bridge.js 有独立的维护历史和稳定性，不应打破

### 19.2 继承 mortal_journey 的 IIFE + 全局命名空间模式

**决策**：不使用 ES Module / TypeScript / 构建工具。

**原因**（与 mortal_journey 相同）：
- 零构建成本：HTML 直接 `<script>` 引用即可运行
- GitHub Pages 适合静态托管，无需 CI/CD
- 兼容旧浏览器
- 保持与 mortal_journey 代码风格一致性，降低维护者学习成本

### 19.3 个案引擎 ≠ 战斗引擎

**决策**：咨询个案引擎不继承 `MortalJourneyBattle` 的任何代码，完全重写。

**原因**：
- 逻辑模型根本不同：战斗是「对抗」模型（攻击/防御/击杀），咨询是「协作」模型（理解/陪伴/疗愈）
- 数值维度不同：HP/MP/damage vs 治疗联盟/症状严重度/干预效果
- 玩家选择模式不同：战斗是自动的功法选择（`pickBestGongfa`），咨询是玩家手动选择干预技术
- 失败模式不同：战斗失败=死亡/读档，咨询失败=来访者脱落/职业反思
- 强行继承会导致概念扭曲和代码维护困难

### 19.4 理论系统 ≠ 功法系统

**决策**：理论系统独立设计，不继承功法系统的代码。

**原因**：
- 功法是「装备」概念（8 个槽位，可装卸），理论是「技能树」概念（6 个学习阶段，不可卸载）
- 功法有品阶（下品→仙品），理论无品阶但阶段深度
- 功法提供固定 bonus（× 境界倍率），理论提供可成长的 bonus（阶段系数 × 属性贡献）
- 功法间无整合机制，理论间有整合机制（创新机制）
- 切换功法可能有惩罚，切换理论取向无惩罚

### 19.5 大阶段突破无概率

**决策**：大阶段晋升（资格考试/答辩）不使用概率突破模型。

**原因**：
- 心理医生的成长与修仙不同——没有「突破失败走火入魔」的概念
- 资格考试/答辩的「通过」取决于多个硬性条件（时数/理论/督导）+ 软性叙事表现
- 未通过无惩罚（可重试），这反映了真实心理学培训的宽容性
- 强调「积累的重要性」而非「运气的随机性」，符合心理学专业精神

### 19.6 反移情系统的引入

**决策**：引入 mortal_journey 完全没有的反移情追踪系统。

**原因**：
- 反移情是心理咨询区别于其他职业的核心专业概念
- 它创造了一个独特的游戏张力：治疗他人 vs 照顾自己
- 它是「自觉性」属性的主要考验场景——高自觉性的咨询师能更早察觉反移情
- 它是连接「个人体验」系统的桥梁——反移情需要通过接受自己的治疗来化解
- 增加游戏的深度和真实感——心理医生不是超人，也会被来访者触动

### 19.7 伦理困境无「正确答案」

**决策**：伦理困境的每个选项都有正面和负面后果，不存在「最优解」。

**原因**：
- 真实的伦理困境没有完美答案——这是伦理学的本质
- 鼓励玩家思考而非寻找「攻略」
- 不同选择塑造不同的职业人格（保守伦理派/灵活适应派/自主赋权派）
- 长期后果在叙事中逐步显现，创造反复回味的故事

### 19.8 哲学思辨深度的属性加成设计

**决策**：哲学深度采用「乘法加成」而非「加法加成」，且对特定属性生效。

**原因**（类比 mortal_journey 的灵根乘法）：
- 哲学深度是「倍率器」而非「加数」——它放大已有的属性而非独立提供属性
- 避免哲学深度变为另一个「可无限堆叠的数值」，保持其「深度」的质变感
- 与灵根五行→属性映射的类比：不同哲学维度侧重不同属性，创造了差异化成长路径
- 「现象学+东方心学」的组合 vs「存在哲学+后现代」的组合，导致完全不同的能力曲线

---

## 21. 数据流全景图

```
                     ┌──────────────────────┐
                     │   localStorage        │
                     │   API_OVERRIDE_V1     │
                     └──────────┬───────────┘
                                │ 读取 API 配置
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                   silly_tarven/bridge.js                      │
│                   TavernHelper / SillyTavernBridge            │
│                   generateFromMessages()   (零修改复用)       │
└──────┬───────────────────────────────────────┬───────────────┘
       │ 叙事 AI 请求                           │ 状态 AI 请求
       ▼                                        ▼
┌───────────────────────┐              ┌───────────────────────┐
│ story_generate.js     │              │ state_generate.js     │
│ buildMessages()       │              │ sendTurn()            │
│  ├── preset           │              │ applyStateTurn        │
│  ├── worldbook        │              │ FromAssistantText()   │
│  ├── chatHistory      │              │  ├── 标签提取          │
│  ├── clientProfiles   │              │  ├── JSON 解析        │
│  └── runtimeState     │              │  ├── 字段校验          │
└──────┬────────────────┘              │  ├── 写回 G 对象       │
       │ 叙事正文                        │  └── 后处理触发器      │
       │ + 来访者话语                    └──────┬────────────────┘
       │ + 咨询师内心活动                       │
       │ + 行动建议                             │
       │ + 个案触发                             ▼
       │ + 伦理困境              ┌──────────────────────────────┐
       │ + 理论洞见              │      PsyDoctorGame            │
       ▼                         │  doctorLevel, clinicalHours,  │
┌────────────────────────────────┤  psychologistBase,            │
│        个案会话引擎             │  theoryMastery, philosophyDepth│
│  CaseSessionEngine             │  currentClients, nearbyPeople,│
│  ├── 干预效果计算              │  countertransference,         │
│  ├── 治疗联盟变化              │  bookShelf, therapyTools,     │
│  ├── 症状改善评估              │  chatHistory,                 │
│  └── 会话结算                  │  activeEthicalDilemma         │
└────────────────────────────────┴──┬──┬──────┬────┬──────┬──────┘
                                    │  │      │    │      │
                                    ▼  ▼      ▼    ▼      ▼
                              ┌────┐┌────┐┌────┐┌────┐┌────────┐
                              │左栏││聊天││藏书││理论││来访者   │
                              │面板││区域││网格││面板││/NPC面板 │
                              └────┘└────┘└────┘└────┘└────────┘
                                 ▲     ▲     ▲     ▲     ▲
                                 └─────┴─────┴─────┴─────┘
                                    PsyMainScreenPanelUi
                                      (UI 渲染层)
```

---

## 22. 模块依赖矩阵

```
                      数据层                    引擎层                        AI层                    UI层
                      drLvl thry phil creat att psych client case ethics count story state world initSt panel panelUi chat mainScreen
character_attribute     -     -    -    -    -    -      -     -    -      -     -     -     -     -      -      -      -     -
doctor_level            -     -    -    -    -    -      -     -    -      -     -     -     -     -      -      -      -     -
theory_state            -     -    -    -    -    -      -     -    -      -     -     -     -     -      -      -      -     -
philosophy_state        -     -    -    -    -    -      -     -    -      -     -     -     -     -      -      -      -     -
creation_config         -     -    -    -    -    -      -     -    -      -     -     -     -     -      -      -      -     -
client_templates        -     -    -    -    -    -      -     -    -      -     -     -     -     -      -      -      -     -
trait_samples           -     -    -    -    -    -      -     -    -      -     -     -     -     -      -      -      -     -
psychologist_base_rt    ✓     ✓    ✓    ✓    -    -      -     -    -      -     -     -     -     -      -      -      -     -
client_character_sheet  ✓     -    -    -    -    ✓      -     -    -      -     -     -     -     -      -      -      -     -
case_session            ✓     -    ✓    -    -    ✓      ✓     -    -      -     -     -     -     -      -      -      -     -
ethics_dilemma          -     -    -    -    -    -      -     -    -      ✓     -     -     -     -      -      -      -     -
countertransference     -     -    -    -    -    ✓      -     -    -      -     -     -     -     -      -      -      -     -
world_book              -     -    -    -    -    -      -     -    -      -     -     -     -     -      -      -      -     -
preset                  -     -    -    -    -    -      -     -    -      -     -     -     -     -      -      -      -     -
story_generate          ✓     ✓    ✓    -    -    -      ✓     -    -      -     -     -     -     -      -      -      -     -
state_generate          ✓     ✓    ✓    -    -    ✓      ✓     -    -      ✓     ✓     -     -     -      -      -      -     -
world_generate          ✓     -    -    ✓    -    -      -     -    -      -     -     -     -     -      -      -      -     -
init_state_generate     ✓     -    -    ✓    -    -      -     -    -      -     -     -     ✓     -      -      -      -     -
mainScreen_panel        ✓     ✓    ✓    ✓    -    -      -     -    ✓      ✓     -     -     -     -      -      -      -     -
mainScreen_panel_ui     ✓     ✓    ✓    ✓    -    -      ✓     -    -      -     -     -     -     -      ✓      -      -     -
mainScreen_chat         ✓     -    ✓    -    -    -      ✓     ✓    -      -     ✓     ✓     -     -      ✓      -      -     -
mainScreen              ✓     -    -    ✓    -    -      -     ✓    ✓      ✓     ✓     ✓     ✓     ✓      ✓      ✓      -     -
```

注：`✓` 表示存在运行时读取依赖（通过全局命名空间 `window.PsyDoctor*` 访问）。

---

## 23. 与 mortal_journey 架构的继承与差异汇总

| 架构维度 | mortal_journey | psydoctor | 继承/重写 |
|---------|---------------|-----------|----------|
| 模块模式 | IIFE + 全局命名空间 | IIFE + 全局命名空间 | ✅ 完全继承 |
| 页面路由 | index.html → main.html | index.html → main.html | ✅ 完全继承 |
| AI 管线 | 双回合（Story + State） | 双回合（Story + State） | ✅ 继承架构，重写 prompt |
| AI 标签协议 | 12 种 `<mj_*>` 标签 | 13 种 `<psy_*>` 标签 | 🔄 继承设计模式，标签内容全新 |
| 全局状态 | MortalJourneyGame | PsyDoctorGame | 🔄 继承单例模式，状态结构全新 |
| 属性计算 | 7 步管线（境界+灵根） | 6 步管线（等级+哲学+反移情） | 🔄 继承管线模式，计算逻辑全新 |
| 战斗/个案 | BattleEngine | CaseSessionEngine | ❌ 完全重写 |
| 功法/理论 | 功法装备（8 槽位） | 理论学习（6 阶段+整合） | ❌ 完全重写 |
| 世界书 | 修仙世界设定 | 心理学知识基底 | 🔄 继承引擎，替换条目数据 |
| AI 预设 | 9 规则预设 | 10 规则预设 | 🔄 继承框架，新增 5 个心理学专用预设 |
| API 桥接 | silly_tarven/bridge.js | silly_tarven/bridge.js | ✅ 零修改复用 |
| UI 渲染 | 两层分离 + 全量重绘 | 两层分离 + 全量重绘 | ✅ 完全继承 |
| 持久化 | sessionStorage + localStorage | sessionStorage + localStorage | ✅ 继承策略，替换键名 |
| 灵根/哲学 | 五行灵根×境界倍率 | 哲学深度×等级倍率 | 🔄 继承乘法模式，维度/映射全新 |
| 突破系统 | 概率突破（小自动/大概率） | 资格考试（小自动/大挑战） | 🔄 继承晋升框架，判定机制全新 |
| 反移情系统 | 无 | CountertransferenceTracker | ❌ 全新系统 |
| 伦理困境 | 无 | EthicsDilemmaEngine | ❌ 全新系统 |
| 理论整合 | 无（功法无整合机制） | TheoryIntegration（8 条预设路线） | ❌ 全新系统 |
| 调试日志 | logPanel.js | logPanel.js | ✅ 零修改复用 |

---

## 24. 实现优先级与依赖关系

### 第一阶段：核心骨架（可玩原型）
```
1. silly_tarven/bridge.js         ← 从 mortal_journey 复制（零修改）
2. character/character_attribute.js ← 新建（属性键定义，简单）
3. data/doctor_level.js           ← 新建（21 行数据表）
4. data/creation_config.js        ← 新建（教育/动机/特质配置）
5. data/philosophy_state.js       ← 新建（哲学维度 × 属性映射）
6. game/psychologist_base_runtime.js ← 新建（核心算法，依赖 3,4,5）
7. index.html + fateChoiceController.js ← 新建（启动页）
8. main.html + mainScreen.js      ← 新建（主界面入口+门闩）
9. worldbook/*                    ← 新建（知识基底+预设，可先最小化）
10. ai_server/story_generate.js   ← 新建（叙事 AI）
11. ai_server/state_generate.js   ← 新建（状态 AI）
12. ui/mainScreen_panel.js + ui   ← 新建（面板）
13. ui/mainScreen_chat.js         ← 新建（聊天+AI 调度）
```

此阶段目标：玩家可创建角色 → 进入主界面 → 发送消息 → AI 叙事响应 → 状态同步 → 基本面板显示

### 第二阶段：心理学深度
```
14. data/theory_state.js          ← 新建（32+ 理论数据）
15. game/case_session.js          ← 新建（个案引擎）
16. game/countertransference.js   ← 新建（反移情追踪）
17. ai_server/world_generate.js   ← 新建（开局剧情）
18. ai_server/init_state_generate.js ← 新建（开局配置）
19. worldbook 扩充条目数据
20. preset_content 扩充预设内容
```

此阶段目标：完整的咨询个案流程 + 理论学习 + 反移情机制

### 第三阶段：完善系统
```
21. data/client_templates.js      ← 新建（来访者类型模板）
22. game/ethics_dilemma.js        ← 新建（伦理困境）
23. game/client_character_sheet.js ← 新建（来访者档案规范化）
24. log/logPanel.js               ← 从 mortal_journey 复制
25. 理论整合系统实现
26. 职业生涯事件系统完善
```

此阶段目标：完整游戏循环（理论→咨询→督导→成长→伦理→反移情→整合）

### 第四阶段：打磨
```
27. 移动端适配
28. 世界书条目扩充至 50+
29. AI 预设优化与调校
30. 性能优化与 bug 修复
```

---

*文档版本：v1.0*
*创建日期：2026-06-18*
*基于：mortal_journey 源码分析 + psydoctor 需求文档 v1.0*
