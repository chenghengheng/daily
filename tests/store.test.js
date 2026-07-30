const test = require('node:test');
const assert = require('node:assert/strict');
global.DateUtils = require('../js/date-utils.js');
global.DailyDomain = require('../js/domain.js');
const memory = new Map();
global.localStorage = { getItem: key => memory.has(key) ? memory.get(key) : null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
const Store = require('../js/store.js');
test.beforeEach(() => memory.clear());

test('提前购买用实际价格替换等待进度并生成关联消费', () => {
  Store.saveWishItems([DailyDomain.createWish({ id: 'w1', name: '耳机', price: 500, dailyProgress: 200, today: '2026-07-30' })]);
  const result = Store.purchaseWish('w1', { actualPrice: 430, reason: '活动价', today: '2026-07-30', now: '2026-07-30T10:00:00+08:00', expenseId: 'e1' });
  assert.equal(result.ok, true); const item = Store.getWishItems()[0]; assert.equal(item.purchaseTiming, 'early'); assert.equal(item.progressAtDecision, 200); assert.equal(item.currentProgress, 0); assert.equal(item.actualPrice, 430); assert.equal(Store.getExpenses()[0].amount, 430);
});
test('达标购买标记 ready 且实际价格可不同于目标价', () => { Store.saveWishItems([DailyDomain.createWish({ id: 'w1', name: '耳机', price: 100, dailyProgress: 100, today: '2026-07-30' })]); Store.purchaseWish('w1', { actualPrice: 80, today: '2026-07-30' }); assert.equal(Store.getWishItems()[0].purchaseTiming, 'ready'); assert.equal(Store.getWishItems()[0].actualPrice, 80); });
test('购买第二次写入失败时回滚消费', () => { Store.saveWishItems([DailyDomain.createWish({ id: 'w1', name: '耳机', price: 100, dailyProgress: 10, today: '2026-07-30' })]); const original = Store._set.bind(Store); let count = 0; Store._set = (key, value) => { count += 1; return count === 2 ? false : original(key, value); }; const result = Store.purchaseWish('w1', { actualPrice: 80, today: '2026-07-30' }); Store._set = original; assert.equal(result.ok, false); assert.equal(Store.getExpenses().length, 0); });
