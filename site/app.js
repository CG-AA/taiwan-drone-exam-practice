"use strict";

const PASS_SCORE = 85; // 正式測驗及格分數（百分制）

let bank = null;        // questions.json 內容
let exam = null;        // { questions: [...], answers: [null|'A'..'D'], index }

const $ = (id) => document.getElementById(id);

init();

async function init() {
  const res = await fetch("data/questions.json");
  bank = await res.json();

  const fs = $("chapter-select");
  bank.chapters.forEach((ch, i) => {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = i;
    cb.checked = true;
    label.append(cb, ` ${ch.title}（${ch.questions.length} 題）`);
    fs.append(label);
  });

  document.querySelectorAll('input[name="count"]').forEach((r) =>
    r.addEventListener("change", () => {
      $("custom-count").disabled = r.value !== "custom" || !r.checked;
    })
  );

  $("start-btn").addEventListener("click", startExam);
  $("prev-btn").addEventListener("click", () => gotoQuestion(exam.index - 1));
  $("next-btn").addEventListener("click", () => gotoQuestion(exam.index + 1));
  $("submit-btn").addEventListener("click", submitExam);
  $("quit-btn").addEventListener("click", () => {
    if (confirm("確定要放棄本次測驗嗎？")) showScreen("setup-screen");
  });
  $("restart-btn").addEventListener("click", () => showScreen("setup-screen"));
  $("review-btn").addEventListener("click", () => {
    const list = $("review-list");
    list.hidden = !list.hidden;
    $("review-btn").textContent = list.hidden ? "檢視錯題" : "隱藏錯題";
  });
}

function startExam() {
  const chosen = [...document.querySelectorAll("#chapter-select input:checked")]
    .map((cb) => bank.chapters[Number(cb.value)]);
  if (chosen.length === 0) {
    alert("請至少選擇一個章節。");
    return;
  }

  const pool = chosen.flatMap((ch) =>
    ch.questions.map((q) => ({ ...q, chapter: ch.title }))
  );

  const mode = document.querySelector('input[name="count"]:checked').value;
  let questions;
  if (mode === "all") {
    questions = pool;
  } else {
    let n = mode === "custom" ? parseInt($("custom-count").value, 10) : Number(mode);
    if (!Number.isFinite(n) || n < 1) {
      alert("請輸入有效題數。");
      return;
    }
    n = Math.min(n, pool.length);
    questions = shuffle([...pool]).slice(0, n);
  }

  exam = {
    questions,
    answers: new Array(questions.length).fill(null),
    index: 0,
  };
  buildPalette();
  gotoQuestion(0);
  showScreen("exam-screen");
}

function gotoQuestion(i) {
  if (i < 0 || i >= exam.questions.length) return;
  exam.index = i;
  const q = exam.questions[i];

  $("progress-label").textContent =
    `第 ${i + 1} / ${exam.questions.length} 題（已作答 ${answeredCount()} 題）`;
  $("question-chapter").textContent = q.chapter;
  $("question-stem").textContent = `${i + 1}. ${q.stem}`;

  const box = $("options");
  box.innerHTML = "";
  for (const key of ["A", "B", "C", "D"]) {
    const btn = document.createElement("button");
    btn.className = "option" + (exam.answers[i] === key ? " selected" : "");
    btn.innerHTML = `<span class="opt-key">(${key})</span> ${escapeHtml(q.options[key])}`;
    btn.addEventListener("click", () => {
      exam.answers[i] = exam.answers[i] === key ? null : key;
      gotoQuestion(i);
      updatePalette();
    });
    box.append(btn);
  }

  $("prev-btn").disabled = i === 0;
  $("next-btn").disabled = i === exam.questions.length - 1;
  updatePalette();
}

function buildPalette() {
  const pal = $("palette");
  pal.innerHTML = "";
  exam.questions.forEach((_, i) => {
    const b = document.createElement("button");
    b.textContent = i + 1;
    b.addEventListener("click", () => gotoQuestion(i));
    pal.append(b);
  });
}

function updatePalette() {
  [...$("palette").children].forEach((b, i) => {
    b.className =
      (exam.answers[i] !== null ? "answered" : "") +
      (i === exam.index ? " current" : "");
  });
}

function answeredCount() {
  return exam.answers.filter((a) => a !== null).length;
}

function submitExam() {
  const unanswered = exam.questions.length - answeredCount();
  if (
    unanswered > 0 &&
    !confirm(`尚有 ${unanswered} 題未作答，未作答視為答錯。確定要交卷嗎？`)
  ) {
    return;
  }

  const wrong = [];
  let correct = 0;
  exam.questions.forEach((q, i) => {
    if (exam.answers[i] === q.answer) correct++;
    else wrong.push(i);
  });

  const total = exam.questions.length;
  const score = Math.round((correct / total) * 10000) / 100;
  $("score-value").textContent = `${score} 分`;
  $("score-detail").textContent = `答對 ${correct} / ${total} 題`;
  const pass = score >= PASS_SCORE;
  const badge = $("pass-badge");
  badge.textContent = pass ? "及格（≥ 85 分）" : "不及格（< 85 分）";
  badge.className = pass ? "pass" : "fail";

  const list = $("review-list");
  list.hidden = true;
  $("review-btn").textContent = "檢視錯題";
  $("review-btn").disabled = wrong.length === 0;
  if (wrong.length === 0) $("review-btn").textContent = "全部答對！";
  list.innerHTML = "";
  wrong.forEach((i) => {
    const q = exam.questions[i];
    const div = document.createElement("div");
    div.className = "review-item";
    const yours = exam.answers[i]
      ? `(${exam.answers[i]}) ${escapeHtml(q.options[exam.answers[i]])}`
      : "未作答";
    div.innerHTML = `
      <p class="q-chapter">${escapeHtml(q.chapter)}</p>
      <p class="q-stem">${i + 1}. ${escapeHtml(q.stem)}</p>
      <p class="your-answer">你的答案：${yours}</p>
      <p class="correct-answer">正確答案：(${q.answer}) ${escapeHtml(q.options[q.answer])}</p>`;
    list.append(div);
  });

  showScreen("result-screen");
}

function showScreen(id) {
  for (const s of ["setup-screen", "exam-screen", "result-screen"]) {
    $(s).hidden = s !== id;
  }
  window.scrollTo(0, 0);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
