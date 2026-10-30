// 試玩存檔：node tools/test-saves.js
// 用 tests/balance-sim.js 的「一般玩家」角色，做出 Lv.50、75、80 四個職業各一個存檔，寫進 test-saves/
// 每個存檔都會先在頁面裡匯入一次，確認匯入得進去
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), { pathToFileURL } = require("url");

const root = path.join(__dirname, ".."), out = path.join(root, "test-saves");
const LEVELS = [50, 75, 80];
const NAMES = { warrior: "劍士", magician: "法師", bowman: "弓手", thief: "盜賊" };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(pathToFileURL(path.join(root, "index.html")).href);
  await page.evaluate(() => { draft.name = "試玩"; confirmCreate(); });
  await page.addScriptTag({ path: path.join(root, "tests", "balance-sim.js") });
  const saves = await page.evaluate(([levels, names]) => {
    const res = [];
    let n = 0;
    for (const lv of levels) for (const line of Object.keys(SIM.LINES)) {
      SIM.build(line, lv);
      // HP and MP as if levelled normally: beginner to Lv.10, then each job's average gain per level, plus what each advancement gives
      let hp = 50, mp = 5;
      for (let l = 2; l <= lv; l++) {
        const j = l <= 10 ? "beginner" : SIM.LINES[line][[10, 30, 50, 70].filter(t => l > t).length - 1];
        hp += (JOBS[j].hp[0] + JOBS[j].hp[1]) / 2;
        mp += (JOBS[j].mp[0] + JOBS[j].mp[1]) / 2 + (line === "magician" && j !== "beginner" ? Math.floor(P.int * l / lv / 10) : 0);
      }
      for (const j of SIM.LINES[line]) if (JOBS[j].req.lv <= lv) { hp += JOBS[j].gain.hp; mp += JOBS[j].gain.mp; }
      P.mhp = Math.round(hp); P.mmp = Math.round(mp);
      P.buffs = {}; P.cds = {}; P.cdMax = {};
      // skill keys: attacks of the two newest jobs (ultimates included), then buffs, then older attacks
      const learned = [...jobLine()].reverse().flatMap((j, i) => (SKILLS[j] || []).map(s => ({ s, i }))).filter(({ s }) => s.type !== "passive" && skLv(s.id) > 0);
      const rank = ({ s, i }) => s.type === "atk" && i < 2 ? 0 : s.type === "buff" ? 1 : 2;
      P.slots = learned.sort((a, b) => rank(a) - rank(b)).slice(0, SKILL_SLOTS).map(({ s }) => s.id);
      P.coins = 2000000; P.exp = 0; P.ap = 0; P.sp = 0;
      addTo(P.bag, "white_pot", 200); addTo(P.bag, "mana_pot", 200); addTo(P.bag, "town_scroll", 10);
      if (lv >= RAID.lv) addTo(P.bag, RAID.pass, 10);
      P.map = lv >= 70 ? "sandcity" : "cloudtown";
      P.raid = { day: "", used: 0 };
      // a different look for each save, the same every run
      const hairs = Object.keys(HAIR_STYLES);
      P.look = { name: `${names[line]}${lv}`, hair: hairs[n % hairs.length], hairColor: (n * 3) % HAIR_COLORS.length, skin: n % SKINS.length, eyes: (n * 2) % EYE_COLORS.length };
      n++;
      P.hp = maxHp(); P.mp = maxMp();
      res.push({ lv, line, job: JOBS[P.job].name, text: exportSave() });
    }
    return res;
  }, [LEVELS, NAMES]);
  for (const s of saves) {
    const ok = await page.evaluate(t => importSave(t) && createWin.hidden, s.text);
    if (!ok) throw new Error(`Lv.${s.lv} ${s.line} 的存檔匯入失敗`);
  }
  await browser.close();
  if (errors.length) throw new Error(errors.join("\n"));

  fs.mkdirSync(out, { recursive: true });
  let md = `# 試玩存檔

Lv.50、Lv.75、Lv.80 四個職業各一個存檔，角色就是 [docs/BALANCE.md](../docs/BALANCE.md) 模擬用的「一般玩家」：

- 能力值都點主屬性（劍士和盜賊的敏捷是等級 + 4），裝備是等級夠穿的最好裝備，沒有卷軸強化。
- 技能點照轉職順序分配，所以剛轉職的技能等級還不高（例如 Lv.80 還沒學四轉大招）。
- 每個都帶 2,000,000 金幣、白藥水和魔力藥水各 200 瓶、回村卷軸 10 張；Lv.75、Lv.80 另外帶 10 張熔心入場證。
- Lv.50 在雲頂城，可以去雷雲祭壇打雷雲巨鷲。Lv.75、Lv.80 在沉砂城，可以找遠征隊長卡蘭進熔心祭壇，或去流沙神殿打沙暴蠍皇。

改了數值或存檔格式之後，用 \`node tools/test-saves.js\` 重新產生這個資料夾。

## 怎麼匯入

1. 先在設定（P）切到一個不要的存檔欄位，匯入會蓋掉那一欄的角色。
2. 把下面其中一段文字整段複製（或打開同名的 .txt 檔），貼到設定視窗的「存檔文字」框。
3. 按「匯入到目前存檔」。

`;
  for (const lv of LEVELS) {
    md += `## Lv.${lv}\n\n`;
    for (const s of saves.filter(s => s.lv === lv)) {
      fs.writeFileSync(path.join(out, `Lv${lv}-${s.line}.txt`), s.text + "\n");
      md += `### ${NAMES[s.line]}${lv}（${s.job}）\n\n\`\`\`\n${s.text}\n\`\`\`\n\n`;
    }
  }
  fs.writeFileSync(path.join(out, "README.md"), md.trimEnd() + "\n");
  console.log(`寫好 ${saves.length} 個存檔：${out}`);
})();
