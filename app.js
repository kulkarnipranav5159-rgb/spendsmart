// ===== CONFIG =====
// Change this to your Java backend URL when running it
const API_BASE = 'http://localhost:8080/api';

// ===== STATE =====
let currentUser = null;
let expenses = [];
let budget = 10000;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('expDate').valueAsDate = new Date();
  document.getElementById('overviewDate').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Check if already logged in (localStorage fallback for demo)
  const saved = localStorage.getItem('spendSmartUser');
  if (saved) {
    const userData = JSON.parse(saved);
    currentUser = userData.username;
    budget = userData.budget || 10000;
    expenses = JSON.parse(localStorage.getItem('expenses_' + currentUser) || '[]');
    showDashboard();
  }
});

// ===== NAVIGATION =====
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const map = { overview: 0, addExpense: 1, expenses: 2, insights: 3 };
  const navItems = document.querySelectorAll('.nav-item');
  if (navItems[map[id]]) navItems[map[id]].classList.add('active');

  if (id === 'overview') updateOverview();
  if (id === 'expenses') renderExpenses();
  if (id === 'insights') renderInsights();
}

function showLogin() { showPage('loginPage'); }
function showRegister() { showPage('registerPage'); }

// ===== AUTH =====
async function login() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value.trim();
  const errorEl = document.getElementById('loginError');

  if (!username || !password) { errorEl.textContent = 'Please fill in all fields.'; return; }

  try {
    // Try Java backend first
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      const data = await res.json();
      currentUser = data.username;
      budget = data.budget;
      await fetchExpensesFromAPI();
      saveSession();
      showDashboard();
      return;
    }
  } catch (e) {
    // Backend not running — use localStorage demo mode
    console.log('Backend offline — using demo mode');
  }

  // Demo mode fallback
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  if (!users[username]) { errorEl.textContent = 'User not found.'; return; }
  if (users[username].password !== password) { errorEl.textContent = 'Wrong password.'; return; }

  currentUser = username;
  budget = users[username].budget;
  expenses = JSON.parse(localStorage.getItem('expenses_' + currentUser) || '[]');
  saveSession();
  errorEl.textContent = '';
  showDashboard();
}

async function register() {
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value.trim();
  const budgetVal = parseInt(document.getElementById('regBudget').value) || 10000;
  const errorEl = document.getElementById('regError');

  if (!username || !password) { errorEl.textContent = 'Please fill in all fields.'; return; }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, budget: budgetVal })
    });

    if (res.ok) {
      errorEl.style.color = 'var(--success)';
      errorEl.textContent = 'Registered! Please login.';
      setTimeout(showLogin, 1200);
      return;
    }
  } catch (e) {
    console.log('Backend offline — using demo mode');
  }

  // Demo mode
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  if (users[username]) { errorEl.textContent = 'Username already exists.'; return; }
  users[username] = { password, budget: budgetVal };
  localStorage.setItem('users', JSON.stringify(users));
  errorEl.style.color = 'var(--success)';
  errorEl.textContent = '✅ Registered! Please login.';
  setTimeout(showLogin, 1200);
}

function logout() {
  localStorage.removeItem('spendSmartUser');
  currentUser = null;
  expenses = [];
  showPage('loginPage');
}

function saveSession() {
  localStorage.setItem('spendSmartUser', JSON.stringify({ username: currentUser, budget }));
  localStorage.setItem('expenses_' + currentUser, JSON.stringify(expenses));
}

// ===== DASHBOARD =====
function showDashboard() {
  showPage('dashboard');
  document.getElementById('sidebarUser').textContent = '👤 ' + currentUser;
  showSection('overview');
}

// ===== EXPENSES =====
async function addExpense() {
  const amount = parseFloat(document.getElementById('expAmount').value);
  const category = document.getElementById('expCategory').value;
  const date = document.getElementById('expDate').value;
  const description = document.getElementById('expDesc').value || category;

  if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
  if (!date) { alert('Please select a date.'); return; }

  const expense = { amount, category, date, description, userId: currentUser };

  try {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    });
    if (res.ok) {
      const saved = await res.json();
      expenses.push(saved);
    } else { throw new Error(); }
  } catch (e) {
    expense.id = Date.now();
    expenses.push(expense);
  }

  saveSession();

  // Show success
  const s = document.getElementById('addSuccess');
  s.classList.remove('hidden');
  setTimeout(() => s.classList.add('hidden'), 2500);

  // Reset form
  document.getElementById('expAmount').value = '';
  document.getElementById('expDesc').value = '';
  document.getElementById('expDate').valueAsDate = new Date();
}

async function fetchExpensesFromAPI() {
  try {
    const res = await fetch(`${API_BASE}/expenses?userId=${currentUser}`);
    if (res.ok) expenses = await res.json();
  } catch (e) {
    expenses = JSON.parse(localStorage.getItem('expenses_' + currentUser) || '[]');
  }
}

// ===== OVERVIEW =====
function updateOverview() {
  const now = new Date();
  const thisMonthExp = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const total = thisMonthExp.reduce((s, e) => s + e.amount, 0);
  const left = budget - total;

  document.getElementById('statThisMonth').textContent = '₹' + total.toLocaleString('en-IN');
  document.getElementById('statBudgetLeft').textContent = '₹' + Math.max(0, left).toLocaleString('en-IN');
  document.getElementById('statCount').textContent = expenses.length;

  // Top category
  const catTotals = {};
  thisMonthExp.forEach(e => catTotals[e.category] = (catTotals[e.category] || 0) + e.amount);
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('statTopCat').textContent = topCat ? topCat[0] : '—';

  // Budget alert
  const alertEl = document.getElementById('budgetAlert');
  if (total > budget) {
    alertEl.classList.remove('hidden');
    alertEl.textContent = `⚠️ Budget Exceeded! You've spent ₹${total.toLocaleString('en-IN')} against your ₹${budget.toLocaleString('en-IN')} monthly budget.`;
  } else if (total > budget * 0.8) {
    alertEl.classList.remove('hidden');
    alertEl.style.borderColor = 'rgba(247,152,106,0.4)';
    alertEl.style.color = '#f7986a';
    alertEl.textContent = `⚡ You've used ${Math.round((total/budget)*100)}% of your monthly budget. ₹${left.toLocaleString('en-IN')} remaining.`;
  } else {
    alertEl.classList.add('hidden');
  }

  drawPieChart(catTotals);
  drawBarChart();
}

// ===== PIE CHART =====
const COLORS = ['#7c6af7','#f7986a','#6af7b8','#f76a9e','#6ab4f7','#f7e96a','#c96af7','#6af7e9'];
const CAT_EMOJI = {
  Food:'🍔', Travel:'✈️', Shopping:'🛍️', Entertainment:'🎬',
  Health:'💊', Education:'📚', Bills:'💡', Other:'📦'
};

function drawPieChart(catTotals) {
  const canvas = document.getElementById('pieChart');
  const ctx = canvas.getContext('2d');
  canvas.width = 220; canvas.height = 220;
  ctx.clearRect(0, 0, 220, 220);

  const total = Object.values(catTotals).reduce((a, b) => a + b, 0);
  if (total === 0) {
    ctx.fillStyle = '#2a2a3a';
    ctx.beginPath();
    ctx.arc(110, 110, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7070a0';
    ctx.font = '14px DM Sans';
    ctx.textAlign = 'center';
    ctx.fillText('No data', 110, 115);
    document.getElementById('pieLegend').innerHTML = '';
    return;
  }

  const entries = Object.entries(catTotals);
  let startAngle = -Math.PI / 2;
  let legendHtml = '';

  entries.forEach(([cat, val], i) => {
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(110, 110);
    ctx.arc(110, 110, 90, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#0a0a0f';
    ctx.lineWidth = 2;
    ctx.stroke();
    startAngle += slice;
    legendHtml += `<div class="legend-item"><div class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></div>${cat}</div>`;
  });

  // Center hole
  ctx.beginPath();
  ctx.arc(110, 110, 44, 0, Math.PI * 2);
  ctx.fillStyle = '#13131a';
  ctx.fill();
  ctx.fillStyle = '#f0f0f8';
  ctx.font = 'bold 14px Syne';
  ctx.textAlign = 'center';
  ctx.fillText('₹' + Math.round(total / 1000) + 'K', 110, 114);

  document.getElementById('pieLegend').innerHTML = legendHtml;
}

// ===== BAR CHART =====
function drawBarChart() {
  const canvas = document.getElementById('barChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 480;
  canvas.width = W; canvas.height = 240;
  ctx.clearRect(0, 0, W, 240);

  // Get last 6 months
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleString('en-IN', { month: 'short' }), month: d.getMonth(), year: d.getFullYear(), total: 0 });
  }

  expenses.forEach(e => {
    const d = new Date(e.date);
    const m = months.find(mo => mo.month === d.getMonth() && mo.year === d.getFullYear());
    if (m) m.total += e.amount;
  });

  const max = Math.max(...months.map(m => m.total), budget);
  const pad = { left: 50, right: 20, top: 20, bottom: 36 };
  const chartW = W - pad.left - pad.right;
  const chartH = 240 - pad.top - pad.bottom;
  const barW = chartW / months.length * 0.5;
  const gap = chartW / months.length;

  // Budget line
  const budgetY = pad.top + chartH - (budget / max) * chartH;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(247,74,74,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, budgetY);
  ctx.lineTo(W - pad.right, budgetY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bars
  months.forEach((m, i) => {
    const x = pad.left + i * gap + gap / 2 - barW / 2;
    const barH = (m.total / max) * chartH;
    const y = pad.top + chartH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#7c6af7');
    grad.addColorStop(1, 'rgba(124,106,247,0.3)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
    ctx.fill();

    // Label
    ctx.fillStyle = '#7070a0';
    ctx.font = '12px DM Sans';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, x + barW / 2, 240 - 8);

    // Value
    if (m.total > 0) {
      ctx.fillStyle = '#f0f0f8';
      ctx.font = '11px DM Sans';
      ctx.fillText('₹' + Math.round(m.total / 1000) + 'K', x + barW / 2, y - 6);
    }
  });
}

// ===== RENDER EXPENSES =====
function renderExpenses() {
  const cat = document.getElementById('filterCat').value;
  const period = document.getElementById('filterPeriod').value;
  const now = new Date();

  let filtered = expenses.filter(e => {
    if (cat !== 'All' && e.category !== cat) return false;
    if (period === 'month') {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (period === 'week') {
      const d = new Date(e.date);
      const weekAgo = new Date(now - 7 * 86400000);
      return d >= weekAgo;
    }
    return true;
  });

  filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  const container = document.getElementById('expenseList');
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No expenses found.</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(e => {
    const emoji = CAT_EMOJI[e.category] || '📦';
    const catColors = {
      Food:'rgba(247,152,106,0.15)', Travel:'rgba(106,180,247,0.15)',
      Shopping:'rgba(247,106,158,0.15)', Entertainment:'rgba(198,106,247,0.15)',
      Health:'rgba(106,247,184,0.15)', Education:'rgba(247,233,106,0.15)',
      Bills:'rgba(247,74,74,0.15)', Other:'rgba(124,106,247,0.15)'
    };
    const bg = catColors[e.category] || 'rgba(124,106,247,0.15)';
    const dateStr = new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return `
      <div class="expense-item">
        <div class="expense-left">
          <div class="exp-cat-badge" style="background:${bg}">${emoji}</div>
          <div class="exp-info">
            <div class="exp-desc">${e.description}</div>
            <div class="exp-meta">${e.category} • ${dateStr}</div>
          </div>
        </div>
        <div class="exp-amount">₹${e.amount.toLocaleString('en-IN')}</div>
      </div>`;
  }).join('');
}

// ===== INSIGHTS =====
function renderInsights() {
  const now = new Date();
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === (now.getMonth() - 1 + 12) % 12 &&
      d.getFullYear() === (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  });

  const total = thisMonth.reduce((s, e) => s + e.amount, 0);
  const lastTotal = lastMonth.reduce((s, e) => s + e.amount, 0);

  const catTotals = {};
  thisMonth.forEach(e => catTotals[e.category] = (catTotals[e.category] || 0) + e.amount);

  const insights = [];

  // Budget status
  if (total > budget) {
    insights.push({ icon: '🚨', type: 'danger', title: 'Budget Exceeded!', desc: `You've spent ₹${total.toLocaleString('en-IN')} this month, which is ₹${(total - budget).toLocaleString('en-IN')} over your ₹${budget.toLocaleString('en-IN')} budget. Consider cutting back on non-essentials.` });
  } else {
    const pct = Math.round((total / budget) * 100);
    insights.push({ icon: '✅', type: 'success', title: 'Within Budget', desc: `You've used ${pct}% of your monthly budget. ₹${(budget - total).toLocaleString('en-IN')} remaining. You're on track!` });
  }

  // Month-on-month comparison
  if (lastTotal > 0) {
    const change = ((total - lastTotal) / lastTotal * 100).toFixed(1);
    if (total > lastTotal) {
      insights.push({ icon: '📈', type: 'warning', title: 'Spending Increased', desc: `Your spending is up ${change}% compared to last month (₹${lastTotal.toLocaleString('en-IN')} → ₹${total.toLocaleString('en-IN')}).` });
    } else {
      insights.push({ icon: '📉', type: 'success', title: 'Spending Decreased', desc: `Great job! You spent ${Math.abs(change)}% less than last month (₹${lastTotal.toLocaleString('en-IN')} → ₹${total.toLocaleString('en-IN')}).` });
    }
  }

  // Category-wise
  Object.entries(catTotals).forEach(([cat, val]) => {
    const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
    if (pct > 40) {
      insights.push({ icon: CAT_EMOJI[cat] || '📦', type: 'warning', title: `High ${cat} Spending`, desc: `${cat} accounts for ${pct}% of your spending this month (₹${val.toLocaleString('en-IN')}). Consider setting a limit.` });
    }
  });

  // Food-specific tip
  if (catTotals['Food'] && catTotals['Food'] > budget * 0.3) {
    insights.push({ icon: '🍱', type: 'info', title: 'Food Saving Tip', desc: 'Try meal prepping or cooking at home more often. You could save ₹2,000–₹5,000/month by reducing restaurant visits.' });
  }

  // Shopping-specific
  if (catTotals['Shopping'] && catTotals['Shopping'] > budget * 0.25) {
    insights.push({ icon: '💡', type: 'info', title: 'Shopping Suggestion', desc: 'Your shopping spend is high. Try the 24-hour rule: wait 24 hours before making non-essential purchases.' });
  }

  // No data
  if (thisMonth.length === 0) {
    insights.push({ icon: '📊', type: 'info', title: 'No Data Yet', desc: 'Start adding your expenses to get personalized insights and spending analysis.' });
  }

  const container = document.getElementById('insightsContainer');
  container.innerHTML = insights.map(ins => `
    <div class="insight-card ${ins.type}">
      <span class="insight-icon">${ins.icon}</span>
      <div class="insight-title">${ins.title}</div>
      <div class="insight-desc">${ins.desc}</div>
    </div>
  `).join('');
}
