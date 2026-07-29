const Dashboard = {
  render(container) {
    const wishItems = Store.getWishItems();
    const events = Store.getCountdownEvents();
    const config = Store.getConfig();
    const studyEnabled = config.features.studyEnabled;
    const activeTimer = Store.getTimer();
    const timerItem = activeTimer ? Store.getCandidateItems().find(item => item.id === activeTimer.candidateId) : null;
    const activeWish = wishItems.filter(i => i.status === 'active');
    const wishReady = activeWish.filter(i => i.currentProgress >= i.price).length;
    const expenses = Store.getExpenses();
    const waitingProgress = activeWish.reduce((sum, item) => sum + item.currentProgress, 0);
    const month = Store.today().slice(0, 7);
    const monthlyExpenses = expenses.filter(item => !item.deletedAt && item.occurredOn?.startsWith(month));
    const quickSpend = monthlyExpenses.filter(item => item.source !== 'wish').reduce((sum, item) => sum + item.amount, 0);
    const plannedSpend = monthlyExpenses.filter(item => item.source === 'wish').reduce((sum, item) => sum + item.amount, 0);

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
      ${upcoming.length > 0 ? `
        <div class="card"><div class="card-title">需要注意</div>${upcoming.map(ev => `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span>${this._esc(ev.title)}</span><span style="color:var(--gold);">${ev.diff === 0 ? '今天' : `${ev.diff} 天后`}</span></div>`).join('')}</div>
      ` : ''}
      ${activeTimer ? `
        <div class="card" style="border-color:var(--sheikah);">
          <div class="card-title">计时仍在进行</div>
          <p style="font-size:14px;">${timerItem ? this._esc(timerItem.title) : '原事项已不存在'}</p>
          <div style="display:flex;gap:8px;margin-top:10px;">
            ${timerItem ? '<button class="btn btn-primary btn-sm" id="timer-resume">继续查看</button>' : ''}
            <button class="btn btn-outline btn-sm" id="timer-discard">结束计时</button>
          </div>
        </div>
      ` : ''}
      <div class="card">
        <div class="card-title">我现在有空</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;" id="free-time-options">
          ${[10,20,45,60,120].map(minutes => `<button class="btn btn-sm btn-outline" data-minutes="${minutes}">${minutes < 60 ? `${minutes}分钟` : `${minutes / 60}小时`}</button>`).join('')}
          <button class="btn btn-sm btn-outline" data-minutes="custom">自定义</button>
        </div>
      </div>
      <div class="stat-grid stat-enter" style="margin-bottom:16px;">
        <a href="#/expense" class="stat-card" style="text-decoration:none;color:inherit;"><div class="stat-number">¥${(quickSpend + plannedSpend).toFixed(1)}</div><div class="stat-label">本月非必要消费</div><div style="font-size:10px;color:var(--text3);margin-top:4px;">即时 ¥${quickSpend.toFixed(1)} · 计划 ¥${plannedSpend.toFixed(1)}</div></a>
        <a href="#/wish" class="stat-card" style="text-decoration:none;color:inherit;"><div class="stat-number">¥${waitingProgress.toFixed(1)}</div><div class="stat-label">等待进度 · ${activeWish.length} 项</div><div style="font-size:10px;color:var(--text3);margin-top:4px;">不是余额或存款</div></a>
      </div>

      ${wishReady > 0 ? `
        <div class="card" style="border-color:var(--gold);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:14px;font-weight:600;">🎯 ${wishReady} 个物品已达目标</span>
            <a href="#/wish" style="color:var(--sheikah);font-size:13px;text-decoration:none;">去看看 →</a>
          </div>
        </div>
      ` : ''}

      <div class="card-stagger" style="display:grid;grid-template-columns:1fr;gap:8px;">
        <a href="#/wish" class="card card-link" hidden style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 42 51" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path d="M39.587 23.468H38.208V17.172C38.208 12.421 36.254 8.128 33.152 5.037C29.992 1.946 25.683 0 20.971 0C11.434 0 3.735 7.67 3.735 17.172V23.468H2.356C1.092 23.468 0 24.498 0 25.815V48.653C0 49.913 1.034 51 2.356 51H39.644C40.966 51 42 49.97 42 48.653V25.815C41.943 24.498 40.851 23.468 39.587 23.468ZM20.856 45.791C16.088 45.791 12.238 41.956 12.238 37.205C12.238 32.455 16.088 28.62 20.856 28.62C25.625 28.62 29.475 32.455 29.475 37.205C29.475 41.956 25.625 45.791 20.856 45.791ZM29.59 23.468H12.353V16.027C12.353 11.276 16.203 7.441 20.971 7.441C25.74 7.441 29.59 11.276 29.59 16.027V23.468ZM24.304 34.916C24.304 36.175 23.614 37.32 22.58 37.892V42.929H19.133V37.892C18.099 37.32 17.409 36.175 17.409 34.916C17.409 33.027 18.96 31.482 20.856 31.482C22.752 31.482 24.304 33.027 24.304 34.916Z"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">清单</div>
        </a>
        ${studyEnabled ? `<a href="#/study" class="card card-link" style="text-align:center;padding:20px;">
          <svg width="22" height="22" viewBox="0 0 77 45.2" fill="currentColor" style="display:block;margin:0 auto;color:var(--sheikah);"><path d="M38.512 0L32.5925 8.943H44.3963L38.512 0"/><path d="M26.7084 17.8509L32.5926 8.943L38.5122 17.8509H26.7084Z"/><path d="M38.5122 17.8509H50.3513L44.3965 8.943L38.5122 17.8509Z"/><path d="M0 2.765L2.89 11.445L23.02 14.47V16.603L4.933 18.587L8.521 25.58L23.52 19.976L24.467 21.811L13.006 30.44L17.939 33.912L26.31 24.638L27.606 25.878L23.52 35.549L28.453 36.541L30.197 27.713C31.749 27.923 34.028 27.713 33.967 25.58C33.937 24.541 33.45 23.267 31.648 22.713C23.875 20.326 25.463 10.651 27.905 6.634C24.986 8.943 24.779 10.109 23.968 11.197C22.635 10.843 0 2.765 0 2.765Z"/><path d="M77 2.765L74.11 11.445L53.978 14.47V16.603L72.067 18.587L68.479 25.58L53.48 19.976L52.533 21.811L63.994 30.44L59.061 33.912L50.69 24.638L49.394 25.878L53.48 35.549L48.547 36.541L46.803 27.713C45.251 27.923 42.972 27.713 43.033 25.58C43.063 24.541 43.55 23.267 45.352 22.713C53.125 20.326 51.537 10.651 49.095 6.634C52.014 8.943 52.221 10.109 53.032 11.197C54.365 10.843 77 2.765 77 2.765Z"/><path d="M38.512 20.604C38.459 21.656 37.049 24.251 36.679 24.638C36.382 24.948 35.974 25.58 35.146 27.713C34.318 29.845 34.66 29.946 32.944 31.195C40.002 34.425 35.974 37.702 35.974 38.456C36.858 40.68 38.512 45.171 38.512 45.171C38.512 45.171 40.164 40.68 41.047 38.456C41.047 37.702 37.02 34.425 44.078 31.195C42.362 29.946 42.704 29.845 41.876 27.713C41.048 25.58 40.64 24.948 40.343 24.638C39.973 24.251 38.565 21.656 38.512 20.604Z"/></svg>
          <div style="font-size:13px;margin-top:8px;color:var(--text);">学习</div>
        </a>` : ''}
        <a href="#/countdown" class="card card-link" hidden style="text-align:center;padding:20px;">
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
    container.querySelector('#timer-resume')?.addEventListener('click', () => this._startTimer(timerItem, activeTimer.plannedMinutes, activeTimer.startedAt));
    container.querySelector('#timer-discard')?.addEventListener('click', () => { Store.saveTimer(null); this.render(container); });
    container.querySelectorAll('.card-stagger > a[href="#/wish"], .card-stagger > a[href="#/countdown"], .card-stagger > a[href="#/study"]').forEach(element => element.remove());
    container.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => {
      let minutes = button.dataset.minutes === 'custom' ? Number(prompt('现在有多少分钟？', '30')) : Number(button.dataset.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0) return;
      this._recommend(minutes);
    }));
  },

  _recommend(minutes, excludedIds = []) {
    const items = Store.getCandidateItems();
    const events = Store.getRecommendationEvents();
    const item = DailyDomain.recommend(items, minutes, events, Math.random, { excludedIds });
    if (!item) { Toast.show('这个时长暂时没有合适事项，可以先记下一件想做的事'); return; }
    Store.addRecommendationEvent('suggested', item.id, { availableMinutes: minutes });
    const typeLabels = { task: '事', book: '书', movie: '影', series: '剧', idea: '想法', media: '书影音（待确认）' };
    const reason = DailyDomain.explainRecommendation(item, minutes, events);
    const modal = Modal.open({ title: '现在可以做', body: `<span class="badge badge-active">${typeLabels[item.type] || '事项'}</span><h2 style="margin-top:8px;">${this._esc(item.title)}</h2><p style="color:var(--text2);">${this._esc(reason)}</p><div class="modal-actions"><button class="btn btn-outline" id="recommend-snooze">现在不适合</button><button class="btn btn-outline" id="recommend-switch">换一个</button><button class="btn btn-primary" id="recommend-start">开始</button></div>` });
    modal.overlay.querySelector('#recommend-switch').onclick = () => { Store.addRecommendationEvent('switched', item.id, { availableMinutes: minutes }); modal.close(); setTimeout(() => this._recommend(minutes, [...excludedIds, item.id]), 180); };
    modal.overlay.querySelector('#recommend-snooze').onclick = () => { Store.addRecommendationEvent('snoozed', item.id, { until: Store.today(), availableMinutes: minutes }); modal.close(); };
    modal.overlay.querySelector('#recommend-start').onclick = () => { Store.addRecommendationEvent('started', item.id, { plannedMinutes: minutes }); modal.close(); this._startTimer(item, minutes); };
  },

  _startTimer(item, minutes, persistedStartedAt = null) {
    const parsedStartedAt = persistedStartedAt ? Date.parse(persistedStartedAt) : NaN;
    const startedAt = Number.isFinite(parsedStartedAt) ? parsedStartedAt : Date.now();
    Store.saveTimer({ candidateId: item.id, plannedMinutes: minutes, startedAt: new Date(startedAt).toISOString() });
    let interval;
    const modal = Modal.open({ title: '计时中', body: `<h2>${this._esc(item.title)}</h2><div class="stat-number" id="session-clock">00:00</div><div class="modal-actions"><button class="btn btn-outline" id="session-stop">结束本次</button></div>`, onClose: () => { if (interval) clearInterval(interval); } });
    const clock = modal.overlay.querySelector('#session-clock');
    const updateClock = () => { const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000)); clock.textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; };
    updateClock();
    interval = setInterval(updateClock, 1000);
    modal.overlay.querySelector('#session-stop').onclick = () => { clearInterval(interval); Store.saveTimer(null); const actual = Math.max(1, Math.round((Date.now() - startedAt) / 60000)); if (actual < minutes) Store.addRecommendationEvent('stopped_early', item.id, { plannedMinutes: minutes, actualMinutes: actual }); modal.close(); setTimeout(() => this._finishSession(item, minutes, actual, new Date(startedAt).toISOString()), 180); };
  },

  _finishSession(item, plannedMinutes, actualMinutes, startedAt) {
    const completedLabels = { movie: '看完了', series: '看完本剧', book: '读完了', task: '做完了', idea: '处理好了' };
    const partialLabels = { movie: '还没看完', series: '看了一段', book: '读了一会', task: '做到一部分', idea: '记录了一点' };
    const modal = Modal.open({ title: '这次怎么样？', body: `<h2>这次怎么样？</h2><div style="display:grid;gap:8px;"><button class="btn btn-primary" data-result="completed">${completedLabels[item.type] || '完成了'}</button><button class="btn btn-outline" data-result="partial">${partialLabels[item.type] || '做到一部分'}</button><button class="btn btn-outline" data-result="continue">还要继续</button><button class="btn btn-outline" data-result="mismatch">时长不准</button></div>` });
    modal.overlay.querySelectorAll('[data-result]').forEach(button => button.onclick = () => {
      const result = button.dataset.result;
      Store.addRecommendationEvent(result === 'completed' ? 'completed' : result === 'mismatch' ? 'time_mismatch' : 'started', item.id, { plannedMinutes, actualMinutes });
      if (['completed', 'partial', 'continue', 'mismatch'].includes(result)) {
        const saved = Store.recordExperience(item.id, { outcome: result === 'completed' ? 'completed' : 'partial', plannedMinutes, actualMinutes, startedAt });
        if (!saved.ok) { Toast.show(saved.error || '投入记录保存失败'); return; }
      }
      modal.close();
      if (result === 'mismatch') setTimeout(() => this._calibrateDuration(item), 180);
      if (result === 'continue') setTimeout(() => this._startTimer(item, plannedMinutes), 180);
      if (result === 'completed' || result === 'partial') setTimeout(() => App.route(), 180);
    });
  },

  _calibrateDuration(item) {
    const modal = Modal.open({ title: '更适合多长时间？', body: '<h2>更适合多长时间？</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><button class="btn btn-outline" data-min="15">更短</button><button class="btn btn-outline" data-min="60">约1小时</button><button class="btn btn-outline" data-min="120">约2小时</button><button class="btn btn-outline" data-mode="continuous">需要一次完成</button></div>' });
    const save = button => { const items = Store.getCandidateItems(); const current = items.find(value => value.id === item.id); if (current) { if (button.dataset.min) { current.minSessionMinutes = Number(button.dataset.min); current.estimatedMinutes = Number(button.dataset.min); } if (button.dataset.mode) current.sessionMode = button.dataset.mode; current.inferenceSource = 'user'; current.updatedAt = new Date().toISOString(); Store.saveCandidateItems(items); } modal.close(); Toast.show('已更新事项时长'); };
    modal.overlay.querySelectorAll('[data-min],[data-mode]').forEach(button => button.onclick = () => save(button));
  },

  _showSettingsModal() {
    const profile = Store.getRecommendationProfile();
    const llmLog = LlmDiagnostics.latest();

    const modal = Modal.open({
      title: '个性化',
      body: `
        <div class="form-group">
          <label>DeepSeek API Key（仅本次浏览器会话）</label>
          <input id="settings-deepseek-key" type="password" autocomplete="off" placeholder="sk-..." value="">
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;"><button class="btn btn-sm btn-outline" id="settings-deepseek-save">保存到本次会话</button><button class="btn btn-sm btn-outline" id="settings-deepseek-test">测试连接</button><button class="btn btn-sm btn-outline" id="settings-deepseek-clear">清除 Key</button></div>
          <p id="settings-deepseek-status" style="font-size:11px;color:var(--text2);margin-top:6px;">${sessionStorage.getItem('daily_deepseek_key') ? '已配置 Key' : '尚未配置 Key'}</p>
          <p style="font-size:11px;color:var(--text3);margin-top:6px;">Key 不写入 localStorage、备份或代码；关闭浏览器会话后失效。前端直连时本机开发者工具仍可看到请求。</p>
          <details style="margin-top:10px;">
            <summary style="cursor:pointer;font-size:12px;color:var(--text2);">最近一次 LLM 诊断</summary>
            <pre style="white-space:pre-wrap;font-size:11px;color:var(--text2);margin-top:8px;">${this._esc(llmLog ? JSON.stringify(llmLog, null, 2) : '当前会话还没有 LLM 请求')}</pre>
            ${llmLog ? '<button class="btn btn-sm btn-outline" id="settings-llm-log-clear">清除诊断</button>' : ''}
          </details>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">
          <button class="btn btn-outline btn-block" id="settings-export">📤 导出数据</button>
          <button class="btn btn-outline btn-block" id="settings-import" style="margin-top:8px;">📥 导入数据</button>
          <button class="btn btn-outline btn-block" id="settings-restore" style="margin-top:8px;">↩ 恢复最近快照</button>
          <button class="btn btn-outline btn-block" id="settings-clear-history" style="margin-top:8px;">清除推荐历史（保留事项）</button>
          <button class="btn btn-outline btn-block" id="settings-reset-profile" style="margin-top:8px;">恢复默认推荐偏好</button>
          <button class="btn btn-danger btn-block" id="settings-clear-all" style="margin-top:8px;">清除全部本地数据</button>
          <p style="font-size:11px;color:var(--text2);margin-top:8px;">偏好摘要：已完成 ${Math.round(profile.completed || 0)} 次，时长校准 ${Math.round(profile.timeMismatch || 0)} 次。偏好会缓慢衰减，单次操作不会形成永久结论。</p>
        </div>
        <p style="font-size:11px;color:var(--text3);margin-top:12px;text-align:center;">
          💡 iOS Safari 与桌面 PWA 数据独立，切换设备请先导出再导入
        </p>
      `,
      onClose() {},
    });

    const updateKeyStatus = message => { modal.modalEl.querySelector('#settings-deepseek-status').textContent = message; };
    modal.modalEl.querySelector('#settings-deepseek-save').onclick = () => { const key = modal.modalEl.querySelector('#settings-deepseek-key').value.trim(); if (!key) { Toast.show('请输入 API Key'); return; } sessionStorage.setItem('daily_deepseek_key', key); modal.modalEl.querySelector('#settings-deepseek-key').value = ''; updateKeyStatus('已配置 Key，建议测试连接'); Toast.show('Key 已保存到本次会话'); };
    modal.modalEl.querySelector('#settings-deepseek-test').onclick = async () => {
      const key = sessionStorage.getItem('daily_deepseek_key');
      if (!key) { Toast.show('请先保存 API Key'); return; }
      updateKeyStatus('正在连接 DeepSeek…');
      try {
        const result = await new DailyDomain.DeepSeekInferenceProvider(key).infer({ title: '连接测试', note: '', type: 'task' });
        LlmDiagnostics.record({ action: '连接测试', status: '成功', output: { sessionMode: result.sessionMode, minSessionMinutes: result.minSessionMinutes } });
        updateKeyStatus('连接成功，可以在随手记中开启 LLM');
      } catch (error) {
        LlmDiagnostics.record({ action: '连接测试', status: '失败', error: error.message || '连接失败' });
        updateKeyStatus(error.message || '连接失败，请检查网络和 Key');
      }
    };
    modal.modalEl.querySelector('#settings-deepseek-clear').onclick = () => { sessionStorage.removeItem('daily_deepseek_key'); modal.modalEl.querySelector('#settings-deepseek-key').value = ''; updateKeyStatus('尚未配置 Key'); Toast.show('Key 已从本次会话清除'); };
    modal.modalEl.querySelector('#settings-llm-log-clear')?.addEventListener('click', () => { LlmDiagnostics.clear(); modal.close(); this._showSettingsModal(); });

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
            const result = Store.importAll(data);
            if (result.ok) {
              modal.close();
              Dashboard.render(document.getElementById('content'));
              Toast.show('导入成功');
            } else {
              Toast.show(result.error || '文件格式不正确');
            }
          } catch {
            Toast.show('文件解析失败');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });
    modal.modalEl.querySelector('#settings-clear-history').onclick = () => { Store.clearRecommendationHistory(); Toast.show('推荐历史已清除，候选事项仍保留'); };
    modal.modalEl.querySelector('#settings-reset-profile').onclick = () => { Store.resetRecommendationProfile(); Toast.show('推荐偏好已恢复默认'); };
    modal.modalEl.querySelector('#settings-restore').onclick = () => {
      const snapshots = Store.getSnapshots().slice().reverse();
      if (!snapshots.length) { Toast.show('暂无可恢复快照'); return; }
      const latest = snapshots[0];
      if (confirm(`恢复 ${latest.savedAt.slice(0, 19).replace('T', ' ')} 的 ${latest.key} 数据？`)) { Store.restoreSnapshot(latest.id); Toast.show('已恢复最近快照'); modal.close(); App.route(); }
    };
    modal.modalEl.querySelector('#settings-clear-all').onclick = () => {
      if (!confirm('这会清除愿望、消费、候选事项、提醒、学习数据和推荐记录。确定继续？')) return;
      if (!confirm('建议先导出备份。再次确认清除全部本地数据？')) return;
      Store.clearAll(); modal.close(); App.route(); Toast.show('全部本地数据已清除');
    };
  },

  _toast(msg) { Toast.show(msg); },

  _esc(s) {
    if (s === null || s === undefined) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
};
