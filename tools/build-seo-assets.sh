#!/usr/bin/env sh
# Regenerates the site's share image and icons into website/.
#   og-image.png          1200x630, rendered from tools/og-image.html by headless Chrome
#   icon-maskable-512.png the square avatar, rendered by headless Chrome; the chip sits
#                         inside the maskable safe zone (34% of the width from centre, limit 40%)
#   favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png
#                         copied from manhattan-brand-assets/icon/
# Needs Chrome (or CHROME=/path/to/chrome).
set -e
cd "$(dirname "$0")/.."
OUT=website
ICON=manhattan-brand-assets/icon

CHROME="${CHROME:-}"
if [ -z "$CHROME" ]; then
  for c in "/c/Program Files/Google/Chrome/Application/chrome.exe" \
           "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           google-chrome chromium; do
    if [ -x "$c" ] || command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
  done
fi
[ -n "$CHROME" ] || { echo "no Chrome found; set CHROME=" >&2; exit 1; }

# Chrome on Windows wants C:/... rather than Git Bash's /c/...; pwd -W gives that.
ROOT="$(pwd -W 2>/dev/null || pwd)"
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=5000 \
  --screenshot="$ROOT/$OUT/og-image.png" "file:///${ROOT#/}/tools/og-image.html" 2>/dev/null
# The avatar SVG is 100x100; a 5.12 scale factor screenshots it at 512x512.
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=5.12 \
  --window-size=100,100 \
  --screenshot="$ROOT/$OUT/icon-maskable-512.png" "file:///${ROOT#/}/$ICON/manhattan-avatar.svg" 2>/dev/null

cp "$ICON/manhattan-icon.svg"     "$OUT/favicon.svg"
cp "$ICON/favicon.ico"            "$OUT/favicon.ico"
cp "$ICON/apple-touch-icon.png"   "$OUT/apple-touch-icon.png"
cp "$ICON/manhattan-icon-192.png" "$OUT/icon-192.png"
cp "$ICON/manhattan-icon-512.png" "$OUT/icon-512.png"

ls -l "$OUT"/og-image.png "$OUT"/favicon.* "$OUT"/*icon*.png
