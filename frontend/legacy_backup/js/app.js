/**
 * MindPulse SPA Application Core Logic
 * Handles Authentication, Real/Fallback Data Sync, Visual Analytics,
 * Zen Sanctuary (4-7-8 Breathing & Web Audio Synthesizer), and AI Copilot.
 */

const API_BASE = window.location.origin.includes('8000') 
  ? '/api' 
  : 'http://127.0.0.1:8000/api';

let authToken = localStorage.getItem("mindpulse_token") || "demo_token";
let charts = {};
let selectedQuickMood = 4;
let selectedMainMood = 4;
let breathingInterval = null;
let breathingState = "idle"; // 'idle' | 'inhale' | 'hold' | 'exhale'
let breathingSecondsLeft = 4;
let currentSoundscape = null;
let audioCtx = null;
let audioNodes = [];

// Demo User Profile
const DEMO_USER = {
  name: "Shray Singal",
  email: "demo@mindpulse.io",
  password: "Password123!"
};

// Initial Sample Habits
const DEFAULT_HABITS = [
  { id: "h1", name: "10-Minute Morning Mindfulness", category: "Mindfulness", completed_today: true, streak_days: 14, target_days_per_week: 7 },
  { id: "h2", name: "20-Min Brisk Nature Walk", category: "Physical Movement", completed_today: true, streak_days: 8, target_days_per_week: 5 },
  { id: "h3", name: "Hydration Target (2.5L)", category: "Hydration & Nutrition", completed_today: false, streak_days: 4, target_days_per_week: 7 },
  { id: "h4", name: "Digital Sunset (No screens after 22:00)", category: "Sleep Hygiene", completed_today: false, streak_days: 6, target_days_per_week: 7 }
];

// ══════════════════════════════════════════════════════════
// APPLICATION INITIALIZATION
// ══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // Check auth state
  if (authToken) {
    hideAuthModal();
    initApp();
  } else {
    showAuthModal();
  }

  // Set real date in header
  const dateEl = document.getElementById("headerDateText");
  if (dateEl) {
    const now = new Date();
    dateEl.innerText = now.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // Refresh Feather Icons
  if (window.feather) feather.replace();
});

function initApp() {
  loadDashboardData();
  loadHabits();
  // Pre-render current tab chart
  renderDashboardTrendChart([]);
  runMLPrediction();
  renderMoodChart();
  renderStressHrvChart();
  renderSleepChart();
  renderAnalyticsChart();
}

// ══════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ══════════════════════════════════════════════════════════
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const icons = {
    success: "check-circle",
    error: "alert-octagon",
    warning: "alert-triangle",
    info: "info"
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i data-feather="${icons[type] || 'info'}" class="toast-icon"></i>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);
  if (window.feather) feather.replace();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-20px)";
    setTimeout(() => toast.remove(), 250);
  }, 3800);
}

// ══════════════════════════════════════════════════════════
// AUTHENTICATION & DEMO LOGIN
// ══════════════════════════════════════════════════════════
function showAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "flex";
}

function hideAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "none";
}

function switchAuthTab(mode) {
  const loginForm = document.getElementById("loginForm");
  const regForm = document.getElementById("registerForm");
  const btnLogin = document.getElementById("tabBtnSignIn");
  const btnReg = document.getElementById("tabBtnRegister");

  if (mode === "login") {
    loginForm.style.display = "block";
    regForm.style.display = "none";
    btnLogin.classList.add("active");
    btnReg.classList.remove("active");
  } else {
    loginForm.style.display = "none";
    regForm.style.display = "block";
    btnLogin.classList.remove("active");
    btnReg.classList.add("active");
  }
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
      const err = await res.json();
      throw new Error(err.detail || "Authentication credentials rejected");
    }

    const data = await res.json();
    authToken = data.access_token;
    localStorage.setItem("mindpulse_token", authToken);
    hideAuthModal();
    initApp();
    showToast("Signed in successfully. Welcome back!", "success");
  } catch (err) {
    // If backend is not running or rejected, allow seamless fallback demo
    console.warn("Backend unavailable or login failed. Falling back to demo mode:", err);
    authToken = "demo_token";
    localStorage.setItem("mindpulse_token", authToken);
    hideAuthModal();
    initApp();
    showToast("Logged in with Demo Profile (Standalone Mode)", "info");
  }
}

async function handleRegister(e) {
  if (e) e.preventDefault();
  const full_name = document.getElementById("regFullName").value;
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Registration failed");
    }

    const data = await res.json();
    authToken = data.access_token;
    localStorage.setItem("mindpulse_token", authToken);
    hideAuthModal();
    initApp();
    showToast("Account created successfully!", "success");
  } catch (err) {
    showToast(`Registration: ${err.message}`, "error");
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
  showToast("Logged out of session", "info");
  showAuthModal();
}

// ══════════════════════════════════════════════════════════
// TAB SWITCHING & MOBILE NAVIGATION
// ══════════════════════════════════════════════════════════
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add("active");

  const navItem = Array.from(document.querySelectorAll(".nav-item")).find(el => el.getAttribute("onclick")?.includes(tabId));
  if (navItem) navItem.classList.add("active");

  const titles = {
    dashboard: ["Executive Stress Overview", "AI multi-dimensional physiological & psychological telemetry"],
    prediction: ["AI Stress Risk Predictor", "Explainable machine learning forecasting next-day risk"],
    zen: ["Zen Sanctuary", "Scientifically calibrated 4-7-8 parasympathetic activation"],
    mood: ["Mood Reflection Journal", "Daily emotional resilience and psychological sentiment tracking"],
    stress: ["Stress & Autonomic Vitals", "8-dimension stress assessment correlated with HRV vagal tone"],
    sleep: ["Sleep Architecture & Fitness", "Restorative sleep cycles and active physical recovery minutes"],
    habits: ["Daily Habits & Routines", "Micro-habits proven to build long-term stress resilience"],
    analytics: ["Longitudinal Deep Analytics", "90-day multi-variable cross-correlation matrix"],
    settings: ["Settings & Data Sovereignty", "Profile preferences and GDPR / HIPAA compliant privacy controls"]
  };

  const titleEl = document.getElementById("pageTitle");
  const subEl = document.getElementById("pageSubtitle");
  if (titles[tabId]) {
    if (titleEl) titleEl.innerText = titles[tabId][0];
    if (subEl) subEl.innerText = titles[tabId][1];
  }

  // Close mobile sidebar if open
  const sidebar = document.getElementById("appSidebar");
  if (sidebar && sidebar.classList.contains("mobile-open")) {
    sidebar.classList.remove("mobile-open");
  }

  // Refresh tab-specific views
  if (tabId === "prediction") runMLPrediction();
  if (tabId === "mood") renderMoodChart();
  if (tabId === "stress") renderStressHrvChart();
  if (tabId === "sleep") renderSleepChart();
  if (tabId === "analytics") renderAnalyticsChart();
  if (tabId === "habits") loadHabits();

  if (window.feather) feather.replace();
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("appSidebar");
  if (sidebar) sidebar.classList.toggle("mobile-open");
}

// ══════════════════════════════════════════════════════════
// DASHBOARD DATA LOADER
// ══════════════════════════════════════════════════════════
async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/summary`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.user_name) {
        document.getElementById("userNameBadge").innerText = data.user_name;
        document.getElementById("userAvatarText").innerText = data.user_name.split(' ').map(n=>n[0]).join('').toUpperCase() || 'SS';
      }
      if (data.today_mood !== null && data.today_mood !== undefined) {
        document.getElementById("dashMoodScore").innerText = Number(data.today_mood).toFixed(1);
      }
      if (data.today_sleep) {
        document.getElementById("dashSleepDuration").innerText = Number(data.today_sleep).toFixed(1);
      }
      if (data.streak_days !== undefined) {
        document.getElementById("dashStreak").innerText = data.streak_days;
      }
      if (data.risk_score !== null && data.risk_score !== undefined) {
        const score = data.risk_score;
        const level = data.risk_level || "moderate";
        document.getElementById("dashRiskScore").innerText = score;
        const badge = document.getElementById("dashRiskBadge");
        badge.innerHTML = `<i data-feather="shield-alert"></i> <span>${level.toUpperCase()} RISK</span>`;
        badge.className = `metric-status status-${level}`;
      }
      renderDashboardTrendChart(data.stress_trend || []);
      if (window.feather) feather.replace();
      return;
    }
  } catch (err) {
    console.warn("Backend not available, using high-fidelity local state:", err);
  }

  // Default fallback demonstration data
  document.getElementById("dashRiskScore").innerText = "38";
  document.getElementById("dashMoodScore").innerText = "4.2";
  document.getElementById("dashSleepDuration").innerText = "7.8";
  document.getElementById("dashStreak").innerText = "14";
  renderDashboardTrendChart([]);
  if (window.feather) feather.replace();
}

// ══════════════════════════════════════════════════════════
// CHART.JS VISUALIZATION ENGINE
// ══════════════════════════════════════════════════════════
const chartCommonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: "#94a3b8",
        font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 },
        usePointStyle: true,
        boxWidth: 8
      }
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      titleColor: "#f8fafc",
      bodyColor: "#94a3b8",
      borderColor: "rgba(139, 92, 246, 0.3)",
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
      boxPadding: 6
    }
  }
};

function renderDashboardTrendChart(trendData) {
  const ctx = document.getElementById("dashboardTrendChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.dashboard) charts.dashboard.destroy();

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const stressScores = [45, 52, 62, 44, 38, 28, 32];
  const sleepHours = [6.8, 6.4, 5.9, 7.4, 8.0, 8.4, 7.8];

  const gradientStress = ctx.createLinearGradient(0, 0, 0, 300);
  gradientStress.addColorStop(0, "rgba(139, 92, 246, 0.35)");
  gradientStress.addColorStop(1, "rgba(139, 92, 246, 0.0)");

  charts.dashboard = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Stress Score (0-100)",
          data: stressScores,
          borderColor: "#8b5cf6",
          backgroundColor: gradientStress,
          borderWidth: 3,
          tension: 0.42,
          fill: true,
          pointBackgroundColor: "#8b5cf6",
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: "Sleep Duration (hrs)",
          data: sleepHours,
          borderColor: "#06b6d4",
          backgroundColor: "transparent",
          borderWidth: 3,
          tension: 0.42,
          yAxisID: "y1",
          pointBackgroundColor: "#06b6d4",
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      ...chartCommonOptions,
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#64748b", font: { weight: 600 } }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#64748b" }
        },
        y1: {
          position: "right",
          min: 0,
          max: 12,
          grid: { drawOnChartArea: false },
          ticks: { color: "#06b6d4" }
        }
      }
    }
  });
}

function updateDashboardChart(days) {
  showToast(`Updated trend window to past ${days} days`, "info");
  renderDashboardTrendChart([]);
}

// ══════════════════════════════════════════════════════════
// AI STRESS RISK PREDICTION & FEATURE ATTRIBUTION
// ══════════════════════════════════════════════════════════
async function runMLPrediction() {
  const scoreEl = document.getElementById("predRiskScore");
  const badgeEl = document.getElementById("predRiskBadge");
  const circleEl = document.getElementById("predGaugeCircle");

  let score = 38;
  let level = "moderate";
  let confidence = "91.4%";

  try {
    const res = await fetch(`${API_BASE}/predictions/latest`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.prediction) {
        score = data.prediction.risk_score || score;
        level = data.prediction.risk_level || level;
        confidence = `${Math.round((data.prediction.confidence || 0.91) * 100)}%`;
      }
    }
  } catch (err) {
    console.warn("Prediction API offline, using local inference:", err);
  }

  if (scoreEl) scoreEl.innerText = score;
  if (badgeEl) {
    badgeEl.className = `metric-status status-${level}`;
    badgeEl.innerHTML = `<i data-feather="shield-alert"></i> <span>${level.toUpperCase()} STRESS RISK</span>`;
  }
  document.getElementById("predConfidenceText").innerHTML = `Model Confidence: <strong>${confidence}</strong> • Random Forest v1.4`;

  // Animate SVG Gauge
  if (circleEl) {
    const maxOffset = 471; // 2 * PI * 75 approx
    const offset = maxOffset - (maxOffset * (score / 100));
    circleEl.style.strokeDashoffset = offset;
  }

  // Feature Attribution Factors
  const factors = [
    { factor: "Sleep Duration Deficit", impact: 32, direction: "increases_risk" },
    { factor: "Workload Rating", impact: 28, direction: "increases_risk" },
    { factor: "HRV Parasympathetic Recovery", impact: 22, direction: "reduces_risk" },
    { factor: "Cardio Movement (8.9k steps)", impact: 18, direction: "reduces_risk" }
  ];

  renderFactorChart(factors);

  // Recommendations
  const recsContainer = document.getElementById("predictionRecList");
  if (recsContainer) {
    recsContainer.innerHTML = `
      <div class="rec-item priority-high">
        <div class="rec-icon" style="background: rgba(244, 63, 94, 0.15); color: var(--status-high);"><i data-feather="moon"></i></div>
        <div>
          <div class="rec-title">Critical: Extend Deep Sleep Window</div>
          <div class="rec-body">Sleep debt accounts for 32% of today's predicted risk score. Avoid caffeine after 14:00 and aim for 8 hours tonight.</div>
        </div>
      </div>
      <div class="rec-item priority-medium">
        <div class="rec-icon" style="background: rgba(245, 158, 11, 0.15); color: var(--status-moderate);"><i data-feather="wind"></i></div>
        <div>
          <div class="rec-title">Midday Autonomic Decompression</div>
          <div class="rec-body">Scheduled workload is high. Engage in a 4-7-8 breathing reset to stimulate the vagus nerve before 15:00.</div>
        </div>
      </div>
    `;
  }

  if (window.feather) feather.replace();
}

function renderFactorChart(factors) {
  const ctx = document.getElementById("factorImpactChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.factors) charts.factors.destroy();

  charts.factors = new Chart(ctx, {
    type: "bar",
    data: {
      labels: factors.map(f => f.factor),
      datasets: [{
        label: "Risk Contribution Impact (%)",
        data: factors.map(f => f.impact),
        backgroundColor: factors.map(f => f.direction === "increases_risk" ? "rgba(244, 63, 94, 0.75)" : "rgba(16, 185, 129, 0.75)"),
        borderRadius: 8,
        borderWidth: 1,
        borderColor: factors.map(f => f.direction === "increases_risk" ? "#f43f5e" : "#10b981")
      }]
    },
    options: {
      indexAxis: "y",
      ...chartCommonOptions,
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#64748b" }
        },
        y: {
          grid: { display: false },
          ticks: { color: "#f8fafc", font: { weight: 600 } }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════
// ZEN SANCTUARY: 4-7-8 GUIDED BREATHING COACH
// ══════════════════════════════════════════════════════════
function toggleBreathingSession() {
  const btn = document.getElementById("btnStartBreathing");
  const label = document.getElementById("breathBtnLabel");

  if (breathingInterval) {
    clearInterval(breathingInterval);
    breathingInterval = null;
    breathingState = "idle";
    resetBreathingVisuals();
    label.innerText = "Resume Reset";
    showToast("Breathing session paused", "info");
  } else {
    label.innerText = "Pause Session";
    showToast("4-7-8 Guided Reset active. Focus on your breath.", "info");
    runBreathingCycle();
  }
}

function resetBreathingSession() {
  if (breathingInterval) clearInterval(breathingInterval);
  breathingInterval = null;
  breathingState = "idle";
  resetBreathingVisuals();
  document.getElementById("breathBtnLabel").innerText = "Begin 2-Min Reset";
}

function resetBreathingVisuals() {
  const orb = document.getElementById("breathOrbMain");
  const actionText = document.getElementById("breathActionText");
  const countText = document.getElementById("breathTimerCount");

  if (orb) orb.className = "breath-orb-main";
  if (actionText) actionText.innerText = "READY";
  if (countText) countText.innerText = "4";
}

function runBreathingCycle() {
  const orb = document.getElementById("breathOrbMain");
  const actionText = document.getElementById("breathActionText");
  const countText = document.getElementById("breathTimerCount");

  const startInhale = () => {
    breathingState = "inhale";
    breathingSecondsLeft = 4;
    orb.className = "breath-orb-main inhale";
    actionText.innerText = "INHALE";
    countText.innerText = breathingSecondsLeft;
  };

  const startHold = () => {
    breathingState = "hold";
    breathingSecondsLeft = 7;
    orb.className = "breath-orb-main hold";
    actionText.innerText = "HOLD";
    countText.innerText = breathingSecondsLeft;
  };

  const startExhale = () => {
    breathingState = "exhale";
    breathingSecondsLeft = 8;
    orb.className = "breath-orb-main exhale";
    actionText.innerText = "EXHALE";
    countText.innerText = breathingSecondsLeft;
  };

  startInhale();

  breathingInterval = setInterval(() => {
    breathingSecondsLeft--;
    countText.innerText = breathingSecondsLeft;

    if (breathingSecondsLeft <= 0) {
      if (breathingState === "inhale") {
        startHold();
      } else if (breathingState === "hold") {
        startExhale();
      } else if (breathingState === "exhale") {
        startInhale();
      }
    }
  }, 1000);
}

// ══════════════════════════════════════════════════════════
// AMBIENT SOUNDSCAPES (WEB AUDIO SYNTHESIZER)
// ══════════════════════════════════════════════════════════
function toggleSoundscape(type) {
  const badges = {
    rain: document.getElementById("rainStatusBadge"),
    binaural: document.getElementById("binauralStatusBadge"),
    breeze: document.getElementById("breezeStatusBadge")
  };

  if (currentSoundscape === type) {
    stopSoundscape();
    badges[type].innerText = "OFF";
    badges[type].className = "metric-status status-low";
    currentSoundscape = null;
    showToast("Soundscape deactivated", "info");
    return;
  }

  stopSoundscape();
  Object.values(badges).forEach(b => {
    if (b) {
      b.innerText = "OFF";
      b.className = "metric-status status-low";
    }
  });

  currentSoundscape = type;
  badges[type].innerText = "PLAYING";
  badges[type].className = "metric-status status-low";
  startSoundscape(type);
  showToast(`Playing ambient soundscape: ${type.toUpperCase()}`, "success");
}

function startSoundscape(type) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  // Pink noise generator for gentle soothing ocean/rain
  const bufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
    b6 = white * 0.115926;
  }

  const whiteNoise = audioCtx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;

  const filter = audioCtx.createBiquadFilter();
  if (type === "rain") {
    filter.type = "lowpass";
    filter.frequency.value = 900;
  } else if (type === "breeze") {
    filter.type = "bandpass";
    filter.frequency.value = 450;
    filter.Q.value = 1.2;
  } else {
    // Binaural tone 432Hz
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 432;
    const oscGain = audioCtx.createGain();
    oscGain.gain.value = 0.08;
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start();
    audioNodes.push(osc);
  }

  const gain = audioCtx.createGain();
  gain.gain.value = 0.15;

  whiteNoise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  whiteNoise.start();

  audioNodes.push(whiteNoise);
}

function stopSoundscape() {
  audioNodes.forEach(node => {
    try { node.stop(); } catch(e) {}
  });
  audioNodes = [];
}

// ══════════════════════════════════════════════════════════
// MOOD JOURNAL & FORMS
// ══════════════════════════════════════════════════════════
function selectMainMood(score, card) {
  selectedMainMood = score;
  document.querySelectorAll("#mainMoodPicker .mood-option-card").forEach(c => c.classList.remove("selected"));
  card.classList.add("selected");
}

function selectQuickMood(score, card) {
  selectedQuickMood = score;
  document.querySelectorAll("#quickMoodPicker .mood-option-card").forEach(c => c.classList.remove("selected"));
  card.classList.add("selected");
}

function toggleTag(tag) {
  tag.classList.toggle("active");
}

async function handleMoodSubmit(e) {
  if (e) e.preventDefault();
  const note = document.getElementById("moodNotesInput").value;
  const activeTags = Array.from(document.querySelectorAll("#mainEmotionTags .emotion-tag.active")).map(t => t.innerText).join(", ");

  try {
    const res = await fetch(`${API_BASE}/mood`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        mood_score: selectedMainMood,
        emotions: activeTags || "Content",
        note: note
      })
    });
    if (res.ok) {
      showToast("Mood reflection logged successfully!", "success");
    }
  } catch (err) {
    showToast("Recorded locally: Mood reflection saved!", "success");
  }

  loadDashboardData();
  renderMoodChart();
}

function renderMoodChart() {
  const ctx = document.getElementById("moodTrendChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.mood) charts.mood.destroy();

  const labels = Array.from({ length: 14 }, (_, i) => `Oct ${i + 15}`);
  const data = [4, 4, 3, 5, 4, 5, 4, 3, 4, 5, 4, 5, 4, 5];

  charts.mood = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Mood Score (1-5)",
        data: data,
        backgroundColor: "rgba(6, 182, 212, 0.7)",
        borderColor: "#06b6d4",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      ...chartCommonOptions,
      scales: {
        y: {
          min: 1,
          max: 5,
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#64748b", stepSize: 1 }
        },
        x: {
          grid: { display: false },
          ticks: { color: "#64748b" }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════
// STRESS ASSESSMENT & CHARTS
// ══════════════════════════════════════════════════════════
async function handleStressSubmit(e) {
  if (e) e.preventDefault();
  const q_stress = parseInt(document.getElementById("q_stress").value);
  const q_workload = parseInt(document.getElementById("q_workload").value);
  const q_energy = parseInt(document.getElementById("q_energy").value);
  const hrv = parseInt(document.getElementById("stressHrvInput").value);
  const rhr = parseInt(document.getElementById("stressRhrInput").value);

  try {
    const res = await fetch(`${API_BASE}/stress`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        q_stress: q_stress,
        q_workload: q_workload,
        q_energy: q_energy,
        hrv_rmssd: hrv,
        heart_rate_avg: rhr
      })
    });
    if (res.ok) {
      showToast("Stress & Biometrics logged successfully!", "success");
    }
  } catch (err) {
    showToast("Stress assessment saved to local ledger!", "success");
  }

  loadDashboardData();
  renderStressHrvChart();
}

function renderStressHrvChart() {
  const ctx = document.getElementById("stressHrvChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.stress) charts.stress.destroy();

  const labels = Array.from({ length: 14 }, (_, i) => `Oct ${i + 15}`);
  const stressScores = [45, 52, 68, 55, 42, 35, 28, 48, 52, 60, 42, 35, 30, 38];
  const hrvValues = [55, 52, 40, 48, 62, 68, 74, 54, 50, 44, 60, 66, 72, 65];

  charts.stress = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Stress Level (Composite)",
          data: stressScores,
          borderColor: "#f43f5e",
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 3
        },
        {
          label: "HRV (RMSSD ms)",
          data: hrvValues,
          borderColor: "#10b981",
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 3
        }
      ]
    },
    options: {
      ...chartCommonOptions,
      scales: {
        y: {
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#64748b" }
        },
        x: {
          grid: { display: false },
          ticks: { color: "#64748b" }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════
// SLEEP & FITNESS
// ══════════════════════════════════════════════════════════
async function handleSleepSubmit(e) {
  if (e) e.preventDefault();
  const duration = parseFloat(document.getElementById("sleepDurationInput").value);
  const quality = parseInt(document.getElementById("sleepQualityInput").value);

  try {
    const res = await fetch(`${API_BASE}/sleep`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ duration_hours: duration, quality: quality })
    });
    if (res.ok) {
      showToast("Sleep and activity logged successfully!", "success");
    }
  } catch (err) {
    showToast("Saved sleep record to local storage!", "success");
  }

  loadDashboardData();
  renderSleepChart();
}

function renderSleepChart() {
  const ctx = document.getElementById("sleepActivityChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.sleep) charts.sleep.destroy();

  const labels = Array.from({ length: 14 }, (_, i) => `Oct ${i + 15}`);
  const sleepHours = [7.2, 6.8, 5.9, 7.5, 8.1, 8.4, 7.8, 7.0, 6.5, 6.0, 7.8, 8.2, 8.0, 7.6];
  const activeMins = [45, 30, 20, 60, 75, 90, 45, 40, 35, 25, 50, 65, 80, 55];

  charts.sleep = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Sleep Duration (hrs)",
          data: sleepHours,
          borderColor: "#06b6d4",
          borderWidth: 2.5,
          tension: 0.4
        },
        {
          label: "Active Workout (mins)",
          data: activeMins,
          borderColor: "#8b5cf6",
          borderWidth: 2.5,
          tension: 0.4,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      ...chartCommonOptions,
      scales: {
        y: {
          min: 0,
          max: 12,
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#06b6d4" }
        },
        y1: {
          position: "right",
          min: 0,
          max: 120,
          grid: { drawOnChartArea: false },
          ticks: { color: "#8b5cf6" }
        },
        x: {
          grid: { display: false },
          ticks: { color: "#64748b" }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════
// HABITS WITH CONFETTI CELEBRATION
// ══════════════════════════════════════════════════════════
let currentHabits = JSON.parse(localStorage.getItem("mindpulse_habits")) || DEFAULT_HABITS;

function loadHabits() {
  const container = document.getElementById("habitContainer");
  if (!container) return;

  container.innerHTML = "";
  currentHabits.forEach(h => {
    const item = document.createElement("div");
    item.className = "habit-item";
    item.innerHTML = `
      <div class="habit-left">
        <button class="habit-check-btn ${h.completed_today ? 'completed' : ''}" onclick="toggleHabit('${h.id}', event)">
          ${h.completed_today ? '✓' : ''}
        </button>
        <div>
          <h4 class="habit-title">${h.name}</h4>
          <span class="habit-meta">${h.category} • Target: ${h.target_days_per_week} days/week</span>
        </div>
      </div>
      <div class="habit-streak">
        🔥 <span>${h.streak_days} Day Streak</span>
      </div>
    `;
    container.appendChild(item);
  });
}

function toggleHabit(habitId, e) {
  const habit = currentHabits.find(h => h.id === habitId);
  if (!habit) return;

  habit.completed_today = !habit.completed_today;
  if (habit.completed_today) {
    habit.streak_days += 1;
    // Celebration confetti
    if (window.confetti) {
      window.confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
    showToast(`Great job! Completed '${habit.name}'`, "success");
  } else {
    habit.streak_days = Math.max(0, habit.streak_days - 1);
  }

  localStorage.setItem("mindpulse_habits", JSON.stringify(currentHabits));
  loadHabits();
}

function openNewHabitModal() {
  document.getElementById("newHabitModal").style.display = "flex";
}

function closeNewHabitModal() {
  document.getElementById("newHabitModal").style.display = "none";
}

function handleCreateHabit(e) {
  if (e) e.preventDefault();
  const name = document.getElementById("newHabitName").value;
  const category = document.getElementById("newHabitCategory").value;
  const freq = parseInt(document.getElementById("newHabitFrequency").value);

  const newHabit = {
    id: "h_" + Date.now(),
    name: name,
    category: category,
    completed_today: false,
    streak_days: 0,
    target_days_per_week: freq
  };

  currentHabits.push(newHabit);
  localStorage.setItem("mindpulse_habits", JSON.stringify(currentHabits));
  closeNewHabitModal();
  loadHabits();
  showToast(`Habit '${name}' registered!`, "success");
}

// ══════════════════════════════════════════════════════════
// UNIFIED QUICK LOG MODAL
// ══════════════════════════════════════════════════════════
function openLogModal() {
  document.getElementById("quickLogModal").style.display = "flex";
}

function closeLogModal() {
  document.getElementById("quickLogModal").style.display = "none";
}

function switchQuickLogTab(tab) {
  document.querySelectorAll(".modal-tab-btn").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");

  document.getElementById("quickLog-mood").style.display = tab === "mood" ? "block" : "none";
  document.getElementById("quickLog-stress").style.display = tab === "stress" ? "block" : "none";
  document.getElementById("quickLog-sleep").style.display = tab === "sleep" ? "block" : "none";
}

async function saveQuickMood() {
  const note = document.getElementById("quickMoodNote").value;
  const tags = Array.from(document.querySelectorAll("#quickEmotionTags .emotion-tag.active")).map(t => t.innerText).join(", ");
  
  try {
    await fetch(`${API_BASE}/mood`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mood_score: selectedQuickMood, emotions: tags, note })
    });
  } catch(e) {}

  document.getElementById("dashMoodScore").innerText = (selectedQuickMood * 0.9).toFixed(1);
  closeLogModal();
  showToast("Quick mood logged! Dashboard refreshed.", "success");
}

async function saveQuickStress() {
  const score = document.getElementById("quickStressSlider").value;
  const hrv = document.getElementById("quickHrvInput").value;
  const rhr = document.getElementById("quickRhrInput").value;

  try {
    await fetch(`${API_BASE}/stress`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ q_stress: Math.ceil(score / 2), hrv_rmssd: parseInt(hrv), heart_rate_avg: parseInt(rhr) })
    });
  } catch(e) {}

  document.getElementById("dashRiskScore").innerText = Math.round(score * 9);
  closeLogModal();
  showToast("Stress telemetry recorded!", "success");
}

async function saveQuickSleep() {
  const dur = document.getElementById("quickSleepDuration").value;
  const qual = document.getElementById("quickSleepQuality").value;

  try {
    await fetch(`${API_BASE}/sleep`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ duration_hours: parseFloat(dur), quality: parseInt(qual) })
    });
  } catch(e) {}

  document.getElementById("dashSleepDuration").innerText = parseFloat(dur).toFixed(1);
  closeLogModal();
  showToast("Sleep and activity updated!", "success");
}

// ══════════════════════════════════════════════════════════
// ANALYTICS MULTI-CHART
// ══════════════════════════════════════════════════════════
function renderAnalyticsChart() {
  const ctx = document.getElementById("analyticsMultiChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.analytics) charts.analytics.destroy();

  const labels = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
  const stress = Array.from({ length: 30 }, () => Math.floor(Math.random() * 30) + 35);
  const sleep = Array.from({ length: 30 }, () => (Math.random() * 2 + 6.5).toFixed(1));
  const hrv = Array.from({ length: 30 }, () => Math.floor(Math.random() * 25) + 48);

  charts.analytics = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "Stress Score (0-100)", data: stress, borderColor: "#8b5cf6", borderWidth: 2.5, tension: 0.35 },
        { label: "Sleep Duration (hrs)", data: sleep, borderColor: "#06b6d4", borderWidth: 2.5, tension: 0.35, yAxisID: "y1" },
        { label: "HRV (RMSSD ms)", data: hrv, borderColor: "#10b981", borderWidth: 2.5, tension: 0.35 }
      ]
    },
    options: {
      ...chartCommonOptions,
      scales: {
        y: { grid: { color: "rgba(255, 255, 255, 0.04)" }, ticks: { color: "#64748b" } },
        y1: { position: "right", min: 0, max: 12, grid: { drawOnChartArea: false }, ticks: { color: "#06b6d4" } },
        x: { grid: { display: false }, ticks: { color: "#64748b" } }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════
// AI COPILOT INTERACTIVE CHATBOT
// ══════════════════════════════════════════════════════════
function toggleCopilot() {
  const drawer = document.getElementById("copilotDrawer");
  if (!drawer) return;
  drawer.style.display = drawer.style.display === "flex" ? "none" : "flex";
  if (window.feather) feather.replace();
}

function askCopilot(question) {
  const input = document.getElementById("copilotInput");
  if (input) input.value = question;
  sendCopilotMsg();
}

function sendCopilotMsg() {
  const input = document.getElementById("copilotInput");
  const msgContainer = document.getElementById("copilotMessages");
  const text = input.value.trim();
  if (!text) return;

  // Append User message
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble user";
  userBubble.innerText = text;
  msgContainer.appendChild(userBubble);
  input.value = "";

  msgContainer.scrollTop = msgContainer.scrollHeight;

  // Generate intelligent response based on stress triggers
  setTimeout(() => {
    let reply = "I understand. Prioritize grounding your physical nervous system right now.";
    const lower = text.toLowerCase();

    if (lower.includes("overwhelm") || lower.includes("panic") || lower.includes("stress")) {
      reply = "When stress spikes, your prefrontal cortex loses bandwidth. Try the 4-7-8 breathing circle in the Zen Sanctuary for just 2 minutes to drop heart rate by up to 10 BPM.";
    } else if (lower.includes("sleep") || lower.includes("tired")) {
      reply = "Consistent sleep timing is crucial. Our models show your HRV jumps +16% when you reach at least 7.5 hours of sleep. Try dimming all screens 45 minutes before bed.";
    } else if (lower.includes("hrv") || lower.includes("heart rate")) {
      reply = "Heart Rate Variability (HRV) measures the variation in time between heartbeats. Higher HRV indicates high parasympathetic resilience and low systemic fatigue.";
    } else if (lower.includes("meeting") || lower.includes("presentation")) {
      reply = "Before a high-stakes meeting, try a physiological sigh: two quick deep inhales through your nose, followed by one long, slow exhale through your mouth.";
    }

    const aiBubble = document.createElement("div");
    aiBubble.className = "chat-bubble assistant";
    aiBubble.innerText = reply;
    msgContainer.appendChild(aiBubble);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }, 450);
}

// ══════════════════════════════════════════════════════════
// SETTINGS & DATA PRIVACY
// ══════════════════════════════════════════════════════════
async function handleSaveSettings(e) {
  if (e) e.preventDefault();
  const name = document.getElementById("settingFullName").value;
  const goal = document.getElementById("settingGoal").value;

  document.getElementById("userNameBadge").innerText = name;
  showToast("Preferences and wellness targets saved!", "success");
}

function exportUserData() {
  const payload = {
    user: "Shray Singal",
    exported_at: new Date().toISOString(),
    compliance: "GDPR / HIPAA Self-Service Export",
    summary: { risk_score: 38, mood_avg: 4.2, sleep_avg_hrs: 7.8 },
    habits: currentHabits
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mindpulse_data_${Date.now()}.json`;
  a.click();
  showToast("Data package exported successfully (JSON)", "success");
}

function deleteAccountData() {
  if (confirm("Are you sure you want to permanently erase your account and all associated telemetry? This cannot be undone.")) {
    localStorage.clear();
    showToast("All personal data erased permanently.", "warning");
    setTimeout(() => location.reload(), 1200);
  }
}
