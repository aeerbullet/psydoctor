# mortal_journey 架构设计文档

> 从实际代码分析得出，非基于文档推测。分析范围：34 个源文件（30 JS + 2 HTML + 4 CSS），约 14,000+ 行 JS。

---

## 1. 架构概览

mortal_journey 是一个**纯前端浏览器端 AI 文字修仙 RPG**，无后端、无模块打包器、无框架。核心架构特征：

- **双页面路由**：`index.html`（启动页/命运抉择）→ `main.html`（主游戏界面）
- **IIFE + 全局命名空间**模块化：每个 JS 文件是一个自执行函数，通过 `window.XYZ = {}` 暴露 API
- **AI 驱动叙事**：OpenAI 兼容 API，双回合管线（剧情 AI → 状态 AI）
- **XML 标签协议**：AI 通过 `<mj_*>` 标签向游戏引擎传递结构化指令
- **单一状态树**：`window.MortalJourneyGame` 作为全局游戏状态
- **双层持久化**：sessionStorage（当前会话）+ localStorage（永久存档）

```
┌─────────────────────────────────────────────────────────┐
│                    index.html (启动页)                    │
│  API 设置 → 命运抉择（出身/灵根/世界因子）→ 开始人生       │
└──────────────────────┬──────────────────────────────────┘
                       │ sessionStorage 传递 fateChoice
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    main.html (主游戏)                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ 左栏     │  │ 中央聊天区    │  │ 右栏             │   │
│  │ 主角面板 │  │ AI 剧情对话   │  │ 周围人物列表      │   │
│  │ 功法/佩戴│  │ 状态反馈      │  │ NPC 详情         │   │
│  │ 储物袋   │  │ 战斗结算      │  │                  │   │
│  └──────────┘  └──────────────┘  └──────────────────┘   │
│                                                          │
│  底层：silly_tarven/bridge.js → OpenAI 兼容 API           │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 模块架构：IIFE + 全局命名空间

### 2.1 模块模式

所有 JS 文件采用统一的 IIFE（Immediately Invoked Function Expression）模式：

```javascript
// 标准模块骨架（以 world_book.js 为例）
(function (global) {
  "use strict";

  // 私有变量与函数
  var WORLD_BOOK_ENTRIES = loadEntriesFromGlobal();

  function selectEntries(scanText, options) { /* ... */ }

  // 对外暴露 API
  global.MortalJourneyWorldBook = {
    selectEntries: selectEntries,
    formatForSystem: formatForSystem,
    syncToBridgeStorage: syncToBridgeStorage,
  };
})(typeof window !== "undefined" ? window : globalThis);
```

### 2.2 全局命名空间一览

| 命名空间 | 源文件 | 职责 |
|---|---|---|
| `MortalJourneyGame` | 运行时注入 | 全局游戏状态单例 |
| `MainScreen` | `js/ui/mainScreen.js` | 主界面对外 API |
| `MjMainScreenChat` | `js/ui/mainScreen_chat.js` | 聊天 UI 与 AI 回合编排 |
| `MjMainScreenPanel` | `js/ui/mainScreen_panel_inventory_ui.js` | 面板 UI 渲染 |
| `MjMainScreenPanelRealm` | `js/ui/mainScreen_panel_realm.js` | 面板数据逻辑 |
| `MortalJourneyWorldGenerate` | `js/ai_server/world_generate.js` | 开局剧情生成 |
| `MortalJourneyInitStateGenerate` | `js/ai_server/init_state_generate.js` | 开局配置 AI |
| `MortalJourneyStoryChat` | `js/ai_server/story_generate.js` | 剧情 AI 对话 |
| `MortalJourneyStateGenerate` | `js/ai_server/state_generate.js` | 状态 AI 同步 |
| `MortalJourneyBattle` | `js/game/mortal_journey_battle.js` | 回合制战斗引擎 |
| `PlayerBaseRuntime` | `js/game/player_base_runtime.js` | 角色属性计算引擎 |
| `MjCharacterSheet` | `js/game/mj_character_sheet.js` | 角色卡规范化 |
| `MortalJourneyWorldBook` | `js/worldbook/world_book.js` | 世界书条目选择与注入 |
| `MortalJourneyWorldBookEntries` | `js/worldbook/world_book_entries.js` | 世界书条目数据 |
| `MortalJourneyAiPreset` | `js/worldbook/preset.js` | AI 预设管理 |
| `MortalJourneyPresetContent` | `js/worldbook/preset_content.js` | AI 预设内容数据 |
| `MortalJourneyStateRules` | `js/worldbook/state_rules.js` | 状态 AI 规则模板 |
| `MortalJourneyInitStateRules` | `js/worldbook/init_state_rules.js` | 开局配置 AI 规则模板 |
| `RealmState` | `js/data/realm_state.js` | 境界数据表（静态） |
| `LinggenState` / `LeegenState` | `js/data/leegen_state.js` | 灵根五行映射与倍率 |
| `MjCreationConfig` | `js/data/mjCreationConfig.js` | 出身/装备/灵根配置表 |
| `CharacterAttribute` | `js/character/character_attribute.js` | 属性键定义与校验 |
| `GameLog` | `js/log/logPanel.js` | 调试日志面板 |
| `SillyTavernBridge` | `silly_tarven/bridge.js` | OpenAI 兼容 API 桥接 |
| `FateChoiceController` | `js/ui/fateChoiceController.js` | 命运抉择控制器 |

### 2.3 模块加载顺序

模块间存在隐式的依赖关系，通过 `<script>` 标签的加载顺序保证：

```
1. 数据层（无依赖）
   ├── character_attribute.js
   ├── realm_state.js
   ├── leegen_state.js
   ├── spirit_stone.js
   ├── trait_samples.js
   └── mjCreationConfig.js

2. 游戏引擎层（依赖数据层）
   ├── player_base_runtime.js
   ├── mj_character_sheet.js
   └── mortal_journey_battle.js

3. 世界书/Preset 层（依赖数据层）
   ├── world_book_entries.js
   ├── world_book.js
   ├── preset_content.js
   ├── preset.js
   ├── state_rules.js
   └── init_state_rules.js

4. AI 服务层（依赖世界书 + 引擎层）
   ├── world_generate.js
   ├── init_state_generate.js
   ├── story_generate.js
   └── state_generate.js

5. UI 层（依赖所有上层模块）
   ├── mainScreen_panel_realm.js
   ├── mainScreen_panel_inventory_ui.js
   ├── mainScreen_chat.js
   ├── mainScreen.js（最后加载，执行 init）
   └── logPanel.js（调试，可独立）
```

关键约束（源码注释明确标注）：
- `mainScreen_panel_realm.js` 必须先于 `mainScreen_panel_inventory_ui.js`
- 两者必须先于 `mainScreen_chat.js`
- `mainScreen.js` 必须最后加载（它调用 `DOMContentLoaded` 触发初始化）
- `world_book_entries.js` 必须先于 `world_book.js`

---

## 3. 目录与文件结构

```
mortal_journey/
├── index.html                          # 启动页（API 设置 → 命运抉择）
├── main.html                           # 主游戏界面
├── css/
│   ├── start_frame.css                 # 启动页样式
│   ├── creation.css                    # 命运抉择/创建样式
│   ├── main.css                        # 主游戏界面样式
│   └── logPanel.css                    # 调试日志面板样式
├── silly_tarven/
│   └── bridge.js                       # OpenAI 兼容 API 桥接层（独立可复用）
└── js/
    ├── character/
    │   └── character_attribute.js      # 属性系统：键定义、校验、类型
    ├── data/                           # 静态数据表（纯数据，无业务逻辑）
    │   ├── realm_state.js              # 境界基础属性、修为需求、寿元、突破概率
    │   ├── leegen_state.js             # 灵根五行→属性映射、境界倍率
    │   ├── mjCreationConfig.js         # 出身配置、装备类型、灵根生成规则
    │   ├── spirit_stone.js             # 灵石五品价值映射
    │   └── trait_samples.js            # 天赋样本
    ├── game/                           # 游戏引擎（计算密集，无 DOM 操作）
    │   ├── player_base_runtime.js      # 角色属性计算引擎（核心算法）
    │   ├── mortal_journey_battle.js    # 回合制战斗引擎
    │   └── mj_character_sheet.js       # 角色卡规范化（玩家/NPC 共用）
    ├── ai_server/                      # AI 管线（prompt 构建 + 响应解析）
    │   ├── world_generate.js           # 开局剧情生成
    │   ├── init_state_generate.js      # 开局配置 AI（主角装备/功法初始化）
    │   ├── story_generate.js           # 剧情 AI 回合（叙事生成）
    │   └── state_generate.js           # 状态 AI 回合（结构化状态同步）
    ├── worldbook/                      # 世界书与 AI 规则
    │   ├── world_book.js               # 世界书引擎（关键词匹配/条目选择）
    │   ├── world_book_entries.js       # 世界书条目数据
    │   ├── preset.js                   # AI 预设管理（system prompt 构建）
    │   ├── preset_content.js           # 预设内容数据
    │   ├── state_rules.js              # 状态 AI 规则模板
    │   └── init_state_rules.js         # 开局配置 AI 规则模板
    ├── ui/                             # UI 层（DOM 渲染 + 事件绑定）
    │   ├── fateChoiceController.js     # 启动页命运抉择
    │   ├── mainScreen.js               # 主界面初始化 + 门闩管线 + 对外 API
    │   ├── mainScreen_chat.js          # 聊天 UI + AI 回合编排 + 战斗触发
    │   ├── mainScreen_panel_realm.js   # 面板数据逻辑（境界/灵石/存档/NPC）
    │   └── mainScreen_panel_inventory_ui.js # 面板 UI 渲染（格子/弹窗/左栏）
    └── log/
        └── logPanel.js                 # 调试日志面板（可折叠，接管 console）
```

---

## 4. 双页面路由架构

### 4.1 页面跳转机制

启动页（`index.html`）到主游戏（`main.html`）通过 `window.location.href` 实现页面级跳转，数据通过 sessionStorage 传递：

```
index.html                          main.html
┌──────────────┐                   ┌──────────────────┐
│ 1. API 设置  │                   │ 读取              │
│    写入      │                   │ sessionStorage    │
│ localStorage │                   │ "mortal_journey   │
│              │                   │  _bootstrap_v1"   │
│ 2. 命运抉择  │                   │                  │
│    出身/灵根 │─── sessionStorage ──→ 恢复 fateChoice │
│    世界因子  │    (bootstrap)      │ 恢复 MortalJourney│
│    开始人生  │                     │ Game            │
│              │                   │                  │
│ 3. 读档     │─── localStorage ──→ │ 从存档槽载入     │
│    读取人生  │    (SAVE_V1:*)      │                  │
└──────────────┘                   └──────────────────┘
```

### 4.2 启动页核心流程

1. **API 设置**：写入 `localStorage` 键 `IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1`，bridge.js 优先读取此覆盖配置
2. **命运抉择**：选择出身 → 生成/自定义灵根 → 选择世界因子 → 写入属性
3. **出身数据**：来自 `MjCreationConfig.BIRTHS`（预设出身表），或用户自定义填写
4. **灵根生成**：`MjCreationConfig` 提供概率表，支持真灵根/伪灵根/天灵根/无灵根，五行随机组合
5. **开始人生**：
   - 构建 `fateChoice` 对象（含 realm、linggen、traits、worldFactors、customBirth）
   - 写入 sessionStorage 键 `mortal_journey_bootstrap_v1`
   - 创建新存档槽（localStorage `MJ_SAVE_V1:*`）
   - 跳转 `main.html`

### 4.3 主游戏入口流程

`mainScreen.js` 的 `init()` 是整个主界面的入口：

```
init()
  ├── 1. 绑定 UI 事件（弹窗、突破、NPC 详情）
  ├── 2. 恢复 Bootstrap：从 sessionStorage 读取 fateChoice + MortalJourneyGame
  ├── 3. ensureGameRuntimeDefaults(G)  → 补全缺失字段
  ├── 4. ensureNearbyNpcsArray(G)      → 确保 NPC 数组存在
  ├── 5. applyRealmBreakthroughs(G)    → 检查修为是否触发自动晋升
  ├── 6. runBootstrapAiGateOrSkip()    → 判断是否需要新档门闩
  │     ├── 需要门闩（新档）→ 4 阶段管线
  │     └── 不需要（读档）→ runNormalFirstEnterPipeline()
  ├── 7. 绑定聊天发送按钮
  ├── 8. 绑定聊天建议按钮
  ├── 9. 绑定手机端面板切换
  ├── 10. 启动 4 秒定时自动保存
  └── 11. 注册 beforeunload 事件兜底保存
```

---

## 5. AI 管线架构

### 5.1 总体设计：双回合管线

每次玩家输入触发两轮 AI 调用：

```
玩家输入
    │
    ▼
┌──────────────┐     ┌──────────────┐
│  剧情 AI      │ ──→ │  状态 AI      │
│  (Story AI)   │     │  (State AI)   │
│              │     │              │
│ 生成叙事正文   │     │ 解析标签更新   │
│ + NPC 战设    │     │ 储物袋/灵石    │
│ + 行动建议    │     │ 世界时间/地点  │
│ + 战斗触发    │     │ 主角血蓝状态   │
│              │     │ 周围人物列表   │
└──────────────┘     └──────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  应用状态更新   │
                    │  刷新 UI 面板   │
                    │  检查战斗触发   │
                    └───────────────┘
```

**分离原因**（从代码设计推断）：
- 剧情 AI 聚焦叙事质量，提示词偏创作导向
- 状态 AI 聚焦结构化数据提取，提示词偏规则/约束导向
- 分离后各自 prompt 更短、指令更聚焦，降低模型混淆
- 状态 AI 的输出可以被程序可靠解析（JSON 标签）

### 5.2 剧情 AI（story_generate.js）

**入口**：`MortalJourneyStoryChat.buildMessages()` 构建完整 OpenAI messages 数组

**消息拼装流程**：

```
buildMessages(fc, G, userText, priorStoryRaw)
  ├── 1. system 消息
  │     ├── 活跃预设（activePreset.systemPrompt，含模板变量填充）
  │     ├── 规则预设（9 个 STORY_RULE_PRESET_IDS 依次拼接）
  │     └── 世界书摘录（MortalJourneyWorldBook.selectEntries + formatForSystem）
  ├── 2. 历史对话轮次（从 G.chatHistory 截取最近 N 轮）
  │     ├── user 消息：用户原文
  │     └── assistant 消息：上次剧情 AI 原文（含标签）
  └── 3. 当前 user 消息
        ├── 用户输入正文
        ├── 运行时存档摘要（境界/面板/佩戴/功法/储物袋/世界因子）
        ├── 周围人物快照
        ├── 世界时间
        └── 战斗上下文（若有 pendingBattle）
```

**AI 输出标签**（由剧情 AI 在叙事中嵌入）：

| 标签 | 含义 |
|---|---|
| `<mj_story_body>...</mj_story_body>` | 叙事正文（必须） |
| `<mj_npc_story_hints>...</mj_npc_story_hints>` | NPC 故事线提示 |
| `<mj_action_suggestions>...</mj_action_suggestions>` | 四级行动建议（aggressive/neutral/cautious/veryCautious） |
| `<mj_battle_trigger>...</mj_battle_trigger>` | 战斗触发器（JSON 含 allies/enemies/triggerKind） |

### 5.3 状态 AI（state_generate.js）

**入口**：`MortalJourneyStateGenerate.sendTurn()` 发送状态同步请求

**AI 输出标签**（结构化 JSON）：

| 标签 | 内容格式 | 作用 |
|---|---|---|
| `<mj_world_state>` | `{"worldTimeString":"...", "currentLocation":"..."}` | 更新世界时间与地点 |
| `<mj_user_state>` | `{"currentHp": N, "currentMp": N}` | 更新主角血蓝 |
| `<mj_inventory_ops>` | `[{"op":"add"/"remove", "name":"...", "count":N, ...}]` | 储物袋物品增删 |
| `<mj_spirit_stone_ops>` | `[{"op":"add"/"remove", "name":"...", "count":N}]` | 灵石增删 |
| `<mj_item_add_ops>` | `[...]` | 精确物品添加（含属性/品阶） |
| `<mj_item_remove_ops>` | `[...]` | 精确物品移除 |
| `<mj_nearby_npcs>` | `[{...characterSheet...}]` | 周围人物完整列表替换 |
| `<mj_battle_trigger>` | `{"allies":[...], "enemies":[...], "triggerKind":"...", "triggerReason":"..."}` | 战斗触发 |

**状态 AI 规则模板**（`state_rules.js`）包含约 200 行的详细约束：
- 品阶与属性基准映射（下品→仙品，血量/法力/物攻/物防/法攻/法防/脚力/神识各有区间）
- 灵石价值映射（下品:10, 中品:100, 上品:1000, 极品:10000, 仙品:100000）
- 物品价值与品阶对应关系
- 突破丹药品阶→境界方向映射
- 交易结算硬约束（只有已结算才 remove 灵石）
- 物品类型分类（武器/法器/防具/载具/功法/丹药/突破丹药/材料/杂物）

### 5.4 新档门闩：4 阶段 Bootstrap Gate

新档首次进入主界面时，通过全屏门闩 UI 依次执行：

```
┌─────────────────────────────────────────────────────┐
│  Phase 1: openingStory（开局剧情 AI）                │
│  world_generate.js → runOpeningStoryStrictPromise()  │
│  生成第一段剧情正文，存入 chatHistory                  │
├─────────────────────────────────────────────────────┤
│  Phase 2: initState（开局配置 AI）                    │
│  init_state_generate.js → runInitStateAiIfNeeded()   │
│  根据剧情正文配置主角佩戴/功法/储物袋                   │
│  标签：<mj_inventory_ops> + <mj_world_state>          │
│        + <mj_init_loadout>                           │
├─────────────────────────────────────────────────────┤
│  Phase 3: stateSync（状态同步 AI）                    │
│  mainScreen_chat.js → runStateInventoryAiTurn()      │
│  根据剧情同步 NPC 列表与周围人物状态                   │
│  标签：<mj_nearby_npcs> + 全部状态标签                 │
├─────────────────────────────────────────────────────┤
│  Phase 4: 完成                                       │
│  finishBootstrapGateSuccess()                        │
│  隐藏门闩 UI、渲染面板、持久化快照                      │
└─────────────────────────────────────────────────────┘
```

每个阶段独立计时（显示开始/结束时间戳）、有状态指示器（等待中/执行中/成功/失败）、支持错误展示与重试（失败后点击「重试」重新执行完整 3 阶段管线）。

### 5.5 开局配置 AI（init_state_generate.js）

位于剧情与常态状态 AI 之间，职责单一：

- **输入**：开局剧情正文 + 命运抉择（出身/灵根/境界/世界因子）+ 开局配置规则
- **输出**：三对标签
  1. `<mj_inventory_ops>` — 储物袋初始物品
  2. `<mj_world_state>` — 世界时间/地点/年龄/初始血蓝
  3. `<mj_init_loadout>` — `{equippedSlots: [4], gongfaSlots: [8]}`
- **槽位约束**：武器位非空、功法至少 1 攻击+1 辅助、空位填 null
- **简化字段**：开局阶段品阶/名称/介绍为主，不强制属性数值（后续由 `PlayerBaseRuntime` 计算）

---

## 6. 标签协议：AI ↔ 引擎通信

### 6.1 协议设计原则

AI 不直接修改游戏状态，而是通过 XML 风格标签输出**结构化指令**，由 JavaScript 解析后执行：

```
AI 输出文本
    │
    ├── 叙事正文（直接展示给玩家）
    │
    └── <mj_*> 标签（程序解析，不可见）
          │
          ▼
    applyStateTurnFromAssistantText()
          │
          ├── 提取标签内容
          ├── JSON.parse() 解析
          ├── 校验字段类型
          ├── 写入 MortalJourneyGame
          └── 刷新 UI 面板
```

### 6.2 标签全集

**剧情 AI 输出标签**（嵌入叙事文本）：

| 标签 | 解析位置 |
|---|---|
| `<mj_story_body>...</mj_story_body>` | `story_generate.js` — 提取纯净叙事正文 |
| `<mj_npc_story_hints>...</mj_npc_story_hints>` | `story_generate.js` — NPC 故事线 |
| `<mj_action_suggestions>...</mj_action_suggestions>` | `mainScreen.js` — 四级行动建议按钮 |
| `<mj_battle_trigger>...</mj_battle_trigger>` | `mainScreen_chat.js` — 战斗触发检测 |

**状态 AI 输出标签**（独立于叙事外）：

| 标签 | 解析位置 |
|---|---|
| `<mj_world_state>...</mj_world_state>` | `state_generate.js` — 世界时间/地点写回 |
| `<mj_user_state>...</mj_user_state>` | `state_generate.js` — 主角血蓝写回 |
| `<mj_inventory_ops>...</mj_inventory_ops>` | `state_generate.js` — 储物袋增删 |
| `<mj_spirit_stone_ops>...</mj_spirit_stone_ops>` | `state_generate.js` — 灵石增删 |
| `<mj_item_add_ops>...</mj_item_add_ops>` | `state_generate.js` — 精确物品添加 |
| `<mj_item_remove_ops>...</mj_item_remove_ops>` | `state_generate.js` — 精确物品移除 |
| `<mj_nearby_npcs>...</mj_nearby_npcs>` | `state_generate.js` — 周围人物列表 |
| `<mj_battle_trigger>...</mj_battle_trigger>` | `state_generate.js` — 状态 AI 战斗触发 |

**开局配置 AI 独有标签**：

| 标签 | 解析位置 |
|---|---|
| `<mj_init_loadout>...</mj_init_loadout>` | `init_state_generate.js` — 主角初始佩戴/功法 |

### 6.3 标签解析策略

`state_generate.js` 中的 `applyStateTurnFromAssistantText()` 是状态应用的核心：

1. 正则提取每个标签对的内容
2. `JSON.parse()` 解析（容错处理畸形 JSON）
3. 逐项校验字段类型与值域
4. 调用 `MjMainScreenPanel` 的方法写回储物袋、灵石、NPC 列表
5. 检查战斗触发标签，若存在则调用 `MortalJourneyBattle.startBattle()`

---

## 7. 状态管理架构

### 7.1 全局状态树：MortalJourneyGame

`window.MortalJourneyGame` 是唯一的运行时状态容器，结构如下：

```javascript
MortalJourneyGame = {
  // === 命运抉择快照（来自启动页，只读） ===
  fateChoice: {
    realm: { major: "练气", minor: "初期" },
    linggen: "真灵根 金, 木",
    traits: [{ name: "...", desc: "...", bonus: {...} }],
    worldFactors: [{ name: "...", desc: "...", effect: "..." }],
    birthLocation: "黄枫谷",
    customBirth: { tag: "...", background: "...", realmMajor: "...", ... },
    playerBase: { hp: 200, mp: 50, patk: 15, pdef: 8, ... },
  },

  // === 运行时状态（可变） ===
  realm: { major: "练气", minor: "初期" },
  age: 16,
  shouyuan: 100,
  xiuwei: 0,                    // 累计修为
  cultivationProgress: 0,       // 当前境界修为进度百分比
  currentHp: 200,
  currentMp: 50,
  maxHp: 200,
  maxMp: 50,
  playerBase: { hp: 200, mp: 50, patk: 15, ... },
  lateStageBreakSuffix: null,   // 后期圆满/巅峰计数

  // === 装备与物品 ===
  equippedSlots: [              // 4 格：武器/法器/防具/载具
    { name: "青钢剑", type: "武器", grade: "下品", bonus: {...}, magnification: {...} },
    null, null, null
  ],
  gongfaSlots: [               // 8 格：功法
    { name: "青元剑诀", type: "攻击功法", grade: "下品", ... },
    null, ...
  ],
  inventorySlots: [            // 至少 12 格，4 列网格可扩容
    { name: "下品灵石", count: 50 },
    { name: "回春丹", count: 3, grade: "下品", type: "丹药" },
    null, ...
  ],

  // === 世界状态 ===
  currentLocation: "黄枫谷外门",
  worldTimeString: "0001年 01月 01日 08:00",
  worldTimeStack: [],           // 时间历史栈

  // === NPC 与交互 ===
  nearbyNpcs: [                 // 周围人物，每个为 characterSheet 格式
    { id: "npc_001", displayName: "王林", realm: {...}, playerBase: {...}, ... }
  ],
  chatHistory: [                // 对话历史
    { role: "user", content: "..." },
    { role: "assistant", content: "..." },
  ],
  chatActionSuggestions: {      // 行动建议
    aggressive: "主动出击",
    neutral: "静观其变",
    cautious: "小心试探",
    veryCautious: "暂避锋芒",
  },

  // === 战斗状态 ===
  pendingBattle: null,          // 待处理的战斗触发
  mjInitStateAiApplied: true,   // 开局配置 AI 是否已执行
};
```

### 7.2 状态变更流

```
用户输入 / AI 响应 / 战斗结算
        │
        ▼
  MainScreen API（mainScreen.js 对外暴露的方法）
        │
        ├── setLingShiCount(n)
        ├── setBagSlot(index, item)
        ├── setEquippedSlot(index, item)
        ├── setGongfaSlot(index, item)
        ├── setXiuwei(n)
        ├── setNearbyNpcs(list)
        ├── setCurrentLocation(label)
        │
        ▼
  MjMainScreenPanelRealm（数据逻辑层）
        │
        ├── 修改 MortalJourneyGame 字段
        ├── persistBootstrapSnapshot()  → 写入 sessionStorage + localStorage 镜像
        └── render*Panel()             → 刷新对应 DOM
```

### 7.3 持久化架构

**双层存储 + 自动保存**：

```
sessionStorage                      localStorage
─────────────────────────────      ─────────────────────────────
mortal_journey_bootstrap_v1        MJ_SAVES_INDEX_V1          ← 存档索引
  └── 当前会话的快照                   └── ["save_001", "save_002"]

                                   MJ_SAVE_V1:save_001        ← 存档槽
                                     └── 完整 MortalJourneyGame
                                   MJ_ACTIVE_SAVE_ID_V1       ← 当前活跃存档 ID

mortal_journey_last_session_v1     IMMORTAL_ST_BRIDGE_API_    ← API 覆盖配置
  └── sessionStorage 的镜像备份       OVERRIDE_V1

                                   IMMORTAL_ST_BRIDGE_        ← Bridge 预设
                                     PRESETS_V1
```

- **sessionStorage**（当前会话）：
  - `mortal_journey_bootstrap_v1`：启动页写入，主界面读取后作为运行时状态源
  - 每次 `persistBootstrapSnapshot()` 都会覆写此键
  
- **localStorage**（永久存档）：
  - `MJ_SAVES_INDEX_V1`：JSON 数组，存档 ID 列表
  - `MJ_SAVE_V1:{id}`：每个槽位存完整 `MortalJourneyGame` JSON
  - `mortal_journey_last_session_v1`：sessionStorage 的镜像备份，应对 sessionStorage 不可用场景

- **自动保存**：4 秒定时器（`setInterval 4000ms`）+ `beforeunload` 事件双重保障

---

## 8. 角色属性计算引擎

### 8.1 计算管线

`PlayerBaseRuntime.computePlayerBase()` 是整个角色系统的核心算法：

```
境界基础属性表 (RealmState.getBaseStats)
        │
        ▼
  ┌─────────────────────┐
  │ Step 1: 平面加成合并  │
  │                     │
  │ + 境界基础值          │
  │ + 难度修正            │
  │ + 出身 bonus         │
  │ + 天赋 bonus         │
  │ + 装备 bonus         │
  │   (佩戴栏 × 境界倍率) │
  │ + 功法 bonus         │
  │   (功法栏 × 境界倍率) │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │ Step 2: 灵根乘法     │
  │                     │
  │ 每种五行 × 境界倍率  │
  │ 金 → patk, matk    │
  │ 木 → sense          │
  │ 水 → mp             │
  │ 火 → hp             │
  │ 土 → pdef, mdef     │
  │                     │
  │ 练气: ×1.05         │
  │ 筑基: ×1.10         │
  │ 结丹: ×1.20         │
  │ 元婴: ×1.50         │
  │ 化神: ×2.00         │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │ Step 3: 收尾         │
  │                     │
  │ 八维取整 (Math.round)│
  │ 魅力/气运钳制 [0,100]│
  │ 血蓝初始化 = 上限    │
  └─────────────────────┘
```

### 8.2 境界基础属性表（realm_state.js）

| 境界 | HP | MP | 物攻 | 物防 | 法攻 | 法防 | 脚力 | 神识 |
|---|---|---|---|---|---|---|---|---|
| 练气初期 | 200 | 50 | 15 | 8 | 12 | 6 | 10 | 5 |
| 练气中期 | 350 | 80 | 25 | 14 | 20 | 10 | 18 | 8 |
| 练气后期 | 500 | 120 | 35 | 20 | 30 | 15 | 25 | 12 |
| 筑基初期 | 800 | 200 | 55 | 30 | 45 | 22 | 40 | 20 |
| 筑基中期 | 1200 | 300 | 80 | 45 | 70 | 35 | 60 | 30 |
| 筑基后期 | 1800 | 450 | 120 | 70 | 100 | 50 | 90 | 45 |
| 结丹初期 | 2800 | 700 | 180 | 100 | 150 | 75 | 140 | 70 |
| 结丹中期 | 3800 | 950 | 250 | 140 | 210 | 105 | 190 | 95 |
| 结丹后期 | 5000 | 1250 | 320 | 180 | 280 | 140 | 250 | 125 |
| 元婴初期 | 6500 | 1600 | 420 | 230 | 360 | 180 | 320 | 160 |
| 元婴中期 | 8000 | 2000 | 520 | 290 | 450 | 225 | 400 | 200 |
| 元婴后期 | 10000 | 2500 | 650 | 360 | 550 | 280 | 500 | 250 |
| 化神 | 15000 | 3500 | 900 | 500 | 750 | 380 | 700 | 350 |

### 8.3 装备境界倍率

装备/功法提供的属性加成乘以当前境界倍率后再合并：

| 境界 | 倍率 |
|---|---|
| 练气初期 | ×1.25 |
| 练气中期 | ×1.50 |
| 练气后期 | ×2.00 |
| 筑基初期 | ×2.50 |
| 筑基中期 | ×3.00 |
| 筑基后期 | ×3.50 |
| 结丹初期 | ×4.00 |
| 结丹中期 | ×5.00 |
| 结丹后期 | ×6.00 |
| 元婴初期 | ×7.00 |
| 元婴中期 | ×8.00 |
| 元婴后期 | ×9.00 |
| 化神 | ×10.00 |

### 8.4 NPC 属性计算

NPC 与主角共用同一套计算逻辑（`PlayerBaseRuntime.computePlayerBaseFromCharacterSheet()`）：

```
NPC characterSheet { realm, linggen?, traits[], equippedSlots[], gongfaSlots[] }
        │
        ▼
  构造伪 fateChoice + overrides
        │
        ▼
  computePlayerBase()  ← 与主角完全相同
        │
        ▼
  写回 characterSheet.playerBase / maxHp / maxMp
```

---

## 9. 战斗引擎架构

### 9.1 战斗流程

`MortalJourneyBattle.startBattle(payload)` 是战斗入口：

```
startBattle(payload)
  ├── 1. 构建参战单位列表
  │     ├── 主角（从 MortalJourneyGame 提取面板 + 佩戴 + 功法）
  │     ├── 友方 NPC（从 payload.allies 或 nearbyNpcs 中匹配）
  │     └── 敌方（从 payload.enemies characterSheet 构造）
  │
  ├── 2. 确定回合顺序：按 神识(sense) 降序排列
  │
  ├── 3. 战斗主循环 runCombat()（最多 500 回合）
  │     for each round:
  │       for each 存活单位 (按神识顺序):
  │         ├── pickBestGongfa(unit)     → 选择最优可用功法
  │         ├── performStrike(unit, target)
  │         │     ├── 功法攻击（消耗 MP）
  │         │     │     ├── 物攻伤害 = attacker.patk × 功法.物攻倍率 - defender.pdef
  │         │     │     └── 法攻伤害 = attacker.matk × 功法.法攻倍率 - defender.mdef
  │         │     ├── 武器普攻（无 MP 消耗，仅物攻）
  │         │     │     └── 伤害 = attacker.patk × weapon.物攻倍率 - defender.pdef
  │         │     └── 扣减 HP，判定击杀
  │         └── 检查胜负条件
  │
  ├── 4. 结算
  │     ├── lootDefeatedEnemyIntoBag()  → 战利品写入储物袋
  │     ├── applyResultToGame()         → 更新主角血蓝、NPC 状态
  │     └── 派发 mj:battle-finished 事件 → 触发自动剧情接续
  │
  └── 5. 渲染战斗日志到聊天区
```

### 9.2 伤害公式

```javascript
// 功法攻击
总伤害 = max(0, matk × 法攻倍率 - defenderMdef)  // 法攻部分
       + max(0, patk × 物攻倍率 - defenderPdef)  // 物攻部分

// 武器普攻（无 MP 消耗）
总伤害 = max(0, patk × 武器物攻倍率 - defenderPdef)
```

### 9.3 功法选择策略

`pickBestGongfa(unit)` 按以下优先级挑选：
1. 筛选 MP 足够的功法
2. 对零防目标计算技能分（skillScore = 预估伤害）
3. 选择技能分最高的功法
4. 若无可用功法，回退到武器普攻

### 9.4 战斗触发来源

战斗可由两个来源触发：
- **剧情 AI**：在叙事中输出 `<mj_battle_trigger>` 标签（主动战斗）
- **状态 AI**：在状态同步中输出 `<mj_battle_trigger>` 标签（被动遇敌）

`triggerKind` 区分 `"active"`（主动）和 `"passive"`（被动遇敌）。

### 9.5 战后自动接续

战斗结算后，`MJ_AUTO_STORY_AFTER_BATTLE` 控制是否自动发起新一轮 AI 回合：

```
mj:battle-finished 事件
        │
        ▼
  构建战后上下文（战斗日志 + pendingBattle 元信息）
        │
        ▼
  自动调用 Chat.handleChatSend() → 剧情 AI → 状态 AI
```

用户消息自动填充：
> 以上为程序给出的本场战斗结算与战时上下文（若有）。请据此直接写下衔接剧情：收束现场、伤势与气氛，勿改写胜负与伤害结论；文末照常输出 NPC 战设标签与四级行动建议。

---

## 10. 世界书系统

### 10.1 设计目的

在每次 AI 请求时，根据对话上下文中的关键词自动注入相关世界观条目，保持 AI 对修仙世界设定的一致性。

### 10.2 条目结构

```javascript
{
  id: "huangfenggu",
  name: "黄枫谷与越国七派",
  constant: false,            // true = 永远注入
  keys: ["黄枫谷", "越国七派", "升仙大会", "令狐老祖"],
  content: "黄枫谷为越国七派之一...",
  priority: 30,               // 数字越大越靠前
}
```

### 10.3 选择算法

```
selectEntries(scanText, options)
  ├── 扫描文本 = 用户输入 + 近期对话 + 状态摘要
  ├── 分离 constant 条目（永远入选）
  ├── 对非常量条目计算命中分
  │     └── scanText.toLowerCase() 中检查每个 key 是否出现
  ├── 排序：priority 降序 → hits 降序 → id 字典序
  ├── 去重后按序合并（constant 先于 triggered）
  └── 截断到 maxEntries（默认 8）
```

### 10.4 注入格式

```
【世界书摘录】

【修仙叙事基底】
天南、越国、元武国等为常见地域称谓...

· · · 条目分隔 · · ·

【黄枫谷与越国七派】
黄枫谷为越国七派之一...
```

### 10.5 桥接同步

`syncToBridgeStorage()` 将世界书条目写入 `localStorage` 键 `IMMORTAL_ST_BRIDGE_WORLDBOOKS_V1`，供 bridge.js 的 TavernHelper 使用（如果底层使用 SillyTavern 兼容前端）。

---

## 11. AI 预设系统

### 11.1 双层预设结构

```
preset_content.js（纯数据）          preset.js（逻辑层）
─────────────────────────          ──────────────────
MortalJourneyPresetContent   ←──   MortalJourneyAiPreset
  .presets[]                       ├── 解析预设列表
    ├── 剧情预设（system prompt）    ├── 分离规则预设 vs 剧情预设
    ├── outputFormat（输出格式）     ├── 模板变量填充 {{VAR}}
    ├── bagNarrative（储物袋叙事）   ├── 构建运行时 rules 列表
    ├── stuff_rules（物品规则）      └── 组装最终 system prompt
    ├── valueScale（价值尺度）
    ├── major_realm_breakthrough
    ├── npcStoryHints
    ├── npc_story_rules
    ├── action_suggestions
    └── story_snapshot
```

### 11.2 规则预设（STORY_RULE_PRESET_IDS）

9 个规则预设独立于剧情预设，始终拼接在 system prompt 尾部：

| 预设 ID | 用途 |
|---|---|
| `outputFormat` | XML 标签输出格式规范 |
| `bagNarrative` | 储物袋物品叙事规则 |
| `stuff_rules` | 物品/装备生成细节规则 |
| `valueScale` | 灵石/物品价值尺度参考 |
| `major_realm_breakthrough` | 大境界突破叙事规则 |
| `npcStoryHints` | NPC 故事线输出格式 |
| `npc_story_rules` | NPC 生成与行为规则 |
| `action_suggestions` | 行动建议输出规则 |
| `story_snapshot` | 故事快照/摘要规则 |

### 11.3 模板变量

`preset.js` 的 `fillTemplateVars()` 支持 `{{VARIABLE}}` 占位符替换，当前支持的变量：
- `{{TOTAL_SPIRIT_STONE_VALUE}}` — 背包灵石总价值
- `{{INVENTORY_SUMMARY}}` — 储物袋内容摘要
- `{{PLAYER_BASE_STATS}}` — 主角面板属性
- 其他运行时数据变量

---

## 12. API 桥接层

### 12.1 bridge.js 设计

`silly_tarven/bridge.js` 是一个独立的 OpenAI 兼容 API 客户端，设计为可脱离 mortal_journey 复用于其他 SillyTavern 前端项目。

**核心能力**：
- OpenAI `/v1/chat/completions` 兼容 API 调用
- 支持流式（SSE）与非流式两种模式
- API 配置三级优先级：
  1. localStorage `API_OVERRIDE_KEY`（用户在启动页设置的覆盖配置，优先级最高）
  2. `FIXED_PRESET`（代码内写死的默认配置）
  3. `DEFAULT_CFG.defaultPresetTemplate`（兜底模板）

**超时配置**：
- 非流式：300 秒
- 流式 chunk 间隔：300 秒
- 流式最大总时长：300 秒

### 12.2 TavernHelper 接口

bridge.js 对外暴露 `SillyTavernBridge`（别名 `TavernHelper`）：

```javascript
TavernHelper.generateFromMessages({
  messages: [...],           // OpenAI 格式消息数组
  onChunk: function(text) {}, // 流式回调（可选）
  signal: AbortSignal,       // 取消信号（可选）
})
// 返回 Promise<{ text: string }>
```

---

## 13. UI 渲染架构

### 13.1 面板分层

UI 代码分为两层，以境界面板模块为例：

```
mainScreen_panel_realm.js（数据逻辑层）
  └── MjMainScreenPanelRealm
      ├── STORAGE_KEY, SAVE_INDEX_KEY, SAVE_PREFIX
      ├── EQUIP_SLOT_COUNT(4), GONGFA_SLOT_COUNT(8), INVENTORY_SLOT_COUNT(12)
      ├── REALM_EQUIP_BONUS_RATIO_MAP
      ├── 灵石炼化计算（spirit stone absorption）
      ├── 境界突破判定（applyRealmBreakthroughs）
      ├── 储物袋操作（add/remove/stack/normalize）
      ├── NPC 列表合并去重
      ├── 功法装卸逻辑
      └── 存档管理（save/load/delete）

mainScreen_panel_inventory_ui.js（UI 渲染层）
  └── MjMainScreenPanel
      ├── renderLeftPanel()         → 左栏：境界/修为/灵根/魅力气运
      ├── renderInventorySlots()    → 储物袋网格
      ├── renderGongfaGrid()        → 功法网格
      ├── renderNearbyNpcsPanel()   → 右栏：周围人物
      ├── renderBootstrapOverview() → 开局总览
      ├── renderBagSlots()          → 背包格子
      ├── bindTraitDetailModalUi()  → 天赋详情弹窗
      ├── bindGongfaBagDetailUi()   → 功法/物品详情弹窗
      ├── bindNpcDetailModalUi()    → NPC 详情弹窗
      └── bindMajorBreakthroughUi() → 大境界突破弹窗
```

### 13.2 渲染策略

- **全量重绘**：每次数据变更后，调用完整的 `render*` 函数重新生成 DOM
- **innerHTML 替换**：面板内容通过设置容器 `innerHTML` 实现更新（非虚拟 DOM diff）
- **数据驱动**：渲染函数无副作用（不修改数据），只读取 `MortalJourneyGame` 生成 HTML

### 13.3 弹窗系统

多个模态弹窗共用一个 body overflow 控制：

```
弹窗打开 → document.body.style.overflow = "hidden"
弹窗关闭 → mjClearBodyOverflowIfNoModal()
           → 检查所有弹窗 DOM 是否隐藏
           → 全部隐藏时恢复 body overflow
```

### 13.4 手机端适配

- 左右侧栏通过 CSS class `mj-mobile-open` 控制滑入/滑出
- `Escape` 键关闭所有移动面板
- 聊天建议区域可折叠（toggle 按钮）

---

## 14. 修为与突破系统

### 14.1 修为获取

修为通过**炼化灵石**获得：

```
单件修为 = 灵石基准值 × 灵根效率系数

灵石基准值：下品 10, 中品 100, 上品 1000, 极品 10000, 仙品 100000
灵根效率系数：
  - 单灵根/无灵根: ×1.00
  - 双灵根: ×0.50
  - 三灵根: ×0.33
  - 四灵根及以上: ×0.25
```

品阶间有硬兑换比例（下品:10, 中品:100, 上品:1000, 极品:10000, 仙品:100000），但代码中灵石品阶间无自动兑换/找零机制，由 AI 在状态回合中通过 add/remove 完成"兑换"操作。

### 14.2 境界晋升

**小境界突破**（自动）：
- 修为达到当前阶段需求时自动晋升
- 练气初期(100)→中期(200)→后期(1000)→筑基初期(2000)→...→化神(10,000,000)
- 无失败惩罚

**大境界突破**（手动 + 概率）：
- 后期修为满后，点击左栏「突破」按钮触发
- 弹窗内可消耗突破丹药增加成功率
- 基础概率：
  - 练气→筑基：50%
  - 筑基→结丹：30%
  - 结丹→元婴：20%
  - 元婴→化神：10%
- 突破丹药品阶加成：
  - 中品（练气→筑基）：+10~15%
  - 上品（筑基→结丹）：+15~20%
  - 极品（结丹→元婴）：+20~25%
  - 仙品（元婴→化神）：+25~30%
- 失败惩罚：修为回落至当前阶段需求的 80%

### 14.3 后期巅峰/圆满

练气/筑基/结丹/元婴后期满修为后，突破失败计入 `lateStageBreakSuffix`：
- `failCount = 0` → 显示"*圆满"
- `failCount ≥ 1` → 显示"*巅峰"

---

## 15. 关键设计决策与权衡

### 15.1 ES5 + IIFE（非 ES Module）

**决策**：全部代码使用 ES5 语法 + IIFE 模块模式，不依赖任何构建工具。

**原因**（从代码特征推断）：
- 零构建成本：HTML 直接 `<script>` 引用即可运行
- 兼容旧浏览器（如微信内置浏览器）
- 适合 GitHub Pages 等静态托管，无需 CI/CD 构建步骤

**代价**：
- 全局命名空间污染风险（依赖约定避免冲突）
- 隐式依赖顺序（必须手动管理 `<script>` 加载顺序）
- 无 Tree-shaking，所有代码全量加载
- 模块间无法静态分析依赖关系

### 15.2 全局状态单例（非 Redux/Context）

**决策**：使用单一全局对象 `window.MortalJourneyGame`，不做状态管理抽象。

**原因**：
- 项目规模适中，状态结构清晰
- 避免引入状态管理库的复杂度
- 序列化/反序列化简单（`JSON.stringify/parse` 直接存档）
- 跨模块访问零成本（无需 prop drilling 或 context）

**代价**：
- 任何模块可修改任何字段，缺乏写保护
- UI 重绘依赖手动调用 render 函数，无自动响应式更新
- 多人协作时容易冲突

### 15.3 AI 双回合分离

**决策**：剧情生成与状态同步分为两次独立 API 调用。

**原因**：
- 单一职责：剧情 AI 只需关注叙事质量，状态 AI 只需关注结构化数据提取
- Prompt 精简：每个 AI 的指令集更短、更聚焦
- 容错性：状态解析失败不影响剧情展示，可重试
- 模型选择灵活：理论上剧情可用强模型，状态可用弱模型（当前共用同一模型）

**代价**：
- 每次玩家输入触发 2 次 API 调用，延迟翻倍
- Token 消耗增加（两端各有独立的 system prompt）
- 剧情与状态可能不一致（需靠 prompt 约束对齐）

### 15.4 XML 标签协议（非 Function Calling）

**决策**：AI 通过 XML 风格标签输出结构化数据，而非 OpenAI Function Calling / JSON Mode。

**原因**：
- 模型无关：任何 OpenAI 兼容模型均支持，不依赖特定 API 功能
- 可嵌入叙事：标签可自然嵌入在叙事正文中（如 `<mj_battle_trigger>` 在剧情中）
- 人类可读：标签文本在聊天日志中清晰可辨，便于调试
- 渐进式解析：正则提取容错性好，部分标签失败不影响其他标签

**代价**：
- 模型可能输出畸形 XML（闭合标签遗漏、嵌套错误）
- JSON 在 XML 内的转义处理复杂
- 需要正则提取 + JSON.parse 两步解析，增加失败点
- 模型的 XML 格式遵循度不如 JSON Mode 稳定

### 15.5 DOM 全量重绘（非虚拟 DOM）

**决策**：面板更新采用 innerHTML 全量替换，不做增量 diff。

**原因**：
- 面板数据量小（几十个格子），全量重绘性能足够
- 代码简单直观，无虚拟 DOM 学习成本
- 避免状态与 DOM 不同步的 bug

**代价**：
- 输入框焦点、滚动位置等 DOM 状态可能在重绘时丢失（需手动恢复）
- 弹窗等交互中重绘会导致状态错乱（通过条件判断避免）

### 15.6 灵石炼化灵根效率递减

**决策**：多灵根角色炼化灵石时修为获取效率递减（单灵根 100% → 五灵根 25%）。

**设计意图**：
- 模拟修仙设定：多灵根修炼更慢（灵力分散）
- 游戏平衡：单灵根天资好但手段单一，多灵根手段多但升级慢
- 鼓励策略选择：玩家在灵根生成时面临"天资 vs 多样性"的权衡

### 15.7 储物袋禁止堆叠物品

**决策**：`妖兽内丹` 等特定物品设为 `BAG_UNIQUE_STACK_ITEM_NAMES`，每件独立占格。

**原因**：
- 模拟游戏内逻辑：每颗内丹来源不同（不同妖兽），属性各异
- 避免 AI 在状态回合中错误合并不同来源的物品

### 15.8 无后端架构

**决策**：所有游戏逻辑在浏览器端执行，API 密钥存于 localStorage。

**影响**：
- 用户需自带 OpenAI API Key
- 存档数据在本地，无账号系统/云同步
- 无服务端校验，存档可被用户任意修改
- 零服务器成本，适合 GitHub Pages 部署

---

## 16. 数据流全景图

```
                    ┌──────────────────────┐
                    │   localStorage        │
                    │   API_OVERRIDE_V1     │
                    └──────────┬───────────┘
                               │ 读取 API 配置
                               ▼
┌──────────────────────────────────────────────────────────┐
│                   silly_tarven/bridge.js                  │
│                   TavernHelper / SillyTavernBridge        │
│                   generateFromMessages()                  │
└──────┬──────────────────────────────────────┬────────────┘
       │ 剧情 AI 请求                          │ 状态 AI 请求
       ▼                                       ▼
┌──────────────────┐                  ┌──────────────────┐
│ story_generate.js│                  │ state_generate.js│
│ buildMessages()  │                  │ sendTurn()       │
│  ├── preset      │                  │ applyStateTurn   │
│  ├── worldbook   │                  │ FromAssistantText│
│  ├── chatHistory │                  │  ├── 标签提取     │
│  └── runtimeState│                  │  ├── JSON 解析   │
└──────┬───────────┘                  │  └── 写回 G 对象  │
       │ 叙事正文                      └──────┬───────────┘
       │ + 标签                               │
       ▼                                       ▼
┌──────────────────────────────────────────────────────────┐
│                   MortalJourneyGame                       │
│  realm, xiuwei, currentHp, equippedSlots,                 │
│  gongfaSlots, inventorySlots, nearbyNpcs, chatHistory     │
└──┬────────┬──────────┬──────────┬──────────┬─────────────┘
   │        │          │          │          │
   ▼        ▼          ▼          ▼          ▼
┌─────┐ ┌─────┐  ┌──────────┐ ┌──────┐ ┌──────────┐
│左栏 │ │聊天 │  │ 储物袋    │ │功法  │ │ NPC 面板  │
│面板 │ │区域 │  │ 网格      │ │网格  │ │          │
└─────┘ └─────┘  └──────────┘ └──────┘ └──────────┘
   ▲        ▲          ▲          ▲          ▲
   └────────┴──────────┴──────────┴──────────┘
           MjMainScreenPanel (渲染层)
```

---

## 17. 模块依赖矩阵

```
                    数据层          引擎层          AI层          UI层
                    realm leegen mjCfg player battle sheet  story state world init  panel chat mainScreen
character_attribute   -     -     -     -      -     -       -     -     -    -      -     -     -
realm_state           -     -     -     -      -     -       -     -     -    -      -     -     -
leegen_state          -     -     -     -      -     -       -     -     -    -      -     -     -
mjCreationConfig      -     -     -     -      -     -       -     -     -    -      -     -     -
player_base_runtime   ✓     ✓     ✓     -      -     -       -     -     -    -      -     -     -
mj_character_sheet    -     -     -     ✓      -     -       -     -     -    -      -     -     -
mortal_journey_battle -     -     ✓     ✓      -     ✓       -     -     -    -      -     -     -
world_book            -     -     -     -      -     -       -     -     -    -      -     -     -
preset                -     -     -     -      -     -       -     -     -    -      -     -     -
story_generate        -     ✓     ✓     ✓      -     -       ✓     -     -    -      -     -     -
state_generate        -     ✓     -     ✓      -     ✓       -     ✓     -    -      -     -     -
world_generate        -     ✓     -     -      -     -       -     -     ✓    -      -     -     -
init_state_generate   -     -     -     ✓      -     -       -     -     ✓    ✓      -     -     -
mainScreen_panel_*    ✓     ✓     ✓     ✓      -     ✓       -     -     -    -      -     -     -
mainScreen_chat       -     -     -     -      ✓     -       ✓     ✓     -    -      ✓     -     -
mainScreen            -     -     -     -      -     -       -     ✓     ✓    ✓      ✓     ✓     -
```

注：`✓` 表示存在运行时读取依赖（通过全局命名空间访问）。

---

*文档基于 2026-06-18 代码快照分析。架构细节以实际代码为准。*
