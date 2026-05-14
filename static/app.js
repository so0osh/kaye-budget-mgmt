// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const APP = {
  raw:    null,          // full data from /api/data
  year:   null,          // selected year string e.g. '2025/2026'
  month:  null,          // { year, month } or null for 'all'
  filter: { supplier: '', status: '' },
  charts: { bar: null, pie: null },
  colors: {},            // supplierName -> hex color
  pendingDelete: null,   // { fn } waiting for confirm
};

const PALETTE = [
  '#1594a0','#cd3468','#e08c1a','#2bac76',
  '#7c5cbf','#e85d04','#3a86ff','#8ac926',
];

const HEB_MONTHS = {
  1:'ינו׳',2:'פבר׳',3:'מרצ׳',4:'אפר׳',5:'מאי',6:'יונ׳',
  7:'יול׳',8:'אוג׳',9:'ספט׳',10:'אוק׳',11:'נוב׳',12:'דצמ׳',
};

// ═══════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadData();
});

async function loadData() {
  const res = await fetch('/api/data');
  APP.raw = await res.json();
  assignColors();
  initYearSelector();
  render();
}

function assignColors() {
  APP.colors = {};
  APP.raw.suppliers.forEach((s, i) => {
    APP.colors[s['שם']] = PALETTE[i % PALETTE.length];
  });
}

// ═══════════════════════════════════════════════════════
// YEAR SELECTOR
// ═══════════════════════════════════════════════════════
function initYearSelector() {
  const sel = document.getElementById('year-select');
  sel.innerHTML = '';

  const years = APP.raw.budget.map(r => r['שנה']).sort().reverse();
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = y;
    sel.appendChild(opt);
  });

  // Auto-select the current academic year
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const currentAcademic = nowM >= 9
    ? `${nowY}/${nowY + 1}`
    : `${nowY - 1}/${nowY}`;

  APP.year = years.includes(currentAcademic) ? currentAcademic : (years[0] || '');
  sel.value = APP.year;

  sel.addEventListener('change', () => {
    APP.year = sel.value;
    APP.month = null;
    render();
  });
}

// ═══════════════════════════════════════════════════════
// RENDER ORCHESTRATOR
// ═══════════════════════════════════════════════════════
function render() {
  renderKPIs();
  renderCharts();
  renderReserves();
  renderCarousel();
  renderJournal();
  renderFilterSelects();
}

// ═══════════════════════════════════════════════════════
// KPI CALCULATIONS
// ═══════════════════════════════════════════════════════
function computeKPIs() {
  const yearCfg  = APP.raw.budget.find(r => r['שנה'] === APP.year) || {};
  const opening  = parseFloat(yearCfg['תקציב_פתיחה']) || 0;
  const endMonth = parseInt(yearCfg['חודש_סיום'])     || 8;

  const txns       = APP.raw.transactions.filter(r => r['שנה'] === APP.year);
  const totalSpent = txns.reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0);

  const rsvs          = APP.raw.reserves.filter(r => r['שנה'] === APP.year);
  const totalReserved = rsvs.reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0);

  const currentBalance   = opening - totalSpent;
  const operativeBalance = currentBalance - totalReserved;
  const monthsLeft       = calcMonthsLeft(APP.year, endMonth);
  const monthlyAllowed   = monthsLeft > 0 ? operativeBalance / monthsLeft : 0;
  const utilizationPct   = opening > 0 ? (totalSpent / opening) * 100 : 0;

  return { opening, totalSpent, currentBalance, totalReserved,
           operativeBalance, monthsLeft, monthlyAllowed, utilizationPct, endMonth };
}

function calcMonthsLeft(yearStr, endMonth) {
  const [, endYearStr] = yearStr.split('/');
  const endYear = parseInt(endYearStr);
  const now = new Date();
  const diff = (endYear - now.getFullYear()) * 12 + (endMonth - (now.getMonth() + 1));
  return Math.max(0, diff);
}

function fmt(n) {
  return '₪' + Math.round(n).toLocaleString('he-IL');
}

// ═══════════════════════════════════════════════════════
// KPI RENDER
// ═══════════════════════════════════════════════════════
function renderKPIs() {
  const k = computeKPIs();
  const grid = document.getElementById('kpi-grid');

  const badgePct = k.utilizationPct < 50
    ? '<span class="kpi-badge badge-green">בטווח יעד</span>'
    : k.utilizationPct < 80
    ? '<span class="kpi-badge badge-amber">שים לב</span>'
    : '<span class="kpi-badge badge-red">חריגה</span>';

  const balanceBadge = k.currentBalance >= 0
    ? '<span class="kpi-badge badge-green">✓ תקין</span>'
    : '<span class="kpi-badge badge-red">חריגה!</span>';

  grid.innerHTML = `
    <div class="kpi-card teal">
      <div class="kpi-label">תקציב שנתי</div>
      <div class="kpi-value">${fmt(k.opening)}</div>
      <div class="kpi-sub">שנת ${APP.year}</div>
    </div>
    <div class="kpi-card pink">
      <div class="kpi-label">הוצאות עד היום</div>
      <div class="kpi-value">${fmt(k.totalSpent)}</div>
      <div class="util-bar-wrap"><div class="util-bar" style="width:${Math.min(100,k.utilizationPct).toFixed(1)}%"></div></div>
      <div class="kpi-sub">${k.utilizationPct.toFixed(1)}% מהתקציב</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">יתרה נוכחית</div>
      <div class="kpi-value">${fmt(k.currentBalance)}</div>
      ${balanceBadge}
    </div>
    <div class="kpi-card amber">
      <div class="kpi-label">סכום שמור</div>
      <div class="kpi-value">${fmt(k.totalReserved)}</div>
      <div class="kpi-sub">${APP.raw.reserves.filter(r=>r['שנה']===APP.year).length} פריטים</div>
    </div>
    <div class="kpi-card teal">
      <div class="kpi-label">יתרה תפעולית</div>
      <div class="kpi-value">${fmt(k.operativeBalance)}</div>
      <div class="kpi-sub">לאחר הפחתת שמורות</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">חודשים שנותרו</div>
      <div class="kpi-value">${k.monthsLeft}</div>
      <div class="kpi-sub">עד ${HEB_MONTHS[k.endMonth]}</div>
    </div>
    <div class="kpi-card amber">
      <div class="kpi-label">תקציב חודשי מותר</div>
      <div class="kpi-value">${fmt(k.monthlyAllowed)}</div>
      <div class="kpi-sub">ממוצע • יתרה ÷ חודשים</div>
    </div>
    <div class="kpi-card pink">
      <div class="kpi-label">אחוז ניצול</div>
      <div class="kpi-value">${k.utilizationPct.toFixed(1)}%</div>
      ${badgePct}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// CHART HELPERS
// ═══════════════════════════════════════════════════════
function getYearMonths(yearStr, endMonth) {
  const [startYearStr, endYearStr] = yearStr.split('/');
  let y = parseInt(startYearStr), m = 9; // academic year starts September
  const endY = parseInt(endYearStr);
  const months = [];
  while (true) {
    months.push({ year: y, month: m });
    if (y === endY && m === endMonth) break;
    m++; if (m > 12) { m = 1; y++; }
    if (y > endY || (y === endY && m > endMonth)) break;
  }
  return months;
}

function buildChartData() {
  const cfg      = APP.raw.budget.find(r => r['שנה'] === APP.year) || {};
  const endMonth = parseInt(cfg['חודש_סיום']) || 8;
  const months   = getYearMonths(APP.year, endMonth);
  const txns     = APP.raw.transactions.filter(r => r['שנה'] === APP.year);
  const active   = APP.raw.suppliers.filter(s => s['פעיל'] === 'TRUE').map(s => s['שם']);

  const labels   = months.map(({ year, month }) => HEB_MONTHS[month]);
  const datasets = active.map(sup => ({
    label:           sup,
    backgroundColor: APP.colors[sup] || '#ccc',
    borderRadius:    4,
    data: months.map(({ year, month }) =>
      txns
        .filter(r => {
          const [, m, y] = r['תאריך'].split('/').map(Number);
          return r['ספק'] === sup && m === month && y === year;
        })
        .reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0)
    ),
  }));

  const totals = active.map(sup =>
    txns.filter(r => r['ספק'] === sup).reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0)
  );

  return { labels, datasets, active, totals };
}

// ═══════════════════════════════════════════════════════
// RENDER CHARTS
// ═══════════════════════════════════════════════════════
function renderCharts() {
  const { labels, datasets, active, totals } = buildChartData();

  // Legend
  document.getElementById('bar-legend').innerHTML = active.map(sup =>
    `<div class="legend-item">
       <div class="legend-dot" style="background:${APP.colors[sup]||'#ccc'}"></div>
       ${sup}
     </div>`
  ).join('');

  // Bar chart
  const barCtx = document.getElementById('bar-chart').getContext('2d');
  if (APP.charts.bar) APP.charts.bar.destroy();
  APP.charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Heebo', size: 11 } } },
        y: { stacked: true, grid: { color: '#f0f0f0' }, ticks: {
          font: { family: 'Heebo', size: 10 },
          callback: v => '₪' + v.toLocaleString(),
        }},
      },
    },
  });

  // Pie chart
  const total   = totals.reduce((a, b) => a + b, 0);
  const pieCtx  = document.getElementById('pie-chart').getContext('2d');
  if (APP.charts.pie) APP.charts.pie.destroy();
  APP.charts.pie = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: active,
      datasets: [{
        data:            totals,
        backgroundColor: active.map(s => APP.colors[s] || '#ccc'),
        borderWidth: 2, borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Heebo', size: 11 }, padding: 12 } },
        tooltip: {
          rtl: true,
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
              return `  ${ctx.label}: ₪${Math.round(ctx.parsed).toLocaleString()} (${pct}%)`;
            },
          },
          bodyFont: { family: 'Heebo', size: 12 },
          padding: 10, cornerRadius: 8,
        },
      },
    },
  });
}

function setBarMode(mode) {
  const stacked = mode === 'stacked';
  APP.charts.bar.options.scales.x.stacked = stacked;
  APP.charts.bar.options.scales.y.stacked = stacked;
  APP.charts.bar.update();
  document.getElementById('btn-stacked').classList.toggle('active', stacked);
  document.getElementById('btn-grouped').classList.toggle('active', !stacked);
}
