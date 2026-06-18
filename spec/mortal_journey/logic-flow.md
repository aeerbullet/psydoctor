# mortal_journey 游戏逻辑流程文档

> 从实际代码分析得出，覆盖游戏运行的完整逻辑流程、决策树与状态转换序列。

---

## 1. 总体游戏循环

```
┌─────────────────────────────────────────────────────────────────┐
│                      游戏主循环（Main Loop）                      │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ 用户输入  │ →  │ 剧情 AI  │ →  │ 状态 AI  │ →  │ 游戏更新  │  │
│  │ (聊天框) │    │ (叙事生成)│    │ (状态同步)│    │ (面板刷新)│  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       ↑                                               │         │
│       └─────────────── 循环 ──────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

每次玩家发言触发一个完整的 **双回合 AI 管线**，随后界面刷新，等待下一次输入。这是游戏的核心节拍。

---

## 2. 游戏启动流程

### 2.1 整体启动顺序

```
浏览器访问 index.html
        │
        ▼
┌──────────────────┐
│  Phase 1: 启动页  │  index.html
│  API 设置        │  ├── 填写 API URL / Key / Model
│  (可选,可跳过)   │  ├── 写入 localStorage
│                  │  └── bridge.js 优先读取覆盖配置
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Phase 2: 命运抉择│  index.html#fate
│  选择出身        │  ├── 预设出身（凡人/黄枫谷弟子）或自定义
│  生成灵根        │  ├── 概率生成：真灵根/伪灵根/天灵根/无灵根
│  选择世界因子    │  ├── 五行随机组合
│  输入角色名      │  └── 可选：性别、叙事人称
└────────┬─────────┘
         │ 点击「开始人生」
         ▼
┌──────────────────┐
│  Phase 3: 创建存档│  fateChoiceController.js
│  构建 fateChoice │  ├── realm: { major, minor }
│  创建存档槽      │  ├── linggen, traits, worldFactors
│  写入 session    │  ├── customBirth { tag, location, background, ... }
│  Storage         │  ├── playerName, gender, narrationPerson
│  跳转 main.html  │  └── 写入 MJ_SAVE_V1:{id} + mortal_journey_bootstrap_v1
└────────┬─────────┘
         │ window.location.href = "./main.html"
         ▼
┌──────────────────┐
│  Phase 4: 主界面  │  main.html → mainScreen.js init()
│  恢复存档        │  ├── 读取 sessionStorage mortal_journey_bootstrap_v1
│  门闩判断        │  ├── 新档 → 4 阶段 Bootstrap Gate
│  或读档流程      │  └── 读档 → runNormalFirstEnterPipeline
└──────────────────┘
```

### 2.2 命运抉择详细流程

```
fateChoiceController.js 初始化
  │
  ├── 1. 加载 MjCreationConfig 出身表
  │     └── buildOrderedBirthKeys() → ["凡人", "黄枫谷弟子", "自定义"]
  │
  ├── 2. 用户选择出身卡片
  │     ├── 预设出身 → syncCustomBirthForCurrentSelection()
  │     │   └── makePresetCustomBirth() 生成标准 customBirth
  │     │       ├── tag/name = 地点名（如"黄枫谷"）
  │     │       ├── location, locationDesc
  │     │       ├── realmMajor: "练气", realmMinor: "初期"
  │     │       └── background = desc + locationDesc
  │     └── 自定义出身 → 用户填写
  │         ├── 出身标签 (tag)
  │         ├── 出生地点 (location)
  │         ├── 境界（下拉：练气~化神 × 初期~后期）
  │         └── 出身背景长文本 (background)
  │
  ├── 3. 灵根生成
  │     ├── 预设出身 → rollLinggen() 按概率表随机
  │     │   ├── 真灵根：从五行中随机选 N 种（概率配置表）
  │     │   ├── 伪灵根：五行全选（四或五种）
  │     │   ├── 天灵根：单一种五行
  │     │   └── 无灵根：无五行
  │     └── 自定义 → 复用同一概率机制
  │
  ├── 4. 天赋词条（逆天改命）
  │     └── 可选词条列表，每个词条有 name/desc/rarity/effects
  │         （当前版本天赋已转为纯叙事标签，不提供属性 bonus）
  │
  ├── 5. 世界因子
  │     └── 预设因子（如"妖兽潮""魔道入侵"等）或自定义
  │         每个因子有 name/desc/effect
  │
  ├── 6. 角色信息
  │     ├── 角色名 (playerName)
  │     ├── 性别 (gender)
  │     └── 叙事人称 (narrationPerson): 第一/第二/第三人称
  │
  └── 7. 「开始人生」按钮
        ├── 构建完整 fateChoice 对象
        ├── 生成存档 ID (saveId)
        ├── 创建完整 MortalJourneyGame 初始对象
        │   ├── realm = fateChoice.realm
        │   ├── xiuwei = 0
        │   ├── age = DEFAULT_AGE (16)
        │   ├── shouyuan = 从 RealmState 查表
        │   ├── equippedSlots = [null, null, null, null] (4格)
        │   ├── gongfaSlots = [null×8] (8格)
        │   ├── inventorySlots = [null×12] (12格，4列)
        │   ├── worldTimeString = "0001年 01月 01日 08:00"
        │   └── currentLocation = birthLocation 或 ""
        ├── 写入 localStorage: MJ_SAVE_V1:{id}
        ├── 更新存档索引: MJ_SAVES_INDEX_V1
        ├── 写入 sessionStorage: mortal_journey_bootstrap_v1
        ├── 写入 sessionStorage: MJ_ACTIVE_SAVE_ID_V1
        ├── 写入 sessionStorage: mj_pending_provisional_save_v1
        └── window.location.href = "./main.html"
```

### 2.3 读档流程

```
启动页「读取人生」
  │
  ├── 1. 从 localStorage 读取 MJ_SAVES_INDEX_V1 → 存档 ID 列表
  ├── 2. 展示存档列表（显示角色名/境界/时间戳）
  ├── 3. 用户选择存档
  │     ├── 读取 localStorage: MJ_SAVE_V1:{id} → 完整 MortalJourneyGame
  │     ├── 写入 sessionStorage: mortal_journey_bootstrap_v1
  │     ├── 设置 MJ_ACTIVE_SAVE_ID_V1
  │     └── 跳转 main.html
  │
  └── 4. main.html 入口
        ├── restoreBootstrap() → 读取 sessionStorage
        ├── shouldRunBootstrapAiGate(G0) → 判断条件：
        │   ├── chatHistory 中已存在 user/assistant 消息 → false（跳过门闩）
        │   ├── mjInitStateAiApplied === true → false（已初始化过）
        │   └── 以上皆非 → true（需要门闩）
        └── 读档时 chatHistory 非空 → 跳过门闩，走正常首次进入管线
```

---

## 3. 新档门闩（Bootstrap Gate）4 阶段流程

### 3.1 门闩触发条件

```javascript
// mainScreen.js: shouldRunBootstrapAiGate(G0)
function shouldRunBootstrapAiGate(G0) {
  if (!G0) return false;
  if (chatHistoryHasUserAssistant(G0)) return false;  // 已有对话 → 读档
  if (G0.mjInitStateAiApplied === true) return false;   // 已初始化
  return true;  // 新档，需要门闩
}
```

### 3.2 阶段一：开局剧情 AI

```
Phase 1: openingStory
  │
  ├── 入口：MortalJourneyWorldGenerate.runOpeningStoryStrictPromise()
  │
  ├── buildOpeningUserPrompt(fc, G)
  │   ├── 判断 postInit（mjInitStateAiApplied）
  │   │   ├── true（读档后重开门闩）→ 要求叙事与已落库面板一致
  │   │   └── false（新档）→ 先写剧情，后续配置 AI 对齐
  │   ├── 注入「铁律」：主角修为不可超过法定大境界
  │   ├── 注入年龄-境界对照表（练气 16-100 岁等）
  │   └── 注入禁止「正文现编例外」约束
  │
  ├── 调用剧情 AI（复用 MortalJourneyStoryChat.sendTurn）
  │   └── skipStateInventoryAfterStory = true
  │       （此阶段不跑状态 AI，主角由后续配置 AI 写面板）
  │
  ├── AI 返回叙事正文
  │   ├── 提取 <mj_story_body> 内的纯叙事
  │   ├── 去除 NPC 战设/行动建议/战斗触发/快照标签
  │   └── 写入 G.chatHistory（role: "assistant"）
  │
  └── 结果写入门闩 UI
      ├── 成功 → 显示绿色时间戳，进入阶段二
      └── 失败 → 显示错误，可点「重试」
```

### 3.3 阶段二：开局配置 AI

```
Phase 2: initState
  │
  ├── 入口：MortalJourneyInitStateGenerate.runInitStateAiIfNeeded()
  │
  ├── 前置条件检查
  │   ├── TavernHelper 未就绪 → 跳过，reason: "no TavernHelper"
  │   ├── game 或 fateChoice 缺失 → 跳过
  │   └── 已执行过（mjInitStateAiApplied）→ 跳过
  │
  ├── 构建请求
  │   ├── system prompt = MortalJourneyInitStateRules.templates.systemPrompt
  │   │   （含标签变量填充：{{OPS_TAG_OPEN}} 等）
  │   ├── user 消息 = 命运抉择 JSON + 开局剧情正文 + 物品/功法参考表
  │   └── 输出要求：三对标签顺序输出
  │
  ├── 调用 AI（非流式）
  │
  ├── 解析 AI 响应
  │   ├── 提取 <mj_inventory_ops> → applyInventoryOps(G, ops)
  │   │   ├── add → resolvePlacePayload() → tryPlaceItemInBag()
  │   │   └── remove → removeStackedItemsFromBag()
  │   │
  │   ├── 提取 <mj_world_state> → parseWorldStateFromText()
  │   │   ├── worldTimeString → 校验格式 → 写入 G.worldTimeString
  │   │   ├── currentLocation → 写入 G.currentLocation
  │   │   ├── currentHp/currentMp → 钳制到上限内 → 写入 G
  │   │   └── age → 钳制 [1, 999] → 写入 G.age
  │   │
  │   └── 提取 <mj_init_loadout> → 解析 equippedSlots + gongfaSlots
  │       ├── equippedSlots: 长度固定 4，空位 null
  │       │   └── 武器位须非空
  │       ├── gongfaSlots: 长度固定 8，空位 null
  │       │   └── 至少 1 攻击功法 + 1 辅助功法
  │       └── 写入 G.equippedSlots / G.gongfaSlots
  │
  ├── 计算角色面板
  │   └── PlayerBaseRuntime.applyToGame(G, fc)
  │       └── 境界表底数 → 静态加成 → 功法/装备加成 → 灵根乘法 → 写入 G
  │
  └── 标记完成
      └── G.mjInitStateAiApplied = true
```

### 3.4 阶段三：状态同步 AI

```
Phase 3: stateSync
  │
  ├── 入口：MjMainScreenChat.runStateInventoryAiTurn()
  │
  ├── 提取开局剧情正文
  │   └── extractLastAssistantOpeningStory(G)
  │       └── 从 chatHistory 最后一条 assistant 消息取全文
  │
  ├── 附加门闩专用提示
  │   └── "开局配置 AI 已写回主角佩戴、功法与储物袋。
  │       本回合请以周围人物为主：剧情中出现的 NPC 须在
  │       <mj_nearby_npcs> 给出完整当期列表"
  │
  ├── 调用状态 AI（MortalJourneyStateGenerate.sendTurn）
  │   ├── system: 状态规则模板（state_rules.js）
  │   ├── user: 世界快照 + 佩戴/功法/储物袋/周围人物快照 + 剧情正文
  │   └── 标签变量注入
  │
  ├── 解析 AI 响应 → applyStateTurnFromAssistantText(G, text)
  │   ├── parseInventoryOpsFromText() → 储物袋增删
  │   ├── parseWorldStateFromText() → 世界时间/地点（单调校验）
  │   ├── parseUserStateFromText() → 主角血蓝
  │   └── parseNearbyNpcsFromText() → 周围人物列表
  │       ├── 新 NPC → 完整 normalize + computePlayerBase
  │       └── 已有 NPC → 仅更新 currentHp/currentMp
  │
  └── 结果写入门闩 UI
      ├── 成功 → 进入阶段四
      └── 失败 → 显示错误
```

### 3.5 阶段四：门闩完成

```
Phase 4: finishBootstrapGateSuccess()
  │
  ├── 清除临时存档标记
  ├── 隐藏全屏门闩 UI
  ├── 刷新所有面板
  │   ├── renderInventorySlots()
  │   ├── renderGongfaGrid()
  │   ├── renderLeftPanel(fc, G)
  │   └── renderNearbyNpcsPanel(G)
  ├── 渲染聊天历史到对话区
  ├── 持久化快照
  │   ├── persistBootstrapSnapshot() → sessionStorage
  │   └── localStorage 镜像备份
  └── 同步世界书到桥接存储
```

### 3.6 门闩异常处理

```
门闩失败处理
  │
  ├── 任一阶段失败 → showBootstrapGateError(msg)
  │   ├── 显示错误信息
  │   ├── 显示「重试」按钮 → execFullPipeline() 重新执行全部 3 阶段
  │   └── 显示「返回」按钮 → cancelBootstrapGateToFateChoice()
  │       ├── 删除临时存档
  │       ├── 清理 sessionStorage
  │       └── 跳转回 index.html#fate
  │
  └── 用户中途取消
      └── cancelBootstrapGateToFateChoice()
          ├── bootstrapGatePipelineCancelled = true
          └── 同上清理流程
```

---

## 4. 主游戏回合流程（用户发言→AI→更新）

### 4.1 完整回合时序

```
用户输入文字 → 点击发送（或 Enter）
        │
        ▼
┌──────────────────────────────────────────────────┐
│ Step 1: 聊天发送处理                               │
│ mainScreen_chat.js: handleChatSend()              │
│                                                    │
│ 1.1 去空格校验（空消息拒绝）                         │
│ 1.2 设置发送按钮禁用态                              │
│ 1.3 清空输入框                                     │
│ 1.4 渲染用户消息到聊天区                            │
│ 1.5 启动状态栏计时器（显示"剧情生成中… 0.0s"）        │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│ Step 2: 剧情 AI 回合                               │
│ story_generate.js: sendTurn()                     │
│                                                    │
│ 2.1 buildMessages({ userText, priorHistory })      │
│     ├── system: 活跃预设 + 规则预设 + 世界书        │
│     ├── 剧情快照沿革（chatPlotSnapshotLog）         │
│     ├── 上一轮 assistant 全文                      │
│     └── user: 用户输入 + 运行时存档摘要             │
│                                                    │
│ 2.2 调用 TavernHelper.generateFromMessages()       │
│     └── 支持流式（SSE）/ 非流式                     │
│                                                    │
│ 2.3 处理流式回调                                   │
│     └── onDelta → visibleNarrativeForStreamingChunk│
│         └── 仅显示 <mj_story_body> 内文本           │
│                                                    │
│ 2.4 获取完整响应后处理                              │
│     ├── resolveStoryReplyForPipeline()             │
│     │   ├── 有 <mj_story_body> 信封 → 提取标签内文本│
│     │   └── 无信封 → 回退全文 strpMetaLeak         │
│     ├── 提取 <mj_story_snapshot> → 追加到快照沿革   │
│     ├── 提取 <mj_action_suggestions> → 四级建议     │
│     ├── 提取 <mj_npc_story_hints> → 供状态 AI 参考  │
│     ├── 提取 <mj_battle_trigger> → 检测战斗触发     │
│     └── 清理泄露英文 (stripStoryAiMetaLeak)         │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│ Step 3: 展示剧情                                   │
│                                                    │
│ 3.1 剥离机器标签                                   │
│     ├── stripNpcStoryHintsFromNarrative()          │
│     ├── stripActionSuggestionsFromNarrative()      │
│     ├── stripBattleTriggerFromNarrative()          │
│     └── stripStorySnapshotFromNarrative()          │
│                                                    │
│ 3.2 渲染纯叙事到聊天气泡                            │
│ 3.3 更新行动建议按钮                               │
│     └── MainScreen.setChatSuggestions(suggestions) │
│ 3.4 将纯叙事追加到 G.chatHistory (role: assistant) │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│ Step 4: 状态 AI 回合                               │
│ state_generate.js: sendTurn()                     │
│                                                    │
│ 4.1 buildInventoryStateUserContent({ storyText })  │
│     ├── 世界时间/地点/血蓝快照 (buildWorldSnapshot) │
│     ├── 主角佩戴快照 (buildEquippedSnapshot)       │
│     ├── 主角功法快照 (buildGongfaSnapshot)         │
│     ├── 储物袋快照 (buildInventorySnapshot)        │
│     ├── 周围人物快照 (buildNearbyNpcsSnapshot)     │
│     ├── 境界合法取值 (buildRealmLexiconLine)       │
│     ├── 可引用功法表 (buildGongfaDescribeCatalog)   │
│     ├── 可引用物品表 (buildStuffDescribeCatalog)    │
│     └── 剧情正文 (storyText = 上轮剧情 AI 全文)     │
│                                                    │
│ 4.2 调用 TavernHelper.generateFromMessages()       │
│                                                    │
│ 4.3 状态栏切换显示 "状态更新中…"                    │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│ Step 5: 应用状态更新                               │
│ applyStateTurnFromAssistantText(G, assistantText) │
│                                                    │
│ 5.1 解析储物袋操作                                 │
│     ├── 尝试新旧标签（split_tags 优先）            │
│     │   ├── <mj_spirit_stone_ops>                 │
│     │   ├── <mj_item_add_ops>                     │
│     │   └── <mj_item_remove_ops>                  │
│     ├── 回退旧标签 <mj_inventory_ops>             │
│     ├── 回退 Markdown 围栏内 JSON                  │
│     └── 回退末行 JSON                             │
│     → applyInventoryOps(G, ops)                   │
│                                                    │
│ 5.2 解析世界状态                                   │
│     ├── parseWorldStateFromText()                 │
│     └── applyWorldStatePatch()                    │
│         ├── 世界时间单调校验（不可早于当前）        │
│         ├── 更新 currentLocation                  │
│         ├── 更新 currentHp/currentMp（钳制到上限） │
│         └── 更新 age                              │
│                                                    │
│ 5.3 解析用户状态                                   │
│     ├── parseUserStateFromText()                  │
│     └── applyUserStatePatch()                     │
│         └── 更新 currentHp/currentMp              │
│                                                    │
│ 5.4 解析周围人物                                   │
│     ├── parseNearbyNpcsFromText()                 │
│     └── applyNearbyNpcsArrayToGame(G, list)       │
│         ├── 新 NPC → 完整 normalize + computePB   │
│         └── 已有 NPC → 仅更新血蓝                  │
│                                                    │
│ 5.5 检测战斗触发                                   │
│     └── 若状态 AI 的 <mj_battle_trigger>          │
│         含 shouldEnterBattle=true                 │
│         → triggerCombatFromBattleResult()         │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│ Step 6: 刷新界面                                   │
│                                                    │
│ 6.1 渲染状态更新结果到聊天区（系统消息气泡）        │
│ 6.2 刷新左栏面板                                   │
│ 6.3 刷新储物袋网格                                 │
│ 6.4 刷新功法网格                                   │
│ 6.5 刷新周围人物面板                               │
│ 6.6 持久化快照（persistBootstrapSnapshot）          │
│ 6.7 停止状态栏计时器                               │
│ 6.8 恢复发送按钮                                   │
└──────────────────────────────────────────────────┘
```

### 4.2 战斗触发检测流程

```
剧情 AI 或状态 AI 响应文本
        │
        ▼
extractBattleTriggerFromNarrative(text, game)
  │
  ├── 正则提取 <mj_battle_trigger>...</mj_battle_trigger>
  ├── JSON.parse 解析内容
  │
  ├── 判断 shouldEnterBattle
  │   ├── false → 不进入战斗，仅记录 triggerKind/triggerReason
  │   └── true →
  │       ├── 校验 enemies 非空（无敌方不触发）
  │       ├── 确保 allies 至少含主角
  │       ├── 每方最多 3 人
  │       └── 返回 { shouldEnterBattle: true, allies, enemies, triggerKind, triggerReason }
  │
  └── 触发战斗
      ├── 设置 G.pendingBattle = payload
      ├── 派发自定义事件 mj:battle-triggered
      └── MortalJourneyBattle.startBattle(payload)
```

### 4.3 剧情 AI 的 messages 构建逻辑

```
buildMessages({ userText, priorHistory, forceBattleIntent })
  │
  ├── 1. 构建 system 消息（按序拼接，用分隔线）
  │     ├── 活跃预设 system prompt（含模板变量填充）
  │     │   └── fillTemplateVars(template, { TOTAL_SPIRIT_STONE_VALUE, ... })
  │     ├── 运行时规则块（9 个 STORY_RULE_PRESET_IDS 依次）
  │     ├── 探索规则（若 detect 到秘境/遗迹/洞府等词）
  │     ├── 世界书摘录（selectEntries + formatForSystem）
  │     └── 运行时存档摘要（角色概要/面板/世界因子/天赋/装备行囊/战斗结算）
  │
  ├── 2. 剧情快照沿革（chatPlotSnapshotLog 拼为一条 assistant 消息）
  │
  ├── 3. 上一轮 assistant 全文（最近一条非空非占位的 assistant）
  │
  └── 4. 当前 user 消息
        ├── userPrefix（预设中的前缀）
        ├── 用户输入原文
        └── 战斗意图提示（若 forceBattleIntent）
```

---

## 5. 战斗系统逻辑流程

### 5.1 战斗完整流程

```
MortalJourneyBattle.startBattle(payload)
  │
  ├── 1. 构建参战单位
  │     ├── 主角单位
  │     │   ├── 从 G.playerBase 提取面板
  │     │   ├── 从 G.equippedSlots 提取装备
  │     │   ├── 从 G.gongfaSlots 提取功法
  │     │   ├── currentHp/currentMp（战斗中的实时值）
  │     │   └── 设置 isPlayer = true
  │     │
  │     ├── 友方单位
  │     │   ├── 从 payload.allies 匹配 G.nearbyNpcs
  │     │   ├── 若找不到 → 用 payload 中的 characterSheet 构造
  │     │   └── 调用 PlayerBaseRuntime.applyComputedPlayerBaseToCharacterSheet
  │     │
  │     └── 敌方单位
  │         └── 从 payload.enemies characterSheet 构造
  │
  ├── 2. 确定回合顺序
  │     └── 所有存活单位按 sense（神识）降序排列
  │         └── 神识高者先出手
  │
  ├── 3. 战斗主循环 runCombat()
  │     for round = 1 to MAX_ROUNDS (500):
  │       │
  │       ├── 按神识顺序遍历每个存活单位
  │       │   │
  │       │   ├── 选择目标
  │       │   │   ├── 玩家/友方 → 优先攻击敌方存活单位
  │       │   │   └── 敌方 → 优先攻击玩家
  │       │   │
  │       │   ├── 选择功法 pickBestGongfa(unit)
  │       │   │   ├── 遍历 gongfaSlots 格
  │       │   │   ├── 筛选 MP 足够的功法
  │       │   │   ├── 对零防目标计算技能分
  │       │   │   │   └── skillScore = computeDamageToTarget(attackerPb, mag, zeroDefPb).total
  │       │   │   ├── 选最高分功法
  │       │   │   ├── 若无可攻击功法 → 回退到武器普攻
  │       │   │   └── 若功法为 null → 武器普攻
  │       │   │
  │       │   ├── 执行攻击 performStrike(attacker, target, gongfa)
  │       │   │   ├── 功法攻击（消耗 MP）
  │       │   │   │   ├── mag = mergeMagnification(gongfaCell, gongfaDef)
  │       │   │   │   ├── manacost = mergeManacost(cell, def)
  │       │   │   │   ├── attacker.currentMp -= manacost
  │       │   │   │   └── damage = computeDamageToTarget(attackerPb, mag, defenderPb)
  │       │   │   │       ├── rawMatkLine = matk × mag.法攻
  │       │   │   │       ├── rawPatkLine = patk × mag.物攻
  │       │   │   │       ├── afterMdef = max(0, rawMatkLine - defenderMdef)
  │       │   │   │       ├── afterPdef = max(0, rawPatkLine - defenderPdef)
  │       │   │   │       └── total = afterMdef + afterPdef
  │       │   │   │
  │       │   │   └── 武器普攻（无 MP 消耗，仅物攻）
  │       │   │       ├── mag = weapon.magnification（仅物攻）
  │       │   │       └── damage = computeDamageToTarget(attackerPb, mag, defenderPb)
  │       │   │   │
  │       │   │   └── target.currentHp -= damage.total
  │       │   │       ├── currentHp <= 0 → 标记死亡
  │       │   │       └── 若目标为玩家 → 记录 "主角重伤"
  │       │   │
  │       │   └── 检查胜负条件
  │       │       ├── 玩家死亡 → 战斗结束，敌方胜
  │       │       └── 所有敌方死亡 → 战斗结束，友方胜
  │       │
  │       └── 若分出胜负 → break
  │
  ├── 4. 结算
  │     ├── 确定 victor: "ally" 或 "enemy"
  │     ├── lootDefeatedEnemyIntoBag() → 战利品
  │     │   └── 遍历敌方单位的 inventorySlots
  │     │       └── tryPlaceItemInBag(G, item)
  │     │
  │     ├── applyResultToGame(G, result)
  │     │   ├── 更新主角 currentHp/currentMp
  │     │   ├── 更新 NPC 状态（死亡/存活/血蓝）
  │     │   └── 写入 G.lastBattleResult
  │     │
  │     └── 派发 mj:battle-finished 自定义事件
  │
  └── 5. 渲染战斗日志
        └── 每回合的战斗描述写入聊天区
```

### 5.2 战后自动接续流程

```
mj:battle-finished 事件触发
  │
  ├── 条件：MJ_AUTO_STORY_AFTER_BATTLE === true
  │
  ├── 构建战后用户消息
  │   ├── formatPendingBattleMetaLines(G) → 触发类型/说明
  │   ├── 战斗结算文本
  │   └── MJ_POST_BATTLE_USER_PROMPT
  │       └── "以上为程序给出的本场战斗结算与战时上下文…
  │          请据此直接写下衔接剧情：收束现场、伤势与气氛…"
  │
  ├── 自动调用剧情 AI → 状态 AI 管线
  │   └── 与正常用户发言流程相同
  │
  └── 清理战斗状态
      └── G.storyBattleContextConsumed = true
```

---

## 6. 修为与突破系统逻辑流程

### 6.1 灵石炼化流程

```
用户点击储物袋中的灵石 → absorbSpiritStonesFromBag(bagIndex, consumeAll, pieceCount)
  │
  ├── 1. 校验灵石名称（isSpiritStoneCultivationItemName）
  │     └── 合法名称：灵石、下品灵石、中品灵石、上品灵石、极品灵石、仙品灵石
  │
  ├── 2. 计算消耗件数
  │     ├── consumeAll = true → 整堆消耗
  │     └── pieceCount 指定 → 不超过堆叠数
  │
  ├── 3. 计算修为增量
  │     │
  │     ├── 单件基准值（getSpiritStoneCultivationValue）
  │     │   ├── 下品灵石 / 灵石 → 10
  │     │   ├── 中品灵石 → 100
  │     │   ├── 上品灵石 → 1000
  │     │   ├── 极品灵石 → 10000
  │     │   └── 仙品灵石 → 100000
  │     │
  │     ├── 灵根效率系数（getSpiritStoneEfficiencyFactorForRootCount）
  │     │   ├── 无灵根 / 单灵根 → ×1.00
  │     │   ├── 双灵根 → ×0.50
  │     │   ├── 三灵根 → ×0.33
  │     │   └── 四灵根及以上 → ×0.25
  │     │
  │     └── 总修为 = round(基准值 × 效率系数 × 件数)
  │
  ├── 4. 累加修为
  │     ├── G.xiuwei += 总修为
  │     └── clampXiuweiToLateStageCapIfNeeded()
  │
  ├── 5. 检查突破
  │     └── applyRealmBreakthroughs(G)
  │         └── 见下方「突破判定流程」
  │
  ├── 6. 更新 UI
  │     ├── computeCultivationUi(G, fc) → 修为进度百分比
  │     ├── renderLeftPanel()
  │     ├── renderBagSlots()
  │     └── persistBootstrapSnapshot()
  │
  └── 7. 记录日志
        └── GameLog.info("[灵石炼化] 消耗 X 颗 Y → +Z 修为")
```

### 6.2 突破判定流程

```
applyRealmBreakthroughs(G)
  │
  ├── 1. 获取当前境界信息
  │     ├── realm.major, realm.minor
  │     └── 修为需求表（CULTIVATION_TABLE）
  │
  ├── 2. 小境界晋升（自动，无概率）
  │     while G.xiuwei >= 下一阶段需求:
  │       │
  │       ├── 练气初期(100) → 练气中期(200) → 练气后期(1000)
  │       ├── 筑基初期(2000) → 筑基中期(5000) → 筑基后期(10000)
  │       ├── 结丹初期(20000) → 结丹中期(50000) → 结丹后期(100000)
  │       ├── 元婴初期(200000) → 元婴中期(500000) → 元婴后期(1000000)
  │       │
  │       ├── 到达后期（非化神）→ 停止自动晋升
  │       │   └── 修为锁在后期需求值 + 标记 lateStageBreakSuffix
  │       │
  │       └── 记录晋升消息："突破至 XX 期"
  │
  ├── 3. 大境界突破（手动触发，概率判定）
  │     │
  │     ├── 触发条件：
  │     │   ├── 当前为后期（非化神）
  │     │   ├── 修为已达后期满值
  │     │   └── 用户点击左栏「突破」按钮
  │     │
  │     ├── 弹窗显示：
  │     │   ├── 当前境界 → 目标境界
  │     │   ├── 基础成功率（从 MAJOR_BREAKTHROUGH_TABLE）
  │     │   │   ├── 练气→筑基: 50%
  │     │   │   ├── 筑基→结丹: 30%
  │     │   │   ├── 结丹→元婴: 20%
  │     │   │   └── 元婴→化神: 10%
  │     │   ├── 突破丹药加成（从储物袋选择）
  │     │   │   ├── 中品突破丹(练气→筑基): +10~15%
  │     │   │   ├── 上品突破丹(筑基→结丹): +15~20%
  │     │   │   ├── 极品突破丹(结丹→元婴): +20~25%
  │     │   │   └── 仙品突破丹(元婴→化神): +25~30%
  │     │   └── 总成功率 = 基础 + 丹药加成（上限 100%）
  │     │
  │     ├── 用户确认 → 掷骰
  │     │   │
  │     │   ├── 成功（Math.random() < 总成功率）
  │     │   │   ├── realm.major = 目标大境界
  │     │   │   ├── realm.minor = "初期"
  │     │   │   ├── 重算寿元（查 SHOUYUAN_TABLE）
  │     │   │   ├── 重算 playerBase（PlayerBaseRuntime.applyToGame）
  │     │   │   ├── 修为保留（不清零）
  │     │   │   └── 清除 lateStageBreakSuffix
  │     │   │
  │     │   └── 失败
  │     │       ├── 修为回落至当前阶段需求的 80%
  │     │       ├── lateStageBreakSuffix.failCount++
  │     │       └── 显示 "*圆满"（failCount=0）或 "*巅峰"（≥1）
  │     │
  │     └── 消耗突破丹药（若使用）
  │
  └── 4. 更新 UI 与持久化
        ├── computeCultivationUi → 修为进度百分比
        ├── renderLeftPanel → 刷新境界显示
        ├── logBreakthroughMessages → 记录突破日志
        └── persistBootstrapSnapshot → 持久化
```

### 6.3 后期「圆满/巅峰」机制

```
后期满修为 + 突破失败
  │
  ├── lateStageBreakSuffix 对象
  │   └── { failCount: N }
  │
  ├── 显示规则
  │   ├── failCount = 0 → 显示 "境界*圆满"
  │   └── failCount ≥ 1 → 显示 "境界*巅峰"
  │
  └── 修为锁定
      └── 修为不可超出后期需求值
          └── clampXiuweiToLateStageCapIfNeeded()
```

---

## 7. 储物袋管理逻辑流程

### 7.1 物品加入流程

```
tryPlaceItemInBag(G, payload)
  │
  ├── 1. 标准化物品名称
  │
  ├── 2. 检查是否为禁止堆叠物品
  │     └── bagItemSkipsSameNameStack(name) → 如"妖兽内丹"
  │         │
  │         ├── 是 → 每件独立占格
  │         │   ├── 确保足够空位（不够则整行扩容）
  │         │   └── 逐件放入
  │         │
  │         └── 否 → 同名合并
  │             ├── 查找已有同名格 → count += 新数量
  │             └── 若无同名格 → 放入首个空位
  │                 └── 若无空位 → 扩容一行（INVENTORY_GRID_COLS 格）
  │
  └── 3. normalizeBagItem(entry) 规范化字段
        ├── name, count, desc
        ├── equipType / type / subtype
        ├── grade, value
        ├── bonus, effects
        ├── manacost, magnification
        └── 功法类额外处理（subtype 推断、manacost 境界缩放）
```

### 7.2 物品移除流程

```
removeStackedItemsFromBag(G, name, count)
  │
  ├── 1. 统计袋内同名所有格的总数量
  │
  ├── 2. 若请求数 ≥ 现存总量 → 扣尽所有同名格
  │
  ├── 3. 若请求数 < 现存总量 → 从前往后逐格扣减
  │     ├── 当前格数量 > 剩余需求 → 减少 count，保留格子
  │     └── 当前格数量 ≤ 剩余需求 → 置 null，继续下一格
  │
  └── 4. 返回实际扣除数量
```

### 7.3 灵石特殊处理

```
灵石 add
  │
  ├── applySpiritStoneDeltaByValue(G, name, count, true)
  │   └── 与其他物品相同，同名合并
  │
灵石 remove
  │
  └── removeSpiritStoneWithChange(G, name, count)
      │
      ├── 1. 计算需扣除的总 value = 单价 × 数量
      ├── 2. 计算袋内灵石总 value
      ├── 3. 若需扣值 ≥ 总价值 → 清空所有灵石
      └── 4. 否则：贪心找零扣除
          ├── 从低品开始扣（下品→中品→上品→极品→仙品）
          ├── 若低品不够 → 向上拆借（1中品=10下品）
          └── 重写各品阶剩余数量
```

---

## 8. NPC 系统逻辑流程

### 8.1 NPC 列表更新

```
状态 AI 的 <mj_nearby_npcs> 标签 → applyNearbyNpcsArrayToGame(G, arr)
  │
  ├── 遍历 arr 中每个 NPC
  │   │
  │   ├── 构建 presenceKey (id 或 displayName)
  │   │
  │   ├── 判断是否已有同 key NPC
  │   │   │
  │   │   ├── 已有 → applyExistingNpcHpMpOnly(oldNpc, incoming)
  │   │   │   └── 仅更新 currentHp / currentMp
  │   │   │       其他字段（装备/功法/境界/身份）保持旧值不变
  │   │   │       → 防止 AI 篡改已建立的 NPC 人设
  │   │   │
  │   │   └── 新 NPC → 完整处理
  │   │       ├── normalizeNpcIncomingSlotsFromStateRules()
  │   │       │   ├── normalizeNpcEquipSlotFromStateRule → 4 格佩戴
  │   │       │   ├── normalizeNpcGongfaSlotFromStateRule → 8 格功法
  │   │       │   └── normalizeNpcInventorySlotFromStateRule → 12 格储物袋
  │   │       ├── MjCharacterSheet.normalize() → 标准化角色卡
  │   │       ├── PlayerBaseRuntime.applyComputedPlayerBaseToCharacterSheet() → 算面板
  │   │       └── syncNpcShouyuanFromRealmState() → 查寿元表
  │   │
  │   └── list.push(npc)
  │
  └── mergeNearbyNpcListInPlace(G, list)
      └── 合并去重、排序、写入 G.nearbyNpcs
```

### 8.2 NPC 可见性

```
NPC 显示规则
  │
  ├── isVisible === false → 不在聊天区和面板显示
  │   └── 但仍在 G.nearbyNpcs 中保留（可重新出现）
  │
  ├── isDead === true → 显示 "阵亡（血量 0）"
  │   └── currentHp 强制为 0
  │
  └── 好感度 favorability ∈ [-99, 99]
      └── 初始 0，由 AI 根据剧情互动调整
```

---

## 9. 存档系统逻辑流程

### 9.1 自动保存

```
自动保存机制
  │
  ├── 定时器：window.setInterval(4000ms)
  │   └── persistBootstrapSnapshot()
  │       ├── 写入 sessionStorage: mortal_journey_bootstrap_v1
  │       └── 写入 localStorage: mortal_journey_last_session_v1 (镜像)
  │
  └── 页面关闭：window.addEventListener("beforeunload", ...)
      └── persistBootstrapSnapshot()
```

### 9.2 手动存档

```
用户操作 → 存档管理
  │
  ├── 「保存人生」（在左栏或弹窗中触发）
  │   ├── 生成或确认存档 ID
  │   ├── localStorage: MJ_SAVE_V1:{id} = JSON.stringify(G)
  │   ├── 更新索引: MJ_SAVES_INDEX_V1 中添加/更新 id
  │   └── 更新活跃存档: MJ_ACTIVE_SAVE_ID_V1 = id
  │
  ├── 「读取人生」（启动页）
  │   ├── 读取 MJ_SAVES_INDEX_V1 → 展示存档列表
  │   ├── 用户选择 → 读取 MJ_SAVE_V1:{id}
  │   ├── 写入 sessionStorage: mortal_journey_bootstrap_v1
  │   └── 跳转 main.html
  │
  └── 「删除存档」
      ├── 从 MJ_SAVES_INDEX_V1 移除 id
      ├── 删除 localStorage: MJ_SAVE_V1:{id}
      └── 若为活跃存档 → 清除 MJ_ACTIVE_SAVE_ID_V1
```

### 9.3 返回启动页

```
用户点击「返回」按钮
  │
  ├── persistBootstrapSnapshot() → 最终保存
  ├── sessionStorage.removeItem("mortal_journey_bootstrap_v1")
  │   └── 清理主界面缓存（防止误用）
  └── window.location.href = "./index.html"
      └── 返回后可「开始新人生」或「读取人生」
```

---

## 10. 属性计算完整管线

### 10.1 主角属性计算

```
PlayerBaseRuntime.computePlayerBase(G, fc, overrides)
  │
  ├── Step 1: 境界底数
  │   └── RealmState.getBaseStats(realm.major, realm.minor)
  │       └── 从境界表取出 8 维基础值（整行 hp/mp/patk/pdef/matk/mdef/foot/sense）
  │
  ├── Step 2: 收集静态加成
  │   ├── 难度修正 (DIFFICULTIES[difficulty].bonus)
  │   ├── 出身加成 (BIRTHS[birth].bonus)
  │   └── 出身自带物品加成 (collectBirthStuffBonusObjects)
  │
  ├── Step 3: 收集功法加成
  │   └── collectGongfaSlotBonuses(gongfaSlots, realm)
  │       ├── 遍历 8 格功法
  │       ├── 取每格的 bonus（优先格内，回退配置表）
  │       └── × 境界倍率（REALM_EQUIP_BONUS_RATIO_MAP）
  │           ├── 练气初期 ×1.25 → 化神 ×10.00
  │
  ├── Step 4: 收集装备加成
  │   └── collectEquipmentSlotBonuses(equippedSlots, realm)
  │       ├── 遍历 4 格佩戴（武器/法器/防具/载具）
  │       └── 同功法 × 境界倍率
  │
  ├── Step 5: 平面加成合并
  │   └── mergeZhBonusesOntoPlayerBase(境界底数, 全部加成列表)
  │       ├── 逐项累加（中文键→英文键映射：血量→hp, 物攻→patk, ...）
  │       ├── 魅力默认 10, 气运默认 10
  │       └── 魅力/气运钳制 [0, 100]
  │
  ├── Step 6: 灵根乘法
  │   └── LinggenState.applyToBase(平面合并结果, majorRealm, linggenText)
  │       ├── parseElements(linggenText) → 五行列表 ["金","木"]
  │       ├── 每种五行 × 大境界倍率（练气×1.05 ~ 化神×2.00）
  │       │   ├── 金 → patk, matk × 倍率
  │       │   ├── 木 → sense × 倍率
  │       │   ├── 水 → mp × 倍率
  │       │   ├── 火 → hp × 倍率
  │       │   └── 土 → pdef, mdef × 倍率
  │       └── 魅力/气运不参与灵根乘法
  │
  └── Step 7: 收尾
      └── finalizeAfterLinggenMultiply()
          ├── 八维 Math.round() 取整
          └── 魅力/气运再钳制 [0, 100]
```

### 10.2 战斗消耗的 HP/MP 恢复

```
非战斗恢复（状态 AI 可写回）：
  └── applyUserStatePatch(G, patch)
      ├── patch.currentHp → G.currentHp = clamp(0, maxHp, patch.currentHp)
      └── patch.currentMp → G.currentMp = clamp(0, maxMp, patch.currentMp)

装备/功法变化导致的 HP/MP 上限变化：
  └── syncCurrentResource(prevMax, newMax, current, fullFill)
      ├── delta = newMax - prevMax
      ├── newCurrent = current + delta
      └── clamp(0, newMax, newCurrent)
```

---

## 11. 世界书注入流程

```
每次 AI 请求前 → buildMessages → 世界书注入
  │
  ├── 1. 构建扫描文本 buildScanText()
  │     ├── 运行时存档摘要（角色概要/面板/装备/储物袋）
  │     ├── 剧情快照沿革（chatPlotSnapshotLog）
  │     ├── 上一轮 assistant 剧情全文
  │     └── 当前用户输入
  │
  ├── 2. selectEntries(scanText, { maxEntries: 10 })
  │     ├── 分离 constant 条目（始终入选）
  │     ├── 对每个条目计算命中分
  │     │   └── scanText.toLowerCase().indexOf(key.toLowerCase()) !== -1 → hits++
  │     ├── 排序：priority 降 → hits 降 → id 字典序
  │     └── 截断到 maxEntries
  │
  └── 3. formatForSystem(entries)
        └── 拼接为 【世界书摘录】 + 条目列表
            └── 注入到 system prompt 尾部
```

---

## 12. API 桥接调用流程

```
TavernHelper.generateFromMessages({ messages, should_stream, onDelta, signal })
  │
  ├── 1. 确定 API 配置（优先级从高到低）
  │     ├── localStorage IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1（用户设置）
  │     ├── FIXED_PRESET（代码内预设）
  │     └── defaultPresetTemplate（兜底）
  │
  ├── 2. 构建请求
  │     ├── URL: {apiUrl}/chat/completions
  │     ├── Headers: Authorization Bearer {apiKey}
  │     └── Body: { model, messages, temperature, stream }
  │
  ├── 3. 发送请求
  │     ├── 流式模式 (stream: true)
  │     │   ├── fetch() + ReadableStream
  │     │   ├── 解析 SSE (data: {...}\n\n)
  │     │   ├── extractOpenAiStreamDeltaText(parsed)
  │     │   │   └── 合并 content / reasoning_content / text / legacy text
  │     │   ├── onDelta(fullText, deltaChunk) 回调
  │     │   ├── chunkIdle 超时: 300s
  │     │   └── totalMax 超时: 300s
  │     │
  │     └── 非流式模式 (stream: false)
  │         ├── fetch() 普通请求
  │         ├── extractOpenAiNonStreamMessageText(data)
  │         └── 超时: 300s
  │
  ├── 4. 返回结果
  │     └── resolve({ text: "完整响应文本" })
  │
  └── 5. 错误处理
        ├── 网络错误 → reject
        ├── HTTP 非 200 → reject(响应JSON或状态文本)
        ├── 超时 → AbortController.abort() → reject
        └── JSON 解析失败 → reject
```

---

## 13. 调试日志系统

```
GameLog 全局对象
  │
  ├── 日志级别
  │   ├── GameLog.info(msg, ...)  → 普通信息
  │   ├── GameLog.warn(msg, ...)  → 警告
  │   └── GameLog.error(msg, ...) → 错误
  │
  ├── 输出目标
  │   ├── 浏览器 console（始终输出）
  │   └── 页面左下角可折叠面板（可选，研发调试用）
  │       ├── MJ_GAME_LOG_PANEL_UI_ENABLED 控制开关
  │       ├── GitHub Pages 自动关闭（除非 URL 参数 ?mjDebugLog=1）
  │       └── 最多保留 500 行
  │
  ├── console 接管（可选）
  │   └── 拦截原生 console.log/warn/error → 同时输出到面板
  │
  └── 时间戳格式
      └── HH:MM:SS.mmm
```

---

## 14. 错误处理与容错机制

```
全局错误处理策略
  │
  ├── AI 调用失败
  │   ├── 剧情 AI 失败
  │   │   ├── 显示错误消息到聊天区
  │   │   ├── 保留上一轮上下文（_mjStoryRetryContext）
  │   │   └── 用户可点击「重试」
  │   │
  │   └── 状态 AI 失败
  │       ├── 保留剧情原文（_mjStateRetryStoryRaw）
  │       ├── 状态解析失败不影响已显示的剧情
  │       └── 可重试
  │
  ├── 标签解析容错
  │   ├── 多级回退策略（以储物袋解析为例）
  │   │   ├── 1) 尝试 split_tags（新标签：spirit_stone/item_add/item_remove）
  │   │   ├── 2) 回退旧标签 <mj_inventory_ops>
  │   │   ├── 3) 回退 Markdown 围栏内 JSON
  │   │   └── 4) 回退末行 JSON
  │   │
  │   └── JSON 解析失败 → 跳过该项，记录错误，继续处理其他项
  │
  ├── 数据完整性
  │   ├── ensureGameRuntimeDefaults(G) → 补全所有缺失字段
  │   ├── ensureInventorySlots(G) → 保证储物袋长度 ≥ 12
  │   ├── ensureEquippedSlots(G) → 保证佩戴栏 4 格
  │   ├── ensureGongfaSlots(G) → 保证功法栏 8 格
  │   └── ensureNearbyNpcsArray(G) → 保证 NPC 数组存在
  │
  ├── 世界时间单调性
  │   └── applyWorldStatePatch 中校验
  │       ├── 新时间 < 当前时间 → 拒绝更新（rejectedWorldTime）
  │       └── 格式无效 → 拒绝更新
  │
  └── UI 异常
      ├── try/catch 包裹所有 render 调用
      ├── 渲染失败 → console.warn，不影响游戏状态
      └── 关键操作（如存档）→ 静默失败（catch 空块）
```

---

## 15. 全局状态转换图

```
                    ┌─────────────┐
                    │  启动页      │
                    │  index.html  │
                    └──────┬──────┘
                           │ 开始人生 / 读取人生
                           ▼
                    ┌─────────────┐
                    │  主界面      │
                    │  main.html   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ 新档门闩  │ │ 正常游戏  │ │ 读档恢复  │
        │ 4 阶段   │ │ 主循环    │ │ 直接可玩  │
        └────┬─────┘ └────┬─────┘ └──────────┘
             │            │
             ▼            ▼
        ┌──────────────────────────┐
        │     游戏主循环            │
        │  用户输入 → AI → 更新     │
        └──────────┬───────────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐
  │ 剧情回合 │ │ 战斗回合 │ │ 修炼回合 │
  │ 叙事推进 │ │ 回合制战 │ │ 灵石炼化 │
  └────┬────┘ └────┬────┘ └────┬────┘
       │           │           │
       └───────────┴───────────┘
                   │
                   ▼
            ┌─────────────┐
            │  状态同步    │
            │  界面刷新    │
            │  自动存档    │
            └─────────────┘
                   │
                   ▼
            ┌─────────────┐
            │  等待下轮    │
            │  用户输入    │
            └─────────────┘
```

---

*文档基于 2026-06-18 代码快照分析。所有流程均从实际源代码提取。*
