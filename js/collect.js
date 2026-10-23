// Things to collect once the levels are done: the monster book, titles, chairs and the jump challenges.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Monster book ----------
// Every monster except summoned ones and the trial shadows has a card. Cards go straight into the book
// (never the bag); five of a kind light up its page, and every few pages lit raise all four stats.
const CARD_NEED = 5, CARD_CHANCE = 0.03, BOSS_CARD_CHANCE = 0.3, PAGES_PER_STAT = 4;
const CARD_TYPES = Object.keys(TYPES).filter(t => !TYPES[t].nocard);
for (const t of CARD_TYPES) {
  const id = `card_${t}`;
  ITEMS[id] = { id, name: `${TYPES[t].name}卡片`, cat: "etc", card: t, icon: "card", color: TYPES[t].boss ? "#ffd84a" : "#cfe3ff",
                price: 0, sell: 0, stack: 1, desc: `收進怪物圖鑑，集滿 ${CARD_NEED} 張就點亮${TYPES[t].name}這一頁` };
}
const litPages = () => CARD_TYPES.filter(t => (P.cards[t] || 0) >= CARD_NEED).length;
const bookStat = () => Math.floor(litPages() / PAGES_PER_STAT);
function gainCard(t) {
  const n = P.cards[t] || 0, name = TYPES[t].name;
  if (n >= CARD_NEED) { msg(`${name}卡片已經集滿了`, "#9fb0cd"); return; }
  P.cards[t] = n + 1;
  msg(`撿到${name}卡片（${n + 1} / ${CARD_NEED}）`, "#cfe3ff");
  if (n + 1 === CARD_NEED) {
    const before = Math.floor((litPages() - 1) / PAGES_PER_STAT);
    msg(`怪物圖鑑點亮了：${name}！`, "#ffc94a");
    if (bookStat() > before) msg(`圖鑑點亮 ${litPages()} 頁，全能力值 +${bookStat()}`, "#ffc94a");
    fx.push({ k: "buff", t: 0 }); sfx("quest");
  }
}

// ---------- Titles ----------
// Earned once and kept; wear one at a time. It shows on your name tag, and some add a little to your stats.
const jobTier = () => P.job === "beginner" ? 0 : jobLine().length;
const bossDown = t => (P.bossKills[t] || 0) > 0;
const ALL4 = n => ({ str: n, dex: n, int: n, luk: n });
const TITLES = {
  first:    { name: "初出茅廬", desc: "第一次轉職", check: () => jobTier() >= 1 },
  second:   { name: "嶄露頭角", desc: "完成二轉", check: () => jobTier() >= 2 },
  third:    { name: "名震四方", desc: "完成三轉", check: () => jobTier() >= 3, bonus: ALL4(1) },
  fourth:   { name: "傳說之巔", desc: "完成四轉", check: () => jobTier() >= 4, bonus: ALL4(2) },
  veteran:  { name: "百戰老兵", desc: "等級達到 Lv.50", check: () => P.lv >= 50, bonus: { hp: 100 } },
  golem:    { name: "巨像粉碎者", desc: "打倒苔岩巨像", check: () => bossDown("boss") },
  crab:     { name: "蟹王剋星", desc: "打倒巨鉗蟹王", check: () => bossDown("crab") },
  treant:   { name: "古樹守護者", desc: "打倒霧林古樹精", check: () => bossDown("treant") },
  eagle:    { name: "雷雲征服者", desc: "打倒雷雲巨鷲", check: () => bossDown("eagle"), bonus: { acc: 5 } },
  scorp:    { name: "沙暴終結者", desc: "打倒沙暴蠍皇", check: () => bossDown("scorpking"), bonus: { avoid: 5 } },
  colossus: { name: "熔心征服者", desc: "打倒熔心巨像", check: () => bossDown("colossus"), bonus: { watk: 3, matk: 3 } },
  book5:    { name: "圖鑑新手", desc: "怪物圖鑑點亮 5 頁", check: () => litPages() >= 5 },
  book15:   { name: "圖鑑學者", desc: "怪物圖鑑點亮 15 頁", check: () => litPages() >= 15, bonus: ALL4(1) },
  bookAll:  { name: "圖鑑大師", desc: "怪物圖鑑全部點亮", check: () => litPages() >= CARD_TYPES.length, bonus: ALL4(3) },
  jumper:   { name: "跳跳達人", desc: "完成兩個跳跳挑戰", check: () => Object.keys(JUMPS).every(id => P.jumps[id]) },
  petPal:   { name: "寵物好朋友", desc: "寵物的親密度到 Lv.3", check: () => Object.values(P.pets).some(p => petLv(p.close) >= 3) },
};
for (const [id, T] of Object.entries(TITLES)) T.id = id;
const titleBonus = k => TITLES[P.title]?.bonus?.[k] || 0;
// what the book and the worn title add, on top of equipment
const extraBonus = k => (STAT_NAMES[k] ? bookStat() : 0) + titleBonus(k);
let titleT = 0;
function checkTitles(dt) {
  if ((titleT -= dt) > 0) return;
  titleT = 1;
  for (const T of Object.values(TITLES)) {
    if (P.titles.includes(T.id) || !T.check()) continue;
    P.titles.push(T.id);
    msg(`獲得稱號「${T.name}」！按 ${keyOf("collection")} 可以戴上`, "#ffc94a");
    fx.push({ k: "lvup", t: 0, text: "NEW TITLE!" });
    sfx("quest");
  }
}
function wearTitle(id) {
  P.title = P.title === id ? null : id;
  msg(P.title ? `戴上了稱號「${TITLES[id].name}」` : "拿下了稱號", "#cfe3ff");
  save();
}

// ---------- Chairs ----------
// Double-click a chair in the bag (other tab) to sit; any move, jump or attack stands you up.
// While sitting, every regeneration tick heals three times as much plus the chair's own amount.
const CHAIRS = {
  chair_stool:  { name: "木頭小板凳", look: "stool", color: "#c9955a", regen: { hp: 30, mp: 15 }, desc: "坐下時 HP、MP 回復變快" },
  chair_cloud:  { name: "棉雲沙發", look: "cloud", color: "#ffffff", regen: { hp: 80, mp: 40 }, desc: "軟綿綿的雲，坐下時 HP、MP 回復快很多" },
  chair_dune:   { name: "沙丘躺椅", look: "lounge", color: "#e0a040", regen: { hp: 150, mp: 80 }, desc: "沙漠商隊的躺椅，坐下時 HP、MP 回復非常快" },
};
for (const [id, C] of Object.entries(CHAIRS)) {
  ITEMS[id] = { id, name: C.name, cat: "etc", chair: true, icon: "chair", color: C.color, price: 0, sell: 1000, stack: 1,
                desc: `${C.desc}（每次回復多 HP ${C.regen.hp}、MP ${C.regen.mp}）。在背包點兩下坐下` };
}
function sitOn(i) {
  const id = P.bag.etc[i].id;
  if (P.dead || !P.onGround || P.climb) { hint("要站在地上才能坐下"); return; }
  P.sit = P.sit === id ? null : id;
  P.vx = 0;
  if (P.sit) msg(`坐在${ITEMS[id].name}上休息`, "#cfe3ff");
}
const STAND_KEYS = ["left", "right", "up", "down", "jump", "space", "attack", "pickup", ...Array.from({ length: 7 }, (_, i) => `skill${i + 1}`)];
// true while you stay seated this frame
function sitting() {
  if (!P.sit) return false;
  if (P.dead || P.knock > 0 || !CHAIRS[P.sit] || !countItem(P.sit) || STAND_KEYS.some(a => held.has(a))) { P.sit = null; return false; }
  return true;
}

// ---------- Jump challenges ----------
// No monsters: climb the floating steps to the flag. Touching the ground past the start sends you back to it.
// The first clear gives a chair; after that, each challenge rewards you once a day.
const JUMPS = {
  jump1: { coach: "fei", first: [["chair_stool", 1]], daily: { exp: 2000, coins: 3000, items: [["red_pot", 20]] } },
  jump2: { coach: "yun", first: [["chair_cloud", 1]], daily: { exp: 30000, coins: 15000, items: [["white_pot", 20]] } },
};
function enterJump(id) {
  closeDialog();
  loadMap(id);
  msg(`來到了${MAPS[id].name}。往上跳到旗子那裡，掉到地上就要從頭開始`, "#cfe3ff");
  sfx("portal");
}
function jumpTick() {
  if (!map.jump || P.dead || P.climb || !P.onGround) return;
  if (P.ground === plats[0] && P.x > map.spawn + 70) {
    // fell: back to the start
    Object.assign(P, { x: map.spawn - P.w / 2, vx: 0, vy: 0 });
    msg("掉下去了……從頭開始", "#9fb0cd");
    sfx("fail");
  } else if (P.ground === plats[map.goal + 1]) finishJump();
}
function finishJump() {
  const id = P.map, J = JUMPS[id], first = !P.jumps[id], fresh = P.jumps[id] !== today();
  const items = [...(first ? J.first : []), ...(fresh ? J.daily.items : [])];
  if (items.some(([it, n]) => roomFor(it) < n)) { hint("背包放不下獎勵了，整理一下再來"); goToTown(); return; }
  P.jumps[id] = today();
  goToTown();
  fx.push({ k: "lvup", t: 0, text: "CLEAR!" });
  sfx("quest");
  msg(`完成了${MAPS[id].name}！`, "#ffc94a");
  items.forEach(([it, n]) => { addItem(it, n); msg(`獲得${ITEMS[it].name}${n > 1 ? ` ×${n}` : ""}`, "#ffd97a"); });
  if (fresh) { P.coins += J.daily.coins; gainExp(J.daily.exp); }
  else msg("今天的獎勵已經拿過了，明天再來挑戰吧", "#9fb0cd");
  save();
}
function coachTalk(opts) {
  const id = Object.keys(JUMPS).find(k => JUMPS[k].coach === talking.id), J = JUMPS[id];
  const state = !P.jumps[id] ? `第一次完成送你「${ITEMS[J.first[0][0]].name}」！` : P.jumps[id] === today() ? "今天的獎勵已經拿過了，不過還是可以練習喔。" : "今天還沒挑戰過，完成就有獎勵！";
  say(`${MAPS[id].name}沒有怪物，只考你的跳躍。爬到最上面的旗子就算完成，掉到地上要從頭開始。\n\n${state}`,
      [...opts, [`挑戰${MAPS[id].name}`, () => enterJump(id)], ["再見", closeDialog]]);
}
