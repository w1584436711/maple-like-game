// Screen size, movement constants, the canvas and small math helpers.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// WORLD_H leaves room under the ground so name tags under the feet clear the status bar
const W = 960, H = 540, WORLD_H = 924;
let WORLD_W = 1400;  // set by loadMap
// Movement tuned to the classic side-scroller feel (px and px/s):
// walk 125, jump launch 555 under gravity 2000 (about 77 px high), fall cap 670, climb 120,
// almost no air control (only braking against your momentum), 2 s of invincibility after a hit.
const G = 2000, JUMP = 555, FALL_MAX = 670, WALK = 125, CLIMB = 120;
const AIR_BRAKE = 390, ROPE_JUMP_VX = 160, ROPE_JUMP_VY = 375, KB_VX = 187, KB_VY = 440, INV_TIME = 2;
const SLASH_T = 0.55, STAB_T = 0.45, SKILL_T = 0.6;
const UI = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
const NUM = '"Lilita One","Arial Black",sans-serif';
const SAVE_KEY = "floating-isle-v1";
// experience multiplier: 3x gets a new character to the first job in roughly ten minutes
const EXP_RATE = 3;

const cv = document.getElementById("game");
// let, not const: item icons borrow the game's drawing code by pointing ctx at a small canvas for a moment
let ctx = cv.getContext("2d");
let scale = 1;
function fit() {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.max(1, Math.round(r.width * dpr));
  cv.height = Math.max(1, Math.round(r.width * 9 / 16 * dpr));
  scale = cv.width / W;
}
new ResizeObserver(fit).observe(cv);
fit();

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlap = (a, b, s = 0) => a.x + s < b.x + b.w && a.x + a.w - s > b.x && a.y + s < b.y + b.h && a.y + a.h - s > b.y;
