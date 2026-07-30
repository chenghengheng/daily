(function (root, factory) {
  const api = factory(root.DateUtils || (typeof require === 'function' ? require('./date-utils.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TimelineDomain = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (DateUtils) {
  const pad = value => String(value).padStart(2, '0');
  const clone = value => JSON.parse(JSON.stringify(value));

  function parseClock(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function durationMatches(text) {
    const patterns = [
      /\d+(?:\.\d+)?\s*h(?:ours?)?(?:\s*\d+\s*(?:min(?:utes?)?))?/gi,
      /\d+\s*小时(?:\s*\d+\s*分钟)?/g,
      /\d+(?:\.\d+)?\s*(?:min(?:utes?)?|分钟)/gi,
    ];
    const matches = [];
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text))) {
        if (!matches.some(item => match.index >= item.index && match.index < item.index + item.value.length)) {
          matches.push({ index: match.index, value: match[0] });
        }
      }
    });
    return matches.sort((a, b) => a.index - b.index);
  }

  function parseDuration(value) {
    const normalized = value.toLowerCase().replace(/\s+/g, '');
    let minutes = 0;
    const hours = normalized.match(/(\d+(?:\.\d+)?)(?:h(?:ours?)?|小时)/);
    const mins = normalized.match(/(\d+)(?:min(?:utes?)?|分钟)/);
    if (hours) minutes += Number(hours[1]) * 60;
    if (mins) minutes += Number(mins[1]);
    return Math.round(minutes);
  }

  function parseLine(raw, lineNumber = 1) {
    const source = String(raw || '').trim();
    if (!source) return { ignored: true, lineNumber, raw: String(raw || '') };
    if (/-\s*\d+(?:\.\d+)?\s*(?:min|分钟|h|小时)/i.test(source)) return error('INVALID_DURATION', '时长必须大于 0', raw, lineNumber);
    const fixedTokens = [...source.matchAll(/@\S+/g)];
    if (fixedTokens.length > 1) return error('MULTIPLE_FIXED_TIMES', '一行只能有一个固定时间', raw, lineNumber);
    let fixedStartMinutes;
    if (fixedTokens.length) {
      fixedStartMinutes = parseClock(fixedTokens[0][0].slice(1));
      if (fixedStartMinutes === null) return error('INVALID_FIXED_TIME', '固定时间应为 @HH:mm', raw, lineNumber);
    }
    const durations = durationMatches(source);
    if (!durations.length) {
      if (/[-+]?\d+(?:\.\d+)?\s*(?:min|分钟|h|小时)/i.test(source)) return error('INVALID_DURATION', '时长必须大于 0', raw, lineNumber);
      return error('MISSING_DURATION', '缺少时长，例如 30min', raw, lineNumber);
    }
    if (durations.length > 1) return error('MULTIPLE_DURATIONS', '一行只能有一个时长', raw, lineNumber);
    const plannedDurationMinutes = parseDuration(durations[0].value);
    if (!Number.isInteger(plannedDurationMinutes) || plannedDurationMinutes <= 0) return error('INVALID_DURATION', '时长必须大于 0', raw, lineNumber);
    const kind = /[～~]/.test(source) ? 'buffer' : 'normal';
    let title = source
      .replace(/@\S+/g, ' ')
      .replace(durations[0].value, ' ')
      .replace(/[～~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (kind === 'buffer' && !title) title = '缓冲';
    if (!title) return error('MISSING_TITLE', '请填写事项名称', raw, lineNumber);
    return { ok: true, lineNumber, raw: String(raw), item: { title: kind === 'buffer' && /^缓冲$/.test(title) ? '缓冲' : title, kind, plannedDurationMinutes, remainingDurationMinutes: kind === 'buffer' ? plannedDurationMinutes : undefined, fixedStartMinutes, note: '', status: 'pending' } };
  }

  function error(code, message, raw, lineNumber) { return { ok: false, code, message, raw: String(raw || ''), lineNumber }; }

  function parseText(text) {
    const results = String(text || '').split(/\r?\n/).map((line, index) => parseLine(line, index + 1));
    return { items: results.filter(result => result.ok).map(result => result.item), errors: results.filter(result => result.ok === false), results };
  }

  function liftFixed(fixedStartMinutes, cursor) {
    let lifted = fixedStartMinutes;
    while (lifted + 720 < cursor) lifted += 1440;
    return lifted;
  }

  function schedule(plan) {
    let cursor = Number(plan?.startTimeMinutes) || 0;
    const items = (plan?.items || []).slice().sort((a, b) => a.order - b.order);
    const calibrationOffset = Number(plan?.execution?.remainingOffsetMinutes) || 0;
    const calibrationAfter = plan?.execution?.calibrationAfterItemId;
    let calibrationApplied = false;
    return items.map((item, index) => {
      const shouldApplyCalibration = !calibrationApplied && calibrationOffset && (
        calibrationAfter ? items[index - 1]?.id === calibrationAfter : index === 0
      );
      if (shouldApplyCalibration) {
        cursor = Math.max(0, cursor + calibrationOffset);
        calibrationApplied = true;
      }
      const duration = item.kind === 'buffer' ? Math.max(0, item.remainingDurationMinutes ?? item.plannedDurationMinutes) : item.plannedDurationMinutes;
      let start = cursor; let idleBeforeMinutes = 0; let overlapMinutes = 0;
      if (Number.isFinite(item.fixedStartMinutes)) {
        start = liftFixed(item.fixedStartMinutes, cursor);
        if (cursor < start) idleBeforeMinutes = start - cursor;
        else if (cursor > start) overlapMinutes = cursor - start;
      }
      const end = start + duration;
      cursor = end;
      return { itemId: item.id, startAbsoluteMinutes: start, endAbsoluteMinutes: end, startDayOffset: Math.floor(start / 1440), endDayOffset: Math.floor((Math.max(start, end - 1)) / 1440), conflict: overlapMinutes > 0, overlapMinutes, idleBeforeMinutes };
    });
  }

  function calibrate(plan, offsetMinutes, calibrationAfterItemId) {
    const next = clone(plan); let remaining = Math.round(offsetMinutes);
    const consumed = [];
    const ordered = next.items.slice().sort((a, b) => a.order - b.order);
    const anchorIndex = calibrationAfterItemId ? ordered.findIndex(item => item.id === calibrationAfterItemId) : -1;
    if (remaining > 0) {
      for (let index = anchorIndex + 1; index < ordered.length; index += 1) {
        const item = ordered[index];
        if (Number.isFinite(item.fixedStartMinutes)) break;
        if (item.status === 'completed' || item.kind !== 'buffer') continue;
        const available = Math.max(0, item.remainingDurationMinutes ?? item.plannedDurationMinutes);
        const amount = Math.min(available, remaining);
        item.remainingDurationMinutes = available - amount;
        remaining -= amount;
        if (amount) consumed.push({ itemId: item.id, minutes: amount });
        if (!remaining) break;
      }
    }
    next.execution = {
      ...(next.execution || {}),
      calibratedAt: new Date().toISOString(),
      calibrationOffsetMinutes: offsetMinutes,
      calibrationAfterItemId: calibrationAfterItemId,
      remainingOffsetMinutes: remaining,
    };
    next.updatedAt = new Date().toISOString();
    return { plan: next, consumed, remainingOffsetMinutes: remaining, schedule: schedule(next) };
  }

  function formatMinutes(value) {
    const day = Math.floor(value / 1440); const minute = ((value % 1440) + 1440) % 1440;
    const clock = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
    return day > 0 ? `次日${day > 1 ? `+${day - 1}` : ''} ${clock}` : clock;
  }

  function exportText(items) {
    return (items || []).slice().sort((a, b) => a.order - b.order).map(item => `${Number.isFinite(item.fixedStartMinutes) ? `@${formatMinutes(item.fixedStartMinutes)} ` : ''}${item.plannedDurationMinutes}min ${item.kind === 'buffer' ? '～' : ''}${item.kind === 'buffer' && !item.title ? '缓冲' : item.title}`).join('\n');
  }

  function iconFor(item) {
    const title = item.kind === 'buffer' ? '缓冲' : item.title;
    if (/早餐|午餐|晚餐|吃饭|咖啡/.test(title)) return '🍴';
    if (/地铁|公交|通勤|打车|步行/.test(title)) return '🚇';
    if (/缓冲|休息|等待/.test(title)) return '〰';
    if (/会议|讨论|同步|复盘/.test(title)) return '⌖';
    if (/日记|记录|写作|阅读/.test(title)) return '▤';
    return '⚑';
  }

  function createPlan(sourceText, startTimeMinutes = 780, previous) {
    const parsed = parseText(sourceText); const now = new Date().toISOString();
    const existing = new Map((previous?.items || []).map(item => [`${item.title}|${item.kind}|${item.plannedDurationMinutes}|${item.fixedStartMinutes ?? ''}`, item]));
    const items = parsed.items.map((item, order) => {
      const key = `${item.title}|${item.kind}|${item.plannedDurationMinutes}|${item.fixedStartMinutes ?? ''}`; const old = existing.get(key);
      return { ...item, id: old?.id || `tl_${Date.now().toString(36)}_${order}_${Math.random().toString(36).slice(2, 5)}`, order, note: old?.note || '', status: old?.status || 'pending', completedAt: old?.completedAt, remainingDurationMinutes: item.kind === 'buffer' ? (old?.remainingDurationMinutes ?? item.plannedDurationMinutes) : undefined };
    });
    return { plan: { schemaVersion: 1, id: previous?.id || `plan_${Date.now().toString(36)}`, localDate: DateUtils.localDate(), startTimeMinutes, sourceText: exportText(items), items, createdAt: previous?.createdAt || now, updatedAt: now, execution: previous?.execution }, errors: parsed.errors };
  }

  return { parseLine, parseText, schedule, calibrate, formatMinutes, exportText, iconFor, createPlan, parseClock };
}));
