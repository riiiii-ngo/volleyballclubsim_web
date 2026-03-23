// ===== state.js =====
// ゲーム状態管理・localStorage永続化

import { VERSION } from './data.js';

const SAVE_KEY = "vbc_v1";

let _state = null;
const _listeners = [];

export function getState() {
  return _state;
}

export function setState(patch) {
  Object.assign(_state, patch);
  _notify();
}

export function subscribe(fn) {
  _listeners.push(fn);
  return () => {
    const i = _listeners.indexOf(fn);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

function _notify() {
  for (const fn of _listeners) fn(_state);
}

export function initState(initialData) {
  _state = initialData;
  _notify();
}

// --- 保存 ---
export function saveGame() {
  if (!_state) return;
  const snapshot = JSON.parse(JSON.stringify(_state));
  snapshot.meta.savedAt = new Date().toISOString();
  // ラリーログは最後の試合分のみ保持
  if (snapshot.lastMatchLog && snapshot.lastMatchLog.length > 200) {
    snapshot.lastMatchLog = snapshot.lastMatchLog.slice(-200);
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.error("Save failed:", e);
  }
}

// --- 読み込み ---
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.meta) return null;
    // バージョンが違う場合は破棄
    if (data.meta.version !== VERSION) {
      console.warn("Save version mismatch, starting new game");
      return null;
    }
    return data;
  } catch (e) {
    console.error("Load failed:", e);
    return null;
  }
}

// --- リセット ---
export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

// --- ヘルパー: プレイヤーチーム取得 ---
export function getPlayerTeam() {
  if (!_state) return null;
  return _state.teams.find(t => t.id === _state.player.teamId);
}

// --- ヘルパー: IDでチーム取得 ---
export function getTeamById(id) {
  if (!_state) return null;
  return _state.teams.find(t => t.id === id);
}

// --- ヘルパー: IDで選手取得（全チーム検索） ---
export function getPlayerById(pid) {
  if (!_state) return null;
  for (const team of _state.teams) {
    const p = team.roster.find(pl => pl.id === pid);
    if (p) return p;
  }
  return null;
}

// --- ヘルパー: スタメン選手リスト取得 ---
export function getStarters(team) {
  if (!team) return [];
  const order = ["OP","OH1","OH2","MB1","MB2","Se","Li"];
  const result = [];
  for (const slot of order) {
    const pid = team.starters[slot];
    if (pid) {
      const p = team.roster.find(pl => pl.id === pid);
      if (p) result.push(p);
    }
  }
  return result;
}

// --- ヘルパー: 今週のプレイヤー試合取得 ---
export function getCurrentMatch() {
  if (!_state) return null;
  const { absoluteWeek } = _state.time;
  const teamId = _state.player.teamId;
  return _state.schedule.find(
    s => s.absoluteWeek === absoluteWeek &&
         (s.homeTeamId === teamId || s.awayTeamId === teamId) &&
         s.result === null
  ) || null;
}

// --- ヘルパー: 次のプレイヤー試合 ---
export function getNextMatch() {
  if (!_state) return null;
  const { absoluteWeek } = _state.time;
  const teamId = _state.player.teamId;
  return _state.schedule.find(
    s => s.absoluteWeek > absoluteWeek &&
         (s.homeTeamId === teamId || s.awayTeamId === teamId) &&
         s.result === null
  ) || null;
}

// --- ヘルパー: スタンディング取得 ---
export function getStanding(teamId) {
  if (!_state) return null;
  return _state.standings.find(s => s.teamId === teamId);
}
