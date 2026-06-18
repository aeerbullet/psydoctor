# mortal_journey（凡人修仙传）需求文档

## 项目概述

**凡人修仙传** 是一个基于浏览器的纯前端 AI 文字修仙 RPG 游戏。核心玩法、存档、战斗与面板逻辑均在浏览器内运行，通过 OpenAI 兼容接口调用大模型生成剧情与世界状态，无需自建游戏后端。

- **版本：** V1.6.0
- **仓库：** https://github.com/Wangkkkkkkkk/mortal_journey
- **在线试玩：** https://wangkkkkkkkk.github.io/mortal_journey/
- **测试模型：** gemini-3-flash-preview
- **技术栈：** 纯静态 HTML/CSS/JavaScript（ES5 兼容，IIFE 模块模式）
- **外部依赖：** Font Awesome 6.0 CDN

---

## 1. 系统架构

### 1.1 页面结构

```
index.html (启动页/命运抉择)
    │
    ▼
main.html (主游戏界面)
```

### 1.2 模块依赖关系

```
index.html 加载顺序：
  logPanel.js → trait_samples.js → spirit_stone.js → mjCreationConfig.js
  → realm_state.js → leegen_state.js → player_base_runtime.js

main.html 加载顺序：
  logPanel.js → mainScreen_panel_realm.js → mainScreen_panel_inventory_ui.js
  → mainScreen_chat.js → mainScreen.js
```

### 1.3 全局命名空间（window 对象挂载）

| 全局变量 | 来源文件 | 用途 |
|----------|----------|------|
| `MortalJourneyGame` | 运行时创建 | 游戏主状态对象 |
| `MjCreationConfig` | `js/data/mjCreationConfig.js` | 开局配置（出身、灵根、天赋、物品/功法描述表） |
| `RealmState` | `js/data/realm_state.js` | 境界基础属性表、修为需求表、寿元表、突破概率 |
| `LinggenState` | `js/data/leegen_state.js` | 灵根五行倍率表 |
| `MjTraitSamples` | `js/data/trait_samples.js` | 天賦词条池（148 条） |
| `MjDescribeSpiritStones` | `js/data/spirit_stone.js` | 灵石品阶与价值表 |
| `PlayerBaseRuntime` | `js/game/player_base_runtime.js` | 角色属性计算引擎（平面加成 + 灵根乘法） |
| `MjCharacterSheet` | `js/game/mj_character_sheet.js` | 角色属性单规范（主角/NPC 共用） |
| `MortalJourneyBattle` | `js/game/mortal_journey_battle.js` | 回合制战斗引擎 |
| `MortalJourneyAiPreset` | `js/worldbook/preset.js` | 剧情 AI 预设/规则管理 |
| `MortalJourneyPresetContent` | `js/worldbook/preset_content.js` | 预设数据 |
| `MortalJourneyWorldBook` | `js/worldbook/world_book.js` | 世界书（关键词触发上下文注入） |
| `MortalJourneyWorldBookEntries` | `js/worldbook/world_book_entries.js` | 世界书条目数据 |
| `MortalJourneyStateRules` | `js/worldbook/state_rules.js` | 状态 AI 规则模板 |
| `MortalJourneyInitStateRules` | `js/worldbook/init_state_rules.js` | 开局配置 AI 规则模板 |
| `MortalJourneyWorldGenerate` | `js/ai_server/world_generate.js` | 开局剧情 AI 生成 |
| `MortalJourneyInitStateGenerate` | `js/ai_server/init_state_generate.js` | 开局配置 AI 生成（装备/功法/储物袋） |
| `MortalJourneyStateGenerate` | `js/ai_server/state_generate.js` | 状态 AI 生成（NPC/储物/世界/主角状态同步） |
| `MortalJourneyStoryGenerate` | `js/ai_server/story_generate.js` | 剧情对话 AI 生成 |
| `MjMainScreenPanel` | `js/ui/mainScreen_panel_realm.js` + `mainScreen_panel_inventory_ui.js` | 主界面面板渲染与逻辑 |
| `MjMainScreenChat` | `js/ui/mainScreen_chat.js` | 聊天 UI 与 AI 回合调度 |
| `MainScreen` | `js/ui/mainScreen.js` | 主界面对外 API |
| `SillyTavernBridge` | `silly_tarven/bridge.js` | OpenAI 兼容 API 调用桥接层 |
| `GameLog` | `js/log/logPanel.js` | 调试日志面板 |

---

## 2. 启动页（index.html）

### 2.1 启动画面

三个按钮：
1. **开始新人生** → 进入命运抉择页面
2. **读取人生** → 从 localStorage 读档，直接进入 `main.html`
3. **API 设置** → 弹窗配置 API URL、API Key、Model（存入 localStorage 键 `IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1`）

### 2.2 API 设置弹窗

- 仅存储到浏览器 localStorage，不上传服务器
- 支持 OpenAI 兼容格式 API
- 字段：`apiUrl`, `apiKey`, `model`
- 存储键：`IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1`

### 2.3 命运抉择（角色创建）

#### 出身选择
| 出身 | bonus | 位置 | 特点 |
|------|-------|------|------|
| 凡人 | 气运+5 | 凡人家庭 | 从未接触修仙界，未来充满可能 |
| 黄枫谷弟子 | 法力+10, 神识+5 | 黄枫谷外门 | 越国七大宗门之一，以剑修传承闻名 |
| 自定义 | 无预设bonus | 可自由填写 | 自由定义出身背景、宗门、境界等 |

**自定义出身字段：**
- `tag`：标签名
- `name`：名称
- `location`：地点
- `realmMajor` / `realmMinor`：初始境界（默认练气初期）
- `realmText`：境界文本
- `background`：背景描述（支持灌顶/夺舍等特殊设定以打破年龄限制）

#### 灵根系统

**灵根类型：**
- 天灵根（1 种五行）— 修炼速度最快，创建消耗 50
- 真灵根（2-3 种五行）— 中等，创建消耗 20
- 伪灵根（4 种五行）— 最慢，创建消耗 5
- 无灵根 — 消耗 0

**五行元素池：** 金、木、水、火、土

**灵根倍率表（LinggenState）：**
- 练气期天灵根倍率最高，伪灵根最低
- 大境界越高，灵根倍率差异越大
- 化神期：天灵根 3.5x → 伪灵根 0.7x

#### 天赋词条（逆天改命）

- 从 148 条预设词条中随机抽取展示
- 天赋已改为纯叙事/标签（不提供属性 bonus）

#### 世界因子

- 可选的世界设定因素，影响 AI 叙事方向
- 支持自定义世界因子（name、desc、effect）

### 2.4 存档系统

**存储位置：** 浏览器 localStorage

**存档键：**
- `MJ_SAVES_INDEX_V1`：存档索引
- `MJ_SAVE_V1:{saveId}`：单个存档
- `MJ_ACTIVE_SAVE_ID_V1`：当前活跃存档 ID
- `mortal_journey_bootstrap_v1`：启动快照（sessionStorage）
- `mortal_journey_last_session_v1`：上局镜像

**存档流程：**
1. 命运抉择完成后将命运选择存入 sessionStorage
2. 跳转 `main.html` 后从 sessionStorage 恢复
3. 游戏每 4 秒自动保存到 localStorage
4. 页面关闭前（beforeunload）触发保存
5. 新档先存临时标记，门闩管线全部成功后转为正式存档

---

## 3. 主游戏界面（main.html）

### 3.1 布局结构

```
┌──────────────────────────────────────────────────┐
│ 顶部栏：凡人修仙传 标题                             │
├──────────┬───────────────────┬────────────────────┤
│ 左侧：    │ 中央：             │ 右侧：              │
│ 角色信息  │ 主线剧情/对话区     │ 周围人物列表        │
│ - 名称   │                   │ - 当前地点          │
│ - 立绘   │ [聊天消息流]       │ - NPC 卡片          │
│ - 境界   │                   │   (名称/境界/好感   │
│ - 修炼进度│                   │    身份/目标/爱好   │
│ - 性别   │                   │    恐惧/性格等)     │
│ - 灵根   │                   │                    │
│ - 年龄   │                   │                    │
│ - 寿元   │                   │                    │
│ - 天赋   │                   │                    │
│ - 储物袋 │                   │                    │
│ - 装备栏 │                   │                    │
│ - 功法栏 │                   │                    │
│ - 面板属性│                   │                    │
├──────────┴───────────────────┴────────────────────┤
│ 底部：输入栏 + 发送按钮 + 行动建议按钮              │
└──────────────────────────────────────────────────┘
```

### 3.2 左侧角色面板

**显示信息：**
- 角色名（竖向排列）
- 角色立绘（默认占位符）
- 境界（如"练气初期"）
- 修炼进度条（百分比 + 突破按钮）
- 性别、灵根
- 年龄、寿元
- 天赋词条（可点击查看详情弹窗）

**储物袋（12 格起，可扩行，每行 4 格）：**
- 物品显示：名称、数量、图标
- 灵石堆叠显示
- 点击物品弹出详情（名称、介绍、品阶、类型、灵石等价价值）
- 点击"使用"按钮消耗灵石增加修为
- 点击"穿戴"按钮装备到对应槽位
- 点击"功法学习"按钮装载到功法栏

**佩戴栏（4 格）：**
- 武器（索引 0）
- 法器（索引 1）
- 防具（索引 2）
- 载具（索引 3）
- 每格可点击卸下到储物袋

**功法栏（12 格，3×4 网格）：**
- 显示功法名称
- 每格可点击卸下到储物袋
- 可查看功法详情弹窗（类型、品阶、消耗法力、倍率）

**面板属性：**
- 血量（当前/上限）
- 法力（当前/上限）
- 物攻、物防、法攻、法防、神识、脚力
- 魅力、气运

### 3.3 右侧周围人物面板

- 显示当前地点
- NPC 卡片列表（可切换可见性）
- 点击 NPC 打开详情弹窗（id、姓名、境界、性别、灵根、年龄、寿元、身份、当前目标、长期目标、爱好、恐惧、性格、好感度）
- NPC 死亡标记（阵亡后灰色显示）
- 手机端切换按钮

### 3.4 中央聊天区

- 消息气泡（用户/助手/AI 状态消息）
- 行动建议按钮（激进/中立/保守/最保守），可展开
- 输入框支持 Shift+Enter 换行、Enter 发送
- 发送后触发"剧情 AI → 状态 AI"双回合管线
- 状态栏显示当前 AI 请求状态和耗时

---

## 4. AI 回合管线

### 4.1 新档门闩管线（Bootstrap Gate）

新档首次进入主界面时执行严格的四阶段管线：

```
Phase 1: 开局剧情 AI (openingStory)
    ↓
Phase 2: 开局配置 AI (initState) — 写回主角装备/功法/储物袋
    ↓
Phase 3: 状态同步 AI (stateSync) — 对齐 NPC 与环境
    ↓
完成：隐藏门闩，渲染界面
```

**容错：**
- 每阶段失败可重试或返回命运抉择
- 门闩页面显示每阶段耗时和状态（等待中/执行中/成功/失败/已跳过）

### 4.2 常规回合管线

玩家输入 → 剧情 AI → 状态 AI 的串联流程：

```
玩家发送消息
    ↓
[剧情 AI] MortalJourneyStoryGenerate.sendTurn()
  - 拼装 messages：
    · system prompt（来自 AiPreset + 世界书匹配条目 + 运行时规则）
    · 历史对话 chatHistory
    · 用户消息（可附加状态快照）
  - 调用 TavernHelper.generateFromMessages()
  - AI 返回剧情文本（可包含 <mj_battle_trigger> 战斗触发标签）
    ↓
[状态 AI] MortalJourneyStateGenerate.sendTurn()
  - 拼装 messages：
    · system: 状态规则模板
    · user: 状态快照（世界时间/当前地点 + 佩戴栏 + 功法栏 + 储物袋 + 周围人物 + 境界词典 + 功法目录 + 物品目录 + 剧情正文 + 补充说明）
  - AI 返回结构化标签（<mj_world_state>、<mj_user_state>、<mj_ops>、<mj_nearby_npcs>）
    ↓
applyStateTurnFromAssistantText() 解析标签并更新游戏状态
    ↓
渲染界面
```

### 4.3 剧情 AI 标签输出

剧情 AI 的 assistant 回复可包含：

| 标签 | 用途 |
|------|------|
| `<mj_battle_trigger>` | 触发战斗（内含 allies/enemies JSON） |
| `<mj_action_suggestions>` | 四级行动建议（激进/中立/保守/最保守，每条 ≤10 字） |
| `<mj_npc_story_modifiers>` | NPC 剧情修正（好感变化等） |

### 4.4 状态 AI 标签输出

状态 AI 的 assistant 回复必须包含：

| 标签 | 用途 | 格式 |
|------|------|------|
| `<mj_world_state>` | 世界时间 + 当前地点 | JSON `{worldTimeString, currentLocation}` |
| `<mj_user_state>` | 主角血量/法力 | JSON `{currentHp, currentMp}` |
| `<mj_ops>` | 储物袋操作 | JSON 数组 `[{op, name, count}]` |
| `<mj_item_add>` | 物品获得 | JSON 数组 `[{type, name, intro, grade, count}]` |
| `<mj_item_remove>` | 物品移除 | JSON 数组 `[{name, count}]` |
| `<mj_nearby_npcs>` | 周围人物完整列表 | JSON 数组（含 id,displayName,realm,linggen,traits,playerBase 等） |

### 4.5 世界书（World Book）系统

**机制：** 从用户输入 + 近期对话中扫描关键词，命中后注入对应的世界设定条目到 system prompt。

**条目属性：**
- `id`：唯一标识
- `name`：注入时的标题
- `constant`：true = 每次请求都带上（如修仙叙事基底）
- `keys`：触发关键词数组
- `content`：注入正文
- `priority`：优先级（数字越大越靠前）

**当前条目（5 条）：**
1. 修仙叙事基底（constant）— 天南/越国/元武国等地名、修仙常识
2. 黄枫谷与越国七派 — 触发词：黄枫谷、越国七派、升仙大会、令狐老祖
3. 太南小会 — 触发词：太南小会、坊市、散修
4. 灵根与五行 — 触发词：灵根、天灵根、伪灵根、五行、金丹
5. 丹药与突破 — 触发词：筑基丹、丹药、闭关、突破、瓶颈

**选择逻辑：**
- constant 条目优先（按 priority 排序）
- 触发条目其次（按 priority → hits 数量排序）
- 最大条目数默认 8
- 去重（同 id 只取一次）

---

## 5. 角色属性计算系统

### 5.1 计算流程

```
境界表底数 (RealmState.getBaseStats)
    ↓ 平面加法阶段
  + 难度 bonus (DIFFICULTIES[difficulty].bonus)
  + 出身 bonus (BIRTHS[birth].bonus)
  + 出身 stuff bonus（装备/物品固有加成）
  + 功法栏 bonus × 境界装备倍率 (REALM_EQUIP_BONUS_RATIO_MAP)
  + 佩戴栏 bonus × 境界装备倍率
    ↓ 灵根乘法阶段
  × 灵根五行倍率 (LinggenState.applyToBase)
    ↓ 最终化
  八维取整 + 魅力/气运钳制 [0, 100]
```

### 5.2 境界装备倍率表（REALM_EQUIP_BONUS_RATIO_MAP）

| 境界 | 倍率 |
|------|------|
| 练气初期 | 1.25 |
| 练气中期 | 1.5 |
| 练气后期 | 2.0 |
| 筑基初期 | 2.5 |
| 筑基中期 | 3.0 |
| 筑基后期 | 3.5 |
| 结丹初期 | 4.0 |
| 结丹中期 | 5.0 |
| 结丹后期 | 6.0 |
| 元婴初期 | 7.0 |
| 元婴中期 | 8.0 |
| 元婴后期 | 9.0 |
| 化神 | 10.0 |

此倍率同时影响装备/功法 bonus 和攻击功法法力消耗。

### 5.3 八维属性

`hp`(血量), `mp`(法力), `patk`(物攻), `pdef`(物防), `matk`(法攻), `mdef`(法防), `foot`(脚力), `sense`(神识)

外加特殊属性：`charm`(魅力), `luck`(气运)，范围 [0, 100]，不参与灵根乘法。

### 5.4 境界基础属性表

| 境界 | HP | MP | 物攻 | 物防 | 法攻 | 法防 | 脚力 | 神识 |
|------|-----|-----|------|------|------|------|------|------|
| 练气初期 | 200 | 50 | 10 | 5 | 20 | 5 | 5 | 10 |
| 练气中期 | 300 | 75 | 15 | 5 | 30 | 5 | 5 | 20 |
| 练气后期 | 400 | 100 | 20 | 5 | 40 | 5 | 5 | 30 |
| 筑基初期 | 600 | 150 | 30 | 10 | 60 | 10 | 20 | 50 |
| 筑基中期 | 700 | 175 | 35 | 10 | 70 | 10 | 20 | 70 |
| 筑基后期 | 800 | 200 | 40 | 10 | 80 | 10 | 20 | 90 |
| 结丹初期 | 1000 | 250 | 50 | 20 | 100 | 20 | 50 | 120 |
| 结丹中期 | 1300 | 325 | 65 | 20 | 130 | 20 | 50 | 150 |
| 结丹后期 | 1600 | 400 | 80 | 20 | 160 | 20 | 50 | 180 |
| 元婴初期 | 2000 | 500 | 100 | 50 | 200 | 50 | 100 | 230 |
| 元婴中期 | 4000 | 1000 | 200 | 50 | 400 | 50 | 100 | 280 |
| 元婴后期 | 6000 | 1500 | 300 | 50 | 600 | 50 | 100 | 330 |
| 化神 | 10000 | 2500 | 500 | 100 | 1000 | 100 | 200 | 400 |

### 5.5 修为与突破

**修为需求表（CULTIVATION_TABLE）：**

| 境界 | 所需修为 |
|------|----------|
| 练气初期 | 100 |
| 练气中期 | 200 |
| 练气后期 | 1,000 |
| 筑基初期 | 2,000 |
| 筑基中期 | 5,000 |
| 筑基后期 | 10,000 |
| 结丹初期 | 20,000 |
| 结丹中期 | 50,000 |
| 结丹后期 | 100,000 |
| 元婴初期 | 200,000 |
| 元婴中期 | 500,000 |
| 元婴后期 | 1,000,000 |
| 化神 | 10,000,000 |

**突破机制：**
- 小境界：修为达到阈值自动晋升
- 大境界：修为满后显示"突破"按钮 → 弹窗确认 → 掷骰判定
- 突破丹药可用以提升成功率

**大境界突破成功率：**
| 突破 | 概率 |
|------|------|
| 练气 → 筑基 | 50% |
| 筑基 → 结丹 | 30% |
| 结丹 → 元婴 | 20% |
| 元婴 → 化神 | 10% |

失败后果：修为保留，但失去突破机会（可重试）。

**寿元表：**
| 境界 | 寿元（岁） |
|------|-----------|
| 练气初期-后期 | 100-120 |
| 筑基初期-后期 | 200-250 |
| 结丹初期-后期 | 500-600 |
| 元婴初期-后期 | 1000-1500 |
| 化神 | 2000 |

**年龄叙事下限：** 练气≥16、筑基≥100、结丹≥200、元婴≥500、化神≥1000

---

## 6. 战斗系统

### 6.1 触发方式

- 玩家输入检测战斗意图关键词（战斗/对战/交手/开打/动手/击杀/...）
- 剧情 AI 输出 `<mj_battle_trigger>` 标签
- 状态 AI 可补充 allies/enemies 信息
- 全局事件 `mj:battle-triggered` → 调用 `MortalJourneyBattle.startBattle(payload)`

### 6.2 战斗数据

**payload 结构：**
```json
{
  "allies": [{ "displayName": "", "roleHint": "主角" }],
  "enemies": [{ "displayName": "" }],
  "triggerKind": "active|passive",
  "triggerReason": "",
  "worldTimeString": "",
  "currentLocation": ""
}
```

### 6.3 战斗规则

**参战方：**
- 默认主角为 ally 方，主角名从 fateChoice.playerName 获取
- NPC 参战方从 G.nearbyNpcs 按 displayName 匹配（优先 id+姓名 → 仅 id → 仅姓名）
- 敌方无匹配时用 `defaultStubSheet` 生成默认属性

**回合制：**
- 最大回合数：500
- 行动顺序：按神识（sense）降序排列，同神识按姓名排序
- 每单位每轮行动一次

**攻击模式：**
- 功法/武器交替（strikeCount % 2 === 0 → 功法，否则武器）
- 功法选择：从功法栏中选伤害评分最高的攻击功法
  - 辅助功法（无攻击倍率）跳过
  - 法力不足时标记 `forceWeaponOnly = true`，此后仅用武器
- 攻击消耗法力（manacost），从当前 MP 扣除
- 武器：从佩戴栏 slot[0] 获取；无武器时徒手（物攻 1, 法攻 0）

**伤害公式：**
```
法攻伤害 = max(0, 角色法攻 × 功法法攻倍率 - 敌方法防)
物攻伤害 = max(0, 角色物攻 × 功法物攻倍率 - 敌方物防)
总伤害 = 法攻伤害 + 物攻伤害
```

**目标选择：** 从敌对存活单位随机选择

**胜负判定：**
- 敌方全灭 → ally 胜
- 己方全灭 → enemy 胜（撤退，己方血量置 1）
- 达到 500 回合未分出胜负 → 判定 enemy 胜

**战后结算：**
- 主角血蓝写回 G.currentHp / G.currentMp
- NPC 血蓝写回 nearbyNpcs
- 胜利后搜刮阵亡敌人的装备和功法入储物袋
- 阵亡 NPC 标记 isDead = true
- 派发 `mj:battle-finished` 事件（含 detail: { victor, rounds, settlement, battleLoot }）
- 触发后续剧情 AI（若 `MJ_AUTO_STORY_AFTER_BATTLE = true`）

**战斗统计（settlement）：**
- 每方每人：dealtFa（造成法伤）, dealtWu（造成物伤）, takenFa（承受法伤）, takenWu（承受物伤）

---

## 7. 灵石经济系统

### 7.1 灵石品阶与价值

| 灵石 | 品阶 | 刻度 value | 兑换比例 |
|------|------|------------|----------|
| 下品灵石 | 下品 | 10 | 1 |
| 中品灵石 | 中品 | 100 | 10 |
| 上品灵石 | 上品 | 1000 | 100 |
| 极品灵石 | 极品 | 10000 | 1000 |
| 仙品灵石 | 仙品 | 100000 | 10000 |

### 7.2 物品价值与品阶对应

| 品阶 | 价值范围 |
|------|----------|
| 下品 | 10-100 |
| 中品 | 100-1000 |
| 上品 | 1000-10000 |
| 极品 | 10000-100000 |
| 仙品 | 100000-1000000 |

### 7.3 修炼消耗

`总修为增加 = round(灵石表列 value × 灵根系数 × 消耗件数)`

---

## 8. 物品系统

### 8.1 物品类型

`武器` | `法器` | `防具` | `载具` | `攻击功法` | `辅助功法` | `丹药` | `突破丹药` | `材料` | `杂物`

### 8.2 装备槽位

| 索引 | 槽位 | 等效名称 |
|------|------|----------|
| 0 | 武器 / 主武器 | 武器、主武器 |
| 1 | 法器 / 副武器 | 法器、副武器 |
| 2 | 防具 | 防具 |
| 3 | 载具 | 载具 |

### 8.3 功法子类型

- `攻击`（攻击功法）— 含攻击倍率，有 manacost
- `辅助`（辅助功法）— 无攻击倍率（或有倍率用于评分），无 manacost

### 8.4 突破丹药与境界对应

| 境界突破 | 丹药品阶 |
|----------|----------|
| 练气 → 筑基 | 中品 |
| 筑基 → 结丹 | 上品 |
| 结丹 → 元婴 | 极品 |
| 元婴 → 化神 | 仙品 |

---

## 9. 角色属性单（CharacterSheet）

### 9.1 字段规范

```json
{
  "id": "唯一标识",
  "displayName": "显示名称",
  "realm": { "major": "练气", "minor": "初期" },
  "playerBase": { "hp":0, "mp":0, "patk":0, "pdef":0, "matk":0, "mdef":0, "foot":0, "sense":0, "charm":10, "luck":10 },
  "maxHp": 200, "maxMp": 50,
  "currentHp": 200, "currentMp": 50,
  "isVisible": true,
  "isDead": false,
  "favorability": 0,       // [-99, 99]
  "linggen": "天灵根 金",
  "gender": "男性",
  "age": 16,
  "shouyuan": 100,
  "identity": "散修",
  "currentStageGoal": "",
  "longTermGoal": "",
  "hobby": "",
  "fear": "",
  "personality": "",
  "traits": [],
  "inventorySlots": [],
  "gongfaSlots": [],
  "equippedSlots": [],
  "xiuwei": 0
}
```

### 9.2 NPC 计算

与主角同一公式：`computePlayerBaseFromCharacterSheet(sheet)` → `applyComputedPlayerBaseToCharacterSheet(sheet)`：
1. 从境界表取底数
2. 叠加难度/出身/天赋 flat bonus
3. 叠加功法/装备槽位 bonus × 境界倍率
4. 灵根乘法
5. 血量归零 → 视为阵亡

---

## 10. 游戏主状态对象（MortalJourneyGame）

```json
{
  "fateChoice": {},              // 命运抉择完整数据
  "realm": { "major":"练气", "minor":"初期" },
  "playerBase": {},              // 当前八维+魅力/气运
  "rawRealmBase": {},            // 纯境界底数（未加成）
  "maxHp": 200, "maxMp": 50,
  "currentHp": 200, "currentMp": 50,
  "charm": 10, "luck": 10,
  "xiuwei": 0,                   // 累计修为
  "cultivationProgress": 0,      // 修炼进度百分比
  "worldTimeString": "0001年 01月 01日 08:00",
  "currentLocation": "",
  "age": 16,
  "equippedSlots": [],           // [武器, 法器, 防具, 载具]
  "gongfaSlots": [],             // 12 格功法栏
  "inventorySlots": [],          // 12+ 格储物袋
  "nearbyNpcs": [],              // 周围人物 CharacterSheet[]
  "chatHistory": [],             // [{role, content}]
  "chatActionSuggestions": {},   // 四级行动建议
  "pendingBattle": null,         // 待处理的战斗 payload
  "lastBattleResult": {},        // 上轮战斗结果
  "storyBattleContextConsumed": false,
  "mjInitStateAiApplied": false, // 开局配置 AI 是否已执行
  "lastStoryRawText": "",        // 上段剧情原文（含标签）
  "mjStoryRetryContext": null    // 剧情重试上下文
}
```

---

## 11. API 桥接层（silly_tarven/bridge.js）

### 11.1 功能

- OpenAI 兼容 Chat Completions API 调用
- 流式/非流式（默认非流式）
- 超时控制（300s）
- API 覆盖（启动页设置优先于 bridge-config）
- 预设管理（多套 API 配置）
- 世界书桥接同步

### 11.2 超时配置

```javascript
timeouts: {
  nonStreamMs: 300000,        // 非流式超时 5 分钟
  streamChunkIdleMs: 300000,  // 流式块空闲超时
  streamMaxTotalMs: 300000    // 流式总超时
}
```

### 11.3 API 覆盖优先级

```
index.html API设置弹窗 (localStorage)
    ↓ 覆盖
bridge-config.js 的固定预设
    ↓ 覆盖  
默认模板
```

---

## 12. 数据持久化

### 12.1 存档时机

1. 每 4 秒自动保存（`setInterval 4000ms`）
2. `beforeunload` 事件触发保存
3. 返回启动页前保存
4. 关键操作后即时保存（装备变更、修炼、战斗结算）

### 12.2 快照范围

通过 `persistBootstrapSnapshot()` 保存到 `sessionStorage`：
- fateChoice
- realm, maxHp, maxMp, currentHp, currentMp
- xiuwei, cultivationProgress
- playerBase, rawRealmBase
- equippedSlots, gongfaSlots, inventorySlots
- nearbyNpcs
- worldTimeString, currentLocation
- age, charm, luck
- chatHistory, lastStoryRawText
- lastBattleResult

---

## 13. 手机端适配

### 13.1 布局调整

- 左侧角色面板和右侧周围人物面板默认隐藏
- 底部按钮切换显示（"角色"/"周围"）
- 面板打开时覆盖聊天区
- 面板关闭按钮（×）和 ESC 键关闭
- 适配触控和小屏（通过 CSS 响应式）

### 13.2 移动端触发点

- 底部固定栏：角色按钮 + 周围人物按钮 + 输入区
- 面板全屏遮罩

---

## 14. 调试日志系统

- `GameLog` 全局对象（`js/log/logPanel.js`）
- 左下角可展开/收起的日志面板
- 支持 info/warn/error 级别
- 战斗详细日志：每回合伤害计算过程
- AI 请求耗时和结果日志
- 突破消息日志
- 面板 UI 启用标记：`GameLog.panelUiEnabled`

---

## 15. 文件清单

| 文件 | 行数（估） | 用途 |
|------|-----------|------|
| `index.html` | ~700 | 启动页（启动画面 + API 设置弹窗 + 命运抉择） |
| `main.html` | ~600 | 主游戏界面布局 |
| `css/start_frame.css` | — | 启动页样式 |
| `css/main.css` | — | 主界面样式 |
| `css/logPanel.css` | — | 日志面板样式 |
| `css/creation.css` | — | 命运抉择样式 |
| `js/log/logPanel.js` | ~300 | 调试日志面板 |
| `js/data/trait_samples.js` | ~100 | 148 条天赋词条 |
| `js/data/spirit_stone.js` | ~35 | 灵石品阶价值表 |
| `js/data/mjCreationConfig.js` | ~800 | 开局配置（出身/灵根/物品描述/功法描述） |
| `js/data/realm_state.js` | ~507 | 境界属性/修为/寿元/突破概率表 |
| `js/data/leegen_state.js` | ~100 | 灵根五行倍率表 |
| `js/game/player_base_runtime.js` | ~436 | 角色属性计算引擎 |
| `js/game/mj_character_sheet.js` | ~175 | 角色属性单规范 |
| `js/game/mortal_journey_battle.js` | ~732 | 回合制战斗引擎 |
| `js/worldbook/world_book_entries.js` | ~67 | 世界书条目数据（5 条） |
| `js/worldbook/world_book.js` | ~188 | 世界书匹配与注入引擎 |
| `js/worldbook/preset_content.js` | — | AI 预设数据 |
| `js/worldbook/preset.js` | ~255 | AI 预设/规则管理 |
| `js/worldbook/state_rules.js` | — | 状态 AI 规则模板 |
| `js/worldbook/init_state_rules.js` | — | 开局配置 AI 规则模板 |
| `js/ai_server/world_generate.js` | ~250 | 开局剧情 AI 生成 |
| `js/ai_server/init_state_generate.js` | ~1200 | 开局配置 AI（装备/功法/储物袋生成） |
| `js/ai_server/state_generate.js` | ~1600 | 状态 AI 同步（标签解析+消息拼装+apply） |
| `js/ai_server/story_generate.js` | ~900 | 剧情 AI 生成（消息拼装+战斗触发提取） |
| `js/ui/mainScreen_panel_realm.js` | ~2500 | 左面板渲染（角色/境界/装备/功法/突破弹窗） |
| `js/ui/mainScreen_panel_inventory_ui.js` | ~2000 | 储物袋 UI + 物品描述弹窗 |
| `js/ui/mainScreen_chat.js` | ~1200 | 聊天 UI + AI 回合调度 + 战斗自动接续 |
| `js/ui/mainScreen.js` | ~1017 | 主界面对外 API + 门闩管线 |
| `js/ui/fateChoiceController.js` | ~1200 | 命运抉择控制器（创建/读档/自定义出身） |
| `silly_tarven/bridge.js` | ~600 | OpenAI API 桥接层 |

总计约 **34 个文件**，核心 JS 约 **14,000+ 行**。

---

## 16. 关键技术特征

1. **纯静态前端：** 无任何服务端代码，完全运行在浏览器中
2. **ES5 兼容：** 使用 IIFE + `var` 声明，避免现代 JS 语法以确保广泛兼容
3. **命名空间全局挂载：** 所有模块通过 `window.XYZ = {}` 暴露，模块间通过全局变量通信
4. **sessionStorage + localStorage：** 双存储体系，sessionStorage 用于当前会话，localStorage 用于持久存档
5. **OpenAI 兼容 API：** 通过 `/v1/chat/completions` 端点调用，支持自定义 base URL
6. **标签解析架构：** AI 输出通过自定义 XML 风格标签（`<mj_*>`）传递结构化数据，JavaScript 解析后更新游戏状态
7. **门闩管道模式：** 新档首次进入执行严格的多阶段 AI 管线，每阶段可独立重试或取消
8. **自动保存：** 4 秒间隔 + beforeunload 兜底
