// 冒煙測試：確認遊戲打得開、角色能動、會存檔、手機有觸控按鈕
const { test, expect, devices } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const GAME_URL = pathToFileURL(path.join(__dirname, "..", "index.html")).href;

// 擋掉 Google 字型：沒網路時也能測，字型只影響外觀
// 新角色和沒有外觀的舊存檔會先出現建立角色畫面；一般測試直接幫它取名「測試員」，keepCreate 才留著畫面
async function openGame(page, { keepCreate = false } = {}) {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.goto(GAME_URL);
  if (!keepCreate) await finishCreate(page);
  return errors;
}
const finishCreate = page => page.evaluate(() => { if (!createWin.hidden) { draft.name = "測試員"; confirmCreate(); } });

test("遊戲畫面正常顯示，沒有程式錯誤", async ({ page }) => {
  const errors = await openGame(page);
  await expect(page).toHaveTitle("浮島冒險記");
  const box = await page.locator("#game").boundingBox();
  expect(box.width).toBeGreaterThan(100);
  expect(box.height).toBeGreaterThan(50);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

// 從右上角小地圖找玩家的黃點（#ffe066），回傳它的平均 x；雲會飄，所以不能只比整張畫面
function playerDotX(page) {
  return page.evaluate(() => {
    const cv = document.getElementById("game");
    const s = cv.width / 960;
    const x0 = Math.floor(738 * s), y0 = Math.floor(12 * s), w = Math.ceil(210 * s), h = Math.ceil(64 * s);
    const px = cv.getContext("2d").getImageData(x0, y0, w, h).data;
    let sum = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (Math.abs(px[i] - 255) < 12 && Math.abs(px[i + 1] - 224) < 12 && Math.abs(px[i + 2] - 102) < 12) {
        sum += (i / 4) % w; n++;
      }
    }
    return n ? sum / n / s : null;
  });
}

test("按住右鍵角色會往右走，跳躍、攻擊不出錯", async ({ page }) => {
  const errors = await openGame(page);
  await page.locator("#game").click();
  await page.waitForTimeout(300);
  const before = await playerDotX(page);
  expect(before).not.toBeNull();

  // 只走 0.8 秒：起點 x=96，怪物最近在 x=300，這段路不會被撞退
  // 走速 125 px/s 走 0.8 秒約 100 px，小地圖縮小約 15 倍，黃點應該右移約 6.5 px
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(800);
  await page.keyboard.up("ArrowRight");
  const after = await playerDotX(page);
  expect(after - before).toBeGreaterThan(3);

  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  await page.keyboard.down("x");
  await page.waitForTimeout(800);
  await page.keyboard.up("x");
  expect(errors).toEqual([]);
});

test("離開頁面時會把進度存進瀏覽器", async ({ page }) => {
  const errors = await openGame(page);
  await page.locator("#game").click();
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("floating-isle-v1")));
  expect(saved.lv).toBe(1);
  expect(saved.bag.use.filter(Boolean)).toEqual([{ id: "red_pot", n: 5 }, { id: "blue_pot", n: 3 }, { id: "town_scroll", n: 2 }]);
  expect(saved.map).toBe("village");
  expect(saved.eq.weapon).toEqual({ id: "wood_sword", n: 1 });
  expect(errors).toEqual([]);
});

// 先把角色資料放進瀏覽器存檔，再打開遊戲
async function openWithSave(page, save, opts) {
  await page.addInitScript(s => localStorage.setItem("floating-isle-v1", JSON.stringify(s)), save);
  return openGame(page, opts);
}
const readSave = async page => {
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  return page.evaluate(() => JSON.parse(localStorage.getItem("floating-isle-v1")));
};
const LV10_BEGINNER = {
  lv: 10, exp: 0, job: "beginner", str: 35, dex: 5, int: 4, luk: 4, ap: 0, sp: 0,
  mhp: 176, mmp: 104, hp: 176, mp: 104, coins: 0, pots: { hp: 5, mp: 3 },
};
// 村裡的 NPC 都站在地面上：轉職教官 x=168、道具商 330、武器商 490、村長 660。
// 鏡頭一開始在地圖左下角，地面在畫面 y=456，所以點 (x, 440) 就會點到他們的身體
async function clickNpc(page, x = 168) {
  const box = await page.locator("#game").boundingBox();
  await page.mouse.click(box.x + box.width * x / 960, box.y + box.height * 440 / 540);
}

test("舊存檔會補回能力值，能在能力值視窗加點", async ({ page }) => {
  // 沒有職業欄位的舊存檔：Lv.3 應該補回 2 級 × 5 = 10 點 AP
  const errors = await openWithSave(page, { lv: 3, exp: 0, coins: 0, pots: { hp: 5, mp: 3 } });
  await page.locator("#game").click();
  await page.keyboard.press("s");
  const win = page.locator("#statsWin");
  await expect(win).toBeVisible();
  await expect(win.locator(".ap b")).toHaveText("10");
  const str = win.locator(".row.stat").first().locator("b");
  await expect(str).toHaveText("12");
  await win.locator('[data-stat="str"]').click();
  await expect(str).toHaveText("13");
  await expect(win.locator(".ap b")).toHaveText("9");
  expect(errors).toEqual([]);
});

test("Lv.10 找轉職教官轉成劍士，學技能並施放", async ({ page }) => {
  const errors = await openWithSave(page, LV10_BEGINNER);
  await clickNpc(page);
  const dlg = page.locator("#dlg");
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: /我想轉職/ }).click();
  await dlg.getByRole("button", { name: /劍士/ }).click();
  await dlg.getByRole("button", { name: /我要成為劍士/ }).click();
  await dlg.getByRole("button", { name: /好/ }).click();
  await expect(dlg).toBeHidden();

  await page.keyboard.press("k");
  const win = page.locator("#skillsWin");
  await expect(win).toContainText("重擊斬");
  await expect(win.locator(".ap b")).toHaveText("1");
  await win.locator('[data-skill="w_heavy"]').click();
  await expect(win.locator(".ap b")).toHaveText("0");

  // 技能要按住到下一個畫面才會放出來
  await page.keyboard.down("Shift");
  await page.waitForTimeout(200);
  await page.keyboard.up("Shift");
  const saved = await readSave(page);
  expect(saved.job).toBe("warrior");
  expect(saved.skills.w_heavy).toBe(1);
  expect(saved.mp).toBeLessThan(saved.mmp);
  expect(errors).toEqual([]);
});

test("能力值不夠時，轉職教官會說還差多少", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV10_BEGINNER, str: 12, ap: 23 });
  await clickNpc(page);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /我想轉職/ }).click();
  await dlg.getByRole("button", { name: /劍士/ }).click();
  await expect(dlg).toContainText("力量還差 23 點");
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  expect((await readSave(page)).job).toBe("beginner");
  expect(errors).toEqual([]);
});

test("盜賊丟飛鏢、放技能都不出錯", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV10_BEGINNER, job: "thief", str: 4, dex: 25, luk: 31, sp: 0, skills: { t_twin: 1, t_shadow: 1 },
  });
  await page.locator("#game").click();
  for (const key of ["x", "Shift", "d"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(700);
    await page.keyboard.up(key);
  }
  const saved = await readSave(page);
  expect(saved.buffs.t_shadow).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

const itemCount = (saved, id) => Object.values(saved.bag).flat().reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);

test("舊存檔的藥水搬進背包，在消耗欄喝藥水", async ({ page }) => {
  // 第 1 階段的存檔沒有背包，藥水記在 pots 裡
  const errors = await openWithSave(page, { ...LV10_BEGINNER, hp: 100 });
  await page.locator("#game").click();
  await page.keyboard.press("i");
  const win = page.locator("#invWin");
  await expect(win).toBeVisible();
  await win.getByRole("tab", { name: "消耗" }).click();
  await win.getByRole("button", { name: "紅藥水 ×5" }).click();
  await win.getByRole("button", { name: "使用" }).click();
  await expect(win.getByRole("button", { name: "紅藥水 ×4" })).toBeVisible();
  const saved = await readSave(page);
  expect(itemCount(saved, "red_pot")).toBe(4);
  expect(saved.hp).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test("穿上、卸下裝備，等級不夠就穿不上", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV10_BEGINNER, lv: 1, str: 12, mhp: 50, mmp: 5, hp: 50, mp: 5,
    bag: { equip: [{ id: "leaf_band", n: 1 }, { id: "iron_blade", n: 1 }], use: [], etc: [] },
    eq: { weapon: { id: "wood_sword", n: 1 } },
  });
  await page.locator("#game").click();
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("button", { name: "綠葉頭巾" }).dblclick();
  await expect(inv.getByRole("button", { name: "綠葉頭巾" })).toHaveCount(0);

  // 精鐵長劍要 Lv.10：說明裡等級需求是紅字，按裝備也穿不上
  await inv.getByRole("button", { name: "精鐵長劍" }).click();
  await expect(inv.locator(".info .bad")).toContainText(["等級 10"]);
  await inv.getByRole("button", { name: "裝備", exact: true }).click();
  let saved = await readSave(page);
  expect(saved.eq.hat).toEqual({ id: "leaf_band", n: 1 });
  expect(saved.eq.weapon.id).toBe("wood_sword");

  await page.keyboard.press("e");
  const eq = page.locator("#equipWin");
  await expect(eq).toContainText("防禦 +4");
  await eq.getByRole("button", { name: "帽子：綠葉頭巾" }).click();
  await eq.getByRole("button", { name: "卸下" }).click();
  saved = await readSave(page);
  expect(saved.eq.hat).toBeNull();
  expect(itemCount(saved, "leaf_band")).toBe(1);
  expect(errors).toEqual([]);
});

test("弓手射箭會用掉箭矢，用完可以跟道具商買", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV10_BEGINNER, job: "bowman", str: 4, dex: 25, coins: 500,
    bag: { equip: [], use: [{ id: "arrow", n: 2 }], etc: [] },
    eq: { weapon: { id: "hunter_bow", n: 1 } },
  });
  await page.locator("#game").click();
  await page.keyboard.down("x");
  await page.waitForTimeout(1600);
  await page.keyboard.up("x");
  expect(itemCount(await readSave(page), "arrow")).toBe(0);

  await clickNpc(page, 330);
  await page.locator("#dlg").getByRole("button", { name: /買賣/ }).click();
  const shop = page.locator("#shopWin");
  await expect(shop).toContainText("道具商 莫莉");
  await shop.getByRole("button", { name: "買木箭矢" }).click();
  const saved = await readSave(page);
  expect(itemCount(saved, "arrow")).toBe(100);
  expect(saved.coins).toBe(400);
  expect(errors).toEqual([]);
});

test("賣裝備要按兩次確認", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV10_BEGINNER, coins: 0,
    bag: { equip: [{ id: "iron_blade", n: 1 }], use: [], etc: [{ id: "green_gel", n: 10 }] }, eq: { weapon: { id: "wood_sword", n: 1 } },
  });
  await clickNpc(page, 490);
  await page.locator("#dlg").getByRole("button", { name: /買賣/ }).click();
  const shop = page.locator("#shopWin");
  await shop.getByRole("tab", { name: "賣" }).click();
  await shop.getByRole("tab", { name: "裝備" }).click();
  await shop.getByRole("button", { name: "賣掉精鐵長劍" }).click();
  await expect(shop.getByRole("button", { name: "賣掉精鐵長劍" })).toHaveText("確定賣掉？");
  expect(itemCount(await readSave(page), "iron_blade")).toBe(1);
  await shop.getByRole("button", { name: "賣掉精鐵長劍" }).click();
  await shop.getByRole("tab", { name: "其他" }).click();
  await shop.getByRole("button", { name: "全部賣掉青果凍凝膠" }).click();
  const saved = await readSave(page);
  expect(itemCount(saved, "iron_blade")).toBe(0);
  expect(saved.coins).toBe(1500 + 60);
  expect(errors).toEqual([]);
});

test("找村長接任務，任務日誌顯示進度", async ({ page }) => {
  const errors = await openGame(page);
  await clickNpc(page, 660);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /【任務】果凍大掃除/ }).click();
  await dlg.getByRole("button", { name: /交給我/ }).click();
  await dlg.getByRole("button", { name: /知道了/ }).click();
  await page.keyboard.press("q");
  await expect(page.locator("#questWin")).toContainText("打倒青果凍 0 / 10");
  expect((await readSave(page)).quests.q_jelly.state).toBe("active");
  expect(errors).toEqual([]);
});

test("打倒的數量夠了，回村長那裡拿獎勵", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV10_BEGINNER, lv: 3, coins: 0, quests: { q_jelly: { state: "active", kills: { jelly: 10 } } } });
  await clickNpc(page, 660);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /【完成】果凍大掃除/ }).click();
  await dlg.getByRole("button", { name: /謝謝/ }).click();
  const saved = await readSave(page);
  expect(saved.quests.q_jelly.state).toBe("done");
  expect(saved.coins).toBe(300);
  expect(itemCount(saved, "red_pot")).toBe(15);
  expect(saved.lv).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test("收集任務會收走材料、給裝備", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV10_BEGINNER, lv: 5, quests: { q_jelly: { state: "done" }, q_gel: { state: "active", kills: {} } },
    bag: { equip: [], use: [], etc: [{ id: "blue_gel", n: 18 }] }, eq: { weapon: { id: "wood_sword", n: 1 } },
  });
  await clickNpc(page, 660);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /【完成】冰涼的凝膠/ }).click();
  await dlg.getByRole("button", { name: /謝謝/ }).click();
  const saved = await readSave(page);
  expect(itemCount(saved, "blue_gel")).toBe(3);
  expect(itemCount(saved, "travel_cape")).toBe(1);
  expect(errors).toEqual([]);
});

test("轉職成盜賊會拿到拳爪和飛鏢", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV10_BEGINNER, str: 4, dex: 25, luk: 30 });
  await clickNpc(page);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /我想轉職/ }).click();
  await dlg.getByRole("button", { name: /盜賊/ }).click();
  await dlg.getByRole("button", { name: /我要成為盜賊/ }).click();
  await expect(dlg).toContainText("鐵指爪");
  const saved = await readSave(page);
  expect(saved.eq.weapon.id).toBe("iron_claw");
  expect(itemCount(saved, "wood_sword")).toBe(1);
  expect(itemCount(saved, "iron_star")).toBe(500);
  expect(errors).toEqual([]);
});

test("丟掉的東西會掉在地上，按 Z 可以撿回來", async ({ page }) => {
  const errors = await openGame(page);
  await page.locator("#game").click();
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("tab", { name: "消耗" }).click();
  await inv.getByRole("button", { name: "紅藥水 ×5" }).click();
  await inv.getByRole("button", { name: "丟掉" }).click();
  expect(itemCount(await readSave(page), "red_pot")).toBe(0);
  await page.waitForTimeout(800);
  await page.keyboard.down("z");
  await page.waitForTimeout(300);
  await page.keyboard.up("z");
  expect(itemCount(await readSave(page), "red_pot")).toBe(5);
  expect(errors).toEqual([]);
});

test("站在傳送門按 ↑ 會換地圖，世界地圖標出所在位置", async ({ page }) => {
  // 從青草平原開始：出生點就在通往浮島村的傳送門上
  const errors = await openWithSave(page, { ...LV10_BEGINNER, map: "meadow" });
  await page.locator("#game").click();
  await page.keyboard.press("w");
  const world = page.locator("#worldWin");
  await expect(world.locator(".place.here")).toContainText("青草平原");
  await page.keyboard.press("ArrowUp");
  await expect(world.locator(".place.here")).toContainText("浮島村");
  expect((await readSave(page)).map).toBe("village");
  expect(errors).toEqual([]);
});

test("讀回村卷軸會回到浮島村", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV10_BEGINNER, map: "shore",
    bag: { equip: [], use: [{ id: "town_scroll", n: 1 }], etc: [] }, eq: { weapon: { id: "wood_sword", n: 1 } },
  });
  await page.locator("#game").click();
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("tab", { name: "消耗" }).click();
  await inv.getByRole("button", { name: "回村卷軸" }).click();
  await inv.getByRole("button", { name: "使用" }).click();
  const saved = await readSave(page);
  expect(saved.map).toBe("village");
  expect(itemCount(saved, "town_scroll")).toBe(0);
  expect(errors).toEqual([]);
});

const LV30_WARRIOR = {
  ...LV10_BEGINNER, lv: 30, job: "warrior", str: 120, sp: 0, mhp: 900, mmp: 150, hp: 900, mp: 150,
  skills: { w_heavy: 20, w_sweep: 20, w_iron: 10, w_regen: 10 },
};

test("Lv.30 找轉職教官二轉，學到新技能", async ({ page }) => {
  const errors = await openWithSave(page, LV30_WARRIOR);
  await clickNpc(page);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /我想二轉/ }).click();
  await dlg.getByRole("button", { name: /我要成為狂刃騎士/ }).click();
  await dlg.getByRole("button", { name: /好/ }).click();
  await page.keyboard.press("k");
  const win = page.locator("#skillsWin");
  await expect(win).toContainText("狂刃騎士技能");
  await win.locator('[data-skill="k_crush"]').click();
  const saved = await readSave(page);
  expect(saved.job).toBe("berserker");
  expect(saved.skills.k_crush).toBe(1);
  expect(saved.skills.w_heavy).toBe(20);
  expect(errors).toEqual([]);
});

test("狂刃騎士按技能 4 的鍵放出斷岩斬", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV30_WARRIOR, job: "berserker", skills: { ...LV30_WARRIOR.skills, k_crush: 5, k_quake: 5 } });
  await page.locator("#game").click();
  await page.keyboard.down("g"); await page.waitForTimeout(200); await page.keyboard.up("g");
  expect((await readSave(page)).mp).toBeLessThan(150);
  expect(errors).toEqual([]);
});

test("元素術士放火焰球、冰霜新星、雷鳴都不出錯", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV30_WARRIOR, job: "elementalist", str: 4, int: 130, mmp: 900, mp: 900,
    skills: { m_bolt: 20, m_barrier: 5, e_fire: 5, e_frost: 5, e_thunder: 5 }, eq: { weapon: { id: "oak_wand", n: 1 } },
  });
  await page.locator("#game").click();
  for (const key of ["f", "g", "h"]) {
    await page.keyboard.down(key); await page.waitForTimeout(700); await page.keyboard.up(key);
  }
  expect((await readSave(page)).mp).toBeLessThan(900);
  expect(errors).toEqual([]);
});

test("卷軸強化：成功會加攻擊，失敗只扣可升級次數", async ({ page }) => {
  // 先讓亂數固定成 0，強化一定成功
  await page.addInitScript(() => { Math.random = () => 0; });
  const errors = await openWithSave(page, {
    ...LV10_BEGINNER, bag: { equip: [], use: [{ id: "scroll_wpn60", n: 2 }], etc: [] }, eq: { weapon: { id: "iron_blade", n: 1 } },
  });
  await page.locator("#game").click();
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("tab", { name: "消耗" }).click();
  await inv.getByRole("button", { name: /武器攻擊卷軸/ }).click();
  await inv.getByRole("button", { name: "使用" }).click();
  await inv.getByRole("button", { name: /精鐵長劍（身上）/ }).click();
  let saved = await readSave(page);
  expect(saved.eq.weapon).toEqual({ id: "iron_blade", n: 1, left: 6, up: 1, bonus: { watk: 2, matk: 2 } });

  // 再讓亂數變成 0.99，這次一定失敗
  await page.evaluate(() => { Math.random = () => 0.99; });
  await inv.getByRole("button", { name: /武器攻擊卷軸/ }).click();
  await inv.getByRole("button", { name: "使用" }).click();
  await inv.getByRole("button", { name: /精鐵長劍 \+1（身上）/ }).click();
  saved = await readSave(page);
  expect(saved.eq.weapon).toEqual({ id: "iron_blade", n: 1, left: 5, up: 1, bonus: { watk: 2, matk: 2 } });
  expect(itemCount(saved, "scroll_wpn60")).toBe(0);
  expect(errors).toEqual([]);
});

test("鍵位設定：把攻擊改到 J，重新整理後還在", async ({ page }) => {
  const errors = await openGame(page);
  await page.locator("#openKeys").click();
  const win = page.locator("#keysWin");
  await win.getByRole("button", { name: "更改攻擊的按鍵" }).click();
  await page.keyboard.press("j");
  await expect(win.getByRole("button", { name: "更改攻擊的按鍵" })).toHaveText("更改");
  await expect(page.locator('.legend [data-key="attack"]')).toHaveText("J");
  const binds = await page.evaluate(() => JSON.parse(localStorage.getItem("floating-isle-keys")));
  expect(binds.attack).toEqual(["KeyJ"]);
  await page.reload();
  await expect(page.locator('.legend [data-key="attack"]')).toHaveText("J");
  expect(errors).toEqual([]);
});

test("世界地圖列出新的三張地圖", async ({ page }) => {
  const errors = await openGame(page);
  await page.locator("#game").click();
  await page.keyboard.press("w");
  const world = page.locator("#worldWin");
  for (const name of ["潮汐礁岩", "霧影森林", "古樹深處", "巨鉗蟹王", "霧林古樹精"]) await expect(world).toContainText(name);
  expect(errors).toEqual([]);
});

test("練功速度：Lv.15 練到 Lv.30 不用打超過 250 隻怪", async ({ page }) => {
  await openGame(page);
  // 用遊戲裡的升級公式和怪物經驗值算：Lv.15～17 打刺殼龜、18～24 打霧菇、25～29 打石甲蜥
  const kills = await page.evaluate(() => {
    const was = P.lv;
    let total = 0;
    for (let lv = 15; lv < 30; lv++) {
      P.lv = lv;
      const t = TYPES[lv < 18 ? "shell" : lv < 25 ? "mush" : "lizard"];
      total += Math.ceil(need() / (t.exp * EXP_RATE));
    }
    P.lv = was;
    return total;
  });
  expect(kills).toBeLessThanOrEqual(250);
});

// Lv.30～85 的平衡：tests/balance-sim.js 用遊戲本身的公式，幫四個職業在每個等級配好能力值、裝備和技能來算
// 表格和算法說明在 docs/BALANCE.md；數值調過之後，用 node tools/balance.js 重新產生表格
const openSim = async page => { await openGame(page); await page.addScriptTag({ path: path.join(__dirname, "balance-sim.js") }); };
const spread = o => Math.max(...Object.values(o)) / Math.min(...Object.values(o));

test("練功速度：Lv.30～85 每級不超過 30 隻怪，一隻怪 6 秒內打完，職業差距不到 2.5 倍", async ({ page }) => {
  test.setTimeout(120000);
  await openSim(page);
  const rows = await page.evaluate(() => SIM.levels(30, 85));
  for (const r of rows) {
    expect(r.kills, `Lv.${r.lv} 打幾隻`).toBeLessThanOrEqual(30);
    for (const [line, secs] of Object.entries(r.secs)) expect(secs, `Lv.${r.lv} ${line}`).toBeLessThan(6);
    expect(spread(r.secs), `Lv.${r.lv} 最快和最慢的職業`).toBeLessThan(2.5);
  }
});

test("Boss 平衡：在建議等級不停攻擊要打一段時間，但不會太久，職業差距不到 2.5 倍", async ({ page }) => {
  test.setTimeout(60000);
  await openSim(page);
  const rows = await page.evaluate(() => SIM.bosses());
  // [Boss, 建議等級, 最快的職業至少幾秒, 最慢的職業最多幾秒]；熔心巨像的遠征限時 600 秒，還要留時間躲招
  for (const [boss, lv, min, max] of [["treant", 35, 15, 60], ["eagle", 50, 20, 90], ["scorpking", 75, 20, 120], ["colossus", 80, 60, 300]]) {
    const r = rows.find(r => r.boss === boss && r.lv === lv);
    expect(Math.min(...Object.values(r.secs)), `${boss} Lv.${lv} 最快`).toBeGreaterThan(min);
    expect(Math.max(...Object.values(r.secs)), `${boss} Lv.${lv} 最慢`).toBeLessThan(max);
    expect(spread(r.secs), `${boss} Lv.${lv} 職業差距`).toBeLessThan(2.5);
  }
  // Lv.75 就能進遠征，但遠征隊長卡蘭會建議 Lv.80 左右再來；Lv.80 以後就不提了
  await page.evaluate(() => { P.lv = 75; karanTalk([]); });
  await expect(page.locator("#dlg")).toContainText("Lv.80 左右再來");
  await page.evaluate(() => { P.lv = 80; karanTalk([]); });
  await expect(page.locator("#dlg")).not.toContainText("Lv.80 左右再來");
});

test("金幣：越後面的怪越好賺，沙漠練到 Lv.70 的錢夠買一輪沙漠裝備", async ({ page }) => {
  await openSim(page);
  const r = await page.evaluate(() => ({
    perKill: ["sheep", "sprite", "rhino", "fox", "worm", "cactus", "wisp", "soldier", "scarab"].map(t => SIM.coinsPerKill(t)),
    desert: SIM.coins(55, 70),
    // 一把 Lv.55 武器、一套沙漠套裝和三件沙漠飾品
    gear: ["sand_sword", "desert_hat", "desert_robe", "desert_pants", "desert_boots", "sand_earring", "sand_necklace", "sand_ring"].reduce((s, id) => s + PRICES[id], 0),
  }));
  // 掉寶有運氣成分，所以只要求不要比前一種怪少太多
  r.perKill.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(r.perKill[i] * 0.6));
  expect(r.desert).toBeGreaterThan(r.gear);
});

test("任務鏈：回報霧菇大豐收之後，採菇人會給下一個任務", async ({ page }) => {
  // 從霧影森林開始，鏡頭在地圖左邊，採菇人波波站在 x=200
  const errors = await openWithSave(page, { ...LV30_WARRIOR, lv: 20, map: "forest", quests: { q_mush: { state: "active", kills: { mush: 30 } } } });
  await clickNpc(page, 200);
  const dlg = page.locator("#dlg");
  await expect(dlg.getByRole("button", { name: /孢子的祕密/ })).toHaveCount(0);
  await dlg.getByRole("button", { name: /【完成】霧菇大豐收/ }).click();
  await dlg.getByRole("button", { name: /謝謝/ }).click();
  await clickNpc(page, 200);
  await dlg.getByRole("button", { name: /【任務】孢子的祕密/ }).click();
  await dlg.getByRole("button", { name: /交給我/ }).click();
  const saved = await readSave(page);
  expect(saved.quests.q_mush.state).toBe("done");
  expect(saved.quests.q_spore.state).toBe("active");
  expect(errors).toEqual([]);
});

test("每日任務：今天做完就不能再接，隔天又可以接", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV10_BEGINNER, quests: { q_jelly: { state: "done" }, d_bjelly: { state: "active", kills: { bjelly: 15 } } } });
  await clickNpc(page, 660);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /【完成】藍果凍巡邏/ }).click();
  await dlg.getByRole("button", { name: /謝謝/ }).click();
  const saved = await readSave(page);
  const today = await page.evaluate(() => today());
  expect(saved.quests.d_bjelly).toEqual({ state: "done", day: today });

  // 同一天再去找村長：沒有每日任務可以接
  await clickNpc(page, 660);
  await expect(dlg.getByRole("button", { name: /藍果凍巡邏/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // 把完成日期改成以前，就像過了一天
  await page.evaluate(() => { P.quests.d_bjelly.day = "2000-01-01"; });
  await clickNpc(page, 660);
  await expect(dlg.getByRole("button", { name: /【每日】藍果凍巡邏/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("倒下損失的經驗值隨等級變少，新手不會損失", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV30_WARRIOR, exp: 1000 });
  await page.evaluate(() => { P.inv = 0; hurt(999999, 0); });
  // Lv.30：10% - (30 - 10) × 0.25% = 5%
  expect((await readSave(page)).exp).toBe(950);
  await page.evaluate(() => { Object.assign(P, { dead: false, hp: 50, job: "beginner", exp: 1000, inv: 0 }); hurt(999999, 0); });
  expect((await readSave(page)).exp).toBe(1000);
  expect(errors).toEqual([]);
});

test("怪物掉的裝備能力會小幅浮動，不會超過一成", async ({ page }) => {
  await openGame(page);
  // 狂嵐巨劍攻擊 52：每次浮動在 -5～+5 之間，擲 300 次應該有好運也有壞運
  const rolls = await page.evaluate(() => Array.from({ length: 300 }, () => rollGear("storm_blade").vary?.watk || 0));
  expect(Math.min(...rolls)).toBeGreaterThanOrEqual(-5);
  expect(Math.max(...rolls)).toBeLessThanOrEqual(5);
  expect(rolls.some(v => v > 0) && rolls.some(v => v < 0)).toBe(true);
});

test("套裝：穿上霧林套裝 3 件，多出 2 件和 3 件的加成", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV30_WARRIOR, bag: { equip: [], use: [], etc: [] },
    eq: { weapon: { id: "wood_sword", n: 1 }, hat: { id: "fog_hood", n: 1 }, top: { id: "lizard_mail", n: 1 }, bottom: { id: "lizard_greaves", n: 1 } },
  });
  // 防禦 14 + 20 + 15，再加 2 件的 5；攻擊是木劍 17 加 3 件的 3
  expect(await page.evaluate(() => [gear("def"), gear("watk")])).toEqual([54, 20]);
  await page.locator("#game").click();
  await page.keyboard.press("e");
  await expect(page.locator("#equipWin")).toContainText("霧林套裝 3 / 4 件");
  expect(errors).toEqual([]);
});

test("倉庫：存進去的東西重新整理後還在，也拿得回來", async ({ page }) => {
  const errors = await openGame(page);
  await clickNpc(page, 790);
  await page.locator("#dlg").getByRole("button", { name: /打開倉庫/ }).click();
  const win = page.locator("#shopWin");
  await win.getByRole("tab", { name: "消耗" }).click();
  await win.getByRole("button", { name: "全部存入紅藥水" }).click();
  let saved = await readSave(page);
  expect(saved.storage.filter(Boolean)).toEqual([{ id: "red_pot", n: 5 }]);
  expect(itemCount(saved, "red_pot")).toBe(0);

  await page.reload();
  await clickNpc(page, 790);
  await page.locator("#dlg").getByRole("button", { name: /打開倉庫/ }).click();
  await win.getByRole("tab", { name: "取出" }).click();
  await win.getByRole("button", { name: "全部取出紅藥水" }).click();
  saved = await readSave(page);
  expect(itemCount(saved, "red_pot")).toBe(5);
  expect(saved.storage.filter(Boolean)).toEqual([]);
  expect(errors).toEqual([]);
});

test("防爆卷軸擋住一次失敗，回復卷軸補回失敗的次數", async ({ page }) => {
  // 先讓亂數固定成 0.99：一般卷軸一定失敗
  await page.addInitScript(() => { Math.random = () => 0.99; });
  const errors = await openWithSave(page, {
    ...LV10_BEGINNER, eq: { weapon: { id: "iron_blade", n: 1, left: 5 } },
    bag: { equip: [], use: [{ id: "guard_scroll", n: 1 }, { id: "scroll_wpn60", n: 2 }, { id: "restore_scroll", n: 1 }], etc: [] },
  });
  await page.locator("#game").click();
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("tab", { name: "消耗" }).click();
  const useOn = async (scroll, target) => {
    await inv.getByRole("button", { name: scroll }).click();
    await inv.getByRole("button", { name: "使用" }).click();
    await inv.getByRole("button", { name: target }).click();
  };
  await useOn(/防爆卷軸/, /精鐵長劍（身上）/);
  await useOn(/武器攻擊卷軸/, /精鐵長劍（身上）/);
  // 有防爆卷軸：失敗也不扣，而且防爆卷軸用掉了
  expect((await readSave(page)).eq.weapon).toEqual({ id: "iron_blade", n: 1, left: 5 });
  await useOn(/武器攻擊卷軸/, /精鐵長劍（身上）/);
  expect((await readSave(page)).eq.weapon.left).toBe(4);

  // 換成一定成功：回復卷軸把一次失敗的次數補回來
  await page.evaluate(() => { Math.random = () => 0; });
  await useOn(/回復卷軸/, /精鐵長劍（身上）/);
  expect((await readSave(page)).eq.weapon.left).toBe(5);
  expect(errors).toEqual([]);
});

test("搭飛船往返浮島村和雲頂城，每趟付 1000 金幣", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV30_WARRIOR, coins: 5000 });
  // 船長在浮島村 x=1220：把角色放到碼頭，鏡頭會停在地圖右邊（cam.x=440），船長在畫面 x=780
  await page.evaluate(() => loadMap("village", 1180));
  await clickNpc(page, 780);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /搭飛船去雲頂城/ }).click();
  let saved = await readSave(page);
  expect(saved.map).toBe("cloudtown");
  expect(saved.coins).toBe(4000);
  // 雲頂城的船長站在 x=160
  await clickNpc(page, 160);
  await dlg.getByRole("button", { name: /搭飛船去浮島村/ }).click();
  saved = await readSave(page);
  expect(saved.map).toBe("village");
  expect(saved.coins).toBe(3000);
  expect(errors).toEqual([]);
});

test("在雲頂的狩獵場讀回村卷軸，會回到雲頂城", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV30_WARRIOR, map: "cloudwalk", bag: { equip: [], use: [{ id: "town_scroll", n: 1 }], etc: [] }, eq: { weapon: { id: "wood_sword", n: 1 } },
  });
  await page.locator("#game").click();
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("tab", { name: "消耗" }).click();
  await inv.getByRole("button", { name: "回村卷軸" }).click();
  await inv.getByRole("button", { name: "使用" }).click();
  expect((await readSave(page)).map).toBe("cloudtown");
  expect(errors).toEqual([]);
});

test("紅藥水鍵會先喝白藥水", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV30_WARRIOR, hp: 300, bag: { equip: [], use: [{ id: "red_pot", n: 5 }, { id: "white_pot", n: 1 }], etc: [] }, eq: { weapon: { id: "wood_sword", n: 1 } },
  });
  await page.locator("#game").click();
  // 按鍵要等遊戲跑到下一個畫面才會處理
  await page.keyboard.press("1");
  await page.waitForTimeout(200);
  const saved = await readSave(page);
  expect(itemCount(saved, "white_pot")).toBe(0);
  expect(itemCount(saved, "red_pot")).toBe(5);
  expect(saved.hp).toBeGreaterThanOrEqual(600);
  expect(errors).toEqual([]);
});

test("雲守衛給任務，世界地圖分成浮島、雲頂和沉砂", async ({ page }) => {
  // 雲頂城的出生點在 x=200，鏡頭在地圖左邊，雲守衛雷恩站在 x=620
  const errors = await openWithSave(page, { ...LV30_WARRIOR, map: "cloudtown" });
  await clickNpc(page, 620);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /【任務】雲海上的羊群/ }).click();
  await dlg.getByRole("button", { name: /交給我/ }).click();
  expect((await readSave(page)).quests.q_sheep.state).toBe("active");
  await page.keyboard.press("Escape");
  await page.keyboard.press("w");
  const world = page.locator("#worldWin");
  await expect(world.locator(".qhead")).toHaveText(["浮島", "雲頂", "沉砂"]);
  await expect(world).toContainText("雷雲巨鷲 Lv.50");
  expect(errors).toEqual([]);
});

const LV50_BERSERKER = {
  ...LV30_WARRIOR, lv: 50, job: "berserker", str: 220, mhp: 3000, mmp: 400, hp: 3000, mp: 400, map: "cloudtown",
  skills: { ...LV30_WARRIOR.skills, k_crush: 20, k_quake: 20, k_rage: 10, k_mastery: 10 },
};

test("三轉：接影之試煉會進試煉場，打倒影子後回報就能三轉", async ({ page }) => {
  // 雲頂城的鏡頭在地圖左邊，賢者奧菈站在 x=780
  const errors = await openWithSave(page, LV50_BERSERKER);
  await clickNpc(page, 780);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /【任務】影之試煉/ }).click();
  await dlg.getByRole("button", { name: /交給我/ }).click();
  let saved = await readSave(page);
  expect(saved.map).toBe("trial");
  expect(await page.evaluate(() => mobs.map(m => m.T.name))).toEqual(["影子分身"]);

  // 假裝已經打倒影子，回雲頂城回報
  await page.evaluate(() => { P.quests.q_trial.kills.shadow = 1; loadMap("cloudtown"); });
  await clickNpc(page, 780);
  await dlg.getByRole("button", { name: /【完成】影之試煉/ }).click();
  await dlg.getByRole("button", { name: /謝謝/ }).click();
  await clickNpc(page, 780);
  await dlg.getByRole("button", { name: /我想三轉/ }).click();
  await dlg.getByRole("button", { name: /我要成為破陣劍豪/ }).click();
  await dlg.getByRole("button", { name: /好/ }).click();
  saved = await readSave(page);
  expect(saved.job).toBe("swordsaint");
  await page.keyboard.press("k");
  await expect(page.locator("#skillsWin")).toContainText("破陣劍豪技能");
  expect(errors).toEqual([]);
});

test("還沒二轉的 Lv.50 角色接不到影之試煉", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV50_BERSERKER, job: "warrior" });
  await clickNpc(page, 780);
  await expect(page.locator("#dlg")).toBeVisible();
  await expect(page.locator("#dlg").getByRole("button", { name: /影之試煉/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("技能視窗可以把技能放到第 7 個鍵，按 B 就放得出來", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV50_BERSERKER, job: "swordsaint", mp: 400, skills: { ...LV50_BERSERKER.skills, s_storm: 5 },
  });
  await page.locator("#game").click();
  await page.keyboard.press("k");
  await page.locator("#skillsWin").getByRole("combobox", { name: "千刃風暴放在哪個鍵" }).selectOption("6");
  let saved = await readSave(page);
  expect(saved.slots[6]).toBe("s_storm");
  await page.keyboard.press("Escape");
  await page.keyboard.down("b"); await page.waitForTimeout(200); await page.keyboard.up("b");
  saved = await readSave(page);
  expect(saved.mp).toBeLessThan(400);
  expect(errors).toEqual([]);
});

test("設定：音量、傷害數字、畫面震動，重新整理後還在", async ({ page }) => {
  const errors = await openGame(page);
  await page.locator("#openSettings").click();
  const win = page.locator("#setWin");
  await win.getByRole("slider", { name: "音樂音量" }).fill("0");
  await win.getByRole("checkbox", { name: "顯示傷害數字" }).uncheck();
  await win.getByRole("combobox", { name: "畫面震動" }).selectOption("0");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("floating-isle-settings")))).toEqual({ sfx: 70, music: 0, nums: false, shake: 0, minimap: 1, petItems: true });
  await page.reload();
  await page.locator("#openSettings").click();
  await expect(win.getByRole("checkbox", { name: "顯示傷害數字" })).not.toBeChecked();
  await expect(win.getByRole("slider", { name: "音樂音量" })).toHaveValue("0");
  expect(errors).toEqual([]);
});

test("存檔欄位：切到空的存檔 2 是新角色，切回存檔 1 還是原本的角色", async ({ page }) => {
  const errors = await openWithSave(page, LV10_BEGINNER);
  await page.locator("#openSettings").click();
  const win = page.locator("#setWin");
  await expect(win).toContainText("Lv.10 新手");
  await win.getByRole("button", { name: "切換到存檔 2" }).click();
  // 空的欄位會先出現建立角色畫面
  await expect(page.locator("#createWin")).toBeVisible();
  await finishCreate(page);
  expect(await page.evaluate(() => [P.lv, saveSlot])).toEqual([1, 2]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("floating-isle-v1-2")).lv)).toBe(1);
  await win.getByRole("button", { name: "切換到存檔 1" }).click();
  expect(await page.evaluate(() => [P.lv, saveSlot])).toEqual([10, 1]);
  expect(errors).toEqual([]);
});

test("匯出存檔再匯入到另一個欄位，角色一模一樣", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV30_WARRIOR, coins: 4321 });
  await page.locator("#openSettings").click();
  const win = page.locator("#setWin");
  await win.getByRole("button", { name: "匯出目前存檔" }).click();
  const text = await win.getByRole("textbox", { name: "存檔文字" }).inputValue();
  expect(text.startsWith("FI1:")).toBe(true);
  await win.getByRole("button", { name: "切換到存檔 3" }).click();
  await finishCreate(page);
  await win.getByRole("textbox", { name: "存檔文字" }).fill(text);
  await win.getByRole("button", { name: "匯入到目前存檔" }).click();
  expect(await page.evaluate(() => [P.lv, P.job, P.coins, saveSlot])).toEqual([30, "warrior", 4321, 3]);
  // 亂貼的文字不會蓋掉角色
  await win.getByRole("textbox", { name: "存檔文字" }).fill("不是存檔");
  await win.getByRole("button", { name: "匯入到目前存檔" }).click();
  expect(await page.evaluate(() => P.lv)).toBe(30);
  expect(errors).toEqual([]);
});

test("點一下畫面就會開始有聲音，在文字框打字不會觸發遊戲按鍵", async ({ page }) => {
  const errors = await openGame(page);
  await page.locator("#game").click();
  expect(await page.evaluate(() => { sfx("levelup"); musicTick(); return actx?.state; })).toBe("running");
  await page.locator("#openSettings").click();
  await page.locator("#saveText").click();
  await page.keyboard.type("iek");
  await expect(page.locator("#invWin")).toBeHidden();
  await expect(page.locator("#saveText")).toHaveValue("iek");
  expect(errors).toEqual([]);
});

// 寵物飼育員露露站在浮島村 x=1090
const PET_SAVE = { ...LV10_BEGINNER, map: "village", pets: { bun: { full: 100, close: 0 } }, petOn: "bun" };

test("跟寵物飼育員買寵物，寵物會跟出來，還送 5 個飼料", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV10_BEGINNER, coins: 5000 });
  await page.locator("#game").click();
  await page.evaluate(() => openNpc(NPCS.lulu));
  await page.locator("#dlg").getByRole("button", { name: /買下圓圓雞/ }).click();
  const saved = await readSave(page);
  expect(saved.pets).toEqual({ chick: { full: 100, close: 0 } });
  expect(saved.petOn).toBe("chick");
  expect(saved.coins).toBe(2000);
  expect(itemCount(saved, "pet_food")).toBe(5);
  expect(errors).toEqual([]);
});

test("寵物會自動撿附近的金幣，肚子餓了就不撿", async ({ page }) => {
  const errors = await openWithSave(page, PET_SAVE);
  await page.locator("#game").click();
  await page.evaluate(() => { for (let i = 0; i < 3; i++) addDrop("coin", P.x + 60 + i * 30, 800, 10); });
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => [P.coins, drops.length])).toEqual([30, 0]);
  // 飽足度低於 20 就不幫忙撿
  await page.evaluate(() => { P.pets.bun.full = 10; addDrop("coin", P.x + 60, 800, 10); });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => [P.coins, drops.length])).toEqual([30, 1]);
  expect(errors).toEqual([]);
});

test("在背包對寵物飼料點兩下會餵寵物，餓的時候餵親密度會上升", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...PET_SAVE, pets: { bun: { full: 40, close: 0 } },
    bag: { equip: [], use: [{ id: "pet_food", n: 3 }], etc: [] },
  });
  await page.locator("#game").click();
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("tab", { name: "消耗" }).click();
  await inv.getByRole("button", { name: "寵物飼料" }).dblclick();
  const saved = await readSave(page);
  expect(saved.pets.bun).toEqual({ full: 70, close: 3 });
  expect(itemCount(saved, "pet_food")).toBe(2);
  expect(errors).toEqual([]);
});

test("按 M 切換小地圖：小、大、關閉，重新整理後還記得", async ({ page }) => {
  const errors = await openGame(page);
  await page.locator("#game").click();
  expect(await playerDotX(page)).not.toBeNull();
  await page.keyboard.press("m");
  expect(await page.evaluate(() => settings.minimap)).toBe(2);
  await page.keyboard.press("m");
  await page.waitForTimeout(100);
  expect(await playerDotX(page)).toBeNull();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("floating-isle-settings")).minimap)).toBe(0);
  await page.locator("#openSettings").click();
  await expect(page.locator("#setWin").getByRole("combobox", { name: "小地圖" })).toHaveValue("0");
  expect(errors).toEqual([]);
});

// 沙漠大陸用 Lv.70 的破陣劍豪；固定亂數讓攻擊、閃避的結果每次都一樣
const LV70_SAINT = {
  ...LV50_BERSERKER, lv: 70, job: "swordsaint", str: 300, mhp: 6000, mmp: 1500, hp: 6000, mp: 1500, coins: 5000,
  bag: { equip: [], use: [{ id: "town_scroll", n: 1 }], etc: [] }, eq: { weapon: { id: "sand_sword", n: 1 } },
};
const fixRandom = page => page.addInitScript(() => { Math.random = () => 0.99; });

test("從雲頂城搭飛船到沉砂城，狩獵場的回村卷軸回到沉砂城，世界地圖多了沉砂", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV70_SAINT, map: "cloudtown" });
  await clickNpc(page, 160);
  await page.locator("#dlg").getByRole("button", { name: /搭飛船去沉砂城/ }).click();
  let saved = await readSave(page);
  expect([saved.map, saved.coins]).toEqual(["sandcity", 4000]);
  // 守衛隊長哈山有新任務
  await page.evaluate(() => openNpc(NPCS.hasan));
  await expect(page.locator("#dlg").getByRole("button", { name: /沙丘上的狐群/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => loadMap("dunes"));
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("tab", { name: "消耗" }).click();
  await inv.getByRole("button", { name: "回村卷軸" }).dblclick();
  expect((await readSave(page)).map).toBe("sandcity");
  await page.keyboard.press("w");
  for (const name of ["沉砂", "沙丘地帶", "仙人掌谷", "地下古墓", "流沙神殿"]) await expect(page.locator("#worldWin")).toContainText(name);
  expect(errors).toEqual([]);
});

test("鑽沙蚯躲在沙裡時打不到，會鑽到腳下冒出來咬人", async ({ page }) => {
  await fixRandom(page);
  const errors = await openWithSave(page, { ...LV70_SAINT, map: "dunes" });
  await page.locator("#game").click();
  // 只留一隻鑽進沙裡的鑽沙蚯，放在角色右邊 120 px
  const start = await page.evaluate(() => {
    loadMap("dunes", 600); mobs.length = 0;
    const m = spawnMob("worm", plats[0], 0, 2400, 720); m.minion = false; m.alpha = 1; m.under = true; m.bt = 2;
    P.inv = 0;
    return { hidden: targetsIn({ x: 0, y: 0, w: 2400, h: 924 }, 10).length, x: m.x };
  });
  expect(start.hidden).toBe(0);
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({ under: mobs[0].under, dx: Math.abs(mobs[0].x + mobs[0].w / 2 - (P.x + P.w / 2)), hp: P.hp, hit: targetsIn({ x: 0, y: 0, w: 2400, h: 924 }, 10).length }));
  expect(after.under).toBe(false);
  expect(after.dx).toBeLessThan(60);
  expect(after.hp).toBeLessThan(6000);
  expect(after.hit).toBe(1);
  expect(errors).toEqual([]);
});

test("仙人掌怪會從遠處丟刺過來", async ({ page }) => {
  await fixRandom(page);
  const errors = await openWithSave(page, { ...LV70_SAINT, map: "valley" });
  await page.locator("#game").click();
  await page.evaluate(() => {
    loadMap("valley", 300); mobs.length = 0;
    const m = spawnMob("cactus", plats[0], 0, 2400, 560); m.minion = false; m.alpha = 1;
    P.inv = 0;
  });
  await page.waitForTimeout(4500);
  const r = await page.evaluate(() => ({ hp: P.hp, x: mobs[0].x + mobs[0].w / 2 - (P.x + P.w / 2) }));
  expect(r.hp).toBeLessThan(6000);
  // 牠站在遠處丟，不會走到角色身上
  expect(Math.abs(r.x)).toBeGreaterThan(120);
  expect(errors).toEqual([]);
});

test("沙暴蠍皇會召喚小沙蠍，血量剩一半會發怒，打倒後小沙蠍也一起消失", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV70_SAINT, map: "temple" });
  await page.locator("#game").click();
  await page.evaluate(() => {
    loadMap("temple", 1000, 440); P.inv = 999;
    const k = mobs.find(m => m.t === "scorpking"); k.aggro = 5; k.scd = 0.1;
  });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => mobs.filter(m => m.t === "scorpling" && !m.dead).length)).toBe(2);
  await page.evaluate(() => { const k = mobs.find(m => m.t === "scorpking"); k.hp = k.T.hp * 0.4; });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => mobs.find(m => m.t === "scorpking").raged)).toBe(true);
  await expect.poll(() => page.evaluate(() => msgs.some(m => m.text.includes("沙暴蠍皇發怒了")))).toBe(true);
  await page.evaluate(() => kill(mobs.find(m => m.t === "scorpking")));
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => mobs.filter(m => m.t === "scorpling").length)).toBe(0);
  expect(await page.evaluate(() => drops.some(d => d.id === "scorp_stinger"))).toBe(true);
  expect(errors).toEqual([]);
});

test("地下古墓很暗，只有角色附近看得清楚", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV70_SAINT, map: "dunes" });
  await page.locator("#game").click();
  // 畫面左上方天空的平均亮度：沙丘很亮，古墓幾乎全黑
  const brightness = () => page.evaluate(() => {
    const cv = document.getElementById("game"), s = cv.width / 960;
    const px = cv.getContext("2d").getImageData(Math.floor(200 * s), Math.floor(120 * s), Math.ceil(200 * s), Math.ceil(80 * s)).data;
    let sum = 0; for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 3;
    return sum / (px.length / 4);
  });
  await page.evaluate(() => { loadMap("dunes", 1200); mobs.length = 0; });
  await page.waitForTimeout(600);
  expect(await brightness()).toBeGreaterThan(150);
  await page.evaluate(() => { loadMap("tomb", 1200); mobs.length = 0; });
  await page.waitForTimeout(600);
  expect(await brightness()).toBeLessThan(30);
  expect(errors).toEqual([]);
});

// 四轉用 Lv.70 的破陣劍豪，帶著兩件信物需要的材料
const LV70_SWORDSAINT = {
  ...LV70_SAINT, map: "sandcity", sp: 0,
  skills: { ...LV50_BERSERKER.skills, s_storm: 20, s_break: 20, s_soul: 20, s_instinct: 20 },
  bag: { equip: [], use: [], etc: [{ id: "scorp_stinger", n: 1 }, { id: "clay_shard", n: 40 }, { id: "wisp_ash", n: 40 }] },
};
const LV75_SWORDKING = {
  ...LV70_SWORDSAINT, lv: 75, job: "swordking", sp: 5, mp: 1500,
  skills: { ...LV70_SWORDSAINT.skills, k4_rift: 20, k4_judgment: 1 }, slots: ["k4_rift", "k4_judgment"],
};

test("四轉：交兩件信物、打倒真影分身，就能成為裂空劍帝，二轉技能還在", async ({ page }) => {
  const errors = await openWithSave(page, LV70_SWORDSAINT);
  await page.locator("#game").click();
  // 兩件信物任務：材料已經帶在身上，接了就能回報
  await page.evaluate(() => { for (const id of ["q_relic1", "q_relic2"]) { acceptQuest(QUESTS[id]); finishQuest(QUESTS[id]); } closeDialog(); });
  let saved = await readSave(page);
  expect([itemCount(saved, "sand_sigil"), itemCount(saved, "tomb_sigil"), itemCount(saved, "scorp_stinger")]).toEqual([1, 1, 0]);
  // 接王者試煉會進試煉場，裡面是真影分身
  await page.evaluate(() => openNpc(NPCS.isa));
  await page.locator("#dlg").getByRole("button", { name: /王者試煉/ }).click();
  await page.locator("#dlg").getByRole("button").first().click();
  expect(await page.evaluate(() => [P.map, mobs[0].t])).toEqual(["trial4", "shadow2"]);
  await page.evaluate(() => { P.quests.q_trial4.kills.shadow2 = 1; loadMap("sandcity"); openNpc(NPCS.isa); });
  await page.locator("#dlg").getByRole("button", { name: /【完成】王者試煉/ }).click();
  await page.evaluate(() => openNpc(NPCS.isa));
  await page.locator("#dlg").getByRole("button", { name: "我想四轉" }).click();
  await page.locator("#dlg").getByRole("button", { name: "我要成為裂空劍帝" }).click();
  saved = await readSave(page);
  expect(saved.job).toBe("swordking");
  expect([itemCount(saved, "sand_sigil"), itemCount(saved, "tomb_sigil")]).toEqual([0, 0]);
  await page.keyboard.press("Escape");
  await page.keyboard.press("k");
  for (const name of ["劍士技能", "狂刃騎士技能", "破陣劍豪技能", "裂空劍帝技能"]) await expect(page.locator("#skillsWin")).toContainText(name);
  expect(errors).toEqual([]);
});

test("天劍審判有 60 秒冷卻：冷卻中再按不會放，狀態列看得到", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV75_SWORDKING, map: "temple" });
  await page.locator("#game").click();
  await page.keyboard.down("d"); await page.waitForTimeout(200); await page.keyboard.up("d");
  const after1 = await page.evaluate(() => [P.mp, Math.round(P.cds.k4_judgment)]);
  expect(after1[0]).toBeLessThan(1500);
  expect(after1[1]).toBeGreaterThan(55);
  await page.waitForTimeout(800);
  await page.keyboard.down("d"); await page.waitForTimeout(200); await page.keyboard.up("d");
  expect(await page.evaluate(() => P.mp)).toBe(after1[0]);
  await expect.poll(() => page.evaluate(() => msgs.some(m => m.text.includes("秒才能再用")))).toBe(true);
  expect(errors).toEqual([]);
});

test("四轉技能先到 Lv.20，讀了技能書才能升到 Lv.30；別的職業的書看不懂", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV75_SWORDKING, bag: { equip: [], use: [{ id: "book_q4_nova", n: 1 }, { id: "book_k4_rift", n: 1 }], etc: [] } });
  await page.locator("#game").click();
  await page.keyboard.press("k");
  const plus = page.locator("#skillsWin").getByRole("button", { name: "裂空斬加 1" });
  await expect(plus).toBeDisabled();
  await expect(page.locator("#skillsWin")).toContainText("讀「裂空斬技能書」才能升到 Lv.30");
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("tab", { name: "消耗" }).click();
  await inv.getByRole("button", { name: "星爆技能書" }).dblclick();
  await inv.getByRole("button", { name: "裂空斬技能書" }).dblclick();
  let saved = await readSave(page);
  expect(saved.books).toEqual(["k4_rift"]);
  expect([itemCount(saved, "book_q4_nova"), itemCount(saved, "book_k4_rift")]).toEqual([1, 0]);
  await plus.click();
  saved = await readSave(page);
  expect(saved.skills.k4_rift).toBe(21);
  expect(errors).toEqual([]);
});

// 遠征用 Lv.80 的裂空劍帝，帶三張入場證；遠征隊長卡蘭站在沉砂城 x=960
const LV80_RAIDER = {
  ...LV75_SWORDKING, lv: 80, mhp: 10000, hp: 10000, map: "sandcity",
  bag: { equip: [{ id: "magma_ring", n: 1 }], use: [], etc: [{ id: "magma_pass", n: 3 }] },
};
const enterRaid = async page => {
  await page.evaluate(() => openNpc(NPCS.karan));
  await page.locator("#dlg").getByRole("button", { name: "進入熔心祭壇" }).click();
};

test("遠征：交入場證才能進，每天 2 次；時間到或倒下都不扣經驗", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV80_RAIDER, exp: 1000 });
  await page.locator("#game").click();
  await enterRaid(page);
  let saved = await readSave(page);
  expect([itemCount(saved, "magma_pass"), saved.raid.used]).toEqual([2, 1]);
  expect(await page.evaluate(() => [P.map, !!raid])).toEqual(["magma", true]);
  // 時間到：回到沉砂城，經驗不變
  await page.evaluate(() => { raid.t = 0.05; });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => [P.map, P.exp])).toEqual(["sandcity", 1000]);
  // 第二次：在祭壇裡倒下也不扣經驗
  await enterRaid(page);
  await page.evaluate(() => { P.inv = 0; hurt(999999, P.x + 1); });
  expect(await page.evaluate(() => [P.dead, P.exp])).toEqual([true, 1000]);
  await page.evaluate(() => revive());
  // 第三次：今天的次數用完了
  await enterRaid(page);
  await expect(page.locator("#dlg")).toContainText("次數已經用完");
  saved = await readSave(page);
  expect([saved.map, itemCount(saved, "magma_pass"), saved.raid.used]).toEqual(["sandcity", 1, 2]);
  expect(errors).toEqual([]);
});

test("熔心巨像：兩隻手臂都打斷前，本體打不到", async ({ page }) => {
  const errors = await openWithSave(page, LV80_RAIDER);
  await page.locator("#game").click();
  await enterRaid(page);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => [raidArms().length, hittable(raidBody())])).toEqual([2, false]);
  await page.evaluate(() => kill(raidArms()[0]));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => hittable(raidBody()))).toBe(false);
  await page.evaluate(() => kill(raidArms()[0]));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => [raidArms().length, hittable(raidBody())])).toEqual([0, true]);
  expect(errors).toEqual([]);
});

test("熔心巨像換階段：手臂長回來；熔岩淹地前有警告，站在地上會受傷、平台上不會", async ({ page }) => {
  const errors = await openWithSave(page, LV80_RAIDER);
  await page.locator("#game").click();
  await enterRaid(page);
  await page.evaluate(() => { raidArms().forEach(a => kill(a)); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const b = raidBody(); b.hp = b.T.hp * 0.6; });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => [raid.phase, raidArms().length])).toEqual([2, 2]);
  // 站在平台上：熔岩淹地打不到
  const onPlatform = () => page.evaluate(() => {
    const p = plats[5]; Object.assign(P, { x: p.x + 50, y: p.y - P.h, vx: 0, vy: 0, onGround: true, ground: p, inv: 0, hp: 10000 });
    raid.rainT = 99; raid.bigT = 99; raid.warn = { kind: "flood", t: 0.3 };
  });
  await onPlatform();
  await page.waitForTimeout(150);
  await expect(page.locator("#game")).toBeVisible();
  expect(await page.evaluate(() => raid.warn?.kind)).toBe("flood");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => P.hp)).toBe(10000);
  // 站在地上：被淹到
  await page.evaluate(() => {
    Object.assign(P, { x: 160, y: 840 - P.h, vx: 0, vy: 0, onGround: true, ground: plats[0], inv: 0, hp: 10000 });
    raid.warn = { kind: "flood", t: 0.3 };
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => P.hp)).toBeLessThan(10000);
  await page.evaluate(() => { const b = raidBody(); b.hp = b.T.hp * 0.3; });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => raid.phase)).toBe(3);
  expect(errors).toEqual([]);
});

test("耳環、項鍊、戒指三個新欄位；在熔心祭壇存檔會回到沉砂城", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV80_RAIDER, map: "magma" });
  await page.locator("#game").click();
  expect(await page.evaluate(() => P.map)).toBe("sandcity");
  await page.keyboard.press("i");
  await page.locator("#invWin").getByRole("button", { name: "熔心戒指" }).dblclick();
  const saved = await readSave(page);
  expect(saved.eq.ring.id).toBe("magma_ring");
  await page.keyboard.press("e");
  const eq = page.locator("#equipWin");
  for (const name of ["耳環", "項鍊", "戒指"]) await expect(eq).toContainText(name);
  await expect(eq).toContainText("魔力 +5");
  expect(errors).toEqual([]);
});

test("怪物卡片直接收進圖鑑；集滿 5 張點亮一頁，點亮 4 頁全能力值 +1", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV10_BEGINNER, map: "meadow", cards: { jelly: 5, bjelly: 5, shell: 5, boss: 4 } });
  await page.locator("#game").click();
  const before = await page.evaluate(() => [stat("str"), stat("luk"), P.bag.etc.filter(Boolean).length]);
  await page.evaluate(() => { addDrop("item", P.x + P.w / 2, P.y + P.h, 1, "card_boss"); });
  await page.waitForTimeout(600);
  await page.keyboard.down("z"); await page.waitForTimeout(200); await page.keyboard.up("z");
  const after = await page.evaluate(() => [stat("str"), stat("luk"), P.bag.etc.filter(Boolean).length, P.cards.boss]);
  expect(after).toEqual([before[0] + 1, before[1] + 1, before[2], 5]);
  await page.keyboard.press("j");
  await expect(page.locator("#collectWin")).toContainText("點亮 4 /");
  await expect(page.locator("#collectWin .card.lit")).toHaveCount(4);
  expect((await readSave(page)).cards.boss).toBe(5);
  expect(errors).toEqual([]);
});

test("跳跳挑戰：掉到地上從頭開始；到終點第一次送椅子，同一天再完成沒有獎勵", async ({ page }) => {
  const errors = await openWithSave(page, LV10_BEGINNER);
  // 跳跳教練小飛站在浮島村 x=36
  await clickNpc(page, 36);
  await page.locator("#dlg").getByRole("button", { name: "挑戰彩虹跳台" }).click();
  expect(await page.evaluate(() => P.map)).toBe("jump1");
  // 掉到地上：回到起點
  await page.evaluate(() => Object.assign(P, { x: 600, y: 700, vy: 0 }));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => P.x)).toBeLessThan(120);
  const toGoal = () => page.evaluate(() => { const g = plats[map.goal + 1]; Object.assign(P, { x: g.x + 20, y: g.y - P.h - 2, vy: 0 }); });
  await toGoal();
  await page.waitForTimeout(500);
  let saved = await readSave(page);
  expect([saved.map, itemCount(saved, "chair_stool"), saved.coins]).toEqual(["village", 1, 3000]);
  await page.evaluate(() => enterJump("jump1"));
  await toGoal();
  await page.waitForTimeout(500);
  saved = await readSave(page);
  expect([saved.map, itemCount(saved, "chair_stool"), saved.coins]).toEqual(["village", 1, 3000]);
  expect(errors).toEqual([]);
});

test("轉職會解鎖稱號；戴上的稱號有加成，存檔會記住", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV30_WARRIOR, job: "berserker" });
  await page.locator("#game").click();
  await page.waitForTimeout(1300);
  expect(await page.evaluate(() => P.titles)).toEqual(expect.arrayContaining(["first", "second"]));
  await page.keyboard.press("j");
  const win = page.locator("#collectWin");
  await win.getByRole("tab", { name: "稱號" }).click();
  await win.getByRole("button", { name: "戴上嶄露頭角" }).click();
  expect((await readSave(page)).title).toBe("second");
  // 四轉的稱號有全能力值 +2：解鎖後戴上，力量多 2
  const str = await page.evaluate(() => stat("str"));
  await page.evaluate(() => { P.titles.push("fourth"); wearTitle("fourth"); });
  expect(await page.evaluate(() => stat("str"))).toBe(str + 2);
  expect(errors).toEqual([]);
});

test("坐在椅子上回復變快，按方向鍵就站起來", async ({ page }) => {
  const errors = await openWithSave(page, { ...LV30_WARRIOR, hp: 100, mp: 10, bag: { equip: [], use: [], etc: [{ id: "chair_stool", n: 1 }] } });
  await page.locator("#game").click();
  await page.keyboard.press("i");
  const inv = page.locator("#invWin");
  await inv.getByRole("tab", { name: "其他" }).click();
  await inv.getByRole("button", { name: "木頭小板凳" }).dblclick();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => P.sit)).toBe("chair_stool");
  await page.evaluate(() => { P.regen = 2.4; });
  await page.waitForTimeout(300);
  // Lv.30 劍士站著每次回 9 HP；坐在板凳上是 9×3+30
  expect(await page.evaluate(() => P.hp)).toBeGreaterThanOrEqual(100 + 9 * 3 + 30);
  await page.keyboard.down("ArrowRight"); await page.waitForTimeout(150); await page.keyboard.up("ArrowRight");
  expect(await page.evaluate(() => P.sit)).toBe(null);
  expect(errors).toEqual([]);
});

test("建立角色：名字太短會提醒，可以隨機外觀，建立後名字會存檔", async ({ page }) => {
  const errors = await openGame(page, { keepCreate: true });
  const win = page.locator("#createWin");
  await expect(win).toBeVisible();
  // 建立畫面開著時，遊戲按鍵沒有作用
  await page.locator("#createWin h2").click();
  await page.keyboard.press("i");
  await expect(page.locator("#invWin")).toBeHidden();
  // 隨機會換掉外觀
  const before = await page.evaluate(() => JSON.stringify(draft));
  for (let i = 0; i < 8 && await page.evaluate(() => JSON.stringify(draft)) === before; i++) await win.getByRole("button", { name: "隨機" }).click();
  expect(await page.evaluate(() => JSON.stringify(draft))).not.toBe(before);
  await win.getByRole("textbox", { name: "角色名字" }).fill("A");
  await win.getByRole("button", { name: "開始冒險" }).click();
  await expect(win.locator("#lookErr")).toContainText("2～12 個字");
  await win.getByRole("textbox", { name: "角色名字" }).fill("冒險家阿明");
  await win.getByRole("button", { name: "長髮" }).click();
  await win.getByRole("button", { name: "髮色 4" }).click();
  await win.getByRole("button", { name: "開始冒險" }).click();
  await expect(win).toBeHidden();
  const saved = await readSave(page);
  expect(saved.look).toMatchObject({ name: "冒險家阿明", hair: "long", hairColor: 3 });
  await page.locator("#openSettings").click();
  await expect(page.locator("#setWin")).toContainText("冒險家阿明．Lv.1");
  expect(errors).toEqual([]);
});

test("沒有外觀的舊存檔：先補名字和外觀，等級和背包都不變", async ({ page }) => {
  const errors = await openWithSave(page, LV30_WARRIOR, { keepCreate: true });
  const win = page.locator("#createWin");
  await expect(win).toContainText("以前的存檔還沒有名字和外觀");
  await win.getByRole("textbox", { name: "角色名字" }).fill("老玩家");
  await win.getByRole("textbox", { name: "角色名字" }).press("Enter");
  await expect(win).toBeHidden();
  const saved = await readSave(page);
  expect([saved.look.name, saved.lv, saved.job]).toEqual(["老玩家", 30, "warrior"]);
  expect(errors).toEqual([]);
});

test("美髮店：換髮型和髮色要付金幣，金幣不夠會提醒", async ({ page }) => {
  const look = { name: "測試員", hair: "short", hairColor: 0, skin: 0, eyes: 0 };
  const errors = await openWithSave(page, { ...LV10_BEGINNER, coins: 4000, look });
  // 美髮師卡莉站在浮島村 x=940：把角色放過去，再跟她說話
  await page.evaluate(() => { loadMap("village", 900); openNpc(NPCS.cali); });
  await page.locator("#dlg").getByRole("button", { name: "換髮型或髮色" }).click();
  const win = page.locator("#createWin");
  await win.getByRole("button", { name: "包包頭" }).click();
  await win.getByRole("button", { name: "髮色 5" }).click();
  await win.getByRole("button", { name: "確定（5,000 金幣）" }).click();
  await expect(win.locator("#lookErr")).toContainText("金幣不夠");
  // 只換髮型：3000 金幣
  await win.getByRole("button", { name: "髮色 1" }).click();
  await win.getByRole("button", { name: "確定（3,000 金幣）" }).click();
  await expect(win).toBeHidden();
  const saved = await readSave(page);
  expect([saved.coins, saved.look.hair, saved.look.hairColor, saved.look.name]).toEqual([1000, "bun", 0, "測試員"]);
  expect(errors).toEqual([]);
});

test("製作：材料夠才能做、做完扣材料和金幣、熟練度升級、配方書解鎖、失敗也會用掉材料", async ({ page }) => {
  const bag = { equip: [], use: [{ id: "recipe_grove_ring", n: 1 }], etc: [{ id: "green_gel", n: 9 }, { id: "shell_shard", n: 3 }, { id: "blue_gel", n: 30 }] };
  const errors = await openWithSave(page, { ...LV10_BEGINNER, lv: 25, coins: 20000, bag, eq: { weapon: { id: "wood_sword", n: 1 } }, craft: { lv: 1, exp: 4 } });
  // 工匠葛洛站在浮島村 x=575
  await page.evaluate(() => { loadMap("village", 540); openNpc(NPCS.grol); });
  await page.locator("#dlg").getByRole("button", { name: "我想製作東西" }).click();
  const win = page.locator("#shopWin");
  await expect(win).toContainText("製作熟練度 Lv.1");
  // 回村卷軸要熟練度 Lv.2，古樹戒指要配方書
  await expect(win.getByRole("button", { name: "製作回村卷軸" })).toBeDisabled();
  await expect(win).toContainText("要先讀配方書（霧林古樹精掉落）");
  // 做一次紅藥水：5 個凝膠、60 金幣換 10 瓶，熟練度經驗 4 + 1 升到 Lv.2
  await win.getByRole("button", { name: "製作紅藥水" }).click();
  expect(await page.evaluate(() => [countItem("green_gel"), countItem("red_pot"), P.coins, P.craft.lv, P.craft.exp])).toEqual([4, 10, 19940, 2, 0]);
  await expect(win).toContainText("製作熟練度 Lv.2");
  // 凝膠只剩 4 個不夠再做；回村卷軸熟練度夠了，但刺殼碎片 3 個不夠
  await expect(win.getByRole("button", { name: "製作紅藥水" })).toBeDisabled();
  await expect(win.getByRole("button", { name: "製作回村卷軸" })).toBeDisabled();
  expect(await page.evaluate(() => craftBlock("town_scroll"))).toBe("材料不夠");
  // 讀配方書：學會古樹戒指，接下來卡在熟練度
  await page.evaluate(() => { invTab = "use"; invSel = P.bag.use.findIndex(s => s?.id === "recipe_grove_ring"); doInv("use"); });
  expect(await page.evaluate(() => [P.recipes, countItem("recipe_grove_ring"), craftBlock("grove_ring")])).toEqual([["grove_ring"], 0, "製作熟練度 Lv.5 才能做"]);
  // 有成功率的配方會顯示機率；失敗時材料和金幣照樣用掉，熟練度經驗照拿
  await expect(win).toContainText("成功率 70%");
  await page.evaluate(() => { P.craft = { lv: 4, exp: 0 }; addItem("green_gel", 26); addItem("lizard_scale", 5); Math.random = () => 0.99; craft("gel_ring"); });
  expect(await page.evaluate(() => [countItem("green_gel"), countItem("blue_gel"), countItem("lizard_scale"), P.bag.equip.filter(Boolean).length, P.coins, P.craft.exp]))
    .toEqual([0, 0, 0, 0, 16940, 4]);
  // 配方書是古樹精的掉落物；熟練度和學會的配方會存檔
  expect(await page.evaluate(() => TYPES.treant.drops.some(([id]) => id === "recipe_grove_ring"))).toBe(true);
  const saved = await readSave(page);
  expect([saved.craft, saved.recipes]).toEqual([{ lv: 4, exp: 4 }, ["grove_ring"]]);
  expect(errors).toEqual([]);
});

// 手機設定裡的 defaultBrowserType 不能在分組裡改，拿掉它
const { defaultBrowserType, ...phone } = devices["Pixel 7"];

test.describe("手機", () => {
  test.use(phone);

  test("出現觸控按鈕，按了不會出錯", async ({ page }) => {
    const errors = await openGame(page);
    await expect(page.locator(".pad")).toBeVisible();
    await expect(page.locator(".legend")).toBeHidden();
    await page.locator('[data-act="attack"]').tap();
    await page.locator('[data-act="jump"]').tap();
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });
});
