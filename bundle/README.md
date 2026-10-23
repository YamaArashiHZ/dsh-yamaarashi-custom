# DSH 个性化定制（插件壳）

这是个性化插件的 **bundle 壳**：只负责「插件整体」的中文名、图标和组件列表，不含任何运行代码。

- 插件名：`DSH 个性化定制`（`locale/zh.json`）
- 组件：`cordis.patch.yml` 里每行一个，行名来自对应组件包的 locale
- 当前组件：
  - `@yamaarashihz/dsh-yamaarashi-dafeiyu`（大肥鱼探头），row id = `dafeiyu`
  - `@yamaarashihz/dsh-yamaarashi-deepseek-balance`（DeepSeek 用量卡片），row id = `deepseek-balance`

新增组件：安装组件包 tgz，并在 `cordis.patch.yml` 追加一行（id 稳定，作为该组件的 settings 命名空间）。
