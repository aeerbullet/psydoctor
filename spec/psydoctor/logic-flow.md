# psydoctor（心理医生成长记）游戏逻辑流程文档

> 基于架构设计文档 v1.0，覆盖游戏运行的完整逻辑流程、决策树与状态转换序列。所有逻辑流程均对应架构文档中的模块职责与数据流设计，确保可实现性。

---

## 1. 总体游戏循环

```
┌──────────────────────────────────────────────────────────────────┐
│                      游戏主循环（Main Loop）                       │
│                                                                   │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ 用户输入  │ → │ 世界 AI  │ → │ 角色 AI  │ → │ 状态 AI  │     │
│  │ (聊天框) │   │(环境叙事)│   │(逐个发言)│   │(状态同步)│     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       ↑                              │            │              │
│       │                              │            ▼              │
│       │              ┌──────────┐    │     ┌───────────┐        │
│       │              │ 个案会话  │    │     │ 游戏更新   │        │
│       │              │ (触发时) │    │     │ (面板刷新) │        │
│       │              └──────────┘    │     └───────────┘        │
│       │                              │                           │
│       └──────────── 循环 ────────────┘                           │
└──────────────────────────────────────────────────────────────────┘
```

每次玩家发言执行一个完整的 **多角色 AI 管线**（世界 AI → 角色 AI(s) → 状态 AI），随后界面刷新，检查特殊系统触发器（个案/伦理困境/反移情告警/理论里程碑/失误告警/脱落预警），等待下一次输入。

**v2.0 与旧架构的关键差异**：
- 叙事 AI 拆分为世界 AI（场景叙事）+ 角色 AI（独立人格发言）——不再一人演所有角色
- 咨询师内心活动不再需要——咨询师就是玩家
- 新增治疗失误追踪 + 来访者脱落预警 + 声誉系统 + 执照危机（详见 architecture.md §12 + logic-flow.md §10-§13）
- 每条 AI 调用的消息结构遵循前缀缓存优化（详见 architecture.md §5.6）

---

## 2. 游戏启动流程

### 2.1 整体启动顺序

```
浏览器访问 index.html
        │
        ▼
┌──────────────────────┐
│  Phase 1: 启动页      │  index.html
│  API 设置（可跳过）   │  ├── 填写 API URL / Key / Model
│                      │  ├── 写入 localStorage
│                      │  └── bridge.js 优先读取覆盖配置
│                      │      (键名复用 IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Phase 2: 人生选择    │  index.html#fate
│  Step 1: 教育背景    │  ├── 6 选 1（心理学本科/跨专业转行/
│                      │  │   精神科医生/社工出身/哲学学者/亲历者转型）
│                      │  ├── 每个背景预设初始等级 + 初始理论 + bonus
│                      │  └── 写入 fateChoice.education
│                      │
│  Step 2: 入行契机    │  ├── 5 选 1（助人理想/智识好奇/
│                      │  │   命运推动/创伤转化/导师感召）
│                      │  ├── 每个契机提供特定属性 bonus
│                      │  └── 写入 fateChoice.motivation
│                      │
│  Step 3: 个人特质    │  ├── 5 大类（疗愈者/思想家/沟通者/
│                      │  │   守护者/开创者）
│                      │  ├── 每类 2-4 个具体特质，选取 2 个
│                      │  ├── 特质提供可成长的属性修饰
│                      │  └── 写入 fateChoice.traits[]
│                      │
│  Step 4: 初始理论    │  ├── 默认根据教育背景自动设定
│                      │  ├── 玩家可微调（下拉选择 32+ 理论之一）
│                      │  └── 写入 fateChoice.initialTheory
│                      │
│  Step 5: 角色信息    │  ├── 角色名 (playerName)
│                      │  ├── 性别 (gender)
│                      │  └── 年龄默认 18-35（根据教育背景自动设定）
└──────────┬───────────┘
           │ 点击「开始人生」
           ▼
┌──────────────────────┐
│  Phase 3: 创建存档    │  fateChoiceController.js
│  构建 fateChoice     │  ├── education, motivation
│  创建存档槽          │  ├── initialTheory, traits[]
│  写入 session        │  ├── playerName, gender, age
│  Storage             │  └── 写入 PSY_SAVE_V1:{id}
│  跳转 main.html      │      + psydoctor_bootstrap_v1
└──────────┬───────────┘
           │ window.location.href = "./main.html"
           ▼
┌──────────────────────┐
│  Phase 4: 主界面      │  main.html → mainScreen.js init()
│  恢复存档            │  ├── 读取 sessionStorage psydoctor_bootstrap_v1
│  门闩判断            │  ├── 新档 → 4 阶段 Bootstrap Gate
│  或读档流程          │  └── 读档 → runNormalFirstEnterPipeline
└──────────────────────┘
```

### 2.2 人生选择详细流程

```
PsyFateChoiceController 初始化
  │
  ├── 1. 加载 PsyDoctorCreationConfig
  │     ├── EDUCATION_OPTIONS = [
  │     │     { key:"psychology_ba", label:"心理学本科", initialLevel:{major:"心理学徒",minor:"初窥"},
  │     │       initialTheory:"来访者中心治疗", bonus:{knowledge:3, technique:1}, age:18, ... }
  │     │   ]
  │     ├── MOTIVATION_OPTIONS = [
  │     │     { key:"helping_ideal", label:"助人理想",
  │     │       bonus:{empathy:5, awareness:3}, desc:"..." }
  │     │   ]
  │     └── TRAIT_CATEGORIES = {
  │           healer: [{ key:"empathy_gift", label:"共情天赋", bonus:{empathy:3}, ... }],
  │           thinker: [...], communicator: [...], guardian: [...], pioneer: [...]
  │         }
  │
  ├── 2. 渲染 Step 1: 教育背景选择
  │     ├── 6 张卡片，点击选中高亮
  │     ├── 每张卡片显示：名称 / 初始等级 / 初始理论 / 优势描述
  │     └── 选中 → 预览初始等级属性表（从 DoctorLevelState 查表）
  │
  ├── 3. 渲染 Step 2: 入行契机选择
  │     ├── 5 张卡片，点击选中高亮
  │     ├── 每张卡片显示：名称 / 属性加成 / 叙事描述
  │     └── 选中 → 预览合并后的 8+2 属性初值
  │
  ├── 4. 渲染 Step 3: 个人特质选择
  │     ├── 5 大分类标签页
  │     ├── 每类 2-4 个具体特质（每个含 name/desc/effects）
  │     ├── 最多选 2 个（可跨类）
  │     └── 已选 2 个后其余变灰
  │
  ├── 5. 渲染 Step 4: 初始理论微调
  │     ├── 默认值 = 教育背景对应的 initialTheory
  │     ├── 下拉列表 = 全部 32+ 理论（按 5 大流派分组）
  │     └── 切换 → 预览该理论的简介和属性贡献
  │
  ├── 6. 渲染 Step 5: 角色信息
  │     ├── 角色名输入框（必填）
  │     ├── 性别单选（男/女/其他）
  │     └── 年龄自动填充（教育背景决定，可微调 ±3 岁）
  │
  └── 7. 「开始人生」按钮
        ├── 校验：角色名非空
        ├── 构建 fateChoice = {
        │     education: "心理学本科",
        │     motivation: "助人理想",
        │     initialTheory: "来访者中心治疗",
        │     traits: [{ key:"empathy_gift", category:"healer" }, { key:"precision_language", category:"communicator" }],
        │     playerName: "林心",
        │     gender: "女",
        │     age: 22,
        │   }
        ├── 生成存档 ID (PSY_save_001)
        ├── 创建 PsyDoctorGame 初始对象
        │   ├── fateChoice = fateChoice（快照保存）
        │   ├── doctorLevel = EDUCATION_OPTIONS[key].initialLevel
        │   ├── levelIndex = 0
        │   ├── clinicalHours = 0
        │   ├── supervisionHours = 0
        │   ├── personalTherapyHours = 0
        │   ├── researchPoints = 0
        │   ├── theoryMastery = {
        │   │     [fateChoice.initialTheory]: { stage: 1, hours: 0 }
        │   │   }
        │   ├── philosophyDepth = { "现象学":0, "诠释学":0, "存在哲学":0, "东方心学":0, "后现代批判":0 }
        │   ├── activeTheoryOrientation = fateChoice.initialTheory
        │   ├── currentWorkplace = EDUCATION_OPTIONS[key].defaultWorkplace
        │   ├── currentLocation = EDUCATION_OPTIONS[key].defaultLocation
        │   ├── worldTimeString = 根据 age 推算当前年月
        │   ├── bookShelf = []
        │   ├── assessmentTools = []
        │   ├── therapyTools = []
        │   ├── currentClients = []
        │   ├── nearbyPeople = []
        │   ├── countertransference = { overIdentification:0, defensiveDistancing:0,
        │   │     saviorComplex:0, professionalArrogance:0,
        │   │     burnoutNumbness:0, ethicalBlurring:0, overallRiskLevel:"low" }
        │   ├── chatHistory = []
        │   ├── chatActionSuggestions = null
        │   ├── pendingCaseSession = null
        │   ├── activeCaseSession = null
        │   └── psyInitStateAiApplied = false
        ├── 写入 localStorage: PSY_SAVE_V1:{id}
        ├── 更新存档索引: PSY_SAVES_INDEX_V1
        ├── 写入 sessionStorage: psydoctor_bootstrap_v1
        └── window.location.href = "./main.html"
```

### 2.3 读档流程

```
启动页「读取人生」
  │
  ├── 1. 从 localStorage 读取 PSY_SAVES_INDEX_V1 → 存档 ID 列表
  ├── 2. 展示存档列表（显示角色名/等级/临床时数/世界时间）
  ├── 3. 用户选择存档
  │     ├── 读取 localStorage: PSY_SAVE_V1:{id} → 完整 PsyDoctorGame
  │     ├── 写入 sessionStorage: psydoctor_bootstrap_v1
  │     ├── 设置 PSY_ACTIVE_SAVE_ID_V1
  │     └── 跳转 main.html
  │
  └── 4. main.html 入口
        ├── restoreBootstrap() → 读取 sessionStorage
        ├── shouldRunBootstrapAiGate(G0) → 判断条件：
        │   ├── chatHistory 中已存在 user/assistant 消息 → false（跳过门闩）
        │   ├── psyInitStateAiApplied === true → false（已初始化过）
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
  if (G0.psyInitStateAiApplied === true) return false; // 已初始化
  return true;  // 新档，需要门闩
}
```

### 3.2 阶段一：开局人生剧情 AI

```
Phase 1: openingStory
  │
  ├── 入口：PsyDoctorWorldGenerate.runOpeningStoryStrictPromise()
  │
  ├── buildOpeningUserPrompt(fc, G)
  │   ├── 判断 postInit（psyInitStateAiApplied）
  │   │   ├── true（读档后重开门闩）→ 要求叙事与已落库面板一致
  │   │   └── false（新档）→ 先写剧情，后续配置 AI 对齐
  │   ├── 注入命运抉择信息：
  │   │   ├── 教育背景：「你是一名心理学本科新生，刚踏入大学校园...」
  │   │   ├── 入行契机：「你选择心理学的初衷是帮助像我一样痛苦的人...」
  │   │   ├── 初始理论：「你在图书馆偶然翻到了罗杰斯的《成为一个人》...」
  │   │   └── 个人特质：「你天生对他人的情绪敏感，善于用语言准确表达...」
  │   ├── 注入叙事约束：
  │   │   ├── 禁止在开局叙事中引入来访者（尚未完成培训）
  │   │   ├── 禁止在开局叙事中让主角做出重大职业决策
  │   │   ├── 叙事应聚焦于「起点感」和「未来可能性」
  │   │   └── 允许引入同学、老师、家人作为背景人物
  │   └── 注入叙事人称（第一/第二/第三人称）
  │
  ├── 调用叙事 AI（复用 PsyDoctorStoryGenerate.sendTurn）
  │   └── skipStateAfterStory = true
  │       （此阶段不跑状态 AI，主角由后续配置 AI 写面板）
  │
  ├── AI 返回叙事正文
  │   ├── 提取 <psy_story_body> 内的纯叙事
  │   ├── 去除行动建议/个案触发/伦理困境/理论洞见标签
  │   └── 写入 G.chatHistory（role: "assistant"，全文保留）
  │
  └── 结果写入门闩 UI
      ├── 成功 → 显示绿色 "✓ 人生剧情已生成 (3.2s)"，自动进入阶段二
      └── 失败 → 显示红色错误信息，可点「重试」重新执行阶段一
```

### 3.3 阶段二：开局配置 AI

```
Phase 2: initState
  │
  ├── 入口：PsyDoctorInitStateGenerate.runInitStateAiIfNeeded()
  │
  ├── 前置条件检查
  │   ├── TavernHelper 未就绪 → 跳过，reason: "no TavernHelper"
  │   ├── game 或 fateChoice 缺失 → 跳过
  │   └── 已执行过（psyInitStateAiApplied）→ 跳过
  │
  ├── 构建请求
  │   ├── system prompt = PsyDoctorInitStateRules.templates.systemPrompt
  │   │   （含心理学专业术语规范 + 标签变量填充）
  │   ├── user 消息 = 命运抉择 JSON + 开局剧情正文 + 物品参考表
  │   │   ├── 命运抉择：education, motivation, initialTheory, traits
  │   │   ├── 开局剧情正文：来自阶段一的 narrativeBody
  │   │   └── 物品参考表：经典心理学著作列表 + 基础测评工具 + 治疗工具
  │   └── 输出要求：三对标签顺序输出
  │       ├── <psy_init_loadout> — 初始藏书/工具/初始来访者
  │       ├── <psy_world_state> — 初始时间/地点/工作场景
  │       └── <psy_therapist_state> — 初始 8+2 属性微调
  │
  ├── 调用 AI（非流式）
  │
  ├── 解析 AI 响应
  │   ├── 提取 <psy_init_loadout> → applyInitLoadout(G, loadout)
  │   │   ├── loadout.books[] → 逐本添加至 bookShelf
  │   │   │   ├── 每本：{ name, author, theory, effectDesc, effectData }
  │   │   │   ├── 去重检查：同一书名+作者 → 视为已有，跳过
  │   │   │   └── 上限检查：bookShelf.length ≤ 30，超出时丢弃低阶书籍
  │   │   ├── loadout.tools[] → 添加至 therapyTools / assessmentTools
  │   │   │   └── 上限检查：therapyTools.length ≤ 10
  │   │   └── loadout.initialClient? → 创建首个来访者档案
  │   │       └── 写入 G.currentClients[0]（仅当叙事中自然出现了来访者）
  │   │
  │   ├── 提取 <psy_world_state> → parseWorldStateFromText()
  │   │   ├── worldTimeString → 格式校验 "YYYY年 MM月 DD日 HH:MM" → 写入 G
  │   │   ├── currentLocation → 写入 G.currentLocation
  │   │   ├── currentWorkplace → 写入 G.currentWorkplace
  │   │   └── age → 钳制 [18, 100] → 写入 G.age
  │   │
  │   └── 提取 <psy_therapist_state> → 覆写 8+2 属性初值
  │       ├── 只接受 ±5 以内的微调（硬约束，防止 AI 大幅改写）
  │       ├── 逐项校验属性名合法性（对照 CharacterAttribute 键表）
  │       └── 写入 G.psychologistBase（覆写部分字段）
  │
  ├── 计算完整心理医生面板
  │   └── PsychologistBaseRuntime.computePsychologistBase(G, fc)
  │       └── 等级表底数 → 教育+动机+特质 bonus → 理论学习深度 → 哲学维度 → 反移情惩罚 → 收尾
  │
  ├── 标记完成
  │   └── G.psyInitStateAiApplied = true
  │
  └── 结果写入门闩 UI
      ├── 成功 → 显示绿色 "✓ 初始配置已生成"，自动进入阶段三
      └── 失败 → 显示错误，可点「重试」
```

### 3.4 阶段三：状态同步 AI

```
Phase 3: stateSync
  │
  ├── 入口：PsyMainScreenChat.runStateAiTurn()
  │
  ├── 提取开局剧情正文
  │   └── extractLastAssistantOpeningStory(G)
  │       └── 从 chatHistory 最后一条 assistant 消息取全文
  │
  ├── 附加门闩专用提示
  │   └── "开局配置 AI 已写回初始藏书、工具与 8+2 属性。
  │        本回合请以周围人物为主：剧情中出现的同学、老师、同行
  │        须在 <psy_nearby_people> 给出完整列表；
  │        根据当前叙事生成合适的初始行动建议"
  │
  ├── 调用状态 AI（PsyDoctorStateGenerate.sendTurn）
  │   ├── system: 状态规则模板（state_rules.js）
  │   │   └── 含来访者状态/临床时数/反移情/物品操作的全部规则约束
  │   ├── user: 世界快照 + 8+2 属性 + 藏书/工具 + 周围人物快照 + 剧情正文
  │   └── 标签变量注入（{{COUNTERTRANSFERENCE_STATUS}} 等）
  │
  ├── 解析 AI 响应 → applyStateTurnFromAssistantText(G, text)
  │   ├── parseInventoryOpsFromText() → 藏书/工具增删
  │   ├── parseWorldStateFromText() → 世界时间/地点（单调校验）
  │   ├── parseTherapistStateFromText() → 疲劳/倦怠/自觉性变化
  │   ├── parseNearbyPeopleFromText() → 周围人物列表
  │   │   ├── 新人 → 完整规范化（ClientCharacterSheet）
  │   │   └── 已有人物 → 仅更新关键状态字段
  │   ├── parseClinicalGainFromText() → 初始临床时数（通常为 0）
  │   └── parseCountertransferenceFromText() → 初始反移情（全部为 0）
  │
  └── 结果写入门闩 UI
      ├── 成功 → 自动进入阶段四
      └── 失败 → 显示错误
```

### 3.5 阶段四：门闩完成

```
Phase 4: finishBootstrapGateSuccess()
  │
  ├── 清除临时存档标记
  │   └── 移除 sessionStorage 中的 provisional_save 标记
  │
  ├── 隐藏全屏门闩 UI
  │   └── fadeOut 动画（300ms）
  │
  ├── 刷新所有面板
  │   ├── renderLeftPanel(fc, G)          → 左栏：等级/8+2 属性/理论/哲学
  │   ├── renderBookShelfGrid(G)           → 藏书网格
  │   ├── renderTherapyToolGrid(G)         → 治疗工具网格
  │   ├── renderRightPanel(G)              → 右栏：来访者列表/同行/督导师
  │   └── renderChatHistory(G)             → 聊天区：开局剧情
  │
  ├── 持久化快照
  │   ├── persistBootstrapSnapshot()       → sessionStorage
  │   └── localStorage 镜像备份
  │       └── 键：psydoctor_last_session_v1
  │
  ├── 同步知识基底到桥接存储
  │   └── PsyDoctorWorldBook.syncToBridgeStorage()
  │
  └── 启动自动保存定时器
      └── setInterval(autoSave, 4000)
```

### 3.6 门闩异常处理

```
门闩任意阶段出错时
  │
  ├── 显示错误信息
  │   ├── 阶段名称 + 错误原因（红色）
  │   ├── AI 返回内容预览（截断 200 字）
  │   └── 时间戳
  │
  ├── 「重试」按钮
  │   └── 从失败的阶段重新执行（非从头开始）
  │       ├── Phase 2 失败 → 重跑 Phase 2
  │       └── Phase 3 失败 → 重跑 Phase 3
  │
  └── 「重新开始」按钮（兜底）
      └── 返回 index.html，清空 sessionStorage 中的 bootstrap 数据
```

---

## 4. 主游戏回合流程（v2.0 多角色 AI 管线）

> v2.0 更新：原双回合管线（叙事 AI → 状态 AI）升级为多角色管线。详见 architecture.md §5。

### 4.1 完整回合序列（v2.0）

```
玩家在聊天框输入文本并点击发送（或点击行动建议按钮）
  │
  ▼
┌──────────────────────────────────────────────────────────┐
│ Step 1: handleChatSend(userText)                         │
│   mainScreen_chat.js                                     │
│                                                          │
│   1.1 校验（与旧架构一致）                                │
│   1.2 预处理                                             │
│     ├── 写入 G.chatHistory[{ role: "user", content }]     │
│     ├── 渲染用户消息到聊天区                              │
│     └── 设置 PSY_AI_GENERATING = true                    │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│ Step 2: 世界 AI（World AI）— 1 次调用                    │
│   world_ai.js                                            │
│                                                          │
│   2.1 构建消息（缓存友好：固定在前，变化在后）            │
│     system: 叙事规则 + 世界设定 + 发言编排规则（固定）    │
│     user: 玩家输入 + 游戏状态摘要 + 前文上下文（变化）    │
│                                                          │
│   2.2 调用 AI（流式，超时 300s）                         │
│     └── onChunk → 追加到聊天区（打字效果）                │
│                                                          │
│   2.3 解析 <psy_scene_info> → speechSchedule             │
│     └── 决定本回合谁发言、什么顺序                        │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│ Step 3: 角色 AI 串行调用 — N 次（N = speechSchedule 长度）│
│   role_ai.js                                             │
│                                                          │
│   for each turn in speechSchedule:                       │
│     3.1 获取该角色的 speechProfile                       │
│     3.2 构建消息：                                       │
│       system: 角色人格描述（固定，命中专属 prefix cache） │
│       user: 场景上下文 + 前文 + [前一发言者原文]          │
│     3.3 调用 AI（流式，追加到聊天区）                    │
│     3.4 保存当前发言 → 作为下一角色的输入                │
│                                                          │
│   ⚠️ 串行调用保证对话感：角色 B 知道角色 A 说了什么      │
│   ⚠️ 同一角色同回合第二次发言 → system prompt 已缓存     │
│        → 延迟明显低于第一次                               │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│ Step 4: 状态 AI（State AI）— 1 次调用                    │
│   state_generate.js                                      │
│                                                          │
│   4.1 拼接完整叙事                                       │
│     └── 世界 AI 叙事 + 所有角色 AI 发言（按顺序）         │
│   4.2 构建消息（缓存友好）                                │
│     system: 状态规则模板（~2000 tokens，固定）            │
│     user: 完整叙事 + 游戏状态快照（变化）                 │
│   4.3 调用 AI（非流式，超时 60s）                        │
│   4.4 解析标签 → 逐项校验 → 写回 G                       │
│     └── 新增标签：psy_scene_info, psy_treatment_error,   │
│         psy_reputation_event                             │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│ Step 5: 后处理与触发器检查                                │
│   mainScreen_chat.js                                     │
│                                                          │
│   5.1 个案触发检查（pendingCaseSession）                  │
│   5.2 伦理困境检查（activeEthicalDilemma）               │
│   5.3 理论里程碑检查                                     │
│   5.4 反移情风险检查                                     │
│   5.5 治疗失误检查（新增 — treatment_error_tracker.js）   │
│   5.6 来访者脱落风险检查（新增 — 四级预警）               │
│   5.7 声誉事件检查（新增 — reputation_system.js）         │
│   5.8 执照状态检查（新增 — license_crisis.js）            │
│   5.9 等级晋升检查                                       │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│ Step 6: 刷新 UI                                          │
│                                                          │
│   6.1 刷新左栏（等级/属性/理论/哲学）                     │
│   6.2 刷新右栏（来访者卡片含脱落风险指示器）              │
│   6.3 刷新风险仪表盘（新增 — 执业安全度/风险评分/声誉）   │
│   6.4 持久化快照                                         │
│   6.5 解锁 UI（启用发送、聚焦输入框）                     │
│   6.6 缓存命中率日志（新增 — [psy:cache] 频道）           │
└──────────────────────────────────────────────────────────┘
```

### 4.2 角色 AI 串行调用详细流程

```
runRoleAiPhase(speechSchedule, worldAiNarrative, G)
  │
  ├── 初始化
  │   └── previousSpeeches = []
  │   └── previousSpeakerOutput = null
  │
  ├── for (i = 0; i < speechSchedule.length; i++):
  │   │
  │   ├── 1. 获取角色 profile
  │   │   └── profile = findRoleById(speechSchedule[i].id)
  │   │       ├── 从 G.nearbyPeople 查找（督导师/同行）
  │   │       └── 从 G.currentClients 查找（来访者）
  │   │
  │   ├── 2. 构建该角色的 system prompt（固定 → prefix cache）
  │   │   └── buildRoleSystemPrompt(profile.speechProfile)
  │   │       ├── roleType === "client" → 来访者人格模板
  │   │       ├── roleType === "supervisor" → 督导师人格模板
  │   │       └── roleType === "colleague" → 同行人格模板
  │   │
  │   ├── 3. 构建 user message
  │   │   └── [
  │   │         "【场景】" + worldAiNarrative,
  │   │         "【前文】" + recentHistorySummary,
  │   │         i > 0 ? "【前一个说话者】" + previousSpeakerOutput : "",
  │   │         "【你的回合】请生成你的发言。",
  │   │       ].join("\n")
  │   │
  │   ├── 4. 调用 AI（流式）
  │   │   └── TavernHelper.generateFromMessages({ messages, onChunk })
  │   │
  │   ├── 5. 追加到聊天区
  │   │   └── appendChatMessage("[角色名] " + text, "assistant")
  │   │
  │   └── 6. 保存上下文
  │       ├── previousSpeakerOutput = text
  │       └── previousSpeeches.push({ id, role, text })
  │
  └── 返回 { speeches: previousSpeeches, combinedText }
```

### 4.3 状态应用详细流程（applyStateTurnFromAssistantText）

> 核心逻辑与旧架构一致。新增标签：`psy_scene_info`、`psy_treatment_error`、`psy_reputation_event`、`psy_speech_habits_update`。详见 architecture.md §12。

```
applyStateTurnFromAssistantText(G, assistantText)
  │
  ├── Step 1: 标签提取
  │   └── 对所有已知 psy_* 标签，用正则 /<psy_xxx>([\s\S]*?)<\/psy_xxx>/g 提取
  │       已知标签列表（10 种状态标签）：
  │       psy_world_state, psy_therapist_state, psy_client_state,
  │       psy_clinical_gain, psy_supervision_notes, psy_career_event,
  │       psy_countertransference, psy_nearby_people,
  │       psy_inventory_ops, psy_theory_milestone
  │
  ├── Step 2: 逐标签解析
  │   │
  │   ├── 2.1 <psy_world_state>
  │   │   ├── JSON.parse → { worldTimeString, currentLocation, currentWorkplace, age }
  │   │   ├── 时间单调性校验：新时间 > G.worldTimeStack 最新时间
  │   │   │   ├── 通过 → 写入 G.worldTimeString，压入 worldTimeStack
  │   │   │   └── 不通过 → 记录日志，保留原时间
  │   │   ├── currentLocation → 写入 G.currentLocation
  │   │   ├── currentWorkplace → 写入 G.currentWorkplace
  │   │   └── age → 钳制 [18, 100]，仅当 > G.age 时写入
  │   │
  │   ├── 2.2 <psy_therapist_state>
  │   │   ├── JSON.parse → { currentFatigue, burnoutLevel, selfAwarenessChange }
  │   │   ├── currentFatigue → 钳制 [0, 100] → 写入 G.currentFatigue
  │   │   ├── burnoutLevel → 钳制 [0, 10] → 写入 G.burnoutLevel
  │   │   └── selfAwarenessChange → 应用于 G.psychologistBase.awareness（±5 内）
  │   │
  │   ├── 2.3 <psy_client_state>
  │   │   ├── JSON.parse → { clientId, symptomChange, allianceChange,
  │   │   │                   phaseProgress, defenseStatus }
  │   │   ├── 匹配 G.currentClients[clientId]
  │   │   │   ├── 找到 → 更新该来访者的状态字段
  │   │   │   │   ├── symptomLevel += symptomChange（钳制 [0, 100]）
  │   │   │   │   ├── therapeuticAlliance += allianceChange（钳制 [0, 100]）
  │   │   │   │   ├── treatmentPhase = phaseProgress
  │   │   │   │   └── defenseStatus = defenseStatus
  │   │   │   └── 未找到 → 记录日志，忽略此更新
  │   │   └── 检查结案条件：
  │   │       └── symptomLevel ≤ 5 且 treatmentPhase === "termination"
  │   │           → 触发结案流程（移至 completedCases，生成结案摘要）
  │   │
  │   ├── 2.4 <psy_clinical_gain>
  │   │   ├── JSON.parse → { clinicalHours, supervisionHours,
  │   │   │                   personalTherapyHours, theoryProgress, insightGained }
  │   │   ├── clinicalHours → 非负校验 → G.clinicalHours += clinicalHours
  │   │   ├── supervisionHours → 非负校验 → G.supervisionHours += supervisionHours
  │   │   ├── personalTherapyHours → 非负校验 → G.personalTherapyHours += it
  │   │   ├── theoryProgress → { theoryName: hoursGained } → 累积到对应理论的 hours
  │   │   │   └── **时数累积后，由 mainScreen_panel.js 的 checkTheoryProgress() 重新计算 stage**
  │   │   │       ├── 检查 hours 是否超过下一阶段阈值 [0, 10, 40, 100, 220, 460, 960]
  │   │   │       └── 若超过，自动提升 stage 并触发晋升通知
  │   │   └── insightGained → 临时记录（用于面板提示）
  │   │
  │   ├── 2.5 <psy_supervision_notes>
  │   │   ├── JSON.parse → { supervisorFeedback, blindSpotIdentified, growthArea }
  │   │   └── 追加到 G.careerHistory（type: "supervision"）
  │   │       └── 附带时间戳 (worldTimeString)
  │   │
  │   ├── 2.6 <psy_career_event>
  │   │   ├── JSON.parse → { eventType, description, requirements, deadline }
  │   │   ├── 创建 careerEvent 对象
  │   │   └── 推入 G.activeCareerEvents[]
  │   │       └── 去重：同 eventType 的活跃事件最多 1 个
  │   │
  │   ├── 2.7 <psy_countertransference>
  │   │   ├── JSON.parse → { type, change, triggerSource, riskLevel, manifestation }
  │   │   ├── type 校验：必须在 6 种有效类型中
  │   │   ├── G.countertransference[type] += change（钳制 [0, 100]）
  │   │   ├── 重新计算 overallRiskLevel：
  │   │   │   ├── 统计各类型最大值
  │   │   │   ├── max ≤ 15 → "low"
  │   │   │   ├── max 16-30 → "medium"
  │   │   │   ├── max 31-50 → "high"
  │   │   │   └── max > 50 → "critical"
  │   │   └── manifestation → 追加到 G.careerHistory（type: "countertransference"）
  │   │
  │   ├── 2.8 <psy_nearby_people>
  │   │   ├── JSON.parse → [{ characterSheet }]
  │   │   ├── 遍历列表：
  │   │   │   ├── 按 id 匹配 G.nearbyPeople 已有条目
  │   │   │   │   ├── 找到且已有完整 profile → 仅更新浮动的状态字段
  │   │   │   │   │   （理论取向、当前状态、与主角关系阶段）
  │   │   │   │   └── 未找到 → 完整规范化（ClientCharacterSheet）→ 推入列表
  │   │   │   └── 过期的条目（AI 未再提及）→ 标记而非删除
  │   │   │       └── 保留在列表中但显示「已离开」状态
  │   │   └── G.nearbyPeople = 合并后的列表
  │   │
  │   ├── 2.9 <psy_inventory_ops>
  │   │   ├── JSON.parse → [{ op, name, count, type, ... }]
  │   │   ├── 逐条执行：
  │   │   │   ├── op === "add" →
  │   │   │   │   ├── type === "book" → addToBookShelf(name, count, details)
  │   │   │   │   │   └── 去重 + 上限 30 检查
  │   │   │   │   ├── type === "tool" → addToTherapyTools(name, details)
  │   │   │   │   │   └── 上限 10 检查
  │   │   │   │   └── type === "assessment" → addToAssessmentTools(name, details)
  │   │   │   │       └── 需要培训前提检查（如 MMPI-2 需特定培训）
  │   │   │   └── op === "remove" →
  │   │   │       ├── type === "book" → removeFromBookShelf(name, count)
  │   │   │       ├── type === "tool" → removeFromTherapyTools(name)
  │   │   │       └── type === "assessment" → removeFromAssessmentTools(name)
  │   │   └── 规范化数组（移除 count=0 的条目）
  │   │
  │   └── 2.10 <psy_theory_milestone>
  │       ├── JSON.parse → { theoryName, milestoneType, description, integrationUnlocked }
  │       │   └── milestoneType: "stage_advance" | "integration_ready" | "innovation_unlocked"
  │       ├── 校验 theoryName 在 TheoryState 中存在
  │       ├── **注意：此标签仅作为"通知"和"标记"使用，不直接修改 stage**
  │       │   └── stage 的实际提升由 mainScreen_panel.js 根据 hours 累积计算后设置
  │       ├── 若 milestoneType === "stage_advance"：
  │       │   ├── 标记 G.theoryMastery[theoryName].pendingMilestone = true
  │       │   ├── 触发 UI 通知：「🎓 你对【认知治疗】的理解已达「掌握」阶段」
  │       │   └── 实际 stage 提升由 applyClinicalGain 后的面板逻辑完成
  │       ├── 若 milestoneType === "integration_ready"：
  │       │   └── 推入整合候选列表
  │       │       └── G.theoryMastery[theoryName].integrationAvailable = [...]
  │       └── 若 milestoneType === "innovation_unlocked"：
  │           └── 标记该理论可进入"创新"阶段（需额外叙事条件）
  │
  ├── Step 3: 标签解析失败处理
  │   └── 单个标签解析失败 → 记录日志 + 跳过此标签
  │       其他标签正常应用（渐进式容错）
  │       所有失败汇总在调试日志 [psy:state] 频道
  │
  └── Step 4: 触发后处理
      ├── 个案触发检查（pendingCaseSession）
      ├── 伦理困境检查（activeEthicalDilemma）
      ├── 理论阶段晋升检查
      ├── 反移情风险阈值检查
      └── 职业生涯事件提醒
```

---

## 5. 咨询个案系统逻辑流程

### 5.1 个案触发检测

```
检测个案触发（在 Step 5 后处理阶段）
  │
  ├── 来源 1：叙事 AI 在正文中输出 <psy_case_session_trigger>
  │   └── 正则提取：/<psy_case_session_trigger>([\s\S]*?)<\/psy_case_session_trigger>/
  │
  ├── 来源 2：状态 AI 在状态同步中输出 <psy_case_session_trigger>
  │   └── 在 applyStateTurnFromAssistantText 的 Step 4 中检测
  │
  ├── 解析 payload：
  │   {
  │     clientId: "client_001",            // 已有来访者 ID（或 "new"）
  │     newClient: { ... },                // 新来访者档案（若 clientId 为 "new"）
  │     caseType: "存在危机型",            // 来访者案例类型
  │     triggerKind: "scheduled",          // scheduled / emergency / intake / followup
  │     initialAssessment: "来访者张某，20岁男性，主诉..." // AI 的初步评估
  │   }
  │
  └── 写入 G.pendingCaseSession = payload
```

### 5.2 个案启动

```
CaseSessionEngine.startCaseSession(payload)
  │
  ├── 1. 构建来访者档案
  │   ├── clientId !== "new"?
  │   │   ├── YES → 从 G.currentClients 按 id 查找（已有来访者）
  │   │   └── NO → 从 payload.newClient 创建新来访者档案
  │   │       ├── 应用 ClientTemplates[caseType] 模板
  │   │       │   ├── 初始化 symptomLevel（根据案例类型预设）
  │   │       │   ├── 初始化 defenseProfile（防御强度）
  │   │       │   ├── 初始化 therapeuticResistance（阻抗）
  │   │       │   └── 初始化 insightCapacity（洞察潜力）
  │   │       └── 推入 G.currentClients[]
  │   └── 构建完整 clientSheet：
  │       {
  │         id, displayName, age, gender,
  │         chiefComplaint, caseType,
  │         symptomLevel,          // [0, 100]，100=最严重
  │         therapeuticAlliance,   // [0, 100]，初始 50
  │         treatmentPhase,        // "initial"
  │         defenseProfile: {      // 由 ClientTemplates 初始化
  │           primaryDefense: "理智化",
  │           defenseStrength: 65,  // [0, 100]
  │           flexibility: 30,      // [0, 100]，防御可变性
  │         },
  │         therapeuticResistance: 55,  // [0, 100]
  │         insightCapacity: 45,        // [0, 100]
  │         attachmentStyle: "anxious", // secure/anxious/avoidant/disorganized
  │         traumaHistory: [...],
  │         resources: [...],
  │         treatmentGoals: [...],
  │         sessionCount: 0,
  │       }
  │
  ├── 2. 计算咨询师当前能力
  │   ├── 读取 G.psychologistBase (8+2 属性)
  │   ├── 读取 G.activeTheoryOrientation
  │   ├── 计算 6 种干预技术的能力值：
  │   │   ├── empathicResponse = empathy×0.8 + communication×0.2
  │   │   ├── interpretation = insight×0.7 + knowledge×0.3
  │   │   ├── behavioralTech = technique×0.7 + judgment×0.3
  │   │   ├── experientialTech = awareness×0.6 + empathy×0.4
  │   │   ├── systemicIntervention = communication×0.6 + insight×0.4
  │   │   └── silentPresence = humanity×0.5 + awareness×0.5
  │   └── 应用反移情惩罚（见 §8.3）
  │       └── overallRiskLevel === "high" → 自觉性 ×0.75, 论断力 ×0.85
  │
  ├── 3. 进入个案主循环（见 §5.3）
  │
  └── 4. 设置 G.activeCaseSession = sessionState
```

### 5.3 个案主循环（runCaseSession）

```
runCaseSession(clientSheet, therapistAbilities)
  │
  ├── 初始化会话状态
  │   sessionState = {
  │     round: 0,
  │     maxRounds: 20,               // 对应约 50 分钟咨询
  │     initialSymptom: clientSheet.symptomLevel,
  │     initialAlliance: clientSheet.therapeuticAlliance,
  │     currentSymptom: clientSheet.symptomLevel,
  │     currentAlliance: clientSheet.therapeuticAlliance,
  │     insightGained: 0,
  │     allianceHistory: [],          // 追踪每回合联盟变化
  │     interventionLog: [],          // 追踪每回合干预选择
  │     criticalMoments: [],          // 关键转折点
  │     terminated: false,
  │     outcome: null,
  │   }
  │
  ├── 循环（最多 20 回合）:
  │   │
  │   ├── Round {sessionState.round + 1}:
  │   │   │
  │   │   ├── 3.1 AI 生成来访者当前状态描述
  │   │   │   ├── 输入：clientSheet + sessionState + 历史回合记录
  │   │   │   ├── AI 生成来访者在当前时刻的言语/情绪/非言语表现
  │   │   │   │   "张某低着头，手指不停地摩擦杯沿。'我也不知道...'
  │   │   │   │    他的声音很轻，像是在对自己说话。"
  │   │   │   └── 渲染到来访者话语区（左侧气泡，蓝色边框）
  │   │   │
  │   │   ├── 3.2 玩家选择干预技术
  │   │   │   ├── 展示 6 个干预按钮（当前能力值 + 向玩家展示）
  │   │   │   │   ┌────────────────────────────────────────┐
  │   │   │   │   │ [共情回应 68] [诠释干预 55] [行为技术 42]│
  │   │   │   │   │ [体验技术 50] [系统干预 48] [沉默在场 45]│
  │   │   │   │   └────────────────────────────────────────┘
  │   │   │   ├── 每个按钮旁显示预估效果：
  │   │   │   │   - 共情回应：预计联盟 +3~8，防御 -3~8
  │   │   │   │   - 诠释干预：预计洞察 +5~15，可能触发阻抗
  │   │   │   │   - 行为技术：预计症状 -3~8，防御 -2~5
  │   │   │   │   - ...
  │   │   │   ├── 玩家点击选择
  │   │   │   └── 选择加入 interventionLog
  │   │   │
  │   │   ├── 3.3 引擎计算干预效果
  │   │   │   ├── computeInterventionEffect(techniqueType, clientSheet, sessionState, G)
  │   │   │   │   │
  │   │   │   │   ├── 基础效果 = therapistAbilities[techniqueType]
  │   │   │   │   ├── 联盟系数 = sessionState.currentAlliance / 100
  │   │   │   │   ├── 时机恰当度 = 1.0 + AI追加评定（-0.2 ~ +0.2）
  │   │   │   │   │   └── 由叙事 AI 在生成来访者回应时隐式判定
  │   │   │   │   ├── 防御阻碍 = clientSheet.defenseProfile.defenseStrength / 100
  │   │   │   │   ├── 阻抗阻碍 = clientSheet.therapeuticResistance / 100
  │   │   │   │   ├── 随机因素 = random(-0.1, +0.1)
  │   │   │   │   │
  │   │   │   │   └── rawEffect = 基础效果 × 联盟系数 × 时机恰当度
  │   │   │   │                  - 防御阻碍 × 阻抗阻碍 × 50
  │   │   │   │                  + 随机因素 × 20
  │   │   │   │
  │   │   │   └── 各维度的效果分配：
  │   │   │       ├── 共情回应：
  │   │   │       │   allianceChange = +rawEffect×0.06（上限 +8）
  │   │   │       │   defenseChange = -rawEffect×0.05（下限 -8）
  │   │   │       │   symptomChange = -rawEffect×0.02（下限 -3）
  │   │   │       ├── 诠释干预：
  │   │   │       │   insightGain = +rawEffect×0.10
  │   │   │       │   allianceChange = ±rawEffect×0.02（可能 + 或 -）
  │   │   │       │   defenseChange = +rawEffect×0.03（可能触发阻抗！）
  │   │   │       ├── 行为技术：
  │   │   │       │   symptomChange = -rawEffect×0.06（下限 -10）
  │   │   │       │   allianceChange = +rawEffect×0.02
  │   │   │       ├── 体验技术：
  │   │   │       │   allianceChange = +rawEffect×0.04
  │   │   │       │   insightGain = +rawEffect×0.06
  │   │   │       │   therapistAwarenessChange = ±rawEffect×0.02（情感波动）
  │   │   │       ├── 系统干预：
  │   │   │       │   symptomChange = -rawEffect×0.04
  │   │   │       │   defenseChange = -rawEffect×0.04
  │   │   │       │   allianceChange = +rawEffect×0.03
  │   │   │       └── 沉默在场：
  │   │   │           allianceChange = +rawEffect×0.03（上限 +5）
  │   │   │           insightGain = +rawEffect×0.04（来访者自己的领悟）
  │   │   │           defenseChange = 0（不触动防御）
  │   │   │
  │   │   ├── 3.4 更新会话状态
  │   │   │   ├── sessionState.currentAlliance += allianceChange
  │   │   │   │   └── 钳制 [0, 100]
  │   │   │   ├── sessionState.currentSymptom += symptomChange
  │   │   │   │   └── 钳制 [0, 100]
  │   │   │   ├── sessionState.insightGained += insightGain
  │   │   │   ├── clientSheet.defenseProfile.defenseStrength += defenseChange
  │   │   │   │   └── 钳制 [10, 95]
  │   │   │   └── allianceHistory.push({round, alliance:currentAlliance, change:allianceChange})
  │   │   │
  │   │   ├── 3.5 AI 生成来访者回应
  │   │   │   ├── 根据效果评估结果，生成来访者的言语/情感回应
  │   │   │   ├── 5 种回应模式（由效果值决定）：
  │   │   │   │   ├── allianceChange ≥ +5 → "开放探索"
  │   │   │   │   │   "张某抬起头，眼眶微红。'谢谢你...我第一次觉得有人真的在听。'"
  │   │   │   │   ├── defenseChange ≥ +3 → "阻抗防御"
  │   │   │   │   │   "张某的表情僵住了。'你这样说不对，你不了解我的情况。'"
  │   │   │   │   ├── symptomChange ≤ -5 → "情感宣泄"
  │   │   │   │   │   "张某的肩膀开始颤抖，泪水终于流了下来..."
  │   │   │   │   ├── insightGain ≥ +10 → "认知转化"
  │   │   │   │   │   "张某突然愣住。'我从来没这样想过...原来我一直...'"
  │   │   │   │   └── 其他 → "平稳推进"
  │   │   │   │       "张某点点头，似乎在消化刚才的对话。"
  │   │   │   └── 渲染到来访者话语区
  │   │   │
  │   │   ├── 3.6 检测关键转折点
  │   │   │   ├── 联盟单回合下降 ≥ 15 → "治疗危机"（记录为 criticalMoment）
  │   │   │   ├── 症状单回合下降 ≥ 10 → "治疗突破"（记录为 criticalMoment）
  │   │   │   ├── 首次 insightGain ≥ 20 → "洞察时刻"（记录为 criticalMoment）
  │   │   │   └── 联盟降至 10 以下 → "来访者脱落风险"（记录为 criticalMoment）
  │   │   │
  │   │   └── 3.7 检查终止条件
  │   │       ├── currentSymptom ≤ 5 → 结案判定（跳至步骤 4）
  │   │       ├── currentAlliance ≤ 0 → 来访者脱落（跳至步骤 4）
  │   │       ├── round ≥ 20 → 达到最大回合（跳至步骤 4）
  │   │       └── 其他 → round++，继续循环
  │   │
  │   └── (循环结束)
  │
  └── 4. 会话结算（computeSessionOutcome）
      ├── 症状改善率 = (initialSymptom - currentSymptom) / initialSymptom × 100
      ├── 联盟维持率 = currentAlliance / initialAlliance × 100
      ├── 综合评分 = 症状改善率×0.5 + 联盟维持率×0.3 + insightGained/100×0.2
      ├── 评级：
      │   ├── 综合评分 > 90% → S（卓越的咨询）
      │   ├── 综合评分 > 70% → A（有效的咨询）
      │   ├── 综合评分 > 50% → B（合格的咨询）
      │   ├── 综合评分 > 30% → C（需要改进）
      │   └── 综合评分 ≤ 30% → D（建议寻求督导）
      └── 返回 outcome
```

### 5.4 个案结算与应用

```
applySessionResultToGame(outcome)
  │
  ├── 1. 临床时数获得
  │   └── G.clinicalHours += (outcome.rating === "S" || outcome.rating === "A") ? 2 : 1
  │
  ├── 2. 理论时数获得
  │   └── 若 activeTheoryOrientation 在会话中使用了：
  │       G.theoryMastery[activeTheoryOrientation].hours += 1
  │
  ├── 3. 来访者档案更新
  │   ├── clientSheet.sessionCount += sessionState.round
  │   ├── clientSheet.symptomLevel = sessionState.currentSymptom
  │   ├── clientSheet.therapeuticAlliance = sessionState.currentAlliance
  │   └── clientSheet.treatmentPhase =
  │       ├── sessionState.currentSymptom ≤ 5 → "termination"（结案）
  │       ├── sessionState.round ≥ 15 → "middle"（中间阶段）
  │       └── 其他 → "initial"（初始阶段）
  │
  ├── 4. 反移情检查
  │   ├── 从来访者 caseType 与咨询师的特质/personalTherapyHours 计算相似度
  │   ├── 相似度 > 阈值 → CountertransferenceTracker.accumulate()
  │   │   └── 类型判定：
  │   │       ├── 来访者创伤经历与咨询师高度相似 → overIdentification +3
  │   │       ├── 咨询师在会话中频繁使用诠释 → professionalArrogance 风险 +1
  │   │       └── 连续 3 次 C/D 评级咨询 → burnoutNumbness +2
  │   └── 写入 G.countertransference
  │
  ├── 5. 督导记录生成
  │   ├── 若评级 ≤ C → 强制督导提示（下次叙事 AI 中将引入督导场景）
  │   └── 若存在 criticalMoments → 记录为重点督导材料
  │
  ├── 6. 清理会话状态
  │   ├── 写入 G.caseSessionHistory.push({ clientId, outcome, timestamp })
  │   ├── G.activeCaseSession = null
  │   ├── G.pendingCaseSession = null
  │   └── 派发 psy:session-finished 事件
  │
  └── 7. 触发后个案自动叙事
      ├── PSY_AUTO_STORY_AFTER_SESSION === true?
      │   └── YES → 自动调用 handleChatSend(postSessionPrompt)
      │       其中 postSessionPrompt =
      │       "以上为程序给出的本节咨询会话结算与来访者状态。
      │        请据此直接写下衔接叙事：
      │        咨询师在咨询后的内心活动、
      │        来访者离开后的氛围、
      │        下次咨询的安排（若有）；
      │        文末照常输出个案标签、理论洞见与四级行动建议。
      │        若来访者已结案，请书写咨询师的结案反思。"
      └── NO → 正常等待玩家输入
```

---

## 6. 职业生涯与等级晋升逻辑流程

### 6.1 临床时数积累

```
临床时数获取途径（由状态 AI 通过 <psy_clinical_gain> 标签写入）：
  │
  ├── 1. 直接接案（个案会话结算后）
  │   └── +1/+2 临床时数
  │
  ├── 2. 接受督导（叙事中提到参加督导）
  │   └── +0.5 督导时数（同时 clinicalHours 不变）
  │
  ├── 3. 理论学习（叙事中提到阅读/培训/工作坊）
  │   └── +2~5 特定理论时数（theoryMastery[theoryName].hours）
  │
  ├── 4. 个人体验（叙事中提到作为来访者接受治疗）
  │   └── +1 个人体验时数
  │
  ├── 5. 案例讨论（叙事中提到同行交流/学术会议）
  │   └── +0.5 督导时数 + 微小洞察增益
  │
  ├── 6. 论文写作（叙事中提到学术写作）
  │   └── +10~20 特定理论时数 + 研究积分
  │
  └── 7. 教学带教（叙事中提到指导新手）
      └── 沟通力微增 + 论断力微增（无时数累加）
```

### 6.2 小阶段晋升（Minor Level Up）

```
applyMinorLevelUp(G)
  │
  ├── 触发条件：G.clinicalHours ≥ 当前阶段所需时数门槛
  │   └── 门槛表（来自 DoctorLevelState.DOCTOR_LEVEL_TABLE[levelIndex].clinicalHoursRequired）
  │
  ├── 晋升流程：
  │   ├── 1. 检查 levelIndex 是否已达最大（20 = 心灵哲学家·贯通）
  │   │   └── 已是最大 → 跳过
  │   ├── 2. levelIndex++
  │   ├── 3. G.doctorLevel = 查表 DOCTOR_LEVEL_TABLE[levelIndex].label
  │   ├── 4. 弹出晋升提示（非模态，顶部 toast）
  │   │   └── "🎉 恭喜！你已晋升为【初级心理咨询师·初窥】"
  │   ├── 5. 重新计算 8+2 属性
  │   │   └── PsychologistBaseRuntime.computePsychologistBase(G, fc)
  │   ├── 6. 若跨越的是大阶段边界（minor 从贯通→初窥且 major 变化）
  │   │   └── 触发工作场景切换（见 §6.4）
  │   └── 7. 持久化
  │
  └── 无失败概率（小阶段晋升是累积式的，自动通过）
```

### 6.3 大阶段晋升：资格考试/答辩（Major Level Up）

```
applyMajorLevelUp(G)
  │
  ├── 触发条件（全部满足）：
  │   ├── 当前等级已是某个大阶段的"贯通"阶段（levelIndex = 2, 5, 8, 11, 14, 17）
  │   │   └── 即：已在本大阶段的最高小阶段，准备跨入下一个大阶段
  │   ├── G.clinicalHours ≥ 下一大阶段的时数门槛
  │   ├── G.supervisionHours ≥ 下一大阶段的督导时数门槛
  │   ├── G.theoryMastery[任一理论].stage ≥ 要求（根据目标大阶段）
  │   │   ├── 实习→初级：至少 1 个理论 ≥ stage 3（练习）
  │   │   ├── 初级→资深：至少 1 个理论 ≥ stage 4（掌握）+ 个人体验 ≥ 50h
  │   │   ├── 资深→专家：至少 2 个理论 ≥ stage 4 + 个人体验 ≥ 100h
  │   │   ├── 专家→大师：至少 3 个理论 ≥ stage 4 + 有至少 1 次整合
  │   │   └── 大师→心灵哲学家：至少 5 个理论 ≥ stage 4 + philosophy ≥ 500
  │   └── G.personalTherapyHours ≥ 要求（从初级→资深开始需要）
  │
  ├── 晋升流程（非概率，挑战式）：
  │   │
  │   ├── 1. 弹出「资格考验」模态
  │   │   ├── 场景描述（根据晋升阶段不同）：
  │   │   │   ├── 心理学徒（贯通）→ 实习咨询师（初窥）："执业资格考试报名通知寄到了你的邮箱..."
  │   │   │   ├── 实习咨询师（贯通）→ 初级咨询师（初窥）："督导建议你申请独立执业资格..."
  │   │   │   ├── 初级咨询师（贯通）→ 资深咨询师（初窥）："行业协会邀请你提交专家认证材料..."
  │   │   │   ├── 资深咨询师（贯通）→ 治疗专家（初窥）："你开始整理自己多年的临床心得..."
  │   │   │   ├── 治疗专家（贯通）→ 心理学大师（初窥）："一个终极问题浮现在你心中..."
  │   │   │   └── 心理学大师（贯通）→ 心灵哲学家（初窥）："你站在了人类心灵理解的顶峰..."
  │   │   └── 展示要求（时数/理论/督导/个人体验，全部以 ✓/✗ 显示）
  │   │
  │   ├── 2. 玩家确认参加 → 触发叙事 AI（资格考试叙事）
  │   │   ├── system prompt 注入考试/答辩场景规则
  │   │   ├── AI 生成考官/评审团的提问
  │   │   └── 玩家作答（在聊天框中回复）
  │   │
  │   ├── 3. 反复 N 轮（2-4 轮）问答后，AI/引擎评估结果
  │   │   ├── 硬性条件全部满足 → 通过基础门槛
  │   │   └── 叙事表现评估（由状态 AI 的专门评定）：
  │   │       ├── 考官/评审反馈为正面 → 高质量通过
  │   │       ├── 反馈有保留 → 通过但有建议
  │   │       └── 反馈为负面 → 建议补充后再试
  │   │
  │   ├── 4. 结果处理：
  │   │   ├── 通过 → 晋升
  │   │   │   ├── 跨越一个大阶段：levelIndex 从 2→3 或 5→6 或 8→9 等
  │   │   │   │   └── 例如：levelIndex 2（心理学徒·贯通）→ levelIndex 3（实习咨询师·初窥）
  │   │   │   ├── G.doctorLevel 更新为下一大阶段的"初窥"级别
  │   │   │   ├── 工作场景切换（见 §6.4）
  │   │   │   ├── 弹出庆祝叙事（AI 生成晋升后的生活变化）
  │   │   │   └── 持久化
  │   │   └── 未通过 → 保留
  │   │       ├── 时数保留（无回落惩罚）
  │   │       ├── 获得「经验洞察」bonus：下次重试时增加 insight +3
  │   │       ├── 弹出鼓励提示："成长需要时间，你已经在这条路上走得很远了"
  │   │       └── 可随时重新挑战（冷却时间：30 次正常回合后）
  │   │
  │   └── 5. 与修仙突破的关键差异：
  │       ├── 无随机概率 → 挑战式评定
  │       ├── 无属性回落 → 鼓励尝试
  │       ├── 多维度要求 → 反映真实的心理学培训体系
  │       └── 失败有补偿 → "经验洞察"机制
  │
  └── 注意：小阶段晋升（如"初窥→践行→贯通"）是自动的、无门槛的累积极制；
       大阶段晋升（如"贯通→下一大阶段初窥"）是挑战式的、需通过资格考验的。
       两者是不同层级的概念，不可混淆。
```

### 6.4 工作场景演化

```
工作场景切换流程：
  │
  ├── 触发条件：大阶段晋升成功
  │
  ├── 新的 currentWorkplace 根据新等级自动设定：
  │   ├── 心理学徒 → "大学校园/图书馆"
  │   ├── 实习咨询师 → "大学心理咨询中心"
  │   ├── 初级咨询师 → "心理咨询机构"
  │   ├── 资深咨询师 → "私人执业诊所"
  │   ├── 治疗专家 → "多学科合作团队"
  │   ├── 心理学大师 → "研究所/培训中心"
  │   └── 心灵哲学家 → "无固定场所"（叙事场景自由切换）
  │
  └── 触发叙事 AI：
      └── 生成新场景的引入剧情（搬家/换工作/新办公室）
```

---

## 7. 理论学习与整合逻辑流程

### 7.1 理论学习阶段状态机

```
理论学习阶段判定（在状态 AI 写入 theoryProgress 后触发）：
  │
  ├── 对 theoryMastery 中的每个理论：
  │   │
  │   ├── 读取当前 stage 和 hours
  │   │
  │   ├── 阶段阈值表（来自 theory_state.js）：
  │   │   ├── Stage 0→1（未接触→通读）：需 ≥ 10h
  │   │   ├── Stage 1→2（通读→理解）：需 ≥ 40h（累计）
  │   │   ├── Stage 2→3（理解→练习）：需 ≥ 100h（累计）
  │   │   ├── Stage 3→4（练习→掌握）：需 ≥ 220h（累计）
  │   │   ├── Stage 4→5（掌握→整合）：需 ≥ 460h（累计）+ 至少 1 个理论整合条件满足
  │   │   └── Stage 5→6（整合→创新）：需 ≥ 960h（累计）+ 发表了相关论文/著作
  │   │
  │   ├── hours ≥ 下一阶段阈值?
  │   │   ├── YES → 弹出晋升提示
  │   │   │   └── "🎓 你对【认知治疗】的理解已达「掌握」阶段"
  │   │   └── NO → 继续累积
  │   │
  │   └── 阶段提升时更新 theoryMastery[theoryName].stage
  │
  └── 检查整合条件（见 §7.2）
```

### 7.2 理论整合触发逻辑

```
理论整合判定：
  │
  ├── 遍历 THEORY_INTEGRATION_TABLE（8 条预设路线）：
  │   │
  │   ├── 对每条路线 { theoryA, theoryB, result, requirements }：
  │   │   ├── G.theoryMastery[theoryA].stage ≥ 4?
  │   │   ├── G.theoryMastery[theoryB].stage ≥ 4?
  │   │   └── requirements 中指定的哲学深度 ≥ 要求?
  │   │       └── 如"正念认知治疗(MBCT)"需要 认知治疗≥4 + 正念减压≥4
  │   │
  │   └── 三个条件都满足 → 解锁该整合选项
  │       └── 状态 AI 在下回合输出 <psy_theory_milestone>
  │           → integrationUnlocked: "MBCT"
  │
  ├── 玩家在面板中选择执行整合：
  │   ├── 弹出确认："将【认知治疗】与【正念减压】整合为【正念认知治疗(MBCT)】"
  │   │   └── 提示："整合后两个原理论的学习进度将合并，新取向从 stage 1 开始"
  │   ├── 玩家确认 →
  │   │   ├── 创建新条目 G.theoryMastery["正念认知治疗(MBCT)"] = { stage: 1, hours: 0,
  │   │   │                                           integratedFrom: [theoryA, theoryB],
  │   │   │                                           learningSpeed: 1.5 }
  │   │   ├── 原两个理论保留（stage 不变，不再作为主要取向）
  │   │   ├── 可选择将新整合取向设为主要取向
  │   │   └── 触发叙事 AI："你开始尝试将认知治疗与正念减压整合..."
  │   └── 玩家取消 → 保留解锁状态，可稍后执行
  │
  └── 约束：
      ├── 每个理论最多参与一次整合（作为 theoryA 或 theoryB）
      └── 整合后不可再次与其他理论整合
```

---

## 8. 反移情系统逻辑流程

### 8.1 反移情累积

```
CountertransferenceTracker.accumulate(G, triggerSource, caseType)
  │
  ├── 1. 计算触发强度
  │   ├── 来访者 caseType 与咨询师个人特质/经历的相似度评分
  │   │   └── 如：咨询师有"创伤转化"动机 + 来访者是"创伤型" → 高相似度
  │   └── 相似度评分 [0, 10]
  │
  ├── 2. 确定反移情类型
  │   ├── 相似度 ≥ 7 → overIdentification（过度认同）可能性 60%
  │   ├── 咨询师自觉性 < 30 → professionalArrogance（专业傲慢）可能性 30%
  │   ├── 连续 5 次咨询评级 ≤ C → burnoutNumbness（倦怠麻木）可能性 50%
  │   ├── 来访者是"人格障碍型" → defensiveDistancing 可能性 40%
  │   └── 存在 activeEthicalDilemma → ethicalBlurring 可能性 50%
  │
  ├── 3. 计算累积量
  │   ├── base = 相似度评分 × 0.5
  │   ├── 自觉性抗性 = 1 - G.psychologistBase.awareness / 200
  │   │   └── 高自觉性 → 低累积（更能察觉反移情）
  │   ├── 个人体验抗性 = 1 - G.personalTherapyHours / 500
  │   │   └── 个人体验越多 → 越能管理反移情
  │   └── change = base × 自觉性抗性 × 个人体验抗性（限制 [0.5, 8]）
  │
  └── 4. 写入（由状态 AI 执行）
      └── 状态 AI 输出 <psy_countertransference> → applyStateTurn 写入 G
```

### 8.2 反移情化解

```
反移情化解途径：
  │
  ├── 1. 接受督导（叙事中主动请教督导师）
  │   ├── 消耗 0.5 督导时数
  │   ├── 指定类型的反移情 -3~5 点
  │   └── overallRiskLevel 重新计算
  │
  ├── 2. 个人体验（叙事中接受自己的治疗）
  │   ├── 消耗 1 个人体验时数
  │   ├── 指定类型的反移情 -5~8 点
  │   └── 自觉性 +2（对自身议题有了更深理解）
  │
  ├── 3. 休假/自我关照（叙事中主动休息）
  │   ├── 所有类型各 -1~2 点
  │   ├── 疲劳度 -20
  │   └── 倦怠等级 -1（若 >0）
  │
  └── 4. 时间推移（每次正常回合微降）
      └── 若当前回合未触发新的反移情 → 各类型 -0.1
```

### 8.3 反移情风险对属性的影响

```
反移情惩罚（在 computePsychologistBase 的 Step 3 中计算）：
  │
  ├── riskLevel === "low"：
  │   └── 无惩罚
  │
  ├── riskLevel === "medium"：
  │   ├── 自觉性 ×0.90
  │   └── 共情力 ×0.95
  │
  ├── riskLevel === "high"：
  │   ├── 自觉性 ×0.75
  │   ├── 论断力 ×0.85
  │   ├── 共情力 ×0.90
  │   └── 弹出建议：「你的反移情正在影响工作，建议接受督导或个人体验」
  │
  └── riskLevel === "critical"：
      ├── 全属性 ×0.70
      ├── 强制暂停接案（无法触发个案会话）
      ├── 弹出警告：「职业危机！你必须立即暂停接案并寻求个人体验」
      └── 唯一行动选择：接受个人体验 / 寻求督导 / 长期休假
```

---

## 9. 伦理困境系统逻辑流程

### 9.1 困境触发与展示

```
伦理困境生命周期：
  │
  ├── 1. 触发
  │   ├── 叙事 AI 在叙事正文中输出 <psy_ethical_dilemma> 标签
  │   └── 状态 AI 在状态同步中输出 <psy_ethical_dilemma> 标签
  │
  ├── 2. 解析困境 payload：
  │   {
  │     dilemmaType: "dualRelationship",   // 5 种类型之一
  │     sceneId: "dual_001",
  │     scene: "来访者张某恰好是你孩子学校的班主任...",
  │     options: [
  │       {
  │         label: "转介给同事",
  │         effects: { reputation: 2, judgment: 5, clientWelfare: 0 },
  │         description: "遵守伦理规范，但来访者可能感到被抛弃"
  │       },
  │       { ... },  // 2-3 个更多选项
  │     ],
  │     context: "你每周给张某做咨询已 3 个月，治疗联盟良好..."
  │   }
  │
  ├── 3. 写入 G.activeEthicalDilemma = payload
  │
  ├── 4. 弹出全屏模态（中断所有其他操作）
  │   ├── 标题：「⚠️ 伦理困境」
  │   ├── 困境类型图标 + 名称
  │   ├── 场景描述（大字体，叙述性文字）
  │   ├── 上下文背景
  │   ├── 选项列表（3-4 个按钮，竖向排列）
  │   │   └── 每个选项显示：选择文本 + 预估影响
  │   │       ├── 🟢 正面影响（绿色标签）
  │   │       └── 🔴 负面影响（红色标签）
  │   └── 无时间限制（不显示倒计时）
  │
  └── 5. 等待玩家决策（阻塞所有其他 UI 交互）
```

### 9.2 困境决策与评估

```
resolveEthicalDilemma(G, choiceIndex)
  │
  ├── 1. 读取玩家选择的选项
  │   └── chosen = G.activeEthicalDilemma.options[choiceIndex]
  │
  ├── 2. 应用 effects：
  │   ├── G.reputation += chosen.effects.reputation || 0
  │   │   └── 钳制 [0, 1000]
  │   ├── G.psychologistBase.judgment += chosen.effects.judgment || 0
  │   │   └── 钳制 [1, 999]
  │   ├── G.psychologistBase.awareness += chosen.effects.awareness || 0
  │   ├── G.psychologistBase.resilience += chosen.effects.resilience || 0
  │   └── clientWelfare = chosen.effects.clientWelfare || 0
  │       └── 应用到当前来访者的 symptomLevel（正=改善，负=恶化）
  │
  ├── 3. 反移情联动：
  │   ├── 若选择涉及边界问题 → ethicalBlurring 可能 +2
  │   ├── 若选择涉及价值冲突 → defensiveDistancing 可能 +1
  │   └── 若选择被评估为「困难但正确」 → 自觉性额外 +2
  │
  ├── 4. 记录决策历史：
  │   └── G.careerHistory.push({
  │         type: "ethical_decision",
  │         dilemmaType, sceneId, choiceIndex,
  │         timestamp: G.worldTimeString,
  │         effects: chosen.effects
  │       })
  │
  ├── 5. 清理：
  │   ├── G.activeEthicalDilemma = null
  │   └── 关闭模态
  │
  ├── 6. 触发叙事 AI（简要衔接）：
  │   └── 基于玩家的选择，AI 生成后续叙事（1-2 段）
  │       "你决定转介张某给同事王咨询师。在最后一次咨询中，
  │        你向张某解释了原因..."
  │
  └── 7. 长期影响：
      ├── 大师→心灵哲学家突破时，检查 ethical_decision 记录
      │   └── 决策记录反映职业伦理成熟度
      └── 未来可能触发相同类型的困境（基于之前的决策模式）
```
- Tier 3 伦理性失误（边界侵犯/保密违规等）触发伦理调查时，联动声誉系统（§12）和执照系统（§13）

---

## 10. 治疗失误检测与追踪流程

```
每个个案回合完成后:
  │
  ├── Tier 1 即时检测:
  │   ├── 查 INTERVENTION_DEFENSE_MATRIX(当前防御, 所选技术)
  │   │   └── risky / dangerous → 记录 Tier 1 技术性失误
  │   ├── alliance < 30 且选了高冲击技术 → 记录 Tier 1
  │   ├── 连续 3 次同技术 → 记录 Tier 1（策略单一）
  │   └── criticalMoments 中有 "treatment_crisis" 且选激进技术 → 记录 Tier 1
  │
  ├── Tier 2 跨回合检测:
  │   ├── 连续 5 回合 defenseStrength 上升 → 报告"忽视阻抗信号"
  │   ├── 超过 10 回合 symptomImprove < 5% → 报告"疗程停滞"
  │   ├── alliance < 20 且连续 3 回合下降，未讨论治疗关系 → 报告
  │   └── 超过 10 回合从未选 silentPresence → 报告"过度主导"
  │
  ├── Tier 3 叙事检测:
  │   └── 解析 AI 输出中的 <psy_treatment_error> 标签
  │       └── { type, severity, description, clientId, round }
  │
  ├── recordError(G, error):
  │   ├── 写入 currentSessionErrors[]
  │   ├── 更新 errorHistory[]
  │   ├── 更新 activeWarnings[]
  │   ├── consecutiveErrors++（连续≥3 → 触发督导警告）
  │   └── 更新 errorStats.total{Technical|Strategic|Ethical}Errors
  │
  └── computeRiskScore(G):
      └── RiskScore = CT_RISK×0.25 + ERROR_RISK×0.30 + DROPOUT_RISK×0.20
                    + FATIGUE_RISK×0.15 + REPUTATION_RISK×0.10
          └── 🟢 0-25 / 🟡 26-50 / 🟠 51-75 / 🔴 76-100
```

---

## 11. 来访者脱落预警与执行流程

```
每个个案回合 + 状态 AI 后:

1. computeDropoutRisk(client, sessionState, errors):
     baseDropout = DROPOUT_BASE_TABLE[attachmentStyle] + caseDifficultyModifier
     errorPenalty = SUM(recentErrors.severity × coefficient)
     allianceBuffer = alliance >= 70 ? -20% : alliance < 30 ? +15% : 0%
     dropoutRisk = baseDropout + errorPenalty - allianceBuffer
     └── 钳制 [5, 99]

2. checkDropoutThresholds(G, client):
     risk < 30% → 🟢 green — 正常
     risk 30-60% → 🟡 yellow — 来访者卡片显示黄点
     risk 60-80% → 🟠 orange — 卡片闪烁 + "建议讨论治疗关系"
     risk > 80% → 🔴 red — 全屏弹窗"来访者即将脱落！"

3. 红灯后的分支:
     玩家选共情回应 + allianceChange > +5 → attemptDropoutRecovery()
       ├── 成功: 风险降至 50%, 获得 judgment +2
       └── 失败: 风险 +15%, 加速脱落
     玩家选其他 / allianceChange不足 → 脱落确认

4. executeDropout(clientId):
     ├── 从 currentClients 移除 → completedCases（标记 terminatedByDropout: true）
     ├── 声誉 -5~15（根据外传抱怨概率）
     ├── 反移情累积触发一次
     ├── 临床时数: 当次无获得
     ├── errorStats.clientDropouts++
     └── 触发叙事 AI（世界 AI）：强制下一轮聚焦脱落事件
```

---

## 12. 声誉事件与投诉处理流程

```
声誉事件来源（任意满足其一即触发）:

1. applyReputationEvent(G, eventType, params):
     ├── 查 REPUTATION_EVENT_TABLE → 三维增减值
     ├── 应用钳制 [0, max]
     ├── 记录到 careerHistory (type: "reputation_event")
     ├── 检查声誉等级跨越:
     │   crisis(<200): 转介几乎停止, 职业机会关闭
     │   recovering(200-400): 转介正常, 机会偶尔
     │   good(400-700): 转介良好, 机会定期
     │   excellent(700-900): 可选择来访者, 机会频繁
     │   legendary(900+): 自主定义, 传奇来访者
     └── 调用 computeReferralQuality(G) 更新转介质量

2. 投诉触发:
     ├── checkComplaintRisk(G, client, error):
     │   伦理失误 + 来访者受损 → 60%
     │   脱落 + alliance<20 → 25%
     │   脱落 + alliance<40 → 10%
     │   连续3+ Tier 2失误 → 15%
     │
     ├── processComplaint(G, complaint):
     │   ├── 创建 complaint 记录 → complaintHistory[]
     │   ├── 声誉立即下降（专业声誉 -20~50）
     │   └── 累计3+投诉 → 触发伦理委员会调查
     │
     └── processEthicsReview(G, complaints):
         ├── 多回合审查流程（类似大阶段考试）
         ├── 玩家回应: 诚实面对 / 推卸责任 / 部分承认
         └── 结果: 无过失(声誉恢复, judgment+3)
                / 轻微过失(声誉-20, 需督导)
                / 中度过失(声誉-50, 暂停接案20回合)
                / 严重过失(声誉-100, 执照暂停或吊销)
```

---

## 13. 执照危机状态转换流程

```
执照状态机:
  │
  ├── checkLicenseStatus(G):
  │   ├── 检查 complaintHistory 数量
  │   ├── 检查 Tier 3 伦理失误记录
  │   ├── 检查 countertransference.overallRiskLevel
  │   └── 判断是否需要状态转换 → 返回 { statusChanged, newStatus, reason }
  │
  ├── 状态转换条件:
  │   ACTIVE → UNDER_REVIEW: 累计3+投诉 / 单次严重伦理失误
  │   UNDER_REVIEW → ACTIVE: 调查结果"无过失"
  │   UNDER_REVIEW → SUSPENDED: 调查结果"中度过失"
  │   UNDER_REVIEW → REVOKED: 严重伦理违规 / 调查结果"严重过失"
  │   SUSPENDED → RESTRICTED: 暂停期满 + 条件满足（督导+个人体验）
  │   RESTRICTED → ACTIVE: 评估通过 + 声誉≥200
  │   REVOKED → 重建人生: 特殊分支，不可逆回 ACTIVE
  │
  ├── 各状态限制:
  │   UNDER_REVIEW: currentClients max=现有, 不可新增
  │   SUSPENDED: currentClients=[], 只能督导+个人体验+理论学习
  │   RESTRICTED: currentClients max=3, 案例难度限制为低
  │   REVOKED: 解锁替代职业路径（研究者/教师/作者）
  │
  └── transitionLicenseStatus(G, newStatus):
      ├── 更新 G.licenseStatus
      ├── 应用新状态限制
      ├── 记录到 careerHistory
      └── 触发对应的叙事线（世界 AI 在下一轮生成危机叙事）
```

---

## 14. NPC 系统逻辑流程

### 10.1 来访者 NPC

```
来访者完整生命周期：
  │
  ├── 创建（首次接案）
  │   ├── 来源：叙事 AI / 状态 AI 引入新来访者
  │   ├── 创建来访者档案（ClientCharacterSheet）
  │   ├── 推入 G.currentClients[]
  │   └── 初始状态：
  │       ├── symptomLevel: 根据 caseType 查 ClientTemplates
  │       ├── therapeuticAlliance: 50（基准值）
  │       ├── treatmentPhase: "initial"
  │       └── sessionCount: 0
  │
  ├── 持续治疗
  │   ├── 每次个案会话更新来访者状态
  │   ├── 状态 AI 在非个案回合中也可微调来访者状态
  │   │   └── "张某本周的情绪比上周好了一些" → symptomLevel -3
  │   └── 来访者可能主动脱落（alliance 降至 0）
  │
  ├── 结案
  │   ├── 条件：symptomLevel ≤ 5 且 treatmentPhase === "termination"
  │   ├── 生成结案摘要
  │   ├── 移入 completedCases[]
  │   │   └── { clientId, sessionsCount, initialSymptom, finalSymptom, outcomeRating }
  │   ├── 从 currentClients[] 移除
  │   └── 影响职业声誉（正面结案 +reputation）
  │
  └── 追踪回访（结案后）
      └── 结案 20 回合后，状态 AI 可能引入追踪回访叙事
          └── "张某发来消息，说想预约一次追踪咨询..."
```

### 10.2 督导师/同行 NPC

```
周围人物管理：
  │
  ├── 合并策略（applyNearbyPeopleToGame）：
  │   ├── 新出现的人物 → 完整规范化（ClientCharacterSheet）
  │   │   └── 含角色类型（supervisor/colleague/mentor/peer）、
  │   │      理论取向、关系阶段
  │   ├── 已存在的人物 → 仅更新可变的字段
  │   │   └── 当前状态、最近互动描述、关系阶段
  │   └── 过期人物 → 标记但保留在列表中
  │       └── status: "inactive"，显示为灰色
  │
  └── 督导师特殊逻辑：
      ├── 督导师的理论取向影响督导反馈的风格
      │   ├── 严格精神分析师 → 注重框架、中立、深度诠释
      │   ├── 温暖 CBT 取向者 → 注重结构、目标、技能训练
      │   └── 人本主义倾听者 → 注重共情、无条件接纳、在场
      └── 可更换督导师（叙事中寻找新的督导师）
```

---

## 15. 存档系统逻辑流程

### 11.1 自动保存

```
autoSave()
  │
  ├── 触发：每 4000ms 定时器 + beforeunload 事件
  │
  ├── 保存内容：
  │   ├── 序列化 PsyDoctorGame → JSON.stringify(G)
  │   ├── 写入 sessionStorage: psydoctor_bootstrap_v1
  │   ├── 写入 localStorage: psydoctor_last_session_v1（镜像）
  │   └── 若存在活跃存档 ID → 写入 localStorage: PSY_SAVE_V1:{activeSaveId}
  │
  └── 保存时跳过：
      ├── PSY_AI_GENERATING === true（AI 生成中，避免写入不完整状态）
      └── activeCaseSession !== null（个案会话中，由会话结算统一保存）
```

### 11.2 手动存档

```
PsyMainScreenPanel.saveGame(saveId)
  │
  ├── 1. 若未提供 saveId → 基于时间戳生成新的
  │   └── "PSY_save_" + Date.now().toString(36)
  │
  ├── 2. 构建存档摘要（用于存档列表展示）
  │   └── { playerName, doctorLevel, clinicalHours, worldTimeString, timestamp }
  │
  ├── 3. 写入 localStorage: PSY_SAVE_V1:{saveId}
  │
  ├── 4. 更新存档索引
  │   ├── 读取 PSY_SAVES_INDEX_V1
  │   ├── 若 saveId 不在列表中 → push
  │   └── 写回
  │
  └── 5. 设置 PSY_ACTIVE_SAVE_ID_V1 = saveId
```

### 11.3 读档（loadGame）

```
PsyMainScreenPanel.loadGame(saveId)
  │
  ├── 1. 读取 localStorage: PSY_SAVE_V1:{saveId} → JSON.parse
  │
  ├── 2. 校验存档结构完整性
  │   ├── 检查必需字段：fateChoice, doctorLevel, clinicalHours, chatHistory
  │   ├── 检查字段类型（数字/字符串/数组/对象）
  │   └── 不完整 → 报错，中止加载
  │
  ├── 3. 恢复状态
  │   ├── window.PsyDoctorGame = 存档 JSON（深拷贝）
  │   ├── ensureGameRuntimeDefaults(G) → 补全新版可能新增的字段
  │   ├── computePsychologistBase(G, G.fateChoice) → 重算属性
  │   ├── applyCountertransferenceCheck(G) → 检查反移情
  │   └── 设置 PSY_ACTIVE_SAVE_ID_V1 = saveId
  │
  ├── 4. 写入 sessionStorage: psydoctor_bootstrap_v1
  │
  └── 5. 刷新所有面板 + 渲染聊天历史
      └── 若 G.chatHistory 为空（不应发生但兜底）→ 触发门闩
```

---

## 16. 属性计算完整管线

### 12.1 computePsychologistBase 6 步详解

```
PsychologistBaseRuntime.computePsychologistBase(G, fc)
  │
  ├── Step 1: 等级基础值读取
  │   └── DOCTOR_LEVEL_TABLE[G.levelIndex]
  │       → { empathy: N, insight: N, knowledge: N, technique: N,
  │           judgment: N, awareness: N, communication: N, resilience: N,
  │           humanity: N, philosophy: N }
  │
  ├── Step 2: 平面加成合并
  │   ├── stats = 等级基础值（深拷贝）
  │   ├── stats += EDUCATION_BONUS_MAP[fc.education]
  │   │   └── 例：心理学本科 → { knowledge:+3, technique:+1 }
  │   ├── stats += MOTIVATION_BONUS_MAP[fc.motivation]
  │   │   └── 例：助人理想 → { empathy:+5, awareness:+3 }
  │   ├── stats += 个人特质 bonus（遍历 fc.traits，累加每个 bonus）
  │   │   └── 例：共情天赋 → { empathy:+3 }，语言精准 → { communication:+2 }
  │   ├── stats += 理论学习深度 bonus
  │   │   ├── 遍历 G.theoryMastery（所有 stage ≥ 1 的理论）
  │   │   │   ├── 对每个理论：theoryBonus = TheoryState[theoryName].attributeContributions
  │   │   │   ├── 阶段系数 = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.5][stage]
  │   │   │   └── stats += theoryBonus × 阶段系数
  │   │   │       × (该理论 === activeTheoryOrientation ? 1.0 : 0.5)
  │   │   └── 上限：理论 bonus 总和不超过 200
  │   └── stats += 哲学思辨 bonus
  │       └── 遍历 G.philosophyDepth
  │           ├── 对每个维度：depthBonus = PhilosophyState[dimension].attributeContributions
  │           ├── philosophyBonus = depthBonus × depth × G.levelIndex × 0.01
  │           └── stats += philosophyBonus
  │
  ├── Step 3: 反移情惩罚
  │   ├── overallRiskLevel = CountertransferenceTracker.computeRisk(G)
  │   ├── 根据 riskLevel 应用百分比惩罚（与架构文档 §8.1 一致）：
  │   │   ├── "low" → 无惩罚
  │   │   ├── "medium" → awareness ×0.90, empathy ×0.95
  │   │   ├── "high" → awareness ×0.75, judgment ×0.85, empathy ×0.90
  │   │   └── "critical" → 全属性 ×0.70
  │   └── stats = stats × penalties
  │
  ├── Step 4: 哲学维度乘法加成
  │   ├── 等级倍率 ratio = [0.02, 0.02, 0.02, 0.05, 0.05, 0.05, 0.08, ... 0.50]
  │   │   └── 学徒:0.02 → 心灵哲学家:0.50（与架构文档 §8.5 一致）
  │   ├── 现象学: insight × (1 + depth×ratio), awareness × (1 + depth×ratio)
  │   ├── 诠释学: knowledge × (1 + depth×ratio), judgment × (1 + depth×ratio)
  │   ├── 存在哲学: humanity × (1 + depth×ratio), resilience × (1 + depth×ratio)
  │   ├── 东方心学: awareness × (1 + depth×ratio), philosophy × (1 + depth×ratio)
  │   └── 后现代批判: insight × (1 + depth×ratio), judgment × (1 + depth×ratio)
  │
  ├── Step 5: 倦怠惩罚
  │   ├── currentFatigue 检查：
  │   │   ├── [0,30] → 无影响
  │   │   ├── [31,60] → empathy ×0.95, communication ×0.95
  │   │   ├── [61,85] → empathy ×0.85, insight ×0.90, resilience ×0.90
  │   │   └── [86,100] → 全属性 ×0.80，触发「需要休息」警告
  │   └── burnoutLevel 惩罚：每级全属性 ×0.98（最高 ×0.80）
  │
  └── Step 6: 收尾
      ├── 所有 8+2 属性 Math.round() 取整
      ├── humanity → 钳制 [0, 100]
      ├── philosophy → 钳制 [0, 100]
      ├── 其余 8 维 → 钳制 [1, 999]
      └── 写入 G.psychologistBase
```

---

## 17. 知识基底注入流程

```
PsyDoctorWorldBook.selectEntries(scanText, options)
  │
  ├── 1. 构建扫描文本
  │   └── scanText = 用户输入 + 最近 3 轮对话 + 状态摘要 + 来访者档案摘要
  │
  ├── 2. 分离 constant 条目
  │   └── entries.filter(e => e.constant === true)
  │       └── 永远入选的条目：
  │           ├── "心理治疗基本框架"（保密/知情同意/治疗框架）
  │           └── "伦理规范摘要"（APA/中国心理学会核心条款）
  │
  ├── 3. 对非常量条目计算命中分
  │   └── for each entry in entries (non-constant):
  │       ├── hits = 0
  │       ├── for each key in entry.keys:
  │       │   └── if scanText.toLowerCase().includes(key.toLowerCase()):
  │       │       └── hits++
  │       └── 若 hits > 0 → 纳入候选
  │
  ├── 4. 排序
  │   ├── 主排序：priority 降序（数字越大越靠前）
  │   ├── 次排序：hits 降序（命中关键词越多越靠前）
  │   └── 末排序：id 字典序（确定性）
  │
  ├── 5. 合并
  │   └── result = [...constantEntries, ...triggeredEntries]
  │       └── 去重（按 id）
  │
  └── 6. 截断
      └── result.slice(0, options.maxEntries || 8)
```

**注入时机**：每次调用 `story_generate.js` 的 `buildMessages()` 时，在 system prompt 尾部追加 formatForSystem(result)。

---

## 18. API 桥接调用流程

```
PsyDoctorStoryGenerate.sendTurn(userText, G, fc)
  │
  ├── 1. 构建消息
  │   └── buildMessages(fc, G, userText, priorStoryRaw) → messages[]
  │
  ├── 2. 创建 AbortController
  │   └── 用于用户点击「停止生成」时取消请求
  │
  ├── 3. 调用 bridge
  │   └── TavernHelper.generateFromMessages({
  │         messages,
  │         onChunk: function(chunk) {
  │           // 流式回调：追加到聊天区
  │           appendToChatArea(chunk);
  │           scrollToBottom();
  │         },
  │         signal: abortController.signal,
  │       })
  │
  ├── 4. bridge.js 内部：
  │   ├── 读取 API 配置（三级优先级）：
  │   │   ├── localStorage IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1
  │   │   ├── FIXED_PRESET
  │   │   └── DEFAULT_CFG.defaultPresetTemplate
  │   ├── 构建 fetch 请求：
  │   │   ├── URL: apiConfig.serverUrl + "/v1/chat/completions"
  │   │   ├── Headers: { Authorization, Content-Type }
  │   │   ├── Body: { model, messages, stream, temperature, ... }
  │   │   └── signal: abortController.signal
  │   ├── 流式模式（stream: true）：
  │   │   ├── 读取 ReadableStream
  │   │   ├── 解析 SSE (Server-Sent Events)
  │   │   │   └── 每行 "data: {...}" → JSON.parse → delta.content
  │   │   ├── 调用 onChunk(delta.content)
  │   │   └── 超时：chunk 间隔 > 300s → 中止
  │   └── 非流式模式（stream: false）：
  │       ├── 等待完整响应
  │       └── 超时：总时长 > 300s → 中止
  │
  └── 5. 返回
      └── Promise<{ text: string }>  // 流式模式下为累积的完整文本
```

---

## 19. 错误处理与容错机制

### 15.1 AI 调用错误

```
AI 调用容错：
  │
  ├── 1. 网络错误
  │   ├── fetch 失败（无网络/DNS解析失败）→ 显示错误信息
  │   │   └── "网络连接失败，请检查网络后重试"
  │   └── 可重试（保留用户输入，重新发起请求）
  │
  ├── 2. API 错误（4xx/5xx）
  │   ├── 401/403 → "API Key 无效或已过期，请重新设置"
  │   ├── 429 → "请求频率过高，请稍后重试"（等待 Retry-After 秒数）
  │   ├── 500/502/503 → "AI 服务暂时不可用，请稍后重试"
  │   └── 自动重试（最多 3 次，退避延迟 2s/4s/8s）
  │
  └── 3. 超时
      ├── 300s 超时 → "AI 响应超时，请缩短输入或稍后重试"
      └── 可重试
```

### 15.2 标签解析容错

```
标签解析多级容错：
  │
  ├── Level 1: 标准正则提取
  │   └── /<psy_xxx>([\s\S]*?)<\/psy_xxx>/g
  │
  ├── Level 2: 容错正则（标签可能不闭合/嵌套等问题）
  │   ├── 尝试修复常见畸形：
  │   │   ├── 标签名大小写不匹配 → 忽略大小写匹配
  │   │   ├── 缺少闭合标签 → 尝试在文末截断
  │   │   └── 标签内含有未转义的 < > → 尝试修复
  │   └── 仍失败 → 跳过此标签
  │
  ├── Level 3: JSON 解析容错
  │   ├── JSON.parse() 失败时尝试修复：
  │   │   ├── trim 首尾空白/换行
  │   │   ├── 移除尾部多余逗号
  │   │   ├── 尝试补全缺失的闭合括号
  │   │   └── 移除注释行（// ...）
  │   └── 仍失败 → 记录原始内容到日志，跳过
  │
  └── 容错策略：部分标签失败不影响其他标签
      └── 失败的标签仅记录日志，不中断整个 applyStateTurn
```

### 15.3 数据完整性保障

```
ensureGameRuntimeDefaults(G)
  │
  └── 对以下字段逐一检查，不存在则初始化为默认值：
      ├── doctorLevel → { major:"心理学徒", minor:"初窥" }
      ├── levelIndex → 0
      ├── psychologistBase → DOCTOR_LEVEL_TABLE[0] 的 8+2 属性
      ├── clinicalHours → 0
      ├── supervisionHours → 0
      ├── personalTherapyHours → 0
      ├── theoryMastery → {}
      ├── philosophyDepth → { 现象学:0, 诠释学:0, 存在哲学:0, 东方心学:0, 后现代批判:0 }
      ├── bookShelf → []
      ├── therapyTools → []
      ├── assessmentTools → []
      ├── currentClients → []
      ├── nearbyPeople → []
      ├── countertransference → { overIdentification:0, ..., overallRiskLevel:"low" }
      ├── chatHistory → []
      ├── careerHistory → []
      ├── activeCareerEvents → []
      ├── currentFatigue → 0
      └── burnoutLevel → 0
```

---

## 20. 全局状态转换图

```
                         ┌─────────────┐
                         │  启动页      │
                         │ index.html  │
                         └──────┬──────┘
                                │ 开始人生 / 读取人生
                                ▼
                         ┌─────────────┐
                         │  主界面      │
                         │ main.html   │
                         └──────┬──────┘
                                │ init()
                                ▼
                    ┌───────────────────────┐
                    │ shouldRunBootstrapGate?│
                    └───────┬───────────────┘
                            │
              ┌─────────────┴─────────────┐
              │ YES (新档)               │ NO (读档)
              ▼                           ▼
    ┌─────────────────┐        ┌─────────────────┐
    │ Phase 1:         │        │ 恢复存档状态     │
    │ openingStory     │        │ 渲染面板 + 聊天  │
    └────────┬────────┘        └────────┬────────┘
             │                          │
             ▼                          │
    ┌─────────────────┐                 │
    │ Phase 2:         │                 │
    │ initState        │                 │
    └────────┬────────┘                 │
             │                          │
             ▼                          │
    ┌─────────────────┐                 │
    │ Phase 3:         │                 │
    │ stateSync        │                 │
    └────────┬────────┘                 │
             │                          │
             ▼                          │
    ┌─────────────────┐                 │
    │ Phase 4:         │                 │
    │ finish           │                 │
    └────────┬────────┘                 │
             │                          │
             └──────────┬───────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │  主游戏循环        │
              │  (等待玩家输入)    │◄──────────────────────────┐
              └────────┬──────────┘                           │
                       │ 玩家发送消息                          │
                       ▼                                      │
              ┌───────────────────┐                           │
              │ Step 1:           │                           │
              │ handleChatSend    │                           │
              └────────┬──────────┘                           │
                       │                                      │
                       ▼                                      │
              ┌───────────────────┐                           │
              │ Step 2:           │                           │
              │ runStoryAiTurn    │                           │
              └────────┬──────────┘                           │
                       │                                      │
                       ▼                                      │
              ┌───────────────────┐                           │
              │ Step 3:           │                           │
              │ 展示叙事+建议     │                           │
              └────────┬──────────┘                           │
                       │                                      │
                       ▼                                      │
              ┌───────────────────┐                           │
              │ Step 4:           │                           │
              │ runStateAiTurn    │                           │
              └────────┬──────────┘                           │
                       │                                      │
                       ▼                                      │
              ┌───────────────────┐                           │
              │ Step 5: 后处理    │                           │
              │ 检查触发器        │──────┐                    │
              └────────┬──────────┘      │                    │
                       │                 │                    │
          ┌────────────┼─────────────────┼────────────────────┤
          │            │                 │                    │
          ▼            ▼                 ▼                    │
   ┌───────────┐ ┌───────────┐   ┌───────────┐               │
   │ 个案触发?  │ │ 伦理困境? │   │ 反移情告警?│               │
   └─────┬─────┘ └─────┬─────┘   └─────┬─────┘               │
     YES │         YES │           YES │                      │
         ▼             ▼               ▼                      │
   ┌───────────┐ ┌───────────┐   ┌───────────┐               │
   │ 个案引擎   │ │ 困境模态   │   │ 风险提示   │               │
   │ 启动      │ │ 弹出      │   │ 弹出      │               │
   └─────┬─────┘ └─────┬─────┘   └─────┬─────┘               │
         │             │               │                      │
         └─────────────┴───────────────┘                      │
                       │                                      │
                       ▼                                      │
              ┌───────────────────┐                           │
              │ Step 6:           │                           │
              │ 刷新全部 UI       │───────────────────────────┘
              │ 持久化            │
              └───────────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │  理论里程碑检查    │
              │  等级晋升检查      │
              │  整合条件检查      │
              └───────────────────┘
```

---

## 21. 调试日志系统

psydoctor 复用 mortal_journey 的 `logPanel.js`，日志分类如下：

| 日志频道 | 颜色 | 记录内容 |
|---------|------|---------|
| `[psy:ai]` | 蓝色 | AI 请求（prompt 类型、消息数、token 数）、响应耗时（ms）、流式 chunk 计数 |
| `[psy:state]` | 绿色 | 状态变更（时数增加、等级晋升、理论阶段提升、属性重算结果） |
| `[psy:session]` | 紫色 | 个案会话（回合数、干预选择、效果计算值、联盟/症状变化、结算评级） |
| `[psy:ethics]` | 橙色 | 伦理困境（触发类型、玩家选择、effects 应用结果） |
| `[psy:counter]` | 红色 | 反移情（累积触发源、change 值、riskLevel 变化、阈值告警） |
| `[psy:tag]` | 青色 | 标签解析（提取成功/失败的标签名、JSON 解析错误详情） |
| `[psy:save]` | 灰色 | 存档操作（autoSave 触发、文件大小、localStorage 写入耗时） |
| `[psy:error]` | 红色 | 所有错误（AI 调用失败、标签解析失败、数据校验失败） |

---

*文档版本：v1.0*
*创建日期：2026-06-18*
*基于：psydoctor 架构设计文档 v1.0 + psydoctor 需求文档 v1.0*
