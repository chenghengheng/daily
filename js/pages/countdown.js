const Countdown = {
  events: [],

  render(container) {
    this.events = this.cleanupExpiredAuto();
    this.events.sort((a, b) => a.date.localeCompare(b.date));
    container.innerHTML = this._view();
    this._bind(container);
  },

  _view() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = Store.today();

    const upcoming = this.events.filter(ev => ev.date >= today);
    const expired = this.events.filter(ev => ev.date < today);

    const MAX_VISIBLE_EXPIRED = 2;

    const renderCard = (ev) => {
      const target = new Date(ev.date + 'T00:00:00');
      const diff = Math.round((target - now) / (1000 * 60 * 60 * 24));
      const isEvent = ev.type !== 'reminder';
      return `
        <div class="card countdown-card ${isEvent ? 'countdown-event' : 'countdown-reminder'} ${diff < 0 ? 'countdown-expired' : ''}" data-id="${ev.id}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                <span class="countdown-type-badge ${isEvent ? 'countdown-type--event' : 'countdown-type--reminder'}">
                  ${isEvent ? '★ 期待' : '⚠ 提醒'}
                </span>
                ${ev.auto ? '<span class="countdown-type-badge countdown-type--auto">📅</span>' : ''}
              </div>
              <div style="font-size:16px;font-weight:600;">${this._esc(ev.title)}</div>
              ${ev.note ? `<div style="font-size:12px;color:var(--text2);margin-top:2px;">${this._esc(ev.note)}</div>` : ''}
              <div style="font-size:12px;color:var(--text2);margin-top:2px;">${ev.date}</div>
            </div>
            <div style="text-align:right;">
              <div class="countdown-number" style="${diff <= 7 && diff >= 0 ? 'color:var(--gold);text-shadow:0 0 12px var(--gold-glow);' : ''}">
                ${diff < 0 ? Math.abs(diff) : diff}
              </div>
              <div class="countdown-label">${diff < 0 ? '天前' : '天后'}</div>
            </div>
          </div>
          <button class="btn btn-sm btn-outline cd-delete-btn" style="margin-top:8px;width:100%;">删除</button>
        </div>
      `;
    };

    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
        <button class="btn btn-primary" id="cd-add-btn">+ 新事件</button>
        <button class="btn btn-outline" id="cd-import-btn">📅 导入节假日</button>
      </div>

      ${this.events.length === 0 ? `
        <div class="empty-state">
          <p>还没有倒计时事件</p>
        </div>
      ` : `
        ${expired.length > 0 ? `
          <div style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:13px;font-weight:600;color:var(--text2);">已经历（${expired.length}）</span>
            </div>
            <div class="card-stagger">${expired.slice(-MAX_VISIBLE_EXPIRED).map(renderCard).join('')}</div>
            ${expired.length > MAX_VISIBLE_EXPIRED ? `
              <details style="margin-top:4px;" id="cd-expired-details">
                <summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:6px 0;user-select:none;">
                  还有 ${expired.length - MAX_VISIBLE_EXPIRED} 个
                </summary>
                <div style="margin-top:4px;">${expired.slice(0, expired.length - MAX_VISIBLE_EXPIRED).map(renderCard).join('')}</div>
              </details>
            ` : ''}
          </div>
        ` : ''}

        ${upcoming.length > 0 ? `<div class="card-title" style="margin-bottom:8px;">即将到来（${upcoming.length}）</div>` : ''}
        ${upcoming.length > 0 ? `<div class="card-stagger">${upcoming.map(renderCard).join('')}</div>` : ''}
      `}
    `;
  },

  _bind(container) {
    container.querySelector('#cd-add-btn').addEventListener('click', () => this._showAddModal());
    container.querySelector('#cd-import-btn')?.addEventListener('click', () => this._importHolidays());
    container.querySelectorAll('.cd-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.card').dataset.id;
        if (!confirm('确定删除？')) return;
        this.events = this.events.filter(ev => ev.id !== id);
        Store.saveCountdownEvents(this.events);
        this.render(document.getElementById('content'));
      });
    });
  },

  _showAddModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>新事件</h2>
        <div class="form-group">
          <label>标题</label>
          <input id="cd-title" placeholder="考试 / 纪念日 / 交房租..." autofocus>
        </div>
        <div class="form-group">
          <label>日期</label>
          <input id="cd-date" type="date">
        </div>
        <div class="form-group">
          <label>类型</label>
          <div style="display:flex;gap:8px;" id="cd-type-picker">
            <button class="btn btn-sm btn-primary cd-type-opt" data-type="event">★ 期待的事</button>
            <button class="btn btn-sm btn-outline cd-type-opt" data-type="reminder">⚠ 提醒的事</button>
          </div>
        </div>
        <div class="form-group" id="cd-keepafter-group" style="display:none;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="cd-keepafter" style="width:auto;">
            过去后保留此事件
          </label>
        </div>
        <div class="form-group">
          <label>备注（可选）</label>
          <textarea id="cd-note" placeholder="备注..." rows="2"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="cd-cancel">取消</button>
          <button class="btn btn-primary" id="cd-confirm">添加</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let selectedType = 'event';

    overlay.querySelectorAll('.cd-type-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.cd-type-opt').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');
        selectedType = btn.dataset.type;
        overlay.querySelector('#cd-keepafter-group').style.display =
          selectedType === 'reminder' ? 'block' : 'none';
      });
    });

    overlay.querySelector('#cd-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#cd-confirm').addEventListener('click', () => {
      const title = overlay.querySelector('#cd-title').value.trim();
      const date = overlay.querySelector('#cd-date').value;
      const note = overlay.querySelector('#cd-note').value.trim();
      const keepAfter = overlay.querySelector('#cd-keepafter').checked;
      if (!title) { this._toast('请输入标题'); return; }
      if (!date) { this._toast('请选择日期'); return; }
      this.events.push({
        id: Store.genId(),
        title, date, note,
        type: selectedType,
        keepAfter: selectedType === 'reminder' ? keepAfter : true,
      });
      Store.saveCountdownEvents(this.events);
      overlay.remove();
      this.render(document.getElementById('content'));
    });
  },

  _toast(msg) { Toast.show(msg); },

  _importHolidays() {
    const todayStr = Store.today();
    const existing = new Set(this.events.map(e => `${e.title}|${e.date}`));
    const newEvents = [];
    const pad2 = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    const holidays = [
      { title: '元旦', start: '2026-01-01', end: '2026-01-03' },
      { title: '春节', start: '2026-02-15', end: '2026-02-23' },
      { title: '清明节', start: '2026-04-04', end: '2026-04-06' },
      { title: '劳动节', start: '2026-05-01', end: '2026-05-05' },
      { title: '端午节', start: '2026-06-19', end: '2026-06-21' },
      { title: '中秋节', start: '2026-09-25', end: '2026-09-27' },
      { title: '国庆节', start: '2026-10-01', end: '2026-10-07' },
    ];

    const isInHoliday = d => holidays.some(h => d >= h.start && d <= h.end);

    holidays.forEach(h => {
      if (h.start >= todayStr && !existing.has(`${h.title}|${h.start}`)) {
        newEvents.push({ id: Store.genId(), title: h.title, date: h.start, note: '法定节假日', type: 'event', keepAfter: true, auto: true });
      }
    });

    const cur = new Date();
    cur.setHours(0, 0, 0, 0);
    cur.setDate(cur.getDate() + 1);
    let satCount = 0;
    while (satCount < 26 && cur.getFullYear() < 2028) {
      if (cur.getDay() === 6) {
        const dateStr = fmt(cur);
        if (!isInHoliday(dateStr) && !existing.has(`周末|${dateStr}`)) {
          newEvents.push({ id: Store.genId(), title: '周末', date: dateStr, note: '', type: 'event', keepAfter: true, auto: true });
        }
        satCount++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (newEvents.length === 0) {
      this._toast('没有新的节假日可导入');
      return;
    }

    this.events.push(...newEvents);
    this.events.sort((a, b) => a.date.localeCompare(b.date));
    Store.saveCountdownEvents(this.events);
    this.render(document.getElementById('content'));
    this._toast(`已导入 ${newEvents.length} 个节假日/周末`);
  },

  cleanupExpiredAuto() {
    const events = Store.getCountdownEvents();
    const today = Store.today();
    const filtered = events.filter(ev => {
      if (ev.date >= today) return true;
      if (ev.auto === true) return false;
      if (ev.type === 'reminder' && !ev.keepAfter) return false;
      return true;
    });
    if (filtered.length !== events.length) {
      Store.saveCountdownEvents(filtered);
    }
    return filtered;
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
};
