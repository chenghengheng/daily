const test = require('node:test');
const assert = require('node:assert/strict');
const Domain = require('../js/domain.js');

test('新建当天立即产生一次等待进度', () => { const item = Domain.createWish({ id: 'w1', name: '耳机', price: 100, dailyProgress: 5, today: '2026-07-30', now: '2026-07-30T10:00:00+08:00' }); assert.equal(item.currentProgress, 5); assert.equal(item.progressLog[0].amount, 5); });
test('同一天重复计算不会增加', () => { const item = Domain.createWish({ id: 'w1', name: '耳机', price: 100, dailyProgress: 5, today: '2026-07-30' }); assert.equal(Domain.applyWishProgress(item, '2026-07-30').changed, false); });
test('跨日逐日补齐并在目标处按真实金额封顶', () => { const item = Domain.createWish({ id: 'w1', name: '耳机', price: 12, dailyProgress: 5, today: '2026-07-28' }); const result = Domain.applyWishProgress(item, '2026-07-30'); assert.equal(result.item.currentProgress, 12); assert.deepEqual(result.item.progressLog.map(log => log.amount), [5, 5, 2]); });
test('达到目标后保持 active 但不再累计', () => { const item = Domain.createWish({ id: 'w1', name: '耳机', price: 5, dailyProgress: 5, today: '2026-07-28' }); const result = Domain.applyWishProgress(item, '2026-07-30'); assert.equal(result.item.status, 'active'); assert.equal(result.changed, false); });
test('已累积使用活动进度、购买实价与随手花且不重复清单消费', () => { const total = Domain.accumulatedAmount([{ status: 'active', currentProgress: 20 }, { status: 'purchased', price: 100, actualPrice: 80 }, { status: 'abandoned', currentProgress: 99 }], [{ source: 'quick', amount: 30 }, { source: 'wish', amount: 80 }]); assert.equal(total, 130); });
test('v1 导入可接受但学习和背景不属于有效写入字段', () => { assert.equal(Domain.validateImport({ version: 1, wish: [], study: [{ id: 1 }], bgImage: 'data:x' }).ok, true); });
test('导入拒绝错误数组和非法消费金额', () => { assert.equal(Domain.validateImport({ version: 2, wish: {} }).ok, false); assert.equal(Domain.validateImport({ version: 2, expenses: [{ amount: -1 }] }).ok, false); });
