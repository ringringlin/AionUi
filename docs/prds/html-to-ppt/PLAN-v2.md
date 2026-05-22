# HTML → PPT 高还原度方案 · 第二版规划

> 作者：visher · 日期：2026-05-19
> 状态：规划中 · 待你审批

---

## 一、目标（不变）

**用户在 AionUi 说一句话 → 拿到一份视觉效果高度还原原 HTML 模板的 .pptx**

发给任何人都能打开、文字可编辑、字体不回退、几何装饰尽量保留。

---

## 二、当前现状

### 我们做了什么

两个对照助手，挂在 AionUi 后端：

| 助手                     | 路线                                       | 中间产物 | 最终交付                  |
| ------------------------ | ------------------------------------------ | -------- | ------------------------- |
| **Deck A · HTML First**  | HTML 模板复制改写 → HTML deck → 按需转 PPT | HTML     | HTML（主）+ .pptx（按需） |
| **Deck B · PPTX Direct** | HTML 模板读 → officecli batch 直出         | 无       | .pptx                     |

资源池：[zarazhangrui/beautiful-html-templates](https://github.com/zarazhangrui/beautiful-html-templates) 34 套模板，全量入库 [examples/html-deck-comparison/templates/](../../../examples/html-deck-comparison/templates/)

### 跑出来的效果

| 测试场景                            | A 产物（HTML）                        | B 产物（.pptx）                             |
| ----------------------------------- | ------------------------------------- | ------------------------------------------- |
| 观夏发布会（grove 模板，文字主导）  | ✅ 完美还原 grove 视觉                | ⚠️ 颜色对、字体对，**布局节奏弱、装饰丢失** |
| 黑胶发行（sakura-chroma，几何主导） | ✅ 完整还原斜带 + 齿轮徽章 + 多色圆点 | ❌ **大量装饰元素缺失**，看着像普通 PPT     |

**核心问题（你的实测判断）**：

> HTML 方案明显好看很多，文字排版问题，比我们 officecli 直接生成的好

差距具体在三个维度：

1. **文字排版节奏弱** — Agent 凭直觉决定 y 坐标，元素间距不稳定
2. **装饰几何缺失** — sakura-chroma 的彩虹斜带、12 角徽章、多色圆点全没了
3. **字体保真不足** — 中文字体没有强制 fallback 链

### 残酷的事实

**HTML 是无损介质，.pptx 是有损介质**——两者不可能 100% 一致。但目前的差距远大于"介质不可避免的损失"，是**翻译质量不够**导致的，是**可以追平的**。

---

## 三、参照品调研

### 参照品 1：open-design（Anthropic 开源参考实现）

**核心方法**（我解剖了他们仓库里 `.od/projects/.../export_pptx.py` 803 行脚本 + audit skill）：

| 纪律             | 内容                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **Cursor 摆位**  | 不让 Agent 拍脑袋决定 y。每写一个元素，由 Cursor 按"前一个元素高度 + 固定间隙"自动累加 y |
| **footer rail**  | 强制 `CONTENT_MAX_Y = 17.5cm`，任何元素跨过 footer 就报错                                |
| **字号梯度锁死** | 9pt / 10pt / 14pt / 28pt / 60pt / 180pt — 6 档固定                                       |
| **语义命名**     | 每个 shape 必须 `slide-N.role`，便于 audit                                               |
| **5 层字体纪律** | Latin 槽 + EA 槽 + 静态字体名 + italic 仅 Latin + CJK fallback 链                        |
| **审计验证**     | `verify_layout.py` 跑完不通过 = 不算完，自动重做                                         |

**还原度评估**（亲眼看了他们的产物 `index.pptx`）：

✅ **能做到**：纯文字 editorial 风的还原（grove / monochrome 这类）
❌ **做不到**：装饰几何（柴 3D 模型直接放弃，写了个"3D · GLB"灰框 placeholder）

**真相**：open-design **没解决装饰几何**。他们的成功案例都是"PPT-friendly 文字主导"风格，本来就不需要复杂几何。

### 参照品 2：Claude Design（闭源，从产品行为反推）

走的是"web-safe 字体白名单 + 通用配色"路线，**主动回避**字体保真和装饰几何挑战。视觉创意上限低，但永远不会跑成宋体回退。Anthropic 的 `a-pptx` skill 是这条路线的开放版本。

### 我们对比参照品的位置

| 维度     | open-design                | Claude Design              | 我们当前                          | 我们应该            |
| -------- | -------------------------- | -------------------------- | --------------------------------- | ------------------- |
| 文字纪律 | ✅ 完整（800 行手写）      | ⚠️ 弱（web-safe 字体兜底） | ❌ 缺 Cursor/字号梯度/footer rail | 复刻 open-design    |
| 装饰几何 | ❌ 放弃                    | ❌ 不挑战                  | ❌ 没做                           | **超过他们**        |
| 字体保真 | ✅ 5 层纪律                | ❌ 限定字体绕过            | ⚠️ 双槽设了但不严格               | 复刻 open-design    |
| 工具链   | python-pptx（800 行/deck） | PptxGenJS（声明式）        | **officecli batch**（71 行/deck） | 利用 officecli 优势 |

---

## 四、officecli 的独有优势

我们的 officecli 比 python-pptx **多了 3 件武器**：

| 武器                                                                                          | 能做什么                                    | 实测可行                                            |
| --------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `rotation`                                                                                    | 任意角度旋转矩形/形状                       | ✅ 6 条彩虹斜带已实测                               |
| 9 种 `geometry`（rect/roundRect/ellipse/triangle/diamond/parallelogram/star5/rightArrow/...） | 复合形状叠加                                | ✅ 12 角齿轮徽章 = 2 个 star5 旋转 36° 叠加，已实测 |
| `gradient`（linear/radial/多 stop）                                                           | 渐变光晕、彩带                              | ✅ 支持完整                                         |
| 加 `batch` 一次提交                                                                           | 71 行 JSON = open-design 800 行 Python 等价 | ✅ 观夏 deck 已实测                                 |

**这是参照品都没做到的事**。如果做好，**我们能在装饰几何这一维度领先 open-design 和 Claude Design**。

---

## 五、规划

### 阶段 1：复刻 open-design 的文字纪律（让 B 在文字主导模板上达到 open-design 水平）

| 任务                                                                | 工作量 | 交付物                         |
| ------------------------------------------------------------------- | ------ | ------------------------------ |
| 把 Cursor 摆位规则写进 Deck B SKILL                                 | 0.5 天 | SKILL.md 中段更新              |
| 把字号梯度（6 档锁死）写进 SKILL                                    | 0.5 天 | SKILL.md 中段更新              |
| 把 footer rail + canvas bound 检查写进 SKILL                        | 0.3 天 | SKILL.md Step 6 强化           |
| 把 5 层字体纪律写进 SKILL（复刻 open-design 的 font-discipline.md） | 0.5 天 | SKILL.md 新章节                |
| Deck A 导出 PPT 步骤共享同样纪律                                    | 0.3 天 | deck-html-first.md Step 8 更新 |

**预期**：B 在 grove / blue-professional / monochrome / vellum / signal 等约 15 套"文字主导"模板上还原度从 ~70% 提升到 ~85%。

### 阶段 2：装饰几何翻译表（超过 open-design）

| 任务                                                      | 工作量 | 交付物                                |
| --------------------------------------------------------- | ------ | ------------------------------------- |
| 调研 34 套模板的装饰元素清单                              | 1 天   | 一份"装饰元素 → officecli 几何"映射表 |
| 写"复合形状翻译表"（≥15 条常见装饰）                      | 1 天   | SKILL.md 装饰章节                     |
| 实测 5 个最难的（齿轮徽章/彩虹斜带/纸张噪点/印章/进度条） | 1 天   | 5 个验证 .pptx + 截图对比报告         |
| Agent 在装饰元素无法翻译时的兜底策略（截图嵌入 PNG）      | 0.5 天 | SKILL.md 兜底章节                     |

**翻译表草稿**（已实测可行的部分）：

```
HTML / CSS 元素              officecli 复合实现
─────────────────────────────────────────────────────
clip-path 12 角星徽章        2× star5 + rotation 0°/36° + 中心 ellipse
clip-path 8 角星徽章         2× star5 + rotation 0°/22.5°
clip-path 自定义多边形       任意多个 triangle/diamond 叠加近似（最多近似 80%）
linear-gradient 彩色斜带     rect + rotation N° + gradient (按色调)
radial-gradient 光晕         ellipse + gradient="radial:C1-C2-center"
border-radius 圆环           ellipse + line.color + fill=none
transform: rotate 旋转印章   rect/roundRect + rotation
border-left 4px solid 单边   细长 rect 贴边
进度条 / 数据条              2 个 rect 叠加（底色 + 填充）
网格背景                     批量细 rect 叠加
五色圆点叠加 (overlap)       3-4 个 ellipse + opacity 不同
横向虚线分割                 多个小 rect 等距排列
绝对定位的角标               textbox + rotation + small font
text-shadow / 阴影           textbox + shadow prop
```

**兜底策略**：实在做不到的（如 CSS `filter: blur` / 复杂 SVG / 真实照片），用 Chrome headless 把该元素**单独截图**为 PNG，作为 picture 嵌入 PPT（局部图片，文字仍可编辑）。

**预期**：sakura-chroma / 8-bit-orbit / peoples-platform 等约 10 套"几何主导"模板还原度从 ~30% 提升到 ~75%。

### 阶段 3：模板归一化（长期）

为 34 套模板各写一份"模板适配文件"（约 30 行/套），统一 class 词汇 → officecli 命令的映射，让 Agent 不用现场猜每个 class 的意图。

**工作量**：每套约 1-2 小时，34 套合计 ~4-5 天。可以分阶段做（先做用户最常用的 8-10 套）。

**预期**：所有 34 套模板还原度统一到 ~80-90%（PPT 介质天花板）。

---

## 六、需不需要 team

| 任务                                        | 谁干                                  |
| ------------------------------------------- | ------------------------------------- |
| 阶段 1（文字纪律复刻）                      | 1 个工程师（你 + Claude），3 天       |
| 阶段 2（装饰几何翻译表）                    | 1 个工程师 + 1 个设计师审视觉，3-5 天 |
| 阶段 3（模板归一化 × 34）                   | 1-2 个工程师 + 设计师监督，2 周分阶段 |
| 后续维护（新模板入库 / officecli 能力扩展） | 持续投入，每新模板 ~2 小时            |

**最小可行 team**：1 个工程师 + 1 个设计师，2 周做完阶段 1+2，覆盖 25 套模板 ~80% 还原度。

**是否需要 team**：阶段 1+2 你跟 Claude 配合完全能做，**不需要额外人**。阶段 3 + 持续维护建议拉一个设计师同事帮看视觉。

---

## 七、决策点（请你拍板）

### 决策 1：是否启动阶段 1+2？

- ✅ 启动 → 我立刻去改 Deck A/B SKILL，2-3 天内能跑出"准 open-design 水平"的 PPT
- ❌ 暂停 → 当前能用，先做别的

### 决策 2：装饰几何兜底策略

- (a) 实在不能翻译的，**截图嵌入 PNG**（局部不可编辑但视觉 100%）
- (b) 实在不能翻译的，**直接省略**（保持 100% 可编辑但视觉残缺）
- (c) 让用户选

### 决策 3：模板归一化优先级

- (a) 先做 10 套热门的（blue-professional / grove / 8-bit-orbit / sakura-chroma / peoples-platform / vellum / monochrome / signal / cobalt-grid / editorial-forest）
- (b) 一次性 34 套全做
- (c) 不做，依赖 Agent 现场判断

### 决策 4：是否需要拉人

- (a) 你 + Claude 跑完阶段 1+2 → 看效果再说
- (b) 现在就拉设计师同事 review 阶段 2 的视觉
- (c) 直接组 team 干阶段 3

---

## 八、衡量标准（PRD 是否达成）

阶段 1 验收：

- [ ] Deck B 跑观夏（grove）—— y 间距规律、字号 6 档分明
- [ ] PPT 中文显示为衬线字体（不是黑体回退）
- [ ] 跑 audit 0 violations
- [ ] 视觉对比 open-design 的产物，**不输他们**

阶段 2 验收：

- [ ] Deck B 跑黑胶（sakura-chroma）—— **彩虹斜带、12 角徽章、多色圆点都出现**
- [ ] 视觉对比 HTML 源文件，**还原度 ≥ 70%**
- [ ] 对比当前版本，**视觉感受拉开明显差距**

阶段 3 验收：

- [ ] 34 套模板每套都有适配文件
- [ ] 任意一套模板跑 B，还原度 ≥ 75%
- [ ] 平均 ≥ 80%

---

## 附录：当前 SKILL 文件位置

- Deck A：[examples/html-deck-comparison/skills/deck-html-first.md](../../../examples/html-deck-comparison/skills/deck-html-first.md)
- Deck B：[examples/html-deck-comparison/skills/deck-pptx-direct.md](../../../examples/html-deck-comparison/skills/deck-pptx-direct.md)
- 模板库：[examples/html-deck-comparison/templates/](../../../examples/html-deck-comparison/templates/)（34 套全量）
- 实测产物（桌面）：
  - `B-indie-vinyl.pptx` — B 当前水平
  - `opendesign-shiba-result.pptx` — open-design 参照品
  - `rainbow-stripes-test.pptx` — officecli 斜带能力验证
  - `badge-test.pptx` — officecli 12 角徽章能力验证
