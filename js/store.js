const Store = {
  _prefix: 'daily_',
  SCHEMA_VERSION: 4,
  _errorHandler: null,
  onError(handler) { this._errorHandler = handler; },
  _fail(message, error) { this._errorHandler?.(message, error); return false; },
  _get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this._prefix + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) { this._fail(`无法读取本地数据：${key}`, error); return fallback; }
  },
  _set(key, value, options = {}) {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new TypeError('数据无法序列化');
      if (options.snapshot !== false) this._snapshotKey(key);
      localStorage.setItem(this._prefix + key, serialized);
      return true;
    } catch (error) { return this._fail('保存失败：本地空间可能已满，请先导出或清理数据。', error); }
  },
  _remove(key) { try { localStorage.removeItem(this._prefix + key); return true; } catch (error) { return this._fail('清理本地数据失败。', error); } },
  _snapshotKey(key) {
    if (key === 'snapshots') return;
    try {
      const storageKey = this._prefix + key;
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return;
      const snapshots = this._get('snapshots', []);
      snapshots.push({ id: this.genId(), key, savedAt: new Date().toISOString(), value: JSON.parse(raw) });
      localStorage.setItem(this._prefix + 'snapshots', JSON.stringify(snapshots.slice(-10)));
    } catch (_) { /* snapshots are best effort; primary writes still proceed */ }
  },

  getConfig() { const stored = this._get('config', {}); return { MAX_DAILY_WISH_CLICKS: 3, showDailyCost: true, ...stored, features: { studyEnabled: false, ...(stored.features || {}) } }; },
  updateConfig(partial) { const current = this.getConfig(); return this._set('config', { ...current, ...partial, features: { ...current.features, ...(partial.features || {}) } }); },
  getWishItems() { return this._get('wish', []).map(DailyDomain.normalizeWish); },
  saveWishItems(value) { return this._set('wish', value); },
  getStudyPlans() { return this._get('study', []); }, saveStudyPlans(value) { return this._set('study', value); },
  getCountdownEvents() { return this._get('countdown', []); }, saveCountdownEvents(value) { return this._set('countdown', value); },
  getNoteItems() { return this.getCandidateItems(); }, saveNoteItems(value) { return this.saveCandidateItems(value); },
  getCandidateItems() {
    const current = this._get('candidate_items', null);
    const source = current === null ? this._get('note', []) : current;
    return source.map(DailyDomain.migrateNote);
  },
  saveCandidateItems(value) { return this._set('candidate_items', value); },
  getExpenses() { return this._get('expenses', []).map(DailyDomain.normalizeExpense); }, saveExpenses(value) { return this._set('expenses', value); },
  getExperiences() { return this._get('experiences', []); }, saveExperiences(value) { return this._set('experiences', value.slice(-2000)); },
  getRecommendationEvents() { return this._get('recommendation_events', []); },
  saveRecommendationEvents(value) { return this._set('recommendation_events', value.slice(-1000)); },
  addRecommendationEvent(type, candidateId, details = {}) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const events = this.getRecommendationEvents().filter(item => new Date(item.createdAt) >= cutoff);
    events.push({ id: this.genId(), type, candidateId, details, createdAt: new Date().toISOString() });
    const saved = this.saveRecommendationEvents(events);
    const profile = this.getRecommendationProfile();
    for (const key of Object.keys(profile)) if (typeof profile[key] === 'number') profile[key] *= 0.995;
    if (type === 'completed') profile.completed = (profile.completed || 0) + 1;
    if (type === 'time_mismatch') profile.timeMismatch = (profile.timeMismatch || 0) + 1;
    if (type === 'switched') profile.switched = (profile.switched || 0) + 0.2;
    this.saveRecommendationProfile(profile);
    return saved;
  },
  getRecommendationProfile() { return this._get('recommendation_profile', {}); },
  saveRecommendationProfile(value) { return this._set('recommendation_profile', value); },
  clearRecommendationHistory() { return this._set('recommendation_events', []); },
  resetRecommendationProfile() { return this._set('recommendation_profile', {}); },
  getTimer() { return this._get('timer', null); }, saveTimer(value) { return this._set('timer', value); },
  getSnapshots() { return this._get('snapshots', []); },
  restoreSnapshot(id) { const item = this.getSnapshots().find(entry => entry.id === id); return item ? this._set(item.key, item.value, { snapshot: false }) : false; },

  exportAll() {
    return { version: this.SCHEMA_VERSION, exportedAt: new Date().toISOString(), config: this._get('config', {}), wish: this._get('wish', []), study: this._get('study', []), countdown: this._get('countdown', []), note: this._get('note', []), candidates: this.getCandidateItems(), expenses: this._get('expenses', []), experiences: this.getExperiences(), recommendationEvents: this._get('recommendation_events', []), recommendationProfile: this._get('recommendation_profile', {}), recommendationSettings: this._get('recommendation_settings', {}), timer: this._get('timer', null) };
  },
  importAll(data) {
    const validation = DailyDomain.validateImport(data);
    if (!validation.ok) return validation;
    const imported = { ...data };
    if (!Object.hasOwn(imported, 'candidates') && Object.hasOwn(imported, 'note')) {
      imported.candidates = imported.note.map(DailyDomain.migrateNote);
    }
    const mapping = { config: 'config', wish: 'wish', study: 'study', countdown: 'countdown', note: 'note', candidates: 'candidate_items', expenses: 'expenses', experiences: 'experiences', recommendationEvents: 'recommendation_events', recommendationProfile: 'recommendation_profile', recommendationSettings: 'recommendation_settings', timer: 'timer' };
    const before = this.exportAll();
    this._set('full-import', before, { snapshot: false });
    for (const [field, key] of Object.entries(mapping)) if (Object.hasOwn(imported, field) && !this._set(key, imported[field], { snapshot: false })) {
      for (const [oldField, oldKey] of Object.entries(mapping)) this._set(oldKey, before[oldField], { snapshot: false });
      return { ok: false, error: '写入导入数据失败，已恢复导入前数据' };
    }
    return { ok: true };
  },
  purchaseWish(wishId, input) {
    const wishesBefore = this.getWishItems();
    const expensesBefore = this.getExpenses();
    const wishes = JSON.parse(JSON.stringify(wishesBefore));
    const expenses = JSON.parse(JSON.stringify(expensesBefore));
    const item = wishes.find(value => value.id === wishId);
    const actualPrice = Number(input?.actualPrice);
    if (!item || item.status !== 'active') return { ok: false, error: '愿望状态已变化，请刷新后重试' };
    if (!Number.isFinite(actualPrice) || actualPrice < 0) return { ok: false, error: '请输入有效实际价格' };
    const now = input.now || new Date().toISOString();
    const today = input.today || this.today();
    item.status = 'purchased';
    item.plannedPrice = item.price;
    item.actualPrice = actualPrice;
    item.purchasedAt = now;
    item.progressAtPurchase = item.currentProgress;
    item.purchaseTiming = item.currentProgress >= item.price ? 'ready' : 'early';
    item.purchaseReason = String(input.reason || '').trim();
    if (!Array.isArray(item.actionLog)) item.actionLog = [];
    item.actionLog.push({ date: today, type: 'purchased', reason: `购买 · 实际 ¥${actualPrice.toFixed(2)}${item.purchaseReason ? ` · ${item.purchaseReason}` : ''}` });
    expenses.push({ id: input.expenseId || this.genId(), amount: actualPrice, category: 'other', source: 'wish', relatedWishId: item.id, note: item.name, occurredOn: today, createdAt: now, updatedAt: now });
    if (!this._set('expenses', expenses)) return { ok: false, error: '购买记录保存失败' };
    if (!this._set('wish', wishes)) {
      this._set('expenses', expensesBefore, { snapshot: false });
      return { ok: false, error: '愿望保存失败，消费记录已回滚' };
    }
    return { ok: true, item };
  },
  recordExperience(candidateId, input = {}) {
    const candidatesBefore = this.getCandidateItems();
    const experiencesBefore = this.getExperiences();
    const candidates = JSON.parse(JSON.stringify(candidatesBefore));
    const experiences = JSON.parse(JSON.stringify(experiencesBefore));
    const item = candidates.find(value => value.id === candidateId);
    if (!item) return { ok: false, error: '候选事项已不存在' };
    const outcome = ['partial', 'completed', 'stopped'].includes(input.outcome) ? input.outcome : 'partial';
    const now = input.endedAt || new Date().toISOString();
    const experience = {
      id: input.id || this.genId(), candidateId: item.id, title: item.title, type: item.type,
      lifecycle: item.lifecycle, outcome, plannedMinutes: Math.max(1, Number(input.plannedMinutes) || 1),
      actualMinutes: Math.max(1, Number(input.actualMinutes) || 1), note: String(input.note || '').trim(),
      startedAt: input.startedAt || now, endedAt: now, occurredOn: input.occurredOn || this.today(new Date(now)),
    };
    experiences.push(experience);
    if (outcome === 'completed') item.status = item.lifecycle === 'repeatable' ? 'active' : 'done';
    else if (outcome === 'partial') item.status = 'in_progress';
    item.updatedAt = now;
    if (!this._set('experiences', experiences)) return { ok: false, error: '投入记录保存失败' };
    if (!this._set('candidate_items', candidates)) {
      this._set('experiences', experiencesBefore, { snapshot: false });
      return { ok: false, error: '事项状态保存失败，投入记录已回滚' };
    }
    return { ok: true, experience, item };
  },
  clearAll() { ['config','wish','study','countdown','note','candidate_items','expenses','experiences','recommendation_events','recommendation_profile','recommendation_settings','timer','snapshots','full-import'].forEach(key => this._remove(key)); },
  clearObsoleteData() {
    try { localStorage.removeItem(this._prefix + ['bg', 'Image'].join('')); } catch (_) { /* best-effort migration cleanup */ }
  },
  exportWishData() { return { version: this.SCHEMA_VERSION, exportedAt: new Date().toISOString(), wish: this._get('wish', []) }; },
  importWishData(data) { const validation = DailyDomain.validateImport(data); if (!validation.ok || !Object.hasOwn(data, 'wish')) return false; return this._set('wish', data.wish); },
  clearWishData() { return this._remove('wish'); },
  genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  today(date) { return DateUtils.localDate(date); },
};
