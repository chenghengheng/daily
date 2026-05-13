const MdParser = {
  // Parse markdown study plan into { title, phases: [{ title, weeks, goal, tasks }] }
  parse(text) {
    const lines = text.split('\n');
    const plan = { title: '', phases: [] };
    let currentPhase = null;
    let parsingTable = false;
    let tableHeaders = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Title: first # header
      if (line.startsWith('# ') && !plan.title) {
        plan.title = line.slice(2).trim();
        continue;
      }

      // Phase header: ### 第 X-Y 周：名称
      const phaseMatch = line.match(/^###\s*第\s*(\d+(?:-\d+)?)\s*周[：:]\s*(.+)/);
      if (phaseMatch) {
        if (currentPhase) plan.phases.push(currentPhase);
        currentPhase = {
          weeks: phaseMatch[1],
          title: phaseMatch[2].trim(),
          goal: '',
          tasks: [],
        };
        parsingTable = false;
        continue;
      }

      if (!currentPhase) continue;

      // Goal: **目标**：xxx
      const goalMatch = line.match(/\*\*目标\*\*[：:]\s*(.+)/);
      if (goalMatch) {
        currentPhase.goal = goalMatch[1].trim();
        continue;
      }

      // Table start
      if (line.startsWith('|') && line.includes('天数') && line.includes('内容')) {
        parsingTable = true;
        tableHeaders = line.split('|').map(h => h.trim()).filter(Boolean);
        // Skip separator line
        if (lines[i+1] && lines[i+1].trim().match(/^\|[\s\-:]+\|/)) i++;
        continue;
      }

      // Table row
      if (parsingTable && line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          currentPhase.tasks.push({
            day: cells[0],
            content: cells[1] || '',
            output: cells[2] || '',
          });
        }
        continue;
      }

      // Table ended
      if (parsingTable && !line.startsWith('|')) {
        parsingTable = false;
      }
    }

    if (currentPhase) plan.phases.push(currentPhase);
    return plan;
  },

  // Generate a plan structure from user input (name + phases)
  generate(title, phases) {
    const plan = { title, phases: [] };
    let weekNum = 1;
    phases.forEach((p, idx) => {
      const weeks = p.weeks || 1;
      const weekEnd = weekNum + weeks - 1;
      const phase = {
        title: p.name,
        weeks: weekNum === weekEnd ? `${weekNum}` : `${weekNum}-${weekEnd}`,
        goal: p.goal || '',
        tasks: [],
      };
      // Generate daily tasks
      const totalDays = weeks * 7;
      for (let d = 1; d <= totalDays; d++) {
        phase.tasks.push({
          day: `Day ${d}`,
          content: d === 1 ? `${p.name} - 开始` : '',
          output: '',
        });
      }
      plan.phases.push(phase);
      weekNum = weekEnd + 1;
    });
    return plan;
  },
};
