// 自動試玩測試：用瀏覽器直接打開 index.html，不需要架伺服器
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  reporter: "list",
  use: { ...devices["Desktop Chrome"] },
});
