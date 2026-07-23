# DUMBER

DUMBER 是一个 Chrome Manifest V3 扩展。它不是过滤器、警告器或数字健康工具，而是一位真诚挑选、优化并推广高刺激内容的 AI 策展人。

当前版本：`0.3.0`

## 运行时体验

DUMBER 会读取进入视口的 X 与 Bilibili 内容卡片，把可见上下文发送到用户自行配置的 OpenAI-compatible Chat Completions 接口。模型返回结构化策展结果后，命中内容会被升级为 VIP 阅读卡片：

- 虹彩只存在于边缘和环境光，不覆盖正文；
- 正文获得稳定、高对比度的阅读平面；
- 主要文字字号与行距提升，截断标题尽可能完整展开；
- 时间、播放量和次要按钮被适度弱化，但功能不被删除；
- 全页面只维护一个 hover sidecar，自动停靠在卡片外侧；
- 虹彩由独立的 Web Animations 动画驱动，不覆盖宿主卡片已有的 CSS 动画；
- sidecar 使用正向标签、推荐强度和庆祝角色；
- `更多这种 / 少一点` 会在本地调整后续推广阈值；
- `prefers-reduced-motion` 会停止虹彩运动，但保留视觉优先级。

运行时不会出现风险警告、羞辱、劝退、停止滚动提示或阅读摩擦。产品唯一保留的反讽是名称 `DUMBER`。

## 支持范围

### X

提取内容包括：

- 推文正文；
- 作者账号与显示名；
- 引用推文可见正文；
- 可见链接卡片标题；
- canonical status ID 与 URL。

### Bilibili

提取内容包括：

- 视频或动态标题；
- UP 主；
- 卡片内可见简介；
- 可见标签和话题；
- BV ID、动态 ID 与 URL。

BewlyBewly 通过递归发现开放的 Shadow DOM 获得支持。当前版本不抓取字幕、评论、视频画面或完整浏览历史。

## 安装

1. 下载并解压发布 ZIP。
2. 打开 `chrome://extensions`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压后的目录。
6. 打开 DUMBER 的“策展设置”，填写 API 地址、模型和 API Key。
7. 点击“测试模型连接”，确认结构化输出可用。

## BYOK 配置

DUMBER 不再内置 API Key，也不绑定第三方代理。默认 API 地址是：

```text
https://api.x.ai/v1
```

模型名称保持为空，必须由用户填写。也可以使用其他兼容 `/chat/completions` 与 `response_format` 的接口。

远程 API 必须使用 HTTPS；HTTP 只允许 `localhost` 与 `127.0.0.1`，用于本机模型服务。API 地址不得包含用户名或密码。

保存设置时，扩展只请求当前 API origin 的可选 host permission。API Key 保存在 `chrome.storage.local`，不会进入导出文件、源码包或工程指标。

在 Key 与模型名称都填写完成前，内容脚本不会扫描信息流、创建请求队列或进行失败重试。若用户之后撤销当前 API origin 权限，popup 会明确显示“等待 API 访问权限”，后台也会在网络调用前拒绝请求。

### 从 v0.1 升级

v0.1 源码曾包含开发凭据。新版本会拒绝迁移旧 schema 中的 API Key。必须执行以下操作：

1. 在上游服务撤销旧开发 Key；
2. 删除或覆盖旧扩展目录；
3. 重新加载本版本；
4. 在设置页填写新的个人 Key。

## 模型协议

内部结构化输出为：

```text
promote
dopamineScore
durableValue
primaryDriver
promotionLabel
```

其中 `primaryDriver` 只允许：

```text
high_emotion
identity_resonance
curiosity_gap
reaction_chain
frictionless_exploration
instant_gratification
status_signal
mixed
```

UI 只消费正向 `promotionLabel`。共享层会过滤未知 ID、越界分数和带有警告、羞辱或劝退语义的标签。

## 请求与缓存

后台 service worker 维护跨页面单飞队列：

- 每批最多 8 条；
- 相同缓存键在等待中或执行中都会合并为同一个请求；
- API 批次严格串行，避免并发请求风暴；
- 默认超时 12 秒；
- 429 与 5xx 最多重试一次；
- 每次调用前确认当前 API origin 权限仍然存在；
- 仅在服务明确不支持 JSON Schema 时回退到 `json_object`；
- 缓存同时保存在 `storage.session` 与 `storage.local`；
- 缓存键包含 API endpoint、模型、提示词版本、提取器版本和内容指纹；
- 缓存只保存 hash 与结构化判定，不保存原始卡片文本；
- 清除本地数据时会中止活动请求，并阻止旧响应重新写回缓存或指标。

## 本地个性化

`更多这种 / 少一点` 会更新完全本地的偏好画像：

- 内容驱动因素；
- 平台与作者；
- 可见标签或话题；
- 操作次数与更新时间。

偏好只对最终推广分数施加有限幅度的增减，不改写模型原始输出。设置页可以导出画像、指标和配置摘要，也可以清除缓存、画像与指标。

## 工程指标

popup 与设置页只展示产品工程状态：

- 今日推广数量；
- 连续命中；
- 缓存命中率；
- 视觉出现延迟 p95；
- API 请求延迟 p95；
- hover 与偏好操作计数。

DUMBER 不记录“阻止了多少阅读”或“减少了多少使用时间”。

## 架构

```text
src/shared.js                 版本、设置、schema、缓存键、偏好与指标纯函数
src/curator.js                系统提示词、JSON Schema、响应解析、单飞批处理器
src/background.js             API、超时重试、缓存、BYOK、偏好与指标
src/adapters/index.js         站点适配器注册表与 DOM 辅助函数
src/adapters/x.js             X 内容提取器
src/adapters/bilibili.js      Bilibili / BewlyBewly 内容提取器
src/renderer.js               VIP 阅读卡片与唯一 hover sidecar
src/content.js                视口发现、Shadow DOM、SPA 与运行时状态机
src/options.*                 BYOK、推广策略与本地数据管理
src/popup.*                   当前策展状态与工程指标
```

更详细的职责边界见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 开发

要求：Node.js 20+。

```bash
npm ci
npm run check
npm test
npm run evaluate:seed
```

真实 Chromium 冒烟测试需要 Python Playwright：

```bash
python -m pip install playwright==1.57.0
python -m playwright install chromium
npm run test:browser
```

测试覆盖：

- 设置迁移与凭据清除；
- 未配置时零扫描，以及 API 权限撤销后的网络前置拦截；
- schema 归一化与正向 UI 标签约束；
- 缓存版本；
- 本地偏好分数；
- 单飞队列去重与串行执行；
- 后台 429 重试、schema 兼容回退与活动请求中止；
- 模型批次缺项拒绝，避免把不完整响应缓存成中性结果；
- X VIP 渲染；
- 宿主 CSS 动画保留与 DOM 重渲染原位修复；
- sidecar 避让；
- 虚拟列表卡片复用；
- Bilibili/BewlyBewly 开放 Shadow DOM、嵌套卡片去重与普通文章排除；
- 暂停、模型切换和清除数据时的旧响应隔离。

## 可复现打包

```bash
npm run package
```

输出：

```text
dist/dumber-0.3.0.zip
dist/dumber-0.3.0.zip.sha256
dist/dumber-0.3.0-source.zip
dist/dumber-0.3.0-source.zip.sha256
```

打包器使用固定文件顺序、固定时间戳、无压缩存储和固定文件元数据。可以通过 `SOURCE_DATE_EPOCH` 覆盖时间戳。安装包只包含扩展运行所需文件和核心说明；源码包包含测试、评测工具、CI 与开发文档。

## 评测

`evaluation/` 包含数据格式、合规要求、合成 seed 和离线评分器。当前仓库没有声称完成 300 条真实 X/Bilibili 样本，也没有声称达到 90% 推广精确率。相关验收必须在真实、审阅过、具有可追溯来源的回归集上完成。

## 安全与隐私

- 无远程托管脚本；
- 无内置 Key；
- API 权限按 origin 运行时申请；
- 不上传完整浏览历史；
- 不抓取字幕、评论或视频画面；
- 导出文件不包含 API Key；
- 无账户、云同步、遥测或订阅系统。

完整说明见 [PRIVACY.md](PRIVACY.md)。

## 开源协议

[MIT](LICENSE)
