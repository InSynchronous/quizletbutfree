let order = [];
let index = 0;
let score = 0;
let missed = [];
let currentOptions = [];
let mode = "forward"; // "forward" = term -> definition, "reverse" = definition -> term

const termEl = document.getElementById("term");
const optionsEl = document.getElementById("options");
const statusEl = document.getElementById("status");
const nextBtn = document.getElementById("next");
const quizSection = document.getElementById("quiz");
const resultSection = document.getElementById("result");
const finalEl = document.getElementById("final");
const missedEl = document.getElementById("missed");
const restartBtn = document.getElementById("restart");
const modeForwardBtn = document.getElementById("mode-forward");
const modeReverseBtn = document.getElementById("mode-reverse");

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

function start() {
  order = shuffle([...CARDS.keys()]);
  index = 0;
  score = 0;
  missed = [];
  resultSection.hidden = true;
  quizSection.hidden = false;
  render();
}

function render() {
  const card = CARDS[order[index]];
  statusEl.textContent = `${index + 1} / ${CARDS.length} · Score ${score}`;
  const isReverse = mode === "reverse";
  termEl.textContent = isReverse ? card.definition : card.term;
  termEl.classList.toggle("definition-prompt", isReverse);
  nextBtn.disabled = true;

  const others = CARDS.filter((_, i) => i !== order[index]);
  currentOptions = shuffle([card, ...shuffle(others).slice(0, 3)]);

  optionsEl.innerHTML = "";
  currentOptions.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.textContent = isReverse ? opt.term : opt.definition;
    btn.addEventListener("click", () => answer(i, btn));
    optionsEl.appendChild(btn);
  });
}

function answer(choiceIndex, btn) {
  const card = CARDS[order[index]];
  const buttons = [...optionsEl.children];
  buttons.forEach((b) => (b.disabled = true));

  const picked = currentOptions[choiceIndex];
  const correctIndex = currentOptions.indexOf(card);

  if (picked === card) {
    score++;
    btn.classList.add("correct");
  } else {
    btn.classList.add("wrong");
    buttons[correctIndex].classList.add("correct");
    missed.push(card);
  }

  statusEl.textContent = `${index + 1} / ${CARDS.length} · Score ${score}`;
  nextBtn.disabled = false;
  nextBtn.focus();
}

nextBtn.addEventListener("click", () => {
  index++;
  if (index < CARDS.length) {
    render();
  } else {
    showResult();
  }
});

function showResult() {
  quizSection.hidden = true;
  resultSection.hidden = false;
  finalEl.textContent = `Score: ${score} / ${CARDS.length}`;

  missedEl.innerHTML = "";
  if (missed.length > 0) {
    missed.forEach((c) => {
      const p = document.createElement("p");
      p.textContent = `${c.term} — ${c.definition}`;
      missedEl.appendChild(p);
    });
  }
}

document.addEventListener("keydown", (e) => {
  if (quizSection.hidden) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= currentOptions.length) {
    const btn = optionsEl.children[n - 1];
    if (btn && !btn.disabled) btn.click();
  } else if (e.key === "Enter" && !nextBtn.disabled) {
    nextBtn.click();
  }
});

restartBtn.addEventListener("click", start);

modeForwardBtn.addEventListener("click", () => setMode("forward"));
modeReverseBtn.addEventListener("click", () => setMode("reverse"));

start();
