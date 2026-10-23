// Fighting, drops, levelling up, and the per-frame update of everything.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Combat ----------
function targetsIn(box, n) {
  const cx = P.x + P.w / 2;
  return mobs.filter(m => hittable(m) && overlap(box, m))
    .sort((a, b) => Math.abs(a.x + a.w / 2 - cx) - Math.abs(b.x + b.w / 2 - cx))
    .slice(0, n);
}
// o: { pct } for physical hits, { magic: true, spell } for spells; stack lifts the number for multi-hits
function rollDamage(m, o) {
  const diff = Math.max(0, m.T.lv - P.lv);
  if (o.magic) {
    if (Math.random() < diff * 0.04) return null;
    const [mn, mx] = magicRange(o.spell);
    return { d: rand(mn, mx) * (1 + dmgBoost() / 100), crit: false };
  }
  // classic hit check: accuracy needed grows with the monster's avoid and its level lead
  const needAcc = (55 + 2 * diff) * m.T.avoid / 15;
  if (Math.random() > Math.min(1, accuracy() / needAcc)) return null;
  const [mn, mx] = physRange();
  const crit = Math.random() < critChance();
  return { d: rand(mn, mx) * (o.pct || 100) / 100 * (crit ? 1.5 : 1) * (1 + dmgBoost() / 100), crit };
}
function dealDamage(m, o = {}) {
  if (m.dead) return;
  const mcx = m.x + m.w / 2, ny = m.y - 8 - (o.stack || 0) * 28;
  m.aggro = 10; m.showHp = 4;
  const r = rollDamage(m, o);
  if (!r) { nums.push({ x: mcx, y: ny, text: "MISS", kind: "miss", t: 0 }); sfx("miss"); return; }
  const d = Math.max(1, Math.round(r.d));
  m.hp -= d; m.flash = 0.12;
  if (!m.T.boss && !m.T.heavy) m.kb = (mcx > P.x + P.w / 2 ? 1 : -1) * 170;
  nums.push({ x: mcx, y: ny, text: String(d), kind: r.crit ? "crit" : "hit", t: 0 });
  sfx("hit");
  fx.push({ k: "spark", x: mcx + rand(-8, 8), y: m.y + m.h / 2 + rand(-8, 8), t: 0 });
  if (m.hp <= 0) kill(m);
}
function kill(m) {
  m.dead = true; m.deadT = m.T.respawn || 5;
  gainExp(m.T.exp * EXP_RATE);
  questKill(m.t);
  const mcx = m.x + m.w / 2, my = m.y + m.h / 2;
  const boss = !!m.T.boss, items = [];
  const coinDrops = boss ? 8 : (Math.random() < 0.9 ? 1 : 0);
  for (let i = 0; i < coinDrops; i++) items.push(["coin", randi(m.T.coin[0], m.T.coin[1]) / (boss ? 8 : 1) | 0]);
  for (const [id, chance, a = 1, b = a] of m.T.drops) {
    // id can be a list to pick one from, or a function that picks (a skill book for your job)
    if (Math.random() < chance) items.push(["item", randi(a, b), Array.isArray(id) ? id[randi(0, id.length - 1)] : typeof id === "function" ? id() : id]);
  }
  // a card for the monster book, now and then (often from a boss)
  if (!m.minion && !m.T.nocard && Math.random() < (boss ? BOSS_CARD_CHANCE : CARD_CHANCE)) items.push(["item", 1, `card_${m.t}`]);
  if (boss && !m.minion) P.bossKills[m.t] = (P.bossKills[m.t] || 0) + 1;
  // items pop up and land side by side in a row, centred on the monster
  items.forEach(([kind, value, id], i) => {
    addDrop(kind, mcx + (i - (items.length - 1) / 2) * 24, my, value, id);
    if (kind === "item" && ITEMS[id].slot) drops[drops.length - 1].gear = rollGear(id);
  });
  if (items.length && !P.lootHint) { P.lootHint = true; msg("按 Z 撿起地上的東西", "#ffc94a"); }
  if (boss) {
    msg(`打倒了${m.T.name}！`, "#ffc94a"); cam.shake = 10;
    // the young it called up scatter with it
    mobs.forEach(o => { if (o.minion && !o.dead) { o.dead = true; o.deadT = 0; } });
  }
}
// kind "coin" carries an amount in value; kind "item" carries an item id and a count in value
function addDrop(kind, x, y, value, id) {
  drops.push({ kind, id, x: clamp(x, 8, WORLD_W - 8), y, value: Math.max(1, value), vx: 0, vy: -420, landed: false, age: 0, ph: rand(0, 6) });
}
// coins and monster cards never need bag room
const canTake = d => d.kind === "coin" || !!ITEMS[d.id].card || roomFor(d.id) > 0;
const PICK_COLORS = { equip: "#ffd97a", use: "#9fd0ff", etc: "#cfe3ff" };
function collect(d) {
  sfx(d.kind === "coin" ? "coin" : "pickup");
  if (d.kind === "coin") { P.coins += d.value; msg(`撿到金幣 ${d.value}`, "#ffd97a"); }
  else if (ITEMS[d.id].card) gainCard(ITEMS[d.id].card);
  else {
    // a stack that only partly fits leaves the rest on the ground
    const I = ITEMS[d.id], left = d.gear ? putGear(d.gear) : addItem(d.id, d.value), got = d.value - left;
    msg(`撿到${I.name}${got > 1 ? ` ×${got}` : ""}`, PICK_COLORS[I.cat]);
    questPickup(d.id);
    if (left) { d.value = left; msg(`背包的${TABS[I.cat]}欄滿了`, "#ff9b8f"); return; }
  }
  fx.push({ k: "spark", x: d.x, y: d.y - 8, t: 0 });
  drops.splice(drops.indexOf(d), 1);
}
function gainExp(n) {
  P.exp += n;
  msg(`獲得經驗值 +${n}`, "#cfe3ff");
  while (P.exp >= need()) {
    P.exp -= need();
    levelUp();
  }
}
function levelUp() {
  const J = job();
  P.lv++; P.ap += 5;
  if (P.job !== "beginner") P.sp += 3;
  P.mhp += randi(J.hp[0], J.hp[1]);
  P.mmp += randi(J.mp[0], J.mp[1]) + (root(P.job) === "magician" ? Math.floor(P.int / 10) : 0);
  P.hp = maxHp(); P.mp = maxMp();
  fx.push({ k: "lvup", t: 0 });
  sfx("levelup");
  msg(`等級提升！現在是 Lv.${P.lv}，按 S 分配 5 點能力值`, "#ffc94a");
  if (P.job === "beginner" && (P.lv === 8 || P.lv === 10)) msg("可以回浮島村找轉職教官薇拉轉職了", "#ffc94a");
  if (SECOND[P.job] && P.lv === 30) msg("可以回浮島村找轉職教官薇拉二轉了", "#ffc94a");
  if (FOURTH[P.job] && P.lv === 70) msg("可以去沉砂城找神殿祭司伊薩，準備四轉了", "#ffc94a");
  refreshPanels(true);
  save();
}
// acc is the monster's accuracy; null means the hit cannot be dodged
function hurt(d, fromX, acc = null) {
  if (P.inv > 0 || P.dead) return;
  if (acc !== null && buffOn("t_shadow")) return;
  if (acc !== null && Math.random() < Math.min(0.5, avoidability() / (acc * 4))) {
    nums.push({ x: P.x + P.w / 2, y: P.y - 6, text: "MISS", kind: "miss", t: 0 });
    P.inv = 0.6;
    return;
  }
  let dmg = Math.max(1, Math.round(d * rand(0.9, 1.1) - P.lv * 0.6 - gear("def") * 0.4 - buffVal("w_iron", "def")));
  const toMp = Math.min(P.mp, Math.round(dmg * buffVal("m_barrier", "absorb") / 100));
  P.mp -= toMp; dmg -= toMp;
  P.hp -= dmg;
  nums.push({ x: P.x + P.w / 2, y: P.y - 6, text: String(dmg), kind: "hurt", t: 0 });
  P.inv = INV_TIME;
  sfx("hurt");
  if (!P.climb) {
    P.knock = 0.35; P.prone = false; P.atkT = 0;
    P.vx = (P.x + P.w / 2 < fromX ? -1 : 1) * KB_VX; P.vy = -KB_VY; P.onGround = false;
  }
  if (P.hp <= 0) {
    P.hp = 0; P.dead = true; P.deadT = 0; P.climb = null;
    sfx("death");
    const lost = Math.floor(P.exp * deathPenalty() / 100);
    P.exp -= lost;
    msg(lost ? `你倒下了…失去 ${lost} 點經驗值` : "你倒下了…", "#ff9b8f");
  }
}
// percent of the current exp lost when knocked out: nothing for a beginner, 10% for a new first job,
// then a quarter of a percent less each level down to 3%, so a long climb is never wiped out at once
// the expedition costs nothing but the try
const deathPenalty = () => P.job === "beginner" || map.raid ? 0 : clamp(10 - (P.lv - 10) * 0.25, 3, 10);
function revive() {
  // like the original, you get back up in the nearest town
  P.dead = false;
  goToTown();
  P.hp = Math.ceil(maxHp() * 0.5); P.mp = Math.ceil(maxMp() * 0.5); P.inv = 2;
  msg(`在${map.name}重新站了起來`, "#cfe3ff");
  save();
}

// ---------- Update ----------
function findLadder(test) { return ladders.find(test); }
// Space talks to a nearby NPC, otherwise it jumps
const jumpPressed = () => pressed.has("jump") || (pressed.has("space") && !nearNpc());

function updatePlayer(dt) {
  if (sitting()) return;
  const L_ = held.has("left"), R_ = held.has("right"), U_ = held.has("up"), D_ = held.has("down");
  const cx = P.x + P.w / 2;

  const attacking = P.atkT > 0;

  if (P.climb) {
    const L = P.climb;
    P.vx = 0; P.vy = 0; P.prone = false;
    if (U_ && !D_) { P.y -= CLIMB * dt; P.anim += dt; }
    else if (D_ && !U_) { P.y += CLIMB * dt; P.anim += dt; }
    if (P.y + P.h <= L.top) { P.y = L.top - P.h; P.climb = null; P.onGround = true; P.ground = platAt(L.x, L.top); return; }
    if (P.y + P.h >= L.bottom) { P.y = L.bottom - P.h; P.climb = null; P.onGround = true; P.ground = platAt(L.x, L.bottom); return; }
    // jumping off a rope needs a direction held
    if (jumpPressed() && (L_ || R_)) {
      P.climb = null; P.climbCd = 0.35; P.face = L_ ? -1 : 1; P.vx = P.face * ROPE_JUMP_VX; P.vy = -ROPE_JUMP_VY;
    }
    return;
  }
  P.climbCd -= dt;

  // ↑ in front of a portal goes through it; otherwise ↑ grabs a rope
  if (pressed.has("up") && P.onGround && !attacking && P.knock <= 0) {
    const pt = portalAt();
    if (pt) { usePortal(pt); return; }
  }
  // grab a rope, on the ground or in mid-air
  if (U_ && !attacking && P.knock <= 0 && P.climbCd <= 0) {
    const L = findLadder(l => Math.abs(cx - l.x) < 14 && P.y + P.h > l.top + 4 && P.y + P.h <= l.bottom + 1);
    if (L) { P.climb = L; P.x = L.x - P.w / 2; P.vx = P.vy = 0; P.onGround = false; return; }
  }
  if (D_ && P.onGround && !attacking && P.knock <= 0) {
    const L = findLadder(l => Math.abs(cx - l.x) < 14 && Math.abs(l.top - (P.y + P.h)) < 2);
    if (L) { P.climb = L; P.x = L.x - P.w / 2; P.y += 6; P.vx = P.vy = 0; P.onGround = false; P.prone = false; return; }
  }

  P.prone = P.onGround && D_ && P.knock <= 0 && (!attacking || P.atkKind === "stab");
  const ax = (R_ ? 1 : 0) - (L_ ? 1 : 0);
  if (P.onGround) {
    // quick start and stop with a few pixels of slide
    const target = (!attacking && !P.prone && P.knock <= 0) ? ax * walkSpeed() : 0;
    P.vx += (target - P.vx) * (1 - Math.exp(-dt / 0.04));
    if (!target && Math.abs(P.vx) < 1) P.vx = 0;
    if (ax && !attacking && P.knock <= 0) P.face = ax;
    if (Math.abs(P.vx) > 10) P.anim += dt;
  } else if (ax && !attacking && P.knock <= 0) {
    // in the air you can turn around and brake, but not speed up
    P.face = ax;
    if (ax * P.vx < 0) { const b = AIR_BRAKE * dt; P.vx = Math.abs(P.vx) <= b ? 0 : P.vx + ax * b; }
  }

  if (jumpPressed() && P.onGround && !attacking && P.knock <= 0) {
    if (D_) {
      if (!P.ground.ground) { P.drop = 0.3; P.dropPlat = P.ground; P.onGround = false; P.prone = false; P.vy = -180; }
    } else { P.vy = -JUMP; P.onGround = false; sfx("jump"); }
  }

  P.vy = Math.min(P.vy + G * dt, FALL_MAX);
  const prevBottom = P.y + P.h;
  P.x = clamp(P.x + P.vx * dt, 0, WORLD_W - P.w);
  P.y += P.vy * dt;
  P.onGround = false;
  if (P.vy >= 0) {
    let best = null;
    for (const p of plats) {
      if (P.drop > 0 && p === P.dropPlat) continue;
      if (P.x + P.w > p.x + 4 && P.x < p.x + p.w - 4 && prevBottom <= p.y + 1 && P.y + P.h >= p.y) {
        if (!best || p.y < best.y) best = p;
      }
    }
    if (best) { P.y = best.y - P.h; P.vy = 0; P.onGround = true; P.ground = best; }
  }
}

function playerActions(dt0) {
  if (P.dead) return;
  // holding Z keeps picking things up, one at a time
  P.pickCd -= dt0;
  if (held.has("pickup") && P.pickCd <= 0 && !P.climb) {
    const cx = P.x + P.w / 2;
    const near = drops.filter(d => d.landed && Math.abs(d.x - cx) < 32 && d.y >= P.y && d.y <= P.y + P.h + 4)
      .sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx));
    // skip what the bag has no room for, so one stuck item does not block the coins next to it
    const d = near.find(canTake);
    if (d) { collect(d); P.pickCd = 0.12; }
    else if (near.length) hint(`背包的${TABS[ITEMS[near[0].id].cat]}欄滿了，按 I 整理背包`);
  }
  if (P.climb) return;
  const npc = nearNpc();
  if (pressed.has("space") && npc) { openNpc(npc); return; }
  // holding the attack key keeps attacking, like the original
  if (P.atkCd <= 0 && P.atkT <= 0) {
    const slot = [...Array(SKILL_SLOTS).keys()].findIndex(i => held.has(`skill${i + 1}`));
    if (held.has("attack")) basicAttack();
    else if (slot >= 0) useSkill(slotSkills()[slot], keyOf(`skill${slot + 1}`));
  }
  if (pressed.has("hpPot")) drink(potFor("hp"));
  if (pressed.has("mpPot")) drink(potFor("mp"));
}

const meleeBox = reach => P.face > 0
  ? { x: P.x + P.w - 6, y: P.y - 10, w: reach, h: 66 }
  : { x: P.x + 6 - reach, y: P.y - 10, w: reach, h: 66 };
function startAction(kind, t) { P.atkT = P.atkDur = t; P.atkKind = kind; P.atkCd = t; }
function revealFromShadow() { if (buffOn("t_shadow")) { P.buffs.t_shadow = 0; msg("從影子裡現身了", "#9fb0cd"); } }
function hint(text) { if (!P.hintT || P.hintT < time) { msg(text, "#9fb0cd"); P.hintT = time + 1.5; } }

const AMMO_NAMES = { bow: "箭矢", claw: "飛鏢" };
// bows and claws need something to shoot; false means the attack should not happen
function haveAmmo(n) {
  const wt = weapon().wtype;
  if (!AMMO_NAMES[wt] || ammoCount() >= n) return true;
  hint(ammoCount() ? `${AMMO_NAMES[wt]}不夠了` : `沒有${AMMO_NAMES[wt]}了，回浮島村找道具商莫莉買`);
  return false;
}
function basicAttack() {
  if (!weapon()) { hint("手上沒有武器，按 E 打開裝備、按 I 從背包穿上"); P.atkCd = 0.3; return; }
  const type = weapon().wtype;
  if (!P.prone && AMMO_NAMES[type] && !haveAmmo(1)) { P.atkCd = 0.3; return; }
  revealFromShadow();
  if (P.prone) {
    // lying down, every weapon does a short stab
    startAction("stab", STAB_T);
    const box = P.face > 0 ? { x: P.x + P.w, y: P.y + P.h - 30, w: 56, h: 30 } : { x: P.x - 56, y: P.y + P.h - 30, w: 56, h: 30 };
    targetsIn(box, 1).forEach(m => dealDamage(m));
    fx.push({ k: "stab", t: 0 });
  } else if (type === "bow" || type === "claw") {
    startAction("shoot", 0.5);
    sfx("shoot");
    useAmmo(1);
    fire(type === "bow" ? "arrow" : "star", {}, 0, 0.12);
  } else {
    startAction("slash", SLASH_T);
    sfx("swing");
    targetsIn(meleeBox(80), 1).forEach(m => dealDamage(m));
    fx.push({ k: "slash", t: 0 });
  }
}

function useSkill(s, key) {
  if (!s) { hint(P.job === "beginner" ? "新手還沒有技能，Lv.10 去找轉職教官薇拉" : `${key} 鍵還沒有技能`); return; }
  const l = skLv(s.id);
  if (!l) { hint(`還沒學會「${s.name}」，按 K 用 SP 學`); return; }
  if (s.weapon && weapon()?.wtype !== s.weapon) { hint(`「${s.name}」要拿著${WTYPES[s.weapon].name}才能用`); return; }
  if (P.cds[s.id] > 0) { hint(`「${s.name}」還要 ${Math.ceil(P.cds[s.id])} 秒才能再用`); return; }
  // bow and claw skills use one arrow or star per shot
  const ammo = AMMO_NAMES[s.weapon] ? (s.shots || 1) : 0;
  if (ammo && !haveAmmo(ammo)) return;
  const cost = buffOn("x_infinity") ? 0 : s.mp(l);
  if (P.mp < cost) { hint("MP 不夠了，按 2 喝藍藥水"); return; }
  P.mp -= cost; P.prone = false;
  if (ammo) useAmmo(ammo);
  // big skills need a rest before they can be used again
  if (s.cd) { P.cds[s.id] = P.cdMax[s.id] = s.cd(l); }
  if (s.type === "buff") {
    startAction("buff", 0.5);
    P.buffs[s.id] = s.dur(l);
    fx.push({ k: "buff", t: 0 });
    sfx("buff");
    msg(`${s.name}：${s.dur(l)} 秒`, "#cfe3ff");
    return;
  }
  revealFromShadow();
  const dmg = s.spell ? { magic: true, spell: s.spell(l) } : { pct: s.pct(l) };
  sfx(s.spell ? "magic" : "skill");
  const cx = P.x + P.w / 2;
  if (s.shot) {
    const spell = s.shot === "bolt" || s.shot === "fire";
    startAction(spell ? "cast" : "shoot", spell ? 0.55 : 0.6);
    for (let i = 0; i < (s.shots || 1); i++) fire(s.shot, { ...dmg, pierce: s.pierce || 1 }, i, 0.12 + i * 0.12);
  } else if (s.area) {
    // everything within the radius, on both sides
    startAction(s.spell ? "cast" : "spin", SKILL_T);
    targetsIn({ x: cx - s.area, y: P.y - 40, w: s.area * 2, h: 110 }, s.targets)
      .forEach(m => { for (let h = 0; h < (s.hits || 1); h++) dealDamage(m, { ...dmg, stack: h }); });
    fx.push({ k: s.fx || (s.spell ? "nova" : "quake"), rain: s.rain, tint: s.tint, x: cx, y: P.y + P.h, r: s.area, t: 0 });
    if (s.cd) cam.shake = 14;
    else if (!s.spell) cam.shake = 6;
  } else if (s.melee) {
    startAction(s.spell ? "cast" : "slash", SLASH_T);
    const hit = targetsIn(meleeBox(s.melee), s.targets || 1);
    hit.forEach(m => { for (let h = 0; h < (s.hits || 1); h++) dealDamage(m, { ...dmg, stack: h }); });
    if (s.spell) fx.push({ k: "zap", t: 0, pts: hit.map(m => [m.x + m.w / 2, m.y + m.h / 2]), x: cx, y: P.y + 10 });
    else fx.push({ k: "slash", t: 0, big: true });
  } else if (s.sweep) {
    startAction("spin", SKILL_T);
    targetsIn({ x: P.face > 0 ? cx - 40 : cx - 170, y: P.y - 22, w: 210, h: 84 }, 6).forEach(m => dealDamage(m, dmg));
    fx.push({ k: "spin", t: 0 });
  }
}

// arrows, throwing stars and magic fly straight; each one hits the first monster in its path,
// or the first few for a piercing shot
const shots = [];
const SHOT_SPEED = { bolt: 560, fire: 520, arrow: 760, star: 760 };
const SHOT_RANGE = { bolt: 320, fire: 360, arrow: 400, star: 340 };
function fire(kind, o, stack, delay) {
  shots.push({ kind, o: { ...o, stack }, wait: delay, launched: false, x: 0, y: 0, vx: 0, dist: 0, spin: 0, max: SHOT_RANGE[kind], hit: [] });
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    if (!s.launched) {
      if ((s.wait -= dt) > 0) continue;
      if (P.dead) { shots.splice(i, 1); continue; }
      s.launched = true; s.face = P.face;
      s.x = P.x + P.w / 2 + P.face * 16; s.y = P.y + 24;
      s.vx = P.face * SHOT_SPEED[s.kind];
    }
    const step = s.vx * dt;
    s.x += step; s.dist += Math.abs(step); s.spin += dt * 30;
    const m = mobs.find(m => hittable(m) && !s.hit.includes(m) && s.x >= m.x && s.x <= m.x + m.w && s.y >= m.y - 10 && s.y <= m.y + m.h + 6);
    if (m) {
      dealDamage(m, s.o);
      s.hit.push(m);
      if (s.kind === "bolt" || s.kind === "fire") fx.push({ k: "burst", x: s.x, y: s.y, t: 0, fire: s.kind === "fire" });
      if (s.hit.length >= (s.o.pierce || 1)) { shots.splice(i, 1); continue; }
    }
    if (s.dist > s.max || s.x < 0 || s.x > WORLD_W) shots.splice(i, 1);
  }
}

// a monster you can hit: not dead, faded in, and not hidden in the sand
const hittable = m => !m.dead && m.alpha > 0.5 && !m.under && !m.armored;

// what monsters throw at you: needles and lantern fire fly at you and hit like a monster would
const foes = [];
const FOE_SPEED = { needle: 330, wisp: 230 };
// lava falls straight down from the sky in the expedition and splashes on the ground
function throwAt(m, Th) {
  const sx = m.x + m.w / 2 + m.dir * m.w * 0.4, sy = m.y + m.h * 0.35;
  const tx = P.x + P.w / 2, ty = P.y + P.h / 2, sp = FOE_SPEED[Th.kind];
  const t = Math.max(0.2, Math.abs(tx - sx) / sp);
  foes.push({ kind: Th.kind, x: sx, y: sy, vx: Math.sign(tx - sx || m.dir) * sp, vy: clamp((ty - sy) / t, -260, 260), dmg: Th.dmg, acc: m.T.acc, left: Th.range + 120, t: 0 });
  m.throwT = 0.35;
}
function updateFoes(dt) {
  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i];
    f.x += f.vx * dt; f.y += f.vy * dt; f.t += dt; f.left -= Math.hypot(f.vx, f.vy) * dt;
    if (f.kind === "lava" && f.y >= 840) { fx.push({ k: "dust", x: f.x, y: 840, r: 50, t: 0, lava: true }); foes.splice(i, 1); continue; }
    if (!P.dead && P.inv <= 0 && f.x > P.x - 4 && f.x < P.x + P.w + 4 && f.y > P.y - 4 && f.y < P.y + P.h + 4) {
      hurt(f.dmg, f.x - f.vx, f.acc); foes.splice(i, 1); continue;
    }
    if (f.left <= 0 || f.x < 0 || f.x > WORLD_W) foes.splice(i, 1);
  }
}

function updateMobs(dt) {
  const pcx = P.x + P.w / 2;
  for (const m of mobs) {
    m.ph += dt;
    if (m.dead) {
      m.alpha = Math.max(0, m.alpha - dt * 2.5);
      m.deadT -= dt;
      if (m.deadT <= 0 && !m.minion) placeMob(m);
      continue;
    }
    if (m.alpha < 1) m.alpha = Math.min(1, m.alpha + dt * 2);
    m.flash = Math.max(0, m.flash - dt); m.showHp -= dt; m.aggro -= dt; m.throwT -= dt; m.surf -= dt;
    const T = m.T, mcx = m.x + m.w / 2;
    const dx = pcx - mcx, dy = (P.y + P.h) - (m.y + m.h);
    if (T.boss && !P.dead && P.ground === m.p && Math.abs(dx) < 360) m.aggro = Math.max(m.aggro, 3);

    // a boss below its rage line gets faster, slams more often and may start burrowing
    if (T.rage && !m.raged && m.hp < T.hp * T.rage.at) {
      m.raged = true; cam.shake = 12; sfx("slam");
      msg(`${T.name}發怒了！`, "#ff9b8f");
    }
    const spd = T.spd * (m.raged ? T.rage.spd : 1);
    const B = (m.raged && T.rage.burrow) || T.burrow;

    // burrowers spend a while hidden under the sand, closing in on you, then burst out
    if (B && m.wind <= 0) {
      m.bt -= dt;
      const close = Math.abs(dx) < 14 && m.bt < (m.under ? B.under - 0.5 : 0);
      if (m.bt <= 0 || (m.under && close)) {
        m.under = !m.under;
        m.bt = m.under ? B.under : B.up * rand(0.7, 1.3);
        m.kb = 0;
        if (!m.under) {
          m.surf = 0.4;
          fx.push({ k: "dust", x: mcx, y: m.p.y, r: m.w * 0.8, t: 0 });
          // bursting out right under you hurts; a boss comes up already winding up a slam
          if (!P.dead && P.ground === m.p && Math.abs(dx) < m.w / 2 + 16) { P.inv = 0; hurt(T.dmg * 1.2, mcx, T.acc); }
          if (T.slam && m.aggro > 0) { m.wind = 0.45; m.slamCd = T.slam.cd * (m.raged ? T.rage.cd : 1); }
        }
      }
    }
    // throwers spot you from a distance and keep it
    const Th = T.throw;
    if (Th && !P.dead && Math.abs(dx) < Th.range && Math.abs(dy) < 160) m.aggro = Math.max(m.aggro, 1);

    if (m.under) {
      if (!P.dead && Math.abs(dx) < 520 && Math.abs(dx) > 4) { m.dir = dx > 0 ? 1 : -1; m.x += m.dir * spd * 1.8 * dt; }
    } else if (m.kb) {
      m.x += m.kb * dt; m.kb *= Math.pow(0.002, dt);
      if (Math.abs(m.kb) < 6) m.kb = 0;
    } else if (m.wind > 0 || m.throwT > 0) {
      // winding up a slam or throwing: stand still
    } else if (m.aggro > 0 && !P.dead && Math.abs(dx) < 520) {
      m.dir = dx > 0 ? 1 : -1;
      // a thrower keeps its distance instead of walking into you
      if (Math.abs(dx) > (Th ? 170 : 10)) m.x += m.dir * spd * 1.5 * dt;
      m.state = "walk";
    } else {
      m.st -= dt;
      if (m.st <= 0) { m.st = rand(1, 3.5); m.state = Math.random() < 0.35 ? "idle" : "walk"; m.dir = Math.random() < 0.5 ? -1 : 1; }
      if (m.state === "walk") m.x += m.dir * spd * dt;
    }
    if (m.x < m.x0) { m.x = m.x0; m.dir = 1; }
    if (m.x > m.x1) { m.x = m.x1; m.dir = -1; }
    if (m.under) continue;

    if (Th && m.aggro > 0 && !P.dead) {
      m.tcd -= dt;
      if (m.tcd <= 0 && Math.abs(dx) < Th.range && Math.abs(dy) < 160) { m.dir = dx > 0 ? 1 : -1; throwAt(m, Th); m.tcd = Th.cd * rand(0.85, 1.15); }
    }
    // a boss calls its young to its side, a few at a time
    const Su = T.summon;
    if (Su && m.aggro > 0 && !P.dead) {
      m.scd -= dt;
      if (m.scd <= 0) {
        m.scd = Su.cd;
        const have = mobs.filter(o => o.minion && !o.dead && o.t === Su.t).length;
        for (let i = 0; i < Math.min(Su.n, Su.max - have); i++) spawnMob(Su.t, m.p, m.x0, m.x1 + m.w, mcx + (i % 2 ? 1 : -1) * (60 + i * 30));
        if (have < Su.max) { msg(`${T.name}召喚了${TYPES[Su.t].name}！`, "#ffb36b"); fx.push({ k: "dust", x: mcx, y: m.p.y, r: 120, t: 0 }); }
      }
    }

    // a boss winds up, then slams: anyone standing on its platform within range takes a hit that cannot be dodged
    const S = T.slam;
    if (S && m.aggro > 0 && !P.dead) {
      if (m.wind > 0) {
        m.wind -= dt;
        if (m.wind <= 0) {
          cam.shake = 14; sfx("slam");
          fx.push({ k: "ring", x: m.x + m.w / 2, y: m.p.y, t: 0 });
          if (P.onGround && P.ground === m.p && Math.abs(pcx - (m.x + m.w / 2)) < S.range) { P.inv = 0; hurt(S.dmg, m.x + m.w / 2); }
        }
      } else {
        m.slamCd -= dt;
        if (m.slamCd <= 0 && Math.abs(dx) < S.range + 120) { m.wind = S.wind; m.slamCd = S.cd * (m.raged ? T.rage.cd : 1); }
      }
    }
    if (!P.dead && P.inv <= 0 && m.alpha > 0.6 && overlap(P, m, 5)) hurt(T.dmg, m.x + m.w / 2, T.acc);
  }
  // summoned monsters leave for good once they have faded out
  for (let i = mobs.length - 1; i >= 0; i--) if (mobs[i].minion && mobs[i].dead && mobs[i].alpha <= 0) mobs.splice(i, 1);
}

function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.age += dt; d.ph += dt;
    if (!d.landed) {
      const prevY = d.y;
      d.vy += G * dt; d.x = clamp(d.x + d.vx * dt, 8, WORLD_W - 8); d.y += d.vy * dt;
      if (d.vy > 0) for (const p of plats) {
        if (d.x >= p.x && d.x <= p.x + p.w && prevY <= p.y && d.y >= p.y) { d.y = p.y; d.landed = true; break; }
      }
    }
    if (d.age > 180) drops.splice(i, 1);
  }
}

function update(dt) {
  time += dt;
  if (P.dead) {
    P.deadT += dt;
    if (P.deadT > 1 && ["revive", "jump", "space", "attack"].some(a => pressed.has(a))) revive();
  } else {
    updatePlayer(dt);
    playerActions(dt);
    P.regen += dt;
    if (P.regen >= 2.5) {
      P.regen = 0;
      // sitting on a chair heals three times as much, plus what the chair adds
      const k = P.sit ? 3 : 1, C = CHAIRS[P.sit]?.regen;
      P.hp = Math.min(maxHp(), P.hp + (2 + (P.lv >> 2) + passive("w_regen", "hpr")) * k + (C?.hp || 0));
      P.mp = Math.min(maxMp(), P.mp + (1 + (P.lv >> 3) + passive("m_medit", "mpr")) * k + (C?.mp || 0));
    }
    for (const id in P.buffs) {
      if (P.buffs[id] > 0 && (P.buffs[id] -= dt) <= 0) { P.buffs[id] = 0; msg(`「${SKILL_BY_ID[id].name}」的效果結束了`, "#9fb0cd"); }
    }
  }
  for (const id in P.cds) if (P.cds[id] > 0 && (P.cds[id] -= dt) <= 0) P.cds[id] = 0;
  P.atkT = Math.max(0, P.atkT - dt); P.atkCd -= dt; P.potCd -= dt; P.inv -= dt; P.drop -= dt;
  P.knock = Math.max(0, P.knock - dt);

  updateShots(dt);
  updateFoes(dt);
  raidTick(dt);
  jumpTick();
  checkTitles(dt);
  updateMobs(dt);
  updateDrops(dt);
  updatePet(dt);
  for (let i = nums.length - 1; i >= 0; i--) if ((nums[i].t += dt) > 1.1) nums.splice(i, 1);
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    const life = { slash: 0.25, stab: 0.2, spin: 0.5, ring: 0.7, lvup: 2.2, spark: 0.3, buff: 0.7, burst: 0.3, dust: 0.6, sky: 1, flood: 1.4, wave: 0.9, nova: 0.5, quake: 0.5, zap: 0.3, rain: 0.6 }[f.k];
    if (f.t > life) fx.splice(i, 1);
  }
  for (let i = msgs.length - 1; i >= 0; i--) if ((msgs[i].t -= dt) <= 0) msgs.splice(i, 1);
  for (const c of clouds) c.x += c.v * dt;

  const k = Math.min(1, dt * 6);
  cam.x += (clamp(P.x + P.w / 2 - W / 2, 0, WORLD_W - W) - cam.x) * k;
  cam.y += (clamp(P.y - H * 0.58, 0, WORLD_H - H) - cam.y) * k;
  cam.shake = Math.max(0, cam.shake - dt * 30);
  fade = Math.max(0, fade - dt * 2.5);

  refreshPanels();
  saveT += dt;
  if (saveT > 5) { saveT = 0; save(); }
}
