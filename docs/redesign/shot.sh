#!/usr/bin/env bash
# shot.sh <route> <out.png> [width] [height] [virtual-time-ms]   screenshots a route of the dev server
CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"
OUT="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="${3:-1440},${4:-1400}" \
  --virtual-time-budget="${5:-8000}" --screenshot="$OUT" "http://localhost:5173$1" 2>&1 | grep -o "[0-9]* bytes" 
