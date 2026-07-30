const test = require('node:test');
const assert = require('node:assert/strict');
let saved = null;
global.Store = { today: () => '2026-07-30', getCountdownEvents: () => [
  { id: 'drop', date: '2026-07-29', type: 'reminder', keepAfter: false },
  { id: 'keep', date: '2026-07-29', type: 'reminder', keepAfter: true },
  { id: 'event', date: '2026-07-29', type: 'event', keepAfter: true },
], saveCountdownEvents: value => { saved = value; } };
const Countdown = require('../js/pages/countdown.js');

test('过期提醒仅在未选择保留时删除', () => { const result = Countdown.cleanupExpiredAuto(); assert.deepEqual(result.map(item => item.id), ['keep','event']); assert.deepEqual(saved.map(item => item.id), ['keep','event']); });
