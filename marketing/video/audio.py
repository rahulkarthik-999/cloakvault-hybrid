"""
Sound design for the CloakVault demo video (original, synthesized — no third-party audio).

Synthesises an original, royalty-free score plus the UI sound-effect set, so the
video ships with no third-party audio licences attached. Everything is written
here from scratch with numpy — nothing is sampled or downloaded.

    python landing/scripts/demo-video/audio.py <outDir> <totalSeconds>

Writes <outDir>/music.wav and <outDir>/sfx/<name>.wav (48 kHz stereo float->pcm16).
"""
import sys, os, math
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000


def write_wav(path, x):
    """x: (n,2) float in [-1,1]"""
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype("<i2")
    n = pcm.shape[0]
    hdr = b"RIFF" + (36 + n * 4).to_bytes(4, "little") + b"WAVEfmt "
    hdr += (16).to_bytes(4, "little") + (1).to_bytes(2, "little") + (2).to_bytes(2, "little")
    hdr += SR.to_bytes(4, "little") + (SR * 4).to_bytes(4, "little")
    hdr += (4).to_bytes(2, "little") + (16).to_bytes(2, "little")
    hdr += b"data" + (n * 4).to_bytes(4, "little")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(hdr)
        f.write(pcm.tobytes())


def lp(x, hz, order=4):
    return sosfilt(butter(order, min(hz, SR / 2 - 100), "lowpass", fs=SR, output="sos"), x, axis=0)


def hp(x, hz, order=4):
    return sosfilt(butter(order, max(hz, 12), "highpass", fs=SR, output="sos"), x, axis=0)


def stereo(mono, width=0.0):
    """Mono -> stereo, optionally widened with a few samples of Haas delay."""
    if width <= 0:
        return np.stack([mono, mono], axis=-1)
    d = int(SR * 0.006 * width)
    left = mono
    right = np.concatenate([np.zeros(d), mono[:-d]]) if d else mono
    return np.stack([left, right], axis=-1)


def adsr(n, a, d, s, r, peak=1.0):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    a, d, r = max(a, 1), max(d, 1), max(r, 1)
    sus = max(n - a - d - r, 0)
    env = np.concatenate([
        np.linspace(0, peak, a) ** 1.6,
        peak - (peak - s * peak) * (np.linspace(0, 1, d) ** 0.7),
        np.full(sus, s * peak),
        np.linspace(s * peak, 0, r) ** 1.8,
    ])
    return env[:n] if len(env) >= n else np.pad(env, (0, n - len(env)))


def note(freq, dur, kind="sine", detune=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if kind == "saw":
        y = np.zeros(n)
        for h in range(1, 15):
            y += np.sin(2 * np.pi * freq * h * t) / h
        y *= 0.45
    elif kind == "tri":
        y = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * freq * t))
    else:
        y = np.sin(2 * np.pi * freq * t)
    if detune:
        y = 0.5 * y + 0.5 * np.sin(2 * np.pi * freq * (1 + detune) * t)
    return y


def reverb(x, amount=0.3, decay=2.2):
    """Cheap Schroeder-ish tail: a few decaying delayed copies, smoothed."""
    out = x.copy()
    for dly, g in ((0.031, 0.55), (0.047, 0.44), (0.071, 0.36), (0.113, 0.26), (0.167, 0.18)):
        d = int(dly * SR)
        if d >= len(x):
            continue
        tail = np.zeros_like(x)
        tail[d:] = x[:-d] * g
        for k in range(2, 6):
            dd = d * k
            if dd >= len(x):
                break
            tail[dd:] += x[:-dd] * (g ** k) * math.exp(-dd / (decay * SR))
        out += tail * amount
    return lp(out, 6500)


MIDI = {"A2": 110.0, "C3": 130.81, "E3": 164.81, "F3": 174.61, "G3": 196.0, "A3": 220.0,
        "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.0, "A4": 440.0,
        "C5": 523.25, "E5": 659.26, "G5": 783.99, "A5": 880.0}


def build_music(total):
    """84 BPM, Am–F–C–G. Warm pad + sub + sparse bell arpeggio + air."""
    bpm = 84.0
    beat = 60.0 / bpm
    bar = beat * 4
    n = int(total * SR)
    mix = np.zeros((n, 2))

    prog = [
        (["A3", "C4", "E4"], "A2"),
        (["F3", "A3", "C4"], "F3"),
        (["C4", "E4", "G4"], "C3"),
        (["G3", "C4", "E4"], "G3"),
    ]

    def place(buf, sig, at):
        i = int(at * SR)
        if i >= n:
            return
        m = min(len(sig), n - i)
        buf[i:i + m] += sig[:m]

    # ── pads + sub ────────────────────────────────────────────────────────
    pad = np.zeros(n)
    sub = np.zeros(n)
    b = 0
    while b * bar < total + bar:
        chord, root = prog[b % 4]
        at = b * bar
        for f in chord:
            v = note(MIDI[f], bar * 1.25, "saw", detune=0.004)
            v *= adsr(len(v), 0.55, 0.7, 0.62, 0.9, peak=0.17)
            place(pad, v, at)
        s = note(MIDI[root] / 2, bar * 1.1, "sine")
        s *= adsr(len(s), 0.10, 0.35, 0.70, 0.55, peak=0.32)
        place(sub, s, at)
        b += 1
    pad = lp(pad, 2100)
    sub = lp(sub, 130)

    # ── bell arpeggio: sparse, on the off-beats ───────────────────────────
    bell = np.zeros(n)
    steps = ["A4", "E5", "C5", "G4", "A4", "C5", "E5", "G4"]
    b = 0
    while b * bar < total:
        chord, _ = prog[b % 4]
        for k, sl in enumerate([0.0, 1.5, 2.5, 3.5]):
            at = b * bar + sl * beat
            f = MIDI[steps[(b * 4 + k) % len(steps)]]
            v = note(f, 1.5, "sine") * 0.55 + note(f * 2, 1.5, "sine") * 0.12
            v *= adsr(len(v), 0.004, 0.55, 0.02, 0.9, peak=0.13)
            place(bell, v, at)
        b += 1
    bell = reverb(bell, 0.42, 2.6)

    # ── air: filtered noise swell, one per 8 bars ─────────────────────────
    rng = np.random.default_rng(7)
    air = np.zeros(n)
    b = 0
    while b * bar * 8 < total:
        ln = int(bar * 8 * SR)
        nz = rng.standard_normal(min(ln, n))
        nz = lp(hp(nz, 1400), 5200)
        env = np.sin(np.linspace(0, np.pi, len(nz))) ** 2
        place(air, nz * env * 0.020, b * bar * 8)
        b += 1

    body = pad + sub + bell * 0.9 + air
    body = np.tanh(body * 1.25) * 0.82
    mix = stereo(body, width=0.7)
    mix[:, 0] += bell * 0.10
    mix[:, 1] += np.concatenate([np.zeros(600), bell[:-600]]) * 0.10

    # long fades so the bed never starts or stops abruptly
    fi, fo = int(3.0 * SR), int(4.5 * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None] ** 1.5
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.2
    peak = np.max(np.abs(mix)) or 1.0
    return mix / peak * 0.72


# ── sound-effect set ─────────────────────────────────────────────────────
def sfx_whoosh():
    n = int(0.85 * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(3)
    nz = rng.standard_normal(n)
    env = np.exp(-((t - 0.30) ** 2) / (2 * 0.13 ** 2))
    swept = np.zeros(n)
    for i, f in enumerate(np.linspace(240, 3400, 9)):
        seg = sosfilt(butter(2, [max(f * 0.6, 40), min(f * 1.7, 20000)], "bandpass", fs=SR, output="sos"), nz)
        w = np.exp(-((t - (0.08 + i * 0.035)) ** 2) / (2 * 0.055 ** 2))
        swept += seg * w
    y = swept * env * 0.30
    return stereo(lp(y, 9000), 0.9)


def sfx_riser():
    n = int(2.4 * SR)
    t = np.arange(n) / SR
    f = 90 * (2 ** (t * 1.5))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * 0.10
    rng = np.random.default_rng(11)
    nz = lp(hp(rng.standard_normal(n), 600), 7000) * 0.05
    env = (t / t[-1]) ** 2.2
    y = (y + nz) * env
    y[-int(0.25 * SR):] *= np.linspace(1, 0, int(0.25 * SR))
    return stereo(y, 0.5)


def sfx_sub():
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    f = np.linspace(74, 40, n)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.1) * 0.42
    return stereo(lp(y, 160))


def sfx_chime():
    n = int(1.7 * SR)
    y = np.zeros(n)
    for f, g in ((880.0, 0.5), (1320.0, 0.26), (1760.0, 0.14), (2640.0, 0.05)):
        v = note(f, 1.7, "sine")
        v *= adsr(n, 0.004, 0.5, 0.05, 1.1, peak=g)
        y += v
    return stereo(reverb(y * 0.24, 0.45, 2.4), 0.6)


def sfx_tick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * 1650 * t) * 0.5 + np.sin(2 * np.pi * 2480 * t) * 0.22) * np.exp(-t * 34)
    return stereo(hp(y * 0.20, 600), 0.4)


def sfx_click():
    n = int(0.14 * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(5)
    y = (rng.standard_normal(n) * 0.5 + np.sin(2 * np.pi * 2100 * t)) * np.exp(-t * 95)
    return stereo(sosfilt(butter(2, [900, 6500], "bandpass", fs=SR, output="sos"), y) * 0.17)


def sfx_type():
    y = np.zeros(int(1.15 * SR))
    rng = np.random.default_rng(9)
    click = sfx_click()[:, 0]
    for i in range(11):
        at = int((0.02 + i * 0.095 + rng.uniform(0, 0.018)) * SR)
        m = min(len(click), len(y) - at)
        if m > 0:
            y[at:at + m] += click[:m] * rng.uniform(0.5, 0.85)
    return stereo(y * 0.7)


def sfx_confirm():
    n = int(1.3 * SR)
    y = np.zeros(n)
    for i, f in enumerate((659.26, 987.77)):
        v = note(f, 1.3, "sine") * adsr(n, 0.006, 0.35, 0.08, 0.85, peak=0.26)
        y += np.concatenate([np.zeros(int(i * 0.075 * SR)), v])[:n]
    return stereo(reverb(y * 0.26, 0.35, 1.8), 0.5)


def sfx_pulse():
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 196 * t) * np.exp(-t * 4.2) * 0.20
    y += np.sin(2 * np.pi * 392 * t) * np.exp(-t * 6.5) * 0.08
    return stereo(lp(y, 1400), 0.35)


def sfx_stream():
    """Soft granular shimmer for 'the answer is generating'."""
    n = int(1.6 * SR)
    y = np.zeros(n)
    rng = np.random.default_rng(21)
    for i in range(16):
        at = int(rng.uniform(0, 1.1) * SR)
        f = rng.choice([1318.5, 1568.0, 1760.0, 2093.0])
        g = note(f, 0.22, "sine") * adsr(int(0.22 * SR), 0.004, 0.09, 0.0, 0.11, peak=0.075)
        m = min(len(g), n - at)
        y[at:at + m] += g[:m]
    return stereo(reverb(y, 0.5, 1.6), 0.8)


SFX = {
    "whoosh": sfx_whoosh, "riser": sfx_riser, "sub": sfx_sub, "chime": sfx_chime,
    "tick": sfx_tick, "click": sfx_click, "type": sfx_type, "confirm": sfx_confirm,
    "pulse": sfx_pulse, "stream": sfx_stream,
}

if __name__ == "__main__":
    out = sys.argv[1]
    total = float(sys.argv[2])
    os.makedirs(out, exist_ok=True)
    write_wav(os.path.join(out, "music.wav"), build_music(total + 1.0))
    print(f"music.wav  {total + 1.0:.1f}s")
    for name, fn in SFX.items():
        x = fn()
        # Normalise every cue to the same peak so no single effect can jump out
        # over the narration; per-cue balance is set in the mix, not here.
        pk = float(np.max(np.abs(x))) or 1.0
        write_wav(os.path.join(out, "sfx", f"{name}.wav"), x / pk * 0.60)
        print(f"sfx/{name}.wav  (peak {pk:.2f} -> 0.60)")
