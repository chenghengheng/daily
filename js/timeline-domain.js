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
      /\d+(?:\.\d+)?\s*h(?:ours?)?(?:\s*\d+\s*(?:min(?:utes?)?|m))?/gi,
      /\d+\s*小时(?:\s*\d+\s*(?:分钟|分))?/g,
      /\d+(?:\.\d+)?\s*(?:min(?:utes?)?|m|分钟|分)/gi,
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
    const mins = normalized.match(/(\d+)(?:min(?:utes?)?|m|分钟|分)/);
    if (hours) minutes += Number(hours[1]) * 60;
    if (mins) minutes += Number(mins[1]);
    return Math.round(minutes);
  }

  function parseLine(raw, lineNumber = 1) {
    const source = String(raw || '').trim();
    if (!source) return { ignored: true, lineNumber, raw: String(raw || '') };
    if (/-\s*\d+(?:\.\d+)?\s*(?:m|min|分|分钟|h|小时)/i.test(source)) return error('INVALID_DURATION', '时长必须大于 0', raw, lineNumber);
    const fixedTokens = [...source.matchAll(/@\S+/g)];
    if (fixedTokens.length > 1) return error('MULTIPLE_FIXED_TIMES', '一行只能有一个固定时间', raw, lineNumber);
    let fixedStartMinutes;
    if (fixedTokens.length) {
      fixedStartMinutes = parseClock(fixedTokens[0][0].slice(1));
      if (fixedStartMinutes === null) return error('INVALID_FIXED_TIME', '固定时间应为 @HH:mm', raw, lineNumber);
    }
    const durations = durationMatches(source);
    if (!durations.length) {
      if (/[-+]?\d+(?:\.\d+)?\s*(?:m|min|分|分钟|h|小时)/i.test(source)) return error('INVALID_DURATION', '时长必须大于 0', raw, lineNumber);
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

  function effectiveDuration(item) {
    return item.kind === 'buffer' ? Math.max(0, item.remainingDurationMinutes ?? item.plannedDurationMinutes) : item.plannedDurationMinutes;
  }

  function movePastFixedFirst(items, startTimeMinutes) {
    const pastFixed = items.filter(item => Number.isFinite(item.fixedStartMinutes) && liftFixed(item.fixedStartMinutes, startTimeMinutes) <= startTimeMinutes)
      .sort((a, b) => liftFixed(a.fixedStartMinutes, startTimeMinutes) - liftFixed(b.fixedStartMinutes, startTimeMinutes));
    const pastIds = new Set(pastFixed.map(item => item.id));
    return pastFixed.concat(items.filter(item => !pastIds.has(item.id)));
  }

  function reorderFutureAroundFixed(items, initialCursor) {
    const remaining = items.slice(); const result = []; let cursor = initialCursor;
    while (remaining.length) {
      const first = remaining[0];
      const anchors = remaining.map((item, index) => Number.isFinite(item.fixedStartMinutes) ? { item, index, start: liftFixed(item.fixedStartMinutes, cursor) } : null)
        .filter(Boolean).sort((a, b) => a.start - b.start || a.index - b.index);
      let selectedIndex = 0;
      if (anchors.length) {
        const anchor = anchors[0];
        if (Number.isFinite(first.fixedStartMinutes) || cursor + effectiveDuration(first) > anchor.start) selectedIndex = anchor.index;
      }
      const [item] = remaining.splice(selectedIndex, 1); const duration = effectiveDuration(item);
      if (Number.isFinite(item.fixedStartMinutes)) {
        const start = liftFixed(item.fixedStartMinutes, cursor);
        cursor = Math.max(start + duration, cursor + duration);
      } else cursor += duration;
      result.push(item);
    }
    return result;
  }

  function schedule(plan) {
    let cursor = Number(plan?.startTimeMinutes) || 0;
    const items = (plan?.items || []).slice().sort((a, b) => a.order - b.order);
    const calibrationOffset = Number(plan?.execution?.remainingOffsetMinutes) || 0;
    const calibrationAfter = plan?.execution?.calibrationAfterItemId;
    let calibrationApplied = false; let leadingPastFixed = true;
    return items.map((item, index) => {
      const shouldApplyCalibration = !calibrationApplied && calibrationOffset && (
        calibrationAfter ? items[index - 1]?.id === calibrationAfter : index === 0
      );
      if (shouldApplyCalibration) {
        cursor = Math.max(0, cursor + calibrationOffset);
        calibrationApplied = true;
      }
      const duration = effectiveDuration(item);
      const cursorBeforeItem = cursor;
      let start = cursor; let idleBeforeMinutes = 0; let overlapMinutes = 0;
      if (Number.isFinite(item.fixedStartMinutes)) {
        start = liftFixed(item.fixedStartMinutes, cursor);
        const isLeadingPastFixed = leadingPastFixed && start <= plan.startTimeMinutes;
        if (!isLeadingPastFixed && cursor < start) idleBeforeMinutes = start - cursor;
        else if (!isLeadingPastFixed && cursor > start) overlapMinutes = cursor - start;
      }
      const end = start + duration;
      const isLeadingPastFixed = leadingPastFixed && Number.isFinite(item.fixedStartMinutes) && start <= plan.startTimeMinutes;
      cursor = Number.isFinite(item.fixedStartMinutes) ? (isLeadingPastFixed ? Math.max(end, cursorBeforeItem) : Math.max(end, cursorBeforeItem + duration)) : end;
      if (!isLeadingPastFixed) leadingPastFixed = false;
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
    const baseSchedule = schedule(next);
    const prefix = anchorIndex >= 0 ? ordered.slice(0, anchorIndex + 1) : [];
    const suffix = anchorIndex >= 0 ? ordered.slice(anchorIndex + 1) : ordered;
    const suffixCursor = (anchorIndex >= 0 ? baseSchedule[anchorIndex]?.endAbsoluteMinutes ?? next.startTimeMinutes : next.startTimeMinutes) + remaining;
    next.items = prefix.concat(reorderFutureAroundFixed(suffix, suffixCursor));
    next.items.forEach((item, order) => { item.order = order; });
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

  const ICON_RULES = [
    { category: 'meal', icon: '🍴', patterns: ['早餐','午餐','晚餐','早饭','午饭','晚饭','吃饭','咖啡','夜宵','加餐'] },
    { category: 'commute', icon: '🚇', patterns: ['地铁','公交','通勤','打车','步行','骑车','骑行','开车','高铁','火车','飞机'] },
    { category: 'buffer', icon: '〰', patterns: ['缓冲','休息','等待','小憩','午休'] },
    { category: 'meeting', icon: '⌖', patterns: ['会议','讨论','同步','复盘','开会','洽谈','面试'] },
    { category: 'journal', icon: '▤', patterns: ['日记','记录','写作','阅读','读书','看书'] },
    { category: 'study', icon: '📚', patterns: ['学习','复习','备考','上课','背单词','听写'] },
    { category: 'sport', icon: '🏃', patterns: ['运动','健身','跑步','锻炼','瑜伽','游泳','散步'] },
    { category: 'work', icon: '💼', patterns: ['工作','上班','加班','写代码','编程','开发','改bug','bug'] },
    { category: 'housework', icon: '🧹', patterns: ['家务','打扫','整理','洗衣','洗碗','拖地'] },
    { category: 'phone', icon: '☎', patterns: ['电话','通话','打电话','语音'] },
    { category: 'fun', icon: '🎮', patterns: ['娱乐','游戏','电影','追剧','动漫','刷手机'] },
    { category: 'sleep', icon: '🛌', patterns: ['睡觉','起床','洗漱','洗澡','冥想'] },
    { category: 'shop', icon: '🛒', patterns: ['购物','超市','买菜','逛街'] },
  ];

  function iconCategoryFor(title) {
    const text = String(title || '').toLowerCase();
    for (const rule of ICON_RULES) {
      if (rule.patterns.some(pattern => text.includes(pattern.toLowerCase()))) return rule.category;
    }
    return 'default';
  }

  function iconFor(item) {
    const title = item.kind === 'buffer' ? '缓冲' : item.title;
    const rule = ICON_RULES.find(entry => entry.category === iconCategoryFor(title));
    return rule ? rule.icon : '⚑';
  }

  function carryOver(plan, previousPlan, fromDate) {
    if (!previousPlan || !Array.isArray(previousPlan.items)) return null;
    const next = clone(plan);
    if (next.carriedFromDate === fromDate) return null;
    const leftovers = previousPlan.items.filter(item => item.status !== 'completed');
    if (leftovers.length) {
      const carried = leftovers.map(item => {
        const copy = clone(item);
        delete copy.fixedStartMinutes;
        copy.carriedFrom = fromDate;
        copy.status = 'pending';
        copy.completedAt = undefined;
        return copy;
      });
      next.items = (next.items || []).concat(carried);
    }
    next.items.forEach((item, order) => { item.order = order; });
    next.carriedFromDate = fromDate;
    next.updatedAt = new Date().toISOString();
    next.sourceText = exportText(next.items);
    return next;
  }

  function normalizePlanOrder(plan) {
    const next = clone(plan); const ordered = (next.items || []).slice().sort((a, b) => a.order - b.order);
    next.items = movePastFixedFirst(ordered, next.startTimeMinutes);
    next.items.forEach((item, order) => { item.order = order; });
    next.sourceText = exportText(next.items);
    return next;
  }

  function createPlan(sourceText, startTimeMinutes = 780, previous, localDate = previous?.localDate || DateUtils.localDate()) {
    const parsed = parseText(sourceText); const now = new Date().toISOString();
    const existing = new Map((previous?.items || []).map(item => [`${item.title}|${item.kind}|${item.plannedDurationMinutes}|${item.fixedStartMinutes ?? ''}`, item]));
    const parsedItems = parsed.items.map((item, order) => {
      const key = `${item.title}|${item.kind}|${item.plannedDurationMinutes}|${item.fixedStartMinutes ?? ''}`; const old = existing.get(key);
      return { ...item, id: old?.id || `tl_${Date.now().toString(36)}_${order}_${Math.random().toString(36).slice(2, 5)}`, order, note: old?.note || '', status: old?.status || 'pending', completedAt: old?.completedAt, remainingDurationMinutes: item.kind === 'buffer' ? (old?.remainingDurationMinutes ?? item.plannedDurationMinutes) : undefined };
    });
    const items = movePastFixedFirst(parsedItems, startTimeMinutes);
    items.forEach((item, order) => { item.order = order; });
    return { plan: { schemaVersion: 1, id: previous?.id || `plan_${Date.now().toString(36)}`, localDate, startTimeMinutes, sourceText: exportText(items), items, createdAt: previous?.createdAt || now, updatedAt: now, execution: previous?.execution }, errors: parsed.errors };
  }

  return { parseLine, parseText, schedule, calibrate, formatMinutes, exportText, iconFor, iconCategoryFor, normalizePlanOrder, carryOver, createPlan, parseClock };
}));
