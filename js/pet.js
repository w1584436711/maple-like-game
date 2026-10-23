// Pets: what each one is, how it follows you, picks things up, gets hungry and grows closer to you.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Pets ----------
// Every pet is bought from the pet keeper. look sets the colours draw.js uses; lines are what it says
// now and then once it is close enough to you.
const PETS = {
  bun:    { name: "毛球兔", price: 3000, look: { body: "#f6f2ec", ear: "#f3a9bd", eye: "#3a2a4a" },
            lines: ["蹦蹦！", "主人，前面有東西！", "今天也要一起冒險喔", "耳朵好癢……"] },
  chick:  { name: "圓圓雞", price: 3000, look: { body: "#ffd84a", ear: "#ff9a3a", eye: "#3a2a1a" },
            lines: ["啾啾！", "想吃飼料……", "我會幫你撿金幣的！", "嘰——"] },
  tanuki: { name: "甜甜狸", price: 3000, look: { body: "#c98a4a", ear: "#5a3a24", eye: "#2a1a10" },
            lines: ["嘿嘿，金幣亮晶晶", "肚子圓滾滾～", "主人好厲害！", "要不要休息一下？"] },
};
for (const [id, p] of Object.entries(PETS)) p.id = id;
// closeness needed for each pet level; the level widens the pickup range and unlocks talking (2) and tricks (3)
const PET_LV = [0, 15, 40, 80, 140];
const PET_FULL_MAX = 100, PET_HUNGRY = 20, PET_FOOD_FULL = 30;
const petLv = c => PET_LV.filter(n => c >= n).length;
const petRange = lv => 160 + 40 * (lv - 1);
const petData = () => P.petOn && P.pets[P.petOn] ? P.pets[P.petOn] : null;

// the pet's body in the world; it is not saved, it just reappears next to you on every map
const pet = { x: 0, y: 0, w: 18, h: 18, vx: 0, vy: 0, onGround: false, face: 1, anim: 0, map: null,
              target: null, chase: 0, far: 0, drop: 0, dropPlat: null, sayText: "", sayT: 0, talkT: 8, trickT: 0, hungerT: 0, closeT: 0, toldHungry: false };
function placePet() {
  pet.x = P.x - P.face * 30; pet.y = P.y + P.h - pet.h; pet.vx = pet.vy = 0;
  pet.onGround = false; pet.map = P.map; pet.target = null; pet.far = 0;
}
function petSay(text, t = 2.6) { pet.sayText = text; pet.sayT = t; }

function cleanPets(d) {
  const out = {};
  for (const id in PETS) {
    const p = d?.[id];
    if (p) out[id] = { full: clamp(Number(p.full) || 0, 0, PET_FULL_MAX) | 0, close: Math.max(0, Number(p.close) | 0) };
  }
  return out;
}

function buyPet(id) {
  const D = PETS[id];
  if (P.pets[id]) return;
  if (P.coins < D.price) { say(`${D.name}要 ${D.price} 金幣，你的金幣不夠喔。`, [["好吧", back]]); return; }
  P.coins -= D.price;
  P.pets[id] = { full: PET_FULL_MAX, close: 0 };
  // a little food to start with, so the first hungry moment is not a trip back to town
  const extra = addItem("pet_food", 5);
  summonPet(id);
  sfx("quest");
  say(`${D.name}會跟著你一起冒險，自動撿起附近的金幣和道具。牠會肚子餓，記得在背包對寵物飼料點兩下餵牠。${extra ? "" : "\n（送你 5 個寵物飼料，已經放進背包了）"}`, [["謝謝", closeDialog]]);
  save();
}
function summonPet(id) {
  P.petOn = id;
  placePet();
  pet.toldHungry = false;
  fx.push({ k: "spark", x: pet.x + pet.w / 2, y: pet.y + 6, t: 0 });
  msg(`${PETS[id].name}出來了`, "#ffd0e0");
}
function restPet() {
  if (!P.petOn) return;
  msg(`${PETS[P.petOn].name}回去休息了`, "#9fb0cd");
  P.petOn = null;
}
// double-clicking pet food in the bag feeds the pet that is out
function feedPet(i) {
  const d = petData();
  if (!d) { hint("要先讓寵物出來，才能餵牠"); return; }
  const name = PETS[P.petOn].name;
  if (d.full >= PET_FULL_MAX) { petSay("吃不下了……"); hint(`${name}已經吃飽了`); return; }
  takeFromSlot("use", i);
  // feeding a pet that is actually hungry is what makes it like you more
  const before = petLv(d.close);
  if (d.full < PET_FULL_MAX - PET_FOOD_FULL) d.close += 3;
  d.full = Math.min(PET_FULL_MAX, d.full + PET_FOOD_FULL);
  pet.toldHungry = false;
  sfx("potion");
  petSay("好好吃！", 1.6);
  msg(`餵了${name}，飽足度 ${d.full}`, "#ffd0e0");
  petGrew(before, d);
  save();
}
function petGrew(before, d) {
  const lv = petLv(d.close);
  if (lv <= before) return;
  sfx("levelup");
  fx.push({ k: "spark", x: pet.x + pet.w / 2, y: pet.y, t: 0 });
  const what = { 2: "，偶爾會跟你說話", 3: "，學會翻跟斗了" }[lv] || "";
  msg(`${PETS[P.petOn].name}的親密度提升到 Lv.${lv}，撿東西的範圍變大了${what}`, "#ffd0e0");
}

// things on the ground the pet will fetch: coins always, items when the setting allows and the bag has room
function petWants(d, range) {
  if (!d.landed || d.petSkip) return false;
  if (Math.abs(d.x - (P.x + P.w / 2)) > range || Math.abs(d.y - (P.y + P.h)) > 130) return false;
  return d.kind === "coin" || (settings.petItems && canTake(d));
}

function updatePet(dt) {
  const d = petData();
  if (!d) return;
  if (pet.map !== P.map) placePet();
  const lv = petLv(d.close), hungry = d.full < PET_HUNGRY;
  // a point of fullness every 30 seconds out, a point of closeness every 2 minutes while it is fed
  pet.hungerT += dt;
  if (pet.hungerT >= 30) {
    pet.hungerT = 0; d.full = Math.max(0, d.full - 1);
    if (d.full < PET_HUNGRY && !pet.toldHungry) {
      pet.toldHungry = true;
      msg(`${PETS[P.petOn].name}肚子餓了，不幫你撿東西了。在背包對寵物飼料點兩下餵牠`, "#ffb0c0");
    }
  }
  if (!hungry) {
    pet.closeT += dt;
    if (pet.closeT >= 120) { pet.closeT = 0; const before = lv; d.close++; petGrew(before, d); }
  }
  pet.sayT -= dt; pet.trickT = Math.max(0, pet.trickT - dt); pet.drop -= dt;

  // pick a target: the nearest thing to fetch, otherwise a spot just behind you
  const pcx = P.x + P.w / 2, feet = P.y + P.h;
  if (pet.target && (!drops.includes(pet.target) || hungry)) pet.target = null;
  if (!pet.target && !hungry && !P.dead) {
    const range = petRange(lv);
    pet.target = drops.filter(o => petWants(o, range)).sort((a, b) => Math.abs(a.x - pet.x) - Math.abs(b.x - pet.x))[0] || null;
    pet.chase = 0;
  }
  const t = pet.target;
  const tx = t ? t.x : pcx - P.face * 34, ty = t ? t.y : feet;
  if (t) {
    pet.chase += dt;
    // something it cannot reach is skipped after a while, so the pet does not run in place forever
    if (pet.chase > 4) { t.petSkip = true; pet.target = null; }
  }

  const cx = pet.x + pet.w / 2, dx = tx - cx, bottom = pet.y + pet.h;
  const dist = Math.hypot(pcx - cx, feet - bottom);
  // too far behind (a rope, a long fall, a portal it missed): it pops up next to you
  pet.far = dist > 360 ? pet.far + dt : 0;
  if (pet.far > 2) { placePet(); fx.push({ k: "spark", x: pet.x + pet.w / 2, y: pet.y + 6, t: 0 }); return; }

  const speed = dist > 160 ? 230 : t ? 190 : 150;
  const want = Math.abs(dx) > (t ? 4 : 10) ? Math.sign(dx) * speed : 0;
  pet.vx += (want - pet.vx) * (1 - Math.exp(-dt / 0.06));
  if (Math.abs(pet.vx) > 8) { pet.face = Math.sign(pet.vx); pet.anim += dt; }
  else if (!t) pet.face = pcx < cx ? -1 : 1;
  if (pet.onGround) {
    // up to a higher platform with a hop, down through a floating one when the target is below
    if (ty < bottom - 30 && Math.abs(dx) < 140) { pet.vy = -600; pet.onGround = false; }
    else if (ty > bottom + 30 && Math.abs(dx) < 70 && !pet.ground?.ground) { pet.drop = 0.3; pet.dropPlat = pet.ground; pet.onGround = false; pet.vy = -120; }
  }
  pet.vy = Math.min(pet.vy + G * dt, FALL_MAX);
  const prevBottom = bottom;
  pet.x = clamp(pet.x + pet.vx * dt, 0, WORLD_W - pet.w);
  pet.y += pet.vy * dt;
  pet.onGround = false;
  if (pet.vy >= 0) {
    let best = null;
    for (const p of plats) {
      if (pet.drop > 0 && p === pet.dropPlat) continue;
      if (pet.x + pet.w > p.x + 2 && pet.x < p.x + p.w - 2 && prevBottom <= p.y + 1 && pet.y + pet.h >= p.y && (!best || p.y < best.y)) best = p;
    }
    if (best) { pet.y = best.y - pet.h; pet.vy = 0; pet.onGround = true; pet.ground = best; }
  }

  if (t && Math.abs(t.x - (pet.x + pet.w / 2)) < 14 && Math.abs(t.y - (pet.y + pet.h)) < 26) {
    collect(t);
    pet.target = null;
  }
  // idle chatter and tricks once it is close enough to you
  if (!t && Math.abs(pet.vx) < 8 && pet.onGround) {
    pet.talkT -= dt;
    if (pet.talkT <= 0) {
      pet.talkT = rand(12, 20);
      if (hungry) petSay("肚子好餓……");
      else if (lv >= 3 && Math.random() < 0.5) { pet.trickT = 0.7; pet.vy = -420; pet.onGround = false; }
      else if (lv >= 2) petSay(PETS[P.petOn].lines[randi(0, PETS[P.petOn].lines.length - 1)]);
    }
  }
}

// the pet keeper's menu: buy a pet, call one out or send it to rest, and the food shop
function luluTalk(opts) {
  const own = Object.keys(P.pets);
  for (const id of Object.keys(PETS)) {
    const D = PETS[id];
    if (!P.pets[id]) opts.push([`買下${D.name}（${D.price.toLocaleString()} 金幣）`, () => buyPet(id)]);
    else if (P.petOn !== id) opts.push([`讓${D.name}出來`, () => { summonPet(id); closeDialog(); save(); }]);
  }
  if (P.petOn) opts.push([`讓${PETS[P.petOn].name}休息`, () => { restPet(); closeDialog(); save(); }]);
  const d = petData();
  const status = d ? `\n\n${PETS[P.petOn].name}：親密度 Lv.${petLv(d.close)}（${d.close}），飽足度 ${d.full} / ${PET_FULL_MAX}` : "";
  say((own.length ? "寵物們今天也很有精神呢！" : "想要一個冒險的好夥伴嗎？寵物會跟著你走，幫你把掉在附近的金幣和道具撿起來。") + status,
      [...opts, ["再見", closeDialog]]);
}
