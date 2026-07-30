const test = require('node:test');
const assert = require('node:assert/strict');
global.DateUtils = require('../js/date-utils.js');
const Timeline = require('../js/timeline-domain.js');

test('解析规范和宽容时长语法', () => {
  const parsed = Timeline.parseText('40min 晚餐\n晚餐 40min\n10min ～缓冲\n@15:00 60min 会议\n1小时30分钟 阅读');
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsed.items.map(item => item.plannedDurationMinutes), [40, 40, 10, 60, 90]);
  assert.equal(parsed.items[2].kind, 'buffer');
  assert.equal(parsed.items[3].fixedStartMinutes, 900);
});

test('逐行返回结构化错误且不阻断合法行', () => {
  const parsed = Timeline.parseText('40min 晚餐\n没有时长\n0min 无效\n@25:00 30min 越界\n30min 20min 重复');
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.errors.map(item => item.code), ['MISSING_DURATION','INVALID_DURATION','INVALID_FIXED_TIME','MULTIPLE_DURATIONS']);
});

test('基本排期、空档和固定锚点精确计算', () => {
  const plan = Timeline.createPlan('40min 晚餐\n30min 地铁\n10min ～缓冲\n@15:00 60min 会议\n20min 日记', 780).plan;
  const result = Timeline.schedule(plan);
  assert.deepEqual(result.map(item => [item.startAbsoluteMinutes, item.endAbsoluteMinutes]), [[780,820],[820,850],[850,860],[900,960],[960,980]]);
  assert.equal(result[3].idleBeforeMinutes, 40);
});

test('固定事项不被前序冲突推迟', () => {
  const plan = Timeline.createPlan('140min 前序\n@15:00 60min 会议', 780).plan;
  const result = Timeline.schedule(plan);
  assert.equal(result[1].startAbsoluteMinutes, 900);
  assert.equal(result[1].overlapMinutes, 20);
  assert.equal(result[1].conflict, true);
});

test('晚间计划里的凌晨固定事项落到次日', () => {
  const plan = Timeline.createPlan('30min 夜间\n@01:00 30min 凌晨事项', 1380).plan;
  assert.equal(Timeline.schedule(plan)[1].startAbsoluteMinutes, 1500);
});

test('校准优先消耗缓冲且固定锚点不移动', () => {
  const plan = Timeline.createPlan('40min 晚餐\n10min ～缓冲\n@15:00 60min 会议', 780).plan;
  const eight = Timeline.calibrate(plan, 8);
  assert.equal(eight.plan.items[1].remainingDurationMinutes, 2);
  assert.equal(eight.schedule[2].startAbsoluteMinutes, 900);
  const fifteen = Timeline.calibrate(plan, 15);
  assert.equal(fifteen.plan.items[1].remainingDurationMinutes, 0);
  assert.equal(fifteen.remainingOffsetMinutes, 5);
  assert.equal(fifteen.schedule[2].startAbsoluteMinutes, 900);
});

test('校准只消耗当前事项之后、下个固定锚点之前的缓冲', () => {
  const plan = Timeline.createPlan('10min ～之前缓冲\n40min 当前\n6min ～之后缓冲\n@15:00 30min 固定\n8min ～锚点后缓冲', 780).plan;
  const result = Timeline.calibrate(plan, 9, plan.items[1].id);
  assert.equal(result.plan.items[0].remainingDurationMinutes, 10);
  assert.equal(result.plan.items[2].remainingDurationMinutes, 0);
  assert.equal(result.plan.items[4].remainingDurationMinutes, 8);
  assert.equal(result.remainingOffsetMinutes, 3);
  assert.equal(result.schedule[3].startAbsoluteMinutes, 900);
});

test('负向校准提前当前事项之后的灵活排期但不移动固定锚点', () => {
  const plan = Timeline.createPlan('20min 当前\n20min 后续\n@15:00 30min 固定', 780).plan;
  const result = Timeline.calibrate(plan, -5, plan.items[0].id);
  assert.equal(result.schedule[1].startAbsoluteMinutes, 795);
  assert.equal(result.schedule[2].startAbsoluteMinutes, 900);
});
