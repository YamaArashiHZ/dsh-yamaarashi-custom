# AGENTS.md — dsh-yamaarashi-custom 开发规则

> 本文件由 DSH 自动加载（工作区根目录 AGENTS.md），对本工作区的所有会话生效，无需用户提醒。
> **动手改代码 / 打包 / 安装前**，先读：
> - [`.docs/DEVELOPMENT.md`](.docs/DEVELOPMENT.md) —— 当前开发规范全文（权威；含 DSH 机制依据、构建/安装/测试流程与已知坑）
> - [`README.md`](README.md) —— 使用与安装说明
>
> 本机环境（DSH 源码检出路径、无全局 `dsh`、profile 位置等）见 `AGENTS.local.md`（不随仓库分发；不存在时按 DEVELOPMENT.md §12 的参考资料自行定位）。

## 项目定位

个人维护、**仓库公开**的 DSH 个性化插件，由「插件壳 + 组件包」组成，目标是以后持续增加组件：

| 角色 | 位置 / 包 | 中文名 | 职责 |
|---|---|---|---|
| 插件壳（bundle） | `bundle/` · `@yamaarashihz/dsh-yamaarashi-custom` | **DSH 个性化定制** | 只放 `cordis.patch.yml` + `locale/` + 图标；`patch` 里一行一个组件，row id 稳定 |
| 组件包 1 | 仓库根目录 · `@yamaarashihz/dsh-yamaarashi-dafeiyu` | **大肥鱼探头** | 立绘背景层：host `Config` + `dsh.client` 客户端 bundle + `locale/` + 图标 |
| 组件包 2 | `packages/deepseek-balance/` · `@yamaarashihz/dsh-yamaarashi-deepseek-balance` | **DeepSeek 用量卡片** | 侧栏卡片：host 凭据路由（余额/今日分时用量）+ 客户端卡片与行配置页 |

> **包名规范**：组件包一律 `@yamaarashihz/dsh-yamaarashi-<组件>`（中段固定 `yamaarashi`），
> 壳包固定 `@yamaarashihz/dsh-yamaarashi-custom`。
> 0.9.0 已执行改名：`dsh-dafeiyu → dsh-yamaarashi-dafeiyu`、`dsh-deepseek-balance → dsh-yamaarashi-deepseek-balance`
> （row id、配置字段、显示名都不变；升级时先从 profile 卸载旧包名，再装新包名）。
> 改包名要同步 `bundle/cordis.patch.yml` 的裸包名、各包 `tsdown.config.ts` 的 `id`、README/DEVELOPMENT 与冒烟脚本；
> **row id 和配置字段不随包名变化**（用户配置不丢），但安装形态会变，需重建重装并重启 host。

## 硬约束（违反会导致插件加载失败或用户配置丢失）

1. **壳包不放运行代码**；组件代码只在各自的组件包里。
2. 组件包的 `package.json` 必须：`dsh.client.platform = "web"`、`exports` 暴露 `./client`、`./package.json`、`./locale/*.json`；**不要**给组件包加 `dsh.bundle`（否则它会作为独立插件出现在“已安装插件”里）。第二个组件起放在 `packages/<组件名>/`，一个组件一个包。
3. 壳 `cordis.patch.yml` 的行必须指向**裸包名**（如 `@yamaarashihz/dsh-yamaarashi-dafeiyu`）；子路径行不会被当作 client row，客户端插件不会加载。
4. **已发布的 row id 永不可改**（row id = settings 命名空间 = 行配置页 key 的一部分）。当前：`dafeiyu`（大肥鱼，0.8.0 由 `yamaarashi-custom` 改名）、`deepseek-balance`（用量卡片）。新增组件用新的、稳定的 row id。
5. 展示名规则：插件名改 `bundle/locale/zh.json` 的 `meta.title`；组件行名改**该组件包** `locale/zh.json` 的 `meta.title`。同一个包无法同时给出两个不同名字。
6. 配置默认值只放在组件 host schema；`.volatile()` 只加在**叶子字段**，不能加在外层对象；用户覆盖写在 profile 的 `cordis.patch.yml`（**整行 config 替换**，不是深合并）。
7. 客户端 bundle 必须保持 DSH 协议：`window.__ModuleLoader__.load({ id: <组件包名>, factory })`、`return module.exports`；external 只能是平台模块（`react` / `react/jsx-runtime` / `react-dom` / `@deepseek-ai/dsh-client-ui-primitives`，见 `packages/client/web/src/platform.ts`）；不能 import CSS/图片（内联资源走生成的 data URL 模块）。
8. 组件配置页注册到 `plugins.row.config`，key = `<壳包名>#<row id>`，用 `configForms.whileServed([rowId])` 门控；写入用 `form.mutate([{ op: 'set', path: [...], value }])`（`form.set()` 只支持单段 key）；`view === 'summary'` 必须返回空。
9. 每个组件在 slot 里的注册 id 必须唯一；组件安装用 try/catch 隔离，单个组件失败不能拖垮整页启动。
10. 不要重命名/移动已发布的配置字段（当前 `components.mascot.*`、`components.balanceCard.*`），只增不改。
11. 基线：DSH `0.2.1-rc.2`；`@deepseek-ai/schemastery` 锁 `3.18.5`（与 Host 自带副本同版本）；`engines.dsh` / `engines.node` 见各包 `package.json`。
12. **git**：允许本地 `commit` / `tag`；`push`、`npm publish`、改远端仓库设置必须经用户明确批准。除 `~/.dsh` 外不改动用户环境，除非用户明确要求并批准。

## 标准工作流

```sh
cd <仓库根>
npm install                 # 首次
npm run typecheck           # 改完先类型检查
npm run build               # assets → tsc → tsdown
node .temp/smoke-v090.mjs   # jsdom 回归（大肥鱼 + 两个组件元数据）
node .temp/smoke-balance.mjs # 用量卡片 client 回归（slot / DOM 注入 / 卡片 / 配置页）
node .temp/host-check.mjs    # 用量卡片 host 路由 + 数据归一化
npm pack                    # 大肥鱼组件包 tgz
npm run build:balance       # DeepSeek 用量卡片：tsc + tsdown
npm run pack:balance        # DeepSeek 用量卡片 tgz
npm run pack:bundle         # 壳 tgz（bundle/ 下）
# 或 npm run pack:all 一次打三个
```

安装 / 升级（壳 + 各组件 tgz 必须一起装，每个组件包都是 profile 直接依赖）：

```sh
cd <DSH 源码检出>
pnpm dsh plugin --profile web add \
  <仓库根>/bundle/yamaarashihz-dsh-yamaarashi-custom-<ver>.tgz \
  <仓库根>/yamaarashihz-dsh-yamaarashi-dafeiyu-<ver>.tgz \
  <仓库根>/packages/deepseek-balance/yamaarashihz-dsh-yamaarashi-deepseek-balance-<ver>.tgz
# 行指向的模块、row 增删、host schema 变化 → 必须重启 host；纯 client.js 改动可刷新/HMR
```

`dsh plugin add` 对组件包的 "not a bundle" 一次性警告是**正常**的。

## 加新组件

按 `.docs/DEVELOPMENT.md` 的 checklist：在 `packages/<id>/` 新建组件包（host Config + client bundle + `plugins.row.config` 页面 + locale）→ 壳 `cordis.patch.yml` 加一行新 row → 各包升版本 → 一起打包安装 → 重启 → 冒烟验收。**不要**把新组件塞进已存在的组件包。

## 提交风格

- 中文沟通；先结论后细节；改完给出可执行的安装/重启命令；
- 一个逻辑改动一个 commit，信息用中文并带前缀（`feat:` / `fix:` / `docs:` / `chore:` / `refactor:`）；
- 任何涉及“删配置字段、改 row id、改包名”的改动，必须先向用户说明影响并确认。
