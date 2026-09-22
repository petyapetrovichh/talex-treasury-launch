"""Single source of truth for the tagline teaser timing + sound.

Typing rhythm and key sounds come from a real recording of the phrase being
typed in iPhone Notes (reference/typing_reference.mp4). Every visible
character re-uses the exact keystroke recorded for it, at the recorded rhythm
played 2x faster. Dots use the recorded "." taps, erasing uses the recorded
delete taps. Only the logo boom is synthesized (ffmpeg + sox).

Writes:
  shared/timeline.js                  -> window.TEASER (all events as 60fps frames)
  shared/assets/audio/tagline_sfx.wav -> final mix, every hit sample-exact on its frame

Frame f starts at sample f * 800 (48 kHz / 60 fps), so each sound starts on
the exact frame its visual change appears.
"""
import json
import pathlib
import subprocess
import tempfile

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
REF = ROOT.parent / "reference" / "typing_reference.mp4"
AUDIO = ROOT / "shared" / "assets" / "audio"
AUDIO.mkdir(parents=True, exist_ok=True)

FPS = 60
SR = 48000
SPF = SR // FPS  # 800 samples per frame
SPEED = 2.0      # play the recorded typing rhythm 2x faster

# ---------------------------------------------------------------- copy
LINE1 = "A user-driven ecosystem"
LINE2 = "for Real-World Businesses"
LINE3 = "that pay you back"
TEXT_A = LINE1 + " " + LINE2          # typed first (white)
TEXT_B = " " + LINE3                  # typed after the dots are erased (green)

# ---------------------------------------------------------------- reference keystrokes
# Index of each keystroke in the recording (detection order), aligned by
# reviewing the video frame by frame. Keys that change nothing on screen
# (shift, 123/ABC layout switches) and the typo fix are skipped - their time
# still shapes the rhythm because we keep the recorded onset of every
# visible character.
REF_A = [0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15,      # "A user-driven "
         16, 17, 18, 19, 20, 21, 22, 23, 24, 25,               # "ecosystem "
         26, 27, 28, 29,                                       # "for "
         31, 32, 33, 34, 36, 39, 40, 41, 42, 43, 44,           # "Real-World "
         46, 47, 48, 49, 50, 51, 52, 53, 54, 55]               # "Businesses"
REF_DOTS = [57, 58, 59]
REF_DELETES = [61, 62, 63]
REF_B = [65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82]
assert len(REF_A) == len(TEXT_A) and len(REF_B) == len(TEXT_B)


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1",
                          "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def detect_keystrokes(x):
    """Return [(onset_seconds, samples)] for each keystroke.

    The screen recording holds digital silence between taps, so a tap is any
    sound after >=30ms of silence. The onset is refined to the transient
    (first sample above 20% of the tap's peak) minus a 1.5ms pre-roll.
    """
    idx = np.flatnonzero(np.abs(x) > 1e-5)
    coarse, prev = [], -10**9
    for j in idx:
        if j - prev > int(0.03 * SR):
            coarse.append(j)
        prev = j
    starts = []
    for s in coarse:
        w = x[s:s + int(0.08 * SR)]
        t = np.argmax(np.abs(w) > 0.2 * np.abs(w).max())
        starts.append(max(0, s + t - int(0.0015 * SR)))
    taps = []
    for k, s in enumerate(starts):
        end = min(s + int(0.05 * SR), starts[k + 1] if k + 1 < len(starts) else len(x))
        seg = x[s:end].copy()
        fade = int(0.008 * SR)
        seg[-fade:] *= np.linspace(1, 0, fade)
        taps.append((s / SR, seg))
    return taps


taps = detect_keystrokes(decode(REF))
assert len(taps) == 83, f"expected 83 keystrokes in the reference, found {len(taps)}"

# Level: bring the (very quiet) recorded taps up to ~-20 dBFS, keeping 40% of
# their natural loudness variation so the typing still feels human.
peaks = np.array([np.abs(seg).max() for _, seg in taps])
p_med = np.median(peaks[REF_A + REF_B])
TARGET = 10 ** (-20 / 20)


def tap(k):
    seg = taps[k][1]
    return seg / peaks[k] * TARGET * (peaks[k] / p_med) ** 0.4


def ref_gap(k0, k1):
    """Recorded time between two taps, sped up, in frames."""
    return max(1, round((taps[k1][0] - taps[k0][0]) / SPEED * FPS))


# ---------------------------------------------------------------- timing (frames @60fps)
BLINK_ON, BLINK_OFF = 32, 28   # iOS cursor: ~0.53s on / ~0.47s off (measured in the reference)
IDLE_ON = 36                   # cursor stays solid ~0.6s after the last keypress
INTRO_BLINKS = 2               # 2s of blinking before typing
WAIT_BLINKS = 2                # blinks after "..." and after "back"
DELETE_LEAD = 14               # after the cursor comes back on, start erasing
BLACK_HOLD = 18                # 0.3s black before the logo
LOGO_FADE = 36                 # 0.6s soft fade-in
LOGO_TAIL = 200                # logo on screen while the boom rings out

cursor = []                    # [frame, 1|0] cursor visibility changes
f = 0
for _ in range(INTRO_BLINKS):
    cursor += [[f, 1], [f + BLINK_ON, 0]]
    f += BLINK_ON + BLINK_OFF
type_a_start = f
cursor.append([f, 1])

type_a = [type_a_start + ref_gap(REF_A[0], k) if k != REF_A[0] else type_a_start for k in REF_A]
dots = [type_a[-1] + ref_gap(REF_A[-1], k) for k in REF_DOTS]


def idle_blinks(last_key, n, come_back_on=True):
    """Cursor after a keypress: solid, then n blinks. Returns the frame after the last phase."""
    g = last_key + IDLE_ON
    for i in range(n):
        cursor.append([g, 0])
        g += BLINK_OFF
        if i < n - 1 or come_back_on:
            cursor.append([g, 1])
            if i < n - 1:
                g += BLINK_ON
    return g


back_on = idle_blinks(dots[-1], WAIT_BLINKS)            # frame the cursor is back on
deletes = [back_on + DELETE_LEAD]
deletes += [deletes[0] + ref_gap(REF_DELETES[0], k) for k in REF_DELETES[1:]]
type_b = [deletes[-1] + ref_gap(REF_DELETES[-1], REF_B[0])]
type_b += [type_b[0] + ref_gap(REF_B[0], k) for k in REF_B[1:]]

# After "back": solid, blink twice, hard cut on the frame it would come back on.
cut = idle_blinks(type_b[-1], WAIT_BLINKS, come_back_on=False)
logo = cut + BLACK_HOLD
end = logo + LOGO_TAIL

timeline = {
    "fps": FPS,
    "lines": [LINE1, LINE2, LINE3],
    "typeA": type_a,           # one frame per char of TEXT_A
    "splitA": len(LINE1),      # index of the " " between LINE1 and LINE2
    "dots": dots,
    "deletes": deletes,        # erase dot 3, 2, 1
    "typeB": type_b,           # index 0 is the " " before "that"
    "cursor": cursor,
    "cut": cut,
    "logo": logo,
    "logoFade": LOGO_FADE,
    "end": end,
    "durationSec": round(end / FPS, 6),
}
(ROOT / "shared" / "timeline.js").write_text(
    "// Generated by scripts/build_timeline_audio.py - do not edit by hand.\n"
    "window.TEASER = " + json.dumps(timeline, indent=2) + ";\n"
)

# ---------------------------------------------------------------- logo boom (synthesized)
# Soft, deep "boom": a rounded 20ms attack (no click/snap), a warm sub that
# glides 72 -> 46 Hz with a gentle 2nd harmonic for small speakers, a
# low-passed pink-noise body, then a dark reverb tail fading to silence.
def run(cmd):
    subprocess.run(cmd, check=True)


with tempfile.TemporaryDirectory() as tmp:
    dry, wet = pathlib.Path(tmp, "dry.wav"), pathlib.Path(tmp, "wet.wav")
    att = "(0.5-0.5*cos(PI*min(t/0.02\\,1)))"
    ph = "(46*t+(72-46)/6*(1-exp(-6*t)))"
    run(["ffmpeg", "-y", "-loglevel", "error",
         "-f", "lavfi", "-i",
         f"aevalsrc='{att}*(0.62*exp(-t*2.4)+0.38*exp(-t*1.2))*"
         f"(sin(2*PI*{ph})+0.22*sin(4*PI*{ph}))':d=3.3:s=48000",
         "-f", "lavfi", "-i", "anoisesrc=d=3.3:c=pink:r=48000:seed=5:a=1",
         "-f", "lavfi", "-i", f"aevalsrc='{att}*exp(-t*7)':d=3.3:s=48000",
         "-filter_complex",
         "[1]lowpass=f=380,lowpass=f=380,highpass=f=40[n];[2][n]amultiply,volume=1.4[body];"
         "[0][body]amix=inputs=2:normalize=0,lowpass=f=2200[o]",
         "-map", "[o]", "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s24le", str(dry)])
    run(["sox", str(dry), "-c", "2", str(wet),
         "gain", "-10",
         "reverb", "80", "85", "100", "90", "12", "-6",
         "fade", "t", "0", "3.3", "1.2",
         "gain", "-n", "-3"])
    boom = decode(wet)
boom *= 10 ** (-4 / 20) / np.abs(boom).max()  # peak -4 dBFS: headroom for AAC

# ---------------------------------------------------------------- mix
total = end * SPF
mix = np.zeros(total)


def place(frame, sig):
    s = frame * SPF
    n = min(len(sig), total - s)
    mix[s:s + n] += sig[:n]


for frames, refs in ((type_a, REF_A), (dots, REF_DOTS), (deletes, REF_DELETES), (type_b, REF_B)):
    for fr, k in zip(frames, refs):
        place(fr, tap(k))
place(logo, boom)
assert np.abs(mix).max() < 1.0

out = AUDIO / "tagline_sfx.wav"
stereo = np.repeat(mix.astype(np.float32)[:, None], 2, axis=1).tobytes()
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2",
                "-i", "-", "-c:a", "pcm_s24le", str(out)], input=stereo, check=True)

print(json.dumps({k: timeline[k] for k in ("cut", "logo", "end", "durationSec")}))
print("typeA", type_a[0], "->", type_a[-1], "| dots", dots, "| deletes", deletes,
      "| typeB", type_b[0], "->", type_b[-1])
print("cursor", cursor)
