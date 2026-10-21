// Jobs, skills, damage formulas, items, prices and the bag helpers they need.
// Loaded as a plain script, in the order index.html lists them; top-level names are shared between files.
"use strict";

// ---------- Character rules ----------
// Classic rules: 5 AP per level, 3 SP per level after the first job, damage from the job's main and
// secondary stats times weapon attack with a low 10% base mastery, and accuracy against monster avoid.
// Names, numbers of individual skills and weapons are our own.
const STAT_NAMES = { str: "力量", dex: "敏捷", int: "智力", luk: "幸運" };
const JOBS = {
  beginner: { name: "新手", weapon: "wood_sword", hp: [12, 16], mp: [10, 12] },
  warrior:  { name: "劍士", weapon: "iron_blade", hp: [24, 28], mp: [4, 6], req: { lv: 10, stat: "str", min: 35 }, gain: { hp: 150, mp: 0 },
              blurb: "拿劍近身作戰，血量最厚。主屬性力量，副屬性敏捷。" },
  magician: { name: "法師", weapon: "oak_wand", hp: [10, 14], mp: [22, 24], req: { lv: 8, stat: "int", min: 20 }, gain: { hp: 0, mp: 120 },
              blurb: "從遠處施放魔法，MP 很多但身體脆弱。主屬性智力，副屬性幸運。" },
  bowman:   { name: "弓手", weapon: "hunter_bow", ammo: ["arrow", 1000], hp: [20, 24], mp: [14, 16], req: { lv: 10, stat: "dex", min: 25 }, gain: { hp: 60, mp: 40 },
              blurb: "拉弓射箭，攻擊距離最長。主屬性敏捷，副屬性力量。" },
  thief:    { name: "盜賊", weapon: "iron_claw", ammo: ["iron_star", 500], hp: [20, 24], mp: [14, 16], req: { lv: 10, stat: "dex", min: 25 }, gain: { hp: 60, mp: 40 },
              blurb: "丟飛鏢、身手靈活，擅長閃躲。主屬性幸運，副屬性敏捷和力量。" },
  // second jobs at Lv.30: base is the first job they grow from; weapons and ammo stay the same
  berserker:    { name: "狂刃騎士", base: "warrior", hp: [28, 32], mp: [6, 8], req: { lv: 30 }, gain: { hp: 300, mp: 0 },
                  blurb: "把劍術練到極致，一刀能劈開岩石，也能震動大地。" },
  elementalist: { name: "元素術士", base: "magician", hp: [12, 16], mp: [26, 30], req: { lv: 30 }, gain: { hp: 0, mp: 300 },
                  blurb: "操縱火焰、冰霜和雷電，一次對付一大群怪物。" },
  hawkeye:      { name: "獵鷹射手", base: "bowman", hp: [22, 26], mp: [16, 18], req: { lv: 30 }, gain: { hp: 150, mp: 100 },
                  blurb: "箭快得像獵鷹，連射三箭，還能一箭射穿好幾隻怪物。" },
  assassin:     { name: "影刃刺客", base: "thief", hp: [22, 26], mp: [16, 18], req: { lv: 30 }, gain: { hp: 150, mp: 100 },
                  blurb: "像影子一樣快，飛鏢連發，還能貫穿整排敵人。" },
  // third jobs at Lv.50, after the shadow trial; prev is the second job they grow from
  swordsaint:   { name: "破陣劍豪", base: "warrior", prev: "berserker", hp: [32, 36], mp: [8, 10], req: { lv: 50 }, gain: { hp: 600, mp: 0 },
                  blurb: "劍氣能劈開戰陣，一個人就能擋住一整群怪物。" },
  starsage:     { name: "星辰賢者", base: "magician", prev: "elementalist", hp: [14, 18], mp: [30, 34], req: { lv: 50 }, gain: { hp: 0, mp: 600 },
                  blurb: "從星空召來流星，讓閃電在敵人之間跳躍。" },
  ranger:       { name: "神射遊俠", base: "bowman", prev: "hawkeye", hp: [24, 28], mp: [18, 20], req: { lv: 50 }, gain: { hp: 300, mp: 200 },
                  blurb: "一箭射穿整排敵人，也能讓箭像雨一樣落下。" },
  nightlord:    { name: "夜影宗師", base: "thief", prev: "assassin", hp: [24, 28], mp: [18, 20], req: { lv: 50 }, gain: { hp: 300, mp: 200 },
                  blurb: "飛鏢如影隨形，貼身一擊就能直取要害。" },
  // fourth jobs at Lv.70 (the original waits until Lv.120; our level curve is shorter), after the king's trial
  swordking:    { name: "裂空劍帝", base: "warrior", prev: "swordsaint", hp: [36, 40], mp: [10, 12], req: { lv: 70 }, gain: { hp: 1000, mp: 0 },
                  blurb: "一劍就能劈開天空。劍帝的審判落下時，整片戰場都會安靜下來。" },
  astromancer:  { name: "星海魔導", base: "magician", prev: "starsage", hp: [16, 20], mp: [34, 38], req: { lv: 70 }, gain: { hp: 0, mp: 1000 },
                  blurb: "把整片星海握在手裡，一念之間就能讓星辰爆裂。" },
  skyarcher:    { name: "蒼穹箭神", base: "bowman", prev: "ranger", hp: [26, 30], mp: [20, 22], req: { lv: 70 }, gain: { hp: 500, mp: 300 },
                  blurb: "箭從天穹落下，沒有一隻怪物躲得過箭神的眼睛。" },
  shadowlord:   { name: "冥夜影帝", base: "thief", prev: "nightlord", hp: [26, 30], mp: [20, 22], req: { lv: 70 }, gain: { hp: 500, mp: 300 },
                  blurb: "黑夜就是他的領土。影帝出手時，連太陽都會被遮住。" },
};
for (const J of Object.values(JOBS)) if (J.base) { J.weapon = JOBS[J.base].weapon; J.ammo = JOBS[J.base].ammo; }
// the first job a job grows from (itself for a first job or a beginner), and the second job each one leads to
const root = id => JOBS[id].base || id;
const SECOND = { warrior: "berserker", magician: "elementalist", bowman: "hawkeye", thief: "assassin" };
const THIRD = { berserker: "swordsaint", elementalist: "starsage", hawkeye: "ranger", assassin: "nightlord" };
const FOURTH = { swordsaint: "swordking", starsage: "astromancer", ranger: "skyarcher", nightlord: "shadowlord" };

// ---------- Items ----------
// Classic rules: three bag tabs with a fixed number of slots, eight equipment slots with level, job and
// stat requirements, monster drop tables, and arrows and throwing stars that get used up. Names are our own.
const BAG_SLOTS = 24;
const TABS = { equip: "裝備", use: "消耗", etc: "其他" };
const EQUIP_SLOTS = { hat: "帽子", top: "上衣", bottom: "褲子", shoes: "鞋子", gloves: "手套", cape: "披風", weapon: "武器", shield: "盾牌",
                      earring: "耳環", necklace: "項鍊", ring: "戒指" };
const ACCESSORY_SLOTS = ["earring", "necklace", "ring"];
const WTYPES = { sword: { name: "劍", jobs: ["beginner", "warrior"] }, wand: { name: "短杖", jobs: ["magician"] },
                 bow: { name: "弓", jobs: ["bowman"], twoHand: true }, claw: { name: "拳爪", jobs: ["thief"], twoHand: true } };
const GEAR_STATS = { watk: "攻擊", matk: "魔力", def: "防禦", str: "力量", dex: "敏捷", int: "智力", luk: "幸運", hp: "HP", mp: "MP", acc: "命中", avoid: "迴避" };
const ITEMS = {
  wood_sword:    { name: "木劍", slot: "weapon", wtype: "sword", watk: 17, color: "#d8b07a" },
  iron_blade:    { name: "精鐵長劍", slot: "weapon", wtype: "sword", watk: 27, req: { lv: 10, str: 35 } },
  jade_blade:    { name: "碧鱗大劍", slot: "weapon", wtype: "sword", watk: 38, color: "#8fe3bf", req: { lv: 15, str: 45 } },
  oak_wand:      { name: "橡木短杖", slot: "weapon", wtype: "wand", watk: 12, matk: 25, color: "#c9a2ff", req: { lv: 8, int: 20 } },
  vine_staff:    { name: "晶藤法杖", slot: "weapon", wtype: "wand", watk: 14, matk: 38, color: "#6fe3d8", req: { lv: 15, int: 45 } },
  hunter_bow:    { name: "獵人短弓", slot: "weapon", wtype: "bow", watk: 25, req: { lv: 10, dex: 25 } },
  hawk_bow:      { name: "鷹羽長弓", slot: "weapon", wtype: "bow", watk: 34, color: "#4a4f6a", req: { lv: 15, dex: 45 } },
  iron_claw:     { name: "鐵指爪", slot: "weapon", wtype: "claw", watk: 12, req: { lv: 10, dex: 25 } },
  dark_claw:     { name: "黑鋼拳爪", slot: "weapon", wtype: "claw", watk: 16, color: "#7d86a8", req: { lv: 15, luk: 45 } },
  plain_tee:     { name: "粗布上衣", slot: "top", def: 3, color: "#e0574a" },
  jelly_tunic:   { name: "果凍紋上衣", slot: "top", def: 6, hp: 10, color: "#3fa7b8", req: { lv: 5 } },
  plain_shorts:  { name: "粗布短褲", slot: "bottom", def: 2, color: "#2c3e66" },
  canvas_pants:  { name: "帆布長褲", slot: "bottom", def: 5, color: "#5c6b3a", req: { lv: 5 } },
  straw_shoes:   { name: "草編鞋", slot: "shoes", def: 2, color: "#5b3a24" },
  wind_boots:    { name: "疾風短靴", slot: "shoes", def: 4, dex: 2, avoid: 2, color: "#2f6fd6", req: { lv: 10 } },
  leaf_band:     { name: "綠葉頭巾", slot: "hat", def: 4, color: "#4fa55a" },
  leather_cap:   { name: "皮革便帽", slot: "hat", def: 8, hp: 15, color: "#8a5a32", req: { lv: 10 } },
  work_gloves:   { name: "工作手套", slot: "gloves", def: 2, color: "#c9a26b" },
  hunter_gloves: { name: "獵人手套", slot: "gloves", def: 3, watk: 1, acc: 3, color: "#6b4a2a", req: { lv: 10 } },
  travel_cape:   { name: "旅人披風", slot: "cape", def: 4, mp: 15, color: "#6a4bc4", req: { lv: 8 } },
  moss_cape:     { name: "苔岩斗篷", slot: "cape", def: 8, str: 2, dex: 2, int: 2, luk: 2, color: "#5f7d4a", req: { lv: 15 } },
  wood_shield:   { name: "圓木盾", slot: "shield", def: 10, hp: 20, color: "#9a6a3a", req: { lv: 10 }, jobs: ["beginner", "warrior", "magician"] },
  shell_shield:  { name: "刺殼盾", slot: "shield", def: 16, str: 2, color: "#7c8a5c", req: { lv: 15 }, jobs: ["warrior", "magician"] },
  red_pot:       { name: "紅藥水", cat: "use", heal: { hp: 80 }, color: "#e0453b", desc: "回復 80 HP" },
  blue_pot:      { name: "藍藥水", cat: "use", heal: { mp: 50 }, color: "#3a7be0", desc: "回復 50 MP" },
  arrow:         { name: "木箭矢", cat: "use", ammo: "bow", stack: 1000, desc: "弓用的箭，射一次用掉一支" },
  iron_star:     { name: "鐵製飛鏢", cat: "use", ammo: "claw", watk: 15, stack: 500, color: "#c8d2de", desc: "拳爪丟的飛鏢，丟一次用掉一支" },
  steel_star:    { name: "銳角飛鏢", cat: "use", ammo: "claw", watk: 19, stack: 500, color: "#9fd0ff", desc: "更鋒利的飛鏢，丟一次用掉一支" },
  town_scroll:   { name: "回村卷軸", cat: "use", warp: true, color: "#e8d6a8", desc: "讀了就會立刻回到這片大陸的城鎮（浮島村或雲頂城）" },
  pet_food:      { name: "寵物飼料", cat: "use", feed: true, icon: "food", color: "#c98a4a", desc: "在背包點兩下，餵給正在外面的寵物，飽足度加 30" },
  white_pot:     { name: "白藥水", cat: "use", heal: { hp: 300 }, color: "#f4f4f4", desc: "回復 300 HP" },
  mana_pot:      { name: "魔力藥水", cat: "use", heal: { mp: 200 }, color: "#7a5ae0", desc: "回復 200 MP" },
  // enhancement scrolls: on success they add bonus to one piece of gear; either way it uses up one upgrade slot
  scroll_wpn60:  { name: "武器攻擊卷軸 60%", cat: "use", scroll: { slots: ["weapon"], rate: 0.6, add: { watk: 2, matk: 2 } }, color: "#f2c8a8", seal: "#3a7be0",
                   desc: "60% 機率讓武器攻擊和魔力各加 2" },
  scroll_wpn10:  { name: "武器攻擊卷軸 10%", cat: "use", scroll: { slots: ["weapon"], rate: 0.1, add: { watk: 5, matk: 5, str: 1, int: 1 } }, color: "#f2c8a8", seal: "#d23b3b",
                   desc: "10% 機率讓武器攻擊和魔力各加 5，力量和智力各加 1" },
  scroll_arm60:  { name: "防具防禦卷軸 60%", cat: "use", scroll: { slots: ["hat", "top", "bottom", "shoes", "cape", "shield"], rate: 0.6, add: { def: 2, hp: 5 } },
                   color: "#c8d8f0", seal: "#3a7be0", desc: "60% 機率讓帽子、衣服、褲子、鞋子、披風或盾牌的防禦加 2、HP 加 5" },
  scroll_arm10:  { name: "防具防禦卷軸 10%", cat: "use", scroll: { slots: ["hat", "top", "bottom", "shoes", "cape", "shield"], rate: 0.1, add: { def: 5, hp: 20 } },
                   color: "#c8d8f0", seal: "#d23b3b", desc: "10% 機率讓防具的防禦加 5、HP 加 20" },
  guard_scroll:  { name: "防爆卷軸", cat: "use", scroll: { kind: "guard" }, color: "#f4f4f4", seal: "#ffc94a",
                   desc: "貼在一件裝備上：下一次強化失敗時，不會用掉可升級次數。不管成不成功，貼上的防爆卷軸都會用掉" },
  restore_scroll: { name: "回復卷軸", cat: "use", scroll: { kind: "restore", rate: 0.5 }, color: "#e6f0d0", seal: "#4fae3f",
                   desc: "50% 機率補回一次因為強化失敗而用掉的可升級次數" },
  scroll_glove60: { name: "手套攻擊卷軸 60%", cat: "use", scroll: { slots: ["gloves"], rate: 0.6, add: { watk: 2 } }, color: "#d8eec0", seal: "#3a7be0",
                   desc: "60% 機率讓手套的攻擊加 2" },
  green_gel:     { name: "青果凍凝膠", color: "#7fd36b", desc: "青果凍留下的黏黏凝膠" },
  blue_gel:      { name: "藍果凍凝膠", color: "#5aa8ff", desc: "藍果凍留下的冰涼凝膠" },
  shell_shard:   { name: "刺殼碎片", color: "#b49a6a", desc: "刺殼龜背上掉下來的硬殼" },
  moss_core:     { name: "苔岩之心", color: "#8fe07a", desc: "苔岩巨像體內微微發光的石頭" },
  fog_spore:     { name: "霧菇孢子", icon: "gel", color: "#b8a8d8", desc: "霧菇抖下來的紫色孢子" },
  lizard_scale:  { name: "石甲鱗片", icon: "shard", color: "#8a9a6a", desc: "像石頭一樣硬的鱗片" },
  crab_claw:     { name: "蟹王巨鉗", icon: "shard", color: "#d0563a", desc: "巨鉗蟹王掉下來的大鉗子" },
  ancient_ring:  { name: "古樹年輪", color: "#c9a26b", desc: "霧林古樹精體內一圈一圈發光的木心" },
  cloud_wool:    { name: "雲羊毛", icon: "gel", color: "#ffffff", desc: "像雲一樣輕的羊毛" },
  bell_shard:    { name: "風鈴碎片", icon: "shard", color: "#8fe0d8", desc: "敲一下會發出清脆的聲音" },
  thunder_horn:  { name: "雷角", icon: "shard", color: "#ffe066", desc: "摸起來會微微發麻" },
  sand_sigil:    { name: "沙之信物", color: "#ffd84a", desc: "用蠍皇毒針換來的信物，四轉試煉要交給神殿祭司" },
  tomb_sigil:    { name: "墓之信物", color: "#7fe0e0", desc: "用古墓的陶片和餘燼換來的信物，四轉試煉要交給神殿祭司" },
  eagle_feather: { name: "雷鷲羽毛", color: "#a080e0", desc: "雷雲巨鷲身上帶著雷光的羽毛" },
  // the desert continent: materials, scrolls and gear
  fox_tail:      { name: "沙狐尾巴", icon: "gel", color: "#e8a050", desc: "蓬鬆的尾巴，尾端是白色的" },
  worm_skin:     { name: "鑽沙蚯外皮", icon: "shard", color: "#c98a6a", desc: "一圈一圈、很有彈性的皮" },
  cactus_needle: { name: "仙人掌刺", icon: "shard", color: "#6fae5a", desc: "又長又硬，小心別刺到手" },
  wisp_ash:      { name: "燈魂餘燼", color: "#7fe0e0", desc: "還在微微發光的藍色灰燼" },
  clay_shard:    { name: "陶俑碎片", icon: "shard", color: "#b8634a", desc: "古墓陶俑身上掉下來的陶片" },
  scarab_shell:  { name: "聖甲蟲殼", icon: "shard", color: "#3fa898", desc: "閃著金綠色光澤的硬殼" },
  scorp_stinger: { name: "蠍皇毒針", icon: "shard", color: "#c83a3a", desc: "沙暴蠍皇尾巴上的巨大毒針" },
  scroll_cape60: { name: "披風防禦卷軸 60%", cat: "use", scroll: { slots: ["cape"], rate: 0.6, add: { def: 2, hp: 10 } }, color: "#e0d0f0", seal: "#3a7be0",
                   desc: "60% 機率讓披風的防禦加 2、HP 加 10" },
  scroll_shoes60: { name: "鞋子敏捷卷軸 60%", cat: "use", scroll: { slots: ["shoes"], rate: 0.6, add: { dex: 1, avoid: 2 } }, color: "#f0e0c0", seal: "#3a7be0",
                   desc: "60% 機率讓鞋子的敏捷加 1、迴避加 2" },
  sand_sword:    { name: "流砂彎刀", slot: "weapon", wtype: "sword", watk: 85, color: "#f0c070", req: { lv: 55, str: 170 } },
  sun_staff:     { name: "烈陽法杖", slot: "weapon", wtype: "wand", watk: 24, matk: 98, color: "#ff9a3a", req: { lv: 55, int: 170 } },
  dune_bow:      { name: "沙丘長弓", slot: "weapon", wtype: "bow", watk: 78, color: "#d8a050", req: { lv: 55, dex: 170 } },
  sand_claw:     { name: "沙蠍拳爪", slot: "weapon", wtype: "claw", watk: 36, color: "#e0b060", req: { lv: 55, luk: 170 } },
  tomb_sword:    { name: "墓王巨劍", slot: "weapon", wtype: "sword", watk: 100, color: "#8fe0c8", req: { lv: 65, str: 200 } },
  moon_staff:    { name: "冥月法杖", slot: "weapon", wtype: "wand", watk: 27, matk: 115, color: "#a8a0ff", req: { lv: 65, int: 200 } },
  pharaoh_bow:   { name: "金沙王弓", slot: "weapon", wtype: "bow", watk: 92, color: "#ffd84a", req: { lv: 65, dex: 200 } },
  scarab_claw:   { name: "聖甲拳爪", slot: "weapon", wtype: "claw", watk: 42, color: "#3fa898", req: { lv: 65, luk: 200 } },
  desert_hat:    { name: "沙漠頭巾", slot: "hat", def: 28, hp: 50, color: "#f0d8a0", req: { lv: 55 } },
  desert_robe:   { name: "沙漠長衫", slot: "top", def: 38, hp: 80, color: "#e8c080", req: { lv: 55 } },
  desert_pants:  { name: "沙漠燈籠褲", slot: "bottom", def: 30, color: "#d8a868", req: { lv: 55 } },
  desert_boots:  { name: "沙行靴", slot: "shoes", def: 16, dex: 4, avoid: 5, color: "#b88a50", req: { lv: 55 } },
  tomb_helm:     { name: "古墓頭冠", slot: "hat", def: 36, hp: 80, mp: 40, color: "#d8b050", req: { lv: 65 } },
  tomb_armor:    { name: "陶俑胸甲", slot: "top", def: 48, hp: 120, color: "#b8634a", req: { lv: 65 } },
  tomb_greaves:  { name: "陶俑護腿", slot: "bottom", def: 38, hp: 40, color: "#9a5a40", req: { lv: 65 } },
  tomb_cape:     { name: "王陵披風", slot: "cape", def: 26, str: 7, dex: 7, int: 7, luk: 7, color: "#3a6a8a", req: { lv: 65 } },
  // accessories: plain ones from the desert shop, molten ones from the expedition
  sand_earring:  { name: "沙金耳環", slot: "earring", int: 3, luk: 3, mp: 50, color: "#ffd84a", req: { lv: 60 } },
  sand_necklace: { name: "沙紋項鍊", slot: "necklace", str: 3, dex: 3, hp: 80, color: "#e0a040", req: { lv: 60 } },
  sand_ring:     { name: "沙之戒指", slot: "ring", str: 2, dex: 2, int: 2, luk: 2, color: "#d8b050", req: { lv: 60 } },
  magma_earring: { name: "熔心耳環", slot: "earring", str: 5, dex: 5, int: 5, luk: 5, watk: 3, matk: 3, color: "#ff6a2a", req: { lv: 75 } },
  magma_necklace: { name: "熔心項鍊", slot: "necklace", str: 5, dex: 5, int: 5, luk: 5, hp: 300, mp: 150, color: "#ff8a3a", req: { lv: 75 } },
  magma_ring:    { name: "熔心戒指", slot: "ring", str: 3, dex: 3, int: 3, luk: 3, watk: 5, matk: 5, color: "#ffaa3a", req: { lv: 75 } },
  scroll_acc10:  { name: "飾品全能卷軸 10%", cat: "use", scroll: { slots: ACCESSORY_SLOTS, rate: 0.1, add: { str: 3, dex: 3, int: 3, luk: 3 } }, color: "#ffd0a0", seal: "#d23b3b",
                   desc: "10% 機率讓耳環、項鍊或戒指的力量、敏捷、智力、幸運各加 3" },
  magma_pass:    { name: "熔心入場證", color: "#ff6a2a", desc: "進入熔心祭壇要交一張，找沉砂城的遠征隊長卡蘭" },
  // gear from the cloud island
  cloud_sword:   { name: "雲紋長劍", slot: "weapon", wtype: "sword", watk: 72, color: "#bfe0ff", req: { lv: 40, str: 130 } },
  thunder_staff: { name: "雷光法杖", slot: "weapon", wtype: "wand", watk: 22, matk: 82, color: "#ffe066", req: { lv: 40, int: 130 } },
  sky_bow:       { name: "天穹長弓", slot: "weapon", wtype: "bow", watk: 66, color: "#7ab8f0", req: { lv: 40, dex: 130 } },
  cloud_claw:    { name: "雲牙拳爪", slot: "weapon", wtype: "claw", watk: 30, color: "#c8d8f0", req: { lv: 40, luk: 130 } },
  cloud_hat:     { name: "雲絲帽", slot: "hat", def: 22, mp: 40, color: "#e8f0fa", req: { lv: 35 } },
  cloud_robe:    { name: "雲絲長袍", slot: "top", def: 30, hp: 60, color: "#d8e6f8", req: { lv: 38 } },
  cloud_pants:   { name: "雲絲長褲", slot: "bottom", def: 24, color: "#b8cce8", req: { lv: 38 } },
  cloud_boots:   { name: "雲靴", slot: "shoes", def: 12, dex: 3, avoid: 4, color: "#a8c0e4", req: { lv: 35 } },
  cloud_shield:  { name: "雲紋盾", slot: "shield", def: 36, hp: 80, color: "#a8c8f0", req: { lv: 40 }, jobs: ["warrior", "magician"] },
  storm_cape:    { name: "雷羽披風", slot: "cape", def: 20, str: 5, dex: 5, int: 5, luk: 5, color: "#5a4a8a", req: { lv: 45 } },
  // gear from the forest and its bosses
  storm_blade:   { name: "狂嵐巨劍", slot: "weapon", wtype: "sword", watk: 52, color: "#ffb36b", req: { lv: 25, str: 90 } },
  star_staff:    { name: "星輝法杖", slot: "weapon", wtype: "wand", watk: 18, matk: 58, color: "#ffe066", req: { lv: 25, int: 90 } },
  gale_bow:      { name: "疾風長弓", slot: "weapon", wtype: "bow", watk: 48, color: "#5aa8d8", req: { lv: 25, dex: 90 } },
  fang_claw:     { name: "影牙拳爪", slot: "weapon", wtype: "claw", watk: 22, color: "#b07ad8", req: { lv: 25, luk: 90 } },
  fog_hood:      { name: "霧林兜帽", slot: "hat", def: 14, mp: 30, color: "#5f7f78", req: { lv: 18 } },
  lizard_mail:   { name: "甲蜥鎧甲", slot: "top", def: 20, hp: 40, color: "#8a9a6a", req: { lv: 22 } },
  lizard_greaves: { name: "甲蜥護腿", slot: "bottom", def: 15, color: "#6f7f55", req: { lv: 22 } },
  crab_shield:   { name: "蟹殼盾", slot: "shield", def: 26, hp: 50, color: "#d0563a", req: { lv: 22 }, jobs: ["warrior", "magician"] },
  grove_cape:    { name: "古樹披風", slot: "cape", def: 14, str: 3, dex: 3, int: 3, luk: 3, color: "#3f6f3a", req: { lv: 30 } },
};
// shop prices in coins; a shop buys anything back for half, and monster materials have their own price
const PRICES = {
  red_pot: 25, blue_pot: 50, pet_food: 30, town_scroll: 200, arrow: 1, iron_star: 2, steel_star: 4,
  wood_sword: 50, iron_blade: 3000, jade_blade: 20000, oak_wand: 2500, vine_staff: 20000, hunter_bow: 3000, hawk_bow: 20000,
  iron_claw: 3000, dark_claw: 20000, plain_tee: 30, jelly_tunic: 600, plain_shorts: 30, canvas_pants: 600, straw_shoes: 30,
  wind_boots: 2000, leaf_band: 200, leather_cap: 1500, work_gloves: 300, hunter_gloves: 2500, travel_cape: 1500, moss_cape: 15000,
  wood_shield: 1500, shell_shield: 8000,
  storm_blade: 40000, star_staff: 40000, gale_bow: 40000, fang_claw: 40000, fog_hood: 5000, lizard_mail: 9000, lizard_greaves: 7000,
  crab_shield: 16000, grove_cape: 30000, guard_scroll: 8000, restore_scroll: 6000,
  white_pot: 150, mana_pot: 300, sand_earring: 60000, sand_necklace: 60000, sand_ring: 60000,
  magma_earring: 400000, magma_necklace: 400000, magma_ring: 400000, scroll_cape60: 5000, scroll_shoes60: 5000,
  sand_sword: 200000, sun_staff: 200000, dune_bow: 200000, sand_claw: 200000, tomb_cape: 150000,
  desert_hat: 20000, desert_robe: 28000, desert_pants: 24000, desert_boots: 18000, tomb_helm: 40000, tomb_armor: 55000, tomb_greaves: 45000,
  tomb_sword: 300000, moon_staff: 300000, pharaoh_bow: 300000, scarab_claw: 300000, cloud_sword: 120000, thunder_staff: 120000, sky_bow: 120000, cloud_claw: 120000,
  cloud_hat: 12000, cloud_robe: 18000, cloud_pants: 15000, cloud_boots: 10000, cloud_shield: 30000, storm_cape: 60000, scroll_wpn60: 4000, scroll_wpn10: 6000, scroll_arm60: 3000, scroll_arm10: 5000, scroll_glove60: 4000,
};
const SELL = { green_gel: 6, blue_gel: 12, shell_shard: 25, moss_core: 800, fog_spore: 30, lizard_scale: 50, crab_claw: 1500, ancient_ring: 3000,
               cloud_wool: 80, bell_shard: 120, thunder_horn: 200, eagle_feather: 5000,
               fox_tail: 220, worm_skin: 260, cactus_needle: 300, wisp_ash: 340, clay_shard: 380, scarab_shell: 420, scorp_stinger: 20000 };
// sets: wearing more pieces of one set unlocks more of its bonuses (every tier you reach adds up)
const SETS = {
  adventurer: { name: "冒險者套裝", items: ["leather_cap", "jelly_tunic", "canvas_pants", "wind_boots"],
                tiers: { 2: { def: 3 }, 4: { def: 8, hp: 50, avoid: 5 } } },
  fog:        { name: "霧林套裝", items: ["fog_hood", "lizard_mail", "lizard_greaves", "grove_cape"],
                tiers: { 2: { def: 5 }, 3: { watk: 3, matk: 3 }, 4: { def: 15, hp: 150, str: 3, dex: 3, int: 3, luk: 3 } } },
  cloud:      { name: "雲絲套裝", items: ["cloud_hat", "cloud_robe", "cloud_pants", "cloud_boots"],
                tiers: { 2: { def: 8 }, 4: { def: 20, hp: 200, mp: 100, avoid: 5 } } },
  desert:     { name: "沙漠套裝", items: ["desert_hat", "desert_robe", "desert_pants", "desert_boots"],
                tiers: { 2: { def: 10 }, 3: { avoid: 6 }, 4: { def: 25, hp: 300, dex: 5, luk: 5 } } },
  tomb:       { name: "古墓套裝", items: ["tomb_helm", "tomb_armor", "tomb_greaves", "tomb_cape"],
                tiers: { 2: { def: 12 }, 3: { watk: 5, matk: 5 }, 4: { def: 30, hp: 400, str: 6, dex: 6, int: 6, luk: 6 } } },
};
for (const [id, S] of Object.entries(SETS)) S.items.forEach(i => { ITEMS[i].set = id; });
for (const [id, I] of Object.entries(ITEMS)) {
  I.id = id;
  I.price = PRICES[id] || 0;
  I.sell = SELL[id] ?? I.price / 2;
  I.cat = I.slot ? "equip" : I.cat || "etc";
  I.stack = I.slot ? 1 : I.stack || (I.cat === "use" ? 100 : 200);
  if (I.wtype) I.jobs = WTYPES[I.wtype].jobs;
  // how many times a piece of gear can be enhanced with scrolls
  if (I.slot) I.slots = I.slots ?? (I.slot === "weapon" ? 7 : 5);
  // guard and restore scrolls work on any piece of gear
  if (I.scroll && !I.scroll.slots) I.scroll.slots = Object.keys(EQUIP_SLOTS);
}
const newBag = () => ({ equip: Array(BAG_SLOTS).fill(null), use: Array(BAG_SLOTS).fill(null), etc: Array(BAG_SLOTS).fill(null) });
// puts n of an item into a bag, filling partly used stacks first; returns how many did not fit
function addTo(bag, id, n = 1) { return addToList(bag[ITEMS[id].cat], id, n); }
// the same for any list of slots, such as the storage
function addToList(tab, id, n = 1) {
  const I = ITEMS[id];
  for (const s of tab) if (n > 0 && s && s.id === id && s.n < I.stack) { const k = Math.min(n, I.stack - s.n); s.n += k; n -= k; }
  for (let i = 0; i < tab.length && n > 0; i++) if (!tab[i]) { const k = Math.min(n, I.stack); tab[i] = { id, n: k }; n -= k; }
  return n;
}
const outfit = weaponId => ({ hat: null, top: { id: "plain_tee", n: 1 }, bottom: { id: "plain_shorts", n: 1 }, shoes: { id: "straw_shoes", n: 1 },
                              gloves: null, cape: null, weapon: { id: weaponId, n: 1 }, shield: null });
// type: atk (attack), buff, passive. Every number scales with the skill level l.
const SKILLS = {
  warrior: [
    { id: "w_heavy", name: "重擊斬", type: "atk", weapon: "sword", melee: 86, max: 20, mp: l => 4 + (l >> 2), pct: l => 160 + 5 * l,
      desc: l => `用力砍一隻怪物，造成 ${160 + 5 * l}% 傷害` },
    { id: "w_sweep", name: "迴旋橫掃", type: "atk", weapon: "sword", sweep: true, max: 20, req: ["w_heavy", 1], mp: l => 8 + (l >> 2), pct: l => 60 + 4 * l,
      desc: l => `橫掃前方最多 6 隻怪物，各造成 ${60 + 4 * l}% 傷害` },
    { id: "w_iron", name: "鋼鐵意志", type: "buff", max: 20, mp: () => 10, dur: l => 10 * l, def: l => 2 * l,
      desc: l => `${10 * l} 秒內，受到的傷害減少 ${2 * l}` },
    { id: "w_regen", name: "體力回復", type: "passive", max: 16, hpr: l => l,
      desc: l => `自然回復時多回 ${l} HP` },
  ],
  magician: [
    { id: "m_bolt", name: "魔光彈", type: "atk", shot: "bolt", max: 20, mp: l => 3 + (l >> 2), spell: l => 12 + 2 * l,
      desc: l => `射出一顆魔法彈，魔法攻擊 ${12 + 2 * l}` },
    { id: "m_barrier", name: "魔力屏障", type: "buff", max: 20, mp: () => 12, dur: l => 20 * l, absorb: l => 4 * l,
      desc: l => `${20 * l} 秒內，受到的傷害有 ${4 * l}% 改扣 MP` },
    { id: "m_medit", name: "冥想", type: "passive", max: 16, mpr: l => l,
      desc: l => `自然回復時多回 ${l} MP` },
  ],
  bowman: [
    { id: "b_double", name: "連珠箭", type: "atk", weapon: "bow", max: 20, mp: l => 6 + (l >> 3), pct: l => 50 + 3 * l, shots: 2, shot: "arrow",
      desc: l => `連射兩支箭，每支 ${50 + 3 * l}% 傷害` },
    { id: "b_power", name: "強弓射擊", type: "atk", weapon: "bow", max: 20, mp: l => 5 + (l >> 2), pct: l => 140 + 6 * l, shots: 1, shot: "arrow",
      desc: l => `拉滿弓射出一支箭，造成 ${140 + 6 * l}% 傷害` },
    { id: "b_eye", name: "鷹眼", type: "buff", max: 20, mp: () => 10, dur: l => 10 * l, acc: l => l, avoid: l => l,
      desc: l => `${10 * l} 秒內，命中和迴避各加 ${l}` },
    { id: "b_crit", name: "致命瞄準", type: "passive", max: 20, crit: l => 2 * l,
      desc: l => `有 ${2 * l}% 機率打出 1.5 倍的爆擊` },
  ],
  thief: [
    { id: "t_twin", name: "雙星鏢", type: "atk", weapon: "claw", max: 20, mp: l => 8 + (l >> 2), pct: l => 60 + 4 * l, shots: 2, shot: "star",
      desc: l => `連丟兩支飛鏢，每支 ${60 + 4 * l}% 傷害` },
    { id: "t_shadow", name: "影遁", type: "buff", max: 20, mp: l => 20 - (l >> 1), dur: l => 10 * l,
      desc: l => `${10 * l} 秒內躲進影子，怪物碰不到你；一攻擊就會現身` },
    { id: "t_agile", name: "輕身術", type: "passive", max: 20, avoid: l => 2 * l,
      desc: l => `迴避加 ${2 * l}` },
  ],
  // second-job skills; how an attack lands comes from melee (reach), area (radius), shot (+ shots, pierce) or sweep
  berserker: [
    { id: "k_crush", name: "斷岩斬", type: "atk", weapon: "sword", melee: 96, hits: 2, max: 20, mp: l => 12 + (l >> 1), pct: l => 160 + 6 * l,
      desc: l => `對一隻怪物連砍兩刀，每刀 ${160 + 6 * l}% 傷害` },
    { id: "k_quake", name: "震地擊", type: "atk", weapon: "sword", area: 170, targets: 8, max: 20, req: ["k_crush", 5], mp: l => 18 + (l >> 1), pct: l => 110 + 5 * l,
      desc: l => `重擊地面，周圍最多 8 隻怪物各受到 ${110 + 5 * l}% 傷害` },
    { id: "k_rage", name: "戰意沸騰", type: "buff", max: 20, mp: () => 15, dur: l => 10 * l, watk: l => l,
      desc: l => `${10 * l} 秒內，攻擊加 ${l}` },
    { id: "k_mastery", name: "劍術精通", type: "passive", max: 20, mastery: l => 3 * l, acc: l => l,
      desc: l => `熟練度加 ${3 * l}%（傷害更穩定），命中加 ${l}` },
  ],
  elementalist: [
    { id: "e_fire", name: "火焰球", type: "atk", shot: "fire", max: 20, mp: l => 10 + (l >> 1), spell: l => 40 + 3 * l,
      desc: l => `射出一顆火球，魔法攻擊 ${40 + 3 * l}` },
    { id: "e_frost", name: "冰霜新星", type: "atk", area: 180, targets: 6, max: 20, req: ["e_fire", 5], mp: l => 16 + (l >> 1), spell: l => 26 + 2 * l,
      desc: l => `以自己為中心放出寒氣，周圍最多 6 隻怪物受到魔法攻擊 ${26 + 2 * l}` },
    { id: "e_thunder", name: "雷鳴", type: "atk", melee: 230, targets: 3, max: 20, mp: l => 14 + (l >> 1), spell: l => 32 + 2 * l,
      desc: l => `召喚雷電打中前方最多 3 隻怪物，魔法攻擊 ${32 + 2 * l}` },
    { id: "e_mastery", name: "元素精通", type: "passive", max: 20, mastery: l => 3 * l, matk: l => l,
      desc: l => `魔法熟練度加 ${3 * l}%，魔力加 ${l}` },
  ],
  hawkeye: [
    { id: "h_triple", name: "三連矢", type: "atk", weapon: "bow", shot: "arrow", shots: 3, max: 20, mp: l => 12 + (l >> 2), pct: l => 70 + 4 * l,
      desc: l => `連射三支箭，每支 ${70 + 4 * l}% 傷害` },
    { id: "h_pierce", name: "穿雲箭", type: "atk", weapon: "bow", shot: "arrow", shots: 1, pierce: 4, max: 20, mp: l => 14 + (l >> 2), pct: l => 150 + 6 * l,
      desc: l => `一箭穿過最多 4 隻怪物，各造成 ${150 + 6 * l}% 傷害` },
    { id: "h_mastery", name: "弓術精通", type: "passive", max: 20, mastery: l => 3 * l, acc: l => l,
      desc: l => `熟練度加 ${3 * l}%，命中加 ${l}` },
  ],
  assassin: [
    { id: "a_triple", name: "三重星", type: "atk", weapon: "claw", shot: "star", shots: 3, max: 20, mp: l => 12 + (l >> 2), pct: l => 70 + 4 * l,
      desc: l => `連丟三支飛鏢，每支 ${70 + 4 * l}% 傷害` },
    { id: "a_meteor", name: "流星鏢", type: "atk", weapon: "claw", shot: "star", shots: 1, pierce: 4, max: 20, mp: l => 14 + (l >> 2), pct: l => 160 + 6 * l,
      desc: l => `一支飛鏢貫穿最多 4 隻怪物，各造成 ${160 + 6 * l}% 傷害` },
    { id: "a_haste", name: "疾行", type: "buff", max: 20, mp: () => 14, dur: l => 10 * l, speed: l => Math.round(l * 1.5),
      desc: l => `${10 * l} 秒內，移動速度加 ${Math.round(l * 1.5)}%` },
    { id: "a_mastery", name: "飛鏢精通", type: "passive", max: 20, mastery: l => 3 * l, avoid: l => l,
      desc: l => `熟練度加 ${3 * l}%，迴避加 ${l}` },
  ],
  // third-job skills; area attacks can hit more than once (hits) and may rain fire or arrows (fx)
  swordsaint: [
    { id: "s_storm", name: "千刃風暴", type: "atk", weapon: "sword", area: 200, targets: 10, hits: 2, max: 20, mp: l => 24 + (l >> 1), pct: l => 120 + 5 * l,
      desc: l => `捲起劍刃風暴，周圍最多 10 隻怪物各被砍兩下，每下 ${120 + 5 * l}% 傷害` },
    { id: "s_break", name: "破天斬", type: "atk", weapon: "sword", melee: 120, targets: 3, hits: 3, max: 20, req: ["s_storm", 5], mp: l => 20 + (l >> 1), pct: l => 180 + 6 * l,
      desc: l => `向前斬出劍氣，前方最多 3 隻怪物各被砍三下，每下 ${180 + 6 * l}% 傷害` },
    { id: "s_soul", name: "劍魂覺醒", type: "buff", max: 20, mp: () => 30, dur: l => 10 * l, watk: l => 2 * l,
      desc: l => `${10 * l} 秒內，攻擊加 ${2 * l}` },
    { id: "s_instinct", name: "戰鬥本能", type: "passive", max: 20, crit: l => Math.round(1.5 * l),
      desc: l => `有 ${Math.round(1.5 * l)}% 機率打出 1.5 倍的爆擊` },
  ],
  starsage: [
    { id: "x_meteor", name: "流星雨", type: "atk", area: 260, targets: 10, fx: "rain", rain: "fire", max: 20, mp: l => 30 + (l >> 1), spell: l => 60 + 3 * l,
      desc: l => `召喚流星落在周圍，最多 10 隻怪物受到魔法攻擊 ${60 + 3 * l}` },
    { id: "x_chain", name: "連鎖閃電", type: "atk", melee: 300, targets: 6, max: 20, req: ["x_meteor", 5], mp: l => 22 + (l >> 1), spell: l => 50 + 3 * l,
      desc: l => `閃電在前方最多 6 隻怪物之間跳躍，魔法攻擊 ${50 + 3 * l}` },
    { id: "x_infinity", name: "魔力無限", type: "buff", max: 20, mp: () => 50, dur: l => 3 * l,
      desc: l => `${3 * l} 秒內，放技能不用 MP` },
    { id: "x_wisdom", name: "星辰智慧", type: "passive", max: 20, matk: l => 2 * l,
      desc: l => `魔力加 ${2 * l}` },
  ],
  ranger: [
    { id: "g_rain", name: "箭雨", type: "atk", weapon: "bow", area: 240, targets: 10, fx: "rain", rain: "arrow", max: 20, mp: l => 24 + (l >> 1), pct: l => 140 + 5 * l,
      desc: l => `向天空射出一陣箭雨，周圍最多 10 隻怪物各受到 ${140 + 5 * l}% 傷害` },
    { id: "g_snipe", name: "致命狙擊", type: "atk", weapon: "bow", shot: "arrow", shots: 1, pierce: 6, max: 20, req: ["g_rain", 5], mp: l => 20 + (l >> 1), pct: l => 300 + 10 * l,
      desc: l => `一箭穿過最多 6 隻怪物，各造成 ${300 + 10 * l}% 傷害` },
    { id: "g_focus", name: "專注", type: "buff", max: 20, mp: () => 25, dur: l => 10 * l, crit: l => l,
      desc: l => `${10 * l} 秒內，爆擊機率加 ${l}%` },
    { id: "g_sharp", name: "神射", type: "passive", max: 20, crit: l => Math.round(1.5 * l), acc: l => l,
      desc: l => `有 ${Math.round(1.5 * l)}% 機率打出爆擊，命中加 ${l}` },
  ],
  nightlord: [
    { id: "n_shuriken", name: "千影手裏劍", type: "atk", weapon: "claw", shot: "star", shots: 4, max: 20, mp: l => 22 + (l >> 1), pct: l => 100 + 5 * l,
      desc: l => `連丟四支飛鏢，每支 ${100 + 5 * l}% 傷害` },
    { id: "n_assault", name: "影殺", type: "atk", weapon: "claw", melee: 150, targets: 4, hits: 2, max: 20, req: ["n_shuriken", 5], mp: l => 24 + (l >> 1), pct: l => 200 + 6 * l,
      desc: l => `化成影子穿過前方最多 4 隻怪物，各砍兩下，每下 ${200 + 6 * l}% 傷害` },
    { id: "n_dark", name: "暗影護體", type: "buff", max: 20, mp: () => 25, dur: l => 10 * l, avoid: l => 2 * l,
      desc: l => `${10 * l} 秒內，迴避加 ${2 * l}` },
    { id: "n_vital", name: "要害打擊", type: "passive", max: 20, crit: l => Math.round(1.5 * l),
      desc: l => `有 ${Math.round(1.5 * l)}% 機率打出 1.5 倍的爆擊` },
  ],
};
// fourth-job skills: up to Lv.20 until you read the skill's book (book: true), then up to Lv.30.
// cd is a cooldown in seconds; dmg raises all damage by that many percent (a passive, or a buff while it lasts);
// the ultimates rain beams of light (fx "sky") in the job's colour (tint)
const FOURTH_SKILLS = {
  swordking: [
    { id: "k4_rift", name: "裂空斬", type: "atk", weapon: "sword", melee: 170, targets: 6, hits: 4, max: 30, book: true, mp: l => 40 + (l >> 1), pct: l => 160 + 5 * l,
      desc: l => `斬開空間，前方最多 6 隻怪物各被砍四下，每下 ${160 + 5 * l}% 傷害` },
    { id: "k4_judgment", name: "天劍審判", type: "atk", weapon: "sword", area: 420, targets: 15, hits: 6, fx: "sky", tint: "#ffd84a", max: 30, book: true, req: ["k4_rift", 5],
      cd: () => 60, mp: l => 80 + l, pct: l => 250 + 8 * l,
      desc: l => `從天上落下無數把光劍，周圍最多 15 隻怪物各被砍六下，每下 ${250 + 8 * l}% 傷害` },
    { id: "k4_aura", name: "帝王劍氣", type: "buff", max: 30, book: true, cd: () => 120, mp: () => 60, dur: l => 30 + l, dmg: l => 10 + l,
      desc: l => `${30 + l} 秒內，所有傷害加 ${10 + l}%` },
    { id: "k4_valor", name: "劍帝極意", type: "passive", max: 30, book: true, mastery: l => l, dmg: l => Math.round(l * 0.7),
      desc: l => `熟練度加 ${l}%，所有傷害加 ${Math.round(l * 0.7)}%` },
  ],
  astromancer: [
    { id: "q4_nova", name: "星爆", type: "atk", area: 300, targets: 12, hits: 2, fx: "nova", max: 30, book: true, mp: l => 40 + (l >> 1), spell: l => 55 + 3 * l,
      desc: l => `讓周圍的星光爆開，最多 12 隻怪物各受到兩次魔法攻擊 ${55 + 3 * l}` },
    { id: "q4_bigbang", name: "創世星爆", type: "atk", area: 440, targets: 15, hits: 4, fx: "sky", tint: "#b8a0ff", max: 30, book: true, req: ["q4_nova", 5],
      cd: () => 60, mp: l => 100 + l, spell: l => 110 + 5 * l,
      desc: l => `讓星辰從天而降，周圍最多 15 隻怪物各受到四次魔法攻擊 ${110 + 5 * l}` },
    { id: "q4_grace", name: "星海加護", type: "buff", max: 30, book: true, cd: () => 120, mp: () => 80, dur: l => 30 + l, dmg: l => 10 + l,
      desc: l => `${30 + l} 秒內，所有傷害加 ${10 + l}%` },
    { id: "q4_mind", name: "魔導極意", type: "passive", max: 30, book: true, mastery: l => l, dmg: l => Math.round(l * 0.7),
      desc: l => `熟練度加 ${l}%，所有傷害加 ${Math.round(l * 0.7)}%` },
  ],
  skyarcher: [
    { id: "y4_storm", name: "颶風連射", type: "atk", weapon: "bow", shot: "arrow", shots: 5, pierce: 2, max: 30, book: true, mp: l => 36 + (l >> 1), pct: l => 110 + 4 * l,
      desc: l => `一口氣射出五箭，每箭穿過 2 隻怪物，各造成 ${110 + 4 * l}% 傷害` },
    { id: "y4_starfall", name: "天墜箭", type: "atk", weapon: "bow", area: 420, targets: 15, hits: 5, fx: "sky", tint: "#9fe8ff", max: 30, book: true, req: ["y4_storm", 5],
      cd: () => 60, mp: l => 80 + l, pct: l => 240 + 8 * l,
      desc: l => `向天空射出一箭，化成光箭落下，周圍最多 15 隻怪物各中五箭，每箭 ${240 + 8 * l}% 傷害` },
    { id: "y4_eye", name: "鷹神之眼", type: "buff", max: 30, book: true, cd: () => 120, mp: () => 60, dur: l => 30 + l, dmg: l => 10 + l,
      desc: l => `${30 + l} 秒內，所有傷害加 ${10 + l}%` },
    { id: "y4_mastery", name: "箭神極意", type: "passive", max: 30, book: true, mastery: l => l, dmg: l => Math.round(l * 0.7),
      desc: l => `熟練度加 ${l}%，所有傷害加 ${Math.round(l * 0.7)}%` },
  ],
  shadowlord: [
    { id: "z4_triple", name: "冥影三連", type: "atk", weapon: "claw", shot: "star", shots: 3, pierce: 3, max: 30, book: true, mp: l => 36 + (l >> 1), pct: l => 150 + 5 * l,
      desc: l => `連丟三支冥影飛鏢，每支穿過 3 隻怪物，各造成 ${150 + 5 * l}% 傷害` },
    { id: "z4_eclipse", name: "日蝕", type: "atk", weapon: "claw", area: 420, targets: 15, hits: 6, fx: "sky", tint: "#c06aff", max: 30, book: true, req: ["z4_triple", 5],
      cd: () => 60, mp: l => 80 + l, pct: l => 220 + 8 * l,
      desc: l => `遮住太陽，讓影刃從天而降，周圍最多 15 隻怪物各被砍六下，每下 ${220 + 8 * l}% 傷害` },
    { id: "z4_veil", name: "冥夜之幕", type: "buff", max: 30, book: true, cd: () => 120, mp: () => 60, dur: l => 30 + l, dmg: l => 10 + l,
      desc: l => `${30 + l} 秒內，所有傷害加 ${10 + l}%` },
    { id: "z4_mastery", name: "影帝極意", type: "passive", max: 30, book: true, mastery: l => l, dmg: l => Math.round(l * 0.7),
      desc: l => `熟練度加 ${l}%，所有傷害加 ${Math.round(l * 0.7)}%` },
  ],
};
Object.assign(SKILLS, FOURTH_SKILLS);
const SKILL_BY_ID = {};
Object.values(SKILLS).flat().forEach(s => { SKILL_BY_ID[s.id] = s; });
const MASTERY_SKILLS = ["k_mastery", "e_mastery", "h_mastery", "a_mastery", "k4_valor", "q4_mind", "y4_mastery", "z4_mastery"];
// skills that raise all damage: the fourth-job passives always, their buffs while they last
const DMG_SKILLS = Object.values(FOURTH_SKILLS).flat().filter(s => s.dmg).map(s => s.id);
// one skill book per fourth-job skill, dropped by the scorpion king
const BOOK_COLORS = { swordking: "#ffd84a", astromancer: "#b8a0ff", skyarcher: "#9fe8ff", shadowlord: "#c06aff" };
for (const [j, list] of Object.entries(FOURTH_SKILLS)) for (const s of list) {
  const id = `book_${s.id}`;
  ITEMS[id] = { id, name: `${s.name}技能書`, cat: "use", book: s.id, icon: "book", color: BOOK_COLORS[j], price: 0, sell: 5000, stack: 10,
                desc: `讀了之後，「${s.name}」最高可以升到 Lv.${s.max}（原本 Lv.20）。只有${JOBS[j].name}看得懂` };
}
// a book drop: one of your own job's books when you are in a fourth job, otherwise any of them
function bookDrop() {
  const own = FOURTH_SKILLS[P.job] || Object.values(FOURTH_SKILLS).flat();
  return `book_${own[randi(0, own.length - 1)].id}`;
}
TYPES.scorpking.drops.push([bookDrop, 0.5]);
const CRIT_SKILLS = ["b_crit", "s_instinct", "g_sharp", "n_vital"];
