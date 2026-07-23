(function (root, factory) {
  const api = factory(root.DateUtils || (typeof require === 'function' ? require('./date-utils.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DailyDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DateUtils) {
  const TYPES = ['task', 'book', 'movie', 'series', 'idea'];
  const CATEGORIES = ['drink', 'snack', 'dining', 'entertainment', 'game_merch', 'other'];
  const STATUSES = ['active', 'in_progress', 'done', 'snoozed', 'archived'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function normalizeWish(item) {
    const now = new Date().toISOString();
    const price = Math.max(0, finite(item?.plannedPrice ?? item?.price));
    const createdAt = item?.createdAt || now;
    return {
      ...item,
      id: String(item?.id || ''), name: String(item?.name || ''), price,
      plannedPrice: price,
      dailyProgress: Math.max(0, finite(item?.dailyProgress, 1)),
      currentProgress: Math.min(price, Math.max(0, finite(item?.currentProgress))),
      status: ['active', 'purchased', 'abandoned', 'archived'].includes(item?.status) ? item.status : 'active',
      sealed: item?.sealed !== false,
      progressLog: Array.isArray(item?.progressLog) ? item.progressLog : (Array.isArray(item?.clickLog) ? item.clickLog : []),
      createdAt, updatedAt: item?.updatedAt || createdAt,
      lastProgressOn: item?.lastProgressOn || DateUtils.localDate(new Date(item?.updatedAt || createdAt)),
    };
  }

  function applyWishProgress(rawItem, today) {
    const item = normalizeWish(clone(rawItem));
    if (item.status !== 'active' || item.currentProgress >= item.price || item.dailyProgress <= 0) return { item, changed: false };
    const createdOn = DateUtils.localDate(new Date(item.createdAt));
    let cursor = item.lastProgressOn || createdOn;
    const elapsed = DateUtils.daysBetween(cursor, today);
    if (elapsed <= 0) return { item, changed: false };
    for (let day = 1; day <= elapsed && item.currentProgress < item.price; day += 1) {
      const date = DateUtils.addDays(cursor, day);
      const amount = Math.min(item.dailyProgress, item.price - item.currentProgress);
      item.currentProgress += amount;
      item.progressLog.push({ date, amount, reason: '自动等待进度' });
    }
    item.lastProgressOn = today;
    item.updatedAt = new Date().toISOString();
    return { item, changed: true };
  }

  function inferCandidate(input) {
    const text = `${input.title || ''} ${input.note || ''}`.toLowerCase();
    let type = TYPES.includes(input.type) ? input.type : 'task';
    if (/电影|影片|movie/.test(text)) type = 'movie';
    else if (/剧|番|series|season/.test(text)) type = 'series';
    else if (/书|阅读|读完|book/.test(text)) type = 'book';
    else if (/想法|灵感|idea/.test(text)) type = 'idea';
    let inferred = { sessionMode: 'flexible', minSessionMinutes: 30, inferenceConfidence: 0.35 };
    if (type === 'movie') inferred = { sessionMode: 'continuous', minSessionMinutes: 90, inferenceConfidence: 0.65 };
    else if (type === 'series') inferred = { sessionMode: 'segmentable', minSessionMinutes: 25, inferenceConfidence: 0.4 };
    else if (type === 'book') inferred = { sessionMode: 'segmentable', minSessionMinutes: 20, inferenceConfidence: 0.65 };
    else if (/整理|收拾|打扫/.test(text)) inferred = { sessionMode: 'flexible', minSessionMinutes: 15, estimatedMinutes: 30, inferenceConfidence: 0.7 };
    else if (/电话|预约|购买|下单/.test(text)) inferred = { sessionMode: 'flexible', minSessionMinutes: 5, estimatedMinutes: 15, inferenceConfidence: 0.7 };
    const now = new Date().toISOString();
    return {
      id: input.id || '', title: String(input.title || '').trim(), note: String(input.note || '').trim(), type,
      ...inferred, ...input,
      minSessionMinutes: Math.max(1, finite(input.minSessionMinutes, inferred.minSessionMinutes)),
      sessionMode: ['continuous', 'segmentable', 'flexible'].includes(input.sessionMode) ? input.sessionMode : inferred.sessionMode,
      inferenceSource: input.inferenceSource || 'rule',
      status: STATUSES.includes(input.status) ? input.status : 'active',
      createdAt: input.createdAt || now, updatedAt: input.updatedAt || now,
    };
  }

  function migrateNote(note) {
    const typeMap = { task: 'task', media: 'movie', idea: 'idea' };
    const legacyType = note.type || note.tag;
    return inferCandidate({ ...note, title: note.title || note.content || '', note: note.note || '', type: typeMap[legacyType] || legacyType, status: note.done ? 'done' : note.status });
  }

  function normalizeExpense(item) {
    const now = new Date().toISOString();
    return { ...item, id: String(item?.id || ''), amount: Math.max(0, finite(item?.amount)), category: CATEGORIES.includes(item?.category) ? item.category : 'other', source: item?.source === 'wish' ? 'wish' : 'quick', occurredOn: /^\d{4}-\d{2}-\d{2}$/.test(item?.occurredOn || '') ? item.occurredOn : DateUtils.localDate(), createdAt: item?.createdAt || now, updatedAt: item?.updatedAt || now };
  }

  function validateImport(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: '导入文件必须是对象' };
    if (!Number.isInteger(data.version) || data.version < 1 || data.version > 3) return { ok: false, error: '不支持的数据版本' };
    const arrays = ['wish', 'study', 'countdown', 'note', 'candidates', 'expenses', 'recommendationEvents', 'snapshots'];
    for (const key of arrays) if (Object.hasOwn(data, key) && !Array.isArray(data[key])) return { ok: false, error: `${key} 必须是数组` };
    if (Object.hasOwn(data, 'config') && (data.config === null || typeof data.config !== 'object' || Array.isArray(data.config))) return { ok: false, error: 'config 必须是对象' };
    if (data.wish?.some(item => !item || typeof item !== 'object' || typeof item.name !== 'string')) return { ok: false, error: '愿望数据结构无效' };
    if (data.expenses?.some(item => !item || finite(item.amount, -1) < 0)) return { ok: false, error: '消费数据结构无效' };
    return { ok: true };
  }

  function recommend(items, availableMinutes, events = [], random = Math.random) {
    const minutes = Math.max(1, finite(availableMinutes, 30));
    const recent = events.slice(-30);
    const snoozedToday = new Set(recent.filter(event => event.type === 'snoozed' && DateUtils.localDate(new Date(event.createdAt)) === DateUtils.localDate()).map(event => event.candidateId));
    const eligible = items.filter(item => ['active', 'in_progress'].includes(item.status) && !snoozedToday.has(item.id)).filter(item => item.sessionMode === 'continuous' ? (!item.estimatedMinutes || item.estimatedMinutes <= minutes * 1.15) : item.minSessionMinutes <= minutes);
    const scored = eligible.map(item => {
      const target = item.estimatedMinutes || item.minSessionMinutes;
      let score = 100 - Math.min(60, Math.abs(minutes - target));
      if (item.deadline) score += Math.max(0, 30 - DateUtils.daysBetween(DateUtils.localDate(), item.deadline));
      score += Math.min(20, Math.floor(DateUtils.daysBetween(DateUtils.localDate(new Date(item.createdAt)), DateUtils.localDate()) / 7));
      score -= recent.filter(event => event.candidateId === item.id && ['suggested', 'switched'].includes(event.type)).length * 8;
      return { item, score };
    }).sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    const pool = scored.slice(0, Math.min(3, scored.length));
    return pool[Math.floor(random() * pool.length)].item;
  }

  class InferenceProvider { infer() { throw new Error('InferenceProvider.infer must be implemented'); } }
  class RuleInferenceProvider extends InferenceProvider { infer(input) { return Promise.resolve(inferCandidate(input)); } }

  return { TYPES, CATEGORIES, normalizeWish, applyWishProgress, inferCandidate, migrateNote, normalizeExpense, validateImport, recommend, InferenceProvider, RuleInferenceProvider };
});
