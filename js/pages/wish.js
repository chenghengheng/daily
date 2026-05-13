const Wish = {
  items: [],
  today: '',

  render(container) {
    this.today = Store.today();
    this.items = Store.getWishItems();
    this._resetDailyFlags();
    container.innerHTML = this._view();
    this._bind(container);
  },

  _resetDailyFlags() {
    let changed = false;
    this.items.forEach(item => {
      if (item.todayDate !== this.today) {
        item.todayClicked = false;
        item.todayDate = this.today;
        changed = true;
      }
    });
    if (changed) Store.saveWishItems(this.items);
  },

  _view() {
    const config = Store.getConfig();
    const remaining = config.MAX_DAILY_WISH_CLICKS - this.items.filter(i =>
      i.status === 'active' && i.todayClicked && i.todayDate === this.today
    ).length;

    const active = this.items.filter(i => i.status === 'active');
    const done = this.items.filter(i => i.status !== 'active');

    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
        <button class="btn btn-primary" id="wish-add-btn">+ 新物品</button>
        <button class="btn btn-outline" id="wish-log-btn">📋 操作日志</button>
        <button class="btn btn-outline" id="wish-data-btn">⚙️ 数据管理</button>
      </div>
      <div class="card" style="text-align:center;padding:12px;">
        <span style="font-size:13px;color:var(--text2);">
          今日剩余可点：<strong style="color:var(--accent);font-size:18px;">${Math.max(0, remaining)}</strong> / ${config.MAX_DAILY_WISH_CLICKS} 个
        </span>
      </div>
      ${active.length === 0 ? `
        <div class="empty-state">
          <p>还没有想买的东西</p>
          <p style="font-size:12px;margin-top:8px;">记录你想买的非必需品，让冲动飞一会儿</p>
        </div>
      ` : `<div class="card-stagger">${active.map(item => this._itemCard(item)).join('')}</div>`}
      ${done.length > 0 ? `
        <h3 style="font-size:13px;color:var(--text2);margin:16px 0 8px;">已处理</h3>
        ${done.map(item => this._itemCard(item)).join('')}
      ` : ''}
    `;
  },

  _itemCard(item) {
    const pct = Math.min(100, (item.currentProgress / item.price) * 100);
    const canClick = item.status === 'active' && !item.todayClicked;
    const fully = item.currentProgress >= item.price;

    return `
      <div class="card" data-id="${item.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <div style="font-size:16px;font-weight:600;">${this._esc(item.name)}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:2px;">
              ¥${item.price} · 每日 +${item.dailyProgress}
            </div>
          </div>
          <span class="badge ${item.status === 'active' ? 'badge-active' : item.status === 'purchased' ? 'badge-done' : 'badge-abandoned'}">
            ${item.status === 'active' ? '进行中' : item.status === 'purchased' ? '已购买' : item.status === 'abandoned' ? '已放弃' : '待确认'}
          </span>
        </div>
        <div style="margin-top:10px;">
          <div class="progress-bar">
            <div class="progress-fill ${pct >= 100 ? 'full' : ''}" style="width:${Math.min(100, pct)}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-top:4px;">
            <span>${item.currentProgress.toFixed(1)} / ${item.price}</span>
            <span>${pct.toFixed(1)}%</span>
          </div>
        </div>
        ${item.status === 'active' ? `
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
            ${fully ? `
              <button class="btn btn-sm btn-primary wish-confirm-btn">确认购买</button>
              <button class="btn btn-sm btn-outline wish-abandon-btn">放弃</button>
            ` : `
              <button class="btn btn-sm ${canClick ? 'btn-primary' : 'btn-outline'} wish-click-btn" ${!canClick ? 'disabled style=opacity:.5' : ''}>
                ${canClick ? `✓ 想要 (+${item.dailyProgress})` : '今天已点'}
              </button>
              ${item.todayClicked ? `<button class="btn btn-sm btn-outline wish-extra-btn">再加一次</button>` : ''}
              <button class="btn btn-sm btn-outline wish-abandon-btn" style="margin-left:auto;">放弃</button>
            `}
          </div>
        ` : `
          <div style="font-size:11px;color:var(--text2);margin-top:6px;">
            最终进度：${item.currentProgress.toFixed(1)} / ${item.price} · ${item.clickLog ? item.clickLog.length : 0} 次点击
          </div>
        `}
      </div>
    `;
  },

  _bind(container) {
    container.querySelector('#wish-add-btn')?.addEventListener('click', () => this._showAddModal());
    container.querySelector('#wish-log-btn')?.addEventListener('click', () => this._showLogModal());
    container.querySelector('#wish-data-btn')?.addEventListener('click', () => this._showDataModal());
    container.querySelectorAll('.wish-click-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.card').dataset.id;
        this._clickItem(id, false);
      });
    });
    container.querySelectorAll('.wish-extra-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.card').dataset.id;
        this._showExtraReasonModal(id);
      });
    });
    container.querySelectorAll('.wish-confirm-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.card').dataset.id;
        this._confirmPurchase(id);
      });
    });
    container.querySelectorAll('.wish-abandon-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.card').dataset.id;
        this._abandonItem(id);
      });
    });
  },

  _clickItem(id, isExtra) {
    const item = this.items.find(i => i.id === id);
    if (!item || item.status !== 'active') return;

    const config = Store.getConfig();
    const clickedToday = this.items.filter(i =>
      i.status === 'active' && i.todayClicked && i.todayDate === this.today
    ).length;

    if (!isExtra && item.todayClicked) return;
    if (!isExtra && clickedToday >= config.MAX_DAILY_WISH_CLICKS) {
      this._toast(`每天最多点 ${config.MAX_DAILY_WISH_CLICKS} 个物品`);
      return;
    }

    item.currentProgress += item.dailyProgress;
    item.todayClicked = true;
    item.todayDate = this.today;
    if (!item.clickLog) item.clickLog = [];
    item.clickLog.push({ date: this.today, reason: isExtra ? '(额外)' : null });
    item.updatedAt = new Date().toISOString();
    Store.saveWishItems(this.items);
    this.render(document.getElementById('content'));
  },

  _showExtraReasonModal(id) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>再加一次</h2>
        <p style="font-size:13px;color:var(--text2);margin-bottom:12px;">说明为什么今天特别想要这个物品：</p>
        <div class="form-group">
          <textarea id="extra-reason" placeholder="输入理由..." rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="extra-cancel">取消</button>
          <button class="btn btn-primary" id="extra-confirm">确认 +1</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#extra-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#extra-confirm').addEventListener('click', () => {
      const reason = overlay.querySelector('#extra-reason').value.trim();
      if (!reason) { this._toast('请输入理由'); return; }
      const item = this.items.find(i => i.id === id);
      if (!item) return;
      item.currentProgress += item.dailyProgress;
      if (!item.clickLog) item.clickLog = [];
      item.clickLog.push({ date: this.today, reason });
      item.updatedAt = new Date().toISOString();
      Store.saveWishItems(this.items);
      overlay.remove();
      this.render(document.getElementById('content'));
    });
  },

  _confirmPurchase(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>确认购买</h2>
        <p style="font-size:14px;">真的买 <strong>${this._esc(item.name)}</strong> 吗？</p>
        <p style="font-size:12px;color:var(--text2);margin-top:8px;">冷却期已过，由你决定。</p>
        <div class="modal-actions">
          <button class="btn btn-outline" id="purchase-cancel">再想想</button>
          <button class="btn btn-primary" id="purchase-yes">确认购买</button>
          <button class="btn btn-danger" id="purchase-no">还是算了</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#purchase-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#purchase-yes').addEventListener('click', () => {
      item.status = 'purchased';
      Store.saveWishItems(this.items);
      overlay.remove();
      this.render(document.getElementById('content'));
    });
    overlay.querySelector('#purchase-no').addEventListener('click', () => {
      item.status = 'abandoned';
      Store.saveWishItems(this.items);
      overlay.remove();
      this.render(document.getElementById('content'));
    });
  },

  _abandonItem(id) {
    if (!confirm('确定放弃这个物品吗？')) return;
    const item = this.items.find(i => i.id === id);
    if (item) { item.status = 'abandoned'; Store.saveWishItems(this.items); }
    this.render(document.getElementById('content'));
  },

  _showAddModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>新物品</h2>
        <div class="form-group">
          <label>名称</label>
          <input id="add-name" placeholder="想买什么？" autofocus>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>价格 (¥)</label>
            <input id="add-price" type="number" step="0.1" placeholder="99">
          </div>
          <div class="form-group">
            <label>每日进度</label>
            <input id="add-daily" type="number" step="0.1" placeholder="1">
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="add-cancel">取消</button>
          <button class="btn btn-primary" id="add-confirm">添加</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#add-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#add-confirm').addEventListener('click', () => {
      const name = overlay.querySelector('#add-name').value.trim();
      const price = parseFloat(overlay.querySelector('#add-price').value);
      const daily = parseFloat(overlay.querySelector('#add-daily').value) || 1;
      if (!name) { this._toast('请输入名称'); return; }
      if (!price || price <= 0) { this._toast('请输入有效价格'); return; }
      this.items.push({
        id: Store.genId(),
        name,
        price,
        dailyProgress: daily,
        currentProgress: 0,
        status: 'active',
        todayClicked: false,
        todayDate: null,
        clickLog: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      Store.saveWishItems(this.items);
      overlay.remove();
      this.render(document.getElementById('content'));
    });
  },

  _showLogModal() {
    // Collect all logs grouped by date
    const dateMap = {};
    this.items.forEach(item => {
      (item.clickLog || []).forEach(log => {
        if (!dateMap[log.date]) dateMap[log.date] = [];
        dateMap[log.date].push({ name: item.name, reason: log.reason });
      });
    });

    const dates = Object.keys(dateMap);
    if (dates.length === 0) {
      this._toast('暂无操作日志');
      return;
    }

    const now = new Date();
    let viewYear = now.getFullYear();
    let viewMonth = now.getMonth();
    let selectedDate = null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const pad2 = n => String(n).padStart(2, '0');
    const renderCal = () => {
      const firstDay = new Date(viewYear, viewMonth, 1);
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      let startW = firstDay.getDay(); // 0=Sun
      startW = startW === 0 ? 6 : startW - 1; // convert to Mon=0

      const todayStr = Store.today();
      const monthLabel = `${viewYear}年${viewMonth + 1}月`;
      const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

      let cells = '';
      for (let i = 0; i < startW; i++) {
        cells += '<div class="cal-day cal-day--empty"></div>';
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
        const logs = dateMap[dateStr];
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        let cls = 'cal-day';
        if (logs) cls += ' cal-day--has';
        if (logs && logs.length > 1) cls += ' cal-day--multi';
        if (isToday) cls += ' cal-day--today';
        if (isSelected) cls += ' cal-day--sel';
        cells += `
          <div class="${cls}" data-date="${dateStr}">
            <span class="cal-day__num">${d}</span>
            ${logs && logs.length > 1
              ? `<span class="cal-day__badge">×${logs.length}</span>`
              : logs ? '<span class="cal-day__dot"></span>' : ''}
          </div>`;
      }

      // Has months with logs before/after
      const hasPrev = dates.some(d => d < `${viewYear}-${pad2(viewMonth + 1)}-01`);
      const hasNext = dates.some(d => d >= `${viewYear}-${pad2(viewMonth + 2)}-01`);

      return `
        <div class="cal-head">
          <button class="btn btn-sm btn-outline cal-nav-btn" data-dir="prev" ${hasPrev ? '' : 'style="opacity:.25;pointer-events:none;"'}>‹</button>
          <span class="cal-head__title">${monthLabel}</span>
          <button class="btn btn-sm btn-outline cal-nav-btn" data-dir="next" ${hasNext ? '' : 'style="opacity:.25;pointer-events:none;"'}>›</button>
        </div>
        <div class="cal-grid">
          ${weekDays.map(w => `<div class="cal-grid__head">${w}</div>`).join('')}
          ${cells}
        </div>
      `;
    };

    const renderDetail = () => {
      if (!selectedDate || !dateMap[selectedDate]) {
        return '<div class="cal-detail cal-detail--empty">点击有标记的日期查看详情</div>';
      }
      const entries = dateMap[selectedDate];
      return `
        <div class="cal-detail">
          <div class="cal-detail__date">${selectedDate}</div>
          ${entries.map(e => `
            <div class="cal-detail__row">
              <span class="cal-detail__name">${this._esc(e.name)}</span>
              ${e.reason ? `<span class="cal-detail__reason">${this._esc(e.reason)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    };

    const update = () => {
      const modal = overlay.querySelector('.modal-body');
      if (!modal) return;
      modal.innerHTML = renderCal() + renderDetail();

      modal.querySelectorAll('.cal-day--has').forEach(el => {
        el.addEventListener('click', () => {
          selectedDate = el.dataset.date;
          // Re-render just the detail + update selected state
          const detail = modal.querySelector('.cal-detail');
          if (detail) detail.outerHTML = renderDetail();
          modal.querySelectorAll('.cal-day--sel').forEach(s => s.classList.remove('cal-day--sel'));
          el.classList.add('cal-day--sel');
        });
      });

      modal.querySelectorAll('.cal-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.dir === 'prev') { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } }
          else { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } }
          selectedDate = null;
          update();
        });
      });
    };

    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <h2>操作日志</h2>
        <div class="modal-body"></div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="log-close">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#log-close').addEventListener('click', () => overlay.remove());
    update();
  },

  _showDataModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>数据管理</h2>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-outline btn-block" id="data-export">📤 导出数据</button>
          <button class="btn btn-outline btn-block" id="data-import">📥 导入数据</button>
          <button class="btn btn-danger btn-block" id="data-clear">🗑️ 清空所有数据</button>
        </div>
        <p style="font-size:11px;color:var(--text3);margin-top:12px;text-align:center;">
          💡 不同浏览器数据独立，切换设备请先导出再导入
        </p>
        <div class="modal-actions">
          <button class="btn btn-outline" id="data-close">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#data-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#data-export').addEventListener('click', () => {
      const data = Store.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `daily-backup-${Store.today()}.json`;
      a.click();
      this._toast('导出成功');
    });
    overlay.querySelector('#data-import').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (Store.importAll(data)) {
              // Re-apply background if present in imported data
              const bg = Store.getBgImage();
              if (bg) {
                document.body.classList.add('has-bg');
                document.body.style.backgroundImage = `url(${bg})`;
              }
              this._toast('导入成功');
              overlay.remove();
              this.render(document.getElementById('content'));
            } else {
              this._toast('文件格式不正确');
            }
          } catch { this._toast('文件解析失败'); }
        };
        reader.readAsText(file);
      });
      input.click();
    });
    overlay.querySelector('#data-clear').addEventListener('click', () => {
      if (confirm('确定清空所有数据？此操作不可恢复！')) {
        if (confirm('是否先导出备份？点击"取消"将直接清空')) {
          const data = Store.exportAll();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `daily-backup-${Store.today()}.json`;
          a.click();
        }
        if (confirm('再次确认：所有物品、学习计划和倒计时将被删除！')) {
          Store.clearAll();
          overlay.remove();
          this.render(document.getElementById('content'));
          this._toast('已清空');
        }
      }
    });
  },

  _toast(msg) { Toast.show(msg); },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
};
