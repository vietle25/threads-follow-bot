#!/bin/bash
# ─── Start Chrome with Remote Debugging ───────────────────────
# This uses a SEPARATE profile dir (chrome-profile/) so that
# Chrome can open with --remote-debugging-port without being
# blocked by the "non-default data directory" restriction.
#
# Usage:  bash start-chrome.sh
# Then:   node bot.js (in another terminal tab)
# ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_DIR="$SCRIPT_DIR/chrome-profile"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

echo "🔴 Killing any existing Chrome instances..."
pkill -9 -x "Google Chrome" 2>/dev/null
sleep 2

echo "🚀 Starting Chrome with remote debugging on port 9222..."
echo "   Profile: $PROFILE_DIR"
echo ""

"$CHROME" \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "https://www.threads.net" &

echo "✅ Chrome started! (PID: $!)"
echo ""
echo "👉 Log in to Threads in the Chrome window that just opened."
echo "   Then run:  node bot.js"
