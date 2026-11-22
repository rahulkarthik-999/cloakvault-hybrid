// Injected into every page while recording the CloakVault demo:
// a visible cursor with click ripples, burned-in captions, and full-screen title cards.
(() => {
  if (window.__cvOverlay) return;
  window.__cvOverlay = true;

  const css = `
  #cv-cursor{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;
    transform:translate(-3px,-2px);transition:opacity .2s}
  .cv-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;
    border-radius:50%;border:2px solid rgba(79,70,229,.9);animation:cvr .55s ease-out forwards}
  @keyframes cvr{to{transform:scale(3.6);opacity:0}}
  #cv-cap{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483645;pointer-events:none;
    max-width:1180px;padding:10px 20px;border-radius:12px;background:rgba(14,16,21,.86);color:#fff;
    font:500 21px/1.35 Geist,system-ui,sans-serif;letter-spacing:-.005em;text-align:center;
    box-shadow:0 10px 30px -10px rgba(0,0,0,.5);opacity:0;transition:opacity .25s}
  #cv-card{position:fixed;inset:0;z-index:2147483640;display:flex;align-items:center;justify-content:center;
    opacity:0;pointer-events:none;transition:opacity .6s ease}
  #cv-card.on{opacity:1}
  #cv-panel{position:fixed;right:28px;top:84px;z-index:2147483641;width:560px;border-radius:18px;
    background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border:1px solid #E5E7EC;
    box-shadow:0 30px 80px -30px rgba(14,16,21,.45);padding:22px 24px;opacity:0;transform:translateY(10px);
    transition:all .45s cubic-bezier(.22,1,.36,1);pointer-events:none;font-family:Geist,system-ui,sans-serif}
  #cv-panel.on{opacity:1;transform:none}
  `;
  const boot = () => {
    if (document.getElementById('cv-cursor')) return;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    const cur = document.createElement('div');
    cur.id = 'cv-cursor';
    cur.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l15 9.5-6.6 1.4L9 20z" fill="#0E1015" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    document.addEventListener('mousemove', (e) => {
      cur.style.left = e.clientX + 'px';
      cur.style.top = e.clientY + 'px';
    }, true);
    document.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.className = 'cv-ripple';
      r.style.left = e.clientX + 'px';
      r.style.top = e.clientY + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }, true);

    const cap = document.createElement('div');
    cap.id = 'cv-cap';
    document.body.appendChild(cap);
    const card = document.createElement('div');
    card.id = 'cv-card';
    document.body.appendChild(card);
    const panel = document.createElement('div');
    panel.id = 'cv-panel';
    document.body.appendChild(panel);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  let capTimers = [];
  window.__cvCaptions = (chunks) => {
    // chunks: [{text, ms}] — shown back to back
    capTimers.forEach(clearTimeout);
    capTimers = [];
    const el = document.getElementById('cv-cap');
    if (!el) return;
    let t = 0;
    chunks.forEach((c) => {
      capTimers.push(setTimeout(() => { el.textContent = c.text; el.style.opacity = 1; }, t));
      t += c.ms;
    });
    capTimers.push(setTimeout(() => { el.style.opacity = 0; }, t));
  };
  window.__cvCard = (html) => {
    const el = document.getElementById('cv-card');
    if (!el) return;
    if (html) { el.innerHTML = html; el.classList.add('on'); } else el.classList.remove('on');
  };
  window.__cvPanel = (html) => {
    const el = document.getElementById('cv-panel');
    if (!el) return;
    if (html) { el.innerHTML = html; el.classList.add('on'); } else el.classList.remove('on');
  };
  window.__cvCursor = (show) => {
    const el = document.getElementById('cv-cursor');
    if (el) el.style.opacity = show ? 1 : 0;
  };
})();
