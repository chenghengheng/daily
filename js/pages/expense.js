const Expense = {
  items: [],
  categories: { drink: '饮料', snack: '零食', dining: '外食', entertainment: '娱乐', game_merch: '游戏与周边', other: '其他' },
  render(container) {
    this.items = Store.getExpenses();
    const month = Store.today().slice(0, 7);
    const current = this.items.filter(item => !item.deletedAt && item.occurredOn.startsWith(month));
    const deleted = this.items.filter(item => item.deletedAt).sort((a,b) => b.deletedAt.localeCompare(a.deletedAt));
    const total = current.reduce((sum, item) => sum + item.amount, 0);
    const summary = Object.entries(this.categories).map(([key, label]) => ({ label, value: current.filter(item => item.category === key).reduce((sum, item) => sum + item.amount, 0) })).filter(item => item.value > 0);
    container.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:16px;"><button class="btn btn-primary" id="expense-add">+ 随手花</button>${deleted.length ? '<button class="btn btn-outline" id="expense-undo">撤销上次删除</button>' : ''}</div><div class="card"><div class="card-title">本月非必要消费</div><div class="stat-number">¥${total.toFixed(2)}</div><p style="font-size:12px;color:var(--text2);margin-top:8px;">${summary.map(item => `${item.label} ¥${item.value.toFixed(2)}`).join(' · ') || '本月还没有记录'}</p></div><div class="card-stagger">${current.sort((a,b) => b.occurredOn.localeCompare(a.occurredOn)).map(item => `<div class="card" data-id="${item.id}"><div style="display:flex;justify-content:space-between;gap:8px;"><div><strong>¥${item.amount.toFixed(2)}</strong> <span class="badge badge-active">${this.categories[item.category]}</span><p style="font-size:12px;color:var(--text2);margin-top:4px;">${item.source === 'wish' ? '计划型' : '即时型'} · ${item.occurredOn}${item.note ? ` · ${this._esc(item.note)}` : ''}</p></div>${item.source === 'quick' ? `<div><button class="btn btn-sm btn-outline" data-edit="${item.id}">编辑</button><button class="btn btn-sm btn-outline" data-delete="${item.id}">删除</button></div>` : ''}</div></div>`).join('')}</div>`;
    container.querySelector('#expense-add').onclick = () => this._add();
    container.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => this._edit(button.dataset.edit));
    container.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => { const item = this.items.find(value => value.id === button.dataset.delete); if (!item) return; this.items = this.items.filter(item => !item.deletedAt); item.deletedAt = new Date().toISOString(); item.updatedAt = item.deletedAt; Store.saveExpenses(this.items); this.render(container); Toast.show('已删除，可撤销最近一次删除'); });
    container.querySelector('#expense-undo')?.addEventListener('click', () => { delete deleted[0].deletedAt; deleted[0].updatedAt = new Date().toISOString(); Store.saveExpenses(this.items); this.render(container); });
  },
  _edit(id) {
    const item = this.items.find(value => value.id === id); if (!item) return;
    const amount = Number(prompt('金额', String(item.amount))); if (!Number.isFinite(amount) || amount <= 0) return;
    const note = prompt('备注（可留空）', item.note || ''); if (note === null) return;
    item.amount = amount; item.note = note.trim(); item.updatedAt = new Date().toISOString(); Store.saveExpenses(this.items); this.render(document.getElementById('content'));
  },
  _add() {
    const options = Object.entries(this.categories).map(([key,label], index) => `<button type="button" class="btn btn-sm btn-outline choice-button" aria-pressed="${index === 0}" data-category="${key}">${label}</button>`).join('');
    const modal = Modal.open({ title: '随手花', body: `<h2>随手花</h2><div class="form-group"><label>金额</label><input id="expense-amount" type="number" inputmode="decimal" min="0.01" step="0.01" autofocus></div><div class="form-group"><label>分类</label><div style="display:flex;gap:6px;flex-wrap:wrap;">${options}</div></div><div class="form-group"><label>日期</label><input id="expense-date" type="date" value="${Store.today()}"></div><div class="form-group"><label>备注（可选）</label><input id="expense-note"></div><div class="modal-actions"><button class="btn btn-outline" id="expense-cancel">取消</button><button class="btn btn-primary" id="expense-save">保存</button></div>` });
    let category = 'drink';
    modal.overlay.querySelectorAll('[data-category]').forEach(button => button.onclick = () => { category = button.dataset.category; modal.overlay.querySelectorAll('[data-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); });
    modal.overlay.querySelector('#expense-cancel').onclick = modal.close;
    modal.overlay.querySelector('#expense-save').onclick = () => { const amount = Number(modal.overlay.querySelector('#expense-amount').value); if (!Number.isFinite(amount) || amount <= 0) { Toast.show('请输入有效金额'); return; } const now = new Date().toISOString(); this.items.push({ id: Store.genId(), amount, category, source: 'quick', note: modal.overlay.querySelector('#expense-note').value.trim(), occurredOn: modal.overlay.querySelector('#expense-date').value || Store.today(), createdAt: now, updatedAt: now }); Store.saveExpenses(this.items); modal.close(); this.render(document.getElementById('content')); };
  },
  _esc(value) { const element = document.createElement('div'); element.textContent = value || ''; return element.innerHTML; },
};
