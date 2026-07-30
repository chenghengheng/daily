(function (root, factory) {
  const api = factory(root.DateUtils || (typeof require === 'function' ? require('./date-utils.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DailyDomain = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (DateUtils) {
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = value => JSON.parse(JSON.stringify(value));
  function normalizeWish(raw) {
    const now = new Date().toISOString();
    const createdAt = raw?.createdAt || now;
    const price = Math.max(0, number(raw?.plannedPrice ?? raw?.price));
    return { ...raw, id: String(raw?.id || ''), name: String(raw?.name || ''), price, plannedPrice: price, dailyProgress: Math.max(0, number(raw?.dailyProgress, 1)), currentProgress: Math.min(price, Math.max(0, number(raw?.currentProgress))), status: ['active','purchased','abandoned'].includes(raw?.status) ? raw.status : 'active', sealed: raw?.sealed !== false, progressLog: Array.isArray(raw?.progressLog) ? raw.progressLog : (Array.isArray(raw?.clickLog) ? raw.clickLog : []), actionLog: Array.isArray(raw?.actionLog) ? raw.actionLog : [], createdAt, updatedAt: raw?.updatedAt || createdAt, lastProgressOn: raw?.lastProgressOn || DateUtils.localDate(new Date(raw?.updatedAt || createdAt)) };
  }
  function createWish(input) {
    const price = Math.max(0, number(input.price));
    const dailyProgress = Math.max(0, number(input.dailyProgress, 1));
    const amount = Math.min(price, dailyProgress);
    const today = input.today || DateUtils.localDate();
    const now = input.now || new Date().toISOString();
    return normalizeWish({ id: input.id, name: input.name, price, dailyProgress, currentProgress: amount, status: 'active', sealed: true, progressLog: amount ? [{ date: today, amount, reason: '新增物品，开始等待进度' }] : [], actionLog: [], createdAt: now, updatedAt: now, lastProgressOn: today });
  }
  function applyWishProgress(raw, today = DateUtils.localDate()) {
    const item = normalizeWish(clone(raw));
    if (item.status !== 'active' || item.currentProgress >= item.price || item.dailyProgress <= 0) return { item, changed: false };
    const elapsed = DateUtils.daysBetween(item.lastProgressOn, today);
    if (elapsed <= 0) return { item, changed: false };
    for (let offset = 1; offset <= elapsed && item.currentProgress < item.price; offset += 1) {
      const date = DateUtils.addDays(item.lastProgressOn, offset);
      const amount = Math.min(item.dailyProgress, item.price - item.currentProgress);
      item.currentProgress += amount;
      item.progressLog.push({ date, amount, reason: '自动等待进度' });
    }
    item.lastProgressOn = today; item.updatedAt = new Date().toISOString();
    return { item, changed: true };
  }
  function accumulatedAmount(wishes, expenses) {
    const active = wishes.filter(item => item.status === 'active').reduce((sum, item) => sum + Math.max(0, number(item.currentProgress)), 0);
    const purchased = wishes.filter(item => item.status === 'purchased').reduce((sum, item) => sum + Math.max(0, number(item.actualPrice, item.price)), 0);
    const quick = expenses.filter(item => item.source !== 'wish' && !item.deletedAt).reduce((sum, item) => sum + Math.max(0, number(item.amount)), 0);
    return active + purchased + quick;
  }
  return { normalizeWish, createWish, applyWishProgress, accumulatedAmount };
}));
