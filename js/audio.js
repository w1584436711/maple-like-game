// Sound effects and background music, made on the fly with Web Audio (no sound files), and the player's settings.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Settings ----------
// kept apart from the character saves, so every save slot shares the same volume and display choices
const SETTINGS_KEY = "floating-isle-settings";
const settings = { sfx: 70, music: 40, nums: true, shake: 1 };
try {
  const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
  if (s) {
    for (const k of ["sfx", "music"]) if (Number.isFinite(s[k])) settings[k] = clamp(Math.round(s[k]), 0, 100);
    if (typeof s.nums === "boolean") settings.nums = s.nums;
    if ([0, 0.5, 1].includes(s.shake)) settings.shake = s.shake;
  }
} catch (_) {}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
  applyVolumes();
}

// ---------- Sound ----------
let actx = null, sfxGain = null, musicGain = null;
// browsers only allow sound after the player touches the page, so it starts on the first key press or click
function startAudio() {
  if (actx) { if (actx.state === "suspended") actx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { actx = new AC(); } catch (_) { return; }
  sfxGain = actx.createGain(); musicGain = actx.createGain();
  sfxGain.connect(actx.destination); musicGain.connect(actx.destination);
  applyVolumes();
}
function applyVolumes() {
  if (!actx) return;
  sfxGain.gain.value = settings.sfx / 100 * 0.5;
  musicGain.gain.value = settings.music / 100 * 0.18;
}
// one note: a waveform gliding from f0 to f1, with a quick attack and a fade out
function tone(type, f0, f1, dur, vol, at = 0, out = sfxGain) {
  const t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}
// a burst of noise through a filter, for swishes and thuds
let noiseBuf = null;
function noise(dur, freq, type, vol, at = 0) {
  if (!noiseBuf) {
    noiseBuf = actx.createBuffer(1, actx.sampleRate / 2, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.sin(i * 12.9898) * 43758.5453 % 1;
  }
  const t = actx.currentTime + at, src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + dur + 0.02);
}
const arpeggio = (notes, gap, len, vol) => notes.forEach((f, i) => tone("triangle", f, f, len, vol, i * gap));
const SFX = {
  swing:   () => noise(0.09, 2400, "highpass", 0.25),
  shoot:   () => noise(0.07, 3000, "bandpass", 0.2),
  hit:     () => { tone("square", 240, 110, 0.08, 0.1); noise(0.05, 1200, "bandpass", 0.2); },
  miss:    () => tone("sine", 700, 600, 0.06, 0.05),
  skill:   () => { tone("sawtooth", 220, 660, 0.18, 0.07); noise(0.15, 1800, "bandpass", 0.12); },
  magic:   () => { tone("sine", 880, 1320, 0.22, 0.1); tone("triangle", 1320, 1760, 0.22, 0.06, 0.05); },
  buff:    () => tone("triangle", 523, 1047, 0.3, 0.08),
  coin:    () => { tone("sine", 988, 988, 0.06, 0.1); tone("sine", 1319, 1319, 0.12, 0.1, 0.06); },
  pickup:  () => tone("triangle", 660, 990, 0.1, 0.1),
  potion:  () => tone("sine", 400, 820, 0.16, 0.1),
  jump:    () => tone("sine", 320, 520, 0.08, 0.05),
  hurt:    () => tone("square", 200, 90, 0.14, 0.09),
  slam:    () => { noise(0.45, 220, "lowpass", 0.6); tone("sine", 90, 40, 0.4, 0.3); },
  portal:  () => tone("sine", 220, 1200, 0.4, 0.1),
  levelup: () => arpeggio([523, 659, 784, 1047], 0.09, 0.18, 0.12),
  quest:   () => arpeggio([784, 1047, 1319, 1568], 0.08, 0.16, 0.1),
  fail:    () => tone("triangle", 330, 220, 0.25, 0.1),
  death:   () => tone("triangle", 440, 110, 0.7, 0.12),
};
// the same sound twice within 40 ms plays once, so a crowd of hits does not get loud
const lastSfx = {};
function sfx(name) {
  if (!actx || actx.state !== "running" || !settings.sfx || !SFX[name]) return;
  const now = actx.currentTime;
  if (now - (lastSfx[name] ?? -1) < 0.04) return;
  lastSfx[name] = now;
  try { SFX[name](); } catch (_) {}
}

// ---------- Music ----------
// Each kind of place has its own key, scale, speed and sound. The tune itself is made up from the map's
// name, so a map always plays the same melody, and every melody is the game's own.
const MUSIC = {
  meadow: { root: 60, scale: [0, 2, 4, 7, 9], bpm: 100, wave: "triangle" },
  shore:  { root: 62, scale: [0, 2, 4, 7, 9], bpm: 90, wave: "sine" },
  reef:   { root: 62, scale: [0, 2, 5, 7, 9], bpm: 96, wave: "sine" },
  ruins:  { root: 57, scale: [0, 3, 5, 7, 10], bpm: 84, wave: "sine" },
  forest: { root: 52, scale: [0, 3, 5, 7, 10], bpm: 80, wave: "triangle" },
  cloud:  { root: 65, scale: [0, 2, 4, 7, 9], bpm: 96, wave: "sine" },
  storm:  { root: 50, scale: [0, 3, 5, 6, 7, 10], bpm: 110, wave: "sawtooth" },
  shadow: { root: 48, scale: [0, 1, 5, 7, 8], bpm: 72, wave: "triangle" },
};
const midi = n => 440 * 2 ** ((n - 69) / 12);
let tune = null, tuneFor = "", nextNote = 0, step = 0;
// two 16-step phrases from a seeded random walk over the scale, played A B A B, ending on the root
function makeTune(id) {
  const kind = Object.keys(THEMES).find(k => THEMES[k] === MAPS[id].theme);
  const M = MUSIC[kind] || MUSIC.meadow;
  let s = [...MAPS[id].name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  const phrase = () => {
    const out = [];
    let deg = M.scale.length;
    for (let i = 0; i < 16; i++) {
      if (i % 4 && rnd() < 0.25) { out.push(null); continue; }
      deg = clamp(deg + Math.round((rnd() - 0.5) * 4), 0, M.scale.length * 2 - 1);
      out.push(deg);
    }
    return out;
  };
  const a = phrase(), b = phrase();
  return { M, mel: [...a, ...b, ...a, ...b.slice(0, 15), 0] };
}
// called every frame: schedules the next notes a little ahead so they land on the beat
function musicTick() {
  if (!actx || actx.state !== "running" || !settings.music) return;
  if (tuneFor !== P.map) { tune = makeTune(P.map); tuneFor = P.map; step = 0; nextNote = actx.currentTime + 0.1; }
  // after the tab was hidden, pick up from now instead of playing every missed note at once
  if (nextNote < actx.currentTime - 0.1) nextNote = actx.currentTime + 0.05;
  const { M, mel } = tune, beat = 60 / M.bpm / 2;
  while (nextNote < actx.currentTime + 0.25) {
    const at = nextNote - actx.currentTime, d = mel[step % mel.length];
    if (d !== null) {
      const n = M.root + 12 + M.scale[d % M.scale.length] + 12 * Math.floor(d / M.scale.length);
      tone(M.wave, midi(n), midi(n), beat * 1.8, 0.5, at, musicGain);
    }
    if (step % 4 === 0) { const bn = M.root - 12 + (step % 16 === 8 ? 7 : 0); tone("sine", midi(bn), midi(bn), beat * 3.5, 0.6, at, musicGain); }
    step++; nextNote += beat;
  }
}
