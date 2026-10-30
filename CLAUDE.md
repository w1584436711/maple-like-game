# maple-like-game

- 不需要建置：`index.html` 放 HTML 結構，樣式在 `css/style.css`，程式分成 `js/` 裡的幾個一般 script，依 `index.html` 列的順序載入、共用頂層名稱。不要改成 ES modules（直接用 file:// 打開時瀏覽器會擋）。
- 每個 JS 檔開頭一行寫它放什麼；新增內容通常只要改資料表：地圖、怪物在 `js/world.js`，職業、技能、道具、價格在 `js/rules.js`，NPC、任務、商店在 `js/npc.js`，寵物在 `js/pet.js`，遠征在 `js/raid.js`，圖鑑、稱號、椅子、跳跳挑戰在 `js/collect.js`，音效、音樂和設定在 `js/audio.js`。
- 一個檔案的頂層程式碼在載入時就執行，只能用到它自己或前面檔案宣告的東西；呼叫後面檔案的函式要放在事件或遊戲迴圈裡。
- 改完一定要跑 `npm test`（Playwright 自動試玩測試），全部通過才 commit。
- 新的玩法或畫面行為，順手在 `tests/smoke.spec.js` 補一項測試。
- 改了怪物、技能、裝備或價格的數值，跑 `node tools/balance.js` 看平衡表（算法和目標在 `docs/BALANCE.md`），有變就把新表格貼回文件，再用 `node tools/test-saves.js` 重新產生 `test-saves/` 的試玩存檔。
- `main` 有開 GitHub Pages，合併後 1～2 分鐘就會更新 https://w1584436711.github.io/maple-like-game/
