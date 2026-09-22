# TaleX tagline teaser

~8s teaser for the tagline **"A user-driven ecosystem for real-world businesses... that pay you back"**,
rendered in two formats from one shared timeline and one audio mix.

| Output | Size | Layout |
| --- | --- | --- |
| `output/talex_tagline_horizontal.mp4` | 1920x1080, 60fps | one centered line, font auto-fit to 88px side margins |
| `output/talex_tagline_vertical.mp4` | 1080x1920, 60fps | three centered lines, font auto-fit to 72px side margins |

## Structure

- `shared/`: the single source for both formats.
  - `timeline.js` (generated): every event as a 60fps frame number.
  - `teaser.js` / `teaser.css`: the builder and styles. Only the text layout differs by format.
  - `assets/`: Inter 800, GSAP, a crisp HD copy of `reference/talex-logo.png`, and the synthesized SFX.
- `horizontal/`, `vertical/`: HyperFrames projects (just `index.html` plus config). `npm run sync` copies `shared/` into both.
- `scripts/build_timeline_audio.py`: computes the timeline and synthesizes all audio with ffmpeg/sox (key tap, dot tick, logo impact). It places every hit sample-exact at `frame * 800` (48 kHz / 60 fps).
- `scripts/make_logo_hd.py`: upscales the 298x50 logo with edge re-thresholding so it stays sharp at 640px.

## Timeline (frames @ 60fps)

| Frames | Beat |
| --- | --- |
| 0–47 | green cursor blinks 2x (silent) |
| 48–150 | "A user-driven ecosystem for real-world businesses" types, one click per char |
| 158–210 | dots: 1-2-3, hold, clear, 1-2-3 settle as "..." (tick per dot) |
| 222–256 | "that pay you back" types in green |
| 268 | cursor disappears |
| 284 | hard cut to black (silent) |
| 302 | logo cuts in, with the impact hit on the same frame |
| 302–481 | logo holds while the impact rings out to silence (end 8.03s) |

## Commands

```bash
npm run build    # regenerate logo, timeline.js, audio (needs python3 + numpy/pillow, ffmpeg, sox), then sync
npm run check    # sync + hyperframes check on both formats
npm run render   # sync + render both MP4s into output/
```
