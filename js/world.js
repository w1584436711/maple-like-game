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
  forest: { sky: ["#2f4a5a", "#6a8a8a", "#b9cbb6"], far: "#4f6f6a", near: "#3f5f4a", tree: "pine", mist: true,
            grass: ["#5f9a52", "#3a6f3a", "#2a552a"], dirt: ["#5f4f42", "#3a3028", "#4a3e34"], tuft: ["#2f5f2f", "#4a7f42"] },
  cloud:  { sky: ["#7ab8f0", "#c8e4fa", "#fff4e6"], far: "#ffffff", near: "#e6eefa", tree: "spire", cloudsea: true,
            grass: ["#ffffff", "#dde6f2", "#c4cfe0"], dirt: ["#cfd8e6", "#9aa8bc", "#b4c0d2"], tuft: ["#a8d0f0", "#c8e4fa"] },
  storm:  { sky: ["#2e3350", "#5a5f80", "#9a90b0"], far: "#40455f", near: "#4f5470", tree: "pillar", storm: true,
            grass: ["#8a9ab0", "#5a6a80", "#4a5a70"], dirt: ["#6a6f88", "#3a3f55", "#50556a"], tuft: ["#7a8aa0", "#9aaac0"] },
  shadow: { sky: ["#1a1428", "#3a2a50", "#6a5080"], far: "#2a2040", near: "#352a4a", tree: "pillar", mist: true,
            grass: ["#6a5a8a", "#45386a", "#352a55"], dirt: ["#4a4060", "#2a2238", "#3a3050"], tuft: ["#5a4a7a", "#7a6a9a"] },
  reef:   { sky: ["#3f86c0", "#86c4e6", "#d6eef0"], far: "#2f7fb8", near: "#6f98a0", tree: "palm", sea: true,
            grass: ["#c9d8c8", "#9ab0a8", "#7f968e"], dirt: ["#8a9a9a", "#55666a", "#6f7f80"], tuft: ["#3f8a6a", "#5fb08a"] },
  // the desert continent: dunes in the sun, a tomb lit only around you (dark), a temple at sunset
  desert: { sky: ["#f0a860", "#f6d08a", "#fbeccc"], far: "#e0b07a", near: "#d9a464", tree: "cactus",
            grass: ["#f2d79a", "#dcb66e", "#c9a058"], dirt: ["#c9955a", "#8a5f34", "#a8784a"], tuft: ["#9aa850", "#b8c068"] },
  tomb:   { sky: ["#140f1c", "#2a2030", "#3a2e38"], far: "#2a2228", near: "#352a2e", tree: "pillar", dark: true,
            grass: ["#9a8a6a", "#6a5c48", "#4a4034"], dirt: ["#5a4a3a", "#30261c", "#40342a"], tuft: ["#5a5040", "#6a6050"] },
  temple: { sky: ["#c8703a", "#eca866", "#f8dcae"], far: "#c88a5a", near: "#b87a4a", tree: "pillar",
            grass: ["#ecd29a", "#c9a46a", "#a8844e"], dirt: ["#b08050", "#6a4a2a", "#8a6038"], tuft: ["#a89050", "#c0a868"] },
  // the expedition's altar: a sea of lava in the background, glowing cracks in the rock
  lava:   { sky: ["#1a0a08", "#4a1a10", "#8a3a1a"], far: "#ff6a2a", near: "#2a1410", tree: "pillar", lava: true,
            grass: ["#6a5450", "#3a2e2c", "#2a2220"], dirt: ["#4a3430", "#241a18", "#33251f"], tuft: ["#ff6a2a", "#ffaa3a"] },
};
const MAPS = {
  village: {
    name: "浮島村", area: "浮島", town: true, scene: "village", note: "城鎮．轉職教官、商店、倉庫、工匠、往雲頂城的飛船", w: 1400, spawn: 96, dock: 1180, theme: THEMES.meadow,
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
    portals: [{ x: 60, to: "meadow", tp: 1 }, { x: 2320, y: 500, to: "ruins", tp: 0 }, { x: 2350, to: "reef", tp: 0 }],
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
    portals: [{ x: 60, to: "shore", tp: 1 }, { x: 1750, to: "forest", tp: 0 }],
  },
  reef: {
    name: "潮汐礁岩", area: "浮島", w: 1600, spawn: 60, theme: THEMES.reef,
    plats: [{ x: 250, y: 780, w: 240 }, { x: 540, y: 720, w: 260 }, { x: 880, y: 780, w: 240 }, { x: 1180, y: 720, w: 260 }],
    ladders: [], trees: [180, 760, 1450],
    zones: [{ p: 0, x0: 500, x1: 1560, t: "crab", n: 1 }, { p: 2, t: "shell", n: 2 }, { p: 4, t: "shell", n: 2 }],
    portals: [{ x: 60, to: "shore", tp: 2 }],
  },
  forest: {
    name: "霧影森林", area: "浮島", w: 2600, spawn: 60, theme: THEMES.forest,
    plats: [
      { x: 300, y: 780, w: 320 }, { x: 560, y: 720, w: 300 }, { x: 800, y: 580, w: 460 }, { x: 1350, y: 780, w: 380 },
      { x: 1500, y: 640, w: 400 }, { x: 1900, y: 780, w: 300 }, { x: 2050, y: 720, w: 330 }, { x: 1050, y: 440, w: 400 },
      { x: 1950, y: 500, w: 420 },
    ],
    ladders: [
      { x: 840, top: 580, bottom: 720 }, { x: 1180, top: 580, bottom: 840 }, { x: 1120, top: 440, bottom: 580 },
      { x: 1560, top: 640, bottom: 780 }, { x: 2100, top: 500, bottom: 720 },
    ],
    trees: [180, 650, 1300, 1800, 2350],
    zones: [
      { p: 0, x0: 300, x1: 1300, t: "mush", n: 4 }, { p: 0, x0: 1400, x1: 2450, t: "lizard", n: 3 },
      { p: 1, t: "mush", n: 2 }, { p: 2, t: "mush", n: 2 }, { p: 3, t: "mush", n: 3 }, { p: 4, t: "lizard", n: 2 },
      { p: 5, t: "lizard", n: 3 }, { p: 6, t: "mush", n: 2 }, { p: 7, t: "lizard", n: 2 }, { p: 8, t: "mush", n: 3 },
      { p: 9, t: "lizard", n: 3 },
    ],
    portals: [{ x: 60, to: "ruins", tp: 1 }, { x: 2540, to: "grove", tp: 0 }],
  },
  grove: {
    name: "古樹深處", area: "浮島", w: 1400, spawn: 60, theme: THEMES.forest,
    plats: [{ x: 200, y: 780, w: 220 }, { x: 460, y: 720, w: 220 }, { x: 960, y: 780, w: 220 }, { x: 1160, y: 720, w: 200 }],
    ladders: [], trees: [150, 700, 1300],
    zones: [{ p: 0, x0: 420, x1: 1200, t: "treant", n: 1 }, { p: 2, t: "lizard", n: 1 }, { p: 4, t: "lizard", n: 1 }],
    portals: [{ x: 60, to: "forest", tp: 1 }],
  },
  // the second island, reached by airship; home is the town a map sends you back to
  cloudtown: {
    name: "雲頂城", area: "雲頂", town: true, scene: "cloud", home: "cloudtown", note: "城鎮．飛船、雲商、雲守衛、雲匠", w: 1400, spawn: 200, dock: 200,
    theme: THEMES.cloud, plats: [{ x: 840, y: 780, w: 180 }, { x: 1040, y: 720, w: 200 }], ladders: [], trees: [300, 760, 1240], zones: [],
    portals: [{ x: 1350, to: "cloudwalk", tp: 0 }],
  },
  cloudwalk: {
    name: "雲海步道", area: "雲頂", home: "cloudtown", w: 2400, spawn: 60, theme: THEMES.cloud,
    plats: [
      { x: 280, y: 780, w: 300 }, { x: 480, y: 720, w: 320 }, { x: 700, y: 600, w: 420 }, { x: 1250, y: 780, w: 420 },
      { x: 1380, y: 560, w: 420 }, { x: 1900, y: 780, w: 300 }, { x: 2120, y: 720, w: 250 }, { x: 900, y: 420, w: 380 },
      { x: 180, y: 540, w: 300 },
    ],
    ladders: [
      { x: 240, top: 540, bottom: 840 }, { x: 760, top: 600, bottom: 720 }, { x: 1080, top: 600, bottom: 840 },
      { x: 1000, top: 420, bottom: 600 }, { x: 1450, top: 560, bottom: 780 }, { x: 1720, top: 560, bottom: 840 },
    ],
    trees: [500, 1180, 2050],
    zones: [
      { p: 0, x0: 300, x1: 2250, t: "sheep", n: 7 }, { p: 3, t: "sheep", n: 3 }, { p: 4, t: "sheep", n: 3 }, { p: 5, t: "sheep", n: 3 },
      { p: 7, t: "sheep", n: 2 }, { p: 8, t: "sheep", n: 3 }, { p: 9, t: "sheep", n: 3 },
    ],
    portals: [{ x: 60, to: "cloudtown", tp: 0 }, { x: 2350, to: "windplateau", tp: 0 }],
  },
  windplateau: {
    name: "風之高台", area: "雲頂", home: "cloudtown", w: 2400, spawn: 60, theme: THEMES.cloud,
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
      { p: 0, x0: 300, x1: 1300, t: "rhino", n: 3 }, { p: 0, x0: 1400, x1: 2300, t: "rhino", n: 3 },
      { p: 1, t: "sprite", n: 2 }, { p: 2, t: "sprite", n: 2 }, { p: 3, t: "sprite", n: 3 }, { p: 4, t: "sprite", n: 2 },
      { p: 5, t: "sprite", n: 3 }, { p: 6, t: "sprite", n: 2 }, { p: 7, t: "sprite", n: 2 }, { p: 8, t: "sprite", n: 3 }, { p: 9, t: "sprite", n: 2 },
    ],
    portals: [{ x: 60, to: "cloudwalk", tp: 1 }, { x: 2320, y: 500, to: "stormaltar", tp: 0 }],
  },
  // reached only through the sage's trial; not on the world map
  trial: {
    name: "影之試煉場", area: "雲頂", home: "cloudtown", w: 1200, spawn: 100, theme: THEMES.shadow,
    plats: [], ladders: [], trees: [260, 980], zones: [{ p: 0, x0: 520, x1: 1100, t: "shadow", n: 1 }],
    portals: [{ x: 60, to: "cloudtown", tp: 0 }],
  },
  // jump challenges, through the coaches in the two towns: no monsters, the ground sends you back to the start,
  // and standing on platform `goal` (an index into plats) finishes it
  jump1: {
    name: "彩虹跳台", area: "浮島", home: "village", jump: true, w: 1000, spawn: 100, theme: THEMES.meadow, goal: 12,
    plats: [
      ...[0, 1, 2, 3, 4, 5].map(i => ({ x: 180 + i * 105, y: 790 - i * 50, w: 70 })), { x: 810, y: 490, w: 130 },
      ...[0, 1, 2, 3, 4].map(i => ({ x: 710 - i * 100, y: 440 - i * 50, w: 65 })), { x: 150, y: 190, w: 125 },
    ],
    ladders: [], trees: [60, 940], zones: [], portals: [{ x: 40, to: "village", tp: 0 }],
  },
  jump2: {
    name: "雲階試煉", area: "雲頂", home: "cloudtown", jump: true, w: 1000, spawn: 100, theme: THEMES.cloud, goal: 12,
    plats: [
      ...[0, 1, 2, 3, 4, 5].map(i => ({ x: 170 + i * 90, y: 785 - i * 55, w: 50 })), { x: 710, y: 455, w: 100 },
      ...[0, 1, 2, 3, 4].map(i => ({ x: 620 - i * 90, y: 400 - i * 55, w: 50 })), { x: 100, y: 125, w: 120 },
    ],
    ladders: [], trees: [40, 900], zones: [], portals: [{ x: 40, to: "cloudtown", tp: 0 }],
  },
  // reached only through the temple priest's trial; not on the world map
  trial4: {
    name: "王者試煉場", area: "沉砂", home: "sandcity", w: 1200, spawn: 100, theme: THEMES.shadow,
    plats: [], ladders: [], trees: [260, 980], zones: [{ p: 0, x0: 520, x1: 1100, t: "shadow2", n: 1 }],
    portals: [{ x: 60, to: "sandcity", tp: 0 }],
  },
  stormaltar: {
    name: "雷雲祭壇", area: "雲頂", home: "cloudtown", w: 1800, spawn: 60, theme: THEMES.storm,
    plats: [
      { x: 250, y: 780, w: 300 }, { x: 450, y: 720, w: 300 }, { x: 650, y: 660, w: 340 }, { x: 700, y: 440, w: 820 },
      { x: 1250, y: 780, w: 400 },
    ],
    ladders: [{ x: 900, top: 440, bottom: 660 }, { x: 1450, top: 440, bottom: 780 }],
    trees: [300, 1100, 1650],
    zones: [
      { p: 0, x0: 300, x1: 1700, t: "rhino", n: 3 }, { p: 1, t: "sprite", n: 2 }, { p: 2, t: "sprite", n: 2 },
      { p: 4, t: "eagle", n: 1 }, { p: 5, t: "rhino", n: 2 },
    ],
    portals: [{ x: 60, to: "windplateau", tp: 1 }],
  },
  // the desert continent, Lv.55 to 75, reached by airship from either town
  sandcity: {
    name: "沉砂城", area: "沉砂", town: true, scene: "sand", home: "sandcity", note: "城鎮．飛船、沙商、倉庫、守衛隊長、沙匠", w: 1400, spawn: 200, dock: 200,
    theme: THEMES.desert, plats: [], ladders: [], trees: [470, 1260], zones: [],
    portals: [{ x: 1350, to: "dunes", tp: 0 }],
  },
  // the expedition: only through the expedition captain, with a pass, twice a day; not on the world map.
  // raid maps send a saved game back to town, and you lose no experience if you fall here
  magma: {
    name: "熔心祭壇", area: "沉砂", home: "sandcity", raid: true, w: 1400, spawn: 120, theme: THEMES.lava,
    plats: [{ x: 60, y: 780, w: 220 }, { x: 1120, y: 780, w: 220 }, { x: 250, y: 720, w: 200 }, { x: 950, y: 720, w: 200 }, { x: 400, y: 660, w: 150 }, { x: 850, y: 660, w: 150 }],
    ladders: [], trees: [40, 1360], zones: [{ p: 0, x0: 600, x1: 800, t: "colossus", n: 1 }],
    portals: [{ x: 40, y: 780, to: "sandcity", tp: 0 }],
  },
  dunes: {
    name: "沙丘地帶", area: "沉砂", home: "sandcity", w: 2400, spawn: 60, theme: THEMES.desert,
    plats: [
      { x: 280, y: 780, w: 300 }, { x: 480, y: 720, w: 320 }, { x: 700, y: 600, w: 420 }, { x: 1250, y: 780, w: 420 },
      { x: 1380, y: 560, w: 420 }, { x: 1900, y: 780, w: 300 }, { x: 2120, y: 720, w: 250 }, { x: 900, y: 420, w: 380 },
      { x: 180, y: 540, w: 300 },
    ],
    ladders: [
      { x: 240, top: 540, bottom: 840 }, { x: 760, top: 600, bottom: 720 }, { x: 1080, top: 600, bottom: 840 },
      { x: 1000, top: 420, bottom: 600 }, { x: 1450, top: 560, bottom: 780 }, { x: 1720, top: 560, bottom: 840 },
    ],
    trees: [520, 1200, 2050],
    zones: [
      { p: 0, x0: 300, x1: 1200, t: "fox", n: 4 }, { p: 0, x0: 1300, x1: 2300, t: "worm", n: 4 }, { p: 1, t: "fox", n: 2 }, { p: 2, t: "worm", n: 2 },
      { p: 3, t: "fox", n: 3 }, { p: 4, t: "worm", n: 3 }, { p: 5, t: "fox", n: 3 }, { p: 7, t: "worm", n: 2 }, { p: 8, t: "fox", n: 2 }, { p: 9, t: "fox", n: 2 },
    ],
    portals: [{ x: 60, to: "sandcity", tp: 0 }, { x: 2350, to: "valley", tp: 0 }],
  },
  valley: {
    name: "仙人掌谷", area: "沉砂", home: "sandcity", w: 2400, spawn: 60, theme: THEMES.desert,
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
      { p: 0, x0: 300, x1: 1300, t: "worm", n: 3 }, { p: 0, x0: 1400, x1: 2300, t: "cactus", n: 3 },
      { p: 1, t: "cactus", n: 2 }, { p: 2, t: "cactus", n: 2 }, { p: 3, t: "cactus", n: 3 }, { p: 4, t: "worm", n: 2 },
      { p: 5, t: "cactus", n: 2 }, { p: 6, t: "worm", n: 2 }, { p: 7, t: "cactus", n: 2 }, { p: 8, t: "cactus", n: 2 }, { p: 9, t: "cactus", n: 3 },
    ],
    portals: [{ x: 60, to: "dunes", tp: 1 }, { x: 2320, y: 500, to: "tomb", tp: 0 }],
  },
  // too dark to see far: only the light around you, the lantern spirits and the portals
  tomb: {
    name: "地下古墓", area: "沉砂", home: "sandcity", w: 2400, spawn: 60, theme: THEMES.tomb,
    plats: [
      { x: 300, y: 780, w: 360 }, { x: 560, y: 720, w: 380 }, { x: 1100, y: 780, w: 400 }, { x: 1400, y: 720, w: 360 },
      { x: 1850, y: 780, w: 380 }, { x: 700, y: 540, w: 460 }, { x: 1350, y: 520, w: 500 }, { x: 1950, y: 560, w: 380 },
    ],
    ladders: [{ x: 900, top: 540, bottom: 720 }, { x: 1500, top: 520, bottom: 720 }, { x: 2050, top: 560, bottom: 780 }],
    trees: [180, 1000, 1700, 2300],
    zones: [
      { p: 0, x0: 300, x1: 1100, t: "soldier", n: 3 }, { p: 0, x0: 1200, x1: 2300, t: "soldier", n: 3 },
      { p: 1, t: "wisp", n: 2 }, { p: 2, t: "soldier", n: 2 }, { p: 3, t: "wisp", n: 2 }, { p: 4, t: "soldier", n: 2 },
      { p: 5, t: "wisp", n: 2 }, { p: 6, t: "wisp", n: 3 }, { p: 7, t: "soldier", n: 3 }, { p: 8, t: "wisp", n: 2 },
    ],
    portals: [{ x: 60, to: "valley", tp: 1 }, { x: 2350, to: "temple", tp: 0 }],
  },
  temple: {
    name: "流沙神殿", area: "沉砂", home: "sandcity", w: 1800, spawn: 60, theme: THEMES.temple,
    plats: [
      { x: 250, y: 780, w: 300 }, { x: 450, y: 720, w: 300 }, { x: 650, y: 660, w: 340 }, { x: 700, y: 440, w: 820 },
      { x: 1250, y: 780, w: 400 },
    ],
    ladders: [{ x: 900, top: 440, bottom: 660 }, { x: 1450, top: 440, bottom: 780 }],
    trees: [300, 1100, 1650],
    zones: [
      { p: 0, x0: 300, x1: 1700, t: "scarab", n: 4 }, { p: 1, t: "scarab", n: 2 }, { p: 2, t: "soldier", n: 2 },
      { p: 4, t: "scorpking", n: 1 }, { p: 5, t: "scarab", n: 3 },
    ],
    portals: [{ x: 60, to: "tomb", tp: 1 }],
  },
};
// the order the world map lists them in, from the village outward
const MAP_ORDER = ["village", "meadow", "shore", "reef", "ruins", "forest", "grove", "cloudtown", "cloudwalk", "windplateau", "stormaltar",
                   "sandcity", "dunes", "valley", "tomb", "temple"];
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
  shell:  { name: "刺殼龜", lv: 8,  hp: 160,  exp: 50,  dmg: 20, spd: 35, avoid: 3, acc: 35, w: 48,  h: 34,  coin: [15, 35],
            drops: [["shell_shard", 0.55], ["red_pot", 0.2], ["blue_pot", 0.12], ["town_scroll", 0.04], ["leather_cap", 0.03], ["wind_boots", 0.03],
                    ["hunter_gloves", 0.03], ["wood_shield", 0.03], ["scroll_wpn60", 0.01], ["scroll_arm60", 0.01], ["arrow", 0.1, 30, 60], ["iron_star", 0.08, 40, 80]] },
  // a boss: no knockback, a health bar at the top, and a slam (wind-up seconds, cooldown, reach, damage)
  boss:   { name: "苔岩巨像", lv: 15, hp: 2400, exp: 600, dmg: 34, spd: 25, avoid: 6, acc: 60, w: 100, h: 120, coin: [300, 500], respawn: 45,
            boss: true, slam: { wind: 0.85, cd: 3.4, range: 300, dmg: 32 },
            drops: [["moss_core", 1], ["red_pot", 1, 5], ["blue_pot", 1, 5], ["town_scroll", 1, 2], [["jade_blade", "vine_staff", "hawk_bow", "dark_claw"], 1],
                    ["moss_cape", 0.5], ["shell_shield", 0.3], ["scroll_wpn60", 0.3], ["scroll_arm60", 0.3], ["arrow", 1, 100, 200], ["steel_star", 0.5, 100, 200]] },
  mush:   { name: "霧菇", lv: 18, hp: 600, exp: 180, dmg: 45, spd: 45, avoid: 6, acc: 80, w: 40, h: 40, coin: [30, 60],
            drops: [["fog_spore", 0.5], ["red_pot", 0.2], ["blue_pot", 0.15], ["town_scroll", 0.04], ["fog_hood", 0.02],
                    ["scroll_wpn60", 0.02], ["scroll_arm60", 0.03], ["arrow", 0.1, 40, 80], ["iron_star", 0.08, 50, 100]] },
  lizard: { name: "石甲蜥", lv: 25, hp: 1500, exp: 400, dmg: 70, spd: 55, avoid: 9, acc: 110, w: 62, h: 34, coin: [50, 90],
            drops: [["lizard_scale", 0.5], ["red_pot", 0.2], ["blue_pot", 0.15], ["lizard_mail", 0.02], ["lizard_greaves", 0.02],
                    ["scroll_wpn60", 0.03], ["scroll_arm60", 0.03], ["scroll_glove60", 0.02], ["scroll_wpn10", 0.01],
                    [["storm_blade", "star_staff", "gale_bow", "fang_claw"], 0.01], ["steel_star", 0.05, 50, 100]] },
  crab:   { name: "巨鉗蟹王", lv: 22, hp: 7000, exp: 3500, dmg: 50, spd: 30, avoid: 7, acc: 100, w: 130, h: 90, coin: [600, 900], respawn: 60,
            boss: true, slam: { wind: 0.8, cd: 3.6, range: 220, dmg: 60 },
            drops: [["crab_claw", 1], ["red_pot", 1, 10], ["blue_pot", 1, 10], ["crab_shield", 0.5], ["scroll_wpn60", 0.6], ["scroll_arm60", 0.6],
                    ["scroll_wpn10", 0.2], ["scroll_arm10", 0.2], ["town_scroll", 1, 2]] },
  treant: { name: "霧林古樹精", lv: 32, hp: 40000, exp: 12000, dmg: 75, spd: 22, avoid: 10, acc: 150, w: 120, h: 160, coin: [1500, 2500], respawn: 90,
            boss: true, slam: { wind: 1.1, cd: 4.2, range: 320, dmg: 95 },
            drops: [["ancient_ring", 1], [["storm_blade", "star_staff", "gale_bow", "fang_claw"], 1], ["grove_cape", 0.5], ["scroll_wpn10", 0.5],
                    ["scroll_arm10", 0.5], ["scroll_glove60", 0.6], ["red_pot", 1, 15], ["blue_pot", 1, 15], ["steel_star", 1, 200, 300]] },
  sheep:  { name: "棉雲羊", lv: 32, hp: 3000, exp: 600, dmg: 110, spd: 45, avoid: 10, acc: 160, w: 46, h: 38, coin: [80, 140],
            drops: [["cloud_wool", 0.5], ["white_pot", 0.15], ["mana_pot", 0.1], ["town_scroll", 0.04], ["cloud_hat", 0.02], ["cloud_boots", 0.02],
                    ["scroll_arm60", 0.03], ["scroll_wpn60", 0.02], ["arrow", 0.1, 60, 120], ["steel_star", 0.06, 60, 120]] },
  sprite: { name: "風鈴精", lv: 40, hp: 5000, exp: 1000, dmg: 150, spd: 55, avoid: 14, acc: 200, w: 36, h: 44, coin: [120, 200],
            drops: [["bell_shard", 0.5], ["white_pot", 0.2], ["mana_pot", 0.15], ["cloud_robe", 0.02], ["cloud_pants", 0.02],
                    ["scroll_glove60", 0.02], ["scroll_wpn60", 0.03], ["scroll_wpn10", 0.01], ["guard_scroll", 0.01]] },
  rhino:  { name: "雷角犀", lv: 46, hp: 8000, exp: 1500, dmg: 190, spd: 50, avoid: 12, acc: 240, w: 72, h: 46, coin: [160, 260],
            drops: [["thunder_horn", 0.5], ["white_pot", 0.2], ["mana_pot", 0.15], ["cloud_shield", 0.015], [["cloud_sword", "thunder_staff", "sky_bow", "cloud_claw"], 0.01],
                    ["scroll_arm10", 0.01], ["scroll_wpn10", 0.01], ["restore_scroll", 0.01]] },
  eagle:  { name: "雷雲巨鷲", lv: 50, hp: 160000, exp: 30000, dmg: 200, spd: 28, avoid: 14, acc: 280, w: 120, h: 130, coin: [3000, 5000], respawn: 120,
            boss: true, slam: { wind: 1.1, cd: 4, range: 340, dmg: 260 },
            drops: [["eagle_feather", 1], [["cloud_sword", "thunder_staff", "sky_bow", "cloud_claw"], 1], ["storm_cape", 0.5], ["scroll_wpn10", 0.6], ["scroll_arm10", 0.6], ["guard_scroll", 0.5],
                    ["white_pot", 1, 20], ["mana_pot", 1, 20]] },
  // the trial's shadow: quick, hits hard, and fights with your own weapon
  shadow: { name: "影子分身", lv: 55, nocard: true, hp: 30000, exp: 8000, dmg: 160, spd: 70, avoid: 15, acc: 260, w: 40, h: 80, coin: [1, 1], respawn: 20,
            boss: true, slam: { wind: 0.7, cd: 3, range: 260, dmg: 200 }, drops: [["white_pot", 1, 10], ["mana_pot", 1, 10]] },
  // the expedition boss: the body cannot be hurt while either arm is up (armored); heavy things are never knocked back
  colossus: { name: "熔心巨像", lv: 85, hp: 2250000, exp: 120000, dmg: 400, spd: 0, avoid: 20, acc: 450, w: 200, h: 230, coin: [10000, 15000], respawn: 99999,
              boss: true, heavy: true, slam: { wind: 1.2, cd: 5, range: 450, dmg: 900 },
              drops: [[["magma_earring", "magma_necklace", "magma_ring"], 1], [["magma_earring", "magma_necklace", "magma_ring"], 0.3], ["scroll_acc10", 0.8],
                      ["scroll_wpn10", 1], ["guard_scroll", 1, 2], ["restore_scroll", 0.6], ["white_pot", 1, 30], ["mana_pot", 1, 30]] },
  carm:     { name: "熔岩巨臂", lv: 85, nocard: true, hp: 375000, exp: 10000, dmg: 350, spd: 0, avoid: 18, acc: 420, w: 70, h: 96, coin: [500, 800], heavy: true,
              slam: { wind: 0.9, cd: 3.5, range: 180, dmg: 600 }, drops: [["white_pot", 0.5, 3]] },
  // the fourth job's trial: a stronger shadow, crimson instead of violet
  shadow2: { name: "真影分身", lv: 80, nocard: true, hp: 150000, exp: 30000, dmg: 330, spd: 85, avoid: 18, acc: 400, w: 44, h: 90, coin: [1, 1], respawn: 20,
             boss: true, slam: { wind: 0.6, cd: 2.6, range: 280, dmg: 450 }, drops: [["white_pot", 1, 15], ["mana_pot", 1, 15]] },
  // the desert. burrow: { under, up } seconds spent hidden in the sand (it cannot be hit, and closes in on you)
  // and above it; throw: { cd, range, dmg, kind } a shot thrown at you from a distance
  fox:     { name: "沙丘狐", lv: 55, hp: 11000, exp: 2000, dmg: 230, spd: 75, avoid: 16, acc: 280, w: 50, h: 34, coin: [540, 900],
             drops: [["fox_tail", 0.5], ["white_pot", 0.2], ["mana_pot", 0.15], ["desert_hat", 0.02], ["desert_boots", 0.02],
                     ["scroll_shoes60", 0.02], ["scroll_wpn60", 0.03], ["arrow", 0.1, 80, 150], ["steel_star", 0.06, 80, 150]] },
  worm:    { name: "鑽沙蚯", lv: 58, hp: 14000, exp: 2500, dmg: 250, spd: 45, avoid: 14, acc: 300, w: 60, h: 32, coin: [600, 960],
             burrow: { under: 2, up: 3.5 },
             drops: [["worm_skin", 0.5], ["white_pot", 0.2], ["mana_pot", 0.15], ["desert_robe", 0.02], ["desert_pants", 0.02],
                     ["scroll_cape60", 0.02], ["scroll_arm60", 0.03], ["guard_scroll", 0.01]] },
  cactus:  { name: "仙人掌怪", lv: 62, hp: 18000, exp: 3000, dmg: 260, spd: 25, avoid: 15, acc: 320, w: 40, h: 58, coin: [660, 1080],
             throw: { cd: 2.6, range: 380, dmg: 230, kind: "needle" },
             drops: [["cactus_needle", 0.5], ["white_pot", 0.2], ["mana_pot", 0.15], ["desert_hat", 0.02], ["desert_robe", 0.02],
                     [["sand_sword", "sun_staff", "dune_bow", "sand_claw"], 0.01], ["scroll_glove60", 0.02], ["scroll_wpn10", 0.01]] },
  wisp:    { name: "古墓燈魂", lv: 65, hp: 20000, exp: 3400, dmg: 270, spd: 35, avoid: 18, acc: 330, w: 34, h: 42, coin: [720, 1140], glow: true,
             throw: { cd: 3, range: 360, dmg: 250, kind: "wisp" },
             drops: [["wisp_ash", 0.5], ["white_pot", 0.2], ["mana_pot", 0.2], ["tomb_helm", 0.015], ["scroll_cape60", 0.02],
                     ["scroll_arm10", 0.01], ["restore_scroll", 0.01]] },
  soldier: { name: "墓守陶俑", lv: 68, hp: 26000, exp: 4000, dmg: 300, spd: 40, avoid: 15, acc: 340, w: 48, h: 72, coin: [780, 1260],
             drops: [["clay_shard", 0.5], ["white_pot", 0.2], ["mana_pot", 0.15], ["tomb_armor", 0.015], ["tomb_greaves", 0.015],
                     [["tomb_sword", "moon_staff", "pharaoh_bow", "scarab_claw"], 0.008], ["scroll_wpn10", 0.01], ["scroll_shoes60", 0.02]] },
  scarab:  { name: "聖甲蟲", lv: 71, hp: 30000, exp: 4600, dmg: 320, spd: 55, avoid: 17, acc: 360, w: 52, h: 32, coin: [840, 1380],
             burrow: { under: 1.8, up: 4 },
             drops: [["scarab_shell", 0.5], ["white_pot", 0.2], ["mana_pot", 0.15], ["tomb_cape", 0.012], ["tomb_helm", 0.015],
                     [["tomb_sword", "moon_staff", "pharaoh_bow", "scarab_claw"], 0.008], ["scroll_arm10", 0.01], ["guard_scroll", 0.01]] },
  // summoned by the scorpion king; they do not come back once beaten
  scorpling: { name: "小沙蠍", lv: 60, nocard: true, hp: 6000, exp: 500, dmg: 220, spd: 85, avoid: 12, acc: 300, w: 38, h: 24, coin: [30, 60], drops: [["white_pot", 0.1]] },
  // summon: { t, n, cd, max } calls monsters to its side; rage: below `at` of its health it gets faster,
  // slams more often and starts burrowing
  scorpking: { name: "沙暴蠍皇", lv: 75, hp: 700000, exp: 80000, dmg: 320, spd: 30, avoid: 18, acc: 380, w: 150, h: 104, coin: [5000, 8000], respawn: 150,
             boss: true, slam: { wind: 1, cd: 4.2, range: 320, dmg: 420 }, summon: { t: "scorpling", n: 2, cd: 14, max: 4 },
             rage: { at: 0.5, spd: 1.6, cd: 0.7, burrow: { under: 1.6, up: 4.5 } },
             drops: [["scorp_stinger", 1], [["tomb_sword", "moon_staff", "pharaoh_bow", "scarab_claw"], 1], ["tomb_cape", 0.5], ["scroll_wpn10", 0.6],
                     ["scroll_arm10", 0.6], ["scroll_cape60", 0.6], ["guard_scroll", 0.6], ["white_pot", 1, 30], ["mana_pot", 1, 30]] },
};
const mobs = [];
function placeMob(m) {
  m.x = rand(m.x0, m.x1);
  m.y = m.p.y - m.h;
  m.hp = m.T.hp; m.dead = false; m.alpha = 0; m.kb = 0; m.aggro = 0; m.showHp = 0; m.wind = 0; m.slamCd = 3;
  m.dir = Math.random() < 0.5 ? -1 : 1;
  m.under = false; m.bt = m.T.burrow ? rand(1, m.T.burrow.up) : 0; m.tcd = rand(1, 2.5); m.throwT = 0; m.scd = 6; m.raged = false; m.surf = 0;
}
// a monster called up during a fight (the scorpion king's young): it fades in next to x and never respawns
function spawnMob(t, p, x0, x1, x) {
  const T = TYPES[t];
  const m = { t, T, p, x0, x1: x1 - T.w, w: T.w, h: T.h, st: rand(0, 2), state: "idle", ph: rand(0, 6), flash: 0, deadT: 0, minion: true };
  placeMob(m);
  m.x = clamp(x - T.w / 2, m.x0, m.x1); m.aggro = 6;
  mobs.push(m);
  return m;
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
  drops.length = 0; shots.length = 0; foes.length = 0; skyGrad = null;
  Object.assign(P, { x: x - P.w / 2, y: y - P.h, vx: 0, vy: 0, climb: null, onGround: true, prone: false, knock: 0, sit: null });
  P.ground = platAt(x, y);
  cam.x = clamp(P.x + P.w / 2 - W / 2, 0, WORLD_W - W);
  cam.y = clamp(P.y - H * 0.58, 0, WORLD_H - H);
  fade = 1;
  pet.map = null;
  if (!map.raid) raid = null;
}
const portalAt = () => portals.find(pt => Math.abs(P.x + P.w / 2 - pt.x) < 24 && Math.abs(P.y + P.h - pt.y) < 4);
function usePortal(pt) {
  sfx("portal");
  const to = MAPS[pt.to], dest = to.portals[pt.tp];
  loadMap(pt.to, dest.x, dest.y ?? 840);
  msg(`來到了${to.name}`, "#cfe3ff");
  refreshPanels(true); save();
}
// the town a map belongs to: where a town scroll and getting knocked out send you
const homeOf = () => MAPS[map.home || "village"];
function goToTown() {
  loadMap(map.home || "village");
  refreshPanels(true);
}
