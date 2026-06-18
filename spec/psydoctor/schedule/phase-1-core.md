# Phase 1: 核心框架（可玩原型）

> 目标：玩家可创建角色 → 进入主界面 → 发送消息 → AI 叙事响应 → 状态同步 → 面板显示 → 存档/读档
> 
> 参考：architecture.md §23 第一阶段 + logic-flow.md §2-4, §11-14

---

## 1.1 项目脚手架

### 1.1.1 文件复制与基础搭建

- [x] 从 `mortal_journey/silly_tarven/bridge.js` 复制到 `psydoctor/silly_tarven/bridge.js`（零修改）
- [x] 从 `mortal_journey/js/log/logPanel.js` 复制到 `psydoctor/js/log/logPanel.js`（零修改）
- [x] 从 `mortal_journey/css/logPanel.css` 复制到 `psydoctor/css/logPanel.css`
- [x] 创建 `index.html`：API 设置区 + 人生选择区 + `<script>` 引用
- [x] 创建 `main.html`：三栏布局骨架 + 按架构 §2.3 顺序声明 `<script>` 加载
- [x] 创建 `css/start_frame.css`（基于 mortal_journey 同名文件改造）
- [x] 创建 `css/creation.css`（人生选择卡片样式）
- [x] 创建 `css/main.css`（三栏布局 + 聊天区 + 面板样式 + 弹窗样式）

### 1.1.2 验证

- [ ] 确认 `bridge.js` 在 psydoctor 中可正常调用（API 连通性测试）
- [ ] 确认 `logPanel.js` 在 psydoctor 中可正常劫持 console
- [ ] 确认 `index.html` 和 `main.html` 可正常打开（无 JS 报错）

---

## 1.2 数据层（静态数据表）

### 1.2.1 属性系统

- [ ] 创建 `js/character/character_attribute.js`
  - [ ] 定义 8+2 属性键常量：`EMPATHY`, `INSIGHT`, `KNOWLEDGE`, `TECHNIQUE`, `JUDGMENT`, `AWARENESS`, `COMMUNICATION`, `RESILIENCE`, `HUMANITY`, `PHILOSOPHY`
  - [ ] 定义属性中文标签映射
  - [ ] 暴露 `CharacterAttribute` 全局命名空间

### 1.2.2 等级数据

- [ ] 创建 `js/data/doctor_level.js`
  - [ ] 定义 `DOCTOR_LEVEL_TABLE`（21 行 × 12 列：8+2 属性 + 临床时数门槛）
  - [ ] 数据与 requirements.md §3.3 完全一致
  - [ ] 定义 `DOCTOR_LEVEL_LABELS`（7×3=21 个中文标签）
  - [ ] 定义 `CLINICAL_HOURS_THRESHOLDS`（21 个时数门槛值）
  - [ ] 暴露 `DoctorLevelState` 全局命名空间

### 1.2.3 哲学维度数据

- [ ] 创建 `js/data/philosophy_state.js`
  - [ ] 定义 5 大哲学维度：现象学/诠释学/存在哲学/东方心学/后现代批判
  - [ ] 定义每维度的属性映射（维度 → 主属性1 × 主属性2）
  - [ ] 定义等级倍率表 PHILOSOPHY_DEPTH_RATIO（21 级对应倍率：学徒×0.02 → 心灵哲学家×0.50）
  - [ ] 暴露 `PhilosophyState` 全局命名空间

### 1.2.4 开局配置数据

- [ ] 创建 `js/data/creation_config.js`
  - [ ] 定义 `EDUCATION_OPTIONS`（6 种教育背景，每种含 initialLevel、initialTheory、bonus、defaultWorkplace、defaultLocation、age）
  - [ ] 定义 `MOTIVATION_OPTIONS`（5 种入行契机，每种含 bonus 和叙事描述）
  - [ ] 定义 `TRAIT_CATEGORIES`（5 大类，每类 2-4 个具体特质，每种含 name/desc/category/bonus）
  - [ ] 暴露 `PsyDoctorCreationConfig` 全局命名空间

### 1.2.5 个人特质数据

- [ ] 创建 `js/data/trait_samples.js`
  - [ ] 定义特质词条池（≥20 条，5 大类各 4+ 条）
  - [ ] 每条含 name/desc/rarity/category/bonus
  - [ ] 暴露 `PsyTraitSamples` 全局命名空间

### 1.2.6 验证

- [ ] 在浏览器 console 中确认所有数据层全局变量可访问
- [ ] 确认 `DOCTOR_LEVEL_TABLE[0]` 的属性值与 requirements.md §3.3 一致
- [ ] 确认 `EDUCATION_OPTIONS` 的 bonus 与 architecture.md §8.3 一致

---

## 1.3 游戏引擎层（核心算法）

### 1.3.1 属性计算引擎

- [ ] 创建 `js/game/psychologist_base_runtime.js`
  - [ ] 实现 `computePsychologistBase(G, fc)` 6 步管线（按 logic-flow.md §12.1）：
    - [ ] Step 1: 从 `DOCTOR_LEVEL_TABLE[G.levelIndex]` 读取等级基础值
    - [ ] Step 2: 平面加成合并（教育 bonus + 动机 bonus + 特质 bonus + 理论学习 depth bonus + 哲学思辨 bonus）
    - [ ] Step 3: 反移情惩罚（按 riskLevel 应用百分比惩罚）
    - [ ] Step 4: 哲学维度乘法加成（depth × ratio 作用于对应属性）
    - [ ] Step 5: 倦怠惩罚（fatigue 区间 + burnoutLevel 惩罚）
    - [ ] Step 6: Math.round 取整 + 钳制（humanity/philosophy [0,100]，其余 [1,999]）
  - [ ] 实现 `applyComputedBaseToGame(G)` 写入 `G.psychologistBase`
  - [ ] 实现 `computePsychologistBaseFromCharacterSheet(sheet)` 用于 NPC
  - [ ] 暴露 `PsychologistBaseRuntime` 全局命名空间

### 1.3.2 验证

- [ ] 单元测试：心理学徒·初窥 + 心理学本科 + 助人理想 → empathy 应为 10+0+5+... ≈ 15
- [ ] 单元测试：反移情 high 时 awareness 应 ×0.75
- [ ] 单元测试：哲学深度 1 级 + 现象学 depth=5 → insight 应被乘法加成

---

## 1.4 知识基底与世界书（最小可用版本）

### 1.4.1 知识基底条目

- [ ] 创建 `js/worldbook/world_book_entries.js`
  - [ ] 定义 ≥10 条最小条目（覆盖 5 个分类各 2 条）：
    - [ ] "心理治疗基本框架"（constant=true，保密/知情同意/治疗框架）
    - [ ] "伦理规范摘要"（constant=true，APA/中国心理学会核心条款）
    - [ ] "共情回应规范"（technique 类）
    - [ ] "认知歪曲清单"（theory 类，CBT 核心概念）
    - [ ] "防御机制分类"（theory 类，精神分析核心概念）
    - [ ] "存在主义四大终极关怀"（philosophy 类）
    - [ ] "抑郁障碍诊断要点"（diagnosis 类）
    - [ ] "焦虑障碍诊断要点"（diagnosis 类）
    - [ ] "知後同意规范"（ethics 类）
    - [ ] "苏格拉底式提问"（technique 类）
  - [ ] 暴露 `PsyDoctorWorldBookEntries` 全局命名空间

### 1.4.2 知识基底引擎

- [ ] 创建 `js/worldbook/world_book.js`
  - [ ] 实现 `selectEntries(scanText, options)`（按 logic-flow.md §13）：
    - [ ] 分离 constant 条目（永远入选）
    - [ ] 对非常量条目计算关键词命中分（`keys[]` 在 scanText 中出现次数）
    - [ ] 排序：priority 降序 → hits 降序 → id 字典序
    - [ ] 去重合并（constant 先于 triggered）
    - [ ] 截断到 maxEntries（默认 8）
  - [ ] 实现 `formatForSystem(entries)` 生成注入格式文本
  - [ ] 实现 `syncToBridgeStorage()` 同步到 localStorage
  - [ ] 暴露 `PsyDoctorWorldBook` 全局命名空间

### 1.4.3 AI 预设系统

- [ ] 创建 `js/worldbook/preset_content.js`
  - [ ] 定义 ≥1 个叙事预设（system prompt：心理医生成长记的叙事基调、人称视角）
  - [ ] 定义 `outputFormat` 规则预设（17 种 `<psy_*>` 标签格式说明）
  - [ ] 定义 `action_suggestions` 规则预设（四级行动建议：正面/中性/谨慎/反思）
  - [ ] 定义 `story_snapshot` 规则预设（故事快照摘要规则）
  - [ ] 暴露 `PsyDoctorPresetContent` 全局命名空间

- [ ] 创建 `js/worldbook/preset.js`
  - [ ] 实现预设列表解析（分离叙事预设 vs 规则预设）
  - [ ] 实现 `fillTemplateVars(template, G)` 模板变量填充：
    - [ ] `{{PLAYER_NAME}}`、`{{DOCTOR_LEVEL}}`、`{{CLINICAL_HOURS}}`
    - [ ] `{{THEORY_ORIENTATION}}`、`{{PSYCHOLOGIST_BASE_STATS}}`
    - [ ] `{{CURRENT_CLIENTS_SUMMARY}}`、`{{COUNTERTRANSFERENCE_STATUS}}`
    - [ ] `{{BOOKSHELF_SUMMARY}}`
  - [ ] 实现 `buildSystemPrompt(G)` 组装最终 system prompt
  - [ ] 暴露 `PsyDoctorAiPreset` 全局命名空间

### 1.4.4 AI 规则模板

- [ ] 创建 `js/worldbook/state_rules.js`
  - [ ] 定义状态 AI 规则模板（来访者状态更新规则/临床时数规则/反移情规则/物品规则）
  - [ ] 标签变量注入（`{{OPS_TAG_OPEN}}` 等）
  - [ ] 暴露 `PsyDoctorStateRules` 全局命名空间

- [ ] 创建 `js/worldbook/init_state_rules.js`
  - [ ] 定义开局配置 AI 规则模板（学历映射/初始物品约束/初始来访者难度限制）
  - [ ] 暴露 `PsyDoctorInitStateRules` 全局命名空间

### 1.4.5 验证

- [ ] 确认 `selectEntries("来访者张某表现出明显的认知歪曲...")` 命中 CBT 条目
- [ ] 确认 `fillTemplateVars` 正确替换所有 10 个模板变量
- [ ] 确认 `buildSystemPrompt` 生成的 prompt 包含叙事预设 + 规则预设 + 知识基底

---

## 1.5 AI 服务层（AI 管线）

### 1.5.1 API 桥接确认

- [ ] 确认 `TavernHelper.generateFromMessages()` 在 psydoctor 上下文中可正常调用
- [ ] 确认流式（SSE）模式正常工作
- [ ] 确认非流式模式正常工作
- [ ] 确认 300s 超时机制正常触发
- [ ] 确认 AbortController 取消机制正常

### 1.5.2 叙事 AI（story_generate.js）

- [ ] 创建 `js/ai_server/story_generate.js`
  - [ ] 实现 `buildMessages(fc, G, userText, priorStoryRaw)`（按 logic-flow.md §4.1 Step 2.1）：
    - [ ] 构建 system 消息（预设 + 规则 + 知识基底）
    - [ ] 构建历史对话轮次（从 `G.chatHistory` 截取最近 N 轮）
    - [ ] 构建当前 user 消息（用户输入 + 运行时状态摘要 + 来访者快照 + 周围人物快照 + 职业生涯上下文）
  - [ ] 实现 `sendTurn(userText, G, fc)`：
    - [ ] 调用 `TavernHelper.generateFromMessages()`
    - [ ] 支持流式渲染（onChunk → 打字效果）
    - [ ] 设置 `PSY_AI_GENERATING` 标志
  - [ ] 实现标签提取函数：
    - [ ] `resolveStoryReplyForPipeline(text)` → 提取 `<psy_story_body>` 纯叙事
    - [ ] `extractActionSuggestions(text)` → 四级行动建议
    - [ ] `detectCaseSessionTrigger(text)` → `<psy_case_session_trigger>`
    - [ ] `detectEthicalDilemma(text)` → `<psy_ethical_dilemma>`
    - [ ] `extractTheoryInsight(text)` → `<psy_theory_insight>`
    - [ ] `extractPhilosophyReflection(text)` → `<psy_philosophy_reflection>`
  - [ ] 暴露 `PsyDoctorStoryGenerate` 全局命名空间

### 1.5.3 状态 AI（state_generate.js）

- [ ] 创建 `js/ai_server/state_generate.js`
  - [ ] 实现 `sendTurn(G, priorStoryText)`：
    - [ ] 构建 system prompt（state_rules.js 模板）
    - [ ] 构建 user 消息（叙事正文引用 + `PsyDoctorGame` 完整快照）
    - [ ] 调用 AI（非流式，60s 超时）
  - [ ] 实现 `applyStateTurnFromAssistantText(G, text)`（按 logic-flow.md §4.2）：
    - [ ] Step 1: 正则提取全部 10 种状态标签
    - [ ] Step 2.1: 解析 `<psy_world_state>`（时间单调性校验 + 写入）
    - [ ] Step 2.2: 解析 `<psy_therapist_state>`（疲劳/倦怠/自觉性变化）
    - [ ] Step 2.3: 解析 `<psy_client_state>`（来访者匹配 + 症状/联盟更新 + 结案检查）
    - [ ] Step 2.4: 解析 `<psy_clinical_gain>`（时数累加 + 理论进度 + 洞察）
    - [ ] Step 2.5: 解析 `<psy_supervision_notes>`（督导记录追加）
    - [ ] Step 2.6: 解析 `<psy_career_event>`（职业事件创建 + 去重）
    - [ ] Step 2.7: 解析 `<psy_countertransference>`（类型校验 + 累积 + riskLevel 重算）
    - [ ] Step 2.8: 解析 `<psy_nearby_people>`（合并策略：保留已有/完整规范化新来者）
    - [ ] Step 2.9: 解析 `<psy_inventory_ops>`（藏书/工具/测评工具增删 + 上限检查）
    - [ ] Step 2.10: 解析 `<psy_theory_milestone>`（阶段提升 + 整合解锁）
    - [ ] Step 3: 单标签失败不影响其他标签（渐进式容错）
    - [ ] Step 4: 触发后处理（个案/伦理/理论/反移情检查）
  - [ ] 暴露 `PsyDoctorStateGenerate` 全局命名空间

### 1.5.4 开局 AI（world_generate.js + init_state_generate.js）

- [ ] 创建 `js/ai_server/world_generate.js`
  - [ ] 实现 `runOpeningStoryStrictPromise(fc, G)`
  - [ ] 实现 `buildOpeningUserPrompt(fc, G)`（注入命运抉择 + 叙事约束）
  - [ ] 提取 `<psy_story_body>` → 写入 `G.chatHistory`
  - [ ] 暴露 `PsyDoctorWorldGenerate` 全局命名空间

- [ ] 创建 `js/ai_server/init_state_generate.js`
  - [ ] 实现 `runInitStateAiIfNeeded(G, fc)`
  - [ ] 前置条件检查（TavernHelper 就绪 + 未执行过）
  - [ ] 构建请求（system = init_state_rules + user = fateChoice + 剧情正文）
  - [ ] 解析三对标签：
    - [ ] `<psy_init_loadout>` → 初始藏书/工具/来访者
    - [ ] `<psy_world_state>` → 初始时间/地点/工作场景
    - [ ] `<psy_therapist_state>` → 初始属性微调（±5 限制）
  - [ ] 调用 `computePsychologistBase(G, fc)` 计算完整面板
  - [ ] 标记 `G.psyInitStateAiApplied = true`
  - [ ] 暴露 `PsyDoctorInitStateGenerate` 全局命名空间

### 1.5.5 验证

- [ ] 测试叙事 AI 调用：输入"我开始今天的咨询工作" → 应返回含 `<psy_story_body>` 的响应
- [ ] 测试状态 AI 调用：输入叙事正文 → 应返回含 `<psy_world_state>` 等标签的响应
- [ ] 测试 `applyStateTurnFromAssistantText` 解析完整标签集
- [ ] 测试标签容错：畸形 JSON 不应导致整个状态应用失败
- [ ] 测试开局剧情 AI 调用：应生成符合教育背景的开局叙事

---

## 1.6 UI 层（界面与交互）

### 1.6.1 启动页

- [ ] 创建 `js/ui/fateChoiceController.js`
  - [ ] 实现 API 设置区（复用 bridge.js 的配置逻辑，写入 localStorage）
  - [ ] 实现人生选择 5 步流程（按 logic-flow.md §2.2）：
    - [ ] Step 1: 教育背景选择（6 张卡片，点击选中高亮 + 属性预览）
    - [ ] Step 2: 入行契机选择（5 张卡片 + 属性加成预览）
    - [ ] Step 3: 个人特质选择（5 大类标签页，最多选 2 个）
    - [ ] Step 4: 初始理论微调（下拉列表，默认 = 教育背景对应的理论）
    - [ ] Step 5: 角色信息（姓名/性别/年龄）
  - [ ] 实现「开始人生」按钮：
    - [ ] 校验（姓名非空）
    - [ ] 构建 `fateChoice` 对象
    - [ ] 创建 `PsyDoctorGame` 初始对象（21 个初始字段）
    - [ ] 生成存档 ID + 写入 localStorage + sessionStorage
    - [ ] 跳转 `main.html`
  - [ ] 实现「读取人生」（存档列表 + 选择 + 恢复）
  - [ ] 暴露 `PsyFateChoiceController` 全局命名空间

### 1.6.2 面板数据逻辑

- [ ] 创建 `js/ui/mainScreen_panel.js`
  - [ ] 定义常量（`STORAGE_KEY`, `SAVE_INDEX_KEY`, `SAVE_PREFIX`, `BOOKSHELF_SLOT_MAX=30`, `TOOL_SLOT_MAX=10`）
  - [ ] 实现临床时数/督导时数/研究积分累积计算
  - [ ] 实现藏书增删改（去重/排序/上限检查）
  - [ ] 实现治疗工具增删改（上限检查）
  - [ ] 实现测评工具增删改（培训前提检查）
  - [ ] 实现来访者列表合并去重
  - [ ] 实现理论阶段晋升判定（按 logic-flow.md §7.1 阈值）
  - [ ] 实现存档管理（save/load/delete/list）
  - [ ] 暴露 `PsyMainScreenPanel` 全局命名空间

### 1.6.3 面板 UI 渲染

- [ ] 创建 `js/ui/mainScreen_panel_ui.js`
  - [ ] 实现 `renderLeftPanel(fc, G)`：
    - [ ] 等级显示（大阶段·小阶段）
    - [ ] 8+2 属性面板（数值 + 进度条）
    - [ ] 临床时数/督导时数/个人体验时数
    - [ ] 当前理论取向 + 掌握阶段
    - [ ] 哲学深度简表
  - [ ] 实现 `renderBookShelfGrid(G)`（网格布局，≤30 格）
  - [ ] 实现 `renderTherapyToolGrid(G)`（网格布局，≤10 格）
  - [ ] 实现 `renderRightPanel(G)`：
    - [ ] 来访者卡片列表（姓名 + 主诉 + 治疗阶段 + 联盟进度条）
    - [ ] 督导/同行列表
    - [ ] 活跃职业事件指示
  - [ ] 实现 `renderBootstrapOverview(fc)`（开局总览）
  - [ ] 实现弹窗绑定：
    - [ ] `bindTheoryDetailModalUi()` — 理论详情弹窗
    - [ ] `bindClientDetailModalUi()` — 来访者档案详情弹窗
  - [ ] 暴露 `PsyMainScreenPanelUi` 全局命名空间

### 1.6.4 聊天 UI 与 AI 回合编排

- [ ] 创建 `js/ui/mainScreen_chat.js`
  - [ ] 实现 `handleChatSend(userText)`（按 logic-flow.md §4.1 Step 1）：
    - [ ] 输入校验（非空 + 非 AI 生成中 + 非个案中 + 非伦理困境中）
    - [ ] 写入 `G.chatHistory`
    - [ ] 渲染用户消息到聊天区
    - [ ] 设置全局锁 `PSY_AI_GENERATING = true`
    - [ ] 禁用发送按钮 + 显示「思考中...」
  - [ ] 实现 `runStoryAiTurn(userText)`（按 logic-flow.md §4.1 Step 2）：
    - [ ] 调用 `PsyDoctorStoryGenerate.sendTurn()`
    - [ ] 流式渲染（appendToChatArea + scrollToBottom）
    - [ ] 写入 `G.chatHistory`
  - [ ] 实现 `runStateAiTurn(priorStoryText)`（按 logic-flow.md §4.1 Step 4）：
    - [ ] 调用 `PsyDoctorStateGenerate.sendTurn()`
    - [ ] 调用 `applyStateTurnFromAssistantText()`
  - [ ] 实现后处理（按 logic-flow.md §4.1 Step 5）：
    - [ ] 检查 `pendingCaseSession`（Phase 1 可跳过，仅记录日志）
    - [ ] 检查 `activeEthicalDilemma`（Phase 1 可跳过）
    - [ ] 检查理论里程碑
    - [ ] 检查反移情风险
  - [ ] 实现 UI 刷新（按 logic-flow.md §4.1 Step 6）：
    - [ ] 渲染行动建议按钮（4 个按钮 + 颜色区分）
    - [ ] 刷新左栏 + 右栏
    - [ ] 持久化快照
    - [ ] 解锁 UI
  - [ ] 暴露 `PsyMainScreenChat` 全局命名空间

### 1.6.5 主界面入口

- [ ] 创建 `js/ui/mainScreen.js`
  - [ ] 实现 `init()`（按 logic-flow.md §3.1 入口流程）：
    - [ ] 绑定 UI 事件（弹窗、晋升、来访者详情）
    - [ ] `restoreBootstrap()` → 读取 sessionStorage
    - [ ] `ensureGameRuntimeDefaults(G)` → 补全缺失字段
    - [ ] `computePsychologistBase(G, fc)` → 首次属性计算
    - [ ] `runBootstrapAiGateOrSkip()` → 判断新档/读档
    - [ ] 绑定聊天发送按钮 + 行动建议按钮
    - [ ] 绑定手机端面板切换
    - [ ] 启动 4 秒定时自动保存
    - [ ] 注册 beforeunload 事件兜底保存
  - [ ] 实现 `shouldRunBootstrapAiGate(G)` 判定逻辑
  - [ ] 实现 `execFullBootstrapPipeline(G, fc)` 门闩管线：
    - [ ] Phase 1: 调用 `PsyDoctorWorldGenerate.runOpeningStoryStrictPromise()`
    - [ ] Phase 2: 调用 `PsyDoctorInitStateGenerate.runInitStateAiIfNeeded()`
    - [ ] Phase 3: 调用 `PsyMainScreenChat.runStateAiTurn()`
    - [ ] Phase 4: `finishBootstrapGateSuccess()`（隐藏门闩 UI + 渲染面板 + 持久化）
  - [ ] 实现门闩异常处理（重试按钮 + 阶段显示）
  - [ ] 实现 `runNormalFirstEnterPipeline(G)`（读档后的正常首次进入）
  - [ ] 实现对外 API（`setClinicalHours`, `addBookToShelf`, `setClientState` 等）
  - [ ] 暴露 `PsyMainScreen` 全局命名空间

### 1.6.6 验证

- [ ] 完整手动测试：index.html → 选择教育背景 → 选择动机 → 选择特质 → 填写姓名 → 点击开始
- [ ] 确认跳转到 main.html 后门闩 UI 正常显示（4 阶段依次执行）
- [ ] 确认 Phase 1 开局剧情正常生成并显示在聊天区
- [ ] 确认 Phase 2 开局配置正常（藏书/工具/属性写入）
- [ ] 确认 Phase 3 状态同步正常（周围人物/行动建议）
- [ ] 确认 Phase 4 门闩完成后三栏面板正常渲染
- [ ] 发送一条消息（如"我去图书馆阅读心理学书籍"）→ 确认叙事 AI 响应 + 状态 AI 同步
- [ ] 确认左栏属性面板数值正确（心理学徒·初窥 + 教育 bonus + 动机 bonus）
- [ ] 确认右栏来访者/同行列表显示
- [ ] 确认行动建议按钮正常显示和点击
- [ ] 手动存档 → 刷新页面 → 读档 → 确认状态恢复正确
- [ ] 确认 4 秒自动保存正常工作
- [ ] 确认调试日志面板可打开并显示日志

---

## 1.7 Phase 1 完成标准

- [ ] **全流程可用**：创建角色 → 门闩 → 聊天对话 → AI 响应 → 面板更新 → 存档/读档
- [ ] **属性计算正确**：6 步管线计算结果与手动计算一致
- [ ] **AI 管线稳定**：连续 10 次对话无崩溃/无标签解析全部失败
- [ ] **存档可靠**：存档 → 刷新 → 读档 → 状态无损恢复
- [ ] **无 console 报错**：正常运行中无未捕获异常

> **完成后**：将本文件重命名为 `phase-1-core-done.md`

---

*基于：architecture.md §23 + logic-flow.md §2-4, §11-14 + requirements.md §2, §3, §7, §11, §13*
