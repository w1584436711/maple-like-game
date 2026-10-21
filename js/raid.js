// The expedition: entering the Molten Altar, the daily limit and time limit, and the molten colossus's
// arms, phases and screen-wide attacks.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Expedition ----------
// Classic expedition rules: a pass to get in, a few tries a day, a time limit, and a boss in parts.
const RAID = {
  map: "magma", lv: 75, pass: "magma_pass", perDay: 2, time: 600,
  // phases start below these shares of the body's health
  phases: [1, 2 / 3, 1 / 3],
  // seconds between lava drops and between the big warned attacks, per phase (index 0 unused)
  rain: [0, 0, 3, 2], big: [0, 0, 22, 15], warn: 3,
  flood: 2200, wave: 1800, lava: 700,
};
// the run in progress; null whenever you are not inside the altar
let raid = null;
const raidLeft = () => RAID.perDay - (P.raid.day === today() ? P.raid.used : 0);

// the expedition captain's door: level, today's tries and a pass
function enterRaid() {
  if (P.lv < RAID.lv) { say(`熔心祭壇太危險了，Lv.${RAID.lv} 以後再來吧。`, [["好", back]]); return; }
  if (raidLeft() <= 0) { say("今天的挑戰次數已經用完了。好好休息，明天再來吧。", [["好", back]]); return; }
  if (!countItem(RAID.pass)) { say(`要進祭壇，得先交一張${ITEMS[RAID.pass].name}。先幫我完成任務吧。`, [["好", back]]); return; }
  removeItem(RAID.pass, 1);
  P.raid = { day: today(), used: RAID.perDay - raidLeft() + 1 };
  closeDialog();
  loadMap(RAID.map);
  startRaid();
  sfx("portal");
  save();
}
function startRaid() {
  raid = { t: RAID.time, phase: 1, rainT: 4, bigT: RAID.big[2], warn: null, banner: null, done: false, flip: false };
  spawnArms(1);
  banner("熔心巨像醒了！先打斷兩隻手臂，才打得到本體", 4);
}
const raidBody = () => mobs.find(m => m.t === "colossus");
const raidArms = () => mobs.filter(m => m.t === "carm" && !m.dead);
function spawnArms(hpShare) {
  const b = raidBody();
  if (!b) return;
  for (const side of [-1, 1]) {
    const a = spawnMob("carm", b.p, 0, WORLD_W, b.x + b.w / 2 + side * 150);
    a.side = side; a.hp = Math.round(a.T.hp * hpShare); a.alpha = 1;
  }
}
function banner(text, t = 3) { raid.banner = { text, t }; }

function raidTick(dt) {
  if (!raid || !map.raid) return;
  const b = raidBody();
  if (raid.banner && (raid.banner.t -= dt) <= 0) raid.banner = null;
  if (raid.done) return;
  if (!b || b.dead) {
    raid.done = true; raid.warn = null;
    banner("遠征成功！撿完掉落物，從左邊的傳送門離開", 6);
    sfx("quest");
    return;
  }
  raid.t -= dt;
  if (raid.t <= 0) {
    // out of time: nothing is lost but the try
    goToTown();
    msg("時間到了……遠征失敗。今天還能再挑戰 " + raidLeft() + " 次", "#ff9b8f");
    return;
  }
  // the arms follow the body and always fight; the body is armoured while either arm is still up
  const arms = raidArms();
  for (const a of arms) { a.x = b.x + b.w / 2 + a.side * 150 - a.w / 2; a.aggro = 3; }
  b.aggro = 3;
  b.armored = arms.length > 0;

  const share = b.hp / b.T.hp;
  if (raid.phase === 1 && share <= RAID.phases[1]) {
    raid.phase = 2; raid.bigT = RAID.big[2];
    spawnArms(0.6);
    banner("第二階段：手臂長回來了，熔岩開始從天而降！", 4);
    cam.shake = 16; sfx("slam");
  } else if (raid.phase === 2 && share <= RAID.phases[2]) {
    raid.phase = 3; raid.bigT = RAID.big[3];
    banner("第三階段：巨像的核心燒得通紅，攻擊越來越猛烈！", 4);
    cam.shake = 16; sfx("slam");
  }
  if (raid.phase < 2) return;

  // lava falling from the sky; in the last phase some of it aims at you
  raid.rainT -= dt;
  if (raid.rainT <= 0) {
    raid.rainT = RAID.rain[raid.phase];
    for (let i = 0; i < (raid.phase === 3 ? 5 : 3); i++) {
      const x = raid.phase === 3 && i === 0 ? P.x + P.w / 2 + rand(-60, 60) : rand(40, WORLD_W - 40);
      foes.push({ kind: "lava", x, y: cam.y - 20 - i * 60, vx: 0, vy: 360, dmg: RAID.lava, acc: null, left: 2000, t: 0 });
    }
  }
  // the big attacks come with a warning across the whole screen
  if (raid.warn) {
    raid.warn.t -= dt;
    if (raid.warn.t <= 0) {
      const kind = raid.warn.kind;
      raid.warn = null; cam.shake = 18; sfx("slam");
      if (kind === "flood") {
        fx.push({ k: "flood", t: 0 });
        if (!P.dead && P.onGround && P.ground === plats[0]) { P.inv = 0; hurt(RAID.flood, P.x + P.w / 2 + 1); }
      } else {
        fx.push({ k: "wave", x: b.x + b.w / 2, y: 840, t: 0 });
        if (!P.dead && P.onGround) { P.inv = 0; hurt(RAID.wave, b.x + b.w / 2); }
      }
    }
  } else if ((raid.bigT -= dt) <= 0) {
    raid.bigT = RAID.big[raid.phase];
    // the third phase alternates the flood with a shock wave you have to jump over
    const kind = raid.phase === 3 && (raid.flip = !raid.flip) ? "wave" : "flood";
    raid.warn = { kind, t: RAID.warn };
  }
}
