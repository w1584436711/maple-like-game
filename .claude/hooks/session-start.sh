#!/bin/bash
# 雲端 session 啟動時安裝測試工具，讓 npm test（自動試玩測試）可以直接跑
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# 雲端已經裝好 Chromium（PLAYWRIGHT_BROWSERS_PATH），這裡只裝 Playwright 套件，不下載瀏覽器
npm install --no-audit --no-fund
