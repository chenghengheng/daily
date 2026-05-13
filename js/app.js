/* ---- global utilities ---- */

/** Toast notification */
const Toast = {
  _container: null,

  _ensureContainer() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    }
    return this._container;
  },

  show(msg, duration = 2000) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    const c = this._ensureContainer();
    c.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
    }, duration);
  },
};

/** Modal helper: creates a modal with animation, keyboard & focus support */
const Modal = {
  open(config) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${config.title || ''}">${config.body}</div>`;
    document.body.appendChild(overlay);

    const modalEl = overlay.querySelector('.modal');
    let closed = false;

    const close = () => {
      if (closed) return;
      closed = true;
      modalEl.classList.add('closing');
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 150);
      config.onClose?.();
      // restore focus
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
    };

    // Escape to close
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      // trap focus
      if (e.key === 'Tab') {
        const focusable = modalEl.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Auto-focus first input/button
    const firstInput = modalEl.querySelector('input, textarea, button:not(.btn-outline)');
    setTimeout(() => {
      const target = config.focus || firstInput || modalEl.querySelector('button');
      target?.focus();
    }, 50);

    return { overlay, modalEl, close };
  },
};

/* ---- page transition ---- */
function animatePageEnter(container) {
  container.classList.remove('page-enter');
  // force reflow
  void container.offsetWidth;
  container.classList.add('page-enter');
}

/* ---- App ---- */
const App = {
  currentPage: '',

  init() {
    // Inject ambient background div (real element for iOS Safari animation reliability)
    const ambient = document.createElement('div');
    ambient.id = 'ambient';
    document.body.insertBefore(ambient, document.body.firstChild);

    this._applyBgImage();
    Countdown.cleanupExpiredAuto();  // remove expired imported countdown events
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  _applyBgImage() {
    const bg = Store.getBgImage();
    if (bg) {
      document.body.classList.add('has-bg');
      document.body.style.backgroundImage = `url(${bg})`;
      this._detectBgLightness(bg);
    }
  },

  _detectBgLightness(dataUrl) {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 50; c.height = 50;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 50, 50);
      const d = ctx.getImageData(0, 0, 50, 50).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
      const avg = sum / (d.length / 4);
      document.body.classList.toggle('bg-light', avg > 180);
    };
    img.src = dataUrl;
  },

  route() {
    const hash = location.hash.slice(1) || '/';
    let page = 'dashboard';
    if (hash.startsWith('/wish')) page = 'wish';
    else if (hash.startsWith('/study')) page = 'study';
    else if (hash.startsWith('/countdown')) page = 'countdown';

    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const titles = { dashboard: '仪表盘', wish: '清单', study: '学习', countdown: '倒计时' };
    document.getElementById('page-title').textContent = titles[page] || 'Daily';

    const container = document.getElementById('content');
    container.scrollTop = 0;

    switch (page) {
      case 'dashboard': Dashboard.render(container); break;
      case 'wish': Wish.render(container); break;
      case 'study': Study.render(container); break;
      case 'countdown': Countdown.render(container); break;
    }

    animatePageEnter(container);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
