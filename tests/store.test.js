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
test('v1 导入忽略学习与背景并迁移为空消费', () => { memory.set('daily_study', '[1]'); memory.set('daily_bgImage', '"x"'); assert.equal(Store.importAll({ version: 1, wish: [], study: [{ id: 1 }], bgImage: 'x' }), true); assert.equal(memory.has('daily_study'), false); assert.equal(memory.has('daily_bgImage'), false); assert.deepEqual(Store.exportAll().expenses, []); assert.equal(Object.hasOwn(Store.exportAll(), 'study'), false); });
test('空数组可以覆盖且非法导入不覆盖现有数据', () => { Store.saveWishItems([{ id: 'w1', name: '旧', price: 1 }]); assert.equal(Store.importAll({ version: 2, wish: [] }), true); assert.equal(Store.getWishItems().length, 0); Store.saveWishItems([{ id: 'w2', name: '保留', price: 1 }]); assert.equal(Store.importAll({ version: 2, wish: {} }), false); assert.equal(Store.getWishItems()[0].name, '保留'); });
test('时间轴按规格键名保存并保留最近五个快照', () => {
  const base = { schemaVersion: 1, localDate: '2026-07-30', items: [], updatedAt: 'a' };
  for (let index = 0; index < 7; index += 1) Store.saveTimelinePlan({ ...base, updatedAt: String(index) });
  assert.equal(JSON.parse(memory.get('daily.timelinePlanner.v1')).updatedAt, '6');
  assert.equal(JSON.parse(memory.get('daily.timelinePlanner.snapshots.v1')).length, 5);
  assert.equal(Store.getTimelinePlan('2026-07-30').updatedAt, '6');
});
test('时间轴可按日期保存并读取多个后续计划', () => {
  Store.saveTimelinePlan({ schemaVersion: 1, localDate: '2099-08-01', items: [{ id: 'a' }], updatedAt: 'a' });
  Store.saveTimelinePlan({ schemaVersion: 1, localDate: '2099-08-03', items: [{ id: 'b' }], updatedAt: 'b' });
  assert.equal(Store.getTimelinePlan('2099-08-01').items[0].id, 'a');
  assert.deepEqual(Store.getTimelinePlans('2099-08-01').map(plan => plan.localDate), ['2099-08-01', '2099-08-03']);
});
test('旧版未编辑示例计划不再作为今日任务返回', () => {
  const today = Store.today();
  const items = [
    ['晚餐', 'normal', 40, undefined], ['地铁', 'normal', 30, undefined], ['缓冲', 'buffer', 10, undefined], ['会议', 'normal', 60, 900], ['日记', 'normal', 20, undefined],
  ].map(([title, kind, plannedDurationMinutes, fixedStartMinutes], order) => ({ id: `i${order}`, order, title, kind, plannedDurationMinutes, remainingDurationMinutes: kind === 'buffer' ? plannedDurationMinutes : undefined, fixedStartMinutes, note: '', status: 'pending' }));
  Store.saveTimelinePlan({ schemaVersion: 1, localDate: today, startTimeMinutes: 780, sourceText: '40min 晚餐\n30min 地铁\n10min ～缓冲\n@15:00 60min 会议\n20min 日记', items });
  assert.equal(Store.getTimelinePlan(today), null);
});
test('Daily 导出导入包含全部日期时间轴及开始时间', () => {
  const future = { schemaVersion: 1, localDate: '2099-08-08', startTimeMinutes: 555, sourceText: '30min 未来任务', items: [{ id: 'future', order: 0, title: '未来任务', kind: 'normal', plannedDurationMinutes: 30, note: '', status: 'pending' }] };
  Store.saveTimelinePlan(future);
  const exported = Store.exportAll();
  assert.equal(exported.timelinePlans['2099-08-08'].startTimeMinutes, 555);
  Store.clearAll();
  assert.equal(Store.importAll(exported), true);
  assert.equal(Store.getTimelinePlan('2099-08-08').startTimeMinutes, 555);
});
