# TaleX tagline teaser

~19s teaser for the tagline **"A user-driven ecosystem for Real-World Businesses that pay you back"**.

| Output | Size | Status |
| --- | --- | --- |
| `output/talex_tagline_horizontal.mp4` | 1920x1080, 60fps | current: typing rhythm and key sounds from the reference recording |
| `output/talex_tagline_vertical.mp4` | 1080x1920, 60fps | previous version (8s). The vertical layout is not re-rendered yet |

## How the typing is made

`reference/typing_reference.mp4` is a screen recording of the phrase being typed in iPhone Notes.
`scripts/build_timeline_audio.py` finds all 83 keystrokes in it and maps each visible character to its own recorded tap.
Taps that change nothing on screen are skipped: shift, 123/ABC layout switches, and a typo fix.
The recorded rhythm plays 2x faster, and each tap sounds on the exact frame its character appears (48 kHz / 60 fps = 800 samples per frame).
The dots use the recorded "." taps, and erasing uses the recorded delete taps.
The cursor blinks like iOS (~0.53s on / 0.47s off, measured in the recording), stays solid while typing, and starts blinking ~0.6s after the last key.

## Sequence

| Time | Beat |
| --- | --- |
| 0–2.0s | green cursor blinks 2x (silent) |
| 2.0–8.3s | "A user-driven ecosystem for Real-World Businesses" types in white, centered |
| 8.6–9.2s | "..." typed in green right after "Businesses" (the dots don't shift the text), cursor after the dots |
| 9.2–11.3s | cursor blinks twice |
| 11.5–11.8s | the three dots are erased, with delete sounds |
| 12.25–13.7s | " that pay you back" types in green |
| 13.7–15.8s | cursor blinks twice |
| 15.78s | hard cut to black (silent) |
| 16.08s | TaleX logo fades in over 0.6s with a soft, deep boom that decays to silence |
| 19.42s | end |

## Structure

- `shared/`: the single source for both formats.
  - `timeline.js` (generated): every event as a 60fps frame number.
  - `teaser.js` / `teaser.css`: the builder and styles.
  - `assets/`: Inter 800, GSAP, an HD copy of `reference/talex-logo.png`, and the audio mix.
- `horizontal/`, `vertical/`: HyperFrames projects (just `index.html` plus config). `npm run sync` copies `shared/` into both.
- `scripts/build_timeline_audio.py`: builds the timeline, extracts the keystrokes, synthesizes the logo boom (ffmpeg + sox), and mixes the audio.
- `scripts/make_logo_hd.py`: upscales the 298x50 logo with edge re-thresholding so it stays sharp at 640px.

## Commands

```bash
npm run build              # regenerate logo, timeline.js, audio (python3 + numpy/pillow, ffmpeg, sox), then sync
npm run check              # sync + hyperframes check on both formats
npm run render:horizontal  # sync first (npm run sync), then render the horizontal MP4 into output/
npm run render             # sync + render both formats
```
