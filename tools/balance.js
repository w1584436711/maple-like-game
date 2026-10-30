// 平衡模擬：node tools/balance.js
// 用瀏覽器打開遊戲，載入 tests/balance-sim.js，印出 docs/BALANCE.md 用的表格（每級打怪數、每隻怪幾秒、Boss 時間、金幣）
const { chromium } = require("playwright");
const path = require("path"), { pathToFileURL } = require("url");

const root = path.join(__dirname, "..");
const NAMES = { warrior: "劍士系", magician: "法師系", bowman: "弓手系", thief: "盜賊系" };
const f1 = n => n.toFixed(1), int = n => Math.round(n).toLocaleString("en-US");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(pathToFileURL(path.join(root, "index.html")).href);
  await page.addScriptTag({ path: path.join(root, "tests", "balance-sim.js") });
  const data = await page.evaluate(() => ({
    levels: SIM.levels(30, 85),
    bosses: SIM.bosses(),
    names: Object.fromEntries(Object.keys(TYPES).map(t => [t, TYPES[t].name + " Lv." + TYPES[t].lv])),
    coins: [[30, 40], [40, 55], [55, 70], [70, 85]].map(([a, b]) => [a, b, SIM.coins(a, b)]),
    perKill: Object.fromEntries(["sheep", "sprite", "rhino", "fox", "worm", "cactus", "wisp", "soldier", "scarab"].map(t => [t, SIM.coinsPerKill(t)])),
  }));
  await browser.close();

  const lines = Object.keys(NAMES);
  const out = [];
  out.push("### 每一級要打幾隻怪、一隻怪打幾秒", "", `| 等級 | 練功的怪 | 打幾隻 | ${lines.map(l => NAMES[l]).join(" | ")} |`, `| --- | --- | ---: | ${lines.map(() => "---:").join(" | ")} |`);
  for (const r of data.levels) out.push(`| ${r.lv} | ${data.names[r.mob]} | ${r.kills} | ${lines.map(l => f1(r.secs[l])).join(" | ")} |`);
  out.push("", "### 打 Boss 要幾秒（不停攻擊）", "", `| Boss | 等級 | ${lines.map(l => NAMES[l]).join(" | ")} |`, `| --- | ---: | ${lines.map(() => "---:").join(" | ")} |`);
  for (const r of data.bosses) out.push(`| ${data.names[r.boss]} | ${r.lv} | ${lines.map(l => int(r.secs[l])).join(" | ")} |`);
  out.push("", "### 金幣", "", "| 怪物 | 每隻平均（掉的金幣＋掉寶賣掉） |", "| --- | ---: |");
  for (const [t, v] of Object.entries(data.perKill)) out.push(`| ${data.names[t]} | ${int(v)} |`);
  out.push("", "| 等級區段 | 練完這段大約賺到 |", "| --- | ---: |");
  for (const [a, b, v] of data.coins) out.push(`| Lv.${a}～${b} | ${int(v)} |`);
  console.log(out.join("\n"));
})();
