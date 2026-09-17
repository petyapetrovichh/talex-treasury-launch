#!/usr/bin/env bash
# Render the composition to an opaque white-background GIF at 50 fps (GIF's practical maximum:
# 2 cs frame delay; shorter delays are clamped to 10 fps by browsers).
# The built-in `hyperframes render --format gif` keys the white background out as transparency,
# so we render a lossless PNG sequence and encode the GIF with ffmpeg ourselves.
set -euo pipefail
cd "$(dirname "$0")/.."
FPS="${FPS:-50}"
OUT="${1:-renders/viewscall-eye-loop.gif}"
FRAMES="$(mktemp -d)"
trap 'rm -rf "$FRAMES"' EXIT
npx --yes hyperframes@0.8.46 render --format png-sequence --fps "$FPS" -o "$FRAMES" --quiet
mkdir -p "$(dirname "$OUT")"
ffmpeg -v error -y -framerate "$FPS" -i "$FRAMES/frame_%06d.png" \
  -lavfi "color=c=white:s=1080x540:r=${FPS}[bg];[bg][0:v]overlay=shortest=1:format=auto,format=rgb24,split[a][b];[a]palettegen=max_colors=64:reserve_transparent=0[p];[b][p]paletteuse=dither=none" \
  -loop 0 "$OUT"
echo "wrote $OUT"
