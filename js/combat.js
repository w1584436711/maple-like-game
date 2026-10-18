// Fighting, drops, levelling up, and the per-frame update of everything.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Combat ----------
function targetsIn(box, n) {
  const cx = P.x + P.w / 2;
  return mobs.filter(m => !m.dead && m.alpha > 0.5 && overlap(box, m))
    .sort((a, b) => Math.abs(a.x + a.w / 2 - cx) - Math.abs(b.x + b.w / 2 - cx))
    .slice(0, n);
}
// o: { pct } for physical hits, { magic: true, spell } for spells; stack lifts the number for multi-hits
function rollDamage(m, o) {
  const diff = Math.max(0, m.T.lv - P.lv);
  if (o.magic) {
    if (Math.random() < diff * 0.04) return null;
    const [mn, mx] = magicRange(o.spell);
    return { d: rand(mn, mx), crit: false };
  }
  // classic hit check: accuracy needed grows with the monster's avoid and its level lead
  const needAcc = (55 + 2 * diff) * m.T.avoid / 15;
  if (Math.random() > Math.min(1, accuracy() / needAcc)) return null;
  const [mn, mx] = physRange();
  const crit = Math.random() < critChance();
  return { d: rand(mn, mx) * (o.pct || 100) / 100 * (crit ? 1.5 : 1), crit };
}
function dealDamage(m, o = {}) {
  if (m.dead) return;
  const mcx = m.x + m.w / 2, ny = m.y - 8 - (o.stack || 0) * 28;
  m.aggro = 10; m.showHp = 4;
  const r = rollDamage(m, o);
  if (!r) { nums.push({ x: mcx, y: ny, text: "MISS", kind: "miss", t: 0 }); return; }
  const d = Math.max(1, Math.round(r.d));
  m.hp -= d; m.flash = 0.12;
  if (!m.T.boss) m.kb = (mcx > P.x + P.w / 2 ? 1 : -1) * 170;
  nums.push({ x: mcx, y: ny, text: String(d), kind: r.crit ? "crit" : "hit", t: 0 });
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
    if (Math.random() < chance) items.push(["item", randi(a, b), Array.isArray(id) ? id[randi(0, id.length - 1)] : id]);
  }
  // items pop up and land side by side in a row, centred on the monster
  items.forEach(([kind, value, id], i) => addDrop(kind, mcx + (i - (items.length - 1) / 2) * 24, my, value, id));
  if (items.length && !P.lootHint) { P.lootHint = true; msg("按 Z 撿起地上的東西", "#ffc94a"); }
  if (boss) { msg(`打倒了${m.T.name}！`, "#ffc94a"); cam.shake = 10; }
}
// kind "coin" carries an amount in value; kind "item" carries an item id and a count in value
function addDrop(kind, x, y, value, id) {
  drops.push({ kind, id, x: clamp(x, 8, WORLD_W - 8), y, value: Math.max(1, value), vx: 0, vy: -420, landed: false, age: 0, ph: rand(0, 6) });
}
const PICK_COLORS = { equip: "#ffd97a", use: "#9fd0ff", etc: "#cfe3ff" };
function collect(d) {
  if (d.kind === "coin") { P.coins += d.value; msg(`撿到金幣 ${d.value}`, "#ffd97a"); }
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
  msg(`等級提升！現在是 Lv.${P.lv}，按 S 分配 5 點能力值`, "#ffc94a");
  if (P.job === "beginner" && (P.lv === 8 || P.lv === 10)) msg("可以回浮島村找轉職教官薇拉轉職了", "#ffc94a");
  if (SECOND[P.job] && P.lv === 30) msg("可以回浮島村找轉職教官薇拉二轉了", "#ffc94a");
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
  if (!P.climb) {
    P.knock = 0.35; P.prone = false; P.atkT = 0;
    P.vx = (P.x + P.w / 2 < fromX ? -1 : 1) * KB_VX; P.vy = -KB_VY; P.onGround = false;
  }
  if (P.hp <= 0) {
    P.hp = 0; P.dead = true; P.deadT = 0; P.climb = null;
    const lost = Math.floor(P.exp * 0.1);
    P.exp -= lost;
    msg(lost ? `你倒下了…失去 ${lost} 點經驗值` : "你倒下了…", "#ff9b8f");
  }
}
function revive() {
  // like the original, you get back up in the nearest town
  P.dead = false;
  goToTown();
  P.hp = Math.ceil(maxHp() * 0.5); P.mp = Math.ceil(maxMp() * 0.5); P.inv = 2;
  msg("在浮島村重新站了起來", "#cfe3ff");
  save();
}

// ---------- Update ----------
function findLadder(test) { return ladders.find(test); }
// Space talks to a nearby NPC, otherwise it jumps
const jumpPressed = () => pressed.has("jump") || (pressed.has("space") && !nearNpc());

function updatePlayer(dt) {
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
    } else { P.vy = -JUMP; P.onGround = false; }
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
    const d = near.find(d => d.kind === "coin" || roomFor(d.id) > 0);
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
  if (pressed.has("hpPot")) drink("red_pot");
  if (pressed.has("mpPot")) drink("blue_pot");
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
    useAmmo(1);
    fire(type === "bow" ? "arrow" : "star", {}, 0, 0.12);
  } else {
    startAction("slash", SLASH_T);
    targetsIn(meleeBox(80), 1).forEach(m => dealDamage(m));
    fx.push({ k: "slash", t: 0 });
  }
}

function useSkill(s, key) {
  if (!s) { hint(P.job === "beginner" ? "新手還沒有技能，Lv.10 去找轉職教官薇拉" : `${key} 鍵還沒有技能`); return; }
  const l = skLv(s.id);
  if (!l) { hint(`還沒學會「${s.name}」，按 K 用 SP 學`); return; }
  if (s.weapon && weapon()?.wtype !== s.weapon) { hint(`「${s.name}」要拿著${WTYPES[s.weapon].name}才能用`); return; }
  // bow and claw skills use one arrow or star per shot
  const ammo = AMMO_NAMES[s.weapon] ? (s.shots || 1) : 0;
  if (ammo && !haveAmmo(ammo)) return;
  const cost = s.mp(l);
  if (P.mp < cost) { hint("MP 不夠了，按 2 喝藍藥水"); return; }
  P.mp -= cost; P.prone = false;
  if (ammo) useAmmo(ammo);
  if (s.type === "buff") {
    startAction("buff", 0.5);
    P.buffs[s.id] = s.dur(l);
    fx.push({ k: "buff", t: 0 });
    msg(`${s.name}：${s.dur(l)} 秒`, "#cfe3ff");
    return;
  }
  revealFromShadow();
  const dmg = s.spell ? { magic: true, spell: s.spell(l) } : { pct: s.pct(l) };
  const cx = P.x + P.w / 2;
  if (s.shot) {
    const spell = s.shot === "bolt" || s.shot === "fire";
    startAction(spell ? "cast" : "shoot", spell ? 0.55 : 0.6);
    for (let i = 0; i < (s.shots || 1); i++) fire(s.shot, { ...dmg, pierce: s.pierce || 1 }, i, 0.12 + i * 0.12);
  } else if (s.area) {
    // everything within the radius, on both sides
    startAction(s.spell ? "cast" : "spin", SKILL_T);
    targetsIn({ x: cx - s.area, y: P.y - 40, w: s.area * 2, h: 110 }, s.targets).forEach(m => dealDamage(m, dmg));
    fx.push({ k: s.spell ? "nova" : "quake", x: cx, y: P.y + P.h, r: s.area, t: 0 });
    if (!s.spell) cam.shake = 6;
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
    const m = mobs.find(m => !m.dead && m.alpha > 0.5 && !s.hit.includes(m) && s.x >= m.x && s.x <= m.x + m.w && s.y >= m.y - 10 && s.y <= m.y + m.h + 6);
    if (m) {
      dealDamage(m, s.o);
      s.hit.push(m);
      if (s.kind === "bolt" || s.kind === "fire") fx.push({ k: "burst", x: s.x, y: s.y, t: 0, fire: s.kind === "fire" });
      if (s.hit.length >= (s.o.pierce || 1)) { shots.splice(i, 1); continue; }
    }
    if (s.dist > s.max || s.x < 0 || s.x > WORLD_W) shots.splice(i, 1);
  }
}

function updateMobs(dt) {
  const pcx = P.x + P.w / 2;
  for (const m of mobs) {
    m.ph += dt;
    if (m.dead) {
      m.alpha = Math.max(0, m.alpha - dt * 2.5);
      m.deadT -= dt;
      if (m.deadT <= 0) placeMob(m);
      continue;
    }
    if (m.alpha < 1) m.alpha = Math.min(1, m.alpha + dt * 2);
    m.flash = Math.max(0, m.flash - dt); m.showHp -= dt; m.aggro -= dt;
    const mcx = m.x + m.w / 2;
    const dx = pcx - mcx;
    if (m.T.boss && !P.dead && P.ground === m.p && Math.abs(dx) < 360) m.aggro = Math.max(m.aggro, 3);

    if (m.kb) {
      m.x += m.kb * dt; m.kb *= Math.pow(0.002, dt);
      if (Math.abs(m.kb) < 6) m.kb = 0;
    } else if (m.wind > 0) {
      // boss winding up: stand still
    } else if (m.aggro > 0 && !P.dead && Math.abs(dx) < 520) {
      m.dir = dx > 0 ? 1 : -1;
      if (Math.abs(dx) > 10) m.x += m.dir * m.T.spd * 1.5 * dt;
      m.state = "walk";
    } else {
      m.st -= dt;
      if (m.st <= 0) { m.st = rand(1, 3.5); m.state = Math.random() < 0.35 ? "idle" : "walk"; m.dir = Math.random() < 0.5 ? -1 : 1; }
      if (m.state === "walk") m.x += m.dir * m.T.spd * dt;
    }
    if (m.x < m.x0) { m.x = m.x0; m.dir = 1; }
    if (m.x > m.x1) { m.x = m.x1; m.dir = -1; }

    // a boss winds up, then slams: anyone standing on its platform within range takes a hit that cannot be dodged
    const S = m.T.slam;
    if (S && m.aggro > 0 && !P.dead) {
      if (m.wind > 0) {
        m.wind -= dt;
        if (m.wind <= 0) {
          cam.shake = 14;
          fx.push({ k: "ring", x: m.x + m.w / 2, y: m.p.y, t: 0 });
          if (P.onGround && P.ground === m.p && Math.abs(pcx - (m.x + m.w / 2)) < S.range) { P.inv = 0; hurt(S.dmg, m.x + m.w / 2); }
        }
      } else {
        m.slamCd -= dt;
        if (m.slamCd <= 0 && Math.abs(dx) < S.range + 120) { m.wind = S.wind; m.slamCd = S.cd; }
      }
    }
    if (!P.dead && P.inv <= 0 && m.alpha > 0.6 && overlap(P, m, 5)) hurt(m.T.dmg, m.x + m.w / 2, m.T.acc);
  }
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
      P.hp = Math.min(maxHp(), P.hp + 2 + (P.lv >> 2) + passive("w_regen", "hpr"));
      P.mp = Math.min(maxMp(), P.mp + 1 + (P.lv >> 3) + passive("m_medit", "mpr"));
    }
    for (const id in P.buffs) {
      if (P.buffs[id] > 0 && (P.buffs[id] -= dt) <= 0) { P.buffs[id] = 0; msg(`「${SKILL_BY_ID[id].name}」的效果結束了`, "#9fb0cd"); }
    }
  }
  P.atkT = Math.max(0, P.atkT - dt); P.atkCd -= dt; P.potCd -= dt; P.inv -= dt; P.drop -= dt;
  P.knock = Math.max(0, P.knock - dt);

  updateShots(dt);
  updateMobs(dt);
  updateDrops(dt);
  for (let i = nums.length - 1; i >= 0; i--) if ((nums[i].t += dt) > 1.1) nums.splice(i, 1);
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    const life = { slash: 0.25, stab: 0.2, spin: 0.5, ring: 0.7, lvup: 2.2, spark: 0.3, buff: 0.7, burst: 0.3, nova: 0.5, quake: 0.5, zap: 0.3 }[f.k];
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
