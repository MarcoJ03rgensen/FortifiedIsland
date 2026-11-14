// Stylized map export studio: live plate preview, restyle selected sites, PNG/PDF.
(() => {
  const HILLSHADE = [
    [14.641174, 55.361384],
    [15.220291, 55.361384],
    [15.220291, 54.970052],
    [14.641174, 54.970052]
  ];
  const MAP_HD = [
    [14.6225, 55.3510],
    [15.2140, 55.3510],
    [15.2190, 54.9515],
    [14.6275, 54.9515]
  ];
  const ERA_ORDER = ['PRKZ', 'ARKZ', 'JRKZ', 'AEGJ', 'YGJ'];
  const ERA_LABELS = {
    PRKZ: 'Pre-Roman Iron Age',
    ARKZ: 'Early Roman Iron Age',
    JRKZ: 'Late Roman Iron Age',
    AEGJ: 'Migration Period',
    YGJ: 'Late Germanic & Viking Age',
    OTHER: 'Undated'
  };
  const ERA_COLORS = {
    PRKZ: '#c4b5fd',
    ARKZ: '#38bdf8',
    JRKZ: '#fbbf24',
    AEGJ: '#34d399',
    YGJ: '#fb7185',
    OTHER: '#94a3b8'
  };
  const BASEMAPS = [
    { id: 'satellite', name: 'Satellite', desc: 'Esri World Imagery', icon: 'fa-satellite', theme: 'night', credit: 'Imagery © Esri, Maxar' },
    { id: 'hillshade', name: 'LiDAR', desc: '0.4 m hillshade', icon: 'fa-mountain-sun', theme: 'night', credit: 'Hillshade from 0.4 m DEM' },
    { id: 'viridis', name: 'Viridis', desc: 'Elevation wash', icon: 'fa-layer-group', theme: 'night', credit: 'Viridis hillshade, 0.4 m DEM' },
    { id: 'map-hd', name: '1805 Chart', desc: 'Historical map', icon: 'fa-scroll', theme: 'cream', credit: 'Bornholm map, 1805' },
    { id: 'parchment', name: 'Parchment', desc: 'Manuscript plate', icon: 'fa-book-open', theme: 'cream', credit: 'Relief drawn as a manuscript plate' },
    { id: 'midnight', name: 'Midnight', desc: 'Dark relief', icon: 'fa-moon', theme: 'night', credit: 'Shaded relief on night ground' },
    { id: 'museum', name: 'Museum Gold', desc: 'Ink & gilt plate', icon: 'fa-landmark', theme: 'museum', credit: 'Gilt relief plate' },
    { id: 'liberty', name: 'Atlas', desc: 'OpenFreeMap Liberty', icon: 'fa-compass', theme: 'atlas', credit: '© OpenFreeMap · OpenStreetMap' }
  ];
  const LOOKS = [
    {
      id: 'notebook', name: 'Field notebook', desc: 'Parchment, period colour, grid', bar: '#c4a574',
      basemap: 'parchment', colorMode: 'period', marker: 'disc', glow: true,
      heat: false, graticule: true, vignette: true, grain: true, frame: 'double',
      stroke: '#5c4a2a'
    },
    {
      id: 'gilt', name: 'Museum gilt', desc: 'Ink plate, gold sites', bar: '#e8c872',
      basemap: 'museum', colorMode: 'solid', fill: '#e8c872', marker: 'disc', glow: true,
      heat: false, graticule: false, vignette: true, grain: true, frame: 'gold',
      stroke: '#2a2114'
    },
    {
      id: 'night', name: 'Night survey', desc: 'Dark relief, heat bloom', bar: '#38bdf8',
      basemap: 'midnight', colorMode: 'type', marker: 'disc', glow: true,
      heat: true, graticule: false, vignette: true, grain: false, frame: 'slim',
      stroke: '#ffffff'
    },
    {
      id: 'lidar', name: 'LiDAR survey', desc: 'Hillshade, feature colour', bar: '#94a3b8',
      basemap: 'hillshade', colorMode: 'type', marker: 'disc', glow: true,
      heat: false, graticule: false, vignette: false, grain: false, frame: 'slim',
      stroke: '#ffffff'
    },
    {
      id: 'chart', name: '1805 chart', desc: 'Historical map, ring marks', bar: '#d4b48a',
      basemap: 'map-hd', colorMode: 'period', marker: 'ring', glow: false,
      heat: false, graticule: true, vignette: true, grain: true, frame: 'double',
      stroke: '#3f2f14'
    },
    {
      id: 'aerial', name: 'Aerial', desc: 'Satellite, feature colour', bar: '#38bdf8',
      basemap: 'satellite', colorMode: 'type', marker: 'disc', glow: true,
      heat: false, graticule: false, vignette: true, grain: false, frame: 'gold',
      stroke: '#ffffff'
    }
  ];

  const $ = (id) => document.getElementById(id);
  const cfg = {
    basemap: 'hillshade',
    colorMode: 'type',
    fill: '#fbbf24',
    colorWeapons: '#38bdf8',
    colorMonuments: '#34d399',
    colorOther: '#fbbf24',
    stroke: '#ffffff',
    size: 8,
    strokeW: 2,
    sizeByGraves: true,
    glow: true,
    labels: 'off',
    aspect: 'landscape',
    showTitle: true,
    showLegend: true,
    showNorth: true,
    showScale: true,
    showCredit: true,
    exportDpi: 300,
    look: 'lidar',
    marker: 'disc',
    heat: false,
    graticule: false,
    vignette: true,
    grain: true,
    frame: 'gold',
    titleColor: '#f8fafc',
    captionColor: '#e2e8f0',
    haloColor: '#000000',
    halo: 40,
    panelFill: '#081410',
    panelEdge: '#ffffff',
    panelAlpha: 62,
    legendAlpha: 72,
    titleCard: true,
    frameColor: '#fbbf24',
    eraColors: {
      PRKZ: '#c4b5fd',
      ARKZ: '#38bdf8',
      JRKZ: '#fbbf24',
      AEGJ: '#34d399',
      YGJ: '#fb7185',
      OTHER: '#94a3b8'
    }
  };

  const hidden = new Set();
  const colorOverride = new Map();
  let previewMap = null;
  let siteCache = [];
  let styleToken = 0;

  function siteId(site) {
    return String(site.systemnr || site.stednavn || '');
  }

  function hasCoords(site) {
    const lat = parseFloat(site.wgs84_latitude);
    const lon = parseFloat(site.wgs84_longitude);
    return !isNaN(lat) && !isNaN(lon) && lat > 54 && lon > 14;
  }

  function primaryEra(site) {
    let found = 'OTHER';
    ERA_ORDER.forEach((era) => {
      if (typeof siteMatchesEra === 'function' && siteMatchesEra(site, era)) found = era;
    });
    return found;
  }

  function includedSites() {
    return siteCache.filter((s) => !hidden.has(siteId(s)));
  }

  function colorFor(site) {
    const override = colorOverride.get(siteId(site));
    if (override) return override;
    if (cfg.colorMode === 'solid') return cfg.fill;
    if (cfg.colorMode === 'period') return cfg.eraColors[primaryEra(site)] || cfg.eraColors.OTHER;
    if (cfg.colorMode === 'graves') {
      const g = parseInt(site.Total_graves, 10) || 0;
      if (g >= 200) return '#9f1239';
      if (g >= 80) return '#ef4444';
      if (g >= 20) return '#f97316';
      if (g >= 5) return '#fbbf24';
      return '#fde68a';
    }
    if (site.Weapons_yes_or_no === 'Yes') return cfg.colorWeapons;
    if (site.Monuments_yes_or_no === 'Yes') return cfg.colorMonuments;
    return cfg.colorOther;
  }

  function radiusFor(site) {
    if (!cfg.sizeByGraves) return cfg.size;
    const g = parseInt(site.Total_graves, 10) || 0;
    return +(cfg.size * (0.72 + Math.min(g, 400) / 400 * 1.7)).toFixed(2);
  }

  function labelFor(site) {
    if (cfg.labels === 'off') return '';
    const name = site.stednavn || 'Unnamed site';
    if (cfg.labels === 'name') return name;
    const g = parseInt(site.Total_graves, 10) || 0;
    return g ? `${name}  ·  ${g}` : name;
  }

  function defaultSubtitle() {
    const n = includedSites().length;
    const era = state.activeEra === 'ALL' ? 'All periods' : (ERA_LABELS[state.activeEra] || state.activeEra);
    const parish = state.selectedParish === 'ALL' ? 'Bornholm' : getParishName(state.selectedParish);
    return `${n} sites · ${era} · ${parish}`;
  }

  function currentBasemap() {
    return BASEMAPS.find((b) => b.id === cfg.basemap) || BASEMAPS[1];
  }

  function rasterPaint(extra) {
    return Object.assign({ 'raster-opacity': 1, 'raster-fade-duration': 0 }, extra || {});
  }

  function buildRasterStyle(kind) {
    const sources = {
      'esri-satellite': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Tiles © Esri'
      },
      'esri-labels': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256
      },
      'hillshade-source': { type: 'image', url: 'hillshade.webp', coordinates: HILLSHADE },
      'viridis-source': { type: 'image', url: 'hillshade-viridis.webp', coordinates: HILLSHADE },
      'map-hd-source': { type: 'image', url: 'map-hd-kopi.jpg', coordinates: MAP_HD }
    };

    const layers = [];
    const bg = {
      satellite: '#0b1220',
      hillshade: '#121212',
      viridis: '#0b1020',
      'map-hd': '#d8c7a3',
      parchment: '#ead7b0',
      midnight: '#070b14',
      museum: '#140f0a',
      ink: '#f4efe4'
    };
    layers.push({ id: 'bg', type: 'background', paint: { 'background-color': bg[kind] || '#111' } });

    if (kind === 'satellite') {
      layers.push({ id: 'sat', type: 'raster', source: 'esri-satellite', paint: rasterPaint() });
      layers.push({ id: 'labels', type: 'raster', source: 'esri-labels', paint: rasterPaint({ 'raster-opacity': 0.85 }) });
    } else if (kind === 'hillshade') {
      layers.push({ id: 'hs', type: 'raster', source: 'hillshade-source', paint: rasterPaint() });
    } else if (kind === 'viridis') {
      layers.push({ id: 'vir', type: 'raster', source: 'viridis-source', paint: rasterPaint() });
    } else if (kind === 'map-hd') {
      layers.push({ id: 'hd', type: 'raster', source: 'map-hd-source', paint: rasterPaint() });
    } else if (kind === 'parchment') {
      layers.push({
        id: 'hs',
        type: 'raster',
        source: 'hillshade-source',
        paint: rasterPaint({
          'raster-opacity': 0.52,
          'raster-saturation': -0.65,
          'raster-contrast': 0.12,
          'raster-brightness-min': 0.28,
          'raster-brightness-max': 0.92
        })
      });
    } else if (kind === 'midnight') {
      layers.push({
        id: 'hs',
        type: 'raster',
        source: 'hillshade-source',
        paint: rasterPaint({
          'raster-opacity': 0.88,
          'raster-saturation': -1,
          'raster-brightness-min': 0,
          'raster-brightness-max': 0.42
        })
      });
    } else if (kind === 'museum') {
      layers.push({
        id: 'hs',
        type: 'raster',
        source: 'hillshade-source',
        paint: rasterPaint({
          'raster-opacity': 0.58,
          'raster-hue-rotate': 32,
          'raster-saturation': -0.25,
          'raster-contrast': 0.2,
          'raster-brightness-min': 0.05,
          'raster-brightness-max': 0.55
        })
      });
    } else if (kind === 'ink') {
      layers.push({
        id: 'hs',
        type: 'raster',
        source: 'hillshade-source',
        paint: rasterPaint({
          'raster-opacity': 0.7,
          'raster-saturation': -1,
          'raster-contrast': 0.28,
          'raster-brightness-min': 0.15,
          'raster-brightness-max': 0.9
        })
      });
    }

    return { version: 8, sources, layers, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf' };
  }

  function isLightTheme() {
    const theme = currentBasemap().theme;
    return theme === 'cream' || theme === 'ink' || theme === 'atlas';
  }

  function haloColor() {
    return cfg.haloColor || (isLightTheme() ? '#f7ecd3' : '#0b1220');
  }

  function labelFill() {
    return cfg.captionColor || (isLightTheme() ? '#2a2114' : '#f8fafc');
  }

  function inkForLook(look) {
    const palettes = {
      notebook: {
        titleColor: '#2a2114', captionColor: '#4a3b28', haloColor: '#fff8e6', halo: 35,
        panelFill: '#f4ead3', panelEdge: '#5c4a2a', panelAlpha: 78, legendAlpha: 86,
        titleCard: true, frameColor: '#5c4a2a'
      },
      gilt: {
        titleColor: '#f3e6c4', captionColor: '#e8c872', haloColor: '#120e0a', halo: 55,
        panelFill: '#120e0a', panelEdge: '#e8c872', panelAlpha: 64, legendAlpha: 72,
        titleCard: true, frameColor: '#e8c872'
      },
      night: {
        titleColor: '#f8fafc', captionColor: '#d1fae5', haloColor: '#000000', halo: 45,
        panelFill: '#071018', panelEdge: '#38bdf8', panelAlpha: 70, legendAlpha: 74,
        titleCard: true, frameColor: '#38bdf8'
      },
      lidar: {
        titleColor: '#f8fafc', captionColor: '#e2e8f0', haloColor: '#000000', halo: 42,
        panelFill: '#0b1220', panelEdge: '#ffffff', panelAlpha: 62, legendAlpha: 72,
        titleCard: true, frameColor: '#fbbf24'
      },
      chart: {
        titleColor: '#2a2114', captionColor: '#4a3b28', haloColor: '#f7ecd3', halo: 30,
        panelFill: '#f4ead3', panelEdge: '#3f2f14', panelAlpha: 80, legendAlpha: 88,
        titleCard: true, frameColor: '#3f2f14'
      },
      aerial: {
        titleColor: '#ffffff', captionColor: '#e2e8f0', haloColor: '#000000', halo: 50,
        panelFill: '#0b1220', panelEdge: '#ffffff', panelAlpha: 58, legendAlpha: 70,
        titleCard: true, frameColor: '#fbbf24'
      }
    };
    return palettes[look && look.id] || palettes.lidar;
  }

  function applyInk() {
    const paper = $('smPaper');
    if (!paper) return;
    paper.style.setProperty('--sm-title', cfg.titleColor);
    paper.style.setProperty('--sm-caption', cfg.captionColor);
    paper.style.setProperty('--sm-halo', hexToRgba(cfg.haloColor, Math.max(0, cfg.halo) / 100));
    paper.style.setProperty('--sm-title-panel', hexToRgba(cfg.panelFill, (cfg.titleCard ? cfg.panelAlpha : 0) / 100));
    paper.style.setProperty('--sm-legend-panel', hexToRgba(cfg.panelFill, cfg.legendAlpha / 100));
    paper.style.setProperty('--sm-panel-edge', hexToRgba(cfg.panelEdge, 0.28));
    paper.style.setProperty('--sm-frame', cfg.frameColor);
    paper.classList.toggle('is-title-card-off', !cfg.titleCard || cfg.panelAlpha < 2);
    paper.classList.toggle('is-legend-card-off', cfg.legendAlpha < 2);
    applyPointPaint();
  }

  function addSiteLayers(map) {
    map = map || previewMap;
    if (!map) return;
    if (!map.getSource('sm-sites')) {
      map.addSource('sm-sites', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
    if (!map.getLayer('sm-heat')) {
      try {
        map.addLayer({
          id: 'sm-heat',
          type: 'heatmap',
          source: 'sm-sites',
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.55, 13, 1.15],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 14, 13, 32],
            'heatmap-opacity': 0.62,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.15, 'rgba(56,189,248,0.12)',
              0.4, 'rgba(251,191,36,0.38)',
              0.7, 'rgba(244,63,94,0.62)',
              1, 'rgba(255,255,255,0.85)'
            ]
          }
        });
      } catch (err) {
        console.warn('Heat bloom layer skipped', err);
      }
    }
    if (!map.getLayer('sm-glow')) {
      map.addLayer({
        id: 'sm-glow',
        type: 'circle',
        source: 'sm-sites',
        paint: {
          'circle-radius': ['*', ['to-number', ['get', 'radius']], 1.85],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.28,
          'circle-blur': 0.75
        }
      });
    }
    if (!map.getLayer('sm-burst')) {
      map.addLayer({
        id: 'sm-burst',
        type: 'circle',
        source: 'sm-sites',
        paint: {
          'circle-radius': ['*', ['to-number', ['get', 'radius']], 1.4],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.2,
          'circle-stroke-width': 0
        }
      });
    }
    if (!map.getLayer('sm-pts')) {
      map.addLayer({
        id: 'sm-pts',
        type: 'circle',
        source: 'sm-sites',
        paint: {
          'circle-radius': ['to-number', ['get', 'radius']],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': cfg.strokeW,
          'circle-stroke-color': cfg.stroke
        }
      });
    }
    if (!map.getLayer('sm-labels')) {
      map.addLayer({
        id: 'sm-labels',
        type: 'symbol',
        source: 'sm-sites',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-offset': [0, 1.15],
          'text-anchor': 'top',
          'text-font': ['Noto Sans Regular'],
          'text-optional': true
        },
        paint: {
          'text-color': '#f8fafc',
          'text-halo-color': haloColor(),
          'text-halo-width': 1.4
        }
      });
    }
    applyPointPaint(map);
  }

  function applyPointPaint(map) {
    map = map || previewMap;
    if (!map || !map.getLayer('sm-pts')) return;
    const ring = cfg.marker === 'ring';
    map.setPaintProperty('sm-pts', 'circle-opacity', ring ? 0.08 : 1);
    map.setPaintProperty('sm-pts', 'circle-stroke-width', ring ? Math.max(cfg.strokeW, 2.2) : cfg.strokeW);
    map.setPaintProperty('sm-pts', 'circle-stroke-color', ring ? ['get', 'color'] : cfg.stroke);
    map.setLayoutProperty('sm-glow', 'visibility', cfg.glow ? 'visible' : 'none');
    if (map.getLayer('sm-burst')) {
      map.setLayoutProperty('sm-burst', 'visibility', cfg.marker === 'burst' ? 'visible' : 'none');
    }
    if (map.getLayer('sm-heat')) {
      map.setLayoutProperty('sm-heat', 'visibility', cfg.heat ? 'visible' : 'none');
    }
    map.setLayoutProperty('sm-labels', 'visibility', cfg.labels === 'off' ? 'none' : 'visible');
    map.setPaintProperty('sm-labels', 'text-color', labelFill());
    map.setPaintProperty('sm-labels', 'text-halo-color', haloColor());
  }

  function featuresFromSites() {
    return includedSites().filter(hasCoords).map((site) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(site.wgs84_longitude), parseFloat(site.wgs84_latitude)]
      },
      properties: {
        id: siteId(site),
        color: colorFor(site),
        radius: radiusFor(site),
        label: labelFor(site)
      }
    }));
  }

  function pushSites(map) {
    map = map || previewMap;
    if (!map || !map.getSource('sm-sites')) return;
    map.getSource('sm-sites').setData({
      type: 'FeatureCollection',
      features: featuresFromSites()
    });
  }

  function waitStyle(map, timeoutMs = 8000) {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      if (map.isStyleLoaded()) return done();
      map.once('style.load', done);
      map.once('load', done);
      setTimeout(done, timeoutMs);
    });
  }

  async function applyBasemap() {
    if (!previewMap) return;
    const token = ++styleToken;
    const spec = currentBasemap();
    const style = spec.id === 'liberty'
      ? 'https://tiles.openfreemap.org/styles/liberty'
      : buildRasterStyle(spec.id);
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 4000);
      previewMap.once('style.load', () => {
        clearTimeout(t);
        resolve();
      });
      previewMap.setStyle(style, { diff: false });
    });
    if (token !== styleToken) return;
    addSiteLayers();
    pushSites();
    applyPointPaint();
    applyTheme();
    updateScale();
  }

  function applyTheme() {
    const paper = $('smPaper');
    const spec = currentBasemap();
    paper.dataset.theme = spec.theme;
    paper.dataset.aspect = cfg.aspect;
    paper.dataset.frame = cfg.frame;
    paper.classList.toggle('is-title-off', !cfg.showTitle);
    paper.classList.toggle('is-legend-off', !cfg.showLegend);
    paper.classList.toggle('is-north-off', !cfg.showNorth);
    paper.classList.toggle('is-scale-off', !cfg.showScale);
    paper.classList.toggle('is-credit-off', !cfg.showCredit);
    paper.classList.toggle('is-vignette-off', !cfg.vignette);
    paper.classList.toggle('is-grain-off', !cfg.grain);
    paper.classList.toggle('is-grid-off', !cfg.graticule);
    $('smCredit').textContent = `Fortis Cemeteries Explorer · Bornholm · ${spec.credit}`;
    $('smTypeColors').style.display = cfg.colorMode === 'type' ? 'flex' : 'none';
    $('smSolidColors').style.display = cfg.colorMode === 'solid' ? 'flex' : 'none';
    if ($('smPeriodColors')) $('smPeriodColors').style.display = cfg.colorMode === 'period' ? 'flex' : 'none';
    applyInk();
    renderLegend();
    drawFx();
    if (previewMap) {
      requestAnimationFrame(() => {
        previewMap.resize();
        drawFx();
      });
    }
  }

  function renderLooks() {
    const box = $('smLooks');
    if (!box) return;
    box.innerHTML = LOOKS.map((l) => `
      <button type="button" class="sm-look${cfg.look === l.id ? ' active' : ''}" data-look="${l.id}">
        <span class="sm-look-bar" style="background:${l.bar}"></span>
        <span><strong>${l.name}</strong><span>${l.desc}</span></span>
      </button>
    `).join('');
  }

  function syncForm() {
    if ($('smColorMode')) $('smColorMode').value = cfg.colorMode;
    document.querySelectorAll('#smColorSeg [data-color-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.colorMode === cfg.colorMode);
    });
    document.querySelectorAll('#smMarkerSeg [data-marker]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.marker === cfg.marker);
    });
    if ($('smFill')) $('smFill').value = cfg.fill;
    if ($('smColorWeapons')) $('smColorWeapons').value = cfg.colorWeapons;
    if ($('smColorMonuments')) $('smColorMonuments').value = cfg.colorMonuments;
    if ($('smColorOther')) $('smColorOther').value = cfg.colorOther;
    if ($('smStroke')) $('smStroke').value = cfg.stroke;
    if ($('smSize')) $('smSize').value = String(cfg.size);
    if ($('smSizeVal')) $('smSizeVal').textContent = String(cfg.size);
    if ($('smStrokeW')) $('smStrokeW').value = String(cfg.strokeW);
    if ($('smStrokeWVal')) $('smStrokeWVal').textContent = String(cfg.strokeW);
    if ($('smSizeByGraves')) $('smSizeByGraves').checked = cfg.sizeByGraves;
    if ($('smGlow')) $('smGlow').checked = cfg.glow;
    if ($('smLabels')) $('smLabels').value = cfg.labels;
    if ($('smHeat')) $('smHeat').checked = cfg.heat;
    if ($('smGraticule')) $('smGraticule').checked = cfg.graticule;
    if ($('smVignette')) $('smVignette').checked = cfg.vignette;
    if ($('smGrain')) $('smGrain').checked = cfg.grain;
    if ($('smFrame')) $('smFrame').value = cfg.frame;
    if ($('smAspect')) $('smAspect').value = cfg.aspect;
    if ($('smDpi')) $('smDpi').value = String(cfg.exportDpi);
    if ($('smShowTitle')) $('smShowTitle').checked = cfg.showTitle;
    if ($('smShowLegend')) $('smShowLegend').checked = cfg.showLegend;
    if ($('smShowNorth')) $('smShowNorth').checked = cfg.showNorth;
    if ($('smShowScale')) $('smShowScale').checked = cfg.showScale;
    if ($('smShowCredit')) $('smShowCredit').checked = cfg.showCredit;
    if ($('smTitleColor')) $('smTitleColor').value = cfg.titleColor;
    if ($('smCaptionColor')) $('smCaptionColor').value = cfg.captionColor;
    if ($('smHaloColor')) $('smHaloColor').value = cfg.haloColor;
    if ($('smHalo')) $('smHalo').value = String(cfg.halo);
    if ($('smHaloVal')) $('smHaloVal').textContent = `${cfg.halo}%`;
    if ($('smPanelFill')) $('smPanelFill').value = cfg.panelFill;
    if ($('smPanelEdge')) $('smPanelEdge').value = cfg.panelEdge;
    if ($('smFrameColor')) $('smFrameColor').value = cfg.frameColor;
    if ($('smTitleBgA')) $('smTitleBgA').value = String(cfg.panelAlpha);
    if ($('smTitleBgVal')) $('smTitleBgVal').textContent = `${cfg.panelAlpha}%`;
    if ($('smLegendBgA')) $('smLegendBgA').value = String(cfg.legendAlpha);
    if ($('smLegendBgVal')) $('smLegendBgVal').textContent = `${cfg.legendAlpha}%`;
    if ($('smTitleCard')) $('smTitleCard').checked = cfg.titleCard;
    ERA_ORDER.concat(['OTHER']).forEach((era) => {
      const el = $(`smEra${era}`);
      if (el) el.value = cfg.eraColors[era];
    });
  }

  function applyLook(id, opts) {
    const look = LOOKS.find((l) => l.id === id);
    if (!look) return;
    cfg.look = id;
    if (!(opts && opts.keepBasemap)) cfg.basemap = look.basemap;
    cfg.colorMode = look.colorMode;
    if (look.fill) cfg.fill = look.fill;
    if (look.stroke) cfg.stroke = look.stroke;
    cfg.marker = look.marker;
    cfg.glow = look.glow;
    cfg.heat = look.heat;
    cfg.graticule = look.graticule;
    cfg.vignette = look.vignette;
    cfg.grain = look.grain;
    cfg.frame = look.frame;
    Object.assign(cfg, inkForLook(look));
    syncForm();
    renderLooks();
    renderBasemaps();
    applyTheme();
    refreshSitesUi();
    if (previewMap && !(opts && opts.skipMap)) applyBasemap();
    else drawFx();
  }

  function renderBasemaps() {
    $('smBasemaps').innerHTML = BASEMAPS.map((b) => `
      <button type="button" class="sm-basemap${b.id === cfg.basemap ? ' active' : ''}" data-basemap="${b.id}">
        <i class="fa-solid ${b.icon}"></i>
        <strong>${b.name}</strong>
        <span>${b.desc}</span>
      </button>
    `).join('');
  }

  function legendDotClass() {
    if (cfg.marker === 'ring') return ' is-ring';
    if (cfg.marker === 'burst') return ' is-burst';
    return '';
  }

  function renderLegend() {
    const box = $('smLegend');
    const sites = includedSites();
    if (cfg.colorMode === 'graves') {
      box.innerHTML = `
        <div class="sm-legend-title">Graves per site</div>
        <div class="sm-legend-ramp"></div>
        <div class="sm-legend-ramp-labels"><span>Few</span><span>Many</span></div>
      `;
      return;
    }
    if (cfg.colorMode === 'solid') {
      box.innerHTML = `
        <div class="sm-legend-title">Sites</div>
        <div class="sm-legend-item"><span class="sm-legend-dot${legendDotClass()}" style="background:${cfg.fill};border-color:${cfg.stroke}"></span> Selected cemeteries</div>
      `;
      return;
    }
    if (cfg.colorMode === 'period') {
      const present = new Set(sites.map(primaryEra));
      const items = ERA_ORDER.filter((e) => present.has(e)).concat(present.has('OTHER') ? ['OTHER'] : []);
      box.innerHTML = `<div class="sm-legend-title">Period</div>` + items.map((e) => `
        <div class="sm-legend-item"><span class="sm-legend-dot${legendDotClass()}" style="background:${cfg.eraColors[e]};border-color:${cfg.marker === 'ring' ? cfg.eraColors[e] : cfg.stroke}"></span> ${ERA_LABELS[e]}</div>
      `).join('');
      return;
    }
    const hasW = sites.some((s) => s.Weapons_yes_or_no === 'Yes');
    const hasM = sites.some((s) => s.Monuments_yes_or_no === 'Yes' && s.Weapons_yes_or_no !== 'Yes');
    const hasO = sites.some((s) => s.Weapons_yes_or_no !== 'Yes' && s.Monuments_yes_or_no !== 'Yes');
    const rows = [];
    if (hasW) rows.push([cfg.colorWeapons, 'Weapon graves']);
    if (hasM) rows.push([cfg.colorMonuments, 'Mounds / standing stones']);
    if (hasO) rows.push([cfg.colorOther, 'Other cemeteries']);
    box.innerHTML = `<div class="sm-legend-title">Legend</div>` + rows.map(([c, t]) => `
      <div class="sm-legend-item"><span class="sm-legend-dot${legendDotClass()}" style="background:${c};border-color:${cfg.marker === 'ring' ? c : cfg.stroke}"></span> ${t}</div>
    `).join('');
  }

  function renderSiteList() {
    const q = ($('smSiteSearch').value || '').trim().toLowerCase();
    const rows = siteCache.filter((s) => {
      if (!q) return true;
      const hay = `${s.stednavn || ''} ${s.alt_stednavm || ''} ${s.systemnr || ''}`.toLowerCase();
      return hay.includes(q);
    });
    $('smSiteList').innerHTML = rows.map((s) => {
      const id = siteId(s);
      const on = !hidden.has(id);
      const color = colorFor(s);
      const graves = parseInt(s.Total_graves, 10) || 0;
      return `<label class="sm-site${on ? '' : ' is-off'}">
        <input type="checkbox" data-site="${escapeAttr(id)}" ${on ? 'checked' : ''}>
        <input type="color" data-color="${escapeAttr(id)}" value="${color}" title="Override colour">
        <span class="sm-site-name">${escapeAttr(s.stednavn || 'Unnamed')}</span>
        <span class="sm-site-meta">${graves || '—'}</span>
      </label>`;
    }).join('') || '<div class="sm-site-meta">No matching sites.</div>';
  }

  function escapeAttr(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  function refreshSitesUi() {
    const n = includedSites().length;
    const total = siteCache.length;
    $('smSummary').textContent = `${n} of ${total} sites on the plate`;
    if (document.activeElement !== $('smSubtitle')) {
      $('smSubtitle').value = defaultSubtitle();
    }
    renderSiteList();
    renderLegend();
    pushSites();
    applyPointPaint();
  }

  function snapshotSelection() {
    siteCache = (state.filteredSites || []).filter(hasCoords);
    hidden.clear();
    colorOverride.clear();
  }

  function fitSites() {
    if (!previewMap) return;
    const pts = includedSites().filter(hasCoords);
    if (!pts.length) {
      previewMap.easeTo({ center: [14.92, 55.13], zoom: 10.4, duration: 500 });
      return;
    }
    const b = new maplibregl.LngLatBounds();
    pts.forEach((s) => b.extend([parseFloat(s.wgs84_longitude), parseFloat(s.wgs84_latitude)]));
    previewMap.fitBounds(b, { padding: 72, maxZoom: 13.2, duration: 700 });
  }

  function niceLength(meters) {
    if (meters >= 10000) return { label: `${Math.round(meters / 1000)} km`, meters: Math.round(meters / 1000) * 1000 };
    if (meters >= 1000) {
      const km = Math.round(meters / 500) * 0.5;
      return { label: `${km} km`, meters: km * 1000 };
    }
    const m = Math.max(50, Math.round(meters / 50) * 50);
    return { label: `${m} m`, meters: m };
  }

  function updateScale() {
    const el = $('smScale');
    if (!previewMap || !el) return;
    const mapEl = $('smMap');
    const width = mapEl.clientWidth || 1;
    const y = (mapEl.clientHeight || 1) / 2;
    const targetPx = Math.min(110, Math.max(70, width * 0.12));
    const left = previewMap.unproject([width / 2 - targetPx / 2, y]);
    const right = previewMap.unproject([width / 2 + targetPx / 2, y]);
    const dist = left.distanceTo(right);
    const nice = niceLength(dist);
    const px = targetPx * (nice.meters / dist);
    el.innerHTML = `<div class="sm-scale-bar" style="width:${px.toFixed(1)}px"></div><div>${nice.label}</div>`;
    el.dataset.meters = String(nice.meters);
    el.dataset.px = String(px);
  }

  function gridStep(span) {
    const raw = Math.max(span / 5, 0.01);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    if (n < 1.5) return mag;
    if (n < 3.5) return 2 * mag;
    if (n < 7.5) return 5 * mag;
    return 10 * mag;
  }

  function drawGraticuleOn(ctx, map, sx, sy, scale) {
    if (!cfg.graticule || !map) return;
    const b = map.getBounds();
    const west = b.getWest();
    const east = b.getEast();
    const south = b.getSouth();
    const north = b.getNorth();
    const step = gridStep(Math.max(east - west, north - south));
    const s = scale || 1;
    ctx.save();
    ctx.strokeStyle = hexToRgba(cfg.captionColor, 0.28);
    ctx.fillStyle = hexToRgba(cfg.captionColor, 0.62);
    ctx.lineWidth = Math.max(1, s);
    ctx.font = `500 ${Math.max(9, 10 * s)}px Inter, sans-serif`;
    ctx.textBaseline = 'top';
    const fmt = (v) => `${Number(v).toFixed(Math.abs(step) < 0.1 ? 2 : 1)}°`;
    const dash = [4 * s, 5 * s];
    const startLon = Math.ceil(west / step) * step;
    const startLat = Math.ceil(south / step) * step;
    for (let lon = startLon; lon <= east + 1e-9; lon = +(lon + step).toFixed(8)) {
      const a = map.project([lon, south]);
      const c = map.project([lon, north]);
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.moveTo(a.x * sx, a.y * sy);
      ctx.lineTo(c.x * sx, c.y * sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textBaseline = 'bottom';
      ctx.fillText(fmt(lon), a.x * sx + 4 * s, a.y * sy - 6 * s);
    }
    for (let lat = startLat; lat <= north + 1e-9; lat = +(lat + step).toFixed(8)) {
      const a = map.project([west, lat]);
      const c = map.project([east, lat]);
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.moveTo(a.x * sx, a.y * sy);
      ctx.lineTo(c.x * sx, c.y * sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textBaseline = 'top';
      ctx.fillText(fmt(lat), 8 * s, a.y * sy + 4 * s);
    }
    ctx.restore();
  }

  function drawFx() {
    const canvas = $('smGrid');
    const paper = $('smPaper');
    if (!paper) return;
    paper.classList.toggle('is-vignette-off', !cfg.vignette);
    paper.classList.toggle('is-grain-off', !cfg.grain);
    paper.classList.toggle('is-grid-off', !cfg.graticule);
    paper.dataset.frame = cfg.frame;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!previewMap || !cfg.graticule) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const w = canvas.clientWidth || paper.clientWidth || 1;
    const h = canvas.clientHeight || paper.clientHeight || 1;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawGraticuleOn(ctx, previewMap, 1, 1, 1);
  }

  function drawHeat(ctx, features, map, sx, sy, scale) {
    if (!cfg.heat) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    features.forEach((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const p = map.project([lon, lat]);
      const x = p.x * sx;
      const y = p.y * sy;
      const r = Math.max(16, 30 * scale);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, hexToRgba(f.properties.color, 0.42));
      g.addColorStop(0.4, hexToRgba(f.properties.color, 0.16));
      g.addColorStop(1, hexToRgba(f.properties.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawMarker(ctx, x, y, r, color, scale) {
    if (cfg.glow) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.85, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 0.28);
      ctx.fill();
    }
    if (cfg.marker === 'burst') {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.2, r * 0.18);
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 1.12, y + Math.sin(a) * r * 1.12);
        ctx.lineTo(x + Math.cos(a) * r * 1.55, y + Math.sin(a) * r * 1.55);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (cfg.marker === 'ring') {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.6 * scale, cfg.strokeW * scale * 1.35);
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
      if (cfg.strokeW > 0) {
        ctx.lineWidth = cfg.strokeW * scale;
        ctx.strokeStyle = cfg.stroke;
        ctx.stroke();
      }
    }
  }

  function ensureMap() {
    if (previewMap) {
      previewMap.resize();
      return Promise.resolve();
    }
    previewMap = new maplibregl.Map({
      container: 'smMap',
      style: buildRasterStyle(cfg.basemap),
      center: [14.92, 55.13],
      zoom: 10.4,
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      minZoom: 6,
      attributionControl: false,
      preserveDrawingBuffer: true,
      fadeDuration: 0,
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      canvasContextAttributes: {
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      }
    });
    previewMap.on('move', drawFx);
    previewMap.on('moveend', () => {
      updateScale();
      drawFx();
    });
    previewMap.on('zoomend', () => {
      updateScale();
      drawFx();
    });
    return waitStyle(previewMap);
  }

  async function show(on) {
    const page = $('stylizedMapPage');
    page.hidden = !on;
    if (!on) return;
    const fe = $('fieldExportPage');
    if (fe) fe.hidden = true;
    snapshotSelection();
    if (!cfg._opened) {
      const layer = state.activeMapLayer;
      const fromLayer = { satellite: 'aerial', hillshade: 'lidar', viridis: 'lidar', 'map-hd': 'chart' }[layer] || 'lidar';
      applyLook(fromLayer, { skipMap: true, keepBasemap: ['satellite', 'hillshade', 'viridis', 'map-hd'].includes(layer) });
      if (['satellite', 'hillshade', 'viridis', 'map-hd'].includes(layer)) cfg.basemap = layer;
      cfg._opened = true;
    }
    if (!$('smTitle').value) $('smTitle').value = 'Burial Sites of Bornholm';
    syncForm();
    renderLooks();
    renderBasemaps();
    applyTheme();
    refreshSitesUi();
    const first = !previewMap;
    await ensureMap();
    if (first) await applyBasemap();
    refreshSitesUi();
    requestAnimationFrame(() => {
      previewMap.resize();
      fitSites();
      updateScale();
      drawFx();
    });
  }

  function canvasLooksEmpty(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return true;
    const sampleW = Math.min(w, 80);
    const sampleH = Math.min(h, 50);
    const img = ctx.getImageData(
      Math.floor((w - sampleW) / 2),
      Math.floor((h - sampleH) / 2),
      sampleW,
      sampleH
    );
    const d = img.data;
    let opaque = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 16) {
      if (d[i + 3] < 10) continue;
      opaque++;
      const y = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      if (y < min) min = y;
      if (y > max) max = y;
    }
    return opaque < 6 || (max - min) < 6;
  }

  function copyMapFrame(map) {
    const src = map.getCanvas();
    const copy = document.createElement('canvas');
    copy.width = src.width;
    copy.height = src.height;
    if (!src.width || !src.height) return copy;
    copy.getContext('2d').drawImage(src, 0, 0);
    return copy;
  }

  function waitForPaintedFrame(map, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let frames = 0;
      let best = null;
      let settled = false;
      const finish = (canvas, err) => {
        if (settled) return;
        settled = true;
        map.off('render', onRender);
        if (canvas) resolve(canvas);
        else reject(err || new Error('Map frame was empty'));
      };
      const onRender = () => {
        frames++;
        requestAnimationFrame(() => {
          if (settled) return;
          const copy = copyMapFrame(map);
          if (!canvasLooksEmpty(copy)) {
            finish(copy);
            return;
          }
          best = copy;
          if (frames >= 40) {
            finish(best && !canvasLooksEmpty(best) ? best : null, new Error('Map frame was empty'));
          }
        });
      };
      map.on('render', onRender);
      if (typeof map.triggerRepaint === 'function') map.triggerRepaint();
      setTimeout(() => {
        if (best && !canvasLooksEmpty(best)) finish(best);
        else finish(null, new Error('Timed out waiting for the map to paint'));
      }, timeoutMs);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load ' + src));
      img.src = src;
    });
  }

  function hexToRgba(hex, alpha) {
    const h = String(hex || '#ffffff').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function basemapImage(kind) {
    if (kind === 'viridis') return { url: 'hillshade-viridis.webp', coords: HILLSHADE };
    if (kind === 'map-hd') return { url: 'map-hd-kopi.jpg', coords: MAP_HD };
    if (['hillshade', 'parchment', 'midnight', 'museum', 'ink'].includes(kind)) {
      return { url: 'hillshade.webp', coords: HILLSHADE };
    }
    return null;
  }

  function paintBasemapImage(ctx, kind) {
    if (kind === 'parchment') {
      ctx.globalAlpha = 0.55;
      ctx.filter = 'saturate(0.4) contrast(1.12) brightness(1.12)';
    } else if (kind === 'midnight') {
      ctx.globalAlpha = 0.88;
      ctx.filter = 'grayscale(1) brightness(0.55)';
    } else if (kind === 'museum') {
      ctx.globalAlpha = 0.6;
      ctx.filter = 'sepia(0.55) saturate(0.75) contrast(1.15) brightness(0.7)';
    } else if (kind === 'ink') {
      ctx.globalAlpha = 0.7;
      ctx.filter = 'grayscale(1) contrast(1.25) brightness(1.08)';
    } else {
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
    }
  }

  async function rasterizeView(outW, outH) {
    const map = previewMap;
    const el = map.getContainer();
    const sx = outW / Math.max(1, el.clientWidth);
    const sy = outH / Math.max(1, el.clientHeight);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    const kind = cfg.basemap;
    const paperBg = {
      satellite: '#0b1220',
      hillshade: '#121212',
      viridis: '#0b1020',
      'map-hd': '#d8c7a3',
      parchment: '#ead7b0',
      midnight: '#070b14',
      museum: '#140f0a',
      ink: '#f4efe4',
      liberty: '#f4efe4'
    };
    ctx.fillStyle = paperBg[kind] || '#111';
    ctx.fillRect(0, 0, outW, outH);

    const asset = basemapImage(kind);
    if (asset) {
      const img = await loadImage(asset.url);
      const [nw, ne, se, sw] = asset.coords.map((c) => map.project(c));
      const x = Math.min(nw.x, sw.x) * sx;
      const y = Math.min(nw.y, ne.y) * sy;
      const w = (Math.max(ne.x, se.x) - Math.min(nw.x, sw.x)) * sx;
      const h = (Math.max(sw.y, se.y) - Math.min(nw.y, ne.y)) * sy;
      ctx.save();
      paintBasemapImage(ctx, kind);
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    } else {
      try {
        const glCopy = await waitForPaintedFrame(map, 2500);
        ctx.drawImage(glCopy, 0, 0, outW, outH);
      } catch (e) {
        /* points still draw on the solid background */
      }
    }

    const scale = (sx + sy) / 2;
    const features = featuresFromSites();
    drawHeat(ctx, features, map, sx, sy, scale);
    drawGraticuleOn(ctx, map, sx, sy, scale);
    features.forEach((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const p = map.project([lon, lat]);
      const x = p.x * sx;
      const y = p.y * sy;
      const r = Math.max(2, f.properties.radius * scale);
      drawMarker(ctx, x, y, r, f.properties.color, scale);
      if (cfg.labels !== 'off' && f.properties.label) {
        ctx.font = `600 ${Math.max(10, 11 * scale)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 3 * scale;
        ctx.strokeStyle = haloColor();
        ctx.strokeText(f.properties.label, x, y + r + 3 * scale);
        ctx.fillStyle = labelFill();
        ctx.fillText(f.properties.label, x, y + r + 3 * scale);
        ctx.textAlign = 'left';
      }
    });
    return canvas;
  }

  function crc32(bytes) {
    let c = ~0 >>> 0;
    for (let i = 0; i < bytes.length; i++) {
      c ^= bytes[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return (~c) >>> 0;
  }

  function stampPngDpi(pngBuffer, dpi) {
    const src = new Uint8Array(pngBuffer);
    if (src.length < 33 || src[0] !== 0x89 || src[1] !== 0x50) return pngBuffer;
    const ihdrLen = (src[8] << 24) | (src[9] << 16) | (src[10] << 8) | src[11];
    const ihdrEnd = 8 + 12 + ihdrLen;
    const ppm = Math.round(dpi / 0.0254);
    const data = new Uint8Array(9);
    const dv = new DataView(data.buffer);
    dv.setUint32(0, ppm);
    dv.setUint32(4, ppm);
    data[8] = 1;
    const typeAndData = new Uint8Array(13);
    typeAndData.set([0x70, 0x48, 0x59, 0x73], 0);
    typeAndData.set(data, 4);
    const crc = crc32(typeAndData);
    const chunk = new Uint8Array(21);
    const cv = new DataView(chunk.buffer);
    cv.setUint32(0, 9);
    chunk.set(typeAndData, 4);
    cv.setUint32(17, crc);
    const out = new Uint8Array(src.length + 21);
    out.set(src.subarray(0, ihdrEnd), 0);
    out.set(chunk, ihdrEnd);
    out.set(src.subarray(ihdrEnd), ihdrEnd + 21);
    return out.buffer;
  }

  function canvasToPngBuffer(canvas) {
    const url = canvas.toDataURL('image/png');
    const b64 = url.split(',')[1];
    if (!b64) throw new Error('Could not encode PNG');
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr.buffer;
  }

  function paperRectScale(outW, outH) {
    const paper = $('smPaper');
    const r = paper.getBoundingClientRect();
    return {
      paper,
      r,
      sx: outW / r.width,
      sy: outH / r.height
    };
  }

  function boxOf(el, origin, sx, sy) {
    const r = el.getBoundingClientRect();
    return {
      x: (r.left - origin.left) * sx,
      y: (r.top - origin.top) * sy,
      w: r.width * sx,
      h: r.height * sy
    };
  }

  function fillTextBox(ctx, text, box, styles, maxWidth) {
    ctx.fillStyle = styles.color;
    ctx.font = `${styles.fontWeight} ${styles.fontSize}px ${styles.fontFamily}`;
    ctx.textBaseline = 'top';
    const t = (text || '').trim();
    if (!t) return;
    ctx.fillText(t, box.x, box.y, maxWidth || box.w);
  }

  let grainTile = null;
  function getGrainTile() {
    if (grainTile) return grainTile;
    grainTile = document.createElement('canvas');
    grainTile.width = 128;
    grainTile.height = 128;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 160 + Math.random() * 80;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return grainTile;
  }

  function drawAtmosphere(ctx, w, h) {
    if (cfg.vignette) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, isLightTheme() ? 'rgba(72,48,16,0.3)' : 'rgba(0,0,0,0.46)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (cfg.grain) {
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function drawFrame(ctx, w, h, sx, sy) {
    if (cfg.frame === 'none') return;
    const color = cfg.frameColor || getComputedStyle($('smPaper')).color || '#fbbf24';
    if (cfg.frame === 'gold') {
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 8 * sx;
      ctx.strokeRect(6 * sx, 6 * sy, w - 12 * sx, h - 12 * sy);
      ctx.strokeStyle = hexToRgba(color, 0.78);
      ctx.lineWidth = 1.6 * sx;
      ctx.strokeRect(10 * sx, 10 * sy, w - 20 * sx, h - 20 * sy);
      return;
    }
    if (cfg.frame === 'double') {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1 * sx;
      ctx.strokeRect(9 * sx, 9 * sy, w - 18 * sx, h - 18 * sy);
      ctx.strokeRect(14 * sx, 14 * sy, w - 28 * sx, h - 28 * sy);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.strokeStyle = hexToRgba(color, 0.4);
    ctx.lineWidth = 1 * sx;
    ctx.strokeRect(8 * sx, 8 * sy, w - 16 * sx, h - 16 * sy);
  }

  async function exportPng() {
    if (!previewMap) return;
    const btn = $('smExport');
    const dpi = Number(cfg.exportDpi) || 300;
    const paper = $('smPaper');
    const cssW = Math.max(1, paper.getBoundingClientRect().width);
    const cssH = Math.max(1, paper.getBoundingClientRect().height);
    const ratio = Math.min(12, Math.max(2, dpi / 96));
    const outW = Math.round(cssW * ratio);
    const outH = Math.round(cssH * ratio);

    if (btn) btn.disabled = true;
    showNotification(`Rendering ${outW}×${outH} px at ${dpi} DPI…`);
    await document.fonts.ready.catch(() => {});

    try {
      const mapBoxCss = $('smMap').getBoundingClientRect();
      const mapCanvas = await rasterizeView(Math.round(mapBoxCss.width * ratio), Math.round(mapBoxCss.height * ratio));
      const out = document.createElement('canvas');
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const { r, sx, sy } = paperRectScale(out.width, out.height);

    ctx.fillStyle = getComputedStyle(paper).backgroundColor || '#111';
    ctx.fillRect(0, 0, out.width, out.height);

    const mapBox = boxOf($('smMap'), r, sx, sy);
    ctx.imageSmoothingEnabled = mapCanvas.width < mapBox.w - 1 || mapCanvas.height < mapBox.h - 1;
    ctx.drawImage(mapCanvas, 0, 0, mapCanvas.width, mapCanvas.height, mapBox.x, mapBox.y, mapBox.w, mapBox.h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawAtmosphere(ctx, out.width, out.height);

    function paintPanel(box, alpha) {
      if (alpha < 0.02) return;
      ctx.fillStyle = hexToRgba(cfg.panelFill, alpha);
      roundRect(ctx, box.x, box.y, box.w, box.h, 10 * sx);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(cfg.panelEdge, 0.28);
      ctx.lineWidth = 1 * sx;
      ctx.stroke();
    }

    function withHalo(draw) {
      ctx.save();
      if (cfg.halo > 0) {
        ctx.shadowColor = hexToRgba(cfg.haloColor, Math.min(0.9, cfg.halo / 80));
        ctx.shadowBlur = (cfg.halo / 100) * 8 * sx;
      }
      draw();
      ctx.restore();
    }

    if (cfg.showTitle) {
      const title = $('smTitle');
      const sub = $('smSubtitle');
      const block = $('smTitleblock');
      if (cfg.titleCard) paintPanel(boxOf(block, r, sx, sy), cfg.panelAlpha / 100);
      const tBox = boxOf(title, r, sx, sy);
      const sBox = boxOf(sub, r, sx, sy);
      const tCss = getComputedStyle(title);
      const sCss = getComputedStyle(sub);
      withHalo(() => {
        fillTextBox(ctx, title.value, tBox, {
          color: cfg.titleColor,
          fontWeight: tCss.fontWeight,
          fontSize: parseFloat(tCss.fontSize) * sx,
          fontFamily: tCss.fontFamily
        });
        fillTextBox(ctx, sub.value, sBox, {
          color: cfg.captionColor,
          fontWeight: sCss.fontWeight,
          fontSize: parseFloat(sCss.fontSize) * sx,
          fontFamily: sCss.fontFamily
        });
      });
    }

    if (cfg.showLegend) {
      const legend = $('smLegend');
      const b = boxOf(legend, r, sx, sy);
      const lcss = getComputedStyle(legend);
      paintPanel(b, cfg.legendAlpha / 100);
      ctx.fillStyle = cfg.captionColor;
      let y = b.y + 10 * sy;
      const x = b.x + 12 * sx;
      legend.querySelectorAll('.sm-legend-title, .sm-legend-item, .sm-legend-ramp, .sm-legend-ramp-labels').forEach((node) => {
        if (node.classList.contains('sm-legend-title')) {
          ctx.font = `700 ${10 * sx}px ${lcss.fontFamily}`;
          ctx.fillStyle = cfg.captionColor;
          ctx.globalAlpha = 0.7;
          ctx.fillText(node.textContent, x, y);
          ctx.globalAlpha = 1;
          y += 16 * sy;
        } else if (node.classList.contains('sm-legend-item')) {
          const dot = node.querySelector('.sm-legend-dot');
          ctx.beginPath();
          ctx.arc(x + 5 * sx, y + 5 * sy, 5 * sx, 0, Math.PI * 2);
          const fill = getComputedStyle(dot).backgroundColor;
          if (dot && dot.classList.contains('is-ring')) {
            ctx.strokeStyle = fill === 'rgba(0, 0, 0, 0)' || fill === 'transparent' ? cfg.stroke : (getComputedStyle(dot).borderColor || fill);
            ctx.lineWidth = 2 * sx;
            ctx.stroke();
          } else {
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.strokeStyle = cfg.stroke;
            ctx.lineWidth = 1.2 * sx;
            ctx.stroke();
          }
          ctx.fillStyle = cfg.captionColor;
          ctx.font = `500 ${11 * sx}px ${lcss.fontFamily}`;
          ctx.fillText(node.textContent.trim(), x + 16 * sx, y);
          y += 16 * sy;
        } else if (node.classList.contains('sm-legend-ramp')) {
          const grd = ctx.createLinearGradient(x, y, x + b.w - 24 * sx, y);
          grd.addColorStop(0, '#fde68a');
          grd.addColorStop(0.25, '#fbbf24');
          grd.addColorStop(0.5, '#f97316');
          grd.addColorStop(0.75, '#ef4444');
          grd.addColorStop(1, '#9f1239');
          ctx.fillStyle = grd;
          roundRect(ctx, x, y, b.w - 24 * sx, 8 * sy, 6 * sx);
          ctx.fill();
          y += 16 * sy;
        } else if (node.classList.contains('sm-legend-ramp-labels')) {
          ctx.font = `400 ${10 * sx}px ${lcss.fontFamily}`;
          ctx.fillStyle = cfg.captionColor;
          ctx.globalAlpha = 0.75;
          ctx.fillText('Few', x, y);
          ctx.textAlign = 'right';
          ctx.fillText('Many', x + b.w - 24 * sx, y);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }
      });
    }

    if (cfg.showNorth) {
      const nb = boxOf($('smNorth'), r, sx, sy);
      const color = cfg.captionColor;
      const cx = nb.x + nb.w / 2;
      const cy = nb.y + nb.h * 0.38;
      const rad = Math.min(nb.w, nb.h) * 0.28;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.2 * sx;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2 * sx, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - rad * 1.12);
      ctx.lineTo(cx + rad * 0.22, cy);
      ctx.lineTo(cx, cy - rad * 0.18);
      ctx.lineTo(cx - rad * 0.22, cy);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(cx, cy + rad * 1.05);
      ctx.lineTo(cx - rad * 0.2, cy);
      ctx.lineTo(cx, cy + rad * 0.16);
      ctx.lineTo(cx + rad * 0.2, cy);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = `700 ${11 * sx}px Cinzel, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('N', cx, nb.y + nb.h - 4 * sy);
      ctx.textAlign = 'left';
    }

    if (cfg.showScale) {
      const sb = boxOf($('smScale'), r, sx, sy);
      const barPx = parseFloat($('smScale').dataset.px || '80') * sx;
      const label = $('smScale').innerText.trim();
      ctx.strokeStyle = cfg.captionColor;
      ctx.lineWidth = 1.6 * sx;
      ctx.beginPath();
      ctx.moveTo(sb.x, sb.y);
      ctx.lineTo(sb.x, sb.y + 6 * sy);
      ctx.lineTo(sb.x + barPx, sb.y + 6 * sy);
      ctx.lineTo(sb.x + barPx, sb.y);
      ctx.stroke();
      ctx.fillStyle = cfg.captionColor;
      ctx.font = `500 ${11 * sx}px ${getComputedStyle($('smScale')).fontFamily}`;
      ctx.fillText(label, sb.x, sb.y + 18 * sy);
    }

    if (cfg.showCredit) {
      const cb = boxOf($('smCredit'), r, sx, sy);
      const ccss = getComputedStyle($('smCredit'));
      ctx.globalAlpha = 0.72;
      fillTextBox(ctx, $('smCredit').textContent, cb, {
        color: cfg.captionColor,
        fontWeight: ccss.fontWeight,
        fontSize: parseFloat(ccss.fontSize) * sx,
        fontFamily: ccss.fontFamily
      }, out.width - 36 * sx);
      ctx.globalAlpha = 1;
    }

    drawFrame(ctx, out.width, out.height, sx, sy);

      let pngBuffer;
      try {
        pngBuffer = canvasToPngBuffer(out);
      } catch (err) {
        showNotification('This basemap cannot be captured in the browser. Try LiDAR, Parchment, Midnight or 1805, or use Print / PDF.');
        return;
      }
      const tagged = stampPngDpi(pngBuffer, dpi);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([tagged], { type: 'image/png' }), `bornholm_stylized_map_${dpi}dpi_${stamp}.png`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function bind() {
    $('exportStylizedMap').addEventListener('click', (e) => {
      e.preventDefault();
      const dd = document.getElementById('exportDropdownContainer');
      if (dd) dd.classList.remove('open');
      show(true);
    });
    $('smBack').addEventListener('click', () => show(false));
    $('smFit').addEventListener('click', fitSites);
    $('smPrint').addEventListener('click', () => window.print());
    $('smExport').addEventListener('click', () => exportPng().catch((err) => {
      console.error(err);
      showNotification(err && err.message ? `Export failed: ${err.message}` : 'Could not export the map.');
    }));

    $('smLooks').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-look]');
      if (!btn) return;
      applyLook(btn.dataset.look);
    });

    $('smBasemaps').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-basemap]');
      if (!btn) return;
      cfg.basemap = btn.dataset.basemap;
      const look = LOOKS.find((l) => l.id === cfg.look);
      if (!look || look.basemap !== cfg.basemap) cfg.look = 'custom';
      renderLooks();
      renderBasemaps();
      applyTheme();
      applyBasemap();
    });

    $('smColorSeg').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-color-mode]');
      if (!btn) return;
      cfg.colorMode = btn.dataset.colorMode;
      $('smColorMode').value = cfg.colorMode;
      syncForm();
      applyTheme();
      refreshSitesUi();
    });
    $('smMarkerSeg').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-marker]');
      if (!btn) return;
      cfg.marker = btn.dataset.marker;
      syncForm();
      applyPointPaint();
      renderLegend();
    });
    $('smColorMode').addEventListener('change', (e) => {
      cfg.colorMode = e.target.value;
      syncForm();
      applyTheme();
      refreshSitesUi();
    });
    [['smFill', 'fill'], ['smColorWeapons', 'colorWeapons'], ['smColorMonuments', 'colorMonuments'], ['smColorOther', 'colorOther'], ['smStroke', 'stroke']].forEach(([id, key]) => {
      $(id).addEventListener('input', (e) => {
        cfg[key] = e.target.value;
        refreshSitesUi();
      });
    });
    $('smSize').addEventListener('input', (e) => {
      cfg.size = Number(e.target.value);
      $('smSizeVal').textContent = String(cfg.size);
      refreshSitesUi();
    });
    $('smStrokeW').addEventListener('input', (e) => {
      cfg.strokeW = Number(e.target.value);
      $('smStrokeWVal').textContent = String(cfg.strokeW);
      applyPointPaint();
    });
    $('smSizeByGraves').addEventListener('change', (e) => {
      cfg.sizeByGraves = e.target.checked;
      refreshSitesUi();
    });
    $('smGlow').addEventListener('change', (e) => {
      cfg.glow = e.target.checked;
      applyPointPaint();
    });
    $('smHeat').addEventListener('change', (e) => {
      cfg.heat = e.target.checked;
      applyPointPaint();
    });
    $('smGraticule').addEventListener('change', (e) => {
      cfg.graticule = e.target.checked;
      drawFx();
    });
    $('smVignette').addEventListener('change', (e) => {
      cfg.vignette = e.target.checked;
      drawFx();
    });
    $('smGrain').addEventListener('change', (e) => {
      cfg.grain = e.target.checked;
      drawFx();
    });
    $('smFrame').addEventListener('change', (e) => {
      cfg.frame = e.target.value;
      applyTheme();
    });
    [['smTitleColor', 'titleColor'], ['smCaptionColor', 'captionColor'], ['smHaloColor', 'haloColor'], ['smPanelFill', 'panelFill'], ['smPanelEdge', 'panelEdge'], ['smFrameColor', 'frameColor']].forEach(([id, key]) => {
      if (!$(id)) return;
      $(id).addEventListener('input', (e) => {
        cfg[key] = e.target.value;
        applyInk();
      });
    });
    $('smHalo').addEventListener('input', (e) => {
      cfg.halo = Number(e.target.value);
      $('smHaloVal').textContent = `${cfg.halo}%`;
      applyInk();
    });
    $('smTitleBgA').addEventListener('input', (e) => {
      cfg.panelAlpha = Number(e.target.value);
      $('smTitleBgVal').textContent = `${cfg.panelAlpha}%`;
      applyInk();
    });
    $('smLegendBgA').addEventListener('input', (e) => {
      cfg.legendAlpha = Number(e.target.value);
      $('smLegendBgVal').textContent = `${cfg.legendAlpha}%`;
      applyInk();
    });
    $('smTitleCard').addEventListener('change', (e) => {
      cfg.titleCard = e.target.checked;
      applyInk();
    });
    $('smInkReset').addEventListener('click', () => {
      const look = LOOKS.find((l) => l.id === cfg.look) || LOOKS.find((l) => l.id === 'lidar');
      Object.assign(cfg, inkForLook(look));
      syncForm();
      applyInk();
    });
    ERA_ORDER.concat(['OTHER']).forEach((era) => {
      const el = $(`smEra${era}`);
      if (!el) return;
      el.addEventListener('input', (e) => {
        cfg.eraColors[era] = e.target.value;
        refreshSitesUi();
      });
    });
    $('smLabels').addEventListener('change', (e) => {
      cfg.labels = e.target.value;
      refreshSitesUi();
    });
    $('smAspect').addEventListener('change', (e) => {
      cfg.aspect = e.target.value;
      applyTheme();
      requestAnimationFrame(() => {
        if (previewMap) previewMap.resize();
        updateScale();
      });
    });
    $('smDpi').addEventListener('change', (e) => {
      cfg.exportDpi = Number(e.target.value) || 300;
    });
    [['smShowTitle', 'showTitle'], ['smShowLegend', 'showLegend'], ['smShowNorth', 'showNorth'], ['smShowScale', 'showScale'], ['smShowCredit', 'showCredit']].forEach(([id, key]) => {
      $(id).addEventListener('change', (e) => {
        cfg[key] = e.target.checked;
        applyTheme();
      });
    });

    $('smSiteSearch').addEventListener('input', renderSiteList);
    $('smSitesAll').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hidden.clear();
      refreshSitesUi();
    });
    $('smSitesNone').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      siteCache.forEach((s) => hidden.add(siteId(s)));
      refreshSitesUi();
    });
    $('smSiteList').addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.site) {
        if (t.checked) hidden.delete(t.dataset.site);
        else hidden.add(t.dataset.site);
        refreshSitesUi();
      } else if (t.dataset.color) {
        colorOverride.set(t.dataset.color, t.value);
        refreshSitesUi();
      }
    });

    window.addEventListener('resize', () => {
      if (!$('stylizedMapPage') || $('stylizedMapPage').hidden || !previewMap) return;
      previewMap.resize();
      updateScale();
      drawFx();
    });
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
