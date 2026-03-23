// ===== main.js =====
// アプリ起動・画面遷移・イベント連結

import { generateInitialState } from './data.js';
import { initState, loadGame, hasSave, saveGame } from './state.js';
import { renderHeader, navigateTo, setupMatchButton } from './ui.js';

// ===== 画面切替ヘルパー =====
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ===== タイトル画面 =====
function initTitleScreen() {
  const btnStart    = document.getElementById("btn-start");
  const btnContinue = document.getElementById("btn-continue");

  if (hasSave()) {
    btnContinue.style.display = "block";
  }

  btnStart.addEventListener("click", () => {
    showScreen("screen-newgame");
  });

  btnContinue.addEventListener("click", () => {
    const saved = loadGame();
    if (saved) {
      initState(saved);
      startGame();
    } else {
      showScreen("screen-newgame");
    }
  });
}

// ===== 新規ゲーム設定画面 =====
function initNewGameScreen() {
  const btn = document.getElementById("btn-newgame-confirm");
  const input = document.getElementById("input-teamname");

  btn.addEventListener("click", () => {
    const teamName = input.value.trim() || "青山バレー部";
    const initialState = generateInitialState(teamName);
    initState(initialState);
    saveGame();
    startGame();
  });

  // Enterキーでも進める
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });
}

// ===== ゲーム開始 =====
function startGame() {
  showScreen("screen-game");
  renderHeader();
  navigateTo("practice");
}

// ===== フッタータブ =====
function initFooterTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      navigateTo(btn.dataset.tab);
    });
  });
}

// ===== 初期化 =====
document.addEventListener("DOMContentLoaded", () => {
  initTitleScreen();
  initNewGameScreen();
  initFooterTabs();
  setupMatchButton();
  showScreen("screen-title");
});
