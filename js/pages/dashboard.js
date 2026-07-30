const Dashboard = {
  render(container) {
    const wishes = Store.getWishItems();
    const expenses = Store.getExpenses ? Store.getExpenses() : [];
    const events = Store.getCountdownEvents();
    const active = wishes.filter(item => item.status === 'active');
    const ready = active.filter(item => Number(item.currentProgress) >= Number(item.price));
    const totalAccumulated = DailyDomain.accumulatedAmount(wishes, expenses);
    const today = Store.today();
    const upcoming = events.map(event => ({ ...event, diff: Math.round((new Date(`${event.date}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000) })).filter(event => event.diff >= 0).sort((a, b) => a.diff - b.diff).slice(0, 3);

    container.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px;"><button class="btn btn-sm btn-outline" id="dashboard-settings-btn">设置</button></div>
      <div class="stat-grid stat-enter" style="grid-template-columns:1fr 1fr;margin-bottom:16px;">
        <div class="stat-card"><div class="stat-number">${active.length}</div><div class="stat-label">进行中 · 清单</div></div>
        <div class="stat-card"><div class="stat-number" style="color:var(--sheikah);">¥${totalAccumulated.toFixed(1)}</div><div class="stat-label">已累积</div></div>
      </div>
      ${ready.length ? `<div class="card" style="border-color:var(--gold);"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:14px;font-weight:600;">🎯 ${ready.length} 个物品已达目标</span><a href="#/wish" style="color:var(--sheikah);font-size:13px;text-decoration:none;">去看看 →</a></div></div>` : ''}
      ${upcoming.length ? `<div class="card"><div class="card-title">⏰ 即将到来</div>${upcoming.map(event => `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid var(--border);"><span>${event.type === 'reminder' ? '⚠ ' : '★ '}${this._esc(event.title)}</span><span style="color:${event.diff <= 7 ? 'var(--gold)' : 'var(--sheikah)'};font-weight:600;">${event.diff} 天</span></div>`).join('')}</div>` : ''}`;
    container.querySelector('#dashboard-settings-btn').onclick = () => this._showSettingsModal();
  },

  _showSettingsModal() {
    const modal = Modal.open({ title: '设置', body: `<h2>设置</h2><button class="btn btn-outline btn-block" id="settings-export">📤 导出数据</button><button class="btn btn-outline btn-block" id="settings-import" style="margin-top:8px;">📥 导入数据</button><button class="btn btn-danger btn-block" id="settings-clear" style="margin-top:8px;">清除全部本地数据</button><p style="font-size:11px;color:var(--text3);margin-top:12px;text-align:center;">iOS Safari 与桌面 PWA 数据独立，切换设备请先导出再导入</p>` });
    modal.modalEl.querySelector('#settings-export').onclick = () => { const blob = new Blob([JSON.stringify(Store.exportAll(), null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `daily-backup-${Store.today()}.json`; link.click(); URL.revokeObjectURL(link.href); };
    modal.modalEl.querySelector('#settings-import').onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = event => { const reader = new FileReader(); reader.onload = result => { try { if (!Store.importAll(JSON.parse(result.target.result))) throw new Error('invalid'); modal.close(); App.route(); Toast.show('导入成功'); } catch (_) { Toast.show('导入失败：文件格式无效'); } }; reader.readAsText(event.target.files[0]); }; input.click(); };
    modal.modalEl.querySelector('#settings-clear').onclick = () => { if (!confirm('确定清除全部本地数据吗？此操作不可恢复。')) return; Store.clearAll(); modal.close(); App.route(); Toast.show('已清除'); };
  },
  _esc(value) { const node = document.createElement('div'); node.textContent = value || ''; return node.innerHTML; },
};
