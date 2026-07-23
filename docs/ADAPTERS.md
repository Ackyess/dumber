# Site Adapter Guide

## 接口

适配器通过 `DumberAdapters.register(name, adapter)` 注册：

```js
DumberAdapters.register("platform", {
  matches(locationLike, documentLike),
  scan(rootNode),
  extract(card)
});
```

`scan` 返回 descriptor 数组：

```js
{
  card,
  stableId,
  context: {
    contentType,
    text,
    title,
    author,
    description,
    quoteText,
    linkTitle,
    tags,
    canonicalUrl
  },
  primaryElements,
  secondaryElements,
  expandableElements,
  preferenceContext: {
    platform,
    author,
    topics
  }
}
```

空字段应省略或保持为空；运行时会再次清洗与限长。

同一内容如果同时匹配外层容器与内层真实卡片，适配器应只返回最接近内容语义的那一层。Bilibili 适配器按 DOM 深度优先接受内层卡片，并跳过包含已接受卡片的外层容器。

## stableId

优先级：

1. 平台原生内容 ID；
2. canonical URL 中的稳定 ID；
3. 作者、标题和正文的稳定 hash。

不得把播放量、点赞数、时间文本或 DOM index 放进 stable ID。这些值会变化并造成重复请求。

使用通用元素（例如 `article`）作为兜底 selector 时，必须额外验证平台原生 ID 或 canonical URL。普通说明文章、帮助内容和页面结构容器不得仅凭标题元素进入策展流程。

## context

context 只应包含模型判定所需的可见语义，不得包含：

- 整张卡片 HTML；
- 控件 aria dump；
- 隐藏元素文本；
- DUMBER 自己的 sidecar；
- 完整页面导航与推荐列表。

## visual element groups

`primaryElements`：正文、标题、简介等阅读核心。

`secondaryElements`：时间、播放量、点赞、弹幕、弱操作按钮等。渲染器只降低视觉权重，不删除功能。

`expandableElements`：保留给未来平台渲染策略的正文与标题分组。当前 X 渲染器不会取消 line clamp、ellipsis 或 max-height，避免异步标记改变布局。

## Shadow DOM

运行时会递归发现 open ShadowRoot，并将每个 root 交给同一适配器。适配器不得假设 `rootNode` 一定是 Document。

Closed Shadow DOM 无法由普通内容脚本读取，不在支持范围内。

## Fixture 要求

新增或修改 selector 时，必须更新 `test/fixtures/`，并在 `test/browser_smoke.py` 中增加至少一个真实 Chromium 断言。

fixture 至少应覆盖：嵌套卡片去重、虚拟列表复用、同 fingerprint 的子节点替换、宿主 CSS 动画保留，以及适用时的 open Shadow DOM。
