/* ============================================
   Erasmus+ Spending Tracker — Cloud Logic
   ============================================ */

// ---- Supabase Config (TO BE FILLED BY USER) ----
const SUPABASE_URL = 'https://kcmlrxswoiiunkreruvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Qg-uAvbjaRWvaf099xDeBg_q0oKJJue';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const EXCHANGE_RATE_PLN = 4.26;

// ---- State ----
let transactions = [];
let currency = 'EUR';
let user = null;
let sortField = 'date';
let sortDir = 'desc';
let searchQuery = '';
let filterCategory = 'all';
let globalDateFilter = 'all';
let spendingChart = null;
let categoryChart = null;
let timeView = 'daily';
let editingExpenseId = null;

// ---- Auth Logic ----
async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPass').value;
  const btn = document.getElementById('authBtn');

  btn.innerText = 'Verifying...';
  btn.disabled = true;

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    user = data.user;
    initApp();
  } catch (err) {
    alert('Login failed: ' + err.message);
    btn.innerText = 'Enter Dashboard';
    btn.disabled = false;
  }
}

async function initApp() {
  document.getElementById('loginState').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('headerRight').style.display = '';
  document.getElementById('headerStatus').innerText = `Logged in as ${user.email}`;
  document.getElementById('fabAdd').style.display = 'flex';

  // Populate category dropdown in modal
  const select = document.getElementById('expCategory');
  select.innerHTML = '';
  const cats = [...new Set(Object.keys(CATEGORY_CONFIG))].sort();
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = `${CATEGORY_CONFIG[c].icon} ${c}`;
    select.appendChild(opt);
  });

  await fetchData();
}

async function fetchData() {
  const { data, error } = await supabaseClient
    .from('spendings')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  transactions = data;
  populateCategoryFilter();
  populateGlobalDateFilter();
  populateMerchantList();
  render();
}

// ---- CRUD ----
async function handleNewExpense(e) {
  e.preventDefault();
  const date = document.getElementById('expDate').value; // Supabase likes YYYY-MM-DD
  const merchant = document.getElementById('expMerchant').value;
  const type = document.querySelector('input[name="expType"]:checked').value;
  const rawAmount = parseFloat(document.getElementById('expAmount').value);
  const amount = type === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount);
  const category = document.getElementById('expCategory').value;
  const city = document.getElementById('expCity').value;
  const country = document.getElementById('expCountry').value;
  const notes = document.getElementById('expNotes').value;

  const newEntry = {
    date,
    merchant,
    amount_eur: amount,
    amount_pln: amount * EXCHANGE_RATE_PLN,
    category,
    notes,
    city,
    country,
    user_id: user.id
  };

  let error;
  if (editingExpenseId) {
    const res = await supabaseClient.from('spendings').update(newEntry).eq('id', editingExpenseId);
    error = res.error;
  } else {
    const res = await supabaseClient.from('spendings').insert([newEntry]);
    error = res.error;
  }

  if (error) {
    alert('Error saving spending: ' + error.message);
  } else {
    toggleModal(false);
    await fetchData();
  }
}

function editExpense(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  
  editingExpenseId = id;
  
  let dtStr = t.date;
  if (dtStr.includes('/')) dtStr = dtStr.replace(/\//g, '-');
  const dt = new Date(dtStr);
  if (!isNaN(dt.getTime())) {
    const pad = n => n.toString().padStart(2, '0');
    document.getElementById('expDate').value = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
  } else {
    document.getElementById('expDate').value = dtStr;
  }
  
  document.getElementById('expMerchant').value = t.merchant;
  const typeValue = t.amount_eur < 0 ? 'expense' : 'income';
  document.querySelector(`input[name="expType"][value="${typeValue}"]`).checked = true;
  document.getElementById('expAmount').value = Math.abs(t.amount_eur);
  document.getElementById('expCategory').value = t.category;
  document.getElementById('expCity').value = t.city;
  document.getElementById('expCountry').value = t.country;
  document.getElementById('expNotes').value = t.notes || '';
  
  document.querySelector('.modal-header h3').textContent = 'Edit Spending';
  document.querySelector('#addExpenseForm button[type="submit"]').textContent = 'Update Expense';
  
  toggleModal(true);
}

async function deleteExpense(id) {
  if (!confirm("Are you sure you want to delete this specific spending?")) return;
  const { error } = await supabaseClient.from('spendings').delete().eq('id', id);
  if (error) {
    alert("Error deleting: " + error.message);
  } else {
    await fetchData();
  }
}

async function clearData() {
  if (confirm('Sign out of dashboard?')) {
    await supabaseClient.auth.signOut();
    window.location.reload();
  }
}

// ---- Category config with emoji icons & colors ----
const CATEGORY_CONFIG = {
  'Food & Drink': { icon: '🍕', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  'Food': { icon: '🍔', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  'Transport': { icon: '🚌', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'Groceries': { icon: '🛒', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'Shopping': { icon: '🛍️', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'Trips': { icon: '✈️', color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  'Home': { icon: '🏠', color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
  'Drinks': { icon: '🍻', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'Leisure': { icon: '🎯', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  'Services': { icon: '🔧', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  'Utilities': { icon: '⚡', color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  'ESN': { icon: '🎉', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  'Transfer': { icon: '💸', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  'Income': { icon: '💰', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  'Subscription': { icon: '🔄', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
  'Rent': { icon: '🏢', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  'Education': { icon: '🎓', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  'Necessities': { icon: '🧴', color: '#78716c', bg: 'rgba(120,113,108,0.12)' },
};

const COUNTRY_FLAGS = {
  'Poland': '🇵🇱',
  'Denmark': '🇩🇰',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Spain': '🇪🇸',
  'Italy': '🇮🇹',
  'Portugal': '🇵🇹',
  'Sweden': '🇸🇪',
  'Norway': '🇳🇴',
  'Finland': '🇫🇮',
  'Czech Republic': '🇨🇿',
  'Czechia': '🇨🇿',
  'Slovakia': '🇸🇰',
  'Hungary': '🇭🇺',
  'Austria': '🇦🇹',
  'Switzerland': '🇨🇭',
  'Netherlands': '🇳🇱',
  'Belgium': '🇧🇪',
  'UK': '🇬🇧',
  'United Kingdom': '🇬🇧',
  'Ireland': '🇮🇪',
  'Greece': '🇬🇷',
  'Croatia': '🇭🇷',
  'Lithuania': '🇱🇹',
  'Latvia': '🇱🇻',
  'Estonia': '🇪🇪',
  'Romania': '🇷🇴',
  'Bulgaria': '🇧🇬',
  'Slovenia': '🇸🇮',
  'Cyprus': '🇨🇾',
  'Malta': '🇲🇹',
  'Iceland': '🇮🇸',
  'USA': '🇺🇸',
  'Turkey': '🇹🇷'
};

function getFlag(country) {
  if (!country) return '🌍';
  const name = country.trim();
  const match = Object.keys(COUNTRY_FLAGS).find(k => k.toLowerCase() === name.toLowerCase());
  return match ? COUNTRY_FLAGS[match] : '🌍';
}

// ---- Parse CSV ----
function parseCSV(raw) {
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',');
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Smart CSV parsing that handles quoted fields
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    const date = fields[0];
    const merchant = fields[1];
    const amountEurRaw = fields[2] || '';
    const amountPlnRaw = fields[3] || '';
    const category = fields[4] || 'Other';
    const notes = fields[5] || '';
    const city = fields[6] || '';
    const country = fields[7] || '';

    const amountEur = parseAmount(amountEurRaw);
    const amountPln = parseAmount(amountPlnRaw);

    records.push({ date, merchant, amountEur, amountPln, category, notes, city, country });
  }

  return records;
}

function parseAmount(raw) {
  if (!raw || raw === '0') return 0;
  let cleaned = raw.replace(/[€złzł\s]/g, '');
  // Convert comma decimal to dot
  cleaned = cleaned.replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  setupCurrencyToggle();
  setupSearch();
  setupCategoryFilter();
  setupSortHeaders();
  setupTimeChartTabs();
  setupFileUpload();
  setupGlobalDateFilter();
  setupMerchantAutocomplete();

  // Check if session exists
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    user = session.user;
    initApp();
  }
});

function setupFileUpload() {
  const input = document.getElementById('csvUpload');
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvContent = event.target.result;
      await loadData(csvContent);
      e.target.value = ''; // Reset input so you can upload same file again
    };
    reader.readAsText(file);
  });
}

async function loadData(csvText) {
  if (!user) {
    alert("Please log in first before uploading data.");
    return;
  }
  try {
    const rawRecords = parseCSV(csvText);
    if (!rawRecords.length) return;

    // Convert local CSV keys to Supabase columns
    const mapped = rawRecords.map(r => ({
      date: r.date.replace(/\//g, '-'),
      merchant: r.merchant,
      amount_eur: r.amountEur,
      amount_pln: r.amountPln,
      category: r.category,
      notes: r.notes,
      city: r.city,
      country: r.country,
      user_id: user.id
    }));

    const { error } = await supabaseClient.from('spendings').insert(mapped);
    if (error) throw error;
    
    alert("CSV Imported Successfully! Dashboard will now update.");
    await fetchData();

  } catch (err) {
    console.error('Error importing CSV:', err);
    alert('Failed to import CSV: ' + err.message);
  }
}

// ---- CRUD Logic ----
function toggleModal(show) {
  const overlay = document.getElementById('modalOverlay');
  overlay.className = show ? 'modal-overlay active' : 'modal-overlay';
  if (show) {
    if (!editingExpenseId) {
      if (transactions && transactions.length > 0) {
        let dtStr = transactions[0].date;
        if (dtStr.includes('/')) dtStr = dtStr.replace(/\//g, '-');
        const dt = new Date(dtStr);
        if (!isNaN(dt.getTime())) {
          const pad = n => n.toString().padStart(2, '0');
          document.getElementById('expDate').value = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
        } else {
          document.getElementById('expDate').valueAsDate = new Date();
        }
        
        document.getElementById('expCity').value = transactions[0].city || '';
        document.getElementById('expCountry').value = transactions[0].country || '';
      } else {
        document.getElementById('expDate').valueAsDate = new Date();
      }
    }
  } else {
    editingExpenseId = null;
    document.getElementById('addExpenseForm').reset();
    document.querySelector('input[name="expType"][value="expense"]').checked = true;
    document.querySelector('.modal-header h3').textContent = 'Add New Spending';
    document.querySelector('#addExpenseForm button[type="submit"]').textContent = 'Save Expense';
  }
}

function transactionsToCSV(data) {
  const header = 'Date,Merchant,Amount_EUR,Amount_PLN,Category,Notes,City,Country';
  const rows = data.map(t => [
    t.date,
    `"${t.merchant.replace(/"/g, '""')}"`,
    `"${Number(t.amount_eur || 0).toFixed(2).replace('.', ',')} €"`,
    `"${Number(t.amount_pln || 0).toFixed(2).replace('.', ',')}"`,
    t.category,
    `"${(t.notes || '').replace(/"/g, '""')}"`,
    t.city,
    t.country
  ].join(','));
  return [header, ...rows].join('\n');
}

function exportToCSV() {
  const csvContent = transactionsToCSV(transactions);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `erasmus_spendings_updated_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Removed duplicate clearData to use the one at the top handling Supabase Auth

function render() {
  renderStats();
  renderCategoryGrid();
  renderCityGrid();
  renderTable();
  renderSpendingChart();
  renderCategoryChart();
  renderDateRange();
}

// ---- Currency Toggle ----
function setupCurrencyToggle() {
  const toggleEl = document.getElementById('currencyToggle');
  toggleEl.querySelectorAll('.currency-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleEl.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currency = btn.dataset.currency;
      render();
    });
  });
}

// ---- Helpers ----
function getAmount(t) {
  if (currency === 'EUR') {
    return t.amount_eur !== 0 ? t.amount_eur : (t.amount_pln / EXCHANGE_RATE_PLN);
  }
  return t.amount_pln !== 0 ? t.amount_pln : (t.amount_eur * EXCHANGE_RATE_PLN);
}

function fmt(val) {
  const abs = Math.abs(val);
  if (currency === 'EUR') {
    return `€${abs.toFixed(2)}`;
  }
  return `${abs.toFixed(2)} zł`;
}

function fmtSigned(val) {
  const abs = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  if (currency === 'EUR') {
    return `${sign}€${abs.toFixed(2)}`;
  }
  return `${sign}${abs.toFixed(2)} zł`;
}

function getExpenses() {
  return transactions.filter(t => getAmount(t) < 0 && isDateInFilter(t.date));
}

function getCatConfig(cat) {
  return CATEGORY_CONFIG[cat] || { icon: '📦', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
}

// ---- Date Range ----
function renderDateRange() {
  const activeDates = transactions.filter(t => isDateInFilter(t.date)).map(t => new Date(t.date.replace(/\//g, '-')));
  if (!activeDates.length) {
    document.getElementById('dateRange').textContent = '📅 No data in range';
    return;
  }
  const min = new Date(Math.min(...activeDates));
  const max = new Date(Math.max(...activeDates));
  const opts = { month: 'short', day: 'numeric' };
  document.getElementById('dateRange').textContent =
    `📅 ${min.toLocaleDateString('en-US', opts)} – ${max.toLocaleDateString('en-US', opts)}, ${max.getFullYear()}`;
}

// ---- Stats ----
function renderStats() {
  const expenses = getExpenses();
  const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(getAmount(t)), 0);
  const dates = [...new Set(expenses.map(t => t.date))];
  const dailyAvg = totalSpent / (dates.length || 1);
  const catTotals = {};
  expenses.forEach(t => {
    const cat = t.category;
    catTotals[cat] = (catTotals[cat] || 0) + Math.abs(getAmount(t));
  });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('totalSpent').textContent = fmt(totalSpent);
  document.getElementById('dailyAvg').textContent = fmt(dailyAvg);
  document.getElementById('transactionCount').textContent = transactions.length;
  document.getElementById('topCategory').textContent = topCat ? `${getCatConfig(topCat[0]).icon} ${topCat[0]}` : '–';
}

// ---- Category Grid ----
function renderCategoryGrid() {
  const grid = document.getElementById('categoryGrid');
  const expenses = getExpenses();
  const catData = {};
  expenses.forEach(t => {
    const cat = t.category;
    if (!catData[cat]) catData[cat] = { total: 0, count: 0 };
    catData[cat].total += Math.abs(getAmount(t));
    catData[cat].count++;
  });

  const sorted = Object.entries(catData).sort((a, b) => b[1].total - a[1].total);
  const maxTotal = sorted.length ? sorted[0][1].total : 1;

  grid.innerHTML = sorted.map(([cat, data], i) => {
    const cfg = getCatConfig(cat);
    return `
      <div class="category-card" style="animation-delay:${i * 0.04}s">
        <div class="category-icon" style="background:${cfg.bg}; color:${cfg.color}">
          ${cfg.icon}
        </div>
        <div class="category-info">
          <div class="category-name">${cat}</div>
          <div class="category-count">${data.count} transaction${data.count > 1 ? 's' : ''}</div>
          <div class="category-bar-bg">
            <div class="category-bar" style="width:${(data.total / maxTotal * 100).toFixed(1)}%; background:${cfg.color}"></div>
          </div>
        </div>
        <div class="category-amount" style="color:${cfg.color}">${fmt(data.total)}</div>
      </div>`;
  }).join('');
}

// ---- City Grid ----
function renderCityGrid() {
  const grid = document.getElementById('cityGrid');
  const expenses = getExpenses();
  const cityData = {};
  expenses.forEach(t => {
    const key = `${t.city}|${t.country}`;
    if (!cityData[key]) cityData[key] = { city: t.city, country: t.country, total: 0, count: 0 };
    cityData[key].total += Math.abs(getAmount(t));
    cityData[key].count++;
  });

  const sorted = Object.values(cityData).sort((a, b) => b.total - a.total);

  grid.innerHTML = sorted.map((cd, i) => {
    const flag = getFlag(cd.country);
    return `
      <div class="city-card" style="animation-delay:${i * 0.06}s">
        <div class="city-header">
          <div class="city-name">
            <span class="city-flag">${flag}</span>
            <h3>${cd.city}</h3>
          </div>
          <div class="city-total">${fmt(cd.total)}</div>
        </div>
        <div class="city-meta">
          <div class="city-meta-item"><strong>${cd.count}</strong> transactions</div>
          <div class="city-meta-item"><strong>${cd.country}</strong></div>
        </div>
      </div>`;
  }).join('');
}

// ---- Spending Chart ----
function setupTimeChartTabs() {
  document.getElementById('timeChartTabs').querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#timeChartTabs .chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      timeView = tab.dataset.view;
      renderSpendingChart();
    });
  });
}

function renderSpendingChart() {
  const ctx = document.getElementById('spendingChart').getContext('2d');
  const expenses = getExpenses();

  // Group by date
  const dateMap = {};
  expenses.forEach(t => {
    const d = t.date;
    dateMap[d] = (dateMap[d] || 0) + Math.abs(getAmount(t));
  });

  let labels, data;

  if (timeView === 'daily') {
    const sortedDates = Object.keys(dateMap).sort();
    labels = sortedDates.map(d => {
      const dt = new Date(d.replace(/\//g, '-'));
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    data = sortedDates.map(d => dateMap[d]);
  } else if (timeView === 'weekly') {
    // Weekly
    const weekMap = {};
    Object.entries(dateMap).forEach(([d, amt]) => {
      const dt = new Date(d.replace(/\//g, '-'));
      const weekStart = new Date(dt);
      weekStart.setDate(dt.getDate() - dt.getDay() + 1); // Monday
      const key = weekStart.toISOString().slice(0, 10);
      weekMap[key] = (weekMap[key] || 0) + amt;
    });
    const sortedWeeks = Object.keys(weekMap).sort();
    labels = sortedWeeks.map(w => {
      const dt = new Date(w);
      return `Week of ${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    });
    data = sortedWeeks.map(w => weekMap[w]);
  } else if (timeView === 'monthly') {
    // Monthly
    const monthMap = {};
    Object.entries(dateMap).forEach(([d, amt]) => {
      const dt = new Date(d.replace(/\//g, '-'));
      const key = dt.toISOString().slice(0, 7); // YYYY-MM
      monthMap[key] = (monthMap[key] || 0) + amt;
    });
    const sortedMonths = Object.keys(monthMap).sort();
    labels = sortedMonths.map(m => {
      const dt = new Date(m + '-01T00:00:00');
      return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    });
    data = sortedMonths.map(m => monthMap[m]);
  }

  if (spendingChart) spendingChart.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  spendingChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        hoverBackgroundColor: 'rgba(59, 130, 246, 0.75)',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(148, 163, 184, 0.15)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: ctx => fmt(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'Inter' },
            maxRotation: 45,
          },
          border: { display: false }
        },
        y: {
          grid: {
            color: 'rgba(148, 163, 184, 0.06)',
            drawBorder: false,
          },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'Inter' },
            callback: v => fmt(v)
          },
          border: { display: false }
        }
      }
    }
  });
}

// ---- Category Chart ----
function renderCategoryChart() {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const expenses = getExpenses();
  const catData = {};
  expenses.forEach(t => {
    catData[t.category] = (catData[t.category] || 0) + Math.abs(getAmount(t));
  });

  const sorted = Object.entries(catData).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([cat]) => `${getCatConfig(cat).icon} ${cat}`);
  const data = sorted.map(([, v]) => v);
  const colors = sorted.map(([cat]) => getCatConfig(cat).color);

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'rgba(10, 14, 26, 0.8)',
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { size: 10, family: 'Inter' },
            padding: 10,
            usePointStyle: true,
            pointStyleWidth: 8,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(148, 163, 184, 0.15)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${fmt(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ---- Merchant Autocomplete ----
function populateMerchantList() {
  const datalist = document.getElementById('merchantList');
  const merchants = [...new Set(transactions.map(t => t.merchant))].sort((a, b) => a.localeCompare(b));
  datalist.innerHTML = merchants.map(m => `<option value="${m.replace(/"/g, '&quot;')}">`).join('');
}

function setupMerchantAutocomplete() {
  const input = document.getElementById('expMerchant');
  input.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    if (!val) return;
    const match = transactions.find(t => t.merchant.toLowerCase() === val);
    if (match) {
      document.getElementById('expCategory').value = match.category;
    }
  });
}

// ---- Search & Filter ----
function setupSearch() {
  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase();
    renderTable();
  });
}

function setupCategoryFilter() {
  const select = document.getElementById('categoryFilter');
  select.addEventListener('change', e => {
    filterCategory = e.target.value;
    renderTable();
  });
}

function populateCategoryFilter() {
  const select = document.getElementById('categoryFilter');
  const currentVal = filterCategory || 'all';
  select.innerHTML = '<option value="all">All Categories</option>';
  const cats = [...new Set(transactions.map(t => t.category))].sort();
  cats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = `${getCatConfig(cat).icon} ${cat}`;
    if (currentVal === cat) opt.selected = true;
    select.appendChild(opt);
  });
}

function setupGlobalDateFilter() {
  document.getElementById('globalDateFilter').addEventListener('change', e => {
    globalDateFilter = e.target.value;
    render();
  });
}

function populateGlobalDateFilter() {
  const select = document.getElementById('globalDateFilter');
  const currentVal = globalDateFilter || 'all';
  
  select.innerHTML = '<option value="all">All Time</option>';
  
  const months = new Set();
  const weeks = new Set();
  
  transactions.forEach(t => {
    const dt = new Date(t.date.replace(/\//g, '-'));
    if (!isNaN(dt.getTime())) {
      const pad = n => n.toString().padStart(2, '0');
      months.add(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`); // YYYY-MM
      
      // Monday of the week
      const weekStart = new Date(dt);
      weekStart.setDate(dt.getDate() - dt.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const wY = weekStart.getFullYear();
      const wM = pad(weekStart.getMonth() + 1);
      const wD = pad(weekStart.getDate());
      weeks.add(`${wY}-${wM}-${wD}`);
    }
  });

  const optgroupMonths = document.createElement('optgroup');
  optgroupMonths.label = "Months";
  Array.from(months).sort().reverse().forEach(m => {
    const dt = new Date(m + '-01T00:00:00');
    const opt = document.createElement('option');
    opt.value = 'month:' + m;
    opt.textContent = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (currentVal === opt.value) opt.selected = true;
    optgroupMonths.appendChild(opt);
  });
  
  const optgroupWeeks = document.createElement('optgroup');
  optgroupWeeks.label = "Weeks";
  Array.from(weeks).sort().reverse().forEach(w => {
    const dt = new Date(w);
    const opt = document.createElement('option');
    opt.value = 'week:' + w;
    opt.textContent = `Week of ${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    if (currentVal === opt.value) opt.selected = true;
    optgroupWeeks.appendChild(opt);
  });

  if (optgroupMonths.children.length > 0) select.appendChild(optgroupMonths);
  if (optgroupWeeks.children.length > 0) select.appendChild(optgroupWeeks);
}

function isDateInFilter(dateStr) {
  if (globalDateFilter === 'all') return true;
  const d = new Date(dateStr.replace(/\//g, '-'));
  if (isNaN(d.getTime())) return true; // invalid date, don't throw
  
  const pad = n => n.toString().padStart(2, '0');
  
  if (globalDateFilter.startsWith('month:')) {
    const yyyymm = globalDateFilter.split(':')[1];
    const m = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    return m === yyyymm;
  }
  
  if (globalDateFilter.startsWith('week:')) {
    const weekStr = globalDateFilter.split(':')[1];
    const weekStart = new Date(weekStr);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return d >= weekStart && d < weekEnd;
  }
  
  return true;
}

// ---- Sort Headers ----
function setupSortHeaders() {
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortDir = field === 'date' ? 'desc' : 'asc';
      }
      document.querySelectorAll('.sortable').forEach(h => h.classList.remove('active-sort'));
      th.classList.add('active-sort');
      th.querySelector('.sort-icon').textContent = sortDir === 'asc' ? '↑' : '↓';
      renderTable();
    });
  });
}

// ---- Transactions Table ----
function renderTable() {
  let filtered = transactions.filter(t => isDateInFilter(t.date));

  // Filter
  if (filterCategory !== 'all') {
    filtered = filtered.filter(t => t.category === filterCategory);
  }

  // Search
  if (searchQuery) {
    filtered = filtered.filter(t =>
      t.merchant.toLowerCase().includes(searchQuery) ||
      t.category.toLowerCase().includes(searchQuery) ||
      t.notes.toLowerCase().includes(searchQuery) ||
      t.city.toLowerCase().includes(searchQuery)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let va, vb;
    switch (sortField) {
      case 'date':
        va = a.date; vb = b.date;
        break;
      case 'merchant':
        va = a.merchant.toLowerCase(); vb = b.merchant.toLowerCase();
        break;
      case 'amount':
        va = Math.abs(getAmount(a)); vb = Math.abs(getAmount(b));
        break;
      default:
        va = a.date; vb = b.date;
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = document.getElementById('transactionsBody');
  tbody.innerHTML = filtered.map(t => {
    const amt = getAmount(t);
    const amtClass = amt >= 0 ? 'positive' : 'negative';
    const cfg = getCatConfig(t.category);
    const dt = new Date(t.date.replace(/\//g, '-'));
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const flag = getFlag(t.country);

    return `
      <tr>
        <td class="td-date">${dateStr}</td>
        <td class="td-merchant">${t.merchant}</td>
        <td>
          <span class="td-category">
            <span class="td-category-icon">${cfg.icon}</span>
            <span class="td-category-label">${t.category}</span>
          </span>
        </td>
        <td class="td-notes">${t.notes}</td>
        <td class="td-city">${flag} ${t.city}</td>
        <td class="td-amount ${amtClass}">${fmtSigned(amt)}</td>
        <td class="td-actions text-right">
          <button class="edit-inline-btn" onclick="editExpense('${t.id}')" title="Edit Expense">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="delete-inline-btn" onclick="deleteExpense('${t.id}')" title="Delete Expense">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');
}
