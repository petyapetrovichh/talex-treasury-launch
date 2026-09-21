// Single source of truth for the weekly video timeline.
// Used by scripts/weekly.mjs (writes data/week.js for the browser) and by
// audio/generate_beat.mjs (places musical accents on the same times).
//
// Every key moment sits on a 16th-note grid at 125 BPM (0.12 s), so the beat
// generator can land accents exactly where the visuals hit.

export const BPM = 125;
export const BEAT = 60 / BPM;          // 0.48 s
export const STEP16 = BEAT / 4;        // 0.12 s
export const FPS = 30;
export const DURATION = 12;            // root data-duration (must match index.html / portrait.html)

// Scene windows (absolute seconds)
export const SCENES = {
  counter: { start: 0, end: 2.0 },
  receipt: { start: 2.0, end: 5.0 },
  holders: { start: 5.0, end: 9.0 },
  finale:  { start: 9.0, end: 12.0 },
};

// Fixed moments (absolute seconds). SLAM/STAMP are also the data-start values
// of the <audio> hit elements in index.html / portrait.html.
export const SLAM_AT = 0.96;           // counter slams into place, hit.mp3 full
export const SUBLINE_AT = 1.2;
export const RECEIPT_FEED_AT = 2.0;
export const RECEIPT_LINE0_AT = 2.4;   // first receipt line
export const RECEIPT_LINE_GAP = 0.16;
export const STAMP_AT = 4.08;          // "ON-CHAIN ✓" stamp, hit.mp3 soft
export const RECEIPT_OUT_AT = 4.56;
export const CHART_IN_AT = 5.0;
export const BASELINE_AT = 5.28;       // first (last week's) holders point appears
export const STEP0_AT = 5.4;           // day steps start after this
export const STEPS_END_AT = 7.92;      // last day step must land on/before this
export const BADGE_DELAY = 0.24;       // badge pops this long after the last step
export const CHART_OUT_AT = 8.76;
export const WEEK_TITLE_AT = 9.12;
export const TOTAL_LABEL_AT = 9.48;
export const COUNTUP_START = 9.6;
export const COUNTUP_END = 10.32;
export const LOGO_AT = 10.56;
export const FADE_OUT_START = 11.04;

function round3(x) { return Math.round(x * 1000) / 1000; }

/**
 * Compute the data-dependent part of the schedule from the week data.
 * `steps[i]` is the absolute time at which holders[i+1] lands (i = 0..N-2).
 */
export function buildSchedule(data) {
  const n = Array.isArray(data.holders) ? data.holders.length : 0;
  if (n < 2) throw new Error("week.json needs at least 2 holders entries (baseline + this week)");
  const stepCount = n - 1;
  const window = STEPS_END_AT - STEP0_AT; // 2.52 s
  // interval in 16ths, clamped so few entries still read as separate beats and
  // many entries still fit before the badge.
  let units = Math.floor(window / stepCount / STEP16 + 1e-6); // +eps: 0.36/0.12 is 2.9999 in floating point
  units = Math.max(1, Math.min(8, units));
  const interval = round3(units * STEP16);
  const steps = [];
  for (let i = 1; i <= stepCount; i++) steps.push(round3(STEP0_AT + i * interval));
  const lastStep = steps[steps.length - 1];
  const overflow = lastStep > STEPS_END_AT + 1e-6;
  const badgeAt = round3(lastStep + BADGE_DELAY);
  return {
    bpm: BPM,
    beat: BEAT,
    step16: STEP16,
    fps: FPS,
    duration: DURATION,
    scenes: SCENES,
    slamAt: SLAM_AT,
    sublineAt: SUBLINE_AT,
    receiptFeedAt: RECEIPT_FEED_AT,
    receiptLine0At: RECEIPT_LINE0_AT,
    receiptLineGap: RECEIPT_LINE_GAP,
    stampAt: STAMP_AT,
    receiptOutAt: RECEIPT_OUT_AT,
    chartInAt: CHART_IN_AT,
    baselineAt: BASELINE_AT,
    stepInterval: interval,
    steps,
    lastStepAt: lastStep,
    stepsOverflow: overflow,
    badgeAt,
    chartOutAt: CHART_OUT_AT,
    weekTitleAt: WEEK_TITLE_AT,
    totalLabelAt: TOTAL_LABEL_AT,
    countupStart: COUNTUP_START,
    countupEnd: COUNTUP_END,
    logoAt: LOGO_AT,
    fadeOutStart: FADE_OUT_START,
  };
}
