const Store = {
  _prefix: 'daily_',

  _get(key) {
    try { return JSON.parse(localStorage.getItem(this._prefix + key)); }
    catch { return null; }
  },
  _set(key, val) {
    localStorage.setItem(this._prefix + key, JSON.stringify(val));
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
  saveWishItems(items) { this._set('wish', items); },

  // ---- countdown events ----
  getCountdownEvents() { return this._get('countdown') || []; },
  saveCountdownEvents(events) { this._set('countdown', events); },

  getExpenses() { return this._get('expenses') || []; },
  saveExpenses(items) { this._set('expenses', items); },
  clearObsoleteData() {
    localStorage.removeItem(this._prefix + 'study');
    localStorage.removeItem(this._prefix + 'bgImage');
  },

  // ---- note items ----
  getNoteItems() { return this._get('note') || []; },
  saveNoteItems(items) { this._set('note', items); },

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
