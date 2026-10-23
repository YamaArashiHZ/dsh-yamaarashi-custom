# dsh-yamaarashi-custom 开发规范

> 本文档是插件的**权威开发规范**；`.docs/HANDOFF.md`（最初的交接/调研文档）是作者本机的历史文档，**不随仓库分发**，
> 与本文档冲突时以本文档为准。
> 本文档由工作区根目录 [`AGENTS.md`](../AGENTS.md) 引用：DSH 会在每个会话自动加载 AGENTS.md，并要求动手前先读本文档。
> 规范本身要改时：直接改本文件 + 同步 AGENTS.md 里的硬约束摘要（两者必须一致）。

> 下文出现的 `/home/yamaarashi/...`、`/mnt/d/...` 等路径是**作者本机环境**，仅作参考；请替换成你自己的 DSH 检出与仓库路径。

- 基线：DSH `0.2.1-rc.2`（Web GUI，WSL2 下运行；本机源码检出路径见 `AGENTS.local.md`）。
- 本机没有全局 `dsh`：命令统一走 `<DSH 源码检出>/pnpm dsh ...`。
- 用户偏好：中文沟通、tgz 安装、数字项用「滑条 + 数字框」、立绘作为背景层铺在所有 UI 下方（含滚动条）、插件整体名保持不变而组件各自命名。

---

## 1. 架构：插件壳 + 组件包

```
dsh-yamaarashi-custom/
├── package.json                           组件包 1：@yamaarashihz/dsh-yamaarashi-dafeiyu 0.3.1（大肥鱼探头）
├── src/index.ts                           host Config（schema、默认值、volatile）
├── src/client/                            客户端 bundle 源码（背景层、设置页、锚点）
├── locale/{zh,en}.json                    组件显示名 / 描述
├── assets/                                图标与内联图片资源
├── scripts/embed-assets.mjs               资源 → src/client/generated/assets.ts
├── tsdown.config.ts                       DSH 客户端 bundle 协议（banner/footer）
├── README.md / AGENTS.md / LICENSE
├── tests/                                 回归脚本（npm test；CI 也跑）
├── .github/workflows/ci.yml               GitHub Actions
├── AGENTS.local.md                        本机环境补充（.gitignore 忽略，不入库）
├── .docs/DEVELOPMENT.md（本文件）、.docs/HANDOFF.md（本机历史文档，不入库）
├── packages/deepseek-balance/             组件包 2：@yamaarashihz/dsh-yamaarashi-deepseek-balance 0.3.0（DeepSeek 用量卡片）
│   ├── package.json / tsconfig.json / tsdown.config.ts
│   ├── src/index.ts                       host Config + 同源路由（余额 / 今日分时用量 / 凭证）
│   ├── src/shared.ts                      host/client 共享类型与常量
│   ├── src/host/                          数据源、HTTP 守卫、路由、缓存
│   ├── src/client/                        侧栏卡片（DOM 注入 + portal + SVG 图）+ 行配置页
│   ├── locale/{zh,en}.json                组件显示名 / 描述
│   └── assets/deepseek-balance.svg        组件行图标
└── bundle/                                插件壳：@yamaarashihz/dsh-yamaarashi-custom 0.9.1
    ├── package.json                       dsh.bundle.patch、icon、engines
    ├── cordis.patch.yml                   一行一个组件（scroll）
    ├── locale/{zh,en}.json                插件整体名
    └── assets/mascot-512.webp
```

| 角色 | 中文名 | 谁能改 | 内容 |
|---|---|---|---|
| 插件壳 `bundle/` | **DSH 个性化定制** | 很少动（加组件时 +1 行） | patch、locale、图标；**无运行代码** |
| 组件包 1（根目录） | **大肥鱼探头** | 立绘相关改动 | host Config + client bundle + locale + 图标 |
| 组件包 2（`packages/deepseek-balance/`） | **DeepSeek 用量卡片** | 卡片相关改动 | host 凭据路由 + client 卡片/配置页 + locale + 图标 |

### 为什么必须是两个包（DSH 机制依据）

- 插件（bundle）标题：Host 用**包名**调用 `readPluginMeta(包名)` 读取 `locale/*.json` 的 `meta.title`
  （`packages/boot/plugin-manager/src/index.ts:369`）。
- 「包含的组件」行标题：Host 用**行的模块名**调用 `metaOf(row.name)`（`packages/boot/plugin-manager/src/index.ts:743`）。
- 客户端插件只认**裸包名**的行（`packages/client/modules/src/index.ts` 的 `resolveMeta` / `locatePkgJson`：
  子路径 specifier 的 `resolveMeta` 返回 null，即“permanently not a client row”）。
- 因此：单包时 bundle 名与 row 名同源、无法不同；要做到“插件名 ≠ 组件名”，必须让 row 指向另一个包，
  那个包就是组件包。

---

## 2. 壳包（`bundle/`）规范

1. `package.json`：
   ```jsonc
   {
     "name": "@yamaarashihz/dsh-yamaarashi-custom",
     "version": "0.7.0",
     "private": true,
     "icon": "assets/mascot-512.webp",
     "exports": { "./locale/*.json": "./locale/*.json", "./package.json": "./package.json" },
     "files": ["cordis.patch.yml", "locale/*.json", "assets/mascot-512.webp"],
     "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
     "engines": { "dsh": ">=0.2.1-rc.2 <0.3.0" }
   }
   ```
   壳包**没有** `main` / `dsh.client` / 运行代码，不要加。
2. `cordis.patch.yml` 一行一个组件，`name` 必须是组件包的**裸包名**：
   ```yaml
   - insert:
       - id: dafeiyu                    # 稳定 row id = 组件配置命名空间
         name: '@yamaarashihz/dsh-yamaarashi-dafeiyu'
   ```
   行 id 一旦发布不可改；新增组件**追加**，不要复用 id。
3. `locale/zh.json` 的 `meta.title` 是插件整体名（保持「DSH 个性化定制」），`en.json` 是英文回退。
4. 壳包版本规则：**行有增减/改名时**才升 minor/major；只改组件代码升组件包版本，壳包不动。
5. 壳包无构建步骤：`cd bundle && npm pack` 即可（`npm run pack:bundle`）。

---

## 3. 组件包规范

### 3.1 package.json

```jsonc
{
  "name": "@yamaarashihz/dsh-yamaarashi-dafeiyu",
  "version": "0.3.1",
  "private": true,
  "icon": "assets/mascot-512.webp",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./locale/*.json": "./locale/*.json",
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js", "lib/client*.js", "lib/client*.js.map", "lib/types/**/*.d.ts",
            "assets/mascot-512.webp", "locale/*.json"],
  "dsh": { "client": { "platform": "web" } },        // 注意：没有 dsh.bundle
  "engines": { "dsh": ">=0.2.1-rc.2 <0.3.0", "node": "^22.19.0 || >=24.0.0" },
  "dependencies": { "@deepseek-ai/schemastery": "3.18.5" }
}
```

- `dsh.bundle` **不能有**：组件包是普通依赖，不是独立插件；加了会在“已安装插件”里重复出现。
- `exports` 必须同时暴露 `./client`、`./package.json`、`./locale/*.json`（Host 读取显示名/图标要靠它们）。
- `icon` 支持 SVG/PNG/JPEG/WebP，≤256 KiB；`locale` 目录必须有 `en.json`（其他语言文件必须与它同目录）。
- `@deepseek-ai/schemastery` 锁 `3.18.5`（与 DSH 自带副本同版本；浏览器端要解码 Host 投影的 `schema.toJSON()`）。

### 3.2 host half（`src/index.ts`）

- 导出 `Config`（schemastery schema）与 `apply(ctx)`；`apply` 只做
  `ctx.inject(['settings'], child => child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)))`。
- 配置默认值只写在 schema；用户覆盖在 profile 的 `cordis.patch.yml`（**整行 config 替换**，不是深合并）。
- `.volatile()` 只能加在**叶子字段**（数值/字符串/布尔）；外层对象不能 volatile。
- **不重命名/移动已发布字段**（当前组件是 `components.mascot.*`）；新增字段用新 key（旧配置自动取默认值）。
- 组件生命周期归客户端；host 半不渲染 UI。

### 3.3 client half（`src/client/`）

- 入口 `src/client/index.ts`：`inject = ['slots', 'configForms']`；每个组件一个 `installXxx(ctx, form)`，
  用 try/catch 隔离（`installComponent`），单组件失败不能影响整页启动。
- 设置命名空间：`form = ctx.configForms.get('<row id>')`；写入
  `form.mutate([{ op: 'set', path: ['components', 'mascot', field], value }])`（`form.set` 只支持单段 key）。
- 配置页：注册到 `plugins.row.config`，key = `<壳包名>#<row id>`（`ROW_CONFIG_KEY` 常量），
  用 `ctx.configForms.whileServed([rowId], () => ctx.slots.inject(...))` 门控；
  `view === 'summary'` 必须返回 `null`（行摘要行已是 `<p>`，不能再塞表单），`view === 'page'` 渲染表单。
- 组件注册 id 必须唯一（当前 `yamaarashi-custom-mascot`）。
- 不 import CSS/图片/其他 npm 包（除平台 externals）；图片走 `scripts/embed-assets.mjs` 生成的 data URL 模块。
- 页面 UI 用 `@deepseek-ai/dsh-client-ui-primitives`；数字项 = 原生 `<input type="range">` + primitives `Input`
  （DSH 没有原生滑条控件），滑条在 `pointerup/keyup/blur` 时提交。
- 每次改动后：`npm run build`；改客户端可 `npm run watch`（`lib/client.js` 走 HMR，效果是整包重载）。

### 3.4 bundle 协议（`tsdown.config.ts`）

```ts
const id = '@yamaarashihz/dsh-yamaarashi-dafeiyu'   // 必须等于组件包名
banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`
footer: 'return module.exports; } });'
intro:  'var module = { exports: {} }; var exports = module.exports;'
```

- externals 只允许平台模块表里的 specifier：`react`、`react/jsx-runtime`、`react-dom`、
  `@deepseek-ai/dsh-client-ui-primitives`（见 `packages/client/web/src/platform.ts:8-15`）；其余一律 inline。
  `react-dom` 仅当组件确实需要 `createPortal` 时使用（DeepSeek 用量卡片就是这种情况）。
- 产物固定 `lib/client.js`（+ map），`files` 必须包含。

### 3.5 显示名与图标

- 组件名/描述：组件包 `locale/zh.json` 的 `meta.title` / `meta.description`；
- 插件整体名：壳包 `locale/zh.json`；两处不要混用。
- 图标：`package.json.icon`，相对包根；组件行与插件都能显示。

---

## 4. 配置规范（重要）

- row id = settings 命名空间 = 组件配置页 key 的一部分，**发布后不可变**。当前 `dafeiyu`（大肥鱼，0.8.0 由 `yamaarashi-custom` 改名）、`deepseek-balance`（用量卡片）。
- 组件配置页入口：插件 → **DSH 个性化定制** → 包含的组件 → **大肥鱼探头** → 行右侧「配置」。
- 默认值只在组件 host schema；`snapshot.status === 'ready'` 之外不信任 `snapshot.value`。
- 配置文件写入形态：`config: { components: { mascot: { ...全部字段 } } }`（整行替换，所以**每一行必须写全字段**）。
- 测试读 volatile 值要用 `.get()`（`JSON.stringify` 会显示 `{}`）。

---

## 5. 组件实现约定

### 5.1 背景层（大肥鱼探头）

- 层元素挂在 `<body>`：`position: fixed; z-index: -1; pointer-events: none` → 位于页面画布之上、
  所有 UI/滚动条之下；`body` 背景会传播到画布，所以主题底色不挡它。
- 位置锚点 = 布局**主内容列**（frame 网格 sidebar | centre | rightbar 的 centre，通过 `[data-rightbar-col]`
  的前一个兄弟节点定位），给该列打 `data-yamaarashi-center` 标记；ResizeObserver + 1s 轮询跟随，
  列宽/高为 0（右侧栏全屏等）时移除层。
- 透明规则（注入 `<style>`，`mascotBackgroundRules()`）：
  - `*:has(> [data-shell-overlay])` → app frame；
  - `[data-yamaarashi-center] > *, [data-yamaarashi-center] > * > *` → 主视图根节点（slot outlet 的
    `display: contents` 锚点会多一层，见 `packages/client/ui-renderer/src/client/scoped-slots.tsx:1088-1120`）；
  - `[data-phase]:has([data-conversation-content])` → 对话页兜底；
  - `[data-shell-bottom]`、`[data-composer-seat]` → 底栏与输入框上方渐隐（`.composerSeat` 的渐变遮罩，
    见 `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css:448`）。
- 卡片/输入框/code block 保留自己的底色，保证可读性；不要把所有元素刷透明。
- `imagePath` 加载失败回退内置图；`:has()` 选择器需要较新 Chromium（与 DSH 本身要求一致）。

### 5.2 侧栏卡片（DeepSeek 用量卡片）

- **位置**：DSH 0.2.1 没有「全局面板列表 ↔ 工作区」之间的插槽（`sidebar.panellist` 是面板行、
  `sidebar.workspaces`/`sidebar.settings` 已被 ui-workspace/ui-settings 独占）。卡片因此采用
  **DOM 注入 + React portal**：在 `shell.overlay` 槽里挂一个 seat，找到侧栏根节点，把
  `div[data-yamaarashi-balance-card]` 插到 `<nav>`（全局面板）之后、工作区区域之前，再用
  `createPortal` 把卡片渲染进去；`MutationObserver` 在侧栏重渲染/挂载变化时重新插入同一节点。
  侧栏根定位：`[data-shell-overlay]` 的父 frame → `[data-rightbar-col]` → 前两个兄弟（sidebarCol）→
  `firstElementChild`。折叠时用 `[data-sidebar-collapsed] ... { display: none }` 隐藏。
  UI 更新（React 状态）不受影响，因为 portal 仍挂在原 React 树里。
- **数据链路**：浏览器只请求同源 host 路由 `/yamaarashi-deepseek-balance/{status,data,credentials}`；
  host 用 `ctx.webServer.register` 注册，`ctx.credentials` 读写凭据，Node `fetch` 直连
  `api.deepseek.com` 与 `platform.deepseek.com`。所有路由做回环 + 同源守卫（写操作要求 Origin 匹配），
  凭据只在进程内存与 DSH 凭据服务里流转，不透传到浏览器。
- **数据源**：
  - 余额：官方 `GET https://api.deepseek.com/user/balance`（`Authorization: Bearer <API Key>`）；
  - 今日分时：`platform.deepseek.com/api/v0/usage/by_api_key/amount|cost?start&end&tz&bucket=3600`，
    `start/end` 为本地日边界 Unix 秒、`tz` 为本地偏移秒（UTC+8 = 28800）；按小时累加消费/tokens/请求数。
  - 私有接口无文档、可能改版；所有失败映射成稳定错误码（`missing_api_key`、`auth_failed`、`timeout`、
    `platform_error`…），卡片按错误码显示中文提示，不崩页。
- **凭据**：ref 固定为 `YAMAARASHI_DEEPSEEK_API_KEY` / `YAMAARASHI_DEEPSEEK_USER_TOKEN`，
  通过 `ctx.credentials`（可回退环境变量）解析；配置页 PUT 凭证时先探测（余额接口 / 用户 summary 接口）
  再 `set`，无效凭据不落盘。API Key 不写进 profile 配置。
- **缓存**：host 合并结果缓存 15s + in-flight 去重；`?refresh=1` 绕过缓存。浏览器按配置的
  `refreshSeconds`（30–600s，默认 60s）轮询，页面重新可见时刷新。
- **主题**：卡片样式通过注入 `<style data-yamaarashi-balance-rules>` 提供，选择器全部收敛在
  `[data-yamaarashi-balance-card]` 下，颜色取 `--dsw-alias-*` 主题令牌（深/浅色都适配），
  不 import CSS；图表是内联 SVG（24 根小时柱 + 渐变 + 网格 + 00:00/08:00/15:00/23:00 轴标）。

---

## 6. 构建 / 打包

```sh
npm run build          # 大肥鱼：embed-assets → clean → tsc（host+types）→ tsdown（lib/client.js）
npm run typecheck
npm run build:balance  # DeepSeek 用量卡片：clean → tsc → tsdown（packages/deepseek-balance）
npm run typecheck:balance
npm pack               # 大肥鱼组件包 → yamaarashihz-dsh-yamaarashi-dafeiyu-<ver>.tgz（prepack 自动 build）
npm run pack:balance   # 用量卡片 → packages/deepseek-balance/yamaarashihz-dsh-yamaarashi-deepseek-balance-<ver>.tgz
npm run pack:bundle    # 壳 → bundle/yamaarashihz-dsh-yamaarashi-custom-<ver>.tgz
npm run pack:all       # 三个一起
npm test               # 回归（需先 build 两个包）
```

- `npm pack` 前确认 `files` 只含需要的东西（不打包源码、`.temp`、旧 tgz）。
- 打包后检查 tgz：组件包含 `lib/`、`locale/`、`assets/`；壳包含 `cordis.patch.yml`、`locale/`、`assets/`。
- 仓库已接入 git（GitHub）；旧 tgz 保留在仓库根但不入库（profile 可能仍引用旧路径），不要随意删除。

---

## 7. 安装 / 升级 / 卸载

```sh
cd /home/yamaarashi/dsh-021
# 安装或升级：壳 + 各组件 tgz 必须同一条命令（每个组件包都必须是 profile 直接依赖，对应 row 才解析得到）
pnpm dsh plugin --profile web add \
  /mnt/d/DeepSeekHarness/dsh-yamaarashi-custom/bundle/yamaarashihz-dsh-yamaarashi-custom-<ver>.tgz \
  /mnt/d/DeepSeekHarness/dsh-yamaarashi-custom/yamaarashihz-dsh-yamaarashi-dafeiyu-<ver>.tgz \
  /mnt/d/DeepSeekHarness/dsh-yamaarashi-custom/packages/deepseek-balance/yamaarashihz-dsh-yamaarashi-deepseek-balance-<ver>.tgz
```

- 组件包没有 `dsh.bundle`，`dsh plugin add` 会输出一次 "not a bundle" 警告，**正常**。
- 也可以直接装 GitHub Release 里的 tgz（`https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/releases/download/v<ver>/<asset>.tgz`），URL 形式与本地 tgz 等价。
- 需要**重启 host**：新增/删除 row、row 的模块名变化、组件包版本变化（新依赖）、host schema 变化。
  仅 `lib/client.js` 变化：刷新页面或等 HMR。
- 卸载（两个一起）：
  `pnpm dsh plugin --profile web remove @yamaarashihz/dsh-yamaarashi-custom @yamaarashihz/dsh-yamaarashi-dafeiyu @yamaarashihz/dsh-yamaarashi-deepseek-balance`
- 配置不丢的前提：row id 不变。升级前用户的值在 profile `cordis.patch.yml` 的该行里。

---

## 8. 新增一个组件的 checklist

1. 新建组件目录/仓库根（当前仓库根就是组件包；多组件时建议拆成独立包目录，保持“一个组件一个包”）。
2. 复制现有组件包的 `package.json` 骨架：改 `name`/`version`/`icon`/`locale`；**不要加 `dsh.bundle`**；
   保留 `dsh.client`、`exports`（`./client`、`./package.json`、`./locale/*.json`）、`engines`、schemastery 版本。
3. host：`src/index.ts` 写本组件的 `Config`（默认值 + `.volatile()` 叶子）与 `apply`。
4. client：`src/client/index.ts` 注册本组件（唯一注册 id + try/catch），配置页注册到
   `plugins.row.config`，key = `<壳包名>#<新 row id>`；`view==='summary'` 返回空。
5. `locale/zh.json` 写组件中文名与描述；`en.json` 回退。
6. 壳 `bundle/cordis.patch.yml` 追加一行：`- id: <新 row id>` / `name: <新组件包名>`（裸包名）。
7. 版本：新组件 `0.1.0`；壳升 minor（0.6.0 → 0.7.0）并重新 `pack:bundle`（本次用量卡片即按此办理）。
8. 构建 → 冒烟测试（见 §9）→ 打包 → 壳 + 组件 tgz 一起安装 → 重启 host → 浏览器验收
   （插件名不变、组件行名正确、行「配置」页可用、原有组件不回归）。
9. 同步更新 `README.md` 的组件表与 `.docs/DEVELOPMENT.md` 的结构说明；AGENTS.md 的表格加一行。

---

## 9. 测试与验收

- 回归脚本在 `tests/`，一条 `npm test` 跑全部（需先 build 两个包）：`tests/shell-check.mjs`（壳 patch 行 / locale / 图标 / 版本）、
  `tests/host-check.mjs`（真实本地 HTTP server + 假凭据/上游，验证 host 路由与数据归一化）、
  `tests/smoke-mascot.mjs`（大肥鱼 jsdom：协议 / slot / 背景层 / 配置页 / 元数据）、
  `tests/smoke-balance.mjs`（用量卡片：协议/slot/DOM 注入/portal/图表/配置页）。覆盖：
  bundle 协议 id、slot 注册（含 `plugins.row.config` key、`whileServed`）、`view summary/page`、
  背景层定位与透明规则、跨主视图保持、侧栏变化、配置实时更新、启用/禁用与卸载清理、设置页结构、
  双包元数据（locale 标题、壳 patch 行、图标）。
- 新增/修改组件后：在 `tests/` 补对应断言；**改版本号时同步 `tests/` 里的版本断言**（否则 CI 会红）。历史 smoke 脚本保留在本地 `.temp/`（不入库）。
- 打包后额外检查：`tar -tzf` 内容、`sha256sum`、组件 tgz 的 host 模块可被 Node import、客户端 banner id 正确。
- 浏览器验收（用户操作）：插件列表名、组件行名、行配置入口、滑条实时生效、所有主视图背景、无控制台报错。
- 测试文件放 `tests/`（入库，CI 跑）；不要进 tgz。CI：`.github/workflows/ci.yml`（typecheck / build / test / pack dry-run）。

---

## 10. 已知坑 / 限制

1. **子路径行不是 client row**：组件行必须是裸包名；不要用 `pkg/subpath` 当组件行。
2. **同一个包无法同时定义插件名和组件名**（bundle meta 与 row meta 都来自同一包 locale）。
3. **slot outlet 是 `display: contents` 包装**：主视图根节点比中心列的直接子元素深一层，透明规则要覆盖两级。
4. **输入区 `.composerSeat` 有渐隐遮罩**：不覆盖 `[data-composer-seat]` 时背景下半部分会“虚化”。
5. **`form.set` 只支持单段 key**：嵌套配置必须 `form.mutate([{ op: 'set', path: [...] }])`。
6. **HMR 是整包重载**：`lib/client.js` 一改，所有组件重挂、交互状态丢失；host schema/包元数据变化必须重启。
7. **配置 patch 是整行替换**：手写覆盖时漏字段会导致该行缺字段（缺的取 schema 默认值），升级时注意保留原有字段。
8. **row config 的 `summary`**：返回表单会被塞进 `<p>`，必须返回 `null`。
9. **locale 目录必须含 `en.json`**，其他语言文件放在同一目录；图标 ≤256 KiB 且必须在包内。
10. **schemastery 版本必须与 Host 一致**（当前 3.18.5），否则浏览器端解码可能静默失败。
11. **不要给组件包加 `dsh.bundle`**；不要往壳包放代码；不要删/改已发布 row id 和配置字段。
12. **侧栏没有现成插槽**：`sidebar.panellist` 只渲染面板行，`sidebar.workspaces`/`sidebar.settings` 是独占 single；
    想插在「全局面板 ↔ 工作区」之间只能 DOM 注入 + portal。注入节点必须能被 `MutationObserver` 复原，折叠时隐藏。
13. **平台用量接口是私有接口**：无文档、可能改版；凭证必须走 DSH 凭据服务，不能写进配置或客户端 bundle；
    改数据源时保持错误码稳定，卡片只认错误码。
14. **组件包 `files` 必须覆盖拆分后的 host 模块**：`lib/index.js` 会 `import './shared.js'` 和 `./host/*.js`；
    `files` 只写 `lib/index.js` 会导致安装后 `ERR_MODULE_NOT_FOUND`。用量卡片的 `files` 已包含
    `lib/shared.js`、`lib/host/*.js`，新增 host 子模块时同步更新；打包后用
    `tar -tzf` + 解包 `node -e "import('./lib/index.js')"` 验证。
12. 删除组件时：壳 patch 删行 + 组件包从 profile 卸载 + locale/文档同步；仅删代码会留下悬挂 row。

---

## 11. 版本记录（架构演进）

| 版本 | 形态 | 说明 |
|---|---|---|
| 0.1.0–0.5.1 | 单包 `@yamaarashihz/dsh-yamaarashi-custom` | 立绘组件从角落→对话区→主内容区，改为背景层，加滑条设置页，铺满所有主视图 |
| 0.6.0 + 组件 0.1.0 | 壳 + 组件包 | 壳名保持「DSH 个性化定制」；组件行名「大肥鱼探头」；配置页迁到 `plugins.row.config`；row id 仍为 `yamaarashi-custom`，旧配置不丢 |
| 0.7.0 + 组件 0.1.0（新增） | 壳 + 两个组件包 | 新增「DeepSeek 用量卡片」（`packages/deepseek-balance`，row id `deepseek-balance`）：host 凭据路由 + 侧栏 DOM 注入卡片 + 行配置页；大肥鱼不变 |
| 0.7.0 + 组件 0.1.1 | 外观微调 | 组件行图标改为纯直方图；卡片标题行去掉品牌图标，只保留文字标题 |
| 0.8.0 + 组件 0.2.0 | row id 改名 | 大肥鱼 row id `yamaarashi-custom` → `dafeiyu`（0.7.x 及以前的旧行配置不自动迁移，回落到 schema 默认值）；组件包内容仅 id 常量与提示文案；已安装用户需重装 tgz 并重启 host |
| 0.9.0 + 组件 0.3.0/0.2.0 | 包名改名 | 组件包统一改为 `@yamaarashihz/dsh-yamaarashi-<组件>`（`dsh-dafeiyu` → `dsh-yamaarashi-dafeiyu`，`dsh-deepseek-balance` → `dsh-yamaarashi-deepseek-balance`）；tsdown `id`、壳 patch 裸包名、文档与冒烟同步；row id/配置字段/显示名不变；升级需从 profile 卸载旧包名、装新包名，并改 profile 覆盖行的 `name:` |
| 0.9.1 + 组件 0.3.1/0.2.1 | 发版与 CI | 各包目录内附 LICENSE（tgz 自带）；README 增加 Release 安装；回归脚本迁到 `tests/` 并新增 GitHub Actions；安装/使用行为无变化 |
| 0.9.1 + 组件 0.3.1/0.3.0（当前） | 用量卡片交互 | 卡片支持中键点击在新标签页打开官方用量页（web UI；mousedown 取消自动滚动，卡片内刷新按钮等控件不劫持手势） |

## 12. 参考资料（本机 DSH 检出）

| 主题 | 位置 |
|---|---|
| bundle/row 显示名 | `packages/boot/plugin-manager/src/index.ts:369`（bundle）、`:743`（row） |
| locale 读取规则 | `packages/boot/app-boot/src/package-meta.ts:175-201` |
| client row 判定（裸包名） | `packages/client/modules/src/index.ts`（`resolveMeta`/`locatePkgJson`） |
| 组件行配置 key | `packages/client/ui-plugin-manager/src/client/config-ledger.ts:36-38` |
| 行配置页渲染 | `packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx:655-690` |
| slot outlet 包装 | `packages/client/ui-renderer/src/client/scoped-slots.tsx:1088-1120` |
| 背景层渐隐来源 | `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css:448` |
| volatile 投影 | `packages/settings/settings/src/schema.ts:33-79` |
| `form.set` 单段 key | `packages/client/ui-settings/src/client/config-form-types.ts:56-73` |
| 平台模块表 | `packages/client/web/src/platform.ts:8-15` |
| 侧栏 DOM 结构 / 面板列表 | `packages/client/ui-sidebar/src/client/SidebarRoot.tsx`、`ui-layout/src/client/AppFrame.tsx` |
| 平台模块表（含 react-dom） | `packages/client/web/src/platform.ts:8-15` |
| webServer 路由注册 | `packages/host/webserver/src/index.ts` |
| credentials 服务 | `packages/credentials/credentials/src/index.ts` |
| 原始交接文档 | `.docs/HANDOFF.md`（历史） |
