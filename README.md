# DSH 个性化定制（dsh-yamaarashi-custom）

[![CI](https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/actions/workflows/ci.yml/badge.svg)](https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/actions/workflows/ci.yml)

> A customization suite for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): a bundle shell plus independent component packages.

个人维护的 DSH 个性化插件，采用「**插件壳 + 组件包**」结构：壳只负责插件整体名/图标与组件列表，每个组件是一个独立 npm 包。非官方项目，与 DeepSeek 官方无关。

| 目录 | 包名 | 中文名 | 作用 |
|---|---|---|---|
| `bundle/` | `@yamaarashihz/dsh-yamaarashi-custom` | **DSH 个性化定制**（壳） | `cordis.patch.yml` 一行一个组件；无运行代码 |
| 根目录 | `@yamaarashihz/dsh-yamaarashi-dafeiyu` | **大肥鱼探头** | 立绘背景层：大小 / 边距 / 透明度 / 自定义图片，改完立即生效 |
| `packages/deepseek-balance/` | `@yamaarashihz/dsh-yamaarashi-deepseek-balance` | **DeepSeek 用量卡片** | 左侧栏卡片：DeepSeek 余额 + 今日分时消费（host 同源路由 + 凭据服务） |

## 为什么拆成两个包

DSH 的「插件名」（bundle）与「包含的组件」行名（row）分别读取**各自包** `locale/*.json` 的 `meta.title`，而组件行必须指向**带 `dsh.client` 的裸包名**才能加载客户端代码。同一个包只能给出一个名字，所以「插件名 ≠ 组件名」就必须拆包。以后加组件 = 新建一个组件包 + 壳里加一行。

更完整的机制依据、目录规范与已知坑见 [`.docs/DEVELOPMENT.md`](.docs/DEVELOPMENT.md)。

## 安装

要求 DSH `0.2.1-rc.x`（Web GUI）。三个包必须**一起装**：壳 + 两个组件包（组件包是 profile 的直接依赖，对应 row 的模块才解析得到）。

### 从 Release 安装（推荐）

```sh
cd <DSH 源码检出>
pnpm dsh plugin --profile web add \
  https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/releases/download/v0.9.1/yamaarashihz-dsh-yamaarashi-custom-0.9.1.tgz \
  https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/releases/download/v0.9.1/yamaarashihz-dsh-yamaarashi-dafeiyu-0.3.1.tgz \
  https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/releases/download/v0.9.1/yamaarashihz-dsh-yamaarashi-deepseek-balance-0.2.1.tgz
# 新增 row / 模块名变化 / host schema 变化 → 重启 host
```

### 从本地 tgz 安装

在 [Releases](https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/releases) 页下载三个 tgz 后：

```sh
cd <DSH 源码检出>
pnpm dsh plugin --profile web add \
  <下载目录>/yamaarashihz-dsh-yamaarashi-custom-0.9.1.tgz \
  <下载目录>/yamaarashihz-dsh-yamaarashi-dafeiyu-0.3.1.tgz \
  <下载目录>/yamaarashihz-dsh-yamaarashi-deepseek-balance-0.2.1.tgz
```

- 组件包没有 `dsh.bundle`，`dsh plugin add` 会对它输出一句 “not a bundle” 的一次性警告 —— **正常**：它作为普通依赖安装，不会在「已安装插件」里单独出现。
- npm 包尚未发布，目前通过 GitHub Release 分发 tgz。

卸载：

```sh
pnpm dsh plugin --profile web remove \
  @yamaarashihz/dsh-yamaarashi-custom \
  @yamaarashihz/dsh-yamaarashi-dafeiyu \
  @yamaarashihz/dsh-yamaarashi-deepseek-balance
```

## 使用

1. 左侧「插件」→ 已安装 → 点 **DSH 个性化定制**；
2. 页面「包含的组件」里选择 **大肥鱼探头** 或 **DeepSeek 用量卡片**，点行右侧「配置」。

### 大肥鱼探头

立绘是挂在 `<body>` 上、`z-index: -1` 的背景层，铺在所有主页面（对话 / 插件 / 自动化任务等）的 UI 元素和滚动条下方，位置锚定主内容区右下角。配置项：启用、大小、右边距、底边距、不透明度、自定义图片路径（滑条 + 数字框，修改立即生效，无需重启）。

### DeepSeek 用量卡片

出现在左侧栏「自动化任务」下方、「工作区」上方：

- **余额**：官方 `GET https://api.deepseek.com/user/balance`，使用你自己填的 DeepSeek API Key；
- **今日使用情况**：`platform.deepseek.com` 的按小时用量接口（`by_api_key/amount|cost` + `bucket=3600`），需要浏览器登录态 `userToken`；展示今日消费、24 小时柱状图、调用次数 / tokens；
- **凭证**：在「插件 → DSH 个性化定制 → 包含的组件 → DeepSeek 用量卡片 → 配置」中录入；API Key / `userToken` 存进 DSH 凭据服务（`YAMAARASHI_DEEPSEEK_API_KEY` / `YAMAARASHI_DEEPSEEK_USER_TOKEN`），不写进 profile 配置文件。获取 `userToken`：登录 `platform.deepseek.com` → F12 Console → `localStorage.getItem("userToken")`。

## 数据与隐私

- 浏览器只请求 **host 的本地同源路由**，不直接跨域访问 DeepSeek；
- API Key / `userToken` 只在进程内存与 DSH 凭据服务中流转，**不会下发到浏览器**，也不写进配置；
- 平台用量接口是**私有接口**：无官方文档、可能随平台改版失效；失败时卡片显示错误提示而不是崩页。

## 兼容性

- DSH：`>=0.2.1-rc.2 <0.3.0`（当前基线 `0.2.1-rc.2`）；
- Node：`^22.19.0 || >=24`；
- `@deepseek-ai/schemastery` 锁定 `3.18.5`（与 Host 自带副本同版本）；
- 背景层透明规则使用 `:has()`，需要较新的 Chromium（与 DSH 本身要求一致）。

## 开发

```sh
npm install
npm run typecheck          # 类型检查
npm run build              # assets → tsc → tsdown（大肥鱼组件包）
npm run build:balance      # 第二个组件包：tsc + tsdown
npm test                   # 回归：壳元数据 + 大肥鱼 jsdom + 用量卡片 jsdom/host
npm pack                   # 大肥鱼组件包 tgz
npm run pack:balance       # 用量卡片 tgz
npm run pack:bundle        # 壳 tgz
npm run pack:all           # 一次打三个
```

- 客户端 bundle 走 DSH 协议（`window.__ModuleLoader__.load`），只允许平台模块作为 external；不能 import CSS / 图片（图片走生成的 data URL 模块）。
- 回归脚本在 `tests/`（`npm test`），CI（GitHub Actions）在每次 push / PR 时跑 typecheck、build、test 与三个包的 `npm pack --dry-run`。
- 开发规则见 [`AGENTS.md`](AGENTS.md)，完整规范见 [`.docs/DEVELOPMENT.md`](.docs/DEVELOPMENT.md)。

## 目录结构

```
bundle/                     插件壳：cordis.patch.yml + locale + 图标
src/                        大肥鱼组件包：host Config + 客户端 bundle 源码
packages/deepseek-balance/  DeepSeek 用量卡片组件包
tests/                      回归脚本（npm test）
.github/workflows/ci.yml    CI
.docs/DEVELOPMENT.md        开发规范（权威）
AGENTS.md                   DSH 自动加载的项目规则
```

## License

[MIT](LICENSE)。立绘与图标由作者创作，随本仓库以 MIT 分发。
