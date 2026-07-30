const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(require.resolve(path), 'utf8');
const index = read('../index.html');
const app = read('../js/app.js');
const dashboard = read('../js/pages/dashboard.js');
const countdown = read('../js/pages/countdown.js');
const css = read('../css/style.css');
const store = read('../js/store.js');

test('学习功能不再提供入口或路由', () => { assert.doesNotMatch(app, /case 'study'|page = 'study'/); assert.match(index, /data-page="study" hidden/); });
test('一级导航包含随手花并按产品顺序排列', () => { assert.match(index, /data-page="expense"/); assert.match(css, /dashboard[^}]*order: 1[\s\S]*wish[^}]*order: 2[\s\S]*expense[^}]*order: 3[\s\S]*note[^}]*order: 4[\s\S]*countdown[^}]*order: 5/); });
test('仪表盘仅保留两格统计和可抉择高亮', () => { assert.match(dashboard, /进行中 · 清单/); assert.match(dashboard, /已累积/); assert.match(dashboard, /个物品已达目标/); assert.doesNotMatch(dashboard, /当前阶段|阶段任务|card-stagger/); });
test('设置不再包含背景功能', () => { assert.match(dashboard, /title: '设置'/); assert.doesNotMatch(dashboard + app, /背景图片|bgImage|has-bg/); });
test('学习和背景旧数据会删除且不再导入导出', () => { assert.match(store, /clearObsoleteData[\s\S]*study[\s\S]*bgImage/); const io = store.match(/exportAll\(\)[\s\S]*?clearAll\(\)/)?.[0] || ''; assert.doesNotMatch(io, /study|bgImage/); });
test('提醒保留复选框有可见原生外观并保存 checked', () => { assert.match(countdown, /cd-keepafter[\s\S]*checked/); assert.match(css, /input\[type="checkbox"\][\s\S]*appearance: auto/); });
