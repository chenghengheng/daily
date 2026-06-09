const Dashboard = {
  render(container) {
    const wishItems = Store.getWishItems();
    const plans = Store.getStudyPlans();
    const events = Store.getCountdownEvents();

    const activeWish = wishItems.filter(i => i.status === 'active');
    const config = Store.getConfig();
    const remaining = config.MAX_DAILY_WISH_CLICKS - activeWish.filter(i =>
      i.todayClicked && i.todayDate === Store.today()
    ).length;
    const wishReady = activeWish.filter(i => i.currentProgress >= i.price).length;

    const plan = plans.length > 0 ? plans[0] : null;
    const currentPhase = plan ? plan.phases[plan.currentPhaseIndex || 0] : null;
    const phaseProgress = currentPhase
      ? `${currentPhase.tasks.filter(t => t.status === 'done').length}/${currentPhase.tasks.length}`
      : '-/-';

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const upcoming = events
      .map(ev => {
        const target = new Date(ev.date + 'T00:00:00');
        const diff = Math.round((target - now) / (1000 * 60 * 60 * 24));
        return { ...ev, diff };
      })
      .filter(ev => ev.diff >= 0)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 3);

    container.innerHTML = `
      <div class="stat-grid stat-enter" style="margin-bottom:16px;">
        <div class="stat-card">
          <div class="stat-number">${activeWish.length}</div>
          <div class="stat-label">进行中 · 清单</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:${wishReady > 0 ? 'var(--gold)' : 'var(--sheikah)'}">
            ${Math.max(0, remaining)}
          </div>
          <div class="stat-label">今日可点 / ${config.MAX_DAILY_WISH_CLICKS}</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${plan ? currentPhase?.title || '-' : '-'}</div>
          <div class="stat-label">${plan ? '当前阶段' : '暂无计划'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${phaseProgress}</div>
          <div class="stat-label">阶段任务</div>
        </div>
      </div>

      ${wishReady > 0 ? `
        <div class="card" style="border-color:var(--gold);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:14px;font-weight:600;">🎯 ${wishReady} 个物品已达目标</span>
            <a href="#/wish" style="color:var(--sheikah);font-size:13px;text-decoration:none;">去看看 →</a>
          </div>
        </div>
      ` : ''}

      ${upcoming.length > 0 ? `
        <div class="card">
          <div class="card-title">⏰ 即将到来</div>
          ${upcoming.map(ev => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid var(--border);">
              <span>${this._esc(ev.title)}</span>
              <span style="color:${ev.diff <= 7 ? 'var(--gold)' : 'var(--sheikah)'};font-weight:600;">${ev.diff} 天</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="card-stagger" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <a href="#/wish" class="card card-link" style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:block;margin:0 auto;color:var(--sheikah);"><polygon points="12,3 20,12 12,21 4,12"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">清单</div>
        </a>
        <a href="#/study" class="card card-link" style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:block;margin:0 auto;color:var(--sheikah);"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">学习</div>
        </a>
        <a href="#/countdown" class="card card-link" style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:block;margin:0 auto;color:var(--sheikah);"><polygon points="12,1 18,8 6,8"/><rect x="8" y="8" width="8" height="3"/><polygon points="6,16 18,16 12,23"/><line x1="12" y1="11" x2="12" y2="16"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">倒计时</div>
        </a>
        <div class="card card-link" style="text-align:center;padding:20px;" id="dashboard-settings-btn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:block;margin:0 auto;color:var(--sheikah);"><polygon points="12,2 22,12 12,22 2,12"/><circle cx="12" cy="12" r="2.5"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">个性化</div>
        </div>
      </div>
    `;

    container.querySelector('#dashboard-settings-btn')?.addEventListener('click', () => this._showSettingsModal());
  },

  _showSettingsModal() {
    const currentBg = Store.getBgImage();
    let previewUrl = currentBg;

    const renderPreview = () => {
      if (previewUrl) {
        return `<div style="width:100%;height:120px;border-radius:var(--radius-sm);background:url(${previewUrl}) center/cover;border:1px solid var(--border);margin-bottom:12px;"></div>`;
      }
      return '';
    };

    // HEIC detection: read first 32 bytes to check ftyp brand
    const detectHeic = (file) => new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => {
        const dv = new DataView(e.target.result);
        if (dv.byteLength < 12) return resolve(false);
        const ftyp = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
        if (ftyp !== 'ftyp') return resolve(false);
        const heicBrands = ['heic','heix','hevc','hevx','mif1','msf1'];
        const end = Math.min(dv.byteLength, 32);
        let off = 8;
        while (off + 4 <= end) {
          const brand = String.fromCharCode(dv.getUint8(off), dv.getUint8(off+1), dv.getUint8(off+2), dv.getUint8(off+3));
          if (heicBrands.includes(brand)) return resolve(true);
          off += 4;
        }
        resolve(false);
      };
      r.readAsArrayBuffer(file.slice(0, 32));
    });

    // Lightness detection using 50×50 canvas
    const detectLightness = (dataUrl, cb) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 50; c.height = 50;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 50, 50);
        const d = ctx.getImageData(0, 0, 50, 50).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        cb(sum / (d.length / 4) > 180);
      };
      img.src = dataUrl;
    };

    const applyBg = (dataUrl) => {
      previewUrl = dataUrl;
      Store.saveBgImage(dataUrl);
      document.body.classList.add('has-bg');
      document.body.style.backgroundImage = `url(${dataUrl})`;
      detectLightness(dataUrl, light => document.body.classList.toggle('bg-light', light));
      const preview = modal.modalEl.querySelector('#settings-bg-preview');
      if (preview) preview.innerHTML = renderPreview();
      const actions = modal.modalEl.querySelector('.form-group > div:last-child');
      if (actions && !actions.querySelector('#settings-bg-remove')) {
        const rmBtn = document.createElement('button');
        rmBtn.className = 'btn btn-sm btn-danger';
        rmBtn.id = 'settings-bg-remove';
        rmBtn.textContent = '移除';
        rmBtn.addEventListener('click', () => {
          Store.clearBgImage();
          document.body.classList.remove('has-bg', 'bg-light');
          document.body.style.backgroundImage = '';
          previewUrl = null;
          if (preview) preview.innerHTML = renderPreview();
          rmBtn.remove();
          Toast.show('已移除背景');
        });
        actions.appendChild(rmBtn);
      }
      Toast.show('背景已更新');
    };

    const modal = Modal.open({
      title: '个性化',
      body: `
        <div class="form-group">
          <label>背景图片</label>
          <div id="settings-bg-preview">${renderPreview()}</div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-outline" id="settings-bg-upload">📁 上传图片</button>
            ${currentBg ? '<button class="btn btn-sm btn-danger" id="settings-bg-remove">移除</button>' : ''}
          </div>
          <p style="font-size:11px;color:var(--text3);margin-top:6px;">建议使用深色图片，效果更佳 · 图片仅存储在本地</p>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">
          <button class="btn btn-outline btn-block" id="settings-export">📤 导出数据</button>
          <button class="btn btn-outline btn-block" id="settings-import" style="margin-top:8px;">📥 导入数据</button>
        </div>
        <p style="font-size:11px;color:var(--text3);margin-top:12px;text-align:center;">
          💡 iOS Safari 与桌面 PWA 数据独立，切换设备请先导出再导入
        </p>
      `,
      onClose() {},
    });

    modal.modalEl.querySelector('#settings-bg-upload')?.addEventListener('click', async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (await detectHeic(file)) {
          Toast.show('不支持 HEIC/HEIF 格式，请使用 JPEG 或 PNG');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => applyBg(ev.target.result);
        reader.readAsDataURL(file);
      });
      input.click();
    });

    modal.modalEl.querySelector('#settings-bg-remove')?.addEventListener('click', () => {
      Store.clearBgImage();
      document.body.classList.remove('has-bg', 'bg-light');
      document.body.style.backgroundImage = '';
      previewUrl = null;
      const preview = modal.modalEl.querySelector('#settings-bg-preview');
      if (preview) preview.innerHTML = renderPreview();
      const btn = modal.modalEl.querySelector('#settings-bg-remove');
      if (btn) btn.remove();
      Toast.show('已移除背景');
    });

    modal.modalEl.querySelector('#settings-export')?.addEventListener('click', () => {
      const data = Store.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `daily-backup-${Store.today()}.json`;
      a.click();
      Toast.show('已导出');
    });

    modal.modalEl.querySelector('#settings-import')?.addEventListener('click', () => {
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
              const bg = Store.getBgImage();
              if (bg) {
                document.body.classList.add('has-bg');
                document.body.style.backgroundImage = `url(${bg})`;
                detectLightness(bg, light => document.body.classList.toggle('bg-light', light));
              } else {
                document.body.classList.remove('bg-light');
              }
              modal.close();
              Dashboard.render(document.getElementById('content'));
              Toast.show('导入成功');
            } else {
              Toast.show('文件格式不正确');
            }
          } catch {
            Toast.show('文件解析失败');
          }
        };
        reader.readAsText(file);
      });
      input.click();
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
