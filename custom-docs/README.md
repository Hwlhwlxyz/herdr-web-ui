# custom-docs/

本 fork（`custom` 分支）独有的文档，上游 herdr-web-ui / Ovis 没有这些文件。
全部放在这个目录里，所以 rebase 或合并上游时不会和上游的 `docs/` 冲突。

| 文件 | 内容 |
|---|---|
| [extensions.md](extensions.md) | 本地扩展（slot 机制）的设计、对上游文件的挂载点、各扩展说明 |
| [ext-agents.md](ext-agents.md) | 修改 `src/ext/` 和 `src/slots/` 时必须遵守的规则（给 agent 和人看） |
| [eink-theme.md](eink-theme.md) | 本地主题 `eink_custom`（彩色墨水屏）：改了哪些上游文件、配色、合并后怎么检查 |

fork 独有的代码在 `src/slots/` 和 `src/ext/`（规则见 `custom-docs/ext-agents.md`）。
对上游已有文件的改动只有挂载点，都带 `local extensions` 注释，可以这样列出：

```
git grep -n "local extensions" -- src/App.tsx src/main.tsx
```

注意：`ext-agents.md` 不在 `src/ext/` 里，agent 不会自动读到它。让 agent 改扩展时，请在提示里写上
「先读 custom-docs/ext-agents.md」。
