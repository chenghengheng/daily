const test = require('node:test');
const assert = require('node:assert/strict');
const DateUtils = require('../js/date-utils.js');
const Domain = require('../js/domain.js');

function wish(overrides = {}) {
  return { id: 'w1', name: '测试', price: 100, dailyProgress: 30, currentProgress: 0, status: 'active', progressLog: [], createdAt: '2026-07-23T00:30:00+08:00', updatedAt: '2026-07-23T00:30:00+08:00', lastProgressOn: '2026-07-23', ...overrides };
}

test('UTC+8 凌晨仍使用本地自然日', () => assert.equal(DateUtils.localDate(new Date('2026-07-22T16:30:00Z')), '2026-07-23'));
test('新建后立即渲染和同日重复渲染不累计', () => {
  const first = Domain.applyWishProgress(wish(), '2026-07-23');
  const second = Domain.applyWishProgress(first.item, '2026-07-23');
  assert.equal(first.item.currentProgress, 0); assert.equal(second.item.currentProgress, 0);
});
test('新建愿望当日立即累计一次并写入本地日期日志', () => {
  const item = Domain.createWish({ id: 'new', name: '耳机', price: 100, dailyProgress: 8, today: '2026-07-23', now: '2026-07-23T10:00:00+08:00' });
  assert.equal(item.currentProgress, 8); assert.deepEqual(item.progressLog, [{ date: '2026-07-23', amount: 8, reason: '新增物品，开始等待进度' }]);
  assert.equal(Domain.applyWishProgress(item, '2026-07-23').item.currentProgress, 8);
});
test('等待进度只包含进行中愿望，购买后该愿望贡献清零', () => {
  const wishes = [
    wish({ id: 'a', currentProgress: 20 }),
    wish({ id: 'b', status: 'purchased', currentProgress: 30, actualPrice: 80 }),
    wish({ id: 'd', status: 'purchased', currentProgress: 15, actualPrice: 10 }),
    wish({ id: 'c', status: 'abandoned', currentProgress: 25 }),
  ];
  const expenses = [
    { id: 'e1', amount: 10, source: 'quick' },
    { id: 'e2', amount: 80, source: 'wish', wishId: 'b' },
  ];
  assert.equal(Domain.accumulatedAmount(wishes, expenses), 30);
  assert.equal(Domain.accumulatedAmount([], expenses), 10);
});
test('跨多日本地自然日补齐进度', () => {
  const result = Domain.applyWishProgress(wish(), '2026-07-25');
  assert.equal(result.item.currentProgress, 60); assert.deepEqual(result.item.progressLog.map(x => x.date), ['2026-07-24', '2026-07-25']);
});
test('封顶日只记录实际增加金额', () => {
  const result = Domain.applyWishProgress(wish({ currentProgress: 80, lastProgressOn: '2026-07-22' }), '2026-07-23');
  assert.equal(result.item.currentProgress, 100); assert.equal(result.item.progressLog[0].amount, 20);
  assert.equal(result.item.progressLog.reduce((sum, x) => sum + x.amount, 0), 20);
});
test('旧 clickLog 被兼容迁移', () => assert.equal(Domain.normalizeWish(wish({ progressLog: undefined, clickLog: [{ date: '2026-07-20', amount: 1 }] })).progressLog.length, 1));
test('导入校验接受空数组、false 和 0', () => assert.equal(Domain.validateImport({ version: 3, wish: [], config: { showDailyCost: false, value: 0 } }).ok, true));
test('导入校验拒绝错误结构', () => assert.match(Domain.validateImport({ version: 3, wish: {} }).error, /wish/));
test('候选事项规则覆盖电影、书籍和整理任务', () => {
  assert.equal(Domain.inferCandidate({ title: '看一部电影' }).sessionMode, 'continuous');
  assert.equal(Domain.inferCandidate({ title: '读一本书' }).minSessionMinutes, 20);
  assert.equal(Domain.inferCandidate({ title: '整理房间' }).sessionMode, 'flexible');
  assert.equal(Domain.inferCandidate({ title: '电影', type: 'movie' }).lifecycle, 'one_time');
  assert.equal(Domain.inferCandidate({ title: '读书', type: 'book' }).lifecycle, 'ongoing');
});
test('旧随手记 media 保留为待确认类型，不擅自归为影片', () => assert.equal(Domain.migrateNote({ id: 'n1', title: '待看', tag: 'media', status: 'active' }).type, 'media'));
test('用户手动选择的候选类型不会被标题关键词覆盖', () => assert.equal(Domain.inferCandidate({ title: '整理电影票', type: 'task' }).type, 'task'));
test('推荐遵守最小时长和 continuous 边界', () => {
  const items = [Domain.inferCandidate({ id: 'movie', title: '电影', type: 'movie', estimatedMinutes: 120 }), Domain.inferCandidate({ id: 'task', title: '整理桌面' })];
  assert.equal(Domain.recommend(items, 20, [], () => 0).id, 'task');
});
test('未知总时长的 continuous 事项仍遵守最小有效时长', () => {
  const movie = Domain.inferCandidate({ id: 'movie', title: '电影', type: 'movie' });
  assert.equal(Domain.recommend([movie], 10, [], () => 0), null);
  assert.equal(Domain.recommend([movie], 90, [], () => 0).id, 'movie');
});
test('推荐可以排除本轮已切换事项并生成可解释理由', () => {
  const task = Domain.inferCandidate({ id: 'task', title: '整理桌面', createdAt: '2026-07-01T00:00:00Z' });
  assert.equal(Domain.recommend([task], 30, [], () => 0, { excludedIds: ['task'] }), null);
  assert.match(Domain.explainRecommendation(task, 30, []), /30 分钟|等待/);
});
test('DeepSeek 推断只发送当前事项且保留用户标题和类型', async () => {
  let request;
  const provider = new Domain.DeepSeekInferenceProvider('test-only', async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ choices: [{ message: { content: '{"minSessionMinutes":12,"sessionMode":"flexible","energy":"low"}' } }] }) }; });
  const result = await provider.infer({ id: 'c1', title: '买灯泡', note: '楼下', type: 'task' });
  assert.equal(result.title, '买灯泡'); assert.equal(result.type, 'task'); assert.equal(result.inferenceSource, 'llm');
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions'); assert.match(request.options.headers.Authorization, /^Bearer /);
  assert.doesNotMatch(request.options.body, /test-only/);
});
test('DeepSeek 错误会显示接口返回的具体原因', async () => {
  const provider = new Domain.DeepSeekInferenceProvider('test-only', async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Authentication Fails' } }) }));
  await assert.rejects(provider.infer({ title: '测试', type: 'task' }), /401：Authentication Fails/);
});
test('DeepSeek 默认 fetch 保持全局调用上下文', async () => {
  const originalFetch = global.fetch;
  global.fetch = function () {
    assert.equal(this, globalThis);
    return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) });
  };
  try {
    const result = await new Domain.DeepSeekInferenceProvider('test-only').infer({ title: '连接测试', type: 'task' });
    assert.equal(result.title, '连接测试');
  } finally {
    global.fetch = originalFetch;
  }
});
test('DeepSeek 为电影生成连续观看总时长并忽略过短最小时长', async () => {
  const provider = new Domain.DeepSeekInferenceProvider('test-only', async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"estimatedMinutes":113,"minSessionMinutes":10,"sessionMode":"continuous"}' } }] }),
  }));
  const result = await provider.infer({ title: '记忆碎片', type: 'movie' });
  assert.equal(result.estimatedMinutes, 113);
  assert.equal(result.minSessionMinutes, 113);
  assert.equal(result.sessionMode, 'continuous');
});
