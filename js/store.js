const Store = {
  _prefix: 'daily_',

  _get(key) {
    try { return JSON.parse(localStorage.getItem(this._prefix + key)); }
    catch { return null; }
  },
  _set(key, val) {
    try { localStorage.setItem(this._prefix + key, JSON.stringify(val)); return true; }
    catch (_) { Toast?.show?.('保存失败：本地空间可能已满，请先导出或清理数据。'); return false; }
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
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      config: this._get('config'),
      wish: this._get('wish'),
      countdown: this._get('countdown'),
      note: this._get('note'),
      expenses: this._get('expenses'),
    };
  },
  importAll(data) {
    if (!data || !data.version) return false;
    if (data.config) this._set('config', data.config);
    if (data.wish) this._set('wish', data.wish);
    if (data.countdown) this._set('countdown', data.countdown);
    if (data.note) this._set('note', data.note);
    if (data.expenses) this._set('expenses', data.expenses);
    return true;
  },
  clearAll() {
    ['config','wish','study','countdown','note','expenses','bgImage'].forEach(k => localStorage.removeItem(this._prefix + k));
  },

  // ---- wishlist-specific data IO ---- (用于清单页面独立导入导出)
  exportWishData() {
    return { version: 1, exportedAt: new Date().toISOString(), wish: this._get('wish') };
  },
  importWishData(data) {
    if (!data || !data.wish) return false;
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
