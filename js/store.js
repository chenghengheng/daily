const Store = {
  _prefix: 'daily_',

  _get(key) {
    try { return JSON.parse(localStorage.getItem(this._prefix + key)); }
    catch { return null; }
  },
  _set(key, val) {
    try { localStorage.setItem(this._prefix + key, JSON.stringify(val)); return true; }
    catch (_) { globalThis.Toast?.show?.('保存失败：本地空间可能已满，请先导出或清理数据。'); return false; }
  },

  // ---- config ----
  getConfig() {
    return { MAX_DAILY_WISH_CLICKS: 3, showDailyCost: true, ...this._get('config') };
  },
  updateConfig(partial) {
    this._set('config', { ...this.getConfig(), ...partial });
  },

  // ---- wish items ----
  getWishItems() { return (this._get('wish') || []).map(DailyDomain.normalizeWish); },
  saveWishItems(items) { return this._set('wish', items); },

  // ---- countdown events ----
  getCountdownEvents() { return this._get('countdown') || []; },
  saveCountdownEvents(events) { return this._set('countdown', events); },

  getExpenses() { return (this._get('expenses') || []).map(DailyDomain.normalizeExpense); },
  saveExpenses(items) { return this._set('expenses', items); },
  clearObsoleteData() {
    localStorage.removeItem(this._prefix + 'study');
    localStorage.removeItem(this._prefix + 'bgImage');
  },

  // ---- note items ----
  getNoteItems() { return this._get('note') || []; },
  saveNoteItems(items) { return this._set('note', items); },

  // ---- timeline planner ----
  _isLegacyTimelineSample(plan) {
    if (!plan || plan.startTimeMinutes !== 780 || plan.execution?.calibratedAt || !Array.isArray(plan.items) || plan.items.length !== 5) return false;
    const expected = [['晚餐','normal',40,null],['地铁','normal',30,null],['缓冲','buffer',10,null],['会议','normal',60,900],['日记','normal',20,null]];
    return plan.items.slice().sort((a, b) => a.order - b.order).every((item, index) => {
      const [title, kind, duration, fixed] = expected[index];
      return item.title === title && item.kind === kind && item.plannedDurationMinutes === duration && (item.fixedStartMinutes ?? null) === fixed && item.status === 'pending' && !item.note && !item.completedAt;
    });
  },
  getTimelinePlan(date = this.today()) {
    let plans = {};
    try { plans = JSON.parse(localStorage.getItem('daily.timelinePlanner.plans.v1')) || {}; } catch { plans = {}; }
    let data = null;
    if (plans[date]?.schemaVersion === 1 && Array.isArray(plans[date].items)) data = plans[date];
    if (!data) try { data = JSON.parse(localStorage.getItem('daily.timelinePlanner.v1')); } catch { data = null; }
    if (!data || data.schemaVersion !== 1 || data.localDate !== date || !Array.isArray(data.items)) return null;
    if (this._isLegacyTimelineSample(data)) {
      delete plans[date];
      try {
        localStorage.setItem('daily.timelinePlanner.plans.v1', JSON.stringify(plans));
        const legacy = JSON.parse(localStorage.getItem('daily.timelinePlanner.v1'));
        if (legacy?.localDate === date && this._isLegacyTimelineSample(legacy)) localStorage.removeItem('daily.timelinePlanner.v1');
      } catch { /* keep the in-memory migration even if storage cleanup fails */ }
      return null;
    }
    return data;
  },
  saveTimelinePlan(plan) {
    let previous = null; let snapshots = [];
    try {
      previous = JSON.parse(localStorage.getItem('daily.timelinePlanner.v1'));
      snapshots = JSON.parse(localStorage.getItem('daily.timelinePlanner.snapshots.v1')) || [];
    } catch { snapshots = []; }
    if (previous) {
      snapshots.unshift(previous);
    }
    try {
      let plans = {};
      try { plans = JSON.parse(localStorage.getItem('daily.timelinePlanner.plans.v1')) || {}; } catch { plans = {}; }
      plans[plan.localDate] = plan;
      localStorage.setItem('daily.timelinePlanner.snapshots.v1', JSON.stringify(snapshots.slice(0, 5)));
      localStorage.setItem('daily.timelinePlanner.plans.v1', JSON.stringify(plans));
      if (plan.localDate === this.today()) localStorage.setItem('daily.timelinePlanner.v1', JSON.stringify(plan));
      return true;
    } catch {
      globalThis.Toast?.show?.('保存失败：本地空间可能已满，请先导出或清理数据。');
      return false;
    }
  },
  getTimelinePlans(fromDate = this.today()) {
    let plans = {};
    try { plans = JSON.parse(localStorage.getItem('daily.timelinePlanner.plans.v1')) || {}; } catch { plans = {}; }
    const legacy = (() => { try { return JSON.parse(localStorage.getItem('daily.timelinePlanner.v1')); } catch { return null; } })();
    if (legacy?.schemaVersion === 1 && Array.isArray(legacy.items) && !plans[legacy.localDate]) plans[legacy.localDate] = legacy;
    return Object.values(plans).filter(plan => plan?.schemaVersion === 1 && Array.isArray(plan.items) && plan.localDate >= fromDate).sort((a, b) => a.localDate.localeCompare(b.localDate));
  },

  purchaseWish(wishId, input = {}) {
    const wishesBefore = this.getWishItems();
    const expensesBefore = this.getExpenses();
    const wishes = JSON.parse(JSON.stringify(wishesBefore));
    const expenses = JSON.parse(JSON.stringify(expensesBefore));
    const item = wishes.find(value => value.id === wishId);
    const actualPrice = Number(input.actualPrice);
    if (!item || item.status !== 'active') return { ok: false, error: '物品状态已变化，请刷新后重试' };
    if (!Number.isFinite(actualPrice) || actualPrice < 0) return { ok: false, error: '请输入有效实际价格' };
    const now = input.now || new Date().toISOString();
    const today = input.today || this.today();
    item.progressAtDecision = item.currentProgress;
    item.purchaseTiming = item.currentProgress >= item.price ? 'ready' : 'early';
    item.currentProgress = 0;
    item.status = 'purchased'; item.plannedPrice = item.price; item.actualPrice = actualPrice; item.purchasedAt = now; item.purchaseReason = String(input.reason || '').trim(); item.updatedAt = now;
    item.actionLog = item.actionLog || [];
    item.actionLog.push({ date: today, type: 'purchased', reason: `${item.purchaseTiming === 'early' ? '提前购买' : '达标购买'} · 等待进度 ¥${item.progressAtDecision.toFixed(2)} · 原目标 ¥${item.price.toFixed(2)} · 实际 ¥${actualPrice.toFixed(2)}${item.purchaseReason ? ` · ${item.purchaseReason}` : ''}` });
    expenses.push({ id: input.expenseId || this.genId(), amount: actualPrice, category: 'other', source: 'wish', relatedWishId: item.id, note: item.name, occurredOn: today, createdAt: now, updatedAt: now });
    if (!this._set('expenses', expenses)) return { ok: false, error: '购买记录保存失败' };
    if (!this._set('wish', wishes)) { this._set('expenses', expensesBefore); return { ok: false, error: '物品保存失败，消费记录已回滚' }; }
    return { ok: true, item };
  },

  // ---- full data IO ----
  exportAll() {
    const timelinePlans = (() => {
      let plans = {};
      try { plans = JSON.parse(localStorage.getItem('daily.timelinePlanner.plans.v1')) || {}; } catch { plans = {}; }
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem('daily.timelinePlanner.v1')); } catch { legacy = null; }
      if (legacy?.schemaVersion === 1 && Array.isArray(legacy.items)) plans[legacy.localDate] = legacy;
      return plans;
    })();
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      config: this._get('config') || {},
      wish: this.getWishItems(),
      countdown: this.getCountdownEvents(),
      note: this.getNoteItems(),
      expenses: this.getExpenses(),
      timelinePlanner: (() => { try { return JSON.parse(localStorage.getItem('daily.timelinePlanner.v1')); } catch { return null; } })(),
      timelinePlans,
    };
  },
  importAll(data) {
    if (!DailyDomain.validateImport(data).ok) return false;
    const incoming = { ...data };
    if (data.version === 1 && !Object.hasOwn(data, 'expenses')) incoming.expenses = [];
    if (Object.hasOwn(incoming, 'timelinePlanner') && incoming.timelinePlanner !== null && (incoming.timelinePlanner?.schemaVersion !== 1 || !Array.isArray(incoming.timelinePlanner.items))) return false;
    if (Object.hasOwn(incoming, 'timelinePlans') && (!incoming.timelinePlans || Array.isArray(incoming.timelinePlans) || typeof incoming.timelinePlans !== 'object' || Object.entries(incoming.timelinePlans).some(([date, plan]) => plan?.schemaVersion !== 1 || plan.localDate !== date || !Array.isArray(plan.items)))) return false;
    const fields = ['config','wish','countdown','note','expenses'];
    const before = Object.fromEntries(fields.map(key => [key, this._get(key)]));
    for (const key of fields) if (Object.hasOwn(incoming, key) && !this._set(key, incoming[key])) {
      for (const restoreKey of fields) if (before[restoreKey] === null) localStorage.removeItem(this._prefix + restoreKey); else this._set(restoreKey, before[restoreKey]);
      return false;
    }
    if (Object.hasOwn(incoming, 'timelinePlans')) {
      try {
        localStorage.setItem('daily.timelinePlanner.plans.v1', JSON.stringify(incoming.timelinePlans));
        const todayPlan = incoming.timelinePlans[this.today()];
        if (todayPlan) localStorage.setItem('daily.timelinePlanner.v1', JSON.stringify(todayPlan)); else localStorage.removeItem('daily.timelinePlanner.v1');
      } catch { return false; }
    } else if (Object.hasOwn(incoming, 'timelinePlanner') && incoming.timelinePlanner !== null && !this.saveTimelinePlan(incoming.timelinePlanner)) return false;
    this.clearObsoleteData();
    return true;
  },
  clearAll() {
    ['config','wish','study','countdown','note','expenses','bgImage','timelinePlanner.v1','timelinePlanner.snapshots.v1'].forEach(k => localStorage.removeItem(this._prefix + k));
    localStorage.removeItem('daily.timelinePlanner.v1');
    localStorage.removeItem('daily.timelinePlanner.snapshots.v1');
    localStorage.removeItem('daily.timelinePlanner.plans.v1');
  },

  // ---- wishlist-specific data IO ---- (用于清单页面独立导入导出)
  exportWishData() {
    return { version: 2, exportedAt: new Date().toISOString(), wish: this._get('wish') };
  },
  importWishData(data) {
    if (!DailyDomain.validateImport(data).ok || !Object.hasOwn(data, 'wish')) return false;
    this._set('wish', data.wish);
    return true;
  },
  clearWishData() {
    localStorage.removeItem(this._prefix + 'wish');
  },

  // ---- helpers ----
  genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  today(date) { return DateUtils.localDate(date); },
};
if (typeof module === 'object' && module.exports) module.exports = Store;
