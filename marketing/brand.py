"""
Builds web-ready brand assets from the master logo (marketing/brand-source-logo.png):
transparent mark + wordmark (light and dark variants), favicons, PWA and Apple touch icons.

    python marketing/brand.py
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "public", "brand")
os.makedirs(OUT, exist_ok=True)
src = np.asarray(Image.open(os.path.join(HERE, "brand-source-logo.png")).convert("RGBA")).astype(np.float32)
H, W, _ = src.shape


def to_png(rgba, path, pad=0.04):
    ys, xs = np.where(rgba[..., 3] > 8)
    im = Image.fromarray(rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1].astype(np.uint8), "RGBA")
    p = int(max(im.size) * pad)
    canvas = Image.new("RGBA", (im.width + 2 * p, im.height + 2 * p), (0, 0, 0, 0))
    canvas.paste(im, (p, p))
    canvas.save(path, optimize=True)
    return canvas


# The master already has a transparent background: split mark | wordmark and trim.
split = int(W * 0.272)
mark_img = to_png(src[:, :split].copy(), os.path.join(OUT, "mark.png"))
text = src[:, split:].copy()
to_png(text, os.path.join(OUT, "wordmark.png"), pad=0.02)
# dark-background version: navy "Cloak" -> white, cyan "Vault" unchanged
rgb = text[..., :3]
navy = (rgb.mean(axis=2) < 90) & (rgb[..., 2] - rgb[..., 0] < 90)
dark = text.copy()
dark[navy, :3] = 255
to_png(dark, os.path.join(OUT, "wordmark-dark.png"), pad=0.02)

# --- icons ---
def square_icon(size, bg=None, scale=0.86, radius=0.0):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0) if bg is None else bg)
    m = mark_img.copy()
    m.thumbnail((int(size * scale), int(size * scale)), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return canvas

for s in (16, 32, 48):
    square_icon(s, scale=1.0).save(os.path.join(OUT, f"favicon-{s}.png"))
square_icon(32, scale=1.0).save(os.path.join(ROOT, "public", "favicon.png"))
square_icon(256, scale=1.0).save(os.path.join(ROOT, "public", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
square_icon(180, bg=(255, 255, 255, 255), scale=0.78).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))
square_icon(192, bg=(255, 255, 255, 255), scale=0.8).save(os.path.join(OUT, "icon-192.png"))
square_icon(512, bg=(255, 255, 255, 255), scale=0.8).save(os.path.join(OUT, "icon-512.png"))
square_icon(512, bg=(255, 255, 255, 255), scale=0.62).save(os.path.join(OUT, "icon-maskable-512.png"))
print("mark", mark_img.size, "->", sorted(os.listdir(OUT)))
