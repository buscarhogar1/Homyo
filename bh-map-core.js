// bh-map-core.js
(function () {
  // Estado global mínimo para conectar módulos sin imports
  window.BHMap = window.BHMap || {};
  const BHMap = window.BHMap;

  const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

  const DEFAULT_CENTER = [37.9838, -1.1280];
  const DEFAULT_ZOOM = 13;

  const statusEl = document.getElementById("status");

  function setStatus(msg) {
    statusEl.textContent = msg || "";
  }

  function toInt(v) {
    if (v == null || v === "") return null;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  }

  function toText(v) {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }

  function toTextArray(csv) {
    if (!csv) return null;
    const arr = String(csv).split(",").map(s => s.trim()).filter(Boolean);
    return arr.length ? arr : null;
  }

  function getParams() {
    const u = new URL(window.location.href);

    let mode = (u.searchParams.get("mode") || "").trim().toLowerCase();
    if (!mode) mode = "buy";

    const allowed = ["buy","rent","room","new_build","all"];
    if (!allowed.includes(mode)) mode = "buy";

    return {
      city: (u.searchParams.get("city") || "").trim(),
      mode,

      priceMin: toInt(u.searchParams.get("price_min")),
      priceMax: toInt(u.searchParams.get("price_max")),

      listedSinceDays: toInt(u.searchParams.get("since_days")),
      availability: toText(u.searchParams.get("availability")),

      usefulMin: toInt(u.searchParams.get("useful_min")),
      usefulMax: toInt(u.searchParams.get("useful_max")),

      builtMin: toInt(u.searchParams.get("built_min")),
      builtMax: toInt(u.searchParams.get("built_max")),

      bedroomsMin: toInt(u.searchParams.get("bedrooms_min")),
      bathroomsMin: toInt(u.searchParams.get("bathrooms_min")),

      outdoorType: toText(u.searchParams.get("outdoor_type")),
      orientations: toTextArray(u.searchParams.get("orientations")),

      energyChoice: toText(u.searchParams.get("energy")),

      buildPeriods: toTextArray(u.searchParams.get("build_periods")),

      parkingTypes: toTextArray(u.searchParams.get("parking")),
      storageTypes: toTextArray(u.searchParams.get("storage")),

      accessibility: toTextArray(u.searchParams.get("accessibility"))
    };
  }

  const initialParams = getParams();

  // Leaflet map + base layer
  const map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  const markersLayer = L.layerGroup().addTo(map);

  let activeMarker = null;
  let lastRows = [];

  function clearMarkers() {
    markersLayer.clearLayers();
    activeMarker = null;
  }

  function setMarkersVisible(visible){
    const has = map.hasLayer(markersLayer);
    if (visible && !has) markersLayer.addTo(map);
    if (!visible && has) map.removeLayer(markersLayer);
  }

  function addPoint(p) {
    if (p.lat == null || p.lng == null) return;

    const el = document.createElement("div");
    el.className = "dot";

    const icon = L.divIcon({
      className: "",
      html: el,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const m = L.marker([p.lat, p.lng], { icon }).addTo(markersLayer);

    m.on("click", () => {
      if (BHMap.areas && BHMap.areas.isDrawing && BHMap.areas.isDrawing()) return;

      if (activeMarker && activeMarker._icon) {
        activeMarker._icon.querySelector(".dot")?.classList.remove("active");
      }
      activeMarker = m;
      m._icon.querySelector(".dot")?.classList.add("active");

      if (BHMap.card && BHMap.card.openForPoint) BHMap.card.openForPoint(p);
    });
  }

  function getCurrentBounds() {
    const b = map.getBounds();
    return {
      south: b.getSouthWest().lat,
      west: b.getSouthWest().lng,
      north: b.getNorthEast().lat,
      east: b.getNorthEast().lng
    };
  }

  async function rpcSearchMapPoints(bounds, filters) {
    const body = {
      p_south: bounds.south,
      p_west: bounds.west,
      p_north: bounds.north,
      p_east: bounds.east,

      p_mode: (filters.mode && filters.mode !== "all") ? filters.mode : null,

      p_price_min: filters.priceMin,
      p_price_max: filters.priceMax,

      p_listed_since_days: filters.listedSinceDays,
      p_availability: filters.availability,

      p_useful_min: filters.usefulMin,
      p_useful_max: filters.usefulMax,

      p_built_min: filters.builtMin,
      p_built_max: filters.builtMax,

      p_bedrooms_min: filters.bedroomsMin,
      p_bathrooms_min: filters.bathroomsMin,

      p_outdoor_type: filters.outdoorType,
      p_orientations: filters.orientations,

      p_energy_choice: filters.energyChoice,

      p_build_periods: filters.buildPeriods,

      p_parking_types: filters.parkingTypes,
      p_storage_types: filters.storageTypes,

      p_accessibility: filters.accessibility
    };

    const url = `${SUPABASE_URL}/rest/v1/rpc/search_map_points_filtered`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt);
    }

    return await res.json();
  }

  async function loadPointsForCurrentView() {
    const b = getCurrentBounds();
    const z = map.getZoom();
    const f = (BHMap.filters && BHMap.filters.getParams) ? BHMap.filters.getParams() : getParams();

    if (BHMap.areas && BHMap.areas.isDrawing && BHMap.areas.isDrawing()) {
      setStatus((BHMap.areas.getLastHint && BHMap.areas.getLastHint()) || "Dibujando área...");
      return;
    }

    setStatus("Cargando...");
    const rows = await rpcSearchMapPoints(b, f);

    let filtered = rows;
    if (BHMap.areas && BHMap.areas.filterRows) {
      filtered = BHMap.areas.filterRows(rows);
    }

    lastRows = filtered;

    clearMarkers();
    filtered.forEach(addPoint);

    if (BHMap.list && BHMap.list.update) {
      BHMap.list.update(filtered);
    }

    setStatus(`Anuncios: ${filtered.length} | zoom ${z} | modo=${f.mode}`);
  }

  let debounceTimer = null;

  function scheduleReload() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        await loadPointsForCurrentView();
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        setStatus(`Error: ${msg}`);
        console.error(e);
      }
    }, 300);
  }

  async function geocodeCity(city) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  }

  async function goToCity(city) {
    setStatus("Buscando ciudad...");
    const center = await geocodeCity(city);
    if (center) map.setView(center, 13);
    scheduleReload();
  }

  function wireHeaderMiniSearch(){
    const form = document.getElementById("miniSearchForm");
    const input = document.getElementById("miniQ");

    if (!form || !input) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const city = (input.value || "").trim();
      if (!city) return;

      const u = new URL(window.location.href);
      u.searchParams.set("city", city);
      history.replaceState(null, "", u.toString());

      await goToCity(city);
    });
  }

  function wireHeaderNav(){
    const fav = document.getElementById("navFavoritos");
    const login = document.getElementById("navLogin");

    if (fav) fav.addEventListener("click", (e) => {
      e.preventDefault();
      alert("MVP: Favoritos (requiere registro).");
    });

    if (login) login.addEventListener("click", (e) => {
      e.preventDefault();
      alert("MVP: Iniciar sesión.");
    });
  }

  map.on("moveend", scheduleReload);
  map.on("zoomend", scheduleReload);

  map.on("click", (e) => {
    const consumed = (BHMap.areas && BHMap.areas.handleMapClick) ? BHMap.areas.handleMapClick(e) : false;
    if (consumed) return;
    if (BHMap.card && BHMap.card.close) BHMap.card.close();
  });

  // API para el resto de módulos
  BHMap.map = map;
  BHMap.setStatus = setStatus;
  BHMap.getParamsFromURL = getParams;
  BHMap.scheduleReload = scheduleReload;
  BHMap.loadPoints = loadPointsForCurrentView;
  BHMap.setMarkersVisible = setMarkersVisible;
  BHMap.getLastRows = () => lastRows.slice();

  // init
  (async function init(){
    try {
      wireHeaderMiniSearch();
      wireHeaderNav();

      if (initialParams.city) {
        const center = await geocodeCity(initialParams.city);
        if (center) map.setView(center, 13);
      }
      await loadPointsForCurrentView();
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setStatus(`Error: ${msg}`);
      console.error(e);
    }
  })();
})();
