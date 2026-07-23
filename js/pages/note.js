const Note = {
  items: [],
  render(container) {
    this.items = Store.getCandidateItems();
    const active = this.items.filter(item => ['active', 'in_progress', 'snoozed'].includes(item.status));
    const archived = this.items.filter(item => ['done', 'archived'].includes(item.status));
    const llmEnabled = sessionStorage.getItem('daily_llm_enabled') === 'true';
    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;"><button class="btn btn-primary" id="note-add-btn">+ 记一下</button><button class="btn btn-outline choice-button" id="note-llm-toggle" aria-pressed="${llmEnabled}">LLM ${llmEnabled ? '已开启' : '已关闭'}</button></div>
      ${active.length ? `<div class="card-stagger">${active.map(item => this._card(item)).join('')}</div>` : '<div class="empty-state"><p>还没有候选事项</p><p>只写标题即可，其他信息稍后再补。</p></div>'}
      ${archived.length ? `<details><summary>已完成或归档（${archived.length}）</summary>${archived.map(item => this._card(item)).join('')}</details>` : ''}`;
    container.querySelector('#note-add-btn').onclick = () => this._add();
    container.querySelector('#note-llm-toggle').onclick = () => { const next = !(sessionStorage.getItem('daily_llm_enabled') === 'true'); sessionStorage.setItem('daily_llm_enabled', String(next)); Toast.show(next ? 'LLM 标注已开启' : 'LLM 标注已关闭'); this.render(container); };
    container.querySelectorAll('[data-done]').forEach(button => button.onclick = () => this._update(button.dataset.done, 'done'));
    container.querySelectorAll('[data-archive]').forEach(button => button.onclick = () => this._update(button.dataset.archive, 'archived'));
    container.querySelectorAll('[data-classify]').forEach(button => button.onclick = () => this._classify(button.dataset.classify));
  },
  _card(item) {
    const labels = { task: '要做的事', book: '书', movie: '电影', series: '剧集', idea: '想法', media: '书影音（待确认）' };
    const modes = { continuous: '适合一次完成', segmentable: '可以分段', flexible: '随时可停' };
    const source = item.inferenceSource === 'llm' ? 'DeepSeek 标注' : item.inferenceSource === 'user' ? '手动确认' : '本地标注';
    return `<div class="card note-item" data-id="${item.id}"><span class="badge badge-active">${labels[item.type] || '事项'}</span><div style="font-size:16px;font-weight:600;margin-top:8px;">${this._esc(item.title)}</div>${item.note ? `<p style="color:var(--text2);margin-top:4px;">${this._esc(item.note)}</p>` : ''}<p style="font-size:12px;color:var(--text2);margin-top:8px;">${modes[item.sessionMode]} · 最短 ${item.minSessionMinutes} 分钟 · ${source}</p>${item.type === 'media' ? `<button class="btn btn-sm btn-outline" data-classify="${item.id}">确认是书 / 影 / 剧</button>` : ''}${item.status === 'done' || item.status === 'archived' ? '' : `<div style="display:flex;gap:8px;margin-top:10px;"><button class="btn btn-sm btn-primary" data-done="${item.id}">完成</button><button class="btn btn-sm btn-outline" data-archive="${item.id}">归档</button></div>`}</div>`;
  },
  _classify(id) {
    const item = this.items.find(value => value.id === id);
    if (!item) return;
    const labels = { book: '书', movie: '影', series: '剧' };
    const modal = Modal.open({ title: '确认类型', body: `<p style="color:var(--text2);">旧数据无法可靠判断是影片还是剧集，请确认一次。</p><div style="display:flex;gap:8px;">${Object.entries(labels).map(([type, label]) => `<button class="btn btn-outline" data-type="${type}">${label}</button>`).join('')}</div>` });
    modal.overlay.querySelectorAll('[data-type]').forEach(button => button.onclick = () => {
      const updated = DailyDomain.inferCandidate({ ...item, type: button.dataset.type, inferenceSource: 'user', updatedAt: new Date().toISOString() });
      this.items = this.items.map(value => value.id === id ? updated : value);
      Store.saveCandidateItems(this.items);
      modal.close();
      this.render(document.getElementById('content'));
    });
  },
  _add() {
    const types = { task: '事', book: '书', movie: '影', series: '剧', idea: '想法' };
    const llmEnabled = sessionStorage.getItem('daily_llm_enabled') === 'true';
    const modal = Modal.open({ title: '记一下', body: `<h2>记一下</h2><div class="form-group"><label>标题</label><input id="candidate-title" placeholder="想做、想读、想看……"></div><div class="form-group"><label>类型</label><div style="display:flex;gap:6px;flex-wrap:wrap;">${Object.entries(types).map(([type,label], index) => `<button type="button" class="btn btn-sm btn-outline choice-button" aria-pressed="${index === 0}" data-candidate-type="${type}">${label}</button>`).join('')}</div></div><details><summary style="cursor:pointer;color:var(--text2);">添加备忘（可选）</summary><textarea id="candidate-note" style="margin-top:8px;" placeholder="补充一点上下文"></textarea></details><p style="font-size:11px;color:var(--text3);margin-top:10px;">${llmEnabled ? (sessionStorage.getItem('daily_deepseek_key') ? '保存时会把本条标题、类别和备注发送给 DeepSeek 标注；失败时自动使用本地规则。' : 'LLM 已开启，但尚未在个性化中设置 Key，将使用本地规则。') : 'LLM 已关闭，使用本地规则。'}</p><div class="modal-actions"><button class="btn btn-outline" id="candidate-cancel">取消</button><button class="btn btn-primary" id="candidate-save">保存</button></div>` });
    let selectedType = 'task';
    modal.overlay.querySelectorAll('[data-candidate-type]').forEach(button => button.onclick = () => { selectedType = button.dataset.candidateType; modal.overlay.querySelectorAll('[data-candidate-type]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); });
    modal.overlay.querySelector('#candidate-cancel').onclick = modal.close;
    modal.overlay.querySelector('#candidate-save').onclick = async () => {
      const title = modal.overlay.querySelector('#candidate-title').value.trim();
      if (!title) { Toast.show('标题不能为空'); return; }
      const input = { id: Store.genId(), title, note: modal.overlay.querySelector('#candidate-note').value.trim(), type: selectedType };
      let item = DailyDomain.inferCandidate(input);
      const apiKey = sessionStorage.getItem('daily_deepseek_key');
      if (llmEnabled && apiKey) {
        try { item = await new DailyDomain.DeepSeekInferenceProvider(apiKey).infer(input); Toast.show('DeepSeek 标注成功'); }
        catch (error) { Toast.show(`${error.message || '网络请求失败'}，已使用本地规则`, 5000); }
      }
      this.items.push(item); Store.saveCandidateItems(this.items); modal.close(); this.render(document.getElementById('content'));
    };
  },
  _update(id, status) { const item = this.items.find(value => value.id === id); if (!item) return; item.status = status; item.updatedAt = new Date().toISOString(); Store.saveCandidateItems(this.items); Store.addRecommendationEvent(status === 'archived' ? 'archived' : 'completed', id, { source: 'candidate-list' }); this.render(document.getElementById('content')); },
  _esc(value) { const element = document.createElement('div'); element.textContent = value || ''; return element.innerHTML; },
};
