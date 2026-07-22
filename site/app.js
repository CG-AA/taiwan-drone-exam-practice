"use strict";

const PASS_SCORE = 85; // 正式測驗及格分數（百分制）

const WRONG_KEY = "droneExamWrong";           // localStorage：錯題 id 清單
const AUTO_REMOVE_KEY = "droneExamAutoRemove"; // localStorage：答對後自動移除
const CORRECT_KEY = "droneExamCorrect";        // localStorage：已答對題目 id 清單（累積制，僅手動移除）
const EXCLUDE_CORRECT_KEY = "droneExamExcludeCorrect"; // localStorage：排除已答對偏好

let bank = null;        // questions.json 內容
let exam = null;        // { questions: [...], answers: [null|'A'..'D'], index }

const $ = (id) => document.getElementById(id);

// ---- 錯題本（localStorage）----

const wrongIdOf = (q) => `${q.chapterIndex}:${q.number}`;

function loadWrongIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(WRONG_KEY));
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveWrongIds(set) {
  try {
    localStorage.setItem(WRONG_KEY, JSON.stringify([...set]));
  } catch {
    // 無痕模式等情況下無法寫入，僅本次不保存
  }
}

// ---- 已答對題目（localStorage）----

function loadCorrectIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(CORRECT_KEY));
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveCorrectIds(set) {
  try {
    localStorage.setItem(CORRECT_KEY, JSON.stringify([...set]));
  } catch {
    // 無痕模式等情況下無法寫入，僅本次不保存
  }
}

// 依 id 找回題目物件；題庫更新後失效的 id 會被略過
function resolveWrongQuestions(ids) {
  const questions = [];
  for (const id of ids) {
    const [ci, num] = id.split(":").map(Number);
    const ch = bank.chapters[ci];
    const q = ch?.questions.find((qq) => qq.number === num);
    if (q) questions.push({ ...q, chapter: ch.title, chapterIndex: ci });
  }
  return questions;
}

function refreshWrongUi() {
  const n = loadWrongIds().size;
  $("wrong-count").textContent = `目前錯題本共 ${n} 題`;
  $("wrong-exam-btn").disabled = n === 0;
  $("manage-wrong-btn").disabled = n === 0;
  $("clear-wrong-btn").disabled = n === 0;

  const c = loadCorrectIds().size;
  $("correct-count").textContent = `已累積答對 ${c} 題`;
  $("manage-correct-btn").disabled = c === 0;
  $("clear-correct-btn").disabled = c === 0;
}

// ---- 管理畫面：逐題檢視／移除 ----

let manageTab = "wrong"; // 目前分頁："wrong" | "correct"

function openManage(tab) {
  manageTab = tab;
  renderManage();
  showScreen("manage-screen");
}

function renderManage() {
  const isWrong = manageTab === "wrong";
  const wrongIds = loadWrongIds();
  const correctIds = loadCorrectIds();
  const tabWrong = $("manage-tab-wrong");
  const tabCorrect = $("manage-tab-correct");
  tabWrong.textContent = `錯題本（${wrongIds.size}）`;
  tabCorrect.textContent = `答對紀錄（${correctIds.size}）`;
  tabWrong.className = isWrong ? "active" : "";
  tabCorrect.className = isWrong ? "" : "active";
  tabWrong.setAttribute("aria-pressed", String(isWrong));
  tabCorrect.setAttribute("aria-pressed", String(!isWrong));

  const ids = isWrong ? wrongIds : correctIds;
  const questions = resolveWrongQuestions(ids);
  let countText = `共 ${questions.length} 題`;
  if (ids.size > questions.length) {
    countText += `（另有 ${ids.size - questions.length} 題已不在最新題庫，將自動略過）`;
  }
  $("manage-count").textContent = countText;

  const list = $("manage-list");
  list.innerHTML = "";
  if (questions.length === 0) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = isWrong
      ? "錯題本是空的，做一次測驗後答錯的題目會出現在這裡。"
      : "還沒有答對紀錄，作答正確的題目會累積在這裡。";
    list.append(p);
    return;
  }
  questions.forEach((q) => {
    const div = document.createElement("div");
    div.className = "review-item manage-item";
    div.innerHTML = `
      <div class="manage-item-body">
        <p class="q-chapter">${escapeHtml(q.chapter)}</p>
        <p class="q-stem">${q.number}. ${escapeHtml(q.stem)}</p>
        <p class="correct-answer">正確答案：(${q.answer}) ${escapeHtml(q.options[q.answer])}</p>
      </div>`;
    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = "移除";
    btn.addEventListener("click", () => removeFromBook(wrongIdOf(q)));
    div.append(btn);
    list.append(div);
  });
}

// 從目前分頁對應的紀錄中移除單一題目
function removeFromBook(id) {
  const ids = manageTab === "wrong" ? loadWrongIds() : loadCorrectIds();
  ids.delete(id);
  (manageTab === "wrong" ? saveWrongIds : saveCorrectIds)(ids);
  renderManage();
}

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

  const autoRemove = $("auto-remove");
  autoRemove.checked = localStorage.getItem(AUTO_REMOVE_KEY) !== "0";
  autoRemove.addEventListener("change", () => {
    try {
      localStorage.setItem(AUTO_REMOVE_KEY, autoRemove.checked ? "1" : "0");
    } catch {}
  });
  const excludeCorrect = $("exclude-correct");
  excludeCorrect.checked = localStorage.getItem(EXCLUDE_CORRECT_KEY) === "1";
  excludeCorrect.addEventListener("change", () => {
    try {
      localStorage.setItem(EXCLUDE_CORRECT_KEY, excludeCorrect.checked ? "1" : "0");
    } catch {}
  });

  $("wrong-exam-btn").addEventListener("click", startWrongExam);
  $("clear-wrong-btn").addEventListener("click", () => {
    if (!confirm(`確定要清空錯題本（共 ${loadWrongIds().size} 題）嗎？`)) return;
    saveWrongIds(new Set());
    refreshWrongUi();
  });
  $("clear-correct-btn").addEventListener("click", () => {
    if (!confirm(`確定要清除答對紀錄（共 ${loadCorrectIds().size} 題）嗎？`)) return;
    saveCorrectIds(new Set());
    refreshWrongUi();
  });
  $("manage-wrong-btn").addEventListener("click", () => openManage("wrong"));
  $("manage-correct-btn").addEventListener("click", () => openManage("correct"));
  $("manage-tab-wrong").addEventListener("click", () => { manageTab = "wrong"; renderManage(); });
  $("manage-tab-correct").addEventListener("click", () => { manageTab = "correct"; renderManage(); });
  $("manage-back-btn").addEventListener("click", () => showScreen("setup-screen"));
  refreshWrongUi();

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
    .map((cb) => Number(cb.value));
  if (chosen.length === 0) {
    alert("請至少選擇一個章節。");
    return;
  }

  let pool = chosen.flatMap((ci) =>
    bank.chapters[ci].questions.map((q) => ({
      ...q,
      chapter: bank.chapters[ci].title,
      chapterIndex: ci,
    }))
  );

  if ($("exclude-correct").checked) {
    const correct = loadCorrectIds();
    pool = pool.filter((q) => !correct.has(wrongIdOf(q)));
    if (pool.length === 0) {
      alert("已排除所有已答對的題目，沒有可出的題目了。");
      return;
    }
  }

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

  beginExam(questions);
}

// 錯題重測：全部錯題洗牌後作答
function startWrongExam() {
  const questions = shuffle(resolveWrongQuestions(loadWrongIds()));
  if (questions.length === 0) {
    alert("錯題本是空的，先做一次測驗吧！");
    return;
  }
  beginExam(questions);
}

function beginExam(questions) {
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

  // 更新錯題本：答錯（含未作答）加入；勾選自動移除時，答對即移出
  // 「已答對」紀錄為累積制：曾答對即保留，只能在管理頁或清除按鈕手動移除
  const wrongIds = loadWrongIds();
  const correctIds = loadCorrectIds();
  const autoRemove = $("auto-remove").checked;
  let added = 0, removed = 0;
  exam.questions.forEach((q, i) => {
    const id = wrongIdOf(q);
    if (exam.answers[i] !== q.answer) {
      if (!wrongIds.has(id)) { wrongIds.add(id); added++; }
    } else {
      correctIds.add(id);
      if (autoRemove && wrongIds.delete(id)) removed++;
    }
  });
  saveWrongIds(wrongIds);
  saveCorrectIds(correctIds);
  $("wrong-summary").textContent =
    `錯題本：新增 ${added} 題、移除 ${removed} 題（現共 ${wrongIds.size} 題）；答對紀錄現共 ${correctIds.size} 題`;

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
  for (const s of ["setup-screen", "manage-screen", "exam-screen", "result-screen"]) {
    $(s).hidden = s !== id;
  }
  if (id === "setup-screen") refreshWrongUi();
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
