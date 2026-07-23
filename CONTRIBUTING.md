# Contributing to DUMBER

## 原则

提交必须遵守 `ROADMAP.md` 的设计宪法。除产品名外，运行时界面必须真诚；不得加入警告、劝退、羞辱、休息提醒、强制点击或阅读摩擦。

## 开发流程

```bash
npm ci
npm run check
npm test
npm run evaluate:seed
npm run test:browser
npm run package
```

## 修改模型协议

任何提示词、schema 或驱动因素变更必须：

1. 更新 `PROMPT_VERSION`；
2. 更新 JSON Schema 单元测试；
3. 运行完整评测集；
4. 记录 precision、recall、误报类别和稳定性；
5. 确认本地 driver 标签仍只包含正向 UI 语言。

## 修改站点适配器

当前发布目标只包含 X。Bilibili/BewlyBewly 适配器是未启用底座；恢复它们需要单独的范围决策和真实站点稳定性验收。

不得在 `content.js` 添加站点 selector。所有平台差异必须保留在 `src/adapters/`。提交应附：

- 最小匿名 DOM fixture；
- 稳定 ID 说明；
- primary / secondary / expandable 元素选择说明；
- 虚拟列表复用测试；
- Shadow DOM 或 SPA 行为说明。

## 资产

只能提交：

- 原创资产；
- 明确允许再分发的资产；
- 可验证许可证与来源的资产。

不得提交来源不明的 meme、图标、字体或截图。字体文件不得进入仓库。

## 安全

提交前运行：

```bash
npm run check
```

不得提交 API Key、cookie、token、私有 endpoint 或真实用户浏览数据。

`npm run check` 会审计整个仓库（排除构建输出与依赖目录），包括凭据/私钥特征、旧代理、远程脚本、Manifest 引用、HTML/CSS 本地引用、JSON、JavaScript/Python 语法、字体文件和图标尺寸。

`npm run package` 必须同时生成安装包与完整源码包，并保持连续两次构建的 SHA-256 一致。
