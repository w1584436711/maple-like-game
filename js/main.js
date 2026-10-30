// The frame loop and starting the game.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Loop ----------
let last = 0;
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0);
  last = now;
  update(dt);
  musicTick();
  draw();
  pressed.clear();
  requestAnimationFrame(loop);
}
document.addEventListener("visibilitychange", () => { if (document.hidden) { save(); held.clear(); } });
addEventListener("pagehide", save);

let booted = false;
function boot(data) {
  if (booted) return; booted = true;
  const resumed = load(data && data.save);
  loadMap(P.map);
  if (resumed && P.look) msg(`歡迎回來，${P.look.name}`, "#ffc94a");
  else if (resumed) msg(`歡迎回來，Lv.${P.lv} 的冒險者`, "#ffc94a");
  // a new character, or a save from before looks existed, starts at the creation screen
  checkLook();
  requestAnimationFrame(t => { last = t; loop(t); });
}
try { window.claude?.hot?.snapshot?.(() => ({ save: serialize() })); } catch (_) {}
const hot = window.claude?.hot;
if (hot?.ready) hot.ready(boot); else boot(hot?.data ?? {});
