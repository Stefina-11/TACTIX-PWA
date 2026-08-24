const TacticalMap = (() => {
  let map = null;
  let markers = [];
  let soldiers = {};
  let styleApplied = false;

  const SOLDIER_COLORS = {
    'SOL-2049': '#3b82f6',
    'SOL-1024': '#10b981',
    'SOL-3388': '#f59e0b',
    'CMD-7742': '#8b5cf6'
  };

  function initSoldierMap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    map = new maplibregl.Map({
      container,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [77.2090, 28.6139],
      zoom: 12,
      pitch: 45,
      bearing: 0,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      styleApplied = true;
      addDarkLayer(containerId);
    });
  }

  function initAdminMap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    map = new maplibregl.Map({
      container,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [77.2090, 28.6139],
      zoom: 11,
      pitch: 30,
      bearing: 0,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      addDarkLayer(containerId);
    });
  }

  function addDarkLayer(containerId) {
    if (!map) return;
    try {
      if (map.getLayer('soldier-markers')) {
        map.removeLayer('soldier-markers');
      }
      map.addSource('soldiers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'soldier-markers',
        type: 'circle',
        source: 'soldiers',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.9
        }
      });
      addPopupLayer();
    } catch (e) {
      console.warn('Layer add warning:', e);
    }
  }

  function addPopupLayer() {
    if (!map || map.getLayer('soldier-popups')) return;
    map.addLayer({
      id: 'soldier-popups',
      type: 'symbol',
      source: 'soldiers',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#e8ecf1',
        'text-halo-color': '#000',
        'text-halo-width': 1.5
      }
    });
  }

  function updateSoldier(soldierId, lat, lng, name, status = 'active') {
    soldiers[soldierId] = { lat, lng, name, status };
    refreshMarkers();
  }

  function removeSoldier(soldierId) {
    delete soldiers[soldierId];
    refreshMarkers();
  }

  function refreshMarkers() {
    if (!map || !map.getSource('soldiers')) return;
    const features = Object.entries(soldiers).map(([id, s]) => ({
      type: 'Feature',
      properties: {
        id,
        name: s.name || id,
        status: s.status,
        color: SOLDIER_COLORS[id] || '#6b7a8f'
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] }
    }));
    map.getSource('soldiers').setData({
      type: 'FeatureCollection',
      features
    });
  }

  function addMarkerToMap(lat, lng, color = '#d32f2f', label = 'SOS') {
    if (!map) return;
    const el = document.createElement('div');
    el.className = 'sos-marker';
    el.innerHTML = `<div style="width:24px;height:24px;background:${color};border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px ${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;font-family:var(--font-mono)">${label}</div>`;
    new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);
    markers.push({ lat, lng, el });
  }

  function clearMarkers() {
    markers.forEach(m => m.el.remove());
    markers = [];
  }

  function flyTo(lat, lng, zoom = 14) {
    if (map) map.flyTo({ center: [lng, lat], zoom, duration: 1500 });
  }

  function getMap() {
    return map;
  }

  function simulateSoldiers() {
    const baseLat = 28.6139;
    const baseLng = 77.2090;
    const demo = [
      { id: 'SOL-2049', lat: baseLat + 0.012, lng: baseLng + 0.015 },
      { id: 'SOL-1024', lat: baseLat - 0.008, lng: baseLng + 0.022 },
      { id: 'SOL-3388', lat: baseLat + 0.005, lng: baseLng - 0.018 },
      { id: 'CMD-7742', lat: baseLat - 0.003, lng: baseLng - 0.005 }
    ];
    demo.forEach(s => updateSoldier(s.id, s.lat, s.lng, s.id));
  }

  return {
    initSoldierMap,
    initAdminMap,
    updateSoldier,
    removeSoldier,
    addMarkerToMap,
    clearMarkers,
    flyTo,
    getMap,
    simulateSoldiers
  };
})();
