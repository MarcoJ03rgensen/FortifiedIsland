// Experimental: circuit-theory current density heatmap (Tilia Alsie, 20 paddlers)
(() => {
  const SRC = 'visuals/annual_mean_current_density.asc';
  const ID = 'current-density';
  const STOPS = [[0, [255, 255, 204]], [0.25, [254, 204, 92]], [0.5, [253, 141, 60]], [0.75, [227, 26, 28]], [1, [128, 0, 38]]];
  let loaded = false, loading = false, visible = false, opacity = 0.75;

  const color = t => {
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i][0]) {
        const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i], f = (t - t0) / (t1 - t0);
        return c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
      }
    }
    return STOPS[STOPS.length - 1][1];
  };

  async function parse() {
    const txt = await (await fetch(SRC)).text();
    const lines = txt.split('\n');
    const h = {};
    let i = 0;
    for (; i < lines.length; i++) {
      const m = lines[i].trim().match(/^([A-Za-z_]+)\s+(-?[\d.]+)$/);
      if (!m) break;
      h[m[1].toLowerCase()] = parseFloat(m[2]);
    }
    const { ncols, nrows, xllcorner, yllcorner, cellsize } = h;
    const nodata = h.nodata_value;
    const vals = new Float32Array(ncols * nrows);
    let n = 0;
    for (; i < lines.length && n < vals.length; i++) {
      const t = lines[i].trim();
      if (t) t.split(/\s+/).forEach(v => { if (n < vals.length) vals[n++] = parseFloat(v); });
    }
    return { ncols, nrows, xllcorner, yllcorner, cellsize, nodata, vals };
  }

  function toCanvas(g) {
    const ok = [];
    for (const v of g.vals) if (v !== g.nodata && v > 0) ok.push(v);
    ok.sort((a, b) => a - b);
    const lo = ok[Math.floor(ok.length * 0.02)], hi = ok[Math.floor(ok.length * 0.98)];
    // The grid is linear in latitude; resample rows into Web Mercator space so it overlays correctly.
    const rad = Math.PI / 180;
    const mY = lat => Math.log(Math.tan(Math.PI / 4 + lat * rad / 2));
    const south = g.yllcorner, north = south + g.nrows * g.cellsize;
    const mS = mY(south), mN = mY(north);
    const outH = Math.round(g.ncols * (mN - mS) / (g.ncols * g.cellsize * rad));
    const cv = document.createElement('canvas');
    cv.width = g.ncols; cv.height = outH;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(g.ncols, outH);
    for (let y = 0; y < outH; y++) {
      const m = mN - (y + 0.5) / outH * (mN - mS);
      const lat = (2 * Math.atan(Math.exp(m)) - Math.PI / 2) / rad;
      const row = Math.min(g.nrows - 1, Math.max(0, Math.floor((north - lat) / g.cellsize)));
      for (let x = 0; x < g.ncols; x++) {
        const v = g.vals[row * g.ncols + x];
        const o = (y * g.ncols + x) * 4;
        if (v === g.nodata || v <= 0 || isNaN(v)) { img.data.set([225, 225, 225, 110], o); continue; }
        const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
        const [r, gg, b] = color(t);
        img.data.set([r, gg, b, 235], o);
      }
    }
    ctx.putImageData(img, 0, 0);
    return { cv, lo, hi };
  }

  async function ensure() {
    if (loaded || loading) return;
    loading = true;
    showNotification('Loading current density layer…');
    try {
      const g = await parse();
      if (!map.isStyleLoaded()) await new Promise(res => map.once('idle', res));
      const { cv, lo, hi } = toCanvas(g);
      const w = g.xllcorner, e = w + g.ncols * g.cellsize, s = g.yllcorner, n = s + g.nrows * g.cellsize;
      map.addSource(ID, { type: 'canvas', canvas: cv, animate: false, coordinates: [[w, n], [e, n], [e, s], [w, s]] });
      const before = map.getLayer('sites-glow') ? 'sites-glow' : undefined;
      map.addLayer({ id: ID, type: 'raster', source: ID, paint: { 'raster-opacity': opacity, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }, before);
      document.getElementById('cdLegendMin').textContent = lo.toFixed(2);
      document.getElementById('cdLegendMax').textContent = hi.toFixed(2);
      loaded = true;
    } catch (err) {
      console.error(err);
      showNotification('Could not load current density layer');
      visible = false;
    }
    loading = false;
  }

  async function apply() {
    const btn = document.getElementById('btnToggleCurrent');
    btn.classList.toggle('active', visible);
    document.getElementById('cdLegend').hidden = !visible;
    if (visible) await ensure();
    if (!visible) btn.classList.remove('active');
    if (map.getLayer(ID)) map.setLayoutProperty(ID, 'visibility', visible ? 'visible' : 'none');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnToggleCurrent').addEventListener('click', () => { visible = !visible; apply(); });
    document.getElementById('cdOpacity').addEventListener('input', e => {
      opacity = e.target.value / 100;
      if (map.getLayer(ID)) map.setPaintProperty(ID, 'raster-opacity', opacity);
    });
  });
})();
