"""
Narration for the CloakVault demo video, one MP3 per scene, via edge-tts neural voices.

    python marketing/video/tts.py            # cached segments are skipped
    python marketing/video/tts.py --force

Writes marketing/out/vo/<scene>.mp3 and marketing/out/vo/durations.json.
"""
import asyncio, json, os, subprocess, sys

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out", "vo")
script = json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))


def duration(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout.strip())


async def main():
    os.makedirs(OUT, exist_ok=True)
    force = "--force" in sys.argv
    durs = {}
    for s in script["scenes"]:
        dest = os.path.join(OUT, f"{s['id']}.mp3")
        if force or not os.path.exists(dest):
            for attempt in range(4):  # the service drops the odd request; retry politely
                try:
                    await edge_tts.Communicate(s["vo"], script["voice"], rate=script["rate"]).save(dest)
                    break
                except edge_tts.exceptions.NoAudioReceived:
                    if attempt == 3:
                        raise
                    await asyncio.sleep(2 + attempt * 2)
        durs[s["id"]] = round(duration(dest), 3)
        print(f"{s['id']:<16} {durs[s['id']]:6.2f}s")
    json.dump(durs, open(os.path.join(OUT, "durations.json"), "w"), indent=2)
    print(f"total narration {sum(durs.values()):.1f}s")


asyncio.run(main())
