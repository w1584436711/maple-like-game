// NPCs, the dialog box, quests, shops and the job advancement talk.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- NPCs and dialog ----------
// Everyone you can talk to. They all stand on the ground of their map; look sets how they are drawn.
// A shop NPC sells the list in SHOPS; quests name the NPC that gives them.
const NPCS = {
  vera:  { name: "轉職教官 薇拉", map: "village", x: 168, talk: veraTalk,
           look: { robe: "#2f6f78", hair: "#f4f6fb", long: true, prop: "staff" } },
  molly: { name: "道具商 莫莉", map: "village", x: 330, shop: "items", greet: "歡迎光臨！藥水、卷軸、箭矢和飛鏢，冒險用得到的這裡都有。",
           look: { robe: "#d46a8a", hair: "#9a5a32", bun: true, apron: true } },
  borin: { name: "武器商 鐵叔", map: "village", x: 490, shop: "gear", greet: "哼，想要好裝備？我這裡的武器和防具，每一件都是親手打的。",
           look: { robe: "#7a5233", hair: "#3a2a20", bald: true, beard: "#4a3020", apron: true, prop: "hammer" } },
  owen:  { name: "村長 歐文", map: "village", x: 660, greet: "歡迎來到浮島村。年輕人，村子最近有些麻煩，你願意幫忙嗎？",
           look: { robe: "#4a63a8", hair: "#dfe3ec", beard: "#eef1f6", prop: "cane" } },
  tuck:  { name: "漁夫 塔克", map: "shore", x: 200, greet: "唉，今天又沒釣到魚。都是那些刺殼龜害的！",
           look: { robe: "#3a7be0", hair: "#6b4a2a", strawHat: true, prop: "rod" } },
};
for (const [id, n] of Object.entries(NPCS)) { n.id = id; n.y = 840; }
const npcsHere = () => Object.values(NPCS).filter(n => n.map === P.map);
// the NPC you are standing next to, if any
const nearNpc = () => P.dead || P.climb || !P.onGround ? null
  : npcsHere().find(n => Math.abs(P.x + P.w / 2 - n.x) < 50 && Math.abs(P.y + P.h - n.y) < 4) || null;

const dlg = document.getElementById("dlg");
const dlgName = document.getElementById("dlgName"), dlgText = document.getElementById("dlgText"), dlgOpts = document.getElementById("dlgOpts");
let talking = NPCS.vera;
function say(text, options) {
  dlgName.textContent = talking.name;
  dlgText.textContent = text;
  dlgOpts.replaceChildren(...options.map(([label, fn], i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = `${i + 1}. ${label}`;
    b.addEventListener("click", fn);
    return b;
  }));
  dlg.hidden = false; held.clear();
  dlgOpts.firstChild?.focus({ preventScroll: true });
}
function closeDialog() { if (!dlg.hidden) { dlg.hidden = true; cv.focus({ preventScroll: true }); } }
const back = () => openNpc(talking);
function openNpc(npc) {
  talking = npc;
  // quests first, like the original's quest list at the top of a conversation
  const opts = [];
  for (const q of Object.values(QUESTS).filter(q => q.npc === npc.id)) {
    const st = questState(q);
    if (st === "ready") opts.push([`【完成】${q.name}`, () => finishQuest(q)]);
    else if (st === "active") opts.push([`【進行中】${q.name}`, () => questProgress(q)]);
    else if (st === "available") opts.push([`【任務】${q.name}`, () => offerQuest(q)]);
  }
  if (npc.shop) opts.push(["我想買賣東西", () => openShop(npc)]);
  if (npc.talk) { npc.talk(opts); return; }
  say(npc.greet, [...opts, ["再見", closeDialog]]);
}
function veraTalk() {
  if (P.job === "beginner") say("你好，冒險者。想選擇自己要走的路，就來找我吧。", [["我想轉職", jobMenu], ["怎麼操作？", controlsHelp], ["再見", closeDialog]]);
  else if (SECOND[P.job]) {
    const next = JOBS[SECOND[P.job]];
    if (P.lv >= next.req.lv) say(`你已經是很出色的${job().name}了。想更上一層樓，就成為${next.name}吧。`, [["我想二轉", secondJob], ["怎麼操作？", controlsHelp], ["再見", closeDialog]]);
    else say(`你已經是${job().name}了。繼續努力，到 Lv.${next.req.lv} 再來找我，我會告訴你下一步。`, [["怎麼操作？", controlsHelp], ["再見", closeDialog]]);
  } else say(`${job().name}，你已經走得很遠了。之後的路，要靠你自己去開拓。`, [["怎麼操作？", controlsHelp], ["再見", closeDialog]]);
}
function secondJob() {
  const id = SECOND[P.job], J = JOBS[id];
  const preview = SKILLS[id].map(s => `・${s.name}：${s.desc(1)}`).join("\n");
  say(`${J.blurb}\n\n成為${J.name}之後會學到：\n${preview}`, [[`我要成為${J.name}`, () => advance2(id)], ["再想想", back]]);
}
// the second job keeps the weapon and every first-job skill, and adds a new set of skills
function advance2(id) {
  const J = JOBS[id];
  P.job = id;
  P.sp += 1;
  P.mhp += J.gain.hp; P.mmp += J.gain.mp;
  P.hp = maxHp(); P.mp = maxMp();
  fx.push({ k: "lvup", t: 0, text: "JOB UP!" });
  msg(`你成為${J.name}了！按 K 學新技能`, "#ffc94a");
  refreshPanels(true); save();
  say(`從今天起你就是${J.name}了。\n新的技能在技能視窗（K）的下半部；技能 4、技能 5 預設是 ${keyOf("skill4")}、${keyOf("skill5")} 鍵，按 O 可以改按鍵。`, [["好", closeDialog]]);
}
function controlsHelp() {
  const k = keyOf;
  say(`← → 移動，↑ ↓ 爬繩梯，↓ 趴下。\n${k("jump")} 或 Space 跳躍，${k("attack")} 攻擊（按住連打），${k("pickup")} 撿東西。\n`
    + `${[1, 2, 3, 4, 5].map(i => k(`skill${i}`)).join("、")} 放技能，${k("hpPot")}、${k("mpPot")} 喝藥水。\n`
    + `${k("stats")} 能力值，${k("skills")} 技能，${k("inv")} 背包，${k("equip")} 裝備，${k("world")} 世界地圖，${k("quests")} 任務，${k("keys")} 鍵位設定。\n`
    + "走到傳送門按 ↑ 換地圖。靠近 NPC 按 Space 或點他，就能說話。", [["知道了", back]]);
}

// ---------- Quests ----------
// kill: monsters to defeat (counted after you accept); collect: items to hand in (taken from the bag).
// after: a quest that has to be finished first. Rewards come all at once when you report back.
const QUESTS = {
  q_jelly: { npc: "owen", name: "果凍大掃除", lv: 1, kill: { jelly: 10 },
             reward: { exp: 150, coins: 300, items: [["red_pot", 10]] },
             ask: "青草平原的青果凍越來越多，把村子的花圃都壓壞了。可以幫我打倒 10 隻嗎？",
             where: "青果凍在村子東邊的青草平原，走到傳送門按 ↑ 就到了。",
             thanks: "做得好！花圃終於保住了。這些藥水給你路上用。" },
  q_gel:   { npc: "owen", name: "冰涼的凝膠", lv: 4, after: "q_jelly", collect: { blue_gel: 15 },
             reward: { exp: 500, coins: 800, items: [["travel_cape", 1]] },
             ask: "藍果凍的凝膠冰冰涼涼，夏天拿來冰西瓜最好了。幫我收集 15 個藍果凍凝膠好嗎？",
             where: "藍果凍在青草平原比較東邊的地方，刺殼海岸的高台上也有。",
             thanks: "太好了，今年夏天有冰西瓜吃了！這件披風是我年輕時穿的，送給你。" },
  q_shell: { npc: "tuck", name: "海岸的刺殼龜", lv: 8, kill: { shell: 15 },
             reward: { exp: 1500, coins: 1500, items: [["leather_cap", 1]] },
             ask: "刺殼龜佔住了我釣魚的位置，害我好幾天沒收穫。幫我打倒 15 隻吧！",
             where: "整片刺殼海岸都是刺殼龜，小心牠們背上的刺。",
             thanks: "海岸終於清靜了！這頂帽子擋太陽很好用，拿去吧。" },
  q_shard: { npc: "tuck", name: "做魚鉤的碎片", lv: 10, after: "q_shell", collect: { shell_shard: 20 },
             reward: { exp: 2500, coins: 2000, items: [["wind_boots", 1]] },
             ask: "刺殼碎片磨一磨可以做成很利的魚鉤。再幫我收集 20 個好嗎？",
             where: "打倒刺殼龜就有機會掉刺殼碎片。",
             thanks: "這麼多碎片，夠我做一整年的魚鉤了！這雙靴子跑起來很輕，送你。" },
  q_core:  { npc: "owen", name: "遺跡的巨像", lv: 13, after: "q_gel", collect: { moss_core: 1 },
             reward: { exp: 6000, coins: 5000, items: [["town_scroll", 5]] },
             ask: "刺殼海岸再過去有一片遺跡，聽說裡面住著會動的石像。如果你能帶回它的苔岩之心，就證明你是真正的冒險者了。",
             where: "苔岩遺跡在刺殼海岸東邊高台上的傳送門後面。苔岩巨像在遺跡中間的高台上。",
             thanks: "這就是苔岩之心……你真的辦到了！浮島村以你為榮。" },
};
for (const [id, q] of Object.entries(QUESTS)) q.id = id;
// P.quests[id] is { state: "active" | "done", kills: { monster type: count } }
function questState(q) {
  const s = P.quests[q.id];
  if (s?.state === "done") return "done";
  if (s) return questGoals(q).every(g => g.have >= g.need) ? "ready" : "active";
  if (P.lv < q.lv || (q.after && P.quests[q.after]?.state !== "done")) return "locked";
  return "available";
}
const questGoals = q => [
  ...Object.entries(q.kill || {}).map(([t, n]) => ({ text: `打倒${TYPES[t].name}`, have: Math.min(n, P.quests[q.id]?.kills?.[t] || 0), need: n })),
  ...Object.entries(q.collect || {}).map(([id, n]) => ({ text: `收集${ITEMS[id].name}`, have: Math.min(n, countItem(id)), need: n })),
];
const goalText = q => questGoals(q).map(g => `${g.text} ${g.have} / ${g.need}`).join("\n");
const rewardText = q => ["經驗值 " + q.reward.exp, "金幣 " + q.reward.coins,
  ...(q.reward.items || []).map(([id, n]) => ITEMS[id].name + (n > 1 ? ` ×${n}` : ""))].join("、");
function offerQuest(q) {
  say(`${q.ask}\n\n${goalText(q)}\n獎勵：${rewardText(q)}`, [["好，交給我吧", () => acceptQuest(q)], ["下次再說", back]]);
}
function acceptQuest(q) {
  P.quests[q.id] = { state: "active", kills: {} };
  msg(`接下任務「${q.name}」，按 Q 看任務日誌`, "#ffc94a");
  refreshPanels(true); save();
  say(`謝謝你！${q.where}`, [["知道了", closeDialog]]);
}
function questProgress(q) {
  say(`${q.where}\n\n${goalText(q)}`, [["我再去努力", closeDialog]]);
}
function finishQuest(q) {
  const items = q.reward.items || [];
  if (items.some(([id, n]) => roomFor(id) < n)) { say("你的背包好像放不下我的謝禮了，整理一下再來找我吧。", [["好", closeDialog]]); return; }
  for (const [id, n] of Object.entries(q.collect || {})) removeItem(id, n);
  P.quests[q.id] = { state: "done" };
  P.coins += q.reward.coins;
  items.forEach(([id, n]) => addItem(id, n));
  msg(`完成任務「${q.name}」！`, "#ffc94a");
  fx.push({ k: "lvup", t: 0, text: "QUEST CLEAR!" });
  gainExp(q.reward.exp);
  refreshPanels(true); save();
  say(`${q.thanks}\n\n獲得：${rewardText(q)}`, [["謝謝", closeDialog]]);
}
// counts a defeated monster toward every quest that wants it
function questKill(t) {
  for (const [id, s] of Object.entries(P.quests)) {
    const need = QUESTS[id]?.kill?.[t];
    if (s.state !== "active" || !need || (s.kills[t] || 0) >= need) continue;
    s.kills[t] = (s.kills[t] || 0) + 1;
    msg(`${QUESTS[id].name}：${TYPES[t].name} ${s.kills[t]} / ${need}`, s.kills[t] >= need ? "#ffc94a" : "#cfe3ff");
  }
}
// after picking something up, shows progress on quests that collect it
function questPickup(itemId) {
  for (const [id, s] of Object.entries(P.quests)) {
    const need = QUESTS[id]?.collect?.[itemId];
    if (s.state === "active" && need && countItem(itemId) <= need) msg(`${QUESTS[id].name}：${ITEMS[itemId].name} ${countItem(itemId)} / ${need}`, countItem(itemId) >= need ? "#ffc94a" : "#cfe3ff");
  }
}
function cleanQuests(d) {
  const out = {};
  for (const [id, s] of Object.entries(d || {})) {
    if (!QUESTS[id] || !s) continue;
    out[id] = s.state === "done" ? { state: "done" } : { state: "active", kills: { ...(s.kills || {}) } };
  }
  return out;
}

// ---------- Shops ----------
// [item, how many one purchase gives]; you sell anything back for half its price
const SHOPS = {
  items: [["red_pot", 1], ["blue_pot", 1], ["town_scroll", 1], ["arrow", 100], ["iron_star", 100]],
  gear: ["wood_sword", "iron_blade", "oak_wand", "hunter_bow", "iron_claw", "plain_tee", "plain_shorts", "straw_shoes", "leaf_band",
         "work_gloves", "jelly_tunic", "canvas_pants", "leather_cap", "hunter_gloves", "travel_cape", "wind_boots", "wood_shield"].map(id => [id, 1]),
};
let shopNpc = null, shopMode = "buy", shopTab = "use", sellArm = -1;
function openShop(npc) {
  shopNpc = npc; shopMode = "buy"; sellArm = -1;
  closeDialog();
  shopWin.hidden = false;
  refreshPanels(true);
}
function buy(k, times) {
  const [id, per] = SHOPS[shopNpc.shop][k], I = ITEMS[id], n = per * times, cost = I.price * n;
  if (P.coins < cost) { hint("金幣不夠"); return; }
  if (roomFor(id) < n) { hint(`背包的${TABS[I.cat]}欄放不下了`); return; }
  P.coins -= cost; addItem(id, n);
  msg(`買了${I.name}${n > 1 ? ` ×${n}` : ""}，花了 ${cost} 金幣`, "#ffd97a");
  save();
}
const sellPrice = (I, n) => Math.floor(I.sell * n);
function sell(i, all) {
  const s = P.bag[shopTab][i];
  if (!s) return;
  const I = ITEMS[s.id], n = all ? s.n : 1, gain = sellPrice(I, n);
  takeFromSlot(shopTab, i, n);
  P.coins += gain; sellArm = -1;
  msg(`賣掉${I.name}${n > 1 ? ` ×${n}` : ""}，得到 ${gain} 金幣`, "#ffd97a");
  save();
}

const reqText = J => `Lv.${J.req.lv}、${STAT_NAMES[J.req.stat]} ${J.req.min}`;
const meets = J => P.lv >= J.req.lv && P[J.req.stat] >= J.req.min;
function jobMenu() {
  const ids = ["warrior", "magician", "bowman", "thief"];
  say("一共有四條路，每一條都要達到等級和能力值的門檻：", [
    ...ids.map(id => [`${JOBS[id].name}（${reqText(JOBS[id])}）${meets(JOBS[id]) ? "　✓ 可以轉職" : ""}`, () => jobInfo(id)]),
    ["再想想", back],
  ]);
}
function jobInfo(id) {
  const J = JOBS[id];
  if (!meets(J)) {
    const miss = [];
    if (P.lv < J.req.lv) miss.push(`等級還差 ${J.req.lv - P.lv} 級`);
    if (P[J.req.stat] < J.req.min) miss.push(`${STAT_NAMES[J.req.stat]}還差 ${J.req.min - P[J.req.stat]} 點`);
    say(`${J.blurb}\n\n要成為${J.name}，需要 ${reqText(J)}。你${miss.join("、")}。按 S 可以分配能力值。`,
      [["看看別的職業", jobMenu], ["再見", closeDialog]]);
    return;
  }
  say(`${J.blurb}\n\n確定要成為${J.name}嗎？轉職之後就不能改了。`, [[`我要成為${J.name}`, () => advance(id)], ["再想想", jobMenu]]);
}
function advance(id) {
  const J = JOBS[id];
  P.job = id;
  // 1 SP for the advancement, plus the 3 per level you would have earned past the required level
  P.sp += 1 + 3 * (P.lv - J.req.lv);
  P.mhp += J.gain.hp; P.mmp += J.gain.mp;
  // the new weapon goes straight into the hand, the old one into the bag
  giveItem(J.weapon);
  const wi = P.bag.equip.findIndex(s => s?.id === J.weapon);
  if (wi >= 0) equipFrom(wi, true);
  if (J.ammo) giveItem(...J.ammo);
  P.hp = maxHp(); P.mp = maxMp();
  fx.push({ k: "lvup", t: 0, text: "JOB UP!" });
  msg(`你成為${J.name}了！拿到 ${P.sp} 點 SP`, "#ffc94a");
  refreshPanels(true); save();
  const gift = ITEMS[J.weapon].name + (J.ammo ? `和 ${J.ammo[1]} 個${ITEMS[J.ammo[0]].name}` : "");
  say(`從今天起你就是${J.name}了，這把${gift}送給你。\n按 ${keyOf("skills")} 打開技能視窗，用 SP 學技能；學會的技能放在 ${[1, 2, 3].map(i => keyOf(`skill${i}`)).join("、")} 鍵。按 ${keyOf("inv")} 看背包，按 ${keyOf("equip")} 看身上的裝備。`, [["好", closeDialog]]);
}
