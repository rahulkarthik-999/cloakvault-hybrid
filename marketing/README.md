# CloakVault marketing pipeline

Everything here films or screenshots the **real app** with live Firebase AI Logic calls. Nothing is mocked.

Requirements: Python 3.11+ with `playwright`, `edge-tts`, `numpy`, `scipy`, `pillow`; `ffmpeg`/`ffprobe` on PATH; Google Chrome.
Start the app first (`npm run dev`, with a Firebase config and an App Check debug token registered for localhost).

## Demo video (≤ 3 min, English narration + subtitles)

```bash
python marketing/video/tts.py                          # narration per scene (edge-tts neural voice)
python marketing/video/record.py http://localhost:5173 # drives the app, captures DevTools screencast frames
python marketing/video/build.py                        # 30 fps H.264 + ducked original score + -16 LUFS
```

Outputs in `marketing/out/` (git-ignored):

| File | Use |
|---|---|
| `cloakvault_demo.mp4` | Upload to YouTube (public or unlisted) and paste the link into Devpost |
| `cloakvault_demo.en.srt` | YouTube → Subtitles → Upload file (English) |
| `youtube_thumbnail.jpg` | YouTube custom thumbnail (1280×720) |

- `script.json` holds the narration. Each scene lasts at least as long as its voice line.
- `overlay.js` adds the on-screen cursor, click ripples, captions and title cards.
- `audio.py` synthesizes an original score with numpy, so there are no third-party music licenses.

## Gallery images (Devpost 3:2, < 5 MB each)

```bash
python marketing/gallery.py http://localhost:5173      # → docs/media/*.jpg + public/og-image.png
python marketing/gallery.py --compose-only             # re-layout without re-capturing
```
