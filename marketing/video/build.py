"""
CloakVault demo — assembly.

Turns the screencast frames from record.py into a constant-30fps H.264 cut, lays each narration
segment on its scene marker, ducks an original synthesized score under the voice, and
loudness-normalises to -16 LUFS (YouTube-friendly).

    python marketing/video/build.py      ->  marketing/out/cloakvault_demo.mp4
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "out"))
FRAMES = os.path.join(OUT, "frames")
VO = os.path.join(OUT, "vo")
AUD = os.path.join(OUT, "audio")
FINAL = os.path.join(OUT, "cloakvault_demo.mp4")

m = json.load(open(os.path.join(OUT, "markers.json")))

# Skipped on-device waits: remove each [from, to) span from the timeline. Frames, scene markers (and so the
# narration), SFX cues and the end time are all shifted left by the cut time that precedes them.
CUTS = sorted(m.get("cuts", []), key=lambda c: c["from"])


def remap(t):
    shift = 0.0
    for c in CUTS:
        if t >= c["to"]:
            shift += c["to"] - c["from"]
        elif t > c["from"]:
            return c["from"] - shift
    return t - shift


for _sc in m["scenes"]:
    _sc["t"] = remap(_sc["t"])
for _c in m.get("cues", []):
    _c["t"] = remap(_c["t"])
m["end"] = remap(m["end"])
if CUTS:
    print("cuts  ", ", ".join(f"{c['skipped']}s" for c in CUTS))

# Speed-fit: on a memory-starved recording rig the UI choreography (cursor glides, clicks, scrolling) can run
# far slower than its narration. Each over-long scene's UI time is sped up just enough to fit its narration
# (max 6x) and tagged on screen. Never sped up: chapter cards, zoom holds, and the 3.5 s after each skip badge.
# AI timings are untouched — the app's own ON_DEVICE / IN_CLOUD labels show the real latency.
DURS = json.load(open(os.path.join(VO, "durations.json")))
LEAD, PADS, MAXK = m["vo_lead"], m.get("pad", 0.3), 6.0
PROT = [(remap(h["from"]), remap(h["to"])) for h in m.get("holds", [])] + \
       [(remap(c["to"]), remap(c["to"]) + 3.5) for c in CUTS]
SEGS = []  # (from, to, k) in post-cut time
_sc = m["scenes"]
for _i, s in enumerate(_sc):
    a, b = s["t"], (_sc[_i + 1]["t"] if _i + 1 < len(_sc) else m["end"])
    span = b - a
    prot = sum(max(0.0, min(b, y) - max(a, x)) for x, y in PROT)
    free = span - prot
    want = DURS[s["id"]] + LEAD + PADS + 0.3
    k = 1.0
    if span > want * 1.05 and free > 0.5:
        k = min(MAXK, max(1.0, free / max(want - prot, free / MAXK)))
    pts = sorted({a, b, *[min(max(x, a), b) for x, y in PROT], *[min(max(y, a), b) for x, y in PROT]})
    for x, y in zip(pts, pts[1:]):
        mid = (x + y) / 2
        SEGS.append((x, y, 1.0 if any(px <= mid < py for px, py in PROT) else k))
    if k > 1.0:
        print(f"speed  {s['id']:<14} {span:5.1f}s -> {prot + free / k:5.1f}s  (UI x{k:.1f})")


def speed(t):
    out = SEGS[0][0] if SEGS else t
    if not SEGS or t <= SEGS[0][0]:
        return t
    for x, y, k in SEGS:
        if t >= y:
            out += (y - x) / k
        else:
            return out + (t - x) / k
    return out + (t - SEGS[-1][1])


for _s in m["scenes"]:
    _s["t"] = speed(_s["t"])
for _c in m.get("cues", []):
    _c["t"] = speed(_c["t"])
m["end"] = speed(m["end"])

t0 = m["scenes"][0]["t"]
total = m["end"] - t0

# on-screen "UI sped up" tags (output-time intervals)
TAGS = []
for x, y, k in SEGS:
    if k > 1.15:
        a2, b2 = speed(x) - t0, speed(y) - t0
        if TAGS and abs(TAGS[-1][1] - a2) < 0.05 and abs(TAGS[-1][2] - k) < 0.01:
            TAGS[-1] = (TAGS[-1][0], b2, k)
        else:
            TAGS.append((a2, b2, k))
TAGS = [t for t in TAGS if t[1] - t[0] >= 0.6]


def ff(*args, cwd=None):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True, cwd=cwd)


# Captions (same chunks/timing as the SRT), burned in as an ASS track so they follow the narration exactly.
sys.path.insert(0, HERE)
from captions import chunks  # noqa: E402

SCRIPT = {s["id"]: s["vo"] for s in json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))["scenes"]}
CAPS = []  # (start, end, text) in output time
for _s in m["scenes"]:
    _t = _s["t"] - t0 + LEAD
    for c in chunks(SCRIPT[_s["id"]], DURS[_s["id"]]):
        CAPS.append((_t, _t + c["ms"] / 1000, c["text"]))
        _t += c["ms"] / 1000


def _ass_time(t):
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


ASS = os.path.join(OUT, "captions.ass")
with open(ASS, "w", encoding="utf-8") as fh:
    fh.write("[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n\n"
             "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
             "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
             "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
             "Style: Cap,Segoe UI Semibold,36,&H00FFFFFF,&H00FFFFFF,&H2415100E,&H2415100E,0,0,0,0,100,100,0,0,"
             "3,12,0,2,300,300,44,1\n\n"
             "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    for a, b, txt in CAPS:
        fh.write(f"Dialogue: 0,{_ass_time(a)},{_ass_time(b)},Cap,,0,0,0,,{txt}\n")


# 1) frames -> silent video (concat demuxer with real per-frame durations)
AUDIO_ONLY = "--audio" in sys.argv  # keep the existing cut, only redo the mix
silent = os.path.join(OUT, "video_silent.mp4")
if not AUDIO_ONLY:
    frames = sorted(os.listdir(FRAMES), key=lambda f: float(f[:-4]))
    stamps = [speed(remap(float(f[:-4]))) for f in frames]
    # the frame on screen at t0 is the last one painted at or before it
    first = max([i for i, s in enumerate(stamps) if s <= t0] or [0])
    lines = []
    for i in range(first, len(frames)):
        start = max(stamps[i], t0)
        stop = stamps[i + 1] if i + 1 < len(frames) else m["end"]
        stop = min(stop, m["end"])
        if stop <= start:
            continue
        lines.append(f"file '{os.path.join(FRAMES, frames[i])}'".replace("\\", "/"))
        lines.append(f"duration {stop - start:.6f}")
    lines.append(lines[-2])  # concat demuxer needs the last file repeated
    listfile = os.path.join(OUT, "frames.txt")
    open(listfile, "w").write("\n".join(lines) + "\n")
    silent = os.path.join(OUT, "video_silent.mp4")
    vf = "fps=30,scale=1920:1080:flags=lanczos,subtitles=captions.ass"
    FONT = "C\\:/Windows/Fonts/segoeuib.ttf"
    for a, b, k in TAGS:
        vf += (f",drawtext=fontfile='{FONT}':text='UI sped up {k:.0f}x':fontsize=24:fontcolor=white@0.92"
               f":box=1:boxcolor=0x0E1015@0.72:boxborderw=12:x=w-tw-48:y=96"
               f":enable='between(t,{a:.2f},{b:.2f})'")
    vf += ",format=yuv420p"
    ff("-f", "concat", "-safe", "0", "-i", "frames.txt", "-vf", vf,
       "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-tune", "stillimage",
       "-t", f"{total:.3f}", "video_silent.mp4", cwd=OUT)
    print(f"video  {total:.1f}s  ({len(lines)//2} frames)")

# 2) original score
os.makedirs(AUD, exist_ok=True)
subprocess.run([sys.executable, os.path.join(HERE, "music.py"), os.path.join(AUD, "music.wav"), f"{total:.2f}"],
               check=True, stdout=subprocess.DEVNULL)

# 2b) sound design: synthesize the cue set, then lay every recorded cue on one track
import numpy as np  # noqa: E402
from scipy.io import wavfile  # noqa: E402

SFX_DIR = os.path.join(AUD, "sfxgen")
subprocess.run([sys.executable, os.path.join(HERE, "audio.py"), SFX_DIR, "12"], check=True, stdout=subprocess.DEVNULL)
SR = 48000
track = np.zeros((int((total + 2) * SR), 2), dtype=np.float32)
bank = {}
for cue_ in m.get("cues", []):
    name = cue_["name"]
    if name not in bank:
        rate, x = wavfile.read(os.path.join(SFX_DIR, "sfx", f"{name}.wav"))
        bank[name] = x.astype(np.float32) / 32768.0
    x = bank[name] * cue_["gain"] * 0.42
    at = int((cue_["t"] - t0) * SR)
    if 0 <= at < len(track):
        n = min(len(x), len(track) - at)
        track[at : at + n] += x[:n]
wavfile.write(os.path.join(AUD, "sfx.wav"), SR, (np.clip(track, -1, 1) * 32767).astype(np.int16))
print(f"sfx    {len(m.get('cues', []))} cues")

# 3) mix: narration on markers, score ducked underneath
inputs, filters, labels = ["-i", os.path.join(AUD, "music.wav")], [], []
SFX_IN = len(m["scenes"]) + 1  # input index of the sfx track (appended after the narration)
for k, sc in enumerate(m["scenes"], start=1):
    inputs += ["-i", os.path.join(VO, f"{sc['id']}.mp3")]
    delay = int((sc["t"] - t0 + m["vo_lead"]) * 1000)
    filters.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={delay}|{delay}[v{k}]")
    labels.append(f"[v{k}]")
n = len(labels)
filters.append(f"{''.join(labels)}amix=inputs={n}:normalize=0,apad,atrim=0:{total:.3f}[vo]")
filters.append("[vo]asplit=2[vo1][vosc]")
filters.append(f"[0:a]atrim=0:{total:.3f},volume=0.11[mus]")
filters.append("[mus][vosc]sidechaincompress=threshold=0.01:ratio=14:attack=10:release=700:makeup=1[duck]")
inputs_sfx = ["-i", os.path.join(AUD, "sfx.wav")]
filters.append(f"[{SFX_IN}:a]atrim=0:{total:.3f}[sfx]")
filters.append(f"[duck][vo1][sfx]amix=inputs=3:normalize=0,afade=t=out:st={total-1.6:.2f}:d=1.5,loudnorm=I=-16:TP=-1.5:LRA=11[mix]")
mix = os.path.join(OUT, "mix.wav")
ff(*inputs, *inputs_sfx, "-filter_complex", ";".join(filters), "-map", "[mix]", "-ar", "48000", "-t", f"{total:.3f}", mix)

# 4) mux
ff("-i", silent, "-i", mix, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", FINAL)
print("wrote", FINAL)

# 5) English subtitles for YouTube (same chunks that are burned in)
sys.path.insert(0, HERE)
from captions import chunks  # noqa: E402

script = {s["id"]: s["vo"] for s in json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))["scenes"]}
durs = json.load(open(os.path.join(VO, "durations.json")))


def stamp(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


cues, n = [], 1
for sc in m["scenes"]:
    t = sc["t"] - t0 + m["vo_lead"]
    for c in chunks(script[sc["id"]], durs[sc["id"]]):
        cues.append(f"{n}\n{stamp(t)} --> {stamp(t + c['ms'] / 1000)}\n{c['text']}\n")
        t += c["ms"] / 1000
        n += 1
open(os.path.join(OUT, "cloakvault_demo.en.srt"), "w", encoding="utf-8").write("\n".join(cues))
print("wrote cloakvault_demo.en.srt", n - 1, "cues")

# 6) web copy for the landing page: lighter MP4, WebVTT captions, poster frame
WEB = os.path.join(os.path.dirname(OUT), "..", "public", "media")
WEB = os.path.abspath(WEB)
os.makedirs(WEB, exist_ok=True)
ff("-i", FINAL, "-c:v", "libx264", "-preset", "slow", "-crf", "29", "-tune", "stillimage", "-pix_fmt", "yuv420p",
   "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(WEB, "cloakvault-demo.mp4"))
srt = open(os.path.join(OUT, "cloakvault_demo.en.srt"), encoding="utf-8").read()
vtt = "WEBVTT\n\n" + "\n".join(
    line.replace(",", ".") if "-->" in line else line for line in srt.splitlines()
) + "\n"
open(os.path.join(WEB, "cloakvault-demo.en.vtt"), "w", encoding="utf-8").write(vtt)
ff("-ss", "4.2", "-i", FINAL, "-frames:v", "1", "-q:v", "3", os.path.join(WEB, "demo-poster.jpg"))
print("web copy", round(os.path.getsize(os.path.join(WEB, "cloakvault-demo.mp4")) / 1e6, 1), "MB ->", WEB)
