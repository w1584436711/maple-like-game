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
function togglePanel(w) { w.hidden = !w.hidden; if (!w.hidden) refreshPanels(true); }
let panelSig = "";
function refreshPanels(force) {
  const sig = JSON.stringify([P.lv, P.exp, P.job, P.str, P.dex, P.int, P.luk, P.ap, P.sp, P.mhp, P.mmp, P.skills, P.coins, bagVer, P.map, P.quests, shopMode, shopTab, sellArm]);
  if (!force && sig === panelSig) return;
  panelSig = sig;
  if (!statsWin.hidden) renderStats();
  if (!skillsWin.hidden) renderSkills();
  if (!invWin.hidden) renderInv();
  if (!equipWin.hidden) renderEquip();
  if (!worldWin.hidden) renderWorld();
  if (!shopWin.hidden) renderShop();
  if (!questWin.hidden) renderQuests();
}
function renderShop() {
  document.getElementById("shopTitle").textContent = shopNpc.name;
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
      html += `<div class="srow"><img src="${itemIcon(s.id).url}" alt=""><div class="what"><b>${esc(I.name)}${s.n > 1 ? ` ×${s.n}` : ""}</b><small>每個 ${one.toLocaleString()} 金幣</small></div>`
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
shopBody.addEventListener("click", e => {
  const t = e.target.closest("[data-mode],[data-stab],[data-buy],[data-sell]");
  if (!t) return;
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
    q => `<div class="quest"><b>${esc(q.name)}</b><p>去${esc(MAPS[NPCS[q.npc].map].name)}找${esc(NPCS[q.npc].name)}</p></div>`);
  html += block("已完成", all.filter(q => questState(q) === "done"), q => `<div class="quest"><p>✔ ${esc(q.name)}</p></div>`);
  questBody.innerHTML = html || `<p class="note">現在沒有任務。等級提升後再去村裡找人聊聊吧。</p>`;
}
function renderWorld() {
  worldBody.innerHTML = MAP_ORDER.map((id, i) => {
    const m = MAPS[id], here = m === map;
    const who = m.town ? "城鎮．轉職教官薇拉在這裡" : mapMobs(id).join("、");
    return (i ? `<div class="link" aria-hidden="true"></div>` : "")
      + `<div class="place${here ? " here" : ""}"><b>${esc(m.name)}</b>${here ? `<span class="tag">你在這裡</span>` : ""}<p>${esc(who)}</p></div>`;
  }).join("") + `<p class="note">走到傳送門按 ↑ 換地圖。讀回村卷軸可以立刻回到浮島村。</p>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const row = (label, value) => `<div class="row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
const PRIMARY = { beginner: "str", warrior: "str", magician: "int", bowman: "dex", thief: "luk" };
function renderStats() {
  const [mn, mx] = physRange();
  let html = row("職業", job().name) + row("等級", P.lv) + row("經驗值", `${P.exp} / ${need()}`)
    + row("HP", maxHp()) + row("MP", maxMp()) + row("攻擊", `${Math.floor(mn)} ~ ${Math.floor(mx)}`);
  if (P.job === "magician") html += row("魔力", magic());
  html += row("防禦", gear("def")) + row("命中", Math.floor(accuracy())) + row("迴避", Math.floor(avoidability()));
  html += `<div class="ap">可分配能力值 <b>${P.ap}</b></div>`;
  for (const k of ["str", "dex", "int", "luk"]) {
    // like the original, bonuses from gear show next to the base value: 力量 35 (+2)
    const bonus = gear(k);
    html += `<div class="row stat${PRIMARY[P.job] === k ? " main" : ""}"><span>${STAT_NAMES[k]}${bonus ? ` <small>(+${bonus})</small>` : ""}</span><b>${P[k]}</b>`
      + `<button type="button" class="plus" data-stat="${k}" aria-label="${STAT_NAMES[k]}加 1"${P.ap > 0 ? "" : " disabled"}>+</button></div>`;
  }
  statsBody.innerHTML = html;
}
const TYPE_NAMES = { atk: "攻擊", buff: "輔助", passive: "被動" };
const canLearn = s => P.sp > 0 && skLv(s.id) < s.max && (!s.req || skLv(s.req[0]) >= s.req[1]);
function renderSkills() {
  if (P.job === "beginner") {
    skillsBody.innerHTML = `<p class="note">新手還不能學技能。Lv.10（法師 Lv.8）回浮島村找轉職教官薇拉轉職，就能用 SP 學技能。</p>`;
    return;
  }
  const slots = slotSkills();
  let html = `<div class="ap">${esc(job().name)}技能　剩餘 SP <b>${P.sp}</b></div>`;
  for (const s of jobSkills()) {
    const l = skLv(s.id), slot = slots.indexOf(s);
    const lock = s.req && skLv(s.req[0]) < s.req[1] ? `需要「${SKILL_BY_ID[s.req[0]].name}」Lv.${s.req[1]}` : "";
    const now = l ? s.desc(l) : "還沒學會";
    const next = l < s.max ? `下一級：${s.desc(l + 1)}` : "已經滿級";
    const cost = s.mp ? `MP ${s.mp(Math.max(1, l))}` : "";
    html += `<div class="skill"><div class="row"><span><b class="sname">${esc(s.name)}</b> <small>${TYPE_NAMES[s.type]}${slot >= 0 ? `．${SLOT_KEYS[slot]} 鍵` : ""}</small></span>`
      + `<b>${l} / ${s.max}</b><button type="button" class="plus" data-skill="${s.id}" aria-label="${esc(s.name)}加 1"${canLearn(s) ? "" : " disabled"}>+</button></div>`
      + `<p>${esc(now)}${cost ? `．${cost}` : ""}</p><p class="dim">${esc(lock || next)}</p></div>`;
  }
  skillsBody.innerHTML = html;
}
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
  if (I.jobs) out.push({ text: I.jobs.map(j => JOBS[j].name).join("、") + "可用", ok: I.jobs.includes(P.job) });
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
// i picks the bag slot; without it the first stack is used, as with keys 1 and 2
function drink(id, i = P.bag.use.findIndex(s => s?.id === id)) {
  const I = ITEMS[id];
  if (P.dead || P.potCd > 0) return;
  if (i < 0) { hint(`沒有${I.name}了`); return; }
  const hp = Math.min(I.heal.hp || 0, maxHp() - P.hp), mp = Math.min(I.heal.mp || 0, maxMp() - P.mp);
  if (hp <= 0 && mp <= 0) return;
  takeFromSlot("use", i);
  P.hp += hp; P.mp += mp; P.potCd = 0.3;
  if (hp > 0) nums.push({ x: P.x + P.w / 2, y: P.y - 6, text: "+" + hp, kind: "heal", t: 0 });
  if (mp > 0) nums.push({ x: P.x + P.w / 2, y: P.y - 6, text: "+" + mp, kind: "mana", t: 0 });
}
function readScroll(i) {
  if (P.dead) return;
  if (map.town) { hint("你已經在浮島村了"); return; }
  takeFromSlot("use", i);
  goToTown();
  msg("讀了回村卷軸，回到浮島村", "#cfe3ff");
  save();
}
function discard(tab, i) {
  const s = P.bag[tab][i];
  if (!s || P.dead) return;
  P.bag[tab][i] = null; bagVer++;
  addDrop("item", P.x + P.w / 2 + P.face * 20, P.y + P.h - 20, s.n, s.id);
  msg(`丟掉了${ITEMS[s.id].name}${s.n > 1 ? ` ×${s.n}` : ""}`, "#9fb0cd");
}

function itemInfo(I, n, acts) {
  let h = `<div class="info"><h3>${esc(I.name)}${n > 1 ? ` ×${n}` : ""}</h3>`;
  if (I.slot) {
    const wt = I.wtype && WTYPES[I.wtype];
    h += `<p class="dim">${EQUIP_SLOTS[I.slot]}${wt ? `．${wt.name}${wt.twoHand ? "（雙手）" : ""}` : ""}</p>`;
    const bon = Object.keys(GEAR_STATS).filter(k => I[k]).map(k => `${GEAR_STATS[k]} +${I[k]}`);
    if (bon.length) h += `<p>${bon.join("　")}</p>`;
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
    + `<img src="${itemIcon(s.id).url}" alt="">${I.stack > 1 ? `<span class="n">${s.n}</span>` : ""}</button>`;
}
function renderInv() {
  const tab = P.bag[invTab];
  let html = `<div class="tabs" role="tablist" aria-label="背包分頁">`
    + Object.entries(TABS).map(([k, name]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === invTab}">${name}</button>`).join("")
    + `</div><div class="grid">`;
  tab.forEach((s, i) => {
    if (!s) { html += `<span class="slot" aria-hidden="true"></span>`; return; }
    const I = ITEMS[s.id];
    html += slotBtn(s, `data-i="${i}"`, i === invSel, I.slot && !canWear(I), `${I.name}${s.n > 1 ? ` ×${s.n}` : ""}`);
  });
  html += `</div><div data-info>${invInfo()}</div>`;
  html += `<div class="money">金幣 <b>${P.coins.toLocaleString()}</b>　空格 ${tab.filter(x => !x).length} / ${BAG_SLOTS}</div>`;
  invBody.innerHTML = html;
}
function invInfo() {
  const s = invSel !== null && P.bag[invTab][invSel];
  if (!s) return `<p class="note">${invTab === "equip" ? "點一下看說明，點兩下直接穿上。" : invTab === "use" ? "點兩下喝藥水或讀回村卷軸。箭矢、飛鏢放在這裡，攻擊時自動用掉。" : "打怪撿到的材料。"}</p>`;
  const I = ITEMS[s.id];
  return itemInfo(I, s.n, (I.slot ? actBtn("equip", "裝備") : I.heal || I.warp ? actBtn("use", "使用") : "") + actBtn("drop", "丟掉"));
}
// picking a slot only moves the outline and swaps the description, so the slot under the
// pointer stays the same element and a double click on it still registers
function pick(body, btn, infoHtml) {
  body.querySelectorAll(".slot.sel").forEach(b => b.classList.remove("sel"));
  btn.classList.add("sel");
  body.querySelector("[data-info]").innerHTML = infoHtml;
}
// laid out like a paper doll: head, body and legs top to bottom
const EQ_ORDER = ["hat", "cape", "top", "gloves", "weapon", "bottom", "shield", "shoes"];
function renderEquip() {
  let html = `<div class="eqgrid">`;
  for (const k of EQ_ORDER) {
    const s = P.eq[k];
    html += `<div class="cell">${s ? slotBtn(s, `data-slot="${k}"`, eqSel === k, false, `${EQUIP_SLOTS[k]}：${ITEMS[s.id].name}`) : `<span class="slot" aria-hidden="true"></span>`}${EQUIP_SLOTS[k]}</div>`;
  }
  html += `</div>`;
  const bon = Object.keys(GEAR_STATS).filter(k => gear(k)).map(k => `${GEAR_STATS[k]} +${gear(k)}`);
  html += `<p class="note">裝備加成：${bon.join("、") || "沒有"}</p><div data-info>${equipInfo()}</div>`;
  equipBody.innerHTML = html;
}
function equipInfo() {
  if (eqSel && P.eq[eqSel]) return itemInfo(ITEMS[P.eq[eqSel].id], 1, actBtn("unequip", "卸下"));
  return `<p class="note">點一下看說明，點兩下卸下。要穿上新裝備，到背包（I）的裝備欄點兩下。</p>`;
}
function doInv(act) {
  const i = invSel, s = i !== null && P.bag[invTab][i];
  if (!s) return;
  if (act === "equip" && invTab === "equip") equipFrom(i);
  else if (act === "use" && invTab === "use" && ITEMS[s.id].heal) drink(s.id, i);
  else if (act === "use" && invTab === "use" && ITEMS[s.id].warp) readScroll(i);
  else if (act === "drop") discard(invTab, i);
  if (!P.bag[invTab][i] || P.bag[invTab][i] !== s) invSel = null;
}
invBody.addEventListener("click", e => {
  const t = e.target.closest("[data-tab],[data-i],[data-do]");
  if (!t) return;
  if (t.dataset.i) { invSel = Number(t.dataset.i); pick(invBody, t, invInfo()); return; }
  if (t.dataset.tab) { invTab = t.dataset.tab; invSel = null; }
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

document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => { b.closest(".win").hidden = true; cv.focus({ preventScroll: true }); }));
document.getElementById("openStats").addEventListener("click", () => togglePanel(statsWin));
document.getElementById("openSkills").addEventListener("click", () => togglePanel(skillsWin));
