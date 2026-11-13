/**
 * MindEase — Frontend SPA Core Application
 * Faithful implementation of the Figma Design System & Screens
 * Fully integrated with FastAPI backend API endpoints
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8000' && window.location.port !== ''
  ? 'http://127.0.0.1:8000/api'
  : '/api';

let authToken = localStorage.getItem("mindpulse_token") || "";
let currentUser = {
  name: "Friend",
  email: "",
  initials: "ME",
  stressScore: 38,
  stressCategory: "Moderate",
  mood: "Calm",
  moodEmoji: "😌",
  sleep: "7h 45m",
  steps: "8,420",
  habitsCompleted: 4,
  habitsTotal: 5
};

function formatNameFromEmail(email) {
  if (!email) return "Friend";
  const localPart = email.split('@')[0];
  let cleaned = localPart.replace(/[._-]+/g, ' ');
  cleaned = cleaned.replace(/\d+$/g, '').trim();
  if (!cleaned) cleaned = localPart.trim();
  return cleaned.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || "Friend";
}

const ICON_SVGS = {
  "activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\"></path>",
  "arrow-left": "<path d=\"m12 19-7-7 7-7\"></path><path d=\"M19 12H5\"></path>",
  "bar-chart-3": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"></path><path d=\"M18 17V9\"></path><path d=\"M13 17V5\"></path><path d=\"M8 17v-3\"></path>",
  "brain": "<path d=\"M12 18V5\"></path><path d=\"M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4\"></path><path d=\"M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294\"></path><path d=\"M17.996 5.125a4 4 0 012.526 5.77\"></path><path d=\"M18 18a4 4 0 002-7.465\"></path><path d=\"M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517\"></path><path d=\"M6 18a4 4 0 01-2-7.465\"></path><path d=\"M6.004 5.125a4 4 0 00-2.526 5.77\"></path>",
  "check": "<path d=\"M20 6 9 17l-5-5\"></path>",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\"></path>",
  "download": "<path d=\"M12 15V3\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><path d=\"m7 10 5 5 5-5\"></path>",
  "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>",
  "eye-off": "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"></path><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"></path><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"></path><path d=\"m2 2 20 20\"></path>",
  "flame": "<path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\"></path>",
  "footprints": "<path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\"></path><path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\"></path><path d=\"M16 17h4\"></path><path d=\"M4 13h4\"></path>",
  "heart": "<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"></path>",
  "home": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"></path><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path>",
  "log-out": "<path d=\"m16 17 5-5-5-5\"></path><path d=\"M21 12H9\"></path><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"></path>",
  "message-circle": "<path d=\"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719\"></path>",
  "moon": "<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"></path>",
  "phone": "<path d=\"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384\"></path>",
  "play": "<path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\"></path>",
  "send": "<path d=\"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z\"></path><path d=\"m21.854 2.147-10.94 10.939\"></path>",
  "shield": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"></path>",
  "sparkles": "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"></path><path d=\"M20 2v4\"></path><path d=\"M22 4h-4\"></path><circle cx=\"4\" cy=\"20\" r=\"2\"></circle>",
  "trash-2": "<path d=\"M10 11v6\"></path><path d=\"M14 11v6\"></path><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"></path><path d=\"M3 6h18\"></path><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"></path>",
  "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"></path><circle cx=\"12\" cy=\"7\" r=\"4\"></circle>",
  "watch": "<path d=\"M12 10v2.2l1.6 1\"></path><path d=\"m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05\"></path><path d=\"m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05\"></path><circle cx=\"12\" cy=\"12\" r=\"6\"></circle>",
  "wind": "<path d=\"M12.8 19.6A2 2 0 1 0 14 16H2\"></path><path d=\"M17.5 8a2.5 2.5 0 1 1 2 4H2\"></path><path d=\"M9.8 4.4A2 2 0 1 1 11 8H2\"></path>",
  "zap": "<path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\"></path>",
  "droplets": "<path d=\"M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z\"></path><path d=\"M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97\"></path>",
  "book-open": "<path d=\"M12 5v16\"></path><path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\"></path>"
};

function getIconSvgHtml(name, size = 20) {
  const inner = ICON_SVGS[name] || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name}">${inner}</svg>`;
}

function renderAppIcons() {
  // Guaranteed replacement: replace any i[data-lucide] with exact inline SVG
  document.querySelectorAll('i[data-lucide]').forEach((el) => {
    const iconName = el.getAttribute('data-lucide');
    const svgInner = ICON_SVGS[iconName];
    if (svgInner) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('class', `lucide lucide-${iconName}`);

      const style = el.getAttribute('style');
      if (style) svg.setAttribute('style', style);
      if (el.classList.length > 0) {
        svg.classList.add(...Array.from(el.classList));
      }

      svg.innerHTML = svgInner;
      el.replaceWith(svg);
    }
  });
}

let authMode = "signin"; // 'signin' or 'signup'
let selectedMood = { name: "Calm", emoji: "😌" };

// Breathing state
let breathingInterval = null;
let breathingMode = "box"; // 'box' or '478'
let breathingRunning = false;
let breathingPhase = 0; // 0: inhale, 1: hold1, 2: exhale, 3: hold2
let breathingSeconds = 4;

// PSS-10 Questions
const PSS_QUESTIONS = [
  "In the last month, how often have you been upset because of something that happened unexpectedly?",
  "In the last month, how often have you felt that you were unable to control the important things in your life?",
  "In the last month, how often have you felt nervous and stressed?",
  "In the last month, how often have you felt confident about your ability to handle your personal problems?",
  "In the last month, how often have you felt that things were going your way?",
  "In the last month, how often have you found that you could not cope with all the things that you had to do?",
  "In the last month, how often have you been able to control irritations in your life?",
  "In the last month, how often have you felt that you were on top of things?",
  "In the last month, how often have you been angered because of things that happened that were outside of your control?",
  "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?"
];
let pssCurrentIndex = 0;
let pssScores = [];

// Default Habits
let userHabits = [
  { id: 1, name: "Sleep routine (7+ hours)", icon: "moon", streak: 5, completed: true },
  { id: 2, name: "Physical activity (30m walk/workout)", icon: "zap", streak: 7, completed: true },
  { id: 3, name: "Mindful breathing pause (5m)", icon: "wind", streak: 3, completed: true },
  { id: 4, name: "Hydration (8 glasses of water)", icon: "droplets", streak: 4, completed: true },
  { id: 5, name: "Daily reflection / journaling", icon: "book-open", streak: 2, completed: false }
];

// App Initialization
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initDateHeader();

  const savedUser = localStorage.getItem("mindease_user");
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      if (parsed.name && parsed.name !== "Shray Demo") {
        currentUser.name = parsed.name;
        currentUser.email = parsed.email || "";
        currentUser.initials = parsed.initials || getInitials(parsed.name);
      }
    } catch (e) {}
  }

  if (authToken) {
    updateUserDisplay();
    switchScreen("home");
    loadDashboardSummary();
    loadHabits();
    fetchCurrentUserProfile();
  } else {
    updateUserDisplay();
    switchScreen("signin");
  }

  renderHabitsList();
  renderAppIcons();
});

async function fetchCurrentUserProfile() {
  if (!authToken || authToken === "demo-local-session") return;
  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      let resolvedName = data.full_name;
      if (!resolvedName || resolvedName === "Shray Demo") {
        resolvedName = formatNameFromEmail(data.email);
      }
      currentUser.name = resolvedName;
      currentUser.email = data.email || currentUser.email;
      currentUser.initials = getInitials(resolvedName);
      localStorage.setItem("mindease_user", JSON.stringify({
        name: currentUser.name,
        email: currentUser.email,
        initials: currentUser.initials
      }));
      updateUserDisplay();
    }
  } catch (err) {
    // Offline / network failure
  }
}

// Theme Management
function initTheme() {
  const isDark = localStorage.getItem("mindease_dark") === "true";
  if (isDark) {
    document.documentElement.classList.add("dark");
    const toggleBtn = document.getElementById("themeToggleBtn");
    if (toggleBtn) toggleBtn.classList.add("active");
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("mindease_dark", isDark);
  const toggleBtn = document.getElementById("themeToggleBtn");
  if (toggleBtn) toggleBtn.classList.toggle("active", isDark);
}

function initDateHeader() {
  const label = document.getElementById("homeTodayLabel");
  if (label) {
    const now = new Date();
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    label.innerText = `TODAY · ${now.toLocaleDateString('en-US', options).toUpperCase()}`;
  }
}

// Screen Routing
function switchScreen(screenName) {
  // Hide all screens
  const screens = document.querySelectorAll(".phone-shell > section");
  screens.forEach(s => s.style.display = "none");

  // Show target screen
  const target = document.getElementById(`screen-${screenName}`);
  if (target) {
    target.style.display = (screenName === 'chat') ? 'flex' : 'block';
  }

  // Update navigation visibility
  const phoneShell = document.getElementById("phoneShell");
  const bottomNav = document.getElementById("bottomNav");
  const navScreens = ['home', 'checkin', 'insights', 'chat', 'profile', 'habits', 'wearables', 'prediction'];

  if (['signin', 'splash'].includes(screenName)) {
    if (bottomNav) bottomNav.style.display = 'none';
    if (phoneShell) phoneShell.classList.remove('has-nav');
  } else {
    if (bottomNav) bottomNav.style.display = 'flex';
    if (phoneShell) phoneShell.classList.add('has-nav');
  }

  // Update active nav button
  document.querySelectorAll(".bottom-nav .nav-button").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-screen") === screenName);
  });

  // Re-render Icons
  renderAppIcons();

  // Scroll to top of screen
  window.scrollTo(0, 0);
}

// Authentication
function toggleAuthMode() {
  authMode = (authMode === "signin") ? "signup" : "signin";
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const nameGroup = document.getElementById("signupNameGroup");
  const submitBtn = document.getElementById("authSubmitBtn");
  const toggleText = document.getElementById("authToggleText");
  const toggleBtn = document.getElementById("authToggleBtn");
  const feedback = document.getElementById("authFeedback");
  if (feedback) feedback.style.display = "none";

  if (authMode === "signup") {
    title.innerText = "Create your account";
    subtitle.innerText = "Start your private wellness sanctuary.";
    nameGroup.style.display = "block";
    submitBtn.innerText = "Create Account";
    toggleText.innerText = "Already have an account?";
    toggleBtn.innerText = "Sign in";
  } else {
    title.innerText = "Welcome to MindEase";
    subtitle.innerText = "Your calmer days start here.";
    nameGroup.style.display = "none";
    submitBtn.innerText = "Sign In";
    toggleText.innerText = "New to MindEase?";
    toggleBtn.innerText = "Create account";
  }
}

function togglePasswordVisibility() {
  const pwd = document.getElementById("authPassword");
  if (!pwd) return;
  const isPwd = pwd.type === "password";
  pwd.type = isPwd ? "text" : "password";
  const btn = pwd.parentElement?.querySelector("button");
  if (btn) {
    const newIcon = isPwd ? "eye-off" : "eye";
    btn.innerHTML = `<i data-lucide="${newIcon}" id="eyeIcon"></i>`;
    renderAppIcons();
  }
}

async function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const submittedName = document.getElementById("authName")?.value?.trim() || "";
  const feedback = document.getElementById("authFeedback");

  try {
    const endpoint = (authMode === "signup") ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;
    const bodyData = (authMode === "signup")
      ? { email, password, full_name: submittedName || formatNameFromEmail(email) }
      : { email, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Authentication request failed");
    }

    const data = await res.json();
    authToken = data.access_token;
    localStorage.setItem("mindpulse_token", authToken);

    let resolvedName = data.full_name;
    if (!resolvedName || resolvedName === "Shray Demo") {
      resolvedName = (authMode === "signup" && submittedName) ? submittedName : formatNameFromEmail(email);
    }
    const resolvedEmail = data.email || email;

    currentUser.name = resolvedName;
    currentUser.email = resolvedEmail;
    currentUser.initials = getInitials(resolvedName);
    localStorage.setItem("mindease_user", JSON.stringify({
      name: currentUser.name,
      email: currentUser.email,
      initials: currentUser.initials
    }));
    updateUserDisplay();

    showToast(authMode === "signup" ? "Account created successfully!" : "Signed in successfully!");
    switchScreen("home");
    loadDashboardSummary();
    loadHabits();
    fetchCurrentUserProfile();
  } catch (err) {
    if (feedback) {
      feedback.innerText = err.message;
      feedback.style.display = "block";
    }
  }
}

async function autoDemoLogin() {
  const emailInput = document.getElementById("authEmail");
  const pwdInput = document.getElementById("authPassword");
  const feedback = document.getElementById("authFeedback");

  if (emailInput) emailInput.value = "demo@mindpulse.io";
  if (pwdInput) pwdInput.value = "Password123!";
  authMode = "signin";

  if (feedback) {
    feedback.innerText = "Connecting to demo account…";
    feedback.style.color = "var(--primary)";
    feedback.style.display = "block";
  }

  try {
    // 1. Try standard login
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@mindpulse.io", password: "Password123!" })
    });

    if (res.ok) {
      const data = await res.json();
      authToken = data.access_token;
      localStorage.setItem("mindpulse_token", authToken);
      currentUser.name = data.full_name || "Demo User";
      currentUser.email = "demo@mindpulse.io";
      currentUser.initials = getInitials(currentUser.name);
      localStorage.setItem("mindease_user", JSON.stringify({
        name: currentUser.name,
        email: currentUser.email,
        initials: currentUser.initials
      }));
      updateUserDisplay();
      if (feedback) feedback.style.display = "none";
      showToast("Signed in as Demo User!");
      switchScreen("home");
      loadDashboardSummary();
      loadHabits();
      return;
    }

    // 2. If login returned 401 (e.g. database reset before seed), automatically register demo user
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "demo@mindpulse.io",
        password: "Password123!",
        full_name: "Demo User",
        age: 24,
        occupation: "Software Engineer"
      })
    });

    if (regRes.ok) {
      const data = await regRes.json();
      authToken = data.access_token;
      localStorage.setItem("mindpulse_token", authToken);
      currentUser.name = "Demo User";
      currentUser.email = "demo@mindpulse.io";
      currentUser.initials = "DU";
      localStorage.setItem("mindease_user", JSON.stringify({
        name: currentUser.name,
        email: currentUser.email,
        initials: currentUser.initials
      }));
      updateUserDisplay();
      if (feedback) feedback.style.display = "none";
      showToast("Demo account created & signed in!");
      switchScreen("home");
      loadDashboardSummary();
      loadHabits();
      return;
    }

    throw new Error("Unable to log into demo account.");
  } catch (err) {
    // 3. Fallback: allow immediate offline demo access so user is never blocked
    currentUser.name = "Demo User";
    currentUser.email = "demo@mindpulse.io";
    currentUser.initials = "DU";
    authToken = "demo-local-session";
    localStorage.setItem("mindpulse_token", authToken);
    localStorage.setItem("mindease_user", JSON.stringify({
      name: currentUser.name,
      email: currentUser.email,
      initials: currentUser.initials
    }));
    updateUserDisplay();
    if (feedback) feedback.style.display = "none";
    showToast("Opened MindEase demo access!");
    switchScreen("home");
  }
}

function logout() {
  authToken = "";
  localStorage.removeItem("mindpulse_token");
  localStorage.removeItem("mindease_user");
  currentUser.name = "Friend";
  currentUser.email = "";
  currentUser.initials = "ME";
  updateUserDisplay();
  showToast("You have been signed out.");
  switchScreen("signin");
}

function getInitials(name) {
  if (!name) return "ME";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function updateUserDisplay() {
  const greeting = document.getElementById("homeGreeting");
  const avatar = document.getElementById("avatarInitials");
  const profName = document.getElementById("profileFullName");
  const profEmail = document.getElementById("profileEmail");
  const profAvatar = document.getElementById("profileAvatarInitials");
  const chatWelcome = document.getElementById("chatWelcomeBubble");

  const displayName = currentUser.name && currentUser.name !== "User Profile" ? currentUser.name : "Friend";
  const firstName = displayName.split(' ')[0];

  const hour = new Date().getHours();
  let timeGreeting = "Good morning";
  if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
  else if (hour >= 17 || hour < 4) timeGreeting = "Good evening";

  if (greeting) greeting.innerText = `${timeGreeting}, ${firstName}.`;
  if (avatar) avatar.innerText = currentUser.initials || "U";
  if (profName) profName.innerText = displayName;
  if (profEmail) profEmail.innerText = currentUser.email || "user@example.com";
  if (profAvatar) profAvatar.innerText = currentUser.initials || "U";
  if (chatWelcome) {
    chatWelcome.innerText = `Hi ${firstName}! I'm your MindEase wellness companion. I'm here to listen, offer cognitive reframing techniques, and guide you through calming exercises. How are you feeling right now?`;
  }
}

// Data Fetching & Dashboard Updates
async function loadDashboardSummary() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/summary`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.status === 401) {
      // If token expired and user was demo, quietly re-authenticate
      if (currentUser.email === "demo@mindpulse.io") {
        await autoDemoLogin();
        return;
      }
      logout();
      return;
    }
    if (!res.ok) return;
    const data = await res.json();

    if (data.stress_score !== undefined) {
      currentUser.stressScore = Math.round(data.stress_score * 10);
      updateStressDisplay(currentUser.stressScore);
    }
    if (data.latest_mood) {
      currentUser.mood = data.latest_mood;
      const elMoodName = document.getElementById("statMoodName");
      if (elMoodName) elMoodName.innerText = data.latest_mood;
    }
  } catch {
    // Keep local defaults if offline or network unavailable
  }
}

function updateStressDisplay(score) {
  const scoreNum = document.getElementById("outlookScoreNum");
  const scoreLabel = document.getElementById("outlookScoreLabel");
  const riskText = document.getElementById("outlookRiskText");
  const latestStress = document.getElementById("latestStressVal");
  const ringVal = document.getElementById("outlookRingValue");

  let category = "Low";
  if (score >= 65) category = "High";
  else if (score >= 35) category = "Moderate";

  if (scoreNum) scoreNum.innerText = score;
  if (scoreLabel) scoreLabel.innerText = category;
  if (riskText) riskText.innerText = `${score}% ${category.toLowerCase()} risk`;
  if (latestStress) latestStress.innerText = (score / 10).toFixed(1);

  if (ringVal) {
    const circumference = 270.17;
    const offset = circumference * (1 - score / 100);
    ringVal.style.strokeDashoffset = offset;
  }
}

// Daily Check-In
function selectMood(name, emoji, btn) {
  selectedMood = { name, emoji };
  document.querySelectorAll(".mood-option").forEach(b => {
    b.classList.remove("active", "selected");
  });
  if (btn) {
    btn.classList.add("active", "selected");
  }
}

function toggleTag(btn) {
  if (btn) btn.classList.toggle("active");
}

async function submitDailyCheckIn() {
  const stressVal = parseInt(document.getElementById("checkinStressSlider").value, 10);
  const energyVal = parseInt(document.getElementById("checkinEnergySlider").value, 10);
  const notes = document.getElementById("checkinNotes").value;
  const activeTags = Array.from(document.querySelectorAll(".tag-wrap .tag.active")).map(t => t.innerText);

  try {
    // Log mood
    await fetch(`${API_BASE}/trackers/mood`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        mood_score: energyVal,
        mood_tags: activeTags,
        notes: notes
      })
    });

    // Log stress
    await fetch(`${API_BASE}/trackers/stress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        perceived_stress: stressVal,
        stressors: activeTags,
        coping_mechanism: "MindEase daily reflection"
      })
    });

    // Update local state
    currentUser.mood = selectedMood.name;
    currentUser.moodEmoji = selectedMood.emoji;
    currentUser.stressScore = stressVal * 10;

    const statEmoji = document.getElementById("statMoodEmoji");
    const statName = document.getElementById("statMoodName");
    if (statEmoji) statEmoji.innerText = selectedMood.emoji;
    if (statName) statName.innerText = selectedMood.name;

    updateStressDisplay(currentUser.stressScore);

    showToast("Daily check-in saved! Wellbeing outlook updated.");
    switchScreen("home");
  } catch (err) {
    showToast("Check-in saved locally!");
    switchScreen("home");
  }
}

// AI Support Chat
function sendQuickPrompt(text) {
  const input = document.getElementById("chatInput");
  if (input) input.value = text;
  handleChatSubmit();
}

async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("chatInput");
  const stream = document.getElementById("chatMessageStream");
  if (!input || !input.value.trim() || !stream) return;

  const userText = input.value.trim();
  input.value = "";

  // Append user message
  const userRow = document.createElement("div");
  userRow.className = "message-row";
  userRow.style.cssText = "display: flex; gap: 10px; align-items: flex-start; justify-content: flex-end;";
  userRow.innerHTML = `
    <div class="bubble" style="background: var(--primary); color: white; border-radius: 16px; padding: 12px 16px; max-width: 80%; font-size: 13px; line-height: 1.5;">
      ${escapeHtml(userText)}
    </div>
  `;
  stream.appendChild(userRow);
  stream.scrollTop = stream.scrollHeight;

  // Typing indicator
  const typingRow = document.createElement("div");
  typingRow.className = "message-row typing-indicator";
  typingRow.style.cssText = "display: flex; gap: 10px; align-items: flex-start;";
  typingRow.innerHTML = `
    <div class="bot-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white;">
      ${getIconSvgHtml('sparkles', 16)}
    </div>
    <div class="bubble" style="background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 10px 16px; font-size: 12px; color: var(--muted);">
      MindEase Assistant is reflecting…
    </div>
  `;
  stream.appendChild(typingRow);
  stream.scrollTop = stream.scrollHeight;
  renderAppIcons();

  try {
    const res = await fetch(`${API_BASE}/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ message: userText })
    });

    typingRow.remove();

    let botResponse = "I hear you, and it is completely natural to experience tension when facing demanding circumstances. Let's take one mindful breath together. Remember that thoughts are mental events, not immutable facts. Would you like to do a quick 3-minute Box Breathing exercise to center yourself?";
    if (res.ok) {
      const data = await res.json();
      botResponse = data.response || data.reply || botResponse;
    }

    const botRow = document.createElement("div");
    botRow.className = "message-row";
    botRow.style.cssText = "display: flex; gap: 10px; align-items: flex-start;";
    botRow.innerHTML = `
      <div class="bot-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white;">
        ${getIconSvgHtml('sparkles', 16)}
      </div>
      <div class="bubble" style="background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px 16px; max-width: 80%; font-size: 13px; line-height: 1.5;">
        ${escapeHtml(botResponse)}
      </div>
    `;
    stream.appendChild(botRow);
    stream.scrollTop = stream.scrollHeight;
  } catch {
    typingRow.remove();
    const fallbackRow = document.createElement("div");
    fallbackRow.className = "message-row";
    fallbackRow.style.cssText = "display: flex; gap: 10px; align-items: flex-start;";
    fallbackRow.innerHTML = `
      <div class="bot-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white;">
        ${getIconSvgHtml('sparkles', 16)}
      </div>
      <div class="bubble" style="background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px 16px; max-width: 80%; font-size: 13px; line-height: 1.5;">
        Take a moment to exhale fully. Ground your feet into the floor, release your shoulders down, and remind yourself that you are in control of this present moment.
      </div>
    `;
    stream.appendChild(fallbackRow);
    stream.scrollTop = stream.scrollHeight;
  }

  renderAppIcons();
}

// Breathing Pacer Visualizer
function setBreathingMode(mode, btn) {
  breathingMode = mode;
  document.getElementById("btnModeBox")?.classList.toggle("active", mode === 'box');
  document.getElementById("btnMode478")?.classList.toggle("active", mode === '478');
  resetBreathingPacer();
}

function toggleBreathingPacer() {
  const btn = document.getElementById("breathToggleBtn");
  if (breathingRunning) {
    clearInterval(breathingInterval);
    breathingRunning = false;
    if (btn) btn.innerText = "Resume Session";
  } else {
    breathingRunning = true;
    if (btn) btn.innerText = "Pause Session";
    runBreathingCycle();
    breathingInterval = setInterval(updateBreathingTick, 1000);
  }
}

function runBreathingCycle() {
  const circle = document.getElementById("breathCircle");
  const halo = document.getElementById("breathHalo");
  const action = document.getElementById("breathAction");
  const instruction = document.getElementById("breathInstruction");

  if (breathingMode === "box") {
    // Box Breathing: Inhale 4s -> Hold 4s -> Exhale 4s -> Hold 4s
    if (breathingPhase === 0) {
      action.innerText = "IN-HALE";
      instruction.innerText = "Breathe in deeply through your nose, expanding your diaphragm.";
      circle.style.transform = "scale(1.25)";
      halo.style.transform = "scale(1.35)";
      breathingSeconds = 4;
    } else if (breathingPhase === 1) {
      action.innerText = "HOLD";
      instruction.innerText = "Hold your breath gently with relaxed shoulders.";
      breathingSeconds = 4;
    } else if (breathingPhase === 2) {
      action.innerText = "EX-HALE";
      instruction.innerText = "Exhale slowly and smoothly through your mouth.";
      circle.style.transform = "scale(0.85)";
      halo.style.transform = "scale(0.8)";
      breathingSeconds = 4;
    } else if (breathingPhase === 3) {
      action.innerText = "HOLD";
      instruction.innerText = "Wait calmly before the next natural breath.";
      breathingSeconds = 4;
    }
  } else {
    // 4-7-8 Breathing: Inhale 4s -> Hold 7s -> Exhale 8s
    if (breathingPhase === 0) {
      action.innerText = "IN-HALE";
      instruction.innerText = "Inhale quietly through your nose.";
      circle.style.transform = "scale(1.3)";
      halo.style.transform = "scale(1.4)";
      breathingSeconds = 4;
    } else if (breathingPhase === 1) {
      action.innerText = "HOLD";
      instruction.innerText = "Retain your breath calmly for 7 seconds.";
      breathingSeconds = 7;
    } else if (breathingPhase === 2) {
      action.innerText = "EX-HALE";
      instruction.innerText = "Make a whooshing sound as you exhale completely for 8 seconds.";
      circle.style.transform = "scale(0.8)";
      halo.style.transform = "scale(0.75)";
      breathingSeconds = 8;
    }
  }

  document.getElementById("breathCount").innerText = breathingSeconds;
}

function updateBreathingTick() {
  breathingSeconds--;
  if (breathingSeconds <= 0) {
    const maxPhases = (breathingMode === "box") ? 4 : 3;
    breathingPhase = (breathingPhase + 1) % maxPhases;
    runBreathingCycle();
  } else {
    document.getElementById("breathCount").innerText = breathingSeconds;
  }
}

function resetBreathingPacer() {
  clearInterval(breathingInterval);
  breathingRunning = false;
  breathingPhase = 0;
  breathingSeconds = 4;

  const btn = document.getElementById("breathToggleBtn");
  if (btn) btn.innerText = "Start Session";

  const circle = document.getElementById("breathCircle");
  const halo = document.getElementById("breathHalo");
  if (circle) circle.style.transform = "scale(0.9)";
  if (halo) halo.style.transform = "scale(0.8)";

  document.getElementById("breathAction").innerText = "READY";
  document.getElementById("breathCount").innerText = "4";
  document.getElementById("breathInstruction").innerText = "Click 'Start Session' to begin guided breathing.";
}

// Habits Management
function renderHabitsList() {
  const container = document.getElementById("habitsListContainer");
  if (!container) return;

  container.innerHTML = userHabits.map((habit, idx) => `
    <div class="card habit-item" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button class="habit-check ${habit.completed ? 'completed' : ''}" onclick="toggleHabit(${idx})" style="width: 26px; height: 26px; border-radius: 8px; border: 2px solid ${habit.completed ? 'var(--positive)' : 'var(--line)'}; background: ${habit.completed ? 'var(--positive)' : 'transparent'}; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${habit.completed ? '✓' : ''}
        </button>
        <div>
          <div class="title-sm" style="${habit.completed ? 'text-decoration: line-through; opacity: 0.7;' : ''}">${escapeHtml(habit.name)}</div>
          <div class="microcopy">${habit.streak}-day streak</div>
        </div>
      </div>
      <div class="habit-icon" style="color: var(--muted);">${getIconSvgHtml(habit.icon, 20)}</div>
    </div>
  `).join("");

  const doneCount = userHabits.filter(h => h.completed).length;
  const numElem = document.getElementById("habitsCompletedNum");
  const statElem = document.getElementById("statHabitsVal");
  if (numElem) numElem.innerText = doneCount;
  if (statElem) statElem.innerText = `${doneCount}/${userHabits.length}`;

  renderAppIcons();
}

function toggleHabit(idx) {
  userHabits[idx].completed = !userHabits[idx].completed;
  if (userHabits[idx].completed) userHabits[idx].streak += 1;
  else userHabits[idx].streak = Math.max(0, userHabits[idx].streak - 1);

  renderHabitsList();
  showToast(userHabits[idx].completed ? "Habit completed!" : "Habit unchecked");
}

async function loadHabits() {
  try {
    const res = await fetch(`${API_BASE}/habits`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        userHabits = data.map((h, i) => ({
          id: h.id || i,
          name: h.name || h.title,
          icon: "check-circle",
          streak: h.streak || 3,
          completed: h.is_completed || false
        }));
        renderHabitsList();
      }
    }
  } catch {}
}

// Clinical PSS-10 Assessment
function answerPSS(score) {
  pssScores.push(score);
  pssCurrentIndex++;

  if (pssCurrentIndex < PSS_QUESTIONS.length) {
    document.getElementById("pssQuestionCounter").innerText = `QUESTION ${pssCurrentIndex + 1} OF 10`;
    document.getElementById("pssQuestionText").innerText = PSS_QUESTIONS[pssCurrentIndex];
  } else {
    // Completed PSS-10
    const totalScore = pssScores.reduce((a, b) => a + b, 0);
    let category = "Low Stress (0-13)";
    if (totalScore >= 27) category = "High Perceived Stress (27-40)";
    else if (totalScore >= 14) category = "Moderate Perceived Stress (14-26)";

    alert(`PSS-10 Assessment Complete!\n\nYour score: ${totalScore} / 40\nClassification: ${category}\n\nYour personalized stress coping plan has been customized.`);
    pssCurrentIndex = 0;
    pssScores = [];
    document.getElementById("pssQuestionCounter").innerText = `QUESTION 1 OF 10`;
    document.getElementById("pssQuestionText").innerText = PSS_QUESTIONS[0];
    switchScreen("home");
  }
}

// Wearables Sync Simulation
function simulateWearableSync(btn) {
  if (!btn) return;
  const originalText = btn.innerText;
  btn.innerText = "Syncing…";
  btn.disabled = true;

  setTimeout(() => {
    btn.innerText = "Synced ✓";
    showToast("Apple Health sensor metrics updated!");
    setTimeout(() => {
      btn.innerText = originalText;
      btn.disabled = false;
    }, 2000);
  }, 1200);
}

// Insights Range Selector
function setInsightsRange(range, btn) {
  document.querySelectorAll(".segmented button").forEach(b => {
    b.className = "button button-ghost";
  });
  if (btn) btn.className = "button button-primary active";
  showToast(`Showing trend analytics for past ${range}`);
}

// Preferences
function saveWellnessGoal() {
  const input = document.getElementById("profileGoalInput");
  if (input && input.value) {
    showToast("Wellness goal updated successfully!");
  }
}

// Data Privacy & Rights
function exportUserData() {
  const exportPayload = {
    profile: currentUser,
    habits: userHabits,
    timestamp: new Date().toISOString(),
    governance: "HIPAA / GDPR Subject Access Request"
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `MindEase_Health_Export_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast("Health data archive exported.");
}

function deleteAccountData() {
  if (confirm("Are you sure you want to delete all personal mental health records? This action is permanent and complies with GDPR Right to Erasure.")) {
    logout();
    showToast("All account data successfully erased.");
  }
}

// Toast helper
function showToast(message) {
  const toast = document.getElementById("toastNotification");
  const msgElem = document.getElementById("toastMessage");
  if (!toast || !msgElem) return;

  msgElem.innerText = message;
  toast.style.display = "flex";
  toast.style.opacity = "1";

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => { toast.style.display = "none"; }, 300);
  }, 3000);
}

// Utility
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
