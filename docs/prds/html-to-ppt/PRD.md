# HTML → PPT 高还原度生成 PRD

> 作者：visher · 日期：2026-05-18 · 状态：进行中

---

## 目标

**用户说一句话，拿到一份视觉效果高度还原 HTML 模板的真原生 .pptx 文件。**

发给任何人都能打开、可编辑、字体不回退。

---

## 参考仓库

| 仓库                                                                                              | 内容                                                                                                                        | 本地路径                                                     | 用途                                                |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| [zarazhangrui/beautiful-html-templates](https://github.com/zarazhangrui/beautiful-html-templates) | 34 套精品 HTML 模板，每套含 template.json 元数据（mood/tone/palette/typography）                                            | `/tmp/beautiful-html-templates/`                             | 主要模板来源，MVP 用 Blue Professional              |
| [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides)                   | 动效优先 HTML 演示，同一作者                                                                                                | OpenDesign 已收录                                            | 动效风模板备选                                      |
| [op7418/guizang-ppt](https://github.com/op7418/guizang-ppt)                                       | 杂志风单套 HTML deck，WebGL 流体背景                                                                                        | `/Users/visher/code/open-design/skills/guizang-ppt/`         | 中文创意风模板备选                                  |
| [open-design](https://github.com/anthropics/open-design)（Anthropic）                             | 已把 beautiful-html-templates 全部 34 套收编进 `design-templates/html-ppt-zhangzara-*/`，统一 SKILL.md + template.json 协议 | `/Users/visher/open-design/`                                 | 组装工艺参考，模板结构协议照搬                      |
| open-design `pptx-html-fidelity-audit` skill                                                      | HTML → python-pptx 的完整工程纪律（Cursor 流、5 层字体纪律、verify_layout）                                                 | `/Users/visher/open-design/skills/pptx-html-fidelity-audit/` | 还原度方法论参考，我们用 officecli 替代 python-pptx |

**关键发现**：beautiful-html-templates 是原料，OpenDesign 是组装工艺。我们参考 OpenDesign 的协议结构，用 officecli 替代 python-pptx 作为执行器。

---

## 当前进度

### 已完成

- `assistantPresets.ts` 注册了「商务演示稿」助手
- 助手 rule 文件（中英）：告诉 Agent 它是谁、干什么
- `html-deck-builder/SKILL.md` 基础框架：配色、字体、布局描述

### 还差什么

SKILL.md 里只有**描述**，没有**可执行的 officecli 命令模板**。

这是核心缺失。没有命令模板，Agent 每次自由发挥，质量不稳定。

---

## 核心问题：如何高度还原？

### 不能这样做（质量无保证）

```
Agent 看 HTML 描述 → 自己想怎么画就怎么画 → officecli 命令 → PPT
```

Agent 做设计判断，每次结果不一样，还原度低。

### 应该这样做（质量固化）

```
HTML 模板（视觉参考）
    │
    ▼
人工把每种布局翻译成 officecli 命令模板
（坐标、颜色、字号全部固化）
    │
    ▼
写进 SKILL.md
    │
    ▼
Agent 只做一件事：把用户内容填进模板
    │
    ▼
officecli 执行 → 高还原度 .pptx
```

设计决策不让 Agent 做，全部预先固化在命令模板里。

---

## 模板视觉系统（Blue Professional）

来源：`https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/blue-professional`

### 配色（4 个 token，不引入其他颜色）

| Token      | 值        | 用途                     |
| ---------- | --------- | ------------------------ |
| bg         | `#FDFAE7` | 所有幻灯片背景           |
| primary    | `#1E2BFA` | 强调色：标题、图标、装饰 |
| text       | `#111111` | 正文主色                 |
| text_muted | `#6B6B6B` | 次要文字、页码           |

透明度变体（混合后近似实色，用于 officecli 不支持 opacity 时的降级）：

| 用途       | 原 CSS                 | 降级实色  |
| ---------- | ---------------------- | --------- |
| 卡片背景   | `rgba(30,43,250,0.04)` | `#F0F1FE` |
| 装饰浅色块 | `rgba(30,43,250,0.08)` | `#E3E5FD` |
| 边框       | `rgba(30,43,250,0.20)` | `#C2C6FB` |
| 大装饰圆   | `rgba(30,43,250,0.15)` | `#CDD0FC` |

### 字体

| 用途 | 字体               | officecli 写法                                                               |
| ---- | ------------------ | ---------------------------------------------------------------------------- |
| 标题 | Space Grotesk Bold | `--prop font="Space Grotesk" --prop bold=true --prop font.ea="Noto Sans SC"` |
| 正文 | Inter Regular      | `--prop font="Inter" --prop font.ea="Noto Sans SC"`                          |

### 画布

16:9，**33.87cm × 19.05cm**

坐标基准：左上角 (0,0)，向右为 x，向下为 y。

---

## officecli 能力边界（已调研）

### 支持

- 形状背景色：`--prop fill=1E2BFA`
- 圆形/椭圆：`--prop geometry=ellipse`
- 矩形（圆角）：`--prop geometry=roundRect`
- 文字颜色、字体、字号、加粗：标准 prop
- 幻灯片背景色：`officecli set "/slide[N]" --prop background.color=FDFAE7`
- 无边框：`--prop line.width=0`
- 文字对齐：`--prop align=left/center`
- 柱状图：`--prop chartType=bar`

### 不支持（需降级）

| HTML 效果                    | 降级方案                                 |
| ---------------------------- | ---------------------------------------- |
| `clip-path` 斜切多边形       | 用矩形近似，或放弃斜切改用纯色矩形       |
| 形状 `opacity`               | 用预混合实色代替（见配色表）             |
| 单边 border（`border-left`） | 在文字框左侧叠一个细长矩形 shape         |
| CSS 动画/过渡                | officecli `animation=fade-entrance` 代替 |
| 自定义多边形路径             | 用预设 geometry 近似                     |
| `font.ea` 东亚字体槽         | 待确认；若不支持则中文回退系统字体       |

---

## 每种布局的 officecli 命令模板

这是 SKILL.md 里最核心的内容，让 Agent 照着填内容。

### 全局设置（每页必须执行）

```bash
# 设背景
officecli set "/slide[N]" --prop background.color=FDFAE7

# 页码（右下角）
officecli add "/slide[N]" --type textbox \
  --prop x=30.87cm --prop y=18.3cm --prop width=2.5cm --prop height=0.5cm \
  --prop text="N / TOTAL" --prop font="Inter" --prop fontSize=11 \
  --prop color=6B6B6B --prop align=right
```

### layout-cover（封面）

```bash
# 右侧装饰色块（近似斜切，用矩形）
officecli add "/slide[N]" --type shape --prop geometry=rect \
  --prop x=22cm --prop y=0cm --prop width=11.87cm --prop height=19.05cm \
  --prop fill=E3E5FD --prop line.width=0

# 左上角点阵（3×2，6个小圆）
# 第1行
officecli add "/slide[N]" --type shape --prop geometry=ellipse \
  --prop x=2.5cm --prop y=1.2cm --prop width=0.18cm --prop height=0.18cm \
  --prop fill=C2C6FB --prop line.width=0
# ... 重复6次，间距 0.5cm

# 短横线装饰
officecli add "/slide[N]" --type shape --prop geometry=rect \
  --prop x=2.5cm --prop y=5.5cm --prop width=1.5cm --prop height=0.1cm \
  --prop fill=1E2BFA --prop line.width=0

# 主标题
officecli add "/slide[N]" --type textbox \
  --prop x=2.5cm --prop y=6cm --prop width=18cm --prop height=3.5cm \
  --prop text="[标题]" --prop font="Space Grotesk" --prop fontSize=48 \
  --prop bold=true --prop color=111111 --prop align=left

# 副标题
officecli add "/slide[N]" --type textbox \
  --prop x=2.5cm --prop y=9.8cm --prop width=16cm --prop height=1.5cm \
  --prop text="[副标题]" --prop font="Inter" --prop fontSize=20 \
  --prop color=6B6B6B --prop align=left

# 元信息（日期 · 作者）
officecli add "/slide[N]" --type textbox \
  --prop x=2.5cm --prop y=17.5cm --prop width=16cm --prop height=0.6cm \
  --prop text="[日期] · [作者]" --prop font="Inter" --prop fontSize=12 \
  --prop color=9A9A9A --prop align=left
```

### layout-content（内容页）

```bash
# kicker 小标签
officecli add "/slide[N]" --type textbox \
  --prop x=2.5cm --prop y=1.2cm --prop width=12cm --prop height=0.5cm \
  --prop text="[SECTION LABEL]" --prop font="Space Grotesk" --prop fontSize=11 \
  --prop color=1E2BFA --prop bold=true --prop align=left

# 主标题
officecli add "/slide[N]" --type textbox \
  --prop x=2.5cm --prop y=2cm --prop width=25cm --prop height=2cm \
  --prop text="[标题]" --prop font="Space Grotesk" --prop fontSize=36 \
  --prop bold=true --prop color=111111 --prop align=left

# 蓝色分隔线
officecli add "/slide[N]" --type shape --prop geometry=rect \
  --prop x=2.5cm --prop y=4.2cm --prop width=8cm --prop height=0.06cm \
  --prop fill=1E2BFA --prop line.width=0

# 正文
officecli add "/slide[N]" --type textbox \
  --prop x=2.5cm --prop y=4.6cm --prop width=28cm --prop height=12cm \
  --prop text="[正文内容]" --prop font="Inter" --prop fontSize=18 \
  --prop color=111111 --prop align=left
```

### layout-metrics（数据大字报，3列）

```bash
# 副标题
officecli add "/slide[N]" --type textbox \
  --prop x=2.5cm --prop y=1.5cm --prop width=25cm --prop height=1.8cm \
  --prop text="[副标题]" --prop font="Space Grotesk" --prop fontSize=32 \
  --prop bold=true --prop color=111111

# 3个 KPI 卡片，等宽排列
# 每张宽度：(33.87 - 2.5 - 2.5 - 1.2×2) / 3 ≈ 8.32cm，间距 0.6cm

# 卡片1背景
officecli add "/slide[N]" --type shape --prop geometry=roundRect \
  --prop x=2.5cm --prop y=4cm --prop width=8.32cm --prop height=11cm \
  --prop fill=F0F1FE --prop line.color=C2C6FB --prop line.width=1.5

# 卡片1数值
officecli add "/slide[N]" --type textbox \
  --prop x=3cm --prop y=4.8cm --prop width=7.32cm --prop height=2.5cm \
  --prop text="[数值]" --prop font="Space Grotesk" --prop fontSize=52 \
  --prop bold=true --prop color=1E2BFA

# 卡片1标签
officecli add "/slide[N]" --type textbox \
  --prop x=3cm --prop y=7.5cm --prop width=7.32cm --prop height=0.8cm \
  --prop text="[指标名]" --prop font="Space Grotesk" --prop fontSize=16 \
  --prop bold=true --prop color=111111

# 卡片1描述
officecli add "/slide[N]" --type textbox \
  --prop x=3cm --prop y=8.5cm --prop width=7.32cm --prop height=2cm \
  --prop text="[描述]" --prop font="Inter" --prop fontSize=14 \
  --prop color=6B6B6B

# 卡片2、卡片3：x 分别 +8.92cm、+17.84cm，其余相同
```

### layout-quote（大引言）

```bash
# 装饰引号
officecli add "/slide[N]" --type textbox \
  --prop x=10cm --prop y=2cm --prop width=14cm --prop height=3cm \
  --prop text='"' --prop font="Space Grotesk" --prop fontSize=120 \
  --prop bold=true --prop color=CDD0FC --prop align=center

# 引言文字
officecli add "/slide[N]" --type textbox \
  --prop x=4cm --prop y=5cm --prop width=25.87cm --prop height=6cm \
  --prop text="[引言内容]" --prop font="Space Grotesk" --prop fontSize=28 \
  --prop color=111111 --prop align=center

# 来源
officecli add "/slide[N]" --type textbox \
  --prop x=4cm --prop y=11.5cm --prop width=25.87cm --prop height=0.8cm \
  --prop text="— [来源]" --prop font="Inter" --prop fontSize=14 \
  --prop color=6B6B6B --prop align=center

# 左上角圆环装饰
officecli add "/slide[N]" --type shape --prop geometry=ellipse \
  --prop x=1.5cm --prop y=1.5cm --prop width=2.5cm --prop height=2.5cm \
  --prop fill=none --prop line.color=C2C6FB --prop line.width=1.5

# 右下角实心圆装饰
officecli add "/slide[N]" --type shape --prop geometry=ellipse \
  --prop x=29.5cm --prop y=15.5cm --prop width=2cm --prop height=2cm \
  --prop fill=E3E5FD --prop line.width=0
```

### layout-closing（结束页）

```bash
# 大圆环装饰（居中）
officecli add "/slide[N]" --type shape --prop geometry=ellipse \
  --prop x=7.44cm --prop y=1.53cm --prop width=19cm --prop height=16cm \
  --prop fill=none --prop line.color=C2C6FB --prop line.width=1

# 内圆环
officecli add "/slide[N]" --type shape --prop geometry=ellipse \
  --prop x=9.64cm --prop y=3.03cm --prop width=14.6cm --prop height=13cm \
  --prop fill=none --prop line.color=C2C6FB --prop line.width=1

# 短横线
officecli add "/slide[N]" --type shape --prop geometry=rect \
  --prop x=15.44cm --prop y=6.5cm --prop width=3cm --prop height=0.1cm \
  --prop fill=1E2BFA --prop line.width=0

# 主标题
officecli add "/slide[N]" --type textbox \
  --prop x=4cm --prop y=7.2cm --prop width=25.87cm --prop height=2.5cm \
  --prop text="[结束语]" --prop font="Space Grotesk" --prop fontSize=40 \
  --prop bold=true --prop color=111111 --prop align=center

# 副文字
officecli add "/slide[N]" --type textbox \
  --prop x=6cm --prop y=10cm --prop width=21.87cm --prop height=1.5cm \
  --prop text="[联系方式或 CTA]" --prop font="Inter" --prop fontSize=18 \
  --prop color=6B6B6B --prop align=center
```

---

## Agent 的工作流程（固化后）

```
1. 理解用户主题，规划 6-10 页结构，选择每页布局

2. officecli new deck.pptx

3. 逐页执行：
   a. officecli add "/" --type slide
   b. 执行全局设置（背景 + 页码）
   c. 从命令模板选对应布局
   d. 把 [占位符] 替换成真实内容
   e. 执行几何检查（x+w ≤ 33.87，y+h ≤ 19.05）

4. 交付：<project>/decks/<slug>/deck.pptx
```

Agent **不做任何设计判断**，只填内容。

---

## 与 officecli 的协作关系

```
AionUi 助手（载体）
    │ 加载
    ▼
html-deck-builder SKILL.md（命令模板库）
    │ 调用
    ▼
officecli（执行器）
    │ 输出
    ▼
.pptx（真原生，可编辑，字体嵌入）
```

SKILL.md 是**中间翻译层**，把 HTML 模板的视觉语言翻译成 officecli 可执行命令，固化质量。

---

## 未来：任意 HTML 模板 → PPT

当前只做了 Blue Professional 一套。

未来扩展路径：

1. 每加一套 HTML 模板，就分析它的布局 + CSS
2. 翻译成对应的 officecli 命令模板
3. 写进新的 SKILL.md 或扩展现有的
4. 注册新助手，选不同模板

34 套 zarazhangrui 模板 + Guizang + 任意新模板，都可以用这套方法处理。

---

## 下一步

1. 把命令模板写进 `html-deck-builder/SKILL.md`（当前版本只有描述，缺命令）
2. 在 AionUi 测试环境验证：说一句话 → Agent 输出 officecli 命令 → 生成 deck.pptx
3. 几何审计脚本确认无溢出
4. 字体确认（Space Grotesk + Inter 本地已装？）
