/**
 * MindPulse SPA Application Core Logic
 * Handles Authentication, API Calls, Chart rendering, and Interactive State
 */

const API_BASE = window.location.origin.includes('8000') 
  ? '/api' 
  : 'http://127.0.0.1:8000/api';

let authToken = localStorage.getItem("mindpulse_token") || "";
let charts = {};

// Default Demo User Info
const DEMO_USER = {
  email: "demo@mindpulse.io",
  password: "Password123!"
};

// Application Initialization
document.addEventListener("DOMContentLoaded", () => {
  if (authToken) {
    hideAuthModal();
    loadDashboardData();
    loadHabits();
  } else {
    showAuthModal();
  }
});

// Auth Handlers
function showAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "flex";
}

function hideAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "none";
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Invalid login credentials");
    }

    const data = await res.json();
    authToken = data.access_token;
    localStorage.setItem("mindpulse_token", authToken);

    hideAuthModal();
    loadDashboardData();
    loadHabits();
  } catch (err) {
    alert(`Login Failed: ${err.message}`);
  }
}

async function autoDemoLogin() {
  document.getElementById("loginEmail").value = DEMO_USER.email;
  document.getElementById("loginPassword").value = DEMO_USER.password;
  await handleLogin();
}

function logout() {
  localStorage.removeItem("mindpulse_token");
  authToken = "";
  showAuthModal();
}

// Password reset request UI handler
function showResetRequestModal() {
  const modal = document.getElementById("resetRequestModal");
  if (modal) modal.style.display = "flex";
}
function hideResetRequestModal() {
  const modal = document.getElementById("resetRequestModal");
  if (modal) modal.style.display = "none";
}
async function handleResetRequest(e) {
  if (e) e.preventDefault();
  const email = document.getElementById("resetEmail").value;
  try {
    const res = await fetch(`${API_BASE}/auth/reset-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    alert(data.message || "Password reset email sent.");
    hideResetRequestModal();
  } catch (err) {
    alert(`Reset request failed: ${err.message}`);
  }
}

// Password reset confirmation UI handler (expects token in URL)
function showResetConfirmModal(token) {
  const modal = document.getElementById("resetConfirmModal");
  if (modal) {
+    // Store token in hidden field
+    const tokenInput = document.getElementById("resetToken");
+    if (tokenInput) tokenInput.value = token;
+    modal.style.display = "flex";
+  }
}
async function handleResetConfirm(e) {
  if (e) e.preventDefault();
  const token = document.getElementById("resetToken").value;
  const newPassword = document.getElementById("newPassword").value;
  try {
    const res = await fetch(`${API_BASE}/auth/reset-confirm`, {
+      method: "POST",
+      headers: { "Content-Type": "application/json" },
+      body: JSON.stringify({ token, new_password: newPassword })
+    });
+    const data = await res.json();
+    alert(data.message || "Password reset successful.");
+    // After success, redirect to login
+    hideResetConfirmModal();
+    showAuthModal();
+  } catch (err) {
+    alert(`Reset confirm failed: ${err.message}`);
+  }
}
function hideResetConfirmModal() {
  const modal = document.getElementById("resetConfirmModal");
  if (modal) modal.style.display = "none";
}


// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add("active");

  const navItem = Array.from(document.querySelectorAll(".nav-item")).find(el => el.getAttribute("onclick")?.includes(tabId));
  if (navItem) navItem.classList.add("active");

  const titleMap = {
    dashboard: ["Dashboard", "Multi-dimensional health overview and today's summary"],
    prediction: ["AI Stress Risk Engine", "Explainable machine learning risk predictions"],
    mood: ["Mood Tracker", "Daily emotional valence & arousal tracking"],
    stress: ["Stress & HRV Tracker", "Biometric heart rate variability and perceived stress correlation"],
    sleep: ["Sleep & Physical Activity", "Circadian rest analysis and physical exertion metrics"],
    habits: ["Habit Tracker", "Daily routine consistency and habit streaks"],
    analytics: ["90-Day Analytics", "Multi-variable longitudinal trend analysis"],
    settings: ["Settings & Privacy", "Account preferences, data export, and privacy governance"]
  };

  if (titleMap[tabId]) {
    document.getElementById("pageTitle").innerText = titleMap[tabId][0];
    document.getElementById("pageSubtitle").innerText = titleMap[tabId][1];
  }

  // Render specific tab charts when activated
  if (tabId === "prediction") runMLPrediction();
  if (tabId === "mood") renderMoodChart();
  if (tabId === "stress") renderStressHrvChart();
  if (tabId === "sleep") renderSleepChart();
  if (tabId === "analytics") renderAnalyticsChart();
}

function openLogModal() {
  switchTab('mood');
}

// Fetch & Load Dashboard Data
async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/summary`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    if (data.today_mood) document.getElementById("dashMoodScore").innerText = data.today_mood.mood_score || "5.0";
    if (data.today_sleep) document.getElementById("dashSleepDuration").innerText = data.today_sleep.sleep_duration_hours || "7.5";
    if (data.latest_prediction) {
      document.getElementById("dashRiskScore").innerText = data.latest_prediction.risk_score || "35";
      const badge = document.getElementById("dashRiskBadge");
      badge.innerText = `${(data.latest_prediction.risk_level || 'low').toUpperCase()} RISK`;
      badge.className = `metric-status status-${data.latest_prediction.risk_level || 'low'}`;
    }

    renderDashboardTrendChart(data.weekly_trend || []);
  } catch (err) {
    console.warn("Using sample dashboard fallback:", err);
    renderDashboardTrendChart([]);
  }
}

// Render Dashboard 7-Day Trend Chart
function renderDashboardTrendChart(trendData) {
  const ctx = document.getElementById("dashboardTrendChart")?.getContext("2d");
  if (!ctx) return;

  if (charts.dashboard) charts.dashboard.destroy();

  const labels = trendData.length ? trendData.map(d => d.date) : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const stressScores = trendData.length ? trendData.map(d => d.stress_score) : [42, 58, 65, 40, 35, 28, 32];
  const sleepHours = trendData.length ? trendData.map(d => d.sleep_hours) : [6.5, 6.2, 5.8, 7.5, 8.0, 8.2, 7.8];

  charts.dashboard = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Stress Score (0-100)",
          data: stressScores,
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.15)",
          borderWidth: 3,
          tension: 0.4,
          fill: true
        },
        {
          label: "Sleep Duration (hrs)",
          data: sleepHours,
          borderColor: "#06b6d4",
          borderWidth: 3,
          tension: 0.4,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9ca3af" } },
        y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9ca3af" }, min: 0, max: 100 },
        y1: { position: "right", grid: { drawOnChartArea: false }, ticks: { color: "#06b6d4" }, min: 0, max: 12 }
      },
      plugins: {
        legend: { labels: { color: "#f9fafb" } }
      }
    }
  });
}

// AI Stress Risk Prediction
async function runMLPrediction() {
  try {
    const res = await fetch(`${API_BASE}/predictions/latest`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    
    let predData;
    if (res.ok) {
      const body = await res.json();
      predData = body.prediction || body;
    } else {
      const triggerRes = await fetch(`${API_BASE}/predictions/evaluate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" }
      });
      predData = await triggerRes.json();
    }

    const score = predData.risk_score || 42;
    const level = predData.risk_level || "moderate";

    document.getElementById("predRiskScore").innerText = score;
    const badge = document.getElementById("predRiskBadge");
    if (badge) {
      badge.innerText = `${level.toUpperCase()} RISK`;
      badge.className = `metric-status status-${level}`;
    }

    const circle = document.getElementById("riskGaugeCircle");
    if (circle) {
      const colorMap = { low: "#10b981", moderate: "#f59e0b", elevated: "#f97316", high: "#ef4444" };
      const color = colorMap[level] || "#8b5cf6";
      circle.style.background = `conic-gradient(${color} ${score}%, var(--border-color) ${score}%)`;
    }

    renderFactorImpactChart(predData.factors || [
      { factor_name: "Stress Assessment", impact_pct: 65, direction: "increases_risk" },
      { factor_name: "Sleep", impact_pct: 20, direction: "reduces_risk" },
      { factor_name: "Activity", impact_pct: 15, direction: "reduces_risk" }
    ]);
  } catch (err) {
    console.warn("Prediction API error fallback:", err);
  }
}

function renderFactorImpactChart(factors) {
  const ctx = document.getElementById("factorImpactChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.factors) charts.factors.destroy();

  const labels = factors.map(f => f.factor_name);
  const data = factors.map(f => f.impact_pct);
  const colors = factors.map(f => f.direction === "increases_risk" ? "#ef4444" : "#10b981");

  charts.factors = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Impact Contribution (%)",
        data: data,
        backgroundColor: colors,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9ca3af" } },
        y: { grid: { display: false }, ticks: { color: "#f9fafb" } }
      }
    }
  });
}

// Form Submission Handlers
async function handleMoodSubmit(e) {
  if (e) e.preventDefault();
  const moodScore = parseInt(document.getElementById("moodScoreInput").value);
  const emotion = document.getElementById("moodEmotionInput").value;
  const notes = document.getElementById("moodNotesInput").value;

  try {
    const res = await fetch(`${API_BASE}/mood`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        mood_score: Math.min(5, Math.max(1, Math.round(moodScore / 2))),
        emotions: emotion,
        note: notes
      })
    });
    if (res.ok) {
      alert("Mood entry recorded successfully!");
      loadDashboardData();
      renderMoodChart();
    }
  } catch (err) {
    alert("Could not save mood entry: " + err.message);
  }
}

async function handleStressSubmit(e) {
  if (e) e.preventDefault();
  const rating = parseInt(document.getElementById("stressRatingInput").value);

  try {
    const res = await fetch(`${API_BASE}/stress`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        q_stress: Math.min(5, Math.max(1, Math.round(rating / 2))),
        q_sleep_quality: 4,
        q_energy: 4,
        q_concentration_difficulty: 2,
        q_workload: 3,
        q_social_connection: 4,
        q_physical_activity: 4,
        q_anxious_overwhelmed: 2
      })
    });
    if (res.ok) {
      alert("Stress assessment recorded successfully!");
      loadDashboardData();
      renderStressHrvChart();
    }
  } catch (err) {
    alert("Could not save stress assessment: " + err.message);
  }
}

async function handleSleepSubmit(e) {
  if (e) e.preventDefault();
  const duration = parseFloat(document.getElementById("sleepDurationInput").value);
  const quality = parseInt(document.getElementById("sleepQualityInput").value);

  try {
    const res = await fetch(`${API_BASE}/sleep`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        duration_hours: duration,
        quality: Math.min(5, Math.max(1, Math.round(quality / 2)))
      })
    });
    if (res.ok) {
      alert("Sleep record saved successfully!");
      loadDashboardData();
      renderSleepChart();
    }
  } catch (err) {
    alert("Could not save sleep record: " + err.message);
  }
}

// Mood Chart
function renderMoodChart() {
  const ctx = document.getElementById("moodTrendChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.mood) charts.mood.destroy();

  charts.mood = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Array.from({length: 14}, (_, i) => `Oct ${i+1}`),
      datasets: [{
        label: "Mood Score (1-5)",
        data: [4, 5, 4, 3, 5, 4, 5, 4, 3, 4, 5, 4, 5, 4],
        backgroundColor: "rgba(6, 182, 212, 0.6)",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 1, max: 5, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9ca3af" } },
        x: { grid: { display: false }, ticks: { color: "#9ca3af" } }
      }
    }
  });
}

// Stress & HRV Chart
function renderStressHrvChart() {
  const ctx = document.getElementById("stressHrvChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.stress) charts.stress.destroy();

  charts.stress = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({length: 14}, (_, i) => `Oct ${i+1}`),
      datasets: [
        { label: "Stress Score", data: [45, 50, 68, 55, 40, 32, 28, 48, 52, 60, 42, 35, 30, 38], borderColor: "#f43f5e", tension: 0.3 },
        { label: "HRV (ms)", data: [55, 52, 41, 48, 62, 68, 74, 54, 50, 44, 60, 66, 72, 65], borderColor: "#10b981", tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9ca3af" } },
        x: { grid: { display: false }, ticks: { color: "#9ca3af" } }
      }
    }
  });
}

// Sleep & Activity Chart
function renderSleepChart() {
  const ctx = document.getElementById("sleepActivityChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.sleep) charts.sleep.destroy();

  charts.sleep = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({length: 14}, (_, i) => `Oct ${i+1}`),
      datasets: [
        { label: "Sleep Duration (hrs)", data: [7.2, 6.8, 5.9, 7.5, 8.1, 8.4, 7.8, 7.0, 6.5, 6.0, 7.8, 8.2, 8.0, 7.6], borderColor: "#06b6d4", tension: 0.4 },
        { label: "Active Minutes", data: [45, 30, 20, 60, 75, 90, 45, 40, 35, 25, 50, 65, 80, 55], borderColor: "#8b5cf6", tension: 0.4, yAxisID: "y1" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 12, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#06b6d4" } },
        y1: { position: "right", min: 0, max: 120, grid: { drawOnChartArea: false }, ticks: { color: "#8b5cf6" } },
        x: { grid: { display: false }, ticks: { color: "#9ca3af" } }
      }
    }
  });
}

// Analytics Chart
function renderAnalyticsChart() {
  const ctx = document.getElementById("analyticsMultiChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.analytics) charts.analytics.destroy();

  charts.analytics = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({length: 30}, (_, i) => `Day ${i+1}`),
      datasets: [
        { label: "Stress Score", data: Array.from({length: 30}, () => Math.floor(Math.random() * 40) + 30), borderColor: "#8b5cf6", tension: 0.3 },
        { label: "Sleep Quality", data: Array.from({length: 30}, () => Math.floor(Math.random() * 3) + 3), borderColor: "#06b6d4", tension: 0.3, yAxisID: "y1" },
        { label: "HRV (ms)", data: Array.from({length: 30}, () => Math.floor(Math.random() * 30) + 45), borderColor: "#10b981", tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9ca3af" } },
        y1: { position: "right", min: 1, max: 5, grid: { drawOnChartArea: false }, ticks: { color: "#06b6d4" } },
        x: { grid: { display: false }, ticks: { color: "#9ca3af" } }
      }
    }
  });
}

// Habits Management
async function loadHabits() {
  try {
    const res = await fetch(`${API_BASE}/habits`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (!res.ok) return;
    const habits = await res.json();

    const container = document.getElementById("habitContainer");
    if (!container) return;
    container.innerHTML = "";

    habits.forEach(h => {
      const item = document.createElement("div");
      item.className = "habit-item";
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px;">
          <div class="habit-check ${h.completed_today ? 'completed' : ''}" onclick="toggleHabit('${h.id}', ${!h.completed_today})">
            ${h.completed_today ? '✓' : ''}
          </div>
          <div>
            <h4 style="font-weight: 600;">${h.name}</h4>
            <p style="font-size: 12px; color: var(--text-muted);">${h.category} • Target: ${h.target_days_per_week} days/week</p>
          </div>
        </div>
        <div style="font-size: 13px; font-weight: 600; color: var(--accent-purple);">
          🔥 ${h.streak_days || 0} Day Streak
        </div>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    console.warn("Habits load failed:", err);
  }
}

async function promptNewHabit() {
  const name = prompt("Enter new habit name (e.g. Evening Journaling):");
  if (!name) return;

  try {
    await fetch(`${API_BASE}/habits`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        category: "Mindfulness",
        target_days_per_week: 7
      })
    });
    loadHabits();
  } catch (err) {
    alert("Could not add habit");
  }
}

async function toggleHabit(habitId, completed) {
  try {
    await fetch(`${API_BASE}/habits/${habitId}/log`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ completed: completed })
    });
    loadHabits();
  } catch (err) {
    alert("Could not update habit");
  }
}

async function handleSaveSettings(e) {
  if (e) e.preventDefault();
  const goal = document.getElementById("settingGoal").value;

  try {
    const res = await fetch(`${API_BASE}/users/me/preferences`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ wellness_goal: goal })
    });
    if (res.ok) {
      alert("Preferences saved successfully!");
    }
  } catch (err) {
    alert("Could not save preferences: " + err.message);
  }
}

// Data Export & Deletion
async function exportUserData() {
  try {
    const res = await fetch(`${API_BASE}/users/me/export`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindpulse_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  } catch (err) {
    alert("Export failed: " + err.message);
  }
}

async function deleteAccountData() {
  if (!confirm("Are you sure you want to permanently delete your account and all associated metrics? This action cannot be undone.")) return;

  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.ok) {
      alert("Account deleted successfully.");
      logout();
    }
  } catch (err) {
    alert("Deletion failed.");
  }
}
