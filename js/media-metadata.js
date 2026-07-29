(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MediaMetadata = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const clean = value => String(value || '').trim();
  const yearOf = value => { const match = clean(value).match(/^\d{4}/); return match ? Number(match[0]) : null; };

  class OpenLibraryProvider {
    constructor(fetchImpl) { this.fetch = fetchImpl || globalThis.fetch.bind(globalThis); }
    async search(query) {
      const response = await this.fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(clean(query))}&limit=5&fields=key,title,author_name,first_publish_year,cover_i`);
      if (!response.ok) throw new Error(`图书资料查询失败（${response.status}）`);
      const data = await response.json();
      return (data.docs || []).map(item => ({ source: 'openlibrary', sourceId: item.key, title: item.title, year: item.first_publish_year || null, author: item.author_name?.[0] || '', runtimeMinutes: null, coverUrl: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : '', fetchedAt: new Date().toISOString() }));
    }
  }

  class TmdbProxyProvider {
    constructor(endpoint, fetchImpl) { this.endpoint = clean(endpoint); this.fetch = fetchImpl || globalThis.fetch.bind(globalThis); }
    async search(query, type) {
      if (!this.endpoint) throw new Error('尚未配置影视资料代理，仍可直接保存');
      const url = new URL(this.endpoint); url.searchParams.set('query', clean(query)); url.searchParams.set('type', type === 'series' ? 'tv' : 'movie');
      const response = await this.fetch(url.toString());
      if (!response.ok) throw new Error(`影视资料查询失败（${response.status}）`);
      const data = await response.json();
      return (data.results || []).slice(0, 5).map(item => ({ source: 'tmdb', sourceId: String(item.id), title: item.title || item.name, year: yearOf(item.release_date || item.first_air_date || item.year), author: '', runtimeMinutes: Number(item.runtime || item.episode_run_time?.[0]) || null, coverUrl: item.coverUrl || item.poster_url || '', fetchedAt: new Date().toISOString() }));
    }
  }

  async function search({ type, query, proxyUrl, fetchImpl }) {
    if (type === 'book') return new OpenLibraryProvider(fetchImpl).search(query);
    if (type === 'movie' || type === 'series') return new TmdbProxyProvider(proxyUrl, fetchImpl).search(query, type);
    throw new Error('此类型不需要媒体资料');
  }

  return { OpenLibraryProvider, TmdbProxyProvider, search };
}));
