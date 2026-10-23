# DSH 个性化定制（dsh-yamaarashi-custom）

[![CI](https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/actions/workflows/ci.yml/badge.svg)](https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/actions/workflows/ci.yml)

DeepSeek Harness 个性化插件：插件壳 + 组件包。非官方项目，MIT License。

| 包 | 内容 |
|---|---|
| `@yamaarashihz/dsh-yamaarashi-custom` | 插件壳（组件列表，无运行代码） |
| `@yamaarashihz/dsh-yamaarashi-dafeiyu` | 大肥鱼探头：立绘背景层，大小 / 边距 / 透明度 / 自定义图可调 |
| `@yamaarashihz/dsh-yamaarashi-deepseek-balance` | DeepSeek 用量卡片：侧栏余额 + 今日分时用量 |

## 安装

要求 DSH `0.2.1-rc.x`，三个包一起装：

```sh
cd <DSH 源码检出>
pnpm dsh plugin --profile web add \
  https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/releases/download/v0.9.1/yamaarashihz-dsh-yamaarashi-custom-0.9.1.tgz \
  https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/releases/download/v0.9.1/yamaarashihz-dsh-yamaarashi-dafeiyu-0.3.1.tgz \
  https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/releases/download/v0.9.1/yamaarashihz-dsh-yamaarashi-deepseek-balance-0.2.1.tgz
# 新增 row / 模块名变化 → 重启 host
```

也可从 [Releases](https://github.com/YamaArashiHZ/dsh-yamaarashi-custom/releases) 下载三个 tgz 用本地路径安装。组件包无 `dsh.bundle`，安装时的 “not a bundle” 警告正常。

## 使用

左侧「插件」→ 已安装 → **DSH 个性化定制** → 「包含的组件」→ 选组件 → 行右侧「配置」。

- **大肥鱼探头**：背景层铺在所有主视图 UI 下方，大小 / 右边距 / 底边距 / 不透明度 / 图片路径可调，修改立即生效。
- **DeepSeek 用量卡片**：填 DeepSeek API Key（余额，官方接口）与浏览器 `userToken`（今日分时，平台私有接口）；凭证存 DSH 凭据服务，浏览器只经本地同源路由取数。私有接口可能改版失效，失败时卡片显示错误提示。

## 兼容性

- DSH `>=0.2.1-rc.2 <0.3.0`；Node `^22.19.0 || >=24`
- `@deepseek-ai/schemastery` 固定 `3.18.5`

## 开发

```sh
npm install
npm run typecheck && npm run build && npm run build:balance
npm test          # 回归（tests/）
npm run pack:all  # 三个 tgz
```

规范见 [`AGENTS.md`](AGENTS.md)、[`.docs/DEVELOPMENT.md`](.docs/DEVELOPMENT.md)。

## License

[MIT](LICENSE)
