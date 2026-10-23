# 本地主题 eink_custom（彩色墨水屏）

> 2026-10-23 新增，基于上游 `4f0a9047`。

给彩色墨水屏（Kaleido 一类滤色片屏）用的**亮色**主题：白底黑字、用边框代替阴影、额外的背景用强调色和状态色的淡色（桃、粉、薄荷绿），不用灰色，也不用黄色。
配色根据真机色卡测试选定（见第二节）：每个用途用一种在屏上能和其他颜色分开的颜色。

使用方法：设置 → 外观 →「主题」选「亮色」，「亮色主题」选「电子墨水（自定义）」。
这个主题只有亮色块，选在「暗色主题」一侧时，显示的也还是亮色。

---

## 一、对上游文件的改动（合并时重点检查）

主题没办法放进 `src/ext/`：颜色字面量只允许写在 `src/styles.css` 里（`src/conventions.test.ts` 会检查），
`THEME_IDS` 是由 `styles.css` 生成的编译期常量，`theme-bootstrap.ts` 也不会加载扩展。所以只能用上游自己的主题方式添加，并尽量只加行。

| 文件 | 改动 | 合并冲突时 |
|---|---|---|
| `src/styles.css` | **文件末尾**追加 `[data-theme="light"][data-palette="eink_custom"] { … }` | 保留这一块即可（解析器扫描整个文件，放在哪里都行） |
| `src/lib/themes.generated.ts` | 生成文件 | 随便选一边，然后运行 `bun run generate:themes` |
| `DESIGN.md` | 生成的 ANSI 表格多了一列 `eink_custom` | 同上，运行生成脚本 |
| `src/components/SettingsDialog.tsx` | `THEME_NAMES` 增加 `eink_custom: "E-ink Custom",` | 重新加上这一行 |
| `src/lib/i18n/settings.{zh,ja,ko}.ts` | 各增加一行 `"E-ink Custom": …` | 重新加上 |
| `shared/telemetry.ts` | `TELEMETRY_THEME_IDS` 增加 `"eink_custom"`（不加的话 `settings.ts` 的类型检查会失败） | 重新加上 |
| `scripts/herdr-theme-overrides.ts` | `APP_THEME_IDS` 增加 `"eink_custom"`（说明这个主题不对应 herdr 的配色） | 重新加上 |

除了生成的文件和 `styles.css` 的颜色块，其他每处都带有 `local theme` 注释：

```
git grep -n "local theme" -- src shared scripts
```

合并上游之后：`bun run generate:themes` → `bun run typecheck` → `bun run build`。

**已知的测试失败**：`scripts/telemetry-deployed.test.ts`（"the deployed Worker is this tree's"）会失败。
它比较 `shared/telemetry.ts` 的指纹和上游已部署的 Worker，只要改了这个文件就会失败。这是上游发版时的检查，对 fork 没有影响。
上游的 Worker 不认识 `eink_custom`，所以选了这个主题时，本机的匿名统计事件会被丢弃（等于不上报）。

---

## 二、配色

### 依据：真机色卡测试（2026-10-23，`../doc/eink-swatches.html`）

文字颜色在白底上的结果（「相近组」= 在屏上分不开的颜色）：

| 在屏上看起来是同一种颜色 | 成员 |
|---|---|
| 黑 | `#000000` `#333333` `#444444` `#555555` `#777777`（所有灰都和黑分不开；`#999999` 看不清） |
| 暗色混成一团 | 绿 `#007a00` `#008a00` `#006b00` `#3d7a00`、棕 `#8a3a00`、土黄 `#7a5200` `#8a6a00`、紫 `#6a1b9a`、灰蓝 `#155a72` |
| 橙 / 暗红 | `#a84400` `#c05000` `#990000` |
| 红 | `#cc0000` `#e00000` |
| 青 | `#008080` `#007f7f` `#006b6b` `#008060` |

没有被分进任何组、而且评为「清楚」的：品红 `#a0007a` `#b8008a` `#8a008a`、蓝 `#0033aa` `#1565c0`、亮橙 `#d06000`、黄 `#9a7000` `#b08800`。
**蓝色在这台设备上其实是清楚的**（`#0044dd` 只是「一般」），所以 ANSI blue 改回了蓝色。

背景色：灰色背景（`#e0e0e0` 到 `#b0b0b0`）全部看不清；淡色背景都是「一般」。所以表面全部用白色，额外的背景用淡的桃色、粉色、薄荷绿，不用灰色。淡黄在普通屏幕上太刺眼，也不用。

### 做法：每个用途从一个「能分开的颜色家族」里取一种

可用的家族：**黑、红、橙、绿、青、品红、蓝**。「暗色混成一团」那一组里只用绿色，其他（棕、土黄、紫）都不用。
亮橙 `#d06000` 和黄 `#9a7000` 虽然看得清，但和白底的对比度不到 4.5:1，过不了上游的测试，所以没用。

| 用途 | token | 值 |
|---|---|---|
| 背景（全部表面） | `bg` `bg-panel` `bg-elevated` `bg-input` | 白 `#ffffff` |
| 悬停 | `bg-hover` | 很淡的桃色 `#fff4ec` |
| 选中行、标记行 | `accent-tint` `primary-tint` | 桃色 `#ffe8d8` |
| 危险提示底色 | `danger-tint` | 粉 `#ffe0e0` |
| 终端选区 | `term-selection` | 较深的桃色 `#ffd0b0` |
| 弹窗遮罩 | `scrim` | 和其他浅色主题一样用中性黑，但只有 8%：`rgba(0, 0, 0, 0.08)`（白底上约 `#ebebeb`）。普通屏幕上轻微变暗；墨水屏上浅灰背景显示不出来，基本不变色 |
| 状态徽章底色 | `status-working/blocked/done-tint` | 桃 `#ffe8d8` / 粉 `#ffe0e0` / 薄荷绿 `#e0f2e0`（色卡里都是「一般」，徽章文字对比度 4.7–5.1:1） |
| 边框 | `border` / `border-strong` | `#555555` / `#000000` |
| 文字 | `text` `text-strong` / `text-dim` | `#000000` / `#333333`（在屏上看起来都是黑） |
| 强调、运行中、提示 | `accent` `status-working` `notice` | 橙 `#a84400` |
| 阻塞、危险 | `status-blocked` `danger-text` | 红 `#cc0000` |
| 完成 | `status-done` | 绿 `#007a00` |
| 空闲 | `status-idle` | `#555555` |
| 侧边栏状态点 | `indicator-working/blocked/done/idle/unknown` | 橙 / 红 / 青 / 绿 / `#555555` |
| 主按钮 | `primary` / `primary-text` | 黑 / 白 |
| 阴影 | `shadow-*` | 全透明，`shadow-pop` 保留 1px 描边 |
| 终端 | `term-bg` / `term-fg` / `term-cursor` | 白 / 黑 / 黑 |
| 代码高亮 | function / keyword / string / number / type / variable / meta | 橙 / 品红 / 绿 / 红 / 青 / 黑 / 蓝 |

终端 ANSI（白底上都至少有 4.5:1 的对比度）：

| | 普通 | bright |
|---|---|---|
| black | `#000000` | `#555555`（在屏上和黑色分不开，见下） |
| red | `#cc0000` | `#e00000` |
| green | `#007a00` | `#008a00` |
| yellow | 橙 `#a84400` | 橙 `#c05000` |
| blue | `#0033aa` | `#1565c0` |
| magenta | `#a0007a` | `#b8008a` |
| cyan | `#008080` | `#007f7f` |
| white | `#444444` | `#000000` |

**已知限制**：灰色都和黑色分不开，所以 `text-dim`、bright black（注释、zsh/fish 的自动补全提示）在屏上看起来和正文一样。
浅一点的灰（`#999999`）又看不清。可以考虑把 bright black 换成某个颜色，但会让灰色语义的内容变成彩色。

**还没在真机上验证**：`#fff4ec`（悬停）、`#ffd0b0`（终端选区）和遮罩；`#ffe8d8` `#ffe0e0` `#e0f2e0` 在色卡里测过，都是「一般」。

上游的测试会检查对比度（`src/lib/settings.test.ts` palette）：文字、状态徽章（状态色叠在对应的 tint 上）、代码高亮、ANSI 颜色都要达到 4.5:1。

调颜色的方法：修改 `styles.css` 里的颜色块 → `bun run generate:themes` → 运行测试
`HERDR_TEST_MODE=unit bun test src/lib/settings.test.ts scripts/herdr-themes.test.ts src/lib/i18n.test.ts`。

---

## 三、扩展 `src/ext/appearance/`（不改上游文件）

只有 CSS，不注册菜单或视图，由 `src/ext/load.ts` 自动加载。

| 规则 | 作用 |
|---|---|
| `:root:lang(zh) { --font-ui: … }` | **中文界面的字体**。上游打包的界面字体 Pretendard 只有拉丁字母和韩文，没有中文，中文会回退到系统字体，同一行里英文和中文来自两种字体，看起来粗细不一。中文界面（`<html lang="zh-CN">`）改为中文字体优先：PingFang SC（mac/iOS）、Microsoft YaHei UI（Windows）、Noto Sans CJK SC / Noto Sans SC（Android、Linux）等，这些字体都带拉丁字母，一整行来自同一种字体。所有主题都生效 |
| `[data-palette="eink_custom"] ::selection` | **网页文字选区**。浏览器默认的选区是系统蓝色，灰色文字在上面看不清。改成主题的桃色选区（`--term-selection`）加黑色文字。只在 eink_custom 主题下生效 |

终端和代码使用等宽字体（`--font-mono` 和终端自己的字体），不受这里影响；终端字体可以在 设置 → 终端字体 里改。
