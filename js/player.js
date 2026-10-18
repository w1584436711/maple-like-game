// The player, shared game state, keyboard and touch input, and saving.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Player ----------
function freshCharacter() {
  return {
    lv: 1, exp: 0, job: "beginner", str: 12, dex: 5, int: 4, luk: 4, ap: 0, sp: 0,
    mhp: 50, mmp: 5, hp: 50, mp: 5, coins: 0, skills: {}, buffs: {}, map: "village", quests: {},
    bag: starterBag({ hp: 5, mp: 3 }), eq: outfit("wood_sword"),
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
// gear(k) sums one bonus over everything worn; stat(k) is the base stat plus gear
const worn = () => Object.values(P.eq).filter(Boolean).map(e => ITEMS[e.id]);
const gear = k => worn().reduce((s, I) => s + (I[k] || 0), 0);
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
const jobSkills = () => SKILLS[P.job] || [];
const slotSkills = () => jobSkills().filter(s => s.type !== "passive").slice(0, 3);

// physical damage range before the skill's percentage
function physRange() {
  const w = weapon();
  if (!w) return [0, 0];
  let pri, sec, watk = gear("watk");
  if (w.wtype === "bow") { pri = stat("dex") * 3.4; sec = stat("str"); }
  else if (w.wtype === "claw") { pri = stat("luk") * 3.6; sec = stat("str") + stat("dex"); watk += ITEMS[ammoStacks()[0]?.id]?.watk || 0; }
  else { pri = stat("str") * 4; sec = stat("dex"); }
  const mastery = 0.1;
  return [(pri * 0.9 * mastery + sec) * watk / 100, (pri + sec) * watk / 100];
}
const magic = () => stat("int") + gear("matk");
function magicRange(spell) {
  const mag = magic(), mastery = 0.1;
  return [((mag * mag / 1000 + mag * mastery * 0.9) / 30 + stat("int") / 200) * spell,
          ((mag * mag / 1000 + mag) / 30 + stat("int") / 200) * spell];
}
const accuracy = () => stat("dex") * 0.8 + stat("luk") * 0.5 + gear("acc") + buffVal("b_eye", "acc");
const avoidability = () => stat("dex") * 0.25 + stat("luk") * 0.5 + gear("avoid") + passive("t_agile", "avoid") + buffVal("b_eye", "avoid");
const critChance = () => passive("b_crit", "crit") / 100;

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
const KEYMAP = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  Space: "space", KeyC: "jump", AltLeft: "jump", AltRight: "jump",
  ControlLeft: "attack", ControlRight: "attack", KeyX: "attack", KeyZ: "pickup",
  ShiftLeft: "skill1", ShiftRight: "skill1", KeyA: "skill1", KeyD: "skill2", KeyF: "skill3",
  Digit1: "hpPot", Numpad1: "hpPot", Delete: "hpPot", Digit2: "mpPot", Numpad2: "mpPot", End: "mpPot", Enter: "revive",
  KeyS: "stats", KeyK: "skills", KeyI: "inv", KeyE: "equip", KeyW: "world", KeyQ: "quests", Escape: "esc",
};
const PANEL_KEYS = ["stats", "skills", "inv", "equip", "world", "quests", "esc"];
function press(a) { started = true; if (!held.has(a)) pressed.add(a); held.add(a); }
addEventListener("keydown", e => {
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
  if (PANEL_KEYS.includes(a)) {
    if (e.repeat) return;
    const wins = { stats: statsWin, skills: skillsWin, inv: invWin, equip: equipWin, world: worldWin, quests: questWin };
    if (a === "esc") [...Object.values(wins), shopWin].forEach(w => { w.hidden = true; });
    else togglePanel(wins[a]);
    return;
  }
  press(a);
});
addEventListener("keyup", e => { const a = KEYMAP[e.code]; if (a) { held.delete(a); e.preventDefault(); } });
addEventListener("blur", () => held.clear());
cv.addEventListener("pointerdown", e => {
  cv.focus(); started = true;
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
  const d = { skills: { ...P.skills }, buffs: { ...P.buffs }, quests: JSON.parse(JSON.stringify(P.quests)), bag: JSON.parse(JSON.stringify(P.bag)), eq: JSON.parse(JSON.stringify(P.eq)) };
  SAVE_FIELDS.forEach(k => { d[k] = P[k]; });
  return d;
}
// keeps only slots holding a known item of the right kind, so a hand-edited or older save cannot break the game
function cleanBag(b) {
  const bag = newBag();
  for (const t in bag) (b[t] || []).slice(0, BAG_SLOTS).forEach((s, i) => {
    const I = s && ITEMS[s.id];
    if (I && I.cat === t && s.n > 0) bag[t][i] = { id: s.id, n: Math.min(s.n | 0, I.stack) };
  });
  return bag;
}
function cleanEq(e) {
  const eq = {};
  for (const k in EQUIP_SLOTS) eq[k] = e?.[k] && ITEMS[e[k].id]?.slot === k ? { id: e[k].id, n: 1 } : null;
  return eq;
}
// saves from before the bag existed: potions move into the bag, and the job's weapon and ammo are handed out
function giveStarterGear(c, pots) {
  c.bag = starterBag({ hp: pots?.hp ?? 5, mp: pots?.mp ?? 3 });
  c.eq = outfit(JOBS[c.job].weapon);
  if (JOBS[c.job].ammo) addTo(c.bag, ...JOBS[c.job].ammo);
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (_) {} }
function load(d) {
  if (!d) { try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (_) { d = null; } }
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
  }
  c.quests = cleanQuests(d.quests);
  if (d.bag) { c.bag = cleanBag(d.bag); c.eq = cleanEq(d.eq); }
  else giveStarterGear(c, d.pots);
  Object.assign(P, c);
  P.hp = clamp(P.hp || maxHp(), 1, maxHp()); P.mp = clamp(P.mp ?? maxMp(), 0, maxMp());
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
