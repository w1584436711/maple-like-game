// 冒煙測試：確認遊戲打得開、角色能動、會存檔、手機有觸控按鈕
const { test, expect, devices } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const GAME_URL = pathToFileURL(path.join(__dirname, "..", "index.html")).href;

// 擋掉 Google 字型：沒網路時也能測，字型只影響外觀
async function openGame(page) {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.goto(GAME_URL);
  return errors;
}

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
async function openWithSave(page, save) {
  await page.addInitScript(s => localStorage.setItem("floating-isle-v1", JSON.stringify(s)), save);
  return openGame(page);
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

test("雲守衛給任務，世界地圖分成浮島和雲頂", async ({ page }) => {
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
  await expect(world.locator(".qhead")).toHaveText(["浮島", "雲頂"]);
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
