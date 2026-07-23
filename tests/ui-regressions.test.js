const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const wishSource = fs.readFileSync(require.resolve('../js/pages/wish.js'), 'utf8');
const expenseSource = fs.readFileSync(require.resolve('../js/pages/expense.js'), 'utf8');
const dashboardSource = fs.readFileSync(require.resolve('../js/pages/dashboard.js'), 'utf8');
const noteSource = fs.readFileSync(require.resolve('../js/pages/note.js'), 'utf8');
const storeSource = fs.readFileSync(require.resolve('../js/store.js'), 'utf8');

test('空进度日志仍可打开日历预览', () => assert.doesNotMatch(wishSource, /if \(dates\.length === 0\)[\s\S]{0,100}暂无操作日志/));
test('购买原因会显示在已处理卡片', () => assert.match(wishSource, /item\.purchaseReason[\s\S]{0,160}购买备注/));
test('随手花只保留最近一条可撤销删除', () => assert.match(expenseSource, /filter\(item => !item\.deletedAt\)[\s\S]{0,260}deletedAt/));
test('仪表盘显示进行中清单和年度等待进度且快捷入口隐藏', () => { assert.match(dashboardSource, /进行中 · 清单/); assert.match(dashboardSource, /年等待进度/); assert.match(dashboardSource, /href="#\/wish" class="card card-link" hidden/); assert.match(dashboardSource, /href="#\/countdown" class="card card-link" hidden/); });
test('随手记保留事书影剧想法手动选择', () => assert.match(noteSource, /task: '事'[\s\S]*book: '书'[\s\S]*movie: '影'[\s\S]*series: '剧'/));
test('DeepSeek Key 仅使用 sessionStorage 且不进入 Store', () => { assert.match(noteSource + dashboardSource, /sessionStorage/); assert.doesNotMatch(storeSource, /deepseek.*key/i); });
test('购买行为写入当日 actionLog 并由日历合并展示详情', () => { assert.match(wishSource, /actionLog\.push/); assert.match(wishSource, /progressLog[\s\S]{0,160}actionLog/); assert.match(wishSource, /cal-detail__reason/); });
test('随手记有独立 LLM 开关', () => assert.match(noteSource, /daily_llm_enabled/));
test('推荐结果显示事项类型标签', () => assert.match(dashboardSource, /typeLabels\[item\.type\]/));
test('个性化不再提供背景上传入口', () => assert.doesNotMatch(dashboardSource, /settings-bg-upload/));
