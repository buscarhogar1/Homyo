import { supabase } from "./bh-user-data.js";

/*
  bh-map-core.js

  Cambios implementados aquí:
  - Tarjeta del anuncio: ahora está dentro del mapa (posicionada respecto a #mapWrap).
  - Cerrar tarjeta deselecciona marcador.
  - Marcadores “vistos”: blanco con borde naranja (persistido en localStorage).
  - Hover en listado resalta marcador.
  - Click en listado abre directamente listing.html?id=...
  - Listado ordenable (fecha desc por defecto + tamaño asc/desc).
  - Botón de geolocalización (zoom 14) encima del botón “Sol”.
  - Etiqueta “Comunidad / Ciudad / Zona” se actualiza automáticamente al mover el mapa (reverse geocoding con Nominatim).
*/

export function initMap(){
  const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

  const DEFAULT_CENTER = [37.9838, -1.1280];
  const DEFAULT_ZOOM = 13;

  const statusEl = document.getElementById("status");
  const placeLabelEl = document.getElementById("placeLabel");

  const listItemsEl = document.getElementById("listItems");

  // Tarjeta dentro del mapa
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

  // Sol overlay
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

  // Áreas
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
  function closeCard() {
    cardEl.classList.remove("visible");
    // Pedido: cerrar tarjeta también deselecciona marcador
    deselectActiveMarker();
  }
  cardCloseBtn.addEventListener("click", closeCard);

  let heartOn = false;
  if (heartBtn) {
    heartBtn.addEventListener("click", () => {
      heartOn = !heartOn;
      heartBtn.style.borderColor = heartOn ? "rgba(26,115,232,0.55)" : "rgba(0,0,0,0.18)";
      heartBtn.style.boxShadow = heartOn ? "0 6px 18px rgba(26,115,232,0.18)" : "none";
    });
  }

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
  function iconBed() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v11"/><path d="M3 13h18v5"/><path d="M21 18v-4a3 3 0 0 0-3-3H8v2"/></svg>';
  }
  function iconBath() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2"/><path d="M3 12h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 20l-1 1"/><path d="M18 20l1 1"/></svg>';
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

  // Persistencia “visto”
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

  function saveSeenSet(set){
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }

  const seenSet = loadSeenSet();

  function markSeen(listingId){
    if (!listingId) return;
    const id = String(listingId);
    if (seenSet.has(id)) return;
    seenSet.add(id);
    saveSeenSet(seenSet);
    // Actualiza marcador si existe
    const m = markerById.get(id);
    if (m && m._icon) {
      const dot = m._icon.querySelector(".dot");
      if (dot && !dot.classList.contains("active")) dot.classList.add("seen");
    }
  }

  function openCardForPoint(p) {
    // Marcar visto al abrir card (pedido)
    markSeen(p.listing_id);

    cardAddrTopEl.textContent = buildAddressTop(p);
    cardAddrBottomEl.textContent = buildAddressBottom(p);

    cardAddrTopEl.href = `listing.html?id=${encodeURIComponent(p.listing_id)}`;

    cardPriceEl.textContent = (p.price_eur != null) ? euro(p.price_eur) : "—";

    setPhoto(p.main_photo_url || null);

    badgeNewEl.style.display = isRecent(p.listed_at, 14) ? "inline-flex" : "none";

    const m2 = (p.useful_area_m2 != null) ? `${p.useful_area_m2} m²` : "— m²";
    const beds = (p.bedrooms != null) ? `${p.bedrooms}` : "—";
    const baths = (p.bathrooms != null) ? `${p.bathrooms}` : "—";

    cardFactsEl.innerHTML = `
      <div class="fact">${iconArea()}<span>${m2} útiles</span></div>
      <div class="fact">${iconBed()}<span>${beds}</span></div>
      <div class="fact">${iconBath()}<span>${baths}</span></div>
    `;

    cardAgencyEl.textContent = p.agency_name || "—";
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

  const urlParamsForBadges = new URL(window.location.href).searchParams;
  const savedSearchIdForBadges = urlParamsForBadges.get("saved_search_id") || "";
  const sourceForBadges = urlParamsForBadges.get("source") || "";
  const hasSavedSearchBadgeContext = Boolean(savedSearchIdForBadges) && (
    sourceForBadges === "email_alert" ||
    sourceForBadges === "saved_search"
  );

  const newInSearchIds = new Set();

  async function loadNewInSearchIds(){
    newInSearchIds.clear();

    if (!hasSavedSearchBadgeContext) return;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    try {
      const { data, error } = await supabase
        .from("saved_search_matches")
        .select("listing_id")
        .eq("saved_search_id", savedSearchIdForBadges)
        .gte("matched_at", since);

      if (error) throw error;

      (data || []).forEach((row) => {
        if (row?.listing_id) newInSearchIds.add(String(row.listing_id));
      });
    } catch (e) {
      console.warn("No se pudieron cargar las etiquetas de búsqueda guardada", e);
    }
  }

  function getListingBadge(p){
    const id = String(p?.listing_id || "");

    if (hasSavedSearchBadgeContext && id && newInSearchIds.has(id)) {
      return { text: "Nuevo en tu búsqueda", type: "search" };
    }

    if (isRecent(p?.listed_at, 3)) {
      return { text: "Nuevo", type: "general" };
    }

    return null;
  }

  function createListBadge(p){
    const badge = getListingBadge(p);
    if (!badge) return null;

    const el = document.createElement("div");
    el.className = `listBadge listBadge-${badge.type}`;
    el.textContent = badge.text;
    return el;
  }

  // Extrae hasta `max` fotos adicionales (distintas de la principal) del punto,
  // tolerando varios nombres de campo posibles del backend.
  function getExtraPhotoUrls(p, max){
    const out = [];
    const main = p && p.main_photo_url;
    const push = (u) => {
      if (out.length >= max) return;
      if (typeof u === "string"){
        const v = u.trim();
        if (v && v !== main && !out.includes(v)) out.push(v);
      }
    };
    const arrays = [p.photo_urls, p.photos, p.gallery, p.gallery_urls, p.extra_photos, p.images, p.image_urls];
    for (const arr of arrays){
      if (Array.isArray(arr)){
        for (const item of arr){
          if (typeof item === "string") push(item);
          else if (item && typeof item === "object") push(item.url || item.src || item.photo_url);
        }
      }
    }
    [p.photo_2_url, p.photo_3_url, p.second_photo_url, p.third_photo_url].forEach(push);
    return out.slice(0, max);
  }

  function createListMediaWrap(p, img, ph){
    const mediaWrap = document.createElement("div");
    mediaWrap.className = "listMediaWrap";

    if (img) mediaWrap.appendChild(img);
    else mediaWrap.appendChild(ph);

    const badge = createListBadge(p);
    if (badge) mediaWrap.appendChild(badge);

    // Fila de dos miniaturas bajo la foto principal (rellena el hueco del lateral).
    const extras = getExtraPhotoUrls(p, 2);
    const thumbs = document.createElement("div");
    thumbs.className = "listThumbs";
    for (let i = 0; i < 2; i++){
      const url = extras[i];
      if (url){
        const t = document.createElement("img");
        t.className = "listThumb";
        t.src = url;
        t.alt = "";
        t.loading = "lazy";
        t.onerror = () => {
          const tph = document.createElement("div");
          tph.className = "listThumbPh";
          tph.textContent = "Foto";
          t.replaceWith(tph);
        };
        thumbs.appendChild(t);
      } else {
        const tph = document.createElement("div");
        tph.className = "listThumbPh";
        tph.textContent = "Foto";
        thumbs.appendChild(tph);
      }
    }
    mediaWrap.appendChild(thumbs);

    return mediaWrap;
  }

  let map = L.map("map", {
    zoomSnap: 0.25,   // permite niveles fraccionarios (13.25, 13.5, ...)
    zoomDelta: 0.75,  // cada clic en +/- mueve 0.75 niveles (entre medio y entero)
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  window.__bhMap = map;

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  let markersLayer = L.layerGroup().addTo(map);
  let activeMarker = null;

  // Relación listing_id -> marcador (para hover/selección)
  const markerById = new Map();

  function deselectActiveMarker(){
    if (activeMarker && activeMarker._icon) {
      const dot = activeMarker._icon.querySelector(".dot");
      dot?.classList.remove("active");
      // Si era visto, se queda en modo visto
      const id = activeMarker.options?.__listingId;
      if (id && seenSet.has(String(id))) dot?.classList.add("seen");
    }
    activeMarker = null;
  }

  function clearMarkers() {
    markersLayer.clearLayers();
    markerById.clear();
    activeMarker = null;
  }

  function addPoint(p) {
    if (p.lat == null || p.lng == null) return;

    const el = document.createElement("div");
    el.className = "dot";

    const idStr = String(p.listing_id || "");
    if (idStr && seenSet.has(idStr)) el.classList.add("seen");

    const icon = L.divIcon({
      className: "",
      html: el,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const m = L.marker([p.lat, p.lng], { icon }).addTo(markersLayer);
    m.options.__listingId = idStr;

    if (idStr) markerById.set(idStr, m);

    m.on("click", () => {
      if (areaState.isDrawing) return;

      // Selección visual
      deselectActiveMarker();
      activeMarker = m;

      const dot = m._icon?.querySelector(".dot");
      dot?.classList.add("active");
      dot?.classList.remove("seen"); // activo manda

      openCardForPoint(p);
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

  let debounceTimer = null;

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
    disableDrawLock();
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
      enableDrawLock();
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

  function simplifyRDP(points, epsilonPx){
    if (!points || points.length < 3) return points || [];
    const sqEps = epsilonPx * epsilonPx;

    function sqSegDist(p, a, b){
      let x = a.x, y = a.y;
      let dx = b.x - x;
      let dy = b.y - y;

      if (dx !== 0 || dy !== 0) {
        const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx*dx + dy*dy);
        if (t > 1) { x = b.x; y = b.y; }
        else if (t > 0) { x += dx * t; y += dy * t; }
      }

      dx = p.x - x;
      dy = p.y - y;
      return dx*dx + dy*dy;
    }

    function rdp(pts, first, last, out){
      let maxSqDist = sqEps;
      let index = -1;

      for (let i = first + 1; i < last; i++) {
        const sqD = sqSegDist(pts[i], pts[first], pts[last]);
        if (sqD > maxSqDist) {
          index = i;
          maxSqDist = sqD;
        }
      }

      if (index !== -1) {
        if (index - first > 1) rdp(pts, first, index, out);
        out.push(pts[index]);
        if (last - index > 1) rdp(pts, index, last, out);
      }
    }

    const out = [points[0]];
    rdp(points, 0, points.length - 1, out);
    out.push(points[points.length - 1]);
    return out;
  }

  function latlngsFromFreehand(rawLatLngs){
    if (!rawLatLngs || rawLatLngs.length < 3) return [];
    const zoom = map.getZoom();
    const proj = rawLatLngs.map(ll => {
      const p = map.project(ll, zoom);
      return { x: p.x, y: p.y, ll };
    });

    const simplified = simplifyRDP(proj, 3.0);
    const out = simplified.map(p => p.ll);

    if (out.length >= 3) {
      const first = out[0];
      const last = out[out.length - 1];
      const d = map.distance(first, last);
      if (d > 5) out.push(first);
    }

    const uniq = [];
    for (const ll of out) {
      const prev = uniq[uniq.length - 1];
      if (!prev) { uniq.push(ll); continue; }
      const dd = map.distance(prev, ll);
      if (dd >= 1) uniq.push(ll);
    }
    return uniq.length >= 3 ? uniq : [];
  }

  let freehandLastSample = null;
  let freehandBound = false;

  // Convierte un evento de ratón O táctil en latlng del mapa.
  function drawLatLngFromEvent(ev){
    let src = ev;
    if (ev.touches && ev.touches.length) src = ev.touches[0];
    else if (ev.changedTouches && ev.changedTouches.length) src = ev.changedTouches[0];
    if (!src || src.clientX == null) return null;
    try { return map.mouseEventToLatLng(src); } catch (err) { return null; }
  }

  // Bloquea el arrastre/zoom del mapa mientras el modo "dibujo libre" está activo.
  // En pantallas táctiles esto es lo que evita que el dedo mueva o haga zoom al
  // mapa: en su lugar el dedo dibuja el área.
  function enableDrawLock(){
    if (areaState._drawLocked) return;
    areaState._drawLocked = true;
    try { map.dragging.disable(); } catch (e) {}
    try { map.touchZoom.disable(); } catch (e) {}
    try { map.doubleClickZoom.disable(); } catch (e) {}
    try { map.boxZoom.disable(); } catch (e) {}
    if (map.tap) { try { map.tap.disable(); } catch (e) {} }
    map.getContainer().classList.add("bh-drawing");
  }

  function disableDrawLock(){
    if (!areaState._drawLocked) return;
    areaState._drawLocked = false;
    try { map.dragging.enable(); } catch (e) {}
    try { map.touchZoom.enable(); } catch (e) {}
    try { map.doubleClickZoom.enable(); } catch (e) {}
    try { map.boxZoom.enable(); } catch (e) {}
    if (map.tap) { try { map.tap.enable(); } catch (e) {} }
    map.getContainer().classList.remove("bh-drawing");
  }

  function freehandStart(ev){
    if (!areaState.isDrawing || areaState.drawingMode !== "freehand") return;
    if (areaState.isFreehandActive) return;

    const startLL = drawLatLngFromEvent(ev);
    if (!startLL) return;

    // Impide que el navegador haga scroll / pan / zoom al arrastrar el dedo.
    if (ev.cancelable) ev.preventDefault();

    areaState.isFreehandActive = true;
    areaState.points = [startLL];
    freehandLastSample = { ll: startLL, t: Date.now() };

    if (areaState.tempLine) { areasLayer.removeLayer(areaState.tempLine); areaState.tempLine = null; }
    if (areaState.tempLivePoly) { areasLayer.removeLayer(areaState.tempLivePoly); areaState.tempLivePoly = null; }

    areaState.tempLine = L.polyline([startLL], {
      color: "rgba(26,115,232,0.88)",
      weight: 3,
      opacity: 1
    }).addTo(areasLayer);
  }

  function freehandMove(ev){
    if (!areaState.isFreehandActive) return;
    // Mientras dibujamos, bloqueamos el gesto nativo en cada movimiento.
    if (ev.cancelable) ev.preventDefault();

    const ll = drawLatLngFromEvent(ev);
    if (!ll) return;

    const now = Date.now();
    const prev = freehandLastSample?.ll;

    let ok = true;
    if (freehandLastSample) {
      const dt = now - freehandLastSample.t;
      const dist = prev ? map.distance(prev, ll) : 999;
      ok = (dt >= 18) && (dist >= 2.0);
    }

    if (!ok) return;

    areaState.points.push(ll);
    freehandLastSample = { ll, t: now };
    if (areaState.tempLine) areaState.tempLine.addLatLng(ll);
  }

  function freehandEnd(ev){
    if (!areaState.isFreehandActive) return;
    if (ev && ev.cancelable) ev.preventDefault();
    finishFreehand();
  }

  // Listeners DOM nativos sobre el contenedor del mapa. Se enlazan una sola vez;
  // sólo actúan cuando estamos en modo "dibujo libre" (las funciones comprueban
  // el estado). Usar listeners nativos con { passive: false } nos permite llamar
  // a preventDefault() y así evitar el desplazamiento táctil de la página.
  function bindFreehandListeners(){
    if (freehandBound) return;
    freehandBound = true;
    const c = map.getContainer();
    c.addEventListener("mousedown", freehandStart);
    window.addEventListener("mousemove", freehandMove);
    window.addEventListener("mouseup", freehandEnd);
    c.addEventListener("touchstart", freehandStart, { passive: false });
    c.addEventListener("touchmove", freehandMove, { passive: false });
    c.addEventListener("touchend", freehandEnd, { passive: false });
    c.addEventListener("touchcancel", freehandEnd, { passive: false });
  }

  function finishFreehand(){
    if (!areaState.isDrawing || areaState.drawingMode !== "freehand") return;

    if (areaState.tempLine) { areasLayer.removeLayer(areaState.tempLine); areaState.tempLine = null; }

    const raw = areaState.points.slice();
    areaState.isFreehandActive = false;

    const simplifiedLL = latlngsFromFreehand(raw);

    const totalLen = (() => {
      let sum = 0;
      for (let i = 1; i < raw.length; i++) sum += map.distance(raw[i-1], raw[i]);
      return sum;
    })();

    if (!simplifiedLL || simplifiedLL.length < 3 || totalLen < 20) {
      cancelCurrentDrawing();
      scheduleReload();
      return;
    }

    addAreaPolygon(simplifiedLL, "freehand");

    cancelCurrentDrawing();
    scheduleReload();
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

  // Enlaza los listeners de dibujo libre (ratón + táctil) una sola vez.
  bindFreehandListeners();

  // Estado de resultados actuales (para listado)
  let currentRows = [];
  // Último conjunto de anuncios traído del servidor (sin filtrar por áreas),
  // para poder re-filtrar al vuelo cuando cambia el área de transporte.
  let lastFetchedRows = [];
  let lastViewInfo = { z: 0, mode: "" };

  function getListOrder(){
    return window.__bhListOrder || "date_desc";
  }

  function sortRows(rows){
    const order = getListOrder();
    const arr = rows.slice();

    function dateVal(r){
      const d = r.listed_at ? new Date(r.listed_at) : null;
      const t = d && !isNaN(d.getTime()) ? d.getTime() : 0;
      return t;
    }
    function sizeVal(r){
      const n = (r.useful_area_m2 != null) ? Number(r.useful_area_m2) : 0;
      return Number.isFinite(n) ? n : 0;
    }

    if (order === "size_asc") arr.sort((a,b)=> sizeVal(a) - sizeVal(b));
    else if (order === "size_desc") arr.sort((a,b)=> sizeVal(b) - sizeVal(a));
    else arr.sort((a,b)=> dateVal(b) - dateVal(a)); // date_desc por defecto

    return arr;
  }

  function renderList(){
    if (!listItemsEl) return;

    const rows = sortRows(currentRows);

    const frag = document.createDocumentFragment();
    listItemsEl.innerHTML = "";

    rows.forEach((p) => {
      const id = String(p.listing_id || "");

      const img = (p.main_photo_url)
        ? (() => {
            const i = document.createElement("img");
            i.className = "listImg";
            i.src = p.main_photo_url;
            i.alt = "";
            i.onerror = () => {
              i.replaceWith(ph);
            };
            return i;
          })()
        : null;

      const ph = document.createElement("div");
      ph.className = "listImgPh";
      ph.textContent = "Foto";

      const left = createListMediaWrap(p, img, ph);

      const title = document.createElement("div");
      title.className = "listTitle";
      title.textContent = buildAddressTop(p);

      const sub = document.createElement("div");
      sub.className = "listSub";
      sub.textContent = buildAddressBottom(p);

      const price = document.createElement("div");
      price.className = "listPrice";
      price.textContent = (p.price_eur != null) ? euro(p.price_eur) : "—";

      const meta = document.createElement("div");
      meta.className = "listMeta";
      const m2 = (p.useful_area_m2 != null) ? `${p.useful_area_m2} m²` : "— m²";
      const beds = (p.bedrooms != null) ? `${p.bedrooms}` : "—";
      const baths = (p.bathrooms != null) ? `${p.bathrooms}` : "—";
      meta.innerHTML = `<span class="listFact">${iconArea()}${m2}</span><span class="listFact">${iconBed()}${beds}</span><span class="listFact">${iconBath()}${baths}</span>`;

      const agency = document.createElement("div");
      agency.className = "listAgency";
      agency.textContent = p.agency_name || "—";

      const right = document.createElement("div");
      right.className = "listBody";
      right.appendChild(title);
      right.appendChild(sub);
      right.appendChild(price);
      right.appendChild(meta);
      right.appendChild(agency);

      const card = document.createElement("div");
      card.className = "listCard";
      card.appendChild(left);
      card.appendChild(right);

      // Hover: resalta marcador sin hacer click (pedido)
      card.addEventListener("mouseenter", () => {
        const m = markerById.get(id);
        if (m && m._icon) {
          const dot = m._icon.querySelector(".dot");
          dot?.classList.add("hover");
        }
      });
      card.addEventListener("mouseleave", () => {
        const m = markerById.get(id);
        if (m && m._icon) {
          const dot = m._icon.querySelector(".dot");
          dot?.classList.remove("hover");
        }
      });

      // Click: abrir ficha directamente (pedido)
      card.addEventListener("click", () => {
        markSeen(id);
        window.location.href = `listing.html?id=${encodeURIComponent(id)}`;
      });

      frag.appendChild(card);
    });

    listItemsEl.appendChild(frag);
  }

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
    lastFetchedRows = rows;
    lastViewInfo = { z, mode: f.mode };
    applyAreaFilterAndRender();
  }

  // Aplica TODOS los filtros geográficos (áreas dibujadas + área de transporte)
  // sobre el último conjunto de anuncios traído del servidor y vuelve a pintar
  // mapa + listado. Se puede invocar sin volver a consultar al servidor (p. ej.
  // al mover el punto de transporte o el slider de minutos).
  function applyAreaFilterAndRender() {
    const filtered = lastFetchedRows.filter(
      (p) => isInsideAnyArea(p) && isInsideTransportArea(p)
    );

    currentRows = filtered;

    clearMarkers();
    filtered.forEach(addPoint);

    renderList();

    const z = lastViewInfo.z, mode = lastViewInfo.mode;
    setStatus(`Anuncios: ${filtered.length} | zoom ${z} | modo=${mode}`);
  }

  function isMapHidden() {
    const g = document.querySelector(".grid3");
    return !!(g && g.classList.contains("hideMap"));
  }

  function scheduleReload() {
    // Si el mapa está oculto (listado extendido) su contenedor mide 0×0 y
    // getBounds() devuelve un área degenerada: refetch -> 0 resultados ->
    // se vaciaría el listado. Mantenemos los resultados actuales.
    if (isMapHidden()) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        await loadNewInSearchIds();
      await loadPointsForCurrentView();
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        setStatus(`Error: ${msg}`);
        console.error(e);
      }
    }, 300);
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  async function geocodeCity(city) {
    const normalized = normalizeSearchText(city);

    // Evita que Nominatim resuelva "Murcia" como zona periférica o punto turístico.
    // Centro urbano de Murcia.
    if (normalized === "murcia") {
      return [37.9922, -1.1307];
    }

    const structuredUrl =
      `https://nominatim.openstreetmap.org/search?format=json&city=${encodeURIComponent(city)}&country=España&countrycodes=es&limit=5`;

    try {
      const structuredRes = await fetch(structuredUrl, { headers: { "Accept": "application/json" } });
      if (structuredRes.ok) {
        const structuredData = await structuredRes.json();
        const bestStructured = (structuredData || []).find((item) => {
          const type = String(item.type || "").toLowerCase();
          const cls = String(item.class || "").toLowerCase();
          return cls === "boundary" || type === "city" || type === "town" || type === "municipality" || type === "administrative";
        }) || structuredData?.[0];

        if (bestStructured) {
          return [parseFloat(bestStructured.lat), parseFloat(bestStructured.lon)];
        }
      }
    } catch {}

    const fallbackUrl =
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ", España")}&countrycodes=es&limit=5`;

    const res = await fetch(fallbackUrl, { headers: { "Accept": "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    const best = (data || []).find((item) => {
      const type = String(item.type || "").toLowerCase();
      const cls = String(item.class || "").toLowerCase();
      return cls === "boundary" || type === "city" || type === "town" || type === "municipality" || type === "administrative";
    }) || data?.[0];

    if (!best) return null;
    return [parseFloat(best.lat), parseFloat(best.lon)];
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
    const consumed = handleMapClickForAreas(e);
    if (consumed) return;
    closeCard();
  });

  window.addEventListener("bh:filters-changed", () => {
    // cerrar tarjeta al cambiar filtros para evitar incoherencias visuales
    closeCard();
    scheduleReload();
  });

  // Si cambia el orden del listado: re-render (sin refetch)
  window.addEventListener("bh:list-order-changed", () => {
    renderList();
  });

  // Sol (tu implementación original, casi intacta)
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

  function addDaysISO(iso, deltaDays){
    const [y,m,d] = iso.split("-").map(x => parseInt(x,10));
    const dt = new Date(y, m-1, d, 12, 0, 0, 0);
    dt.setDate(dt.getDate() + deltaDays);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const dd = String(dt.getDate()).padStart(2,"0");
    return `${yy}-${mm}-${dd}`;
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

    if (sunrise instanceof Date && !isNaN(sunrise.getTime()) && sunset instanceof Date && !isNaN(sunset.getTime())) {
      const sr = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, sunrise);
      const ss = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, sunset);

      haveSunTimes = true;

      const d1 = arcPath(cx, cy, R, sr.bearingDeg, ss.bearingDeg);

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

    const sunR = Math.round(18 * 1.15);
    const sunStroke = Math.round(6 * 1.15);

    const sunRingYellow = "rgba(255, 196, 50, 0.98)";
    const sunLineYellow = "rgba(255, 196, 50, 0.86)";

    if (meta.isDay) {
      if (haveSunTimes) {
        const pts = [];
        const stepMin = 6;
        const start = sunrise.getTime();
        const end = sunset.getTime();
        for (let tt = start; tt <= end; tt += stepMin*60*1000) {
          const d = new Date(tt);
          const pa = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, d);
          if (pa.altDeg >= 0) pts.push(polarXY(cx, cy, R, pa.bearingDeg, pa.altDeg));
        }
        if (pts.length >= 2) {
          const dAttr = pts.map((p,i)=> `${i===0?"M":"L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
          svg.appendChild(svgEl("path", {
            d: dAttr,
            fill: "none",
            stroke: "rgba(255, 140, 0, 0.88)",
            "stroke-width": "8",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }));
        }
      }

      const p = polarXY(cx, cy, R, cur.bearingDeg, cur.altDeg);

      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: p.x, y2: p.y,
        stroke: sunLineYellow,
        "stroke-width": "8",
        "stroke-linecap": "round"
      }));

      svg.appendChild(svgEl("circle", {
        cx: p.x, cy: p.y, r: sunR,
        fill: "rgba(255, 120, 60, 0.95)",
        stroke: sunRingYellow,
        "stroke-width": String(sunStroke)
      }));
    } else {
      const p = polarXY(cx, cy, R, cur.bearingDeg, cur.altDeg);

      svg.appendChild(svgEl("circle", {
        cx: p.x, cy: p.y, r: sunR,
        fill: "rgba(165,165,165,0.86)",
        stroke: sunRingYellow,
        "stroke-width": String(sunStroke)
      }));
    }

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
    document.body.classList.toggle("sunActive", !!ok);

    if (!ok) return;

    const c = map.getCenter();
    const iso = sunState.dateISO || todayISO();
    const mins = (sunState.minutes != null) ? sunState.minutes : nowMinutes();

    updateDaylightBand();

    const meta = drawSunPolar(sunPolarOverlaySvg, c, iso, mins);

    const card = bearingToCardinal(meta.bearingDeg);
    if (meta.isDay) {
      sunOverlayLabelEl.textContent = `${minutesToHHMM(mins)} · ${card} · ${Math.round(meta.bearingDeg)}° · alt ${Math.round(meta.altDeg)}°`;
    } else {
      sunOverlayLabelEl.textContent = `${minutesToHHMM(mins)} · noche · ${card} · ${Math.round(meta.bearingDeg)}° · alt ${Math.round(meta.altDeg)}°`;
    }
  }

  function setSunEnabled(next){
    sunEnabled = next;
    updateSunOverlay();
  }

  function initHoursRow(){
    const frag = document.createDocumentFragment();
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    for (let h = 0; h < 24; h++) {
      const s = document.createElement("span");
      s.textContent = isMobile ? String(h) : String(h).padStart(2,"0");
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

  // NUEVO: botón geolocalización (encima del sol)
  const LocateControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const btn = L.DomUtil.create("div", "qBtn", container);
      btn.title = "Mi ubicación";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19s5.5-5 5.5-10A5.5 5.5 0 1 0 6.5 9c0 5 5.5 10 5.5 10z"></path>
          <circle cx="12" cy="9" r="2.1"></circle>
          <path d="M8 21.5h8"></path>
        </svg>
      `;

      btn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          alert("Tu navegador no permite geolocalización.");
          return;
        }
        setStatus("Obteniendo ubicación...");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 14);
            setStatus("Ubicación encontrada");
            scheduleReload();
          },
          (err) => {
            setStatus("No se pudo obtener la ubicación");
            console.error(err);
            alert("No se pudo obtener la ubicación. Revisa permisos del navegador.");
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });

      return container;
    }
  });

  map.addControl(new LocateControl());

  // NUEVO: botón de transporte (placeholder funcional, mismo lenguaje visual
  // que el resto de los controles laterales y a juego con el botón "Vehículo"
  // del index).
  const TransportControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const btn = L.DomUtil.create("div", "qBtn", container);
      btn.id = "transportBtn";
      btn.title = "Transporte";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="8"></circle>
          <circle cx="12" cy="12" r="2.2"></circle>
          <path d="M12 14.2V20"></path>
          <path d="M9.9 11l-6.8-2.4"></path>
          <path d="M14.1 11l6.8-2.4"></path>
        </svg>
      `;

      btn.addEventListener("click", () => {
        const next = !btn.classList.contains("active");
        btn.classList.toggle("active", next);
        try {
          window.dispatchEvent(new CustomEvent("bh:transport-toggle", { detail: { active: next } }));
        } catch {}
      });

      return container;
    }
  });

  map.addControl(new TransportControl());

  // ====== TRANSPORTE — área alcanzable (isócrona simulada) ======
  // Estima hasta dónde se llega en X minutos desde un punto, según el modo.
  // Sin API de rutas: radio = velocidad media · tiempo · factor de desvío real,
  // con un contorno orgánico (no un círculo perfecto) para que parezca creíble.
  const transportLayer = L.layerGroup().addTo(map);
  const transportBarEl = document.getElementById("transportBar");
  const tpRangeEl = document.getElementById("tpRange");
  const tpMinsValEl = document.getElementById("tpMinsVal");
  const tpHintEl = document.getElementById("tpHint");
  const tpModeBtns = transportBarEl
    ? Array.from(transportBarEl.querySelectorAll(".tpMode"))
    : [];

  const TP_MINUTES = [5, 10, 15, 30, 45];
  // Velocidades urbanas medias (km/h) puerta a puerta.
  const TP_MODES = {
    walk:    { label: "andando",   speed: 4.8 },
    transit: { label: "en público", speed: 18 },
    car:     { label: "en coche",  speed: 30 },
    bike:    { label: "en bici",   speed: 15 },
  };
  // Factor de desvío: las calles no van en línea recta, así que el alcance
  // real es menor que el radio teórico. El transporte público suma espera.
  const TP_DETOUR = { walk: 0.80, transit: 0.62, car: 0.74, bike: 0.78 };

  let transportEnabled = false;
  let transportMode = "walk";
  let transportMinsIdx = 2; // 15 min
  let transportOrigin = null;
  let transportPin = null;
  // Anillo (polígono) del área alcanzable actual, como [{lat,lng}], usado para
  // filtrar los anuncios igual que las áreas dibujadas a mano.
  let transportRing = null;

  // ¿El anuncio cae dentro del área de transporte? Si el transporte está
  // apagado o aún no hay anillo, no filtra (deja pasar todo).
  function isInsideTransportArea(p){
    if (!transportEnabled || !transportRing || transportRing.length < 3) return true;
    if (p.lat == null || p.lng == null) return false;
    return pointInPoly(p.lat, p.lng, transportRing);
  }

  // Re-filtra (sin reconsultar al servidor) los anuncios ya cargados cuando
  // cambia el área de transporte. Pequeño debounce para arrastres del punto y
  // del slider de minutos.
  let transportRefilterTimer = null;
  function scheduleTransportRefilter(){
    if (transportRefilterTimer) clearTimeout(transportRefilterTimer);
    transportRefilterTimer = setTimeout(() => {
      transportRefilterTimer = null;
      if (typeof applyAreaFilterAndRender === "function") applyAreaFilterAndRender();
    }, 90);
  }

  function tpHash(str){
    let h = 2166136261;
    for (let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295; // 0..1
  }

  function tpReachMeters(mode, mins){
    const v = TP_MODES[mode].speed;          // km/h
    const km = v * (mins / 60);               // distancia teórica
    return km * 1000 * (TP_DETOUR[mode] || 0.75);
  }

  // Contorno orgánico determinista: misma forma para un modo dado, solo escala
  // con los minutos. Así no "salta" al mover el slider.
  function tpIsoRing(origin, radiusM, mode){
    const N = 80;
    const latRad = origin.lat * Math.PI / 180;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(latRad);
    const s = tpHash(mode) * 6.283;
    const pts = [];
    for (let i = 0; i < N; i++){
      const a = (i / N) * Math.PI * 2;
      const n = 0.90
        + 0.10 * Math.sin(a * 3 + s)
        + 0.06 * Math.sin(a * 5 + s * 1.7)
        + 0.05 * Math.sin(a * 2 + s * 0.6);
      const r = radiusM * n;
      const dLat = (r * Math.cos(a)) / mPerDegLat;
      const dLng = (r * Math.sin(a)) / mPerDegLng;
      pts.push([origin.lat + dLat, origin.lng + dLng]);
    }
    return pts;
  }

  function tpDrawIso(){
    transportLayer.clearLayers();
    if (!transportEnabled || !transportOrigin) {
      transportRing = null;
      scheduleTransportRefilter();
      return;
    }
    const mins = TP_MINUTES[transportMinsIdx];
    const radiusM = tpReachMeters(transportMode, mins);
    const ring = tpIsoRing(transportOrigin, radiusM, transportMode);

    // Guarda el anillo como [{lat,lng}] para filtrar los anuncios.
    transportRing = ring.map((pt) => ({ lat: pt[0], lng: pt[1] }));
    scheduleTransportRefilter();

    // Halo exterior suave + relleno + borde nítido.
    L.polygon(ring, {
      className: "tpIso",
      color: "#8C1F2D",
      weight: 2,
      opacity: 0.85,
      fillColor: "#8C1F2D",
      fillOpacity: 0.12,
      smoothFactor: 1.2,
      interactive: false,
    }).addTo(transportLayer);
  }

  function tpEnsurePin(){
    if (transportPin) return;
    const icon = L.divIcon({
      className: "tpPin",
      html: "<span></span>",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    transportPin = L.marker(transportOrigin, {
      icon,
      draggable: true,
      zIndexOffset: 1200,
      keyboard: false,
    });
    const onMove = () => {
      transportOrigin = transportPin.getLatLng();
      tpDrawIso();
    };
    transportPin.on("drag", onMove);
    transportPin.on("dragend", onMove);
    transportPin.addTo(map);
  }

  function tpRemovePin(){
    if (transportPin){
      map.removeLayer(transportPin);
      transportPin = null;
    }
  }

  function tpUpdateBar(){
    if (tpMinsValEl) tpMinsValEl.textContent = String(TP_MINUTES[transportMinsIdx]);
    tpModeBtns.forEach((b) => {
      const on = b.dataset.mode === transportMode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (tpHintEl){
      tpHintEl.textContent = `Área alcanzable ${TP_MODES[transportMode].label} · arrastra el punto o toca el mapa`;
    }
  }

  function setTransportEnabled(next){
    transportEnabled = !!next;
    if (transportBarEl){
      transportBarEl.style.display = transportEnabled ? "block" : "none";
      transportBarEl.setAttribute("aria-hidden", transportEnabled ? "false" : "true");
    }
    const cont = map.getContainer();
    if (transportEnabled){
      // Exclusión mutua con el Sol (comparten zona inferior).
      if (areaState && typeof areaState.sunBtnForceOff === "function") areaState.sunBtnForceOff();
      if (!transportOrigin) transportOrigin = map.getCenter();
      tpEnsurePin();
      tpUpdateBar();
      tpDrawIso();
      cont.classList.add("tpPicking");
    } else {
      tpRemovePin();
      transportLayer.clearLayers();
      transportRing = null;
      scheduleTransportRefilter();
      cont.classList.remove("tpPicking");
    }
  }

  // Permite que el Sol apague el transporte al activarse.
  areaState.transportForceOff = function(){
    if (!transportEnabled) return;
    const b = document.getElementById("transportBtn");
    if (b) b.classList.remove("active");
    setTransportEnabled(false);
  };

  if (transportBarEl){
    preventMapDragOn(transportBarEl);
    tpModeBtns.forEach((b) => {
      b.addEventListener("click", () => {
        transportMode = b.dataset.mode || "walk";
        tpUpdateBar();
        tpDrawIso();
      });
    });
    if (tpRangeEl){
      tpRangeEl.addEventListener("input", () => {
        transportMinsIdx = Math.max(0, Math.min(TP_MINUTES.length - 1, parseInt(tpRangeEl.value, 10) || 0));
        tpUpdateBar();
        tpDrawIso();
      });
    }
  }

  // Clic en el mapa => fija el punto de salida (si no estamos dibujando un área).
  map.on("click", (e) => {
    if (!transportEnabled) return;
    if (areaState && (areaState.isDrawing || areaState.pointsActive || areaState.freehandActive)) return;
    transportOrigin = e.latlng;
    if (transportPin) transportPin.setLatLng(transportOrigin);
    tpDrawIso();
  });

  window.addEventListener("bh:transport-toggle", (e) => {
    setTransportEnabled(!!(e.detail && e.detail.active));
  });

  const SunControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const btn = L.DomUtil.create("div", "qBtn", container);
      btn.id = "sunBtn";
      btn.title = "Sol";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2.5 20h19"></path>
          <path d="M6 20a6 6 0 0 1 12 0"></path>
          <path d="M12 3v3"></path>
          <path d="M4 9l1.8 1.8"></path>
          <path d="M20 9l-1.8 1.8"></path>
        </svg>
      `;

      function setBtnEnabled() {
        const ok = map.getZoom() >= ZOOM_SOL_MIN;
        btn.classList.toggle("disabled", !ok);
        btn.title = ok ? "Sol" : `Acércate para activar (zoom ${ZOOM_SOL_MIN}+)`;
        if (!ok && sunEnabled) {
          btn.classList.remove("active");
          setSunEnabled(false);
        } else {
          updateSunOverlay();
        }
      }

      function forceOff(){
        if (sunEnabled) {
          sunEnabled = false;
          btn.classList.remove("active");
          updateSunOverlay();
        }
      }

      btn.addEventListener("click", () => {
        const ok = map.getZoom() >= ZOOM_SOL_MIN;
        if (!ok) return;

        if (areaState.isDrawing) cancelCurrentDrawing();

        const next = !sunEnabled;
        if (next && typeof areaState.transportForceOff === "function") areaState.transportForceOff();
        btn.classList.toggle("active", next);
        setSunEnabled(next);
      });

      map.on("zoomend", setBtnEnabled);
      setBtnEnabled();

      areaState.sunBtnForceOff = forceOff;

      return container;
    }
  });

  map.addControl(new SunControl());

  map.on("moveend", () => { if (sunEnabled) updateSunOverlay(); });
  map.on("zoomend", () => { if (sunEnabled) updateSunOverlay(); });
  window.addEventListener("resize", () => {
    initHoursRow();
    if (sunEnabled) updateSunOverlay();
  });

  // Cuando cambia layout (ocultar/mostrar columnas) Leaflet necesita invalidateSize
  function safeInvalidate(){
    // No invalidamos un mapa oculto: su contenedor mide 0×0 y disparar
    // invalidateSize provoca un moveend que recargaría el listado en vacío.
    if (isMapHidden()) return;
    // Guardamos el centro antes de redimensionar: invalidateSize ancla la
    // esquina superior-izquierda, así que al ensanchar/estrechar el mapa
    // (ocultar/mostrar filtros o listado) el centro visible se desplazaría.
    let prevCenter = null;
    try { prevCenter = map.getCenter(); } catch {}
    try { map.invalidateSize({ pan: false, animate: false }); } catch {}
    if (prevCenter) {
      try { map.setView(prevCenter, map.getZoom(), { animate: false }); } catch {}
    }
    if (sunEnabled) {
      try { updateSunOverlay(); } catch {}
    }
  }

  window.addEventListener("bh:layout-resize", () => {
    requestAnimationFrame(() => {
      safeInvalidate();
      setTimeout(() => safeInvalidate(), 120);
      setTimeout(() => safeInvalidate(), 260);
    });
  });

  const AreasControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const wrapPoints = L.DomUtil.create("div", "areaBtnWrap", container);

      const plusPoints = L.DomUtil.create("div", "qBtnSmall", wrapPoints);
      plusPoints.title = "Añadir área (punto a punto)";
      plusPoints.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14"></path><path d="M5 12h14"></path>
        </svg>
      `;

      const btnPoints = L.DomUtil.create("div", "qBtn", wrapPoints);
      btnPoints.title = "Área por puntos";
      btnPoints.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 8l6-4 8 5-3 8-9-1z"></path>
          <circle cx="5" cy="8" r="1.3"></circle>
          <circle cx="11" cy="4" r="1.3"></circle>
          <circle cx="19" cy="9" r="1.3"></circle>
          <circle cx="16" cy="17" r="1.3"></circle>
          <circle cx="7" cy="16" r="1.3"></circle>
        </svg>
      `;

      const wrapFree = L.DomUtil.create("div", "areaBtnWrap", container);

      const plusFree = L.DomUtil.create("div", "qBtnSmall", wrapFree);
      plusFree.title = "Añadir área (dibujo libre)";
      plusFree.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14"></path><path d="M5 12h14"></path>
        </svg>
      `;

      const btnFree = L.DomUtil.create("div", "qBtn", wrapFree);
      btnFree.title = "Área dibujo libre";
      btnFree.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 19l1.5-4L16 5.5l3 3L9.5 18z"></path>
          <path d="M14 7.5l3 3"></path>
        </svg>
      `;

      areaState.btnPointsEl = btnPoints;
      areaState.btnFreeEl = btnFree;
      areaState.btnPlusPointsEl = plusPoints;
      areaState.btnPlusFreeEl = plusFree;

      function hasAreasOfType(t){
        return areaState.polys.some(a => a.type === t);
      }

      function refreshPlusVisibility(){
        const full = areaState.polys.length >= MAX_AREAS;

        plusPoints.classList.toggle("disabled", full);
        plusFree.classList.toggle("disabled", full);

        plusPoints.style.display = (areaState.pointsActive && hasAreasOfType("points")) ? "grid" : "none";
        plusFree.style.display = (areaState.freehandActive && hasAreasOfType("freehand")) ? "grid" : "none";
      }

      function refreshButtons(){
        btnPoints.classList.toggle("active", areaState.pointsActive);
        btnFree.classList.toggle("active", areaState.freehandActive);
        refreshPlusVisibility();
      }

      areaState.refreshAreasUI = refreshButtons;

      function startPointsArea(){
        if (areaState.polys.length >= MAX_AREAS) return;
        if (!areaState.pointsActive) return;
        if (areaState.isDrawing) cancelCurrentDrawing();
        startNewAreaDrawing("points");
      }

      function startFreeArea(){
        if (areaState.polys.length >= MAX_AREAS) return;
        if (!areaState.freehandActive) return;
        if (areaState.isDrawing) cancelCurrentDrawing();
        startNewAreaDrawing("freehand");
      }

      function togglePoints(){
        const willOn = !areaState.pointsActive;
        areaState.pointsActive = willOn;

        if (!willOn) {
          if (areaState.isDrawing && areaState.drawingMode === "points") cancelCurrentDrawing();
          removeAreasByType("points");
          refreshButtons();
          return;
        }

        areaState.freehandActive = false;
        if (areaState.isDrawing && areaState.drawingMode === "freehand") cancelCurrentDrawing();

        refreshButtons();
        startPointsArea();
      }

      function toggleFree(){
        const willOn = !areaState.freehandActive;
        areaState.freehandActive = willOn;

        if (!willOn) {
          if (areaState.isDrawing && areaState.drawingMode === "freehand") cancelCurrentDrawing();
          removeAreasByType("freehand");
          refreshButtons();
          return;
        }

        areaState.pointsActive = false;
        if (areaState.isDrawing && areaState.drawingMode === "points") cancelCurrentDrawing();

        refreshButtons();
        startFreeArea();
      }

      btnPoints.addEventListener("click", togglePoints);
      btnFree.addEventListener("click", toggleFree);

      plusPoints.addEventListener("click", () => {
        if (plusPoints.classList.contains("disabled")) return;
        startPointsArea();
      });

      plusFree.addEventListener("click", () => {
        if (plusFree.classList.contains("disabled")) return;
        startFreeArea();
      });

      refreshButtons();
      return container;
    }
  });

  map.addControl(new AreasControl());

  // Etiqueta dinámica “Comunidad / Ciudad / Zona” según centro del mapa
  // (cache + throttle para no spamear Nominatim)
  const placeCache = new Map();
  let placeTimer = null;

  function formatPlace(address){
    const comunidad = address.state || address.region || address.county || "—";
    const ciudad = address.city || address.town || address.village || address.municipality || "—";
    return `${comunidad} / ${ciudad}`;
  }

  async function reverseGeocode(lat, lng){
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (placeCache.has(key)) return placeCache.get(key);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=14&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data && data.address ? formatPlace(data.address) : null;
    if (txt) placeCache.set(key, txt);
    return txt;
  }

  function schedulePlaceUpdate(){
    if (!placeLabelEl) return;
    if (placeTimer) clearTimeout(placeTimer);
    placeTimer = setTimeout(async () => {
      try{
        const c = map.getCenter();
        const txt = await reverseGeocode(c.lat, c.lng);
        if (txt) placeLabelEl.textContent = txt;
      } catch (e){
        // si falla, no rompemos nada
        console.warn("reverse geocode error", e);
      }
    }, 650);
  }

  map.on("moveend", schedulePlaceUpdate);
  map.on("zoomend", schedulePlaceUpdate);

  (async function init(){
    try {
      wireHeaderMiniSearch();
      wireHeaderNav();

      let initialCityCenter = null;

      // Coordenadas exactas si llegan desde una sugerencia del autocompletado del index.
      const _u = new URL(window.location.href);
      const _lat = parseFloat(_u.searchParams.get("lat"));
      const _lng = parseFloat(_u.searchParams.get("lng"));
      const _zoom = parseInt(_u.searchParams.get("zoom"), 10);
      let initialZoom = Number.isFinite(_zoom) ? Math.min(Math.max(_zoom, 6), 17) : 13;

      if (Number.isFinite(_lat) && Number.isFinite(_lng)) {
        initialCityCenter = [_lat, _lng];
        map.setView(initialCityCenter, initialZoom, { animate: false });
      } else if (initialParams.city) {
        initialCityCenter = await geocodeCity(initialParams.city);
        if (initialCityCenter) {
          map.setView(initialCityCenter, initialZoom, { animate: false });
        }
      }

      safeInvalidate();

      if (initialCityCenter) {
        map.setView(initialCityCenter, initialZoom, { animate: false });
      }

      await loadPointsForCurrentView();

      // etiqueta inicial
      schedulePlaceUpdate();

      // Segunda pasada por si el layout termina de ajustar, sin permitir desplazamientos automáticos
      setTimeout(() => {
        safeInvalidate();
        if (initialCityCenter) map.setView(initialCityCenter, initialZoom, { animate: false });
      }, 250);

      setTimeout(() => {
        safeInvalidate();
        if (initialCityCenter) map.setView(initialCityCenter, initialZoom, { animate: false });
      }, 600);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setStatus(`Error: ${msg}`);
      console.error(e);
    }
  })();
}
