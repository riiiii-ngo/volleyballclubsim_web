// ===== ui.js =====
// 全画面描画・タブルーター・ヘッダー

import {
  PRACTICE_MENUS, FACILITIES, ITEMS, calcRank, calcTeamRank,
  formatMonthWeek, monthWeekToAbs, absToMonthWeek
} from './data.js';
import {
  getState, getPlayerTeam, getTeamById, getStarters,
  getCurrentMatch, getNextMatch, getStanding, saveGame, clearSave
} from './state.js';
import {
  applyPractice, advanceWeek, playMatch, signScout,
  buyFacility, sellFacility, buyItem, useItem,
  firePlayer, setStarter, getSortedStandings, getPracticeLimit
} from './engine.js';

// --- 現在のタブ ---
let _currentTab = "practice";

// --- モーダルコールバック ---
let _modalResolve = null;

// ===== ヘルパー =====
function fmt(n) { return n.toLocaleString(); }
function fmtMoney(n) {
  const cls = n >= 0 ? "money-pos" : "money-neg";
  return `<span class="${cls}">¥${fmt(n)}</span>`;
}
function rankBadge(rank) {
  return `<span class="rank-badge rank-${rank}">${rank}</span>`;
}
function statBar(label, val) {
  const pct = Math.min(100, val);
  return `
    <div class="stat-bar-wrap">
      <span class="stat-bar-label">${label}</span>
      <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
      <span class="stat-bar-val">${Math.round(val)}</span>
    </div>`;
}
function staminaBar(cur, max) {
  const pct = max > 0 ? Math.round(cur / max * 100) : 0;
  const cls = pct >= 60 ? "stamina-ok" : pct >= 30 ? "stamina-warn" : "stamina-low";
  return `<div class="stamina-bar-wrap"><div class="stamina-bar-bg"><div class="stamina-bar-fill ${cls}" style="width:${pct}%"></div></div></div>`;
}

// ===== ヘッダー更新 =====
export function renderHeader() {
  const state = getState();
  if (!state) return;
  const { time, player } = state;
  const team = getPlayerTeam();
  if (!team) return;

  const starters = getStarters(team);
  const teamRank = calcTeamRank(starters);
  const { month, week, season } = time;

  document.getElementById("hdr-season").textContent = `S${season} ${month}月 第${week}週`;
  document.getElementById("hdr-teamname").textContent = team.name;
  document.getElementById("hdr-money").textContent = `¥${fmt(player.money)}`;
  document.getElementById("hdr-rank").textContent = teamRank;

  if (starters.length > 0) {
    const keys = ["spike","receive","serve","block","toss"];
    const labels = ["Sp","Re","Sv","Bl","To"];
    const avgs = keys.map(k => Math.round(starters.reduce((s,p) => s + p.stats[k], 0) / starters.length));
    document.getElementById("hdr-stats").textContent = labels.map((l,i) => `${l}:${avgs[i]}`).join(" ");
    const avgH = Math.round(starters.reduce((s,p) => s + p.height, 0) / starters.length);
    document.getElementById("hdr-height").textContent = `身長${avgH}cm`;
  }

  const nextMatch = getNextMatch();
  if (nextMatch) {
    const opId = nextMatch.homeTeamId === player.teamId ? nextMatch.awayTeamId : nextMatch.homeTeamId;
    const op = getTeamById(opId);
    const { month: nm, week: nw } = absToMonthWeek(nextMatch.absoluteWeek);
    document.getElementById("hdr-nextmatch").textContent = `次戦: vs ${op?.shortName || "?"} (${nm}月第${nw}週)`;
  } else {
    document.getElementById("hdr-nextmatch").textContent = "次戦: なし";
  }

  const totalSalary = team.roster.reduce((s,p) => s + p.salary, 0);
  document.getElementById("hdr-salary").textContent = `年俸計: ¥${fmt(totalSalary)}`;
}

// ===== タブ切替 =====
export function navigateTo(tab) {
  _currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  renderCurrentTab();
}

function renderCurrentTab() {
  const container = document.getElementById("screen-container");
  container.innerHTML = "";
  switch (_currentTab) {
    case "practice": renderPracticeTab(container); break;
    case "team":     renderTeamTab(container);     break;
    case "shop":     renderShopTab(container);     break;
    case "league":   renderLeagueTab(container);   break;
    case "other":    renderOtherTab(container);    break;
  }
  renderHeader();
}

// ===== 練習・試合タブ =====
function renderPracticeTab(c) {
  const state = getState();
  const team = getPlayerTeam();
  const currentMatch = getCurrentMatch();
  const practiceLimit = getPracticeLimit(state.player.facilities);
  const practiceUsed = state.practiceUsed || 0;
  const canPractice = practiceUsed < practiceLimit;
  const { month, week, season } = state.time;

  c.innerHTML = `<div class="section-title">S${season} ${month}月 第${week}週</div>`;

  // 資金不足の警告
  if (state.flags.insolvent) {
    c.innerHTML += `<div class="insolvent-warn">
      ⚠️ 資金不足です。選手の解雇または施設の売却で所持金をゼロ以上にしてください。
    </div>`;
  }

  // 試合がある週
  if (currentMatch && !currentMatch.result) {
    c.innerHTML += renderMatchPreview(currentMatch);
    return;
  }

  // 試合結果表示
  if (state.lastMatchResult && state.time.absoluteWeek > 1) {
    const r = state.lastMatchResult;
    const outcome = r.isWin ? "勝利！" : "敗北";
    const cls = r.isWin ? "win-text" : "loss-text";
    const setSc = r.setScores.map(s => `<span class="set-score-item">${s.a}-${s.b}</span>`).join("");
    c.innerHTML += `
      <div class="match-result-card">
        <div style="color:var(--text-muted);font-size:12px">前回の試合結果</div>
        <div class="match-result-outcome ${cls}">${outcome}</div>
        <div class="set-scores">${setSc}</div>
        <div class="reward-text">獲得: ¥${fmt(r.reward)}</div>
      </div>`;
    state.lastMatchResult = null;
  }

  // 練習メニュー
  c.innerHTML += `<div class="section-title">練習メニュー（${practiceUsed}/${practiceLimit}回済）</div>`;
  const grid = document.createElement("div");
  grid.className = "practice-grid";

  for (const menu of PRACTICE_MENUS) {
    const btn = document.createElement("button");
    btn.className = "practice-btn" + (menu.id === "rest" ? " rest" : "");
    btn.disabled = !canPractice;
    btn.innerHTML = `<div class="practice-name">${menu.icon} ${menu.name}</div>
      <div class="practice-effect">${menu.isRest ? "全選手の体力を回復" : menu.stats.join("・") + " +" + menu.xpMin + "~" + menu.xpMax + "XP"}</div>`;
    btn.addEventListener("click", () => doPractice(menu.id));
    grid.appendChild(btn);
  }
  c.appendChild(grid);

  // 週進行ボタン
  const advBtn = document.createElement("button");
  advBtn.className = "tag-advance-btn";
  advBtn.textContent = "週を進める";
  advBtn.disabled = !!state.flags.insolvent;
  advBtn.addEventListener("click", doAdvanceWeek);
  c.appendChild(advBtn);
}

function renderMatchPreview(match) {
  const state = getState();
  const playerTeamId = state.player.teamId;
  const opId = match.homeTeamId === playerTeamId ? match.awayTeamId : match.homeTeamId;
  const opponent = getTeamById(opId);
  const myTeam = getPlayerTeam();
  const myStarters = getStarters(myTeam);
  const opStarters = getStarters(opponent);
  const myRank = calcTeamRank(myStarters);
  const opRank = calcTeamRank(opStarters);
  const isHome = match.homeTeamId === playerTeamId;

  return `
    <div class="match-preview">
      <div style="font-size:12px;color:var(--text-muted)">今週の試合 ${isHome?"(ホーム)":"(アウェイ)"}</div>
      <div class="match-teams">
        <div>
          <div class="match-team-name">${myTeam.name}</div>
          <div class="match-rank">${rankBadge(myRank)}</div>
        </div>
        <div class="match-vs">VS</div>
        <div>
          <div class="match-team-name">${opponent?.name || "?"}</div>
          <div class="match-rank">${rankBadge(opRank)}</div>
        </div>
      </div>
      <button class="btn btn-primary btn-lg" id="btn-start-match" data-matchid="${match.id}">試合開始！</button>
    </div>`;
}

// --- 練習実行 ---
async function doPractice(menuId) {
  const state = getState();
  const practiceLimit = getPracticeLimit(state.player.facilities);
  if ((state.practiceUsed || 0) >= practiceLimit && menuId !== "rest") return;

  const menu = PRACTICE_MENUS.find(m => m.id === menuId);
  const results = applyPractice(menuId);

  // 結果モーダル
  let body = menu.isRest ? "<p>全選手の体力が回復しました！</p>" : "";
  if (!menu.isRest && results) {
    const leveled = results.filter(r => r.changes.some(c => c.delta > 0));
    body += `<p>練習完了！ ${results.length}人が練習しました。</p>`;
    if (leveled.length > 0) {
      body += "<p style='color:var(--success)'>ステータスアップ！</p><ul>";
      for (const r of leveled) {
        for (const c of r.changes.filter(ch => ch.delta > 0)) {
          body += `<li>${r.name}: ${c.stat} +1</li>`;
        }
      }
      body += "</ul>";
    }
  }

  await showModal("練習結果", body, [{ label: "OK", value: "ok", cls: "btn-primary" }]);
  renderCurrentTab();
}

// --- 週進行 ---
async function doAdvanceWeek() {
  const state = getState();
  if (state.flags.insolvent) return;

  const events = advanceWeek();
  let message = "";
  for (const ev of events) {
    if (ev.type === "salary_paid") {
      message += `<p>年俸 ¥${fmt(ev.amount)} を支払いました。</p><p>残高: ${fmtMoney(ev.balance)}</p>`;
    }
    if (ev.type === "insolvent") {
      message += `<p style="color:var(--danger)">資金不足！選手解雇か施設売却が必要です。</p>`;
    }
    if (ev.type === "players_joined") {
      message += `<p style="color:var(--success)">スカウト選手が加入しました！</p><ul>`;
      for (const p of ev.players) message += `<li>${p.name} (${p.position})</li>`;
      message += "</ul>";
    }
    if (ev.type === "new_season") {
      message += `<p style="color:var(--accent2)">🎉 Season ${ev.season} が始まりました！</p>`;
    }
  }

  if (message) {
    await showModal("週進行", message, [{ label: "OK", value: "ok", cls: "btn-primary" }]);
  }

  renderCurrentTab();
}

// --- 試合イベント設定 ---
export function setupMatchButton() {
  document.addEventListener("click", async (e) => {
    if (e.target.id === "btn-start-match" || e.target.closest("#btn-start-match")) {
      const btn = e.target.closest("[data-matchid]") || e.target;
      const matchId = btn.dataset.matchid;
      const state = getState();
      const match = state.schedule.find(s => s.id === matchId);
      if (!match) return;

      await runMatch(match);
      renderCurrentTab();
    }
  });
}

async function runMatch(match) {
  // ローディング表示
  const container = document.getElementById("screen-container");
  container.innerHTML = `<div class="match-preview" style="text-align:center;padding:40px">
    <div style="font-size:48px">🏐</div>
    <div style="margin-top:16px">試合シミュレーション中...</div>
  </div>`;

  // 非同期で少し待ってからシミュレーション（UX向上）
  await new Promise(r => setTimeout(r, 500));

  const result = playMatch(match);
  if (!result) return;

  // 試合結果表示
  const cls = result.isWin ? "win-text" : "loss-text";
  const outcome = result.isWin ? "勝利！" : "敗北";
  const setSc = result.setScores.map(s => `<span class="set-score-item">${s.a}-${s.b}</span>`).join("");

  container.innerHTML = `
    <div class="match-result-card">
      <div style="font-size:13px;color:var(--text-muted)">試合結果 vs ${result.opponentName}</div>
      <div class="match-result-outcome ${cls}">${outcome}</div>
      <div class="set-scores">${setSc}</div>
      <div>セット: ${result.setsA} - ${result.setsB}</div>
      <div class="reward-text">獲得: ¥${fmt(result.reward)}</div>
    </div>
    <div class="section-title">ラリーログ（直近50件）</div>
    <div class="match-log" id="match-log"></div>
    <button class="btn btn-primary btn-block mt-8" id="btn-after-match">続ける</button>`;

  const logEl = document.getElementById("match-log");
  const state = getState();
  const logs = state.lastMatchLog.slice(-50);
  for (const entry of logs) {
    const div = document.createElement("div");
    div.className = "log-entry";
    if (entry.point === "home") div.className += " log-point-home";
    else if (entry.point === "away") div.className += " log-point-away";
    div.textContent = entry.text;
    logEl.appendChild(div);
  }
  logEl.scrollTop = logEl.scrollHeight;

  await new Promise(r => {
    document.getElementById("btn-after-match").addEventListener("click", r, { once: true });
  });
}

// ===== チーム管理タブ =====
function renderTeamTab(c) {
  c.innerHTML = `
    <div class="subtabs">
      <button class="subtab-btn active" data-sub="roster">ロスター</button>
      <button class="subtab-btn" data-sub="starter">スタメン</button>
      <button class="subtab-btn" data-sub="scout">スカウト</button>
      <button class="subtab-btn" data-sub="items">アイテム</button>
    </div>
    <div id="team-subcontent"></div>`;

  c.querySelectorAll(".subtab-btn").forEach(b => {
    b.addEventListener("click", () => {
      c.querySelectorAll(".subtab-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderTeamSub(document.getElementById("team-subcontent"), b.dataset.sub);
    });
  });

  renderTeamSub(document.getElementById("team-subcontent"), "roster");
}

function renderTeamSub(el, sub) {
  const team = getPlayerTeam();
  el.innerHTML = "";

  switch (sub) {
    case "roster":   renderRoster(el, team); break;
    case "starter":  renderStarters(el, team); break;
    case "scout":    renderScout(el); break;
    case "items":    renderItems(el); break;
  }
}

function renderRoster(el, team) {
  const state = getState();
  if (team.roster.length === 0) {
    el.innerHTML = '<div class="empty-msg">選手がいません</div>';
    return;
  }
  for (const p of team.roster) {
    const div = document.createElement("div");
    div.className = "player-card";
    const keys = ["spike","receive","serve","block","toss","power","technique","speed"];
    const labels = ["Sp","Re","Sv","Bl","To","Pw","Te","Sp"];
    const statsHtml = keys.map((k,i) => `
      <div class="player-stat-item">
        <div class="player-stat-label">${labels[i]}</div>
        <div class="player-stat-val">${p.stats[k]}</div>
      </div>`).join("");
    const stamPct = p.stats.maxStamina > 0 ? Math.round(p.stats.currentStamina / p.stats.maxStamina * 100) : 0;

    div.innerHTML = `
      <div class="player-card-top">
        <span class="player-pos">${p.position}</span>
        ${rankBadge(p.rank)}
        <span class="player-name">${p.name}</span>
        <span class="player-height">${p.height}cm</span>
        <span class="player-salary text-warn">¥${fmt(p.salary)}</span>
      </div>
      <div class="player-stats-grid">${statsHtml}</div>
      ${staminaBar(p.stats.currentStamina, p.stats.maxStamina)}
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">体力: ${p.stats.currentStamina.toFixed(1)}/${p.stats.maxStamina.toFixed(1)} (${stamPct}%)</div>
      <div style="margin-top:8px">
        <button class="btn btn-danger btn-sm" data-fire="${p.id}">解雇</button>
      </div>`;

    div.querySelector("[data-fire]").addEventListener("click", async () => {
      const res = await showModal(
        "選手解雇確認",
        `<p>${p.name} を解雇しますか？</p><p style="color:var(--text-muted);font-size:12px">年俸 ¥${fmt(p.salary)} 分の負担がなくなります。</p>`,
        [{ label: "解雇する", value: "fire", cls: "btn-danger" }, { label: "キャンセル", value: "cancel", cls: "btn-secondary" }]
      );
      if (res === "fire") {
        firePlayer(p.id);
        renderCurrentTab();
      }
    });

    el.appendChild(div);
  }
}

function renderStarters(el, team) {
  const SLOTS = [
    { key:"OP",  label:"OP オポジット" },
    { key:"OH1", label:"OH アウトサイド1" },
    { key:"OH2", label:"OH アウトサイド2" },
    { key:"MB1", label:"MB ミドルブロッカー1" },
    { key:"MB2", label:"MB ミドルブロッカー2" },
    { key:"Se",  label:"Se セッター" },
    { key:"Li",  label:"Li リベロ" },
  ];

  el.innerHTML = "<p style='font-size:12px;color:var(--text-muted);margin-bottom:8px'>スロットをタップして選手を割り当て</p>";
  const grid = document.createElement("div");
  grid.className = "starter-grid";

  for (const slot of SLOTS) {
    const pid = team.starters[slot.key];
    const player = pid ? team.roster.find(p => p.id === pid) : null;

    const div = document.createElement("div");
    div.className = "starter-slot" + (player ? "" : " empty");
    div.innerHTML = `
      <div class="starter-slot-pos">${slot.label}</div>
      <div class="starter-slot-name">${player ? player.name : "未設定"}</div>
      <div class="starter-slot-stats">${player ? `${player.stats.spike}/${player.stats.receive}/${player.stats.serve} | ${player.height}cm` : ""}</div>`;

    div.addEventListener("click", () => showStarterPicker(slot.key, team, el));
    grid.appendChild(div);
  }
  el.appendChild(grid);
}

async function showStarterPicker(slotKey, team, parentEl) {
  const state = getState();
  const content = document.createElement("div");
  content.innerHTML = `<h3 style="margin-bottom:12px">${slotKey} を選択</h3>`;

  // ポジションフィルタ（緩め）
  const posMap = { OP:["OP","OH"], OH1:["OH","OP"], OH2:["OH","OP"], MB1:["MB"], MB2:["MB"], Se:["Se"], Li:["Li"] };
  const allowed = posMap[slotKey] || [];
  const candidates = team.roster.filter(p => allowed.includes(p.position));

  if (candidates.length === 0) {
    content.innerHTML += `<p class="text-muted">適切な選手がいません</p>`;
  } else {
    for (const p of candidates) {
      const btn = document.createElement("button");
      btn.className = "btn btn-secondary btn-block mb-8";
      btn.style.textAlign = "left";
      const stamPct = p.stats.maxStamina > 0 ? Math.round(p.stats.currentStamina / p.stats.maxStamina * 100) : 0;
      btn.innerHTML = `<strong>${p.name}</strong> ${rankBadge(p.rank)} <span class="text-muted">${p.height}cm</span><br>
        <span class="text-muted" style="font-size:11px">Sp:${p.stats.spike} Re:${p.stats.receive} Sv:${p.stats.serve} Bl:${p.stats.block} To:${p.stats.toss} | 体力:${stamPct}%</span>`;
      btn.addEventListener("click", () => {
        setStarter(slotKey, p.id);
        closeModal();
        renderCurrentTab();
      });
      content.appendChild(btn);
    }
  }

  // 「外す」ボタン
  const removeBtn = document.createElement("button");
  removeBtn.className = "btn btn-secondary btn-block mt-8";
  removeBtn.textContent = "スタメンから外す";
  removeBtn.addEventListener("click", () => {
    setStarter(slotKey, null);
    closeModal();
    renderCurrentTab();
  });
  content.appendChild(removeBtn);

  showModalEl(content);
}

function renderScout(el) {
  const state = getState();
  const feeRates = { S:0.50, A:0.45, B:0.35, C:0.30, D:0.25, E:0.20, F:0.15, G:0.10 };

  if (!state.scoutPool || state.scoutPool.length === 0) {
    el.innerHTML = '<div class="empty-msg">スカウト候補はいません</div>';
    return;
  }

  el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">来シーズン4月に加入。月初に候補が入れ替わります。</p>';

  for (const p of state.scoutPool) {
    const isContracted = !!p.contracted || state.pendingSignings.some(s => s.id === p.id);
    const fee = Math.floor(p.salary * (feeRates[p.rank] || 0.10));
    const div = document.createElement("div");
    div.className = "scout-card";
    div.innerHTML = `
      <div class="player-card-top">
        <span class="player-pos">${p.position}</span>
        ${rankBadge(p.rank)}
        <span class="player-name">${p.name}</span>
        <span class="player-height">${p.height}cm</span>
        ${isContracted ? '<span class="scout-status-badge scout-contracted">来季加入</span>' : ''}
      </div>
      <div class="player-stats-grid">
        ${["spike","receive","serve","block","toss"].map(k => `<div class="player-stat-item"><div class="player-stat-label">${k.slice(0,2)}</div><div class="player-stat-val">${p.stats[k]}</div></div>`).join("")}
      </div>
      <div class="flex-between mt-8">
        <span class="text-warn">年俸: ¥${fmt(p.salary)}</span>
        <span>契約費: ¥${fmt(fee)}</span>
        ${!isContracted ? `<button class="btn btn-primary btn-sm" data-scout="${p.id}">契約</button>` : '<span class="text-muted">契約済</span>'}
      </div>`;

    if (!isContracted) {
      div.querySelector("[data-scout]").addEventListener("click", async () => {
        const { ok, reason, fee: f } = doSignScout(p.id);
        if (!ok) {
          await showModal("契約失敗", `<p>${reason}</p>`, [{ label: "OK", value: "ok", cls: "btn-secondary" }]);
        } else {
          await showModal("契約成功！", `<p>${p.name} と契約しました。</p><p>契約費: ¥${fmt(f)}</p><p>来シーズン4月に加入します。</p>`,
            [{ label: "OK", value: "ok", cls: "btn-primary" }]);
          renderCurrentTab();
        }
      });
    }
    el.appendChild(div);
  }
}

function doSignScout(scoutId) {
  return signScout(scoutId);
}

function renderItems(el) {
  const state = getState();
  const inv = state.player.inventory;
  const team = getPlayerTeam();

  el.innerHTML = `<div class="section-title">所持アイテム</div>`;

  if (inv.length === 0) {
    el.innerHTML += '<div class="empty-msg">アイテムを持っていません<br>ショップで購入できます</div>';
  } else {
    for (const entry of inv) {
      const item = ITEMS[entry.itemId];
      if (!item) continue;
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="flex-between">
          <span>${item.icon} ${item.name} × ${entry.quantity}</span>
          <span class="text-muted">${item.effect}</span>
          <button class="btn btn-sm btn-primary" data-use="${entry.itemId}">使用</button>
        </div>`;
      div.querySelector("[data-use]").addEventListener("click", () => showItemUsePicker(entry.itemId, team.roster, el));
      el.appendChild(div);
    }
  }
}

function showItemUsePicker(itemId, roster, parentEl) {
  const content = document.createElement("div");
  content.innerHTML = `<h3 style="margin-bottom:12px">使用する選手を選択</h3>`;
  for (const p of roster) {
    const btn = document.createElement("button");
    btn.className = "btn btn-secondary btn-block mb-8";
    btn.style.textAlign = "left";
    const stamPct = p.stats.maxStamina > 0 ? Math.round(p.stats.currentStamina / p.stats.maxStamina * 100) : 0;
    btn.innerHTML = `<strong>${p.name}</strong> <span class="text-muted">体力: ${stamPct}%</span>`;
    btn.addEventListener("click", () => {
      useItem(itemId, p.id);
      closeModal();
      renderCurrentTab();
    });
    content.appendChild(btn);
  }
  showModalEl(content);
}

// ===== ショップタブ =====
function renderShopTab(c) {
  const state = getState();
  c.innerHTML = `
    <div class="subtabs">
      <button class="subtab-btn active" data-sub="facilities">施設</button>
      <button class="subtab-btn" data-sub="items">アイテム</button>
    </div>
    <div id="shop-subcontent"></div>`;

  c.querySelectorAll(".subtab-btn").forEach(b => {
    b.addEventListener("click", () => {
      c.querySelectorAll(".subtab-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderShopSub(document.getElementById("shop-subcontent"), b.dataset.sub);
    });
  });

  renderShopSub(document.getElementById("shop-subcontent"), "facilities");
}

function renderShopSub(el, sub) {
  el.innerHTML = "";
  if (sub === "facilities") renderFacilities(el);
  else renderItemShop(el);
}

function renderFacilities(el) {
  const state = getState();
  const owned = state.player.facilities;

  for (const [id, fac] of Object.entries(FACILITIES)) {
    const isOwned = owned.includes(id);
    const div = document.createElement("div");
    div.className = "facility-card" + (isOwned ? " facility-owned" : "");
    div.innerHTML = `
      <div class="facility-icon">${fac.icon}</div>
      <div class="facility-info">
        <div class="facility-name">${fac.name} ${isOwned ? "✓" : ""}</div>
        <div class="facility-effect">${fac.effect}</div>
        <div class="facility-price">${isOwned ? `売却: ¥${fmt(fac.sellPrice)}` : `購入: ¥${fmt(fac.cost)}`}</div>
      </div>
      <button class="btn ${isOwned ? "btn-secondary" : "btn-primary"} btn-sm" data-facid="${id}" data-action="${isOwned ? "sell" : "buy"}">
        ${isOwned ? "売却" : "購入"}
      </button>`;

    div.querySelector("[data-facid]").addEventListener("click", async (e) => {
      const action = e.target.dataset.action;
      if (action === "buy") {
        const res = await showModal(
          "施設購入",
          `<p>${fac.name} を購入しますか？</p><p>費用: ¥${fmt(fac.cost)}</p>`,
          [{ label: "購入", value: "buy", cls: "btn-primary" }, { label: "キャンセル", value: "cancel", cls: "btn-secondary" }]
        );
        if (res === "buy") {
          const result = buyFacility(id);
          if (!result.ok) {
            await showModal("購入失敗", `<p>${result.reason}</p>`, [{ label: "OK", value: "ok", cls: "btn-secondary" }]);
          }
          renderCurrentTab();
        }
      } else {
        const res = await showModal(
          "施設売却",
          `<p>${fac.name} を売却しますか？</p><p>売却額: ¥${fmt(fac.sellPrice)}</p>`,
          [{ label: "売却", value: "sell", cls: "btn-warn" }, { label: "キャンセル", value: "cancel", cls: "btn-secondary" }]
        );
        if (res === "sell") {
          const result = sellFacility(id);
          if (!result.ok) {
            await showModal("売却失敗", `<p>${result.reason}</p>`, [{ label: "OK", value: "ok", cls: "btn-secondary" }]);
          } else {
            renderHeader();
          }
          renderCurrentTab();
        }
      }
    });
    el.appendChild(div);
  }
}

function renderItemShop(el) {
  const state = getState();
  for (const [id, item] of Object.entries(ITEMS)) {
    const inInv = state.player.inventory.find(i => i.itemId === id);
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="card-header">
        <span class="card-title">${item.icon} ${item.name}</span>
        <span class="text-muted">${inInv ? `所持: ${inInv.quantity}個` : "未所持"}</span>
      </div>
      <div class="info-row">
        <span class="text-muted">${item.effect}</span>
        <span class="money-pos">¥${fmt(item.cost)}</span>
        <button class="btn btn-primary btn-sm" data-buy="${id}">購入</button>
      </div>`;

    div.querySelector("[data-buy]").addEventListener("click", async () => {
      const result = buyItem(id, 1);
      if (!result.ok) {
        await showModal("購入失敗", `<p>${result.reason}</p>`, [{ label: "OK", value: "ok", cls: "btn-secondary" }]);
      } else {
        renderHeader();
        renderCurrentTab();
      }
    });
    el.appendChild(div);
  }
}

// ===== リーグ情報タブ =====
function renderLeagueTab(c) {
  c.innerHTML = `
    <div class="subtabs">
      <button class="subtab-btn active" data-sub="standings">順位表</button>
      <button class="subtab-btn" data-sub="schedule">試合日程</button>
    </div>
    <div id="league-subcontent"></div>`;

  c.querySelectorAll(".subtab-btn").forEach(b => {
    b.addEventListener("click", () => {
      c.querySelectorAll(".subtab-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderLeagueSub(document.getElementById("league-subcontent"), b.dataset.sub);
    });
  });

  renderLeagueSub(document.getElementById("league-subcontent"), "standings");
}

function renderLeagueSub(el, sub) {
  el.innerHTML = "";
  if (sub === "standings") renderStandings(el);
  else renderSchedule(el);
}

function renderStandings(el) {
  const state = getState();
  const sorted = getSortedStandings();

  el.innerHTML = `
    <table class="standings-table">
      <thead>
        <tr><th>#</th><th>チーム</th><th>勝</th><th>敗</th><th>セット率</th></tr>
      </thead>
      <tbody id="standings-tbody"></tbody>
    </table>`;

  const tbody = el.querySelector("#standings-tbody");
  sorted.forEach((s, i) => {
    const team = getTeamById(s.teamId);
    const total = s.setsWon + s.setsLost;
    const ratio = total > 0 ? (s.setsWon / total).toFixed(3) : "0.000";
    const isPlayer = s.teamId === state.player.teamId;
    const tr = document.createElement("tr");
    if (isPlayer) tr.className = "player-row";
    tr.innerHTML = `<td>${i + 1}</td><td>${team?.shortName || s.teamId} ${isPlayer ? "★" : ""}</td><td>${s.wins}</td><td>${s.losses}</td><td>${ratio}</td>`;
    tbody.appendChild(tr);
  });
}

function renderSchedule(el) {
  const state = getState();
  const playerTeamId = state.player.teamId;
  const playerMatches = state.schedule.filter(
    s => s.homeTeamId === playerTeamId || s.awayTeamId === playerTeamId
  ).slice(0, 40); // 直近40試合まで表示

  el.innerHTML = '<div class="section-title">自チームの試合日程</div>';

  let currentLeg = 0;
  for (const m of playerMatches) {
    if (m.leg !== currentLeg) {
      currentLeg = m.leg;
      el.innerHTML += `<div class="section-title">${typeof m.leg === "number" ? `第${m.leg}節` : "決勝T"}</div>`;
    }

    const opId = m.homeTeamId === playerTeamId ? m.awayTeamId : m.homeTeamId;
    const op = getTeamById(opId);
    const { month, week } = absToMonthWeek(m.absoluteWeek);
    const isHome = m.homeTeamId === playerTeamId;

    let resultHtml = '<span class="text-muted">未定</span>';
    if (m.result) {
      const isWin = m.result.winnerId === playerTeamId;
      resultHtml = `<span class="${isWin ? "result-win" : "result-loss"}">${isWin ? "勝" : "敗"}</span>`;
      if (m.result.setScores) {
        const sc = m.result.setScores.map(s => isHome ? `${s.a}-${s.b}` : `${s.b}-${s.a}`).join(", ");
        resultHtml += ` <span class="text-muted">(${sc})</span>`;
      }
    }

    const div = document.createElement("div");
    div.className = "schedule-match";
    div.innerHTML = `
      <span class="schedule-week">${month}月第${week}週</span>
      <span class="schedule-teams">${isHome ? "●" : "○"} vs ${op?.name || opId}</span>
      <span class="schedule-result">${resultHtml}</span>`;
    el.appendChild(div);
  }
}

// ===== その他タブ =====
function renderOtherTab(c) {
  const state = getState();
  c.innerHTML = `
    <div class="section-title">設定・その他</div>
    <div class="card">
      <div class="info-row"><span>シーズン</span><span>${state.time.season}</span></div>
      <div class="info-row"><span>現在の週</span><span>${state.time.month}月 第${state.time.week}週</span></div>
      <div class="info-row"><span>所持金</span>${fmtMoney(state.player.money)}</div>
      <div class="info-row"><span>所有施設</span><span>${state.player.facilities.length}件</span></div>
    </div>
    <div class="section-title">セーブ・リセット</div>
    <div class="card">
      <button class="btn btn-secondary btn-block mb-8" id="btn-manual-save">💾 手動セーブ</button>
      <button class="btn btn-danger btn-block" id="btn-reset">🔄 ゲームリセット</button>
    </div>
    <div class="section-title">コード入力</div>
    <div class="card">
      <div class="form-group">
        <input type="text" id="input-code" class="form-input" placeholder="コードを入力">
      </div>
      <button class="btn btn-primary btn-block mt-8" id="btn-redeem-code">コードを使用</button>
    </div>`;

  c.querySelector("#btn-manual-save").addEventListener("click", async () => {
    saveGame();
    await showModal("セーブ完了", "<p>ゲームを保存しました。</p>", [{ label: "OK", value: "ok", cls: "btn-primary" }]);
  });

  c.querySelector("#btn-reset").addEventListener("click", async () => {
    const res = await showModal(
      "ゲームリセット",
      "<p>本当にリセットしますか？<br>全データが消えます。</p>",
      [{ label: "リセット", value: "reset", cls: "btn-danger" }, { label: "キャンセル", value: "cancel", cls: "btn-secondary" }]
    );
    if (res === "reset") {
      clearSave();
      location.reload();
    }
  });

  c.querySelector("#btn-redeem-code").addEventListener("click", async () => {
    const code = document.getElementById("input-code").value.trim().toUpperCase();
    const result = redeemCode(code);
    if (result.ok) {
      await showModal("コード成功！", `<p>${result.message}</p>`, [{ label: "OK", value: "ok", cls: "btn-primary" }]);
      renderHeader();
      renderCurrentTab();
    } else {
      await showModal("コードエラー", `<p>${result.reason}</p>`, [{ label: "OK", value: "ok", cls: "btn-secondary" }]);
    }
  });
}

function redeemCode(code) {
  const state = getState();
  if (!state.usedCodes) state.usedCodes = [];
  if (state.usedCodes.includes(code)) return { ok: false, reason: "このコードは使用済みです" };

  const CODES = {
    "START2025":  { type: "money", amount: 500000 },
    "VOLLEYBALL": { type: "money", amount: 1000000 },
  };

  const reward = CODES[code];
  if (!reward) return { ok: false, reason: "無効なコードです" };

  state.usedCodes.push(code);
  if (reward.type === "money") {
    state.player.money += reward.amount;
    saveGame();
    return { ok: true, message: `¥${fmt(reward.amount)} を獲得しました！` };
  }

  return { ok: false, reason: "不明なコードタイプ" };
}

// ===== モーダル =====
export function showModal(title, bodyHtml, buttons) {
  return new Promise(resolve => {
    _modalResolve = resolve;
    const overlay = document.getElementById("modal-overlay");
    const content = document.getElementById("modal-content");
    const actions = document.getElementById("modal-actions");

    content.innerHTML = `<h3 style="margin-bottom:12px">${title}</h3>${bodyHtml}`;
    actions.innerHTML = "";

    for (const btn of buttons) {
      const b = document.createElement("button");
      b.className = `btn ${btn.cls}`;
      b.textContent = btn.label;
      b.addEventListener("click", () => {
        overlay.classList.add("hidden");
        _modalResolve = null;
        resolve(btn.value);
      }, { once: true });
      actions.appendChild(b);
    }

    overlay.classList.remove("hidden");
  });
}

export function showModalEl(contentEl) {
  const overlay = document.getElementById("modal-overlay");
  const content = document.getElementById("modal-content");
  const actions = document.getElementById("modal-actions");
  content.innerHTML = "";
  content.appendChild(contentEl);
  actions.innerHTML = '<button class="btn btn-secondary" id="modal-close-btn">閉じる</button>';
  document.getElementById("modal-close-btn").addEventListener("click", () => {
    overlay.classList.add("hidden");
  }, { once: true });
  overlay.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

// オーバーレイ外クリックで閉じる
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-overlay")) {
    closeModal();
    if (_modalResolve) { _modalResolve(null); _modalResolve = null; }
  }
});

// ===== 公開API =====
export { renderCurrentTab };
