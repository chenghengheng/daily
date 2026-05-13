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
    return { MAX_DAILY_WISH_CLICKS: 3, ...this._get('config') };
  },
  updateConfig(partial) {
    this._set('config', { ...this.getConfig(), ...partial });
  },

  // ---- wish items ----
  getWishItems() { return this._get('wish') || []; },
  saveWishItems(items) { this._set('wish', items); },

  // ---- study plans ----
  getStudyPlans() { return this._get('study') || []; },
  saveStudyPlans(plans) { this._set('study', plans); },

  // ---- countdown events ----
  getCountdownEvents() { return this._get('countdown') || []; },
  saveCountdownEvents(events) { this._set('countdown', events); },

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
      study: this._get('study'),
      countdown: this._get('countdown'),
      note: this._get('note'),
      bgImage: this._get('bgImage'),
    };
  },
  importAll(data) {
    if (!data || !data.version) return false;
    if (data.config) this._set('config', data.config);
    if (data.wish) this._set('wish', data.wish);
    if (data.study) this._set('study', data.study);
    if (data.countdown) this._set('countdown', data.countdown);
    if (data.note) this._set('note', data.note);
    if (data.bgImage) this._set('bgImage', data.bgImage);
    return true;
  },
  clearAll() {
    ['config','wish','study','countdown','note'].forEach(k => localStorage.removeItem(this._prefix + k));
  },

  // ---- background image ----
  getBgImage() { return this._get('bgImage') || null; },
  saveBgImage(dataUrl) { this._set('bgImage', dataUrl); },
  clearBgImage() { localStorage.removeItem(this._prefix + 'bgImage'); },

  // ---- helpers ----
  genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  today() { return new Date().toISOString().slice(0, 10); },
};
