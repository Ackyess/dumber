# DUMBER

DUMBER 是一个 Chrome Manifest V3 扩展。它不是过滤器、警告器或数字健康工具，而是一位真诚挑选、优化并推广高刺激、低持久价值内容的 AI 策展人。

当前版本：`0.3.4`

## 运行时体验

DUMBER 会读取进入视口的 X 内容卡片，把可见上下文发送到用户自行配置的 OpenAI-compatible Chat Completions 接口。模型返回结构化策展结果后，命中内容会被升级为 VIP 阅读卡片：

- 虹彩只存在于边缘和环境光，不覆盖正文；
- 正文获得稳定、高对比度的阅读平面；
- 保留 X 原有的字号、字重、行距、换行和卡片尺寸，不因标记触发布局重排；
- 时间、播放量和次要按钮被适度弱化，但功能不被删除；
- 全页面只维护一个 hover sidecar，自动停靠在卡片外侧；
- 虹彩由独立的 Web Animations 动画驱动，不覆盖宿主卡片已有的 CSS 动画；
- sidecar 使用正向标签、推荐强度和庆祝角色；
- `更多这种 / 这条真有用` 会在本地调整后续推广并保存单条纠错；
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

### 暂缓的平台

Bilibili/BewlyBewly 适配器源码与 fixture 作为工程底座保留，但当前 Manifest 不在这些站点注入内容脚本，设置页也不提供启用开关。恢复该平台要等 X 完成长时间滚动、误报与视觉稳定性验收。

## 安装

1. 下载并解压发布 ZIP。
2. 打开 `chrome://extensions`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压后的目录。
6. 打开 DUMBER 的“策展设置”，填写 DeepSeek API Key。
7. 点击“测试模型连接”，确认结构化输出可用。

## BYOK 配置

DUMBER 不内置 API Key，也不绑定第三方代理。默认使用 DeepSeek 官方接口：

```text
https://api.deepseek.com
```

默认模型为 `deepseek-v4-flash`。升级时，官方 xAI 配置会切换到 DeepSeek 并清空不兼容的 xAI Key；自定义 Grok 网关会保留地址与 Key，只把模型名切换为 DeepSeek Flash。

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

模型网络输出为：

```text
promote
dopamineScore
durableValue
primaryDriver
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

UI 标签由本地 `primaryDriver` 映射生成，不再要求模型生成重复文案。共享层会过滤未知 ID与越界分数。

最终推广必须同时满足：模型建议推广、刺激分达到阈值、`durableValue <= 0.45`，且用户没有对同一内容选择“这条真有用”。项目、研究、作品和教程只有在模型同时判断其持久价值较低时，才可能获得 VIP 标记。

## 请求与缓存

后台 service worker 维护跨页面单飞队列：

- 内容在视口前方 2400px 即开始预判，目标是在滚入屏幕前完成；
- 内容脚本与后台批处理不再增加人为 debounce；
- 每批最多 8 条；
- 相同缓存键在等待中或执行中都会合并为同一个请求；
- API 批次严格串行，避免并发请求风暴；
- 请求使用紧凑、非流式结构化输出；正文最多发送 700 字，删除 URL 等无关字段；
- `deepseek-v4-flash` 显式关闭 thinking，避免默认 high 思考占用实时路径；
- DeepSeek 直接使用 `json_object`，避免先发送不兼容的 JSON Schema 请求；
- 设置和缓存会在 service worker 启动时预热，工程指标写入不阻塞模型请求；
- 28 秒超时仍作为异常请求的安全上限，不作为性能目标；
- 429 与 5xx 最多重试一次；
- 每次调用前确认当前 API origin 权限仍然存在；
- 仅在服务明确不支持 JSON Schema 时回退到 `json_object`；
- 缓存同时保存在 `storage.session` 与 `storage.local`；
- 缓存键包含 API endpoint、模型、提示词版本、提取器版本和内容指纹；
- 缓存只保存 hash 与结构化判定，不保存原始卡片文本；
- 清除本地数据时会中止活动请求，并阻止旧响应重新写回缓存或指标。

体验 SLA 定义为“卡片进入视口到最终视觉状态少于 1000ms”。预判完成后再滚入视口记为 0ms；设置页的连接测试会执行一次真实冷请求，超过 1000ms 会明确判定为不合格。插件自身回归测试要求：上游模型耗时 700ms 时，端到端响应仍低于 1000ms。

## 本地个性化

`更多这种 / 这条真有用` 会更新完全本地的偏好画像：

- 内容驱动因素；
- 平台与作者；
- 可见标签或话题；
- 单条内容指纹；“这条真有用”会立即撤销并持续阻止该条内容再次被推广；
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
src/adapters/bilibili.js      暂停启用的 Bilibili / BewlyBewly 适配器底座
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
- 700ms 上游响应下的端到端 1 秒预算；
- 视口前方预判完成后滚入屏幕的 0ms 视觉响应；
- X VIP 渲染与标记前后排版几何不变；
- 宿主 CSS 动画保留与 DOM 重渲染原位修复；
- sidecar 避让；
- 虚拟列表卡片复用；
- 暂停、模型切换和清除数据时的旧响应隔离。

## 可复现打包

```bash
npm run package
```

输出：

```text
dist/dumber-0.3.4.zip
dist/dumber-0.3.4.zip.sha256
dist/dumber-0.3.4-source.zip
dist/dumber-0.3.4-source.zip.sha256
```

打包器使用固定文件顺序、固定时间戳、无压缩存储和固定文件元数据。可以通过 `SOURCE_DATE_EPOCH` 覆盖时间戳。安装包只包含扩展运行所需文件和核心说明；源码包包含测试、评测工具、CI 与开发文档。

## 评测

`evaluation/` 包含数据格式、合规要求、合成 seed 和离线评分器。当前仓库没有声称完成 300 条真实 X 样本，也没有声称达到 90% 推广精确率。相关验收必须在真实、审阅过、具有可追溯来源的回归集上完成。

## 安全与隐私

- 无远程托管脚本；
- 无内置 Key；
- API 权限按 origin 运行时申请；
- 不上传完整浏览历史；
- 不抓取 X 私信、页面外内容或完整浏览历史；
- 导出文件不包含 API Key；
- 无账户、云同步、遥测或订阅系统。

完整说明见 [PRIVACY.md](PRIVACY.md)。

## 开源协议

[MIT](LICENSE)
