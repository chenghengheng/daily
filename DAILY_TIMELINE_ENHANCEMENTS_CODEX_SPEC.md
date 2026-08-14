# Daily 时间轴增强：图标识别、历史查看、任务结转、校准修复

> 基于上一轮「每日时间轴计划器」（`707562b` feat + `f90e133` fix）的四项增强。
> 日期：2026-08-14

## 1. 目标

对每日时间轴计划器做四项优化：

1. **图标识别范围扩大**：当前 `iconFor` 只能识别少数几组中文词，匹配规则过窄。扩大关键词映射并集中管理，UI 复用同一份规则。
2. **支持查看过去的计划**：当前「计划」页只展示未来计划、日期选择器 `min` 限制为明天，无法回看历史。
3. **未完成/未删除任务自动结转下一天**：新的一天打开时，把昨日未完成任务保留到今日，排在今日已有计划之后。
4. **校准修复**：点击「校准」后当前任务没有从现在开始，排期锚定逻辑有误。

## 2. 现状与根因

### 2.1 图标识别（`js/timeline-domain.js` `iconFor`）

```js
if (/早餐|午餐|晚餐|吃饭|咖啡/.test(title)) return '🍴';
if (/地铁|公交|通勤|打车|步行/.test(title)) return '🚇';
if (/缓冲|休息|等待/.test(title)) return '〰';
if (/会议|讨论|同步|复盘/.test(title)) return '⌖';
if (/日记|记录|写作|阅读/.test(title)) return '▤';
return '⚑';
```

- 仅 5 组固定词，子串匹配，无英文、无其他生活场景。
- `js/pages/timeline.js:93` 的 `journal` CSS 类用的是另一份正则 `/日记|记录|写作|阅读/`，与 `iconFor` 重复维护，易失配。

### 2.2 历史查看

- `Store.getTimelinePlans(fromDate)` 已能按日期区间返回，但 `TimelinePage.renderPlan` 只取 `>= tomorrow` 的计划，日期输入 `min="${tomorrow}"`。

### 2.3 任务结转

- 无结转逻辑。`load()` 当天无计划时直接 `createPlan('', ...)` 生成空计划。

### 2.4 校准

- `calibrate` 只消耗锚点之后的缓冲并重排「后续」事项，锚点自身开始时间不变；
- `schedule` 用 `remainingOffsetMinutes`（扣除缓冲后的剩余偏移）在**锚点之后**（`items[index-1].id === calibrationAfter`）累加到 cursor；
- 结果：当前任务始终停在原定开始时间，点击校准后「现在」卡不变，用户感知为「校准不可用」。

## 3. 设计

### 3.1 图标识别：集中式关键词映射表

在 `js/timeline-domain.js` 内新增（模块内常量 + 导出）：

- `iconRules`：有序数组，每项 `{ category, icon, patterns }`。`patterns` 为关键词数组，内部合并为正则，子串匹配、英文大小写不敏感。顺序即优先级，先匹配者胜。
- `iconCategoryFor(title)`：返回命中分类的 key（无命中返回 `'default'`）。供 UI 与图标共同复用。
- `iconFor(item)`：改为调用 `iconCategoryFor` → 查表返回图标。

分类表（`buffer` 项标题为「缓冲」时语义不变）：

| category | patterns | icon |
| --- | --- | --- |
| meal | 早餐、午餐、晚餐、早饭、午饭、晚饭、吃饭、咖啡、夜宵、加餐 | 🍴 |
| commute | 地铁、公交、通勤、打车、步行、骑车、骑行、开车、高铁、火车、飞机 | 🚇 |
| buffer | 缓冲、休息、等待、小憩、午休 | 〰 |
| meeting | 会议、讨论、同步、复盘、开会、洽谈、面试 | ⌖ |
| journal | 日记、记录、写作、阅读、读书、看书 | ▤ |
| study | 学习、复习、备考、上课、背单词、听写 | 📚 |
| sport | 运动、健身、跑步、锻炼、瑜伽、游泳、散步 | 🏃 |
| work | 工作、上班、加班、写代码、编程、开发、改bug | 💼 |
| housework | 家务、打扫、整理、洗衣、洗碗、拖地 | 🧹 |
| phone | 电话、通话、打电话、语音 | ☎ |
| fun | 娱乐、游戏、电影、追剧、动漫、刷手机 | 🎮 |
| sleep | 睡觉、起床、洗漱、洗澡、冥想 | 🛌 |
| shop | 购物、超市、买菜、逛街 | 🛒 |
| default | — | ⚑ |

- `js/pages/timeline.js:93` 的 `journal` 类改判 `TimelineDomain.iconCategoryFor(item.title) === 'journal'`，去掉重复正则。
- 新增单测覆盖各分类、命中优先级、英文大小写。

### 3.2 历史查看

**Store（`js/store.js`）**：不需要新 API。`getTimelinePlans('0001-01-01')` 返回全部计划（升序），UI 侧取 `localDate < today` 的部分倒序即得历史。

**`TimelinePage.renderPlan`（`js/pages/timeline.js`）**：

- 日期选择器去掉 `min`，默认 `today`；保存逻辑**移除 `date < tomorrow` 的拒绝校验**，允许任意日期回写（过去日期写入该日 `localDate` 的计划，未来日期为后续计划）。
- 顶部新增「历史」区：渲染过去计划卡片（日期、项数、开始时间、前 3 项预览），点击加载到编辑器（与现有 `future-card` 行为一致，`scrollIntoView` 到编辑器）。
- 保存按钮文案：选中日期 `< today` 显示「保存计划」，否则「保存后续计划」。
- 复用现有 `futurePlansHtml` 的卡片结构，抽象出 `planCardsHtml(plans)` 供未来/历史共用，样式可加一个 `history` 变体。

### 3.3 未完成任务结转

**领域层（`js/timeline-domain.js`）新增 `carryOver(plan, previousPlan, fromDate)`**：

- 幂等：若 `plan.carriedFromDate === fromDate`，直接返回 `null`（无变更）。调用方收到 `null` 不保存、不提示。
- 取 `previousPlan.items` 中 `status !== 'completed'` 的项：
  - **去掉 `fixedStartMinutes`**（改为 `undefined`），作为灵活任务追加 → 满足「排在当天已有计划之后」；
  - 保留 `title / kind / plannedDurationMinutes / note`；缓冲的 `remainingDurationMinutes` 保留（不重置，避免提前消耗的缓冲复活）；
  - 追加 `carriedFrom: fromDate` 标记；**保留原 id**（`tl_` 前缀按时间戳+随机生成，与当日项碰撞概率可忽略，且便于撤销与溯源）。
- 追加到 `plan.items` 末尾，重排 `order`，`plan.carriedFromDate = fromDate`，`updatedAt` 刷新，`sourceText = exportText(items)`。
- 返回新计划对象（克隆，不改原对象）。

**载入流程（`js/pages/timeline.js` `load()`）**：

- 取今日计划后（无则 `createPlan('')` 空计划），读昨日计划 `Store.getTimelinePlan(DateUtils.addDays(today, -1))`，调用 `carryOver`。
- 有变更则 `save()` 并 `Toast.show('已将昨日 N 项未完成任务结转')`。
- 即便昨日无未完成任务，也写 `carriedFromDate` 标记，避免每次打开重复扫描。

**UI**：时间轴条目若 `item.carriedFrom`，在标题旁显示小标签「昨日结转」（复用 `small` 样式，加一个 CSS 类）。编辑页 `sourceText` 已含结转项（`exportText` 自动带出），用户可自行删除/调整。

**滚动结转**：结转项若当日仍未完成，次日会再次结转，直到完成或删除。

### 3.4 校准修复：当前任务从现在开始

**`js/timeline-domain.js` `schedule`**：

- 读取 `execution.anchorStartAbsoluteMinutes`（新格式）。
- 到达**灵活锚点**项（`items[index].id === calibrationAfterItemId`；无锚点时 `index === 0`）时，将 cursor **设为** `anchorStartAbsoluteMinutes`（而非累加）。
- 无 `anchorStartAbsoluteMinutes` 的旧执行态走原逻辑（`remainingOffsetMinutes` 在锚点之后累加），已保存的旧校准计划渲染不变。
- 固定锚点项（`Number.isFinite(item.fixedStartMinutes)`）不套用「设为锚点开始」，维持固定时间，仅后续顺延。

**`calibrate`**：

- 先按当前执行态计算 `baseSchedule`，取锚点原开始 `baseSchedule[anchorIndex].startAbsoluteMinutes`（无锚点视为 `startTimeMinutes`）。
- **灵活锚点**：`anchorNewStart = 原开始 + offset`（即「现在」）。前缀（含锚点）保持顺序；后缀从 `anchorNewStart + effectiveDuration(锚点)` 起用现有 `reorderFutureAroundFixed` 重排。执行态写入 `anchorStartAbsoluteMinutes = anchorNewStart`、`calibrationAfterItemId`、`calibrationOffsetMinutes`、`remainingOffsetMinutes`（信息保留）。
- **固定锚点**：锚点不动，后缀从 `baseSchedule[anchorIndex].endAbsoluteMinutes + remaining` 重排，执行态保持旧格式（只有 `remainingOffsetMinutes` 等，不写 `anchorStartAbsoluteMinutes`）。
- 正向偏移优先消耗锚点之后、下一固定项之前的缓冲（现有逻辑保留）；负向偏移不消耗缓冲。
- 返回结构不变：`{ plan, consumed, remainingOffsetMinutes, schedule }`。

**UI**：无改动（校准弹窗文案「从现在继续…」已正确）。校准后 `renderNow` 重新 `current()`，因锚点现在落在 `now`，当前卡显示该任务从当前时刻开始。

## 4. 数据模型变更

- `plan` 增加 `carriedFromDate?: string`（结转过账标记）。
- `item` 增加 `carriedFrom?: string`（来源日期，用于 UI 标签）。
- `plan.execution` 增加 `anchorStartAbsoluteMinutes?: number`（新格式校准锚点）。
- 均为可选字段，向后兼容；`schemaVersion` 保持 1，无需迁移。

## 5. 数据流

- 载入「现在」页：`load()` → 读今日计划 → `carryOver` 合并昨日未完成 → 保存 → `schedule` → 渲染。
- 校准：点击校准 → 弹窗 → 确认 → `calibrate(plan, offset, anchorId)` → 新 `execution` + 重排 → `save` → `renderNow`。
- 历史查看：`renderPlan` → `getTimelinePlans(all)` 拆分未来/历史 → 选日期载入编辑器 → 保存回写对应 `localDate`。

## 6. 错误处理

- `carryOver`：昨日无计划、无未完成项、今日已结转均返回 `null`/无变更，不产生副作用。
- 校准：固定锚点/越界/负偏移沿用现有 clamp 与缓冲边界处理。
- 存储失败：`saveTimelinePlan` 已有 toast 提示，结转保存失败时放弃本次结转但不崩溃。

## 7. 测试

`tests/timeline-domain.test.js`：

- `iconCategoryFor` / `iconFor`：各分类命中、优先级（先命中分类胜出）、英文大小写、默认 `⚑`。
- `carryOver`：昨日未完成项追加到今日计划之后、去掉固定时间、缓冲保留剩余、`carriedFromDate` 幂等、已完不结转、无昨日计划返回 null。
- `calibrate`：灵活锚点开始 = 原开始 + 偏移（从现在开始）；后续撞固定项时固定项优先；固定锚点不移动仅顺延；缓冲优先消耗；负向提前。
- 更新既有测试 `校准导致后续普通事项撞上固定事项时优先固定锚点`：锚点预期从 `[840,860]` 改为 `[870,890]`。

`tests/ui.test.js`：结转后时间轴含「昨日结转」标签（如已有 DOM 测试设施）。

## 8. 文件清单

| 文件 | 变更 |
| --- | --- |
| `js/timeline-domain.js` | 图标映射表 + `iconCategoryFor`；`carryOver`；`calibrate`/`schedule` 校准锚定 |
| `js/pages/timeline.js` | `journal` 类判据；历史区 + 日期放开；`load()` 结转；结转标签 |
| `js/store.js` | 无必要改动（可选加注释） |
| `css/timeline.css` | 历史卡片变体 + 结转标签样式 |
| `index.html` / `sw.js` | 变更文件版本号（`?v=`）与 `CACHE` 版本提升，规避 PWA 旧缓存 |
| `tests/timeline-domain.test.js` | 新增 + 更新 |
| `tests/ui.test.js` | 结转标签 UI 测试 |

## 9. 不做的事（YAGNI）

- 不为结转项提供「一键清空昨日遗留」批量操作（用户可在编辑页删除）。
- 不新增图标手选覆盖（规格标注非首版必需）。
- 不重构 `reorderFutureAroundFixed` / `movePastFixedFirst` 的既有行为，只调整校准入口与光标语义。
