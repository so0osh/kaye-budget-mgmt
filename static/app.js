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
          <button class="action-btn" onclick="editReserve('${r.id}')">✎</button>
          <button class="action-btn del" onclick="deleteReserve('${r.id}','${r['שם']}')">✕</button>
        </div>
        <div class="reserve-name">${r['שם']}</div>
        <div class="reserve-amount" style="color:${color}">₪${parseFloat(r['סכום']).toLocaleString()}</div>
        <div class="reserve-desc">${r['תיאור'] || ''}</div>
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
      <input type="text" id="rsv-name" class="form-input" value="${r ? r['שם'] : ''}">
    </div>
    <div class="form-row">
      <label>סכום (₪)</label>
      <input type="number" id="rsv-amount" class="form-input" min="0" step="0.01" value="${r ? r['סכום'] : ''}">
    </div>
    <div class="form-row">
      <label>תיאור</label>
      <input type="text" id="rsv-desc" class="form-input" value="${r ? r['תיאור'] : ''}">
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
let _carouselOffset = 0;
const PILLS_VISIBLE  = 6;

function renderCarousel() {
  const cfg      = APP.raw.budget.find(r => r['שנה'] === APP.year) || {};
  const endMonth = parseInt(cfg['חודש_סיום']) || 8;
  const months   = getYearMonths(APP.year, endMonth);

  // Auto-focus current month on first render
  if (APP.month === null) {
    const now = new Date();
    const cur = months.find(m => m.month === now.getMonth() + 1 && m.year === now.getFullYear());
    APP.month = cur || null;
    // Set carousel offset so current month is visible
    const idx = cur ? months.indexOf(cur) : 0;
    _carouselOffset = Math.max(0, idx - Math.floor(PILLS_VISIBLE / 2));
  }

  const pills = document.getElementById('month-pills');
  const slice = months.slice(_carouselOffset, _carouselOffset + PILLS_VISIBLE);

  const allActive = APP.month === null;
  pills.innerHTML =
    `<div class="month-pill all ${allActive ? 'active' : ''}" onclick="selectMonth(null)">הכל</div>` +
    slice.map(({ year, month }) => {
      const active = APP.month && APP.month.month === month && APP.month.year === year;
      return `<div class="month-pill ${active ? 'active' : ''}"
        onclick="selectMonth(${month},${year})">${HEB_MONTHS[month]}</div>`;
    }).join('');
}

function scrollCarousel(dir) {
  const cfg      = APP.raw.budget.find(r => r['שנה'] === APP.year) || {};
  const endMonth = parseInt(cfg['חודש_סיום']) || 8;
  const months   = getYearMonths(APP.year, endMonth);
  _carouselOffset = Math.max(0, Math.min(_carouselOffset + dir, months.length - PILLS_VISIBLE));
  renderCarousel();
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
  const supSel = document.getElementById('filter-supplier');
  const stSel  = document.getElementById('filter-status');

  supSel.innerHTML = '<option value="">כל הספקים</option>' +
    APP.raw.suppliers.filter(s => s['פעיל'] === 'TRUE')
      .map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');

  stSel.innerHTML = '<option value="">כל הסטטוסים</option>' +
    APP.raw.statuses.map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');

  supSel.value = APP.filter.supplier;
  stSel.value  = APP.filter.status;
}

function applyFilters() {
  APP.filter.supplier = document.getElementById('filter-supplier').value;
  APP.filter.status   = document.getElementById('filter-status').value;
  renderJournal();
}

function clearFilters() {
  APP.filter = { supplier: '', status: '' };
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
    const color  = APP.colors[r['ספק']] || '#ccc';
    const status = APP.raw.statuses.find(s => s['שם'] === r['סטטוס']);
    const badgeColor = status ? status['צבע'] : '#727272';
    const badgeBg    = badgeColor + '22';
    return `<tr>
      <td>${r['תאריך']}</td>
      <td><span class="supplier-dot" style="background:${color}"></span>${r['ספק']}</td>
      <td style="color:#727272;font-size:12px">${r['מס_חשבונית'] || '—'}</td>
      <td style="color:#727272">${r['תיאור'] || ''}</td>
      <td class="amount-cell">₪${parseFloat(r['סכום']).toLocaleString()}</td>
      <td><span class="status-badge" style="background:${badgeBg};color:${badgeColor}">${r['סטטוס']}</span></td>
      <td class="no-print"><div class="row-actions">
        <button class="action-btn" onclick="openTransactionModal('${r.id}')">✎</button>
        <button class="action-btn del" onclick="deleteTransaction('${r.id}','${r['ספק']}','${r['תאריך']}')">✕</button>
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
  document.querySelector('.modal-body').innerHTML = `
    <input type="hidden" id="txn-id">
    <div class="form-row">
      <label>תאריך</label>
      <input type="date" id="txn-date" class="form-input">
    </div>
    <div class="form-row">
      <label>ספק <button class="link-btn no-print" onclick="openManageSuppliers()">נהל ספקים</button></label>
      <select id="txn-supplier" class="form-input"></select>
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

function openTransactionModal(id) {
  _restoreTransactionForm();

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');

  // Populate supplier dropdown
  const supSel = document.getElementById('txn-supplier');
  supSel.innerHTML = APP.raw.suppliers
    .filter(s => s['פעיל'] === 'TRUE')
    .map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');

  // Populate status dropdown
  const stSel = document.getElementById('txn-status');
  stSel.innerHTML = APP.raw.statuses
    .map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');

  if (id) {
    const r = APP.raw.transactions.find(t => t.id === id);
    document.getElementById('modal-title').textContent = 'עריכת תנועה';
    document.getElementById('txn-id').value          = r.id;
    document.getElementById('txn-date').value        = isoDate(r['תאריך']);
    document.getElementById('txn-supplier').value    = r['ספק'];
    document.getElementById('txn-invoice').value     = r['מס_חשבונית'];
    document.getElementById('txn-description').value = r['תיאור'];
    document.getElementById('txn-amount').value      = r['סכום'];
    document.getElementById('txn-status').value      = r['סטטוס'];
  } else {
    document.getElementById('modal-title').textContent = 'הוספת תנועה';
    document.getElementById('txn-date').value = new Date().toISOString().slice(0,10);
  }
}

// Convert DD/MM/YYYY → YYYY-MM-DD for date input
function isoDate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

// Convert YYYY-MM-DD → DD/MM/YYYY for storage
function heDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function saveTransaction() {
  const id      = document.getElementById('txn-id').value;
  const dateVal = document.getElementById('txn-date').value;
  const amount  = document.getElementById('txn-amount').value;
  if (!dateVal || !amount) return;

  const row = {
    id:          id || String(Date.now()),
    שנה:         APP.year,
    תאריך:       heDate(dateVal),
    ספק:         document.getElementById('txn-supplier').value,
    מס_חשבונית: document.getElementById('txn-invoice').value.trim(),
    תיאור:       document.getElementById('txn-description').value.trim(),
    סכום:        amount,
    סטטוס:       document.getElementById('txn-status').value,
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
