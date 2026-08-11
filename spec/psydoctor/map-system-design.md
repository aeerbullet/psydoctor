# psydoctor（心理医生成长记）地图系统与页面解耦设计方案

> 设计目标：将三栏一屏的高密度信息按"空间逻辑"重新组织为**地图系统 + 地点专职页面**，减轻玩家认知负担、增强代入感。本文档为方案留档，记录信息架构、地点划分、背景图映射与 AI 生图 prompt。对应排期：页面解耦（地图系统）。

---

## 1. 背景与问题

### 1.1 现状

当前主界面（`main.html`）为"三栏一屏"：

- **左栏**：等级、临床时数、督导/个人时数、理论取向、8+2 属性、哲学深度、反移情、疲劳、藏书、治疗工具（8+ 类信息）
- **中栏**：叙事聊天区（核心玩法）+ 输入框
- **右栏**：来访者列表、督导师/同行、职业事件

### 1.2 问题

1. 玩家需同时盯十几个指标，认知负担重
2. 信息与叙事混杂，缺乏"我在某个地方工作/生活"的空间感
3. `currentLocation` / `currentWorkplace` 仅作为存档字符串存在，UI 上无任何地点呈现
4. 代入感弱——无场景、无空间锚点

### 1.3 设计原则

1. **信息随场景走**：玩家"去哪"就只看到"哪"相关的面板，其余收进对应地点页
2. **不拆细**：仅 4 个核心地点 + 1 个地图枢纽，不按"藏书/哲学/理论"细分页面
3. **叙事是主线**：中央聊天/叙事区全程保留，仅背景图随地点切换
4. **地点选择 = 游戏行为**：每个地点有专属动作与消耗，选择有意义而非纯装饰
5. **代入感**：每个地点一张背景图，风格统一（深绿 × 粉红点缀 × 暗调绘画感）

---

## 2. 信息架构

```
顶栏（全局常驻，一行）：世界时间 | 地点名 | 等级 | 疲劳● | 反移情● | 【地图】【角色档案】
┌──────────────────────────────────────────────────────────┐
│  地图枢纽（默认落点）：4 个发光地点节点 + 各节点待办角标     │
│    咨询室③   书房④   督导室⑤   城市①                     │
├──────────────────────────────────────────────────────────┤
│  中央叙事区（始终存在）：聊天记录 + 输入框 + 发送            │
│  背景图 = 当前地点的背景（沉浸感来源）                      │
└──────────────────────────────────────────────────────────┘
点击地点 → 切背景图 + 只显示该地点侧边面板 → 叙事区保留
点击顶栏【地图】→ 返回枢纽
```

### 2.1 全局常驻 vs 地点专属

| 信息 | 归属 |
|---|---|
| 世界时间、等级、地点名 | 顶栏（全局） |
| 疲劳度、反移情风险 | 顶栏紧凑指示（点击看详情） |
| 8+2 核心属性 | 顶栏"角色档案"弹层（点开才看） |
| 来访者/个案/工具/反移情详情 | 咨询室 |
| 理论/哲学/藏书/个人体验 | 书房 |
| 督导/职业事件/伦理/晋升 | 督导室 |
| 周围人物/社区/工作场所 | 城市 |
| 聊天/叙事/输入框 | 全程保留（核心） |

---

## 3. 地点详设

| 地点 | 专职 | 面板归入 | 专属动作 | 消耗/收益 |
|---|---|---|---|---|
| 🛋 **咨询室** | 核心临床 | 来访者列表、个案会话进度+干预按钮、治疗工具、咨询室布置、反移情详情、临床时数 | 开始/继续咨询 | 消耗疲劳，获临床时数，可触发个案/伦理/反移情 |
| 📚 **书房** | 学习+自我恢复 | 理论掌握、哲学深度、藏书、个人体验时数、疲劳恢复 | 读书、写咨询日志、自我关照 | 提升理论/哲学，降低疲劳/反移情 |
| 👥 **督导室** | 职业支持 | 督导师/同行、督导记录、督导时数、职业事件、伦理困境入口、等级晋升 | 接受督导、处理职业事件 | 降低反移情风险，推进职业线 |
| 🌆 **城市** | 人际+社区 | 周围人物、社区来访者、换工作场景入口 | 社交、社区义诊、申请换工作场所 | 连接社会环境，对应等级→场所演化 |

### 3.1 地图枢纽（Home）

- 默认落点，4 个节点 + 待办角标（咨询室来访者数、督导室未处理事件数、书房未读理论洞见等）
- 角标即"我要去哪"的天然引导，替代已删除的 AI 建议按钮
- 顶部当日概览：时间/天气/健康度提示

---

## 4. 背景图资源映射

图片存放目录：`image/`（游戏根目录下）

| 地点 | 图片文件 | 用途 |
|---|---|---|
| 地图枢纽 | `image/地图.png` | 地图页背景（夜色城市俯瞰） |
| 咨询室 | `image/咨询室.png` | 咨询室页背景 |
| 书房 | `image/书房.png` | 书房页背景 |
| 督导室 | `image/督导室.png` | 督导室页背景 |
| 城市街道 | `image/城市街道.png` | 城市页背景 |

---

## 5. AI 生图 Prompt（留档）

### 5.1 统一风格锚点（每张 prompt 都带）

> Deep emerald green palette, pink accent lighting, dark moody painterly style, stylized game background illustration, cinematic lighting, soft grain, no people, no readable text, negative space reserved for UI panels

### 5.2 各地点 Prompt

**1. 地图总览（地图.png）**

> Overhead night city map of a psychology-themed life sim, stylized game map with 4 glowing location nodes (private clinic, university library, supervision office, community street), deep emerald green palette with pink neon accent lights, dark moody painterly background illustration, wide cinematic composition, calm negative space in the center for UI, no people, no readable text

**2. 咨询室（咨询室.png）**

> A warm private psychotherapy consulting room at dusk, amber floor lamp, two leather armchairs facing each other, low side table with a tissue box, potted plant, bookshelf, deep green walls, soft pink-gold accent light through venetian blinds, intimate calming atmosphere, cinematic depth, space on the left empty for UI panels, no people, no readable text

**3. 书房（书房.png）**

> Quiet university library reading corner at night, warm desk lamp over an open book, tall wooden bookshelves of psychology classics, large window with distant city lights, deep green and amber palette with subtle pink moonlight accent, contemplative cozy atmosphere, cinematic, empty area for UI, no people, no readable text

**4. 督导室（督导室.png）**

> Professional clinical supervision office in warm afternoon light, two chairs facing a whiteboard with brief case diagrams, wooden desk with supervision notebooks, large window, deep green walls with soft pink fabric accents, trustworthy supportive atmosphere, cinematic, UI-safe empty space, no people, no readable text

**5. 城市街道（城市街道.png）**

> Quiet community street at night, warmly lit counseling center entrance with a soft green sign, golden street lamps, pink neon glow reflecting on wet asphalt, cozy apartment buildings in the background, deep emerald night palette, atmospheric painterly background, cinematic wide shot, empty space for UI, no people, no readable text

---

## 6. 落地方向（后续实施改动面）

- **数据层**：`G` 增加 `locationMap`（4 地点状态 + 背景图引用 + 待办摘要）；复用现有 `currentLocation`/`currentWorkplace`；新增"地点→sceneType"映射
- **UI 层**：新增 `PsyMainScreenMapUi`（地图页渲染）；按地点重组 `renderLeftPanel`/`renderRightPanel` 为按地点分发；顶栏新增地图/角色档案入口；背景图 CSS 层
- **AI 层**：地点名与背景注入叙事 prompt；地点切换触发对应 sceneType 叙事开场
- **移动端**：地图点选天然适配

## 7. 边界

- 不拆到"每本书/每维度一页"
- 不做真实地图导航/寻路，仍是"选择即进入"
- 不做多存档位改动，存档结构向后兼容（新增字段给默认值即可）
