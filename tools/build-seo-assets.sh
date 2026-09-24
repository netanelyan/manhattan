#!/usr/bin/env sh
# Regenerates the site's share image and icons into website/.
#   og-image.png          1200x630, rendered from tools/og-image.html by headless Chrome
#   favicon.svg           the mark, vector
#   favicon.ico           16/32/48 px, for browsers and search results
#   apple-touch-icon.png  180 px
#   icon-192.png, icon-512.png, icon-maskable-512.png   for site.webmanifest
# Needs Chrome (or CHROME=/path/to/chrome) and Python 3 with Pillow.
set -e
cd "$(dirname "$0")/.."
OUT=website

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

python - "$OUT" <<'EOF'
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
BG, ACCENT, CELL, POWER = (10, 12, 11), (159, 212, 159), (87, 133, 189), (209, 87, 66)

def mark(size, pad):
    """The three-rectangle mark on a rounded dark tile. pad is the inset as a fraction of size."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=round(size * 0.19), fill=BG)
    x0 = y0 = size * pad
    span = size - 2 * x0
    gap = max(1, span * 0.1)
    half = (span - gap) / 2
    d.rectangle([x0, y0, x0 + half, y0 + span], fill=ACCENT)
    d.rectangle([x0 + half + gap, y0, x0 + span, y0 + half], fill=CELL)
    d.rectangle([x0 + half + gap, y0 + half + gap, x0 + span, y0 + span], fill=POWER)
    return im

big = mark(1024, 0.19)
for name, px in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
    img = big.resize((px, px), Image.LANCZOS)
    if name == 'apple-touch-icon.png':  # iOS ignores transparency; flatten onto the background
        flat = Image.new('RGB', img.size, BG); flat.paste(img, mask=img); img = flat
    img.save(f'{out}/{name}')
# maskable: full-bleed background, mark inside the 80% safe zone
m = Image.new('RGB', (512, 512), BG)
inner = mark(1024, 0.19).resize((360, 360), Image.LANCZOS)
m.paste(inner, (76, 76), inner)
m.save(f'{out}/icon-maskable-512.png')
mark(256, 0.16).save(f'{out}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0a0c0b"/><rect x="6" y="6" width="9" height="20" fill="#9fd49f"/><rect x="17" y="6" width="9" height="9" fill="#5785bd"/><rect x="17" y="17" width="9" height="9" fill="#d15742"/></svg>\n'''
open(f'{out}/favicon.svg', 'w').write(svg)
EOF

ls -l "$OUT"/og-image.png "$OUT"/favicon.* "$OUT"/*icon*.png
