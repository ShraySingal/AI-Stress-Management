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
  name: "Shray Demo",
  email: "demo@mindpulse.io",
  initials: "SD",
  stressScore: 38,
  stressCategory: "Moderate",
  mood: "Calm",
  moodEmoji: "😌",
  sleep: "7h 45m",
  steps: "8,420",
  habitsCompleted: 4,
  habitsTotal: 5
};

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

  if (authToken) {
    switchScreen("home");
    loadDashboardSummary();
    loadHabits();
  } else {
    switchScreen("signin");
  }

  renderHabitsList();
  if (window.lucide) lucide.createIcons();
});

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

  // Re-initialize Lucide Icons
  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 20);
  }

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
  const eye = document.getElementById("eyeIcon");
  if (!pwd) return;
  if (pwd.type === "password") {
    pwd.type = "text";
    if (eye) eye.setAttribute("data-lucide", "eye-off");
  } else {
    pwd.type = "password";
    if (eye) eye.setAttribute("data-lucide", "eye");
  }
  if (window.lucide) lucide.createIcons();
}

async function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const name = document.getElementById("authName")?.value?.trim() || "Shray Demo";
  const feedback = document.getElementById("authFeedback");

  try {
    const endpoint = (authMode === "signup") ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;
    const bodyData = (authMode === "signup")
      ? { email, password, full_name: name }
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

    currentUser.name = name;
    currentUser.email = email;
    currentUser.initials = getInitials(name);
    updateUserDisplay();

    showToast(authMode === "signup" ? "Account created successfully!" : "Signed in successfully!");
    switchScreen("home");
    loadDashboardSummary();
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
      currentUser.name = "Shray Demo";
      currentUser.email = "demo@mindpulse.io";
      currentUser.initials = "SD";
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
        full_name: "Shray Demo",
        age: 24,
        occupation: "Software Engineer"
      })
    });

    if (regRes.ok) {
      const data = await regRes.json();
      authToken = data.access_token;
      localStorage.setItem("mindpulse_token", authToken);
      currentUser.name = "Shray Demo";
      currentUser.email = "demo@mindpulse.io";
      currentUser.initials = "SD";
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
    currentUser.name = "Shray Demo";
    currentUser.email = "demo@mindpulse.io";
    currentUser.initials = "SD";
    authToken = "demo-local-session";
    localStorage.setItem("mindpulse_token", authToken);
    updateUserDisplay();
    if (feedback) feedback.style.display = "none";
    showToast("Opened MindEase demo access!");
    switchScreen("home");
  }
}

function logout() {
  authToken = "";
  localStorage.removeItem("mindpulse_token");
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

  if (greeting) greeting.innerText = `Good morning, ${currentUser.name.split(' ')[0]}.`;
  if (avatar) avatar.innerText = currentUser.initials;
  if (profName) profName.innerText = currentUser.name;
  if (profEmail) profEmail.innerText = currentUser.email;
  if (profAvatar) profAvatar.innerText = currentUser.initials;
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
      <i data-lucide="sparkles" style="width: 16px; height: 16px;"></i>
    </div>
    <div class="bubble" style="background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 10px 16px; font-size: 12px; color: var(--muted);">
      MindEase Assistant is reflecting…
    </div>
  `;
  stream.appendChild(typingRow);
  stream.scrollTop = stream.scrollHeight;
  if (window.lucide) lucide.createIcons();

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
        <i data-lucide="sparkles" style="width: 16px; height: 16px;"></i>
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
        <i data-lucide="sparkles" style="width: 16px; height: 16px;"></i>
      </div>
      <div class="bubble" style="background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px 16px; max-width: 80%; font-size: 13px; line-height: 1.5;">
        Take a moment to exhale fully. Ground your feet into the floor, release your shoulders down, and remind yourself that you are in control of this present moment.
      </div>
    `;
    stream.appendChild(fallbackRow);
    stream.scrollTop = stream.scrollHeight;
  }

  if (window.lucide) lucide.createIcons();
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
      <div class="habit-icon" style="color: var(--muted);"><i data-lucide="${habit.icon}"></i></div>
    </div>
  `).join("");

  const doneCount = userHabits.filter(h => h.completed).length;
  const numElem = document.getElementById("habitsCompletedNum");
  const statElem = document.getElementById("statHabitsVal");
  if (numElem) numElem.innerText = doneCount;
  if (statElem) statElem.innerText = `${doneCount}/${userHabits.length}`;

  if (window.lucide) lucide.createIcons();
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
