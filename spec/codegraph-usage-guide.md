# CodeGraph 使用指南

## 概述

CodeGraph 是一个本地优先的代码智能 CLI + MCP 服务器。它使用 tree-sitter 解析代码，将符号（函数、类、方法等）、关系（调用、导入、继承等）和文件存储到 SQLite 知识图谱中，并通过 MCP 协议暴露给 AI 编码代理（Claude Code、Cursor、Codex CLI 等）。

**版本：** v1.0.1（已安装在 `D:\APP\CodeAPP\CodeGraph`）

**核心理念：** 用预构建的语义索引替代代理的文件扫描（grep/find/Read），大幅减少 token 消耗和工具调用次数。

**基准数据：** 平均 16% 更便宜、47% 更少 token、22% 更快、58% 更少工具调用。

---

## 1. 架构概览

```
源代码文件 → ExtractionOrchestrator (tree-sitter AST解析)
                ↓
         ReferenceResolver (导入/名称匹配/框架模式解析)
                ↓
         GraphQueryManager / GraphTraverser (调用者/被调用者/影响分析)
                ↓
         ContextBuilder (Markdown/JSON 输出供 AI 消费)
```

### 数据存储

- 位置：`.codegraph/codegraph.db`（项目根目录下）
- 引擎：SQLite + FTS5 全文搜索
- WAL 模式，支持并发读

### 核心组件

| 组件 | 路径 | 职责 |
|------|------|------|
| `CodeGraph` 类 | `src/index.ts` | 公共 API，连接所有层 |
| 数据库层 | `src/db/` | `DatabaseConnection`, `QueryBuilder`, schema |
| 提取层 | `src/extraction/` | tree-sitter 封装，每种语言一个提取器 |
| 解析层 | `src/resolution/` | 引用解析、导入解析、框架路由识别 |
| 图谱层 | `src/graph/` | BFS/DFS 遍历、影响半径、路径查找 |
| 上下文层 | `src/context/` | Markdown/JSON 格式化 |
| 搜索层 | `src/search/` | FTS5 全文搜索查询解析器 |
| MCP 层 | `src/mcp/` | MCP 服务器、工具定义、传输层 |
| 同步层 | `src/sync/` | 文件监听器 (FSEvents/inotify/RDCW) |

---

## 2. 安装与配置

### 2.1 安装方式

**方式一：捆绑安装（推荐，无需 Node.js）**
```bash
# Windows PowerShell
irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex

# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
```

**方式二：npm 全局安装**
```bash
npm install -g @colbymchenry/codegraph
```

**方式三：npx（无需安装）**
```bash
npx @colbymchenry/codegraph
```

**方式四：从源码构建**
```bash
git clone https://github.com/colbymchenry/codegraph.git
cd codegraph
npm install
npm run build
npm link
```

### 2.2 配置代理（关键步骤）

```bash
codegraph install
```

此命令会：
1. 询问要配置哪些代理 — 自动检测已安装的：Claude Code、Cursor、Codex CLI、opencode、Hermes Agent、Gemini CLI、Antigravity IDE、Kiro
2. 提示将 `codegraph` 安装到 PATH
3. 询问是全局配置还是仅当前项目
4. 为每个代理写入 MCP 服务器配置和指令文件标记

**非交互模式：**
```bash
codegraph install --yes                              # 自动检测、全局安装
codegraph install --target=cursor,claude --yes       # 指定目标
codegraph install --target=auto --location=local     # 项目本地
codegraph install --print-config claude               # 仅打印配置片段
```

**卸载代理配置：**
```bash
codegraph uninstall
```

### 2.3 手动配置（参考）

**Claude Code (`~/.claude.json`)：**
```json
{
  "mcpServers": {
    "codegraph": {
      "type": "stdio",
      "command": "codegraph",
      "args": ["serve", "--mcp"]
    }
  }
}
```

**权限自动允许 (`~/.claude/settings.json`)：**
```json
{
  "permissions": {
    "allow": [
      "mcp__codegraph__codegraph_search",
      "mcp__codegraph__codegraph_explore",
      "mcp__codegraph__codegraph_callers",
      "mcp__codegraph__codegraph_callees",
      "mcp__codegraph__codegraph_impact",
      "mcp__codegraph__codegraph_node",
      "mcp__codegraph__codegraph_status",
      "mcp__codegraph__codegraph_files"
    ]
  }
}
```

---

## 3. 项目管理

### 3.1 初始化项目

```bash
cd your-project
codegraph init
```

创建 `.codegraph/` 目录并构建完整索引。索引完成后自动开启文件监听。

**参数：**
- `-f, --force`：即使路径看起来像家目录或根目录也强制初始化
- `-v, --verbose`：显示详细的 worker 生命周期和内存信息

### 3.2 移除项目索引

```bash
codegraph uninit [path]
```

**参数：**
- `-f, --force`：跳过确认提示

### 3.3 重建索引

```bash
codegraph index [path]
```

**参数：**
- `-f, --force`：强制重新索引
- `-q, --quiet`：减少输出
- `-v, --verbose`：详细输出

### 3.4 增量同步

```bash
codegraph sync [path]
```

**参数：**
- `-q, --quiet`：静默模式（用于 git hooks）

### 3.5 查看状态

```bash
codegraph status [path]
```

**参数：**
- `-j, --json`：JSON 格式输出

### 3.6 解锁

```bash
codegraph unlock [path]
```

移除阻止索引的陈旧锁文件。

---

## 4. CLI 命令详解

### 4.1 符号搜索 — `codegraph query`

```bash
codegraph query <search> [options]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-p, --path <path>` | 项目路径 | 当前目录 |
| `-l, --limit <number>` | 最大结果数 | 10 |
| `-k, --kind <kind>` | 按节点类型过滤 | 无 |
| `-j, --json` | JSON 格式输出 | false |

**支持的节点类型（NodeKind）：**
`file`, `module`, `class`, `struct`, `interface`, `trait`, `protocol`, `function`, `method`, `property`, `field`, `variable`, `constant`, `enum`, `enum_member`, `type_alias`, `namespace`, `parameter`, `import`, `export`, `route`, `component`

### 4.2 区域探索 — `codegraph explore`

```bash
codegraph explore <query...> [options]
```

最主要的工具。一次调用返回相关符号的源代码（按文件分组）+ 调用路径。等同于 MCP 工具 `codegraph_explore`。

| 选项 | 说明 |
|------|------|
| `-p, --path <path>` | 项目路径 |
| `--max-files <number>` | 包含源文件的最大数量 |

### 4.3 符号详情 — `codegraph node`

```bash
codegraph node <name> [options]
```

单个符号的源代码 + 调用者/被调用者轨迹，或者以行号读取文件。等同于 MCP 工具 `codegraph_node`。

| 选项 | 说明 |
|------|------|
| `-p, --path <path>` | 项目路径 |
| `-f, --file <file>` | 文件模式（或消除符号歧义） |
| `--offset <number>` | 文件模式：1-based 起始行 |
| `--limit <number>` | 文件模式：最大行数 |
| `--symbols-only` | 文件模式：仅符号映射 + 依赖者 |

### 4.4 调用者查询 — `codegraph callers`

```bash
codegraph callers <symbol> [options]
```

查找调用指定符号的所有函数/方法（包括回调注册位置）。

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-p, --path <path>` | 项目路径 | 当前目录 |
| `-l, --limit <number>` | 最大结果数 | 20 |
| `-j, --json` | JSON 格式 | false |

### 4.5 被调用者查询 — `codegraph callees`

```bash
codegraph callees <symbol> [options]
```

查找指定符号所调用的所有函数/方法。

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-p, --path <path>` | 项目路径 | 当前目录 |
| `-l, --limit <number>` | 最大结果数 | 20 |
| `-j, --json` | JSON 格式 | false |

### 4.6 影响分析 — `codegraph impact`

```bash
codegraph impact <symbol> [options]
```

分析更改某个符号会影响哪些代码。

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-p, --path <path>` | 项目路径 | 当前目录 |
| `-d, --depth <number>` | 遍历深度 | 2 |
| `-j, --json` | JSON 格式 | false |

### 4.7 受影响的测试 — `codegraph affected`

```bash
codegraph affected [files...] [options]
```

查找受源代码更改影响的测试文件。追踪导入依赖传递性。

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--stdin` | 从 stdin 读取文件列表 | false |
| `-d, --depth <number>` | 最大依赖遍历深度 | 5 |
| `-f, --filter <glob>` | 自定义测试文件 glob | 自动检测 |
| `-j, --json` | JSON 格式 | false |
| `-q, --quiet` | 仅输出文件路径 | false |

**CI/Git Hook 示例：**
```bash
# 通过参数
codegraph affected src/utils.ts src/api.ts

# 从 git diff 管道
git diff --name-only HEAD | codegraph affected --stdin --quiet

# 自定义测试文件模式
codegraph affected src/auth.ts --filter "e2e/*.spec.ts"

# CI 集成示例
#!/usr/bin/env bash
AFFECTED=$(git diff --name-only HEAD | codegraph affected --stdin --quiet)
if [ -n "$AFFECTED" ]; then
  npx vitest run $AFFECTED
fi
```

### 4.8 文件结构 — `codegraph files`

```bash
codegraph files [options]
```

显示索引中的项目文件结构。

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-p, --path <path>` | 项目路径 | 当前目录 |
| `--filter <dir>` | 仅显示此目录下的文件 | 无 |
| `--pattern <glob>` | 匹配 glob 模式的文件 | 无 |
| `--format <format>` | 输出格式 (tree, flat, grouped) | tree |
| `--max-depth <number>` | tree 格式的最大深度 | 无限制 |
| `--no-metadata` | 隐藏文件元数据 | false |
| `-j, --json` | JSON 格式 | false |

### 4.9 守护进程管理 — `codegraph daemon`

```bash
codegraph daemon
```

管理运行中的后台守护进程 — 选择一个并回车停止。

### 4.10 升级 — `codegraph upgrade`

```bash
codegraph upgrade [version] [options]
```

| 选项 | 说明 |
|------|------|
| `--check` | 仅检查是否有更新可用 |
| `-f, --force` | 即使已是最新版本也重新安装 |

### 4.11 遥测 — `codegraph telemetry`

```bash
codegraph telemetry [on|off|status]
```

管理匿名使用遥测。

### 4.12 版本 — `codegraph version`

```bash
codegraph version   # 或 -v, --version
```

---

## 5. MCP 工具详解

当以 MCP 服务器运行时，CodeGraph 暴露以下工具给 AI 代理：

### 5.1 主要工具（默认启用）

| 工具 | 用途 | 使用场景 |
|------|------|----------|
| `codegraph_explore` | **主要工具。** 一次调用回答几乎任何问题 — 返回相关符号的逐字源代码（按文件分组）+ 关系图 + 影响范围 | "X 如何工作"、架构问题、流程追踪、区域调查 |
| `codegraph_node` | 单个符号的源代码 + 调用者/被调用者轨迹；也可替代 Read 工具读取文件（带行号） | 深入了解特定符号、读取源文件 |
| `codegraph_search` | 按名称跨代码库搜索符号 | 快速定位符号位置 |
| `codegraph_callers` | 列出每个调用点（包括回调注册），按定义分组 | "谁调用了这个？"、重构规划 |

### 5.2 隐藏工具（默认不列出，可启用）

| 工具 | 用途 |
|------|------|
| `codegraph_callees` | 查找符号调用了什么 |
| `codegraph_impact` | 影响范围分析 |
| `codegraph_files` | 文件结构 |
| `codegraph_status` | 索引状态 |

通过环境变量重新启用：
```bash
CODEGRAPH_MCP_TOOLS=explore,node,search,callers,impact
```

### 5.3 MCP 代理指令（核心行为指导）

MCP 服务器在 `initialize` 响应中自动发送使用指导给代理。核心原则：

**工具选择意图：**
- 几乎任何问题 → `codegraph_explore`（首选）
- "X 如何到达 Y？" → `codegraph_explore`（命名符号）
- "X 是什么？"（仅定位）→ `codegraph_search`
- "谁调用了这个？" → `codegraph_callers`（包括回调注册）
- "这个调用了什么？" → `codegraph_node`（包括代码）
- 读取源文件 → `codegraph_node`（替代 Read 工具）
- 准备编辑 → `codegraph_node`（获取源代码 + 影响范围）

**反模式（要避免）：**
1. 不要用 grep 验证 codegraph 结果 — 它们来自完整 AST 解析
2. 不要先 grep — `codegraph_search` 更快
3. 不要链式调用 `codegraph_search` + `codegraph_node` — 一次 `codegraph_explore` 即可
4. 不要循环 `codegraph_node` 处理多个符号 — 一次 `codegraph_explore` 全部返回
5. 不要在已索引的源文件上使用 `Read` 工具 — 用 `codegraph_node` + `file` 参数
6. 编辑后检查陈旧性横幅 — 标记为待重新索引的文件需要直接 Read

**常见调用链：**
- 流程追踪：一次 `codegraph_explore`（带符号名）
- 入门理解区域：一次 `codegraph_explore` 通常足够
- 重构规划：`codegraph_callers`（完整调用点列表）
- 调试回归：可疑符号的 `codegraph_callers` + 意外符号的 `codegraph_node`

---

## 6. 自动同步机制

### 6.1 三层保鲜机制

1. **文件监听器 + 防抖自动同步**
   - 原生 OS 文件事件（FSEvents / inotify / ReadDirectoryChangesW）
   - 防抖窗口：默认 2000ms，可通过 `CODEGRAPH_WATCH_DEBOUNCE_MS` 调整（范围 [100ms, 60s]）
   - 编辑爆裂自动合并为单次同步

2. **每文件陈旧性横幅**
   - 防抖窗口期间，引用待处理文件的 MCP 响应前缀 `⚠️` 横幅
   - 告知代理直接 `Read` 那些文件

3. **连接时追赶**
   - MCP 服务器重连时，先运行 `(size, mtime)` + 内容哈希核对
   - 吸收离线期间的编辑（git pull、其他编辑器修改等）

### 6.2 验证

```bash
codegraph status                    # CLI
codegraph_status                    # MCP
```

如果有待处理文件，会显示 `### Pending sync:` 部分。

---

## 7. 框架感知路由

CodeGraph 检测 Web 框架路由文件，生成 `route` 节点并通过 `references` 边连接到处理函数。

| 框架 | 识别模式 |
|------|----------|
| **Django** | `path()`, `re_path()`, `url()`, `include()` in `urls.py` |
| **Flask** | `@app.route('/path', methods=[...])`, blueprint 路由 |
| **FastAPI** | `@app.get(...)`, `@router.post(...)` |
| **Express** | `app.get(...)`, `router.post(...)` + 中间件链 |
| **NestJS** | `@Controller` + `@Get/@Post/...`, GraphQL `@Resolver`, `@MessagePattern` |
| **Laravel** | `Route::get()`, `Route::resource()`, `Controller@action` |
| **Drupal** | `*.routing.yml`, `hook_*` 实现 |
| **Rails** | `get '/x', to: 'users#index'` |
| **Spring** | `@GetMapping`, `@PostMapping`, `@RequestMapping` |
| **Play** | `conf/routes` GET/POST 路由 |
| **Gin / chi / gorilla / mux** | `r.GET(...)`, `router.HandleFunc(...)` |
| **Axum / actix / Rocket** | `.route("/x", get(handler))` |
| **ASP.NET** | `[HttpGet("/x")]` 属性 |
| **Vapor** | `app.get("x", use: handler)` |
| **React Router / SvelteKit** | 路由组件节点 |
| **Vue Router / Nuxt** | `pages/` 文件路由, `server/api/` 端点 |
| **Astro** | `src/pages/` 文件路由 |

---

## 8. 跨语言桥接（iOS / React Native / Expo）

真实 iOS/RN 代码库跨越多种语言。CodeGraph 连接跨语言边界。

| 边界 | JS/Swift 侧 | Native 侧 | 机制 |
|------|------------|-----------|------|
| **Swift → ObjC** | `obj.foo(bar:)` | `-fooWithBar:` | `@objc` 自动桥接规则 |
| **ObjC → Swift** | `[obj fooWithBar:]` | `@objc func foo(bar:)` | 反向桥接 + `@objc` 验证 |
| **RN 传统桥** | `NativeModules.X.fn(...)` | `RCT_EXPORT_METHOD` | 宏/注解声明解析 |
| **RN TurboModules** | `import M from './NativeM'` | Native 实现 | Codegen spec 作为依据 |
| **RN native → JS 事件** | `new NativeEventEmitter(...)` | `sendEventWithName:` | 合成跨语言事件通道 |
| **Expo Modules** | `requireNativeModule('X')` | `Module { Name("X") }` | Expo DSL 文字量解析 |
| **Fabric 视图组件** | `<MyView prop={v}/>` | TS Codegen spec + native 类 | 约定命名查找 |
| **Paper 视图管理器** | `<MyView prop={v}/>` | `RCT_EXPORT_VIEW_PROPERTY` | 同 Fabric |

每条桥接边标记 `provenance: 'heuristic'` + `metadata.synthesizedBy: <通道名>`。

---

## 9. 支持的编程语言

| 语言 | 扩展名 | 支持级别 |
|------|--------|----------|
| TypeScript | `.ts`, `.tsx` | 完整 |
| JavaScript | `.js`, `.jsx`, `.mjs` | 完整 |
| Python | `.py` | 完整 |
| Go | `.go` | 完整 |
| Rust | `.rs` | 完整 |
| Java | `.java` | 完整 |
| C# | `.cs` | 完整 |
| PHP | `.php` | 完整 |
| Ruby | `.rb` | 完整 |
| C | `.c`, `.h` | 完整 |
| C++ | `.cpp`, `.hpp`, `.cc` | 完整 |
| Objective-C | `.m`, `.mm`, `.h` | 部分（类、协议、方法、`@property`、`#import`、消息发送） |
| Swift | `.swift` | 完整 |
| Kotlin | `.kt`, `.kts` | 完整 |
| Scala | `.scala`, `.sc` | 完整 |
| Dart | `.dart` | 完整 |
| Svelte | `.svelte` | 完整 |
| Vue | `.vue` | 完整 |
| Astro | `.astro` | 完整 |
| Liquid | `.liquid` | 完整 |
| Pascal / Delphi | `.pas`, `.dpr`, `.dpk`, `.lpr` | 完整 |
| Lua | `.lua` | 完整 |
| R | `.R`, `.r` | 完整 |
| Luau | `.luau` | 完整 |

---

## 10. 图谱数据模型

### 10.1 节点类型（NodeKind）

```
file | module | class | struct | interface | trait | protocol |
function | method | property | field | variable | constant |
enum | enum_member | type_alias | namespace | parameter |
import | export | route | component
```

### 10.2 边类型（EdgeKind）

| 类型 | 含义 |
|------|------|
| `contains` | 包含关系（file→class, class→method） |
| `calls` | 函数/方法调用 |
| `imports` | 文件导入 |
| `exports` | 文件导出符号 |
| `extends` | 继承 |
| `implements` | 接口实现 |
| `references` | 通用引用（含 value-ref 边） |
| `type_of` | 变量/参数类型 |
| `returns` | 函数返回类型 |
| `instantiates` | 类实例化 |
| `overrides` | 方法重写 |
| `decorates` | 装饰器 |

### 10.3 数据库表结构

**nodes 表：**
`id`, `kind`, `name`, `qualified_name`, `file_path`, `language`, `start_line`, `end_line`, `start_column`, `end_column`, `docstring`, `signature`, `visibility`, `is_exported`, `is_async`, `is_static`, `is_abstract`, `decorators` (JSON), `type_parameters` (JSON), `return_type`, `updated_at`

**edges 表：**
`id`, `source`, `target`, `kind`, `metadata` (JSON), `line`, `col`, `provenance`

**files 表：**
`path`, `content_hash`, `language`, `size`, `modified_at`, `indexed_at`, `node_count`, `errors` (JSON)

**nodes_fts (FTS5 虚拟表)：**
全文搜索索引，覆盖 `name`, `qualified_name`, `docstring`, `signature`

---

## 11. 环境变量配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CODEGRAPH_DIR` | 自定义索引目录名 | `.codegraph` |
| `CODEGRAPH_NO_DAEMON` | 设为 `1` 禁用守护进程模式 | 关闭 |
| `CODEGRAPH_NO_WATCH` | 设为 `1` 禁用文件监听 | 关闭 |
| `CODEGRAPH_WATCH_DEBOUNCE_MS` | 文件变更防抖毫秒数 | 2000 |
| `CODEGRAPH_MAX_DIR_WATCHES` | 最大目录监听数 | 系统默认 |
| `CODEGRAPH_DAEMON_IDLE_TIMEOUT_MS` | 守护进程空闲超时 | 300000 (5分钟) |
| `CODEGRAPH_DAEMON_MAX_IDLE_MS` | 守护进程最大空闲时间 | 可配置 |
| `CODEGRAPH_PPID_POLL_MS` | 父进程轮询间隔 | 内部默认 |
| `CODEGRAPH_MCP_TOOLS` | 自定义 MCP 工具列表 | 默认四个主要工具 |
| `CODEGRAPH_MCP_DEBUG` | MCP 调试日志 | 关闭 |
| `CODEGRAPH_MCP_LOG_ATTACH` | MCP 日志附件 | 关闭 |
| `CODEGRAPH_EXPLORE_LINENUMS` | explore 输出行号（`0` 禁用） | 启用 |
| `CODEGRAPH_ADAPTIVE_EXPLORE` | 自适应 explore 大小（`0` 禁用） | 启用 |
| `CODEGRAPH_VALUE_REFS` | value-ref 边（`0` 禁用） | 启用 |
| `CODEGRAPH_TELEMETRY` | 遥测开关（`0` 禁用） | 询问用户 |
| `CODEGRAPH_NO_WATCHDOG` | 设为 `1` 禁用心跳看门狗 | 关闭 |
| `CODEGRAPH_WATCHDOG_TIMEOUT_MS` | 看门狗超时 | 内部默认 |
| `CODEGRAPH_DEBUG` | 通用调试日志 | 关闭 |
| `CODEGRAPH_ASCII` | 设为 `1` 强制 ASCII 输出 | 关闭 |
| `CODEGRAPH_UNICODE` | 设为 `1` 强制 Unicode 输出 | Windows 默认 |
| `CODEGRAPH_WASM_RELAUNCHED` | WASM 重启动标记（内部） | — |
| `CODEGRAPH_HOST_PPID` | 宿主父进程 PID（内部） | — |
| `CODEGRAPH_DAEMON_INTERNAL` | 守护进程模式标记（内部） | — |
| `CODEGRAPH_VERSION` | 固定升级版本 | 最新 |
| `CODEGRAPH_INSTALL_DIR` | 安装目录 | 自动检测 |
| `CODEGRAPH_RESOLVER_CACHE_SIZE` | 解析器缓存大小 | 内部默认 |

---

## 12. 排除规则（零配置）

默认排除以下内容，无需配置：
- 依赖/构建/缓存目录：`node_modules`, `vendor`, `dist`, `build`, `target`, `.venv`, `Pods`, `.next` 等
- `.gitignore` 中的所有内容
- 大于 1MB 的文件

要额外排除，添加到 `.gitignore`。要重新包含默认排除的目录，添加 `!vendor/`。

---

## 13. 库使用（程序化 API）

```typescript
import CodeGraph from '@colbymchenry/codegraph';

// 初始化或打开
const cg = await CodeGraph.init('/path/to/project');
// 或: const cg = await CodeGraph.open('/path/to/project');

// 索引
await cg.indexAll({
  onProgress: (p) => console.log(`${p.phase}: ${p.current}/${p.total}`)
});

// 搜索
const results = cg.searchNodes('UserService');

// 调用者
const callers = cg.getCallers(results[0].node.id);

// 构建上下文
const context = await cg.buildContext('fix login bug', {
  maxNodes: 20,
  includeCode: true,
  format: 'markdown'
});

// 影响半径
const impact = cg.getImpactRadius(results[0].node.id, 2);

// 文件监听
cg.watch();   // 开启自动同步
cg.unwatch(); // 停止监听
cg.close();   // 关闭

// 低级模块（同一入口导出）
// DatabaseConnection, QueryBuilder, getDatabasePath,
// initGrammars / loadGrammarsForLanguages, FileLock
```

**嵌入要求：** Node 22.5+（需要内置 `node:sqlite`），通过 npm 安装。

---

## 14. 支持的平台和代理

### 平台
| 平台 | 架构 |
|------|------|
| Windows | x64, arm64 |
| macOS | x64, arm64 |
| Linux | x64, arm64 |

### 代理
- Claude Code
- Cursor
- Codex CLI
- opencode
- Hermes Agent
- Gemini CLI
- Antigravity IDE
- Kiro

---

## 15. 故障排除

### "CodeGraph not initialized"
运行 `codegraph init`。

### 索引太慢
检查 `node_modules` 等大目录是否被排除。使用 `--quiet` 减少输出。

### MCP "database is locked"
- 旧版本（<0.9）：重新安装最新版
- `codegraph status` 显示 `Journal: wal` 以外：WAL 无法启用（常见于网络共享和 WSL2 `/mnt`），将项目移到本地磁盘

### MCP 服务器不连接
- 确保项目已初始化（`codegraph status`）
- 重新运行 `codegraph install` 重写配置
- 重启代理

### 缺失符号
- MCP 服务器在保存几秒后自动同步
- 手动运行 `codegraph sync`
- 检查文件语言是否支持，是否在排除目录中

### Windows 和 WSL 共享一个检出版本
不要同时指向同一个 `.codegraph/`（锁和 SQLite 绑定到写入的 OS，跨 WSL2/Windows 文件系统边界不可靠）。

**解决方法：** 在一侧设置不同的 `CODEGRAPH_DIR`：
```bash
# Windows 上
set CODEGRAPH_DIR=.codegraph-win

# WSL 上保持默认 .codegraph
```

---

## 16. 最佳实践

1. **全局安装 + 每项目初始化：** 一次 `codegraph install`（全局），每个项目 `codegraph init`
2. **先用 explore 再用 node：** 探索用 `codegraph_explore`，深入特定符号用 `codegraph_node`
3. **相信 codegraph 结果：** 不要用 grep/Read 重新验证
4. **编辑后检查陈旧性横幅：** 标有 `⚠️` 的文件尚未重新索引，直接 Read
5. **CI 集成：** 使用 `codegraph affected --stdin` 只运行受影响的测试
6. **自动同步已开启：** 无需手动运行 `codegraph sync`（除非在沙箱环境或脚本中）
7. **不要手动启动 MCP 服务器：** 代理会自动启动
