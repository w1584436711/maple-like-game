// Jobs, skills, damage formulas, items, prices and the bag helpers they need.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Character rules ----------
// Classic rules: 5 AP per level, 3 SP per level after the first job, damage from the job's main and
// secondary stats times weapon attack with a low 10% base mastery, and accuracy against monster avoid.
// Names, numbers of individual skills and weapons are our own.
const STAT_NAMES = { str: "力量", dex: "敏捷", int: "智力", luk: "幸運" };
const JOBS = {
  beginner: { name: "新手", weapon: "wood_sword", hp: [12, 16], mp: [10, 12] },
  warrior:  { name: "劍士", weapon: "iron_blade", hp: [24, 28], mp: [4, 6], req: { lv: 10, stat: "str", min: 35 }, gain: { hp: 150, mp: 0 },
              blurb: "拿劍近身作戰，血量最厚。主屬性力量，副屬性敏捷。" },
  magician: { name: "法師", weapon: "oak_wand", hp: [10, 14], mp: [22, 24], req: { lv: 8, stat: "int", min: 20 }, gain: { hp: 0, mp: 120 },
              blurb: "從遠處施放魔法，MP 很多但身體脆弱。主屬性智力，副屬性幸運。" },
  bowman:   { name: "弓手", weapon: "hunter_bow", ammo: ["arrow", 1000], hp: [20, 24], mp: [14, 16], req: { lv: 10, stat: "dex", min: 25 }, gain: { hp: 60, mp: 40 },
              blurb: "拉弓射箭，攻擊距離最長。主屬性敏捷，副屬性力量。" },
  thief:    { name: "盜賊", weapon: "iron_claw", ammo: ["iron_star", 500], hp: [20, 24], mp: [14, 16], req: { lv: 10, stat: "dex", min: 25 }, gain: { hp: 60, mp: 40 },
              blurb: "丟飛鏢、身手靈活，擅長閃躲。主屬性幸運，副屬性敏捷和力量。" },
};

// ---------- Items ----------
// Classic rules: three bag tabs with a fixed number of slots, eight equipment slots with level, job and
// stat requirements, monster drop tables, and arrows and throwing stars that get used up. Names are our own.
const BAG_SLOTS = 24;
const TABS = { equip: "裝備", use: "消耗", etc: "其他" };
const EQUIP_SLOTS = { hat: "帽子", top: "上衣", bottom: "褲子", shoes: "鞋子", gloves: "手套", cape: "披風", weapon: "武器", shield: "盾牌" };
const WTYPES = { sword: { name: "劍", jobs: ["beginner", "warrior"] }, wand: { name: "短杖", jobs: ["magician"] },
                 bow: { name: "弓", jobs: ["bowman"], twoHand: true }, claw: { name: "拳爪", jobs: ["thief"], twoHand: true } };
const GEAR_STATS = { watk: "攻擊", matk: "魔力", def: "防禦", str: "力量", dex: "敏捷", int: "智力", luk: "幸運", hp: "HP", mp: "MP", acc: "命中", avoid: "迴避" };
const ITEMS = {
  wood_sword:    { name: "木劍", slot: "weapon", wtype: "sword", watk: 17, color: "#d8b07a" },
  iron_blade:    { name: "精鐵長劍", slot: "weapon", wtype: "sword", watk: 27, req: { lv: 10, str: 35 } },
  jade_blade:    { name: "碧鱗大劍", slot: "weapon", wtype: "sword", watk: 38, color: "#8fe3bf", req: { lv: 15, str: 45 } },
  oak_wand:      { name: "橡木短杖", slot: "weapon", wtype: "wand", watk: 12, matk: 25, color: "#c9a2ff", req: { lv: 8, int: 20 } },
  vine_staff:    { name: "晶藤法杖", slot: "weapon", wtype: "wand", watk: 14, matk: 38, color: "#6fe3d8", req: { lv: 15, int: 45 } },
  hunter_bow:    { name: "獵人短弓", slot: "weapon", wtype: "bow", watk: 25, req: { lv: 10, dex: 25 } },
  hawk_bow:      { name: "鷹羽長弓", slot: "weapon", wtype: "bow", watk: 34, color: "#4a4f6a", req: { lv: 15, dex: 45 } },
  iron_claw:     { name: "鐵指爪", slot: "weapon", wtype: "claw", watk: 12, req: { lv: 10, dex: 25 } },
  dark_claw:     { name: "黑鋼拳爪", slot: "weapon", wtype: "claw", watk: 16, color: "#7d86a8", req: { lv: 15, luk: 45 } },
  plain_tee:     { name: "粗布上衣", slot: "top", def: 3, color: "#e0574a" },
  jelly_tunic:   { name: "果凍紋上衣", slot: "top", def: 6, hp: 10, color: "#3fa7b8", req: { lv: 5 } },
  plain_shorts:  { name: "粗布短褲", slot: "bottom", def: 2, color: "#2c3e66" },
  canvas_pants:  { name: "帆布長褲", slot: "bottom", def: 5, color: "#5c6b3a", req: { lv: 5 } },
  straw_shoes:   { name: "草編鞋", slot: "shoes", def: 2, color: "#5b3a24" },
  wind_boots:    { name: "疾風短靴", slot: "shoes", def: 4, dex: 2, avoid: 2, color: "#2f6fd6", req: { lv: 10 } },
  leaf_band:     { name: "綠葉頭巾", slot: "hat", def: 4, color: "#4fa55a" },
  leather_cap:   { name: "皮革便帽", slot: "hat", def: 8, hp: 15, color: "#8a5a32", req: { lv: 10 } },
  work_gloves:   { name: "工作手套", slot: "gloves", def: 2, color: "#c9a26b" },
  hunter_gloves: { name: "獵人手套", slot: "gloves", def: 3, watk: 1, acc: 3, color: "#6b4a2a", req: { lv: 10 } },
  travel_cape:   { name: "旅人披風", slot: "cape", def: 4, mp: 15, color: "#6a4bc4", req: { lv: 8 } },
  moss_cape:     { name: "苔岩斗篷", slot: "cape", def: 8, str: 2, dex: 2, int: 2, luk: 2, color: "#5f7d4a", req: { lv: 15 } },
  wood_shield:   { name: "圓木盾", slot: "shield", def: 10, hp: 20, color: "#9a6a3a", req: { lv: 10 }, jobs: ["beginner", "warrior", "magician"] },
  shell_shield:  { name: "刺殼盾", slot: "shield", def: 16, str: 2, color: "#7c8a5c", req: { lv: 15 }, jobs: ["warrior", "magician"] },
  red_pot:       { name: "紅藥水", cat: "use", heal: { hp: 80 }, color: "#e0453b", desc: "回復 80 HP" },
  blue_pot:      { name: "藍藥水", cat: "use", heal: { mp: 50 }, color: "#3a7be0", desc: "回復 50 MP" },
  arrow:         { name: "木箭矢", cat: "use", ammo: "bow", stack: 1000, desc: "弓用的箭，射一次用掉一支" },
  iron_star:     { name: "鐵製飛鏢", cat: "use", ammo: "claw", watk: 15, stack: 500, color: "#c8d2de", desc: "拳爪丟的飛鏢，丟一次用掉一支" },
  steel_star:    { name: "銳角飛鏢", cat: "use", ammo: "claw", watk: 19, stack: 500, color: "#9fd0ff", desc: "更鋒利的飛鏢，丟一次用掉一支" },
  town_scroll:   { name: "回村卷軸", cat: "use", warp: true, color: "#e8d6a8", desc: "讀了就會立刻回到浮島村" },
  green_gel:     { name: "青果凍凝膠", color: "#7fd36b", desc: "青果凍留下的黏黏凝膠" },
  blue_gel:      { name: "藍果凍凝膠", color: "#5aa8ff", desc: "藍果凍留下的冰涼凝膠" },
  shell_shard:   { name: "刺殼碎片", color: "#b49a6a", desc: "刺殼龜背上掉下來的硬殼" },
  moss_core:     { name: "苔岩之心", color: "#8fe07a", desc: "苔岩巨像體內微微發光的石頭" },
};
// shop prices in coins; a shop buys anything back for half, and monster materials have their own price
const PRICES = {
  red_pot: 25, blue_pot: 50, town_scroll: 200, arrow: 1, iron_star: 2, steel_star: 4,
  wood_sword: 50, iron_blade: 3000, jade_blade: 20000, oak_wand: 2500, vine_staff: 20000, hunter_bow: 3000, hawk_bow: 20000,
  iron_claw: 3000, dark_claw: 20000, plain_tee: 30, jelly_tunic: 600, plain_shorts: 30, canvas_pants: 600, straw_shoes: 30,
  wind_boots: 2000, leaf_band: 200, leather_cap: 1500, work_gloves: 300, hunter_gloves: 2500, travel_cape: 1500, moss_cape: 15000,
  wood_shield: 1500, shell_shield: 8000,
};
const SELL = { green_gel: 6, blue_gel: 12, shell_shard: 25, moss_core: 800 };
for (const [id, I] of Object.entries(ITEMS)) {
  I.id = id;
  I.price = PRICES[id] || 0;
  I.sell = SELL[id] ?? I.price / 2;
  I.cat = I.slot ? "equip" : I.cat || "etc";
  I.stack = I.slot ? 1 : I.stack || (I.cat === "use" ? 100 : 200);
  if (I.wtype) I.jobs = WTYPES[I.wtype].jobs;
}
const newBag = () => ({ equip: Array(BAG_SLOTS).fill(null), use: Array(BAG_SLOTS).fill(null), etc: Array(BAG_SLOTS).fill(null) });
// puts n of an item into a bag, filling partly used stacks first; returns how many did not fit
function addTo(bag, id, n = 1) {
  const I = ITEMS[id], tab = bag[I.cat];
  for (const s of tab) if (n > 0 && s && s.id === id && s.n < I.stack) { const k = Math.min(n, I.stack - s.n); s.n += k; n -= k; }
  for (let i = 0; i < tab.length && n > 0; i++) if (!tab[i]) { const k = Math.min(n, I.stack); tab[i] = { id, n: k }; n -= k; }
  return n;
}
const outfit = weaponId => ({ hat: null, top: { id: "plain_tee", n: 1 }, bottom: { id: "plain_shorts", n: 1 }, shoes: { id: "straw_shoes", n: 1 },
                              gloves: null, cape: null, weapon: { id: weaponId, n: 1 }, shield: null });
// type: atk (attack), buff, passive. Every number scales with the skill level l.
const SKILLS = {
  warrior: [
    { id: "w_heavy", name: "重擊斬", type: "atk", weapon: "sword", max: 20, mp: l => 4 + (l >> 2), pct: l => 160 + 5 * l,
      desc: l => `用力砍一隻怪物，造成 ${160 + 5 * l}% 傷害` },
    { id: "w_sweep", name: "迴旋橫掃", type: "atk", weapon: "sword", max: 20, req: ["w_heavy", 1], mp: l => 8 + (l >> 2), pct: l => 60 + 4 * l,
      desc: l => `橫掃前方最多 6 隻怪物，各造成 ${60 + 4 * l}% 傷害` },
    { id: "w_iron", name: "鋼鐵意志", type: "buff", max: 20, mp: () => 10, dur: l => 10 * l, def: l => 2 * l,
      desc: l => `${10 * l} 秒內，受到的傷害減少 ${2 * l}` },
    { id: "w_regen", name: "體力回復", type: "passive", max: 16, hpr: l => l,
      desc: l => `自然回復時多回 ${l} HP` },
  ],
  magician: [
    { id: "m_bolt", name: "魔光彈", type: "atk", max: 20, mp: l => 3 + (l >> 2), spell: l => 12 + 2 * l,
      desc: l => `射出一顆魔法彈，魔法攻擊 ${12 + 2 * l}` },
    { id: "m_barrier", name: "魔力屏障", type: "buff", max: 20, mp: () => 12, dur: l => 20 * l, absorb: l => 4 * l,
      desc: l => `${20 * l} 秒內，受到的傷害有 ${4 * l}% 改扣 MP` },
    { id: "m_medit", name: "冥想", type: "passive", max: 16, mpr: l => l,
      desc: l => `自然回復時多回 ${l} MP` },
  ],
  bowman: [
    { id: "b_double", name: "連珠箭", type: "atk", weapon: "bow", max: 20, mp: l => 6 + (l >> 3), pct: l => 50 + 3 * l, shots: 2, shot: "arrow",
      desc: l => `連射兩支箭，每支 ${50 + 3 * l}% 傷害` },
    { id: "b_power", name: "強弓射擊", type: "atk", weapon: "bow", max: 20, mp: l => 5 + (l >> 2), pct: l => 140 + 6 * l, shots: 1, shot: "arrow",
      desc: l => `拉滿弓射出一支箭，造成 ${140 + 6 * l}% 傷害` },
    { id: "b_eye", name: "鷹眼", type: "buff", max: 20, mp: () => 10, dur: l => 10 * l, acc: l => l, avoid: l => l,
      desc: l => `${10 * l} 秒內，命中和迴避各加 ${l}` },
    { id: "b_crit", name: "致命瞄準", type: "passive", max: 20, crit: l => 2 * l,
      desc: l => `有 ${2 * l}% 機率打出 1.5 倍的爆擊` },
  ],
  thief: [
    { id: "t_twin", name: "雙星鏢", type: "atk", weapon: "claw", max: 20, mp: l => 8 + (l >> 2), pct: l => 60 + 4 * l, shots: 2, shot: "star",
      desc: l => `連丟兩支飛鏢，每支 ${60 + 4 * l}% 傷害` },
    { id: "t_shadow", name: "影遁", type: "buff", max: 20, mp: l => 20 - (l >> 1), dur: l => 10 * l,
      desc: l => `${10 * l} 秒內躲進影子，怪物碰不到你；一攻擊就會現身` },
    { id: "t_agile", name: "輕身術", type: "passive", max: 20, avoid: l => 2 * l,
      desc: l => `迴避加 ${2 * l}` },
  ],
};
const SKILL_BY_ID = {};
Object.values(SKILLS).flat().forEach(s => { SKILL_BY_ID[s.id] = s; });
const SLOT_KEYS = ["Shift", "D", "F"];
