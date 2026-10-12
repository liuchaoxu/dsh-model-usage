# dsh-model-usage

适用于 DeepSeek Harness（DSH）的**供应商模型账户用量查询插件**。

它在会话页面头部放一个「用量」入口，点开即可看到**当前对话所用模型**对应供应商账户的用量
——余额、套餐窗口、已用额度、信用余额；也可以手动切到任意可路由的模型，去查别的供应商的额度，
不必再逐个打开各家控制台。

- 插件包本体：[`model-usage/`](model-usage/)（包名 `dsh-model-usage`）
- 功能细节（原理、凭据解析、各家用量接口、刷新策略、面板内容、安装步骤）：
  [model-usage/README.md](model-usage/README.md)
- 许可证：[MIT](LICENSE)

## 仓库结构

| 路径 | 说明 |
| --- | --- |
| [`model-usage/`](model-usage/) | 插件包本体：node 半负责用量查询与 loopback Web 路由，浏览器半负责会话头部入口与弹窗面板 |
| [`model-usage/README.md`](model-usage/README.md) | 插件层功能说明，是使用与二次开发的主要文档 |
| [`LICENSE`](LICENSE) | MIT License |

## 快速开始

安装与挂载步骤见[插件说明](model-usage/README.md#安装)，概括为三步：

1. 把 `model-usage/` 作为插件包装进 DSH profile（`dsh plugin add <插件目录绝对路径>`，
   或直接复制 / 建 junction 到 `$DSH_HOME/profiles/web/node_modules/dsh-model-usage`）；
2. 在 profile 的 `cordis.patch.yml` 的 `insert` 里挂载入口 `dsh-model-usage`；
3. 重启 `dsh web`（host 半生效），浏览器硬刷新（浏览器半生效）。

## 参与贡献

**这个项目友善地欢迎开源合作，也欢迎任何人提交 PR。**
无论是新增一家供应商的用量适配器、修掉一个边界情况、改进文案与文档，还是指出我们写错的字段名，
都同样有价值；哪怕只是把某家接口的真实返回贴给我们做校准，也是实打实的帮助。

- **新供应商适配**：在 `model-usage/lib/index.js` 里认领一个 query kind（`kindOf()` 按 host / provider 判定）、
  写一个归一化函数（`{ rows }` / `{ windows, models }`），客户端会自动用通用卡片渲染；
  已支持的路由与接口形态见[用量接口](model-usage/README.md#用量接口)。
- **未文档化的接口**：如果某家用量接口没有公开文档，欢迎在 PR 描述里附上脱敏后的真实返回，
  我们会据此收敛字段名，而不是靠猜。
- **提交方式**：fork 本仓库 → 建一个语义清晰的分支 → 提交 PR，并在描述里写清「解决什么、怎么验证、影响哪些路由」。
  状态类改动请附上截图或最小复现步骤。
- **协作方式**：我们会对每个 PR 认真 review、尽量及时回复；分歧时优先讨论方案而不是互相消耗。
  提交即表示同意你的贡献以本仓库的 [MIT 许可](LICENSE)发布。
- 还不确定怎么改也没关系，先开 issue 描述你看到的场景与期望行为，我们一起来定方案。

## 许可证与生态

本项目以 [MIT License](LICENSE) 发布。

- 上游 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 同样以 **MIT** 许可发布，
  与本仓库一致，因此代码可以在两个方向自由复用；若将来某个适配器被官方收录，也不存在许可障碍。
- 本项目是**独立的社区插件**，与深度求索公司无隶属、合作或背书关系；
  "DeepSeek Harness" 是深度求索公司的注册商标，本仓库仅在描述性文字中说明兼容关系。
  命名遵循官方[品牌素材使用规范](https://github.com/deepseek-ai/deepseek-harness/blob/master/BRAND_GUIDELINES.zh.md)，
  使用 `DSH` 缩写而非完整商标。
- 如果你是插件作者，可以在自己的仓库上添加 `dsh-plugin` 话题，方便社区检索（官方推荐做法）。
