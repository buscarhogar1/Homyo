// bh-map-core.js
// - Mapa Leaflet + Supabase RPC
// - Listado lateral + ordenación
// - Geolocalización
// - Texto de área (Comunidad / Ciudad / Zona) según el mapa
// - Correcciones de layout (invalidateSize) al ocultar columnas

export function initMap(){
  const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

  const DEFAULT_CENTER = [37.9838, -1.1280];
  const DEFAULT_ZOOM = 13;

  const statusEl = document.getElementById("status");
  const areaTextEl = document.getElementById("areaText");

  const listingsEl = document.getElementById("listings");
  const sortBtn = document.getElementById("sortBtn");
  const sortMenu = document.getElementById("sortMenu");

  const cardEl = document.getElementById("card");
  const cardCloseBtn = document.getElementById("cardClose");
  const heartBtn = document.getElementById("heartBtn");

  const badgeNewEl = document.getElementById("badgeNew");
  const mediaImgEl = document.getElementById("mediaImg");
  const mediaPlaceholderEl = document.getElementById("mediaPlaceholder");

  const cardAddrTopEl = document.getElementById("cardAddrTop");
  const cardAddrBottomEl = document.getElementById("cardAddrBottom");
  const cardPriceEl = document.getElementById("cardPrice");
  const cardFactsEl = document.getElementById("cardFacts");
  const cardAgencyEl = document.getElementById("cardAgency");

  const sunOverlayEl = document.getElementById("sunOverlay");
  const sunOverlayLabelEl = document.getElementById("sunOverlayLabel");
  const sunPolarOverlaySvg = document.getElementById("sunPolarOverlay");

  const sunTimebarEl = document.getElementById("sunTimebar");
  const sunDateDockEl = document.getElementById("sunDateDock");
  const sunHoursRowEl = document.getElementById("sunHoursRow");
  const sunTrackEl = document.getElementById("sunTrack");
  const sunRangeEl = document.getElementById("sunRange");
  const sunDateEl = document.getElementById("sunDate");
  const sunNowBtn = document.getElementById("sunNowBtn");

  const areaHintEl = document.getElementById("areaHint");
  const areaHintTextEl = document.getElementById("areaHintText");

  function setStatus(msg) { statusEl.textContent = msg || ""; }

  function euro(n) {
    try {
      return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${n} EUR`;
    }
  }

  function openCard() { cardEl.classList.add("visible"); }
  function closeCard() { cardEl.classList.remove("visible"); }

  // Al cerrar ficha: deselecciona marcador activo
  cardCloseBtn.addEventListener("click", () => {
    closeCard();
    deselectActiveMarker();
  });

  let heartOn = false;
  heartBtn.addEventListener("click", () => {
    heartOn = !heartOn;
    heartBtn.style.borderColor = heartOn ? "rgba(26,115,232,0.55)" : "rgba(0,0,0,0.18)";
    heartBtn.style.boxShadow = heartOn ? "0 6px 18px rgba(26,115,232,0.18)" : "none";
  });

  function setPhoto(url) {
    if (!url) {
      mediaImgEl.style.display = "none";
      mediaImgEl.removeAttribute("src");
      mediaPlaceholderEl.style.display = "grid";
      return;
    }
    mediaImgEl.src = url;
    mediaImgEl.style.display = "block";
    mediaPlaceholderEl.style.display = "none";

    mediaImgEl.onerror = () => {
      mediaImgEl.style.display = "none";
      mediaImgEl.removeAttribute("src");
      mediaPlaceholderEl.style.display = "grid";
    };
  }

  function isRecent(listedAtIso, days = 14) {
    if (!listedAtIso) return false;
    const d = new Date(listedAtIso);
    if (isNaN(d.getTime())) return false;
    const diff = Date.now() - d.getTime();
    return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
  }

  function iconArea() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 10h16"/><path d="M10 10v10"/></svg>';
  }
  function iconType() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>';
  }

  function joinNonEmpty(parts, sep) {
    return parts.map(v => (v == null ? "" : String(v).trim()))
      .filter(v => v.length > 0)
      .join(sep);
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

  function openCardForPoint(p) {
    cardAddrTopEl.textContent = buildAddressTop(p);
    cardAddrBottomEl.textContent = buildAddressBottom(p);
    cardAddrTopEl.href = `listing.html?id=${encodeURIComponent(p.listing_id)}`;

    cardPriceEl.textContent = (p.price_eur != null) ? euro(p.price_eur) : "—";
    setPhoto(p.main_photo_url || null);
    badgeNewEl.style.display = isRecent(p.listed_at, 14) ? "inline-flex" : "none";

    const m2 = (p.useful_area_m2 != null) ? `${p.useful_area_m2} m²` : "— m²";
    const type = p.property_type ? String(p.property_type) : "—";

    cardFactsEl.innerHTML = `
      <div class="fact">${iconArea()}<span>${m2} m² útiles</span></div>
      <div class="fact">${iconType()}<span>${type}</span></div>
    `;

    cardAgencyEl.textContent = p.agency_name || "—";
    openCard();

    // Marcar como visto
    markSeen(p.listing_id);
    // Refrescar estilo del marcador activo (si está)
    refreshSeenStyles();
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

      // disponibilidad: por defecto available
      availability: toText(u.searchParams.get("availability")) || "available",

      usefulMin: toInt(u.searchParams.get("useful_min")),
      usefulMax: toInt(u.searchParams.get("useful_max")),

      builtMin: toInt(u.searchParams.get("built_min")),
      builtMax: toInt(u.searchParams.get("built_max")),

      bedroomsMin: toInt(u.searchParams.get("bedrooms_min")),
      bathroomsMin: toInt(u.searchParams.get("bathrooms_min")),

      energyChoice: toText(u.searchParams.get("energy")),

      // Reservados por si ya los usabas (no rompen aunque sean null)
      outdoorType: toText(u.searchParams.get("outdoor_type")),
      orientations: toTextArray(u.searchParams.get("orientations")),
      buildPeriods: toTextArray(u.searchParams.get("build_periods")),
      parkingTypes: toTextArray(u.searchParams.get("parking")),
      storageTypes: toTextArray(u.searchParams.get("storage")),
      accessibility: toTextArray(u.searchParams.get("accessibility"))
    };
  }

  const initialParams = getParams();

  let map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  window.__bhMap = map;

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  // Marcadores
  let markersLayer = L.layerGroup().addTo(map);
  let activeMarker = null;

  // Mapeo listing_id -> marker (para hover desde listado)
  const markerById = new Map();

  // Vistos (localStorage)
  const SEEN_KEY = "bh_seen_ids_v1";
  function loadSeenSet(){
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.map(String));
    } catch {
      return new Set();
    }
  }
  let seenSet = loadSeenSet();

  function markSeen(listingId){
    if (!listingId) return;
    const id = String(listingId);
    if (seenSet.has(id)) return;
    seenSet.add(id);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seenSet)));
    } catch {}
  }

  function refreshSeenStyles(){
    // Aplica clase "seen" a todos los marcadores que estén vistos y NO activos
    for (const [id, m] of markerById.entries()){
      const icon = m?._icon;
      if (!icon) continue;
      const dot = icon.querySelector(".dot");
      if (!dot) continue;

      const isActive = (activeMarker === m);
      dot.classList.toggle("seen", !isActive && seenSet.has(String(id)));
    }
  }

  function clearMarkers() {
    markersLayer.clearLayers();
    activeMarker = null;
    markerById.clear();
  }

  function deselectActiveMarker(){
    if (activeMarker && activeMarker._icon) {
      const dot = activeMarker._icon.querySelector(".dot");
      dot && dot.classList.remove("active");
      // si estaba visto, vuelve a estilo visto
      dot && dot.classList.toggle("seen", seenSet.has(String(activeMarker.__listingId)));
    }
    activeMarker = null;
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
    m.__listingId = String(p.listing_id || "");

    markerById.set(m.__listingId, m);

    // estilo "visto" si aplica
    if (seenSet.has(m.__listingId)) {
      el.classList.add("seen");
    }

    m.on("click", () => {
      if (areaState.isDrawing) return;

      // deseleccionar anterior
      if (activeMarker && activeMarker._icon) {
        const prevDot = activeMarker._icon.querySelector(".dot");
        prevDot && prevDot.classList.remove("active");
        prevDot && prevDot.classList.toggle("seen", seenSet.has(String(activeMarker.__listingId)));
      }

      activeMarker = m;
      el.classList.add("active");
      el.classList.remove("seen");

      openCardForPoint(p);
    });
  }

  function setMarkerHover(listingId, on){
    const m = markerById.get(String(listingId));
    if (!m || !m._icon) return;
    const dot = m._icon.querySelector(".dot");
    if (!dot) return;
    dot.classList.toggle("hover", !!on);
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

  // Ordenación del listado
  const SORTS = [
    { id: "date_desc", label: "Por fecha de publicación" },
    { id: "area_asc", label: "Tamaño: menor a mayor" },
    { id: "area_desc", label: "Tamaño: mayor a menor" },
    { id: "price_desc", label: "Precio: de mayor a menor" },
    { id: "price_asc", label: "Precio: de menor a mayor" },
  ];
  let currentSort = "date_desc";

  function renderSortMenu(){
    sortMenu.innerHTML = "";
    SORTS.forEach(s => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bhSortItem";
      b.textContent = s.label;
      b.addEventListener("click", () => {
        currentSort = s.id;
        closeSortMenu();
        scheduleReload();
      });
      sortMenu.appendChild(b);
    });
  }

  function openSortMenu(){
    sortMenu.classList.add("open");
    sortMenu.setAttribute("aria-hidden", "false");
  }
  function closeSortMenu(){
    sortMenu.classList.remove("open");
    sortMenu.setAttribute("aria-hidden", "true");
  }

  sortBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (sortMenu.classList.contains("open")) closeSortMenu();
    else openSortMenu();
  });

  window.addEventListener("click", (e) => {
    if (!sortMenu || !sortBtn) return;
    const t = e.target;
    if (sortMenu.contains(t) || sortBtn.contains(t)) return;
    closeSortMenu();
  });

  renderSortMenu();

  function sortRows(rows){
    const arr = rows.slice();
    const byDate = (a,b) => {
      const da = a.listed_at ? new Date(a.listed_at).getTime() : 0;
      const db = b.listed_at ? new Date(b.listed_at).getTime() : 0;
      return db - da;
    };
    const byAreaAsc = (a,b) => (toInt(a.useful_area_m2) || 0) - (toInt(b.useful_area_m2) || 0);
    const byAreaDesc = (a,b) => (toInt(b.useful_area_m2) || 0) - (toInt(a.useful_area_m2) || 0);
    const byPriceAsc = (a,b) => (toInt(a.price_eur) || 0) - (toInt(b.price_eur) || 0);
    const byPriceDesc = (a,b) => (toInt(b.price_eur) || 0) - (toInt(a.price_eur) || 0);

    if (currentSort === "date_desc") arr.sort(byDate);
    else if (currentSort === "area_asc") arr.sort(byAreaAsc);
    else if (currentSort === "area_desc") arr.sort(byAreaDesc);
    else if (currentSort === "price_asc") arr.sort(byPriceAsc);
    else if (currentSort === "price_desc") arr.sort(byPriceDesc);

    return arr;
  }

  function renderListings(rows){
    if (!listingsEl) return;

    listingsEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    rows.forEach(p => {
      const id = String(p.listing_id || "");
      const item = document.createElement("div");
      item.className = "bhListItem";
      item.dataset.id = id;

      const thumb = document.createElement("div");
      thumb.className = "bhListThumb";
      if (p.main_photo_url) {
        const img = document.createElement("img");
        img.src = p.main_photo_url;
        img.alt = "";
        thumb.innerHTML = "";
        thumb.appendChild(img);
      } else {
        thumb.textContent = "Foto";
      }

      const right = document.createElement("div");

      const title = document.createElement("div");
      title.className = "bhListTitle";
      title.textContent = buildAddressTop(p);

      const meta = document.createElement("div");
      meta.className = "bhListMeta";
      meta.textContent = buildAddressBottom(p);

      const price = document.createElement("div");
      price.className = "bhListPrice";
      price.textContent = (p.price_eur != null) ? euro(p.price_eur) : "—";

      const facts = document.createElement("div");
      facts.className = "bhListFacts";
      const m2 = (p.useful_area_m2 != null) ? `${p.useful_area_m2} m²` : "— m²";
      const type = p.property_type ? String(p.property_type) : "—";
      facts.textContent = `${m2} · ${type}`;

      const agency = document.createElement("div");
      agency.className = "bhListAgency";
      agency.textContent = p.agency_name || "—";

      right.appendChild(title);
      right.appendChild(meta);
      right.appendChild(price);
      right.appendChild(facts);
      right.appendChild(agency);

      item.appendChild(thumb);
      item.appendChild(right);

      // Hover: resalta marcador
      item.addEventListener("mouseenter", () => setMarkerHover(id, true));
      item.addEventListener("mouseleave", () => setMarkerHover(id, false));

      // Click: abrir ficha directamente
      item.addEventListener("click", () => {
        if (!id) return;
        window.location.href = `listing.html?id=${encodeURIComponent(id)}`;
      });

      frag.appendChild(item);
    });

    listingsEl.appendChild(frag);
  }

  // Debounce de carga
  let debounceTimer = null;

  // Áreas (tu código original, sin cambios funcionales)
  const MAX_AREAS = 5;

  const areaState = {
    pointsActive: false,
    freehandActive: false,

    drawingMode: null,
    isDrawing: false,

    isFreehandActive: false,
    points: [],
    tempLine: null,
    tempFirstMarker: null,
    tempVertexMarkers: [],
    tempLivePoly: null,

    polys: [],
    nextId: 1,

    btnPointsEl: null,
    btnFreeEl: null,
    btnPlusPointsEl: null,
    btnPlusFreeEl: null,

    refreshAreasUI: null,

    sunBtnForceOff: null,
    lastHint: ""
  };

  const areasLayer = L.layerGroup().addTo(map);

  function setAreaHintVisible(visible, text){
    areaHintEl.style.display = visible ? "block" : "none";
    areaHintEl.setAttribute("aria-hidden", visible ? "false" : "true");
    if (typeof text === "string") {
      areaHintTextEl.textContent = text;
      areaState.lastHint = text;
    }
  }

  function setMarkersVisible(visible){
    const has = map.hasLayer(markersLayer);
    if (visible && !has) markersLayer.addTo(map);
    if (!visible && has) map.removeLayer(markersLayer);
  }

  function clearTempDrawing(){
    if (areaState.tempLine) { areasLayer.removeLayer(areaState.tempLine); areaState.tempLine = null; }
    if (areaState.tempLivePoly) { areasLayer.removeLayer(areaState.tempLivePoly); areaState.tempLivePoly = null; }

    if (areaState.tempFirstMarker) {
      areasLayer.removeLayer(areaState.tempFirstMarker);
      areaState.tempFirstMarker = null;
    }

    areaState.tempVertexMarkers.forEach(m => areasLayer.removeLayer(m));
    areaState.tempVertexMarkers = [];
    areaState.points = [];
  }

  function cancelCurrentDrawing(){
    if (!areaState.isDrawing) return;
    areaState.isDrawing = false;
    areaState.isFreehandActive = false;
    areaState.drawingMode = null;
    clearTempDrawing();
    setMarkersVisible(true);
    setAreaHintVisible(false, "");
  }

  function latlngsToSimple(latlngs){
    return latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
  }

  function pointInPoly(lat, lng, poly){
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].lng, yi = poly[i].lat;
      const xj = poly[j].lng, yj = poly[j].lat;

      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);

      if (intersect) inside = !inside;
    }
    return inside;
  }

  function isInsideAnyArea(p){
    if (!areaState.polys.length) return true;
    if (p.lat == null || p.lng == null) return false;
    const lat = p.lat, lng = p.lng;
    for (const a of areaState.polys) {
      if (pointInPoly(lat, lng, a.latlngs)) return true;
    }
    return false;
  }

  function northwestVertex(latlngs){
    let best = null;
    for (const ll of latlngs) {
      if (!best) { best = ll; continue; }
      if (ll.lat > best.lat) best = ll;
      else if (ll.lat === best.lat && ll.lng < best.lng) best = ll;
    }
    return best || latlngs[0];
  }

  function makeDelMarker(latlng, areaId){
    const el = document.createElement("div");
    el.className = "areaDel";
    const s = document.createElement("span");
    s.textContent = "×";
    el.appendChild(s);

    const icon = L.divIcon({
      className: "",
      html: el,
      iconSize: [22,22],
      iconAnchor: [11,11]
    });

    const m = L.marker(latlng, { icon, interactive: true, keyboard: false });

    m.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      removeAreaById(areaId);
    });

    return m;
  }

  function removeAreaById(id, opts){
    const options = opts || {};
    const idx = areaState.polys.findIndex(x => x.id === id);
    if (idx < 0) return;

    const removed = areaState.polys[idx];

    if (removed.poly) areasLayer.removeLayer(removed.poly);
    if (removed.delMarker) areasLayer.removeLayer(removed.delMarker);

    areaState.polys.splice(idx, 1);

    if (removed && removed.type) {
      const stillAny = areaState.polys.some(a => a.type === removed.type);
      if (!stillAny) {
        if (removed.type === "points") {
          areaState.pointsActive = false;
          if (areaState.isDrawing && areaState.drawingMode === "points") cancelCurrentDrawing();
        }
        if (removed.type === "freehand") {
          areaState.freehandActive = false;
          if (areaState.isDrawing && areaState.drawingMode === "freehand") cancelCurrentDrawing();
        }
      }
    }

    if (!options.silentUI && areaState.refreshAreasUI) {
      areaState.refreshAreasUI();
    }

    scheduleReload();
  }

  function removeAreasByType(type){
    const ids = areaState.polys.filter(a => a.type === type).map(a => a.id);
    ids.forEach(id => removeAreaById(id, { silentUI: true }));
    if (areaState.refreshAreasUI) areaState.refreshAreasUI();
    scheduleReload();
  }

  function addAreaPolygon(latlngs, type){
    if (!latlngs || latlngs.length < 3) return false;
    if (areaState.polys.length >= MAX_AREAS) return false;

    const t = (type === "freehand") ? "freehand" : "points";

    const id = areaState.nextId++;
    const poly = L.polygon(latlngs, {
      color: "rgba(26,115,232,0.80)",
      weight: 3,
      opacity: 1,
      fillColor: "rgba(26,115,232,0.20)",
      fillOpacity: 0.18
    }).addTo(areasLayer);

    const nw = northwestVertex(latlngs);
    const delMarker = makeDelMarker(nw, id).addTo(areasLayer);

    areaState.polys.push({
      id,
      type: t,
      latlngs: latlngsToSimple(latlngs),
      poly,
      delMarker
    });

    if (areaState.refreshAreasUI) areaState.refreshAreasUI();
    return true;
  }

  function startNewAreaDrawing(mode){
    if (areaState.polys.length >= MAX_AREAS) return;
    if (mode !== "points" && mode !== "freehand") return;

    if (areaState.sunBtnForceOff) areaState.sunBtnForceOff();

    closeCard();
    deselectActiveMarker();
    clearTempDrawing();

    areaState.isDrawing = true;
    areaState.drawingMode = mode;
    setMarkersVisible(false);

    if (mode === "points") {
      setAreaHintVisible(true, "Haz clic punto a punto para dibujar el área. Cierra en el primer punto.");
      areaState.points = [];
      areaState.tempLine = L.polyline([], {
        color: "rgba(26,115,232,0.88)",
        weight: 3,
        opacity: 1
      }).addTo(areasLayer);
    }

    if (mode === "freehand") {
      setAreaHintVisible(true, "Mantén pulsado y dibuja el área. Suelta para terminar.");
      areaState.points = [];
      areaState.isFreehandActive = false;
    }
  }

  function finishDrawingPoints(){
    const pts = areaState.points.slice();
    if (pts.length < 3) {
      cancelCurrentDrawing();
      scheduleReload();
      return;
    }
    addAreaPolygon(pts, "points");
    cancelCurrentDrawing();
    scheduleReload();
  }

  function addPointVertex(latlng){
    areaState.points.push(latlng);

    if (areaState.tempLine) {
      areaState.tempLine.addLatLng(latlng);
    }

    const isFirst = areaState.points.length === 1;

    const circle = L.circleMarker(latlng, {
      radius: isFirst ? 7 : 6,
      color: "rgba(255,255,255,0.95)",
      weight: 3,
      fillColor: "rgba(26,115,232,0.90)",
      fillOpacity: 1
    }).addTo(areasLayer);

    if (isFirst) {
      areaState.tempFirstMarker = circle;
      circle.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (!areaState.isDrawing || areaState.drawingMode !== "points") return;
        finishDrawingPoints();
      });
    } else {
      areaState.tempVertexMarkers.push(circle);
    }
  }

  function maybeCloseFirst(latlng){
    if (!areaState.tempFirstMarker) return false;
    const first = areaState.points[0];
    if (!first) return false;
    const d = map.distance(first, latlng);
    return d <= 12;
  }

  function handleMapClickForAreas(e){
    if (!areaState.isDrawing) return false;

    if (areaState.drawingMode === "points") {
      const ll = e.latlng;
      if (!ll) return true;

      if (areaState.points.length >= 3 && maybeCloseFirst(ll)) {
        finishDrawingPoints();
        return true;
      }

      addPointVertex(ll);
      return true;
    }
    return true;
  }

  map.on("click", (e) => {
    const consumed = handleMapClickForAreas(e);
    if (consumed) return;
    closeCard();
    deselectActiveMarker();
  });

  // Carga + listado
  let lastRows = [];
  async function loadPointsForCurrentView() {
    const b = getCurrentBounds();
    const z = map.getZoom();
    const f = getParams();

    if (areaState.isDrawing) {
      setStatus(areaState.lastHint || "Dibujando área...");
      return;
    }

    setStatus(`Cargando...`);
    const rows = await rpcSearchMapPoints(b, f);
    const filtered = rows.filter(isInsideAnyArea);

    // Guardar para listado y ordenación
    lastRows = sortRows(filtered);

    clearMarkers();
    lastRows.forEach(addPoint);
    refreshSeenStyles();

    renderListings(lastRows);

    setStatus(`Anuncios: ${lastRows.length} | zoom ${z} | modo=${f.mode}`);
  }

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
    }, 250);
  }

  // Geocoding city (solo para centrar en city inicial)
  async function geocodeCity(city) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  }

  // Texto "Comunidad / Ciudad / Zona" según mapa (reverse geocode)
  let areaDebounce = null;
  async function reverseGeocodeCenter(){
    const c = map.getCenter();
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(c.lat)}&lon=${encodeURIComponent(c.lng)}&zoom=12&addressdetails=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};

    // Construcción del texto:
    // Comunidad Autónoma / Ciudad / Zona
    // Nominatim puede variar; esto es una heurística.
    const region =
      addr.state || addr.region || addr.county || addr.province || "";
    const city =
      addr.city || addr.town || addr.village || addr.municipality || "";
    const zone =
      addr.suburb || addr.neighbourhood || addr.city_district || addr.hamlet || "";

    const parts = [region, city, zone].map(s => String(s || "").trim()).filter(Boolean);
    return parts.length ? parts.join(" / ") : null;
  }

  function scheduleAreaTextUpdate(){
    if (!areaTextEl) return;
    if (areaDebounce) clearTimeout(areaDebounce);
    areaDebounce = setTimeout(async () => {
      try {
        const txt = await reverseGeocodeCenter();
        if (txt) areaTextEl.textContent = txt;
      } catch {
        // no pasa nada si falla
      }
    }, 450);
  }

  // Cuando cambie el filtro o el mapa, actualiza área y recarga
  map.on("moveend", () => {
    scheduleReload();
    scheduleAreaTextUpdate();
  });
  map.on("zoomend", () => {
    scheduleReload();
    scheduleAreaTextUpdate();
  });

  window.addEventListener("bh:filters-changed", () => {
    scheduleReload();
  });

  // Fix de layout: si ocultas/mostrar columnas, Leaflet necesita invalidateSize
  function safeInvalidate(){
    try { map.invalidateSize(true); } catch {}
  }
  window.addEventListener("bh:layout-resize", () => {
    requestAnimationFrame(() => safeInvalidate());
    setTimeout(() => safeInvalidate(), 80);
  });

  // Sol (tu control)
  const ZOOM_SOL_MIN = 14;
  let sunEnabled = false;
  const sunState = { dateISO: null, minutes: null, sunriseMin: null, sunsetMin: null };

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours()*60 + d.getMinutes();
  }

  function minutesToHHMM(mins) {
    const h = Math.floor(mins/60);
    const m = mins % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }

  function rad2deg(r){ return r * 180 / Math.PI; }

  function sunBearingAndAltDeg(lat, lng, dateObj){
    const pos = SunCalc.getPosition(dateObj, lat, lng);
    const azDeg = rad2deg(pos.azimuth);
    const bearingDeg = (180 + azDeg + 360) % 360;
    const altDeg = rad2deg(pos.altitude);
    return { bearingDeg, altDeg };
  }

  function bearingToCardinal(deg){
    const dirs = ["N","NE","E","SE","S","SO","O","NO"];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  }

  function buildDateObj(iso, minutes) {
    const [y,m,d] = iso.split("-").map(x => parseInt(x,10));
    const hh = Math.floor(minutes/60);
    const mm = minutes % 60;
    return new Date(y, (m-1), d, hh, mm, 0, 0);
  }

  function svgClear(el){ while (el.firstChild) el.removeChild(el.firstChild); }
  function svgEl(name, attrs){
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (attrs) for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  function polarXY(cx, cy, R, bearingDeg, altDeg){
    const a = Math.max(0, Math.min(90, Math.abs(altDeg)));
    const r = ((90 - a) / 90) * R;
    const t = bearingDeg * Math.PI / 180;
    const x = cx + r * Math.sin(t);
    const y = cy - r * Math.cos(t);
    return { x, y };
  }

  function arcPath(cx, cy, r, a0Deg, a1Deg){
    const a0 = (a0Deg - 90) * Math.PI/180;
    const a1 = (a1Deg - 90) * Math.PI/180;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    let da = ((a1Deg - a0Deg) % 360 + 360) % 360;
    const large = da > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function drawSunPolar(svg, centerLatLng, dateISO, minutes){
    const V = 1120;
    const cx = V/2;
    const cy = V/2;
    const R = 450;

    svg.setAttribute("viewBox", `0 0 ${V} ${V}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgClear(svg);

    svg.appendChild(svgEl("circle", {
      cx, cy, r: R,
      fill: "rgba(255,255,255,0.00)",
      stroke: "rgba(0,0,0,0.35)",
      "stroke-width": "3"
    }));

    const axes = [
      { a:0,   label:"N", x: cx,          y: cy - R - 22, anchor:"middle" },
      { a:90,  label:"E", x: cx + R + 22, y: cy + 12,     anchor:"start"  },
      { a:180, label:"S", x: cx,          y: cy + R + 42, anchor:"middle" },
      { a:270, label:"O", x: cx - R - 22, y: cy + 12,     anchor:"end"    },
    ];

    [0,90,180,270].forEach(a=>{
      const p = polarXY(cx, cy, R, a, 0);
      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: p.x, y2: p.y,
        stroke: "rgba(0,0,0,0.20)",
        "stroke-width": "2"
      }));
    });

    axes.forEach(o=>{
      const t = svgEl("text", {
        x: o.x,
        y: o.y,
        "text-anchor": o.anchor,
        "font-size": "34",
        fill: "rgba(0,0,0,0.45)"
      });
      t.textContent = o.label;
      svg.appendChild(t);
    });

    const dayNoon = buildDateObj(dateISO, 12*60);
    const times = SunCalc.getTimes(dayNoon, centerLatLng.lat, centerLatLng.lng);
    const sunrise = times.sunrise;
    const sunset = times.sunset;

    let haveSunTimes = false;
    let sunriseBearing = null;
    let sunsetBearing = null;

    if (sunrise instanceof Date && !isNaN(sunrise.getTime()) && sunset instanceof Date && !isNaN(sunset.getTime())) {
      const sr = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, sunrise);
      const ss = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, sunset);

      sunriseBearing = sr.bearingDeg;
      sunsetBearing = ss.bearingDeg;
      haveSunTimes = true;

      const d1 = arcPath(cx, cy, R, sunriseBearing, sunsetBearing);

      svg.appendChild(svgEl("path", {
        d: `${d1} L ${cx} ${cy} Z`,
        fill: "rgba(255, 196, 50, 0.14)",
        stroke: "none"
      }));

      svg.appendChild(svgEl("path", {
        d: d1,
        fill: "none",
        stroke: "rgba(255, 140, 0, 0.65)",
        "stroke-width": "6",
        "stroke-linecap": "round"
      }));
    }

    const curDate = buildDateObj(dateISO, minutes);
    const cur = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, curDate);
    const meta = { isDay: cur.altDeg > 0, bearingDeg: cur.bearingDeg, altDeg: cur.altDeg };

    const p = polarXY(cx, cy, R, cur.bearingDeg, cur.altDeg);

    svg.appendChild(svgEl("line", {
      x1: cx, y1: cy, x2: p.x, y2: p.y,
      stroke: "rgba(255, 196, 50, 0.86)",
      "stroke-width": "8",
      "stroke-linecap": "round"
    }));

    svg.appendChild(svgEl("circle", {
      cx: p.x, cy: p.y, r: 20,
      fill: meta.isDay ? "rgba(255, 120, 60, 0.95)" : "rgba(165,165,165,0.86)",
      stroke: "rgba(255, 196, 50, 0.98)",
      "stroke-width": "7"
    }));

    return meta;
  }

  function minutesOfDate(d){
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  }

  function updateDaylightBand(){
    const c = map.getCenter();
    const iso = sunState.dateISO || todayISO();
    const noon = buildDateObj(iso, 12*60);
    const times = SunCalc.getTimes(noon, c.lat, c.lng);

    const sr = minutesOfDate(times.sunrise);
    const ss = minutesOfDate(times.sunset);

    sunState.sunriseMin = sr;
    sunState.sunsetMin = ss;

    const srPct = (sr == null) ? 0 : Math.max(0, Math.min(100, (sr / 1439) * 100));
    const ssPct = (ss == null) ? 0 : Math.max(0, Math.min(100, (ss / 1439) * 100));

    sunTrackEl.style.setProperty("--sr", `${srPct.toFixed(3)}%`);
    sunTrackEl.style.setProperty("--ss", `${ssPct.toFixed(3)}%`);
  }

  function updateSunOverlay(){
    const ok = sunEnabled && map.getZoom() >= ZOOM_SOL_MIN;

    sunOverlayEl.style.display = ok ? "block" : "none";
    sunTimebarEl.style.display = ok ? "block" : "none";
    sunDateDockEl.style.display = ok ? "block" : "none";

    if (!ok) return;

    const c = map.getCenter();
    const iso = sunState.dateISO || todayISO();
    const mins = (sunState.minutes != null) ? sunState.minutes : nowMinutes();

    updateDaylightBand();

    const meta = drawSunPolar(sunPolarOverlaySvg, c, iso, mins);
    const card = bearingToCardinal(meta.bearingDeg);

    sunOverlayLabelEl.textContent = meta.isDay
      ? `${minutesToHHMM(mins)} · ${card} · ${Math.round(meta.bearingDeg)}° · alt ${Math.round(meta.altDeg)}°`
      : `${minutesToHHMM(mins)} · noche · ${card} · ${Math.round(meta.bearingDeg)}° · alt ${Math.round(meta.altDeg)}°`;
  }

  function setSunEnabled(next){
    sunEnabled = next;
    updateSunOverlay();
  }

  function initHoursRow(){
    const frag = document.createDocumentFragment();
    for (let h = 0; h < 24; h++) {
      const s = document.createElement("span");
      s.textContent = String(h).padStart(2,"0");
      frag.appendChild(s);
    }
    sunHoursRowEl.innerHTML = "";
    sunHoursRowEl.appendChild(frag);
  }

  function preventMapDragOn(el){
    el.addEventListener("mousedown", (e) => e.stopPropagation());
    el.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    el.addEventListener("click", (e) => e.stopPropagation());
  }

  initHoursRow();
  preventMapDragOn(sunTimebarEl);
  preventMapDragOn(sunDateDockEl);

  sunState.dateISO = todayISO();
  sunState.minutes = nowMinutes();

  sunDateEl.value = sunState.dateISO;
  sunRangeEl.value = String(sunState.minutes);

  sunRangeEl.addEventListener("input", () => {
    sunState.minutes = parseInt(sunRangeEl.value, 10);
    updateSunOverlay();
  });

  sunDateEl.addEventListener("change", () => {
    sunState.dateISO = sunDateEl.value || todayISO();
    updateSunOverlay();
  });

  sunNowBtn.addEventListener("click", () => {
    sunState.dateISO = todayISO();
    sunState.minutes = nowMinutes();
    sunDateEl.value = sunState.dateISO;
    sunRangeEl.value = String(sunState.minutes);
    updateSunOverlay();
  });

  // Botón de localización (nuevo) + botón sol
  const LocSunControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      // Localización (encima del sol)
      const locBtn = L.DomUtil.create("div", "qBtn", container);
      locBtn.title = "Mi ubicación";
      locBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 2v3"></path><path d="M12 19v3"></path>
          <path d="M2 12h3"></path><path d="M19 12h3"></path>
        </svg>
      `;

      locBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          alert("Tu navegador no permite geolocalización.");
          return;
        }
        setStatus("Buscando tu ubicación...");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 14);
            scheduleAreaTextUpdate();
            scheduleReload();
          },
          () => {
            setStatus("No se pudo obtener tu ubicación.");
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 20000 }
        );
      });

      // Sol
      const sunBtn = L.DomUtil.create("div", "qBtn", container);
      sunBtn.title = "Sol";
      sunBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path><path d="M12 20v2"></path>
          <path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path>
          <path d="M2 12h2"></path><path d="M20 12h2"></path>
          <path d="M4.93 19.07l1.41-1.41"></path><path d="M17.66 6.34l1.41-1.41"></path>
        </svg>
      `;

      function setBtnEnabled() {
        const ok = map.getZoom() >= ZOOM_SOL_MIN;
        sunBtn.classList.toggle("disabled", !ok);
        sunBtn.title = ok ? "Sol" : `Acércate para activar (zoom ${ZOOM_SOL_MIN}+)`;
        if (!ok && sunEnabled) {
          sunBtn.classList.remove("active");
          setSunEnabled(false);
        } else {
          updateSunOverlay();
        }
      }

      function forceOff(){
        if (sunEnabled) {
          sunEnabled = false;
          sunBtn.classList.remove("active");
          updateSunOverlay();
        }
      }

      sunBtn.addEventListener("click", () => {
        const ok = map.getZoom() >= ZOOM_SOL_MIN;
        if (!ok) return;

        if (areaState.isDrawing) cancelCurrentDrawing();

        const next = !sunEnabled;
        sunBtn.classList.toggle("active", next);
        setSunEnabled(next);
      });

      map.on("zoomend", setBtnEnabled);
      setBtnEnabled();

      areaState.sunBtnForceOff = forceOff;

      return container;
    }
  });

  map.addControl(new LocSunControl());

  map.on("moveend", () => { if (sunEnabled) updateSunOverlay(); });
  map.on("zoomend", () => { if (sunEnabled) updateSunOverlay(); });
  window.addEventListener("resize", () => { if (sunEnabled) updateSunOverlay(); });

  // Init
  (async function init(){
    try {
      if (initialParams.city) {
        const center = await geocodeCity(initialParams.city);
        if (center) map.setView(center, 13);
      }

      // Primera carga
      await loadPointsForCurrentView();
      scheduleAreaTextUpdate();

      // Asegurar render tras el primer layout
      safeInvalidate();
      setTimeout(() => safeInvalidate(), 200);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setStatus(`Error: ${msg}`);
      console.error(e);
    }
  })();
}