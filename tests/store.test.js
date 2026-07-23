const test = require('node:test');
const assert = require('node:assert/strict');
global.DateUtils = require('../js/date-utils.js');
global.DailyDomain = require('../js/domain.js');
const values = new Map();
global.localStorage = { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
const fs = require('node:fs');
const vm = require('node:vm');
vm.runInThisContext(`${fs.readFileSync(require.resolve('../js/store.js'), 'utf8')}\n;global.Store = Store;`);

test.beforeEach(() => values.clear());
test('导入空数组、false 和 0 会覆盖旧值', () => {
  Store.saveWishItems([{ id: 'old', name: '旧', price: 1 }]);
  const result = Store.importAll({ version: 3, wish: [], config: { showDailyCost: false, count: 0 } });
  assert.equal(result.ok, true); assert.deepEqual(Store.getWishItems(), []); assert.equal(Store.getConfig().showDailyCost, false); assert.equal(Store.getConfig().count, 0);
});
test('非法导入不会覆盖现有数据', () => {
  Store.saveWishItems([{ id: 'old', name: '旧', price: 1 }]);
  const result = Store.importAll({ version: 3, wish: {} });
  assert.equal(result.ok, false); assert.equal(Store.getWishItems()[0].name, '旧');
});
test('序列化与容量异常会报告且返回 false', () => {
  let message = ''; Store.onError(value => { message = value; });
  const circular = {}; circular.self = circular;
  assert.equal(Store._set('bad', circular), false); assert.match(message, /保存失败/);
});
test('只保留最近十个快照并可恢复', () => {
  for (let index = 0; index < 12; index += 1) Store._set('config', { index });
  assert.equal(Store.getSnapshots().length, 10);
  const latest = Store.getSnapshots().at(-1); assert.equal(Store.restoreSnapshot(latest.id), true);
});
test('完整导出包含必需数据域和版本', () => {
  const data = Store.exportAll();
  for (const key of ['version','config','wish','study','countdown','note','candidates','expenses','recommendationEvents','recommendationProfile','recommendationSettings','timer']) assert.ok(Object.hasOwn(data, key), key);
  assert.equal(Object.hasOwn(data, 'bgImage'), false);
});
test('只有旧随手记时完整导出仍包含迁移后的候选事项', () => {
  values.set('daily_note', JSON.stringify([{ id: 'n1', title: '看电影', tag: 'media', status: 'active' }]));
  const data = Store.exportAll(); assert.equal(data.candidates.length, 1); assert.equal(data.candidates[0].title, '看电影');
});
test('导入旧 note 备份会覆盖已有 candidate_items', () => {
  Store.saveCandidateItems([{ id: 'current', title: '当前事项', type: 'task', status: 'active' }]);
  const result = Store.importAll({ version: 2, note: [{ id: 'legacy', title: '旧备份事项', tag: 'task', status: 'active' }] });
  assert.equal(result.ok, true);
  assert.deepEqual(Store.getCandidateItems().map(item => item.id), ['legacy']);
});
test('购买愿望通过一个命令同时写入愿望和消费', () => {
  Store.saveWishItems([{ id: 'w1', name: '耳机', price: 100, currentProgress: 20, dailyProgress: 1, status: 'active' }]);
  const result = Store.purchaseWish('w1', { actualPrice: 88, reason: '需要', now: '2026-07-23T10:00:00.000Z', today: '2026-07-23', expenseId: 'e1' });
  assert.equal(result.ok, true);
  assert.equal(Store.getWishItems()[0].status, 'purchased');
  assert.deepEqual(Store.getExpenses().map(item => [item.id, item.relatedWishId, item.amount]), [['e1', 'w1', 88]]);
});
test('购买愿望第二次写入失败时回滚消费记录', () => {
  Store.saveWishItems([{ id: 'w1', name: '耳机', price: 100, currentProgress: 20, dailyProgress: 1, status: 'active' }]);
  const originalSetItem = localStorage.setItem;
  let failed = false;
  localStorage.setItem = (key, value) => {
    if (!failed && key === 'daily_wish') { failed = true; throw new Error('quota'); }
    return originalSetItem(key, value);
  };
  try {
    const result = Store.purchaseWish('w1', { actualPrice: 88, now: '2026-07-23T10:00:00.000Z', today: '2026-07-23', expenseId: 'e1' });
    assert.equal(result.ok, false);
    assert.equal(Store.getWishItems()[0].status, 'active');
    assert.deepEqual(Store.getExpenses(), []);
  } finally {
    localStorage.setItem = originalSetItem;
  }
});
