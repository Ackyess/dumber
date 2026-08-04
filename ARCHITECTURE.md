# DUMBER Architecture

## 1. 设计边界

运行时必须始终真诚推广命中内容。内部可以分析即时刺激、持久价值和内容驱动因素，但 UI 不得泄露负面分类，也不得制造阅读摩擦。

架构采用六个明确边界：

```text
站点适配器 → 内容状态机 → 后台单飞队列 → 模型协议
        ↘              ↘
          VIP 渲染器      本地缓存 / 偏好 / 指标
```

## 2. 共享纯函数

`src/shared.js` 不依赖 Chrome API 或 DOM，可直接在 Node.js 测试。它负责：

- schema 与存储 key 版本；
- 文本归一化和稳定序列化；
- 两路 32-bit 混合得到的 64-bit 十六进制内容指纹；
- API URL 规范化；
- 设置迁移与验证；
- 模型输出归一化；
- 缓存键；
- 本地偏好画像与分数增益；
- 严格度到刺激门槛与持久价值上限的统一映射；
- 日指标归一化和 percentile。

内容指纹用于稳定复用与缓存去重，不作为密码学安全散列。远程 API 只允许 HTTPS；HTTP 仅允许 `localhost` 与 `127.0.0.1`。URL 内嵌用户名或密码会被拒绝。

旧设置不是当前 `schemaVersion: 2` 时，API Key 一律不迁移。这是针对 v0.1 源码凭据泄露的显式安全迁移。

## 3. 模型协议

`src/curator.js` 包含：

- 固定版本的 system prompt；
- 严格 JSON Schema；
- API payload 构造；
- JSON fenced/plain 响应解析；
- 可测试的单飞批处理器。

模型看到的是经过裁剪的 X context，而不是宿主页面 HTML：正文最多 700 字，引用最多 280 字，并移除 canonical URL 等无关字段。提示词明确把输入当作不可信引用内容，阻止 prompt injection。模型只返回判定字段，正向 UI 标签由本地 driver 映射生成。

每个批次必须返回全部请求 ID。缺少任意条目时整批失败并进入受控重试流程，不会把缺项静默转换为长期缓存的中性结果。旧的 `verdicts/items` 响应容器不再被接受。

## 4. 后台 service worker

`src/background.js` 是唯一允许发起模型网络请求的模块。

### 4.1 单飞

所有内容脚本请求进入同一个 `createSingleFlightBatcher`：

- pending 与 active 都以版本化 cache key 去重；
- 执行期间到达的同键请求会加入既有 waiter，而不是创建第二次模型调用；
- 同组配置最多合并 8 条；
- worker 全局只允许一个活跃批次；
- 下一批只有在上一批结束后才开始。

### 4.2 网络策略

- `AbortController` 提供硬超时；
- 设置与缓存随 service worker 启动预热；
- 批处理不增加人为等待，工程指标写入不阻塞网络关键路径；
- DeepSeek V4 Flash 显式关闭 thinking，并直接请求 `json_object`；
- 模型请求使用紧凑非流式 JSON，因为完成前不存在可消费的局部判定；
- 429/5xx 最多重试一次；
- `Retry-After` 最高等待 1.5 秒；
- 网络错误和超时不进行无限重试；
- 只有明确的 schema 兼容性 400 才回退到 `json_object`。
- Key/模型缺失时内容状态机不启动；API origin 权限缺失时后台在 `fetch` 前失败，并返回稳定错误码。

后台维护数据 generation 与活动 `AbortController`。清除数据会先提升 generation、拒绝 pending/active waiter、终止活动 fetch，再通过缓存、指标与画像写入屏障写入空状态。旧请求不能在清除完成后复活数据。

### 4.3 缓存

缓存条目不含原始文本：

```text
cacheKey -> { curation, at }
```

`cacheKey` 绑定：

```text
versioned namespace hash(endpoint, model, prompt version, extractor version)
content fingerprint
```

`storage.session` 提供 service worker 重启后的热缓存，`storage.local` 提供浏览器重启后的持久缓存。

缓存、指标和画像分别使用串行 mutation chain，避免异步 read-modify-write 互相覆盖。缓存 schema 当前为 V3，画像 schema 为 V2；旧缓存键在安装迁移和清除操作中删除。

## 5. 站点适配器

当前发布版的 Manifest 只加载 X 适配器。Bilibili/BewlyBewly 适配器源码继续保留为未启用的工程底座，不获得站点权限，也不进入运行时脚本列表。

每个适配器返回统一 descriptor：

```js
{
  card,
  stableId,
  context,
  primaryElements,
  secondaryElements,
  expandableElements,
  preferenceContext
}
```

适配器不发送请求、不写存储、不创建 DUMBER DOM，只负责从宿主页面提取稳定语义。

`stableId` 优先使用平台原生 ID；缺失时才使用作者与正文 hash。视觉计数、播放量和时间文本不会进入内容指纹，避免宿主实时数字变化触发重复判定。

## 6. 内容状态机

`src/content.js` 对每个宿主卡片维护状态：

```text
observing → queued → requesting → promoted | ready
                               ↘ error → one delayed retry
```

关键约束：

- IntersectionObserver 只分析接近视口的卡片；
- 预判边界扩展到视口前后 2400px，给远程模型留下滚动前置时间；
- Key 与模型均未配置完成时不扫描、不排队、不重试；
- 每个卡片绑定当前 fingerprint；
- 虚拟列表复用导致 fingerprint 变化时，旧视觉状态立即撤销；
- 宿主框架替换正文节点但 fingerprint 不变时，渲染器会原位重新绑定 class，不重复请求模型；
- 内存判定按模型配置签名隔离；
- 每个运行 generation 只允许一个活跃消息批次；模型切换可启动新 generation，而旧响应只能被丢弃；
- URL 轮询与 MutationObserver 一起覆盖 SPA 导航；
- X 私信路径不会激活内容运行时。

视觉延迟从卡片第一次进入真实视口开始计时；若判定在屏外预取阶段完成，记录为 0ms。目标 SLA 为 p95 小于 1000ms。

## 7. VIP 渲染器

`src/renderer.js` 只通过 class、CSS 变量、一个全局 sidecar 和一个 fixed 活动指示器工作。

卡片本体：

- 已定位卡片使用绝对定位伪元素形成虹彩边缘；静态卡片使用不占空间的 outline 色相动画，均不增加 border、不改变定位上下文或盒模型；
- 不在正文上方放置半透明覆盖层；
- 虹彩使用独立 Web Animations 动画更新自定义属性，不覆盖宿主 CSS `animation`；
- 主要元素只提升颜色对比度，不改字号、字重、行距、换行或文字尺寸；
- 次要元素仅降低视觉权重；
- 不主动取消宿主的 line clamp 或截断，避免异步标记触发布局重排；
- reduced-motion 停止角度动画。

sidecar：

- 每个 document 只有一个；
- 使用 fixed positioning，避免被宿主 overflow 裁剪；
- 优先放在卡片右侧或左侧，其次放在上下方；
- 没有任何无重叠位置时保持隐藏，不以覆盖正文作为降级方案；
- 通过 `event.composedPath()` 支持 Shadow DOM 内的卡片；
- 偏好按钮直接写入本地画像。

活动指示器直接观察现有 `data-dumber-state`，聚合扫描、排队、请求、完成和错误数量；不复制请求状态，也不进入页面布局。

## 8. 数据最小化

发送给模型：进入视口卡片的有限可见 context。

保存在本地：

- API 配置；
- 结构化判定缓存；
- 偏好画像；
- 聚合工程指标；
- 少量事件去重 ID。

不保存：

- 完整页面 HTML；
- 完整浏览历史；
- X 私信、页面外内容和完整页面 HTML；
- 云端用户账号。

## 9. 扩展点

恢复或新增平台只能通过站点适配器与独立验收完成，不得把平台 selector 重新塞回 `content.js`。适配器规范见 `docs/ADAPTERS.md`。
