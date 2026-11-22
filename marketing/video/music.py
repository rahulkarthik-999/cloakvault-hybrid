"""
Soft ambient bed for the CloakVault demo — designed to sit *under* narration.

No drums, no melody in the voice range: warm low-passed pads on a slow four-chord loop,
a quiet sub, and a few distant bell tones well above the voice. Original, synthesized with
numpy — no third-party audio.

    python marketing/video/music.py <out.wav> <seconds>
"""
import os, sys

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000


def lp(x, hz):
    return sosfilt(butter(2, hz, "lowpass", fs=SR, output="sos"), x)


def hp(x, hz):
    return sosfilt(butter(2, hz, "highpass", fs=SR, output="sos"), x)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def pad_voice(freq, n, seed):
    """Detuned soft-saw-ish pad from a few sines with slow beating."""
    rng = np.random.default_rng(seed)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for det, amp in [(-0.12, 0.5), (0.0, 0.6), (0.11, 0.5)]:
        f = freq * 2 ** (det / 12)
        ph = rng.uniform(0, 2 * np.pi)
        out += amp * (np.sin(2 * np.pi * f * t + ph) + 0.18 * np.sin(4 * np.pi * f * t + ph))
    return out


def env(n, attack, release):
    e = np.ones(n)
    a, r = min(int(attack * SR), n // 2), min(int(release * SR), n // 2)
    e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    e[n - r :] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return e


def bell(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 3)
    return tone * np.exp(-t * 1.6) * np.minimum(1, t / 0.01)


def build(total):
    n_total = int(total * SR)
    left, right = np.zeros(n_total), np.zeros(n_total)
    # Dmaj9 → Bm9 → Gmaj9 → A6sus  (calm, hopeful, unresolved)
    chords = [
        [50, 57, 61, 64, 66],
        [47, 54, 57, 61, 62],
        [43, 50, 54, 57, 59],
        [45, 52, 54, 57, 59],
    ]
    bar = 6.0
    i = 0
    t0 = 0.0
    while t0 < total:
        ch = chords[i % len(chords)]
        dur = bar + 2.5  # overlap for seamless cross-fades
        n = min(int(dur * SR), n_total - int(t0 * SR))
        if n <= SR // 10:
            break
        s = int(t0 * SR)
        e = env(n, 2.2, 2.4)
        for k, note in enumerate(ch):
            v = pad_voice(midi(note), n, seed=i * 10 + k) * e * (0.11 if k else 0.15)
            pan = 0.5 + 0.35 * np.sin(k * 1.7 + i)
            left[s : s + n] += v * (1 - pan) * 1.4
            right[s : s + n] += v * pan * 1.4
        sub = np.sin(2 * np.pi * midi(ch[0] - 12) * np.arange(n) / SR) * e * 0.10
        left[s : s + n] += sub
        right[s : s + n] += sub
        # one distant bell per bar, high above the voice range
        bt = t0 + 1.5 + (i % 2) * 2.0
        if bt < total - 2:
            b = bell(midi(ch[(i % 3) + 2] + 24), 3.0) * 0.045
            bs = int(bt * SR)
            m = min(len(b), n_total - bs)
            left[bs : bs + m] += b[:m] * 0.6
            right[bs : bs + m] += b[:m] * 1.0
        t0 += bar
        i += 1

    # warm it up and keep 1–4 kHz (speech presence band) clear
    left, right = lp(hp(left, 45), 2200), lp(hp(right, 45), 2200)
    # simple stereo reverb tail
    for x, d in ((left, 0.043), (right, 0.051)):
        dl = int(d * SR)
        for g in (0.35, 0.22, 0.12):
            x[dl:] += g * x[:-dl].copy()
            dl = int(dl * 1.9)
    mix = np.stack([left, right], 1)
    fade = env(n_total, 2.5, 3.0)[:, None]
    mix *= fade
    mix /= max(1e-9, np.abs(mix).max()) / 0.7
    return mix


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    n = pcm.shape[0]
    hdr = b"RIFF" + (36 + n * 4).to_bytes(4, "little") + b"WAVEfmt " + (16).to_bytes(4, "little")
    hdr += (1).to_bytes(2, "little") + (2).to_bytes(2, "little") + SR.to_bytes(4, "little")
    hdr += (SR * 4).to_bytes(4, "little") + (4).to_bytes(2, "little") + (16).to_bytes(2, "little")
    hdr += b"data" + (n * 4).to_bytes(4, "little")
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "wb") as f:
        f.write(hdr + pcm.tobytes())


if __name__ == "__main__":
    write_wav(sys.argv[1], build(float(sys.argv[2])))
    print("wrote", sys.argv[1])
