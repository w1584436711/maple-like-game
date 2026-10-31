// Balance simulation: runs inside the game page and uses the game's own formulas (need, rollDamage, the skill
// and item tables) to estimate how fast each job levels and kills bosses. tests/smoke.spec.js and
// tools/balance.js load it into the page with addScriptTag; it changes the character, so reload afterwards.
"use strict";
const SIM = (() => {
  const LINES = {
    warrior: ["warrior", "berserker", "swordsaint", "swordking"],
    magician: ["magician", "elementalist", "starsage", "astromancer"],
    bowman: ["bowman", "hawkeye", "ranger", "skyarcher"],
    thief: ["thief", "assassin", "nightlord", "shadowlord"],
  };
  const TIER_LV = [10, 30, 50, 70];
  // where you train at each level: the strongest field monster at most two levels above you
  const TRAIN = ["sheep", "sprite", "rhino", "fox", "worm", "cactus", "wisp", "soldier", "scarab"];
  const trainAt = lv => [...TRAIN].reverse().find(t => TYPES[t].lv <= lv + 2) || TRAIN[0];
  // the bosses and the levels you would fight them at
  const BOSSES = { treant: [30, 35], eagle: [45, 50], scorpking: [70, 75], colossus: [75, 80, 85] };
  // monsters in one pack when training: area skills hit up to this many at once
  const PACK = 3;

  // a seeded random so every run gives the same numbers
  function seeded(fn) {
    const real = Math.random;
    let a = 12345;
    Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { return fn(); } finally { Math.random = real; }
  }

  // a typical character of one job line at one level: AP into the main stat (warriors and thieves keep
  // DEX at level + 4 for accuracy), the best gear the level allows without scrolls, and SP spent on the
  // job's first attack, then mastery, critical and damage passives, the job's other attacks, then the rest
  function build(line, lv, { raidGear = lv >= 80, books = lv >= 80 } = {}) {
    const job = LINES[line][TIER_LV.filter(t => lv >= t).length - 1];
    Object.assign(P, freshCharacter(), { lv, job, look: P.look });
    const keep = { warrior: { dex: lv + 4 }, magician: {}, bowman: {}, thief: { dex: lv + 4 } }[line];
    const main = { warrior: "str", magician: "int", bowman: "dex", thief: "luk" }[line];
    const pool = 25 + 5 * (lv - 1);
    for (const k of ["str", "dex", "int", "luk"]) P[k] = keep[k] || 4;
    P[main] = pool - ["str", "dex", "int", "luk"].filter(k => k !== main).reduce((s, k) => s + P[k], 0);
    // gear
    const wtype = ITEMS[JOBS[line].weapon].wtype;
    P.eq = {};
    for (const slot of Object.keys(EQUIP_SLOTS)) {
      if (slot === "shield" && WTYPES[wtype].twoHand) continue;
      const fits = Object.values(ITEMS).filter(I => I.slot === slot && (I.req?.lv || 0) <= lv && (!I.jobs || I.jobs.includes(line))
        && (slot !== "weapon" || I.wtype === wtype) && (raidGear || !I.id.startsWith("magma_")) && !I.made);
      fits.sort((a, b) => (b.req?.lv || 0) - (a.req?.lv || 0) || b.price - a.price);
      P.eq[slot] = fits[0] ? { id: fits[0].id, n: 1 } : null;
    }
    P.bag = newBag();
    if (wtype === "bow") addTo(P.bag, "arrow", 1000);
    if (wtype === "claw") addTo(P.bag, lv >= 30 ? "steel_star" : "iron_star", 500);
    // skills
    P.books = books ? Object.values(FOURTH_SKILLS).flat().map(s => s.id) : [];
    // SP comes in job by job: what you earn as a first job can only go into first-job skills, and so on
    const tiers = jobLine();
    const own = tiers.flatMap((j, i) => (SKILLS[j] || []).map(s => ({ s, tier: i })));
    const boosts = s => s.mastery || s.crit || s.matk || s.dmg || s.watk;
    P.skills = {};
    tiers.forEach((j, now) => {
      const end = Math.min(lv, TIER_LV[now + 1] || lv);
      let sp = (now === 3 ? 3 : 1) + 3 * (end - TIER_LV[now]);
      const first = (SKILLS[j] || []).find(s => s.type === "atk");
      const rank = ({ s, tier }) => s === first ? 0 : s.type === "passive" && boosts(s) ? 1 : s.type === "atk" && tier === now ? 2
        : s.type === "buff" && boosts(s) ? 3 : s.type === "atk" ? 4 - tier / 10 : 5;
      const can = own.filter(o => o.tier <= now).sort((a, b) => rank(a) - rank(b));
      for (const { s } of can) {
        const n = Math.min(skillCap(s) - (P.skills[s.id] || 0), sp);
        if (n > 0) { P.skills[s.id] = (P.skills[s.id] || 0) + n; sp -= n; }
      }
    });
    // buffs that last minutes are always on; the fourth-job damage buffs are worked out by their uptime
    P.buffs = {};
    for (const { s } of own) if (s.type === "buff" && !s.cd && P.skills[s.id]) P.buffs[s.id] = 999;
    P.hp = maxHp(); P.mp = maxMp();
    return job;
  }

  // the attacks you have now: [skill or null for the basic attack, seconds it takes, hits on one target, targets]
  function attacks() {
    const w = weapon(), list = [[null, w.wtype === "bow" || w.wtype === "claw" ? 0.5 : SLASH_T, 1, 1]];
    for (const s of jobSkills()) {
      if (s.type !== "atk" || !skLv(s.id)) continue;
      const t = s.shot ? (s.spell ? 0.55 : 0.6) : s.melee ? SLASH_T : SKILL_T;
      list.push([s, t, (s.hits || 1) * (s.shots || 1), s.sweep ? 6 : s.shot ? s.pierce || 1 : s.targets || 1]);
    }
    return list;
  }
  // average damage of one hit on monster t, misses included
  function perHit(t, s) {
    const m = { T: TYPES[t] }, o = !s ? {} : s.spell ? { magic: true, spell: s.spell(skLv(s.id)) } : { pct: s.pct(skLv(s.id)) };
    let sum = 0;
    for (let i = 0; i < 400; i++) sum += rollDamage(m, o)?.d || 0;
    return sum / 400;
  }
  // damage per second against monster t when up to `pack` of them stand together: the best attack you
  // can repeat, plus what each cooldown skill adds over it
  function dpsNow(t, pack) {
    const rows = attacks().map(([s, time, hits, targets]) => ({ s, time, rate: perHit(t, s) * hits * Math.min(targets, pack) / time }));
    const base = Math.max(...rows.filter(r => !r.s?.cd).map(r => r.rate));
    let dps = base;
    for (const r of rows.filter(r => r.s?.cd)) {
      const cd = r.s.cd(skLv(r.s.id));
      dps += Math.max(0, (r.rate - base) * r.time / cd);
    }
    return dps;
  }
  function dps(t, pack = 1) {
    const buff = jobSkills().find(s => s.type === "buff" && s.cd && s.dmg && skLv(s.id));
    if (!buff) return dpsNow(t, pack);
    const l = skLv(buff.id), up = Math.min(1, buff.dur(l) / buff.cd(l));
    P.buffs[buff.id] = 0; const off = dpsNow(t, pack);
    P.buffs[buff.id] = 999; const on = dpsNow(t, pack);
    P.buffs[buff.id] = 0;
    return up * on + (1 - up) * off;
  }

  // levelling from lv to lv + 1: where you train, how many kills, how long a kill takes for each job
  function levelRow(lv) {
    const t = trainAt(lv), T = TYPES[t];
    const was = P.lv; P.lv = lv; const kills = Math.ceil(need() / (T.exp * EXP_RATE)); P.lv = was;
    const secs = {};
    // a pack of PACK monsters takes PACK * hp / dps, so each kill takes hp / dps
    for (const line of Object.keys(LINES)) { build(line, lv); secs[line] = T.hp / dps(t, PACK); }
    return { lv, mob: t, kills, secs };
  }
  // seconds of nonstop attacking to beat a boss; the colossus's arms come twice and stand side by side
  function bossTime(boss, line, lv) {
    build(line, lv);
    if (boss !== "colossus") return TYPES[boss].hp / dps(boss, 1);
    const arms = 2 * TYPES.carm.hp * 1.6;
    return arms / dps("carm", 2) + TYPES.colossus.hp / dps("colossus", 1);
  }
  // coins from one kill: the coins it drops plus what its drops sell for (gear at half its shop price)
  function coinsPerKill(t) {
    const T = TYPES[t];
    let v = 0.9 * (T.coin[0] + T.coin[1]) / 2;
    for (const [id, chance, a = 1, b = a] of T.drops) {
      if (typeof id === "function") continue;
      const ids = Array.isArray(id) ? id : [id];
      v += chance * (a + b) / 2 * ids.reduce((s, i) => s + ITEMS[i].sell, 0) / ids.length;
    }
    return v;
  }

  const run = fn => seeded(fn);
  return {
    LINES, BOSSES, PACK, trainAt, build, dps, coinsPerKill,
    levels: (from, to) => run(() => { const rows = []; for (let lv = from; lv < to; lv++) rows.push(levelRow(lv)); return rows; }),
    bosses: () => run(() => Object.entries(BOSSES).flatMap(([boss, lvs]) => lvs.map(lv => ({
      boss, lv, secs: Object.fromEntries(Object.keys(LINES).map(line => [line, bossTime(boss, line, lv)])),
    })))),
    // coins earned while levelling from `from` to `to` (both what drops and what the drops sell for)
    coins: (from, to) => run(() => {
      let sum = 0;
      for (let lv = from; lv < to; lv++) { const t = trainAt(lv); const was = P.lv; P.lv = lv; sum += need() / (TYPES[t].exp * EXP_RATE) * coinsPerKill(t); P.lv = was; }
      return sum;
    }),
  };
})();
