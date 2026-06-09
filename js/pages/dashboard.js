const Dashboard = {
  render(container) {
    const wishItems = Store.getWishItems();
    const plans = Store.getStudyPlans();
    const events = Store.getCountdownEvents();

    const activeWish = wishItems.filter(i => i.status === 'active');
    const wishReady = activeWish.filter(i => i.currentProgress >= i.price).length;
    const wishSealed = activeWish.filter(i => i.currentProgress < i.price).length;

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
            ${wishSealed}
          </div>
          <div class="stat-label">封印中</div>
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
          <svg width="22" height="22" viewBox="0 0 51 51" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path d="M43.414 34.472L32.149 45.783C24.408 53.557 11.873 53.441 4.652 45.203C-1.819 37.836 -1.53 26.641 5.46 19.621L17.014 8.02C17.303 7.73 17.765 7.73 17.996 8.02L24.293 14.227C24.582 14.517 24.582 14.981 24.293 15.213L12.97 26.583C9.793 29.773 9.446 35.052 12.508 38.416C15.743 41.955 21.231 42.071 24.639 38.706L36.193 27.105C36.482 26.815 36.944 26.815 37.175 27.105L43.414 33.37C43.703 33.718 43.703 34.182 43.414 34.472ZM24.87 0.131L20.191 4.829C20.018 5.003 20.018 5.293 20.191 5.525L26.777 12.138C26.95 12.312 27.239 12.312 27.47 12.138L32.149 7.44C32.323 7.266 32.323 6.976 32.149 6.744L25.564 0.131C25.333 -0.044 25.044 -0.044 24.87 0.131ZM51.213 25.944L44.627 19.331C44.454 19.157 44.165 19.157 43.934 19.331L39.255 24.03C39.082 24.204 39.082 24.494 39.255 24.726L45.84 31.339C46.014 31.513 46.302 31.513 46.534 31.339L51.213 26.641C51.444 26.408 51.444 26.118 51.213 25.944Z"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">清单</div>
        </a>
        <a href="#/study" class="card card-link" style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 68 57" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path d="M52.817 12.43L45.059 0.746C44.729 0.331 44.234 0 43.739 0H24.015C23.52 0 22.942 0.249 22.695 0.746L14.855 12.43H1.568C0.66 12.43 0 13.176 0 14.005V55.523C0 56.434 0.743 57.097 1.568 57.097H66.021C66.929 57.097 67.589 56.351 67.589 55.523V14.005C67.589 13.093 66.846 12.43 66.021 12.43H52.817ZM33.836 48.893C25.17 48.893 18.156 41.849 18.156 33.148C18.156 24.447 25.17 17.403 33.836 17.403C42.501 17.403 49.516 24.447 49.516 33.148C49.516 41.849 42.501 48.893 33.836 48.893ZM44.564 33.148C44.564 39.114 39.778 43.921 33.836 43.921C27.894 43.921 23.107 39.114 23.107 33.148C23.107 27.181 27.894 22.375 33.836 22.375C39.778 22.375 44.564 27.181 44.564 33.148Z"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">学习</div>
        </a>
        <a href="#/countdown" class="card card-link" style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 42 51" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path d="M39.587 23.468H38.208V17.172C38.208 12.421 36.254 8.128 33.152 5.037C29.992 1.946 25.683 0 20.971 0C11.434 0 3.735 7.67 3.735 17.172V23.468H2.356C1.092 23.468 0 24.498 0 25.815V48.653C0 49.913 1.034 51 2.356 51H39.644C40.966 51 42 49.97 42 48.653V25.815C41.943 24.498 40.851 23.468 39.587 23.468ZM20.856 45.791C16.088 45.791 12.238 41.956 12.238 37.205C12.238 32.455 16.088 28.62 20.856 28.62C25.625 28.62 29.475 32.455 29.475 37.205C29.475 41.956 25.625 45.791 20.856 45.791ZM29.59 23.468H12.353V16.027C12.353 11.276 16.203 7.441 20.971 7.441C25.74 7.441 29.59 11.276 29.59 16.027V23.468ZM24.304 34.916C24.304 36.175 23.614 37.32 22.58 37.892V42.929H19.133V37.892C18.099 37.32 17.409 36.175 17.409 34.916C17.409 33.027 18.96 31.482 20.856 31.482C22.752 31.482 24.304 33.027 24.304 34.916Z"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">倒计时</div>
        </a>
        <div class="card card-link" style="text-align:center;padding:20px;" id="dashboard-settings-btn">
          <svg width="22" height="22" viewBox="0 0 380 350" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path d="M108.514 25.105C111.349 29.966 116.705 33.221 122.781 33.221C131.873 33.221 139.254 25.908 139.254 16.9C139.254 15.384 139.029 13.913 138.669 12.53C138.129 10.613 137.273 8.829 136.103 7.268C133.133 3.166 128.272 0.535 122.781 0.535C113.689 0.535 106.308 7.848 106.308 16.856C106.308 17.792 106.398 18.684 106.533 19.531C106.803 21.582 107.523 23.455 108.514 25.105Z"/><path d="M241.916 24.525C244.752 29.386 250.108 32.641 256.184 32.641C261.63 32.641 266.491 30.01 269.506 25.952C270.541 27.826 272.702 28.515 276.572 26.443C299.076 40.4 319.06 56.364 334.137 78.348C346.919 96.987 355.831 118.213 360.827 140.196C360.827 140.375 360.872 140.553 360.872 140.731C360.872 142.827 358.081 143.228 357.586 141.222C356.686 137.521 355.831 133.82 354.706 130.208C353.22 125.436 351.285 120.977 349.62 116.295C339.268 87.533 320.23 61.893 295.566 43.611C287.284 37.457 278.373 32.151 269.866 26.265Z"/><path d="M380 174.889C380 173.06 379.73 171.277 379.28 169.627C378.605 167.308 377.57 165.168 376.174 163.295C372.574 158.345 366.723 155.179 360.107 155.179C349.71 155.179 341.203 163.072 340.303 173.149C340.258 173.462 340.078 173.774 339.808 173.952C339.628 174.041 339.448 174.13 339.268 174.175C336.613 174.443 335.712 174.353 333.147 174.487C332.427 174.532 330.086 174.487 329.366 174.487C322.525 174.443 315.729 174.487 308.888 174.443C307.583 174.443 306.953 174.844 306.953 176.182C306.908 177.564 307.538 177.921 308.843 177.876C313.569 177.832 315.999 177.965 320.725 177.965L326.981 177.921C331.842 177.921 332.787 177.876 337.648 177.965C338.143 177.965 338.773 178.01 339.313 178.099C339.988 178.188 340.528 178.679 340.663 179.303C341.113 181.265 341.878 183.049 342.914 184.743C345.929 189.871 351.105 193.483 357.316 194.286C357.811 194.33 358.171 194.732 358.216 195.222C358.891 206.638 352.095 227.997 351.06 230.94C346.604 243.515 340.528 255.555 333.147 266.703C324.37 280.036 313.704 292.12 301.777 302.777C295.791 308.084 289.535 313.123 282.918 317.671C276.302 322.264 269.011 325.787 261.765 329.532C260.054 330.424 257.669 330.023 256.769 328.328C250.873 317.448 246.597 305.453 241.691 294.082C241.241 293.056 240.791 291.942 240.926 290.782C241.196 288.731 243.897 287.839 245.472 286.992C251.863 283.558 257.714 280.08 263.925 276.78C264.15 276.647 265.41 275.978 266.536 275.22C266.941 274.952 267.436 274.997 267.796 275.354C270.226 277.761 273.557 279.278 277.292 279.278C284.629 279.278 290.615 273.392 290.615 266.078C290.615 264.874 290.435 263.671 290.12 262.556C289.67 260.995 288.994 259.568 288.049 258.32C285.619 255.02 281.703 252.879 277.292 252.879C269.956 252.879 263.97 258.765 263.97 266.078C263.97 266.837 264.015 267.55 264.15 268.263C264.33 269.289 264.6 270.315 265.005 271.207C265.185 271.652 265.05 272.143 264.645 272.41C263.745 273.035 262.935 273.57 262.89 273.614C257.444 276.914 252.268 280.125 246.687 283.023C243.852 284.495 241.961 285.565 239.081 287.037C237.731 287.705 236.921 290.158 237.416 291.496C238.361 293.993 239.126 295.554 240.161 298.006C242.366 303.223 244.662 308.396 246.867 313.569C248.668 317.716 250.378 321.863 252.133 325.965C253.168 328.328 254.744 333.635 257.849 333.992C259.379 334.17 260.64 334.081 262.035 333.412C288.409 320.926 311.498 301.841 329.051 278.698C344.534 258.275 356.641 234.062 360.962 208.734C361.637 204.676 361.772 200.484 362.042 196.382C362.087 195.757 362.222 195.222 362.447 194.776C362.627 194.464 362.987 194.241 363.347 194.152C372.754 192.814 380 184.699 380 174.889ZM39.652 178.01C39.742 177.653 40.057 177.341 40.417 177.386C42.892 177.43 51.444 177.296 56.17 177.386C60.85 177.475 65.891 177.386 70.707 177.296C72.102 177.252 72.958 177.296 72.958 175.825C72.958 174.264 71.652 174.353 70.482 174.353C65.621 174.398 64.046 174.353 59.185 174.353L54.324 174.309C49.509 174.309 45.818 174.353 41.002 174.264C40.822 174.264 40.597 174.22 40.372 174.175C39.967 174.086 39.697 173.729 39.697 173.372C39.607 172.079 39.382 170.831 39.067 169.627C38.392 167.308 37.356 165.168 35.961 163.295C32.676 158.836 27.59 155.803 21.739 155.268C21.289 155.224 20.929 154.778 21.064 154.332C21.289 153.262 21.469 152.147 21.604 151.077C25.609 118.703 39.562 87.756 61.301 63.097C68.862 54.491 77.368 46.732 86.595 39.91C89.205 37.992 91.906 36.119 94.651 34.336C95.506 33.756 95.866 32.641 95.371 31.749C95.281 31.571 95.146 31.437 95.011 31.303C94.156 30.545 92.671 31.125 91.681 31.794C83.669 36.967 76.513 43.834 69.312 50.032C55.585 61.893 45.548 76.609 37.041 92.394C32.316 101.134 27.95 110.097 25.114 119.684C23.314 125.793 21.379 131.858 20.028 138.011C18.948 143.05 18.678 148.223 18.003 153.351C17.958 153.618 17.913 154.02 17.868 154.421C17.778 154.911 17.418 155.357 16.878 155.402C7.336 156.873 0 164.989 0 174.889C0 176.003 0.09 177.074 0.27 178.144C0.675 180.552 1.485 182.781 2.7 184.788C6.121 190.629 12.557 194.598 19.893 194.598C29.615 194.553 37.897 187.151 39.652 178.01Z"/></svg>
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
