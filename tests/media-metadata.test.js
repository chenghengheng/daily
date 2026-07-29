const test = require('node:test');
const assert = require('node:assert/strict');
const MediaMetadata = require('../js/media-metadata');

test('Open Library 结果映射为可确认的图书资料', async () => {
  const fetchImpl = async url => ({ ok: true, json: async () => ({ docs: [{ key: '/works/OL1W', title: '记忆碎片', author_name: ['某作者'], first_publish_year: 2001, cover_i: 9 }] }) });
  const [item] = await MediaMetadata.search({ type: 'book', query: '记忆碎片', fetchImpl });
  assert.equal(item.source, 'openlibrary'); assert.equal(item.author, '某作者'); assert.equal(item.year, 2001);
});

test('影视未配置代理时给出可降级提示且不发请求', async () => {
  let called = false;
  await assert.rejects(() => MediaMetadata.search({ type: 'movie', query: 'Memento', fetchImpl: async () => { called = true; } }), /尚未配置影视资料代理/);
  assert.equal(called, false);
});

test('影视代理结果可提供可信片长', async () => {
  const fetchImpl = async url => ({ ok: true, json: async () => ({ results: [{ id: 77, title: 'Memento', release_date: '2000-10-11', runtime: 113 }] }) });
  const [item] = await MediaMetadata.search({ type: 'movie', query: 'Memento', proxyUrl: 'https://example.test/search', fetchImpl });
  assert.equal(item.runtimeMinutes, 113); assert.equal(item.year, 2000); assert.equal(item.source, 'tmdb');
});
