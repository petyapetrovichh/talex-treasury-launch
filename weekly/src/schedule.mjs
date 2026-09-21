// Single source of truth for the weekly video timeline.
//
// The music is audio/music.mp3 (a fixed track). Its key transients are listed
// in audio/beats.json; every visual moment is pinned to one of them so the
// picture lands on the beats. scripts/weekly.mjs writes the resolved schedule
// into data/week.js for the browser, and verifies the scene host clips in
// index.html match these windows.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const BEATS = JSON.parse(readFileSync(join(here, "..", "audio", "beats.json"), "utf8"));
export const FPS = 30;
export const DURATION = BEATS.duration; // root data-duration (must match index.html)

function round3(x) { return Math.round(x * 1000) / 1000; }

/** Resolve the data-dependent part (holders day-steps) against the beat map. */
export function buildSchedule(data) {
  const n = Array.isArray(data.holders) ? data.holders.length : 0;
  if (n < 2) throw new Error("week.json needs at least 2 holders entries (baseline + this week)");
  const B = BEATS;
  const slots = B.holders.stepSlots;
  const stepCount = n - 1;
  let steps;
  if (stepCount <= slots.length) {
    steps = slots.slice(0, stepCount);            // one day-step per musical hit
  } else {
    // more entries than hits: spread evenly across the same window
    const t0 = slots[0], t1 = slots[slots.length - 1];
    steps = Array.from({ length: stepCount }, (_, i) => round3(t0 + ((t1 - t0) * i) / (stepCount - 1)));
  }
  const lastStep = steps[steps.length - 1];
  return {
    fps: FPS,
    duration: DURATION,
    bpm: B.bpm,
    scenes: {
      counter: { start: B.counter.start, end: B.counter.end },
      receipt: { start: B.receipt.start, end: B.receipt.end },
      holders: { start: B.holders.start, end: B.holders.end },
      finale:  { start: B.finale.start,  end: B.finale.end },
    },
    slamAt: B.counter.slam,
    sublineAt: B.counter.subline,
    counterExitAt: B.counter.exit,
    receiptFeedAt: B.receipt.feed,
    receiptLine0At: B.receipt.line0,
    receiptLineGap: B.receipt.lineGap,
    stampAt: B.receipt.stamp,
    receiptOutAt: B.receipt.out,
    chartInAt: B.holders.chartIn,
    baselineAt: B.holders.baseline,
    steps,
    stepInterval: steps.length > 1 ? round3(steps[1] - steps[0]) : 0.48,
    onBeat: stepCount <= slots.length,
    lastStepAt: lastStep,
    badgeAt: B.holders.badge,
    chartOutAt: B.holders.chartOut,
    totalLabelAt: B.finale.totalLabel,
    countupStart: B.finale.countupStart,
    countupEnd: B.finale.countupEnd,
    logoAt: B.finale.logo,
  };
}
