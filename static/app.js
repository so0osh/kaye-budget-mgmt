// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const APP = {
  raw:          null,          // full data from /api/data
  year:         null,          // selected year string e.g. '2025/2026'
  month:        null,          // { year, month } or null for 'all'
  filter:       { supplier: '', status: '', dept: '', duplicates: false, chartDept: '' },
  charts:       { bar: null, pie: null },
  colors:       {},            // supplierName -> hex color
  pendingDelete: null,         // { fn } waiting for confirm
  duplicateIds: new Set(),
  version:      '',
};

function computeDuplicateIds() {
  const counts = {};
  APP.raw.transactions.forEach(r => {
    if (!r['מס_חשבונית']) return;
    const key = r['ספק'] + '::' + r['מס_חשבונית'];
    if (!counts[key]) counts[key] = [];
    counts[key].push(r.id);
  });
  APP.duplicateIds = new Set();
  Object.values(counts).forEach(ids => {
    if (ids.length > 1) ids.forEach(id => APP.duplicateIds.add(id));
  });
}

const PALETTE = [
  '#1594a0','#cd3468','#e08c1a','#2bac76',
  '#7c5cbf','#e85d04','#3a86ff','#8ac926',
];

const HEB_MONTHS = {
  1:'ינו׳',2:'פבר׳',3:'מרץ',4:'אפר׳',5:'מאי',6:'יוני',
  7:'יולי',8:'אוג׳',9:'ספט׳',10:'אוק׳',11:'נוב׳',12:'דצמ׳',
};

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
  computeDuplicateIds();
  renderKPIs();
  initChartDeptFilter();
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
  const parts = yearStr.split('/');
  if (parts.length < 2) return 0;
  const endYear = parseInt(parts[1]);
  if (isNaN(endYear)) return 0;
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

  let active = APP.raw.suppliers.filter(s => s['פעיל'] === 'TRUE').map(s => s['שם']);
  if (APP.filter.chartDept) {
    const deptSet = new Set(
      APP.raw.suppliers
        .filter(s => s['פעיל'] === 'TRUE' && s['מחלקה'] === APP.filter.chartDept)
        .map(s => s['שם'])
    );
    active = active.filter(name => deptSet.has(name));
  }

  const labels   = months.map(({ month }) => HEB_MONTHS[month]);
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

function initChartDeptFilter() {
  const sel = document.getElementById('chart-dept-filter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">כל המחלקות</option>' +
    APP.raw.departments.map(d =>
      `<option value="${escHtml(d['שם'])}">${escHtml(d['שם'])}</option>`
    ).join('');
  sel.value = current;
}

function applyChartDeptFilter() {
  APP.filter.chartDept = document.getElementById('chart-dept-filter').value;
  renderCharts();
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
       ${escHtml(sup)}
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

  document.getElementById('btn-stacked').classList.add('active');
  document.getElementById('btn-grouped').classList.remove('active');

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
              return `ספק: ₪${Math.round(ctx.parsed).toLocaleString()} (${pct}%)`;
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

// ═══════════════════════════════════════════════════════
// RESERVES
// ═══════════════════════════════════════════════════════
const RESERVE_COLORS = ['#cd3468','#e08c1a','#2bac76','#7c5cbf','#1594a0'];

function renderReserves() {
  const container = document.getElementById('reserves-container');
  const reserves  = APP.raw.reserves.filter(r => r['שנה'] === APP.year);

  const cards = reserves.map((r, i) => {
    const color = RESERVE_COLORS[i % RESERVE_COLORS.length];
    return `
      <div class="reserve-card" style="border-top-color:${color}">
        <div class="reserve-actions no-print">
          <button class="action-btn" data-id="${escHtml(r.id)}" onclick="editReserve(this.dataset.id)">✎</button>
          <button class="action-btn del" data-id="${escHtml(r.id)}" data-name="${escHtml(r['שם'])}" onclick="deleteReserve(this.dataset.id, this.dataset.name)">✕</button>
        </div>
        <div class="reserve-name">${escHtml(r['שם'])}</div>
        <div class="reserve-amount" style="color:${color}">₪${parseFloat(r['סכום']).toLocaleString()}</div>
        <div class="reserve-desc">${escHtml(r['תיאור'] || '')}</div>
      </div>`;
  }).join('');

  container.innerHTML = cards + `
    <div class="reserve-card add-card no-print" onclick="openReserveModal(null)">
      <span style="font-size:20px">＋</span> הוסף שמור
    </div>`;
}

// Reserve modal reuses the transaction modal overlay with a separate form
// injected dynamically (avoids adding another modal to the HTML)
let _reserveEditId = null;

function openReserveModal(id) {
  _reserveEditId = id;
  const r = id ? APP.raw.reserves.find(x => x.id === id) : null;

  document.getElementById('modal-title').textContent = id ? 'עריכת שמור' : 'הוספת סכום שמור';
  document.getElementById('modal-overlay').classList.remove('hidden');

  // Temporarily swap modal body content for reserve form
  document.querySelector('.modal-body').innerHTML = `
    <div class="form-row">
      <label>שם</label>
      <input type="text" id="rsv-name" class="form-input" value="${escHtml(r ? r['שם'] : '')}">
    </div>
    <div class="form-row">
      <label>סכום (₪)</label>
      <input type="number" id="rsv-amount" class="form-input" min="0" step="0.01" value="${escHtml(r ? r['סכום'] : '')}">
    </div>
    <div class="form-row">
      <label>תיאור</label>
      <input type="text" id="rsv-desc" class="form-input" value="${escHtml(r ? r['תיאור'] : '')}">
    </div>
  `;
  document.querySelector('.modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeTransactionModal()">ביטול</button>
    <button class="btn btn-primary" onclick="saveReserve()">שמור</button>
  `;
}

async function saveReserve() {
  const name   = document.getElementById('rsv-name').value.trim();
  const amount = document.getElementById('rsv-amount').value;
  const desc   = document.getElementById('rsv-desc').value.trim();
  if (!name || !amount) return;

  const row = { id: _reserveEditId || String(Date.now()), שנה: APP.year, שם: name, סכום: amount, תיאור: desc };
  const action = _reserveEditId ? 'update' : 'create';

  await fetch('/api/reserve', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action, row }) });

  if (action === 'create') {
    APP.raw.reserves.push(row);
  } else {
    const idx = APP.raw.reserves.findIndex(x => x.id === row.id);
    if (idx >= 0) APP.raw.reserves[idx] = row;
  }

  closeTransactionModal();
  renderReserves();
  renderKPIs();
}

function editReserve(id) { openReserveModal(id); }

function deleteReserve(id, name) {
  APP.pendingDelete = async () => {
    await fetch('/api/reserve', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'delete', id }) });
    APP.raw.reserves = APP.raw.reserves.filter(r => r.id !== id);
    renderReserves();
    renderKPIs();
  };
  document.getElementById('confirm-message').textContent = `למחוק את "${name}"?`;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════
// JOURNAL — CAROUSEL
// ═══════════════════════════════════════════════════════
let _monthReady = false;

function renderCarousel() {
  const cfg      = APP.raw.budget.find(r => r['שנה'] === APP.year) || {};
  const endMonth = parseInt(cfg['חודש_סיום']) || 8;
  const months   = getYearMonths(APP.year, endMonth);

  // Auto-focus current month on first render only
  if (!_monthReady) {
    _monthReady = true;
    const now = new Date();
    const cur = months.find(m => m.month === now.getMonth() + 1 && m.year === now.getFullYear());
    APP.month = cur || null;
  }

  const pills = document.getElementById('month-pills');
  const allActive = APP.month === null;
  pills.innerHTML =
    `<div class="month-pill all ${allActive ? 'active' : ''}" onclick="selectMonth(null)">הכל</div>` +
    months.map(({ year, month }) => {
      const active = APP.month && APP.month.month === month && APP.month.year === year;
      return `<div class="month-pill ${active ? 'active' : ''}"
        onclick="selectMonth(${month},${year})">${HEB_MONTHS[month]}</div>`;
    }).join('');
}

function selectMonth(month, year) {
  APP.month = month === null ? null : { month, year };
  renderCarousel();
  renderJournal();
}

// ═══════════════════════════════════════════════════════
// JOURNAL — FILTERS
// ═══════════════════════════════════════════════════════
function renderFilterSelects() {
  const deptSel = document.getElementById('filter-dept');
  const supSel  = document.getElementById('filter-supplier');
  const stSel   = document.getElementById('filter-status');

  deptSel.innerHTML = '<option value="">כל המחלקות</option>' +
    APP.raw.departments.map(d =>
      `<option value="${escHtml(d['שם'])}">${escHtml(d['שם'])}</option>`
    ).join('');
  deptSel.value = APP.filter.dept;

  const filteredSuppliers = APP.filter.dept
    ? APP.raw.suppliers.filter(s => s['פעיל'] === 'TRUE' && s['מחלקה'] === APP.filter.dept)
    : APP.raw.suppliers.filter(s => s['פעיל'] === 'TRUE');

  supSel.innerHTML = '<option value="">כל הספקים</option>' +
    filteredSuppliers.map(s =>
      `<option value="${escHtml(s['שם'])}">${escHtml(s['שם'])}</option>`
    ).join('');
  supSel.value = APP.filter.supplier;

  stSel.innerHTML = '<option value="">כל הסטטוסים</option>' +
    APP.raw.statuses.map(s =>
      `<option value="${escHtml(s['שם'])}">${escHtml(s['שם'])}</option>`
    ).join('');
  stSel.value = APP.filter.status;
}

function applyFilters() {
  APP.filter.supplier = document.getElementById('filter-supplier').value;
  APP.filter.status   = document.getElementById('filter-status').value;
  renderJournal();
}

function toggleDuplicateFilter() {
  APP.filter.duplicates = !APP.filter.duplicates;
  const btn = document.getElementById('filter-duplicates');
  btn.style.borderColor = APP.filter.duplicates ? '#e08c1a' : '';
  btn.style.color       = APP.filter.duplicates ? '#e08c1a' : '';
  renderJournal();
}

function applyDeptFilter() {
  APP.filter.dept = document.getElementById('filter-dept').value;
  APP.filter.supplier = '';
  renderFilterSelects();
  renderJournal();
}

function clearFilters() {
  APP.filter.supplier  = '';
  APP.filter.status    = '';
  APP.filter.dept      = '';
  APP.filter.duplicates = false;
  const btn = document.getElementById('filter-duplicates');
  if (btn) { btn.style.borderColor = ''; btn.style.color = ''; }
  renderFilterSelects();
  renderJournal();
}

// ═══════════════════════════════════════════════════════
// JOURNAL — TABLE
// ═══════════════════════════════════════════════════════
function getFilteredTransactions() {
  let rows = APP.raw.transactions.filter(r => r['שנה'] === APP.year);

  if (APP.month) {
    rows = rows.filter(r => {
      const parts = r['תאריך'].split('/').map(Number);
      return parts[1] === APP.month.month && parts[2] === APP.month.year;
    });
  }
  if (APP.filter.supplier) rows = rows.filter(r => r['ספק'] === APP.filter.supplier);
  if (APP.filter.status)   rows = rows.filter(r => r['סטטוס'] === APP.filter.status);
  if (APP.filter.duplicates) rows = rows.filter(r => APP.duplicateIds.has(r.id));
  if (APP.filter.dept)       rows = rows.filter(r => r['מחלקה'] === APP.filter.dept);

  return rows.sort((a, b) => {
    const parse = s => { const [d,m,y] = s.split('/').map(Number); return new Date(y,m-1,d); };
    return parse(b['תאריך']) - parse(a['תאריך']);
  });
}

function renderJournal() {
  const rows  = getFilteredTransactions();
  const total = rows.reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0);
  const tbody = document.getElementById('journal-tbody');

  tbody.innerHTML = rows.map(r => {
    const color      = APP.colors[r['ספק']] || '#ccc';
    const status     = APP.raw.statuses.find(s => s['שם'] === r['סטטוס']);
    const badgeColor = status ? status['צבע'] : '#727272';
    const badgeBg    = badgeColor + '22';
    const isDup      = APP.duplicateIds.has(r.id);
    const dupBadge   = isDup ? '<span class="dup-badge">כפול</span>' : '';
    return `<tr class="${isDup ? 'row-duplicate' : ''}">
      <td>${r['תאריך']}</td>
      <td><span class="supplier-dot" style="background:${color}"></span>${escHtml(r['ספק'])}</td>
      <td style="color:#727272;font-size:12px">${escHtml(r['מס_חשבונית'] || '—')} ${dupBadge}</td>
      <td style="color:#727272">${escHtml(r['תיאור'] || '')}</td>
      <td class="amount-cell">₪${parseFloat(r['סכום']).toLocaleString()}</td>
      <td><span class="status-badge" style="background:${badgeBg};color:${badgeColor}">${escHtml(r['סטטוס'])}</span></td>
      <td class="no-print"><div class="row-actions">
        <button class="action-btn" data-id="${escHtml(r.id)}" onclick="openTransactionModal(this.dataset.id)">✎</button>
        <button class="action-btn del" data-id="${escHtml(r.id)}" data-supplier="${escHtml(r['ספק'])}" data-date="${escHtml(r['תאריך'])}" onclick="deleteTransaction(this.dataset.id, this.dataset.supplier, this.dataset.date)">✕</button>
      </div></td>
    </tr>`;
  }).join('');

  const period = APP.month
    ? `${HEB_MONTHS[APP.month.month]} ${APP.month.year}`
    : APP.year;
  document.getElementById('journal-count').textContent = `${rows.length} תנועות | ${period}`;
  document.getElementById('journal-total').textContent = `₪${Math.round(total).toLocaleString()}`;
}

function printJournal() {
  window.print();
}

function deleteTransaction(id, supplier, date) {
  APP.pendingDelete = async () => {
    await fetch('/api/transaction', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'delete', id }) });
    APP.raw.transactions = APP.raw.transactions.filter(r => r.id !== id);
    render();
  };
  document.getElementById('confirm-message').textContent = `למחוק תנועה של ${supplier} מתאריך ${date}?`;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════
// DELETE CONFIRM
// ═══════════════════════════════════════════════════════
function confirmDelete() {
  if (APP.pendingDelete) APP.pendingDelete();
  APP.pendingDelete = null;
  document.getElementById('confirm-overlay').classList.add('hidden');
}

function cancelDelete() {
  APP.pendingDelete = null;
  document.getElementById('confirm-overlay').classList.add('hidden');
}

// ═══════════════════════════════════════════════════════
// TRANSACTION MODAL
// ═══════════════════════════════════════════════════════
function _restoreTransactionForm() {
  const deptOptions = APP.raw.departments.map(d =>
    `<option value="${escHtml(d['שם'])}">${escHtml(d['שם'])}</option>`
  ).join('');

  document.querySelector('.modal-body').innerHTML = `
    <input type="hidden" id="txn-id">
    <div class="form-row">
      <label>תאריך</label>
      <input type="text" id="txn-date" class="form-input" placeholder="dd/mm/yyyy" readonly>
    </div>
    <div class="form-row">
      <label>מחלקה <button class="link-btn no-print" onclick="openManageDepartments()">נהל מחלקות</button></label>
      <select id="txn-dept" class="form-input" onchange="changeTxnDept(this.value)">${deptOptions}</select>
    </div>
    <div class="form-row">
      <label>ספק <button class="link-btn no-print" onclick="openManageSuppliers()">נהל ספקים</button></label>
      <div class="combobox-wrap">
        <input type="text" id="txn-supplier-input" class="form-input" placeholder="הקלד לחיפוש ספק..." autocomplete="off">
        <input type="hidden" id="txn-supplier">
        <div id="txn-supplier-list" class="combobox-list hidden"></div>
      </div>
    </div>
    <div class="form-row">
      <label>מס׳ חשבונית</label>
      <input type="text" id="txn-invoice" class="form-input" placeholder="מספר חשבונית">
    </div>
    <div class="form-row">
      <label>תיאור</label>
      <input type="text" id="txn-description" class="form-input" placeholder="תיאור (אופציונלי)">
    </div>
    <div class="form-row">
      <label>סכום (₪)</label>
      <input type="number" id="txn-amount" class="form-input" min="0" step="0.01">
    </div>
    <div class="form-row">
      <label>סטטוס <button class="link-btn no-print" onclick="openManageStatuses()">נהל סטטוסים</button></label>
      <select id="txn-status" class="form-input"></select>
    </div>
  `;
  document.querySelector('.modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeTransactionModal()">ביטול</button>
    <button class="btn btn-primary" onclick="saveTransaction()">שמור</button>
  `;
}

let _supplierDept = '';
let _suppliersModalDept = '';

function changeTxnDept(deptName) {
  _supplierDept = deptName;
  const supInput  = document.getElementById('txn-supplier-input');
  const supHidden = document.getElementById('txn-supplier');
  if (!supInput || !supHidden) return;
  const options = APP.raw.suppliers
    .filter(s => s['פעיל'] === 'TRUE' && s['מחלקה'] === deptName)
    .map(s => s['שם']);
  if (!options.includes(supHidden.value)) {
    supInput.value  = '';
    supHidden.value = '';
  }
}

// ═══════════════════════════════════════════════════════
// SUPPLIER COMBOBOX
// ═══════════════════════════════════════════════════════
function buildCombobox(inputEl, hiddenEl, getOptions) {
  const listEl = document.getElementById(inputEl.id + '-list');

  function renderList() {
    const query = inputEl.value.toLowerCase();
    const opts  = getOptions().filter(o => o.toLowerCase().includes(query));
    listEl.innerHTML = opts.map(o =>
      `<div class="combobox-item" data-value="${escHtml(o)}">${escHtml(o)}</div>`
    ).join('');
    listEl.classList.toggle('hidden', opts.length === 0);
  }

  function selectOption(value) {
    inputEl.value  = value;
    hiddenEl.value = value;
    listEl.classList.add('hidden');
  }

  inputEl.addEventListener('input',  renderList);
  inputEl.addEventListener('focus',  renderList);

  inputEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (!getOptions().includes(inputEl.value)) {
        inputEl.value  = '';
        hiddenEl.value = '';
      }
      listEl.classList.add('hidden');
    }, 150);
  });

  inputEl.addEventListener('keydown', e => {
    const items    = [...listEl.querySelectorAll('.combobox-item')];
    const activeEl = listEl.querySelector('.combobox-item.active');
    const activeIdx = items.indexOf(activeEl);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items.forEach(el => el.classList.remove('active'));
      const next = items[(activeIdx + 1) % items.length];
      if (next) next.classList.add('active');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items.forEach(el => el.classList.remove('active'));
      const prev = items[(activeIdx <= 0 ? items.length : activeIdx) - 1];
      if (prev) prev.classList.add('active');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeEl) selectOption(activeEl.dataset.value);
    } else if (e.key === 'Escape') {
      listEl.classList.add('hidden');
    }
  });

  listEl.addEventListener('mousedown', e => {
    const item = e.target.closest('.combobox-item');
    if (item) selectOption(item.dataset.value);
  });
}

function openTransactionModal(id) {
  if (!APP.raw.departments.length) {
    alert('יש להוסיף מחלקה לפני הוספת תנועה. פתח "נהל מחלקות" בהגדרות.');
    return;
  }
  _restoreTransactionForm();

  const fp = flatpickr('#txn-date', {
    locale: 'he',
    dateFormat: 'd/m/Y',
    disableMobile: true,
  });

  // Build combobox — reads _supplierDept dynamically each keystroke
  const supInput  = document.getElementById('txn-supplier-input');
  const supHidden = document.getElementById('txn-supplier');
  buildCombobox(supInput, supHidden, () =>
    APP.raw.suppliers
      .filter(s => s['פעיל'] === 'TRUE' && s['מחלקה'] === _supplierDept)
      .map(s => s['שם'])
  );

  // Populate status dropdown
  document.getElementById('txn-status').innerHTML = APP.raw.statuses
    .map(s => `<option value="${escHtml(s['שם'])}">${escHtml(s['שם'])}</option>`).join('');

  document.getElementById('modal-overlay').classList.remove('hidden');

  const deptSel = document.getElementById('txn-dept');

  if (id) {
    const r = APP.raw.transactions.find(t => t.id === id);
    document.getElementById('modal-title').textContent = 'עריכת תנועה';
    document.getElementById('txn-id').value            = r.id;
    fp.setDate(r['תאריך'], false, 'd/m/Y');

    // Set dept first so _supplierDept is correct before setting supplier
    _supplierDept    = r['מחלקה'] || '';
    deptSel.value    = r['מחלקה'] || '';

    // Set supplier after dept
    supInput.value   = r['ספק'];
    supHidden.value  = r['ספק'];

    document.getElementById('txn-invoice').value     = r['מס_חשבונית'];
    document.getElementById('txn-description').value = r['תיאור'];
    document.getElementById('txn-amount').value      = r['סכום'];
    document.getElementById('txn-status').value      = r['סטטוס'];
  } else {
    document.getElementById('modal-title').textContent = 'הוספת תנועה';
    fp.setDate(new Date(), true);

    const defaultDept = APP.raw.departments.find(d => d['ברירת_מחדל'] === 'TRUE')
                     || APP.raw.departments[0]
                     || null;
    if (defaultDept) {
      deptSel.value = defaultDept['שם'];
      _supplierDept = defaultDept['שם'];
    } else {
      _supplierDept = '';
    }
  }
}


async function saveTransaction() {
  const id       = document.getElementById('txn-id').value;
  const dateVal  = document.getElementById('txn-date').value;
  const amount   = document.getElementById('txn-amount').value;
  const dept     = document.getElementById('txn-dept').value;
  const supplier = document.getElementById('txn-supplier').value;
  if (!dateVal || !amount || !dept || !supplier) return;

  const row = {
    id:          id || String(Date.now()),
    שנה:         APP.year,
    תאריך:       dateVal,
    ספק:         supplier,
    מס_חשבונית: document.getElementById('txn-invoice').value.trim(),
    תיאור:       document.getElementById('txn-description').value.trim(),
    סכום:        amount,
    סטטוס:       document.getElementById('txn-status').value,
    מחלקה:       dept,
  };
  const action = id ? 'update' : 'create';

  await fetch('/api/transaction', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action, row }),
  });

  if (action === 'create') {
    APP.raw.transactions.push(row);
  } else {
    const idx = APP.raw.transactions.findIndex(t => t.id === row.id);
    if (idx >= 0) APP.raw.transactions[idx] = row;
  }

  closeTransactionModal();
  render();
}

function closeTransactionModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  _reserveEditId = null;
}

function closeModal(event) {
  if (event.target === document.getElementById('modal-overlay')) closeTransactionModal();
  if (event.target === document.getElementById('suppliers-modal')) closeManageSuppliers();
  if (event.target === document.getElementById('statuses-modal')) closeManageStatuses();
  if (event.target === document.getElementById('settings-overlay')) closeSettings();
}

// ═══════════════════════════════════════════════════════
// MANAGE SUPPLIERS
// ═══════════════════════════════════════════════════════
function openManageSuppliers() {
  _suppliersModalDept = document.getElementById('txn-dept')?.value || '';
  const deptSel = document.getElementById('suppliers-modal-dept-filter');
  deptSel.innerHTML = '<option value="">הכל</option>' +
    APP.raw.departments.map(d =>
      `<option value="${escHtml(d['שם'])}">${escHtml(d['שם'])}</option>`
    ).join('');
  deptSel.value = _suppliersModalDept;
  renderSuppliersList();
  document.getElementById('suppliers-modal').classList.remove('hidden');
}

function filterSuppliersModal(deptName) {
  _suppliersModalDept = deptName;
  renderSuppliersList();
}

function closeManageSuppliers() {
  document.getElementById('suppliers-modal').classList.add('hidden');
  assignColors();
  renderFilterSelects();
}

function renderSuppliersList() {
  const visible = _suppliersModalDept
    ? APP.raw.suppliers.filter(s => s['מחלקה'] === _suppliersModalDept)
    : APP.raw.suppliers;

  document.getElementById('suppliers-list').innerHTML =
    visible.map(s => {
      const deptOpts = '<option value="">ללא מחלקה</option>' +
        APP.raw.departments.map(d =>
          `<option value="${escHtml(d['שם'])}" ${d['שם'] === s['מחלקה'] ? 'selected' : ''}>${escHtml(d['שם'])}</option>`
        ).join('');
      return `
        <div class="manage-item">
          <span>${escHtml(s['שם'])} ${s['פעיל'] === 'FALSE' ? '<em style="color:#8a8a8a;font-size:11px">(לא פעיל)</em>' : ''}</span>
          <div class="manage-item-actions" style="gap:4px">
            <select class="filter-select" style="font-size:11px;padding:2px 6px"
              data-id="${escHtml(s.id)}" data-name="${escHtml(s['שם'])}" data-active="${escHtml(s['פעיל'])}"
              onchange="updateSupplierDept(this.dataset.id, this.dataset.name, this.dataset.active, this.value)">
              ${deptOpts}
            </select>
            <button class="action-btn" data-id="${escHtml(s.id)}" data-name="${escHtml(s['שם'])}" data-active="${escHtml(s['פעיל'])}"
              onclick="toggleSupplierActive(this.dataset.id, this.dataset.name, this.dataset.active)"
              title="${s['פעיל'] === 'TRUE' ? 'הסתר' : 'הפעל'}">
              ${s['פעיל'] === 'TRUE' ? '○' : '●'}
            </button>
            <button class="action-btn del" data-id="${escHtml(s.id)}" data-name="${escHtml(s['שם'])}"
              onclick="deleteSupplier(this.dataset.id, this.dataset.name)">✕</button>
          </div>
        </div>`;
    }).join('');
}

async function updateSupplierDept(id, name, active, deptName) {
  const row = { id, שם: name, פעיל: active, מחלקה: deptName };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'update', row }) });
  const s = APP.raw.suppliers.find(x => x.id === id);
  if (s) s['מחלקה'] = deptName;
  renderSuppliersList();
}

async function addSupplier() {
  const name = document.getElementById('new-supplier-name').value.trim();
  if (!name) return;
  const row = { id: String(Date.now()), שם: name, פעיל: 'TRUE', מחלקה: _suppliersModalDept };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'create', row }) });
  APP.raw.suppliers.push(row);
  assignColors();
  document.getElementById('new-supplier-name').value = '';
  renderSuppliersList();
}

async function toggleSupplierActive(id, name, current) {
  const newActive = current === 'TRUE' ? 'FALSE' : 'TRUE';
  const s   = APP.raw.suppliers.find(x => x.id === id);
  const row = { id, שם: name, פעיל: newActive, מחלקה: s ? (s['מחלקה'] || '') : '' };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'update', row }) });
  if (s) s['פעיל'] = newActive;
  renderSuppliersList();
}

async function deleteSupplier(id, name) {
  if (!confirm(`למחוק את הספק "${name}"?`)) return;
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'delete', id }) });
  APP.raw.suppliers = APP.raw.suppliers.filter(s => s.id !== id);
  assignColors();
  renderSuppliersList();
}

// ═══════════════════════════════════════════════════════
// MANAGE STATUSES
// ═══════════════════════════════════════════════════════
function openManageStatuses() {
  renderStatusesList();
  document.getElementById('statuses-modal').classList.remove('hidden');
}

function closeManageStatuses() {
  document.getElementById('statuses-modal').classList.add('hidden');
  renderFilterSelects();
  const stSel = document.getElementById('txn-status');
  if (stSel) {
    stSel.innerHTML = APP.raw.statuses
      .map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');
  }
}

function renderStatusesList() {
  document.getElementById('statuses-list').innerHTML =
    APP.raw.statuses.map(s => `
      <div class="manage-item">
        <span>
          <span class="status-badge" style="background:${s['צבע']}22;color:${s['צבע']}">${escHtml(s['שם'])}</span>
        </span>
        <div class="manage-item-actions">
          <button class="action-btn del" data-id="${escHtml(s.id)}" data-name="${escHtml(s['שם'])}" onclick="deleteStatus(this.dataset.id, this.dataset.name)">✕</button>
        </div>
      </div>`).join('');
}

async function addStatus() {
  const name  = document.getElementById('new-status-name').value.trim();
  const color = document.getElementById('new-status-color').value;
  if (!name) return;
  const row = { id: String(Date.now()), שם: name, צבע: color };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'status', action: 'create', row }) });
  APP.raw.statuses.push(row);
  document.getElementById('new-status-name').value = '';
  renderStatusesList();
}

async function deleteStatus(id, name) {
  if (!confirm(`למחוק את הסטטוס "${name}"?`)) return;
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'status', action: 'delete', id }) });
  APP.raw.statuses = APP.raw.statuses.filter(s => s.id !== id);
  renderStatusesList();
}

// ═══════════════════════════════════════════════════════
// MANAGE DEPARTMENTS
// ═══════════════════════════════════════════════════════
function openManageDepartments() {
  renderDepartmentsList();
  document.getElementById('departments-modal').classList.remove('hidden');
}

function closeManageDepartments() {
  document.getElementById('departments-modal').classList.add('hidden');
  const deptSel = document.getElementById('txn-dept');
  if (!deptSel) return;
  const currentVal = deptSel.value;
  deptSel.innerHTML = APP.raw.departments.map(d =>
    `<option value="${escHtml(d['שם'])}">${escHtml(d['שם'])}</option>`
  ).join('');
  if (APP.raw.departments.some(d => d['שם'] === currentVal)) {
    deptSel.value = currentVal;
    changeTxnDept(currentVal);
  } else if (APP.raw.departments.length > 0) {
    deptSel.value = APP.raw.departments[0]['שם'];
    changeTxnDept(APP.raw.departments[0]['שם']);
  }
}

function renderDepartmentsList() {
  const defaultDept = APP.raw.departments.find(d => d['ברירת_מחדל'] === 'TRUE');
  document.getElementById('departments-list').innerHTML =
    APP.raw.departments.map(d => `
      <div class="manage-item">
        <div style="display:flex;align-items:center;gap:8px">
          <input type="radio" name="dept-default" value="${escHtml(d.id)}"
            ${d.id === (defaultDept || {}).id ? 'checked' : ''}
            onchange="setDefaultDept('${escHtml(d.id)}')">
          <span>${escHtml(d['שם'])}</span>
        </div>
        <div class="manage-item-actions">
          <button class="action-btn del" data-id="${escHtml(d.id)}" data-name="${escHtml(d['שם'])}"
            onclick="deleteDepartment(this.dataset.id, this.dataset.name)">✕</button>
        </div>
      </div>`).join('');
}

async function addDepartment() {
  const name = document.getElementById('new-dept-name').value.trim();
  if (!name) return;
  const row = { id: String(Date.now()), שם: name, ברירת_מחדל: 'FALSE' };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'department', action: 'create', row }) });
  APP.raw.departments.push(row);
  document.getElementById('new-dept-name').value = '';
  renderDepartmentsList();
}

async function setDefaultDept(id) {
  const prev = APP.raw.departments.find(d => d['ברירת_מחדל'] === 'TRUE');
  if (prev && prev.id !== id) {
    const prevRow = { ...prev, ברירת_מחדל: 'FALSE' };
    await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ type: 'department', action: 'update', row: prevRow }) });
    prev['ברירת_מחדל'] = 'FALSE';
  }
  const next = APP.raw.departments.find(d => d.id === id);
  if (next) {
    const nextRow = { ...next, ברירת_מחדל: 'TRUE' };
    await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ type: 'department', action: 'update', row: nextRow }) });
    next['ברירת_מחדל'] = 'TRUE';
  }
}

async function deleteDepartment(id, name) {
  if (!confirm(`למחוק את המחלקה "${name}"?`)) return;
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'department', action: 'delete', id }) });
  APP.raw.departments = APP.raw.departments.filter(d => d.id !== id);
  renderDepartmentsList();
}

// ═══════════════════════════════════════════════════════
// SETTINGS PANEL — YEAR MANAGEMENT
// ═══════════════════════════════════════════════════════
function openSettings() {
  renderYearsList();
  document.getElementById('settings-overlay').classList.remove('hidden');
}

function closeSettings(event) {
  if (event && event.target !== document.getElementById('settings-overlay') &&
      event.type === 'click') return;
  document.getElementById('settings-overlay').classList.add('hidden');
}

function renderYearsList() {
  document.getElementById('years-list').innerHTML =
    APP.raw.budget.map(r => `
      <div class="year-manage-item">
        <strong>${escHtml(r['שנה'])}</strong>
        <span style="font-size:11px;color:#727272">תקציב:</span>
        <input type="number" class="form-input" value="${escHtml(r['תקציב_פתיחה'])}"
          data-year="${escHtml(r['שנה'])}" data-endmonth="${escHtml(r['חודש_סיום'])}"
          onchange="updateYear(this.dataset.year, this.value, this.dataset.endmonth)">
        <span style="font-size:11px;color:#727272">חודש סיום:</span>
        <input type="number" class="form-input" style="width:60px" min="1" max="12" value="${escHtml(r['חודש_סיום'])}"
          data-year="${escHtml(r['שנה'])}" data-budget="${escHtml(r['תקציב_פתיחה'])}"
          onchange="updateYear(this.dataset.year, this.dataset.budget, this.value)">
      </div>`).join('');
}

async function updateYear(yearStr, budget, endMonth) {
  const row = { שנה: yearStr, תקציב_פתיחה: budget, חודש_סיום: endMonth };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'year', action: 'update', row }) });
  const y = APP.raw.budget.find(r => r['שנה'] === yearStr);
  if (y) { y['תקציב_פתיחה'] = budget; y['חודש_סיום'] = endMonth; }
  renderKPIs();
}

async function addYear() {
  const yearStr  = document.getElementById('new-year-str').value.trim();
  const budget   = document.getElementById('new-year-budget').value;
  const endMonth = document.getElementById('new-year-endmonth').value || '8';
  if (!yearStr || !budget) return;

  const row = { שנה: yearStr, תקציב_פתיחה: budget, חודש_סיום: endMonth };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'year', action: 'create', row }) });

  APP.raw.budget.push(row);
  document.getElementById('new-year-str').value    = '';
  document.getElementById('new-year-budget').value = '';

  // Update year selector
  const sel = document.getElementById('year-select');
  const opt = document.createElement('option');
  opt.value = opt.textContent = yearStr;
  sel.appendChild(opt);

  renderYearsList();
}
