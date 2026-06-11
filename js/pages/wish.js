const Wish = {
  items: [],
  _sealedVisible: false,

  render(container) {
    this.items = Store.getWishItems();
    this._applyAutoProgress();
    this._sealedVisible = false;
    container.innerHTML = this._view();
    this._bind(container);
  },

  // Auto-accumulate progress based on elapsed days
  _applyAutoProgress() {
    const today = Store.today();
    let changed = false;
    this.items.forEach(item => {
      if (item.status !== 'active') return;
      if (item.currentProgress >= item.price) return;
      const lastDate = item.updatedAt ? item.updatedAt.slice(0, 10) : item.createdAt.slice(0, 10);
      if (lastDate >= today) return;
      const daysDiff = Math.floor((new Date(today + 'T00:00:00') - new Date(lastDate + 'T00:00:00')) / 86400000);
      if (daysDiff <= 0) return;
      const added = Math.min(item.price - item.currentProgress, daysDiff * item.dailyProgress);
      if (added <= 0) return;
      item.currentProgress += added;
      if (!item.progressLog) item.progressLog = [];
      for (let i = 1; i <= daysDiff; i++) {
        const d = new Date(lastDate + 'T00:00:00');
        d.setDate(d.getDate() + i);
        const ds = d.toISOString().slice(0, 10);
        if (ds > today) break;
        item.progressLog.push({ date: ds, amount: item.dailyProgress });
      }
      item.updatedAt = new Date().toISOString();
      changed = true;
    });
    if (changed) Store.saveWishItems(this.items);
  },

  _view() {
    const config = Store.getConfig();
    const active = this.items.filter(i => i.status === 'active');
    const ready = active.filter(i => i.currentProgress >= i.price);
    const sealed = active.filter(i => i.currentProgress < i.price && i.sealed !== false);
    const unsealed = active.filter(i => i.currentProgress < i.price && i.sealed === false);
    const done = this.items.filter(i => i.status !== 'active');

    const dailyTotal = active.reduce((s, i) => s + i.dailyProgress, 0);

    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
        <button class="btn btn-primary" id="wish-add-btn">+ 新物品</button>
        <button class="btn btn-outline" id="wish-log-btn">📋 操作日志</button>
        <button class="btn btn-outline" id="wish-data-btn">⚙️ 数据管理</button>
      </div>

      ${active.length === 0 && done.length === 0 ? `
        <div class="empty-state">
          <p>还没有物品</p>
          <p style="font-size:12px;margin-top:8px;">添加你想买的东西，让它自己积累等待期</p>
        </div>
      ` : ''}

      ${ready.length > 0 ? `
        <div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" style="filter:drop-shadow(0 0 4px var(--gold-glow));"><polygon points="12,2 22,12 12,22 2,12"/><circle cx="12" cy="12" r="2.5"/></svg>
            <span style="font-family:'Cinzel',serif;font-size:14px;font-weight:700;color:var(--gold);text-shadow:0 0 8px var(--gold-glow);">可抉择</span>
            <span style="font-size:12px;color:var(--text2);">${ready.length}</span>
          </div>
          <div class="card-stagger">${ready.map(i => this._itemCard(i, true)).join('')}</div>
        </div>
      ` : ''}

      ${config.showDailyCost && active.length > 0 ? `
        <div style="text-align:center;padding:8px 8px 0;font-size:12px;color:var(--text3);margin-bottom:2px;">
          每日累计 <span style="color:var(--sheikah);font-weight:600;">¥${dailyTotal.toFixed(1)}/天</span>
        </div>
      ` : ''}

      ${active.length > 0 || done.filter(i => i.status === 'purchased').length > 0 ? `
        <div style="text-align:center;padding:0 8px 8px;font-size:12px;color:var(--text3);margin-bottom:4px;">
          已累积 <span style="color:var(--gold);font-weight:600;">¥${this._calcAccumulated().toFixed(1)}</span>
        </div>
      ` : ''}

      ${sealed.length > 0 || unsealed.length > 0 ? `
        <div style="margin-bottom:4px;">
          <div style="font-size:11px;color:var(--text3);letter-spacing:.5px;font-family:'Cinzel',serif;display:flex;align-items:center;gap:8px;">
            <span>─ 等待中 ─</span>
            <span style="font-size:10px;font-weight:400;font-family:'Roboto',sans-serif;">${sealed.length + unsealed.length}</span>
          </div>
        </div>
      ` : ''}

      ${unsealed.length > 0 ? `
        <div style="margin-bottom:14px;">
          <div class="card-stagger">${unsealed.map(i => this._itemCard(i, false)).join('')}</div>
        </div>
      ` : ''}

      ${sealed.length > 0 ? `
        <div style="text-align:center;margin-bottom:14px;" id="wish-sealed-section">
          <button class="btn btn-sm sealed-toggle" id="wish-sealed-btn">
            ▸ 封印中（${sealed.length}）
          </button>
          <div id="wish-sealed-body" style="display:none;margin-top:8px;">
            ${sealed.map(i => this._itemCard(i, false)).join('')}
          </div>
        </div>
      ` : ''}

      ${done.length > 0 ? `
        <details style="margin-top:8px;" id="wish-done-details">
          <summary style="cursor:pointer;font-size:13px;color:var(--text2);padding:8px 0;user-select:none;">
            已处理（${done.length}）
          </summary>
          <div style="margin-top:4px;">${done.map(i => this._itemCard(i, false)).join('')}</div>
        </details>
      ` : ''}
    `;
  },

  _itemCard(item, isReady) {
    const pct = Math.min(100, (item.currentProgress / item.price) * 100);
    return `
      <div class="card wish-item ${isReady ? 'wish-item--ready' : ''}" data-id="${item.id}">
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
        ${isReady ? `
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary wish-confirm-btn">确认购买</button>
            <button class="btn btn-sm btn-outline wish-abandon-btn">放弃</button>
            <button class="btn btn-sm btn-outline wish-delete-btn" style="margin-left:auto;color:var(--text3);font-size:11px;">删除</button>
          </div>
        ` : item.status === 'active' ? `
          <div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end;">
            <button class="btn btn-sm btn-outline wish-seal-btn" style="color:var(--text3);font-size:11px;">${item.sealed !== false ? '解除封印' : '封印'}</button>
            <button class="btn btn-sm btn-outline wish-delete-btn" style="color:var(--text3);font-size:11px;">删除</button>
          </div>
        ` : `
          <div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end;">
            <span style="font-size:11px;color:var(--text2);margin-right:auto;">
              最终进度：${item.currentProgress.toFixed(1)} / ${item.price} · ${(item.progressLog || item.clickLog || []).length} 天
            </span>
            <button class="btn btn-sm btn-outline wish-delete-btn" style="color:var(--text3);font-size:11px;">删除</button>
          </div>
        `}
      </div>
    `;
  },

  _bind(container) {
    container.querySelector('#wish-add-btn')?.addEventListener('click', () => this._showAddModal());
    container.querySelector('#wish-log-btn')?.addEventListener('click', () => this._showLogModal());
    container.querySelector('#wish-data-btn')?.addEventListener('click', () => this._showDataModal());

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

    container.querySelector('#wish-sealed-btn')?.addEventListener('click', () => this._showSealedConfirm(container));

    container.querySelectorAll('.wish-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.target.closest('.card').dataset.id;
        this._deleteItem(id);
      });
    });

    container.querySelectorAll('.wish-seal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.target.closest('.card').dataset.id;
        this._toggleSeal(id);
      });
    });
  },

  _showSealedConfirm(container) {
    if (this._sealedVisible) {
      // Already visible, just toggle off
      this._sealedVisible = false;
      const body = container.querySelector('#wish-sealed-body');
      const btn = container.querySelector('#wish-sealed-btn');
      if (body) body.style.display = 'none';
      if (btn) btn.textContent = `▸ 封印中（${this.items.filter(i => i.status === 'active' && i.currentProgress < i.price).length}）`;
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>封印之物</h2>
        <p style="font-size:14px;color:var(--text);line-height:1.6;margin-bottom:8px;">
          这些物品正在积累等待期。频繁查看会削弱等待效果，让冲动战胜理性。
        </p>
        <p style="font-size:13px;color:var(--text2);">确定要继续吗？</p>
        <div class="modal-actions">
          <button class="btn btn-outline" id="sealed-cancel">不必了</button>
          <button class="btn btn-primary" id="sealed-next">坚持查看</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#sealed-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#sealed-next').addEventListener('click', () => {
      overlay.remove();
      // Step 2
      const overlay2 = document.createElement('div');
      overlay2.className = 'modal-overlay';
      overlay2.innerHTML = `
        <div class="modal">
          <h2>最后一次提醒</h2>
          <p style="font-size:14px;color:var(--text);line-height:1.6;margin-bottom:8px;">
            进度条和物品信息会影响你的判断。你真的需要现在就查看吗？
          </p>
          <div class="modal-actions">
            <button class="btn btn-outline" id="sealed-cancel2">算了</button>
            <button class="btn btn-primary" id="sealed-confirm">我确定</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay2);

      overlay2.querySelector('#sealed-cancel2').addEventListener('click', () => overlay2.remove());
      overlay2.querySelector('#sealed-confirm').addEventListener('click', () => {
        overlay2.remove();
        this._sealedVisible = true;
        const body = document.querySelector('#wish-sealed-body');
        const btn = document.querySelector('#wish-sealed-btn');
        if (body) body.style.display = 'block';
        if (btn) btn.textContent = `▾ 封印中（${this.items.filter(i => i.status === 'active' && i.currentProgress < i.price).length}）`;
      });
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
        <p style="font-size:12px;color:var(--text2);margin-top:8px;">等待期已到，由你决定。</p>
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

  _toggleSeal(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.sealed = item.sealed === false;
    Store.saveWishItems(this.items);
    this.render(document.getElementById('content'));
  },

  _calcAccumulated() {
    return this.items.filter(i => i.status !== 'abandoned').reduce((s, i) => s + i.currentProgress, 0);
  },

  _deleteItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>删除物品</h2>
        <p style="font-size:14px;">确定永久删除 <strong>${this._esc(item.name)}</strong> 吗？<br><span style="font-size:12px;color:var(--text2);">此操作不可恢复。</span></p>
        <div class="modal-actions">
          <button class="btn btn-outline" id="del-cancel">取消</button>
          <button class="btn btn-danger" id="del-confirm">删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#del-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#del-confirm').addEventListener('click', () => {
      this.items = this.items.filter(i => i.id !== id);
      Store.saveWishItems(this.items);
      overlay.remove();
      this.render(document.getElementById('content'));
      this._toast('已删除');
    });
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
        sealed: true,
        progressLog: [],
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
      const logs = item.progressLog || item.clickLog || [];
      logs.forEach(log => {
        if (!dateMap[log.date]) dateMap[log.date] = [];
        dateMap[log.date].push({ name: item.name, reason: log.reason || null });
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
      let startW = firstDay.getDay();
      startW = startW === 0 ? 6 : startW - 1;

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
        <h2>清单数据管理</h2>
        <p style="font-size:12px;color:var(--text2);margin-bottom:12px;">仅操作清单物品数据，不影响其他页面</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-outline btn-block" id="data-export">📤 导出清单数据</button>
          <button class="btn btn-outline btn-block" id="data-import">📥 导入清单数据</button>
          <button class="btn btn-danger btn-block" id="data-clear">🗑️ 清空所有物品</button>
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
      const data = Store.exportWishData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `wishlist-backup-${Store.today()}.json`;
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
            if (Store.importWishData(data)) {
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
      if (confirm('确定清空所有清单物品？此操作不可恢复！')) {
        if (confirm('是否先导出备份？点击"取消"将直接清空')) {
          const data = Store.exportWishData();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `wishlist-backup-${Store.today()}.json`;
          a.click();
        }
        Store.clearWishData();
        overlay.remove();
        this.render(document.getElementById('content'));
        this._toast('已清空');
      }
    });
  },

  _toast(msg) { Toast.show(msg); },

  _esc(s) {
    if (s === null || s === undefined) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
};
