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

    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
        <button class="btn btn-primary" id="cd-add-btn">+ 新事件</button>
        <button class="btn btn-outline" id="cd-import-btn">📅 导入节假日</button>
      </div>
      ${this.events.length === 0 ? `
        <div class="empty-state">
          <p>还没有倒计时事件</p>
        </div>
      ` : `<div class="card-stagger">${this.events.map(ev => {
        const target = new Date(ev.date + 'T00:00:00');
        const diff = Math.round((target - now) / (1000 * 60 * 60 * 24));
        const expired = diff < 0;
        return `
          <div class="card ${expired ? 'countdown-expired' : ''}" data-id="${ev.id}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:16px;font-weight:600;">${this._esc(ev.title)}</div>
                ${ev.note ? `<div style="font-size:12px;color:var(--text2);margin-top:2px;">${this._esc(ev.note)}</div>` : ''}
                <div style="font-size:12px;color:var(--text2);margin-top:2px;">${ev.date}</div>
              </div>
              <div style="text-align:right;">
                <div class="countdown-number" style="${diff <= 7 && !expired ? 'background:linear-gradient(135deg,var(--orange),#fbbf24);-webkit-background-clip:text;background-clip:text;' : ''}">
                  ${expired ? Math.abs(diff) : diff}
                </div>
                <div class="countdown-label">${expired ? '天前' : '天后'}</div>
              </div>
            </div>
            <button class="btn btn-sm btn-outline cd-delete-btn" style="margin-top:8px;width:100%;">删除</button>
          </div>
        `;
      }).join('')}</div>`}
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
        <h2>新倒计时</h2>
        <div class="form-group">
          <label>标题</label>
          <input id="cd-title" placeholder="考试 / 纪念日 / ..." autofocus>
        </div>
        <div class="form-group">
          <label>日期</label>
          <input id="cd-date" type="date">
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
    overlay.querySelector('#cd-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#cd-confirm').addEventListener('click', () => {
      const title = overlay.querySelector('#cd-title').value.trim();
      const date = overlay.querySelector('#cd-date').value;
      const note = overlay.querySelector('#cd-note').value.trim();
      if (!title) { this._toast('请输入标题'); return; }
      if (!date) { this._toast('请选择日期'); return; }
      this.events.push({ id: Store.genId(), title, date, note });
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

    // 2026 法定节假日范围
    const holidays = [
      { title: '元旦', start: '2026-01-01', end: '2026-01-03' },
      { title: '春节', start: '2026-02-15', end: '2026-02-23' },
      { title: '清明节', start: '2026-04-04', end: '2026-04-06' },
      { title: '劳动节', start: '2026-05-01', end: '2026-05-05' },
      { title: '端午节', start: '2026-06-19', end: '2026-06-21' },
      { title: '中秋节', start: '2026-09-25', end: '2026-09-27' },
      { title: '国庆节', start: '2026-10-01', end: '2026-10-07' },
    ];

    // 判断某天是否在任一假日范围内
    const isInHoliday = d => holidays.some(h => d >= h.start && d <= h.end);

    // 添加法定节假日起始日
    holidays.forEach(h => {
      if (h.start >= todayStr && !existing.has(`${h.title}|${h.start}`)) {
        newEvents.push({ id: Store.genId(), title: h.title, date: h.start, note: '法定节假日', auto: true });
      }
    });

    // 添加周末：只取周六，且不在假日范围内的才加
    const cur = new Date();
    cur.setHours(0, 0, 0, 0);
    cur.setDate(cur.getDate() + 1);
    let satCount = 0;
    while (satCount < 26 && cur.getFullYear() < 2028) {
      if (cur.getDay() === 6) {
        const dateStr = fmt(cur);
        if (!isInHoliday(dateStr) && !existing.has(`周末|${dateStr}`)) {
          newEvents.push({ id: Store.genId(), title: '周末', date: dateStr, note: '', auto: true });
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
    const filtered = events.filter(ev => !(ev.auto === true && ev.date < today));
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
