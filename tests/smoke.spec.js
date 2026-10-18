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
// 轉職教官站在 x=168 的地面上；鏡頭一開始在地圖左下角，所以她在畫面 (168, 420～480)
async function clickNpc(page) {
  const box = await page.locator("#game").boundingBox();
  await page.mouse.click(box.x + box.width * 168 / 960, box.y + box.height * 455 / 540);
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

test("弓手射箭會用掉箭矢，用完可以找轉職教官補", async ({ page }) => {
  const errors = await openWithSave(page, {
    ...LV10_BEGINNER, job: "bowman", str: 4, dex: 25,
    bag: { equip: [], use: [{ id: "arrow", n: 2 }], etc: [] },
    eq: { weapon: { id: "hunter_bow", n: 1 } },
  });
  await page.locator("#game").click();
  await page.keyboard.down("x");
  await page.waitForTimeout(1600);
  await page.keyboard.up("x");
  expect(itemCount(await readSave(page), "arrow")).toBe(0);

  await clickNpc(page);
  const dlg = page.locator("#dlg");
  await dlg.getByRole("button", { name: /木箭矢用完了/ }).click();
  await dlg.getByRole("button", { name: /謝謝/ }).click();
  expect(itemCount(await readSave(page), "arrow")).toBe(250);
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
