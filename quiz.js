let order = [];
let index = 0;
let score = 0;
let missed = [];
let currentOptions = [];
let mode = "forward"; // "forward" = term -> definition, "reverse" = definition -> term
let streak = 0;
let maxStreak = 0;
let selectedIndex = -1;
let autoTimer = null;
let audioCtx = null;

const termEl = document.getElementById("term");
const optionsEl = document.getElementById("options");
const statusEl = document.getElementById("status");
const barEl = document.getElementById("bar");
const feedbackEl = document.getElementById("feedback");
const submitBtn = document.getElementById("submit");
const quizSection = document.getElementById("quiz");
const resultSection = document.getElementById("result");
const finalEl = document.getElementById("final");
const gradeEl = document.getElementById("grade");
const bestEl = document.getElementById("best");
const missedEl = document.getElementById("missed");
const restartBtn = document.getElementById("restart");
const retryMissedBtn = document.getElementById("retry-missed");
const modeForwardBtn = document.getElementById("mode-forward");
const modeReverseBtn = document.getElementById("mode-reverse");
const motionToggle = document.getElementById("motion-toggle");

let buttonMode = "submit"; // "submit" | "next"
let graded = false;

function resetActionButton(label = "Submit", next = false) {
  buttonMode = next ? "next" : "submit";
  submitBtn.textContent = label;
  submitBtn.classList.toggle("is-next", next);
}

function setHype() {
  document.body.dataset.hype = streak >= 2 ? "1" : "0";
}

function shakeRails() {
  document.body.classList.remove("shake-rails");
  void document.body.offsetWidth;
  document.body.classList.add("shake-rails");
}

function applyMotion(off) {
  document.body.classList.toggle("no-motion", off);
  if (motionToggle) {
    motionToggle.textContent = off ? "motion: off" : "motion: on";
    motionToggle.setAttribute("aria-pressed", String(!off));
  }
  try {
    localStorage.setItem("odyssey-motion", off ? "off" : "on");
  } catch (_) {}
}

function initMotion() {
  let off = false;
  try {
    off = localStorage.getItem("odyssey-motion") === "off";
  } catch (_) {}
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) off = true;
  applyMotion(off);
  if (motionToggle) motionToggle.addEventListener("click", () => applyMotion(!document.body.classList.contains("no-motion")));
}

const PRAISE = ["Nice!", "Clean!", "Got it!", "Locked in!", "Sharp!", "Easy!"];
const FIRE_PRAISE = ["On fire!", "Unstoppable!", "Cooking!", "In the zone!"];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function setMode(newMode) {
  if (mode === newMode) return;
  mode = newMode;
  modeForwardBtn.classList.toggle("active", mode === "forward");
  modeReverseBtn.classList.toggle("active", mode === "reverse");
  start();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function playTone(freq, startIn, dur, type = "sine", vol = 0.12) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime + startIn;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch (_) {
    // audio is decoration — never break the quiz
  }
}

function correctSound() {
  playTone(523.25, 0, 0.12);
  playTone(783.99, 0.08, 0.18);
}

function wrongSound() {
  playTone(160, 0, 0.22, "sawtooth", 0.06);
}

function updateStatus() {
  const streakBit = streak >= 2 ? ` · 🔥${streak}` : "";
  statusEl.textContent = `${index + 1} / ${order.length} · Score ${score}${streakBit}`;
  statusEl.classList.remove("bump");
  void statusEl.offsetWidth;
  statusEl.classList.add("bump");
  barEl.style.width = `${(index / order.length) * 100}%`;
}

function setFeedback(text, cls) {
  feedbackEl.textContent = text;
  feedbackEl.className = cls || "";
}

function clearAuto() {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

function start(customOrder) {
  clearAuto();
  document.querySelectorAll(".confetti").forEach((n) => n.remove());
  order = customOrder && customOrder.length ? shuffle([...customOrder]) : shuffle([...CARDS.keys()]);
  index = 0;
  score = 0;
  missed = [];
  streak = 0;
  maxStreak = 0;
  selectedIndex = -1;
  document.body.dataset.hype = "0";
  document.body.classList.remove("shake-rails");
  resultSection.hidden = true;
  quizSection.hidden = false;
  render();
}

function render() {
  clearAuto();
  const card = CARDS[order[index]];
  updateStatus();
  const isReverse = mode === "reverse";
  // restart entrance animation
  termEl.style.animation = "none";
  void termEl.offsetWidth;
  termEl.style.animation = "";
  termEl.textContent = isReverse ? card.definition : card.term;
  termEl.classList.toggle("definition-prompt", isReverse);
  setFeedback("", "");
  selectedIndex = -1;
  graded = false;
  resetActionButton("Submit", false);
  submitBtn.disabled = true;

  const others = CARDS.filter((_, i) => i !== order[index]);
  currentOptions = shuffle([card, ...shuffle(others).slice(0, 3)]);

  optionsEl.innerHTML = "";
  currentOptions.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const kbd = document.createElement("kbd");
    kbd.textContent = i + 1;
    btn.appendChild(kbd);
    btn.appendChild(document.createTextNode(isReverse ? opt.term : opt.definition));
    btn.addEventListener("click", () => select(i));
    optionsEl.appendChild(btn);
  });
}

function select(choiceIndex) {
  if (graded || buttonMode === "next") return; // already submitted — locked in
  selectedIndex = choiceIndex;
  const buttons = [...optionsEl.children];
  buttons.forEach((b, i) => b.classList.toggle("selected", i === choiceIndex));
  setFeedback("", "");
  submitBtn.disabled = false;
  submitBtn.focus();
}

function submitAnswer() {
  if (buttonMode === "next") {
    advance();
    return;
  }
  if (graded || selectedIndex < 0 || submitBtn.disabled) return;
  const card = CARDS[order[index]];
  const buttons = [...optionsEl.children];
  buttons.forEach((b) => (b.disabled = true));
  submitBtn.disabled = true;
  graded = true;

  const picked = currentOptions[selectedIndex];
  const correctIndex = currentOptions.indexOf(card);
  const btn = buttons[selectedIndex];

  if (picked === card) {
    score++;
    streak++;
    maxStreak = Math.max(maxStreak, streak);
    btn.classList.add("correct");
    correctSound();
    if (streak >= 4) {
      setFeedback(`🔥 ${pick(FIRE_PRAISE)} x${streak}`, "fire");
    } else if (streak >= 2) {
      setFeedback(`${pick(PRAISE)} x${streak}`, "good");
    } else {
      setFeedback(pick(PRAISE), "good");
    }
    // correct: keep momentum, auto-advance
    resetActionButton("Submit", false);
    clearAuto();
    autoTimer = setTimeout(() => advance(), 750);
  } else {
    streak = 0;
    btn.classList.add("wrong");
    buttons[correctIndex].classList.add("correct");
    wrongSound();
    shakeRails();
    quizSection.classList.remove("shake");
    void quizSection.offsetWidth;
    quizSection.classList.add("shake");
    const answerText = mode === "reverse" ? card.term : card.definition;
    setFeedback(`Nope — it was "${answerText}"`, "bad");
    missed.push(card);
    // wrong: pause and let Submit become Next so they can read it
    clearAuto();
    resetActionButton("Next →", true);
    submitBtn.disabled = false;
    submitBtn.focus();
  }

  updateStatus();
  setHype();
}

function advance() {
  clearAuto();
  index++;
  if (index < order.length) {
    render();
  } else {
    showResult();
  }
}

function getGrade(pct) {
  if (pct >= 90) return "🏆 Absurd. Odyssey scholar.";
  if (pct >= 70) return "🔥 Solid — almost there.";
  if (pct >= 50) return "📖 Getting there — hit retry on your misses.";
  return "💀 The Odyssey wins this round. Run it back.";
}

function launchConfetti(n = 80) {
  const colors = ["#7ee787", "#ffa657", "#79c0ff", "#d2a8ff", "#ffa198", "#fff"];
  for (let i = 0; i < n; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = pick(colors);
    c.style.animationDuration = `${2 + Math.random() * 2}s`;
    c.style.animationDelay = `${Math.random() * 0.6}s`;
    c.style.width = `${6 + Math.random() * 6}px`;
    c.style.height = `${10 + Math.random() * 8}px`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}

function showResult() {
  clearAuto();
  quizSection.hidden = true;
  resultSection.hidden = false;
  barEl.style.width = "100%";
  const pct = order.length ? Math.round((score / order.length) * 100) : 0;
  finalEl.textContent = `Score: ${score} / ${order.length} (${pct}%) · Best streak 🔥${maxStreak}`;
  gradeEl.textContent = getGrade(pct);

  try {
    const key = "odyssey-best";
    const prev = Number(localStorage.getItem(key) || 0);
    const best = Math.max(prev, score);
    localStorage.setItem(key, String(best));
    bestEl.textContent = `Best score on this device: ${best} / ${CARDS.length}`;
  } catch (_) {
    bestEl.textContent = "";
  }

  missedEl.innerHTML = "";
  if (missed.length > 0) {
    missed.forEach((c) => {
      const p = document.createElement("p");
      p.textContent = `${c.term} — ${c.definition}`;
      missedEl.appendChild(p);
    });
  } else {
    const p = document.createElement("p");
    p.textContent = "Flawless. Nothing missed.";
    missedEl.appendChild(p);
  }

  retryMissedBtn.disabled = missed.length === 0;
  if (pct >= 70) launchConfetti();
}

submitBtn.addEventListener("click", submitAnswer);

restartBtn.addEventListener("click", () => start());

retryMissedBtn.addEventListener("click", () => {
  if (!missed.length) return;
  const retryOrder = missed.map((c) => CARDS.indexOf(c)).filter((i) => i >= 0);
  start(retryOrder);
});

document.addEventListener("keydown", (e) => {
  if (quizSection.hidden) {
    if (e.key === "Enter" && !resultSection.hidden) {
      if (!retryMissedBtn.disabled) retryMissedBtn.click();
      else restartBtn.click();
    }
    return;
  }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= currentOptions.length) {
    const btn = optionsEl.children[n - 1];
    if (btn && !btn.disabled) btn.click();
  } else if (e.key === "Enter") {
    if (!submitBtn.disabled) submitAnswer();
  }
});

modeForwardBtn.addEventListener("click", () => setMode("forward"));
modeReverseBtn.addEventListener("click", () => setMode("reverse"));

initMotion();
start();
