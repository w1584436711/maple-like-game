// Maps, monster types, building a map and walking through portals.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Maps ----------
// Each map lists its platforms (the ground is added for you), ropes, monster zones and portals.
// Steps 60 px apart can be jumped (jump is ~77 px); taller gaps use ropes. A platform's y is its top.
// A portal stands on the platform at its y (ground if left out) and leads to portal number tp of map `to`.
// zones: p is the platform index (0 = ground), x0/x1 narrow a zone on the ground.
const THEMES = {
  meadow: { sky: ["#6fb9ea", "#b5e1f6", "#e4f6ee"], far: "#a6cde2", near: "#93caa0", tree: "oak",
            grass: ["#79d35f", "#4fae3f", "#3f9a36"], dirt: ["#a06a46", "#6a4229", "#7a4e33"], tuft: ["#3f9a36", "#5dbb4a"] },
  shore:  { sky: ["#5fb3e8", "#a9dcf5", "#f6f0d8"], far: "#4aa3d6", near: "#ead8a6", tree: "palm", sea: true,
            grass: ["#f6e7b8", "#dcc48c", "#c9ad70"], dirt: ["#d1ad78", "#9a7650", "#b08a5c"], tuft: ["#7f9e42", "#a3c25c"] },
  ruins:  { sky: ["#7f78c4", "#d9a2b6", "#f6d6ae"], far: "#9b8fb8", near: "#7d968a", tree: "pillar",
            grass: ["#86b86a", "#5a8f48", "#4a7a3a"], dirt: ["#9a9088", "#5f5650", "#7a706a"], tuft: ["#4a7a3a", "#6a9f52"] },
};
const MAPS = {
  village: {
    name: "浮島村", area: "浮島", town: true, w: 1400, spawn: 96, theme: THEMES.meadow,
    plats: [{ x: 840, y: 780, w: 180 }, { x: 1040, y: 720, w: 200 }],
    ladders: [], trees: [250, 760, 1240], zones: [],
    portals: [{ x: 1350, to: "meadow", tp: 0 }],
  },
  meadow: {
    name: "青草平原", area: "浮島", w: 2400, spawn: 60, theme: THEMES.meadow,
    plats: [
      { x: 280, y: 780, w: 300 }, { x: 480, y: 720, w: 320 }, { x: 700, y: 600, w: 420 }, { x: 1250, y: 780, w: 420 },
      { x: 1380, y: 560, w: 420 }, { x: 1900, y: 780, w: 300 }, { x: 2120, y: 720, w: 250 }, { x: 900, y: 420, w: 380 },
      { x: 180, y: 540, w: 300 },
    ],
    ladders: [
      { x: 240, top: 540, bottom: 840 }, { x: 760, top: 600, bottom: 720 }, { x: 1080, top: 600, bottom: 840 },
      { x: 1000, top: 420, bottom: 600 }, { x: 1450, top: 560, bottom: 780 }, { x: 1720, top: 560, bottom: 840 },
    ],
    trees: [240, 700, 1180, 1560, 2050],
    zones: [
      { p: 0, x0: 300, x1: 1200, t: "jelly", n: 5 }, { p: 0, x0: 1250, x1: 2250, t: "bjelly", n: 4 },
      { p: 1, t: "jelly", n: 2 }, { p: 2, t: "jelly", n: 2 }, { p: 3, t: "bjelly", n: 3 }, { p: 4, t: "bjelly", n: 3 },
      { p: 5, t: "bjelly", n: 3 }, { p: 6, t: "bjelly", n: 2 }, { p: 7, t: "bjelly", n: 2 }, { p: 8, t: "jelly", n: 3 },
      { p: 9, t: "jelly", n: 3 },
    ],
    portals: [{ x: 60, to: "village", tp: 0 }, { x: 2350, to: "shore", tp: 0 }],
  },
  shore: {
    name: "刺殼海岸", area: "浮島", w: 2400, spawn: 60, theme: THEMES.shore,
    plats: [
      { x: 300, y: 780, w: 320 }, { x: 560, y: 720, w: 300 }, { x: 800, y: 580, w: 460 }, { x: 1350, y: 780, w: 380 },
      { x: 1500, y: 640, w: 400 }, { x: 1900, y: 780, w: 300 }, { x: 2050, y: 720, w: 330 }, { x: 1050, y: 440, w: 400 },
      { x: 1950, y: 500, w: 420 },
    ],
    ladders: [
      { x: 840, top: 580, bottom: 720 }, { x: 1180, top: 580, bottom: 840 }, { x: 1120, top: 440, bottom: 580 },
      { x: 1560, top: 640, bottom: 780 }, { x: 2100, top: 500, bottom: 720 },
    ],
    trees: [200, 900, 1700, 2250],
    zones: [
      { p: 0, x0: 300, x1: 1300, t: "shell", n: 3 }, { p: 0, x0: 1400, x1: 2300, t: "shell", n: 3 },
      { p: 1, t: "bjelly", n: 2 }, { p: 2, t: "shell", n: 2 }, { p: 3, t: "shell", n: 3 }, { p: 4, t: "shell", n: 2 },
      { p: 5, t: "shell", n: 3 }, { p: 6, t: "bjelly", n: 2 }, { p: 7, t: "shell", n: 2 }, { p: 8, t: "shell", n: 3 },
      { p: 9, t: "shell", n: 2 },
    ],
    portals: [{ x: 60, to: "meadow", tp: 1 }, { x: 2320, y: 500, to: "ruins", tp: 0 }],
  },
  ruins: {
    name: "苔岩遺跡", area: "浮島", w: 1800, spawn: 60, theme: THEMES.ruins,
    plats: [
      { x: 250, y: 780, w: 300 }, { x: 450, y: 720, w: 300 }, { x: 650, y: 660, w: 340 }, { x: 700, y: 440, w: 820 },
      { x: 1250, y: 780, w: 400 },
    ],
    ladders: [{ x: 900, top: 440, bottom: 660 }, { x: 1450, top: 440, bottom: 780 }],
    trees: [300, 1100, 1650],
    zones: [
      { p: 0, x0: 300, x1: 1700, t: "shell", n: 3 }, { p: 1, t: "shell", n: 2 }, { p: 2, t: "shell", n: 2 },
      { p: 4, t: "boss", n: 1 }, { p: 5, t: "shell", n: 2 },
    ],
    portals: [{ x: 60, to: "shore", tp: 1 }],
  },
};
// the order the world map lists them in, from the village outward
const MAP_ORDER = ["village", "meadow", "shore", "ruins"];
let map = MAPS.village, plats = [], ladders = [], trees = [], portals = [];
const platAt = (x, y) => plats.find(p => Math.abs(p.y - y) < 1.5 && x >= p.x && x <= p.x + p.w) || plats[0];
const clouds = Array.from({ length: 9 }, (_, i) => ({ x: i * 150 + rand(0, 80), y: rand(40, 210), s: rand(0.7, 1.4), v: rand(4, 12) }));

// ---------- Monsters ----------
// drops: [item id (or a list to pick one from), chance, min count, max count]
const TYPES = {
  jelly:  { name: "青果凍", lv: 1,  hp: 18,   exp: 6,   dmg: 6,  spd: 40, avoid: 1, acc: 10, w: 34,  h: 28,  coin: [3, 8],
            drops: [["green_gel", 0.5], ["red_pot", 0.15], ["blue_pot", 0.08], ["town_scroll", 0.02], ["leaf_band", 0.03], ["work_gloves", 0.03],
                    ["arrow", 0.06, 15, 30], ["iron_star", 0.04, 20, 40]] },
  bjelly: { name: "藍果凍", lv: 4,  hp: 55,   exp: 14,  dmg: 12, spd: 50, avoid: 2, acc: 20, w: 38,  h: 32,  coin: [8, 18],
            drops: [["blue_gel", 0.5], ["red_pot", 0.18], ["blue_pot", 0.12], ["town_scroll", 0.03], ["jelly_tunic", 0.03], ["canvas_pants", 0.03],
                    ["travel_cape", 0.02], ["arrow", 0.08, 20, 40], ["iron_star", 0.06, 30, 60]] },
  shell:  { name: "刺殼龜", lv: 8,  hp: 160,  exp: 32,  dmg: 20, spd: 35, avoid: 3, acc: 35, w: 48,  h: 34,  coin: [15, 35],
            drops: [["shell_shard", 0.55], ["red_pot", 0.2], ["blue_pot", 0.12], ["town_scroll", 0.04], ["leather_cap", 0.03], ["wind_boots", 0.03],
                    ["hunter_gloves", 0.03], ["wood_shield", 0.03], ["arrow", 0.1, 30, 60], ["iron_star", 0.08, 40, 80]] },
  boss:   { name: "苔岩巨像", lv: 15, hp: 2400, exp: 600, dmg: 34, spd: 25, avoid: 6, acc: 60, w: 100, h: 120, coin: [300, 500], respawn: 45,
            drops: [["moss_core", 1], ["red_pot", 1, 5], ["blue_pot", 1, 5], ["town_scroll", 1, 2], [["jade_blade", "vine_staff", "hawk_bow", "dark_claw"], 1],
                    ["moss_cape", 0.5], ["shell_shield", 0.3], ["arrow", 1, 100, 200], ["steel_star", 0.5, 100, 200]] },
};
const mobs = [];
function placeMob(m) {
  m.x = rand(m.x0, m.x1);
  m.y = m.p.y - m.h;
  m.hp = m.T.hp; m.dead = false; m.alpha = 0; m.kb = 0; m.aggro = 0; m.showHp = 0; m.wind = 0; m.slamCd = 3;
  m.dir = Math.random() < 0.5 ? -1 : 1;
}
// monster names and levels on a map, for the world map
const mapMobs = id => [...new Set(MAPS[id].zones.map(z => z.t))].map(t => `${TYPES[t].name} Lv.${TYPES[t].lv}`);

// builds a map and puts the player at x on the platform whose top is y (the ground when left out)
let fade = 0;
function loadMap(id, x = MAPS[id].spawn, y = 840) {
  map = MAPS[id]; P.map = id;
  WORLD_W = map.w;
  plats = [{ x: 0, y: 840, w: WORLD_W, ground: true }, ...map.plats.map(p => ({ ...p }))];
  // decoration seeds per platform
  plats.forEach((p, i) => {
    p.tufts = [];
    let s = i * 977 + 13 + map.w;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let tx = p.x + 10; tx < p.x + p.w - 10; tx += 26 + rnd() * 40) p.tufts.push({ x: tx, k: rnd() });
    p.stones = [];
    for (let sx = p.x + 14; sx < p.x + p.w - 14; sx += 40 + rnd() * 70) p.stones.push({ x: sx, y: rnd(), r: 3 + rnd() * 5 });
  });
  ladders = map.ladders;
  trees = map.trees.map((tx, i) => ({ x: tx, h: 130 + (i % 3) * 30, c: i % 2 }));
  portals = map.portals.map(pt => ({ ...pt, y: pt.y ?? 840 }));
  mobs.length = 0;
  map.zones.forEach(z => {
    const p = plats[z.p], T = TYPES[z.t];
    const x0 = z.x0 ?? p.x + 4, x1 = (z.x1 ?? p.x + p.w - 4) - T.w;
    for (let i = 0; i < z.n; i++) {
      const m = { t: z.t, T, p, x0, x1, w: T.w, h: T.h, st: rand(0, 2), state: "idle", ph: rand(0, 6), flash: 0, deadT: 0 };
      placeMob(m);
      m.alpha = 1;
      mobs.push(m);
    }
  });
  drops.length = 0; shots.length = 0; skyGrad = null;
  Object.assign(P, { x: x - P.w / 2, y: y - P.h, vx: 0, vy: 0, climb: null, onGround: true, prone: false, knock: 0 });
  P.ground = platAt(x, y);
  cam.x = clamp(P.x + P.w / 2 - W / 2, 0, WORLD_W - W);
  cam.y = clamp(P.y - H * 0.58, 0, WORLD_H - H);
  fade = 1;
}
const portalAt = () => portals.find(pt => Math.abs(P.x + P.w / 2 - pt.x) < 24 && Math.abs(P.y + P.h - pt.y) < 4);
function usePortal(pt) {
  const to = MAPS[pt.to], dest = to.portals[pt.tp];
  loadMap(pt.to, dest.x, dest.y ?? 840);
  msg(`來到了${to.name}`, "#cfe3ff");
  refreshPanels(true); save();
}
function goToTown() {
  loadMap("village");
  refreshPanels(true);
}
