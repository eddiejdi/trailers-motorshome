/**
 * PhotoBookService — gera book de fotos multi-vista no browser (dia/noite).
 * Não depende de Playwright: usa renderer THREE + toDataURL.
 */
export default class PhotoBookService {
  constructor({ sceneManager, getApp, getProjectMeta }) {
    this.sceneManager = sceneManager;
    this.getApp = getApp;
    this.getProjectMeta = getProjectMeta || (() => ({}));
    this.busy = false;
  }

  views() {
    return [
      { id: '01_iso_dia', cam: [5.2, 3.8, 5.0], tgt: [0.2, 1.2, 0.0], night: false, title: 'Isométrica — dia' },
      { id: '02_iso_noite', cam: [5.2, 3.8, 5.0], tgt: [0.2, 1.2, 0.0], night: true, title: 'Isométrica — noite' },
      { id: '03_lateral_toldo_dia', cam: [6.5, 2.2, 0.3], tgt: [0.5, 1.5, 0.2], night: false, title: 'Lateral direita + toldo — dia' },
      { id: '04_lateral_toldo_noite', cam: [6.5, 2.2, 0.3], tgt: [0.5, 1.5, 0.2], night: true, title: 'Lateral direita + toldo — noite' },
      { id: '05_entrada_dia', cam: [1.5, 2.0, 5.5], tgt: [0.0, 1.4, 1.0], night: false, title: 'Entrada traseira — dia' },
      { id: '06_entrada_noite', cam: [1.5, 2.0, 5.5], tgt: [0.0, 1.4, 1.0], night: true, title: 'Entrada traseira — noite' },
      { id: '07_planta', cam: [0.0, 9.0, 0.02], tgt: [0.0, 0.5, 0.0], night: false, title: 'Planta (top-down)' },
      { id: '08_sala_int', cam: [0.1, 1.55, 1.1], tgt: [0.2, 1.3, -0.2], night: false, title: 'Interior sala' },
      { id: '09_mezanino', cam: [0.0, 2.6, -1.0], tgt: [0.0, 1.9, -2.4], night: false, title: 'Mezanino' },
      { id: '10_sob_toldo_noite', cam: [3.2, 1.2, 0.2], tgt: [1.4, 1.6, 0.2], night: true, title: 'Sob o toldo — noite' },
      { id: '11_frente_mez', cam: [0.0, 2.8, -5.5], tgt: [0.0, 1.8, -2.0], night: false, title: 'Frente / mezanino' },
      { id: '12_hb20_engate', cam: [-3.5, 1.8, -5.5], tgt: [0.0, 0.6, -3.2], night: false, title: 'HB20 engatado na lança' },
      { id: '13_conjunto_lado', cam: [7.5, 2.8, -2.0], tgt: [0.0, 1.0, -2.5], night: false, title: 'Conjunto lateral · HB20 + trailer' },
      { id: '14_iso_conjunto', cam: [6.0, 4.0, 4.0], tgt: [0.0, 1.0, -1.5], night: false, title: 'Iso · HB20 engatado + trailer' },
      { id: '15_traseira_esq', cam: [-4.5, 2.5, 3.5], tgt: [0.0, 1.3, 0.5], night: false, title: 'Traseira esquerda' },
    ];
  }

  async _waitFrames(n = 6) {
    const sm = this.sceneManager;
    const r = sm.getRenderer();
    const sc = sm.getScene();
    const c = sm.getCamera();
    for (let i = 0; i < n; i++) {
      await new Promise((res) => requestAnimationFrame(res));
      if (r && sc && c) r.render(sc, c);
    }
  }

  _setNight(on) {
    const sm = this.sceneManager;
    const app = this.getApp && this.getApp();
    if (!sm || typeof sm.setNightMode !== 'function') return;
    const cur = !!(sm.isNight && sm.isNight());
    if (cur !== !!on) sm.setNightMode(!!on);
    if (on && app && app.editableMeshes) {
      sm.setEditableMeshes(app.editableMeshes);
      if (sm.refreshNightFixtures) sm.refreshNightFixtures();
    }
  }

  _captureJpeg(quality = 0.9) {
    const canvas = document.querySelector('#canvas-wrap canvas');
    if (!canvas) throw new Error('Canvas 3D não encontrado');
    return canvas.toDataURL('image/jpeg', quality);
  }

  async generate({ onProgress } = {}) {
    if (this.busy) throw new Error('Book já em geração');
    this.busy = true;
    const sm = this.sceneManager;
    const views = this.views();
    const pages = [];
    const wasNight = !!(sm.isNight && sm.isNight());
    const ctrl = sm.getControls && sm.getControls();
    const prevTarget = ctrl && ctrl.target ? ctrl.target.clone() : null;
    const cam = sm.getCamera && sm.getCamera();
    const prevCam = cam ? cam.position.clone() : null;

    // hide UI
    const hideSel = '#hud,#palette,#editor,#view-info,#btn-night-float,#walk-hud,#ctx-menu,#plan2d-active-hint,#auth-section,#files-section,.ui-win,#ai-panel,#btn-book-float';
    const style = document.createElement('style');
    style.id = 'photo-book-hide-ui';
    style.textContent = `${hideSel}{display:none!important}`;
    document.head.appendChild(style);

    try {
      for (let i = 0; i < views.length; i++) {
        const v = views[i];
        if (onProgress) onProgress(i + 1, views.length, v.title);
        this._setNight(v.night);
        if (typeof sm.repositionCamera === 'function') {
          sm.repositionCamera(v.cam[0], v.cam[1], v.cam[2], v.tgt[0], v.tgt[1], v.tgt[2]);
        }
        await this._waitFrames(v.night ? 10 : 6);
        const dataUrl = this._captureJpeg(0.9);
        pages.push({
          id: v.id,
          title: v.title,
          night: !!v.night,
          dataUrl,
        });
      }
    } finally {
      // restore
      this._setNight(wasNight);
      if (prevCam && cam) cam.position.copy(prevCam);
      if (prevTarget && ctrl) {
        ctrl.target.copy(prevTarget);
        ctrl.update();
      }
      const st = document.getElementById('photo-book-hide-ui');
      if (st) st.remove();
      this.busy = false;
    }

    const meta = Object.assign({
      generatedAt: new Date().toISOString(),
      photos: pages.length,
    }, this.getProjectMeta() || {});

    const html = this._buildHtml(meta, pages);
    return { meta, pages, html };
  }

  _buildHtml(meta, pages) {
    const cards = pages.map((p, i) => {
      const badge = p.night ? 'noite' : 'dia';
      return `<figure class="card">
        <div class="n">${String(i + 1).padStart(2, '0')}</div>
        <img src="${p.dataUrl}" alt="${p.title}"/>
        <figcaption><strong>${p.title}</strong><span class="b ${badge}">${badge}</span></figcaption>
      </figure>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Photo Book — ${meta.name || 'Trailer'}</title>
<style>
:root{--bg:#0f1116;--card:#1a1d26;--ink:#f2eee4;--muted:#9a9588;--accent:#c9a86c;--line:#2c3140}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif}
header{max-width:1180px;margin:0 auto;padding:28px 20px 14px;border-bottom:1px solid var(--line)}
h1{margin:0 0 8px;font-size:1.55rem;font-weight:600}
.m{color:var(--muted);font-size:.92rem;line-height:1.45}.m b{color:var(--accent)}
.grid{max-width:1180px;margin:0 auto;padding:22px 16px 48px;display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.card{margin:0;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;position:relative}
.card img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block;background:#111}
.card .n{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.65);color:var(--accent);font-size:.72rem;font-weight:700;padding:3px 8px;border-radius:999px;border:1px solid var(--line)}
figcaption{display:flex;justify-content:space-between;gap:8px;padding:11px 13px;font-size:.9rem}
.b{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.b.noite{color:#f0e0b0;border-color:#6a5a30;background:#2a2410}
.b.dia{color:#b8d4f0;border-color:#3a5070;background:#152030}
footer{max-width:1180px;margin:0 auto 36px;padding:0 16px;color:var(--muted);font-size:.8rem}
</style></head><body>
<header>
  <h1>Photo Book · ${meta.name || 'Trailer'}</h1>
  <p class="m">rev <b>${meta.rev ?? '—'}</b> · ${meta.photos || pages.length} fotos · ${meta.source || ''}<br/>
  gerado ${meta.generatedAt || ''}</p>
</header>
<main class="grid">${cards}</main>
<footer>Trailer 3D Studio · photo book</footer>
</body></html>`;
  }

  openBook(html) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      // popup blocked — download instead
      this.downloadBook(html);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  downloadBook(html, filename) {
    const name = filename || `photo-book-${Date.now()}.html`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  }
}
