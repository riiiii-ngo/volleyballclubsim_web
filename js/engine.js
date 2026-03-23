// ===== engine.js =====
// ゲームエンジン: 週進行・練習・試合シミュレーション・スカウト・財務

import {
  calcRank, PRACTICE_MENUS, FACILITIES, ITEMS,
  generateScoutPool, monthWeekToAbs, absToMonthWeek, generateSchedule
} from './data.js';
import {
  getState, setState, saveGame,
  getPlayerTeam, getTeamById, getStarters, getPlayerById
} from './state.js';

// ===== 乱数 =====
function rand() { return Math.random(); }
function randInt(min, max) { return Math.floor(min + rand() * (max - min + 1)); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ===== 施設ボーナス計算 =====
export function getFacilityMultiplier(facilities, stat) {
  let mult = 1.0;
  if (facilities.includes("serveMachine") && (stat === "receive" || stat === "technique")) mult *= 1.5;
  if (facilities.includes("blockBoard")   && (stat === "spike"   || stat === "technique")) mult *= 1.5;
  if (facilities.includes("trainingEq")   && (stat === "power"   || stat === "maxStamina")) mult *= 1.5;
  return mult;
}

export function getMinigameMultiplier(facilities) {
  return facilities.includes("videoSys") ? 2.0 : 1.0;
}

export function getPracticeLimit(facilities) {
  return facilities.includes("gym2") ? 2 : 1;
}

// ===== 次レベルアップに必要なXP =====
export function xpForNextLevel(level) {
  return Math.floor(50 + level * 3 + level * level * 0.5);
}

// ===== 練習適用 =====
export function applyPractice(menuId) {
  const state = getState();
  const team = getPlayerTeam();
  const facilities = state.player.facilities;
  const menu = PRACTICE_MENUS.find(m => m.id === menuId);
  if (!menu) return;

  const results = [];

  for (const player of team.roster) {
    if (menu.isRest) {
      // 休憩: 体力全回復
      player.stats.currentStamina = player.stats.maxStamina;
      results.push({ name: player.name, changes: [{ stat: "体力", delta: 0, recovered: true }] });
      continue;
    }

    const changes = [];
    const isMinigame = menuId === "minigame";
    const mgMult = isMinigame ? getMinigameMultiplier(facilities) : 1.0;

    for (const stat of menu.stats) {
      const mult = isMinigame ? mgMult : getFacilityMultiplier(facilities, stat);
      const baseXp = randInt(menu.xpMin, menu.xpMax);
      const xp = Math.floor(baseXp * mult);

      player.xp[stat] = (player.xp[stat] || 0) + xp;
      let leveled = false;
      while (player.xp[stat] >= xpForNextLevel(player.stats[stat])) {
        player.xp[stat] -= xpForNextLevel(player.stats[stat]);
        player.stats[stat] = Math.min(100, player.stats[stat] + 1);
        leveled = true;
      }
      if (leveled) {
        changes.push({ stat, delta: 1, xp });
      } else {
        changes.push({ stat, delta: 0, xp });
      }
    }

    // ランク再計算
    player.rank = calcRank(player.stats, player.height);
    results.push({ name: player.name, changes });
  }

  state.practiceUsed = (state.practiceUsed || 0) + 1;
  saveGame();
  return results;
}

// ===== アイテム使用 =====
export function useItem(itemId, playerId) {
  const state = getState();
  const inv = state.player.inventory;
  const idx = inv.findIndex(i => i.itemId === itemId);
  if (idx < 0) return false;

  const item = ITEMS[itemId];
  if (!item) return false;

  const player = getPlayerById(playerId);
  if (!player) return false;

  const recover = Math.floor(player.stats.maxStamina * item.recoverRate);
  player.stats.currentStamina = Math.min(player.stats.maxStamina, player.stats.currentStamina + recover);

  inv[idx].quantity--;
  if (inv[idx].quantity <= 0) inv.splice(idx, 1);

  saveGame();
  return true;
}

// ===== 試合シミュレーション =====

function effectiveStat(baseStat, currentStamina, maxStamina) {
  const ratio = maxStamina > 0 ? currentStamina / maxStamina : 0.5;
  return baseStat * (0.5 + 0.5 * ratio);
}

function getTeamAvgStat(players, stat) {
  if (!players || players.length === 0) return 30;
  return players.reduce((s, p) => s + (p.stats[stat] || 30), 0) / players.length;
}

// attacker=攻撃側(サーブ権保持), defender=守備側
// 戻り値: "attacker_point" | "defender_point" | "continue"
function simulateRally(attacker, defender, log) {
  // ① サーブ
  const server = attacker.players[randInt(0, attacker.players.length - 1)];
  const serveEff = effectiveStat(server.stats.serve || 30, server.stats.currentStamina, server.stats.maxStamina);
  const recvAvg = getTeamAvgStat(defender.players, "receive");
  const receiverStam = defender.players.reduce((s,p) => s + p.stats.currentStamina, 0) / Math.max(1, defender.players.length);
  const recvEff = effectiveStat(recvAvg, receiverStam, defender.players[0]?.stats.maxStamina || 80);

  // サーブミス（5%固定）
  if (rand() < 0.05) {
    log.push({ text: `${server.name} サーブミス`, point: "defender" });
    return "defender_point";
  }
  // サービスエース
  const aceChance = clamp((serveEff - recvEff) / 200 + 0.06, 0.02, 0.20);
  if (rand() < aceChance) {
    log.push({ text: `${server.name} サービスエース！`, point: "attacker" });
    return "attacker_point";
  }

  // ② レシーブ（守備側がサーブレシーブ）
  const passQualityRoll = rand();
  const recvThresh = recvEff / 100;
  let passQuality;
  if (passQualityRoll > recvThresh * 0.9) {
    log.push({ text: "レシーブミス", point: "attacker" });
    return "attacker_point";
  } else if (passQualityRoll < recvThresh * 0.4) {
    passQuality = "A";
  } else if (passQualityRoll < recvThresh * 0.7) {
    passQuality = "B";
  } else {
    passQuality = "C";
  }

  // ③ トス（守備側のセッター）
  const setter = defender.setter;
  const tossEff = effectiveStat(setter.stats.toss || 30, setter.stats.currentStamina, setter.stats.maxStamina);

  // トスミス
  const tossMissChance = clamp((80 - tossEff) / 200, 0.01, 0.12);
  if (rand() < tossMissChance) {
    log.push({ text: `${setter.name} トスミス`, point: "attacker" });
    return "attacker_point";
  }

  // ブロック枚数（守備側セッターのトス力で相手ブロックをかわせるか）
  let blockerCount;
  if (tossEff >= 70) {
    blockerCount = rand() < 0.5 ? 0 : (rand() < 0.5 ? 1 : 2);
  } else if (tossEff >= 50) {
    blockerCount = rand() < 0.3 ? 0 : (rand() < 0.5 ? 1 : 2);
  } else {
    blockerCount = rand() < 0.4 ? 0 : (rand() < 0.6 ? 1 : 2);
  }

  // パス補正
  const passBonus = passQuality === "A" ? 10 : passQuality === "B" ? 0 : -10;

  // ④ スパイク（守備側が攻撃）
  const spiker = defender.players[randInt(0, defender.players.length - 1)];
  const spikeEff = effectiveStat(spiker.stats.spike || 30, spiker.stats.currentStamina, spiker.stats.maxStamina);
  const adjustedSpike = spikeEff + passBonus;

  // スパイクミス
  const spikeMissChance = clamp((60 - adjustedSpike) / 200 + 0.04, 0.03, 0.18);
  if (rand() < spikeMissChance) {
    log.push({ text: `${spiker.name} スパイクミス`, point: "attacker" });
    return "attacker_point";
  }

  // ⑤ ブロック（攻撃側がブロック）
  if (blockerCount > 0) {
    const blockAvg = getTeamAvgStat(attacker.players, "block");
    const blockEff = effectiveStat(blockAvg, attacker.players[0]?.stats.currentStamina || 60, attacker.players[0]?.stats.maxStamina || 80);
    const totalBlock = blockEff * blockerCount * 0.6;
    const blockChance = clamp(totalBlock / (totalBlock + adjustedSpike) * 0.4, 0.03, 0.30);

    if (rand() < blockChance) {
      log.push({ text: `ブロック成功！(${blockerCount}枚)`, point: "attacker" });
      return "attacker_point";
    }
    // ワンタッチ → レシーブしやすくなる
    const oneTouchChance = blockChance * 0.5;
    if (rand() < oneTouchChance) {
      log.push({ text: "ワンタッチ" });
      const defRecvEff = getTeamAvgStat(attacker.players, "receive") * 1.2;
      if (rand() > defRecvEff / 120) {
        log.push({ text: "ラリーレシーブミス", point: "defender" });
        return "defender_point";
      }
      return "continue"; // 攻守交代
    }
  }

  // ⑥ ラリーレシーブ（攻撃側が守備）
  const defRecvAvg = getTeamAvgStat(attacker.players, "receive");
  const defStam = attacker.players.reduce((s,p) => s + p.stats.currentStamina, 0) / Math.max(1, attacker.players.length);
  const defRecvEff = effectiveStat(defRecvAvg, defStam, attacker.players[0]?.stats.maxStamina || 80);

  if (rand() > defRecvEff / 100 * 0.8) {
    log.push({ text: `${spiker.name} スパイク決まる！`, point: "defender" });
    return "defender_point";
  }

  log.push({ text: "ラリー継続" });
  return "continue"; // 攻守交代
}

function simulateSet(teamA, teamB, isLastSet) {
  const targetScore = isLastSet ? 15 : 25;
  let scoreA = 0, scoreB = 0;
  const log = [];
  // attacker=現在のサーブ権保持チーム
  let attacker = teamA;
  let defender = teamB;
  let totalRallies = 0;

  while (true) {
    totalRallies++;
    if (totalRallies > 800) break; // 安全弁

    // スタミナ消耗
    for (const p of [...teamA.players, ...teamB.players]) {
      p.stats.currentStamina = Math.max(p.stats.maxStamina * 0.2, p.stats.currentStamina - 0.5);
    }

    // 1ラリー（最大20往復の攻防）
    let result;
    let curAttacker = attacker;
    let curDefender = defender;
    for (let i = 0; i < 20; i++) {
      result = simulateRally(curAttacker, curDefender, log);
      if (result !== "continue") break;
      // 攻守交代
      [curAttacker, curDefender] = [curDefender, curAttacker];
    }
    if (!result || result === "continue") {
      result = rand() < 0.5 ? "attacker_point" : "defender_point";
    }

    if (result === "attacker_point") {
      // サーブ権保持チームが得点
      if (attacker === teamA) scoreA++;
      else scoreB++;
      // サーブ権は変わらない
    } else {
      // 守備側が得点 → 守備側がサーブ権取得
      if (defender === teamA) scoreA++;
      else scoreB++;
      // 攻守交代
      [attacker, defender] = [defender, attacker];
    }

    // 終了判定（2点差必要）
    if (scoreA >= targetScore || scoreB >= targetScore) {
      if (Math.abs(scoreA - scoreB) >= 2) break;
    }
  }

  return { scoreA, scoreB, log };
}

export function simulateMatch(teamAData, teamBData, playerTeamId, facilities) {
  // teamAData/teamBData: { id, name, players: [player...], setter }
  const medRoom = facilities && facilities.includes("medRoom");

  let setsA = 0, setsB = 0;
  const setScores = [];
  const allLog = [];
  const maxSets = 3;

  while (setsA < 2 && setsB < 2) {
    const isLastSet = (setsA + setsB) === 4;
    const setResult = simulateSet(teamAData, teamBData, isLastSet);
    setScores.push({ a: setResult.scoreA, b: setResult.scoreB });
    allLog.push(...setResult.log);

    if (setResult.scoreA > setResult.scoreB) setsA++;
    else setsB++;
  }

  const winnerId = setsA > setsB ? teamAData.id : teamBData.id;
  const isPlayerWin = (playerTeamId === teamAData.id && setsA > setsB) ||
                      (playerTeamId === teamBData.id && setsB > setsA);
  const reward = isPlayerWin ? 1300000 : 800000;

  // 医務室効果: 消耗軽減
  if (medRoom) {
    for (const p of [...teamAData.players, ...teamBData.players]) {
      const loss = p.stats.maxStamina - p.stats.currentStamina;
      p.stats.currentStamina = Math.min(p.stats.maxStamina, p.stats.currentStamina + Math.floor(loss * 0.3));
    }
  }

  return { winnerId, setsA, setsB, setScores, log: allLog, reward };
}

// ===== チームの試合用データ取得（スタメンが空ならロスター先頭7人使用） =====
function getTeamMatchData(team) {
  let players = getStarters(team);
  if (players.length === 0) players = team.roster.slice(0, 7);
  if (players.length === 0) players = [{ position:"OH", name:"選手", height:175, stats:{ spike:30,receive:30,serve:30,block:30,toss:30,power:30,technique:30,speed:30,maxStamina:80,currentStamina:80 }, xp:{} }];
  const setter = players.find(p => p.position === "Se") || players[0];
  return { id: team.id, name: team.name, players, setter };
}

// ===== CPUチームのスタメン取得 =====
function getCpuTeamData(team) {
  return getTeamMatchData(team);
}

// ===== スタンディング更新 =====
function updateStandings(state, winnerId, loserId, setScores, reversedSides, homeId) {
  // setScores: [{a, b}...]  a=homeTeam
  const winStand = state.standings.find(s => s.teamId === winnerId);
  const loseStand = state.standings.find(s => s.teamId === loserId);
  if (winStand) winStand.wins++;
  if (loseStand) loseStand.losses++;

  // セット数加算
  const isHomeWin = winnerId === homeId;
  for (const sc of setScores) {
    if (winStand) { winStand.setsWon += isHomeWin ? sc.a : sc.b; winStand.setsLost += isHomeWin ? sc.b : sc.a; }
    if (loseStand) { loseStand.setsWon += isHomeWin ? sc.b : sc.a; loseStand.setsLost += isHomeWin ? sc.a : sc.b; }
  }
}

// ===== 週進行 =====
export function advanceWeek(onEvent) {
  const state = getState();
  const { time, player, teams, schedule, standings } = state;
  const playerTeam = getPlayerTeam();

  const events = [];

  // ① CPU同士の試合処理
  const cpuMatches = schedule.filter(
    s => s.absoluteWeek === time.absoluteWeek &&
         s.homeTeamId !== player.teamId &&
         s.awayTeamId !== player.teamId &&
         s.result === null
  );
  for (const match of cpuMatches) {
    const homeTeam = getTeamById(match.homeTeamId);
    const awayTeam = getTeamById(match.awayTeamId);
    if (!homeTeam || !awayTeam) continue;
    const homeData = getCpuTeamData(homeTeam);
    const awayData = getCpuTeamData(awayTeam);
    const result = simulateMatch(homeData, awayData, null, []);
    match.result = result;
    const loserId = result.winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    updateStandings(state, result.winnerId, loserId, result.setScores, false, match.homeTeamId);
  }

  // ② 時間を進める
  let { season, month, week, absoluteWeek } = time;
  week++;
  if (week > 4) {
    week = 1;
    month++;
    if (month > 12) month = 1;
  }
  absoluteWeek++;
  // シーズン切替: 4月第1週に来たらシーズンを上げる（初回を除く）
  if (month === 4 && week === 1 && absoluteWeek > 1) {
    season++;
  }

  time.season = season;
  time.month = month;
  time.week = week;
  time.absoluteWeek = absoluteWeek;

  // ③ 練習回数リセット
  state.practiceUsed = 0;

  // ④ 月初処理（月の第1週）
  if (week === 1) {
    // スカウト候補リフレッシュ（契約済みは残す）
    const contracted = state.pendingSignings.map(p => p.id);
    const newPool = generateScoutPool(month, season);
    // 契約済みは引き続き表示
    const contractedInPool = state.scoutPool.filter(p => contracted.includes(p.id));
    state.scoutPool = [...contractedInPool, ...newPool].slice(0, 3 + contractedInPool.length);
    events.push({ type: "scout_refresh" });
  }

  // ⑤ シーズン開始（4月第1週）
  if (month === 4 && week === 1 && season > 1) {
    // スカウト選手をロースターに加入
    for (const newPlayer of state.pendingSignings) {
      newPlayer.rank = calcRank(newPlayer.stats, newPlayer.height);
      playerTeam.roster.push(newPlayer);
    }
    if (state.pendingSignings.length > 0) {
      events.push({ type: "players_joined", players: state.pendingSignings });
    }
    state.pendingSignings = [];

    // 新シーズンのスケジュール生成
    const teamIds = teams.map(t => t.id);
    const newSchedule = generateSchedule(teamIds);
    // absoluteWeekをシーズンにオフセット
    const seasonOffset = (season - 1) * 48;
    for (const s of newSchedule) s.absoluteWeek += seasonOffset;
    state.schedule.push(...newSchedule);

    // スタンディングリセット
    state.standings = teams.map(t => ({ teamId: t.id, wins: 0, losses: 0, setsWon: 0, setsLost: 0 }));
    state.scoutPool = generateScoutPool(4, season);
    events.push({ type: "new_season", season });
  }

  // ⑥ シーズン終了（3月第4週）
  if (month === 3 && week === 4) {
    const totalSalary = playerTeam.roster.reduce((s, p) => s + p.salary, 0);
    player.money -= totalSalary;
    events.push({ type: "salary_paid", amount: totalSalary, balance: player.money });
    if (player.money < 0) {
      state.flags.insolvent = true;
      events.push({ type: "insolvent" });
    }
  }

  saveGame();

  if (onEvent) {
    for (const ev of events) onEvent(ev);
  }

  return events;
}

// ===== プレイヤー試合実行 =====
export function playMatch(matchSlot) {
  const state = getState();
  const playerTeamId = state.player.teamId;
  const playerTeam = getPlayerTeam();
  const opponentId = matchSlot.homeTeamId === playerTeamId ? matchSlot.awayTeamId : matchSlot.homeTeamId;
  const opponent = getTeamById(opponentId);
  if (!opponent) return null;

  const playerData = getTeamMatchData(playerTeam);
  const opponentData = getCpuTeamData(opponent);

  // ホーム/アウェイで順序を決定
  let teamA, teamB;
  if (matchSlot.homeTeamId === playerTeamId) {
    teamA = playerData; teamB = opponentData;
  } else {
    teamA = opponentData; teamB = playerData;
  }

  const result = simulateMatch(teamA, teamB, playerTeamId, state.player.facilities);
  matchSlot.result = result;

  // 報酬
  state.player.money += result.reward;

  // スタンディング更新
  const winnerId = result.winnerId;
  const loserId = winnerId === matchSlot.homeTeamId ? matchSlot.awayTeamId : matchSlot.homeTeamId;
  updateStandings(state, winnerId, loserId, result.setScores, false, matchSlot.homeTeamId);

  state.lastMatchLog = result.log;
  state.lastMatchResult = {
    isWin: result.winnerId === playerTeamId,
    setsA: result.setsA,
    setsB: result.setsB,
    setScores: result.setScores,
    reward: result.reward,
    opponentName: opponent.name,
  };

  saveGame();
  return state.lastMatchResult;
}

// ===== スカウト契約 =====
const SCOUT_FEE_RATES = { S:0.50, A:0.45, B:0.35, C:0.30, D:0.25, E:0.20, F:0.15, G:0.10 };

export function signScout(scoutId) {
  const state = getState();
  const candidate = state.scoutPool.find(p => p.id === scoutId);
  if (!candidate) return { ok: false, reason: "候補が見つかりません" };

  const rank = candidate.rank;
  const feeRate = SCOUT_FEE_RATES[rank] || 0.10;
  const fee = Math.floor(candidate.salary * feeRate);

  if (state.player.money < fee) {
    return { ok: false, reason: `資金不足（必要: ¥${fee.toLocaleString()}）` };
  }

  state.player.money -= fee;
  state.pendingSignings.push({ ...candidate });
  candidate.contracted = true;

  saveGame();
  return { ok: true, fee };
}

// ===== 施設購入 =====
export function buyFacility(facilityId) {
  const state = getState();
  const fac = FACILITIES[facilityId];
  if (!fac) return { ok: false, reason: "施設が見つかりません" };
  if (state.player.facilities.includes(facilityId)) return { ok: false, reason: "すでに所有しています" };
  if (state.player.money < fac.cost) return { ok: false, reason: `資金不足（必要: ¥${fac.cost.toLocaleString()}）` };

  state.player.money -= fac.cost;
  state.player.facilities.push(facilityId);
  saveGame();
  return { ok: true };
}

// ===== 施設売却 =====
export function sellFacility(facilityId) {
  const state = getState();
  const fac = FACILITIES[facilityId];
  if (!fac) return { ok: false, reason: "施設が見つかりません" };
  if (!state.player.facilities.includes(facilityId)) return { ok: false, reason: "所有していません" };

  state.player.money += fac.sellPrice;
  state.player.facilities = state.player.facilities.filter(f => f !== facilityId);
  saveGame();
  return { ok: true, gained: fac.sellPrice };
}

// ===== アイテム購入 =====
export function buyItem(itemId, qty = 1) {
  const state = getState();
  const item = ITEMS[itemId];
  if (!item) return { ok: false, reason: "アイテムが見つかりません" };
  const totalCost = item.cost * qty;
  if (state.player.money < totalCost) return { ok: false, reason: "資金不足" };

  state.player.money -= totalCost;
  const inv = state.player.inventory;
  const existing = inv.find(i => i.itemId === itemId);
  if (existing) existing.quantity += qty;
  else inv.push({ itemId, quantity: qty });

  saveGame();
  return { ok: true };
}

// ===== 選手解雇 =====
export function firePlayer(playerId) {
  const state = getState();
  const team = getPlayerTeam();
  const idx = team.roster.findIndex(p => p.id === playerId);
  if (idx < 0) return { ok: false, reason: "選手が見つかりません" };

  // スタメンから外す
  for (const slot of Object.keys(team.starters)) {
    if (team.starters[slot] === playerId) team.starters[slot] = null;
  }
  team.roster.splice(idx, 1);

  if (team.roster.reduce((s,p) => s + p.salary, 0) <= 0 || state.player.money >= 0) {
    state.flags.insolvent = false;
  }

  saveGame();
  return { ok: true };
}

// ===== スタメン設定 =====
export function setStarter(slot, playerId) {
  const team = getPlayerTeam();
  // 既に別スロットに設定されていたら外す
  for (const s of Object.keys(team.starters)) {
    if (team.starters[s] === playerId) team.starters[s] = null;
  }
  team.starters[slot] = playerId;
  saveGame();
}

// ===== 順位表ソート =====
export function getSortedStandings() {
  const state = getState();
  if (!state) return [];
  return [...state.standings].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const ratioA = (a.setsLost + a.setsWon) > 0 ? a.setsWon / (a.setsWon + a.setsLost) : 0;
    const ratioB = (b.setsLost + b.setsWon) > 0 ? b.setsWon / (b.setsWon + b.setsLost) : 0;
    return ratioB - ratioA;
  });
}
