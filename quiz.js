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

// --- coins ---
let coins = 0;
let coinsEarnedRun = 0;
try {
  const saved = Number(localStorage.getItem("odyssey-coins"));
  coins = Number.isFinite(saved) && saved >= 0 ? Math.floor(saved) : 50;
  if (localStorage.getItem("odyssey-coins") === null) coins = 50; // starter bankroll
} catch (_) {
  coins = 50;
}

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
const coinsEl = document.getElementById("coins");
const shopEl = document.getElementById("shop");
const shopOpenBtn = document.getElementById("shop-open");
const shopCloseBtn = document.getElementById("shop-close");
const shopCoinsEl = document.getElementById("shop-coins");

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

function saveCoins() {
  try {
    localStorage.setItem("odyssey-coins", String(coins));
  } catch (_) {}
}

function updateCoinsUI() {
  if (coinsEl) {
    coinsEl.textContent = `🪙 ${coins}`;
    coinsEl.classList.remove("bump");
    void coinsEl.offsetWidth;
    coinsEl.classList.add("bump");
  }
  if (shopCoinsEl) shopCoinsEl.textContent = `🪙 ${coins}`;
  if (typeof refreshBJ === "function") refreshBJ();
  if (typeof refreshRO === "function") refreshRO();
}

function addCoins(n) {
  coins += n;
  coinsEarnedRun += n;
  saveCoins();
  updateCoinsUI();
}

function coinReward() {
  // base 10, streak bonuses: x3+ => 15, x5+ => 20
  if (streak >= 5) return 20;
  if (streak >= 3) return 15;
  return 10;
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
  coinsEarnedRun = 0;
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
    const reward = coinReward();
    addCoins(reward);
    if (streak >= 4) {
      setFeedback(`🔥 ${pick(FIRE_PRAISE)} x${streak} · +${reward} 🪙`, "fire");
    } else if (streak >= 2) {
      setFeedback(`${pick(PRAISE)} x${streak} · +${reward} 🪙`, "good");
    } else {
      setFeedback(`${pick(PRAISE)} +${reward} 🪙`, "good");
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
  finalEl.textContent = `Score: ${score} / ${order.length} (${pct}%) · Best streak 🔥${maxStreak} · +${coinsEarnedRun} 🪙 this run (balance 🪙${coins})`;
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
  if (shopEl && !shopEl.hidden) return; // shop open — don't hijack keys
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

// --- shop ---
function openShop() {
  if (shopEl) {
    shopEl.hidden = false;
    updateCoinsUI();
  }
}
function closeShop() {
  if (shopEl) shopEl.hidden = true;
}
if (shopOpenBtn) shopOpenBtn.addEventListener("click", openShop);
if (shopCloseBtn) shopCloseBtn.addEventListener("click", closeShop);
if (shopEl) {
  shopEl.addEventListener("click", (e) => {
    if (e.target === shopEl) closeShop();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !shopEl.hidden) closeShop();
  });
}

// --- blackjack ---
const bjMsgEl = document.getElementById("bj-msg");
const bjDealerEl = document.getElementById("bj-dealer");
const bjPlayerEl = document.getElementById("bj-player");
const bjDealerValEl = document.getElementById("bj-dealer-val");
const bjPlayerValEl = document.getElementById("bj-player-val");
const bjBetEl = document.getElementById("bj-bet");
const bjDealBtn = document.getElementById("bj-deal");
const bjHitBtn = document.getElementById("bj-hit");
const bjStandBtn = document.getElementById("bj-stand");
const bjFreeBtn = document.getElementById("bj-free");
const bjChipsEl = document.getElementById("bj-chips");

let bjBet = 10;
let bjDeck = [];
let bjPlayer = [];
let bjDealer = [];
let bjPhase = "betting"; // "betting" | "player" | "done"
let bjHoleHidden = true;

const BJ_SUITS = ["♠", "♥", "♦", "♣"];
const BJ_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function bjNewDeck() {
  const d = [];
  for (const s of BJ_SUITS) for (const r of BJ_RANKS) d.push({ r, s });
  return shuffle(d);
}

function bjValue(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.r === "A") {
      aces++;
      total += 11;
    } else if (["K", "Q", "J"].includes(c.r)) {
      total += 10;
    } else {
      total += Number(c.r);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function bjIsBlackjack(hand) {
  return hand.length === 2 && bjValue(hand) === 21;
}

function bjCardEl(card, faceDown) {
  const div = document.createElement("div");
  div.className = "bj-card" + (faceDown ? " face-down" : "") + (card && (card.s === "♥" || card.s === "♦") ? " red" : "");
  div.textContent = faceDown ? "🂠" : `${card.r}${card.s}`;
  return div;
}

function bjSetMsg(text) {
  if (bjMsgEl) bjMsgEl.textContent = text;
}

function renderBJ() {
  if (!bjDealerEl || !bjPlayerEl) return;
  bjDealerEl.innerHTML = "";
  bjPlayerEl.innerHTML = "";
  bjDealer.forEach((c, i) => {
    bjDealerEl.appendChild(bjCardEl(c, bjHoleHidden && i === 1 && bjPhase === "player"));
  });
  bjPlayer.forEach((c) => bjPlayerEl.appendChild(bjCardEl(c, false)));
  if (bjDealerValEl) {
    bjDealerValEl.textContent =
      bjDealer.length === 0 ? "" : bjHoleHidden && bjPhase === "player" ? `${bjValue([bjDealer[0]])} + ?` : `${bjValue(bjDealer)}`;
  }
  if (bjPlayerValEl) bjPlayerValEl.textContent = bjPlayer.length === 0 ? "" : `${bjValue(bjPlayer)}`;
  if (bjBetEl) bjBetEl.textContent = `${bjBet}`;
}

function refreshBJ() {
  if (!bjDealBtn) return;
  if (bjFreeBtn) bjFreeBtn.hidden = coins >= 10;
  if (bjPhase === "betting") {
    bjDealBtn.disabled = coins < bjBet || bjBet <= 0;
    bjHitBtn.disabled = true;
    bjStandBtn.disabled = true;
    if (coins < bjBet) {
      bjSetMsg(coins < 10 ? "Out of coins — answer quiz questions or claim free coins." : "Bet too high for your balance. Lower it or earn more in the quiz.");
    } else if (bjDealer.length === 0 && bjPlayer.length === 0) {
      if (!bjMsgEl.textContent) bjSetMsg("Place a bet to start.");
    }
  } else if (bjPhase === "player") {
    bjDealBtn.disabled = true;
    bjHitBtn.disabled = false;
    bjStandBtn.disabled = false;
  } else {
    bjDealBtn.disabled = coins < bjBet || bjBet <= 0;
    bjHitBtn.disabled = true;
    bjStandBtn.disabled = true;
  }
  renderBJ();
}

function bjDeal() {
  if (bjPhase !== "betting" && bjPhase !== "done") return;
  if (coins < bjBet || bjBet <= 0) {
    refreshBJ();
    return;
  }
  coins -= bjBet;
  saveCoins();
  updateCoinsUI();
  bjDeck = bjNewDeck();
  bjPlayer = [bjDeck.pop(), bjDeck.pop()];
  bjDealer = [bjDeck.pop(), bjDeck.pop()];
  bjPhase = "player";
  bjHoleHidden = true;

  const pBJ = bjIsBlackjack(bjPlayer);
  const dBJ = bjIsBlackjack(bjDealer);
  renderBJ();
  if (pBJ || dBJ) {
    bjHoleHidden = false;
    bjPhase = "done";
    if (pBJ && dBJ) {
      coins += bjBet; // push
      saveCoins();
      bjSetMsg(`Both blackjack — push. Bet returned.`);
    } else if (pBJ) {
      const payout = Math.floor(bjBet * 2.5);
      coins += payout;
      saveCoins();
      bjSetMsg(`BLACKJACK! +${payout - bjBet} 🪙`);
      correctSound();
      launchConfetti(30);
    } else {
      bjSetMsg(`Dealer blackjack. You lose 🪙${bjBet}.`);
      wrongSound();
    }
    updateCoinsUI();
    refreshBJ();
    return;
  }
  bjSetMsg(`Your move: Hit or Stand? (bet 🪙${bjBet})`);
  refreshBJ();
}

function bjHit() {
  if (bjPhase !== "player") return;
  bjPlayer.push(bjDeck.pop());
  const v = bjValue(bjPlayer);
  if (v > 21) {
    bjHoleHidden = false;
    bjPhase = "done";
    bjSetMsg(`Bust! ${v} over 21. You lose 🪙${bjBet}.`);
    wrongSound();
    shakeRails();
  } else if (v === 21) {
    bjStand();
    return;
  } else {
    bjSetMsg(`You have ${v}. Hit or Stand?`);
  }
  updateCoinsUI();
  refreshBJ();
}

function bjStand() {
  if (bjPhase !== "player") return;
  bjHoleHidden = false;
  while (bjValue(bjDealer) < 17) bjDealer.push(bjDeck.pop());
  const p = bjValue(bjPlayer);
  const d = bjValue(bjDealer);
  bjPhase = "done";
  if (d > 21) {
    coins += bjBet * 2;
    saveCoins();
    bjSetMsg(`Dealer busts at ${d}! You win +${bjBet} 🪙`);
    correctSound();
    launchConfetti(30);
  } else if (d > p) {
    bjSetMsg(`Dealer ${d} beats ${p}. You lose 🪙${bjBet}.`);
    wrongSound();
  } else if (p > d) {
    coins += bjBet * 2;
    saveCoins();
    bjSetMsg(`You ${p} beat dealer ${d}! +${bjBet} 🪙`);
    correctSound();
    launchConfetti(30);
  } else {
    coins += bjBet;
    saveCoins();
    bjSetMsg(`Push at ${p}. Bet returned.`);
  }
  updateCoinsUI();
  refreshBJ();
}

if (bjChipsEl) {
  bjChipsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || bjPhase === "player") return;
    if (btn.id === "bj-max") {
      bjBet = Math.max(10, Math.min(coins, 500));
    } else {
      bjBet = Number(btn.dataset.bet) || 10;
    }
    [...bjChipsEl.querySelectorAll("button")].forEach((b) => b.classList.toggle("active", b === btn));
    refreshBJ();
  });
}
if (bjDealBtn) bjDealBtn.addEventListener("click", bjDeal);
if (bjHitBtn) bjHitBtn.addEventListener("click", bjHit);
if (bjStandBtn) bjStandBtn.addEventListener("click", bjStand);
if (bjFreeBtn) {
  bjFreeBtn.addEventListener("click", () => {
    if (coins >= 10) return;
    coins += 25;
    saveCoins();
    updateCoinsUI();
    bjSetMsg("Claimed +25 🪙. Good luck!");
    refreshBJ();
  });
}

// --- roulette (red / black 1:1, green 14x) ---
const roMsgEl = document.getElementById("ro-msg");
const roWheelEl = document.getElementById("ro-wheel");
const roDotEl = document.getElementById("ro-dot");
const roLabelEl = document.getElementById("ro-label");
const roBetEl = document.getElementById("ro-bet");
const roSpinBtn = document.getElementById("ro-spin");
const roFreeBtn = document.getElementById("ro-free");
const roChipsEl = document.getElementById("ro-chips");
const roColorBtns = {
  red: document.getElementById("ro-red"),
  black: document.getElementById("ro-black"),
  green: document.getElementById("ro-green"),
};

// 15 slots, matches the conic-gradient order: 1 green + 7 red + 7 black
const RO_SLOTS = ["green", "red", "black", "red", "black", "red", "black", "red", "black", "red", "black", "red", "black", "red", "black"];
const RO_EMOJI = { red: "🔴", black: "⚫", green: "🟢" };

let roBet = 10;
let roColor = "red";
let roPhase = "idle"; // "idle" | "spinning"
let roRotation = 0;

function roSetMsg(text) {
  if (roMsgEl) roMsgEl.textContent = text;
}

function roShowResult(color) {
  if (roDotEl) roDotEl.className = color;
  if (roLabelEl) roLabelEl.textContent = color.toUpperCase();
}

function roMotionOK() {
  try {
    if (document.body.classList.contains("no-motion")) return false;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  } catch (_) {}
  return true;
}

function refreshRO() {
  if (!roSpinBtn) return;
  const spinning = roPhase === "spinning";
  if (roFreeBtn) roFreeBtn.hidden = coins >= 10;
  if (roBetEl) roBetEl.textContent = `${roBet}`;
  for (const [c, btn] of Object.entries(roColorBtns)) {
    if (!btn) continue;
    btn.classList.toggle("active", c === roColor);
    btn.setAttribute("aria-pressed", String(c === roColor));
    btn.disabled = spinning;
  }
  if (roChipsEl) {
    [...roChipsEl.querySelectorAll("button")].forEach((b) => {
      b.disabled = spinning;
      if (b.id !== "ro-max") b.classList.toggle("active", Number(b.dataset.bet) === roBet);
      else b.classList.remove("active");
    });
  }
  if (spinning) {
    roSpinBtn.disabled = true;
    return;
  }
  roSpinBtn.disabled = coins < roBet || roBet <= 0;
  if (coins < roBet && coins >= 10) {
    roSetMsg("Bet too high for your balance. Lower it or earn more in the quiz.");
  } else if (coins < 10 && roMsgEl && !roMsgEl.textContent) {
    roSetMsg("Out of coins — answer quiz questions or claim free coins.");
  }
}

function roSelectColor(color) {
  if (roPhase === "spinning") return;
  if (!RO_SLOTS.includes(color) && color !== "red" && color !== "black" && color !== "green") return;
  roColor = color;
  refreshRO();
}

function roSpin() {
  if (roPhase === "spinning") return;
  if (coins < roBet || roBet <= 0) {
    refreshRO();
    return;
  }
  coins -= roBet;
  saveCoins();
  updateCoinsUI();
  roPhase = "spinning";
  refreshRO();
  roSetMsg(`Spinning for ${RO_EMOJI[roColor]} ${roColor}… (bet 🪙${roBet})`);

  const idx = Math.floor(Math.random() * RO_SLOTS.length);
  const outcome = RO_SLOTS[idx];
  // pointer sits at top (0deg); slot i center is at i*24+12deg on the wheel
  const target = -(idx * 24 + 12);
  const base = Math.ceil(roRotation / 360) * 360;
  let delta = ((target - base) % 360 + 360) % 360;
  roRotation = base + 360 * 5 + delta; // 5 full turns + land on slot
  const animate = roMotionOK() && roWheelEl;

  const resolve = () => {
    const win = outcome === roColor;
    roShowResult(outcome);
    roPhase = "idle";
    if (win) {
      const mult = outcome === "green" ? 15 : 2; // stake back + profit (green profit = 14x)
      const profit = roBet * (mult - 1);
      coins += roBet * mult;
      saveCoins();
      correctSound();
      if (outcome === "green") {
        roSetMsg(`🟢 GREEN HITS! +${profit} 🪙 on 🪙${roBet} bet 🎉`);
        launchConfetti(30);
      } else {
        roSetMsg(`${RO_EMOJI[outcome]} ${outcome[0].toUpperCase() + outcome.slice(1)} hits! +${profit} 🪙`);
      }
    } else {
      wrongSound();
      shakeRails();
      roSetMsg(`${RO_EMOJI[outcome]} ${outcome[0].toUpperCase() + outcome.slice(1)} hits — you picked ${RO_EMOJI[roColor]} ${roColor}. Lost 🪙${roBet}.`);
    }
    updateCoinsUI();
    refreshRO();
  };

  if (animate) {
    requestAnimationFrame(() => {
      roWheelEl.style.transform = `rotate(${roRotation}deg)`;
    });
    setTimeout(resolve, 1350);
  } else {
    if (roWheelEl) roWheelEl.style.transform = `rotate(${roRotation}deg)`;
    setTimeout(resolve, 50);
  }
}

if (roChipsEl) {
  roChipsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || roPhase === "spinning") return;
    if (btn.id === "ro-max") {
      roBet = Math.max(10, Math.min(coins, 500));
    } else {
      roBet = Number(btn.dataset.bet) || 10;
    }
    refreshRO();
  });
}
for (const [c, btn] of Object.entries(roColorBtns)) {
  if (btn) btn.addEventListener("click", () => roSelectColor(c));
}
if (roSpinBtn) roSpinBtn.addEventListener("click", roSpin);
if (roFreeBtn) {
  roFreeBtn.addEventListener("click", () => {
    if (coins >= 10) return;
    coins += 25;
    saveCoins();
    updateCoinsUI();
    roSetMsg("Claimed +25 🪙. Good luck!");
    refreshRO();
  });
}

initMotion();
start();
updateCoinsUI();
refreshBJ();
refreshRO();
