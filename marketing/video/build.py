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
t0 = m["scenes"][0]["t"]
total = m["end"] - t0


def ff(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


# 1) frames -> silent video (concat demuxer with real per-frame durations)
frames = sorted(os.listdir(FRAMES), key=lambda f: float(f[:-4]))
stamps = [float(f[:-4]) for f in frames]
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
ff("-f", "concat", "-safe", "0", "-i", listfile,
   "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p",
   "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-tune", "stillimage",
   "-t", f"{total:.3f}", silent)
print(f"video  {total:.1f}s  ({len(lines)//2} frames)")

# 2) original score
os.makedirs(AUD, exist_ok=True)
subprocess.run([sys.executable, os.path.join(HERE, "audio.py"), AUD, f"{total:.2f}", "cinematic"], check=True,
               stdout=subprocess.DEVNULL)

# 3) mix: narration on markers, score ducked underneath
inputs, filters, labels = ["-i", os.path.join(AUD, "music.wav")], [], []
for k, sc in enumerate(m["scenes"], start=1):
    inputs += ["-i", os.path.join(VO, f"{sc['id']}.mp3")]
    delay = int((sc["t"] - t0 + m["vo_lead"]) * 1000)
    filters.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={delay}|{delay}[v{k}]")
    labels.append(f"[v{k}]")
n = len(labels)
filters.append(f"{''.join(labels)}amix=inputs={n}:normalize=0,apad,atrim=0:{total:.3f}[vo]")
filters.append("[vo]asplit=2[vo1][vosc]")
filters.append(f"[0:a]atrim=0:{total:.3f},volume=0.30[mus]")
filters.append("[mus][vosc]sidechaincompress=threshold=0.015:ratio=10:attack=15:release=450[duck]")
filters.append(f"[duck][vo1]amix=inputs=2:normalize=0,afade=t=out:st={total-1.6:.2f}:d=1.5,loudnorm=I=-16:TP=-1.5:LRA=11[mix]")
mix = os.path.join(OUT, "mix.wav")
ff(*inputs, "-filter_complex", ";".join(filters), "-map", "[mix]", "-ar", "48000", "-t", f"{total:.3f}", mix)

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
