// Builds metadata.txt for exports and bundles it with the data file.
// Sources are de-duplicated into a numbered bibliography; per-site page
// pinpoints are listed under each work instead of repeating full citations.
(function () {
  const DESC = [
    [/^systemnr$/, 'Heritage-database system number'],
    [/^stednr$/, 'Site number (parish.site)'],
    [/^loknr$/, 'Locality number'],
    [/^(sbext|sb)$/, 'Sb. number extension'],
    [/^frednr$/, 'Protection (fredning) number'],
    [/^stednavn$/, 'Site name'],
    [/^alt_stednavn$/, 'Alternative site name'],
    [/^stednavnsb$/, 'Site name with Sb. number'],
    [/^anlnr$/, 'Monument (anlæg) number'],
    [/^fra_aar$/, 'Dating: from year'],
    [/^til_aar$/, 'Dating: to year'],
    [/^url$/, 'Link to the heritage-database record'],
    [/^utm32n/, 'Coordinate in UTM zone 32N (EPSG:25832)'],
    [/^wgs84/, 'Coordinate in WGS84 (EPSG:4326)'],
    [/^geometry/, 'Geometry as WKT'],
    [/^(Total_graves|Total_graves_min)$/, 'Minimum total number of graves at the site'],
    [/^Graves per type/, 'Number of graves of the given type'],
    [/^Graves_/, 'Number of graves by burial rite and sub-period (e.g. C1a, C2)'],
    [/^Monuments_yes/, 'Visible monuments recorded (yes/no)'],
    [/^Monuments_notes/, 'Notes on monuments'],
    [/^Weapons_yes/, 'Weapon graves recorded (yes/no)'],
    [/^Weapons_notes/, 'Notes on weapons'],
    [/^source$/, 'Literature/archive sources for the site (see reference list below)'],
    [/^NM_and_BMR$/, 'National Museum / Bornholms Museum registration references'],
    [/^status$/, 'Investigation / discovery history'],
    [/^notes$/i, 'Free-text notes'],
  ];
  const describe = f => (DESC.find(d => d[0].test(f)) || [null, ''])[1];

  const PIN = /,\s*(?=pp?\.\s)/;
  const clean = s => s.replace(/[\s.]+$/, '').trim();

  function parseSources(rows) {
    const works = new Map();
    let none = 0;
    rows.forEach(r => {
      const raw = String(r.source || '').trim();
      if (!raw) { none++; return; }
      const label = (r.stednavn || '?') + (r.stednr ? ` (${r.stednr})` : '');
      const seen = new Set();
      raw.split(';').map(x => x.trim()).filter(Boolean).forEach(part => {
        const i = part.search(PIN);
        const title = clean(i >= 0 ? part.slice(0, i) : part);
        const pin = i >= 0 ? clean(part.slice(i).replace(/^,\s*/, '')) : '';
        const m = title.match(/^([^,(]+).*?\([^)]*?(\d{4})\)/) || title.match(/^([A-Za-zÀ-ÿ.\s]+?)\s+(\d{4})$/);
        const key = m ? m[1].trim().toLowerCase() + '|' + m[2] : title.toLowerCase();
        let w = works.get(key);
        if (!w) works.set(key, w = { title, sites: new Set(), pins: [] });
        if (title.length > w.title.length) w.title = title;
        w.sites.add(label);
        if (pin && !seen.has(key + pin)) { w.pins.push(`${label}: ${pin}`); seen.add(key + pin); }
      });
    });
    return { list: [...works.values()].sort((a, b) => b.sites.size - a.sites.size), none };
  }

  function build({ rows, fields, format, scope, names }) {
    const L = [];
    const total = rows.length;
    L.push('FORTIS CEMETERIES EXPLORER – EXPORT METADATA');
    L.push('='.repeat(44));
    L.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
    L.push(`Format: ${format}`);
    if (scope) L.push(`Selection: ${scope}`);
    L.push(`Records: ${total} burial sites`);
    L.push('');
    L.push('DATASET');
    L.push('-------');
    L.push('Iron Age and Viking Age burial sites on Bornholm, Denmark, compiled from');
    L.push('published literature, museum archives and the Danish heritage database.');
    L.push('One row = one site. Grave counts are per site, split by burial rite');
    L.push('(urn, cremation, inhumation, boat, chamber, stone cist) and by sub-period.');
    L.push('Coordinates: WGS84 (EPSG:4326) lat/lon; UTM columns are EPSG:25832.');
    L.push('Empty cells mean "not recorded", not zero.');
    L.push('');
    L.push(`FIELDS (${fields.length})`);
    L.push('------');
    fields.forEach((f, i) => {
      const d = describe(f);
      const n = names && names[i] !== f ? ` [shapefile name: ${names[i]}]` : '';
      L.push(`- ${f}${n}${d ? ' – ' + d : ''}`);
    });
    L.push('');
    const { list, none } = parseSources(rows);
    L.push('SOURCES');
    L.push('-------');
    L.push(`${list.length} distinct works are cited by the ${total - none} exported sites that have a source`);
    L.push(`recorded${none ? ` (${none} sites have none)` : ''}. Each work is listed once; see its page references below.`);
    L.push('');
    list.forEach((w, i) => {
      L.push(`[${i + 1}] ${w.title}`);
      L.push(`    Used by ${w.sites.size} of ${total} sites${w.sites.size === total ? ' (all)' : ''}.`);
      if (w.pins.length) {
        L.push('    Page/entry references:');
        w.pins.forEach(p => L.push('      · ' + p));
      }
      L.push('');
    });
    return L.join('\n');
  }

  // Bundles data + metadata.txt into one zip (or adds it to an existing zip).
  async function download(blob, filename, ctx) {
    const meta = build(ctx);
    if (typeof JSZip === 'undefined') {
      downloadBlob(blob, filename);
      setTimeout(() => downloadBlob(new Blob([meta], { type: 'text/plain;charset=utf-8' }), 'metadata.txt'), 400);
      return;
    }
    let zip;
    const isZip = /\.zip$/i.test(filename);
    zip = isZip ? await JSZip.loadAsync(blob) : new JSZip();
    if (!isZip) zip.file(filename, blob);
    zip.file('metadata.txt', meta);
    const out = await zip.generateAsync({ type: 'blob' });
    downloadBlob(out, isZip ? filename : filename.replace(/\.[^.]+$/, '') + '.zip');
  }

  window.ExportMeta = { build, download };
})();
