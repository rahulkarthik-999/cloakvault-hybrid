"""
Illustrated, animated full-screen cards for the CloakVault demo (hook, chapters, outro).
Pure HTML/CSS/SVG rendered inside the recorded page, so they are captured frame-accurately.
"""
import base64, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _data(path):
    return "data:image/png;base64," + base64.b64encode(open(os.path.join(ROOT, path), "rb").read()).decode()


MARK = _data("public/brand/mark.png")
WORDMARK_DARK = _data("public/brand/wordmark-dark.png")

SERIF = "font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.01em"
SANS = "font-family:Geist,system-ui,sans-serif"
MONO = "font-family:'Geist Mono',ui-monospace,monospace"
BG = (
    "position:absolute;inset:0;background:#070B16;"
    "background-image:radial-gradient(700px 480px at 15% 20%,rgba(37,99,235,.28),transparent),"
    "radial-gradient(640px 460px at 88% 82%,rgba(6,182,212,.22),transparent);"
)
GRID = (
    "position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.05) 1px,transparent 1px),"
    "linear-gradient(to bottom,rgba(255,255,255,.05) 1px,transparent 1px);background-size:64px 64px;"
    "mask-image:radial-gradient(ellipse 70% 60% at 50% 50%,#000 30%,transparent 100%)"
)

KEYFRAMES = """<style>
@keyframes cvUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes cvIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}
@keyframes cvStrike{from{width:0}to{width:100%}}
@keyframes cvSwapOut{to{opacity:0;transform:translateY(-10px);filter:blur(4px)}}
@keyframes cvSwapIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes cvDash{to{stroke-dashoffset:-48}}
@keyframes cvTravel{0%{offset-distance:0%;opacity:0}10%{opacity:1}90%{opacity:1}100%{offset-distance:100%;opacity:0}}
@keyframes cvPulse{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.18);opacity:0}}
@keyframes cvType{from{width:0}to{width:100%}}
@keyframes cvBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes cvFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.cv-up{animation:cvUp .8s cubic-bezier(.22,1,.36,1) both}
.cv-in{animation:cvIn .9s cubic-bezier(.22,1,.36,1) both}
</style>"""


def _chip(raw, token, i):
    d = 1.6 + i * 0.28
    return f"""<span style="position:relative;display:inline-grid;margin:7px">
      <span style="grid-area:1/1;{MONO};font-size:22px;padding:11px 20px;border-radius:999px;color:#FCA5A5;
        border:1px solid rgba(252,165,165,.35);background:rgba(252,165,165,.08);animation:cvSwapOut .45s {d + .35:.2f}s both">
        {raw}<span style="position:absolute;left:18px;right:18px;top:50%;height:2px;background:#FCA5A5;width:0;animation:cvStrike .35s {d:.2f}s both"></span></span>
      <span style="grid-area:1/1;{MONO};font-size:22px;padding:11px 20px;border-radius:12px;color:#5EEAD4;
        background:#0B1222;border:1px solid rgba(94,234,212,.35);animation:cvSwapIn .5s {d + .5:.2f}s both">🔒 {token}</span>
    </span>"""


CARD_HOOK = f"""{KEYFRAMES}<div style="{BG}"></div><div style="{GRID}"></div>
<div style="position:relative;text-align:center;color:#fff;max-width:1300px">
  <div class="cv-up" style="{MONO};font-size:18px;letter-spacing:.22em;color:#67E8F9;text-transform:uppercase">The privacy tax on AI</div>
  <div class="cv-up" style="{SERIF};font-size:104px;line-height:1.02;margin-top:24px;animation-delay:.15s">Would you paste your NDA<br/>into a <em style="color:#67E8F9">chatbot</em>?</div>
  <div style="margin-top:44px;display:flex;flex-wrap:wrap;justify-content:center">
    {_chip('Priya Sharma', '[PERSON_1]', 0)}{_chip('HDFC 5010048291', '[ACCOUNT_1]', 1)}{_chip('PAN ABCPS4921K', '[GOV_ID_1]', 2)}{_chip('418 Indiranagar Rd', '[ADDRESS_1]', 3)}
  </div>
</div>"""


def _chapter(num, kicker, title, sub, art, color):
    return f"""{KEYFRAMES}<div style="{BG}"></div><div style="{GRID}"></div>
<div style="position:relative;display:grid;grid-template-columns:620px 640px;gap:90px;align-items:center;color:#fff">
  <div class="cv-in" style="height:520px;display:flex;align-items:center;justify-content:center">{art}</div>
  <div>
    <div class="cv-up" style="{MONO};font-size:20px;letter-spacing:.2em;color:{color}">{num} · {kicker}</div>
    <div class="cv-up" style="{SERIF};font-size:92px;line-height:1;margin-top:20px;animation-delay:.12s">{title}</div>
    <div class="cv-up" style="{SANS};font-size:26px;line-height:1.45;color:rgba(255,255,255,.66);margin-top:24px;animation-delay:.24s">{sub}</div>
  </div>
</div>"""


def _doc_lines():
    rows = []
    widths = [[120, 70, 150], [90, 160, 60], [140, 90, 100], [70, 130, 120], [150, 100, 70]]
    for r, ws in enumerate(widths):
        x = 0
        for c, w in enumerate(ws):
            pii = (r + c) % 2 == 0 and c == 1
            delay = 0.5 + r * 0.18
            fill = "#94A3B8" if not pii else "#F59E0B"
            anim = f'<animate attributeName="fill" from="#F59E0B" to="#0B1222" begin="{delay + .6:.2f}s" dur=".35s" fill="freeze"/>' if pii else ""
            stroke = f'<rect x="{80 + x}" y="{150 + r * 54}" width="{w}" height="22" rx="6" fill="none" stroke="#5EEAD4" stroke-width="2" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="{delay + .6:.2f}s" dur=".3s" fill="freeze"/></rect>' if pii else ""
            rows.append(f'<rect x="{80 + x}" y="{150 + r * 54}" width="{w}" height="22" rx="6" fill="{fill}" opacity=".9">{anim}</rect>{stroke}')
            x += w + 16
    return "".join(rows)


ART_SHIELD = f"""<svg width="560" height="500" viewBox="0 0 560 500">
  <rect x="50" y="90" width="430" height="360" rx="26" fill="#0F172A" stroke="rgba(255,255,255,.14)"/>
  <rect x="80" y="112" width="180" height="16" rx="8" fill="#E2E8F0"/>
  {_doc_lines()}
  <g style="animation:cvFloat 3s ease-in-out infinite;transform-origin:440px 110px">
    <circle cx="455" cy="105" r="70" fill="rgba(6,182,212,.15)" style="animation:cvPulse 2s infinite;transform-origin:455px 105px"/>
    <image href="{MARK}" x="395" y="40" width="120" height="124"/>
  </g>
</svg>"""

ART_ROUTE = """<svg width="600" height="460" viewBox="0 0 600 460">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#10B981"/><stop offset="1" stop-color="#3B82F6"/></linearGradient></defs>
  <rect x="30" y="250" width="200" height="150" rx="22" fill="#0F172A" stroke="#10B981" stroke-width="2"/>
  <rect x="70" y="290" width="120" height="70" rx="10" fill="rgba(16,185,129,.15)" stroke="#10B981"/>
  <text x="130" y="332" text-anchor="middle" font-family="Geist Mono" font-size="20" fill="#6EE7B7">NANO</text>
  <text x="130" y="430" text-anchor="middle" font-family="Geist" font-size="20" fill="#A7F3D0">on-device</text>
  <path d="M400 150 a60 60 0 0 1 112 -10 a45 45 0 0 1 20 88 h-150 a45 45 0 0 1 18 -78z" fill="#0F172A" stroke="#3B82F6" stroke-width="2"/>
  <text x="455" y="200" text-anchor="middle" font-family="Geist Mono" font-size="20" fill="#93C5FD">GEMINI</text>
  <text x="455" y="270" text-anchor="middle" font-family="Geist" font-size="20" fill="#BFDBFE">cloud</text>
  <path id="p" d="M230 300 C 320 300, 330 190, 395 190" fill="none" stroke="url(#g)" stroke-width="4" stroke-dasharray="10 14" style="animation:cvDash 1s linear infinite"/>
  <g style="offset-path:path('M230 300 C 320 300, 330 190, 395 190');animation:cvTravel 1.8s .4s ease-in-out infinite">
    <rect x="-62" y="-18" width="124" height="36" rx="10" fill="#0B1222" stroke="#5EEAD4"/>
    <text x="0" y="7" text-anchor="middle" font-family="Geist Mono" font-size="16" fill="#5EEAD4">[TOKENS]</text>
  </g>
  <g transform="translate(300 380)"><rect x="-108" y="-20" width="216" height="40" rx="20" fill="rgba(239,68,68,.12)" stroke="rgba(239,68,68,.5)"/>
  <text x="0" y="7" text-anchor="middle" font-family="Geist Mono" font-size="16" fill="#FCA5A5">raw PII ✕ blocked</text></g>
</svg>"""

ART_PROOF = f"""<div style="width:560px;{MONO};color:#E2E8F0">
  <div style="display:flex;align-items:center;gap:16px;font-size:20px;color:#5EEAD4">
    <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" stroke-width="1.6" stroke-linecap="round"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>
    zero_leak_certificate.json</div>
  {''.join(f'''<div style="margin-top:26px"><div style="font-size:16px;color:rgba(255,255,255,.45)">{k}</div>
    <div style="overflow:hidden;white-space:nowrap;font-size:21px;margin-top:6px;width:0;animation:cvType 1s steps(32) {0.4 + i * 0.55:.2f}s both;color:{c}">{v}</div></div>'''
    for i, (k, v, c) in enumerate([
        ("originalSha256", "985e70523eb2519a874f8a1f8c950024", "#E2E8F0"),
        ("redactedSha256", "2a2e5cc1e0feefe52326d0eb8c497619", "#E2E8F0"),
        ("rawPiiBytesSent", "0", "#5EEAD4"),
        ("zeroLeakVerified", "true", "#5EEAD4"),
    ]))}
</div>"""

CHAPTER_SHIELD = _chapter("01", "ONLY_ON_DEVICE", "Shield it<br/>on-device.", "Names, IDs, accounts and addresses become reversible local tokens — before any model sees the text.", ART_SHIELD, "#5EEAD4")
CHAPTER_ROUTE = _chapter("02", "HYBRID ROUTING", "Only tokens<br/>travel.", "Firebase AI Logic picks Gemini Nano on-device or Gemini in the cloud, per task. Raw PII never crosses.", ART_ROUTE, "#93C5FD")
CHAPTER_PROOF = _chapter("03", "PROOF, NOT PROMISES", "Verify<br/>the wire.", "Every cloud call ships with a SHA-256 receipt you can check yourself.", ART_PROOF, "#5EEAD4")

CARD_OUTRO = f"""{KEYFRAMES}<div style="{BG}"></div><div style="{GRID}"></div>
<div style="position:relative;text-align:center;color:#fff">
  <div class="cv-in" style="display:flex;justify-content:center;align-items:center;gap:26px">
    <img src="{MARK}" style="height:150px"/><img src="{WORDMARK_DARK}" style="height:92px"/></div>
  <div class="cv-up" style="{SANS};font-size:38px;color:rgba(255,255,255,.8);margin-top:40px;animation-delay:.2s">Get the second opinion. Keep the secrets.</div>
  <div class="cv-up" style="{MONO};font-size:28px;color:#67E8F9;margin-top:44px;animation-delay:.4s">cloakvault.buzz</div>
  <div class="cv-up" style="{SANS};font-size:20px;color:rgba(255,255,255,.45);margin-top:16px;animation-delay:.55s">#BuildHybridAI 2026 · Firebase AI Logic · Open source (Apache-2.0)</div>
</div>"""


# ───────────────────────── Architecture diagram (scene 14, "Under the hood") ─────────────────────────
# Node entrances are timed to the narration: "Firebase AI Logic … App Check … Remote Config …
# Firestore … Authentication … Hosting" (≈11 s).

def _node(x, y, w, h, title, sub, color, delay, fill="#0B1222"):
    return f"""<g style="opacity:0;animation:cvFade .55s {delay:.2f}s both">
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{fill}" stroke="{color}" stroke-width="2"/>
  <rect x="{x - 6}" y="{y - 6}" width="{w + 12}" height="{h + 12}" rx="20" fill="none" stroke="{color}" stroke-width="3"
        style="opacity:0;animation:cvFlash 1.4s {delay + .1:.2f}s both"/>
  <text x="{x + w / 2}" y="{y + h / 2 - (6 if sub else -7)}" text-anchor="middle" font-family="Geist" font-weight="600" font-size="21" fill="#F1F5F9">{title}</text>
  {f'<text x="{x + w / 2}" y="{y + h / 2 + 20}" text-anchor="middle" font-family="Geist Mono" font-size="14" fill="{color}">{sub}</text>' if sub else ''}
</g>"""


def _edge(d, color, delay, label=None, lx=0, ly=0, dash="9 11"):
    w = len(label or "") * 8.6 + 22
    lab = (f'<rect x="{lx - w / 2}" y="{ly - 17}" width="{w}" height="26" rx="13" fill="#070B16" stroke="{color}" stroke-opacity=".35"/>'
           f'<text x="{lx}" y="{ly + 1}" text-anchor="middle" font-family="Geist Mono" font-size="14" fill="{color}">{label}</text>'
           if label else "")
    return f"""<g style="opacity:0;animation:cvFade .5s {delay:.2f}s both">
  <path d="{d}" fill="none" stroke="{color}" stroke-width="3" stroke-dasharray="{dash}" style="animation:cvDash 1.1s linear infinite"/>{lab}
</g>"""


def _packet(d, text, color, delay):
    return f"""<g style="offset-path:path('{d}');opacity:0;animation:cvTravel 2.2s {delay:.2f}s ease-in-out infinite">
  <rect x="-58" y="-16" width="116" height="32" rx="9" fill="#020617" stroke="{color}" stroke-width="1.5"/>
  <text x="0" y="6" text-anchor="middle" font-family="Geist Mono" font-size="14" fill="{color}">{text}</text></g>"""


G, B, A, R = "#34D399", "#60A5FA", "#FBBF24", "#F87171"
ROUTE_TO_CLOUD = "M770 330 C 860 330, 880 250, 975 250"
ARCH_SVG = f"""<svg width="1500" height="700" viewBox="0 0 1500 700">
  <!-- device + cloud zones -->
  <g style="opacity:0;animation:cvFade .6s .15s both">
    <rect x="20" y="40" width="800" height="620" rx="28" fill="rgba(16,185,129,.05)" stroke="rgba(52,211,153,.45)" stroke-dasharray="6 8"/>
    <text x="48" y="80" font-family="Geist Mono" font-size="16" letter-spacing="3" fill="{G}">YOUR DEVICE · CHROME</text>
  </g>
  <g style="opacity:0;animation:cvFade .6s 3.2s both">
    <rect x="940" y="40" width="540" height="620" rx="28" fill="rgba(59,130,246,.05)" stroke="rgba(96,165,250,.45)" stroke-dasharray="6 8"/>
    <text x="968" y="80" font-family="Geist Mono" font-size="16" letter-spacing="3" fill="{B}">GOOGLE CLOUD · FIREBASE</text>
  </g>
  <!-- zero-leak boundary -->
  <g style="opacity:0;animation:cvFade .6s 4.6s both">
    <line x1="880" y1="60" x2="880" y2="590" stroke="{R}" stroke-width="2" stroke-dasharray="4 8"/>
    <rect x="790" y="596" width="180" height="34" rx="17" fill="#1F0A0A" stroke="{R}"/>
    <text x="880" y="618" text-anchor="middle" font-family="Geist Mono" font-size="14" fill="#FCA5A5">0 B raw PII crosses</text>
  </g>

  <!-- device side -->
  {_node(60, 110, 230, 74, 'Document', 'PDF · DOCX · TXT', '#94A3B8', 0.35)}
  {_node(60, 230, 230, 84, 'PII Shield', 'detectors + Nano NER', G, 0.7)}
  {_node(60, 360, 230, 84, 'Token vault', 'IndexedDB · keymap', G, 1.0)}
  {_node(320, 470, 230, 84, 'Gemini Nano', 'ON_DEVICE', G, 2.0, fill='#052E1F')}
  {_edge('M175 184 L175 230', '#94A3B8', 0.6)}
  {_edge('M175 314 L175 360', G, 0.9)}
  {_edge('M290 272 C 420 272, 470 300, 540 318', G, 1.3)}

  <!-- the hybrid router -->
  {_node(540, 270, 230, 120, 'Firebase AI Logic', 'InferenceMode per task', '#E2E8F0', 1.3, fill='#111827')}
  {_edge('M600 390 C 600 440, 560 450, 520 470', G, 2.2, 'PREFER_ON_DEVICE', 690, 450)}
  {_edge(ROUTE_TO_CLOUD, B, 3.6, 'PREFER_IN_CLOUD', 900, 180)}
  {_packet(ROUTE_TO_CLOUD, '[TOKENS]', '#5EEAD4', 4.4)}

  <!-- cloud side -->
  {_node(975, 205, 210, 90, 'App Check', 'reCAPTCHA Ent.', B, 3.6)}
  {_node(1225, 205, 220, 90, 'Gemini', '3.5 Flash-Lite', B, 4.4, fill='#0B1736')}
  {_edge('M1185 250 L1225 250', B, 4.4)}
  {_node(975, 335, 210, 80, 'Remote Config', 'live policy', A, 5.7)}
  {_edge('M975 375 C 880 375, 830 360, 770 350', A, 6.0, 'policy', 915, 410, dash='4 7')}
  {_node(975, 455, 210, 80, 'Firestore', 'zeroLeakVerified rules', G, 7.0)}
  {_edge('M175 444 C 175 640, 760 630, 975 505', G, 7.3, 'redacted vaults only', 470, 612)}
  {_node(1225, 335, 220, 80, 'Authentication', 'anonymous · Google', '#C4B5FD', 9.1)}
  {_node(1225, 455, 220, 80, 'Hosting', 'cloakvault.buzz', '#C4B5FD', 10.1)}
</svg>"""

CARD_ARCH = f"""{KEYFRAMES}<style>
@keyframes cvFade{{from{{opacity:0}}to{{opacity:1}}}}
@keyframes cvFlash{{0%{{opacity:0}}25%{{opacity:.9}}100%{{opacity:0}}}}
</style><div style="{BG}"></div><div style="{GRID}"></div>
<div style="position:relative;color:#fff;text-align:center">
  <div class="cv-up" style="{MONO};font-size:18px;letter-spacing:.22em;color:#93C5FD">ARCHITECTURE</div>
  <div class="cv-up" style="{SERIF};font-size:58px;line-height:1.05;margin:10px 0 6px;animation-delay:.1s">One hybrid SDK. A boundary raw PII never crosses.</div>
  <div style="transform:scale(.98);transform-origin:top center">{ARCH_SVG}</div>
</div>"""
