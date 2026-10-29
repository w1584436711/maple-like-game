// The stat, skill, bag, equipment, shop, quest and world map windows.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Stat and skill windows ----------
const statsWin = document.getElementById("statsWin"), skillsWin = document.getElementById("skillsWin");
const statsBody = document.getElementById("statsBody"), skillsBody = document.getElementById("skillsBody");
const invWin = document.getElementById("invWin"), equipWin = document.getElementById("equipWin");
const invBody = document.getElementById("invBody"), equipBody = document.getElementById("equipBody");
const worldWin = document.getElementById("worldWin"), worldBody = document.getElementById("worldBody");
const shopWin = document.getElementById("shopWin"), shopBody = document.getElementById("shopBody");
const questWin = document.getElementById("questWin"), questBody = document.getElementById("questBody");
const keysWin = document.getElementById("keysWin"), keysBody = document.getElementById("keysBody");
const setWin = document.getElementById("setWin"), setBody = document.getElementById("setBody");
const collectWin = document.getElementById("collectWin"), collectBody = document.getElementById("collectBody");
function togglePanel(w) { w.hidden = !w.hidden; if (!w.hidden) refreshPanels(true); }
let panelSig = "";
function refreshPanels(force) {
  const sig = JSON.stringify([P.cards, P.titles, P.title, collectTab, P.lv, P.exp, P.job, P.str, P.dex, P.int, P.luk, P.ap, P.sp, P.mhp, P.mmp, P.skills, P.coins, bagVer, P.map, P.quests, shopMode, shopTab, sellArm, binding, P.slots]);
  if (!force && sig === panelSig) return;
  panelSig = sig;
  if (!statsWin.hidden) renderStats();
  if (!skillsWin.hidden) renderSkills();
  if (!invWin.hidden) renderInv();
  if (!equipWin.hidden) renderEquip();
  if (!worldWin.hidden) renderWorld();
  if (!shopWin.hidden) renderShop();
  if (!questWin.hidden) renderQuests();
  if (!keysWin.hidden) renderKeys();
  if (force && !setWin.hidden) renderSettings();
  if (!collectWin.hidden) renderCollection();
}
function renderShop() {
  document.getElementById("shopTitle").textContent = shopNpc.name;
  if (shopNpc.storage) { renderStorage(); return; }
  let html = `<div class="tabs" role="tablist" aria-label="買或賣">`
    + [["buy", "買"], ["sell", "賣"]].map(([k, n]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="${shopMode === k}">${n}</button>`).join("") + `</div>`;
  if (shopMode === "buy") {
    SHOPS[shopNpc.shop].forEach(([id, per], k) => {
      const I = ITEMS[id], cost = I.price * per, bad = I.slot && !canWear(I);
      const jobs = I.jobs ? I.jobs.filter(j => j !== "beginner").map(j => JOBS[j].name).join("、") || "新手" : "";
      const what = I.slot ? [EQUIP_SLOTS[I.slot], I.req?.lv && `Lv.${I.req.lv}`, jobs].filter(Boolean).join("．") : I.desc;
      html += `<div class="srow"><img src="${itemIcon(id).url}" alt=""><div class="what"><b class="${bad ? "bad" : ""}">${esc(I.name)}${per > 1 ? ` ×${per}` : ""}</b><small>${esc(what)}</small></div>`
        + `<span class="price">${cost.toLocaleString()}</span>`
        + `<button type="button" class="btn" data-buy="${k}" data-times="1"${P.coins < cost ? " disabled" : ""} aria-label="買${esc(I.name)}">買</button>`
        + (I.cat === "use" && per === 1 ? `<button type="button" class="btn" data-buy="${k}" data-times="10"${P.coins < cost * 10 ? " disabled" : ""} aria-label="買 10 個${esc(I.name)}">買 10</button>` : "")
        + `</div>`;
    });
  } else {
    html += `<div class="tabs" role="tablist" aria-label="背包分頁">`
      + Object.entries(TABS).map(([k, n]) => `<button type="button" role="tab" data-stab="${k}" aria-selected="${k === shopTab}">${n}</button>`).join("") + `</div>`;
    const rows = P.bag[shopTab].map((s, i) => [s, i]).filter(([s]) => s);
    if (!rows.length) html += `<p class="note">這一欄是空的。</p>`;
    for (const [s, i] of rows) {
      const I = ITEMS[s.id], one = sellPrice(I, 1);
      html += `<div class="srow"><img src="${itemIcon(s.id).url}" alt=""><div class="what"><b>${esc(I.slot ? gearName(s) : I.name)}${s.n > 1 ? ` ×${s.n}` : ""}</b><small>每個 ${one.toLocaleString()} 金幣</small></div>`
        + (s.n > 1
          ? `<button type="button" class="btn" data-sell="${i}" aria-label="賣 1 個${esc(I.name)}">賣 1</button>`
            + `<button type="button" class="btn" data-sell="${i}" data-all="1" aria-label="全部賣掉${esc(I.name)}">全部 ${sellPrice(I, s.n).toLocaleString()}</button>`
          // equipment asks once more before it goes, so a rare weapon is never sold by a stray click
          : `<button type="button" class="btn${sellArm === i ? " warn" : ""}" data-sell="${i}" data-all="1" aria-label="賣掉${esc(I.name)}">${sellArm === i ? "確定賣掉？" : "賣"}</button>`)
        + `</div>`;
    }
  }
  html += `<div class="money">金幣 <b>${P.coins.toLocaleString()}</b></div>`;
  shopBody.innerHTML = html;
}
function renderStorage() {
  const row = (s, attr, verb) => {
    const I = ITEMS[s.id], name = I.slot ? gearName(s) : I.name;
    return `<div class="srow"><img src="${itemIcon(s.id).url}" alt=""><div class="what"><b>${esc(name)}${s.n > 1 ? ` ×${s.n}` : ""}</b><small>${TABS[I.cat]}</small></div>`
      + (s.n > 1
        ? `<button type="button" class="btn" ${attr} aria-label="${verb} 1 個${esc(I.name)}">${verb} 1</button><button type="button" class="btn" ${attr} data-all="1" aria-label="全部${verb}${esc(I.name)}">全部</button>`
        : `<button type="button" class="btn" ${attr} data-all="1" aria-label="${verb}${esc(name)}">${verb}</button>`)
      + `</div>`;
  };
  let html = `<div class="tabs" role="tablist" aria-label="存入或取出">`
    + [["put", "存入"], ["take", "取出"]].map(([k, n]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="${shopMode === k}">${n}</button>`).join("") + `</div>`;
  if (shopMode === "put") {
    html += `<div class="tabs" role="tablist" aria-label="背包分頁">`
      + Object.entries(TABS).map(([k, n]) => `<button type="button" role="tab" data-stab="${k}" aria-selected="${k === shopTab}">${n}</button>`).join("") + `</div>`;
    const rows = P.bag[shopTab].map((s, i) => s && row(s, `data-store="${i}"`, "存入")).filter(Boolean);
    html += rows.join("") || `<p class="note">這一欄是空的。</p>`;
  } else {
    const rows = P.storage.map((s, j) => s && row(s, `data-take="${j}"`, "取出")).filter(Boolean);
    html += rows.join("") || `<p class="note">倉庫裡還沒有東西。</p>`;
  }
  html += `<div class="money">倉庫 <b>${P.storage.filter(Boolean).length} / ${BAG_SLOTS}</b> 格</div>`;
  shopBody.innerHTML = html;
}
shopBody.addEventListener("click", e => {
  const t = e.target.closest("[data-mode],[data-stab],[data-buy],[data-sell],[data-store],[data-take]");
  if (!t) return;
  if (t.dataset.store) { store(Number(t.dataset.store), !!t.dataset.all); refreshPanels(true); return; }
  if (t.dataset.take) { takeOut(Number(t.dataset.take), !!t.dataset.all); refreshPanels(true); return; }
  if (t.dataset.mode) { shopMode = t.dataset.mode; sellArm = -1; }
  else if (t.dataset.stab) { shopTab = t.dataset.stab; sellArm = -1; }
  else if (t.dataset.buy) buy(Number(t.dataset.buy), Number(t.dataset.times));
  else {
    const i = Number(t.dataset.sell), s = P.bag[shopTab][i];
    if (s && ITEMS[s.id].slot && sellArm !== i) sellArm = i;
    else sell(i, !!t.dataset.all);
  }
  refreshPanels(true);
});
function renderQuests() {
  const all = Object.values(QUESTS);
  const block = (title, list, body) => list.length ? `<div class="qhead">${title}</div>` + list.map(body).join("") : "";
  const active = all.filter(q => ["active", "ready"].includes(questState(q)));
  let html = block("進行中", active, q => `<div class="quest"><b>${esc(q.name)}</b>　<small>${esc(NPCS[q.npc].name)}</small>`
    + questGoals(q).map(g => `<p class="${g.have >= g.need ? "ok" : ""}">${esc(g.text)} ${g.have} / ${g.need}</p>`).join("")
    + (questState(q) === "ready" ? `<p class="ok">完成了！回去找${esc(NPCS[q.npc].name)}回報</p>` : "") + `</div>`);
  html += block("可以接的任務", all.filter(q => questState(q) === "available"),
    q => `<div class="quest"><b>${q.daily ? "【每日】" : ""}${esc(q.name)}</b><p>去${esc(MAPS[NPCS[q.npc].map].name)}找${esc(NPCS[q.npc].name)}</p></div>`);
  html += block("每日任務（今天已完成，明天再來）", all.filter(q => q.daily && questState(q) === "done"), q => `<div class="quest"><p>✔ ${esc(q.name)}</p></div>`);
  html += block("已完成", all.filter(q => !q.daily && questState(q) === "done"), q => `<div class="quest"><p>✔ ${esc(q.name)}</p></div>`);
  questBody.innerHTML = html || `<p class="note">現在沒有任務。等級提升後再去村裡找人聊聊吧。</p>`;
}
// grouped by island; within one, each place leads to the next
function renderWorld() {
  worldBody.innerHTML = MAP_ORDER.map((id, i) => {
    const m = MAPS[id], here = m === map, first = !i || MAPS[MAP_ORDER[i - 1]].area !== m.area;
    const who = m.town ? m.note : mapMobs(id).join("、");
    return (first ? `<div class="qhead">${esc(m.area)}</div>` : `<div class="link" aria-hidden="true"></div>`)
      + `<div class="place${here ? " here" : ""}"><b>${esc(m.name)}</b>${here ? `<span class="tag">你在這裡</span>` : ""}<p>${esc(who)}</p></div>`;
  }).join("") + `<p class="note">走到傳送門按 ↑ 換地圖。浮島、雲頂和沉砂之間找飛船船長搭飛船。回村卷軸會帶你回到這片大陸的城鎮。</p>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const row = (label, value) => `<div class="row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
const PRIMARY = { beginner: "str", warrior: "str", magician: "int", bowman: "dex", thief: "luk" };
function renderStats() {
  const [mn, mx] = physRange();
  let html = row("職業", job().name) + row("等級", P.lv) + row("經驗值", `${P.exp} / ${need()}`)
    + row("HP", maxHp()) + row("MP", maxMp()) + row("攻擊", `${Math.floor(mn)} ~ ${Math.floor(mx)}`);
  if (root(P.job) === "magician") html += row("魔力", magic());
  html += row("防禦", gear("def")) + row("命中", Math.floor(accuracy())) + row("迴避", Math.floor(avoidability()));
  html += `<div class="ap">可分配能力值 <b>${P.ap}</b></div>`;
  for (const k of ["str", "dex", "int", "luk"]) {
    // like the original, bonuses from gear show next to the base value: 力量 35 (+2)
    const bonus = gear(k);
    html += `<div class="row stat${PRIMARY[root(P.job)] === k ? " main" : ""}"><span>${STAT_NAMES[k]}${bonus ? ` <small>(+${bonus})</small>` : ""}</span><b>${P[k]}</b>`
      + `<button type="button" class="plus" data-stat="${k}" aria-label="${STAT_NAMES[k]}加 1"${P.ap > 0 ? "" : " disabled"}>+</button></div>`;
  }
  statsBody.innerHTML = html;
}
const TYPE_NAMES = { atk: "攻擊", buff: "輔助", passive: "被動" };
const canLearn = s => P.sp > 0 && skLv(s.id) < skillCap(s) && (!s.req || skLv(s.req[0]) >= s.req[1]);
function renderSkills() {
  if (P.job === "beginner") {
    skillsBody.innerHTML = `<p class="note">新手還不能學技能。Lv.10（法師 Lv.8）回浮島村找轉職教官薇拉轉職，就能用 SP 學技能。</p>`;
    return;
  }
  const slots = slotSkills();
  let html = `<div class="ap">剩餘 SP <b>${P.sp}</b></div>`;
  // one heading per job in the line: first, second, third
  for (const j of jobLine()) {
    html += `<div class="qhead">${esc(JOBS[j].name)}技能</div>`;
    for (const s of SKILLS[j] || []) {
      const l = skLv(s.id), slot = slots.indexOf(s);
      const lock = s.req && skLv(s.req[0]) < s.req[1] ? `需要「${SKILL_BY_ID[s.req[0]].name}」Lv.${s.req[1]}` : "";
      const now = l ? s.desc(l) : "還沒學會";
      const cap = skillCap(s);
      const next = l < cap ? `下一級：${s.desc(l + 1)}` : cap < s.max ? `目前最高 Lv.${cap}，讀「${s.name}技能書」才能升到 Lv.${s.max}` : "已經滿級";
      const cost = [s.mp && `MP ${s.mp(Math.max(1, l))}`, s.cd && `冷卻 ${s.cd(Math.max(1, l))} 秒`].filter(Boolean).join("．");
      // active skills pick their key from a list: skill 1 to 7, or none
      const keySel = s.type === "passive" ? "" : `<select class="keysel" data-slot-of="${s.id}" aria-label="${esc(s.name)}放在哪個鍵">`
        + `<option value="-1"${slot < 0 ? " selected" : ""}>不放</option>`
        + Array.from({ length: SKILL_SLOTS }, (_, k) => `<option value="${k}"${slot === k ? " selected" : ""}>${k + 1}．${esc(keyOf(`skill${k + 1}`))} 鍵</option>`).join("")
        + `</select>`;
      html += `<div class="skill"><div class="row"><span><b class="sname">${esc(s.name)}</b> <small>${TYPE_NAMES[s.type]}</small></span>`
        + `${keySel}<b>${l} / ${cap}</b><button type="button" class="plus" data-skill="${s.id}" aria-label="${esc(s.name)}加 1"${canLearn(s) ? "" : " disabled"}>+</button></div>`
        + `<p>${esc(now)}${cost ? `．${cost}` : ""}</p><p class="dim">${esc(lock || next)}</p></div>`;
    }
  }
  skillsBody.innerHTML = html;
}
skillsBody.addEventListener("change", e => {
  const sel = e.target.closest("[data-slot-of]");
  if (!sel) return;
  assignSlot(sel.dataset.slotOf, Number(sel.value));
  refreshPanels(true); save();
  cv.focus({ preventScroll: true });
});
statsBody.addEventListener("click", e => {
  const b = e.target.closest("[data-stat]");
  if (!b || P.ap <= 0) return;
  P[b.dataset.stat]++; P.ap--;
  refreshPanels(true); save();
  if (e.detail) cv.focus({ preventScroll: true });
});
skillsBody.addEventListener("click", e => {
  const b = e.target.closest("[data-skill]");
  const s = b && SKILL_BY_ID[b.dataset.skill];
  if (!s || !canLearn(s)) return;
  P.skills[s.id] = skLv(s.id) + 1; P.sp--;
  if (skLv(s.id) === 1) msg(`學會了「${s.name}」`, "#cfe3ff");
  refreshPanels(true); save();
  if (e.detail) cv.focus({ preventScroll: true });
});
// ---------- Bag and equipment ----------
let bagVer = 0, invTab = "equip", invSel = null, eqSel = null;
const countItem = id => P.bag[ITEMS[id].cat].reduce((n, s) => n + (s?.id === id ? s.n : 0), 0);
// how many more of an item fit: space left in its stacks plus empty slots
const roomFor = id => { const I = ITEMS[id]; return P.bag[I.cat].reduce((n, s) => n + (!s ? I.stack : s.id === id ? I.stack - s.n : 0), 0); };
function addItem(id, n = 1) { const left = addTo(P.bag, id, n); if (left < n) bagVer++; return left; }
// rewards that do not fit fall at your feet instead of disappearing
function giveItem(id, n = 1) {
  const left = addItem(id, n);
  if (left) { addDrop("item", P.x + P.w / 2, P.y + P.h - 20, left, id); msg(`背包滿了，${ITEMS[id].name}掉在地上`, "#ff9b8f"); }
}
// takes n of an item out of the bag, from the first stacks on
function removeItem(id, n) {
  const tab = P.bag[ITEMS[id].cat];
  tab.forEach((s, i) => { if (n > 0 && s?.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) tab[i] = null; } });
  bagVer++;
}
function takeFromSlot(tab, i, n = 1) {
  const s = P.bag[tab][i];
  if ((s.n -= n) <= 0) P.bag[tab][i] = null;
  bagVer++;
}
function useAmmo(n) {
  for (const s of ammoStacks()) { const k = Math.min(n, s.n); s.n -= k; if (!(n -= k)) break; }
  P.bag.use.forEach((s, i) => { if (s && s.n <= 0) P.bag.use[i] = null; });
  bagVer++;
}
function reqLines(I) {
  const r = I.req || {}, out = [];
  if (r.lv) out.push({ text: `等級 ${r.lv}`, ok: P.lv >= r.lv });
  for (const k in STAT_NAMES) if (r[k]) out.push({ text: `${STAT_NAMES[k]} ${r[k]}`, ok: P[k] >= r[k] });
  if (I.jobs) out.push({ text: I.jobs.map(j => JOBS[j].name).join("、") + "可用", ok: I.jobs.includes(root(P.job)) });
  return out;
}
const canWear = I => reqLines(I).every(l => l.ok);
function afterGearChange() { P.hp = Math.min(P.hp, maxHp()); P.mp = Math.min(P.mp, maxMp()); bagVer++; }
// force skips the requirement check, for gear the game hands you
function equipFrom(i, force) {
  const s = P.bag.equip[i];
  if (!s || P.dead) return false;
  const I = ITEMS[s.id], slot = I.slot, held = weapon();
  if (!force && !canWear(I)) { hint(`還不能裝備「${I.name}」，需要${reqLines(I).filter(l => !l.ok).map(l => l.text).join("、")}`); return false; }
  if (slot === "shield" && held && WTYPES[held.wtype].twoHand) { hint(`拿著${WTYPES[held.wtype].name}的時候不能用盾牌`); return false; }
  // the piece you take off goes into this bag slot; a shield pushed off by a two-handed weapon needs one more
  const off = slot === "weapon" && WTYPES[I.wtype].twoHand ? P.eq.shield : null;
  const back = [P.eq[slot], off].filter(Boolean);
  if (back.length > 1 + P.bag.equip.filter(x => !x).length) { hint("背包的裝備欄滿了"); return false; }
  P.bag.equip[i] = null;
  P.eq[slot] = s;
  if (off) P.eq.shield = null;
  for (const b of back) P.bag.equip[P.bag.equip[i] ? P.bag.equip.indexOf(null) : i] = b;
  afterGearChange();
  if (!force) msg(`裝備了「${I.name}」`, "#cfe3ff");
  return true;
}
function unequip(slot) {
  const s = P.eq[slot], j = P.bag.equip.indexOf(null);
  if (!s || P.dead) return;
  if (j < 0) { hint("背包的裝備欄滿了"); return; }
  P.bag.equip[j] = s; P.eq[slot] = null;
  afterGearChange();
  msg(`卸下了「${ITEMS[s.id].name}」`, "#cfe3ff");
}
// the potion keys drink the strongest kind you are carrying: white before red, mana before blue
const POTS = { hp: ["white_pot", "red_pot"], mp: ["mana_pot", "blue_pot"] };
const potFor = kind => POTS[kind].find(id => countItem(id) > 0) || POTS[kind][POTS[kind].length - 1];
// i picks the bag slot; without it the first stack is used, as with keys 1 and 2
function drink(id, i = P.bag.use.findIndex(s => s?.id === id)) {
  const I = ITEMS[id];
  if (P.dead || P.potCd > 0) return;
  if (i < 0) { hint(`沒有${I.name}了`); return; }
  const hp = Math.min(I.heal.hp || 0, maxHp() - P.hp), mp = Math.min(I.heal.mp || 0, maxMp() - P.mp);
  if (hp <= 0 && mp <= 0) return;
  takeFromSlot("use", i);
  P.hp += hp; P.mp += mp; P.potCd = 0.3;
  sfx("potion");
  if (hp > 0) nums.push({ x: P.x + P.w / 2, y: P.y - 6, text: "+" + hp, kind: "heal", t: 0 });
  if (mp > 0) nums.push({ x: P.x + P.w / 2, y: P.y - 6, text: "+" + mp, kind: "mana", t: 0 });
}
// a skill book lifts its fourth-job skill's cap from Lv.20 to Lv.30, for the job that can read it
function readBook(i) {
  const I = ITEMS[P.bag.use[i].id], s = SKILL_BY_ID[I.book];
  if (!jobSkills().includes(s)) { hint(`看不懂這本書……只有${JOBS[Object.keys(FOURTH_SKILLS).find(j => FOURTH_SKILLS[j].includes(s))].name}能讀`); return; }
  if (P.books.includes(s.id)) { hint(`已經讀過「${I.name}」了`); return; }
  takeFromSlot("use", i);
  P.books.push(s.id);
  sfx("levelup");
  fx.push({ k: "buff", t: 0 });
  msg(`讀懂了${I.name}！「${s.name}」最高可以升到 Lv.${s.max}`, "#ffc94a");
  save();
}
function readScroll(i) {
  if (P.dead) return;
  if (map.town) { hint(`你已經在${map.name}了`); return; }
  takeFromSlot("use", i);
  goToTown();
  msg(`讀了回村卷軸，回到${map.name}`, "#cfe3ff");
  save();
}
// gear from monsters comes with each stat a little above or below normal (about 10%, at least 1),
// like the original's lucky and unlucky drops
function rollGear(id) {
  const I = ITEMS[id], g = { id, n: 1 }, vary = {};
  for (const k in GEAR_STATS) {
    if (!(I[k] > 0)) continue;
    const r = Math.max(1, Math.round(I[k] * 0.1)), d = Math.max(-I[k], randi(-r, r));
    if (d) vary[k] = d;
  }
  if (Object.keys(vary).length) g.vary = vary;
  return g;
}
// a piece of gear keeps its scroll upgrades when it is dropped and picked up again
function putGear(g) {
  const j = P.bag.equip.indexOf(null);
  if (j < 0) return 1;
  P.bag.equip[j] = g; bagVer++;
  return 0;
}
function discard(tab, i) {
  const s = P.bag[tab][i];
  if (!s || P.dead) return;
  P.bag[tab][i] = null; bagVer++;
  addDrop("item", P.x + P.w / 2 + P.face * 20, P.y + P.h - 20, s.n, s.id);
  if (ITEMS[s.id].slot) drops[drops.length - 1].gear = s;
  msg(`丟掉了${ITEMS[s.id].name}${s.n > 1 ? ` ×${s.n}` : ""}`, "#9fb0cd");
}

// ---------- Enhancement scrolls ----------
const gearLeft = g => g.left ?? ITEMS[g.id].slots;
const gearName = g => ITEMS[g.id].name + (g.up ? ` +${g.up}` : "");
let scrollPick = null;  // the bag slot of a scroll waiting for you to pick the gear it goes on
// gear in the bag and on the body that a scroll can still go on
// slots used up by failed scrolls: everything spent that did not turn into an upgrade
const gearFailed = g => ITEMS[g.id].slots - gearLeft(g) - (g.up || 0);
const scrollFits = (S, g) => S.slots.includes(ITEMS[g.id].slot)
  && (S.kind === "restore" ? gearFailed(g) > 0 : S.kind === "guard" ? !g.guard && gearLeft(g) > 0 : gearLeft(g) > 0);
function scrollTargets(S) {
  const out = [];
  P.bag.equip.forEach((g, i) => { if (g && scrollFits(S, g)) out.push([`bag:${i}`, g, ""]); });
  for (const k of EQ_ORDER) { const g = P.eq[k]; if (g && scrollFits(S, g)) out.push([`eq:${k}`, g, "（身上）"]); }
  return out;
}
function applyScroll(si, target) {
  const sc = P.bag.use[si], S = sc && ITEMS[sc.id].scroll;
  const [where, key] = target.split(":");
  const g = where === "eq" ? P.eq[key] : P.bag.equip[Number(key)];
  if (!S || !g || P.dead) return;
  const I = ITEMS[g.id];
  if (!scrollFits(S, g)) return;
  takeFromSlot("use", si);
  if (S.kind === "guard") {
    g.guard = true;
    msg(`${gearName(g)}貼上了防爆卷軸`, "#cfe3ff");
  } else if (S.kind === "restore") {
    if (Math.random() < S.rate) { g.left = gearLeft(g) + 1; msg(`回復成功！${I.name}的可升級次數多了一次`, "#ffc94a"); fx.push({ k: "lvup", t: 0, text: "SUCCESS!" }); }
    else msg("回復失敗……", "#ff9b8f");
  } else if (Math.random() < S.rate) {
    g.left = gearLeft(g) - 1;
    g.bonus = g.bonus || {};
    for (const [k, v] of Object.entries(S.add)) g.bonus[k] = (g.bonus[k] || 0) + v;
    g.up = (g.up || 0) + 1;
    msg(`強化成功！${gearName(g)}`, "#ffc94a"); sfx("quest");
    fx.push({ k: "lvup", t: 0, text: "SUCCESS!" });
  } else if (g.guard) {
    msg(`強化失敗，但防爆卷軸保住了${I.name}的可升級次數`, "#cfe3ff");
  } else {
    g.left = gearLeft(g) - 1;
    msg(`強化失敗……${I.name}的可升級次數少了一次`, "#ff9b8f"); sfx("fail");
  }
  // a guard scroll is used up by the next enhancement scroll, whether it works or not
  if (!S.kind) delete g.guard;
  afterGearChange(); save();
}

// g is the piece of gear itself, when there is one, so its scroll bonuses and upgrade slots show
function itemInfo(I, n, acts, g) {
  let h = `<div class="info"><h3>${esc(g ? gearName(g) : I.name)}${n > 1 ? ` ×${n}` : ""}</h3>`;
  if (I.slot) {
    const wt = I.wtype && WTYPES[I.wtype];
    h += `<p class="dim">${EQUIP_SLOTS[I.slot]}${wt ? `．${wt.name}${wt.twoHand ? "（雙手）" : ""}` : ""}</p>`;
    // the rolled difference shows green or red, scroll bonuses in gold
    const bon = Object.keys(GEAR_STATS).filter(k => I[k] || g?.bonus?.[k])
      .map(k => {
        const v = g?.vary?.[k] || 0, b = g?.bonus?.[k] || 0;
        return `${GEAR_STATS[k]} +${(I[k] || 0) + v + b}${v ? ` <small class="${v > 0 ? "lucky" : "bad"}">(${v > 0 ? "+" : ""}${v})</small>` : ""}${b ? ` <small class="up">(+${b})</small>` : ""}`;
      });
    if (bon.length) h += `<p>${bon.join("　")}</p>`;
    h += `<p class="dim">可升級次數 ${g ? gearLeft(g) : I.slots}${g?.guard ? "．已貼防爆卷軸" : ""}</p>`;
    if (I.set) {
      const S = SETS[I.set], n = setCount(I.set);
      h += `<p class="set">${esc(S.name)}（身上 ${n} / ${S.items.length} 件）</p>`
        + Object.entries(S.tiers).map(([need, add]) => `<p class="${n >= need ? "set" : "dim"}">${need} 件：${Object.entries(add).map(([k, v]) => `${GEAR_STATS[k]} +${v}`).join("、")}</p>`).join("");
    }
    const req = reqLines(I);
    if (req.length) h += `<p>需求：${req.map(l => `<span class="${l.ok ? "dim" : "bad"}">${esc(l.text)}</span>`).join("、")}</p>`;
  } else {
    h += `<p class="dim">${esc(I.desc)}</p>`;
    if (I.watk) h += `<p>攻擊 +${I.watk}</p>`;
  }
  return h + `<div class="acts">${acts}</div></div>`;
}
const actBtn = (act, label) => `<button type="button" class="btn" data-do="${act}">${label}</button>`;
function slotBtn(s, attr, sel, bad, label) {
  const I = ITEMS[s.id];
  return `<button type="button" class="slot${sel ? " sel" : ""}${bad ? " bad" : ""}" ${attr} aria-label="${esc(label)}">`
    + `<img src="${itemIcon(s.id).url}" alt="">${I.stack > 1 ? `<span class="n">${s.n}</span>` : s.up ? `<span class="n up">+${s.up}</span>` : ""}</button>`;
}
function renderInv() {
  const tab = P.bag[invTab];
  let html = `<div class="tabs" role="tablist" aria-label="背包分頁">`
    + Object.entries(TABS).map(([k, name]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === invTab}">${name}</button>`).join("")
    + `</div><div class="grid">`;
  tab.forEach((s, i) => {
    if (!s) { html += `<span class="slot" aria-hidden="true"></span>`; return; }
    const I = ITEMS[s.id];
    html += slotBtn(s, `data-i="${i}"`, i === invSel, I.slot && !canWear(I), `${I.slot ? gearName(s) : I.name}${s.n > 1 ? ` ×${s.n}` : ""}`);
  });
  html += `</div><div data-info>${invInfo()}</div>`;
  html += `<div class="money">金幣 <b>${P.coins.toLocaleString()}</b>　空格 ${tab.filter(x => !x).length} / ${BAG_SLOTS}</div>`;
  invBody.innerHTML = html;
}
function invInfo() {
  const s = invSel !== null && P.bag[invTab][invSel];
  if (!s) return `<p class="note">${invTab === "equip" ? "點一下看說明，點兩下直接穿上。" : invTab === "use" ? "點兩下喝藥水、讀卷軸。箭矢、飛鏢放在這裡，攻擊時自動用掉。" : "打怪撿到的材料。"}</p>`;
  const I = ITEMS[s.id];
  if (I.scroll && scrollPick === invSel) {
    const list = scrollTargets(I.scroll);
    const how = I.scroll.kind === "guard" ? "要貼在哪一件上？" : I.scroll.kind === "restore" ? `要回復哪一件？成功率 ${Math.round(I.scroll.rate * 100)}%。`
      : `要強化哪一件？成功率 ${Math.round(I.scroll.rate * 100)}%，失敗會用掉一次可升級次數（貼了防爆卷軸就不會）。`;
    return `<div class="info"><h3>${esc(I.name)}</h3><p class="dim">${how}</p>`
      + list.map(([t, g, where]) => `<button type="button" class="btn pickgear" data-target="${t}">${esc(gearName(g))}${where}　剩 ${gearLeft(g)} 次</button>`).join("")
      + `<div class="acts">${actBtn("cancel", "取消")}</div></div>`;
  }
  return itemInfo(I, s.n, (I.slot ? actBtn("equip", "裝備") : I.chair ? actBtn("use", P.sit === s.id ? "站起來" : "坐下")
    : I.heal || I.warp || I.scroll || I.feed || I.book ? actBtn("use", "使用") : "") + actBtn("drop", "丟掉"), I.slot ? s : null);
}
// picking a slot only moves the outline and swaps the description, so the slot under the
// pointer stays the same element and a double click on it still registers
function pick(body, btn, infoHtml) {
  body.querySelectorAll(".slot.sel").forEach(b => b.classList.remove("sel"));
  btn.classList.add("sel");
  body.querySelector("[data-info]").innerHTML = infoHtml;
}
// laid out like a paper doll: head, body and legs top to bottom
const EQ_ORDER = ["hat", "cape", "top", "gloves", "weapon", "bottom", "shield", "shoes", "earring", "necklace", "ring"];
function renderEquip() {
  let html = `<div class="eqgrid">`;
  for (const k of EQ_ORDER) {
    const s = P.eq[k];
    html += `<div class="cell">${s ? slotBtn(s, `data-slot="${k}"`, eqSel === k, false, `${EQUIP_SLOTS[k]}：${gearName(s)}`) : `<span class="slot" aria-hidden="true"></span>`}${EQUIP_SLOTS[k]}</div>`;
  }
  html += `</div>`;
  const bon = Object.keys(GEAR_STATS).filter(k => gearOnly(k)).map(k => `${GEAR_STATS[k]} +${gearOnly(k)}`);
  const sets = Object.entries(SETS).map(([id, S]) => [S, setCount(id)]).filter(([, n]) => n >= 2);
  html += `<p class="note">裝備加成：${bon.join("、") || "沒有"}</p>`
    + sets.map(([S, n]) => `<p class="note set">${esc(S.name)} ${n} / ${S.items.length} 件</p>`).join("")
    + `<div data-info>${equipInfo()}</div>`;
  equipBody.innerHTML = html;
}
function equipInfo() {
  if (eqSel && P.eq[eqSel]) return itemInfo(ITEMS[P.eq[eqSel].id], 1, actBtn("unequip", "卸下"), P.eq[eqSel]);
  return `<p class="note">點一下看說明，點兩下卸下。要穿上新裝備，到背包（I）的裝備欄點兩下。</p>`;
}
function doInv(act) {
  const i = invSel, s = i !== null && P.bag[invTab][i];
  if (!s) return;
  if (act === "equip" && invTab === "equip") equipFrom(i);
  else if (act === "use" && invTab === "use" && ITEMS[s.id].heal) drink(s.id, i);
  else if (act === "use" && invTab === "use" && ITEMS[s.id].warp) readScroll(i);
  else if (act === "use" && invTab === "use" && ITEMS[s.id].feed) feedPet(i);
  else if (act === "use" && invTab === "use" && ITEMS[s.id].book) readBook(i);
  else if (act === "use" && invTab === "etc" && ITEMS[s.id].chair) sitOn(i);
  else if (act === "use" && invTab === "use" && ITEMS[s.id].scroll) {
    if (scrollTargets(ITEMS[s.id].scroll).length) { scrollPick = i; return; }
    hint(ITEMS[s.id].scroll.kind === "restore" ? "沒有強化失敗過的裝備" : "沒有可以用這張卷軸的裝備");
  } else if (act === "cancel") { scrollPick = null; return; }
  else if (act === "drop") discard(invTab, i);
  if (!P.bag[invTab][i] || P.bag[invTab][i] !== s) invSel = null;
}
invBody.addEventListener("click", e => {
  const t = e.target.closest("[data-tab],[data-i],[data-do],[data-target]");
  if (!t) return;
  if (t.dataset.i) { invSel = Number(t.dataset.i); scrollPick = null; pick(invBody, t, invInfo()); return; }
  if (t.dataset.tab) { invTab = t.dataset.tab; invSel = null; scrollPick = null; }
  else if (t.dataset.target) { applyScroll(scrollPick, t.dataset.target); scrollPick = null; if (!P.bag.use[invSel]) invSel = null; }
  else doInv(t.dataset.do);
  refreshPanels(true);
  if (e.detail) cv.focus({ preventScroll: true });
});
invBody.addEventListener("dblclick", e => {
  const t = e.target.closest("[data-i]");
  if (!t) return;
  invSel = Number(t.dataset.i);
  doInv(invTab === "equip" ? "equip" : "use");
  refreshPanels(true);
});
equipBody.addEventListener("click", e => {
  const t = e.target.closest("[data-slot],[data-do]");
  if (!t) return;
  if (t.dataset.slot) { eqSel = t.dataset.slot; pick(equipBody, t, equipInfo()); return; }
  if (eqSel) { unequip(eqSel); if (!P.eq[eqSel]) eqSel = null; }
  refreshPanels(true);
  if (e.detail) cv.focus({ preventScroll: true });
});
equipBody.addEventListener("dblclick", e => {
  const t = e.target.closest("[data-slot]");
  if (!t) return;
  unequip(t.dataset.slot); eqSel = null;
  refreshPanels(true);
});
document.getElementById("openInv").addEventListener("click", () => togglePanel(invWin));
document.getElementById("openEquip").addEventListener("click", () => togglePanel(equipWin));
document.getElementById("openWorld").addEventListener("click", () => togglePanel(worldWin));
document.getElementById("openQuests").addEventListener("click", () => togglePanel(questWin));

// ---------- Key settings ----------
function renderKeys() {
  let html = `<p class="note">按「更改」，再按想用的鍵；按 Esc 取消。方向鍵、Space、Enter、Esc 不能改。</p>`;
  for (const [a, label] of Object.entries(ACTIONS)) {
    const now = binding === a ? `<span class="dim">按下新按鍵……</span>` : [...new Set(binds[a].map(keyName))].map(k => `<kbd>${esc(k)}</kbd>`).join(" ") || "—";
    html += `<div class="row keyrow"><span>${label}</span><span class="keys">${now}</span>`
      + `<button type="button" class="btn" data-rebind="${a}" aria-label="更改${label}的按鍵">${binding === a ? "取消" : "更改"}</button></div>`;
  }
  keysBody.innerHTML = html + `<div class="acts">${actBtn("reset", "恢復預設")}</div>`;
}
// key names shown around the page (the legend, button labels) follow the current settings
function renderKeyLabels() {
  document.querySelectorAll("[data-key]").forEach(el => { el.textContent = keyOf(el.dataset.key); });
}
keysBody.addEventListener("click", e => {
  const t = e.target.closest("[data-rebind],[data-do]");
  if (!t) return;
  if (t.dataset.rebind) binding = binding === t.dataset.rebind ? null : t.dataset.rebind;
  else { binding = null; resetBinds(); renderKeyLabels(); }
  refreshPanels(true);
});
document.getElementById("openKeys").addEventListener("click", () => togglePanel(keysWin));

// ---------- Settings window ----------
let saveText = "";
function renderSettings() {
  const range = (k, label) => `<label class="setrow"><span>${label}</span>`
    + `<input type="range" min="0" max="100" step="5" value="${settings[k]}" data-set="${k}" aria-label="${label}音量"><b>${settings[k]}</b></label>`;
  setBody.innerHTML = `<div class="qhead">聲音</div>` + range("sfx", "音效") + range("music", "音樂")
    + `<div class="qhead">畫面</div>`
    + `<label class="setrow"><span>顯示傷害數字</span><input type="checkbox" data-set="nums" aria-label="顯示傷害數字"${settings.nums ? " checked" : ""}></label>`
    + `<label class="setrow"><span>畫面震動</span><select class="keysel" data-set="shake" aria-label="畫面震動">`
    + [[1, "正常"], [0.5, "小一點"], [0, "關閉"]].map(([v, n]) => `<option value="${v}"${settings.shake === v ? " selected" : ""}>${n}</option>`).join("")
    + `</select></label>`
    + `<label class="setrow"><span>小地圖（${keyOf("minimap")}）</span><select class="keysel" data-set="minimap" aria-label="小地圖">`
    + MINIMAP_SIZES.map((n, v) => `<option value="${v}"${settings.minimap === v ? " selected" : ""}>${n}</option>`).join("")
    + `</select></label>`
    + `<div class="qhead">寵物</div>`
    + `<label class="setrow"><span>寵物也撿道具（關掉就只撿金幣）</span><input type="checkbox" data-set="petItems" aria-label="寵物也撿道具"${settings.petItems ? " checked" : ""}></label>`
    + `<div class="qhead">存檔</div>`
    + [1, 2, 3].map(n => `<div class="setrow"><span>存檔 ${n}${n === saveSlot ? "（使用中）" : ""}<small>${esc(slotSummary(n))}</small></span>`
      + (n === saveSlot ? "" : `<button type="button" class="btn" data-slot-switch="${n}" aria-label="切換到存檔 ${n}">切換</button>`) + `</div>`).join("")
    + `<div class="acts">${actBtn("export", "匯出目前存檔")}${actBtn("import", "匯入到目前存檔")}</div>`
    + `<textarea id="saveText" rows="3" aria-label="存檔文字" placeholder="按「匯出」，存檔文字會出現在這裡；要匯入，就把文字貼進來">${esc(saveText)}</textarea>`
    + `<p class="note">匯入會換掉目前這個存檔欄位的角色。音量和畫面設定所有存檔共用。</p>`;
}
setBody.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "saveText") { saveText = t.value; return; }
  // sliders update as they move, without redrawing the window under the pointer
  if (t.type === "range") { settings[t.dataset.set] = Number(t.value); t.nextElementSibling.textContent = t.value; saveSettings(); }
});
setBody.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.set === "nums") settings.nums = t.checked;
  else if (t.dataset.set === "shake") settings.shake = Number(t.value);
  else if (t.dataset.set === "minimap") settings.minimap = Number(t.value);
  else if (t.dataset.set === "petItems") settings.petItems = t.checked;
  else return;
  saveSettings();
});
setBody.addEventListener("click", e => {
  const t = e.target.closest("[data-slot-switch],[data-do]");
  if (!t) return;
  if (t.dataset.slotSwitch) switchSlot(Number(t.dataset.slotSwitch));
  else if (t.dataset.do === "export") { saveText = exportSave(); renderSettings(); setBody.querySelector("#saveText").select(); return; }
  else if (t.dataset.do === "import" && importSave(saveText)) saveText = "";
  renderSettings();
});
document.getElementById("openSettings").addEventListener("click", () => togglePanel(setWin));

// ---------- Monster book and titles ----------
let collectTab = "book";
function renderCollection() {
  let html = `<div class="tabs" role="tablist" aria-label="圖鑑或稱號">`
    + [["book", "怪物圖鑑"], ["titles", "稱號"]].map(([k, n]) => `<button type="button" role="tab" data-ctab="${k}" aria-selected="${collectTab === k}">${n}</button>`).join("") + `</div>`;
  if (collectTab === "book") {
    const lit = litPages();
    html += `<div class="ap">點亮 <b>${lit} / ${CARD_TYPES.length}</b> 頁．全能力值 <b>+${bookStat()}</b></div>`
      + `<p class="note">每種怪物的卡片集滿 ${CARD_NEED} 張就點亮一頁，每點亮 ${PAGES_PER_STAT} 頁全能力值 +1。卡片會直接收進圖鑑，不佔背包。</p>`
      + `<div class="cards">` + CARD_TYPES.map(t => {
        const n = P.cards[t] || 0, T = TYPES[t];
        return `<div class="card${n >= CARD_NEED ? " lit" : ""}${T.boss ? " boss" : ""}"><b>${n ? esc(T.name) : "？？？"}</b><small>Lv.${T.lv}．${n} / ${CARD_NEED}</small></div>`;
      }).join("") + `</div>`;
  } else {
    html += `<p class="note">一次可以戴一個稱號，會顯示在角色腳下，有些還有小加成。</p>`;
    for (const T of Object.values(TITLES)) {
      const got = P.titles.includes(T.id), on = P.title === T.id;
      const bonus = T.bonus ? Object.entries(T.bonus).map(([k, v]) => `${GEAR_STATS[k]} +${v}`).join("、") : "";
      html += `<div class="skill"><div class="row"><span><b class="sname">${got ? esc(T.name) : "？？？"}</b></span>`
        + (got ? `<button type="button" class="btn${on ? " warn" : ""}" data-title="${T.id}" aria-label="${on ? "拿下" : "戴上"}${esc(T.name)}">${on ? "拿下" : "戴上"}</button>` : `<small>未獲得</small>`)
        + `</div><p>${esc(T.desc)}</p>${bonus ? `<p class="dim">戴上時：${esc(bonus)}</p>` : ""}</div>`;
    }
  }
  collectBody.innerHTML = html;
}
collectBody.addEventListener("click", e => {
  const t = e.target.closest("[data-ctab],[data-title]");
  if (!t) return;
  if (t.dataset.ctab) collectTab = t.dataset.ctab;
  else wearTitle(t.dataset.title);
  refreshPanels(true);
});
document.getElementById("openCollect").addEventListener("click", () => togglePanel(collectWin));
renderKeyLabels();

document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => { b.closest(".win").hidden = true; cv.focus({ preventScroll: true }); }));
document.getElementById("openStats").addEventListener("click", () => togglePanel(statsWin));
document.getElementById("openSkills").addEventListener("click", () => togglePanel(skillsWin));

// ---------- Character creation, the hair salon and the face shop ----------
// One window for all three: creating shows every choice and a name; the salon shows only hair, the
// face shop only eyes, each with a price for what you change.
const createWin = document.getElementById("createWin"), createBody = document.getElementById("createBody");
const SALON_PRICES = { hair: 3000, hairColor: 2000, eyes: 5000 };
const CREATE_ROWS = { create: ["hair", "hairColor", "skin", "eyes"], hair: ["hair", "hairColor"], face: ["eyes"] };
const ROW_NAMES = { hair: "髮型", hairColor: "髮色", skin: "膚色", eyes: "眼睛" };
let createMode = "create", draft = null;
function openCreate(mode) {
  createMode = mode;
  draft = mode === "create" ? { ...(P.look || randomLook()), name: P.look?.name || "" } : { ...P.look };
  createWin.hidden = false; held.clear();
  renderCreate();
  if (mode === "create") document.getElementById("lookName").focus();
}
// after loading a character: ask for a look if it has none, and close the creation screen if it has one
function checkLook() {
  if (!P.look) openCreate("create");
  else if (!createWin.hidden && createMode === "create") createWin.hidden = true;
}
function closeCreate() { createWin.hidden = true; cv.focus({ preventScroll: true }); }
const salonCost = () => CREATE_ROWS[createMode].reduce((n, k) => n + (draft[k] !== P.look[k] ? SALON_PRICES[k] : 0), 0);
function renderCreate() {
  const create = createMode === "create", old = create && P.lv > 1;
  const title = create ? (old ? "幫你的角色決定名字和樣子" : "建立角色") : createMode === "hair" ? "美髮店" : "整形診所";
  const row = k => {
    const list = k === "hair" ? Object.entries(HAIR_STYLES) : (k === "hairColor" ? HAIR_COLORS : k === "skin" ? SKINS : EYE_COLORS).map((c, i) => [i, c]);
    return `<div class="lrow"><span>${ROW_NAMES[k]}${create ? "" : `<small>${SALON_PRICES[k].toLocaleString()} 金幣</small>`}</span><div class="lopts">`
      + list.map(([v, c]) => k === "hair"
        ? `<button type="button" class="btn${draft.hair === v ? " on" : ""}" data-look="hair" data-v="${v}" aria-pressed="${draft.hair === v}">${c}</button>`
        : `<button type="button" class="swatch${draft[k] === v ? " on" : ""}" data-look="${k}" data-v="${v}" aria-pressed="${draft[k] === v}" aria-label="${ROW_NAMES[k]} ${v + 1}" style="background:${Array.isArray(c) ? c[0] : c}"></button>`).join("")
      + `</div></div>`;
  };
  const cost = create ? 0 : salonCost();
  createBody.innerHTML = `<h2>${title}</h2>`
    + (old ? `<p class="note">以前的存檔還沒有名字和外觀。等級、背包和裝備都不會變。</p>` : "")
    + `<div class="crow"><canvas id="lookPreview" width="200" height="230" aria-label="角色預覽"></canvas><div class="copts">`
    + (create ? `<label class="lrow"><span>名字</span><input id="lookName" maxlength="${NAME_MAX}" autocomplete="off" value="${esc(draft.name)}" placeholder="${NAME_MIN}～${NAME_MAX} 個字" aria-label="角色名字"></label>` : "")
    + CREATE_ROWS[createMode].map(row).join("") + `</div></div>`
    + `<p class="err" id="lookErr" role="alert"></p>`
    + `<div class="acts">` + (create
      ? `${actBtn("random", "隨機")}${actBtn("confirm", old ? "確定" : "開始冒險")}`
      : `<span class="money">金幣 <b>${P.coins.toLocaleString()}</b></span>${actBtn("cancel", "取消")}${actBtn("confirm", cost ? `確定（${cost.toLocaleString()} 金幣）` : "確定")}`)
    + `</div>`;
  drawPreview();
}
// the preview borrows the game's own drawing of the player, with the draft look standing still
function drawPreview() {
  const c = document.getElementById("lookPreview");
  if (!c) return;
  const g = c.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = g.createLinearGradient(0, 0, 0, c.height); g.fillStyle.addColorStop(0, "#6fb9ea"); g.fillStyle.addColorStop(1, "#e4f6ee");
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#79d35f"; g.fillRect(0, c.height - 30, c.width, 30);
  const keep = { x: P.x, y: P.y, face: P.face, look: P.look, atkT: P.atkT, prone: P.prone, climb: P.climb, dead: P.dead, inv: P.inv, onGround: P.onGround, vx: P.vx, sit: P.sit };
  const main = ctx;
  ctx = g;
  try {
    g.setTransform(3, 0, 0, 3, c.width / 2, c.height - 30);
    Object.assign(P, { x: -P.w / 2, y: -P.h, face: 1, look: draft, atkT: 0, prone: false, climb: null, dead: false, inv: 0, onGround: true, vx: 0, sit: null });
    drawPlayer();
  } finally { ctx = main; Object.assign(P, keep); }
}
function confirmCreate() {
  const err = document.getElementById("lookErr");
  if (createMode === "create") {
    const name = draft.name.trim();
    if (nameLength(name) < NAME_MIN || nameLength(name) > NAME_MAX) { err.textContent = `名字要 ${NAME_MIN}～${NAME_MAX} 個字`; return; }
    const first = !P.look;
    P.look = cleanLook({ ...draft, name });
    closeCreate();
    msg(first && P.lv === 1 ? `${name}，歡迎來到浮島！往右走到傳送門按 ↑，去青草平原打青果凍` : `${name}，準備好繼續冒險了`, "#ffc94a");
  } else {
    const cost = salonCost();
    if (!cost) { err.textContent = "還沒有改變任何地方"; return; }
    if (P.coins < cost) { err.textContent = `金幣不夠，需要 ${cost.toLocaleString()} 金幣`; return; }
    P.coins -= cost;
    const changed = {};
    for (const k of CREATE_ROWS[createMode]) changed[k] = draft[k];
    P.look = { ...P.look, ...changed };
    sfx("coin");
    closeCreate();
    msg(`換了新造型，花了 ${cost.toLocaleString()} 金幣`, "#ffd97a");
  }
  save(); refreshPanels(true);
}
createBody.addEventListener("click", e => {
  const t = e.target.closest("[data-look],[data-do]");
  if (!t) return;
  if (t.dataset.look) {
    const k = t.dataset.look;
    draft[k] = k === "hair" ? t.dataset.v : Number(t.dataset.v);
  } else if (t.dataset.do === "random") draft = randomLook(draft.name);
  else if (t.dataset.do === "cancel") { closeCreate(); return; }
  else if (t.dataset.do === "confirm") { confirmCreate(); return; }
  renderCreate();
});
createBody.addEventListener("input", e => { if (e.target.id === "lookName") { draft.name = e.target.value; document.getElementById("lookErr").textContent = ""; } });
createBody.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "lookName") { e.preventDefault(); confirmCreate(); }
  else if (e.key === "Escape" && createMode !== "create") { e.preventDefault(); closeCreate(); }
});
