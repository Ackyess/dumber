# Changelog

## 0.3.1 — 2026-07-23

- 将 `durableValue <= 0.45` 设为不可被个性化绕过的推广硬门槛。
- 收紧提示词：好奇、情绪、热度或新颖本身不再足以触发推广；项目、研究、作品和教程默认按持久价值保护。
- 将“少一点”改为“这条真有用”，并按内容指纹保存立即生效的单条纠错。
- 同一平台内容补齐上下文时保留旧标记到新判定完成，虚拟列表切换到另一内容时仍立即撤销。
- 模型请求增加响应完成阶段超时；卡片失败后最多只延迟重试一次。
- X 私信路径不再激活适配器。
- 合成评测 seed 增加高吸引力、高持久价值的困难反例。
- 当前发布范围收敛为 X；Bilibili 适配器源码保留，但不再申请站点权限、注入脚本或显示设置开关。
- VIP 标记不再改写字号、字重、行距、换行、line clamp 或卡片盒模型；虹彩边缘使用伪元素或不占空间的 outline，避免强制定位与布局重排。

## 0.3.0 — 2026-07-23

### Runtime reset

- 将旧模型字段迁移为 `promote / dopamineScore / durableValue / primaryDriver / promotionLabel`。
- 删除运行时纠正、处方、风险和劝退语义。
- 新增正向 UI 标签过滤。

### Reliability

- X 与 Bilibili 拆分为独立适配器。
- 使用平台 ID 与内容指纹处理虚拟列表复用。
- 后台新增跨页面单飞批处理队列。
- 等待中与执行中的同键请求都会合并；清队列会拒绝 pending 与 active waiter。
- 请求默认使用流式响应，28 秒只限制模型开始响应的时间；自动迁移早期 12 秒配置，并保留 429/5xx 一次重试和受控 schema fallback。
- `grok-4.5` 请求显式使用 `reasoning_effort: "low"`，避免落入默认 high 推理。
- 未配置 Key/模型时运行时保持静默；API origin 权限撤销会在网络调用前被识别并显示在 popup。
- 模型批次缺项会整批拒绝，不再缓存静默生成的中性占位结果。
- 缓存键绑定 endpoint、模型、提示词版本和提取器版本。
- 使用 session/local 双层缓存。
- 新增运行 generation、活动请求中止与写入屏障，防止暂停、模型切换或清除数据后的旧结果复活。
- 修复 Shadow DOM、SPA、虚拟列表、DOM 子节点替换和 hover 状态保持。
- Bilibili 增加嵌套卡片去重与普通 `article` 排除。

### VIP renderer

- 移除覆盖正文的虹彩层。
- 新增高对比阅读平面、字体和行距增强、标题展开与次要信息弱化。
- 新增全局唯一、自动避让的 hover sidecar。
- 无可用停靠位置时 sidecar 保持隐藏，不覆盖正文。
- 虹彩改为独立 Web Animations 动画，不覆盖宿主 CSS 动画。
- 支持 reduced motion。
- 移除未确认授权的 meme sprite，替换为原创文字庆祝角色。

### Personalization

- 新增本地 `更多这种 / 少一点`。
- 按 driver、作者和话题维护有限幅度的本地偏好画像。
- 新增导出、清除和 popup 工程指标。

### Security and release

- 删除源码内置 Key 与固定代理依赖。
- 改为 BYOK 和可选 API origin 权限。
- 新增原创图标、隐私说明、适配器文档、测试、CI 和可复现 ZIP。
- 静态检查扩展到整个仓库的凭据、私钥、远程脚本、引用完整性、JSON、JS/Python 语法与图标尺寸。
- 打包器同时生成确定性的安装 ZIP 与完整源码 ZIP。
