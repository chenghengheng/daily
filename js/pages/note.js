const NOTE_TAGS = {
  task:  { label: '任务', cls: 'note-tag--task' },
  media: { label: '书影', cls: 'note-tag--media' },
  idea:  { label: '念头', cls: 'note-tag--idea' },
};

const NOTE_ORDER = ['task', 'media', 'idea'];

const Note = {
  items: [],

  render(container) {
    this.items = Store.getNoteItems();
    container.innerHTML = this._view();
    this._bind(container);
  },

  _view() {
    const active = this.items.filter(i => i.status === 'active');
    const done = this.items.filter(i => i.status === 'done');

    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
        <button class="btn btn-primary" id="note-add-btn">+ 新记录</button>
      </div>
      ${active.length === 0 && done.length === 0 ? `
        <div class="empty-state">
          <p>还没有记录</p>
          <p style="font-size:12px;margin-top:8px;">记下想做的事、想看的书、一闪而过的念头</p>
        </div>
      ` : ''}
      ${NOTE_ORDER.map(tag => {
        const items = active.filter(i => i.tag === tag);
        if (items.length === 0) return '';
        const t = NOTE_TAGS[tag];
        return `
          <div style="margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
              <span class="note-tag ${t.cls}" style="font-size:11px;">${t.label}</span>
              <span style="font-size:13px;font-weight:600;color:var(--text);">${items.length}</span>
            </div>
            <div class="card-stagger">${items.map(i => this._itemCard(i)).join('')}</div>
          </div>
        `;
      }).join('')}
      ${done.length > 0 ? `
        <details style="margin-top:8px;" id="note-done-details">
          <summary style="cursor:pointer;font-size:13px;color:var(--text2);padding:8px 0;user-select:none;">
            已完成（${done.length}）
          </summary>
          <div style="margin-top:4px;">${done.map(i => this._itemCard(i)).join('')}</div>
        </details>
      ` : ''}
    `;
  },

  _itemCard(item) {
    const t = NOTE_TAGS[item.tag];
    const done = item.status === 'done';
    return `
      <div class="card note-item ${done ? 'note-item--done' : ''}" data-id="${item.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <span class="note-tag ${t.cls}">${t.label}</span>
            </div>
            <div style="font-size:15px;font-weight:600;word-break:break-word;">${this._esc(item.title)}</div>
            ${item.note ? `<div style="font-size:13px;color:var(--text2);margin-top:3px;line-height:1.5;word-break:break-word;">${this._esc(item.note)}</div>` : ''}
            ${done && item.review ? `
              <div style="margin-top:6px;padding:6px 10px;border-radius:var(--radius-xs);background:var(--surface2);font-size:12px;color:var(--text);line-height:1.5;border:1px solid var(--border);">
                <span style="color:var(--text3);font-weight:600;">✎ 感想</span><br>${this._esc(item.review)}
              </div>
            ` : ''}
            ${done && item.doneAt ? `
              <div style="font-size:11px;color:var(--text3);margin-top:4px;">✓ ${item.doneAt}</div>
            ` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
          ${done ? `
            <button class="btn btn-sm btn-outline note-delete-btn" style="margin-left:auto;">删除</button>
          ` : `
            <button class="btn btn-sm btn-primary note-done-btn">✓ 完成</button>
            <button class="btn btn-sm btn-outline note-delete-btn" style="margin-left:auto;">删除</button>
          `}
        </div>
      </div>
    `;
  },

  _bind(container) {
    container.querySelector('#note-add-btn')?.addEventListener('click', () => this._showAddModal());
    container.querySelectorAll('.note-done-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.note-item').dataset.id;
        this._markDone(id);
      });
    });
    container.querySelectorAll('.note-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.note-item').dataset.id;
        this._deleteItem(id);
      });
    });
  },

  _showAddModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>新记录</h2>
        <div class="form-group">
          <label>标题</label>
          <input id="note-title" placeholder="想做什么？想看什么？" autofocus>
        </div>
        <div class="form-group">
          <label>备注（可选）</label>
          <textarea id="note-note" placeholder="补充信息..." rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>分类</label>
          <div style="display:flex;gap:8px;" id="note-tag-picker">
            ${NOTE_ORDER.map(tag => {
              const t = NOTE_TAGS[tag];
              return `<button class="btn btn-sm btn-outline note-tag-opt" data-tag="${tag}">${t.label}</button>`;
            }).join('')}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="note-add-cancel">取消</button>
          <button class="btn btn-primary" id="note-add-confirm" disabled>添加</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let selectedTag = null;

    overlay.querySelectorAll('.note-tag-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.note-tag-opt').forEach(b => b.classList.remove('btn-primary'));
        overlay.querySelectorAll('.note-tag-opt').forEach(b => b.classList.remove('btn-outline'));
        btn.classList.add('btn-primary');
        selectedTag = btn.dataset.tag;
        const title = overlay.querySelector('#note-title').value.trim();
        overlay.querySelector('#note-add-confirm').disabled = !(title && selectedTag);
      });
    });

    overlay.querySelector('#note-title').addEventListener('input', () => {
      const title = overlay.querySelector('#note-title').value.trim();
      overlay.querySelector('#note-add-confirm').disabled = !(title && selectedTag);
    });

    overlay.querySelector('#note-add-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#note-add-confirm').addEventListener('click', () => {
      const title = overlay.querySelector('#note-title').value.trim();
      const note = overlay.querySelector('#note-note').value.trim();
      if (!title || !selectedTag) { this._toast('请填写标题并选择分类'); return; }
      this.items.push({
        id: Store.genId(),
        title,
        note,
        tag: selectedTag,
        status: 'active',
        review: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        doneAt: null,
      });
      Store.saveNoteItems(this.items);
      overlay.remove();
      this.render(document.getElementById('content'));
    });
  },

  _markDone(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>✓ ${this._esc(item.title)}</h2>
        <p style="font-size:13px;color:var(--text2);margin-bottom:12px;">看完/做完了？有什么想记下来的吗（可选）</p>
        <div class="form-group">
          <textarea id="note-review" placeholder="观后感、完成感想..." rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="note-done-skip">跳过</button>
          <button class="btn btn-primary" id="note-done-confirm">保存感想</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#note-done-skip').addEventListener('click', () => {
      item.status = 'done';
      item.review = '';
      item.doneAt = Store.today();
      item.updatedAt = new Date().toISOString();
      Store.saveNoteItems(this.items);
      overlay.remove();
      this.render(document.getElementById('content'));
    });
    overlay.querySelector('#note-done-confirm').addEventListener('click', () => {
      const review = overlay.querySelector('#note-review').value.trim();
      item.status = 'done';
      item.review = review;
      item.doneAt = Store.today();
      item.updatedAt = new Date().toISOString();
      Store.saveNoteItems(this.items);
      overlay.remove();
      this.render(document.getElementById('content'));
    });
  },

  _deleteItem(id) {
    if (!confirm('确定删除这条记录吗？')) return;
    this.items = this.items.filter(i => i.id !== id);
    Store.saveNoteItems(this.items);
    this.render(document.getElementById('content'));
  },

  _toast(msg) { Toast.show(msg); },

  _esc(s) {
    if (s === null || s === undefined) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
};
