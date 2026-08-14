# Daily 时间轴增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为时间轴计划器实现四项增强：图标识别范围扩大、历史计划查看、未完成任务自动结转下一天、校准后当前任务从现在开始。

**Architecture:** 纯逻辑集中在 `js/timeline-domain.js`（图标映射、`carryOver`、`calibrate`/`schedule` 校准锚定），UI 逻辑在 `js/pages/timeline.js`，样式在 `css/timeline.css`。每项功能独立可测，测试用 `node --test tests/*.test.js`。

**Tech Stack:** 原生 JS（UMD 模块、无构建）、localStorage 持久化、PWA Service Worker 缓存、`node:test` 单测。

**Spec:** `DAILY_TIMELINE_ENHANCEMENTS_CODEX_SPEC.md`

## Global Constraints

- 保持 `schemaVersion: 1`，所有新增字段（`carriedFromDate`、`item.carriedFrom`、`execution.anchorStartAbsoluteMinutes`）均可选，向后兼容旧数据。
- 不改 `js/store.js` 与 `js/app.js`（`?v=13` / `?v=9` 版本号不变，`tests/ui.test.js:25-26` 依赖它们）。
- 固定事项（`fixedStartMinutes`）的开始时间永远不移动（校准规格）。
- 单测用 `node --test tests/timeline-domain.test.js` 或 `npm test` 运行；`npm run check` 做全量语法检查 + 测试。
- 提交信息沿用仓库风格（`feat:` / `fix:` / `chore:`）。

---

### Task 1: 图标识别映射表（范围扩大 + UI 复用）

**Files:**
- Modify: `js/timeline-domain.js:195-203`（`iconFor`）与 `:225`（导出）
- Modify: `js/pages/timeline.js:93`（`journal` CSS 类判据）
- Test: `tests/timeline-domain.test.js`（追加）

**Interfaces:**
- Produces: `TimelineDomain.iconCategoryFor(title: string) => string`（返回 `'meal'`…`'default'`）；`TimelineDomain.iconFor(item) => string` 行为扩展；`ICON_RULES` 常量（内部）。

- [ ] **Step 1: 追加失败测试**

在 `tests/timeline-domain.test.js` 末尾追加：

```js
test('图标识别覆盖更多生活场景', () => {
  const samples = [
    ['早餐', '🍴'], ['咖啡', '🍴'], ['夜宵', '🍴'],
    ['高铁通勤', '🚇'], ['打车', '🚇'],
    ['跑步', '🏃'], ['健身', '🏃'], ['瑜伽', '🏃'],
    ['学习英语', '📚'], ['复习', '📚'], ['背单词', '📚'],
    ['写代码', '💼'], ['加班', '💼'],
    ['打扫卫生', '🧹'], ['洗碗', '🧹'],
    ['打电话', '☎'],
    ['追剧', '🎮'], ['看电影', '🎮'],
    ['睡觉', '🛌'], ['冥想', '🛌'],
    ['超市采购', '🛒'], ['买菜', '🛒'],
    ['随便什么', '⚑'],
  ];
  samples.forEach(([title, icon]) => assert.equal(Timeline.iconFor({ title, kind: 'normal' }), icon));
});

test('图标分类可供 UI 复用且大小写不敏感', () => {
  assert.equal(Timeline.iconCategoryFor('写BUG'), 'work');
  assert.equal(Timeline.iconCategoryFor('读书'), 'journal');
  assert.equal(Timeline.iconCategoryFor('缓冲'), 'buffer');
  assert.equal(Timeline.iconCategoryFor('X'), 'default');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/timeline-domain.test.js`
Expected: 新增两个测试 FAIL（`iconFor` 仍返回旧结果 / `iconCategoryFor is not a function`）。

- [ ] **Step 3: 实现映射表**

在 `js/timeline-domain.js` 中把 `iconFor` 函数整体替换为：

```js
  const ICON_RULES = [
    { category: 'meal', icon: '🍴', patterns: ['早餐','午餐','晚餐','早饭','午饭','晚饭','吃饭','咖啡','夜宵','加餐'] },
    { category: 'commute', icon: '🚇', patterns: ['地铁','公交','通勤','打车','步行','骑车','骑行','开车','高铁','火车','飞机'] },
    { category: 'buffer', icon: '〰', patterns: ['缓冲','休息','等待','小憩','午休'] },
    { category: 'meeting', icon: '⌖', patterns: ['会议','讨论','同步','复盘','开会','洽谈','面试'] },
    { category: 'journal', icon: '▤', patterns: ['日记','记录','写作','阅读','读书','看书'] },
    { category: 'study', icon: '📚', patterns: ['学习','复习','备考','上课','背单词','听写'] },
    { category: 'sport', icon: '🏃', patterns: ['运动','健身','跑步','锻炼','瑜伽','游泳','散步'] },
    { category: 'work', icon: '💼', patterns: ['工作','上班','加班','写代码','编程','开发','改bug'] },
    { category: 'housework', icon: '🧹', patterns: ['家务','打扫','整理','洗衣','洗碗','拖地'] },
    { category: 'phone', icon: '☎', patterns: ['电话','通话','打电话','语音'] },
    { category: 'fun', icon: '🎮', patterns: ['娱乐','游戏','电影','追剧','动漫','刷手机'] },
    { category: 'sleep', icon: '🛌', patterns: ['睡觉','起床','洗漱','洗澡','冥想'] },
    { category: 'shop', icon: '🛒', patterns: ['购物','超市','买菜','逛街'] },
  ];

  function iconCategoryFor(title) {
    const text = String(title || '').toLowerCase();
    for (const rule of ICON_RULES) {
      if (rule.patterns.some(pattern => text.includes(pattern.toLowerCase()))) return rule.category;
    }
    return 'default';
  }

  function iconFor(item) {
    const title = item.kind === 'buffer' ? '缓冲' : item.title;
    const rule = ICON_RULES.find(entry => entry.category === iconCategoryFor(title));
    return rule ? rule.icon : '⚑';
  }
```

在 `:225` 的导出对象中加入 `iconCategoryFor`：

```js
  return { parseLine, parseText, schedule, calibrate, formatMinutes, exportText, iconFor, iconCategoryFor, normalizePlanOrder, createPlan, parseClock };
```

- [ ] **Step 4: 让 UI 复用同一规则**

在 `js/pages/timeline.js:93`，把：

```js
      const classes = ['entry', item.kind === 'buffer' ? 'buffer' : '', Number.isFinite(item.fixedStartMinutes) ? 'fixed' : '', /日记|记录|写作|阅读/.test(item.title) ? 'journal' : '', item.status === 'completed' ? 'is-complete' : '', slot.conflict ? 'conflict' : ''].filter(Boolean).join(' ');
```

改为：

```js
      const classes = ['entry', item.kind === 'buffer' ? 'buffer' : '', Number.isFinite(item.fixedStartMinutes) ? 'fixed' : '', TimelineDomain.iconCategoryFor(item.title) === 'journal' ? 'journal' : '', item.status === 'completed' ? 'is-complete' : '', slot.conflict ? 'conflict' : ''].filter(Boolean).join(' ');
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/timeline-domain.test.js`
Expected: 全部 PASS（含既有排期/校准测试）。

- [ ] **Step 6: 提交**

```bash
git add js/timeline-domain.js js/pages/timeline.js tests/timeline-domain.test.js
git commit -m "feat: broaden timeline icon keyword matching and share it with UI"
```

---

### Task 2: 结转领域函数 `carryOver`

**Files:**
- Modify: `js/timeline-domain.js`（新增 `carryOver`，追加导出）
- Test: `tests/timeline-domain.test.js`（追加）

**Interfaces:**
- Consumes: `DateUtils.addDays`（全局）、`exportText(items)`、`clone`、`createPlan(sourceText, startMinutes, previous, localDate)`。
- Produces: `TimelineDomain.carryOver(plan, previousPlan, fromDate) => object|null`
  - 无 `previousPlan` 或 `plan.carriedFromDate === fromDate` 时返回 `null`；
  - 否则返回克隆后的新 plan（已追加昨日未完成项并打标记），无遗留项时仅打 `carriedFromDate` 标记。

- [ ] **Step 1: 追加失败测试**

```js
test('结转昨日未完成任务到今日计划之后', () => {
  const today = Timeline.createPlan('30min 今日任务', 540, null, '2026-08-14').plan;
  const yesterday = Timeline.createPlan('40min 未完成\n@10:00 30min 已完\n10min ～缓冲', 480, null, '2026-08-13').plan;
  yesterday.items[1].status = 'completed';
  const merged = Timeline.carryOver(today, yesterday, '2026-08-13');
  assert.ok(merged);
  assert.deepEqual(merged.items.map(item => item.title), ['今日任务', '未完成', '缓冲']);
  assert.equal(merged.items[1].fixedStartMinutes, undefined);
  assert.equal(merged.items[1].carriedFrom, '2026-08-13');
  assert.deepEqual(merged.items.map(item => item.order), [0, 1, 2]);
  assert.equal(merged.carriedFromDate, '2026-08-13');
});

test('结转幂等：同日重复调用返回 null', () => {
  const today = Timeline.createPlan('30min 任务', 540, null, '2026-08-14').plan;
  const yesterday = Timeline.createPlan('40min 遗留', 480, null, '2026-08-13').plan;
  const first = Timeline.carryOver(today, yesterday, '2026-08-13');
  assert.ok(first);
  assert.equal(Timeline.carryOver(first, yesterday, '2026-08-13'), null);
});

test('昨日无未完成任务时仅打标记', () => {
  const today = Timeline.createPlan('30min 任务', 540, null, '2026-08-14').plan;
  const yesterday = Timeline.createPlan('40min 已完成', 480, null, '2026-08-13').plan;
  yesterday.items[0].status = 'completed';
  const merged = Timeline.carryOver(today, yesterday, '2026-08-13');
  assert.equal(merged.items.length, 1);
  assert.equal(merged.carriedFromDate, '2026-08-13');
});

test('结转保留缓冲剩余时长', () => {
  const today = Timeline.createPlan('30min 任务', 540, null, '2026-08-14').plan;
  const yesterday = Timeline.createPlan('10min ～缓冲', 480, null, '2026-08-13').plan;
  yesterday.items[0].remainingDurationMinutes = 4;
  const merged = Timeline.carryOver(today, yesterday, '2026-08-13');
  assert.equal(merged.items[1].remainingDurationMinutes, 4);
});

test('无昨日计划时不结转', () => {
  const today = Timeline.createPlan('30min 任务', 540, null, '2026-08-14').plan;
  assert.equal(Timeline.carryOver(today, null, '2026-08-13'), null);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/timeline-domain.test.js`
Expected: 新增测试 FAIL（`carryOver is not a function`）。

- [ ] **Step 3: 实现 `carryOver`**

在 `js/timeline-domain.js` 中，`normalizePlanOrder` 之前插入：

```js
  function carryOver(plan, previousPlan, fromDate) {
    if (!previousPlan || !Array.isArray(previousPlan.items)) return null;
    const next = clone(plan);
    if (next.carriedFromDate === fromDate) return null;
    const leftovers = previousPlan.items.filter(item => item.status !== 'completed');
    if (leftovers.length) {
      const carried = leftovers.map(item => {
        const copy = clone(item);
        delete copy.fixedStartMinutes;
        copy.carriedFrom = fromDate;
        copy.status = 'pending';
        copy.completedAt = undefined;
        return copy;
      });
      next.items = (next.items || []).concat(carried);
    }
    next.items.forEach((item, order) => { item.order = order; });
    next.carriedFromDate = fromDate;
    next.updatedAt = new Date().toISOString();
    next.sourceText = exportText(next.items);
    return next;
  }
```

在导出对象中加入 `carryOver`。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/timeline-domain.test.js`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add js/timeline-domain.js tests/timeline-domain.test.js
git commit -m "feat: carry unfinished tasks from previous day into today's plan"
```

---

### Task 3: 载入接线 + 时间轴结转标签

**Files:**
- Modify: `js/pages/timeline.js:10-19`（`load()` 追加 `applyCarryover`）、`:97`（标签）
- Modify: `css/timeline.css`（`carried-tag` 样式）
- Test: `tests/ui.test.js`（追加）

**Interfaces:**
- Consumes: `TimelineDomain.carryOver(plan, previousPlan, fromDate)`、`Store.getTimelinePlan(date)`、`Store.today()`、`DateUtils.addDays`。
- Produces: `TimelinePage.applyCarryover()` 方法；`load()` 内调用并 toast。

- [ ] **Step 1: 追加失败测试**

```js
test('结转任务显示昨日结转标签', () => { assert.match(timeline, /昨日结转/); assert.match(timeline, /item\.carriedFrom/); });
test('载入时自动结转昨日未完成任务', () => { assert.match(timeline, /applyCarryover\(\)/); assert.match(timeline, /carriedFromDate === yesterdayDate/); assert.match(timeline, /已将昨日/); });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/ui.test.js`
Expected: 新增两条 FAIL（`昨日结转` / `applyCarryover` 不存在）。

- [ ] **Step 3: 实现 `applyCarryover` 并在 `load` 调用**

在 `js/pages/timeline.js`，把 `load()` 改为（在 `this.schedule = ...` 之前调用）：

```js
  load() {
    this.plan = Store.getTimelinePlan();
    if (!this.plan) this.plan = TimelineDomain.createPlan('', this.localMinutes()).plan;
    else {
      const beforeOrder = this.plan.items.map(item => item.id).join('|');
      this.plan = TimelineDomain.normalizePlanOrder(this.plan);
      if (this.plan.items.map(item => item.id).join('|') !== beforeOrder) Store.saveTimelinePlan(this.plan);
    }
    this.applyCarryover();
    this.schedule = TimelineDomain.schedule(this.plan);
  },
  applyCarryover() {
    const today = this.plan.localDate || Store.today();
    const yesterdayDate = DateUtils.addDays(today, -1);
    if (this.plan.carriedFromDate === yesterdayDate) return;
    const merged = TimelineDomain.carryOver(this.plan, Store.getTimelinePlan(yesterdayDate), yesterdayDate);
    if (!merged) return;
    const count = merged.items.filter(item => item.carriedFrom === yesterdayDate).length;
    this.plan = merged;
    this.save();
    if (count) Toast.show(`已将昨日 ${count} 项未完成任务结转`);
  },
```

- [ ] **Step 4: 时间轴条目显示结转标签**

在 `js/pages/timeline.js:97` 的 `ticket-main` 内，`ticket-title` 之后、`tap-hint` 之前插入：

```js
        <button class="ticket-main" type="button" aria-expanded="false"><span class="ticket-title">${this.escape(item.kind === 'buffer' ? '缓冲' : item.title)}</span>${item.carriedFrom ? '<span class="carried-tag small">昨日结转</span>' : ''}<span class="tap-hint small">点击查看备注</span>${slot.conflict ? `<span class="conflict-note">⚠ 冲突 ${slot.overlapMinutes} 分钟</span>` : ''}</button>
```

- [ ] **Step 5: CSS 样式**

在 `css/timeline.css` 追加：

```css
#timeline-planner .carried-tag{display:inline-block;margin:0 0 4px 6px;padding:2px 6px;border:1px solid var(--olive);color:var(--olive);background:var(--paper);vertical-align:middle}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `node --test tests/ui.test.js tests/timeline-domain.test.js`
Expected: 全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add js/pages/timeline.js css/timeline.css tests/ui.test.js
git commit -m "feat: auto-carry yesterday's unfinished tasks with a badge on load"
```

---

### Task 4: 计划页历史回看

**Files:**
- Modify: `js/pages/timeline.js:171-182`（`renderPlan`）、`:203-206`（`futurePlansHtml` 拆出卡片渲染）
- Modify: `css/timeline.css`（历史区样式）
- Test: `tests/ui.test.js`（追加）

**Interfaces:**
- Consumes: `Store.getTimelinePlans(fromDate)`、`Store.getTimelinePlan(date)`、`DateUtils.localDate/addDays/parseLocalDate`、`TimelineDomain.createPlan/schedule/parseClock/parseText`。
- Produces: `TimelinePage.historyPlansHtml(plans)`、`TimelinePage.planCard(plan, variant)`；`renderPlan` 新增历史区、日期选择放开。

- [ ] **Step 1: 追加失败测试**

```js
test('计划页可回看历史计划', () => { assert.match(timeline, /historyPlansHtml/); assert.match(timeline, /history-plans/); assert.match(timeline, /PAST PLANS/); assert.match(timeline, /getTimelinePlans\('0001-01-01'\)/); });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/ui.test.js`
Expected: 新测试 FAIL（`historyPlansHtml` 不存在）。

- [ ] **Step 3: 重写 `renderPlan` 并抽出 `planCard`**

把 `js/pages/timeline.js:171-182` 的 `renderPlan` 整体替换为：

```js
  renderPlan() {
    const root = this.container.querySelector('#timeline-planner');
    const today = DateUtils.localDate();
    const tomorrow = DateUtils.addDays(today, 1);
    const allPlans = Store.getTimelinePlans('0001-01-01');
    const futurePlans = allPlans.filter(plan => plan.localDate >= tomorrow);
    const historyPlans = allPlans.filter(plan => plan.localDate < today).reverse();
    const selectedDate = tomorrow; const text = ''; const start = '';
    root.innerHTML = `<section class="phone plan-page" aria-label="后续时间轴计划"><header class="top"><div><p class="kicker small">UPCOMING PLANS</p><h2 class="serif">Daybook</h2></div></header><div class="plan-scroll"><h2 class="plan-title serif">Plan ahead.</h2><p class="plan-lead">为之后的日期添加计划；日期到来时会自动显示在“现在”。也可以在下面回看过去的计划。</p><div class="history-plans" aria-label="历史计划"><p class="kicker small">PAST PLANS</p>${this.historyPlansHtml(historyPlans)}</div><div class="future-plans" aria-label="后续计划">${this.futurePlansHtml(futurePlans)}</div><div class="future-editor"><div class="plan-field"><label for="timeline-date">计划日期</label><input id="timeline-date" type="date" value="${selectedDate}"></div><div class="plan-field"><label for="timeline-start">计划开始时间</label><input id="timeline-start" type="time" value="${start}"></div><div class="plan-field"><label for="timeline-source">每行一项，例如：40min 晚餐</label><textarea id="timeline-source" spellcheck="false">${this.escape(text)}</textarea><div class="plan-errors" role="alert"></div></div><div class="plan-preview"><h3 class="serif">时间预览</h3><div class="preview-list"></div></div><div class="plan-buttons"><button class="primary save-plan" type="button">保存后续计划</button></div></div></div>${this.bottom('plan')}</section>`;
    this.bindCommon(); const textarea = root.querySelector('#timeline-source'); const input = root.querySelector('#timeline-start'); const dateInput = root.querySelector('#timeline-date'); const saveBtn = root.querySelector('.save-plan');
    const preview = () => this.updatePreview(textarea.value, input.value); textarea.addEventListener('input', preview); input.addEventListener('input', preview); preview();
    const refreshLists = () => {
      const all = Store.getTimelinePlans('0001-01-01');
      root.querySelector('.future-plans').innerHTML = this.futurePlansHtml(all.filter(plan => plan.localDate >= tomorrow));
      root.querySelector('.history-plans').innerHTML = this.historyPlansHtml(all.filter(plan => plan.localDate < today).reverse());
    };
    const updateSaveLabel = () => { saveBtn.textContent = dateInput.value && dateInput.value < today ? '保存计划' : '保存后续计划'; };
    const loadDate = () => {
      const existing = Store.getTimelinePlan(dateInput.value);
      textarea.value = existing?.sourceText || '';
      input.value = this.formatTime(existing?.startTimeMinutes ?? 780).replace(/^次日(?:\+\d+)? /,'');
      preview(); updateSaveLabel();
    };
    dateInput.addEventListener('change', loadDate);
    const bindPlanCard = container => container?.addEventListener('click', event => {
      const card = event.target.closest('[data-plan-date]'); if (!card) return;
      const existing = Store.getTimelinePlan(card.dataset.planDate); if (!existing) return;
      dateInput.value = existing.localDate; loadDate();
      root.querySelector('.future-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    bindPlanCard(root.querySelector('.future-plans')); bindPlanCard(root.querySelector('.history-plans'));
    root.querySelector('.save-plan').addEventListener('click', () => {
      const parsed = TimelineDomain.parseText(textarea.value);
      const startMinutes = TimelineDomain.parseClock(input.value);
      if (!dateInput.value) { Toast.show('请选择日期'); return; }
      if (startMinutes === null) { Toast.show('请选择计划开始时间'); return; }
      if (parsed.errors.length && !confirm('有无法识别的行，仍保存其他合法项目吗？')) return;
      const existing = Store.getTimelinePlan(dateInput.value);
      const result = TimelineDomain.createPlan(textarea.value, startMinutes, existing, dateInput.value);
      if (!Store.saveTimelinePlan(result.plan)) return;
      refreshLists(); textarea.value = ''; input.value = ''; preview();
      Toast.show(dateInput.value < today ? '计划已保存' : '后续计划已保存');
    });
    this.bindPreviewEditing(textarea, preview);
  },
  historyPlansHtml(plans) {
    if (!plans.length) return '<p class="empty-future">还没有历史计划。</p>';
    return plans.map(plan => this.planCard(plan, 'history')).join('');
  },
  futurePlansHtml(plans) {
    if (!plans.length) return '<p class="empty-future">还没有后续计划。先选择日期并写下安排。</p>';
    return plans.map(plan => this.planCard(plan, 'future')).join('');
  },
  planCard(plan, variant) {
    const date = DateUtils.parseLocalDate(plan.localDate);
    const label = date ? new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(date) : plan.localDate;
    const schedule = TimelineDomain.schedule(plan);
    const preview = plan.items.slice(0, 3).map((item, index) => `<span>${this.formatTime(schedule[index].startAbsoluteMinutes)} ${this.escape(item.kind === 'buffer' ? '缓冲' : item.title)}</span>`).join('');
    return `<button class="future-card ${variant === 'history' ? 'history-card' : ''}" type="button" data-plan-date="${plan.localDate}"><span class="future-date serif">${this.escape(label)}</span><span class="future-count small">${plan.items.length} 项 · ${this.formatTime(plan.startTimeMinutes)} 开始</span><span class="future-preview">${preview || '<span>空计划</span>'}</span></button>`;
  },
```

> 保留 `futurePlansHtml` 方法名（`tests/ui.test.js:33` 依赖）；`selectedDate = tomorrow; const text = ''; const start = ''` 保持连续（`tests/ui.test.js:34` 依赖）；`Store.saveTimelinePlan(result.plan) ... textarea.value = ''; input.value = ''; preview()` 顺序不变。

- [ ] **Step 4: CSS 样式**

在 `css/timeline.css` 追加：

```css
#timeline-planner .history-plans{margin-bottom:22px}
#timeline-planner .history-plans .kicker{margin-bottom:8px}
#timeline-planner .history-card{box-shadow:4px 4px 0 var(--olive)}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/ui.test.js tests/timeline-domain.test.js`
Expected: 全部 PASS（含既有 `未来计划默认明天…`、`保存后续计划` 相关测试）。

- [ ] **Step 6: 提交**

```bash
git add js/pages/timeline.js css/timeline.css tests/ui.test.js
git commit -m "feat: browse past plans from the plan page with an open date picker"
```

---

### Task 5: 校准修复——当前任务从现在开始

**Files:**
- Modify: `js/timeline-domain.js:119-148`（`schedule` 校准锚定）、`:150-183`（`calibrate`）
- Test: `tests/timeline-domain.test.js`（更新 1 条 + 新增 4 条）

**Interfaces:**
- Consumes: `effectiveDuration`、`liftFixed`、`reorderFutureAroundFixed`、`clone`。
- Produces: `schedule(plan)` 支持 `execution.anchorStartAbsoluteMinutes`；`calibrate(plan, offset, anchorId)` 为灵活锚点写入 `anchorStartAbsoluteMinutes`，固定锚点保持旧格式。

- [ ] **Step 1: 更新既有测试 + 追加新测试**

把 `tests/timeline-domain.test.js` 中的 `校准导致后续普通事项撞上固定事项时优先固定锚点` 改为（锚点从现在开始）：

```js
test('校准导致后续普通事项撞上固定事项时优先固定锚点', () => {
  const plan = Timeline.createPlan('20min 当前\n20min 后续\n@15:00 60min 固定', 840).plan;
  const result = Timeline.calibrate(plan, 30, plan.items[0].id);
  assert.deepEqual(result.plan.items.map(item => item.title), ['当前', '固定', '后续']);
  assert.deepEqual(result.schedule.map(slot => [slot.startAbsoluteMinutes, slot.endAbsoluteMinutes]), [[870, 890], [900, 960], [960, 980]]);
});
```

追加新测试：

```js
test('校准后灵活锚点从现在开始并优先消耗缓冲', () => {
  const plan = Timeline.createPlan('40min 晚餐\n10min ～缓冲\n30min 后续', 780).plan;
  const result = Timeline.calibrate(plan, 8, plan.items[0].id);
  assert.deepEqual(result.schedule.map(slot => slot.startAbsoluteMinutes), [788, 828, 830]);
  assert.equal(result.plan.items[1].remainingDurationMinutes, 2);
});

test('校准偏移超出缓冲后顺延后续事项', () => {
  const plan = Timeline.createPlan('20min 当前\n10min ～缓冲\n20min 后续', 780).plan;
  const result = Timeline.calibrate(plan, 25, plan.items[0].id);
  assert.equal(result.plan.items[1].remainingDurationMinutes, 0);
  assert.equal(result.remainingOffsetMinutes, 15);
  assert.deepEqual(result.schedule.map(slot => [slot.startAbsoluteMinutes, slot.endAbsoluteMinutes]), [[805, 825], [825, 825], [825, 845]]);
});

test('固定锚点校准时保持不动仅顺延后续', () => {
  const plan = Timeline.createPlan('@15:00 60min 会议\n20min 后续', 780).plan;
  const result = Timeline.calibrate(plan, 30, plan.items[0].id);
  assert.equal(result.schedule[0].startAbsoluteMinutes, 900);
  assert.equal(result.schedule[1].startAbsoluteMinutes, 990);
});

test('校准偏移写入执行态且旧格式仍可渲染', () => {
  const plan = Timeline.createPlan('20min 当前\n20min 后续', 780).plan;
  const result = Timeline.calibrate(plan, 5, plan.items[0].id);
  assert.equal(result.plan.execution.anchorStartAbsoluteMinutes, 785);
  assert.equal(result.schedule[0].startAbsoluteMinutes, 785);
  const legacy = Timeline.createPlan('20min 当前\n20min 后续', 780).plan;
  legacy.execution = { calibrationOffsetMinutes: 5, calibrationAfterItemId: legacy.items[0].id, remainingOffsetMinutes: 5 };
  assert.equal(Timeline.schedule(legacy)[0].startAbsoluteMinutes, 780);
  assert.equal(Timeline.schedule(legacy)[1].startAbsoluteMinutes, 805);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/timeline-domain.test.js`
Expected: 更新后的测试 FAIL（锚点仍是 `[840,860]`），新增测试 FAIL。

- [ ] **Step 3: 实现新 `schedule`**

把 `js/timeline-domain.js:119-148` 的 `schedule` 整体替换为：

```js
  function schedule(plan) {
    let cursor = Number(plan?.startTimeMinutes) || 0;
    const items = (plan?.items || []).slice().sort((a, b) => a.order - b.order);
    const execution = plan?.execution || {};
    const anchorStart = Number(execution.anchorStartAbsoluteMinutes);
    const hasAnchorStart = Number.isFinite(anchorStart);
    const legacyOffset = Number(execution.remainingOffsetMinutes) || 0;
    const calibrationAfter = execution.calibrationAfterItemId;
    let calibrationApplied = false; let leadingPastFixed = true;
    return items.map((item, index) => {
      const isAnchor = calibrationAfter ? items[index]?.id === calibrationAfter : index === 0;
      const legacyPoint = calibrationAfter ? items[index - 1]?.id === calibrationAfter : index === 0;
      if (!calibrationApplied) {
        if (hasAnchorStart && isAnchor && !Number.isFinite(item.fixedStartMinutes)) { cursor = Math.max(0, anchorStart); calibrationApplied = true; }
        else if (legacyOffset && legacyPoint) { cursor = Math.max(0, cursor + legacyOffset); calibrationApplied = true; }
      }
      const duration = effectiveDuration(item);
      const cursorBeforeItem = cursor;
      let start = cursor; let idleBeforeMinutes = 0; let overlapMinutes = 0;
      if (Number.isFinite(item.fixedStartMinutes)) {
        start = liftFixed(item.fixedStartMinutes, cursor);
        const isLeadingPastFixed = leadingPastFixed && start <= plan.startTimeMinutes;
        if (!isLeadingPastFixed && cursor < start) idleBeforeMinutes = start - cursor;
        else if (!isLeadingPastFixed && cursor > start) overlapMinutes = cursor - start;
      }
      const end = start + duration;
      const isLeadingPastFixed = leadingPastFixed && Number.isFinite(item.fixedStartMinutes) && start <= plan.startTimeMinutes;
      cursor = Number.isFinite(item.fixedStartMinutes) ? (isLeadingPastFixed ? Math.max(end, cursorBeforeItem) : Math.max(end, cursorBeforeItem + duration)) : end;
      if (!isLeadingPastFixed) leadingPastFixed = false;
      return { itemId: item.id, startAbsoluteMinutes: start, endAbsoluteMinutes: end, startDayOffset: Math.floor(start / 1440), endDayOffset: Math.floor((Math.max(start, end - 1)) / 1440), conflict: overlapMinutes > 0, overlapMinutes, idleBeforeMinutes };
    });
  }
```

- [ ] **Step 4: 实现新 `calibrate`**

把 `js/timeline-domain.js:150-183` 的 `calibrate` 整体替换为：

```js
  function calibrate(plan, offsetMinutes, calibrationAfterItemId) {
    const next = clone(plan); let remaining = Math.round(offsetMinutes);
    const consumed = [];
    const ordered = next.items.slice().sort((a, b) => a.order - b.order);
    const anchorIndex = calibrationAfterItemId ? ordered.findIndex(item => item.id === calibrationAfterItemId) : -1;
    const anchor = anchorIndex >= 0 ? ordered[anchorIndex] : (ordered[0] || null);
    const anchorIsFixed = Boolean(anchor && Number.isFinite(anchor.fixedStartMinutes));
    if (remaining > 0) {
      for (let index = anchorIndex + 1; index < ordered.length; index += 1) {
        const item = ordered[index];
        if (Number.isFinite(item.fixedStartMinutes)) break;
        if (item.status === 'completed' || item.kind !== 'buffer') continue;
        const available = Math.max(0, item.remainingDurationMinutes ?? item.plannedDurationMinutes);
        const amount = Math.min(available, remaining);
        item.remainingDurationMinutes = available - amount;
        remaining -= amount;
        if (amount) consumed.push({ itemId: item.id, minutes: amount });
        if (!remaining) break;
      }
    }
    const baseSchedule = schedule(next);
    const baseStart = anchorIndex >= 0 ? (baseSchedule[anchorIndex]?.startAbsoluteMinutes ?? next.startTimeMinutes) : next.startTimeMinutes;
    let prefix, suffix, suffixCursor;
    if (anchorIsFixed) {
      prefix = anchorIndex >= 0 ? ordered.slice(0, anchorIndex + 1) : [];
      suffix = anchorIndex >= 0 ? ordered.slice(anchorIndex + 1) : ordered;
      suffixCursor = (anchorIndex >= 0 ? (baseSchedule[anchorIndex]?.endAbsoluteMinutes ?? next.startTimeMinutes) : next.startTimeMinutes) + remaining;
    } else {
      const anchorNewStart = Math.max(0, baseStart + offsetMinutes);
      prefix = anchorIndex >= 0 ? ordered.slice(0, anchorIndex + 1) : [];
      suffix = anchorIndex >= 0 ? ordered.slice(anchorIndex + 1) : ordered;
      suffixCursor = anchorNewStart + (anchorIndex >= 0 ? effectiveDuration(anchor) : 0);
      next.execution = { ...(next.execution || {}), anchorStartAbsoluteMinutes: anchorNewStart };
    }
    next.items = prefix.concat(reorderFutureAroundFixed(suffix, suffixCursor));
    next.items.forEach((item, order) => { item.order = order; });
    next.execution = {
      ...(next.execution || {}),
      calibratedAt: new Date().toISOString(),
      calibrationOffsetMinutes: offsetMinutes,
      calibrationAfterItemId: calibrationAfterItemId,
      remainingOffsetMinutes: remaining,
    };
    next.updatedAt = new Date().toISOString();
    return { plan: next, consumed, remainingOffsetMinutes: remaining, schedule: schedule(next) };
  }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/timeline-domain.test.js`
Expected: 全部 PASS（含更新后的旧测试与 4 条新增）。

- [ ] **Step 6: 提交**

```bash
git add js/timeline-domain.js tests/timeline-domain.test.js
git commit -m "fix: calibrate re-anchors the current task to start from now"
```

---

### Task 6: PWA 缓存版本提升 + 全量验证

**Files:**
- Modify: `index.html:15,51,57`（`css/timeline.css`、`js/timeline-domain.js`、`js/pages/timeline.js` 版本号）
- Modify: `sw.js:1-2`（`CACHE` 名 + `PRECACHE`）
- Test: `tests/ui.test.js:24`（`daily-lite-v13` → `daily-lite-v14`）

- [ ] **Step 1: 更新 `index.html` 版本号**

`css/timeline.css?v=13` → `?v=14`；`js/timeline-domain.js?v=7` → `?v=8`；`js/pages/timeline.js?v=13` → `?v=14`。`js/store.js?v=13`、`js/app.js?v=9` 保持不变。

- [ ] **Step 2: 更新 `sw.js`**

`const CACHE = 'daily-lite-v14';`，`PRECACHE` 中对应三处改为新版本号（其余不变）。

- [ ] **Step 3: 更新 UI 测试缓存断言**

`tests/ui.test.js:24`：`/daily-lite-v13/` → `/daily-lite-v14/`。

- [ ] **Step 4: 全量验证**

Run: `npm run check`
Expected: 全部 PASS，无语法错误。

- [ ] **Step 5: 手工冒烟（可选，有浏览器时）**

`python3 -m http.server` 打开 `index.html`：确认时间轴「现在/计划」正常、历史区显示、结转标签、校准后当前卡从当前时刻开始。

- [ ] **Step 6: 提交**

```bash
git add index.html sw.js tests/ui.test.js
git commit -m "chore: bump service worker cache for timeline enhancements"
```

---

## 自检记录

- **Spec 覆盖**：3.1 图标 → Task 1；3.2 历史 → Task 4；3.3 结转 → Task 2+3；3.4 校准 → Task 5；§8 文件清单 → 各 Task；§7 测试 → 各 Task；缓存 → Task 6。
- **占位符扫描**：无 TBD/TODO，每步含完整代码。
- **类型一致性**：`carryOver(plan, previousPlan, fromDate)`、`iconCategoryFor(title)`、`execution.anchorStartAbsoluteMinutes`、`item.carriedFrom`、`plan.carriedFromDate` 在前后任务中签名一致。
