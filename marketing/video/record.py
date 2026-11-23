"""
CloakVault demo recorder.

Drives the REAL app (landing + workbench, live Firebase AI Logic calls) in Chrome and captures
every painted frame through the DevTools screencast, so text stays crisp. Each scene lasts at
least as long as its narration (from tts.py). Scene start times go to out/markers.json for build.py.

    python marketing/video/record.py [base_url]      # default http://localhost:5173
"""
import asyncio, base64, json, os, re, sys, time

from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from captions import chunks  # noqa: E402
import cards  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out")
FRAMES = os.path.join(OUT, "frames")
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173").rstrip("/")
PAD = 0.3  # breathing room after each narration line
CHAPTER_SECS = 2.1  # illustrated chapter cards (no narration)
VO_LEAD = 0.25  # narration starts this long after the scene cut

script = json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))
VO = {s["id"]: s["vo"] for s in script["scenes"]}
DUR = json.load(open(os.path.join(OUT, "vo", "durations.json")))
OVERLAY = open(os.path.join(HERE, "overlay.js"), encoding="utf-8").read()

MARK_SVG = (
    '<svg width="{s}" height="{s}" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0E1015"/>'
    '<path d="M32 11 L14 18.5 V31 C14 42.6 21.6 51.6 32 55 Z" fill="#10B981"/>'
    '<path d="M32 11 L50 18.5 V31 C50 42.6 42.4 51.6 32 55 Z" fill="#6366F1"/>'
    '<circle cx="32" cy="29" r="5.2" fill="#0E1015"/><path d="M29.4 31.5 h5.2 l1.6 10.5 h-8.4 z" fill="#0E1015"/></svg>'
)
DARK = (
    "position:absolute;inset:0;background:#0E1015;"
    "background-image:radial-gradient(600px 420px at 18% 22%,rgba(16,185,129,.18),transparent),"
    "radial-gradient(640px 460px at 85% 80%,rgba(99,102,241,.22),transparent);"
)
SERIF = "font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.01em"
SANS = "font-family:Geist,system-ui,sans-serif"
MONO = "font-family:'Geist Mono',ui-monospace,monospace"


def chip(t, color):
    return (
        f'<span style="{MONO};font-size:20px;padding:10px 18px;border-radius:999px;'
        f'border:1px solid {color}55;color:{color};background:{color}14">{t}</span>'
    )


CARD_HOOK = f"""<div style="{DARK}"></div>
<div style="position:relative;text-align:center;color:#fff;max-width:1250px">
  <div style="{MONO};font-size:18px;letter-spacing:.22em;color:#34D399;text-transform:uppercase">The privacy tax on AI</div>
  <div style="{SERIF};font-size:104px;line-height:1.02;margin-top:26px">Would you paste your NDA<br/>into a <em style="color:#A5B4FC">chatbot</em>?</div>
  <div style="display:flex;gap:14px;justify-content:center;margin-top:46px;flex-wrap:wrap">
    {chip('Names','#FCA5A5')}{chip('Bank accounts','#FCA5A5')}{chip('Tax IDs','#FCA5A5')}{chip('Home addresses','#FCA5A5')}{chip('Medical codes','#FCA5A5')}
  </div>
</div>"""


def tile(title, body, color):
    return (
        f'<div style="text-align:left;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);'
        f'border-radius:20px;padding:26px 28px"><div style="width:12px;height:12px;border-radius:4px;background:{color}"></div>'
        f'<div style="{SANS};font-weight:600;font-size:25px;margin-top:18px">{title}</div>'
        f'<div style="{SANS};font-size:18px;line-height:1.45;color:rgba(255,255,255,.62);margin-top:8px">{body}</div></div>'
    )


CARD_STACK = f"""<div style="{DARK}"></div>
<div style="position:relative;color:#fff;width:1320px">
  <div style="{MONO};font-size:18px;letter-spacing:.22em;color:#A5B4FC;text-transform:uppercase;text-align:center">Built on Firebase</div>
  <div style="{SERIF};font-size:76px;line-height:1.05;margin-top:16px;text-align:center">One hybrid SDK. Six Firebase products.</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:46px">
    {tile('Firebase AI Logic','getGenerativeModel() with per-task InferenceMode — Gemini Nano on-device, Gemini in the cloud','#10B981')}
    {tile('App Check','reCAPTCHA Enterprise attests every cloud inference request','#6366F1')}
    {tile('Remote Config','Live policy: inference modes, cloud model, strict PII shield','#F59E0B')}
    {tile('Cloud Firestore','Redacted vaults only — rules require zeroLeakVerified','#10B981')}
    {tile('Authentication','Invisible anonymous guest, optional Google sign-in','#6366F1')}
    {tile('Hosting','cloakvault.buzz + Chrome side panel extension','#F59E0B')}
  </div>
</div>"""

CARD_OUTRO = f"""<div style="{DARK}"></div>
<div style="position:relative;text-align:center;color:#fff">
  <div style="display:flex;justify-content:center">{MARK_SVG.format(s=120)}</div>
  <div style="{SERIF};font-size:120px;line-height:1;margin-top:28px">CloakVault</div>
  <div style="{SANS};font-size:34px;color:rgba(255,255,255,.75);margin-top:18px">Get the second opinion. Keep the secrets.</div>
  <div style="{MONO};font-size:26px;color:#34D399;margin-top:46px">cloakvault.buzz</div>
  <div style="{SANS};font-size:19px;color:rgba(255,255,255,.45);margin-top:16px">#BuildHybridAI 2026 · Firebase AI Logic · Open source (Apache-2.0)</div>
</div>"""


def route_row(task, mode, device):
    c, bg = ("#047857", "#ECFDF5") if device else ("#4338CA", "#EEF2FF")
    return (
        f'<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-top:1px solid #EEF0F3">'
        f'<span style="font-size:17px;font-weight:500;color:#1E2129">{task}</span>'
        f'<span style="{MONO};font-size:13px;padding:5px 11px;border-radius:999px;color:{c};background:{bg}">{mode}</span></div>'
    )


PANEL_ROUTING = (
    f'<div style="{MONO};font-size:12px;letter-spacing:.16em;color:#697083;text-transform:uppercase">Firebase AI Logic · per-task routing</div>'
    f'<div style="{SERIF};font-size:34px;line-height:1.1;margin:8px 0 12px;color:#0E1015">Cheapest safe place, every time.</div>'
    + route_row("Contextual PII discovery", "ONLY_ON_DEVICE", True)
    + route_row("Triage summary", "PREFER_ON_DEVICE", True)
    + route_row("Streaming Q&amp;A", "PREFER_ON_DEVICE", True)
    + route_row("Deep risk audit + redlines", "PREFER_IN_CLOUD", False)
    + '<div style="margin-top:12px;font-size:14px;color:#697083">No Nano in this browser → SDK falls back to cloud Gemini. Modes live in Remote Config.</div>'
)

PANEL_EXTENSION = (
    f'<div style="{MONO};font-size:12px;letter-spacing:.16em;color:#697083;text-transform:uppercase">Also in the box</div>'
    f'<div style="{SERIF};font-size:34px;line-height:1.1;margin:8px 0 12px;color:#0E1015">Chrome side panel extension</div>'
    '<div style="font-size:16px;line-height:1.55;color:#4A5061">Open it on any Terms of Service or invoice page. It scans and redacts on-device with Gemini Nano, '
    'then hands the sanitized text to the workbench for a full hybrid audit.</div>'
)


def caption_chunks(scene_id):
    return chunks(VO[scene_id], DUR[scene_id])


CARD_HOOK = cards.CARD_HOOK
CARD_OUTRO = cards.CARD_OUTRO
CARD_STACK = CARD_STACK.replace(DARK, cards.BG)


async def main():
    os.makedirs(FRAMES, exist_ok=True)
    for f in os.listdir(FRAMES):
        os.remove(os.path.join(FRAMES, f))

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", args=["--hide-scrollbars"])
        ctx = await browser.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=1.2)
        await ctx.add_init_script(OVERLAY)
        page = await ctx.new_page()
        await page.goto(BASE + "/", wait_until="networkidle")
        await page.evaluate("document.fonts.ready")
        await page.wait_for_timeout(800)

        cdp = await ctx.new_cdp_session(page)
        n_frames = 0

        def on_frame(ev):
            nonlocal n_frames
            ts = ev["metadata"]["timestamp"]
            with open(os.path.join(FRAMES, f"{ts:.6f}.jpg"), "wb") as fh:
                fh.write(base64.b64decode(ev["data"]))
            n_frames += 1
            asyncio.ensure_future(cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]}))

        cdp.on("Page.screencastFrame", on_frame)

        markers = []
        cues = []  # sound-design cues: {t, name, gain}

        def cue(name, gain=1.0, at=None):
            cues.append({"t": at if at is not None else time.time(), "name": name, "gain": gain})

        mouse = {"x": 800, "y": 450}

        async def move(x, y, steps=28):
            await page.mouse.move(x, y, steps=steps)
            mouse.update(x=x, y=y)

        async def click(locator, pause=0.25):
            box = await locator.bounding_box()
            await move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            await asyncio.sleep(pause)
            cue("click", 0.55)
            await page.mouse.click(mouse["x"], mouse["y"])

        async def caps(scene_id):
            await asyncio.sleep(VO_LEAD)
            await page.evaluate("c => window.__cvCaptions(c)", caption_chunks(scene_id))

        async def card(html, sfx="whoosh"):
            cue(sfx, 0.7)
            await page.evaluate("h => window.__cvCard(h)", html)

        async def chapter(html):
            await page.evaluate("() => window.__cvCursor(false)")
            cue("riser", 0.45)
            await card(html)
            cue("sub", 0.5, at=time.time() + 0.35)
            await asyncio.sleep(CHAPTER_SECS)
            cue("whoosh", 0.5)
            await page.evaluate("() => window.__cvCard(null)")
            await asyncio.sleep(0.5)
            await page.evaluate("() => window.__cvCursor(true)")

        async def zoom(sel, scale, hold):
            await page.evaluate("() => window.__cvCursor(false)")
            cue("whoosh", 0.3)
            await page.evaluate("([s, k]) => window.__cvZoom(s, k)", [sel, scale])
            await asyncio.sleep(hold)
            cue("whoosh", 0.22)
            await page.evaluate("() => window.__cvZoom(null)")
            await asyncio.sleep(1.0)
            await page.evaluate("() => window.__cvCursor(true)")

        async def scene(scene_id, action):
            t0 = time.time()
            markers.append({"id": scene_id, "t": t0})
            cap_task = asyncio.ensure_future(caps(scene_id))
            await action()
            await cap_task
            left = DUR[scene_id] + VO_LEAD + PAD - (time.time() - t0)
            if left > 0:
                await asyncio.sleep(left)
            print(f"{scene_id:<16} {time.time() - t0:6.2f}s")

        # Start on the hook card, already covering the landing page.
        await page.evaluate("h => window.__cvCard(h)", CARD_HOOK)
        await page.evaluate("() => window.__cvCursor(false)")
        await page.wait_for_timeout(700)
        await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1920, "maxHeight": 1080})
        await page.wait_for_timeout(400)
        rec_start = time.time()
        # hook chips flip from raw PII to tokens (timings mirror cards._chip)
        for i in range(4):
            cue("tick", 0.5, at=rec_start + 1.6 + i * 0.28 + 0.5)
        cue("confirm", 0.35, at=rec_start + 1.6 + 3 * 0.28 + 1.1)

        async def s01():
            pass

        async def s02():
            cue("whoosh", 0.6)
            await page.evaluate("() => window.__cvCard(null)")
            await page.evaluate("() => window.__cvCursor(true)")
            await move(760, 520, steps=40)
            await asyncio.sleep(7.5)
            await page.evaluate("window.scrollTo({top: document.getElementById('how').offsetTop - 40, behavior: 'smooth'})")

        async def s03():
            await page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
            await asyncio.sleep(1.2)
            await click(page.get_by_role("button", name="Open the workbench").first)
            await page.get_by_text("Run Hybrid Audit", exact=True).first.wait_for(timeout=15000)

        async def s04():
            await asyncio.sleep(0.6)
            await click(page.get_by_role("button", name="Original (Local)"))
            await move(700, 600, steps=30)
            await asyncio.sleep(3.6)
            await click(page.get_by_role("button", name="Redacted View"))
            await asyncio.sleep(0.4)
            await zoom(".paper-sheet", 1.55, 2.6)

        async def s05():
            rect = await page.evaluate(
                """() => {
                  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                  let n; while ((n = w.nextNode())) {
                    const i = n.data.indexOf('$18,500 USD');
                    if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 11);
                      r.startContainer.parentElement.scrollIntoView({block: 'center'});
                      const b = r.getBoundingClientRect(); return {x: b.left, y: b.top, w: b.width, h: b.height}; }
                  } return null; }"""
            )
            if not rect:
                return
            await asyncio.sleep(0.4)
            y = rect["y"] + rect["h"] / 2
            await move(rect["x"] + 1, y)
            await page.mouse.down()
            await page.mouse.move(rect["x"] + rect["w"] - 1, y, steps=18)
            await page.mouse.up()
            await asyncio.sleep(0.7)
            btn = page.get_by_role("button", name="Custom", exact=True)
            if await btn.count():
                await click(btn.first)

        async def s06():
            await move(1380, 150)
            await page.evaluate("h => window.__cvPanel(h)", PANEL_ROUTING)
            await asyncio.sleep(11.5)
            await page.evaluate("() => window.__cvPanel(null)")
            await asyncio.sleep(0.4)
            await click(page.locator("header button", has_text="gemini").first)
            await asyncio.sleep(6.5)
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.3)
            close = page.locator("button:has(svg.lucide-x)")
            if await close.count() and await close.first.is_visible():
                await click(close.first)

        async def s07():
            await click(page.get_by_text("Run Hybrid Audit", exact=True).first)
            await page.get_by_text("/ 100").first.wait_for(timeout=45000)
            cue("confirm", 0.6)
            await zoom("aside[data-pane=inspector]", 1.45, 2.0)

        async def s08():
            await click(page.get_by_role("button", name="Locate").first)
            await asyncio.sleep(3.2)
            await click(page.get_by_role("button", name="Cloud Tokens").first)
            await asyncio.sleep(2.6)
            await click(page.get_by_role("button", name="Re-Hydrated").first)
            await asyncio.sleep(0.8)
            await page.mouse.wheel(0, 380)

        async def s09():
            await click(page.get_by_role("button", name="Outbound Cloud Payload"))
            await asyncio.sleep(0.3)
            # bring the SHA-256 proof box (top of the sheet) into view before zooming on it
            await page.evaluate("""() => { let el = document.querySelector('.paper-sheet');
              while (el && !(el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflowY !== 'visible')) el = el.parentElement;
              if (el) el.scrollTo({top: 0, behavior: 'smooth'}); }""")
            await asyncio.sleep(0.6)
            await zoom(".paper-sheet", 1.6, 4.2)
            await page.mouse.wheel(0, 300)

        async def s10():
            await click(page.get_by_role("button", name="Ask", exact=True))
            await asyncio.sleep(0.8)
            await click(page.locator("button.block.w-full").first)
            try:
                await page.locator(r"text=/Total \d+ms/").first.wait_for(timeout=30000)
            except Exception:
                pass

        async def s11():
            await click(page.get_by_role("button", name=re.compile(r"^Telemetry")))
            await move(1250, 420, steps=30)

        async def s12():
            await click(page.locator("header button", has_text="Hybrid routing").first)
            await asyncio.sleep(1.2)
            await click(page.get_by_role("button", name=re.compile(r"^Risk Audit")))
            await asyncio.sleep(0.6)
            await click(page.get_by_role("button", name="Quick Triage"))
            await asyncio.sleep(1.2)
            cue("pulse", 0.5)
            await zoom("aside[data-pane=inspector]", 1.5, 3.2)
            await click(page.locator("header button", has_text="Air-gap").first)

        async def s13():
            await click(page.get_by_role("button", name=re.compile(r"^Medical Bill")))
            await asyncio.sleep(3.5)
            await page.evaluate("h => window.__cvPanel(h)", PANEL_EXTENSION)

        async def s14():
            await page.evaluate("() => window.__cvPanel(null)")
            await page.evaluate("() => window.__cvCursor(false)")
            await card(cards.CARD_ARCH)

        async def s15():
            await card(CARD_OUTRO, sfx="chime")

        for sid, fn in [
            ("s01_hook", s01), ("s02_landing", s02), ("s03_open", s03), ("s04_redact", s04),
            ("s05_select", s05), ("s06_routing", s06), ("s07_audit", s07), ("s08_findings", s08),
            ("s09_proof", s09), ("s10_ask", s10), ("s11_telemetry", s11), ("s12_airgap", s12),
            ("s13_samples", s13), ("s14_stack", s14), ("s15_outro", s15),
        ]:
            if sid == "s04_redact":
                await chapter(cards.CHAPTER_SHIELD)
            elif sid == "s07_audit":
                await chapter(cards.CHAPTER_ROUTE)
            elif sid == "s09_proof":
                await chapter(cards.CHAPTER_PROOF)
            await scene(sid, fn)

        end = time.time() + 1.2
        await asyncio.sleep(1.2)
        await cdp.send("Page.stopScreencast")
        await browser.close()

    json.dump({"start": rec_start, "end": end, "scenes": markers, "cues": cues, "vo_lead": VO_LEAD},
              open(os.path.join(OUT, "markers.json"), "w"), indent=2)
    print(f"frames={n_frames}  length={end - markers[0]['t']:.1f}s")


asyncio.run(main())
