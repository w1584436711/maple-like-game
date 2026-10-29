// Everything drawn on the canvas: scenery, NPCs, monsters, items, the player and the HUD.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Drawing helpers ----------
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function outlinedText(text, x, y, fill, stroke, lw = 4) {
  ctx.lineJoin = "round"; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

// Shared paint helpers: everything gets a soft top-to-bottom gradient and a dark outline,
// which is what gives hand-drawn side-scroller sprites their look.
const INK = "rgba(38,26,40,.78)";
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), t = k < 0 ? 0 : 255, p = Math.abs(k);
  const ch = s => Math.round(((n >> s) & 255) + (t - ((n >> s) & 255)) * p);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function vgrad(y0, y1, c0, c1) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
// fills the current path, then outlines it
function paint(fill, line = INK, lw = 1.4) {
  ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.stroke(); }
}
// a glossy colour: lighter at y0, darker at y1
const gloss = (c, y0, y1) => vgrad(y0, y1, shade(c, 0.32), shade(c, -0.18));
function eyes(x1, x2, y, r, look, blink, pupil = "#2a2233") {
  for (const x of [x1, x2]) {
    if (blink) { ctx.strokeStyle = pupil; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y + r * 0.6, x + r, y); ctx.stroke(); continue; }
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 1.15, 0, 0, Math.PI * 2); paint("#ffffff", INK, 1);
    ctx.fillStyle = pupil; ctx.beginPath(); ctx.ellipse(x + look, y + 0.6, r * 0.55, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x + look - r * 0.2, y - r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fill();
  }
}
// everyone blinks for a moment every few seconds, offset by a per-creature phase
const blinking = ph => (time + ph) % 3.7 < 0.13;

let skyGrad = null;
function drawBG() {
  if (!skyGrad) {
    const sky = map.theme.sky;
    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, sky[0]); skyGrad.addColorStop(0.6, sky[1]); skyGrad.addColorStop(1, sky[2]);
  }
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
  // sun, unless underground
  if (!map.theme.dark) {
    ctx.fillStyle = "rgba(255,247,214,.9)";
    ctx.beginPath(); ctx.arc(780 - cam.x * 0.02, 90, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,247,214,.25)";
    ctx.beginPath(); ctx.arc(780 - cam.x * 0.02, 90, 60, 0, Math.PI * 2); ctx.fill();
  }
  // far mountains
  const ox = cam.x * 0.12, oy = cam.y * 0.1, th = map.theme;
  if (th.cloudsea) {
    // banks of cloud rolling slowly below the island
    const sy = 320 - oy;
    ctx.fillStyle = vgrad(sy, H, "rgba(255,255,255,.95)", "rgba(220,232,248,.95)"); ctx.fillRect(0, sy + 20, W, H - sy);
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 14; i++) {
      const x = ((i * 110 - ox * 1.2 + time * 6) % 1540 + 1540) % 1540 - 160;
      ctx.beginPath(); ctx.ellipse(x, sy + 24 + (i % 3) * 6, 70 + (i % 4) * 14, 26, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (th.lava) {
    // a sea of lava far below, with slow bright ripples
    const sy = 330 - oy;
    ctx.fillStyle = vgrad(sy, H, "#ff8a3a", "#8a1a0a"); ctx.fillRect(0, sy, W, H - sy);
    ctx.strokeStyle = "rgba(255,230,140,.45)"; ctx.lineWidth = 2;
    for (let r = 0; r < 5; r++) {
      const y = sy + 12 + r * 24;
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 50) { const px = x - ((ox * (1 + r * 0.3) + time * (5 + r * 2)) % 50); ctx.moveTo(px, y); ctx.quadraticCurveTo(px + 12, y - 4, px + 25, y); }
      ctx.stroke();
    }
  } else if (th.sea) {
    // open sea with slow rolling wave lines
    const sy = 330 - oy;
    ctx.fillStyle = vgrad(sy, H, th.far, shade(th.far, -0.3)); ctx.fillRect(0, sy, W, H - sy);
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5;
    for (let r = 0; r < 5; r++) {
      const y = sy + 14 + r * 22;
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 40) { const px = x - ((ox * (1 + r * 0.3) + time * (8 + r * 3)) % 40); ctx.moveTo(px, y); ctx.quadraticCurveTo(px + 10, y - 3, px + 20, y); }
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = th.far;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 12; x += 12) { const wx = x + ox; ctx.lineTo(x, 300 - oy + Math.sin(wx * 0.0045) * 50 + Math.sin(wx * 0.013 + 1) * 20); }
    ctx.lineTo(W, H); ctx.fill();
  }
  if (th.tree === "pillar") {
    // ruined columns standing on the far hills
    ctx.fillStyle = shade(th.far, -0.18);
    for (let i = 0; i < 6; i++) {
      const x = ((i * 230 - ox * 1.4) % 1380 + 1380) % 1380 - 120, h = 90 + (i * 37) % 70, base = 330 - oy;
      ctx.fillRect(x, base - h, 22, h + 40); ctx.fillRect(x - 5, base - h - 8, 32, 8);
      if (i % 2) { ctx.beginPath(); ctx.moveTo(x, base - h - 8); ctx.lineTo(x + 32 * 0.6, base - h - 20); ctx.lineTo(x + 27, base - h - 8); ctx.fill(); }
    }
  }
  // clouds
  if (!th.dark) for (const c of clouds) {
    const span = W + 320;
    const x = ((c.x - cam.x * 0.18) % span + span) % span - 160;
    const y = c.y - cam.y * 0.08;
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.beginPath();
    ctx.ellipse(x, y, 46 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 26 * c.s, y + 4, 26 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 20 * c.s, y - 8 * c.s, 28 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // near hills
  const ox2 = cam.x * 0.32, oy2 = cam.y * 0.28;
  ctx.fillStyle = th.near;
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 12; x += 12) { const wx = x + ox2; ctx.lineTo(x, 420 - oy2 + Math.sin(wx * 0.006 + 2) * 34 + Math.sin(wx * 0.017) * 12); }
  ctx.lineTo(W, H); ctx.fill();
}

function drawTree(t) {
  const kind = map.theme.tree;
  if (kind === "palm") drawPalm(t);
  else if (kind === "pine") drawPine(t);
  else if (kind === "spire") drawSpire(t);
  else if (kind === "pillar") drawPillar(t);
  else if (kind === "cactus") drawCactusTree(t);
  else drawOak(t);
}
// a palm leaning over the beach, with ringed trunk, drooping fronds and coconuts
function drawPalm(t) {
  const by = 840, h = t.h * 1.15, lean = t.c ? 1 : -1;
  const top = { x: t.x + lean * 26, y: by - h };
  for (let i = 0; i < 9; i++) {
    const k0 = i / 9, k1 = (i + 1) / 9;
    const x0 = t.x + lean * 26 * k0 * k0, y0 = by - h * k0, x1 = t.x + lean * 26 * k1 * k1, y1 = by - h * k1, wdt = 9 - k0 * 3;
    ctx.beginPath(); ctx.moveTo(x0 - wdt, y0); ctx.lineTo(x1 - wdt + 1, y1); ctx.lineTo(x1 + wdt - 1, y1); ctx.lineTo(x0 + wdt, y0); ctx.closePath();
    paint(vgrad(y1, y0, "#b88a5a", "#8a6038"), "rgba(60,35,20,.55)", 1.1);
  }
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.5 + Math.sin(time * 1.2 + i) * 0.04, len = 58 + (i % 2) * 10;
    const ex = top.x + Math.cos(a) * len, ey = top.y + Math.sin(a) * len * 0.45 + 26;
    ctx.beginPath(); ctx.moveTo(top.x, top.y);
    ctx.quadraticCurveTo(top.x + Math.cos(a) * len * 0.5, top.y + Math.sin(a) * len * 0.5 - 14, ex, ey);
    ctx.quadraticCurveTo(top.x + Math.cos(a) * len * 0.5, top.y + Math.sin(a) * len * 0.5 + 2, top.x, top.y + 4);
    paint(vgrad(top.y - 30, top.y + 30, "#6fc75a", "#3f8f3a"), "rgba(30,70,30,.6)", 1.2);
  }
  ctx.fillStyle = "#6b4a2a";
  for (const [dx, dy] of [[-5, 6], [4, 7], [0, 11]]) { ctx.beginPath(); ctx.arc(top.x + dx, top.y + dy, 4.2, 0, Math.PI * 2); ctx.fill(); }
}
// a white tower of the cloud island: marble walls, little windows, a gold roof and a pennant
function drawSpire(t) {
  const by = 840, h = t.h * 1.1, x = t.x, w = 22;
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#c8d4e6");
  ctx.beginPath(); ctx.rect(x - w, by - h, w * 2, h); paint(g, "rgba(60,70,100,.5)", 1.3);
  ctx.fillStyle = "#7ab8f0";
  for (let y = by - h + 24; y < by - 20; y += 34) { ctx.beginPath(); rr(x - 5, y, 10, 16, 5); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(x - w - 6, by - h); ctx.lineTo(x, by - h - 40); ctx.lineTo(x + w + 6, by - h); ctx.closePath();
  paint(vgrad(by - h - 40, by - h, "#ffe08a", "#c8952a"), "rgba(90,60,10,.7)", 1.3);
  ctx.strokeStyle = "#8a6237"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, by - h - 40); ctx.lineTo(x, by - h - 58); ctx.stroke();
  ctx.fillStyle = "#e0453b"; ctx.beginPath(); ctx.moveTo(x, by - h - 58); ctx.lineTo(x + 16 + Math.sin(time * 3) * 2, by - h - 53); ctx.lineTo(x, by - h - 48); ctx.fill();
}
// a tall dark pine: a short trunk under four stacked tiers of needles
function drawPine(t) {
  const by = 840, h = t.h * 1.3, x = t.x;
  ctx.beginPath(); rr(x - 6, by - h * 0.3, 12, h * 0.3, 2); paint(vgrad(by - h * 0.3, by, "#7a5233", "#4a3020"), "rgba(30,20,10,.6)", 1.2);
  for (let i = 0; i < 4; i++) {
    const top = by - h + i * h * 0.17, bottom = top + h * 0.3, w = 18 + i * 15;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w, bottom); ctx.quadraticCurveTo(x, bottom - 8, x - w, bottom); ctx.closePath();
    paint(vgrad(top, bottom, "#4f8a5a", "#24502f"), "rgba(15,35,20,.6)", 1.2);
  }
}
// a broken stone column with moss and a trailing vine
function drawPillar(t) {
  const by = 840, h = t.h * 0.9, x = t.x;
  ctx.beginPath(); rr(x - 26, by - 14, 52, 14, 2); paint(vgrad(by - 14, by, "#b3aaa2", "#7d746c"), "rgba(50,40,35,.6)", 1.3);
  ctx.beginPath(); ctx.moveTo(x - 18, by - 14); ctx.lineTo(x - 18, by - h); ctx.lineTo(x - 6, by - h - 10); ctx.lineTo(x + 4, by - h + 4); ctx.lineTo(x + 18, by - h - 4); ctx.lineTo(x + 18, by - 14); ctx.closePath();
  const g = ctx.createLinearGradient(x - 18, 0, x + 18, 0); g.addColorStop(0, "#c7beb5"); g.addColorStop(1, "#8a8178");
  paint(g, "rgba(50,40,35,.6)", 1.3);
  ctx.strokeStyle = "rgba(60,50,45,.3)"; ctx.lineWidth = 1.4;
  for (const dx of [-9, 0, 9]) { ctx.beginPath(); ctx.moveTo(x + dx, by - 16); ctx.lineTo(x + dx, by - h + 6); ctx.stroke(); }
  ctx.fillStyle = "#6a9f52"; ctx.beginPath(); ctx.ellipse(x - 8, by - h - 2, 12, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#4a7a3a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 14, by - h); ctx.quadraticCurveTo(x + 22, by - h * 0.6, x + 12, by - h * 0.3); ctx.stroke();
}

function drawOak(t) {
  const by = 840, h = t.h;
  // trunk with a little flare at the roots and a few bark lines
  ctx.beginPath(); ctx.moveTo(t.x - 8, by); ctx.quadraticCurveTo(t.x - 6, by - h * 0.3, t.x - 6.5, by - h * 0.6);
  ctx.lineTo(t.x + 6.5, by - h * 0.6); ctx.quadraticCurveTo(t.x + 6, by - h * 0.3, t.x + 8, by); ctx.lineTo(t.x + 13, by); ctx.lineTo(t.x - 13, by); ctx.closePath();
  const bark = ctx.createLinearGradient(t.x - 8, 0, t.x + 8, 0); bark.addColorStop(0, "#94653f"); bark.addColorStop(1, "#5e3d24");
  paint(bark, "rgba(50,30,20,.6)", 1.4);
  ctx.strokeStyle = "rgba(50,30,20,.35)"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(t.x - 2, by - 10); ctx.lineTo(t.x - 3, by - h * 0.3); ctx.moveTo(t.x + 3, by - h * 0.2); ctx.lineTo(t.x + 2, by - h * 0.45); ctx.stroke();
  // leaves: a dark under-layer, the main crown, then sunlit clumps on top
  const blobs = [[0, -0.72, 0.3], [-0.24, -0.56, 0.22], [0.24, -0.58, 0.22], [-0.12, -0.84, 0.18], [0.14, -0.82, 0.17]];
  const leaf = t.c ? "#4fa55a" : "#5fb760";
  ctx.fillStyle = shade(leaf, -0.25);
  ctx.beginPath(); for (const [dx, dy, r] of blobs) { ctx.moveTo(t.x + dx * h + r * h, by + dy * h + 4); ctx.arc(t.x + dx * h, by + dy * h + 4, r * h, 0, Math.PI * 2); } ctx.fill();
  ctx.beginPath(); for (const [dx, dy, r] of blobs) { ctx.moveTo(t.x + dx * h + r * h, by + dy * h); ctx.arc(t.x + dx * h, by + dy * h, r * h, 0, Math.PI * 2); }
  ctx.fillStyle = vgrad(by - h, by - h * 0.35, shade(leaf, 0.18), shade(leaf, -0.12)); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.16)";
  ctx.beginPath(); for (const [dx, dy, r] of blobs) { ctx.moveTo(t.x + (dx - 0.05) * h + r * h * 0.5, by + (dy - 0.06) * h); ctx.arc(t.x + (dx - 0.05) * h, by + (dy - 0.06) * h, r * h * 0.5, 0, Math.PI * 2); } ctx.fill();
  // a couple of apples on every other tree
  if (t.c) { ctx.fillStyle = "#e0453b"; for (const [dx, dy] of [[-0.15, -0.6], [0.18, -0.7]]) { ctx.beginPath(); ctx.arc(t.x + dx * h, by + dy * h, 3.2, 0, Math.PI * 2); ctx.fill(); } }
}

// the airship: a striped balloon on ropes over a wooden hull, bobbing gently, with a spinning propeller
function drawAirship(x, y) {
  y += Math.sin(time * 1.4) * 3;
  ctx.strokeStyle = "rgba(90,60,30,.8)"; ctx.lineWidth = 1.4;
  for (const dx of [-40, -14, 14, 40]) { ctx.beginPath(); ctx.moveTo(x + dx * 0.9, y - 46); ctx.lineTo(x + dx * 0.7, y - 18); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(x, y - 76, 72, 34, 0, 0, Math.PI * 2); paint(vgrad(y - 110, y - 42, "#ffd27a", "#d8893a"), "rgba(90,45,10,.75)", 1.8);
  ctx.save(); ctx.clip();
  ctx.fillStyle = "rgba(200,70,50,.55)";
  for (const dx of [-48, -16, 16, 48]) { ctx.beginPath(); ctx.ellipse(x + dx, y - 76, 8, 36, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(x - 26, y - 92, 22, 7, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 64, y - 20); ctx.lineTo(x + 64, y - 20); ctx.quadraticCurveTo(x + 58, y + 8, x, y + 8); ctx.quadraticCurveTo(x - 58, y + 8, x - 64, y - 20); ctx.closePath();
  paint(vgrad(y - 20, y + 8, "#a06a3a", "#6a4224"), "rgba(50,30,15,.8)", 1.6);
  ctx.fillStyle = "#e7c45a"; ctx.fillRect(x - 60, y - 16, 120, 3);
  ctx.fillStyle = "rgba(60,40,20,.6)"; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(x + i * 16, y - 6, 2.6, 0, Math.PI * 2); ctx.fill(); }
  const spin = Math.abs(Math.sin(time * 18));
  ctx.fillStyle = "rgba(200,210,220,.8)"; ctx.beginPath(); ctx.ellipse(x - 70, y - 10, 3, 14 * spin + 2, 0, 0, Math.PI * 2); ctx.fill();
}
// the cloud town: the airship at the dock and a sign welcoming you
function drawCloudTown() {
  drawAirship(NPCS.gray2.x + 40, 640);
  const x = 520, y = 840;
  ctx.fillStyle = "#8a6237"; ctx.fillRect(x - 3, y - 60, 6, 60);
  ctx.beginPath(); rr(x - 46, y - 82, 92, 28, 5); paint(vgrad(y - 82, y - 54, "#fff6e0", "#e8d6a8"), "rgba(90,60,30,.7)", 1.4);
  ctx.font = `900 13px ${UI}`; ctx.textAlign = "center"; ctx.fillStyle = "#5a3a1a"; ctx.fillText("雲頂城", x, y - 63); ctx.textAlign = "left";
}

function drawVillage() {
  const hx = 8, hy = 840;
  // chimney behind the roof
  ctx.beginPath(); rr(hx + 78, hy - 132, 14, 34, 2); paint(vgrad(hy - 132, hy - 98, "#b9867a", "#8a5a4f"));
  const puff = (time * 0.6) % 1;
  ctx.fillStyle = `rgba(240,240,245,${0.55 * (1 - puff)})`; ctx.beginPath(); ctx.arc(hx + 86 + puff * 10, hy - 140 - puff * 30, 5 + puff * 7, 0, Math.PI * 2); ctx.fill();
  // plank walls
  ctx.beginPath(); ctx.rect(hx, hy - 78, 110, 78); paint(vgrad(hy - 78, hy, "#f6e8cc", "#dcc39a"), "rgba(80,50,30,.7)", 1.6);
  ctx.strokeStyle = "rgba(120,85,50,.25)"; ctx.lineWidth = 1;
  for (let y = hy - 66; y < hy; y += 12) { ctx.beginPath(); ctx.moveTo(hx + 1, y); ctx.lineTo(hx + 109, y); ctx.stroke(); }
  // roof with rows of tiles
  ctx.beginPath(); ctx.moveTo(hx - 14, hy - 74); ctx.lineTo(hx + 55, hy - 126); ctx.lineTo(hx + 124, hy - 74); ctx.closePath();
  paint(vgrad(hy - 126, hy - 74, "#e06a4f", "#b2432f"), "rgba(80,30,20,.8)", 1.8);
  ctx.save(); ctx.clip();
  ctx.strokeStyle = "rgba(90,25,15,.35)"; ctx.lineWidth = 1.2;
  for (let y = hy - 118; y < hy - 74; y += 9) {
    ctx.beginPath(); ctx.moveTo(hx - 14, y); ctx.lineTo(hx + 124, y); ctx.stroke();
    for (let x = hx - 14 + ((y / 9) & 1) * 8; x < hx + 124; x += 16) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 9); ctx.stroke(); }
  }
  ctx.restore();
  ctx.beginPath(); rr(hx - 16, hy - 77, 142, 5, 2.5); paint("#8a3a28", "rgba(60,20,10,.8)", 1.2);
  // door with a frame, a knob and a little sign
  ctx.beginPath(); rr(hx + 62, hy - 50, 30, 50, 3); paint("#5b3a24", null);
  ctx.beginPath(); rr(hx + 65, hy - 47, 24, 47, 10); paint(vgrad(hy - 47, hy, "#9a6236", "#6e4426"), "rgba(50,30,20,.8)", 1.2);
  ctx.strokeStyle = "rgba(40,25,15,.35)"; ctx.beginPath(); ctx.moveTo(hx + 77, hy - 44); ctx.lineTo(hx + 77, hy); ctx.stroke();
  ctx.fillStyle = "#e7c45a"; ctx.beginPath(); ctx.arc(hx + 84, hy - 22, 2.2, 0, Math.PI * 2); ctx.fill();
  // window with panes, curtains and a flower box
  ctx.beginPath(); ctx.rect(hx + 14, hy - 58, 32, 26); paint(vgrad(hy - 58, hy - 32, "#bfe8fb", "#7cc3e6"), "#7a4a2c", 3);
  ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.moveTo(hx + 17, hy - 55); ctx.lineTo(hx + 26, hy - 55); ctx.lineTo(hx + 17, hy - 44); ctx.fill();
  ctx.fillStyle = "#f3b6c4"; ctx.beginPath(); ctx.moveTo(hx + 15, hy - 57); ctx.quadraticCurveTo(hx + 22, hy - 48, hx + 15, hy - 34); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 45, hy - 57); ctx.quadraticCurveTo(hx + 38, hy - 48, hx + 45, hy - 34); ctx.fill();
  ctx.strokeStyle = "#7a4a2c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx + 30, hy - 58); ctx.lineTo(hx + 30, hy - 32); ctx.moveTo(hx + 14, hy - 45); ctx.lineTo(hx + 46, hy - 45); ctx.stroke();
  ctx.beginPath(); rr(hx + 11, hy - 32, 38, 7, 2); paint("#8a5a32");
  for (const [x, c] of [[17, "#ff6b8a"], [25, "#ffe066"], [33, "#ff9fc4"], [41, "#ffe066"]]) {
    ctx.fillStyle = "#4a9d3b"; ctx.fillRect(hx + x - 0.8, hy - 37, 1.6, 5);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(hx + x, hy - 38, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  drawStall(NPCS.molly.x, "#e88aa6", "red_pot");
  drawStall(NPCS.borin.x, "#d9823a", "iron_blade");
  drawAirship(NPCS.gray.x - 40, 640);
}

// a market stall behind a shopkeeper: posts, a striped awning, a counter and a hanging sign
function drawStall(x, stripe, sign) {
  const y = 840;
  ctx.fillStyle = "#7a5233"; ctx.fillRect(x - 46, y - 92, 5, 92); ctx.fillRect(x + 41, y - 92, 5, 92);
  ctx.beginPath(); ctx.moveTo(x - 54, y - 92); ctx.lineTo(x + 54, y - 92); ctx.lineTo(x + 50, y - 74); ctx.lineTo(x - 50, y - 74); ctx.closePath();
  paint("#fff6e6", "rgba(60,35,20,.7)", 1.4);
  ctx.save(); ctx.clip(); ctx.fillStyle = stripe;
  for (let i = -54; i < 54; i += 18) ctx.fillRect(x + i, y - 92, 9, 18);
  ctx.restore();
  ctx.fillStyle = stripe;
  for (let i = -50; i < 50; i += 12.5) { ctx.beginPath(); ctx.arc(x + i + 6.25, y - 74, 6.25, 0, Math.PI); ctx.fill(); }
  ctx.beginPath(); rr(x - 50, y - 30, 100, 30, 3); paint(vgrad(y - 30, y, "#b07a4a", "#7a5233"), "rgba(50,30,20,.7)", 1.4);
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(x - 48, y - 28, 96, 3);
  ctx.beginPath(); ctx.arc(x, y - 104, 11, 0, Math.PI * 2); paint("#f6e8cc", "rgba(60,35,20,.7)", 1.4);
  ctx.drawImage(itemIcon(sign).canvas, x - 9, y - 113, 18, 18);
}

// NPCs are drawn facing +x, then flipped to face the player. look picks the hair, clothes and prop.
function drawNpc(n) {
  const L = n.look, x = n.x, y = n.y, skin = vgrad(-55, -33, "#ffe8d4", "#f3bf95");
  ctx.save(); ctx.translate(x, y); ctx.scale(P.x + P.w / 2 < x ? -1 : 1, 1);
  ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.beginPath(); ctx.ellipse(0, 0, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = "round";
  if (L.prop === "staff") {
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(14, -2); ctx.lineTo(14, -60); ctx.stroke();
    ctx.strokeStyle = "#9a6a3f"; ctx.lineWidth = 3; ctx.stroke();
    const bob = Math.sin(time * 2.5) * 1.5;
    ctx.save(); ctx.shadowColor = "#7fe0d0"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(14, -76 + bob); ctx.lineTo(19, -68 + bob); ctx.lineTo(14, -61 + bob); ctx.lineTo(9, -68 + bob); ctx.closePath(); paint(gloss("#7fe0d0", -76, -61));
    ctx.restore();
  } else if (L.prop === "cane") {
    ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(15, -1); ctx.lineTo(14, -32); ctx.arc(10, -32, 4, 0, Math.PI, true); ctx.stroke();
    ctx.strokeStyle = "#8a5a32"; ctx.lineWidth = 2.6; ctx.stroke();
  } else if (L.prop === "rod") {
    ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(12, -26); ctx.lineTo(38, -84); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(38, -84); ctx.quadraticCurveTo(44, -50, 42, -30 + Math.sin(time * 2) * 2); ctx.stroke();
    ctx.fillStyle = "#e0453b"; ctx.beginPath(); ctx.arc(42, -30 + Math.sin(time * 2) * 2, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "butt";
  if (L.long) { ctx.beginPath(); ctx.moveTo(-12, -48); ctx.quadraticCurveTo(-17, -30, -12, -16); ctx.lineTo(-4, -22); ctx.lineTo(-2, -48); ctx.closePath(); paint(vgrad(-50, -16, shade(L.hair, 0.2), shade(L.hair, -0.12))); }
  // robe, with a sash, or an apron for the shopkeepers
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-12, -20, -9, -34); ctx.lineTo(9, -34); ctx.quadraticCurveTo(12, -20, 14, 0); ctx.closePath(); paint(gloss(L.robe, -34, 0));
  ctx.fillStyle = shade(L.robe, -0.3); ctx.fillRect(-13.6, -4, 27.2, 3);
  if (L.apron) {
    ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(6, -30); ctx.lineTo(10, -3); ctx.lineTo(-10, -3); ctx.closePath(); paint(vgrad(-30, -3, "#ffffff", "#e6dccb"), INK, 1.1);
    ctx.beginPath(); rr(-3, -16, 6, 5, 1.5); paint("#e6dccb", INK, 0.8);
  } else { ctx.beginPath(); rr(-10, -21, 20, 4, 2); paint("#e7c45a", INK, 1); }
  ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, -30); ctx.quadraticCurveTo(-7, -14, -9, -4); ctx.stroke();
  if (L.prop === "hammer") {
    ctx.save(); ctx.translate(13, -24); ctx.rotate(0.35);
    ctx.beginPath(); rr(-1.6, 0, 3.2, 22, 1.4); paint("#8a5a32");
    ctx.beginPath(); rr(-7, 18, 14, 9, 2); paint(gloss("#8f9cab", 18, 27));
    ctx.restore();
  }
  ctx.beginPath(); ctx.ellipse(8, -28, 5, 7, -0.6, 0, Math.PI * 2); paint(gloss(L.robe, -35, -21));
  ctx.beginPath(); ctx.arc(13, -32, 3.3, 0, Math.PI * 2); paint(vgrad(-35, -29, "#ffe8d4", "#f3bf95"), INK, 1.1);
  // face
  ctx.beginPath(); ctx.ellipse(1.5, -44, 11.5, 11, 0, 0, Math.PI * 2); paint(skin);
  eyes(4.5, 9.5, -44, 2.3, 0.6, blinking(n.x * 0.013), "#3a2a4a");
  if (L.beard) {
    ctx.beginPath(); ctx.moveTo(-6, -42); ctx.quadraticCurveTo(-4, -26, 6, -27); ctx.quadraticCurveTo(13, -30, 12, -40); ctx.quadraticCurveTo(7, -36, 0, -38); ctx.closePath();
    paint(vgrad(-42, -26, shade(L.beard, 0.15), shade(L.beard, -0.1)));
  } else { ctx.strokeStyle = "#9a4a3a"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(7.5, -39.5, 1.6, 0.2, Math.PI - 0.2); ctx.stroke(); }
  // hair, then a hat on top if there is one
  const hairFill = vgrad(-60, -44, shade(L.hair, 0.2), shade(L.hair, -0.12));
  if (L.bald) {
    ctx.beginPath(); ctx.ellipse(-8, -45, 4, 6, 0, 0, Math.PI * 2); paint(hairFill);
    ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.ellipse(-1, -52, 4, 2, -0.3, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-12, -46); ctx.quadraticCurveTo(-6, -61, 6, -58); ctx.quadraticCurveTo(14, -55, 13.5, -47);
    ctx.lineTo(10, -50); ctx.lineTo(7, -46); ctx.lineTo(4, -51); ctx.lineTo(0, -47); ctx.lineTo(-4, -51); ctx.lineTo(-7, -44); ctx.closePath();
    paint(hairFill);
    if (L.long || L.bun) { ctx.beginPath(); ctx.arc(-9, -53, 5.5, 0, Math.PI * 2); paint(vgrad(-59, -47, shade(L.hair, 0.2), shade(L.hair, -0.12))); }
  }
  if (L.strawHat) {
    ctx.beginPath(); ctx.ellipse(1, -53, 20, 4.5, 0, 0, Math.PI * 2); paint(vgrad(-58, -48, "#f6dc8a", "#d9b65a"));
    ctx.beginPath(); ctx.arc(1, -54, 10, Math.PI, 0); ctx.closePath(); paint(vgrad(-64, -54, "#f6dc8a", "#d9b65a"));
    ctx.fillStyle = "#c8553d"; ctx.fillRect(-9, -57, 20, 3);
  }
  ctx.restore();
  // name tag under the feet, as NPCs have
  ctx.font = `700 11px ${UI}`; ctx.textAlign = "center";
  const tw = ctx.measureText(n.name).width + 12;
  ctx.fillStyle = "rgba(20,24,30,.65)"; rr(x - tw / 2, y + 4, tw, 17, 4); ctx.fill();
  ctx.fillStyle = "#ffe48a"; ctx.fillText(n.name, x, y + 17);
  // a bouncing mark over the head: ! for something new, ? when a quest is ready to hand in
  const states = Object.values(QUESTS).filter(q => q.npc === n.id).map(questState);
  const mark = states.includes("ready") ? "?" : states.includes("available") || (n.id === "vera" && ((P.job === "beginner" && P.lv >= 8) || (SECOND[P.job] && P.lv >= 30))) ? "!" : "";
  if (mark) {
    const by = y - 96 + Math.sin(time * 4) * 3;
    ctx.fillStyle = "#ffc94a"; ctx.beginPath(); ctx.arc(x, by, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#8a5a00"; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `16px ${NUM}`; ctx.fillStyle = "#5a3a00"; ctx.fillText(mark, x, by + 6);
  }
  if (nearNpc() === n && dlg.hidden) {
    const t = "按 Space 或點我說話";
    ctx.font = `700 12px ${UI}`;
    const bw = ctx.measureText(t).width + 18, by = y - 124;
    ctx.fillStyle = "rgba(255,255,255,.95)"; rr(x - bw / 2, by, bw, 24, 8); ctx.fill();
    ctx.strokeStyle = "#c79a5b"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#33281c"; ctx.fillText(t, x, by + 16);
  }
  ctx.textAlign = "left";
}

function drawPlatform(p) {
  const th = map.theme;
  if (p.ground) {
    ctx.fillStyle = vgrad(p.y, WORLD_H + 40, th.dirt[0], shade(th.dirt[1], -0.1)); ctx.fillRect(p.x, p.y, p.w, WORLD_H - p.y + 40);
    ctx.fillStyle = "rgba(60,35,20,.25)"; ctx.fillRect(p.x, p.y + 8, p.w, 6);
    for (const s of p.stones) {
      ctx.beginPath(); ctx.ellipse(s.x, p.y + 26 + s.y * 30, s.r * 1.6, s.r, 0, 0, Math.PI * 2); paint(th.dirt[2], "rgba(50,30,20,.35)", 1);
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.ellipse(s.x - s.r * 0.4, p.y + 25 + s.y * 30 - s.r * 0.3, s.r * 0.6, s.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // a floating chunk of earth, rounded underneath, with hanging roots
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 4); ctx.lineTo(p.x + p.w, p.y + 4);
    ctx.lineTo(p.x + p.w - 10, p.y + 22);
    ctx.quadraticCurveTo(p.x + p.w / 2, p.y + 42, p.x + 10, p.y + 22);
    ctx.closePath(); paint(vgrad(p.y, p.y + 40, th.dirt[0], th.dirt[1]), "rgba(60,35,20,.7)", 1.6);
    ctx.fillStyle = "rgba(60,35,20,.22)"; ctx.fillRect(p.x + 2, p.y + 7, p.w - 4, 4);
    for (const s of p.stones) {
      ctx.beginPath(); ctx.ellipse(s.x, p.y + 16 + s.y * 6, s.r, s.r * 0.6, 0, 0, Math.PI * 2); paint(th.dirt[2], "rgba(50,30,20,.3)", 1);
    }
    ctx.strokeStyle = "#5f8a34"; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (const t of p.tufts) if (t.k > 0.7) {
      ctx.beginPath(); ctx.moveTo(t.x, p.y + 14); ctx.quadraticCurveTo(t.x + 4, p.y + 24, t.x - 2, p.y + 34 + t.k * 10); ctx.stroke();
      ctx.fillStyle = "#7fbf4a"; ctx.beginPath(); ctx.ellipse(t.x + 2, p.y + 26 + t.k * 4, 3, 1.6, 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineCap = "butt";
  }
  // grass: a rounded band with a scalloped lip hanging over the dirt and a sunlit top edge
  ctx.beginPath(); rr(p.x - 2, p.y - 4, p.w + 4, 11, 5); paint(vgrad(p.y - 4, p.y + 7, th.grass[0], th.grass[1]), "rgba(40,90,30,.7)", 1.3);
  ctx.fillStyle = th.grass[1];
  ctx.beginPath(); for (let x = p.x + 4; x < p.x + p.w - 4; x += 10) { ctx.moveTo(x + 5, p.y + 6); ctx.arc(x + 5, p.y + 6, 5, 0, Math.PI); } ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(p.x + 4, p.y - 3, p.w - 8, 1.6);
  for (const t of p.tufts) {
    ctx.fillStyle = th.tuft[0]; ctx.beginPath(); ctx.moveTo(t.x - 4, p.y - 2); ctx.lineTo(t.x - 1, p.y - 10 - t.k * 5); ctx.lineTo(t.x + 1, p.y - 2); ctx.fill();
    ctx.fillStyle = th.tuft[1]; ctx.beginPath(); ctx.moveTo(t.x - 1, p.y - 2); ctx.lineTo(t.x + 3, p.y - 8 - t.k * 4); ctx.lineTo(t.x + 5, p.y - 2); ctx.fill();
    if (t.k > 0.82) {
      // a flower: five petals round a yellow middle
      const fx0 = t.x + 9, fy0 = p.y - 7, col = t.k > 0.9 ? "#fff6d0" : "#ff9fc4";
      ctx.fillStyle = col;
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; ctx.beginPath(); ctx.arc(fx0 + Math.cos(a) * 2.4, fy0 + Math.sin(a) * 2.4, 1.8, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#ffcf3d"; ctx.beginPath(); ctx.arc(fx0, fy0, 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// a swirling gate of light; standing in it shows where it leads
function drawPortal(pt) {
  ctx.save(); ctx.translate(pt.x, pt.y - 36);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
  g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.35, "rgba(150,210,255,.75)"); g.addColorStop(1, "rgba(90,110,255,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 22, 38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) { const a = time * 3 + i * 2.1; ctx.beginPath(); ctx.ellipse(0, 0, 17 - i * 4.5, 31 - i * 8, 0, a, a + 2.2); ctx.stroke(); }
  ctx.lineCap = "butt";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 5; i++) {
    const k = (time * 0.7 + i / 5) % 1;
    ctx.beginPath(); ctx.arc(Math.sin(i * 2.4 + time * 2) * 12, 34 - k * 68, 1.8 * (1 - k) + 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (portalAt() === pt && !P.dead) {
    const t = `↑ 前往${MAPS[pt.to].name}`;
    ctx.font = `700 12px ${UI}`; ctx.textAlign = "center";
    const bw = ctx.measureText(t).width + 18, by = pt.y - 104;
    ctx.fillStyle = "rgba(14,22,40,.85)"; rr(pt.x - bw / 2, by, bw, 24, 8); ctx.fill();
    ctx.strokeStyle = "#7fd0ff"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#eef3fb"; ctx.fillText(t, pt.x, by + 16);
    ctx.textAlign = "left";
  }
}

function drawLadder(l) {
  // a twisted rope with knots, tied to a peg at the top
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(70,45,25,.8)"; ctx.lineWidth = 7.5;
  ctx.beginPath(); ctx.moveTo(l.x, l.top - 6); ctx.lineTo(l.x, l.bottom - 4); ctx.stroke();
  ctx.strokeStyle = "#c69a5e"; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = "#8a6237"; ctx.lineWidth = 1.6;
  for (let y = l.top; y < l.bottom - 8; y += 8) { ctx.beginPath(); ctx.moveTo(l.x - 2.5, y); ctx.lineTo(l.x + 2.5, y + 5); ctx.stroke(); }
  ctx.strokeStyle = "rgba(255,240,210,.5)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(l.x - 1.3, l.top); ctx.lineTo(l.x - 1.3, l.bottom - 6); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.beginPath(); ctx.arc(l.x, l.top - 6, 5, 0, Math.PI * 2); paint(gloss("#8a6237", -11 + l.top, l.top - 1));
}

function drawDrop(d) {
  const bob = d.landed ? Math.sin(d.ph * 4) * 2 - 4 : 0;
  const x = d.x, y = d.y - 8 + bob;
  if (d.kind === "coin") {
    const r = d.value > 40 ? 9 : d.value > 15 ? 7.5 : 6;
    // a spinning coin: dark rim, bright face, a stamped dot, and a glint now and then
    const sq = Math.abs(Math.cos(d.ph * 3)), rw = r * (0.35 + 0.65 * sq);
    ctx.beginPath(); ctx.ellipse(x, y, rw, r, 0, 0, Math.PI * 2); paint("#c98a12", "rgba(90,55,0,.8)", 1.2);
    ctx.fillStyle = vgrad(y - r, y + r, "#fff0a0", "#f0b52a"); ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rw - 1.8), r - 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(160,100,0,.55)"; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.3, rw * 0.35), r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillRect(x - rw * 0.45, y - r + 2.5, 1.8, 3);
  } else ctx.drawImage(itemIcon(d.id).canvas, x - 13, y - 20, 26, 26);
  // a little four-point sparkle drifts over things on the ground
  const tw = (d.ph * 0.8) % 2.5;
  if (d.landed && tw < 0.5) {
    const s = Math.sin(tw / 0.5 * Math.PI) * 4, sx = x + 7, sy = y - 12;
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath(); ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * 0.25, sy); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s * 0.25, sy); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - s, sy); ctx.lineTo(sx, sy + s * 0.25); ctx.lineTo(sx + s, sy); ctx.lineTo(sx, sy - s * 0.25); ctx.closePath(); ctx.fill();
  }
}

// Item icons are painted once into a 32x32 box (64 px canvas) with the same code as the world,
// then reused for drops on the ground and as images in the bag and equipment windows.
const iconCache = {};
function itemIcon(id) {
  if (!iconCache[id]) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.scale(2, 2);
    const main = ctx;
    ctx = g;
    try { paintItem(ITEMS[id]); } finally { ctx = main; }
    iconCache[id] = { canvas: c, url: c.toDataURL() };
  }
  return iconCache[id];
}
// icon shapes: glossy fill from light to dark, a dark outline, and a soft shine along the top
function shape(color, path) {
  ctx.beginPath(); path();
  paint(color.startsWith("#") ? gloss(color, 4, 28) : color, INK, 1.3);
  ctx.save(); ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.fillRect(0, 0, 32, 11);
  ctx.restore();
}
const poly = (...pts) => () => { for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); };
function paintItem(I) {
  const c = I.color || "#9fb0cd";
  if (I.wtype) {
    // [scale, angle, offset along the weapon to its middle]
    const [s, a, mid] = { sword: [0.68, 0.785, 16], wand: [0.7, 0.785, 16], bow: [0.78, -0.785, -6], claw: [1.35, 0.4, 6] }[I.wtype];
    ctx.translate(16, 16); ctx.scale(s, s); ctx.rotate(a); ctx.translate(0, mid);
    drawWeapon(I.wtype, 0, I.color);
    return;
  }
  const kind = I.slot || (I.heal ? "pot" : I.warp || I.scroll ? "scroll" : I.ammo) || I.icon || I.id.split("_").pop();
  if (kind === "hat") {
    shape(c, () => { ctx.arc(16, 20, 11, Math.PI, 0); ctx.closePath(); });
    shape(c, () => rr(3, 18, 26, 5, 2.5));
  } else if (kind === "top") {
    shape(c, poly(10, 6, 22, 6, 29, 12, 25, 17, 23, 15, 23, 27, 9, 27, 9, 15, 7, 17, 3, 12));
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(13, 6, 6, 3);
  } else if (kind === "bottom") {
    shape(c, poly(8, 5, 24, 5, 25, 28, 18, 28, 16, 13, 14, 28, 7, 28));
  } else if (kind === "shoes") {
    shape(c, poly(7, 7, 16, 7, 16, 17, 27, 20, 27, 26, 7, 26));
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(7, 23, 20, 3);
  } else if (kind === "gloves") {
    shape(c, () => rr(5, 12, 7, 9, 3.5));
    shape(c, () => rr(10, 6, 13, 18, 6));
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(10, 22, 13, 5);
  } else if (kind === "cape") {
    shape(c, poly(11, 5, 21, 5, 27, 28, 5, 28));
    ctx.fillStyle = "#ffc94a"; ctx.beginPath(); ctx.arc(16, 7, 2.6, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "shield") {
    shape(c, () => ctx.arc(16, 16, 12, 0, Math.PI * 2));
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(16, 16, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#cfd8e3"; ctx.beginPath(); ctx.arc(16, 16, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "pot") {
    ctx.fillStyle = "#e9eef5"; ctx.fillRect(13, 5, 6, 6);
    ctx.fillStyle = "#8a6237"; ctx.fillRect(12.5, 3, 7, 3);
    shape(c, () => ctx.arc(16, 19, 9, 0, Math.PI * 2));
    ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.arc(12.5, 16, 3, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "scroll") {
    // a parchment with rolled ends and a red wax seal
    shape(c, () => rr(7, 7, 18, 18, 1.5));
    shape(shade(c, -0.15), () => rr(4, 4, 24, 5, 2.5));
    shape(shade(c, -0.15), () => rr(4, 23, 24, 5, 2.5));
    ctx.strokeStyle = "rgba(90,60,30,.45)"; ctx.lineWidth = 1;
    for (const y of [12, 15, 18]) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(22, y); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(21, 21, 3.4, 0, Math.PI * 2); paint(I.seal || "#d23b3b", INK, 1);
  } else if (kind === "bow") {
    // a bundle of three arrows
    for (const o of [-4, 0, 4]) {
      ctx.save(); ctx.translate(16 + o, 16); ctx.rotate(-0.785);
      ctx.strokeStyle = "#8a5a32"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(9, 0); ctx.stroke();
      ctx.fillStyle = "#cfd8e3"; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(8, -3); ctx.lineTo(8, 3); ctx.fill();
      ctx.fillStyle = "#f1ead8"; ctx.fillRect(-13, -2.5, 4, 1.6); ctx.fillRect(-13, 1, 4, 1.6);
      ctx.restore();
    }
  } else if (kind === "claw") {
    ctx.translate(16, 16);
    shape(c, () => { for (let i = 0; i < 8; i++) { const r = i % 2 ? 4.5 : 13, a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); });
    ctx.fillStyle = "#3b4a63"; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "gel") {
    shape(c, () => ctx.ellipse(16, 19, 11, 8, 0, 0, Math.PI * 2));
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(12, 16, 3.5, 2, -0.4, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "earring") {
    ctx.strokeStyle = "#d8b050"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(16, 9, 4, Math.PI * 0.2, Math.PI * 1.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 13); ctx.lineTo(16, 16); ctx.stroke();
    shape(c, poly(16, 15, 22, 22, 16, 29, 10, 22));
  } else if (kind === "necklace") {
    ctx.strokeStyle = "#d8b050"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(16, 12, 11, 9, 0, 0.15, Math.PI - 0.15); ctx.stroke();
    shape(c, () => ctx.arc(16, 23, 6, 0, Math.PI * 2));
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.arc(14, 21, 1.8, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "ring") {
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(16, 19, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#e7c45a"; ctx.lineWidth = 3.6; ctx.stroke();
    shape(c, poly(16, 4, 21, 9, 16, 14, 11, 9));
  } else if (kind === "card") {
    // a little card with a gold border and a star
    shape("#3b4a63", () => rr(7, 3, 18, 26, 3));
    ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.strokeRect(9.5, 5.5, 13, 21);
    ctx.fillStyle = c; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.4 : 6, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  } else if (kind === "chair") {
    ctx.translate(16, 28); ctx.scale(0.62, 0.62);
    drawChair(I.id, true); drawChair(I.id, false);
  } else if (kind === "book") {
    // a thick book with a gem on the cover in the job's colour
    shape("#f0e6d0", () => rr(8, 5, 18, 23, 2));
    shape(c, () => rr(6, 4, 18, 23, 2.5));
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(6, 4, 3, 23);
    ctx.strokeStyle = "#ffe48a"; ctx.lineWidth = 1.2; ctx.strokeRect(11, 8, 10, 15);
    ctx.beginPath(); ctx.moveTo(16, 11); ctx.lineTo(19, 15.5); ctx.lineTo(16, 20); ctx.lineTo(13, 15.5); ctx.closePath(); paint("#ffffff", INK, 1);
  } else if (kind === "food") {
    // a little bowl heaped with kibble
    for (const [x, y] of [[11, 13], [16, 11], [21, 13], [13.5, 16], [18.5, 16]]) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); paint(gloss(c, y - 3, y + 3), INK, 1); }
    shape("#e88ab0", () => { ctx.moveTo(4, 16); ctx.lineTo(28, 16); ctx.quadraticCurveTo(27, 27, 16, 27); ctx.quadraticCurveTo(5, 27, 4, 16); ctx.closePath(); });
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(16, 21, 2.2, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "shard") {
    shape(c, poly(16, 4, 27, 24, 19, 28, 5, 20));
    ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.moveTo(16, 4); ctx.lineTo(14, 22); ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 13);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, c); g.addColorStop(1, "rgba(80,140,60,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 13, 0, Math.PI * 2); ctx.fill();
  }
}

function drawMob(m) {
  if (m.alpha <= 0) return;
  const cx = m.x + m.w / 2, by = m.y + m.h;
  ctx.save();
  ctx.globalAlpha = m.alpha;
  ctx.translate(cx, by - (m.dead ? (1 - m.alpha) * 18 : 0));
  // shadow
  ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(0, 0, m.w * 0.45, 4, 0, 0, Math.PI * 2); ctx.fill();
  const white = m.flash > 0;
  const f = m.dir;
  // hidden in the sand: only a moving heap shows where it is
  if (m.under) { drawMound(m); ctx.restore(); return; }
  // coming out of the sand: it rises out of the ground
  if (m.surf > 0) { ctx.beginPath(); ctx.rect(-m.w * 2, -400, m.w * 4, 400); ctx.clip(); ctx.translate(0, m.h * 0.8 * (m.surf / 0.4)); }
  if (m.t === "jelly" || m.t === "bjelly") {
    const walking = m.state === "walk" || m.aggro > 0;
    const hop = walking ? Math.abs(Math.sin(m.ph * 7)) * 8 : 0;
    const sq = 1 + (walking ? Math.cos(m.ph * 14) * 0.08 : Math.sin(m.ph * 3) * 0.04);
    ctx.translate(0, -hop);
    ctx.scale(sq, 1 / sq);
    const hw = m.w / 2, h = m.h;
    const base = m.t === "jelly" ? "#4cc46a" : "#4a8fe0";
    // a leaf sprout on the green ones, a curl of water on the blue ones
    if (m.t === "jelly") {
      ctx.strokeStyle = "#3a7a3a"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -h * 0.95); ctx.quadraticCurveTo(2, -h * 1.12, -1, -h * 1.22); ctx.stroke();
      ctx.save(); ctx.translate(-1, -h * 1.2); ctx.rotate(-0.6 + Math.sin(m.ph * 3) * 0.15);
      ctx.beginPath(); ctx.ellipse(5, 0, 6, 2.8, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss("#7fd36b", -3, 3), INK, 1);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.moveTo(0, -h * 1.22); ctx.quadraticCurveTo(4, -h * 1.04, 0, -h * 0.94); ctx.quadraticCurveTo(-4, -h * 1.04, 0, -h * 1.22);
      paint(white ? "#fff" : "#9cc8ff", INK, 1);
    }
    ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.bezierCurveTo(-hw, -h * 1.3, hw, -h * 1.3, hw, 0); ctx.quadraticCurveTo(0, 3, -hw, 0); ctx.closePath();
    const g = ctx.createRadialGradient(-hw * 0.3, -h * 0.75, 2, 0, -h * 0.4, hw * 1.3);
    g.addColorStop(0, shade(base, 0.55)); g.addColorStop(0.55, base); g.addColorStop(1, shade(base, -0.3));
    paint(white ? "#ffffff" : g, shade(base, -0.5), 1.8);
    ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.beginPath(); ctx.ellipse(0, -h * 0.13, hw * 0.7, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.beginPath(); ctx.ellipse(-hw * 0.45, -h * 0.68, hw * 0.2, h * 0.11, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-hw * 0.16, -h * 0.84, 1.8, 0, Math.PI * 2); ctx.fill();
    eyes(f * hw * 0.08, f * hw * 0.5, -h * 0.47, 3.3, f * 0.8, blinking(m.ph * 0.37));
    if (m.aggro > 0) {
      ctx.strokeStyle = "#1d2a22"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(f * hw * -0.06, -h * 0.72); ctx.lineTo(f * hw * 0.2, -h * 0.64); ctx.moveTo(f * hw * 0.66, -h * 0.72); ctx.lineTo(f * hw * 0.38, -h * 0.64); ctx.stroke();
      ctx.lineCap = "butt";
    }
    ctx.strokeStyle = "#1d2a22"; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(f * hw * 0.29, -h * 0.29, 2.2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = "rgba(255,120,140,.45)";
    ctx.beginPath(); ctx.ellipse(f * hw * 0.78, -h * 0.32, 2.8, 1.8, 0, 0, Math.PI * 2); ctx.ellipse(-f * hw * 0.22, -h * 0.32, 2.8, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  } else if (m.t === "shell") {
    const step = (m.state === "walk" || m.aggro > 0) ? Math.sin(m.ph * 10) * 3 : 0;
    const hw = m.w / 2, skin = "#a7c35a";
    ctx.scale(f, 1);
    for (const [x, s] of [[-14, step], [-4, -step], [8, step], [16, -step]]) {
      ctx.beginPath(); ctx.ellipse(x + s * 0.5, -3, 5.5, 4.5, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss(skin, -8, 1));
    }
    ctx.beginPath(); ctx.ellipse(hw - 3, -9, 6, 5, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss(skin, -14, -4));
    ctx.beginPath(); ctx.arc(hw + 2, -14, 9, 0, Math.PI * 2); paint(white ? "#fff" : gloss(skin, -23, -5));
    ctx.beginPath(); ctx.arc(hw + 5, -16, 3, 0, Math.PI * 2); paint("#ffffff", INK, 1);
    if (blinking(m.ph * 0.5)) { ctx.fillStyle = shade(skin, -0.2); ctx.beginPath(); ctx.arc(hw + 5, -16, 3, 0, Math.PI * 2); ctx.fill(); }
    else {
      ctx.fillStyle = "#1d2a22"; ctx.beginPath(); ctx.arc(hw + 5.8, -15.6, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hw + 5.2, -16.6, 0.7, 0, Math.PI * 2); ctx.fill();
    }
    if (m.aggro > 0) { ctx.strokeStyle = "#1d2a22"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(hw + 1.5, -21); ctx.lineTo(hw + 8, -19); ctx.stroke(); }
    ctx.strokeStyle = "#3a4a22"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hw + 6, -9.5); ctx.lineTo(hw + 10, -10); ctx.stroke();
    // shell: a glossy dome with plates, a pale rim and bone spikes
    const shell = "#3d8c84";
    ctx.beginPath(); ctx.moveTo(-hw, -4); ctx.bezierCurveTo(-hw, -m.h * 1.15, hw, -m.h * 1.15, hw, -4); ctx.closePath();
    paint(white ? "#fff" : gloss(shell, -m.h, -4), "#1f4f4a", 1.8);
    ctx.save(); ctx.clip();
    ctx.strokeStyle = "rgba(20,60,55,.5)"; ctx.lineWidth = 1.4;
    for (const [x, y] of [[-12, -20], [2, -24], [14, -18], [-4, -11], [10, -9], [-17, -8]]) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * 6.5, y + Math.sin(a) * 5.5); }
      ctx.closePath(); ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.ellipse(-8, -22, 8, 3.5, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.beginPath(); rr(-hw - 1, -7.5, m.w + 2, 5, 2.5); paint(white ? "#fff" : vgrad(-7.5, -2.5, "#f3e3b0", "#c9b07a"), INK, 1.2);
    for (let i = -2; i <= 2; i++) {
      const a = -Math.PI / 2 + i * 0.42, r = m.h * 0.78;
      const sx = Math.cos(a) * hw * 0.85, sy = -4 + Math.sin(a) * r;
      ctx.beginPath(); ctx.moveTo(sx - 4, sy + 3); ctx.lineTo(sx + Math.cos(a) * 11, sy + Math.sin(a) * 11); ctx.lineTo(sx + 4, sy + 3); ctx.closePath();
      paint(white ? "#fff" : vgrad(sy - 8, sy + 3, "#fff8e0", "#d9c28a"), INK, 1);
    }
  } else if (m.t === "boss") {
    const wind = m.wind > 0 ? 1 - m.wind / m.T.slam.wind : 0;
    const shake = m.wind > 0 ? Math.sin(m.ph * 60) * 2 : 0;
    const b = Math.sin(m.ph * 2) * 2;
    ctx.translate(shake, 0);
    ctx.scale(f, 1);
    const stone = "#8a958e", moss = "#5f9e4b";
    const rock = (y0, y1) => white ? "#fff" : vgrad(y0, y1, "#a9b3ad", "#606b65");
    for (const x of [-36, 12]) { ctx.beginPath(); rr(x, -32, 24, 32, 6); paint(rock(-32, 0), "#2f3532", 2); }
    ctx.beginPath(); rr(-50, -108 + b, 100, 84, 20); paint(rock(-108 + b, -24 + b), "#2f3532", 2.2);
    // cracks and a few loose stones
    ctx.strokeStyle = "rgba(40,48,44,.55)"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-34, -70 + b); ctx.lineTo(-24, -60 + b); ctx.lineTo(-28, -46 + b);
    ctx.moveTo(30, -52 + b); ctx.lineTo(22, -42 + b); ctx.lineTo(26, -32 + b); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.ellipse(-24, -94 + b, 18, 6, -0.2, 0, Math.PI * 2); ctx.fill();
    // a rune on the chest that flares red before a slam
    const glow = m.wind > 0 ? "#ff5a3a" : "#ffb347";
    ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 10 + wind * 14;
    ctx.strokeStyle = glow; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(10, -52 + b, 9, 0, Math.PI * 2); ctx.moveTo(10, -61 + b); ctx.lineTo(10, -43 + b); ctx.moveTo(3, -56 + b); ctx.lineTo(17, -48 + b); ctx.stroke();
    ctx.restore();
    // moss cap with drips, grass and a flower
    ctx.beginPath(); ctx.moveTo(-50, -94 + b); ctx.quadraticCurveTo(-52, -116 + b, -30, -114 + b); ctx.lineTo(30, -116 + b); ctx.quadraticCurveTo(52, -116 + b, 50, -94 + b);
    for (let x = 46; x >= -46; x -= 12) ctx.quadraticCurveTo(x - 3, -88 + b + (x % 24 ? 8 : 2), x - 12, -94 + b);
    ctx.closePath(); paint(white ? "#fff" : gloss(moss, -116 + b, -86 + b), "#2f5a2a", 1.8);
    ctx.fillStyle = "#4a8a3a";
    for (const x of [-38, -26, -10, 6, 22, 38]) { ctx.beginPath(); ctx.moveTo(x - 3, -114 + b); ctx.lineTo(x + 1, -124 + b - (x & 3)); ctx.lineTo(x + 3, -114 + b); ctx.fill(); }
    ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(-20, -118 + b, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff9fc4"; ctx.beginPath(); ctx.arc(-20, -118 + b, 1.4, 0, Math.PI * 2); ctx.fill();
    // arms
    const armA = -wind * 2.4;
    [[-52, -1], [52, 1]].forEach(([ax, s]) => {
      ctx.save(); ctx.translate(ax, -92 + b); ctx.rotate(armA * s);
      ctx.beginPath(); rr(-12, 0, 24, 58, 10); paint(rock(0, 58), "#2f3532", 2);
      ctx.beginPath(); rr(-16, 44, 32, 24, 9); paint(white ? "#fff" : vgrad(44, 68, "#8a958e", "#4f5954"), "#2f3532", 2);
      ctx.strokeStyle = "rgba(40,48,44,.5)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-6, 46); ctx.lineTo(-6, 56); ctx.moveTo(4, 46); ctx.lineTo(4, 56); ctx.stroke();
      if (!white) { ctx.fillStyle = moss; ctx.beginPath(); ctx.ellipse(0, 2, 12, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    // brow ridge and glowing eyes
    ctx.fillStyle = white ? "#eee" : "#505a55"; ctx.beginPath(); rr(-2, -96 + b, 46, 8, 4); ctx.fill();
    ctx.save(); ctx.fillStyle = glow; ctx.shadowColor = glow; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(11, -84 + b, 6.5, 3.5, 0, 0, Math.PI * 2); ctx.ellipse(32, -84 + b, 6.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff8d0"; ctx.beginPath(); ctx.arc(12.5, -84.5 + b, 1.6, 0, Math.PI * 2); ctx.arc(33.5, -84.5 + b, 1.6, 0, Math.PI * 2); ctx.fill();
  } else if (m.t === "mush") {
    // a hopping mushroom: a pale stem with a face under a spotted violet cap
    const walking = m.state === "walk" || m.aggro > 0;
    ctx.translate(0, walking ? -Math.abs(Math.sin(m.ph * 6)) * 7 : 0);
    ctx.scale(f, 1);
    ctx.beginPath(); rr(-11, -25, 22, 25, 9); paint(white ? "#fff" : vgrad(-25, 0, "#fff3e0", "#e0caa6"));
    eyes(1, 8, -14, 2.4, 0.6, blinking(m.ph * 0.4));
    if (m.aggro > 0) { ctx.strokeStyle = "#3a2a2a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -20); ctx.lineTo(3, -18); ctx.moveTo(11, -20); ctx.lineTo(6, -18); ctx.stroke(); }
    ctx.strokeStyle = "#6a3a2a"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(5, -8, 2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-21, -20); ctx.bezierCurveTo(-23, -47, 23, -47, 21, -20); ctx.quadraticCurveTo(0, -14, -21, -20); ctx.closePath();
    paint(white ? "#fff" : gloss("#8a6fb8", -44, -18), "#3a2a5a", 1.6);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (const [x, y, rx, ry] of [[-10, -32, 4.5, 3], [6, -37, 5, 3.4], [14, -26, 3.2, 2.4], [-16, -24, 2.6, 2]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  } else if (m.t === "lizard") {
    // a long lizard with stone plates down its back and a swishing tail
    const walking = m.state === "walk" || m.aggro > 0, step = walking ? Math.sin(m.ph * 10) * 3 : 0, skin = "#7a8a5a";
    ctx.scale(f, 1);
    ctx.beginPath(); ctx.moveTo(-20, -16); ctx.quadraticCurveTo(-40, -14, -46, -4 + Math.sin(m.ph * 4) * 3); ctx.quadraticCurveTo(-34, -6, -18, -6); ctx.closePath();
    paint(white ? "#fff" : gloss(skin, -16, -4));
    for (const [x, s2] of [[-15, step], [-5, -step], [10, step], [19, -step]]) { ctx.beginPath(); rr(x - 3 + s2 * 0.5, -9, 6, 9, 2.5); paint(white ? "#fff" : gloss(shade(skin, -0.15), -9, 0)); }
    ctx.beginPath(); ctx.ellipse(0, -15, 27, 11, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss(skin, -26, -4));
    ctx.fillStyle = "rgba(255,240,200,.3)"; ctx.beginPath(); ctx.ellipse(3, -9, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
    for (const x of [-15, -5, 5, 15]) {
      ctx.beginPath(); ctx.moveTo(x - 6, -22); ctx.lineTo(x, -31); ctx.lineTo(x + 6, -22); ctx.closePath();
      paint(white ? "#fff" : vgrad(-31, -22, "#c9cfd6", "#7f8a96"), INK, 1);
    }
    ctx.beginPath(); ctx.ellipse(28, -16, 11, 8, 0.1, 0, Math.PI * 2); paint(white ? "#fff" : gloss(skin, -24, -8));
    ctx.beginPath(); ctx.arc(31, -19, 3.2, 0, Math.PI * 2); paint("#ffe066", INK, 1);
    ctx.fillStyle = "#1d2a22"; ctx.fillRect(30.4, -21.6, 1.4, 5.2);
    ctx.strokeStyle = "#2f3a22"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(30, -12); ctx.lineTo(38, -13); ctx.stroke();
  } else if (m.t === "crab") {
    // a giant crab: legs, a domed shell, eyes on stalks and two pincers that rise before it smashes
    const wind = m.wind > 0 ? 1 - m.wind / m.T.slam.wind : 0, shake = m.wind > 0 ? Math.sin(m.ph * 60) * 2 : 0;
    const b = Math.sin(m.ph * 3) * 1.5, walk = Math.sin(m.ph * 8) * 3, shell = "#d0563a";
    ctx.translate(shake, 0); ctx.scale(f, 1);
    ctx.lineCap = "round";
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const path = () => { ctx.beginPath(); ctx.moveTo(side * (24 + i * 12), -32); ctx.lineTo(side * (54 + i * 8), -46 + walk * (i % 2 ? 1 : -1)); ctx.lineTo(side * (60 + i * 7), 0); };
      path(); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke();
      path(); ctx.strokeStyle = white ? "#fff" : shade(shell, -0.15); ctx.lineWidth = 5; ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.beginPath(); ctx.ellipse(0, -42 + b, 56, 32, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss(shell, -74, -10), "#5a1a10", 2.2);
    ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-12, -58 + b, 22, 7, -0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(90,20,10,.35)";
    for (const [x, y] of [[-26, -40], [-8, -32], [14, -44], [30, -34], [4, -54]]) { ctx.beginPath(); ctx.arc(x, y + b, 3.5, 0, Math.PI * 2); ctx.fill(); }
    for (const x of [-12, 12]) {
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, -70 + b); ctx.lineTo(x * 1.2, -88 + b); ctx.stroke();
      ctx.beginPath(); ctx.arc(x * 1.2, -92 + b, 6.5, 0, Math.PI * 2); paint("#ffffff", INK, 1.4);
      ctx.fillStyle = m.wind > 0 ? "#c0261a" : "#1d1a22"; ctx.beginPath(); ctx.arc(x * 1.2 + 2, -91 + b, 3, 0, Math.PI * 2); ctx.fill();
    }
    const claw = (x, big) => {
      ctx.save(); ctx.translate(x, -40 + b); ctx.rotate((x > 0 ? 1 : -1) * (0.35 + wind * 0.5) - wind * 0.6);
      ctx.beginPath(); rr(-7, -36, 14, 38, 7); paint(white ? "#fff" : gloss(shell, -36, 2), "#5a1a10", 1.8);
      ctx.translate(0, -40);
      const r = big ? 22 : 16, open = 0.25 + wind * 0.45;
      for (const jaw of [-1, 1]) {
        ctx.save(); ctx.rotate(jaw * open);
        ctx.beginPath(); ctx.ellipse(jaw * r * 0.32, -r * 0.55, r * 0.42, r, 0, 0, Math.PI * 2);
        paint(white ? "#fff" : gloss(shell, -r * 1.6, r * 0.2), "#5a1a10", 1.8);
        ctx.restore();
      }
      ctx.restore();
    };
    claw(-60, false); claw(62, true);
  } else if (m.t === "shadow" || m.t === "shadow2") {
    // your own shadow, half again your size: your outline in dark violet, red eyes, your weapon, smoke rising off it
    const walking = m.state === "walk" || m.aggro > 0, sw = walking ? Math.sin(m.ph * 12) : 0;
    const wind = m.wind > 0 ? 1 - m.wind / m.T.slam.wind : 0;
    ctx.fillStyle = "rgba(120,80,180,.18)";
    for (let i = 0; i < 5; i++) { const k = (m.ph * 0.6 + i / 5) % 1; ctx.beginPath(); ctx.arc(Math.sin(i * 2.3 + m.ph) * 22, -k * 120, 8 + k * 10, 0, Math.PI * 2); ctx.fill(); }
    const big = m.t === "shadow2" ? 1.75 : 1.5;
    ctx.scale(f * big, big);
    const dark = white ? "#fff" : vgrad(-58, 0, m.t === "shadow2" ? "#8a2a3a" : "#5a4a7a", "#1a1028"), edge = "#0a0610";
    for (const [x, a] of [[-4, sw * 0.6], [4, -sw * 0.6]]) { ctx.save(); ctx.translate(x, -13); ctx.rotate(a); ctx.beginPath(); rr(-3.4, -1, 6.8, 14, 2.5); paint(dark, edge, 1.2); ctx.restore(); }
    ctx.beginPath(); rr(-10, -32, 20, 20, 6); paint(dark, edge, 1.2);
    ctx.save(); ctx.translate(5, -24); drawWeapon(weapon()?.wtype || "sword", wind ? -2.3 + wind * 3.4 : 2.3 + sw * 0.15, "#4a3a6a"); ctx.restore();
    ctx.beginPath(); ctx.arc(1, -43, 13, 0, Math.PI * 2); paint(dark, edge, 1.2);
    ctx.beginPath(); ctx.moveTo(-12, -46); ctx.lineTo(-16, -56); ctx.lineTo(-6, -52); ctx.lineTo(0, -60); ctx.lineTo(6, -53); ctx.lineTo(14, -56); ctx.lineTo(12, -44); ctx.closePath(); paint(dark, edge, 1);
    ctx.save(); ctx.fillStyle = "#ff3a4a"; ctx.shadowColor = "#ff3a4a"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.ellipse(5, -43, 2.4, 1.5, 0, 0, Math.PI * 2); ctx.ellipse(10.5, -43, 2.4, 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (m.t === "sheep") {
    // a fluffy sheep made of cloud, with a dark face and curled horns
    const walking = m.state === "walk" || m.aggro > 0, step = walking ? Math.sin(m.ph * 10) * 3 : 0;
    ctx.scale(f, 1);
    for (const [x, s2] of [[-14, step], [-6, -step], [6, step], [14, -step]]) { ctx.beginPath(); rr(x - 2.5 + s2 * 0.5, -12, 5, 12, 2); paint("#4a4a5a"); }
    ctx.translate(0, walking ? -Math.abs(Math.sin(m.ph * 8)) * 3 : 0);
    const puffs = [[-13, -22, 11], [0, -28, 12], [12, -22, 11], [-7, -14, 10], [7, -14, 10], [0, -19, 12]];
    ctx.beginPath(); for (const [x, y, r] of puffs) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
    ctx.fillStyle = white ? "#fff" : vgrad(-40, -4, "#ffffff", "#d6e2f2"); ctx.fill();
    ctx.strokeStyle = "rgba(90,110,150,.45)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(21, -22, 8, 10, 0.15, 0, Math.PI * 2); paint(white ? "#fff" : "#4a4a5a");
    ctx.strokeStyle = "#d8b06a"; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(16, -30, 5, Math.PI * 0.9, Math.PI * 2.3); ctx.stroke();
    if (!blinking(m.ph * 0.4)) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(24, -24, 2, 0, Math.PI * 2); ctx.fill(); }
    if (m.aggro > 0) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(21, -29); ctx.lineTo(26, -27); ctx.stroke(); }
  } else if (m.t === "sprite") {
    // a bell-shaped wind spirit floating above the ground on fluttering wings
    ctx.translate(0, -10 - Math.sin(m.ph * 3) * 4);
    ctx.scale(f, 1);
    const flap = Math.sin(m.ph * 14) * 0.4;
    for (const s2 of [-1, 1]) {
      ctx.save(); ctx.translate(s2 * 9, -26); ctx.rotate(s2 * (0.5 + flap));
      ctx.fillStyle = "rgba(210,255,250,.55)"; ctx.beginPath(); ctx.ellipse(s2 * 10, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(-15, -2); ctx.quadraticCurveTo(-16, -40, 0, -40); ctx.quadraticCurveTo(16, -40, 15, -2); ctx.quadraticCurveTo(0, 2, -15, -2); ctx.closePath();
    paint(white ? "#fff" : gloss("#7fd8cc", -40, 0), "#2f6f6a", 1.6);
    ctx.beginPath(); rr(-17, -6, 34, 5, 2.5); paint(white ? "#fff" : "#e7c45a", INK, 1);
    ctx.beginPath(); ctx.arc(0, 3 + Math.sin(m.ph * 6) * 2, 3.2, 0, Math.PI * 2); paint("#e7c45a", INK, 1);
    eyes(-1, 7, -22, 2.4, 0.6, blinking(m.ph * 0.5), "#1f4f4a");
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(-6, -30, 6, Math.PI, Math.PI * 1.6); ctx.stroke();
  } else if (m.t === "rhino") {
    // a heavy storm rhino with a horn that crackles yellow
    const walking = m.state === "walk" || m.aggro > 0, step = walking ? Math.sin(m.ph * 9) * 3 : 0, hide = "#4a5a80";
    ctx.scale(f, 1);
    for (const [x, s2] of [[-22, step], [-10, -step], [12, step], [24, -step]]) { ctx.beginPath(); rr(x - 5 + s2 * 0.5, -16, 10, 16, 3); paint(white ? "#fff" : gloss(shade(hide, -0.15), -16, 0)); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-34, -28); ctx.quadraticCurveTo(-42, -24, -40, -16); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -26, 34, 18, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss(hide, -44, -8), "#1f2a40", 1.8);
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2;
    for (const x of [-16, -4, 8]) { ctx.beginPath(); ctx.arc(x, -26, 12, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(32, -24, 14, 12, 0.1, 0, Math.PI * 2); paint(white ? "#fff" : gloss(hide, -36, -12), "#1f2a40", 1.6);
    ctx.save(); ctx.shadowColor = "#ffe066"; ctx.shadowBlur = m.aggro > 0 ? 12 : 6;
    ctx.beginPath(); ctx.moveTo(38, -28); ctx.lineTo(54, -46); ctx.lineTo(44, -24); ctx.closePath(); paint(vgrad(-46, -24, "#fff6b0", "#e0b62a"), INK, 1.2);
    ctx.restore();
    ctx.beginPath(); ctx.arc(30, -28, 2.8, 0, Math.PI * 2); paint(m.aggro > 0 ? "#ff6a4a" : "#ffe066", INK, 1);
    ctx.beginPath(); ctx.ellipse(24, -34, 3, 5, -0.4, 0, Math.PI * 2); paint(hide, INK, 1);
  } else if (m.t === "eagle") {
    // a storm eagle standing on its altar; its wings spread and crackle before it calls down lightning
    const wind = m.wind > 0 ? 1 - m.wind / m.T.slam.wind : 0, shake = m.wind > 0 ? Math.sin(m.ph * 60) * 2 : 0;
    const b = Math.sin(m.ph * 2) * 2, plum = "#5a4a8a";
    ctx.translate(shake, 0); ctx.scale(f, 1);
    const wing = (side) => {
      ctx.save(); ctx.translate(side * 14, -86 + b); ctx.rotate(side * (0.35 + wind * 1.1) - wind * 0.3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * 70, -30, side * 90, 10); ctx.quadraticCurveTo(side * 60, 20, side * 50, 46);
      ctx.quadraticCurveTo(side * 30, 30, 0, 30); ctx.closePath(); paint(white ? "#fff" : gloss(plum, -30, 46), "#2a1f45", 1.8);
      ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.lineWidth = 1.5;
      for (const k of [0.4, 0.6, 0.8]) { ctx.beginPath(); ctx.moveTo(side * 20 * k, 26 * k); ctx.lineTo(side * 80 * k, 4 + 30 * k); ctx.stroke(); }
      ctx.restore();
    };
    wing(-1);
    ctx.strokeStyle = "#e0a93a"; ctx.lineWidth = 6; ctx.lineCap = "round";
    for (const x of [-14, 14]) { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x, -4); ctx.moveTo(x - 7, -2); ctx.lineTo(x + 8, -2); ctx.stroke(); }
    ctx.lineCap = "butt";
    ctx.beginPath(); ctx.ellipse(0, -74 + b, 40, 46, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss(plum, -120, -28), "#2a1f45", 2);
    ctx.fillStyle = white ? "#fff" : "rgba(220,210,250,.5)"; ctx.beginPath(); ctx.ellipse(12, -66 + b, 20, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(26, -118 + b, 20, 0, Math.PI * 2); paint(white ? "#fff" : vgrad(-138, -98, "#ffffff", "#c8c8e0"), "#2a1f45", 1.8);
    ctx.fillStyle = white ? "#fff" : "#8a7ac8";
    for (const k of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(10 + k * 6, -134 + b); ctx.lineTo(2 + k * 8, -152 + b - k * 2); ctx.lineTo(18 + k * 6, -136 + b); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(42, -124 + b); ctx.quadraticCurveTo(64, -122 + b, 58, -106 + b); ctx.lineTo(44, -112 + b); ctx.closePath(); paint("#f0c040", INK, 1.4);
    const glow = m.wind > 0 ? "#ff5a3a" : "#ffe066";
    ctx.save(); ctx.fillStyle = glow; ctx.shadowColor = glow; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.ellipse(34, -122 + b, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    wing(1);
    if (m.wind > 0) {
      ctx.save(); ctx.strokeStyle = "rgba(255,250,180,.9)"; ctx.lineWidth = 2; ctx.shadowColor = "#ffe066"; ctx.shadowBlur = 10;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); let x = rand(-60, 60), y = -150;
        ctx.moveTo(x, y); for (let j = 0; j < 4; j++) { x += rand(-14, 14); y += 22; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.restore();
    }
  } else if (m.t === "treant") {
    // an old tree come alive: roots for feet, a bark face that glows, branch arms and a leafy crown
    const wind = m.wind > 0 ? 1 - m.wind / m.T.slam.wind : 0, shake = m.wind > 0 ? Math.sin(m.ph * 60) * 2 : 0;
    const sway = Math.sin(m.ph * 1.5) * 2;
    ctx.translate(shake, 0); ctx.scale(f, 1);
    const bark = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, "#8a6040"); g.addColorStop(1, "#4a3020"); return white ? "#fff" : g; };
    for (const x of [-44, -16, 14, 42]) {
      ctx.beginPath(); ctx.moveTo(x - 12, 0); ctx.quadraticCurveTo(x - 2, -18, x + 2, -34); ctx.lineTo(x + 14, -34); ctx.quadraticCurveTo(x + 12, -12, x + 20, 0); ctx.closePath();
      paint(bark(x - 12, x + 20), "#2a1a10", 1.6);
    }
    // branch arms, raised for the slam
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * 38, -104 + sway); ctx.rotate(side * (0.9 - wind * 1.5));
      ctx.beginPath(); rr(-7, -6, 50, 13, 6); paint(bark(0, 50), "#2a1a10", 1.6);
      ctx.beginPath(); ctx.moveTo(30, -4); ctx.lineTo(44, -18); ctx.lineTo(48, -14); ctx.lineTo(38, 0); ctx.closePath(); paint(bark(30, 48), "#2a1a10", 1.2);
      ctx.fillStyle = white ? "#fff" : "#4f8a3a"; ctx.beginPath(); ctx.arc(48, -2, 9, 0, Math.PI * 2); ctx.arc(44, -18, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(-44, -24); ctx.quadraticCurveTo(-54, -90, -38, -134 + sway); ctx.lineTo(38, -134 + sway); ctx.quadraticCurveTo(54, -90, 44, -24); ctx.closePath();
    paint(bark(-50, 50), "#2a1a10", 2.2);
    ctx.strokeStyle = "rgba(30,15,5,.4)"; ctx.lineWidth = 2;
    for (const x of [-28, -10, 22, 34]) { ctx.beginPath(); ctx.moveTo(x, -30); ctx.quadraticCurveTo(x + 4, -70, x - 2, -120 + sway); ctx.stroke(); }
    // hollow eyes and mouth; red just before a slam
    const glow = m.wind > 0 ? "#ff5a3a" : "#a8f070";
    ctx.fillStyle = "#1a0f08";
    ctx.beginPath(); ctx.ellipse(-2, -100 + sway, 9, 11, 0, 0, Math.PI * 2); ctx.ellipse(26, -100 + sway, 9, 11, 0, 0, Math.PI * 2); ctx.ellipse(12, -66 + sway, 14, 8 + wind * 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.fillStyle = glow; ctx.shadowColor = glow; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(0, -100 + sway, 3.6, 0, Math.PI * 2); ctx.arc(28, -100 + sway, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // the crown: dark leaves underneath, lighter clumps on top, and a little moss
    const crown = [[-40, -150, 34], [0, -170, 42], [40, -150, 34], [-20, -186, 28], [24, -190, 28]];
    ctx.fillStyle = white ? "#fff" : "#2f5f2a";
    ctx.beginPath(); for (const [x, y, r] of crown) { ctx.moveTo(x + r, y + 6 + sway); ctx.arc(x, y + 6 + sway, r, 0, Math.PI * 2); } ctx.fill();
    ctx.fillStyle = white ? "#fff" : vgrad(-220, -120, "#6fae5a", "#3f7a3a");
    ctx.beginPath(); for (const [x, y, r] of crown) { ctx.moveTo(x + r * 0.9, y + sway); ctx.arc(x, y + sway, r * 0.9, 0, Math.PI * 2); } ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.beginPath(); for (const [x, y, r] of crown) { ctx.moveTo(x - 6 + r * 0.4, y - 8 + sway); ctx.arc(x - 6, y - 8 + sway, r * 0.4, 0, Math.PI * 2); } ctx.fill();
  } else if (m.t === "fox") {
    // a desert fox: big ears, a cream belly and a bushy white-tipped tail
    const walking = m.state === "walk" || m.aggro > 0, step = walking ? Math.sin(m.ph * 14) * 4 : 0, fur = "#e8a050";
    ctx.scale(f, 1);
    ctx.save(); ctx.translate(-18, -22); ctx.rotate(-0.5 + Math.sin(m.ph * 6) * 0.15);
    ctx.beginPath(); ctx.ellipse(-12, 0, 16, 8, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss(fur, -8, 8));
    ctx.fillStyle = "#fff8ee"; ctx.beginPath(); ctx.ellipse(-23, 0, 6, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    for (const [x, s2] of [[-14, step], [-6, -step], [8, step], [15, -step]]) { ctx.beginPath(); rr(x - 2.5 + s2 * 0.6, -12, 5, 12, 2); paint(white ? "#fff" : "#c87a38"); }
    ctx.beginPath(); ctx.ellipse(0, -18, 20, 10, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss(fur, -28, -8));
    ctx.fillStyle = "#fff3e0"; ctx.beginPath(); ctx.ellipse(4, -12.5, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    for (const [a, b, c] of [[12, 20, 17], [20, 26, 25]]) {
      ctx.beginPath(); ctx.moveTo(a, -32); ctx.lineTo(a + (b - a) * 0.4, -48); ctx.lineTo(b, -33); ctx.closePath(); paint(white ? "#fff" : fur);
      ctx.fillStyle = "#f3b0a0"; ctx.beginPath(); ctx.moveTo(a + 2, -33); ctx.lineTo(a + (b - a) * 0.4, -44); ctx.lineTo(b - 2, -33); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(18, -27, 10, 8.5, 0, 0, Math.PI * 2); paint(white ? "#fff" : gloss(fur, -36, -18));
    ctx.beginPath(); ctx.ellipse(27, -23, 6, 3.6, 0, 0, Math.PI * 2); paint("#fff3e0", INK, 1);
    ctx.fillStyle = "#2a1a10"; ctx.beginPath(); ctx.arc(32.5, -24, 1.8, 0, Math.PI * 2); ctx.fill();
    if (!blinking(m.ph * 0.4)) { ctx.beginPath(); ctx.ellipse(21, -29, 1.8, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
    if (m.aggro > 0) { ctx.strokeStyle = "#5a2a10"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(17, -33); ctx.lineTo(24, -31); ctx.stroke(); }
  } else if (m.t === "worm") {
    // a ringed sand worm reared out of a little heap of sand, jaws open
    ctx.scale(f, 1);
    const wig = Math.sin(m.ph * 5) * 2.5, skin = "#c98a6a";
    ctx.fillStyle = map.theme.grass[1]; ctx.beginPath(); ctx.ellipse(-20, 0, 16, 5, 0, Math.PI, 0); ctx.fill();
    const seg = [[-24, -5, 9], [-14, -11, 10], [-2, -17, 11], [10, -21, 11], [21, -22, 10]];
    seg.forEach(([x, y, r], i) => {
      const yy = y + wig * (i % 2 ? 1 : -1) * 0.5;
      ctx.beginPath(); ctx.arc(x, yy, r, 0, Math.PI * 2); paint(white ? "#fff" : gloss(skin, yy - r, yy + r));
      ctx.strokeStyle = "rgba(90,40,30,.35)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, yy, r * 0.62, -1.2, 1.2); ctx.stroke();
    });
    const open = m.aggro > 0 ? 1 : 0.5 + Math.sin(m.ph * 3) * 0.3;
    ctx.fillStyle = "#5a2020"; ctx.beginPath(); ctx.ellipse(29, -22, 3.5, 4 + open * 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#f6e8cc"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(28, -27 - open * 2); ctx.quadraticCurveTo(36, -28 - open * 3, 35, -22); ctx.moveTo(28, -17 + open * 2); ctx.quadraticCurveTo(36, -16 + open * 3, 35, -22); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = "#2a1010"; ctx.beginPath(); ctx.arc(22, -27, 1.6, 0, Math.PI * 2); ctx.arc(25, -26, 1.4, 0, Math.PI * 2); ctx.fill();
  } else if (m.t === "cactus") {
    // a walking cactus with a flower on top; it raises an arm to throw its needles
    const hop = m.state === "walk" || m.aggro > 0 ? Math.abs(Math.sin(m.ph * 6)) * 4 : 0, g = "#5fae4a", fill = (y0, y1) => white ? "#fff" : gloss(g, y0, y1);
    ctx.scale(f, 1); ctx.translate(0, -hop);
    ctx.fillStyle = "#8a6237"; ctx.beginPath(); ctx.ellipse(0, -2, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); rr(-24, -40, 9, 22, 4.5); paint(fill(-40, -18)); ctx.beginPath(); rr(-20, -24, 8, 7, 3); paint(fill(-24, -17));
    ctx.beginPath(); rr(-13, -58, 26, 58, 13); paint(fill(-58, 0), "#2a5a20", 1.6);
    ctx.strokeStyle = "rgba(30,80,30,.4)"; ctx.lineWidth = 1.4;
    for (const x of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x, -54); ctx.lineTo(x, -4); ctx.stroke(); }
    ctx.save(); ctx.translate(12, -26); ctx.rotate(m.throwT > 0 ? -1.6 : -0.15);
    ctx.beginPath(); rr(-3, -22, 9, 24, 4.5); paint(fill(-22, 2), "#2a5a20", 1.4);
    ctx.restore();
    ctx.strokeStyle = "#f6f0d8"; ctx.lineWidth = 1;
    for (const [x, y] of [[-12, -44], [12, -36], [-11, -20], [12, -12], [-3, -8], [5, -50]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sign(x) * 4, y - 2); ctx.stroke(); }
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4 + m.ph * 0.3; ctx.fillStyle = "#ff7aa8"; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 4, -60 + Math.sin(a) * 2.5, 3.6, 2.4, a, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(0, -60, 2.4, 0, Math.PI * 2); ctx.fill();
    eyes(-1, 6, -40, 2.3, 0.6, blinking(m.ph * 0.5), "#1f3a1a");
    if (m.aggro > 0) { ctx.strokeStyle = "#1f3a1a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -46); ctx.lineTo(1, -44); ctx.moveTo(9, -46); ctx.lineTo(4, -44); ctx.stroke(); }
    ctx.strokeStyle = "#1f3a1a"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(3, -31, 3, m.aggro > 0 ? Math.PI + 0.4 : 0.4, m.aggro > 0 ? -0.4 : Math.PI - 0.4); ctx.stroke();
  } else if (m.t === "wisp") {
    // a lantern spirit: a floating blue flame with a little face, trailing sparks
    ctx.translate(0, -12 - Math.sin(m.ph * 3) * 5); ctx.scale(f, 1);
    const flick = Math.sin(m.ph * 9) * 3;
    for (let i = 1; i <= 3; i++) { ctx.fillStyle = `rgba(127,224,224,${0.35 - i * 0.08})`; ctx.beginPath(); ctx.arc(-8 * i, -12 + Math.sin(m.ph * 4 + i) * 3, 5 - i, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.shadowColor = "#7fe0e0"; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(-2, -48 + flick); ctx.bezierCurveTo(16, -34, 17, -12, 0, -3); ctx.bezierCurveTo(-17, -12, -15, -32, -2, -48 + flick);
    paint(white ? "#fff" : vgrad(-48, -3, "#e8ffff", "#3fb8c8"), "rgba(20,80,100,.6)", 1.2);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.65)"; ctx.beginPath(); ctx.ellipse(0, -15, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
    eyes(-1, 6, -22, 2, 0.5, blinking(m.ph * 0.6), "#0f3a40");
    ctx.fillStyle = "#0f3a40"; ctx.beginPath(); ctx.ellipse(3, -14, 2, m.throwT > 0 ? 3 : 1.6, 0, 0, Math.PI * 2); ctx.fill();
  } else if (m.t === "soldier") {
    // a terracotta tomb guard with a bronze-tipped spear; its eyes light up when it is after you
    const walking = m.state === "walk" || m.aggro > 0, step = walking ? Math.sin(m.ph * 7) * 4 : 0, clay = "#b8634a", fill = (c, y0, y1) => white ? "#fff" : gloss(c, y0, y1);
    ctx.scale(f, 1);
    ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(18, -2); ctx.lineTo(22, -88); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, -102); ctx.lineTo(27, -88); ctx.lineTo(17, -88); ctx.closePath(); paint("#d8b050", INK, 1.2);
    for (const [x, s2] of [[-10, step], [2, -step]]) { ctx.beginPath(); rr(x + s2 * 0.5, -24, 9, 24, 3); paint(fill("#9a5040", -24, 0)); }
    ctx.beginPath(); rr(-15, -56, 30, 36, 7); paint(fill(clay, -56, -20), "#4a2418", 1.6);
    ctx.fillStyle = "rgba(60,25,15,.35)";
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(-12 + c * 6.5 + (r % 2) * 3, -51 + r * 8, 5, 5);
    ctx.beginPath(); rr(-16, -26, 32, 5, 2); paint("#7a3a2a", INK, 1);
    ctx.beginPath(); ctx.ellipse(14, -44, 5, 9, -0.3, 0, Math.PI * 2); paint(fill(clay, -53, -35));
    ctx.beginPath(); ctx.ellipse(2, -66, 11, 12, 0, 0, Math.PI * 2); paint(fill("#c8805a", -78, -54), "#4a2418", 1.4);
    ctx.beginPath(); ctx.arc(1, -70, 12, Math.PI, 0); ctx.closePath(); paint(fill("#8a4a35", -82, -70), "#4a2418", 1.4);
    ctx.fillStyle = white ? "#fff" : "#c8553d"; ctx.beginPath(); ctx.moveTo(-6, -82); ctx.quadraticCurveTo(0, -94, 8, -82); ctx.closePath(); ctx.fill();
    const lit = m.aggro > 0;
    ctx.save(); if (lit) { ctx.shadowColor = "#7fe0c8"; ctx.shadowBlur = 8; }
    ctx.strokeStyle = lit ? "#a8ffe8" : "#3a1a10"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(3, -66); ctx.lineTo(7, -66); ctx.moveTo(9.5, -66); ctx.lineTo(12, -66); ctx.stroke();
    ctx.restore();
  } else if (m.t === "scarab") {
    // a shining scarab with a split shell, a horn and six scuttling legs
    const walking = m.state === "walk" || m.aggro > 0, step = walking ? Math.sin(m.ph * 16) * 3 : 0;
    ctx.scale(f, 1);
    ctx.strokeStyle = "#1f2a24"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
    for (const [x, s2] of [[-14, step], [-2, -step], [10, step]]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x - 5 + s2, -4); ctx.lineTo(x - 9 + s2, 0); ctx.stroke(); }
    ctx.lineCap = "butt";
    ctx.beginPath(); ctx.ellipse(-4, -16, 23, 14, 0, 0, Math.PI * 2); paint(white ? "#fff" : vgrad(-30, -2, "#8fe0c8", "#1f6a5a"), "#0f3a30", 1.6);
    ctx.strokeStyle = "rgba(10,40,30,.6)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(-4, -3); ctx.stroke();
    ctx.fillStyle = "rgba(255,216,74,.75)";
    for (const [x, y] of [[-14, -20], [-12, -11], [5, -21], [7, -11]]) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(-10, -24, 8, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(19, -12, 8, 7, 0, 0, Math.PI * 2); paint(white ? "#fff" : "#2a3a30", "#0f1a14", 1.4);
    ctx.strokeStyle = "#d8b050"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(24, -14); ctx.quadraticCurveTo(31, -18, 30, -27); ctx.stroke(); ctx.lineCap = "butt";
    ctx.fillStyle = m.aggro > 0 ? "#ff6a4a" : "#ffe066"; ctx.beginPath(); ctx.arc(22, -14, 1.8, 0, Math.PI * 2); ctx.fill();
  } else if (m.t === "colossus") {
    // a giant of black basalt split by glowing lava; the core in its chest is shielded while its arms are up
    const wind = m.wind > 0 ? 1 - m.wind / m.T.slam.wind : 0, shake = m.wind > 0 ? Math.sin(m.ph * 50) * 2 : 0;
    const phase = raid?.phase || 1, heat = phase === 3 ? "#fff0a0" : phase === 2 ? "#ffaa3a" : "#ff6a2a", breathe = Math.sin(m.ph * 2) * 2;
    const rock = (y0, y1) => white ? "#fff" : vgrad(y0, y1, "#5a4a48", "#1e1614");
    ctx.translate(shake, 0); ctx.scale(f, 1);
    for (const x of [-56, 56]) { ctx.beginPath(); rr(x - 26, -70, 52, 70, 12); paint(rock(-70, 0), "#0a0605", 2); }
    // shoulders reaching toward the arms
    for (const x of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x * 92, -176 + breathe, 34, 28, 0, 0, Math.PI * 2); paint(rock(-204, -148), "#0a0605", 2); }
    ctx.beginPath(); ctx.moveTo(-90, -70); ctx.lineTo(-104, -170 + breathe); ctx.quadraticCurveTo(0, -214 + breathe, 104, -170 + breathe); ctx.lineTo(90, -70); ctx.closePath();
    paint(rock(-214, -70), "#0a0605", 2.4);
    // lava cracks, brighter each phase
    ctx.save(); ctx.strokeStyle = heat; ctx.shadowColor = heat; ctx.shadowBlur = 10; ctx.lineWidth = 3; ctx.lineJoin = "round";
    for (const pts of [[-70, -90, -52, -120, -64, -150], [60, -84, 44, -112, 66, -146], [-20, -76, -6, -96, -24, -112], [-56, -30, -40, -50], [48, -20, 62, -48]]) {
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
    }
    ctx.restore();
    // the core, and a shield over it while the arms still stand
    ctx.save(); ctx.shadowColor = heat; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(0, -128 + breathe, 22 + wind * 6, 0, Math.PI * 2); ctx.fillStyle = white ? "#fff" : vgrad(-150, -106, "#fff6c0", heat); ctx.fill();
    ctx.restore();
    if (m.armored) {
      ctx.strokeStyle = `rgba(160,220,255,${0.6 + Math.sin(m.ph * 6) * 0.25})`; ctx.lineWidth = 4;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + m.ph * 0.5; ctx.lineTo(Math.cos(a) * 36, -128 + breathe + Math.sin(a) * 36); } ctx.closePath(); ctx.stroke();
    }
    // head with burning eyes
    ctx.beginPath(); rr(-34, -238 + breathe, 68, 50, 16); paint(rock(-238, -188), "#0a0605", 2.2);
    ctx.save(); ctx.fillStyle = heat; ctx.shadowColor = heat; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(-12, -214 + breathe, 7, 4 + wind * 3, 0, 0, Math.PI * 2); ctx.ellipse(16, -214 + breathe, 7, 4 + wind * 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,150,60,.5)"; ctx.fillRect(-14, -196 + breathe, 28, 3);
  } else if (m.t === "carm") {
    // a molten fist resting on the ground, raised high before it pounds
    const wind = m.wind > 0 ? 1 - m.wind / m.T.slam.wind : 0, lift = wind * 70, side = m.side || 1;
    const rock = (y0, y1) => white ? "#fff" : vgrad(y0, y1, "#6a5450", "#241a18");
    ctx.scale(side, 1);
    ctx.beginPath(); ctx.moveTo(-22, -70 - lift); ctx.quadraticCurveTo(-40, -150, -72, -170); ctx.lineTo(-52, -190); ctx.quadraticCurveTo(-12, -160, 18, -76 - lift); ctx.closePath();
    paint(rock(-190, -70), "#0a0605", 2);
    ctx.beginPath(); rr(-34, -96 - lift, 68, 96, 18); paint(rock(-96 - lift, -lift), "#0a0605", 2.2);
    ctx.strokeStyle = "rgba(10,6,5,.6)"; ctx.lineWidth = 2;
    for (const x of [-16, 0, 16]) { ctx.beginPath(); ctx.moveTo(x, -96 - lift); ctx.lineTo(x, -66 - lift); ctx.stroke(); }
    ctx.save(); ctx.strokeStyle = "#ff8a3a"; ctx.shadowColor = "#ff6a2a"; ctx.shadowBlur = 8; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-24, -40 - lift); ctx.lineTo(-8, -54 - lift); ctx.lineTo(4, -38 - lift); ctx.lineTo(20, -50 - lift); ctx.stroke();
    ctx.restore();
    if (lift) { ctx.fillStyle = `rgba(255,120,40,${0.3 * wind})`; ctx.beginPath(); ctx.ellipse(0, 0, 60, 8, 0, 0, Math.PI * 2); ctx.fill(); }
  } else if (m.t === "scorpling" || m.t === "scorpking") {
    ctx.scale(f, 1);
    drawScorp(m, white);
  }
  ctx.restore();

  if (!m.dead && m.showHp > 0 && !m.T.boss) {
    const bw = Math.max(40, m.w + 8), bx = cx - bw / 2, by2 = m.y - 14;
    ctx.fillStyle = "rgba(20,24,30,.8)"; ctx.fillRect(bx - 1, by2 - 1, bw + 2, 7);
    ctx.fillStyle = "#e0453b"; ctx.fillRect(bx, by2, bw * Math.max(0, m.hp / m.T.hp), 5);
  }
  if (!m.dead && (m.showHp > 0 || m.aggro > 0)) {
    ctx.font = `700 11px ${UI}`; ctx.textAlign = "center";
    const label = `Lv.${m.T.lv} ${m.T.name}`;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = "rgba(20,24,30,.6)"; rr(cx - tw / 2, m.y + m.h + 4, tw, 16, 4); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(label, cx, m.y + m.h + 16);
    ctx.textAlign = "left";
  }
}

// drawn pointing "up" (-y) from the hand, then rotated by angle
// tint is the item's colour: the blade of a sword, the gem of a wand, the limbs of a bow, the blades of a claw
function drawWeapon(type, angle, tint) {
  if (!type) return;
  ctx.save(); ctx.rotate(angle);
  if (type === "wand") {
    const gem = tint || "#c9a2ff";
    ctx.beginPath(); rr(-2, -30, 4, 37, 2); paint(vgrad(-30, 7, "#a87244", "#6b4524"));
    ctx.fillStyle = "#e7c45a"; ctx.fillRect(-2.6, -28, 5.2, 2.2); ctx.fillRect(-2.6, 2, 5.2, 2.2);
    ctx.shadowColor = gem; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(5.5, -34); ctx.lineTo(0, -27.5); ctx.lineTo(-5.5, -34); ctx.closePath(); paint(gloss(gem, -42, -28));
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(-1.6, -36, 1.4, 0, Math.PI * 2); ctx.fill();
  } else if (type === "bow") {
    const wood = tint || "#9a6236";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(245,238,220,.9)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-17.8, 10.9); ctx.lineTo(17.8, 10.9); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 5.6;
    ctx.beginPath(); ctx.arc(0, 20, 20, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.strokeStyle = wood; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.strokeStyle = shade(wood, 0.35); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(0, 20, 19.2, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
    ctx.beginPath(); rr(-3, -2.5, 6, 6, 1.5); paint("#e7d3a8");
    ctx.lineCap = "butt";
  } else if (type === "claw") {
    const steel = tint || "#cfd8e3";
    for (const bx of [-3.6, 0, 3.6]) {
      ctx.beginPath(); ctx.moveTo(bx - 1.5, -5); ctx.lineTo(bx * 1.35, -17); ctx.lineTo(bx + 1.5, -5); ctx.closePath();
      paint(vgrad(-17, -5, shade(steel, 0.4), shade(steel, -0.2)), INK, 1);
    }
    ctx.beginPath(); rr(-6, -7, 12, 10, 3); paint(gloss("#8f9cab", -7, 3));
    ctx.fillStyle = "#e7c45a"; ctx.beginPath(); ctx.arc(0, -2, 1.8, 0, Math.PI * 2); ctx.fill();
  } else {
    const blade = tint || "#e7eef6";
    ctx.beginPath(); rr(-2.2, -4, 4.4, 12, 1.5); paint("#5b3a24");
    ctx.strokeStyle = "rgba(255,230,180,.35)"; ctx.lineWidth = 1;
    for (const y of [-1, 2.5, 6]) { ctx.beginPath(); ctx.moveTo(-2, y); ctx.lineTo(2, y + 1.5); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 9.5, 2.6, 0, Math.PI * 2); paint("#e7c45a");
    const g = ctx.createLinearGradient(-3.4, 0, 3.4, 0);
    g.addColorStop(0, shade(blade, 0.45)); g.addColorStop(0.5, blade); g.addColorStop(1, shade(blade, -0.28));
    ctx.beginPath(); ctx.moveTo(-3.4, -6); ctx.lineTo(-3.4, -34); ctx.lineTo(0, -41.5); ctx.lineTo(3.4, -34); ctx.lineTo(3.4, -6); ctx.closePath(); paint(g);
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-1.4, -9); ctx.lineTo(-1.4, -33); ctx.stroke();
    ctx.beginPath(); rr(-8.5, -7.5, 17, 4.5, 2); paint(vgrad(-7.5, -3, "#ffe08a", "#b8862a"));
    ctx.fillStyle = "#e0453b"; ctx.beginPath(); ctx.arc(0, -5.2, 1.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawShots() {
  for (const s of shots) {
    if (!s.launched) continue;
    ctx.save(); ctx.translate(s.x, s.y);
    if (s.kind === "arrow") {
      ctx.scale(s.face, 1);
      ctx.strokeStyle = "#8a5a32"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = "#cfd8e3"; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(2, -4); ctx.lineTo(2, 4); ctx.fill();
      ctx.fillStyle = "#f1ead8"; ctx.fillRect(-24, -3, 5, 2); ctx.fillRect(-24, 1, 5, 2);
    } else if (s.kind === "star") {
      ctx.rotate(s.spin);
      ctx.fillStyle = "#c8d2de"; ctx.strokeStyle = "#5d6b7c"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 9, a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (s.kind === "fire") {
      for (let i = 3; i >= 1; i--) {
        ctx.fillStyle = `rgba(255,${120 + i * 20},40,${0.35 - i * 0.08})`;
        ctx.beginPath(); ctx.arc(-s.face * i * 9, Math.sin(s.spin + i) * 2, 13 - i * 2.5, 0, Math.PI * 2); ctx.fill();
      }
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
      g.addColorStop(0, "#fff6c0"); g.addColorStop(0.4, "#ffb347"); g.addColorStop(1, "rgba(255,80,30,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    } else {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 12);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, "#d6b8ff"); g.addColorStop(1, "rgba(150,100,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(190,150,255,.35)"; ctx.beginPath(); ctx.ellipse(-s.face * 14, 0, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer() {
  const cx = P.x + P.w / 2, by = P.y + P.h;
  if (P.dead) {
    // a little gravestone until you get back up
    ctx.save(); ctx.translate(cx, by);
    ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(0, 0, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14, -26); ctx.arc(0, -26, 14, Math.PI, 0); ctx.lineTo(14, 0); ctx.closePath();
    paint(vgrad(-40, 0, "#c3cad3", "#7f8a96"));
    ctx.strokeStyle = "#5d6773"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(0, -12); ctx.moveTo(-6, -25); ctx.lineTo(6, -25); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = "#5dbb4a";
    for (const x of [-12, -5, 6, 12]) { ctx.beginPath(); ctx.moveTo(x - 3, 0); ctx.lineTo(x, -6); ctx.lineTo(x + 3, 0); ctx.fill(); }
    ctx.restore();
    return;
  }
  ctx.save();
  if (P.inv > 0 && Math.floor(P.inv * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  if (buffOn("t_shadow")) ctx.globalAlpha = 0.3;
  ctx.translate(cx, by);
  ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.beginPath(); ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

  // clothes take their colour from what is worn; without them you see the undershirt and bare skin
  // colours from your look (a default one until the creation screen is done)
  const L = P.look || DEFAULT_LOOK, tone = SKINS[L.skin], hair = HAIR_COLORS[L.hairColor], eyeColor = EYE_COLORS[L.eyes];
  const skin = tone[1];
  const wear = (slot, bare) => P.eq[slot] ? ITEMS[P.eq[slot].id].color : bare;
  const shirt = wear("top", "#f1ead8"), pants = wear("bottom", "#e8dcc4"), shoe = wear("shoes", "#f2c6a0");
  const hat = wear("hat", null), cape = wear("cape", null), shield = wear("shield", null), glove = wear("gloves", skin);
  const skinFill = (y0, y1) => vgrad(y0, y1, tone[0], tone[1]);
  const hand = (x, y) => { ctx.beginPath(); ctx.arc(x, y, 3.3, 0, Math.PI * 2); paint(glove === skin ? skinFill(y - 3, y + 3) : gloss(glove, y - 3, y + 3), INK, 1.1); };
  const hatOn = (x, y, r) => {
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.closePath(); paint(gloss(hat, y - r, y));
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(x - r + 1, y - 4, r * 2 - 2, 3);
    ctx.beginPath(); rr(x - r - 1.5, y - 1.5, r * 2 + 6, 4.5, 2.2); paint(shade(hat, -0.1));
  };
  const shieldOn = (x, y) => {
    ctx.beginPath(); ctx.ellipse(x, y, 7.5, 9.5, 0, 0, Math.PI * 2); paint(gloss(shield, y - 9, y + 9));
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, y, 5, 6.8, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); paint("#dfe6ee", INK, 1);
  };

  if (P.climb) {
    // seen from behind, hands reaching up the rope
    const s = Math.sin(P.anim * 14);
    for (const [x, d] of [[-4.5, 1], [4.5, -1]]) {
      ctx.beginPath(); rr(x - 3.4, -14 + s * 2 * d, 6.8, 13, 2.5); paint(gloss(pants, -14, 0));
      ctx.beginPath(); rr(x - 3.6, -3 + s * 2 * d, 7.2, 4.5, 2); paint(shade(shoe, -0.1));
    }
    for (const [x, d] of [[-10, 1], [10, -1]]) {
      ctx.beginPath(); rr(x - 2.8, -41 + s * 4 * d, 5.6, 14, 2.8); paint(gloss(shirt, -41, -27));
      hand(x, -42 + s * 4 * d);
    }
    ctx.beginPath(); rr(-9, -31, 18, 19, 6); paint(gloss(shirt, -31, -12));
    if (cape) { ctx.beginPath(); ctx.moveTo(-8, -31); ctx.lineTo(8, -31); ctx.lineTo(11, -7); ctx.lineTo(-11, -7); ctx.closePath(); paint(gloss(cape, -31, -7)); }
    ctx.beginPath(); ctx.arc(0, -43, 13.5, 0, Math.PI * 2); paint(gloss(hair, -57, -30));
    ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-2, -45, 8, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    if (hat) hatOn(0, -47, 13.5);
    ctx.restore();
    return;
  }
  ctx.scale(P.face, 1);
  if (P.prone) {
    // lying flat, head forward; a stab thrusts the weapon straight ahead
    ctx.beginPath(); rr(-27, -10, 21, 8, 3.5); paint(gloss(pants, -10, -2));
    ctx.beginPath(); rr(-31, -11, 6, 10, 2.5); paint(shade(shoe, -0.1));
    ctx.beginPath(); rr(-9, -16, 23, 15, 6); paint(gloss(shirt, -16, -1));
    if (cape) { ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(10, -16); ctx.lineTo(-22, -12); ctx.closePath(); paint(gloss(cape, -16, -10)); }
    const thrust = P.atkKind === "stab" && P.atkT > 0 ? Math.sin((1 - P.atkT / P.atkDur) * Math.PI) * 16 : 0;
    ctx.save(); ctx.translate(14 + thrust, -6); drawWeapon(weapon()?.wtype, Math.PI / 2, weapon()?.color); ctx.restore();
    hand(14 + thrust, -6);
    ctx.beginPath(); ctx.arc(23, -17, 13, 0, Math.PI * 2); paint(gloss(hair, -30, -4));
    ctx.beginPath(); ctx.ellipse(25, -13, 11, 10.5, 0, 0, Math.PI * 2); paint(skinFill(-24, -2));
    ctx.beginPath(); ctx.moveTo(14, -18); ctx.quadraticCurveTo(22, -30, 36, -20); ctx.lineTo(30, -21); ctx.lineTo(27, -16); ctx.lineTo(24, -21); ctx.lineTo(19, -16); ctx.closePath();
    paint(gloss(hair, -30, -16));
    if (hat) hatOn(24, -22, 12);
    eyes(29, 34, -13, 2.3, 0.6, blinking(0), eyeColor);
    ctx.restore();
    return;
  }
  const moving = P.onGround && Math.abs(P.vx) > 10;
  const sw = moving ? Math.sin(P.anim * 13) : 0;
  const air = !P.onGround;
  // cape hangs behind everything and sways a little while walking
  if (cape) {
    const tail = -17 - sw * 2.5 - (air ? 5 : 0);
    ctx.beginPath(); ctx.moveTo(-8, -31); ctx.quadraticCurveTo(-3, -19, -3, -6); ctx.lineTo(tail + 6, -4);
    ctx.quadraticCurveTo(tail, -16, -10, -30); ctx.closePath(); paint(gloss(cape, -31, -4));
  }
  // back arm swings opposite the front leg
  ctx.save(); ctx.translate(-6.5, -28); ctx.rotate(0.2 - sw * 0.35 + (air ? -0.5 : 0));
  ctx.beginPath(); rr(-2.8, -1, 5.6, 11, 2.8); paint(gloss(shirt, -1, 10));
  hand(0, 11);
  ctx.restore();
  if (shield) shieldOn(-10, -19);
  // legs
  const leg = (x, a) => {
    ctx.save(); ctx.translate(x, -13); ctx.rotate(a);
    ctx.beginPath(); rr(-3.4, -1, 6.8, 11, 2.5); paint(gloss(pants, -1, 10));
    ctx.beginPath(); rr(-3.8, 8.5, 9.6, 5, 2.4); paint(gloss(shoe, 8.5, 13.5));
    ctx.restore();
  };
  leg(-3.5, air ? 0.5 : sw * 0.6);
  leg(3.5, air ? -0.3 : -sw * 0.6);
  // body, with a V collar and a belt
  ctx.beginPath(); ctx.moveTo(-8.5, -31); ctx.lineTo(8.5, -31); ctx.quadraticCurveTo(10.5, -22, 9.5, -12); ctx.lineTo(-9.5, -12);
  ctx.quadraticCurveTo(-10.5, -22, -8.5, -31); ctx.closePath(); paint(gloss(shirt, -31, -12));
  ctx.strokeStyle = shade(shirt, -0.35); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3, -31); ctx.lineTo(1, -26.5); ctx.lineTo(4, -31); ctx.stroke();
  ctx.fillStyle = "#5b3a24"; ctx.fillRect(-9.6, -16, 19.2, 3.2);
  ctx.fillStyle = "#e7c45a"; ctx.fillRect(0.5, -16.6, 4, 4.4);
  // weapon arm
  const wt = weapon()?.wtype;
  let ang = wt === "bow" ? 2.7 : 2.3;
  if (P.atkT > 0) {
    const prog = 1 - P.atkT / P.atkDur;
    if (P.atkKind === "slash") ang = -2.3 + prog * 3.9;
    else if (P.atkKind === "spin") ang = prog * Math.PI * 4;
    else if (P.atkKind === "shoot") ang = wt === "claw" ? -0.8 + Math.min(1, prog * 3) * 2.4 : Math.PI / 2;
    else if (P.atkKind === "cast") ang = 0.5 + Math.sin(prog * Math.PI) * 0.5;
    else if (P.atkKind === "buff") ang = -0.3;
  } else if (moving) ang += sw * 0.15;
  ctx.beginPath(); ctx.arc(5, -27, 4, 0, Math.PI * 2); paint(gloss(shirt, -31, -23));
  ctx.save(); ctx.translate(5, -24);
  drawWeapon(wt, ang, weapon()?.color);
  hand(0, 0);
  ctx.restore();
  // head: hair behind, face, ear, eyes, then bangs and the hat on top
  ctx.beginPath(); ctx.arc(-1, -44, 14.5, 0, Math.PI * 2); paint(gloss(hair, -58, -30));
  hairBack(L.hair, hair);
  ctx.beginPath(); ctx.moveTo(-11, -46); ctx.quadraticCurveTo(-16, -38, -13, -31); ctx.lineTo(-8, -37); ctx.closePath(); paint(gloss(hair, -46, -31));
  ctx.beginPath(); ctx.ellipse(2.5, -41, 12, 11.5, 0, 0, Math.PI * 2); paint(skinFill(-53, -29));
  ctx.beginPath(); ctx.ellipse(-5.5, -40, 3, 3.8, 0, 0, Math.PI * 2); paint(skinFill(-44, -36), INK, 1.1);
  eyes(5.5, 11, -41, 2.6, 0.7, blinking(0), eyeColor);
  ctx.strokeStyle = shade(hair, -0.2); ctx.lineWidth = 1.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(3.5, -46.5); ctx.lineTo(7, -46.8); ctx.moveTo(9.5, -46.8); ctx.lineTo(12.5, -46); ctx.stroke();
  ctx.strokeStyle = "#9a4a3a"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(9, -36.5, 1.8, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "rgba(255,120,120,.35)";
  ctx.beginPath(); ctx.ellipse(12.5, -37.5, 2.4, 1.5, 0, 0, Math.PI * 2); ctx.ellipse(2.5, -37.5, 2.4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10, -45); ctx.quadraticCurveTo(-5, -59, 6, -57); ctx.quadraticCurveTo(15, -55, 15.5, -45);
  ctx.lineTo(12, -48); ctx.lineTo(10, -43.5); ctx.lineTo(7, -48.5); ctx.lineTo(3.5, -44); ctx.lineTo(1, -49); ctx.lineTo(-4, -45.5); ctx.closePath();
  paint(gloss(hair, -58, -44));
  hairFront(L.hair, hair);
  ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(2, -47, 8, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
  if (hat) hatOn(1.5, -49, 14);
  ctx.restore();
}

function drawFX() {
  const cx = P.x + P.w / 2;
  for (const f of fx) {
    if (f.k === "slash" && !P.dead) {
      const p = f.t / 0.25;
      ctx.save(); ctx.translate(cx, P.y + 22); ctx.scale(P.face, 1);
      ctx.strokeStyle = f.big ? `rgba(255,214,120,${0.9 * (1 - p)})` : `rgba(255,255,255,${0.85 * (1 - p)})`;
      ctx.lineWidth = (f.big ? 18 : 12) * (1 - p) + 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(10, 0, f.big ? 50 : 44, -1.9 + p * 0.4, 0.9 + p * 0.3); ctx.stroke();
      ctx.restore();
    } else if (f.k === "buff" && !P.dead) {
      const p = f.t / 0.7;
      ctx.strokeStyle = `rgba(160,220,255,${1 - p})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, P.y + P.h - p * 60, 26, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, P.y + P.h - p * 30, 22, 6, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (f.k === "sky") {
      // an ultimate: beams of light in the job's colour fall one after another across the area
      for (let i = 0; i < 11; i++) {
        const x = f.x + (i - 5) / 5 * f.r * 0.9, local = clamp((f.t - (i * 7 % 11) * 0.04) / 0.45, 0, 1);
        if (local <= 0 || local >= 1) continue;
        ctx.save(); ctx.globalAlpha = 1 - local; ctx.shadowColor = f.tint; ctx.shadowBlur = 16;
        ctx.fillStyle = vgrad(cam.y, f.y, "rgba(255,255,255,.2)", f.tint);
        const w = 14 * (1 - local) + 4;
        ctx.fillRect(x - w / 2, cam.y, w, f.y - cam.y);
        ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(x, f.y - 4, 26 * (1 - local) + 8, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      if (f.t < 0.25) { ctx.fillStyle = `rgba(255,255,255,${0.25 * (1 - f.t / 0.25)})`; ctx.fillRect(cam.x, cam.y, W, H); }
    } else if (f.k === "flood") {
      // lava surging over the whole floor of the altar
      const p = f.t / 1.4, rise = Math.sin(Math.min(1, p) * Math.PI) * 46;
      ctx.fillStyle = vgrad(840 - rise, 924, "rgba(255,230,140,.95)", "rgba(200,40,10,.95)"); ctx.fillRect(0, 840 - rise, WORLD_W, 84 + rise);
      ctx.strokeStyle = "rgba(255,250,200,.8)"; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = 0; x <= WORLD_W; x += 40) ctx.lineTo(x, 840 - rise + Math.sin(x * 0.05 + time * 8) * 5);
      ctx.stroke();
    } else if (f.k === "wave") {
      // a ring of fire racing out along the ground from the colossus
      const p = f.t / 0.9, r = p * 900;
      ctx.save(); ctx.globalAlpha = 1 - p; ctx.strokeStyle = "#ffaa3a"; ctx.shadowColor = "#ff6a2a"; ctx.shadowBlur = 20; ctx.lineWidth = 14 * (1 - p) + 3;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - 10, r, 30 + r * 0.05, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    } else if (f.k === "dust") {
      // sand bursting up where something comes out of the ground
      const p = f.t / 0.6;
      for (let i = 0; i < 12; i++) {
        const a = Math.PI + (i + 0.5) / 12 * Math.PI, d = f.r * 0.6 * p;
        ctx.fillStyle = f.lava ? `rgba(255,140,50,${0.9 * (1 - p)})` : `rgba(220,180,110,${0.8 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.9 + p * p * 30, 5 * (1 - p) + 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (f.k === "nova") {
      // a ring of frost spreading over the ground, with ice shards flying outward
      const p = f.t / 0.5;
      ctx.strokeStyle = `rgba(170,230,255,${1 - p})`; ctx.lineWidth = 6 * (1 - p) + 1;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - 16, f.r * p, f.r * p * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(225,248,255,${1 - p})`;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, sx = f.x + Math.cos(a) * f.r * p, sy = f.y - 16 + Math.sin(a) * f.r * p * 0.32 - Math.sin(p * Math.PI) * 20;
        ctx.beginPath(); ctx.moveTo(sx, sy - 7); ctx.lineTo(sx + 3, sy); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx - 3, sy); ctx.closePath(); ctx.fill();
      }
    } else if (f.k === "quake") {
      const p = f.t / 0.5;
      ctx.strokeStyle = `rgba(220,180,110,${1 - p})`; ctx.lineWidth = 8 * (1 - p) + 1;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * p, 8 + p * 12, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const dx = (i - 4.5) / 4.5 * f.r * p;
        ctx.fillStyle = `rgba(140,110,80,${1 - p})`; ctx.fillRect(f.x + dx - 3, f.y - 4 - Math.sin(p * Math.PI) * (16 + (i % 3) * 8), 6, 6);
      }
    } else if (f.k === "rain") {
      // meteors or arrows falling across the area, each at its own moment
      const p = f.t / 0.6;
      for (let i = 0; i < 9; i++) {
        const k = clamp(p * 1.6 - i * 0.07, 0, 1), x = f.x + (i / 8 * 2 - 1) * f.r * 0.9, y = f.y - 220 + k * 210;
        if (k <= 0 || k >= 1) continue;
        ctx.save(); ctx.translate(x, y);
        if (f.rain === "fire") {
          const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 12); g.addColorStop(0, "#fff6c0"); g.addColorStop(0.5, "#ff9a3a"); g.addColorStop(1, "rgba(255,80,30,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,140,60,.35)"; ctx.beginPath(); ctx.ellipse(-6, -14, 4, 12, -0.4, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.rotate(Math.PI / 2 + 0.25);
          ctx.strokeStyle = "#8a5a32"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(4, 0); ctx.stroke();
          ctx.fillStyle = "#cfd8e3"; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(2, -4); ctx.lineTo(2, 4); ctx.fill();
        }
        ctx.restore();
      }
    } else if (f.k === "zap") {
      // jagged lightning from the sky onto each target
      const p = f.t / 0.3;
      ctx.save(); ctx.strokeStyle = `rgba(255,250,180,${1 - p})`; ctx.lineWidth = 3; ctx.shadowColor = "#ffe066"; ctx.shadowBlur = 12; ctx.lineJoin = "round";
      for (const [tx, ty] of f.pts) {
        ctx.beginPath(); ctx.moveTo(tx + 10, ty - 170);
        for (let k = 1; k <= 6; k++) ctx.lineTo(tx + (k < 6 ? rand(-14, 14) : 0), ty - 170 + k * 170 / 6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (f.k === "burst") {
      const p = f.t / 0.3;
      ctx.fillStyle = f.fire ? `rgba(255,150,60,${0.85 * (1 - p)})` : `rgba(214,184,255,${0.8 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + p * 18, 0, Math.PI * 2); ctx.fill();
    } else if (f.k === "stab" && !P.dead) {
      const p = f.t / 0.2;
      ctx.save(); ctx.translate(cx, P.y + P.h - 6); ctx.scale(P.face, 1);
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(40 + p * 10, 0); ctx.lineTo(72 + p * 14, 0); ctx.stroke();
      ctx.restore();
    } else if (f.k === "spin" && !P.dead) {
      const p = f.t / 0.5;
      ctx.save(); ctx.translate(cx + P.face * 60, P.y + 20);
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(160,232,255,${0.75 * (1 - p)})`; ctx.lineWidth = 6 - i * 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, 70 + i * 22 + p * 20, 26 + i * 6, 0, p * 9 + i * 2, p * 9 + i * 2 + 3.6); ctx.stroke();
      }
      ctx.restore();
    } else if (f.k === "ring") {
      const p = f.t / 0.7;
      ctx.strokeStyle = `rgba(190,160,110,${1 - p})`; ctx.lineWidth = 8 * (1 - p) + 1;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 40 + p * 280, 10 + p * 18, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const dx = (i - 3.5) * (30 + p * 60);
        ctx.fillStyle = `rgba(140,110,80,${1 - p})`; ctx.fillRect(f.x + dx - 3, f.y - 4 - Math.sin(p * Math.PI) * (20 + (i % 3) * 8), 6, 6);
      }
    } else if (f.k === "spark") {
      const p = f.t / 0.3;
      ctx.strokeStyle = `rgba(255,236,160,${1 - p})`; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + 0.3, r1 = 4 + p * 14, r2 = r1 + 8 * (1 - p);
        ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1); ctx.lineTo(f.x + Math.cos(a) * r2, f.y + Math.sin(a) * r2); ctx.stroke();
      }
    } else if (f.k === "lvup" && !P.dead) {
      const p = f.t / 2.2, a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      const g = ctx.createLinearGradient(0, P.y - 140, 0, P.y + P.h);
      g.addColorStop(0, "rgba(255,220,90,0)"); g.addColorStop(1, `rgba(255,220,90,${0.55 * a})`);
      ctx.fillStyle = g; ctx.fillRect(cx - 30, P.y - 140, 60, 140 + P.h);
      for (let i = 0; i < 10; i++) {
        const sx = cx + Math.sin(i * 2.1 + f.t * 3) * 28, sy = P.y + P.h - ((f.t * 120 + i * 23) % 170);
        ctx.fillStyle = `rgba(255,245,180,${a})`; ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
      ctx.font = `34px ${NUM}`; ctx.textAlign = "center";
      outlinedText(f.text || "LEVEL UP!", cx, P.y - 30 - p * 40, `rgba(255,214,74,${a})`, `rgba(90,50,0,${a})`, 6);
      ctx.textAlign = "left";
    }
  }
}

function drawNums() {
  if (!settings.nums) return;
  ctx.textAlign = "center";
  const style = {
    hit: [26, "#ffb636", "#6b2a00"], crit: [32, "#ff6a3d", "#4a0c00"],
    hurt: [25, "#c98cff", "#3a1460"], heal: [22, "#7dff8a", "#0d4a1a"], mana: [22, "#8fd0ff", "#0d2e5a"],
    miss: [22, "#e3e9f2", "#3a4660"],
  };
  for (const n of nums) {
    const [size, fill, stroke] = style[n.kind];
    const a = n.t > 0.8 ? Math.max(0, (1.1 - n.t) / 0.3) : 1;
    const s = n.t < 0.08 ? 1.6 - (n.t / 0.08) * 0.6 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(n.x, n.y - n.t * 42); ctx.scale(s, s);
    ctx.font = `${size}px ${NUM}`;
    outlinedText(n.kind === "crit" ? n.text + "!" : n.text, 0, 0, fill, stroke, 5);
    ctx.restore();
  }
  ctx.textAlign = "left";
}

function drawBar(x, y, w, h, ratio, c1, c2, label, value) {
  ctx.fillStyle = "#0b1426"; rr(x, y, w, h, h / 2); ctx.fill();
  if (ratio > 0) {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; rr(x + 2, y + 2, Math.max(h - 4, (w - 4) * Math.min(1, ratio)), h - 4, (h - 4) / 2); ctx.fill();
  }
  ctx.font = `12px ${NUM}`; ctx.fillStyle = "#fff"; ctx.textAlign = "left";
  outlinedText(label, x + 8, y + h - 4, "#fff", "rgba(0,0,0,.6)", 3);
  // big numbers shrink to fit beside the label instead of running over it
  const room = w - 16 - ctx.measureText(label).width - 6;
  ctx.font = `${Math.max(8, Math.min(12, 12 * room / ctx.measureText(value).width))}px ${NUM}`;
  ctx.textAlign = "right"; outlinedText(value, x + w - 8, y + h - 4, "#fff", "rgba(0,0,0,.6)", 3);
  ctx.textAlign = "left";
}

// returns the y just under the minimap, where the buff icons line up
function drawMinimap() {
  const size = settings.minimap;
  if (!size) return 12;
  const big = size === 2, mw = big ? 300 : 210, mh = big ? 120 : 64, head = big ? 20 : 0;
  const mx = W - mw - 12, my = 12 + head, sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = "rgba(14,22,40,.72)"; rr(mx - 6, my - 6 - head, mw + 12, mh + 12 + head, 8); ctx.fill();
  if (big) {
    ctx.font = `700 12px ${UI}`; ctx.fillStyle = "#ffe48a"; ctx.fillText(`${map.area}．${map.name}`, mx, my - 8);
    ctx.font = `10px ${UI}`; ctx.fillStyle = "#9fb0cd"; ctx.textAlign = "right"; ctx.fillText(`${keyOf("minimap")} 切換`, mx + mw, my - 8); ctx.textAlign = "left";
  }
  ctx.save(); ctx.beginPath(); ctx.rect(mx - 4, my - 4, mw + 8, mh + 8); ctx.clip();
  ctx.strokeStyle = "#7fbf6a"; ctx.lineWidth = big ? 2.5 : 2;
  for (const p of plats) { ctx.beginPath(); ctx.moveTo(mx + p.x * sx, my + p.y * sy); ctx.lineTo(mx + (p.x + p.w) * sx, my + p.y * sy); ctx.stroke(); }
  ctx.strokeStyle = "#c9a26b"; ctx.lineWidth = 1;
  for (const l of ladders) { ctx.beginPath(); ctx.moveTo(mx + l.x * sx, my + l.top * sy); ctx.lineTo(mx + l.x * sx, my + l.bottom * sy); ctx.stroke(); }
  ctx.fillStyle = "#7fd0ff";
  for (const pt of portals) { ctx.beginPath(); ctx.ellipse(mx + pt.x * sx, my + (pt.y - 10) * sy, 2.4, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  for (const m of mobs) if (!m.dead) {
    ctx.fillStyle = m.T.boss ? "#ff5a3a" : "#ff9b8f";
    const r = m.T.boss ? 3.5 : 1.6;
    ctx.beginPath(); ctx.arc(mx + (m.x + m.w / 2) * sx, my + (m.y + m.h / 2) * sy, r, 0, Math.PI * 2); ctx.fill();
  }
  // NPCs as green dots; the large map also names them
  ctx.font = `700 9px ${UI}`; ctx.textAlign = "center";
  // neighbours too close together take turns above and below the dot, so their names do not overlap
  let lastX = -99, below = false;
  for (const n of npcsHere().sort((a, b) => a.x - b.x)) {
    const x = mx + n.x * sx, y = my + (n.y - 20) * sy;
    below = x - lastX < 30 && !below; lastX = x;
    ctx.fillStyle = "#6fe08a"; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
    if (big) outlinedText(n.name.split(" ").pop(), x, below ? y + 13 : y - 5, "#d8ffe0", "rgba(10,20,30,.8)", 2.5);
  }
  ctx.textAlign = "left";
  if (petData()) { ctx.fillStyle = "#ffb0d0"; ctx.beginPath(); ctx.arc(mx + (pet.x + pet.w / 2) * sx, my + (pet.y + pet.h / 2) * sy, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(mx + (P.x + P.w / 2) * sx, my + (P.y + P.h / 2) * sy, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#5a3a00"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.strokeRect(mx + cam.x * sx, my + cam.y * sy, W * sx, H * sy);
  ctx.restore();
  return my + mh + 12;
}
// Pets are drawn facing +x around the middle of their feet, then flipped; they bob while they walk
// and spin through a somersault for a trick.
function drawPet() {
  if (!petData()) return;
  const D = PETS[P.petOn], L = D.look, cx = pet.x + pet.w / 2, by = pet.y + pet.h;
  const walking = Math.abs(pet.vx) > 8 && pet.onGround;
  const bob = walking ? -Math.abs(Math.sin(pet.anim * 14)) * 3 : Math.sin(time * 3) * 0.6;
  ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.beginPath(); ctx.ellipse(cx, by, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(cx, by + bob); ctx.scale(pet.face, 1);
  if (pet.trickT > 0) { ctx.translate(0, -9); ctx.rotate((1 - pet.trickT / 0.7) * Math.PI * 2); ctx.translate(0, 9); }
  const body = gloss(L.body, -18, 0), blink = blinking(cx * 0.01);
  if (P.petOn === "bun") {
    for (const [x, a] of [[-4, -0.25], [3, 0.15]]) {
      ctx.save(); ctx.translate(x, -15); ctx.rotate(a + Math.sin(time * 2 + x) * 0.06);
      ctx.beginPath(); ctx.ellipse(0, -8, 3.6, 9, 0, 0, Math.PI * 2); paint(body);
      ctx.fillStyle = L.ear; ctx.beginPath(); ctx.ellipse(0, -8, 1.6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(-10, -6, 3.6, 0, Math.PI * 2); paint("#ffffff");
    ctx.beginPath(); ctx.ellipse(0, -9, 10.5, 9.5, 0, 0, Math.PI * 2); paint(body);
    ctx.fillStyle = "rgba(243,169,189,.55)"; ctx.beginPath(); ctx.ellipse(7, -6, 2.4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    eyes(2.5, 7.5, -11, 1.7, 0.4, blink, L.eye);
    ctx.fillStyle = "#e0708a"; ctx.beginPath(); ctx.arc(9.6, -8, 1.1, 0, Math.PI * 2); ctx.fill();
  } else if (P.petOn === "chick") {
    ctx.beginPath(); ctx.moveTo(-1, -18); ctx.quadraticCurveTo(-3, -24, 1, -25); ctx.quadraticCurveTo(0, -21, 3, -18); ctx.closePath(); paint(body);
    for (const x of [-3, 3]) { ctx.strokeStyle = L.ear; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x, 0.5); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, -9, 10, 9.5, 0, 0, Math.PI * 2); paint(body);
    const flap = walking ? Math.sin(pet.anim * 20) * 0.5 : 0;
    ctx.save(); ctx.translate(-5, -9); ctx.rotate(0.4 + flap);
    ctx.beginPath(); ctx.ellipse(0, 3, 3.2, 5, 0, 0, Math.PI * 2); paint(gloss("#f0b830", -12, -2));
    ctx.restore();
    eyes(3, 7.5, -12, 1.6, 0.4, blink, L.eye);
    ctx.beginPath(); ctx.moveTo(9, -10); ctx.lineTo(13.5, -8.5); ctx.lineTo(9, -7); ctx.closePath(); paint(L.ear, INK, 1);
    ctx.fillStyle = "rgba(255,120,90,.45)"; ctx.beginPath(); ctx.ellipse(5.5, -7, 2, 1.3, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // tanuki: a striped tail, round ears, a dark mask around the eyes
    ctx.save(); ctx.translate(-9, -7); ctx.rotate(-0.5 + Math.sin(time * 4) * 0.15);
    ctx.beginPath(); ctx.ellipse(-4, 0, 6, 4, 0, 0, Math.PI * 2); paint(gloss(L.body, -4, 4));
    ctx.fillStyle = L.ear; ctx.fillRect(-6, -4, 2, 8); ctx.fillRect(-10, -3, 2, 6);
    ctx.restore();
    for (const x of [-5, 5]) { ctx.beginPath(); ctx.arc(x, -17, 3.4, 0, Math.PI * 2); paint(L.ear); }
    ctx.beginPath(); ctx.ellipse(0, -9, 10.5, 9.5, 0, 0, Math.PI * 2); paint(body);
    ctx.fillStyle = "#f6e2c4"; ctx.beginPath(); ctx.ellipse(1, -4.5, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(60,36,20,.75)"; ctx.beginPath(); ctx.ellipse(5, -11, 6.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    eyes(2.6, 7.4, -11, 1.6, 0.4, blink, "#fff4e0");
    ctx.fillStyle = "#2a1a10"; ctx.beginPath(); ctx.arc(9.8, -7.5, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  const d = petData(), hungry = d.full < PET_HUNGRY;
  ctx.font = `700 10px ${UI}`; ctx.textAlign = "center";
  const tw = ctx.measureText(D.name).width + 10;
  ctx.fillStyle = "rgba(20,24,30,.55)"; rr(cx - tw / 2, by + 3, tw, 14, 4); ctx.fill();
  ctx.fillStyle = hungry ? "#ffb0c0" : "#ffe0ec"; ctx.fillText(D.name, cx, by + 13.5);
  // a speech bubble for chatter and hunger
  if (pet.sayT > 0) {
    ctx.font = `700 11px ${UI}`;
    const bw = ctx.measureText(pet.sayText).width + 14, bx = cx - bw / 2, y0 = pet.y - 34;
    ctx.globalAlpha = Math.min(1, pet.sayT * 2);
    ctx.fillStyle = "rgba(255,255,255,.95)"; rr(bx, y0, bw, 20, 8); ctx.fill();
    ctx.strokeStyle = "#e88ab0"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.moveTo(cx - 4, y0 + 19); ctx.lineTo(cx, y0 + 25); ctx.lineTo(cx + 4, y0 + 19); ctx.fill();
    ctx.fillStyle = "#4a2a3a"; ctx.fillText(pet.sayText, cx, y0 + 14);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";
}

// a heap of sand moving along the ground, with grains kicked up behind it
function drawMound(m) {
  const r = m.w * 0.55, h = 7 + m.w * 0.07, wob = Math.sin(m.ph * 12) * 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, r, h + wob, 0, Math.PI, 0); ctx.closePath();
  paint(vgrad(-h, 0, map.theme.grass[0], map.theme.grass[2]), "rgba(90,60,30,.5)", 1.2);
  ctx.fillStyle = map.theme.grass[2];
  for (let i = 0; i < 5; i++) {
    const k = (m.ph * 1.6 + i / 5) % 1;
    ctx.globalAlpha = m.alpha * (1 - k);
    ctx.beginPath(); ctx.arc(-m.dir * (r * 0.4 + k * r * 0.8), -h * 0.6 - Math.sin(k * Math.PI) * 14, 2 + (i % 2), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = m.alpha;
}
// a scorpion: drawn at the king's size and scaled down for its young. Its tail arches over its back and
// swings forward for the slam; the king wears a crown and turns red when enraged.
function drawScorp(m, white) {
  const king = m.t === "scorpking", k = king ? 1 : 0.3;
  const wind = m.wind > 0 && m.T.slam ? 1 - m.wind / m.T.slam.wind : 0;
  const walking = m.state === "walk" || m.aggro > 0, step = walking ? Math.sin(m.ph * (king ? 8 : 16)) : 0;
  const shell = m.raged ? "#c8553d" : king ? "#d8a050" : "#e0b870", dark = "#4a2a10", fill = (y0, y1) => white ? "#fff" : gloss(shell, y0, y1);
  ctx.scale(k, k);
  ctx.strokeStyle = dark; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = 0; i < 4; i++) {
    const x = -46 + i * 22, s2 = step * 6 * (i % 2 ? 1 : -1);
    ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(x - 12 + s2, -16); ctx.lineTo(x - 18 + s2, 0); ctx.stroke();
  }
  // tail: segments arching over the back, the stinger at the end
  const segs = [[-56, -44, 15], [-70, -64, 14], [-72, -88, 13], [-60, -108, 12], [-38, -118, 11]];
  const pts = segs.map(([x, y, r], i) => [x + wind * i * i * 6, y + wind * i * 10, r]);
  pts.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); paint(fill(y - r, y + r), dark, 2); });
  const [tx, ty] = pts[pts.length - 1];
  ctx.save(); ctx.translate(tx + 10, ty + 4); ctx.rotate(0.9 + wind * 0.6);
  ctx.beginPath(); ctx.moveTo(-8, -6); ctx.quadraticCurveTo(16, -6, 22, 14); ctx.quadraticCurveTo(6, 4, -8, 6); ctx.closePath(); paint(white ? "#fff" : "#7a1a1a", dark, 2);
  if (m.raged || wind > 0) { ctx.fillStyle = "rgba(160,255,90,.8)"; ctx.beginPath(); ctx.arc(22, 15, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // body plates
  ctx.beginPath(); ctx.ellipse(-8, -34, 50, 22, 0, 0, Math.PI * 2); paint(fill(-56, -12), dark, 2.4);
  ctx.strokeStyle = "rgba(74,42,16,.5)"; ctx.lineWidth = 2;
  for (const x of [-38, -20, -2, 16]) { ctx.beginPath(); ctx.arc(x, -34, 20, -1.1, 1.1); ctx.stroke(); }
  ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.ellipse(-14, -46, 28, 6, -0.1, 0, Math.PI * 2); ctx.fill();
  // pincers reaching forward, opening and closing
  const snap = Math.abs(Math.sin(m.ph * (m.aggro > 0 ? 5 : 2))) * 0.5;
  for (const [y0, sc] of [[-22, 1], [-40, 0.9]]) {
    ctx.save(); ctx.translate(36, y0); ctx.scale(sc, sc);
    ctx.strokeStyle = dark; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(30, -6); ctx.stroke();
    ctx.strokeStyle = white ? "#fff" : shell; ctx.lineWidth = 6; ctx.stroke();
    ctx.translate(38, -8);
    ctx.save(); ctx.rotate(-snap); ctx.beginPath(); ctx.ellipse(10, -4, 16, 8, 0, Math.PI, Math.PI * 2); ctx.closePath(); paint(fill(-12, 0), dark, 2); ctx.restore();
    ctx.save(); ctx.rotate(snap); ctx.beginPath(); ctx.ellipse(10, 4, 16, 8, 0, 0, Math.PI); ctx.closePath(); paint(fill(0, 12), dark, 2); ctx.restore();
    ctx.restore();
  }
  // head with a cluster of eyes; the king wears a crown of spikes
  ctx.beginPath(); ctx.ellipse(38, -32, 16, 14, 0, 0, Math.PI * 2); paint(fill(-46, -18), dark, 2.2);
  const eye = m.raged || m.aggro > 0 ? "#ff3a2a" : "#2a0a0a";
  ctx.save(); if (m.raged) { ctx.shadowColor = "#ff3a2a"; ctx.shadowBlur = 10; }
  ctx.fillStyle = eye; for (const [x, y] of [[42, -38], [48, -36], [45, -32]]) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  if (king) {
    ctx.beginPath(); ctx.moveTo(26, -42); ctx.lineTo(28, -60); ctx.lineTo(34, -46); ctx.lineTo(38, -64); ctx.lineTo(42, -46); ctx.lineTo(48, -60); ctx.lineTo(50, -42); ctx.closePath();
    paint(vgrad(-64, -42, "#fff0a0", "#d89a2a"), dark, 1.6);
    ctx.fillStyle = "#3fa8e0"; ctx.beginPath(); ctx.arc(38, -50, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "butt";
}
// what monsters throw: green needles and blue lantern fire
function drawFoes() {
  for (const f of foes) {
    ctx.save(); ctx.translate(f.x, f.y);
    if (f.kind === "needle") {
      ctx.rotate(Math.atan2(f.vy, f.vx));
      ctx.strokeStyle = "#4a8a3a"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(7, 0); ctx.stroke();
      ctx.fillStyle = "#f6f0d8"; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(6, -2.5); ctx.lineTo(6, 2.5); ctx.fill();
    } else if (f.kind === "lava") {
      // a falling blob of lava with a glowing tail, and a mark where it will land
      ctx.restore(); ctx.save();
      ctx.fillStyle = "rgba(255,90,30,.25)"; ctx.beginPath(); ctx.ellipse(f.x, 840, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(f.x, f.y);
      ctx.shadowColor = "#ff6a2a"; ctx.shadowBlur = 16;
      ctx.fillStyle = "rgba(255,120,40,.4)"; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(0, -40); ctx.lineTo(8, -6); ctx.fill();
      ctx.fillStyle = vgrad(-12, 12, "#fff0a0", "#ff4a1a"); ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.shadowColor = "#7fe0e0"; ctx.shadowBlur = 14;
      ctx.fillStyle = "rgba(127,224,224,.35)"; ctx.beginPath(); ctx.arc(-Math.sign(f.vx) * 8, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = vgrad(-7, 7, "#ffffff", "#3fb8c8"); ctx.beginPath(); ctx.arc(0, 0, 6.5 + Math.sin(f.t * 20), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
// the tomb is dark except for the light around you, the lantern spirits, their fire and the portals
let darkCv = null;
function drawDark(ox, oy) {
  darkCv = darkCv || document.createElement("canvas");
  if (darkCv.width !== W) { darkCv.width = W; darkCv.height = H; }
  const g = darkCv.getContext("2d");
  g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, W, H);
  g.fillStyle = "rgba(6,4,14,.92)"; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "destination-out";
  const hole = (x, y, r) => {
    const gr = g.createRadialGradient(x + ox, y + oy, r * 0.3, x + ox, y + oy, r);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill();
  };
  hole(P.x + P.w / 2, P.y + P.h / 2, 180);
  for (const m of mobs) if (m.T.glow && !m.dead) hole(m.x + m.w / 2, m.y + m.h / 2 - 12, 90 * m.alpha);
  for (const f of foes) hole(f.x, f.y, 40);
  for (const pt of portals) hole(pt.x, pt.y - 30, 70);
  ctx.drawImage(darkCv, 0, 0, W, H);
}
// a tall desert cactus with two raised arms
function drawCactusTree(t) {
  const by = 840, h = t.h * 0.75, x = t.x, g = (x0, x1) => { const gr = ctx.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, "#7fc05a"); gr.addColorStop(1, "#3f7a32"); return gr; };
  for (const [side, y0, len] of [[-1, 0.55, 0.32], [1, 0.4, 0.38]]) {
    const ax = x + side * 26, top = by - h * (y0 + len);
    ctx.beginPath(); rr(ax - 7, top, 14, h * len + 8, 7); paint(g(ax - 7, ax + 7), "rgba(30,60,20,.6)", 1.2);
    ctx.beginPath(); rr(Math.min(x, ax) + (side < 0 ? 0 : -4), by - h * y0 - 4, 26, 12, 6); paint(g(x - 10, x + 10), "rgba(30,60,20,.6)", 1.2);
  }
  ctx.beginPath(); rr(x - 12, by - h, 24, h, 12); paint(g(x - 12, x + 12), "rgba(30,60,20,.6)", 1.3);
  ctx.strokeStyle = "rgba(30,70,25,.35)"; ctx.lineWidth = 1.4;
  for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(x + dx, by - h + 8); ctx.lineTo(x + dx, by - 4); ctx.stroke(); }
  if (t.c) { ctx.fillStyle = "#ff7aa8"; ctx.beginPath(); ctx.arc(x, by - h - 2, 5, 0, Math.PI * 2); ctx.fill(); }
}
// the desert town: the airship, a market stall, a domed sandstone house and a sign
function drawSandTown() {
  drawAirship(NPCS.gray3.x + 40, 640);
  const hx = 1080, hy = 840;
  ctx.beginPath(); ctx.rect(hx, hy - 90, 150, 90); paint(vgrad(hy - 90, hy, "#f2d9a8", "#d0a868"), "rgba(90,60,30,.7)", 1.6);
  ctx.beginPath(); ctx.arc(hx + 75, hy - 90, 52, Math.PI, 0); ctx.closePath(); paint(vgrad(hy - 142, hy - 90, "#7fd0e8", "#3a8ab8"), "rgba(30,60,90,.7)", 1.6);
  ctx.fillStyle = "#d8b050"; ctx.beginPath(); ctx.arc(hx + 75, hy - 146, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 58, hy); ctx.lineTo(hx + 58, hy - 40); ctx.arc(hx + 75, hy - 40, 17, Math.PI, 0); ctx.lineTo(hx + 92, hy); ctx.closePath(); paint("#5a3a24", "rgba(40,25,15,.8)", 1.2);
  for (const x of [hx + 22, hx + 118]) { ctx.beginPath(); ctx.moveTo(x - 8, hy - 44); ctx.lineTo(x - 8, hy - 62); ctx.arc(x, hy - 62, 8, Math.PI, 0); ctx.lineTo(x + 8, hy - 44); ctx.closePath(); paint("#3a6a8a", "rgba(40,25,15,.8)", 1.2); }
  drawStall(NPCS.saya.x, "#e0a040", "white_pot");
  const x = 290, y = 840;
  ctx.fillStyle = "#8a6237"; ctx.fillRect(x - 3, y - 60, 6, 60);
  ctx.beginPath(); rr(x - 46, y - 82, 92, 28, 5); paint(vgrad(y - 82, y - 54, "#fff6e0", "#e8d6a8"), "rgba(90,60,30,.7)", 1.4);
  ctx.font = `900 13px ${UI}`; ctx.textAlign = "center"; ctx.fillStyle = "#5a3a1a"; ctx.fillText("沉砂城", x, y - 63); ctx.textAlign = "left";
}

// the expedition's clock under the boss bar, the red warning before a big attack, and phase banners
function drawRaidHUD() {
  ctx.textAlign = "center";
  if (!raid.done) {
    const m = Math.floor(Math.max(0, raid.t) / 60), sec = String(Math.floor(Math.max(0, raid.t) % 60)).padStart(2, "0");
    ctx.font = `16px ${NUM}`; outlinedText(`${m}:${sec}`, W / 2, 132, raid.t < 60 ? "#ff9b8f" : "#ffffff", "rgba(40,10,0,.8)", 4);
  }
  if (raid.warn) {
    const a = 0.35 + Math.abs(Math.sin(time * 8)) * 0.35;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.65);
    g.addColorStop(0, "rgba(255,40,20,0)"); g.addColorStop(1, `rgba(255,40,20,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H - 48);
    const text = raid.warn.kind === "flood" ? "熔岩要淹沒地面了！快跳到平台上！" : "衝擊波要來了！看準時機跳起來！";
    ctx.fillStyle = "rgba(60,0,0,.75)"; rr(W / 2 - 230, 168, 460, 56, 12); ctx.fill();
    ctx.font = `900 20px ${UI}`; outlinedText(`⚠ ${text}`, W / 2, 196, "#ffe0a0", "rgba(80,0,0,.9)", 4);
    ctx.font = `15px ${NUM}`; ctx.fillStyle = "#ffffff"; ctx.fillText(raid.warn.t.toFixed(1), W / 2, 216);
  } else if (raid.banner) {
    ctx.globalAlpha = Math.min(1, raid.banner.t);
    ctx.font = `900 18px ${UI}`;
    const tw = ctx.measureText(raid.banner.text).width + 40;
    ctx.fillStyle = "rgba(30,10,5,.78)"; rr(W / 2 - tw / 2, 172, tw, 40, 12); ctx.fill();
    outlinedText(raid.banner.text, W / 2, 198, "#ffd7a0", "rgba(60,20,0,.9)", 4);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";
}

// hair styles add to the basic short cut: parts behind the head, then parts in front of the bangs
function hairBack(style, c) {
  if (style === "long") {
    ctx.beginPath(); ctx.moveTo(-14, -47); ctx.quadraticCurveTo(-19, -32, -14, -20); ctx.quadraticCurveTo(-8, -18, -3, -22); ctx.lineTo(-2, -42); ctx.closePath();
    paint(gloss(c, -50, -20));
  } else if (style === "twin") {
    for (const [x, a] of [[-15, 0.25], [-10, -0.05]]) {
      ctx.save(); ctx.translate(x, -46); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 11, 5, 12, 0, 0, Math.PI * 2); paint(gloss(c, -1, 23));
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); paint("#ff7aa8", INK, 1);
      ctx.restore();
    }
  } else if (style === "bun") {
    ctx.beginPath(); ctx.arc(-10, -57, 7, 0, Math.PI * 2); paint(gloss(c, -64, -50));
    ctx.fillStyle = "#e7c45a"; ctx.fillRect(-12, -52, 6, 2.2);
  }
}
function hairFront(style, c) {
  if (style === "spiky") {
    for (const [a, b, d] of [[[-9, -53], [-8, -67], [-1, -56]], [[-2, -56], [4, -69], [8, -56]], [[6, -55], [16, -63], [13, -48]]]) {
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...d); ctx.closePath(); paint(gloss(c, -69, -48));
    }
  } else if (style === "long") {
    ctx.beginPath(); ctx.moveTo(13, -48); ctx.quadraticCurveTo(17, -40, 15, -31); ctx.lineTo(12, -36); ctx.closePath(); paint(gloss(c, -48, -31));
  }
}
// your name under your feet, and the worn title above it in gold, as the original's medals
function drawPlayerTags() {
  if (P.dead) return;
  const T = TITLES[P.title], cx = P.x + P.w / 2;
  let y = P.y + P.h + (P.sit ? 9 : 0) + 3;
  ctx.textAlign = "center";
  if (T) {
    ctx.font = `900 10px ${UI}`;
    const tw = ctx.measureText(T.name).width + 16;
    ctx.fillStyle = vgrad(y, y + 15, "#8a5a10", "#5a3a00"); rr(cx - tw / 2, y, tw, 15, 7); ctx.fill();
    ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "#ffe48a"; ctx.fillText(T.name, cx, y + 11);
    y += 17;
  }
  if (P.look) {
    ctx.font = `700 11px ${UI}`;
    const tw = ctx.measureText(P.look.name).width + 12;
    ctx.fillStyle = "rgba(20,24,30,.7)"; rr(cx - tw / 2, y, tw, 15, 4); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.fillText(P.look.name, cx, y + 11.5);
  }
  ctx.textAlign = "left";
}
// chairs are drawn around (0, 0) at the feet: back parts first, then the seat in front of you
function drawChair(id, back) {
  const C = CHAIRS[id], c = C.color;
  if (C.look === "stool") {
    if (back) return;
    for (const x of [-11, 8]) { ctx.beginPath(); rr(x, -12, 4, 12, 1.5); paint(shade(c, -0.25)); }
    ctx.beginPath(); rr(-15, -17, 30, 6, 3); paint(gloss(c, -17, -11));
  } else if (C.look === "cloud") {
    const puff = (pts, fill) => { ctx.beginPath(); for (const [x, y, r] of pts) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = "rgba(90,110,150,.45)"; ctx.lineWidth = 1.2; ctx.stroke(); };
    if (back) puff([[-14, -32, 10], [-6, -38, 10], [-18, -22, 9]], vgrad(-48, -12, "#ffffff", "#d6e2f2"));
    else puff([[-12, -12, 9], [0, -14, 10], [12, -12, 9], [-4, -6, 8], [8, -6, 8]], vgrad(-24, 0, "#ffffff", "#d6e2f2"));
  } else {
    // a striped deck chair leaning back
    if (back) {
      ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(-20, -42); ctx.lineTo(-12, -44); ctx.lineTo(2, -14); ctx.closePath(); paint(gloss(c, -44, -14));
      ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.moveTo(-10, -22); ctx.lineTo(-15, -33); ctx.lineTo(-11, -34); ctx.lineTo(-6, -23); ctx.fill();
      return;
    }
    ctx.strokeStyle = "#8a5a32"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(12, -16); ctx.moveTo(14, 0); ctx.lineTo(-8, -16); ctx.stroke();
    ctx.beginPath(); rr(-12, -18, 28, 5, 2.5); paint(gloss(c, -18, -13));
  }
}
// the goal of a jump challenge: a pole with a waving flag
function drawGoalFlag(p) {
  const x = p.x + p.w / 2, y = p.y;
  ctx.strokeStyle = "#8a6237"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 70); ctx.stroke();
  const wave = Math.sin(time * 5) * 4;
  ctx.beginPath(); ctx.moveTo(x, y - 70); ctx.quadraticCurveTo(x + 20, y - 72 + wave, x + 38, y - 62 + wave); ctx.lineTo(x, y - 48); ctx.closePath();
  paint(vgrad(y - 72, y - 48, "#ff7aa8", "#e0453b"));
  ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(x, y - 72, 4, 0, Math.PI * 2); ctx.fill();
  ctx.font = `900 12px ${UI}`; ctx.textAlign = "center"; outlinedText("終點", x, y - 78, "#ffffff", "rgba(80,20,20,.8)", 3); ctx.textAlign = "left";
}

function drawHUD() {
  // bottom panel
  const top = H - 48;
  ctx.fillStyle = "rgba(14,22,40,.88)"; ctx.fillRect(0, top, W, 48);
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, top, W, 1);
  ctx.font = `13px ${NUM}`; ctx.fillStyle = "#ffc94a"; ctx.fillText("LV.", 14, top + 22);
  ctx.font = `26px ${NUM}`; outlinedText(String(P.lv), 40, top + 26, "#ffc94a", "#5a3a00", 4);
  ctx.font = `700 12px ${UI}`; ctx.fillStyle = "#cfe3ff"; ctx.fillText(job().name, 14, top + 42);
  // unspent points glow as a reminder, like the level-up buttons in the original
  const pts = [P.ap > 0 && `AP ${P.ap}`, P.sp > 0 && `SP ${P.sp}`].filter(Boolean);
  if (pts.length) {
    const t = pts.join("  ");
    ctx.font = `12px ${NUM}`;
    const tw = ctx.measureText(t).width + 14, a = 0.75 + Math.sin(time * 5) * 0.25;
    ctx.globalAlpha = a; ctx.fillStyle = "#ffc94a"; rr(14, top - 24, tw, 18, 9); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = "#4a2e00"; ctx.fillText(t, 21, top - 10);
  }
  // coins
  ctx.fillStyle = "#ffcf3d"; ctx.beginPath(); ctx.arc(96, top + 17, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c98a12"; ctx.beginPath(); ctx.arc(96, top + 17, 3, 0, Math.PI * 2); ctx.fill();
  ctx.font = `14px ${NUM}`; ctx.fillStyle = "#ffe7a3"; ctx.fillText(P.coins.toLocaleString(), 106, top + 22);

  const bx = 160, bw = 116, gap = 8;
  drawBar(bx, top + 10, bw, 18, P.hp / maxHp(), "#ff7a6b", "#d8362b", "HP", `${Math.ceil(P.hp)} / ${maxHp()}`);
  drawBar(bx + bw + gap, top + 10, bw, 18, P.mp / maxMp(), "#7fb6ff", "#2f6fd6", "MP", `${Math.floor(P.mp)} / ${maxMp()}`);
  const er = P.exp / need();
  drawBar(bx + (bw + gap) * 2, top + 10, bw, 18, er, "#fff08a", "#e0b62a", "EXP", `${(er * 100).toFixed(1)}%`);
  ctx.font = `700 11px ${UI}`; ctx.fillStyle = "#9fb0cd";
  ctx.fillText(`${P.exp} / ${need()}`, bx + (bw + gap) * 2 + 8, top + 42);
  const [dmgMin, dmgMax] = physRange();
  ctx.fillText(`攻擊 ${Math.floor(dmgMin)}～${Math.floor(dmgMax)}`, bx + 8, top + 42);
  // arrows or stars left, red when running low
  const ammoName = AMMO_NAMES[weapon()?.wtype];
  if (ammoName) {
    const n = ammoCount();
    ctx.fillStyle = n < 50 ? "#ff9b8f" : "#9fb0cd";
    ctx.fillText(`${ammoName} ${n}`, bx + bw + gap + 8, top + 42);
  }

  // quick slots: two potions, then the seven skill keys, labelled with whatever keys they are bound to
  const SKILL_COLORS = { atk: "#ff9b5a", buff: "#7fd0ff" };
  const short = a => keyOf(a).replace("Shift", "⇧").replace("Num ", "N");
  const slots = [
    ...["hp", "mp"].map(k => { const id = potFor(k), I = ITEMS[id], n = countItem(id);
      return { key: short(`${k}Pot`), label: I.name.slice(0, 2), sub: "×" + n, c: I.color, dim: !n }; }),
    ...slotSkills().map((s, i) => {
      if (!s) return { key: short(`skill${i + 1}`), label: "", sub: "", c: "#3b4a63", dim: true };
      const l = skLv(s.id);
      return { key: short(`skill${i + 1}`), label: s.name.slice(0, 2), sub: l ? `MP ${s.mp(l)}` : "未學",
               c: SKILL_COLORS[s.type], dim: !l || P.mp < s.mp(Math.max(1, l)), on: buffOn(s.id), cd: P.cds[s.id] || 0, cdMax: P.cdMax[s.id] || 1 };
    }),
  ];
  slots.forEach((s, i) => {
    const x = 530 + i * 47, y = top + 6;
    ctx.fillStyle = "#0b1426"; rr(x, y, 44, 36, 7); ctx.fill();
    ctx.strokeStyle = s.on ? "#7fd0ff" : "rgba(255,255,255,.14)"; ctx.lineWidth = s.on ? 2 : 1; ctx.stroke();
    ctx.fillStyle = s.dim ? "#3b4a63" : s.c; ctx.beginPath(); ctx.arc(x + 10, y + 21, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = `700 10px ${UI}`; ctx.fillStyle = s.dim ? "#7d8aa3" : "#dfe8f6"; ctx.fillText(s.label, x + 18, y + 17);
    ctx.font = `9px ${NUM}`; ctx.fillStyle = "#9fb0cd"; ctx.fillText(s.sub, x + 18, y + 30);
    ctx.font = `10px ${NUM}`; ctx.fillStyle = "#ffc94a"; ctx.fillText(s.key, x + 3, y + 11);
    // cooling down: a grey shade that shrinks from the top as it gets ready, and the seconds left
    if (s.cd > 0) {
      const h = 36 * s.cd / s.cdMax;
      ctx.save(); rr(x, y, 44, 36, 7); ctx.clip();
      ctx.fillStyle = "rgba(8,12,24,.72)"; ctx.fillRect(x, y + 36 - h, 44, h);
      ctx.restore();
      ctx.font = `14px ${NUM}`; ctx.textAlign = "center"; outlinedText(String(Math.ceil(s.cd)), x + 22, y + 24, "#ffffff", "rgba(0,0,0,.7)", 3); ctx.textAlign = "left";
    }
  });

  // minimap first, so the buffs can sit right under it
  const mini = drawMinimap();
  // active buffs under the minimap, with seconds left
  Object.keys(P.buffs).filter(buffOn).forEach((id, i) => {
    const x = W - 46 - i * 40, y = mini;
    ctx.fillStyle = "rgba(14,22,40,.8)"; rr(x, y, 36, 36, 7); ctx.fill();
    ctx.strokeStyle = "#7fd0ff"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `700 12px ${UI}`; ctx.textAlign = "center"; ctx.fillStyle = "#dfe8f6";
    ctx.fillText(SKILL_BY_ID[id].name.slice(0, 2), x + 18, y + 16);
    ctx.font = `11px ${NUM}`; ctx.fillStyle = "#ffc94a"; ctx.fillText(Math.ceil(P.buffs[id]) + "s", x + 18, y + 30);
    ctx.textAlign = "left";
  });

  // map name + messages
  ctx.font = `900 15px ${UI}`;
  outlinedText(`${map.area}．${map.name}`, 16, 28, "#ffffff", "rgba(20,40,70,.7)", 4);
  ctx.font = `700 13px ${UI}`;
  msgs.forEach((m, i) => {
    ctx.globalAlpha = Math.min(1, m.t);
    outlinedText(m.text, 16, 54 + i * 20, m.color, "rgba(10,20,40,.75)", 3);
  });
  ctx.globalAlpha = 1;


  // boss bar
  const boss = mobs.find(m => m.T.boss && !m.dead && (m.aggro > 0 || m.hp < m.T.hp));
  if (boss) {
    const w = 380, x = (W - w) / 2, y = 96;
    ctx.font = `900 14px ${UI}`; ctx.textAlign = "center";
    outlinedText(`Lv.${boss.T.lv} ${boss.T.name}${raid ? `．第 ${raid.phase} 階段` : ""}${boss.armored ? "（先打斷手臂）" : ""}`, W / 2, y - 6, "#ffd7a0", "rgba(40,10,0,.8)", 4);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(20,10,10,.85)"; rr(x, y, w, 14, 7); ctx.fill();
    ctx.fillStyle = "#d8362b"; rr(x + 2, y + 2, (w - 4) * Math.max(0, boss.hp / boss.T.hp), 10, 5); ctx.fill();
  }

  if (raid) drawRaidHUD();

  if (!started) {
    const t = "點一下畫面，就能用鍵盤開始冒險";
    ctx.font = `700 15px ${UI}`; const tw = ctx.measureText(t).width + 28;
    ctx.globalAlpha = 0.75 + Math.sin(time * 3) * 0.2;
    ctx.fillStyle = "rgba(14,22,40,.85)"; rr((W - tw) / 2, 150, tw, 34, 17); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(t, W / 2, 172); ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  if (P.dead) {
    ctx.fillStyle = "rgba(10,14,24,.55)"; ctx.fillRect(0, 0, W, H - 48);
    ctx.textAlign = "center";
    ctx.font = `900 30px ${UI}`; outlinedText("你倒下了", W / 2, H / 2 - 30, "#ffffff", "rgba(0,0,0,.6)", 5);
    if (P.deadT > 1) { ctx.font = `700 15px ${UI}`; ctx.fillStyle = "#cfe3ff"; ctx.fillText(`按 Enter、空白鍵或點一下畫面，回到${homeOf().name}`, W / 2, H / 2 + 6); }
    ctx.textAlign = "left";
  }
}

function draw() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawBG();
  const shake = cam.shake * settings.shake;
  const sx = shake ? rand(-shake, shake) * 0.5 : 0, sy = shake ? rand(-shake, shake) * 0.5 : 0;
  ctx.save();
  ctx.translate(Math.round(-cam.x + sx), Math.round(-cam.y + sy));
  trees.forEach(drawTree);
  if (map.scene === "village") drawVillage();
  else if (map.scene === "cloud") drawCloudTown();
  else if (map.scene === "sand") drawSandTown();
  for (let i = plats.length - 1; i >= 0; i--) drawPlatform(plats[i]);
  ladders.forEach(drawLadder);
  portals.forEach(drawPortal);
  if (map.jump) drawGoalFlag(plats[map.goal + 1]);
  npcsHere().forEach(drawNpc);
  drops.forEach(drawDrop);
  drawPet();
  mobs.forEach(drawMob);
  drawShots();
  drawFoes();
  // sitting: the chair's back, you a little lower, then the seat's front over your legs
  if (P.sit && !P.dead) {
    ctx.save(); ctx.translate(P.x + P.w / 2, P.y + P.h); ctx.scale(P.face, 1); drawChair(P.sit, true); ctx.restore();
    ctx.save(); ctx.translate(0, 9); drawPlayer(); ctx.restore();
    ctx.save(); ctx.translate(P.x + P.w / 2, P.y + P.h); ctx.scale(P.face, 1); drawChair(P.sit, false); ctx.restore();
  } else drawPlayer();
  drawPlayerTags();
  drawFX();
  drawNums();
  ctx.restore();
  if (map.theme.dark) drawDark(Math.round(-cam.x + sx), Math.round(-cam.y + sy));
  if (map.theme.storm) {
    const k = time % 7;
    if (k < 0.18) { ctx.fillStyle = `rgba(230,230,255,${0.35 * (1 - k / 0.18)})`; ctx.fillRect(0, 0, W, H); }
  }
  if (map.theme.mist) {
    for (let i = 0; i < 4; i++) {
      const x = ((time * (10 + i * 4) + i * 300 - cam.x * 0.4) % 1400 + 1400) % 1400 - 220, y = 250 + i * 70 - cam.y * 0.15;
      ctx.fillStyle = "rgba(225,238,232,.10)"; ctx.beginPath(); ctx.ellipse(x, y, 260, 34, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // a quick fade from black after changing maps
  if (fade > 0) { ctx.fillStyle = `rgba(8,12,24,${fade})`; ctx.fillRect(0, 0, W, H); }
  drawHUD();
}
