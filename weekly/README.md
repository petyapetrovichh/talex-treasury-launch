# TaleX weekly buyback video — template

Reusable HyperFrames composition for the weekly **$X buyback & liquidity injection**
announcement. Everything on screen comes from `data/week.json`; nothing is hardcoded.
Each week you edit the JSON, run one command, and post the two MP4s.

```
weekly/
  data/week.json          ← the ONLY file you edit each week
  data/week.js            ← generated from week.json (do not edit)
  index.html              ← root composition (1:1); 9:16 is derived from it at render time
  compositions/           ← scenes: bg, counter, receipt, holders, finale
  weekly.css              ← design tokens + all format-specific sizes (1:1 vs 9:16)
  src/schedule.mjs        ← the timeline (single source of truth for visuals AND music)
  src/weekly.js           ← number formatting + derived values (growth %, short tx, …)
  audio/hit.mp3           ← the signature hit sound (generated once, reused every week)
  audio/generate_hit.mjs  ← how hit.mp3 was made (`npm run hit` regenerates it, bit-identical)
  audio/generate_beat.mjs ← music bed generator, rebuilt on every render from the timeline
  audio/weekly_music_override.mp3   ← OPTIONAL: drop a track here to replace the generated beat
  scripts/weekly.mjs      ← `npm run weekly`
  scripts/check.mjs       ← `npm run check` (both formats)
  output/                 ← rendered MP4s
```

## How to publish next week

1. **Edit `weekly/data/week.json`**

   | field            | what to put there                                                      |
   |------------------|------------------------------------------------------------------------|
   | `week`           | week number → titles, receipt header and output file names (`week{N}`) |
   | `date`           | date shown on the receipt, e.g. `"Sep 28, 2026"`                        |
   | `buyback_usd`    | this week's buyback in USD (the big slam number)                        |
   | `x_injected`     | $X bought & injected                                                    |
   | `bnb_injected`   | BNB injected (shown with 3 decimals)                                    |
   | `price_usd`      | $X price (shown with 4 decimals)                                        |
   | `revenue_pct`    | % of revenue allocated (usually `100`)                                  |
   | `tx_hash`        | full tx hash; the video shows `first 6 + … + last 4`                    |
   | `cumulative_usd` | total bought back so far (finale count-up)                              |
   | `holders`        | array of `{ "label": "Sep 21", "value": 11928 }` — see below            |

   **`holders`: the first entry is LAST WEEK's final value** (the baseline the chart starts
   from). The remaining entries are this week's daily values. Any number of entries works
   (2 or more); the chart, the day-step timing and the music accents adapt automatically
   (up to ~22 entries fit the chart beat window). The growth badge is computed:
   `+%` = `(last − first) / first`, net change = `last − first`.

2. **Optional: your own music.** Put any audio file at `weekly/audio/weekly_music_override.mp3`
   and it is used as the music bed instead of the generated beat (trimmed/padded to 12 s,
   loudness-normalised, ducked under the two hit sounds, faded in and out). The hit sounds
   stay. Delete the file to go back to the generated beat.

3. **Render**

   ```bash
   npm run weekly        # from the repo root (or from weekly/)
   ```

   This regenerates `data/week.js`, rebuilds the beat so its accents match the timeline
   (slam, stamp, every day-step, badge peak, logo resolve), and renders:

   - `weekly/output/talex_weekly_week{N}_1x1.mp4`  — 1080×1080 for X / Telegram / Discord
   - `weekly/output/talex_weekly_week{N}_9x16.mp4` — 1080×1920 for Shorts / Reels / TikTok

   Options: `npm run weekly -- --format 1x1` (or `9x16`) renders one format;
   `-- --quality draft` for a quick preview render.

4. **Post** both files and commit them if you want them in the repo.

## Requirements

- Node 18+, **ffmpeg + ffprobe on PATH** (`apt install ffmpeg` / `brew install ffmpeg`),
  and Chrome Headless Shell for HyperFrames: `npx hyperframes browser ensure` (one time).
  `npx hyperframes doctor` shows what is missing.
- The CLI is pinned (`hyperframes@0.8.58`) in `weekly/package.json` so renders stay identical.

## Checking / previewing

```bash
npm run check                 # lint + runtime + layout + motion + contrast, both formats
cd weekly && npm run dev      # HyperFrames Studio preview of the 1:1 composition
```

## Timeline (12 s, 125 BPM grid)

| time        | scene                                                                                 |
|-------------|---------------------------------------------------------------------------------------|
| 0.0 – 2.0 s | **Counter slam** — slot-machine digits land on `buyback_usd` at 0.96 s (hit.mp3, full) |
| 2.0 – 5.0 s | **Receipt** — paper feed, lines print, `ON-CHAIN ✓` stamp at 4.08 s (hit.mp3, soft)   |
| 5.0 – 9.0 s | **Active holders** — day-by-day steps (spacing derived from the entry count), badge   |
| 9.0 – 12 s  | **Finale** — `Week #N`, cumulative count-up, TaleX logo lands at 10.56 s and holds    |

All times live in `src/schedule.mjs`. The beat generator reads the same schedule, so the
music always lands on the picture. If you change the two constant hit times there
(`SLAM_AT`, `STAMP_AT`), also update the `data-start` of the two `<audio>` hits in
`index.html`.

## Design notes

- Palette/fonts follow the Treasury Dashboard: near-black `#0a0e10`, TaleX green `#6eef00`,
  JetBrains Mono for numbers, Inter for text (fonts ship in `assets/fonts`, no network).
- 9:16 is a re-layout, not a crop: `weekly.css` holds every format-specific size under
  `html[data-format="portrait"]` as CSS variables, with safe areas for platform UI
  (top 250 px, bottom 340 px). `scripts/formats.mjs` materialises the portrait project
  (root and scene sizes) into a temp copy at render/check time, so `index.html` stays
  the single source.
