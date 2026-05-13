const Chart = {
  // Draw a simple horizontal bar chart
  bars(canvas, data, { barColor = '#7c6af0', labelColor = '#8888aa' } = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const barH = Math.min(24, (h - 20) / data.length - 6);
    const startY = 10;
    const labelW = 60;

    ctx.clearRect(0, 0, w, h);

    data.forEach((d, i) => {
      const y = startY + i * (barH + 6);
      const bw = ((w - labelW - 16) * Math.min(d.value, maxVal)) / maxVal;

      // label
      ctx.fillStyle = labelColor;
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(d.label, labelW - 6, y + barH / 2 + 4);

      // bar
      ctx.fillStyle = d.color || barColor;
      ctx.beginPath();
      const r = barH / 2;
      const bx = labelW;
      if (bw < r * 2) {
        ctx.roundRect(bx, y, bw, barH, bw / 2);
      } else {
        ctx.roundRect(bx, y, bw, barH, r);
      }
      ctx.fill();

      // value
      if (bw > 30) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(d.value + (d.unit || ''), bx + 4, y + barH / 2 + 3);
      }
    });
  },
};
