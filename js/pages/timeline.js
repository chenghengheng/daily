const TimelinePage = {
  container: null,
  plan: null,
  schedule: [],
  undo: null,

  phrases: ['Make room for the day.','Make room for what matters.','Give the day some shape.','One thing at a time.','Let the day unfold.','Today, in gentle steps.','Pace the day your way.','Leave space between things.'],

  escape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[char])); },
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
  save() { if (!Store.saveTimelinePlan(this.plan)) return false; this.schedule = TimelineDomain.schedule(this.plan); return true; },

  render(container, view = 'now') {
    this.container = container; this.load();
    container.innerHTML = `<div id="timeline-planner"></div>`;
    if (view === 'plan') this.renderPlan(); else if (view === 'today') this.renderTodayPlan(); else this.renderNow();
  },
  dateLabel() {
    const date = new Date();
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date).toUpperCase();
    const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date).toUpperCase();
    return `${weekday} · ${date.getDate()} ${month}`;
  },
  phrase() {
    const date = DateUtils.parseLocalDate(this.plan.localDate) || new Date();
    const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    return this.phrases[((day % this.phrases.length) + this.phrases.length) % this.phrases.length];
  },
  localMinutes() { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); },
  current() {
    const now = this.localMinutes();
    const active = this.plan.items.find(item => item.status === 'active' && item.status !== 'completed');
    let index = active ? this.plan.items.indexOf(active) : this.schedule.findIndex((slot, i) => now >= slot.startAbsoluteMinutes && now < slot.endAbsoluteMinutes && this.plan.items[i]?.status !== 'completed');
    if (index >= 0) return { item: this.plan.items[index], slot: this.schedule[index], now, mode: 'active' };
    index = this.schedule.findIndex((slot, i) => slot.startAbsoluteMinutes > now && this.plan.items[i]?.status !== 'completed');
    if (index >= 0) return { item: this.plan.items[index], slot: this.schedule[index], now, mode: now < this.plan.startTimeMinutes ? 'before' : 'next' };
    index = this.plan.items.findIndex(item => item.status !== 'completed');
    if (index >= 0) return { item: this.plan.items[index], slot: this.schedule[index], now, mode: 'overdue' };
    return null;
  },
  formatTime(value) { return TimelineDomain.formatMinutes(value); },
  clockNow() { return this.formatTime(this.localMinutes()); },

  renderNow() {
    const root = this.container.querySelector('#timeline-planner'); const current = this.current();
    const start = this.formatTime(this.plan.startTimeMinutes);
    const completeTitle = this.plan.items.length ? '今日已完成' : '还没有计划';
    const completeHint = this.plan.items.length ? '给今天留一点余白' : '点右上角“编辑”写下今天的安排';
    const currentHtml = current ? this.currentCard(current) : `<section class="now"><div class="now-label small">NOW · ${this.clockNow()}</div><div class="now-main"><div><h2 class="serif">${completeTitle}</h2><p class="now-label">${completeHint}</p></div></div></section>`;
    root.innerHTML = `<section class="phone" aria-label="时间轴计划器">
      <header class="top"><div><p class="kicker small">${this.dateLabel()}</p><h2 class="serif">Daybook</h2></div><button class="edit" type="button" data-action="edit-today">✎ 编辑</button></header>
      <div class="intro"><h2 class="serif">${this.escape(this.phrase())}</h2><span class="start-display small">START<br><strong>${start}</strong></span></div>
      <div class="day-scroll">
        ${currentHtml}
        <section class="timeline-section" aria-label="今日时间轴">
          <div class="timeline-head"><h3 class="serif">Up next</h3><p class="small">点击中间展开备注</p></div>
          <div class="timeline">${this.timelineHtml()}</div>
        </section>
      </div>
      <div class="calibration-sheet" role="dialog" aria-modal="true" aria-labelledby="calibration-title" hidden>
        <div class="calibration-paper">
          <p class="kicker small">ADJUST THE DAY</p>
          <h3 class="serif" id="calibration-title">校准计划</h3>
          <p class="calibration-message"></p>
          <div class="calibration-actions"><button class="cancel-calibration" type="button">取消</button><button class="confirm-calibration" type="button">确认校准</button></div>
        </div>
      </div>
      ${this.bottom('now')}
      <div class="action-toast" role="status"><span class="toast-text"></span><button class="undo-action" type="button">撤销</button></div>
    </section>`;
    this.bindCommon(); this.bindNow();
  },
  currentCard(current) {
    const { item, slot, now, mode } = current; const total = Math.max(1, slot.endAbsoluteMinutes - slot.startAbsoluteMinutes);
    const elapsed = mode === 'active' ? Math.max(0, Math.min(total, now - slot.startAbsoluteMinutes)) : 0;
    const remaining = mode === 'active' ? Math.max(0, slot.endAbsoluteMinutes - now) : mode === 'overdue' ? 0 : Math.max(0, slot.startAbsoluteMinutes - now);
    const label = mode === 'active' ? `NOW · ${this.clockNow()}` : mode === 'overdue' ? `OVERDUE · ${this.clockNow()}` : `NEXT · ${this.clockNow()}`;
    const unit = mode === 'active' ? 'MIN LEFT' : mode === 'overdue' ? 'MIN LATE' : 'MIN TO GO';
    return `<section class="now" aria-label="当前事项"><div class="now-label small">${label}</div><div class="now-main"><div><h2 class="serif">${this.escape(item.kind === 'buffer' ? '缓冲时间' : item.title)}</h2><p class="now-label">${this.formatTime(slot.startAbsoluteMinutes)}—${this.formatTime(slot.endAbsoluteMinutes)}</p></div><div class="minutes">${remaining}<small>${unit}</small></div></div><div class="progress" aria-label="已完成约${Math.round(elapsed / total * 100)}%"><span style="width:${elapsed / total * 100}%"></span></div><div class="now-actions"><button class="now-primary" type="button" data-action="complete-current">✓ 完成</button><button class="now-secondary" type="button" data-action="calibrate">↻ 校准</button></div></section>`;
  },
  timelineHtml() {
    if (!this.plan.items.length) return '<p class="empty-timeline">还没有计划。点右上角“编辑”开始安排今天。</p>';
    return this.plan.items.map((item, index) => {
      const slot = this.schedule[index]; const classes = ['entry', item.kind === 'buffer' ? 'buffer' : '', Number.isFinite(item.fixedStartMinutes) ? 'fixed' : '', TimelineDomain.iconCategoryFor(item.title) === 'journal' ? 'journal' : '', item.status === 'completed' ? 'is-complete' : '', slot.conflict ? 'conflict' : ''].filter(Boolean).join(' ');
      const type = Number.isFinite(item.fixedStartMinutes) ? '固定时间' : item.kind === 'buffer' ? '可消耗缓冲' : '普通时间块';
      return `<section class="${classes}" data-id="${this.escape(item.id)}"><span class="time small">${Number.isFinite(item.fixedStartMinutes) ? `<strong>${this.formatTime(slot.startAbsoluteMinutes)}</strong>` : this.formatTime(slot.startAbsoluteMinutes)}</span><span class="tick" aria-hidden="true"></span><div class="ticket">
        <button class="stub left-stub" type="button" aria-label="向右拖动删除${this.escape(item.title)}"><span class="stub-normal"><span aria-hidden="true">${TimelineDomain.iconFor(item)}</span></span><span class="tear-action"><span>⌫</span><span class="small">删除</span></span></button>
        <button class="ticket-main" type="button" aria-expanded="false"><span class="ticket-title">${this.escape(item.kind === 'buffer' ? '缓冲' : item.title)}</span>${item.carriedFrom ? '<span class="carried-tag small">昨日结转</span>' : ''}<span class="tap-hint small">点击查看备注</span>${slot.conflict ? `<span class="conflict-note">⚠ 冲突 ${slot.overlapMinutes} 分钟</span>` : ''}</button>
        <button class="stub right-stub" type="button" aria-label="向左拖动完成${this.escape(item.title)}"><span class="stub-normal"><span>${item.kind === 'buffer' ? (item.remainingDurationMinutes ?? item.plannedDurationMinutes) : item.plannedDurationMinutes}</span><span class="stub-hint small">MIN</span></span><span class="tear-action"><span>✓</span><span class="small">完成</span></span></button><span class="done-stamp small">DONE</span></div>
        <div class="detail"><div class="detail-meta small"><span>${this.formatTime(slot.startAbsoluteMinutes)}—${this.formatTime(slot.endAbsoluteMinutes)}</span><span>${type}</span></div>${slot.idleBeforeMinutes ? `<p class="small">此前空档 ${slot.idleBeforeMinutes} 分钟</p>` : ''}<label class="note-label small">备注</label><textarea class="note" aria-label="${this.escape(item.title)}备注">${this.escape(item.note)}</textarea><div class="detail-actions"><button class="alt-complete" type="button">完成</button><button class="alt-delete" type="button">删除</button><button class="save-note" type="button">保存备注</button></div></div>
      </section>`;
    }).join('');
  },
  bottom(active) { return `<nav class="bottom small" aria-label="时间轴页底部导航"><button class="local-nav ${active === 'now' ? 'active' : ''}" type="button" data-view="now"><span>▱</span>现在</button><button class="local-nav ${active === 'plan' ? 'active' : ''}" type="button" data-view="plan"><span>▦</span>计划</button><button class="local-nav" type="button" data-view="close"><span>×</span>关闭</button></nav>`; },

  bindCommon() {
    const root = this.container.querySelector('#timeline-planner');
    root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.view === 'close') location.hash = '#/';
      else location.hash = button.dataset.view === 'plan' ? '#/timeline/plan' : '#/timeline';
    }));
    root.querySelector('[data-action="edit-today"]')?.addEventListener('click', () => { location.hash = '#/timeline/today'; });
  },
  bindNow() {
    const root = this.container.querySelector('#timeline-planner'); const entries = [...root.querySelectorAll('.entry')];
    const calibrationSheet = root.querySelector('.calibration-sheet');
    let pendingCalibration = null;
    entries.forEach(entry => {
      const main = entry.querySelector('.ticket-main');
      main.addEventListener('click', () => { const open = !entry.classList.contains('is-open'); entries.forEach(row => { row.classList.remove('is-open'); row.querySelector('.ticket-main').setAttribute('aria-expanded','false'); }); if (open) { entry.classList.add('is-open'); main.setAttribute('aria-expanded','true'); } });
      entry.querySelector('.save-note').addEventListener('click', () => { const item = this.item(entry.dataset.id); item.note = entry.querySelector('.note').value; this.touch(); entry.classList.remove('is-open'); Toast.show('备注已保存'); });
      entry.querySelector('.alt-complete').addEventListener('click', () => this.complete(entry.dataset.id));
      entry.querySelector('.alt-delete').addEventListener('click', () => this.remove(entry.dataset.id));
      this.setupTear(entry.querySelector('.left-stub'), 'right', () => this.remove(entry.dataset.id));
      this.setupTear(entry.querySelector('.right-stub'), 'left', () => this.complete(entry.dataset.id));
    });
    root.querySelector('[data-action="complete-current"]')?.addEventListener('click', () => { const current = this.current(); if (current) this.complete(current.item.id); });
    root.querySelector('[data-action="calibrate"]')?.addEventListener('click', () => {
      const current = this.current(); if (!current) return;
      const offset = this.localMinutes() - current.slot.startAbsoluteMinutes;
      const offsetText = offset >= 0 ? `延误 ${offset} 分钟` : `提前 ${Math.abs(offset)} 分钟`;
      pendingCalibration = { current, offset, before: JSON.parse(JSON.stringify(this.plan)) };
      calibrationSheet.querySelector('.calibration-message').textContent = `从现在继续，将按当前${offsetText}校准，并优先消耗后续缓冲。`;
      calibrationSheet.hidden = false;
      calibrationSheet.querySelector('.confirm-calibration').focus();
    });
    root.querySelector('.cancel-calibration').addEventListener('click', () => { pendingCalibration = null; calibrationSheet.hidden = true; });
    root.querySelector('.confirm-calibration').addEventListener('click', () => {
      if (!pendingCalibration) return;
      const { current, offset, before } = pendingCalibration;
      this.plan = TimelineDomain.calibrate(this.plan, offset, current.item.id).plan;
      this.save(); this.undo = () => { this.plan = before; this.save(); this.renderNow(); };
      pendingCalibration = null; this.renderNow(); this.showAction('已校准计划');
    });
    root.querySelector('.undo-action').addEventListener('click', () => { this.undo?.(); this.undo = null; });
  },
  setupTear(stub, direction, action) {
    let startX = 0; let startY = 0; let distance = 0; let dragging = false; let locked = false;
    stub.addEventListener('pointerdown', event => { startX = event.clientX; startY = event.clientY; distance = 0; dragging = true; locked = false; stub.setPointerCapture(event.pointerId); });
    stub.addEventListener('pointermove', event => {
      if (!dragging) return; const dx = event.clientX - startX; const dy = event.clientY - startY;
      if (!locked && Math.hypot(dx, dy) > 9) { if (Math.abs(dx) <= Math.abs(dy) * 1.2) { dragging = false; return; } locked = true; stub.classList.add('is-dragging'); }
      if (!locked) return; event.preventDefault(); const raw = direction === 'right' ? Math.max(0, dx) : Math.min(0, dx); distance = raw; const limited = direction === 'right' ? Math.min(raw, 72) : Math.max(raw, -72); const lift = Math.min(Math.abs(limited) / 12, 4); stub.style.transform = `translate3d(${limited}px,-${lift}px,0) rotate(${limited / 9}deg) scale(1.02)`;
    });
    const finish = () => { if (!dragging && !locked) return; const passed = locked && (direction === 'right' ? distance >= 48 : distance <= -48); dragging = false; locked = false; stub.classList.remove('is-dragging'); stub.style.transform = ''; if (passed) action(); };
    stub.addEventListener('pointerup', finish); stub.addEventListener('pointercancel', finish); window.addEventListener('blur', finish, { once: true });
  },
  item(id) { return this.plan.items.find(item => item.id === id); },
  touch() { this.plan.updatedAt = new Date().toISOString(); this.plan.sourceText = TimelineDomain.exportText(this.plan.items); this.save(); },
  complete(id) { const before = JSON.parse(JSON.stringify(this.plan)); const item = this.item(id); if (!item || item.status === 'completed') return; item.status = 'completed'; item.completedAt = new Date().toISOString(); this.touch(); this.undo = () => { this.plan = before; this.save(); this.renderNow(); }; this.renderNow(); this.showAction('已标记完成'); },
  remove(id) { const before = JSON.parse(JSON.stringify(this.plan)); const index = this.plan.items.findIndex(item => item.id === id); if (index < 0) return; this.plan.items.splice(index, 1); this.plan.items.forEach((item, order) => { item.order = order; }); this.touch(); this.undo = () => { this.plan = before; this.save(); this.renderNow(); }; this.renderNow(); this.showAction('已删除该条目'); },
  showAction(message) { const toast = this.container.querySelector('.action-toast'); if (!toast) return; toast.querySelector('.toast-text').textContent = message; toast.classList.add('is-visible'); },

  renderTodayPlan() {
    const root = this.container.querySelector('#timeline-planner'); const text = this.plan.sourceText || TimelineDomain.exportText(this.plan.items); const startMinutes = this.plan.items.length ? this.plan.startTimeMinutes : this.localMinutes(); const start = this.formatTime(startMinutes).replace(/^次日(?:\+\d+)? /,'');
    root.innerHTML = `<section class="phone plan-page" aria-label="编辑今日时间轴计划"><header class="top"><div><p class="kicker small">${this.dateLabel()}</p><h2 class="serif">Daybook</h2></div></header><div class="plan-scroll"><h2 class="plan-title serif">Plan today.</h2><p class="plan-lead">编辑今天的任务，保存后返回“现在”。</p><div class="plan-field"><label for="timeline-start">计划开始时间</label><input id="timeline-start" type="time" value="${start}"></div><div class="plan-field"><label for="timeline-source">每行一项，例如：40min 晚餐</label><textarea id="timeline-source" spellcheck="false">${this.escape(text)}</textarea><div class="plan-errors" role="alert"></div></div><div class="plan-preview"><h3 class="serif">时间预览</h3><div class="preview-list"></div></div><div class="plan-buttons"><button class="primary save-today-plan" type="button">保存今日计划</button></div></div>${this.bottom('now')}</section>`;
    this.bindCommon(); const textarea = root.querySelector('#timeline-source'); const input = root.querySelector('#timeline-start'); const preview = () => this.updatePreview(textarea.value, input.value);
    textarea.addEventListener('input', preview); input.addEventListener('input', preview); preview(); this.bindPreviewEditing(textarea, preview);
    root.querySelector('.save-today-plan').addEventListener('click', () => { const parsed = TimelineDomain.parseText(textarea.value); if (parsed.errors.length && !confirm('有无法识别的行，仍保存其他合法项目吗？')) return; this.plan = TimelineDomain.createPlan(textarea.value, TimelineDomain.parseClock(input.value) ?? 780, this.plan, DateUtils.localDate()).plan; if (!this.save()) return; location.hash = '#/timeline'; });
  },

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
  bindPreviewEditing(textarea, preview) {
    const root = this.container.querySelector('#timeline-planner');
    root.querySelector('.preview-list').addEventListener('click', event => {
      const action = event.target.closest('[data-preview-action]'); if (!action) return;
      const parsed = TimelineDomain.parseText(textarea.value); if (parsed.errors.length) { Toast.show('请先修正逐行错误再调整顺序'); return; }
      const index = Number(action.dataset.index); const items = parsed.items;
      if (action.dataset.previewAction === 'delete') items.splice(index, 1);
      if (action.dataset.previewAction === 'up' && index > 0) [items[index - 1], items[index]] = [items[index], items[index - 1]];
      if (action.dataset.previewAction === 'down' && index < items.length - 1) [items[index + 1], items[index]] = [items[index], items[index + 1]];
      items.forEach((item, order) => { item.order = order; }); textarea.value = TimelineDomain.exportText(items); preview();
    });
    let draggedIndex = null;
    root.querySelector('.preview-list').addEventListener('dragstart', event => { const row = event.target.closest('[data-preview-index]'); draggedIndex = row ? Number(row.dataset.previewIndex) : null; });
    root.querySelector('.preview-list').addEventListener('dragover', event => { if (draggedIndex !== null) event.preventDefault(); });
    root.querySelector('.preview-list').addEventListener('drop', event => {
      event.preventDefault(); const row = event.target.closest('[data-preview-index]'); if (!row || draggedIndex === null) return;
      const parsed = TimelineDomain.parseText(textarea.value); if (parsed.errors.length) return;
      const targetIndex = Number(row.dataset.previewIndex); const [moved] = parsed.items.splice(draggedIndex, 1); parsed.items.splice(targetIndex, 0, moved); parsed.items.forEach((item, order) => { item.order = order; }); textarea.value = TimelineDomain.exportText(parsed.items); draggedIndex = null; preview();
    });
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
  updatePreview(text, startValue) {
    const root = this.container.querySelector('#timeline-planner'); const parsed = TimelineDomain.parseText(text); const startMinutes = TimelineDomain.parseClock(startValue);
    root.querySelector('.plan-errors').innerHTML = parsed.errors.map(item => `<p>第 ${item.lineNumber} 行：${this.escape(item.message)}</p>`).join('');
    if (startMinutes === null) { root.querySelector('.preview-list').innerHTML = '<p class="empty-timeline">选择开始时间后显示预览。</p>'; return; }
    const temporary = TimelineDomain.createPlan(text, startMinutes, this.plan).plan; const schedule = TimelineDomain.schedule(temporary);
    const controlsDisabled = parsed.errors.length ? 'disabled' : '';
    root.querySelector('.preview-list').innerHTML = temporary.items.length ? temporary.items.map((item, index) => `<div class="preview-row" draggable="${parsed.errors.length ? 'false' : 'true'}" data-preview-index="${index}"><span class="preview-time small">${this.formatTime(schedule[index].startAbsoluteMinutes)}</span><span class="preview-name">${TimelineDomain.iconFor(item)} ${this.escape(item.kind === 'buffer' ? '缓冲' : item.title)}<small>${item.plannedDurationMinutes} MIN</small></span><span class="preview-actions"><button type="button" data-preview-action="up" data-index="${index}" ${controlsDisabled} aria-label="上移${this.escape(item.title)}">↑</button><button type="button" data-preview-action="down" data-index="${index}" ${controlsDisabled} aria-label="下移${this.escape(item.title)}">↓</button><button type="button" data-preview-action="delete" data-index="${index}" ${controlsDisabled} aria-label="删除${this.escape(item.title)}">×</button></span></div>`).join('') : '<p class="empty-timeline">合法项目会显示在这里。</p>';
  },
};
