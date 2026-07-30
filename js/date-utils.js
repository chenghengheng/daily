(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DateUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const pad = value => String(value).padStart(2, '0');

  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseLocalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addDays(value, days) {
    const date = parseLocalDate(value);
    if (!date) return null;
    date.setDate(date.getDate() + days);
    return localDate(date);
  }

  function daysBetween(from, to) {
    const start = parseLocalDate(from);
    const end = parseLocalDate(to);
    if (!start || !end) return 0;
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.floor((endUtc - startUtc) / 86400000);
  }

  return { localDate, parseLocalDate, addDays, daysBetween };
});

