// The player, shared game state, keyboard and touch input, and saving.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Player ----------
function freshCharacter() {
  return {
    lv: 1, exp: 0, job: "beginner", str: 12, dex: 5, int: 4, luk: 4, ap: 0, sp: 0,
    mhp: 50, mmp: 5, hp: 50, mp: 5, coins: 0, skills: {}, buffs: {}, map: "village", quests: {}, slots: [], pets: {}, petOn: null,
    bag: starterBag({ hp: 5, mp: 3 }), eq: outfit("wood_sword"), storage: Array(BAG_SLOTS).fill(null),
  };
}
function starterBag(pots) {
  const bag = newBag();
  addTo(bag, "red_pot", pots.hp); addTo(bag, "blue_pot", pots.mp); addTo(bag, "town_scroll", 2);
  return bag;
}
const P = {
  x: 96, y: 790, w: 26, h: 50, vx: 0, vy: 0, face: 1, onGround: false, ground: plats[0], climb: null,
  drop: 0, dropPlat: null, knock: 0, prone: false, climbCd: 0, pickCd: 0, lootHint: false, atkT: 0, atkDur: 0, atkKind: "", atkCd: 0, potCd: 0, inv: 0, anim: 0,
  dead: false, deadT: 0, regen: 0, ...freshCharacter(),
};
// gear(k) sums one bonus over everything worn: the item's own value, how its drop rolled, scroll bonuses
// and set bonuses; stat(k) is the base stat plus gear
const bonusOf = (e, k) => (ITEMS[e.id][k] || 0) + (e.vary?.[k] || 0) + (e.bonus?.[k] || 0);
const setCount = id => Object.values(P.eq).filter(e => e && ITEMS[e.id].set === id).length;
const setBonus = k => Object.entries(SETS).reduce((s, [id, S]) => {
  const n = setCount(id);
  return s + Object.entries(S.tiers).reduce((t, [need, add]) => t + (n >= need ? add[k] || 0 : 0), 0);
}, 0);
const gear = k => Object.values(P.eq).reduce((s, e) => s + (e ? bonusOf(e, k) : 0), 0) + setBonus(k);
const stat = k => P[k] + gear(k);
const maxHp = () => P.mhp + gear("hp");
const maxMp = () => P.mmp + gear("mp");
const need = () => Math.round(0.6 * P.lv ** 3 + 14 * P.lv);
const job = () => JOBS[P.job];
const weapon = () => P.eq.weapon ? ITEMS[P.eq.weapon.id] : null;
// arrows for a bow, throwing stars for a claw, in bag order
const ammoStacks = () => P.bag.use.filter(s => s && s.n > 0 && ITEMS[s.id].ammo === weapon()?.wtype);
const ammoCount = () => ammoStacks().reduce((n, s) => n + s.n, 0);
const skLv = id => P.skills[id] || 0;
const buffOn = id => (P.buffs[id] || 0) > 0;
const passive = (id, key) => { const l = skLv(id); return l ? SKILL_BY_ID[id][key](l) : 0; };
const buffVal = (id, key) => buffOn(id) ? SKILL_BY_ID[id][key](skLv(id)) : 0;
// every job keeps the skills of the jobs before it: first, then second, then third
const jobLine = () => [...new Set([root(P.job), JOBS[P.job].prev, P.job].filter(Boolean))];
const jobSkills = () => jobLine().flatMap(j => SKILLS[j] || []);
// seven skill keys; until you place skills yourself (P.slots), they fill with your active skills in order
const SKILL_SLOTS = 7;
const autoSlots = () => jobSkills().filter(s => s.type !== "passive").slice(0, SKILL_SLOTS).map(s => s.id);
function slotSkills() {
  const own = jobSkills(), ids = P.slots.length ? P.slots : autoSlots();
  return Array.from({ length: SKILL_SLOTS }, (_, i) => own.find(s => s.id === ids[i]) || null);
}
// puts a skill on key k (0-6), or takes it off every key when k is -1
function assignSlot(id, k) {
  const ids = Array.from({ length: SKILL_SLOTS }, (_, i) => slotSkills()[i]?.id || null).map(x => x === id ? null : x);
  if (k >= 0) ids[k] = id;
  P.slots = ids;
}
// mastery narrows the damage range toward the top: 10% to start, raised by each second job's mastery skill
const mastery = () => 0.1 + MASTERY_SKILLS.reduce((s, id) => s + passive(id, "mastery"), 0) / 100;

// physical damage range before the skill's percentage
function physRange() {
  const w = weapon();
  if (!w) return [0, 0];
  let pri, sec, watk = gear("watk") + buffVal("k_rage", "watk") + buffVal("s_soul", "watk");
  if (w.wtype === "bow") { pri = stat("dex") * 3.4; sec = stat("str"); }
  else if (w.wtype === "claw") { pri = stat("luk") * 3.6; sec = stat("str") + stat("dex"); watk += ITEMS[ammoStacks()[0]?.id]?.watk || 0; }
  else { pri = stat("str") * 4; sec = stat("dex"); }
  return [(pri * 0.9 * mastery() + sec) * watk / 100, (pri + sec) * watk / 100];
}
const magic = () => stat("int") + gear("matk") + passive("e_mastery", "matk") + passive("x_wisdom", "matk");
function magicRange(spell) {
  const mag = magic();
  return [((mag * mag / 1000 + mag * mastery() * 0.9) / 30 + stat("int") / 200) * spell,
          ((mag * mag / 1000 + mag) / 30 + stat("int") / 200) * spell];
}
const accuracy = () => stat("dex") * 0.8 + stat("luk") * 0.5 + gear("acc") + buffVal("b_eye", "acc") + passive("k_mastery", "acc") + passive("h_mastery", "acc") + passive("g_sharp", "acc");
const avoidability = () => stat("dex") * 0.25 + stat("luk") * 0.5 + gear("avoid") + passive("t_agile", "avoid") + passive("a_mastery", "avoid") + buffVal("b_eye", "avoid") + buffVal("n_dark", "avoid");
const walkSpeed = () => WALK * (1 + buffVal("a_haste", "speed") / 100);
const critChance = () => (CRIT_SKILLS.reduce((s, id) => s + passive(id, "crit"), 0) + buffVal("g_focus", "crit")) / 100;

// ---------- State ----------
const cam = { x: 0, y: WORLD_H - H, shake: 0 };
const nums = [], fx = [], drops = [], msgs = [];
let time = 0, saveT = 0, started = false;

function msg(text, color = "#eef3fb") {
  msgs.push({ text, color, t: 4.5 });
  if (msgs.length > 6) msgs.shift();
}

// ---------- Input ----------
const held = new Set(), pressed = new Set();
// Arrows, Space, Enter and Esc always do the same thing; everything in ACTIONS can be moved to another key.
const FIXED_KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Space: "space", Enter: "revive", Escape: "esc" };
const ACTIONS = {
  jump: "跳躍", attack: "攻擊", pickup: "撿東西", skill1: "技能 1", skill2: "技能 2", skill3: "技能 3", skill4: "技能 4", skill5: "技能 5", skill6: "技能 6", skill7: "技能 7",
  hpPot: "紅藥水", mpPot: "藍藥水", stats: "能力值", skills: "技能視窗", inv: "背包", equip: "裝備", world: "世界地圖", quests: "任務日誌", keys: "鍵位設定", settings: "設定", minimap: "小地圖",
};
const DEFAULT_BINDS = {
  jump: ["AltLeft", "AltRight", "KeyC"], attack: ["ControlLeft", "ControlRight", "KeyX"], pickup: ["KeyZ"],
  skill1: ["ShiftLeft", "ShiftRight", "KeyA"], skill2: ["KeyD"], skill3: ["KeyF"], skill4: ["KeyG"], skill5: ["KeyH"], skill6: ["KeyV"], skill7: ["KeyB"],
  hpPot: ["Digit1", "Numpad1", "Delete"], mpPot: ["Digit2", "Numpad2", "End"],
  stats: ["KeyS"], skills: ["KeyK"], inv: ["KeyI"], equip: ["KeyE"], world: ["KeyW"], quests: ["KeyQ"], keys: ["KeyO"], settings: ["KeyP"], minimap: ["KeyM"],
};
const BINDS_KEY = "floating-isle-keys";
let binds = {}, KEYMAP = {}, binding = null;
function loadBinds() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(BINDS_KEY) || "null"); } catch (_) {}
  binds = {};
  for (const a in DEFAULT_BINDS) binds[a] = Array.isArray(saved?.[a]) ? saved[a].filter(c => typeof c === "string" && !FIXED_KEYS[c]) : [...DEFAULT_BINDS[a]];
  rebuildKeymap();
}
function rebuildKeymap() {
  KEYMAP = { ...FIXED_KEYS };
  for (const a in binds) for (const c of binds[a]) KEYMAP[c] = a;
}
// one key does one thing: giving a key to an action takes it away from whatever had it
function bindKey(action, code) {
  for (const a in binds) binds[a] = binds[a].filter(c => c !== code);
  binds[action] = [code];
  rebuildKeymap();
  try { localStorage.setItem(BINDS_KEY, JSON.stringify(binds)); } catch (_) {}
}
function resetBinds() {
  try { localStorage.removeItem(BINDS_KEY); } catch (_) {}
  loadBinds();
}
const KEY_NAMES = { ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl", AltLeft: "Alt", AltRight: "Alt", Delete: "Del",
  Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
  Tab: "Tab", CapsLock: "Caps", Backspace: "Back", Insert: "Ins", Home: "Home", End: "End", PageUp: "PgUp", PageDown: "PgDn" };
const keyName = code => KEY_NAMES[code] || code.replace(/^Key|^Digit/, "").replace(/^Numpad/, "Num ");
// the key shown for an action: its first binding, or a dash when it has none
const keyOf = a => binds[a]?.length ? keyName(binds[a][0]) : "—";
loadBinds();
const PANEL_KEYS = ["stats", "skills", "inv", "equip", "world", "quests", "keys", "settings", "esc"];
function press(a) { started = true; startAudio(); if (!held.has(a)) pressed.add(a); held.add(a); }
addEventListener("keydown", e => {
  // typing in the settings window (pasting a save) must not move the character
  if (e.target instanceof HTMLElement && e.target.matches("input, textarea, select") && e.code !== "Escape") return;
  if (binding) {
    // the key window is waiting for the next key press
    e.preventDefault();
    if (e.code === "Escape") binding = null;
    else if (FIXED_KEYS[e.code]) hint(`${keyName(e.code)} 不能改`);
    else { bindKey(binding, e.code); binding = null; renderKeyLabels(); }
    refreshPanels(true);
    return;
  }
  if (!dlg.hidden) {
    // while the NPC is talking, keys drive the dialog instead of the game
    if (e.code === "Escape") { e.preventDefault(); closeDialog(); }
    else if (/^(Digit|Numpad)[1-9]$/.test(e.code)) {
      const b = dlgOpts.children[Number(e.code.slice(-1)) - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
    return;
  }
  const a = KEYMAP[e.code];
  if (!a) return;
  e.preventDefault();
  if (a === "minimap") { if (!e.repeat) cycleMinimap(); return; }
  if (PANEL_KEYS.includes(a)) {
    if (e.repeat) return;
    const wins = { stats: statsWin, skills: skillsWin, inv: invWin, equip: equipWin, world: worldWin, quests: questWin, keys: keysWin, settings: setWin };
    if (a === "esc") [...Object.values(wins), shopWin].forEach(w => { w.hidden = true; });
    else togglePanel(wins[a]);
    return;
  }
  press(a);
});
addEventListener("keyup", e => { const a = KEYMAP[e.code]; if (a) { held.delete(a); e.preventDefault(); } });
addEventListener("blur", () => held.clear());
cv.addEventListener("pointerdown", e => {
  cv.focus(); started = true; startAudio();
  if (P.dead) { pressed.add("revive"); return; }
  // clicking the NPC opens the dialog, like in the original
  const r = cv.getBoundingClientRect();
  const wx = (e.clientX - r.left) / r.width * W + cam.x, wy = (e.clientY - r.top) / r.height * H + cam.y;
  const npc = npcsHere().find(n => Math.abs(wx - n.x) < 22 && wy > n.y - 64 && wy < n.y + 4);
  if (npc) openNpc(npc);
});
document.querySelectorAll("[data-act]").forEach(b => {
  const a = b.dataset.act;
  const off = () => { held.delete(a); b.classList.remove("on"); };
  b.addEventListener("pointerdown", e => {
    e.preventDefault(); press(a); b.classList.add("on");
    try { b.setPointerCapture(e.pointerId); } catch (_) {}
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(t => b.addEventListener(t, off));
  b.addEventListener("contextmenu", e => e.preventDefault());
});

// ---------- Save ----------
const SAVE_FIELDS = ["lv", "exp", "job", "str", "dex", "int", "luk", "ap", "sp", "mhp", "mmp", "hp", "mp", "coins", "map"];
function serialize() {
  const copy = v => JSON.parse(JSON.stringify(v));
  const d = { skills: { ...P.skills }, buffs: { ...P.buffs }, slots: [...P.slots], quests: copy(P.quests), bag: copy(P.bag), eq: copy(P.eq), storage: copy(P.storage), pets: copy(P.pets), petOn: P.petOn };
  SAVE_FIELDS.forEach(k => { d[k] = P[k]; });
  return d;
}
// keeps only slots holding a known item of the right kind, so a hand-edited or older save cannot break the game
function cleanBag(b) {
  const bag = newBag();
  for (const t in bag) (b[t] || []).slice(0, BAG_SLOTS).forEach((s, i) => {
    const I = s && ITEMS[s.id];
    if (I && I.cat === t && s.n > 0) bag[t][i] = I.slot ? cleanGear(s) : { id: s.id, n: Math.min(s.n | 0, I.stack) };
  });
  return bag;
}
// a piece of gear: upgrade slots left, successful upgrades, the bonus they added, how its stats rolled
// when it dropped, and whether a guard scroll is on it
function cleanGear(s) {
  const I = ITEMS[s.id], g = { id: s.id, n: 1 };
  if (Number.isInteger(s.left)) g.left = clamp(s.left, 0, I.slots);
  if (s.up > 0) g.up = s.up | 0;
  if (s.bonus) {
    g.bonus = {};
    for (const k in GEAR_STATS) if (Number(s.bonus[k]) > 0) g.bonus[k] = Number(s.bonus[k]) | 0;
  }
  if (s.vary) {
    const vary = {};
    for (const k in GEAR_STATS) if (Number.isInteger(s.vary[k]) && s.vary[k]) vary[k] = clamp(s.vary[k], -(I[k] || 0), 50);
    if (Object.keys(vary).length) g.vary = vary;
  }
  if (s.guard === true) g.guard = true;
  return g;
}
function cleanStorage(a) {
  return Array.from({ length: BAG_SLOTS }, (_, i) => {
    const s = a?.[i], I = s && ITEMS[s.id];
    return I && s.n > 0 ? (I.slot ? cleanGear(s) : { id: s.id, n: Math.min(s.n | 0, I.stack) }) : null;
  });
}
function cleanEq(e) {
  const eq = {};
  for (const k in EQUIP_SLOTS) eq[k] = e?.[k] && ITEMS[e[k].id]?.slot === k ? cleanGear(e[k]) : null;
  return eq;
}
// saves from before the bag existed: potions move into the bag, and the job's weapon and ammo are handed out
function giveStarterGear(c, pots) {
  c.bag = starterBag({ hp: pots?.hp ?? 5, mp: pots?.mp ?? 3 });
  c.eq = outfit(JOBS[c.job].weapon);
  if (JOBS[c.job].ammo) addTo(c.bag, ...JOBS[c.job].ammo);
}
// three save slots: slot 1 keeps the original key, so saves from before slots existed stay where they were
const SLOT_KEY = "floating-isle-slot";
const slotKey = n => n === 1 ? SAVE_KEY : `${SAVE_KEY}-${n}`;
let saveSlot = 1;
try { saveSlot = clamp(Number(localStorage.getItem(SLOT_KEY)) || 1, 1, 3); } catch (_) {}
function save() { try { localStorage.setItem(slotKey(saveSlot), JSON.stringify(serialize())); } catch (_) {} }
function load(d) {
  if (!d) { try { d = JSON.parse(localStorage.getItem(slotKey(saveSlot)) || "null"); } catch (_) { d = null; } }
  if (!d || !d.lv) return false;
  const c = freshCharacter();
  if (!d.job) {
    // saves from before jobs existed: keep level, coins and potions, hand back every level's AP
    const lv = Math.max(1, d.lv | 0);
    Object.assign(c, { lv, exp: d.exp || 0, coins: d.coins || 0, ap: 5 * (lv - 1), mhp: 50 + 14 * (lv - 1), mmp: 5 + 11 * (lv - 1) });
    c.hp = c.mhp; c.mp = c.mmp;
  } else {
    SAVE_FIELDS.forEach(k => { if (d[k] !== undefined) c[k] = d[k]; });
    if (!JOBS[c.job]) c.job = "beginner";
    if (!MAPS[c.map]) c.map = "village";
    c.skills = { ...(d.skills || {}) }; c.buffs = { ...(d.buffs || {}) };
    c.slots = Array.isArray(d.slots) ? d.slots.slice(0, SKILL_SLOTS).map(x => SKILL_BY_ID[x] ? x : null) : [];
  }
  c.quests = cleanQuests(d.quests);
  c.storage = cleanStorage(d.storage);
  c.pets = cleanPets(d.pets);
  c.petOn = c.pets[d.petOn] ? d.petOn : null;
  if (d.bag) { c.bag = cleanBag(d.bag); c.eq = cleanEq(d.eq); }
  else giveStarterGear(c, d.pots);
  Object.assign(P, c);
  P.hp = clamp(P.hp || maxHp(), 1, maxHp()); P.mp = clamp(P.mp ?? maxMp(), 0, maxMp());
  return true;
}
// a line about a slot for the settings window: level, job and where the character is
function slotSummary(n) {
  let d = n === saveSlot ? P : null;
  if (!d) { try { d = JSON.parse(localStorage.getItem(slotKey(n)) || "null"); } catch (_) {} }
  return d?.lv ? `Lv.${d.lv} ${JOBS[d.job]?.name || "新手"}．${MAPS[d.map]?.name || "浮島村"}` : "空的";
}
// a fresh start in the new slot when it is empty
function switchSlot(n) {
  if (n === saveSlot) return;
  save();
  saveSlot = n;
  try { localStorage.setItem(SLOT_KEY, String(n)); } catch (_) {}
  const had = load();
  if (!had) Object.assign(P, freshCharacter());
  P.dead = false;
  loadMap(P.map);
  invSel = null; eqSel = null; bagVer++;
  closeDialog(); shopWin.hidden = true;
  msg(had ? `切換到存檔 ${n}：Lv.${P.lv} 的${job().name}` : `存檔 ${n} 是空的，開始新的冒險`, "#ffc94a");
  refreshPanels(true); save();
}
// a save as one line of text, to carry to another device; the prefix marks it as this game's
function exportSave() {
  return "FI1:" + btoa(unescape(encodeURIComponent(JSON.stringify(serialize()))));
}
function importSave(text) {
  let d = null;
  try { d = JSON.parse(decodeURIComponent(escape(atob(text.trim().replace(/^FI1:/, ""))))); } catch (_) {}
  if (!d || !d.lv || !load(d)) { hint("存檔文字不對，請把整段文字完整貼上"); return false; }
  P.dead = false;
  loadMap(P.map);
  invSel = null; eqSel = null; bagVer++;
  save();
  msg(`匯入完成：Lv.${P.lv} 的${job().name}`, "#ffc94a");
  refreshPanels(true);
  return true;
}
const resetBtn = document.getElementById("reset");
let armT = 0;
resetBtn.addEventListener("click", () => {
  if (!resetBtn.classList.contains("armed")) {
    resetBtn.classList.add("armed"); resetBtn.textContent = "再按一次確認重來";
    clearTimeout(armT); armT = setTimeout(() => { resetBtn.classList.remove("armed"); resetBtn.textContent = "重新開始"; }, 3000);
    return;
  }
  clearTimeout(armT);
  resetBtn.classList.remove("armed"); resetBtn.textContent = "重新開始";
  Object.assign(P, freshCharacter(), { dead: false });
  loadMap("village");
  invSel = null; eqSel = null; bagVer++;
  closeDialog(); refreshPanels(true);
  save(); msg("已重新開始冒險", "#ffc94a"); cv.focus();
});
