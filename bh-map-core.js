import { initFiltersBar } from "/buscarhogardemo/map-filters.js";
import { initSun } from "/buscarhogardemo/map-sun.js";
import { initAreas } from "/buscarhogardemo/map-areas.js";
import { initListPanel } from "/buscarhogardemo/map-list.js";

const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

const DEFAULT_CENTER = [37.9838, -1.1280];
const DEFAULT_ZOOM = 13;

const els = {
  status: document.getElementById("status"),

  card: document.getElementById("card"),
  cardClose: document.getElementById("cardClose"),
  heartBtn: document.getElementById("heartBtn"),

  badgeNew: document.getElementById("badgeNew"),
  mediaImg: document.getElementById("mediaImg"),
  mediaPlaceholder: document.getElementById("mediaPlaceholder"),

  cardAddrTop: document.getElementById("cardAddrTop"),
  cardAddrBottom: document.getElementById("cardAddrBottom"),
  cardPrice: document.getElementById("cardPrice"),
  cardFacts: document.getElementById("cardFacts"),
  cardAgency: document.getElementById("cardAgency"),

  sunOverlay: document.getElementById("sunOverlay"),
  sunOverlayLabel: document.getElementById("sunOverlayLabel"),
  sunPolarOverlay: document.getElementById("sunPolarOverlay"),

  sunTimebar: document.getElementById("sunTimebar"),
  sunDateDock: document.getElementById("sunDateDock"),
  sunHoursRow: document.getElementById("sunHoursRow"),
  sunTrack: document.getElementById("sunTrack"),
  sunRange: document.getElementById("sunRange"),
  sunDate: document.getElementById("sunDate"),
  sunNowBtn: document.getElementById("sunNowBtn"),

  areaHint: document.getElementById("areaHint"),
  areaHintText: document.getElementById("areaHintText")
};

function setStatus(msg) {
  els.status.textContent = msg || "";
}

function euro(n) {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} EUR`;
  }
}

function joinNonEmpty(parts, sep) {
  return parts.map(v => (v == null ? "" : String(v).trim())).filter(v => v.length > 0).join(sep);
}

function buildAddressTop(p) {
  const base = joinNonEmpty([p.street_name, p.street_number], " ");
  const extras = joinNonEmpty([p.building, p.staircase, p.floor, p.door], ", ");
  if (base && extras) return base + ", " + extras;
  return base || extras || "Dirección";
}

function buildAddressBottom(p) {
  const line = joinNonEmpty([p.postcode, p.city], " ");
  return line || "—";
}

function isRecent(listedAtIso, days = 14) {
  if (!listedAtIso) return false;
  const d = new Date(listedAtIso);
  if (Number.isNaN(d.getTime())) return false;
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function iconArea() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 10h16"/><path d="M10 10v10"/></svg>';
}
function iconType() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>';
}

function openCard() { els.card.classList.add("visible"); }
function closeCard() { els.card.classList.remove("visible"); }

els.cardClose.addEventListener("click", closeCard);

let heartOn = false;
els.heartBtn.addEventListener("click", () => {
  heartOn = !heartOn;
  els.heartBtn.style.borderColor = heartOn ? "rgba(26,115,232,0.55)" : "rgba(0,0,0,0.18)";
  els.heartBtn.style.boxShadow = heartOn ? "0 6px 18px rgba(26,115,232,0.18)" : "none";
});

function setPhoto(url) {
  if (!url) {
    els.mediaImg.style.display = "none";
    els.mediaImg.removeAttribute("src");
    els.mediaPlaceholder.style.display = "grid";
    return;
  }

  els.mediaImg.src = url;
  els.mediaImg.style.display = "block";
  els.mediaPlaceholder.style.display = "none";

  els.mediaImg.onerror = () => {
    els.mediaImg.style.display = "none";
    els.mediaImg.removeAttribute("src");
    els.mediaPlaceholder.style.display = "grid";
  };
}

function openCardForPoint(p) {
  els.cardAddrTop.textContent = buildAddressTop(p);
  els.cardAddrBottom.textContent = buildAddressBottom(p);

  els.cardAddrTop.href = `listing.html?id=${encodeURIComponent(p.listing_id)}`;

  els.cardPrice.textContent = (p.price_eur != null) ? euro(p.price_eur) : "—";

  setPhoto(p.main_photo_url || null);

  els.badgeNew.style.display = isRecent(p.listed_at, 14) ? "inline-flex" : "none";

  const m2 = (p.useful_area_m2 != null) ? `${p.useful_area_m2} m²` : "— m²";
  const type = p.property_type ? String(p.property_type) : "—";

  els.cardFacts.innerHTML = `
    <div class="fact">${iconArea()}<span>${m2} m² útiles</span></div>
    <div class="fact">${iconType()}<span>${type}</span></div>
  `;

  els.cardAgency.textContent = p.agency_name || "—";
  openCard();
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

function getParamsFromUrl() {
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

/*
  Importante: NO dejamos que la barra de filtros cambie el mode.
  Preservamos el mode actual de la URL siempre.
*/
function setParamsToUrl(partial) {
  const u = new URL(window.location.href);
  const current = getParamsFromUrl();

  const next = {
    ...current,
    ...partial,
    mode: current.mode
  };

  const set = (k, v) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) u.searchParams.delete(k);
    else u.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  };

  set("mode", next.mode);
  set("city", next.city);

  set("price_min", next.priceMin);
  set("price_max", next.priceMax);

  set("useful_min", next.usefulMin);
  set("useful_max", next.usefulMax);

  set("built_min", next.builtMin);
  set("built_max", next.builtMax);

  set("bedrooms_min", next.bedroomsMin);
  set("bathrooms_min", next.bathroomsMin);

  set("energy", next.energyChoice);

  history.replaceState(null, "", u.toString());
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

function getCurrentBounds(map) {
  const b = map.getBounds();
  return {
    south: b.getSouthWest().lat,
    west: b.getSouthWest().lng,
    north: b.getNorthEast().lat,
    east: b.getNorthEast().lng
  };
}

async function geocodeCity(city) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data[0]) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

async function goToCity(map, city) {
  setStatus("Buscando ciudad...");
  const center = await geocodeCity(city);
  if (center) map.setView(center, 13);
}

function wireHeaderMiniSearch(onCity) {
  const form = document.getElementById("miniSearchForm");
  const input = document.getElementById("miniQ");
  if (!form || !input) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const city = (input.value || "").trim();
    if (!city) return;
    await onCity(city);
  });
}

function wireHeaderNav() {
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

function setMarkersVisible(map, markersLayer, visible) {
  const has = map.hasLayer(markersLayer);
  if (visible && !has) markersLayer.addTo(map);
  if (!visible && has) map.removeLayer(markersLayer);
}

function init() {
  if (!window.L) {
    setStatus("Error: Leaflet no está cargado.");
    return;
  }

  const map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  const markersLayer = L.layerGroup().addTo(map);
  let activeMarker = null;

  function clearMarkers() {
    markersLayer.clearLayers();
    activeMarker = null;
  }

  function addPoint(p, guard) {
    if (p.lat == null || p.lng == null) return;
    if (guard && guard.isDrawing()) return;

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
      if (guard && guard.isDrawing()) return;

      if (activeMarker && activeMarker._icon) {
        activeMarker._icon.querySelector(".dot")?.classList.remove("active");
      }
      activeMarker = m;
      m._icon.querySelector(".dot")?.classList.add("active");
      openCardForPoint(p);
    });
  }

  let debounceTimer = null;

  const areas = initAreas({
    map,
    els,
    onMarkersVisible: (visible) => setMarkersVisible(map, markersLayer, visible),
    onCloseCard: closeCard,
    onScheduleReload: () => scheduleReload(),
    onStatus: (txt) => setStatus(txt)
  });

  initSun({
    map,
    els,
    onIfAreaDrawingCancel: () => areas.cancelDrawingIfAny(),
    onAreaWantsSunOff: (fnForceOffSetter) => areas.setSunForceOff(fnForceOffSetter)
  });

  initListPanel({});

  initFiltersBar({
    container: document.getElementById("filtersInner"),
    getInitial: () => getParamsFromUrl(),
    onApply: async (partial) => {
      // Preserva mode siempre
      setParamsToUrl(partial);

      const cur = getParamsFromUrl();
      if (cur.city) await goToCity(map, cur.city);

      scheduleReload(true);
    },
    onClear: async () => {
      // Limpiamos filtros, pero NO tocamos mode; city la dejamos como está
      const cur = getParamsFromUrl();
      setParamsToUrl({
        city: cur.city || "",

        priceMin: null,
        priceMax: null,
        usefulMin: null,
        usefulMax: null,
        builtMin: null,
        builtMax: null,
        bedroomsMin: null,
        bathroomsMin: null,
        energyChoice: null
      });

      if (cur.city) await goToCity(map, cur.city);
      scheduleReload(true);
    }
  });

  async function loadPointsForCurrentView() {
    const f = getParamsFromUrl();
    const b = getCurrentBounds(map);
    const z = map.getZoom();

    if (areas.isDrawing()) {
      setStatus(areas.getHint() || "Dibujando área...");
      return;
    }

    setStatus("Cargando...");
    const rows = await rpcSearchMapPoints(b, f);
    const filtered = rows.filter(p => areas.isInsideAnyArea(p));

    clearMarkers();
    filtered.forEach(p => addPoint(p, areas));

    setStatus(`Anuncios: ${filtered.length} | zoom ${z} | modo=${f.mode}`);
  }

  function scheduleReload(immediate) {
    if (debounceTimer) clearTimeout(debounceTimer);
    const wait = immediate ? 0 : 300;
    debounceTimer = setTimeout(async () => {
      try {
        await loadPointsForCurrentView();
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        setStatus(`Error: ${msg}`);
        console.error(e);
      }
    }, wait);
  }

  map.on("moveend", () => scheduleReload(false));
  map.on("zoomend", () => scheduleReload(false));

  map.on("click", (e) => {
    const consumed = areas.handleMapClick(e);
    if (consumed) return;
    closeCard();
  });

  wireHeaderMiniSearch(async (city) => {
    const cur = getParamsFromUrl();
    setParamsToUrl({ city });
    await goToCity(map, city);
    scheduleReload(true);
  });

  wireHeaderNav();

  (async () => {
    try {
      const initial = getParamsFromUrl();
      if (initial.city) {
        const center = await geocodeCity(initial.city);
        if (center) map.setView(center, 13);
      }
      scheduleReload(true);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setStatus(`Error: ${msg}`);
      console.error(e);
    }
  })();
}

init();
