const Study = {
  plans: [],
  currentPlanId: null,
  timerInterval: null,
  timerTaskId: null,
  timerSeconds: 0,

  render(container) {
    // Clear any running timer when leaving/re-rendering
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.timerTaskId = null;
      this.timerSeconds = 0;
    }
    this.plans = Store.getStudyPlans();
    this._ensureCurrentPlan();
    container.innerHTML = this._view();
    this._bind(container);
  },

  _ensureCurrentPlan() {
    if (this.plans.length > 0 && !this.currentPlanId) {
      this.currentPlanId = this.plans[0].id;
    }
    if (this.plans.length > 0 && !this.plans.find(p => p.id === this.currentPlanId)) {
      this.currentPlanId = this.plans[0].id;
    }
  },

  _view() {
    if (this.plans.length === 0) {
      return `
        <div class="empty-state">
          <p style="font-size:16px;font-weight:500;color:var(--text);">还没有学习计划</p>
          <p style="font-size:13px;margin:8px 0 20px;">导入已有的计划文件或在应用内创建</p>
          <button class="btn btn-primary" id="study-import-btn" style="margin-bottom:8px;">📄 导入 Markdown 文件</button>
          <button class="btn btn-outline" id="study-create-btn">＋ 手动创建计划</button>
        </div>
      `;
    }

    const plan = this.plans.find(p => p.id === this.currentPlanId);
    if (!plan) return '<div class="empty-state"><p>请选择一个计划</p></div>';

    const currentPhase = plan.phases[plan.currentPhaseIndex || 0];
    const now = Store.today();

    // Calculate today's task
    const todayTask = currentPhase?.tasks?.find(t => {
      if (!t.date) return false;
      return t.date === now;
    });

    return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <button class="btn btn-sm btn-outline" id="study-import-btn">📄 导入</button>
        <button class="btn btn-sm btn-outline" id="study-create-btn">＋ 新建</button>
        <button class="btn btn-sm btn-outline" id="study-switch-btn">📋 切换计划</button>
        <button class="btn btn-sm btn-outline" id="study-delete-btn" style="color:var(--red);">删除</button>
        <button class="btn btn-sm btn-outline" id="study-review-btn" style="margin-left:auto;">📊 回顾</button>
      </div>
      <div class="card">
        <div style="font-size:13px;color:var(--text2);">当前计划</div>
        <div style="font-size:18px;font-weight:700;margin:2px 0;">${this._esc(plan.title)}</div>
        ${currentPhase ? `
          <div style="font-size:13px;color:var(--accent);margin-top:4px;">
            第 ${currentPhase.weeks} 周：${this._esc(currentPhase.title)}
          </div>
          ${currentPhase.goal ? `<div style="font-size:12px;color:var(--text2);margin-top:4px;">目标：${this._esc(currentPhase.goal)}</div>` : ''}
          <div style="margin-top:8px;">
            ${this._phaseProgress(plan)}
          </div>
        ` : ''}
      </div>
      ${currentPhase ? this._phaseTasksView(currentPhase, plan) : ''}
    `;
  },

  _phaseProgress(plan) {
    const phases = plan.phases;
    const currentIdx = plan.currentPhaseIndex || 0;
    const total = phases.length;
    const completed = phases.filter(p => p.status === 'completed').length;
    return `
      <div style="display:flex;gap:4px;align-items:center;">
        <span style="font-size:12px;color:var(--text2);">${completed}/${total} 阶段</span>
        <div class="progress-bar" style="flex:1;height:6px;">
          <div class="progress-fill" style="width:${(completed/total)*100}%"></div>
        </div>
        ${currentIdx < total - 1 ? `<button class="btn btn-sm btn-outline" id="study-next-phase">下一阶段 →</button>` : ''}
      </div>
    `;
  },

  _phaseTasksView(phase, plan) {
    const now = Store.today();
    const tasksCompleted = phase.tasks.filter(t => t.status === 'done').length;
    const tasksTotal = phase.tasks.length;

    // Show only unfinished tasks and today's task
    const pendingTasks = phase.tasks.filter(t => t.status !== 'done' || t.date === now);

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <span style="font-size:14px;font-weight:600;">任务</span>
            <span style="font-size:12px;color:var(--text2);margin-left:8px;">${tasksCompleted}/${tasksTotal} 完成</span>
          </div>
          ${plan.currentPhaseIndex < plan.phases.length - 1 && tasksCompleted === tasksTotal ? `
            <button class="btn btn-sm btn-primary" id="study-advance-btn" style="font-size:12px;">进入下一阶段</button>
          ` : ''}
        </div>
        <div class="progress-bar" style="margin-bottom:12px;">
          <div class="progress-fill" style="width:${tasksTotal > 0 ? (tasksCompleted/tasksTotal)*100 : 0}%"></div>
        </div>
        ${tasksTotal > 0 ? `
          <div class="card-stagger" style="max-height:400px;overflow-y:auto;">
            ${phase.tasks.map((task, idx) => {
              const isToday = task.date === now;
              const totalMinutes = (task.timeLog || []).reduce((s, l) => s + l.minutes, 0);
              return `
                <div class="task-item" data-task-idx="${idx}">
                  <div class="task-check ${task.status === 'done' ? 'done' : ''}" data-task-check></div>
                  <div class="task-body">
                    <div class="content">
                      ${isToday ? '<span style="color:var(--orange);font-weight:600;">● </span>' : ''}
                      <span style="${task.status === 'done' ? 'text-decoration:line-through;opacity:.5;' : ''}">
                        ${task.day ? `<span style="color:var(--text2);">${this._esc(task.day)}</span> ` : ''}
                        ${this._esc(task.content || '（待填写）')}
                      </span>
                    </div>
                    ${task.output ? `<div class="output">📎 ${this._esc(task.output)}</div>` : ''}
                    <div class="time">
                      ⏱ ${totalMinutes > 0 ? `${totalMinutes} 分钟` : '未计时'}
                      ${task.date ? `· ${task.date}` : ''}
                    </div>
                  </div>
                  <div class="task-actions">
                    ${task.status !== 'done' ? `
                      <button class="btn btn-sm btn-outline study-time-btn" style="font-size:11px;padding:4px 8px;" data-task-idx="${idx}">
                        ${this.timerTaskId === `${phase.title}-${idx}` ? '⏹' : '⏱'}
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">
            暂无任务，请编辑计划添加内容
          </div>
          <button class="btn btn-sm btn-outline btn-block" id="study-edit-tasks-btn">编辑任务内容</button>
        `}
      </div>
    `;
  },

  _bind(container) {
    container.querySelector('#study-import-btn')?.addEventListener('click', () => this._importMd());
    container.querySelector('#study-create-btn')?.addEventListener('click', () => this._showCreateModal());
    container.querySelector('#study-switch-btn')?.addEventListener('click', () => this._showSwitchModal());
    container.querySelector('#study-delete-btn')?.addEventListener('click', () => {
      if (!confirm('确定删除当前计划？')) return;
      this.plans = this.plans.filter(p => p.id !== this.currentPlanId);
      this.currentPlanId = this.plans.length > 0 ? this.plans[0].id : null;
      Store.saveStudyPlans(this.plans);
      this.render(document.getElementById('content'));
    });
    container.querySelector('#study-review-btn')?.addEventListener('click', () => this._showReview());
    container.querySelector('#study-next-phase')?.addEventListener('click', () => {
      const plan = this.plans.find(p => p.id === this.currentPlanId);
      if (!plan) return;
      plan.currentPhaseIndex = (plan.currentPhaseIndex || 0) + 1;
      if (plan.currentPhaseIndex >= plan.phases.length) plan.currentPhaseIndex = plan.phases.length - 1;
      Store.saveStudyPlans(this.plans);
      this.render(document.getElementById('content'));
    });
    container.querySelector('#study-advance-btn')?.addEventListener('click', () => {
      const plan = this.plans.find(p => p.id === this.currentPlanId);
      if (!plan) return;
      const idx = plan.currentPhaseIndex || 0;
      if (plan.phases[idx]) plan.phases[idx].status = 'completed';
      plan.currentPhaseIndex = idx + 1;
      if (plan.currentPhaseIndex >= plan.phases.length) plan.currentPhaseIndex = plan.phases.length - 1;
      if (plan.phases[plan.currentPhaseIndex]) plan.phases[plan.currentPhaseIndex].status = 'active';
      Store.saveStudyPlans(this.plans);
      this.render(document.getElementById('content'));
    });
    container.querySelector('#study-edit-tasks-btn')?.addEventListener('click', () => this._showEditTasksModal());

    // Task check
    container.querySelectorAll('[data-task-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        const taskItem = e.target.closest('.task-item');
        const plan = this.plans.find(p => p.id === this.currentPlanId);
        if (!plan) return;
        const phase = plan.phases[plan.currentPhaseIndex || 0];
        if (!phase) return;
        const idx = parseInt(taskItem.dataset.taskIdx);
        const task = phase.tasks[idx];
        if (!task) return;
        task.status = task.status === 'done' ? 'pending' : 'done';
        if (task.status === 'done') task.date = Store.today();
        Store.saveStudyPlans(this.plans);
        this.render(document.getElementById('content'));
      });
    });

    // Timer buttons
    container.querySelectorAll('.study-time-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.taskIdx);
        const plan = this.plans.find(p => p.id === this.currentPlanId);
        if (!plan) return;
        const phase = plan.phases[plan.currentPhaseIndex || 0];
        if (!phase) return;
        const task = phase.tasks[idx];
        if (!task) return;
        this._toggleTimer(phase, idx, task);
      });
    });
  },

  _toggleTimer(phase, idx, task) {
    const key = `${phase.title}-${idx}`;
    if (this.timerTaskId === key) {
      // Stop
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      const minutes = Math.round(this.timerSeconds / 60);
      if (minutes > 0) {
        if (!task.timeLog) task.timeLog = [];
        task.timeLog.push({ date: Store.today(), minutes });
        Store.saveStudyPlans(this.plans);
      }
      this.timerTaskId = null;
      this.timerSeconds = 0;
      this.render(document.getElementById('content'));
    } else {
      // Start
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        // Save previous timer
        const prevMinutes = Math.round(this.timerSeconds / 60);
        if (prevMinutes > 0) {
          const prevPlan = this.plans.find(p => p.id === this.currentPlanId);
          if (prevPlan) {
            const prevPhase = prevPlan.phases[prevPlan.currentPhaseIndex || 0];
            if (prevPhase) {
              const prevTask = prevPhase.tasks[idx];
              if (prevTask) {
                if (!prevTask.timeLog) prevTask.timeLog = [];
                prevTask.timeLog.push({ date: Store.today(), minutes: prevMinutes });
                Store.saveStudyPlans(this.plans);
              }
            }
          }
        }
      }
      this.timerTaskId = key;
      this.timerSeconds = 0;
      this.timerInterval = setInterval(() => { this.timerSeconds++; }, 1000);
      this._toast('⏱ 计时开始');
    }
  },

  _importMd() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        const parsed = MdParser.parse(text);
        if (parsed.phases.length === 0) {
          this._toast('未能识别阶段结构，请检查文件格式');
          return;
        }
        // Initialize phase/task states
        parsed.phases.forEach((phase, i) => {
          phase.status = i === 0 ? 'active' : 'pending';
          phase.tasks = phase.tasks.map(t => ({
            ...t,
            status: 'pending',
            timeLog: [],
            date: null,
          }));
        });
        const plan = {
          id: Store.genId(),
          title: parsed.title || file.name.replace(/\.(md|markdown|txt)$/i, ''),
          createdAt: new Date().toISOString(),
          currentPhaseIndex: 0,
          phases: parsed.phases,
        };
        this.plans.push(plan);
        this.currentPlanId = plan.id;
        Store.saveStudyPlans(this.plans);
        this.render(document.getElementById('content'));
        this._toast(`已导入：${plan.title}（${plan.phases.length} 个阶段，${plan.phases.reduce((s, p) => s + p.tasks.length, 0)} 个任务）`);
      };
      reader.readAsText(file);
    });
    input.click();
  },

  _showCreateModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>创建学习计划</h2>
        <div class="form-group">
          <label>计划名称</label>
          <input id="create-title" placeholder="例如：Java 后端学习">
        </div>
        <div id="create-phases">
          <div class="phase-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:end;">
            <div class="form-group" style="flex:2;margin-bottom:0;">
              <label>阶段名称</label>
              <input class="phase-name" placeholder="基础语法">
            </div>
            <div class="form-group" style="flex:1;margin-bottom:0;">
              <label>周数</label>
              <input class="phase-weeks" type="number" value="2" min="1" style="text-align:center;">
            </div>
            <button class="btn btn-sm btn-outline phase-remove" style="margin-bottom:2px;">✕</button>
          </div>
        </div>
        <button class="btn btn-sm btn-outline btn-block" id="add-phase-btn" style="margin-bottom:12px;">＋ 添加阶段</button>
        <div class="modal-actions">
          <button class="btn btn-outline" id="create-cancel">取消</button>
          <button class="btn btn-primary" id="create-confirm">创建</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#add-phase-btn').addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'phase-row';
      row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:end;';
      row.innerHTML = `
        <div class="form-group" style="flex:2;margin-bottom:0;">
          <input class="phase-name" placeholder="阶段名称">
        </div>
        <div class="form-group" style="flex:1;margin-bottom:0;">
          <input class="phase-weeks" type="number" value="2" min="1" style="text-align:center;">
        </div>
        <button class="btn btn-sm btn-outline phase-remove" style="margin-bottom:2px;">✕</button>
      `;
      overlay.querySelector('#create-phases').appendChild(row);
      row.querySelector('.phase-remove').addEventListener('click', () => row.remove());
    });

    overlay.querySelectorAll('.phase-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('.phase-row');
        if (overlay.querySelectorAll('.phase-row').length > 1) row.remove();
      });
    });

    overlay.querySelector('#create-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#create-confirm').addEventListener('click', () => {
      const title = overlay.querySelector('#create-title').value.trim();
      if (!title) { this._toast('请输入计划名称'); return; }
      const phaseRows = overlay.querySelectorAll('.phase-row');
      const phases = [];
      phaseRows.forEach(row => {
        const name = row.querySelector('.phase-name').value.trim();
        const weeks = parseInt(row.querySelector('.phase-weeks').value) || 1;
        if (name) phases.push({ name, weeks });
      });
      if (phases.length === 0) { this._toast('请至少添加一个阶段'); return; }

      const generated = MdParser.generate(title, phases);
      generated.phases.forEach((p, i) => {
        p.status = i === 0 ? 'active' : 'pending';
        p.tasks = p.tasks.map(t => ({ ...t, status: 'pending', timeLog: [], date: null }));
      });
      const plan = {
        id: Store.genId(),
        title,
        createdAt: new Date().toISOString(),
        currentPhaseIndex: 0,
        phases: generated.phases,
      };
      this.plans.push(plan);
      this.currentPlanId = plan.id;
      Store.saveStudyPlans(this.plans);
      overlay.remove();
      this.render(document.getElementById('content'));
      this._toast(`已创建：${plan.title}`);
    });
  },

  _showSwitchModal() {
    if (this.plans.length <= 1) { this._toast('只有一个计划'); return; }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>切换计划</h2>
        ${this.plans.map(p => `
          <div class="list-item" style="cursor:pointer;" data-id="${p.id}">
            <div class="info">
              <div class="name ${p.id === this.currentPlanId ? '' : ''}">${this._esc(p.title)}</div>
              <div class="meta">${p.phases.length} 阶段 · ${p.phases.reduce((s, ph) => s + ph.tasks.length, 0)} 任务</div>
            </div>
            ${p.id === this.currentPlanId ? '<span style="color:var(--accent);font-size:12px;">当前</span>' : ''}
          </div>
        `).join('')}
        <div class="modal-actions">
          <button class="btn btn-outline" id="switch-close">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.list-item').forEach(el => {
      el.addEventListener('click', () => {
        this.currentPlanId = el.dataset.id;
        overlay.remove();
        this.render(document.getElementById('content'));
      });
    });
    overlay.querySelector('#switch-close').addEventListener('click', () => overlay.remove());
  },

  _showEditTasksModal() {
    const plan = this.plans.find(p => p.id === this.currentPlanId);
    if (!plan) return;
    const phase = plan.phases[plan.currentPhaseIndex || 0];
    if (!phase) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>编辑任务</h2>
        <div style="max-height:50vh;overflow-y:auto;">
          ${phase.tasks.map((t, i) => `
            <div class="form-group" style="margin-bottom:8px;">
              <label style="font-size:11px;">${this._esc(t.day || `任务 ${i+1}`)}</label>
              <input class="edit-task-input" data-idx="${i}" value="${this._esc(t.content)}" placeholder="任务内容">
            </div>
          `).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="edit-cancel">取消</button>
          <button class="btn btn-primary" id="edit-confirm">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#edit-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#edit-confirm').addEventListener('click', () => {
      overlay.querySelectorAll('.edit-task-input').forEach(input => {
        const idx = parseInt(input.dataset.idx);
        if (phase.tasks[idx]) phase.tasks[idx].content = input.value.trim();
      });
      Store.saveStudyPlans(this.plans);
      overlay.remove();
      this.render(document.getElementById('content'));
      this._toast('已保存');
    });
  },

  _showReview() {
    const plan = this.plans.find(p => p.id === this.currentPlanId);
    if (!plan) { this._toast('没有计划可回顾'); return; }

    // Collect time logs
    const allLogs = [];
    plan.phases.forEach((phase, pi) => {
      phase.tasks.forEach((task, ti) => {
        (task.timeLog || []).forEach(log => {
          allLogs.push({
            date: log.date,
            minutes: log.minutes,
            phase: phase.title,
            task: task.content || task.day,
          });
        });
      });
    });

    // Weekly aggregation
    const weekMap = {};
    allLogs.forEach(log => {
      const week = log.date ? log.date.slice(0, 7) : '未知';
      if (!weekMap[week]) weekMap[week] = 0;
      weekMap[week] += log.minutes;
    });
    const weeklyData = Object.entries(weekMap).sort((a, b) => a[0].localeCompare(b[0]));

    // Phase completion
    const phaseData = plan.phases.map(p => ({
      name: p.title,
      done: p.tasks.filter(t => t.status === 'done').length,
      total: p.tasks.length,
    }));

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:500px;">
        <h2>学习回顾</h2>
        <div style="font-size:13px;color:var(--text2);margin-bottom:12px;">${this._esc(plan.title)}</div>

        <div class="card-title">⏱ 每周投入时间</div>
        <div style="margin-bottom:16px;">
          ${weeklyData.length > 0 ? `
            <canvas id="review-weekly-chart" style="width:100%;height:${Math.max(80, weeklyData.length * 30)}px;"></canvas>
          ` : '<p style="font-size:13px;color:var(--text2);">暂无计时记录</p>'}
          ${allLogs.length > 0 ? `
            <details style="margin-top:8px;">
              <summary style="font-size:12px;color:var(--text2);cursor:pointer;">查看明细（共 ${allLogs.reduce((s, l) => s + l.minutes, 0)} 分钟）</summary>
              <div style="max-height:200px;overflow-y:auto;margin-top:8px;">
                ${allLogs.sort((a, b) => b.date?.localeCompare(a.date || '')).map(log => `
                  <div class="log-entry">${log.date} · ${this._esc(log.phase)} · ${log.minutes} 分钟</div>
                `).join('')}
              </div>
            </details>
          ` : ''}
        </div>

        <div class="card-title">📊 阶段完成度</div>
        <div style="margin-bottom:8px;">
          ${phaseData.map(p => `
            <div style="margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
                <span>${this._esc(p.name)}</span>
                <span style="color:var(--text2);">${p.done}/${p.total}</span>
              </div>
              <div class="progress-bar" style="height:6px;">
                <div class="progress-fill ${p.total > 0 && p.done === p.total ? 'full' : ''}" style="width:${p.total > 0 ? (p.done/p.total)*100 : 0}%"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="modal-actions">
          <button class="btn btn-outline" id="review-close">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#review-close').addEventListener('click', () => overlay.remove());

    // Draw chart after DOM is ready
    setTimeout(() => {
      const canvas = overlay.querySelector('#review-weekly-chart');
      if (canvas && weeklyData.length > 0) {
        Chart.bars(canvas, weeklyData.map(([week, mins]) => ({
          label: week,
          value: mins,
          unit: 'm',
        })));
      }
    }, 50);
  },

  _toast(msg) { Toast.show(msg); },

  _esc(s) {
    if (s === null || s === undefined) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
};
