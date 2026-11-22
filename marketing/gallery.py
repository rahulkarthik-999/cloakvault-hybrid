"""
CloakVault product gallery.

1) Captures real app states (landing, redaction, live hybrid audit, wire proof, telemetry) at 2x.
2) Composes 3:2 marketing cards (3000x2000 JPEG, < 5 MB — Devpost gallery spec) plus a
   1200x630 Open Graph image, into docs/media/ and public/og-image.png.

    python marketing/gallery.py [base_url]     # default http://localhost:5173
"""
import asyncio, base64, os, sys

from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
RAW = os.path.join(HERE, "out", "raw")
MEDIA = os.path.join(ROOT, "docs", "media")
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173").rstrip("/")

FONTS = (
    '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400..600'
    '&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">'
)
MARK = (
    '<svg width="{s}" height="{s}" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0E1015"/>'
    '<path d="M32 11 L14 18.5 V31 C14 42.6 21.6 51.6 32 55 Z" fill="#10B981"/>'
    '<path d="M32 11 L50 18.5 V31 C50 42.6 42.4 51.6 32 55 Z" fill="#6366F1"/>'
    '<circle cx="32" cy="29" r="5.2" fill="#0E1015"/><path d="M29.4 31.5 h5.2 l1.6 10.5 h-8.4 z" fill="#0E1015"/></svg>'
)

CSS = """
*{box-sizing:border-box;margin:0}
body{width:1500px;height:1000px;overflow:hidden;font-family:Geist,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.serif{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.01em}
.mono{font-family:'Geist Mono',ui-monospace,monospace}
.light{background:#F3F4F7;color:#0E1015}
.dark{background:#0E1015;color:#fff;background-image:radial-gradient(520px 380px at 12% 18%,rgba(16,185,129,.20),transparent),
  radial-gradient(560px 420px at 92% 88%,rgba(99,102,241,.24),transparent)}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(14,16,21,.05) 1px,transparent 1px),
  linear-gradient(to bottom,rgba(14,16,21,.05) 1px,transparent 1px);background-size:50px 50px;
  mask-image:radial-gradient(ellipse 80% 70% at 50% 40%,#000 30%,transparent 100%)}
.eyebrow{font-family:'Geist Mono',monospace;font-size:15px;letter-spacing:.2em;text-transform:uppercase}
.frame{border-radius:16px;overflow:hidden;background:#fff;border:1px solid #E5E7EC;
  box-shadow:0 40px 90px -35px rgba(14,16,21,.45)}
.bar{height:34px;background:#FAFBFC;border-bottom:1px solid #E5E7EC;display:flex;align-items:center;gap:7px;padding:0 14px}
.bar i{width:11px;height:11px;border-radius:50%;background:#E5E7EC;display:block}
.bar span{margin-left:14px;font:13px 'Geist Mono',monospace;color:#697083}
img{display:block}
.pill{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:8px 15px;font:14px 'Geist Mono',monospace}
.dev{background:#ECFDF5;color:#047857;border:1px solid #A7F3D0}
.cld{background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE}
.brand{position:absolute;display:flex;align-items:center;gap:10px;font-family:'Instrument Serif',serif;font-size:28px}
"""


def data_url(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()


def raw(name):
    return data_url(os.path.join(RAW, name + ".png"))


def page_html(body_class, inner):
    return f"<!doctype html><html><head><meta charset='utf-8'>{FONTS}<style>{CSS}</style></head><body class='{body_class}'>{inner}</body></html>"


def brand(dark=False, pos="left:70px;bottom:52px"):
    color = "#fff" if dark else "#0E1015"
    return f'<div class="brand" style="{pos};color:{color}">{MARK.format(s=34)}CloakVault</div>'


def browser(img, url="cloakvault-hybrid.web.app/app", style=""):
    return f'<div class="frame" style="{style}"><div class="bar"><i></i><i></i><i></i><span>{url}</span></div><img src="{img}" style="width:100%"></div>'


def cards():
    out = {}
    # 01 — hero
    out["01-hero"] = page_html("dark", f"""
      <div style="position:absolute;left:70px;right:70px;top:56px;text-align:center">
        <div style="display:flex;justify-content:center;align-items:center;gap:12px" class="serif">{MARK.format(s=40)}<span style="font-size:32px">CloakVault</span></div>
        <div class="serif" style="font-size:70px;line-height:1.0;margin-top:22px">Frontier AI for your contracts. <em style="color:#A5B4FC">Zero</em> secrets in the cloud.</div>
        <div style="display:flex;gap:10px;margin-top:22px;justify-content:center">
          <span class="pill dev">ON-DEVICE · Gemini Nano</span><span class="pill cld">CLOUD · Gemini via Firebase AI Logic</span></div>
      </div>
      {browser(raw('app_audit'), style='position:absolute;left:110px;top:330px;width:1280px')}""")
    # 02 — redaction before/after
    out["02-redaction"] = page_html("light", f"""<div class="grid"></div>
      <div style="position:absolute;left:70px;top:62px;right:70px;text-align:center">
        <div class="eyebrow" style="color:#047857">Stage 1 · ONLY_ON_DEVICE</div>
        <div class="serif" style="font-size:60px;line-height:1.05;margin-top:12px">Personal data is redacted before any AI sees it.</div></div>
      <div style="position:absolute;left:70px;top:230px;width:665px">
        <div class="mono" style="font-size:15px;color:#697083;margin-bottom:10px">ORIGINAL · stays in this browser</div>
        <div class="frame" style="height:700px"><img src="{raw('doc_original')}" style="width:100%"></div></div>
      <div style="position:absolute;right:70px;top:230px;width:665px">
        <div class="mono" style="font-size:15px;color:#047857;margin-bottom:10px">WHAT THE AI SEES · reversible local tokens</div>
        <div class="frame" style="border-color:#A7F3D0;height:700px"><img src="{raw('doc_redacted')}" style="width:100%"></div></div>
      """)
    # 03 — audit
    out["03-risk-audit"] = page_html("light", f"""<div class="grid"></div>
      <div style="position:absolute;left:70px;top:90px;width:560px">
        <div class="eyebrow" style="color:#4338CA">Stage 3 · PREFER_IN_CLOUD</div>
        <div class="serif" style="font-size:64px;line-height:1.02;margin-top:16px">A lawyer-grade risk audit. Only tokens went to the cloud.</div>
        <div style="font-size:20px;line-height:1.55;color:#4A5061;margin-top:24px">Gemini returns a 0–100 risk score, exact clause quotes you can jump to, and ready-to-send redlines — then real names are re-hydrated locally.</div>
        <div style="margin-top:28px;display:flex;flex-direction:column;gap:10px;font-size:18px;color:#1E2129">
          <div>● Clickable <b>Locate ↗</b> clause jump</div><div>● Strikethrough + proposed redlines</div><div>● Re-hydrated ⇄ cloud-token X-ray toggle</div></div>
      </div>
      <div class="frame" style="position:absolute;right:70px;top:60px;width:700px;height:880px"><img src="{raw('inspector_audit')}" style="width:100%"></div>
      {brand(pos='left:70px;bottom:52px')}""")
    # 04 — wire proof
    out["04-zero-leak-proof"] = page_html("dark", f"""
      <div style="position:absolute;left:70px;top:70px;right:70px">
        <div class="eyebrow" style="color:#34D399">Proof, not promises</div>
        <div class="serif" style="font-size:64px;line-height:1.02;margin-top:14px">Inspect the exact bytes that left your browser.</div></div>
      {browser(raw('doc_wire'), style='position:absolute;left:70px;top:255px;width:860px;height:700px')}
      <div style="position:absolute;left:980px;top:270px;width:450px;display:flex;flex-direction:column;gap:22px;font-size:20px;line-height:1.45;color:rgba(255,255,255,.78)">
        <div><b style="color:#fff">0 bytes</b> of raw PII in the outbound payload — the token keymap never leaves the device.</div>
        <div><b style="color:#fff">SHA-256</b> of original and redacted text, computed with Web Crypto.</div>
        <div><b style="color:#fff">Strict PII Shield</b> (Remote Config) blocks escalation if any entity is exposed.</div>
        <div><b style="color:#fff">Firestore rules</b> reject any vault not flagged <span class="mono" style="color:#34D399">zeroLeakVerified</span>.</div>
      </div>
      """)
    # 05 — routing + telemetry
    rows = "".join(
        f'<div style="display:flex;justify-content:space-between;align-items:center;padding:17px 0;border-top:1px solid #EEF0F3">'
        f'<span style="font-size:20px;font-weight:500">{t}</span><span class="pill {c}">{m}</span></div>'
        for t, m, c in [
            ("Contextual PII discovery", "ONLY_ON_DEVICE", "dev"),
            ("Triage summary", "PREFER_ON_DEVICE", "dev"),
            ("Streaming Q&amp;A", "PREFER_ON_DEVICE", "dev"),
            ("Deep risk audit + redlines", "PREFER_IN_CLOUD", "cld"),
        ]
    )
    out["05-hybrid-routing"] = page_html("light", f"""<div class="grid"></div>
      <div style="position:absolute;left:70px;top:80px;width:640px">
        <div class="eyebrow" style="color:#4338CA">Firebase AI Logic · hybrid inference</div>
        <div class="serif" style="font-size:62px;line-height:1.02;margin-top:14px">Every task runs in the cheapest safe place.</div>
        <div class="frame" style="padding:8px 28px 10px;margin-top:36px">{rows}</div>
        <div style="font-size:17px;color:#697083;margin-top:18px;line-height:1.5">No Nano on the device? The SDK falls back to cloud Gemini automatically. Modes, model and shield are live-tunable in Remote Config.</div>
      </div>
      <div class="frame" style="position:absolute;right:70px;top:80px;width:640px;height:840px"><img src="{raw('inspector_telemetry')}" style="width:100%"></div>
      {brand(pos='left:70px;bottom:44px')}""")
    # 06 — firebase stack
    tiles = "".join(
        f'<div style="border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:20px;padding:30px">'
        f'<div style="width:14px;height:14px;border-radius:4px;background:{c}"></div>'
        f'<div style="font-weight:600;font-size:27px;margin-top:20px">{t}</div>'
        f'<div style="font-size:18px;line-height:1.5;color:rgba(255,255,255,.62);margin-top:10px">{d}</div></div>'
        for t, d, c in [
            ("Firebase AI Logic", "getGenerativeModel() per task with InferenceMode — Gemini Nano on-device, Gemini in the cloud, streaming + inferenceSource.", "#10B981"),
            ("App Check", "reCAPTCHA Enterprise attests every cloud inference request.", "#6366F1"),
            ("Remote Config", "Live policy: per-task modes, cloud model name, strict PII shield, context size.", "#F59E0B"),
            ("Cloud Firestore", "Redacted vaults + telemetry only. Rules require zeroLeakVerified and an allowlisted schema.", "#10B981"),
            ("Authentication", "Invisible anonymous guest for sync; optional Google sign-in. No sign-up wall.", "#6366F1"),
            ("Hosting + Chrome", "cloakvault-hybrid.web.app and a Chrome side-panel extension for any web page.", "#F59E0B"),
        ]
    )
    out["06-firebase-stack"] = page_html("dark", f"""
      <div style="position:absolute;left:70px;right:70px;top:70px;text-align:center">
        <div class="eyebrow" style="color:#A5B4FC">Built on Firebase</div>
        <div class="serif" style="font-size:66px;line-height:1.02;margin-top:14px">One hybrid SDK. Six Firebase products.</div></div>
      <div style="position:absolute;left:70px;right:70px;top:265px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px">{tiles}</div>
      {brand(True)}""")
    # 07 — use cases
    out["07-use-cases"] = page_html("light", f"""<div class="grid"></div>
      <div style="position:absolute;left:70px;right:70px;top:62px;text-align:center">
        <div class="eyebrow" style="color:#047857">Who it’s for</div>
        <div class="serif" style="font-size:60px;line-height:1.05;margin-top:12px">Contracts, bank statements and hospital bills.</div></div>
      <div style="position:absolute;left:70px;right:70px;top:230px;display:grid;grid-template-columns:repeat(3,1fr);gap:26px">
        {''.join(f'<div><div style="font-size:22px;font-weight:600">{t}</div><div style="font-size:16px;color:#697083;margin:4px 0 14px">{d}</div><div class="frame" style="height:640px"><img src="{raw(k)}" style="width:100%"></div></div>' for k, t, d in [
            ('doc_redacted', 'Freelancers &amp; founders', 'Auto-renewal traps, uncapped indemnity, IP grabs'),
            ('use_financial', 'Small finance teams', 'Duplicate SaaS billing, hidden wire fees'),
            ('use_medical', 'Patients &amp; caregivers', 'Upcoded ER visits, duplicate lab panels'),
        ])}
      </div>
      """)
    return out


OG = page_html("dark", f"""
  <div style="position:absolute;left:80px;top:90px;width:1000px">
    <div style="display:flex;align-items:center;gap:16px" class="serif">{MARK.format(s=64)}<span style="font-size:52px">CloakVault</span></div>
    <div class="serif" style="font-size:84px;line-height:1.0;margin-top:40px">Frontier AI for your contracts.<br/><em style="color:#A5B4FC">Zero</em> secrets in the cloud.</div>
    <div class="mono" style="font-size:22px;color:#34D399;margin-top:34px">Gemini Nano on-device · Gemini in the cloud · Firebase AI Logic</div>
  </div>""")


async def capture(p):
    os.makedirs(RAW, exist_ok=True)
    b = await p.chromium.launch(channel="chrome", args=["--hide-scrollbars"])
    ctx = await b.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=2)
    pg = await ctx.new_page()
    await pg.goto(BASE + "/app", wait_until="networkidle")
    await pg.evaluate("document.fonts.ready")
    await pg.wait_for_timeout(1500)
    paper = pg.locator(".paper-sheet").first
    await pg.get_by_role("button", name="Original (Local)").click()
    await pg.wait_for_timeout(500)
    await paper.screenshot(path=os.path.join(RAW, "doc_original.png"))
    await pg.get_by_role("button", name="Redacted View").click()
    await pg.wait_for_timeout(500)
    await paper.screenshot(path=os.path.join(RAW, "doc_redacted.png"))
    await pg.screenshot(path=os.path.join(RAW, "use_legal.png"))

    await pg.get_by_text("Run Hybrid Audit", exact=True).first.click()
    await pg.get_by_text("/ 100").first.wait_for(timeout=60000)
    await pg.wait_for_timeout(800)
    await pg.screenshot(path=os.path.join(RAW, "app_audit.png"))
    await pg.locator("aside").last.screenshot(path=os.path.join(RAW, "inspector_audit.png"))

    await pg.get_by_role("button", name="Outbound Cloud Payload").click()
    await pg.wait_for_timeout(700)
    await pg.locator("section").first.screenshot(path=os.path.join(RAW, "doc_wire.png"))

    await pg.get_by_role("button", name="Ask", exact=True).click()
    await pg.locator("button.block.w-full").first.click()
    await pg.locator("text=/Total \\d+ms/").first.wait_for(timeout=60000)
    await pg.get_by_role("button", name="Telemetry").click()
    await pg.wait_for_timeout(600)
    await pg.locator("aside").last.screenshot(path=os.path.join(RAW, "inspector_telemetry.png"))

    for key, label in [("use_financial", "Financial Ledger"), ("use_medical", "Medical Bill")]:
        await pg.get_by_role("button", name=label).click()
        await pg.wait_for_timeout(800)
        await pg.get_by_role("button", name="Redacted View").click()
        await pg.wait_for_timeout(500)
        await paper.screenshot(path=os.path.join(RAW, key + ".png"))
    await b.close()


async def compose(p):
    os.makedirs(MEDIA, exist_ok=True)
    b = await p.chromium.launch(channel="chrome")
    pg = await b.new_page(viewport={"width": 1500, "height": 1000}, device_scale_factor=2)
    tmp = os.path.join(HERE, "out", "card.png")
    from PIL import Image

    for name, html in cards().items():
        await pg.set_content(html, wait_until="networkidle")
        await pg.evaluate("document.fonts.ready")
        await pg.screenshot(path=tmp)
        dest = os.path.join(MEDIA, name + ".jpg")
        Image.open(tmp).convert("RGB").save(dest, quality=90, optimize=True, progressive=True)
        print(f"{name:<22} {os.path.getsize(dest) / 1e6:.2f} MB")

    await pg.set_viewport_size({"width": 1200, "height": 630})
    await pg.set_content(OG.replace("width:1500px;height:1000px", "width:1200px;height:630px"), wait_until="networkidle")
    await pg.evaluate("document.fonts.ready")
    og = os.path.join(ROOT, "public", "og-image.png")
    await pg.screenshot(path=tmp)
    Image.open(tmp).resize((1200, 630), Image.LANCZOS).save(og, optimize=True)
    print("og-image.png", os.path.getsize(og) // 1000, "KB")
    await b.close()


async def main():
    async with async_playwright() as p:
        if "--compose-only" not in sys.argv:
            await capture(p)
        await compose(p)


asyncio.run(main())
