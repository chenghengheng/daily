const Note = {
  items: [],
  render(container) {
    this.items = Store.getCandidateItems();
    const active = this.items.filter(item => ['active', 'in_progress', 'snoozed'].includes(item.status));
    const archived = this.items.filter(item => ['done', 'archived'].includes(item.status));
    container.innerHTML = `
      <button class="btn btn-primary" id="note-add-btn" style="margin-bottom:16px;">+ 记一下</button>
      ${active.length ? `<div class="card-stagger">${active.map(item => this._card(item)).join('')}</div>` : '<div class="empty-state"><p>还没有候选事项</p><p>只写标题即可，其他信息稍后再补。</p></div>'}
      ${archived.length ? `<details><summary>已完成或归档（${archived.length}）</summary>${archived.map(item => this._card(item)).join('')}</details>` : ''}`;
    container.querySelector('#note-add-btn').onclick = () => this._add();
    container.querySelectorAll('[data-done]').forEach(button => button.onclick = () => this._update(button.dataset.done, 'done'));
    container.querySelectorAll('[data-archive]').forEach(button => button.onclick = () => this._update(button.dataset.archive, 'archived'));
  },
  _card(item) {
    const labels = { task: '要做的事', book: '书', movie: '电影', series: '剧集', idea: '想法' };
    const modes = { continuous: '适合一次完成', segmentable: '可以分段', flexible: '随时可停' };
    return `<div class="card note-item" data-id="${item.id}"><span class="badge badge-active">${labels[item.type] || '事项'}</span><div style="font-size:16px;font-weight:600;margin-top:8px;">${this._esc(item.title)}</div>${item.note ? `<p style="color:var(--text2);margin-top:4px;">${this._esc(item.note)}</p>` : ''}<p style="font-size:12px;color:var(--text2);margin-top:8px;">${modes[item.sessionMode]} · 最短 ${item.minSessionMinutes} 分钟</p>${item.status === 'done' || item.status === 'archived' ? '' : `<div style="display:flex;gap:8px;margin-top:10px;"><button class="btn btn-sm btn-primary" data-done="${item.id}">完成</button><button class="btn btn-sm btn-outline" data-archive="${item.id}">归档</button></div>`}</div>`;
  },
  _add() {
    const modal = Modal.open({ title: '记一下', body: `<h2>记一下</h2><div class="form-group"><label>标题</label><input id="candidate-title" placeholder="想做、想读、想看……"></div><details><summary style="cursor:pointer;color:var(--text2);">添加备忘（可选）</summary><textarea id="candidate-note" style="margin-top:8px;" placeholder="补充一点上下文"></textarea></details><div class="modal-actions"><button class="btn btn-outline" id="candidate-cancel">取消</button><button class="btn btn-primary" id="candidate-save">保存</button></div>` });
    modal.overlay.querySelector('#candidate-cancel').onclick = modal.close;
    modal.overlay.querySelector('#candidate-save').onclick = () => {
      const title = modal.overlay.querySelector('#candidate-title').value.trim();
      if (!title) { Toast.show('标题不能为空'); return; }
      const item = DailyDomain.inferCandidate({ id: Store.genId(), title, note: modal.overlay.querySelector('#candidate-note').value.trim() });
      this.items.push(item); Store.saveCandidateItems(this.items); modal.close(); this.render(document.getElementById('content'));
    };
  },
  _update(id, status) { const item = this.items.find(value => value.id === id); if (!item) return; item.status = status; item.updatedAt = new Date().toISOString(); Store.saveCandidateItems(this.items); Store.addRecommendationEvent(status === 'archived' ? 'archived' : 'completed', id, { source: 'candidate-list' }); this.render(document.getElementById('content')); },
  _esc(value) { const element = document.createElement('div'); element.textContent = value || ''; return element.innerHTML; },
};
