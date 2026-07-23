const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const wishSource = fs.readFileSync(require.resolve('../js/pages/wish.js'), 'utf8');
const expenseSource = fs.readFileSync(require.resolve('../js/pages/expense.js'), 'utf8');
const dashboardSource = fs.readFileSync(require.resolve('../js/pages/dashboard.js'), 'utf8');
const noteSource = fs.readFileSync(require.resolve('../js/pages/note.js'), 'utf8');
const storeSource = fs.readFileSync(require.resolve('../js/store.js'), 'utf8');
const appSource = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
const styleSource = fs.readFileSync(require.resolve('../css/style.css'), 'utf8');
const serviceWorkerSource = fs.readFileSync(require.resolve('../sw.js'), 'utf8');

test('空进度日志仍可打开日历预览', () => assert.doesNotMatch(wishSource, /if \(dates\.length === 0\)[\s\S]{0,100}暂无操作日志/));
test('购买原因会显示在已处理卡片', () => assert.match(wishSource, /item\.purchaseReason[\s\S]{0,160}购买备注/));
test('随手花只保留最近一条可撤销删除', () => assert.match(expenseSource, /filter\(item => !item\.deletedAt\)[\s\S]{0,260}deletedAt/));
test('仪表盘显示进行中清单和已累积且快捷入口隐藏', () => { assert.match(dashboardSource, /进行中 · 清单/); assert.match(dashboardSource, />已累积</); assert.match(dashboardSource, /href="#\/wish" class="card card-link" hidden/); assert.match(dashboardSource, /href="#\/countdown" class="card card-link" hidden/); });
test('随手记保留事书影剧想法手动选择', () => assert.match(noteSource, /task: '事'[\s\S]*book: '书'[\s\S]*movie: '影'[\s\S]*series: '剧'/));
test('DeepSeek Key 仅使用 sessionStorage 且不进入 Store', () => { assert.match(noteSource + dashboardSource, /sessionStorage/); assert.doesNotMatch(storeSource, /deepseek.*key/i); });
test('购买行为写入当日 actionLog 并由日历合并展示详情', () => { assert.match(wishSource, /actionLog\.push/); assert.match(wishSource, /progressLog[\s\S]{0,160}actionLog/); assert.match(wishSource, /cal-detail__reason/); });
test('随手记有独立 LLM 开关', () => assert.match(noteSource, /daily_llm_enabled/));
test('DeepSeek 可测试连接且事项展示标注来源', () => { assert.match(dashboardSource, /settings-deepseek-test/); assert.match(noteSource, /DeepSeek 标注成功/); });
test('推荐结果显示事项类型标签', () => assert.match(dashboardSource, /typeLabels\[item\.type\]/));
test('背景功能已从页面、应用、存储和样式中完全移除', () => {
  assert.doesNotMatch(dashboardSource + appSource + storeSource + styleSource, /背景图片|背景图|bgImage|has-bg|bg-light/);
});
test('本轮发布更新离线缓存版本', () => assert.match(serviceWorkerSource, /daily-shell-v5/));
