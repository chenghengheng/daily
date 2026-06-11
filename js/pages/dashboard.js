const Dashboard = {
  render(container) {
    const wishItems = Store.getWishItems();
    const plans = Store.getStudyPlans();
    const events = Store.getCountdownEvents();

    const activeWish = wishItems.filter(i => i.status === 'active');
    const wishReady = activeWish.filter(i => i.currentProgress >= i.price).length;
    const totalAccumulated = wishItems.filter(i => i.status !== 'abandoned').reduce((s, i) => s + i.currentProgress, 0);

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
          <div class="stat-number" style="color:var(--gold);">¥${totalAccumulated.toFixed(1)}</div>
          <div class="stat-label">已累积</div>
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
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:14px;border-bottom:1px solid var(--border);">
              <span>
                ${ev.type === 'reminder' ? '<span style="font-size:10px;color:var(--gold);">⚠</span> ' : ev.type === 'event' ? '<span style="font-size:10px;color:var(--sheikah);">★</span> ' : ''}
                ${this._esc(ev.title)}
              </span>
              <span style="color:${ev.diff <= 7 ? 'var(--gold)' : 'var(--sheikah)'};font-weight:600;">${ev.diff} 天</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="card-stagger" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <a href="#/wish" class="card card-link" style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 42 51" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path d="M39.587 23.468H38.208V17.172C38.208 12.421 36.254 8.128 33.152 5.037C29.992 1.946 25.683 0 20.971 0C11.434 0 3.735 7.67 3.735 17.172V23.468H2.356C1.092 23.468 0 24.498 0 25.815V48.653C0 49.913 1.034 51 2.356 51H39.644C40.966 51 42 49.97 42 48.653V25.815C41.943 24.498 40.851 23.468 39.587 23.468ZM20.856 45.791C16.088 45.791 12.238 41.956 12.238 37.205C12.238 32.455 16.088 28.62 20.856 28.62C25.625 28.62 29.475 32.455 29.475 37.205C29.475 41.956 25.625 45.791 20.856 45.791ZM29.59 23.468H12.353V16.027C12.353 11.276 16.203 7.441 20.971 7.441C25.74 7.441 29.59 11.276 29.59 16.027V23.468ZM24.304 34.916C24.304 36.175 23.614 37.32 22.58 37.892V42.929H19.133V37.892C18.099 37.32 17.409 36.175 17.409 34.916C17.409 33.027 18.96 31.482 20.856 31.482C22.752 31.482 24.304 33.027 24.304 34.916Z"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">清单</div>
        </a>
        <a href="#/study" class="card card-link" style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 77 45.2" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path d="M38.512 0L32.5925 8.943H44.3963L38.512 0"/><path d="M26.7084 17.8509L32.5926 8.943L38.5122 17.8509H26.7084Z"/><path d="M38.5122 17.8509H50.3513L44.3965 8.943L38.5122 17.8509Z"/><path d="M0 2.765L2.89 11.445L23.02 14.47V16.603L4.933 18.587L8.521 25.58L23.52 19.976L24.467 21.811L13.006 30.44L17.939 33.912L26.31 24.638L27.606 25.878L23.52 35.549L28.453 36.541L30.197 27.713C31.749 27.923 34.028 27.713 33.967 25.58C33.937 24.541 33.45 23.267 31.648 22.713C23.875 20.326 25.463 10.651 27.905 6.634C24.986 8.943 24.779 10.109 23.968 11.197C22.635 10.843 0 2.765 0 2.765Z"/><path d="M77 2.765L74.11 11.445L53.978 14.47V16.603L72.067 18.587L68.479 25.58L53.48 19.976L52.533 21.811L63.994 30.44L59.061 33.912L50.69 24.638L49.394 25.878L53.48 35.549L48.547 36.541L46.803 27.713C45.251 27.923 42.972 27.713 43.033 25.58C43.063 24.541 43.55 23.267 45.352 22.713C53.125 20.326 51.537 10.651 49.095 6.634C52.014 8.943 52.221 10.109 53.032 11.197C54.365 10.843 77 2.765 77 2.765Z"/><path d="M38.512 20.604C38.459 21.656 37.049 24.251 36.679 24.638C36.382 24.948 35.974 25.58 35.146 27.713C34.318 29.845 34.66 29.946 32.944 31.195C40.002 34.425 35.974 37.702 35.974 38.456C36.858 40.68 38.512 45.171 38.512 45.171C38.512 45.171 40.164 40.68 41.047 38.456C41.047 37.702 37.02 34.425 44.078 31.195C42.362 29.946 42.704 29.845 41.876 27.713C41.048 25.58 40.64 24.948 40.343 24.638C39.973 24.251 38.565 21.656 38.512 20.604Z"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">学习</div>
        </a>
        <a href="#/countdown" class="card card-link" style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 51 48" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path fill-rule="evenodd" clip-rule="evenodd" d="M0 11V4V0H4H11H15V3H36V0H40H47H51V4V11V15V22V26V33V37V44V48H47H40H36V45H15V48H11H4H0V44V37V33V26V22V15V11ZM40 44H47V37H40V44ZM11 37V44H4V37H11ZM36 37V33V26H15V33V37V41H36V37ZM40 33H47V26H40V33ZM4 33H11V26H4V33ZM4 22H11V15H4V22ZM36 22H15V15V11V7H36V11V15V22ZM40 22H47V15H40V22ZM47 4V11H40V4H47ZM4 11H11V4H4V11Z"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">倒计时</div>
        </a>
        <div class="card card-link" style="text-align:center;padding:20px;" id="dashboard-settings-btn">
          <svg width="22" height="22" viewBox="0 0 52 52" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path d="M24.7867 0.52L0.52 24.7867C-0.173333 25.48 -0.173333 26.52 0.52 27.2133L24.7867 51.48C25.48 52.1733 26.52 52.1733 27.2133 51.48L51.48 27.2133C52.1733 26.52 52.1733 25.48 51.48 24.7867L27.2133 0.52C26.52 -0.173333 25.48 -0.173333 24.7867 0.52ZM27.04 44.1133H24.96C24.0933 44.1133 23.2267 43.7667 22.5333 43.16L21.9267 42.5533C21.06 41.6867 20.6267 40.3867 20.8 39.1733L21.06 37.0067C21.2333 35.9667 21.58 34.9267 22.1867 34.06C22.7933 33.1933 23.5733 32.5 24.5267 31.98C24.96 31.72 25.48 31.6333 26 31.6333C26.52 31.6333 27.04 31.72 27.4733 31.98C29.38 33.02 30.5933 34.84 30.8533 37.0067L31.1133 39.1733C31.2867 40.3867 30.8533 41.6867 29.9867 42.5533L29.4667 43.16C28.7733 43.7667 27.9067 44.1133 27.04 44.1133ZM36.66 28.2533C34.4933 26.1733 32.8467 23.5733 31.98 20.6267L30.7667 16.4667C30.5067 15.6 29.7267 14.9933 28.7733 14.9933H23.14C22.1867 14.9933 21.4067 15.6 21.1467 16.4667L19.9333 20.6267C19.0667 23.4867 17.5067 26.1733 15.2533 28.2533L11.3533 31.98L5.98 26.6067C5.63333 26.26 5.63333 25.74 5.98 25.3933L25.3933 5.98C25.74 5.63333 26.26 5.63333 26.6067 5.98L45.9333 25.3933C46.28 25.74 46.28 26.26 45.9333 26.6067L40.56 31.98L36.66 28.2533Z"/></svg>
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
