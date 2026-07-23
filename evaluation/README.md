# DUMBER Evaluation

本目录提供 v0.4 评测工程基础，不代表已完成路线图要求的 300 条真实样本。

## 数据原则

真实样本必须：

- 覆盖 X 与 Bilibili；
- 包含高刺激、灰区和高持久价值反例；
- 覆盖新闻、艺术、关系、幽默与正常娱乐；
- 记录采集时间、平台和可追溯来源；
- 遵守内容许可、隐私和再分发限制；
- 由至少两名审阅者独立标注争议样本。

不要把完整用户浏览历史或私密内容放入数据集。

## 文件

- `schema.json`：gold JSONL 每行结构；
- `seed.synthetic.jsonl`：仅用于验证工具链的合成样本；
- `seed.predictions.jsonl`：与 seed 对应的示例预测；
- `scripts/evaluate.mjs`：离线评分器。

评分器会拒绝重复 ID、非法分数、未知 driver 和缺失必填字段；报告会单独列出缺失/多余预测、false positive 与 false negative。只有样本数不少于 300 且覆盖率为 100% 时，`roadmapGateEligible` 才会为 `true`。

## 运行

```bash
node scripts/evaluate.mjs \
  --gold evaluation/seed.synthetic.jsonl \
  --pred evaluation/seed.predictions.jsonl
```

正式验收至少报告：

- promotion precision；
- recall 与 F1；
- false-positive 分类；
- primaryDriver agreement；
- 输出覆盖率；
- 相同模型版本重复运行的一致率。
