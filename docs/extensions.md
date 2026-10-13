# 本地扩展（slot 机制）与「项目文件」浏览器 — 开发文档

> 2026-10-13 新增。基于上游 `a4b2295`（v0.4.8）。
> 目标：在**尽量不改上游文件、不改后端**的前提下增加功能，以后合并上游新提交时冲突最少。

---

## 一、设计原则

1. **不改后端**：只用已有的 `/api/*` 接口（通过 `useMachineApi()` 调用，远程电脑自动走 `/api/machines/<id>/…`）。
2. **上游文件只加「挂载点」**：一共 2 个文件、5 行，全部是**新增行**，不修改任何已有行。每行末尾都带有注释 `local extensions`，合并冲突时搜索这个关键字就能找到。
3. **扩展代码全部放在新目录**：`src/slots/`（slot 机制）和 `src/ext/`（各个扩展）。
4. **只通过一个文件引用上游代码**：`src/ext/upstream.ts`。上游重命名或移动了某个模块时，只需要修改这一个文件。

---

## 二、对上游文件的改动（合并时重点检查）

| 文件 | 改动 | 说明 |
|---|---|---|
| `src/main.tsx` | `import "./ext/load.ts";` | 放在 `import { App }` 之后，保证扩展的 CSS 在 `styles.css` 之后加载 |
| `src/App.tsx` | `import { menuItems, Slot } from "./slots/registry.tsx";` | 加在 import 区末尾 |
| `src/App.tsx` | `const slotCtx = { machineId, pane, openFile };` | 紧挨在 `const moreItems: RowMenuItem[] = [` 的上一行 |
| `src/App.tsx` | `...menuItems("header.more", slotCtx),` | 加在 `moreItems` 数组的最后一项 |
| `src/App.tsx` | `<Slot name="app.overlay" ctx={slotCtx} />` | 加在 `FilesDialog` 和 `RepoDiffViewer` 之间。放在 FileViewer 之前，所以 FileViewer 会显示在扩展上层 |

**合并上游后的检查步骤：**
1. `git grep -n "local extensions" src/` 应该找到 5 行；如果少了，按上表重新加上
2. `bun run typecheck`：`src/ext/upstream.ts` 报错时，说明上游移动了模块，在这个文件里修正路径
3. `bun run build`，然后在浏览器中打开「⋯ → 项目文件」验证

---

## 三、slot 机制

```
src/slots/
  types.ts        AppSlotContext、slot 名称（MenuSlotName / ViewSlotName）
  registry.tsx    registerMenuItems / registerSlot / menuItems() / <Slot>
src/ext/
  load.ts         import.meta.glob("./*/index.{ts,tsx}", { eager: true })，自动加载所有扩展
  upstream.ts     集中导出扩展用到的上游模块
  AGENTS.md       给 AI 的规则（不要修改上游文件等）
  <扩展名>/index.ts  注册菜单项和视图
```

**AppSlotContext**（App 传给扩展的全部内容）：

| 字段 | 含义 |
|---|---|
| `machineId` | 当前 pane 所在的电脑（本机是 `"local"`） |
| `pane` | 当前选中的 pane（`HerdrPane`，包含 `pane_id`、`cwd`、`foreground_cwd`、`workspace_id` 等），没有选中时为 `null` |
| `openFile(path)` | 用上游的 FileViewer 打开文件（图片、PDF、Markdown 预览、下载等） |

**目前的 slot：**

| 名称 | 类型 | 位置 |
|---|---|---|
| `header.more` | 菜单 | 右上角「⋯」菜单的末尾 |
| `app.overlay` | 视图 | App 根部的浮层区域，位于 FileViewer 之下 |

**容错**：菜单 provider 抛出异常时，只丢掉这个扩展的菜单项；视图组件放在独立的 `RenderBoundary` 中，渲染出错时只有这个扩展不显示，App 不受影响。

**新增扩展：**
1. 新建 `src/ext/<名称>/index.ts`，调用 `registerMenuItems(...)` / `registerSlot(...)`，`load.ts` 会自动加载
2. 需要新的挂载位置时：在 `src/slots/types.ts` 中增加 slot 名称，在 `App.tsx` 中加一行，**并更新本文第二节的表格**

**约束**（`src/ext/AGENTS.md`）：
- **扩展里不要调用 `t("…")`**：上游的 `src/lib/i18n.test.ts` 会扫描所有 `t(` 调用，并要求每个字符串都存在于上游的词典中。扩展使用自己的词典，函数名为 `tx`（`useTx()` / `txNow()`）。目前只有中文翻译，其他语言显示英文
- CSS 只能使用 token（`var(--…)`），不能写颜色字面量，不能用 `!important`（`src/conventions.test.ts` 会检查）；所有 class 都加扩展前缀（项目文件用 `pf-`）
- localStorage 键名统一为 `herdr-web-ui:ext:<扩展名>:<键>`，并且必须放在 try/catch 里

---

## 四、「项目文件」扩展（`src/ext/project-files/`）

### 入口
右上角「⋯」菜单 →「项目文件」。只有选中 pane 时才显示这一项。

### 界面
- **右侧抽屉，不加遮罩**（`aria-modal="false"`）：显示在 header 下方，左边的终端或聊天仍然可以查看和操作；抽屉是浮层，**不会改变终端尺寸**（不触发 PTY resize）
- 桌面（≥769px）：拖动抽屉左边缘调整宽度；拖动树和预览之间的分隔条调整树的宽度；「最大化」按钮可以切换到全宽
- 641–768px：全宽
- 手机（≤640px）：全宽，分两级页面（树 → 预览，点「返回」回到树）
- 层级：`--z-drawer`（20），低于弹窗的 `--z-modal`（30），所以「在查看器中打开」的 FileViewer 会盖在抽屉上面
- Escape：焦点在抽屉内、并且上面没有其他弹窗时关闭抽屉；FileViewer 打开时 Escape 只关闭 FileViewer

```
┌ 项目文件  agent_research › techstack_research   [↑][⌂][⟳][👁][⤢][✕] ┐
│ 快速打开（git 跟踪的文件）…    │ hono-vite-deno/server.ts            [⧉][↗] │
│ ▾ hono-vite-deno             │ 12 行 · 450 B                                │
│   ▸ packages                 │  1 │ // …                                    │
│   ▸ src                      │  3 │ import { serveStatic } … ▒▒▒ 已选中     │
│     server.ts  ◀             │  7 │ app.route('/', api)       ▒▒▒           │
│                              │ server.ts:3-7  [路径 + 代码 ▾] [复制引用] [✕] │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

### 功能
| 功能 | 实现 |
|---|---|
| 根目录 | 打开时为当前 pane 的 `foreground_cwd ?? cwd`；切换 pane 后自动跟随。[↑] 进入上级目录，[⌂] 回到 pane 的目录 |
| 目录树 | 展开时才通过 `fetchDirectories(path, hidden, files=true, paneId)` 加载，加载过的结果会缓存；[⟳] 重新加载所有已展开的目录；键盘操作为 ↑↓←→ / Home / End / Enter，`role="tree"` |
| 隐藏目录 | 默认隐藏以 `.` 开头的目录（由服务端过滤），以及 `node_modules dist build target out .venv venv __pycache__ .herdr-web-ui coverage .next .turbo`；[👁] 一键全部显示 |
| 快速打开 | `fetchPaneFiles(paneId, q, 50)`（服务端优先用 `git ls-files`，否则遍历目录），150ms 防抖，支持 ↑↓ 和 Enter |
| 预览 | `fetchFileInfo` → 文本文件通过 Range 请求读取最多 **2MB / 10,000 行**（`readFilePreviewText`），用 `useHighlightedLines` + `CodeLines` 显示行号和高亮。超出上限时显示提示；非文本文件引导到查看器 |
| 选中行 | ①在代码上拖选（监听 `selectionchange`，根据 `[data-line]` 计算起止行，三击选整行时不会多算一行）②点击行号选中一行，Shift+点击行号扩展选区。选中的行用 `--accent-tint` 高亮 |
| 复制引用 | 格式可选（记住上次的选择）：只复制路径和行号 `src/a.ts:3-7` / 路径 + 代码 / Markdown 代码块（围栏比代码中最长的反引号串多一个）。路径相对于树的根目录，不在根目录下时用绝对路径；Windows 路径统一转换为 `/` |
| 复制路径 | 复制相对路径 |
| **cd 到选中目录** | 目录树下方的按钮「cd 到 <目录名>」。目标是树中最后选中的一项：选中目录就用该目录，选中文件就用文件所在目录，什么都没选就用树的根目录。点击后往**当前选中的 pane** 输入切换目录命令并回车（`POST /api/pane/input` 写入命令，再 `POST /api/pane/keys ["Enter"]`，都是已有接口，不使用 bracketed paste）。命令按 shell 生成（根据 pane 的 title / terminal_title 猜测）：pwsh 用 `Set-Location -LiteralPath '…'`；cmd 用 `cd /d "…"`；bash/zsh 等用 `cd -- '…'`；无法判断时用 `cd "…"`。**pane 里正在运行 Agent（`pane.agent` 不为空）或 pane 没有在运行时，按钮禁用**，否则命令会被当作消息发给 Agent。pane 的目录变化后，目录树**不会**自动跳到新目录（只有切换 pane 时才会跟随），避免刚 cd 完树就被重置 |
| 剪贴板不可用时 | 例如通过局域网 HTTP 访问时没有剪贴板权限，会显示一个已全选的只读文本框，方便手动复制 |

**这一版不做的事：** 不把代码发送给 Agent（不使用 bracketed paste），代码只负责复制，由用户自己粘贴。唯一会写入终端的是「cd 到选中目录」按钮，而且只对 shell pane 可用。

### 文件
| 文件 | 内容 |
|---|---|
| `index.ts` | 注册菜单项（`header.more`）和抽屉（`app.overlay`） |
| `store.ts` | 抽屉的开关状态，以及按设备保存的偏好（宽度、树宽度、最大化、显示隐藏目录、复制格式）；使用 `useSyncExternalStore`，App 里不增加任何 state |
| `ProjectFiles.tsx` | 抽屉外壳、标题栏、宽度拖动、快速打开、移动端两级页面 |
| `Tree.tsx` | 懒加载的目录树 |
| `Preview.tsx` | 预览、选中行、复制 |
| `reference.ts` | 生成相对路径和引用文本（纯函数，有测试 `reference.test.ts`） |
| `terminal.ts` | 判断 shell、生成 cd 命令、检查是否允许发送、发送（有测试 `terminal.test.ts`） |
| `i18n.ts` | 扩展自己的词典（`tx`） |
| `project-files.css` | 样式（`pf-` 前缀，只使用 token） |

### 已知限制 / 后续（需要 server slot，即修改后端）
- 每个目录最多显示 500 项（服务端 `MAX_DIRECTORY_ENTRIES`），超出时只显示提示
- 目录树不遵循 `.gitignore`（只按上面的固定列表隐藏）；快速打开遵循 `.gitignore`
- 没有 git 状态标记（M/A/?），没有「某个 Agent 改过的文件」标记
- 目录树没有做虚拟滚动（每层最多 500 项，暂时够用）
- 文件变化不会自动刷新，需要手动点 [⟳]
- 超过 10,000 行的文件只能预览前 10,000 行
- 后续如果需要以上功能：在 `server/index.ts` 的认证检查之后加一个 `/api/ext/*` 转发（约 2 行），由扩展的后端处理

---

## 五、开发与验证

```bash
bun run typecheck
HERDR_TEST_MODE=unit bun test src/ext          # 扩展的单元测试（跳过启动 herdr 测试会话的步骤）
bun run build                                  # 正在运行的 server 读取的就是 dist/
```

- 「cd 到选中目录」（2026-10-13 新增）：通过了单元测试（各 shell 的引号处理、Agent pane 禁用）和构建；**还没有在浏览器中实际点击验证**。shell 类型是根据 pane 标题猜测的，猜错时会退回到 `cd "…"`
- 本次验证（Windows，herdr 0.9.3-preview）：菜单项、抽屉、目录树展开、文件预览、点击行号 / Shift+点击 / 拖选、复制引用的文本、在查看器中打开（FileViewer 在抽屉上层）、Escape 只关闭最上层 都已在浏览器中实际操作确认
- 注意：在 Windows 上，上游的 `src/conventions.test.ts` 有 4 个用例本来就会失败（路径分隔符 `\` 的问题），与扩展无关
