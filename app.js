/**
 * BORNHOLM GRAVES EXPLORER - APPLICATION CORE
 * Features:
 * - MapLibre 3D Globe & Local Planar ESRI Satellite View Switcher
 * - Smart Hierarchical Period Filter (Aggregate Eras vs. Specific Sub-phases)
 * - Real-Time Live Sync with bornholm_graves_master.csv
 * - Custom Glassmorphism UI & Archaeological Dossier Inspector
 * - Instant Extraction / Data Export (CSV, JSON, GeoJSON)
 */

// Global State
const state = {
  allSites: [],
  filteredSites: [],
  selectedSite: null,
  activeEra: 'ALL', // ALL, PRKZ, ARKZ, JRKZ, AEGJ, YGJ
  selectedSubPhases: new Set(),
  selectedGraveTypes: new Set(['Urn', 'Cremation', 'Inhumation', 'Chamber', 'Boat', 'Cist']),
  weaponsOnly: false,
  monumentsOnly: false,
  highPotentialOnly: false,
  selectedParish: 'ALL',
  searchQuery: '',
  mapMode: 'local', // 'local' or 'globe'
  showLabels: true,
  showHeatmap: false,
  lastModifiedHeader: null,
  pollTimer: null
};

// Parish Code mapping for Bornholm
const PARISH_NAMES = {
  '060101': 'Allinge-Sandvig',
  '060102': 'Hasle',
  '060103': 'Rutsker',
  '060104': 'Klemensker',
  '060105': 'Olsker',
  '060106': 'Nyker',
  '060107': 'Rø',
  '060201': 'Bodilsker',
  '060202': 'Nexø',
  '060203': 'Bodilsker / Povlsker',
  '060204': 'Poulsker (Povlsker)',
  '060205': 'Vestermarie / Åker',
  '060206': 'Pedersker',
  '060301': 'Knudsker',
  '060302': 'Rønne Landdistrikt',
  '060303': 'Nylarsker',
  '060304': 'Vestermarie Syd',
  '060305': 'Aaker (Åker)',
  '060402': 'Ibsker (Gudhjem)',
  '060403': 'Svaneke',
  '060404': 'Svaneke By',
  '060405': 'Østerlarsker',
  '060406': 'Østermarie'
};

// Sub-phase definitions
const SUB_PHASE_KEYS = [
  { key: 'B2/C1a', label: 'B2 / C1a (Transitional)' },
  { key: 'C1a', label: 'Phase C1a' },
  { key: 'C1b', label: 'Phase C1b' },
  { key: 'C1a/b', label: 'Phase C1a/b' },
  { key: 'C1b/C2a', label: 'Phase C1b/C2a' },
  { key: 'C1', label: 'Phase C1 (Broad)' },
  { key: 'C1-C2', label: 'Phase C1–C2' },
  { key: 'C2a', label: 'Phase C2a' },
  { key: 'C2b', label: 'Phase C2b' },
  { key: 'C2', label: 'Phase C2 (Broad)' },
  { key: 'C2/C3', label: 'Phase C2/C3' },
  { key: 'C3', label: 'Phase C3' }
];

let map;
let hoverPopup;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initSubPhaseChips();
  initEventListeners();
  loadMasterData();
  startLiveSyncWatcher();
});

// ==========================================================================
// MAP INITIALIZATION (MAPLIBRE GL + ESRI SATELLITE GLOBE)
// ==========================================================================
function initMap() {
  hoverPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 12
  });

  const mapStyle = {
    version: 8,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics'
      },
      'esri-labels': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256
      }
    },
    layers: [
      {
        id: 'esri-satellite-layer',
        type: 'raster',
        source: 'esri-satellite',
        paint: { 'raster-opacity': 1.0 }
      },
      {
        id: 'esri-labels-layer',
        type: 'raster',
        source: 'esri-labels',
        paint: { 'raster-opacity': 0.85 },
        layout: { visibility: 'visible' }
      }
    ]
  };

  // Default: Local Bornholm true north planar cartographic view
  map = new maplibregl.Map({
    container: 'map',
    style: mapStyle,
    center: [14.92, 55.13],
    zoom: 10.4,
    pitch: 0,
    bearing: 0,
    maxZoom: 18,
    minZoom: 1.5,
    attributionControl: false
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

  map.on('load', () => {
    addMapDataLayers();
    updateMapData();
  });

  map.on('zoom', () => {
    const zb = document.getElementById('zoomLevelBadge');
    if (zb) zb.textContent = `Zoom: ${map.getZoom().toFixed(1)}`;
  });
}

function addMapDataLayers() {
  // Empty GeoJSON Source
  map.addSource('bornholm-sites', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: false
  });

  // Heatmap Layer (toggleable)
  map.addLayer({
    id: 'sites-heatmap',
    type: 'heatmap',
    source: 'bornholm-sites',
    maxzoom: 14,
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': [
        'interpolate', ['linear'], ['get', 'totalGraves'],
        0, 0.2,
        20, 0.5,
        100, 1.0
      ],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 3],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(56, 189, 248, 0.5)',
        0.5, 'rgba(251, 191, 36, 0.7)',
        0.8, 'rgba(239, 68, 68, 0.9)'
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 15, 14, 35],
      'heatmap-opacity': 0.75
    }
  });

  // Glowing Outer Ping Rings
  map.addLayer({
    id: 'sites-glow',
    type: 'circle',
    source: 'bornholm-sites',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'totalGraves'],
        0, 10,
        10, 14,
        50, 20,
        200, 28,
        1500, 36
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'hasWeapons'], true], 'rgba(56, 189, 248, 0.3)',
        ['==', ['get', 'hasMonuments'], true], 'rgba(52, 211, 153, 0.25)',
        'rgba(251, 191, 36, 0.25)'
      ],
      'circle-blur': 0.8
    }
  });

  // Solid Inner Point Marker Circles
  map.addLayer({
    id: 'sites-points',
    type: 'circle',
    source: 'bornholm-sites',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'totalGraves'],
        0, 6,
        10, 8,
        50, 12,
        200, 17,
        1500, 23
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'hasWeapons'], true], '#38bdf8',
        ['==', ['get', 'hasMonuments'], true], '#34d399',
        '#fbbf24'
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  });

  // Site Marker Click & Hover Events
  map.on('click', 'sites-points', (e) => {
    if (!e.features || !e.features.length) return;
    const siteId = e.features[0].properties.systemnr || e.features[0].properties.stednavn;
    const site = state.allSites.find(s => s.systemnr === siteId || s.stednavn === siteId);
    if (site) {
      openSiteDossier(site);
      flyToSite(site);
    }
  });

  map.on('mouseenter', 'sites-points', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    if (!e.features || !e.features.length) return;
    const p = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();

    const gravesText = p.totalGraves > 0 ? `${p.totalGraves} graves` : 'Grave site (count unspecified)';
    const weaponBadge = p.hasWeapons ? '<span style="color:#38bdf8;">⚔️ Weapons</span>' : '';
    const monumentBadge = p.hasMonuments ? '<span style="color:#34d399;">🪨 Monument</span>' : '';

    const html = `
      <div class="popup-site-title">${p.stednavn}</div>
      <div class="popup-site-graves">${gravesText} &bull; ${p.parishName || ''}</div>
      <div class="popup-badges">
        ${weaponBadge} ${monumentBadge}
      </div>
    `;

    hoverPopup.setLngLat(coords).setHTML(html).addTo(map);
  });

  map.on('mouseleave', 'sites-points', () => {
    map.getCanvas().style.cursor = '';
    hoverPopup.remove();
  });
}

function updateMapData() {
  if (!map || !map.getSource('bornholm-sites')) return;

  const features = [];
  state.filteredSites.forEach(site => {
    const lat = parseFloat(site.wgs84_latitude);
    const lon = parseFloat(site.wgs84_longitude);
    if (!isNaN(lat) && !isNaN(lon) && lat > 54.0 && lon > 14.0) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat]
        },
        properties: {
          systemnr: site.systemnr,
          stednavn: site.stednavn,
          alt_stednavm: site.alt_stednavm,
          stednr: site.stednr,
          loknr: site.loknr,
          parishName: getParishName(site.stednr),
          totalGraves: parseInt(site.Total_graves) || 0,
          hasWeapons: site.Weapons_yes_or_no === 'Yes',
          hasMonuments: site.Monuments_yes_or_no === 'Yes',
          analyticalPotential: site.Analytical_potential
        }
      });
    }
  });

  map.getSource('bornholm-sites').setData({
    type: 'FeatureCollection',
    features: features
  });

  updateGlobeData();
}

function flyToSite(site) {
  const lat = parseFloat(site.wgs84_latitude);
  const lon = parseFloat(site.wgs84_longitude);
  if (!isNaN(lat) && !isNaN(lon) && lat > 54.0 && lon > 14.0) {
    if (state.mapMode === 'globe') {
      switchToLocalView();
    }
    map.flyTo({
      center: [lon, lat],
      zoom: Math.max(map.getZoom(), 13.5),
      pitch: 0,
      bearing: 0,
      duration: 1500
    });
  } else {
    showNotification(`"${site.stednavn}": No geographic coordinates recorded in source archive.`);
  }
}

// ==========================================================================
// DATA LOADING & LIVE SYNCHRONIZATION
// ==========================================================================
async function loadMasterData() {
  const statusPill = document.getElementById('syncStatusPill');
  const syncText = document.getElementById('syncText');
  if (syncText) syncText.textContent = 'Syncing...';

  try {
    // Add cache-busting timestamp to guarantee freshness from disk
    const url = `bornholm_graves_master.csv?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch master CSV: ${response.statusText}`);
    }

    // Save etag/last-modified for live sync checking
    state.lastModifiedHeader = response.headers.get('Last-Modified') || response.headers.get('ETag');

    const csvText = await response.text();
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        processParsedData(results.data);
        if (syncText) syncText.textContent = `Live (${results.data.length} sites)`;
      },
      error: (err) => {
        console.error('PapaParse error:', err);
        if (syncText) syncText.textContent = 'CSV Parse Error';
      }
    });
  } catch (error) {
    console.warn('Network fetch error, attempting fallback to local json:', error);
    try {
      const jRes = await fetch(`bornholm_graves_master.json?t=${Date.now()}`);
      const jData = await jRes.json();
      processParsedData(jData);
      if (syncText) syncText.textContent = `Live (${jData.length} sites)`;
    } catch (e) {
      if (syncText) syncText.textContent = 'Sync Offline';
    }
  }
}

function processParsedData(data) {
  state.allSites = data.map(r => ({
    ...r,
    Total_graves: parseInt(r.Total_graves) || 0,
    urn_count: parseInt(r['Graves per type: Urn']) || 0,
    crem_count: parseInt(r['Graves per type: Cremation grave']) || 0,
    inh_count: parseInt(r['Graves per type: Inhumation']) || 0,
    boat_count: parseInt(r['Graves per type: Boat grave']) || 0,
    chamber_count: parseInt(r['Graves per type: Chamber grave']) || 0,
    cist_count: parseInt(r['Graves per type: Stone cist']) || 0
  }));

  populateParishDropdown();
  applyFilters();
}

function startLiveSyncWatcher() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  // Poll every 3.5 seconds to see if CSV on disk was changed
  state.pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`bornholm_graves_master.csv?check=${Date.now()}`, { method: 'HEAD' });
      const curHeader = res.headers.get('Last-Modified') || res.headers.get('ETag');
      if (curHeader && state.lastModifiedHeader && curHeader !== state.lastModifiedHeader) {
        console.log('Detected change in bornholm_graves_master.csv on disk! Live reloading...');
        state.lastModifiedHeader = curHeader;
        loadMasterData();
        showNotification('Master CSV modified on disk – dataset reloaded!');
      }
    } catch (e) {
      // Ignore network polling blips
    }
  }, 3500);
}

// ==========================================================================
// SMART FILTER ENGINE (HIERARCHICAL PERIODS & MULTI-FACETS)
// ==========================================================================
function applyFilters() {
  const q = state.searchQuery.toLowerCase().trim();

  state.filteredSites = state.allSites.filter(site => {
    // 1. Text Search across key fields
    if (q) {
      const matchName = site.stednavn && site.stednavn.toLowerCase().includes(q);
      const matchAlt = site.alt_stednavm && site.alt_stednavm.toLowerCase().includes(q);
      const matchNotes = site.Notes && site.Notes.toLowerCase().includes(q);
      const matchWep = site.Weapons_notes && site.Weapons_notes.toLowerCase().includes(q);
      const matchMon = site.Monuments_notes && site.Monuments_notes.toLowerCase().includes(q);
      const matchMuseum = site.NM_and_BMR && site.NM_and_BMR.toLowerCase().includes(q);
      const matchParish = getParishName(site.stednr).toLowerCase().includes(q);
      const matchSys = site.systemnr && site.systemnr.toString().includes(q);

      if (!matchName && !matchAlt && !matchNotes && !matchWep && !matchMon && !matchMuseum && !matchParish && !matchSys) {
        return false;
      }
    }

    // 2. Parish Filter
    if (state.selectedParish !== 'ALL') {
      const normSiteParish = normalizeStednr(site.stednr);
      if (normSiteParish !== state.selectedParish) {
        return false;
      }
    }

    // 3. Special Context Toggles
    if (state.weaponsOnly && site.Weapons_yes_or_no !== 'Yes') {
      return false;
    }
    if (state.monumentsOnly && site.Monuments_yes_or_no !== 'Yes') {
      return false;
    }
    if (state.highPotentialOnly && !site.Analytical_potential.toLowerCase().startsWith('high')) {
      return false;
    }

    // 4. Grave Types Filter
    // If all 6 types are checked (default), do not exclude unclassified or general grave sites.
    // If specific types are unchecked, restrict to sites containing the checked types.
    if (state.selectedGraveTypes.size < 6) {
      const matchesGraveType = (
        (state.selectedGraveTypes.has('Urn') && site.urn_count > 0) ||
        (state.selectedGraveTypes.has('Cremation') && site.crem_count > 0) ||
        (state.selectedGraveTypes.has('Inhumation') && site.inh_count > 0) ||
        (state.selectedGraveTypes.has('Chamber') && site.chamber_count > 0) ||
        (state.selectedGraveTypes.has('Boat') && site.boat_count > 0) ||
        (state.selectedGraveTypes.has('Cist') && site.cist_count > 0)
      );
      if (!matchesGraveType) return false;
    }

    // 5. Smart Chronological Periods (Dateringer)
    // If granular subphases are selected, match any selected subphase
    if (state.selectedSubPhases.size > 0) {
      let matchesAnySubPhase = false;
      for (const phaseKey of state.selectedSubPhases) {
        if (siteHasSubPhase(site, phaseKey)) {
          matchesAnySubPhase = true;
          break;
        }
      }
      if (!matchesAnySubPhase) return false;
    } else if (state.activeEra !== 'ALL') {
      // Otherwise filter by active aggregate era
      if (!siteMatchesEra(site, state.activeEra)) {
        return false;
      }
    }

    return true;
  });

  updateUI();
  updateMapData();
}

function parseYear(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val.toString().trim());
  return isNaN(n) ? null : n;
}

function siteMatchesEra(site, era) {
  if (era === 'ALL') return true;

  const f = parseYear(site.fra_aar);
  const t = parseYear(site.til_aar);
  const notes = (site.Notes || '') + ' ' + (site.alt_stednavm || '');

  if (era === 'PRKZ') {
    // Pre-Roman Iron Age (~500 BC – 1 AD)
    const yearMatch = (f !== null && t !== null && Math.max(f, -500) <= Math.min(t, 1));
    const colMatch = (
      hasCount(site['Graves_urn_PRKZ']) ||
      hasCount(site['Graves_inhumation_PRKZ']) ||
      hasCount(site['Graves_cremation_PRKZ'])
    );
    const textMatch = /pre-roman|førromersk|prkz/i.test(notes);
    return yearMatch || colMatch || textMatch;
  }

  if (era === 'ARKZ') {
    // Early Roman Iron Age (~1 – 160 AD)
    const yearMatch = (f !== null && t !== null && Math.max(f, 1) <= Math.min(t, 160));
    const colMatch = (
      hasCount(site['Graves_urn_ÄRKZ']) ||
      hasCount(site['Graves_inhumation_ÄRKZ']) ||
      hasCount(site['Graves_cremation_ÄRKZ']) ||
      hasCount(site['Graves_urn_late_roman_iron_age B2/C1a']) ||
      hasCount(site['Graves_inhumation_late_roman_iron_age B2/C1a']) ||
      hasCount(site['Graves_cremation_late_roman_iron_age B2/C1a'])
    );
    const textMatch = /early roman|ældre romersk|ärkz|\bb1\b|\bb2\b/i.test(notes);
    return yearMatch || colMatch || textMatch;
  }

  if (era === 'JRKZ') {
    // Late Roman Iron Age (Phases C1, C2, C3, ~160 – 375/400 AD)
    const yearMatch = (f !== null && t !== null && Math.max(f, 160) <= Math.min(t, 400));
    const jrkzKeys = [
      'Graves_urn_JRKZ', 'Graves_inhumation_JRKZ', 'Graves_cremation_JRKZ',
      'Graves_urn_late_roman_iron_age C1a', 'Graves_inhumation_late_roman_iron_age C1a', 'Graves_cremation_late_roman_iron_age C1a',
      'Graves_urn_late_roman_iron_age C1b', 'Graves_inhumation_late_roman_iron_age C1b', 'Graves_cremation_late_roman_iron_age C1b',
      'Graves_urn_late_roman_iron_age C1a/b', 'Graves_inhumation_late_roman_iron_age C1a/b', 'Graves_cremation_late_roman_iron_age C1a/b',
      'Graves_urn_late_roman_iron_age C1b/C2a', 'Graves_inhumation_late_roman_iron_age C1b/C2a', 'Graves_cremation_late_roman_iron_age C1b/C2a',
      'Graves_urn_late_roman_iron_age C2a', 'Graves_inhumation_late_roman_iron_age C2a', 'Graves_cremation_late_roman_iron_age C2a',
      'Graves_urn_late_roman_iron_age C2b', 'Graves_inhumation_late_roman_iron_age C2b', 'Graves_cremation_late_roman_iron_age C2b',
      'Graves_urn_late_roman_iron_age C2', 'Graves_inhumation_late_roman_iron_age C2', 'Graves_cremation_late_roman_iron_age C2',
      'Graves_urn_late_roman_iron_age C2/C3', 'Graves_inhumation_late_roman_iron_age C2/C3', 'Graves_cremation_late_roman_iron_age C2/C3',
      'Graves_urn_late_roman_iron_age C3', 'Graves_inhumation_late_roman_iron_age C3', 'Graves_cremation_late_roman_iron_age C3',
      'Graves_urn_late_roman_iron_age C1', 'Graves_inhumation_late_roman_iron_age C1', 'Graves_cremation_late_roman_iron_age C1',
      'Graves_urn_late_roman_iron_age C1-C2', 'Graves_inhumation_late_roman_iron_age C1-C2', 'Graves_cremation_late_roman_iron_age C1-C2'
    ];
    const colMatch = jrkzKeys.some(k => hasCount(site[k]));
    const textMatch = /late roman|yngre romersk|jrkz|\bc1\b|\bc2\b|\bc3\b/i.test(notes);
    return yearMatch || colMatch || textMatch;
  }

  if (era === 'AEGJ') {
    // Early Germanic Iron Age / Migration Period (~375/400 – 550 AD)
    const yearMatch = (f !== null && t !== null && Math.max(f, 375) <= Math.min(t, 550));
    const colMatch = (
      hasCount(site['Graves_urn_ÆGJ']) ||
      hasCount(site['Graves_inhumation_ÆGJ']) ||
      hasCount(site['Graves_cremation_ÆGJ'])
    );
    const textMatch = /early germanic|ægj|egj|ældre germansk|folkevandringstid|migration period/i.test(notes);
    return yearMatch || colMatch || textMatch;
  }

  if (era === 'YGJ') {
    // Late Germanic & Viking Age (~550 – 1050 AD)
    const yearMatch = (f !== null && t !== null && Math.max(f, 550) <= Math.min(t, 1066));
    const textMatch = /late germanic|ygj|yngre germansk|viking|vendel|merovingertid/i.test(notes);
    return yearMatch || textMatch;
  }

  return true;
}

function siteHasSubPhase(site, phase) {
  const urnKey = `Graves_urn_late_roman_iron_age ${phase}`;
  const inhKey = `Graves_inhumation_late_roman_iron_age ${phase}`;
  const cremKey = `Graves_cremation_late_roman_iron_age ${phase}`;
  const colMatch = hasCount(site[urnKey]) || hasCount(site[inhKey]) || hasCount(site[cremKey]);
  if (colMatch) return true;

  const notes = (site.Notes || '') + ' ' + (site.alt_stednavm || '');
  const escaped = phase.replace('/', '\\/');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(notes);
}

function hasCount(val) {
  if (val === undefined || val === null || val === '') return false;
  const n = parseInt(val);
  return !isNaN(n) && n > 0;
}

// ==========================================================================
// UI & CONTROLS UPDATES
// ==========================================================================
function updateUI() {
  // Update Header Badges
  const countBadge = document.getElementById('exportCountBadge');
  if (countBadge) countBadge.textContent = state.filteredSites.length;

  const sidebarDownloadBadge = document.getElementById('sidebarDownloadBadge');
  if (sidebarDownloadBadge) sidebarDownloadBadge.textContent = `${state.filteredSites.length} sites`;

  const resultsListCount = document.getElementById('resultsListCount');
  if (resultsListCount) resultsListCount.textContent = state.filteredSites.length;

  // Update Metric Summary Cards
  const totalGraves = state.filteredSites.reduce((sum, s) => sum + (parseInt(s.Total_graves) || 0), 0);
  const weaponSites = state.filteredSites.filter(s => s.Weapons_yes_or_no === 'Yes').length;
  const monumentSites = state.filteredSites.filter(s => s.Monuments_yes_or_no === 'Yes').length;

  document.getElementById('metricSites').textContent = state.filteredSites.length;
  document.getElementById('metricGraves').textContent = totalGraves.toLocaleString();
  document.getElementById('metricWeapons').textContent = weaponSites;
  document.getElementById('metricMonuments').textContent = monumentSites;

  // Update Aggregate Era Counts
  updateEraCounts();

  // Update Mini List in Sidebar
  renderMiniList();

  // Update Bottom Table if open
  renderTableData();
}

function updateEraCounts() {
  const prkz = state.allSites.filter(s => siteMatchesEra(s, 'PRKZ')).length;
  const arkz = state.allSites.filter(s => siteMatchesEra(s, 'ARKZ')).length;
  const jrkz = state.allSites.filter(s => siteMatchesEra(s, 'JRKZ')).length;
  const aegj = state.allSites.filter(s => siteMatchesEra(s, 'AEGJ')).length;
  const ygj = state.allSites.filter(s => siteMatchesEra(s, 'YGJ')).length;

  document.getElementById('countEraAll').textContent = state.allSites.length;
  document.getElementById('countEraPRKZ').textContent = prkz;
  document.getElementById('countEraARKZ').textContent = arkz;
  document.getElementById('countEraJRKZ').textContent = jrkz;
  document.getElementById('countEraAEGJ').textContent = aegj;
  document.getElementById('countEraYGJ').textContent = ygj;
}

function renderMiniList() {
  const listContainer = document.getElementById('sitesMiniList');
  if (!listContainer) return;

  if (state.filteredSites.length === 0) {
    listContainer.innerHTML = '<div style="color:var(--text-dim);font-size:11.5px;padding:12px;text-align:center;">No sites match current filters.</div>';
    return;
  }

  let html = '';
  // Show up to 100 in mini-list for performance
  const displaySites = state.filteredSites.slice(0, 80);
  displaySites.forEach(site => {
    const isAct = state.selectedSite && (state.selectedSite.systemnr === site.systemnr && state.selectedSite.stednavn === site.stednavn);
    const wepIcon = site.Weapons_yes_or_no === 'Yes' ? '<i class="fa-solid fa-shield text-cyan" title="Weapons"></i>' : '';
    const monIcon = site.Monuments_yes_or_no === 'Yes' ? '<i class="fa-solid fa-monument text-emerald" title="Monument"></i>' : '';
    const graves = site.Total_graves > 0 ? `${site.Total_graves}g` : '-';

    html += `
      <div class="mini-site-item ${isAct ? 'active' : ''}" data-id="${site.systemnr || site.stednavn}">
        <span class="mini-site-name" title="${site.stednavn} (${site.alt_stednavm || ''})">${site.stednavn}</span>
        <div class="mini-site-meta">
          ${wepIcon} ${monIcon}
          <span>${graves}</span>
        </div>
      </div>
    `;
  });

  if (state.filteredSites.length > 80) {
    html += `<div style="text-align:center;font-size:11px;color:var(--text-dim);padding:6px;">+ ${state.filteredSites.length - 80} more sites (use search or table)</div>`;
  }

  listContainer.innerHTML = html;

  // Add click handlers
  listContainer.querySelectorAll('.mini-site-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      const site = state.filteredSites.find(s => s.systemnr === id || s.stednavn === id);
      if (site) {
        openSiteDossier(site);
        flyToSite(site);
      }
    });
  });
}

function initSubPhaseChips() {
  const container = document.getElementById('phaseChipsContainer');
  if (!container) return;

  let html = '';
  SUB_PHASE_KEYS.forEach(p => {
    html += `
      <label class="phase-chip" data-phase="${p.key}">
        <input type="checkbox" value="${p.key}">
        <span>${p.key}</span>
      </label>
    `;
  });
  container.innerHTML = html;

  container.querySelectorAll('.phase-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const phase = chip.getAttribute('data-phase');
      if (state.selectedSubPhases.has(phase)) {
        state.selectedSubPhases.delete(phase);
        chip.classList.remove('selected');
      } else {
        state.selectedSubPhases.add(phase);
        chip.classList.add('selected');
      }
      applyFilters();
    });
  });
}

function populateParishDropdown() {
  const sel = document.getElementById('parishSelect');
  if (!sel) return;

  const parishes = new Set();
  state.allSites.forEach(s => {
    const p = normalizeStednr(s.stednr);
    if (p) parishes.add(p);
  });

  const sorted = Array.from(parishes).sort();
  let html = '<option value="ALL">All Parishes on Bornholm</option>';
  sorted.forEach(pCode => {
    const pName = PARISH_NAMES[pCode] || `Parish ${pCode}`;
    const count = state.allSites.filter(s => normalizeStednr(s.stednr) === pCode).length;
    html += `<option value="${pCode}">${pName} (${count})</option>`;
  });
  sel.innerHTML = html;
}

function normalizeStednr(val) {
  if (!val) return '';
  let s = val.toString().trim();
  if (s.length === 5) s = '0' + s;
  return s;
}

function getParishName(stednr) {
  const code = normalizeStednr(stednr);
  return PARISH_NAMES[code] || `Parish ${code}`;
}

// ==========================================================================
// ARCHAEOLOGICAL DOSSIER INSPECTOR
// ==========================================================================
function openSiteDossier(site) {
  state.selectedSite = site;
  const drawer = document.getElementById('dossierDrawer');
  const title = document.getElementById('dossierTitle');
  const subtitle = document.getElementById('dossierSubtitle');
  const tagsContainer = document.getElementById('dossierTags');
  const body = document.getElementById('dossierBody');

  drawer.classList.add('open');

  title.textContent = site.stednavn;
  const altText = site.alt_stednavm ? `Alt: ${site.alt_stednavm} &bull; ` : '';
  subtitle.innerHTML = `${altText}Parish: <strong>${getParishName(site.stednr)}</strong> (${normalizeStednr(site.stednr)})`;

  // Badges
  let tagsHtml = '';
  if (site.Weapons_yes_or_no === 'Yes') {
    tagsHtml += '<span class="dossier-badge badge-weapon"><i class="fa-solid fa-shield"></i> Weapon Grave</span>';
  }
  if (site.Monuments_yes_or_no === 'Yes') {
    tagsHtml += '<span class="dossier-badge badge-monument"><i class="fa-solid fa-monument"></i> Surface Monument</span>';
  }
  if (site.Analytical_potential) {
    tagsHtml += `<span class="dossier-badge badge-potential"><i class="fa-solid fa-award"></i> ${site.Analytical_potential.split('(')[0].trim()}</span>`;
  }
  tagsContainer.innerHTML = tagsHtml;

  // Build Dossier Sections
  const latNum = parseFloat(site.wgs84_latitude);
  const lonNum = parseFloat(site.wgs84_longitude);
  const hasCoords = !isNaN(latNum) && !isNaN(lonNum) && latNum > 54.0 && lonNum > 14.0;
  const lat = site.wgs84_latitude || '';
  const lon = site.wgs84_longitude || '';
  const easting = site.utm32n_x_easting || '';
  const northing = site.utm32n_y_northing || '';

  const heritageUrl = site.url || (site.systemnr && !site.systemnr.toString().startsWith('FON-') ? `http://www.kulturarv.dk/fundogfortidsminder/Lokalitet/${site.systemnr}/` : null);

  const coordSectionHtml = hasCoords ? `
    <div class="coord-pill">
      <span>WGS84: ${lat}, ${lon}</span>
      <button class="btn-copy-coord" title="Copy WGS84 Coordinates" onclick="navigator.clipboard.writeText('${lat}, ${lon}')">
        <i class="fa-regular fa-copy"></i>
      </button>
    </div>
    <div class="coord-pill" style="margin-top:4px;">
      <span>UTM32N: ${easting} E, ${northing} N</span>
      <button class="btn-copy-coord" title="Copy UTM Coordinates" onclick="navigator.clipboard.writeText('${easting}, ${northing}')">
        <i class="fa-regular fa-copy"></i>
      </button>
    </div>
  ` : `
    <div class="coord-pill" style="color:var(--text-muted);background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.08);padding:7px 10px;">
      <span><i class="fa-solid fa-location-slash" style="margin-right:6px;color:#f59e0b;"></i>No spatial coordinates recorded in source archive</span>
    </div>
  `;

  let bodyHtml = `
    <!-- Spatial & Administrative Register -->
    <div class="dossier-card">
      <div class="dossier-card-title"><i class="fa-solid fa-map-location-dot"></i> Geographical & Registry Reference</div>
      <div class="dossier-card-content">
        <div><strong>National System No:</strong> ${site.systemnr || 'Literature reference'}</div>
        <div><strong>Parish / Local No:</strong> Stednr ${normalizeStednr(site.stednr)} &bull; Loknr ${site.loknr || '-'}</div>
        ${coordSectionHtml}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          ${heritageUrl ? `
            <a href="${heritageUrl}" target="_blank" rel="noopener noreferrer" class="btn-external-heritage" style="flex:1;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open in SKS
            </a>
          ` : ''}
          ${hasCoords ? `
            <button class="glass-btn-xs" id="btnExportSiteSHP" title="Download this site as ESRI Shapefile (.shp / .zip)">
              <i class="fa-solid fa-file-zipper text-cyan"></i> Export SHP
            </button>
            <button class="glass-btn-xs" id="btnExportSiteGeoJSON" title="Download this site as GeoJSON">
              <i class="fa-solid fa-map-location-dot"></i> GeoJSON
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Grave Counts Breakdown -->
    <div class="dossier-card">
      <div class="dossier-card-title"><i class="fa-solid fa-monument"></i> Burial Census & Grave Types</div>
      <div class="dossier-card-content">
        <div style="font-size:14px;margin-bottom:6px;">
          Total Recorded Graves: <strong style="color:var(--primary-cyan);font-size:18px;">${site.Total_graves || 'Unspecified'}</strong>
        </div>
        <div class="grave-breakdown-grid">
          <div class="breakdown-box">
            <div class="val">${site.urn_count || 0}</div>
            <div class="lbl">Urn</div>
          </div>
          <div class="breakdown-box">
            <div class="val">${site.crem_count || 0}</div>
            <div class="lbl">Cremation</div>
          </div>
          <div class="breakdown-box">
            <div class="val">${site.inh_count || 0}</div>
            <div class="lbl">Inhumation</div>
          </div>
          <div class="breakdown-box">
            <div class="val">${site.chamber_count || 0}</div>
            <div class="lbl">Chamber</div>
          </div>
          <div class="breakdown-box">
            <div class="val">${site.boat_count || 0}</div>
            <div class="lbl">Boat</div>
          </div>
          <div class="breakdown-box">
            <div class="val">${site.cist_count || 0}</div>
            <div class="lbl">Stone Cist</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Weapons Analysis -->
    <div class="dossier-card">
      <div class="dossier-card-title"><i class="fa-solid fa-shield-halved"></i> Weapons & Warrior Equipment</div>
      <div class="dossier-card-content">
        <div style="margin-bottom:6px;">
          Presence of Weapons: <strong style="color:${site.Weapons_yes_or_no === 'Yes' ? 'var(--primary-cyan)' : 'var(--text-muted)'};">${site.Weapons_yes_or_no || 'No'}</strong>
        </div>
        <p>${site.Weapons_notes || 'No weapons noted in published catalogue.'}</p>
      </div>
    </div>

    <!-- Surface Monuments -->
    <div class="dossier-card">
      <div class="dossier-card-title"><i class="fa-solid fa-mountain"></i> Surface Monuments & Earthworks</div>
      <div class="dossier-card-content">
        <div style="margin-bottom:6px;">
          Preserved Monuments: <strong style="color:${site.Monuments_yes_or_no === 'Yes' ? 'var(--accent-emerald)' : 'var(--text-muted)'};">${site.Monuments_yes_or_no || 'No'}</strong>
        </div>
        <p>${site.Monuments_notes || 'No surface monuments recorded.'}</p>
      </div>
    </div>

    <!-- Excavation History & Research State -->
    <div class="dossier-card">
      <div class="dossier-card-title"><i class="fa-solid fa-person-digging"></i> Excavation History & Fieldwork</div>
      <div class="dossier-card-content">
        <p>${site.excavation_state || 'No excavation history recorded.'}</p>
        <div style="margin-top:8px;">
          <strong>Museum Numbers:</strong> <span style="font-family:var(--font-mono);">${site.NM_and_BMR || 'N/A'}</span>
        </div>
      </div>
    </div>

    <!-- Analytical Potential & Synthesis -->
    <div class="dossier-card">
      <div class="dossier-card-title"><i class="fa-solid fa-microscope"></i> Analytical Potential & Evaluation</div>
      <div class="dossier-card-content">
        <p>${site.Analytical_potential || 'Unassessed'}</p>
      </div>
    </div>

    <!-- Academic Notes & Sources -->
    <div class="dossier-card">
      <div class="dossier-card-title"><i class="fa-solid fa-book-bookmark"></i> Academic Citations & Catalog Notes</div>
      <div class="dossier-card-content">
        <div style="margin-bottom:10px;">
          <strong>Source(s):</strong><br>
          <span style="font-size:11.5px;color:var(--text-muted);">${site['Source(s)'] || 'Fund og Fortidsminder'}</span>
        </div>
        <div>
          <strong>Detailed Synthesis Notes:</strong><br>
          <p style="margin-top:4px;font-size:12px;">${site.Notes || 'No notes.'}</p>
        </div>
      </div>
    </div>
  `;

  body.innerHTML = bodyHtml;

  // Single-site export listeners
  const btnSiteSHP = document.getElementById('btnExportSiteSHP');
  if (btnSiteSHP) {
    btnSiteSHP.addEventListener('click', () => {
      exportShapefile([site], `bornholm_site_${site.systemnr || (site.stednavn || 'site').replace(/[^a-zA-Z0-9]/g, '_')}`);
    });
  }
  const btnSiteGeoJSON = document.getElementById('btnExportSiteGeoJSON');
  if (btnSiteGeoJSON) {
    btnSiteGeoJSON.addEventListener('click', () => {
      const latNum = parseFloat(site.wgs84_latitude);
      const lonNum = parseFloat(site.wgs84_longitude);
      if (isNaN(latNum) || isNaN(lonNum) || latNum <= 54.0 || lonNum <= 14.0) {
        showNotification(`Cannot export spatial GeoJSON: "${site.stednavn}" has no recorded coordinates.`);
        return;
      }
      const singleGeo = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lonNum, latNum]
          },
          properties: site
        }]
      };
      downloadBlob(new Blob([JSON.stringify(singleGeo, null, 2)], { type: 'application/geo+json;charset=utf-8;' }), `bornholm_site_${site.systemnr || 'site'}.geojson`);
    });
  }

  renderMiniList(); // Re-render to highlight active item
}

function closeSiteDossier() {
  state.selectedSite = null;
  const drawer = document.getElementById('dossierDrawer');
  drawer.classList.remove('open');
  renderMiniList();
}

// ==========================================================================
// EXPORT EXTRACT CAPABILITIES
// ==========================================================================
function exportData(format) {
  const dataToExport = state.filteredSites.length > 0 ? state.filteredSites : state.allSites;
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `bornholm_graves_extract_${state.activeEra.toLowerCase()}_${timestamp}`;

  if (format === 'csv') {
    const csvStr = Papa.unparse(dataToExport);
    downloadBlob(new Blob(["\ufeff" + csvStr], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
  } else if (format === 'json') {
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    downloadBlob(new Blob([jsonStr], { type: 'application/json;charset=utf-8;' }), `${filename}.json`);
  } else if (format === 'geojson') {
    const geojson = {
      type: 'FeatureCollection',
      features: dataToExport
        .filter(s => s.wgs84_latitude && s.wgs84_longitude)
        .map(s => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(s.wgs84_longitude), parseFloat(s.wgs84_latitude)]
          },
          properties: s
        }))
    };
    downloadBlob(new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json;charset=utf-8;' }), `${filename}.geojson`);
  } else if (format === 'shp') {
    exportShapefile(dataToExport, filename);
  }
}

function exportShapefile(dataToExport, filename) {
  if (typeof shpwrite === 'undefined') {
    showNotification('Shapefile library loading... please try again in a moment.');
    return;
  }

  // Filter features with valid spatial coordinates
  const validSites = dataToExport.filter(s => {
    const lat = parseFloat(s.wgs84_latitude);
    const lon = parseFloat(s.wgs84_longitude);
    return !isNaN(lat) && !isNaN(lon) && lat > 54.0 && lon > 14.0;
  });

  if (validSites.length === 0) {
    showNotification('No sites with spatial coordinates in current filter to export to SHP.');
    return;
  }

  // Build clean GeoJSON with DBF-compliant attribute names (max 10 chars)
  const geojson = {
    type: 'FeatureCollection',
    features: validSites.map(s => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(s.wgs84_longitude), parseFloat(s.wgs84_latitude)]
      },
      properties: {
        systemnr: s.systemnr ? parseInt(s.systemnr) || 0 : 0,
        stednr: s.stednr ? s.stednr.toString().slice(0, 10) : '',
        loknr: s.loknr ? parseInt(s.loknr) || 0 : 0,
        stednavn: (s.stednavn || '').slice(0, 70),
        alt_navn: (s.alt_stednavm || '').slice(0, 70),
        sogn: (getParishName(s.stednr) || '').slice(0, 40),
        tot_graves: parseInt(s.Total_graves) || 0,
        urn_graves: parseInt(s.urn_count) || 0,
        crem_grave: parseInt(s.crem_count) || 0,
        inh_graves: parseInt(s.inh_count) || 0,
        chamber_gr: parseInt(s.chamber_count) || 0,
        boat_grave: parseInt(s.boat_count) || 0,
        cist_grave: parseInt(s.cist_count) || 0,
        weapons: (s.Weapons_yes_or_no || 'No').slice(0, 3),
        monuments: (s.Monuments_yes_or_no || 'No').slice(0, 3),
        potential: (s.Analytical_potential || '').slice(0, 80),
        fra_aar: (s.fra_aar || '').slice(0, 10),
        til_aar: (s.til_aar || '').slice(0, 10),
        heritage_u: (s.url || '').slice(0, 120),
        sources: (s['Source(s)'] || '').slice(0, 200),
        museum_no: (s.NM_and_BMR || '').slice(0, 100),
        notes: (s.Notes || '').slice(0, 250)
      }
    }))
  };

  showNotification('Packaging Shapefile archive...');
  try {
    shpwrite.zip(geojson, {
      folder: filename,
      filename: filename,
      outputType: 'blob',
      types: {
        point: filename
      }
    }).then(blob => {
      downloadBlob(blob, `${filename}.zip`);
      showNotification(`Shapefile (.zip) downloaded with ${validSites.length} spatial features!`);
    }).catch(err => {
      console.error('Error generating Shapefile zip:', err);
      showNotification('Error generating Shapefile: ' + (err.message || err));
    });
  } catch (err) {
    console.error('Error exporting Shapefile:', err);
    showNotification('Error generating Shapefile: ' + err.message);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Delay removing and revoking URL to avoid aborting download in Chromium / Safari
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 10000);
  showNotification(`Downloaded: ${filename}`);
}

// ==========================================================================
// BOTTOM TABLE MODAL
// ==========================================================================
function renderTableData() {
  const overlay = document.getElementById('tableOverlay');
  if (overlay.style.display === 'none') return;

  const countBadge = document.getElementById('tableCountBadge');
  if (countBadge) countBadge.textContent = state.filteredSites.length;

  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');

  const headers = ['systemnr', 'stednavn', 'alt_stednavm', 'stednr', 'loknr', 'Total_graves', 'Weapons_yes_or_no', 'Monuments_yes_or_no', 'Analytical_potential'];
  thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

  let rowsHtml = '';
  state.filteredSites.slice(0, 150).forEach(s => {
    rowsHtml += `
      <tr onclick="window.selectSiteFromTable('${s.systemnr || s.stednavn}')">
        <td>${s.systemnr || '-'}</td>
        <td><strong>${s.stednavn}</strong></td>
        <td>${s.alt_stednavm || '-'}</td>
        <td>${normalizeStednr(s.stednr)}</td>
        <td>${s.loknr || '-'}</td>
        <td><strong>${s.Total_graves || 0}</strong></td>
        <td>${s.Weapons_yes_or_no || 'No'}</td>
        <td>${s.Monuments_yes_or_no || 'No'}</td>
        <td>${(s.Analytical_potential || '').slice(0, 40)}</td>
      </tr>
    `;
  });
  tbody.innerHTML = rowsHtml;
}

window.selectSiteFromTable = function(id) {
  const site = state.allSites.find(s => s.systemnr === id || s.stednavn === id);
  if (site) {
    openSiteDossier(site);
    flyToSite(site);
  }
};

// ==========================================================================
// 3D PLANETARY GLOBE & CARTOGRAPHIC VIEW ENGINE
// ==========================================================================
let globeViz = null;

function initGlobe() {
  const container = document.getElementById('globeContainer');
  if (!container) return;
  if (globeViz) {
    updateGlobeData();
    return;
  }

  if (typeof Globe === 'undefined') {
    console.warn('Globe.gl library not loaded; falling back to map view.');
    return;
  }

  try {
    container.innerHTML = '';
    globeViz = Globe()(container)
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('#38bdf8')
      .atmosphereAltitude(0.2)
      .pointLat(d => parseFloat(d.wgs84_latitude))
      .pointLng(d => parseFloat(d.wgs84_longitude))
      .pointColor(d => d.Weapons_yes_or_no === 'Yes' ? '#38bdf8' : (d.Monuments_yes_or_no === 'Yes' ? '#34d399' : '#f59e0b'))
      .pointAltitude(0.018)
      .pointRadius(0.35)
      .pointLabel(d => `
        <div style="background:rgba(15,23,42,0.92);padding:8px 12px;border-radius:8px;border:1px solid rgba(56,189,248,0.4);font-family:sans-serif;color:#f8fafc;font-size:12px;box-shadow:0 6px 20px rgba(0,0,0,0.6);">
          <div style="color:#38bdf8;font-weight:700;font-size:13px;margin-bottom:2px;">${d.stednavn}</div>
          <div style="color:#94a3b8;font-size:11px;">${d.Total_graves || 0} graves &bull; ${getParishName(d.stednr)}</div>
        </div>
      `)
      .onPointClick((d) => {
        switchToLocalView();
        setTimeout(() => {
          openSiteDossier(d);
          flyToSite(d);
        }, 300);
      });

    globeViz.pointOfView({ lat: 55.13, lng: 14.92, altitude: 0.85 }, 2000);

    if (globeViz.controls()) {
      globeViz.controls().autoRotate = true;
      globeViz.controls().autoRotateSpeed = 0.35;
    }

    updateGlobeData();
  } catch (err) {
    console.error('Error creating 3D globe:', err);
  }
}

function updateGlobeData() {
  if (!globeViz) return;
  const sitesWithCoords = state.filteredSites.filter(s => {
    const lat = parseFloat(s.wgs84_latitude);
    const lon = parseFloat(s.wgs84_longitude);
    return !isNaN(lat) && !isNaN(lon) && lat > 54.0 && lon > 14.0;
  });
  globeViz.pointsData(sitesWithCoords);
}

function switchToGlobeView() {
  const btnLocal = document.getElementById('btnViewLocal');
  const btnGlobe = document.getElementById('btnViewGlobe');
  if (btnGlobe) btnGlobe.classList.add('active');
  if (btnLocal) btnLocal.classList.remove('active');
  state.mapMode = 'globe';

  const globeContainer = document.getElementById('globeContainer');
  const mapEl = document.getElementById('map');

  if (typeof Globe !== 'undefined') {
    if (mapEl) mapEl.style.display = 'none';
    if (globeContainer) globeContainer.style.display = 'block';
    if (!globeViz) {
      initGlobe();
    } else {
      updateGlobeData();
      globeViz.pointOfView({ lat: 55.13, lng: 14.92, altitude: 0.85 }, 1500);
    }
  } else {
    // If Globe.gl is loading, smoothly zoom out MapLibre as a graceful fallback
    if (mapEl) mapEl.style.display = 'block';
    if (globeContainer) globeContainer.style.display = 'none';
    map.flyTo({
      center: [14.9, 55.0],
      zoom: 3.8,
      pitch: 0,
      bearing: 0,
      duration: 2000
    });
  }

  const modeBadge = document.getElementById('mapModeBadge');
  if (modeBadge) modeBadge.innerHTML = '<i class="fa-solid fa-earth-europe"></i> 3D Planetary Globe View';
}

function switchToLocalView() {
  const btnLocal = document.getElementById('btnViewLocal');
  const btnGlobe = document.getElementById('btnViewGlobe');
  if (btnLocal) btnLocal.classList.add('active');
  if (btnGlobe) btnGlobe.classList.remove('active');
  state.mapMode = 'local';

  const globeContainer = document.getElementById('globeContainer');
  const mapEl = document.getElementById('map');
  if (globeContainer) globeContainer.style.display = 'none';
  if (mapEl) mapEl.style.display = 'block';
  if (map) {
    map.resize();
    map.flyTo({
      center: [14.92, 55.13],
      zoom: 10.4,
      pitch: 0,
      bearing: 0,
      duration: 1500
    });
  }

  const modeBadge = document.getElementById('mapModeBadge');
  if (modeBadge) modeBadge.innerHTML = '<i class="fa-solid fa-satellite"></i> ESRI World Imagery &bull; Local Bornholm';
}

// ==========================================================================
// EVENT LISTENERS & PROJECTION CONTROLS
// ==========================================================================
function initEventListeners() {
  // Projection & View Mode Switchers
  const btnLocal = document.getElementById('btnViewLocal');
  const btnGlobe = document.getElementById('btnViewGlobe');

  btnLocal.addEventListener('click', () => {
    switchToLocalView();
  });

  btnGlobe.addEventListener('click', () => {
    switchToGlobeView();
  });

  // Layer Toggles
  const btnLabels = document.getElementById('btnToggleLabels');
  btnLabels.addEventListener('click', () => {
    state.showLabels = !state.showLabels;
    btnLabels.classList.toggle('active', state.showLabels);
    if (map.getLayer('esri-labels-layer')) {
      map.setLayoutProperty('esri-labels-layer', 'visibility', state.showLabels ? 'visible' : 'none');
    }
  });

  const btnHeatmap = document.getElementById('btnToggleHeatmap');
  btnHeatmap.addEventListener('click', () => {
    state.showHeatmap = !state.showHeatmap;
    btnHeatmap.classList.toggle('active', state.showHeatmap);
    if (map.getLayer('sites-heatmap')) {
      map.setLayoutProperty('sites-heatmap', 'visibility', state.showHeatmap ? 'visible' : 'none');
    }
  });

  // Global Search Input
  const searchInput = document.getElementById('globalSearchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
    applyFilters();
  });
  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    btnClearSearch.style.display = 'none';
    applyFilters();
  });

  // Aggregate Era Pills
  document.querySelectorAll('.era-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.era-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeEra = pill.getAttribute('data-era');
      state.selectedSubPhases.clear();
      document.querySelectorAll('.phase-chip').forEach(c => c.classList.remove('selected'));
      applyFilters();
    });
  });

  document.getElementById('btnResetPeriods').addEventListener('click', () => {
    state.activeEra = 'ALL';
    state.selectedSubPhases.clear();
    document.querySelectorAll('.era-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('.era-pill[data-era="ALL"]').classList.add('active');
    document.querySelectorAll('.phase-chip').forEach(c => c.classList.remove('selected'));
    applyFilters();
  });

  // Sub-Phases Accordion Toggle
  const subPhasesHeader = document.getElementById('btnToggleSubPhases');
  const subPhasesContainer = document.querySelector('.sub-phases-container');
  subPhasesHeader.addEventListener('click', () => {
    subPhasesContainer.classList.toggle('open');
  });

  // Grave Types Checkboxes
  ['Urn', 'Crem', 'Inh', 'Chamber', 'Boat', 'Cist'].forEach(typeKey => {
    const el = document.getElementById(`type${typeKey}`);
    if (el) {
      el.addEventListener('change', (e) => {
        const val = el.value;
        if (e.target.checked) state.selectedGraveTypes.add(val);
        else state.selectedGraveTypes.delete(val);
        applyFilters();
      });
    }
  });

  document.getElementById('btnResetGraveTypes').addEventListener('click', () => {
    state.selectedGraveTypes = new Set(['Urn', 'Cremation', 'Inhumation', 'Chamber', 'Boat', 'Cist']);
    ['typeUrn', 'typeCrem', 'typeInh', 'typeChamber', 'typeBoat', 'typeCist'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = true;
    });
    applyFilters();
  });

  // Special Attributes Switches
  document.getElementById('filterWeaponsOnly').addEventListener('change', (e) => {
    state.weaponsOnly = e.target.checked;
    applyFilters();
  });
  document.getElementById('filterMonumentsOnly').addEventListener('change', (e) => {
    state.monumentsOnly = e.target.checked;
    applyFilters();
  });
  document.getElementById('filterHighPotentialOnly').addEventListener('change', (e) => {
    state.highPotentialOnly = e.target.checked;
    applyFilters();
  });

  // Parish Select
  const parishSel = document.getElementById('parishSelect');
  parishSel.addEventListener('change', (e) => {
    state.selectedParish = e.target.value;
    applyFilters();
  });
  document.getElementById('btnResetParish').addEventListener('click', () => {
    parishSel.value = 'ALL';
    state.selectedParish = 'ALL';
    applyFilters();
  });

  // Fit Map Button
  document.getElementById('btnFitMapToBounds').addEventListener('click', () => {
    fitMapToFilteredSites();
  });

  // Export Menu Dropdown
  const exportBtn = document.getElementById('btnExportMenu');
  const exportDropdown = document.getElementById('exportDropdown');
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportBtn.parentElement.classList.toggle('open');
  });
  document.addEventListener('click', () => {
    exportBtn.parentElement.classList.remove('open');
  });

  document.getElementById('exportFilteredCSV').addEventListener('click', (e) => {
    e.preventDefault();
    exportData('csv');
  });
  document.getElementById('exportFilteredJSON').addEventListener('click', (e) => {
    e.preventDefault();
    exportData('json');
  });
  document.getElementById('exportFilteredGeoJSON').addEventListener('click', (e) => {
    e.preventDefault();
    exportData('geojson');
  });
  document.getElementById('exportFilteredSHP').addEventListener('click', (e) => {
    e.preventDefault();
    exportData('shp');
  });
  document.getElementById('exportFullMasterCSV').addEventListener('click', (e) => {
    e.preventDefault();
    const csvStr = Papa.unparse(state.allSites);
    downloadBlob(new Blob(["\ufeff" + csvStr], { type: 'text/csv;charset=utf-8;' }), 'bornholm_graves_master.csv');
  });

  // Dedicated Sidebar Download Section
  const sbSHP = document.getElementById('sidebarDownloadSHP');
  if (sbSHP) sbSHP.addEventListener('click', () => exportData('shp'));
  const sbGeoJSON = document.getElementById('sidebarDownloadGeoJSON');
  if (sbGeoJSON) sbGeoJSON.addEventListener('click', () => exportData('geojson'));
  const sbCSV = document.getElementById('sidebarDownloadCSV');
  if (sbCSV) sbCSV.addEventListener('click', () => exportData('csv'));
  const sbJSON = document.getElementById('sidebarDownloadJSON');
  if (sbJSON) sbJSON.addEventListener('click', () => exportData('json'));

  // Table Overlay SHP & CSV Exports
  const btnExportTableSHP = document.getElementById('btnExportTableSHP');
  if (btnExportTableSHP) btnExportTableSHP.addEventListener('click', () => exportData('shp'));
  const btnExportTableCSV = document.getElementById('btnExportTableCSV');
  if (btnExportTableCSV) btnExportTableCSV.addEventListener('click', () => exportData('csv'));

  // Manual Reload Button
  document.getElementById('btnManualReload').addEventListener('click', () => {
    loadMasterData();
    showNotification('Manually reloaded dataset from disk.');
  });

  // Dossier Close Button
  document.getElementById('btnCloseDossier').addEventListener('click', closeSiteDossier);

  // Table Overlay Toggles
  const btnToggleTable = document.getElementById('btnToggleTable');
  const tableOverlay = document.getElementById('tableOverlay');
  const btnCloseTable = document.getElementById('btnCloseTable');
  btnToggleTable.addEventListener('click', () => {
    const isVis = tableOverlay.style.display !== 'none';
    tableOverlay.style.display = isVis ? 'none' : 'flex';
    if (!isVis) renderTableData();
  });
  btnCloseTable.addEventListener('click', () => {
    tableOverlay.style.display = 'none';
  });

  // Info Modal
  const infoModal = document.getElementById('infoModalBackdrop');
  document.getElementById('btnInfoModal').addEventListener('click', () => {
    infoModal.style.display = 'flex';
  });
  document.getElementById('btnCloseInfoModal').addEventListener('click', () => {
    infoModal.style.display = 'none';
  });
  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) infoModal.style.display = 'none';
  });
}

function fitMapToFilteredSites() {
  if (!map || state.filteredSites.length === 0) return;
  const bounds = new maplibregl.LngLatBounds();
  let count = 0;
  state.filteredSites.forEach(s => {
    const lat = parseFloat(s.wgs84_latitude);
    const lon = parseFloat(s.wgs84_longitude);
    if (!isNaN(lat) && !isNaN(lon) && lat > 54.0 && lon > 14.0) {
      bounds.extend([lon, lat]);
      count++;
    }
  });
  if (count > 0) {
    map.fitBounds(bounds, { padding: 80, duration: 1500 });
  }
}

function showNotification(msg) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid var(--primary-cyan);
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      color: #fff;
      padding: 12px 18px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-bell text-cyan"></i> ${msg}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 3500);
}
