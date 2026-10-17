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
  expect(saved.pots).toEqual({ hp: 5, mp: 3 });
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
