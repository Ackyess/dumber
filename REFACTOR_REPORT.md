# DUMBER 0.3.0 全量重构与审计报告

> 本文记录 0.3.0 重构基线；0.3.1–0.3.4 的语义纠正、X-only 范围、几何稳定渲染、低延迟调度和模型切换见 `CHANGELOG.md`。

日期：2026-07-23

## 1. 结论

本次工作不是在 0.1.0 上继续堆叠补丁，而是按 `ROADMAP.md` 的设计宪法重建了插件的运行时边界、模型协议、站点适配、请求调度、缓存一致性、VIP 渲染、本地个性化、设置管理、测试和发布流程。

当前代码适合作为 **0.3.0 工程版**：路线图 v0.2 的核心稳定性机制、v0.3 的 VIP 阅读渲染器、v0.4 的评测基础设施、v0.5 的本地偏好基础和 v0.9 的开源工程骨架已经落地。它不应被表述为已完成 v0.4 的 300 条真实样本或 90% 精确率验收。

## 2. 原始版本审计

0.1.0 的主要问题如下：

1. 源码中存在一处开发凭据特征；旧凭据必须在上游服务撤销，本报告不复述其内容。
2. Manifest 绑定固定 API/代理 host，并公开两个运行时素材资源。
3. 运行时仍使用“变蠢、纠正、处方、风险、提醒”等旧产品语义，与路线图设计宪法冲突。
4. 内容提取、DOM 状态、视觉渲染、模型调用和站点分支集中在少量文件，职责耦合。
5. 请求层缺少完整的跨页面单飞、活动请求去重、硬超时、受控重试和清除数据写入屏障。
6. 缓存缺少完整版本命名空间，虚拟列表复用和 SPA 重渲染容易造成状态错位。
7. Bilibili/BewlyBewly 的 Shadow DOM、嵌套卡片、hover 与 DOM 替换场景缺少系统性处理。
8. 第三方 meme/icon 素材的再分发许可不清晰。
9. 测试、fixture、CI、评测工具、可复现发布包、隐私说明和适配器规范不完整。

## 3. 新架构

### 3.1 共享协议层

`src/shared.js` 现在只包含可在 Node.js 中直接测试的纯函数：

- 设置、缓存、偏好和指标 schema 版本；
- API URL 规范化与安全约束；
- 稳定序列化、内容指纹和候选 ID；
- 模型响应归一化与正向 UI 标签约束；
- 版本化缓存键；
- 本地偏好画像、推广增益和每日工程指标。

旧 schema 中的 API Key 不迁移，避免把 0.1.0 的开发凭据带入新版本。

### 3.2 模型协议层

`src/curator.js` 使用统一输出：

```text
promote
dopamineScore
durableValue
primaryDriver
promotionLabel
```

模型输入是经过长度和字段限制的可见 context，不是页面 HTML。提示词明确把卡片文本视为不可信引用内容。严格 JSON Schema 每批要求 1–8 条结果；缺少任何请求 ID 时整批失败，不生成并缓存中性占位结果。

### 3.3 后台网络与一致性层

`src/background.js` 是唯一网络出口，包含：

- 跨页面全局单飞批处理；
- pending 与 active 同键合并；
- 每批最多 8 条、全局串行执行；
- 默认使用流式响应，28 秒限制模型开始响应的时间，并自动迁移早期 12 秒配置；
- 429/5xx 最多重试一次；
- 仅对明确的 JSON Schema 不兼容 400 进行 `json_object` 回退；
- API origin 权限前置检查；
- session/local 双层缓存；
- 缓存、指标和画像的串行 mutation chain；
- 数据 generation、活动 `AbortController` 和清除数据写入屏障。

清除本地数据时，pending/active waiter 会被拒绝，活动 fetch 会被中止，旧请求不能在清除完成后重新写回缓存、指标或画像。

### 3.4 站点适配层

站点差异已从内容状态机中拆出：

- `src/adapters/x.js`：正文、引用内容、链接标题、作者、状态 ID 和话题；
- `src/adapters/bilibili.js`：标题、UP 主、标签、简介、BV/动态 ID；
- `src/adapters/index.js`：注册表与安全 DOM 辅助函数。

Bilibili 扫描按 DOM 深度优先处理真实内层卡片，排除无平台身份的普通 `article`，避免嵌套容器重复判定。BewlyBewly 通过递归发现开放 Shadow DOM 获得支持。

### 3.5 内容状态机

`src/content.js` 维护：

```text
observing → queued → requesting → promoted | ready
                               ↘ error → delayed retry
```

关键行为：

- 未填写 Key/模型时不扫描、不排队、不重试；
- 只处理接近视口的内容；
- 稳定 fingerprint 绑定当前卡片内容；
- 虚拟列表复用时立即撤销旧视觉状态并重新判定；
- DOM 子节点被宿主框架替换但内容未变时，原位修复样式，不重复请求；
- 暂停、模型切换和运行代际变化时丢弃旧响应；
- SPA URL 变化、MutationObserver 和开放 Shadow DOM 均纳入扫描生命周期。

### 3.6 VIP 渲染器

`src/renderer.js` 将命中内容升级为高对比阅读卡片：

- 虹彩只存在于边缘和环境光；
- 正文使用稳定阅读平面；
- 字号、行距、标题展开和次要信息弱化分层处理；
- 虹彩由 Web Animations 驱动，不覆盖宿主 CSS `animation`；
- 支持 `prefers-reduced-motion`；
- 每个 document 只有一个 fixed sidecar；
- sidecar 自动选择右、左、下、上位置；没有无重叠空间时直接隐藏；
- 不插入覆盖正文的 marker，不使用外部 meme 资源。

### 3.7 BYOK、本地偏好和数据治理

- API 地址、模型和 Key 均由用户本地配置；
- 远程 API 强制 HTTPS，本机 HTTP 只允许 `localhost` 和 `127.0.0.1`；
- 保存配置时按当前 API origin 请求可选权限；
- popup 区分“未配置模型”和“API 权限已撤销”；
- `更多这种 / 少一点` 只更新本地 driver、作者和话题画像；
- 导出不包含 API Key；
- 可清除缓存、画像和工程指标；
- 不建设账户、云同步、分析 SDK、广告或订阅系统。

## 4. 安全与供应链清理

本次完成：

- 删除源码内置开发 Key；
- 删除固定代理依赖；
- 删除来源许可不明确的 meme sprite、noise 和旧 icon；
- 生成原创多尺寸 PNG 图标；
- 移除 required API host permission，改为运行时可选 origin 权限；
- 禁止远程脚本、远程样式、`javascript:` URL、字体文件、私钥和常见凭据特征进入发布包；
- API 地址禁止内嵌用户名/密码；
- Manifest 内容脚本范围保持为 X 与 Bilibili；
- 发布包禁止符号链接，并对待打包文件再次执行敏感信息扫描。

旧开发 Key 即使已经从仓库删除，也必须在上游服务执行撤销或轮换。

## 5. 测试与验证

最终自动化矩阵：

| 层级 | 结果 | 覆盖重点 |
| --- | --- | --- |
| 静态仓库审计 | 通过 | Manifest、权限、引用、JSON、JS/Python 语法、远程代码、凭据、字体、图标尺寸 |
| Node.js 单元/后台 VM | 27/27 通过 | 设置迁移、schema、缓存、偏好、单飞、活动去重、429、兼容回退、权限前置拦截、清除竞态 |
| 离线评测 seed | 通过 | 覆盖率、混淆矩阵、precision/recall/F1、重复 ID 拒绝、路线图 gate 判定 |
| Chromium DOM 冒烟 | 通过 | 未配置零请求、X、Bilibili、Shadow DOM、虚拟列表、sidecar 避让、DOM 修复、代际隔离 |
| 可复现构建 | 通过 | 连续两次安装包与源码包 SHA-256 一致 |
| ZIP 解包审计 | 通过 | Manifest 可解析、所有引用存在、脚本语法、无秘密信息、文件集合符合预期 |

Chromium 冒烟测试使用真实浏览器执行 DOM、CSS、事件、Shadow DOM 和内容脚本逻辑，但使用匿名本地 fixture 和模拟扩展 API，不调用真实社交平台或模型服务。

## 6. 路线图覆盖

### v0.2

核心工程机制已落地。仍需真实站点执行 30 分钟连续滚动、缓存恢复 100 ms 和新判定 p95 4 秒验收。

### v0.3

VIP 阅读渲染器已实现。仍需在 X/Bilibili 的多主题和真实页面上做 WCAG 对比度采样与截图回归。

### v0.4

协议、数据格式、合成 seed 和离线评分器已建立。尚未完成 300 条真实样本和 90% 精确率验收，因此没有宣称模型质量 gate 已通过。

### v0.5

本地偏好、正向操作、streak、导出和清除基础已实现。真实长期使用中的偏好衰减与稳定性仍需数据验证。

### v0.9

BYOK、秘密信息清理、原创资产、测试、CI、可复现 ZIP、隐私和贡献文档已完成。发布前仍需 Chrome Web Store 素材、真实站点长时间测试和第三方兼容矩阵。

## 7. 已知边界

1. 平台 DOM selector 可能随 X、Bilibili 或 BewlyBewly 更新而变化，需要 fixture 与适配器同步维护。
2. 仅支持开放 Shadow DOM；closed Shadow DOM 无法由内容脚本递归进入。
3. 当前不抓取字幕、评论、视频画面，也不做跨设备同步。
4. 本地内容指纹用于工程去重，不是密码学散列。
5. 本次执行环境中的 Chromium 受管理员策略限制，禁止加载 unpacked extension，因此不能声称已在该环境完成“开发者模式真实安装并启动 service worker”。替代验证包括 Manifest/引用静态审计、解包校验、真实 Chromium 内容运行时测试和 service worker VM 测试。
6. 真实 API 兼容性取决于用户选择的 OpenAI-compatible 服务是否支持项目所需请求与结构化输出行为。

## 8. 发布建议

- 版本号保持 `0.3.0`；
- 发布前撤销旧开发 Key；
- 优先用真实 X/Bilibili 账户完成 30 分钟滚动和主题对比度检查；
- 用至少两个实际 API 服务执行连接、429、超时和 schema fallback 验证；
- 在完成 300 条真实回归集之前，不使用“90% 精确率”作为发布声明。
