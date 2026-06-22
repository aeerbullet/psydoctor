# Phase 1 手动测试步骤

> 按顺序执行，每项效果符合预期后在本文件打 `[x]`，并同步到 `phase-1-core.md` 对应项。

---

## 准备工作

1. 启动项目，打开浏览器
2. 按 **F12** 打开开发者工具 → **Console（控制台）** 面板

---

## 1.1.2 基础搭建验证

### ① bridge.js 连通性

在 Console 粘贴：

```js
typeof TavernHelper
```

预期输出：`"object"`（不是 `"undefined"`）

### ② API 连通性测试

页面上操作：

> 点 **API 设置** → 填入 API URL、Key、模型 → 点 **测试** → 看到绿色"连接成功"

### ③ logPanel.js

在 Console 粘贴：

```js
console.log("测试日志面板");
```

预期：页面右下角出现彩色日志条目（不是只有 F12 能看到）

### ④ 无 JS 报错

刷新页面 → Console 面板顶部红色错误 `✖` 数量为 0

- [ ] ① bridge.js 连通性
- [ ] ② API 测试连接成功
- [ ] ③ logPanel 日志显示
- [ ] ④ 控制台无红色报错

---

## 1.2.6 数据层验证

> 需要先进入 main.html，在 Console 中执行以下代码。

### ⑤ 全局变量可访问

```js
typeof CharacterAttribute, typeof DoctorLevelState, typeof PhilosophyState, typeof PsyDoctorCreationConfig, typeof PsyTraitSamples
```

预期输出：`"object","object","object","object","object"`

### ⑥ 等级表数据

```js
JSON.stringify(DoctorLevelState.DOCTOR_LEVEL_TABLE[0])
```

将输出与 `spec/psydoctor/requirements.md §3.3` 第一行对照。

### ⑦ 教育配置

```js
JSON.stringify(PsyDoctorCreationConfig.EDUCATION_OPTIONS)
```

将输出与 `spec/psydoctor/architecture.md §8.3` 对照。

- [ ] ⑤ 全部 5 个数据层全局变量为 object
- [ ] ⑥ DOCTOR_LEVEL_TABLE[0] 与 requirements 一致
- [ ] ⑦ EDUCATION_OPTIONS bonus 与 architecture 一致

---

## 1.3.2 属性计算引擎验证

> 需要已进入 main.html，在 Console 中执行。

### ⑧ 基础属性计算

```js
let fc = { education: 'psychology', motivation: 'helping' };
let G = {
  levelIndex: 0,
  theoryOrientation: 'cbt',
  philosophyDepths: { phenomenology: 0, hermeneutics: 0, existential: 0, eastern: 0, postmodern: 0 },
  countertransferenceRiskLevel: 'low',
  fatigue: 0,
  burnoutLevel: 0,
  psychologistBase: {}
};
PsychologistBaseRuntime.computePsychologistBase(G, fc);
console.log('empathy =', G.psychologistBase.empathy);
```

预期：empathy ≈ 等级基础值 + 学历 bonus + 动机 bonus

### ⑨ 反移情惩罚

```js
G.countertransferenceRiskLevel = 'high';
PsychologistBaseRuntime.computePsychologistBase(G, fc);
console.log('high 风险下 awareness =', G.psychologistBase.awareness);
```

预期：awareness 变为 ×0.75

### ⑩ 哲学深度加成

```js
G.philosophyDepths.phenomenology = 5;
PsychologistBaseRuntime.computePsychologistBase(G, fc);
console.log('depth=5 后 insight =', G.psychologistBase.insight);
```

预期：insight > 基础值（被乘法加成）

- [ ] ⑧ 基础属性计算正确
- [ ] ⑨ 反移情惩罚生效
- [ ] ⑩ 哲学深度加成生效

---

## 1.4.5 知识基底验证

> 需要已进入 main.html，在 Console 中执行。

### ⑪ selectEntries 命中

```js
PsyDoctorWorldBook.selectEntries("来访者张某表现出明显的认知歪曲，他认为同事看他一眼就说明讨厌他", {maxEntries: 8});
```

预期：结果列表包含"认知歪曲清单"

### ⑫ 模板变量替换

```js
PsyDoctorAiPreset.buildSystemPrompt(G);
```

预期：输出文本中没有 `{{XXX}}` 残留

- [ ] ⑪ selectEntries 命中正确条目
- [ ] ⑫ 模板变量全部替换无残留

---

## 1.5.5 AI 服务层验证

> 以下步骤全部在页面上操作。

### ⑬ 完整创建流程（首次门闩管线）

页面操作：

1. 在 index.html 选教育背景 → 点卡片确认高亮
2. 选入行契机 → 点卡片确认高亮
3. 选个人特质 → 最多选 2 个
4. 填姓名
5. 点 **"开始人生"**
6. 自动跳转 main.html

### ⑭ 门闩 4 阶段

预期：

- 看到 4 个阶段进度条依次执行（Phase 1 → 2 → 3 → 4）
- 每个阶段执行时显示"加载中"状态
- 全部完成后阶段标签变绿

### ⑮ Phase 1 开局剧情

预期：聊天区出现 AI 生成的开篇故事，有打字机逐字输出效果

### ⑯ Phase 2 开局配置

预期：

- 左栏面板出现藏书（几本书图标）
- 左栏出现工具列表

### ⑰ Phase 3 状态同步

预期：

- 右栏显示周围人物（督导/同行）
- 聊天区下方显示行动建议按钮

### ⑱ Phase 4 门闩完成

预期：三栏完整渲染

- 左栏：属性面板
- 中间：聊天区
- 右栏：来访者列表 + 同行列表

### ⑲ 发送消息

在聊天框输入：

```
我去图书馆阅读心理学书籍
```

按 Enter。

预期：

- AI 流式回复（打字机效果）
- 左栏或右栏数值可能更新
- 无报错

- [ ] ⑬ 创建角色完整流程走通
- [ ] ⑭ 门闩 4 阶段依次执行
- [ ] ⑮ 开局剧情生成并打字机显示
- [ ] ⑯ 开局配置写入（藏书/工具）
- [ ] ⑰ 状态同步（人物/行动建议）
- [ ] ⑱ 门闩完成后三栏渲染
- [ ] ⑲ 发送消息后 AI 正常回复

---

## 1.6.6 UI 层测试

> 以下步骤在门闩完成后进行。

### ⑳ 左栏属性面板

检查：

- 8+2 属性有数值 + 进度条
- 等级显示（如"心理学徒·初窥"）
- 临床时数/督导时数
- 理论取向 + 掌握阶段
- 哲学深度简表

### ㉑ 右栏

检查：

- 来访者卡片（姓名 + 主诉 + 治疗阶段 + 联盟进度条）
- 督导/同行列表
- 活跃职业事件指示

### ㉒ 行动建议按钮

检查：

- 4 个按钮，不同颜色（正面/中性/谨慎/反思）
- 点击一个按钮，自动发送并触发 AI 回复

### ㉓ 存档

页面操作：

> 找到保存按钮（页面左上角或底部） → 点击 → 看到"已保存"提示

### ㉔ 读档

页面操作：

> F5 刷新页面 → 点 **"读取人生"** → 看到刚才的存档 → 点击存档

预期：状态恢复

- 聊天记录还在
- 属性数值不变
- 来访者不变
- 藏书/工具不变

### ㉕ 自动保存

等待 4 秒以上，看是否有 auto-save 日志提示。

### ㉖ 调试日志面板

页面操作：

> 找页面右下角日志面板按钮 → 点击 → 看到彩色日志流

- [ ] ⑳ 左栏属性/等级/时数显示完整
- [ ] ㉑ 右栏来访者/同行列表显示
- [ ] ㉒ 行动建议 4 按钮可点击
- [ ] ㉓ 手动存档成功
- [ ] ㉔ 读档状态完整恢复
- [ ] ㉕ 自动保存触发
- [ ] ㉖ 调试日志面板可打开

---

## 1.7 Phase 1 完成标准验收

### ㉗ 全模块加载检查

在 Console 粘贴：

```js
let checks = {
  TavernHelper: typeof TavernHelper === 'object',
  CharacterAttribute: typeof CharacterAttribute === 'object',
  DoctorLevelState: typeof DoctorLevelState === 'object',
  PhilosophyState: typeof PhilosophyState === 'object',
  PsyDoctorCreationConfig: typeof PsyDoctorCreationConfig === 'object',
  PsyTraitSamples: typeof PsyTraitSamples === 'object',
  PsychologistBaseRuntime: typeof PsychologistBaseRuntime === 'object',
  PsyDoctorWorldBook: typeof PsyDoctorWorldBook === 'object',
  PsyDoctorAiPreset: typeof PsyDoctorAiPreset === 'object',
  PsyDoctorStoryGenerate: typeof PsyDoctorStoryGenerate === 'object',
  PsyDoctorStateGenerate: typeof PsyDoctorStateGenerate === 'object',
  PsyDoctorWorldGenerate: typeof PsyDoctorWorldGenerate === 'object',
  PsyDoctorInitStateGenerate: typeof PsyDoctorInitStateGenerate === 'object',
  PsyFateChoiceController: typeof PsyFateChoiceController === 'object',
  PsyMainScreenPanel: typeof PsyMainScreenPanel === 'object',
  PsyMainScreenPanelUi: typeof PsyMainScreenPanelUi === 'object',
  PsyMainScreenChat: typeof PsyMainScreenChat === 'object',
  PsyMainScreen: typeof PsyMainScreen === 'object'
};
console.table(checks);
let allOk = Object.values(checks).every(v => v);
console.log(allOk ? '✅ 全部 18 个模块加载成功' : '❌ 有模块未加载，看上面哪些是 false');
```

预期：全部 18 个模块为 `true`

### ㉘ 连续对话稳定性

连续发送 10 条不同消息，观察：

- 是否每次都有 AI 回复
- 是否没有崩溃
- 是否没有状态解析全部失败的情况

### ㉙ Console 报错检查

整个测试过程中 Console 面板的红色错误数量。

- [ ] ㉗ 全部 18 个模块加载成功
- [ ] ㉘ 连续 10 次对话无崩溃
- [ ] ㉙ 全过程无 console 报错

---

## 测试完成

全部通过后：

1. 将本文件重命名为 `phase-1-manual-test-done.md`
2. 在 `phase-1-core.md` 中将所有已验证项标记为 `[x]`
3. 将 `phase-1-core.md` 重命名为 `phase-1-core-done.md`
