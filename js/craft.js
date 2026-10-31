// Crafting: the three craftsmen's recipes, crafting proficiency, recipe books from bosses and the crafting window.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Recipes ----------
// at: which craftsman (NPCS[...].craft); item and n: what you get; mats: monster materials used;
// coins: the craftsman's fee; lv: the proficiency needed (also the proficiency EXP one try gives);
// rate: the chance it works (materials and fee are used up either way); book: the boss whose recipe book teaches it
const RECIPES = {
  red_pot:      { at: "village", item: "red_pot", n: 10, mats: { green_gel: 5 }, coins: 60, lv: 1 },
  blue_pot:     { at: "village", item: "blue_pot", n: 10, mats: { blue_gel: 5 }, coins: 120, lv: 1 },
  town_scroll:  { at: "village", item: "town_scroll", n: 2, mats: { shell_shard: 4 }, coins: 100, lv: 2 },
  scroll_arm60: { at: "village", item: "scroll_arm60", n: 1, mats: { shell_shard: 10, fog_spore: 8 }, coins: 1000, lv: 3 },
  moss_cape:    { at: "village", item: "moss_cape", n: 1, mats: { moss_core: 1, shell_shard: 20 }, coins: 5000, lv: 3 },
  scroll_wpn60: { at: "village", item: "scroll_wpn60", n: 1, mats: { lizard_scale: 10, fog_spore: 8 }, coins: 1500, lv: 4 },
  gel_ring:     { at: "village", item: "gel_ring", n: 1, mats: { green_gel: 30, blue_gel: 30, lizard_scale: 5 }, coins: 3000, lv: 4, rate: 0.8 },
  crab_shield:  { at: "village", item: "crab_shield", n: 1, mats: { crab_claw: 1, lizard_scale: 15 }, coins: 8000, lv: 5 },
  grove_ring:   { at: "village", item: "grove_ring", n: 1, mats: { ancient_ring: 1, fog_spore: 30, lizard_scale: 20 }, coins: 10000, lv: 5, rate: 0.7, book: "treant" },

  white_pot:    { at: "cloud", item: "white_pot", n: 10, mats: { cloud_wool: 5 }, coins: 500, lv: 2 },
  mana_pot:     { at: "cloud", item: "mana_pot", n: 10, mats: { bell_shard: 5 }, coins: 1000, lv: 3 },
  scroll_glove60: { at: "cloud", item: "scroll_glove60", n: 1, mats: { cloud_wool: 10, bell_shard: 10 }, coins: 1500, lv: 4 },
  cloud_earring: { at: "cloud", item: "cloud_earring", n: 1, mats: { cloud_wool: 20, bell_shard: 15 }, coins: 6000, lv: 5, rate: 0.8 },
  thunder_necklace: { at: "cloud", item: "thunder_necklace", n: 1, mats: { thunder_horn: 20, bell_shard: 10 }, coins: 8000, lv: 5, rate: 0.8 },
  guard_scroll: { at: "cloud", item: "guard_scroll", n: 1, mats: { thunder_horn: 15, bell_shard: 15 }, coins: 3000, lv: 6 },
  storm_cape:   { at: "cloud", item: "storm_cape", n: 1, mats: { eagle_feather: 1, thunder_horn: 20 }, coins: 20000, lv: 6 },
  eagle_ring:   { at: "cloud", item: "eagle_ring", n: 1, mats: { eagle_feather: 2, thunder_horn: 30 }, coins: 30000, lv: 7, rate: 0.7, book: "eagle" },

  scroll_cape60: { at: "sand", item: "scroll_cape60", n: 1, mats: { fox_tail: 10, worm_skin: 10 }, coins: 2000, lv: 5 },
  scroll_shoes60: { at: "sand", item: "scroll_shoes60", n: 1, mats: { fox_tail: 10, cactus_needle: 10 }, coins: 2000, lv: 5 },
  restore_scroll: { at: "sand", item: "restore_scroll", n: 1, mats: { wisp_ash: 15, clay_shard: 10 }, coins: 3000, lv: 6 },
  scroll_wpn10: { at: "sand", item: "scroll_wpn10", n: 1, mats: { cactus_needle: 15, scarab_shell: 15 }, coins: 5000, lv: 7 },
  tomb_cape:    { at: "sand", item: "tomb_cape", n: 1, mats: { wisp_ash: 30, clay_shard: 30, scarab_shell: 30 }, coins: 50000, lv: 7, rate: 0.8 },
  scarab_earring: { at: "sand", item: "scarab_earring", n: 1, mats: { scarab_shell: 30, wisp_ash: 20 }, coins: 50000, lv: 8, rate: 0.6 },
  scroll_acc10: { at: "sand", item: "scroll_acc10", n: 1, mats: { scorp_stinger: 1, scarab_shell: 20, clay_shard: 20 }, coins: 20000, lv: 9, rate: 0.5, book: "scorpking" },
};
// proficiency EXP needed to go from each level to the next (index = current level)
const CRAFT_NEED = [0, 5, 12, 20, 30, 45, 60, 80, 100, 130];
const CRAFT_MAX = CRAFT_NEED.length;
const crafterOf = at => Object.values(NPCS).find(n => n.craft === at);

// a recipe book for every recipe that needs one, dropped by its boss
for (const [k, r] of Object.entries(RECIPES)) {
  if (!r.book) continue;
  const id = `recipe_${k}`, name = ITEMS[r.item].name;
  ITEMS[id] = { id, name: `${name}配方書`, cat: "use", recipe: k, icon: "book", color: "#e8c890", price: 0, sell: 2000, stack: 10,
                desc: `讀了之後，${crafterOf(r.at).name}就能幫你做${name}` };
  TYPES[r.book].drops.push([id, 0.3]);
}

// what stops you from making a recipe right now, or "" when nothing does
function craftBlock(k) {
  const r = RECIPES[k];
  if (r.book && !P.recipes.includes(k)) return `要先讀配方書（${TYPES[r.book].name}掉落）`;
  if (P.craft.lv < r.lv) return `製作熟練度 Lv.${r.lv} 才能做`;
  if (Object.entries(r.mats).some(([id, n]) => countItem(id) < n)) return "材料不夠";
  if (P.coins < r.coins) return "金幣不夠";
  if (ITEMS[r.item].slot ? !P.bag.equip.includes(null) : roomFor(r.item) < r.n) return `背包的${TABS[ITEMS[r.item].cat]}欄放不下了`;
  return "";
}
function craft(k) {
  const r = RECIPES[k], I = ITEMS[r.item], why = craftBlock(k);
  if (why) { hint(why); return; }
  for (const [id, n] of Object.entries(r.mats)) removeItem(id, n);
  P.coins -= r.coins;
  if (Math.random() < (r.rate ?? 1)) {
    if (I.slot) putGear(rollGear(r.item)); else addItem(r.item, r.n);
    sfx("quest");
    msg(`做好了${I.name}${r.n > 1 ? ` ×${r.n}` : ""}！`, "#ffd97a");
  } else {
    sfx("fail");
    msg(`${I.name}做失敗了……材料和金幣都用掉了`, "#ff9b8f");
  }
  craftExp(r.lv);
  bagVer++;
  save();
}
// every try counts, whether it worked or not
function craftExp(n) {
  const c = P.craft;
  if (c.lv >= CRAFT_MAX) return;
  c.exp += n;
  while (c.lv < CRAFT_MAX && c.exp >= CRAFT_NEED[c.lv]) {
    c.exp -= CRAFT_NEED[c.lv]; c.lv++;
    sfx("levelup");
    msg(`製作熟練度升到 Lv.${c.lv} 了！`, "#ffc94a");
  }
  if (c.lv >= CRAFT_MAX) c.exp = 0;
}
// reading a recipe book teaches its recipe for good
function readRecipe(i) {
  const I = ITEMS[P.bag.use[i].id];
  if (P.recipes.includes(I.recipe)) { hint(`已經讀過${I.name}了`); return; }
  takeFromSlot("use", i);
  P.recipes.push(I.recipe);
  sfx("levelup");
  msg(`讀懂了${I.name}！去找${crafterOf(RECIPES[I.recipe].at).name}製作`, "#ffc94a");
  save();
}

// ---------- Crafting window ----------
// shares the shop window: every recipe this craftsman knows, with what you have of each material
function renderCraft() {
  const c = P.craft;
  let html = `<div class="money">製作熟練度 <b>Lv.${c.lv}</b>${c.lv < CRAFT_MAX ? `　經驗 ${c.exp} / ${CRAFT_NEED[c.lv]}` : "（最高）"}</div>`;
  for (const [k, r] of Object.entries(RECIPES).filter(([, r]) => r.at === shopNpc.craft)) {
    const I = ITEMS[r.item], why = craftBlock(k), locked = why && (why.startsWith("要先") || why.startsWith("製作熟練度"));
    const mats = Object.entries(r.mats).map(([id, n]) => {
      const have = countItem(id);
      return `<span class="${have < n ? "bad" : ""}">${esc(ITEMS[id].name)} ${have}/${n}</span>`;
    }).join("、");
    const notes = [`${r.coins.toLocaleString()} 金幣`, `熟練度 Lv.${r.lv}`, r.rate ? `成功率 ${Math.round(r.rate * 100)}%` : ""].filter(Boolean).join("．");
    html += `<div class="srow${locked ? " locked" : ""}"><img src="${itemIcon(r.item).url}" alt=""><div class="what"><b>${esc(I.name)}${r.n > 1 ? ` ×${r.n}` : ""}</b>`
      + `<small>${mats}</small><small>${notes}${locked ? `　<span class="bad">${esc(why)}</span>` : ""}</small></div>`
      + `<button type="button" class="btn" data-craft="${k}"${why ? " disabled" : ""} aria-label="製作${esc(I.name)}">製作</button></div>`;
  }
  html += `<div class="money">金幣 <b>${P.coins.toLocaleString()}</b></div>`;
  shopBody.innerHTML = html;
}
