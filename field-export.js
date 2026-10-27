// Detailed field export page: pick CSV columns by category, no map.
(() => {
  const GROUPS = [
    ['Identification', /^(systemnr|stednr|loknr|sbext|frednr|anlnr|url|source|NM_and_BMR|status)$/],
    ['Names', /^(stednavn|alt_stednavn|stednavnsb)$/],
    ['Location', /^(utm32n|wgs84|geometry)/],
    ['Dating', /^(fra_aar|til_aar)$/],
    ['Grave totals & types', /^(Total_graves|Total_graves_min|Graves per type)/],
    ['Late Roman Iron Age', /^Graves_.*late_roman/],
    ['Early Roman Iron Age', /^Graves_.*early_roman/],
    ['Pre-Roman Iron Age', /^Graves_.*pre-roman/],
    ['Early Germanic Iron Age', /^Graves_.*early_germanic/],
    ['Late Germanic Iron Age', /^Graves_.*late_germanic/],
    ['Viking Age', /^Graves_.*viking/],
    ['Monuments', /^Monuments_/],
    ['Weapons', /^Weapons_/],
  ];
  const DERIVED = /^(urn_count|crem_count|inh_count|boat_count|chamber_count|cist_count)$/;
  const sel = new Set();
  let groups = [];

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function build() {
    const sites = state.allSites;
    if (!sites.length) return;
    const cols = Object.keys(sites[0]).filter(c => !DERIVED.test(c));
    const map = new Map(GROUPS.map(g => [g[0], []]));
    map.set('Notes & other', []);
    cols.forEach(c => {
      const g = GROUPS.find(g => g[1].test(c));
      map.get(g ? g[0] : 'Notes & other').push(c);
    });
    groups = [...map].filter(([, f]) => f.length);
    render();
  }

  function render() {
    const q = $('feSearch').value.trim().toLowerCase();
    $('feGroups').innerHTML = groups.map(([name, fields], gi) => {
      const shown = fields.filter(f => !q || f.toLowerCase().includes(q) || name.toLowerCase().includes(q));
      if (!shown.length) return '';
      const all = shown.every(f => sel.has(f));
      return `<div class="fe-group"><h3><label><input type="checkbox" data-g="${gi}" ${all ? 'checked' : ''}> ${esc(name)}</label><span>${fields.filter(f => sel.has(f)).length}/${fields.length}</span></h3>` +
        shown.map(f => `<label class="fe-field"><input type="checkbox" data-f="${esc(f)}" ${sel.has(f) ? 'checked' : ''}> ${esc(f)}</label>`).join('') + '</div>';
    }).join('');
    summary();
  }

  function rows() {
    return $('feScope').value === 'all' ? state.allSites : state.filteredSites;
  }
  function cols() {
    return groups.flatMap(g => g[1]).filter(f => sel.has(f));
  }
  function ctx(c, format, names) {
    return { rows: rows(), fields: c, names, format, scope: $('feScope').value === 'all' ? 'all sites' : 'current map filters' };
  }
  function summary() {
    $('feSummary').textContent = `${cols().length} fields · ${rows().length} sites`;
  }

  function out(kind) {
    const c = cols();
    if (!c.length) return showNotification('Select at least one field');
    const data = rows().map(r => Object.fromEntries(c.map(k => [k, r[k] ?? ''])));
    if (kind === 'csv') {
      ExportMeta.download(new Blob(['\ufeff' + Papa.unparse({ fields: c, data: data.map(d => c.map(k => d[k])) })], { type: 'text/csv;charset=utf-8' }), 'bornholm_graves_custom.csv', ctx(c, 'CSV'));
    } else {
      ExportMeta.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'bornholm_graves_custom.json', ctx(c, 'JSON'));
    }
  }

  // DBF field names max out at 10 chars, so build unique short names
  function shortNames(c) {
    const used = new Set();
    return c.map(k => {
      let b = k.replace(/^Graves per type: /, 'gt_').replace(/^Graves_/, 'g_').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
      let n = b.slice(0, 10), i = 1;
      while (used.has(n.toLowerCase())) { const suf = String(i++); n = b.slice(0, 10 - suf.length) + suf; }
      used.add(n.toLowerCase());
      return n;
    });
  }

  function shp() {
    const c = cols();
    if (!c.length) return showNotification('Select at least one field');
    if (typeof shpwrite === 'undefined') return showNotification('Shapefile export is still loading – try again in a moment.');
    const names = shortNames(c);
    const feats = rows().filter(r => {
      const la = parseFloat(r.wgs84_latitude), lo = parseFloat(r.wgs84_longitude);
      return !isNaN(la) && !isNaN(lo) && la > 54 && lo > 14;
    }).map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [parseFloat(r.wgs84_longitude), parseFloat(r.wgs84_latitude)] },
      properties: Object.fromEntries(c.map((k, i) => {
        const v = r[k] ?? '';
        const num = typeof v === 'number' || (v !== '' && /^-?\d+(\.\d+)?$/.test(String(v).trim()));
        return [names[i], num ? Number(v) : String(v).slice(0, 254)];
      }))
    }));
    if (!feats.length) return showNotification('None of the selected sites have coordinates.');
    const fn = 'bornholm_graves_custom';
    showNotification('Preparing shapefile…');
    shpwrite.zip({ type: 'FeatureCollection', features: feats }, { folder: fn, filename: fn, outputType: 'blob', types: { point: fn } })
      .then(b => ExportMeta.download(b, fn + '.zip', ctx(c, 'Shapefile (point)', names)))
      .catch(e => showNotification('Error generating Shapefile: ' + (e.message || e)));
  }

  function show(on) {
    $('fieldExportPage').hidden = !on;
    if (on) build();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('btnFieldExportView').addEventListener('click', () => show($('fieldExportPage').hidden));
    $('feBack').addEventListener('click', () => show(false));
    $('feSearch').addEventListener('input', render);
    $('feScope').addEventListener('change', summary);
    $('feAll').addEventListener('click', () => { groups.forEach(g => g[1].forEach(f => sel.add(f))); render(); });
    $('feNone').addEventListener('click', () => { sel.clear(); render(); });
    $('feCSV').addEventListener('click', () => out('csv'));
    $('feSHP').addEventListener('click', shp);
    $('feJSON').addEventListener('click', () => out('json'));
    $('feGroups').addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.f) t.checked ? sel.add(t.dataset.f) : sel.delete(t.dataset.f);
      else if (t.dataset.g) groups[t.dataset.g][1].forEach(f => t.checked ? sel.add(f) : sel.delete(f));
      render();
    });
  });
})();
