// ===== data.js =====
// 初期データ定義・生成関数

export const VERSION = "1.0.0";

// --- 名前リスト ---
const SURNAMES = ["田中","鈴木","佐藤","山田","伊藤","渡辺","中村","小林","加藤","吉田",
                  "山本","松本","井上","木村","林","斎藤","清水","山口","阿部","池田",
                  "橋本","石川","前田","岡田","長谷川","藤田","後藤","近藤","村上","坂本",
                  "青木","藤井","西村","福田","太田","三浦","岩田","中島","高田","上田"];
const GIVEN_NAMES = ["健太","翔","大輔","拓海","颯","悠","蒼","陸","蓮","湊",
                     "朔","碧","陽","奏","律","樹","誠","光","航","剛",
                     "誉","武","淳","徹","修","勇","克","明","豊","強",
                     "智","仁","慶","亮","祐","進","浩","敦","啓","俊"];

// --- チーム定義 ---
export const TEAM_DEFS = [
  { id:"t0", name:"青山バレー部",   short:"青山",   rankProfile:"DE", isPlayer:true },
  { id:"t1", name:"北条スポーツ",   short:"北条",   rankProfile:"BC", isPlayer:false },
  { id:"t2", name:"東京エクセル",   short:"東京",   rankProfile:"AB", isPlayer:false },
  { id:"t3", name:"大阪ブレイズ",   short:"大阪",   rankProfile:"BC", isPlayer:false },
  { id:"t4", name:"福岡サンダース", short:"福岡",   rankProfile:"CD", isPlayer:false },
  { id:"t5", name:"横浜マリナーズ", short:"横浜",   rankProfile:"BC", isPlayer:false },
  { id:"t6", name:"名古屋ファイア", short:"名古屋", rankProfile:"CD", isPlayer:false },
  { id:"t7", name:"仙台ウェーブ",   short:"仙台",   rankProfile:"DE", isPlayer:false },
  { id:"t8", name:"京都サムライ",   short:"京都",   rankProfile:"BC", isPlayer:false },
  { id:"t9", name:"札幌ストーム",   short:"札幌",   rankProfile:"CD", isPlayer:false },
];

// --- 施設定義 ---
export const FACILITIES = {
  gym2:       { id:"gym2",       name:"第二体育館",      icon:"🏟️", cost:8000000, sellPrice:4000000, effect:"週2回練習可能" },
  serveMachine:{ id:"serveMachine",name:"サーブマシン",    icon:"🎯", cost:3000000, sellPrice:1500000, effect:"レシーブ・テクニック経験値×1.5" },
  blockBoard: { id:"blockBoard", name:"ブロック板",        icon:"🧱", cost:4000000, sellPrice:2000000, effect:"スパイク・テクニック経験値×1.5" },
  trainingEq: { id:"trainingEq", name:"トレーニング器具",  icon:"🏋️", cost:5000000, sellPrice:2500000, effect:"パワー・最大体力経験値×1.5" },
  videoSys:   { id:"videoSys",   name:"映像分析システム",  icon:"📹", cost:7000000, sellPrice:3500000, effect:"ミニゲーム全経験値×2.0" },
  medRoom:    { id:"medRoom",    name:"医務室",            icon:"🏥", cost:6000000, sellPrice:3000000, effect:"試合後スタミナ消耗30%軽減" },
};

// --- アイテム定義 ---
export const ITEMS = {
  sportsDrink: { id:"sportsDrink", name:"スポーツドリンク", icon:"🥤", cost:500,  effect:"体力30%回復", recoverRate:0.30 },
  energyDrink: { id:"energyDrink", name:"エナジードリンク",  icon:"⚡", cost:1500, effect:"体力70%回復", recoverRate:0.70 },
};

// --- 練習メニュー ---
export const PRACTICE_MENUS = [
  { id:"spike",   name:"スパイク練習", icon:"💥", stats:["spike","power"],          xpMin:10, xpMax:25 },
  { id:"receive", name:"レシーブ練習", icon:"🛡️", stats:["receive","technique"],    xpMin:10, xpMax:25 },
  { id:"block",   name:"ブロック練習", icon:"🧱", stats:["block","technique"],       xpMin:10, xpMax:25 },
  { id:"serve",   name:"サーブ練習",   icon:"🏐", stats:["serve"],                   xpMin:10, xpMax:25 },
  { id:"weight",  name:"ウエイト",     icon:"🏋️", stats:["power","maxStamina"],      xpMin:10, xpMax:25 },
  { id:"minigame",name:"ミニゲーム",   icon:"🎮", stats:["spike","receive","serve","block","toss","power","technique","speed"], xpMin:3, xpMax:8 },
  { id:"rest",    name:"休憩",         icon:"😴", stats:[],                           xpMin:0,  xpMax:0, isRest:true },
];

// --- ランク閾値 ---
export const RANK_THRESHOLDS = [
  { rank:"S", min:100 }, { rank:"A", min:90 }, { rank:"B", min:75 },
  { rank:"C", min:60 },  { rank:"D", min:45 }, { rank:"E", min:30 },
  { rank:"F", min:20 },  { rank:"G", min:0 },
];

// --- ランクプロファイル → ステータス範囲 ---
const RANK_RANGES = {
  A: { primary:[85,100], secondary:[70,90] },
  B: { primary:[70,90],  secondary:[55,75] },
  C: { primary:[55,75],  secondary:[40,60] },
  D: { primary:[40,60],  secondary:[25,45] },
  E: { primary:[25,45],  secondary:[15,30] },
};

// --- 年俸テーブル（月額） ---
const SALARY_BY_RANK = { S:900000, A:700000, B:500000, C:350000, D:250000, E:180000, F:120000, G:80000 };
const CONTRACT_FEE_RATE = { S:0.50, A:0.45, B:0.35, C:0.30, D:0.25, E:0.20, F:0.15, G:0.10 };

// --- ポジション別ステータス重み ---
const POS_WEIGHTS = {
  OP: { primary:["spike","power"],        secondary:["serve","block","technique","speed","maxStamina"], low:["receive","toss"] },
  OH: { primary:["spike","receive"],      secondary:["serve","speed","technique","power"],              low:["block","toss","maxStamina"] },
  MB: { primary:["block","spike"],        secondary:["power","technique","speed","maxStamina"],         low:["receive","toss","serve"] },
  Se: { primary:["toss","technique"],     secondary:["receive","speed","maxStamina"],                   low:["spike","block","serve","power"] },
  Li: { primary:["receive","speed"],      secondary:["technique","maxStamina"],                         low:["spike","block","toss","serve","power"] },
};

const POS_HEIGHT = {
  OP: [182,198], OH: [178,195], MB: [186,202], Se: [173,188], Li: [165,182],
};

// --- 試合IDカウンター ---
let _matchIdCounter = 0;

// --- シード乱数 ---
function seededRand(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// --- ランク計算 ---
export function calcRank(stats, height) {
  const heightScore = Math.min(100, Math.max(0, (height - 160) / 0.45));
  const { spike, receive, serve, block, toss, power, technique, speed, maxStamina } = stats;
  const avg = (spike + receive + serve + block + toss + power + technique + speed + maxStamina + heightScore) / 10;
  for (const { rank, min } of RANK_THRESHOLDS) {
    if (avg >= min) return rank;
  }
  return "G";
}

export function calcTeamRank(starters) {
  if (!starters || starters.length === 0) return "G";
  const keys = ["spike","receive","serve","block","toss"];
  let sum = 0, count = 0;
  for (const p of starters) {
    for (const k of keys) sum += p.stats[k];
    count += keys.length;
  }
  const avg = sum / count;
  for (const { rank, min } of RANK_THRESHOLDS) {
    if (avg >= min) return rank;
  }
  return "G";
}

export function getContractFeeRate(rank) {
  return CONTRACT_FEE_RATE[rank] || 0.10;
}

export function getSalaryByRank(rank) {
  return SALARY_BY_RANK[rank] || 80000;
}

// --- 選手生成 ---
let _playerIdCounter = 0;
function nextPlayerId() {
  return "p" + (++_playerIdCounter);
}

function pickName(seed, teamIdx, playerIdx) {
  const r = seededRand(seed + teamIdx * 100 + playerIdx);
  const si = Math.floor(r() * SURNAMES.length);
  const gi = Math.floor(r() * GIVEN_NAMES.length);
  return SURNAMES[si] + " " + GIVEN_NAMES[gi];
}

function rangeVal(r, min, max) {
  return Math.floor(min + r() * (max - min + 1));
}

export function generatePlayer(position, rankProfile, seed, teamIdx, playerIdx) {
  const r = seededRand(seed + teamIdx * 1000 + playerIdx * 37);
  const weights = POS_WEIGHTS[position];

  // ランクプロファイル（例 "BC"）→ A/Bランクのステータス範囲をランダムに選択
  const rankChar = rankProfile[Math.floor(r() * rankProfile.length)];
  const ranges = RANK_RANGES[rankChar] || RANK_RANGES["D"];

  const stats = {};
  const allStats = ["spike","receive","serve","block","toss","power","technique","speed","maxStamina"];

  for (const s of allStats) {
    if (weights.primary.includes(s)) {
      stats[s] = rangeVal(r, ranges.primary[0], ranges.primary[1]);
    } else if (weights.low.includes(s)) {
      stats[s] = rangeVal(r, ranges.secondary[0] - 20, ranges.secondary[1] - 15);
    } else {
      stats[s] = rangeVal(r, ranges.secondary[0], ranges.secondary[1]);
    }
    stats[s] = Math.max(5, Math.min(100, stats[s]));
  }
  stats.currentStamina = stats.maxStamina;

  const hRange = POS_HEIGHT[position];
  const height = Math.floor(hRange[0] + r() * (hRange[1] - hRange[0] + 1));

  const rank = calcRank(stats, height);
  const salary = getSalaryByRank(rank);
  const name = pickName(seed, teamIdx, playerIdx);

  const xp = {};
  for (const s of allStats) xp[s] = 0;

  return {
    id: nextPlayerId(),
    name,
    position,
    height,
    salary,
    stats,
    xp,
    rank,
  };
}

// --- チーム生成 ---
const POSITIONS_PER_TEAM = ["OP","OH","OH","MB","MB","Se","Li","OH","MB"]; // 9人

export function generateTeam(def, seed) {
  const players = [];
  for (let i = 0; i < POSITIONS_PER_TEAM.length; i++) {
    players.push(generatePlayer(POSITIONS_PER_TEAM[i], def.rankProfile, seed, TEAM_DEFS.indexOf(def), i));
  }
  // スタメン設定（先頭7人）
  const starters = {
    OP:  players[0].id,
    OH1: players[1].id,
    OH2: players[2].id,
    MB1: players[3].id,
    MB2: players[4].id,
    Se:  players[5].id,
    Li:  players[6].id,
  };
  return {
    id: def.id,
    name: def.name,
    shortName: def.short,
    isPlayer: def.isPlayer,
    roster: players,
    starters,
  };
}

// --- 試合スケジュール生成（トリプルラウンドロビン） ---
// absoluteWeek: month 4 W1 = 1, month 4 W2 = 2 ... month 3 W4 = 48
export function monthWeekToAbs(month, week) {
  // month 4-12=0-8レグ, 1-3=9-11レグ
  const offset = month >= 4 ? month - 4 : month + 8;
  return offset * 4 + week;
}

export function absToMonthWeek(abs) {
  const idx = abs - 1;
  const monthOffset = Math.floor(idx / 4);
  const week = (idx % 4) + 1;
  const month = monthOffset < 9 ? monthOffset + 4 : monthOffset - 8;
  return { month, week };
}

export function formatMonthWeek(month, week) {
  return `${month}月第${week}週`;
}

// 第1節の試合週（absoluteWeek）
const LEG1_WEEKS = [5,6,7,8,9,10,11,12,13];   // May W1 - Jul W1
const LEG2_WEEKS = [17,18,19,20,21,22,23,24,25]; // Jul W4 - Sep W4
const LEG3_WEEKS = [27,28,29,30,31,32,33,34,35]; // Oct W3 - Dec W3
const PLAYOFF_WEEKS = [43,44,45]; // Feb W1/W2/W3

export function generateSchedule(teamIds) {
  // ラウンドテーブルアルゴリズム（10チーム → 9ラウンド）
  const n = teamIds.length; // 10
  const rounds = [];
  const teams = [...teamIds];

  for (let r = 0; r < n - 1; r++) {
    const matchesInRound = [];
    for (let i = 0; i < n / 2; i++) {
      matchesInRound.push({ home: teams[i], away: teams[n - 1 - i] });
    }
    rounds.push(matchesInRound);
    // 固定チーム(index0)以外を1つずつ回転
    const last = teams[n - 1];
    for (let i = n - 1; i > 1; i--) teams[i] = teams[i - 1];
    teams[1] = last;
  }

  const allMatches = [];

  // 3レグ分
  const legWeeks = [LEG1_WEEKS, LEG2_WEEKS, LEG3_WEEKS];
  for (let leg = 0; leg < 3; leg++) {
    const weeks = legWeeks[leg];
    for (let r = 0; r < rounds.length; r++) {
      const absWeek = weeks[r];
      for (const m of rounds[r]) {
        // 奇数レグはhome/away通常、偶数レグで反転、3レグ目は再び通常
        const home = leg === 1 ? m.away : m.home;
        const away = leg === 1 ? m.home : m.away;
        allMatches.push({
          id: "s" + (++_matchIdCounter),
          leg: leg + 1,
          absoluteWeek: absWeek,
          homeTeamId: home,
          awayTeamId: away,
          result: null,
        });
      }
    }
  }

  return allMatches;
}

// --- スタンディング初期化 ---
export function initStandings(teamIds) {
  return teamIds.map(id => ({
    teamId: id,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
  }));
}

// --- スカウト候補生成 ---
let _scoutIdCounter = 0;
export function generateScoutPool(month, season) {
  // 月とシーズンで固定的に生成（毎月同じ候補）
  const seed = season * 1000 + month * 100;
  const r = seededRand(seed);
  const profiles = ["CD","CD","BC","DE","BC","CD"]; // 候補分布
  const positions = ["OP","OH","MB","Se","Li","OH","MB","OP"];
  const pool = [];
  for (let i = 0; i < 3; i++) {
    const profile = profiles[Math.floor(r() * profiles.length)];
    const pos = positions[Math.floor(r() * positions.length)];
    const p = generatePlayer(pos, profile, seed + i * 7, 99, i);
    p.id = "sc" + (++_scoutIdCounter);
    pool.push(p);
  }
  return pool;
}

// --- 初期ゲーム状態生成 ---
export function generateInitialState(teamName) {
  _playerIdCounter = 0;
  _scoutIdCounter = 0;
  _matchIdCounter = 0;

  const seed = Date.now() % 100000;
  const teams = TEAM_DEFS.map(def => generateTeam(def, seed));
  if (teamName) teams[0].name = teamName;

  const teamIds = teams.map(t => t.id);
  const schedule = generateSchedule(teamIds);
  const standings = initStandings(teamIds);
  const scoutPool = generateScoutPool(4, 1); // 4月（シーズン1）

  return {
    meta: { version: VERSION, savedAt: new Date().toISOString() },
    time: { season: 1, month: 4, week: 1, absoluteWeek: 1 },
    player: {
      teamId: "t0",
      money: 100000,
      facilities: [],
      inventory: [],
    },
    flags: { insolvent: false },
    teams,
    schedule,
    standings,
    scoutPool,
    pendingSignings: [],
    practiceUsed: 0,
    lastMatchLog: [],
    lastMatchResult: null,
    playoffBracket: null,
  };
}
