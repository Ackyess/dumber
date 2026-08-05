# GetDumber promo archive

这是 GetDumber 第一支完整宣传片的可复现工程归档。项目已于
2026-08-05 冻结，后续不再继续修改当前成片。

## 最终成片

- 画幅：1080×1920
- 帧率：30 fps
- 时长：15.8 秒
- 视频：H.264
- 音频：AAC
- 叙事：进入信息流 → AI 精选 → 霓虹强化 → 沉浸加速 → 品牌落点
- 主句：`Attention is all it needs.`
- SHA-256：`ce355a7e6f44ac39d4ff1e0b76628e079b7969ce5d4d8e0220652c2a03f4bf04`

最终 MP4 不进入 Git 历史，随
[v0.3.13 Release](https://github.com/Ackyess/dumber/releases/tag/v0.3.13)
发布。

同一 Release 还附带可安装插件包与精简源码包：

- `dumber-0.3.13.zip`：`e741fc1e68488507ddfa6c0c769c4451a4c6a057b1d9ecf7b4fe92d58b4c1e02`
- `dumber-0.3.13-source.zip`：`69f329195422ccf65133c5a8c4dba47ba392752313d0df403e3103d2574fbe6d`

## 目录

- `hyperframes-mobile/`：最终移动版源工程，是归档的权威版本；
- `hyperframes-preview/`：早期桌面版原型，用于保留设计演进；
- `STORYBOARD.md`、`STORYBOARD.html`、`STORYBOARD.png`：早期连续镜头方案；
- `RETROSPECTIVE.md`：项目复盘和以后使用 HyperFrames 的标准流程；
- `reference/`：用于对齐插件实际视觉的参考图；
- `assets/`：早期方案画面。

移动版目录内后来补写的 `STORYBOARD.md` 是评审板提案，不是实际的文件拆分清单；
当前成片仍由单个 `index.html` 驱动。为忠实保存最终版本，本次归档不再重构它。

## 本地预览

```bash
cd marketing/promo-12s/hyperframes-mobile
npm run dev
```

完整检查：

```bash
npm run check
```

工程固定使用 `hyperframes@0.7.94`。字体许可证、音乐署名和音效说明均随源文件保存。
