# psydoctor 开发 Schedule 总览

> 4 阶段渐进式开发计划。每个阶段独立可验证，完成后将对应文件重命名为 `phase-{N}-{name}-done.md`。

---

## 阶段总览

| 阶段 | 文件 | 目标 | 预估模块数 |
|------|------|------|-----------|
| Phase 1 | [phase-1-core.md](phase-1-core.md) | 核心框架（可玩原型） | 14 个 JS 模块 + 2 HTML + 4 CSS |
| Phase 2 | [phase-2-depth.md](phase-2-depth.md) | 心理学深度系统 | 8 个新/改模块 + 数据扩充 |
| Phase 3 | [phase-3-advanced.md](phase-3-advanced.md) | 高级机制 | 7 个新/改模块 |
| Phase 4 | [phase-4-polish.md](phase-4-polish.md) | 打磨完善 | 全模块优化 + 测试 |

---

## 阶段依赖关系

```
Phase 1 ──── 可玩原型 ──── 角色创建 + AI 对话 + 面板 + 存档
  │
  ├── Phase 2 ──── 个案引擎 + 理论体系 + 来访者 + 反移情
  │     │
  │     ├── Phase 3 ──── 伦理困境 + 理论整合 + 职业事件 + 个人体验 + 传承
  │     │     │
  │     │     └── Phase 4 ──── 移动端 + 扩展 + 调优 + 测试
  │     │
  │     └── (Phase 2 完成即可进行深度游戏体验)
  │
  └── (Phase 1 完成即可进行基础游戏体验)
```

---

## 核心文件产出清单

### Phase 1 新建文件（20 个）

```
psydoctor/
├── index.html
├── main.html
├── css/
│   ├── start_frame.css
│   ├── creation.css
│   ├── main.css
│   └── logPanel.css                         (复制)
├── silly_tarven/
│   └── bridge.js                            (复制)
└── js/
    ├── character/
    │   └── character_attribute.js           (新建)
    ├── data/
    │   ├── doctor_level.js                  (新建)
    │   ├── philosophy_state.js              (新建)
    │   ├── creation_config.js               (新建)
    │   └── trait_samples.js                 (新建)
    ├── game/
    │   └── psychologist_base_runtime.js     (新建)
    ├── ai_server/
    │   ├── world_generate.js                (新建)
    │   ├── init_state_generate.js           (新建)
    │   ├── story_generate.js                (新建)
    │   └── state_generate.js                (新建)
    ├── worldbook/
    │   ├── world_book_entries.js            (新建)
    │   ├── world_book.js                    (新建)
    │   ├── preset_content.js                (新建)
    │   ├── preset.js                        (新建)
    │   ├── state_rules.js                   (新建)
    │   └── init_state_rules.js              (新建)
    ├── ui/
    │   ├── fateChoiceController.js          (新建)
    │   ├── mainScreen.js                    (新建)
    │   ├── mainScreen_chat.js               (新建)
    │   ├── mainScreen_panel.js              (新建)
    │   └── mainScreen_panel_ui.js           (新建)
    └── log/
        └── logPanel.js                      (复制)
```

### Phase 2 新建/修改文件（8 个）

```
psydoctor/js/
├── data/
│   ├── theory_state.js                      (新建)
│   └── client_templates.js                  (新建)
├── game/
│   ├── client_character_sheet.js            (新建)
│   ├── case_session.js                      (新建)
│   └── countertransference.js               (新建)
├── worldbook/
│   ├── world_book_entries.js                (扩充 10→25+)
│   └── preset_content.js                    (扩充 3→7+ 规则预设)
├── ai_server/
│   ├── world_generate.js                    (完善 6 种教育背景)
│   └── init_state_generate.js               (完善配置模板)
└── ui/
    └── mainScreen_panel_ui.js               (新增个案/反移情 UI)
```

### Phase 3 新建/修改文件（7 个）

```
psydoctor/js/
├── game/
│   ├── ethics_dilemma.js                    (新建)
│   ├── personal_therapy.js                  (新建)
│   └── psychologist_base_runtime.js         (新增整合/职业事件功能)
├── ui/
│   └── mainScreen_panel_ui.js               (新增伦理/整合/职业/个人体验 UI)
└── js/ui/
    └── mainScreen_chat.js                   (集成伦理困境触发)
```

### Phase 4 修改文件（全模块）

```
psydoctor/
├── css/
│   ├── main.css                             (移动端适配)
│   └── creation.css                         (移动端适配)
├── js/
│   ├── worldbook/world_book_entries.js      (扩充 25+→50+)
│   ├── worldbook/preset_content.js          (调优)
│   ├── worldbook/preset.js                  (调优)
│   ├── worldbook/state_rules.js             (调优)
│   ├── ai_server/*                          (模型适配优化)
│   └── ui/*                                 (性能优化 + 边缘情况)
```

---

## 使用说明

1. **开始一个阶段前**：阅读对应 phase 文件的全部任务清单
2. **完成一个子任务**：将该行的 `- [ ]` 改为 `- [x]`
3. **一个阶段全部完成**：
   - 所有 `- [ ]` 均已变为 `- [x]`
   - 完成标准全部达成
   - 将文件重命名为 `phase-{N}-{name}-done.md`
4. **版本控制**：每个阶段完成后 commit 一次

---

*创建日期：2026-06-18*
