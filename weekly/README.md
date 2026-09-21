# TaleX weekly buyback video — template

Reusable HyperFrames composition for the weekly **$X buyback & liquidity injection**
announcement. Everything on screen comes from `data/week.json`; nothing is hardcoded.
Each week you edit the JSON, run one command, and post the two MP4s.

```
weekly/
  data/week.json          ← the ONLY file you edit each week
  data/week.js            ← generated from week.json (do not edit)
  index.html              ← root composition, 1920x1080 (16:9)
  compositions/           ← scenes: bg, counter, receipt, holders, finale
  weekly.css              ← design tokens + format-specific sizes
  src/schedule.mjs        ← the timeline: every visual moment is pinned to a beat of the track
  src/weekly.js           ← number formatting + derived values (growth %, short tx, …)
  audio/music.mp3         ← THE soundtrack (the only audio in the video)
  audio/beats.json        ← its measured transients (slam, stamp, day-step slots, badge, logo)
  audio/analyze_onsets.mjs ← helper that measured them (re-run if the track ever changes)
  scripts/weekly.mjs      ← `npm run weekly`
  scripts/check.mjs       ← `npm run check`
  output/                 ← rendered MP4
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
   (2 or more). Each day-step lands on one of the track's hits (there are 10 hit slots in the
   chart section, so up to 11 entries stay on the beat; more entries are spread evenly across
   the same window). The growth badge is computed: `+%` = `(last − first) / first`,
   net change = `last − first`.

2. **Render**

   ```bash
   npm run weekly        # from the repo root (or from weekly/)
   ```

   This regenerates `data/week.js`, checks that the scene windows in `index.html` still match
   the beat map, and renders `weekly/output/talex_weekly_week{N}_16x9.mp4` (1920×1080).

   Options: `-- --quality draft` for a quick preview render;
   `-- --format 1x1` / `9x16` / `all` for the derived square / vertical layouts.

3. **Post** the file and commit it if you want it in the repo.

## Requirements

- Node 18+, **ffmpeg + ffprobe on PATH** (`apt install ffmpeg` / `brew install ffmpeg`),
  and Chrome Headless Shell for HyperFrames: `npx hyperframes browser ensure` (one time).
  `npx hyperframes doctor` shows what is missing.
- The CLI is pinned (`hyperframes@0.8.58`) in `weekly/package.json` so renders stay identical.

## Checking / previewing

```bash
npm run check                 # lint + runtime + layout + motion + contrast (16:9)
cd weekly && npm run check:all   # also the derived 1:1 and 9:16 layouts
cd weekly && npm run dev      # HyperFrames Studio preview
```

## Timeline (14.1 s, cut to `audio/music.mp3`)

The track is a 125 BPM stomp: hits every 0.48 s from 0.504 s to ~8 s, a sparse break
(8.20 / 8.68 / 9.19 / 9.53 / 9.77 s), a big impact at 10.137 s, a final hit at 11.13 s and
a decaying tail. The picture is cut to those hits (`audio/beats.json`):

| time           | scene                                                                                |
|----------------|--------------------------------------------------------------------------------------|
| 0.0 – 2.42 s   | **Counter slam** — digits spin through the intro swell and land on the first stomp (0.504 s); subline on the next beat |
| 2.42 – 5.05 s  | **Receipt** — paper feeds on the bar-2 downbeat, a line prints every 8th note, `ON-CHAIN ✓` stamps on 4.344 s |
| 5.05 – 10.65 s | **Active holders** — baseline on 5.304 s, one day-step per hit (5.78, 6.26, 6.74, 7.22, 7.70, 8.20, 8.68 s …), `+%` badge on the 10.137 s impact |
| 10.65 – 14.1 s | **Finale** — cumulative count-up lands on the 11.13 s hit, TaleX logo lands at 11.6 s and holds through the tail |

To change the music: replace `audio/music.mp3`, measure its hits with
`audio/analyze_onsets.mjs`, update `audio/beats.json` (scene windows + key moments), and
update the scene clips / root duration in `index.html` to the same windows
(`npm run weekly` refuses to render if they disagree).

## Design notes

- Palette/fonts follow the Treasury Dashboard: near-black `#0a0e10`, TaleX green `#6eef00`,
  JetBrains Mono for numbers, Inter for text (fonts ship in `assets/fonts`, no network).
- The source is 16:9. The optional 1:1 / 9:16 layouts are re-layouts, not crops: `weekly.css`
  holds every format-specific size under `html[data-format="…"]` as CSS variables (with safe
  areas for vertical platform UI), and `scripts/formats.mjs` materialises those projects into
  a temp copy at render/check time, so `index.html` stays the single source.
