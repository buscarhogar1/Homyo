// bh-map-core.js
// Mapa + listado + toggles + ordenación + controles Leaflet (sol, áreas, localización)

export function initMap(){
  const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

  const DEFAULT_CENTER = [37.9838, -1.1280];
  const DEFAULT_ZOOM = 13;

  // DOM principales
  const statusEl = document.getElementById("status");
  const listMount = document.getElementById("listMount");
  const areaCrumbEl = document.getElementById("areaCrumb");

  const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
  const toggleListBtn = document.getElementById("toggleListBtn");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  const sortWrap = document.getElementById("sortWrap");
  const sortBtn = document.getElementById("sortBtn");
  const sortMenu = document.getElementById("sortMenu");

  // Tarjeta seleccionada (dentro del mapa)
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

  // Sol
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

  // Hint áreas
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

  // Cerrar tarjeta: además deselecciona marcador activo (lo pide tu requisito)
  let activeMarker = null;
  function clearActiveMarker(){
    if (activeMarker && activeMarker._icon) {
      activeMarker._icon.querySelector(".dot")?.classList.remove("active");
    }
    activeMarker = null;
  }
  cardCloseBtn.addEventListener("click", () => {
    closeCard();
    clearActiveMarker();
  });

  // “Favorito” (MVP visual)
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

  // Vistos (localStorage)
  const SEEN_KEY = "bh_seen_listing_ids_v1";
  function loadSeen(){
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) return new Set(arr.map(String));
    } catch {}
    return new Set();
  }
  function saveSeen(set){
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set))); } catch {}
  }
  const seenSet = loadSeen();
  function markSeen(listingId){
    if (!listingId) return;
    const s = String(listingId);
    if (!seenSet.has(s)){
      seenSet.add(s);
      saveSeen(seenSet);
    }
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
    // Refrescar estilo del marcador (si existe)
    const m = markerById.get(String(p.listing_id));
    if (m && m._icon) {
      const dot = m._icon.querySelector(".dot");
      if (dot && !dot.classList.contains("active")) dot.classList.add("seen");
    }
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

  // Leer filtros desde URL (los escribe bh-map-filters.js)
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

      availability: toText(u.searchParams.get("availability")) || "available",

      usefulMin: toInt(u.searchParams.get("useful_min")),
      usefulMax: toInt(u.searchParams.get("useful_max")),

      builtMin: toInt(u.searchParams.get("built_min")),
      builtMax: toInt(u.searchParams.get("built_max")),

      outdoorType: toText(u.searchParams.get("outdoor_type")),

      bedroomsMode: toText(u.searchParams.get("bedrooms_mode")),
      bedroomsVal: toInt(u.searchParams.get("bedrooms_min")),

      bathroomsMin: toInt(u.searchParams.get("bathrooms_min")),

      energyChoice: toText(u.searchParams.get("energy")),

      orientations: toTextArray(u.searchParams.get("orientations")),

      buildPeriods: toTextArray(u.searchParams.get("build_periods")),

      parkingTypes: toTextArray(u.searchParams.get("parking")),
      storageTypes: toTextArray(u.searchParams.get("storage")),

      accessibility: toTextArray(u.searchParams.get("accessibility"))
    };
  }

  const initialParams = getParams();

  // Leaflet map
  const map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  window.__bhMap = map;

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  let markersLayer = L.layerGroup().addTo(map);
  const markerById = new Map(); // listing_id -> marker
  let currentRows = [];         // resultados actuales (para listado)

  function clearMarkers() {
    markersLayer.clearLayers();
    markerById.clear();
    clearActiveMarker();
  }

  // Crear marcador y conectar click
  function addPoint(p) {
    if (p.lat == null || p.lng == null) return;
    const listingId = String(p.listing_id || "");

    const elDot = document.createElement("div");
    elDot.className = "dot";

    // Si está visto, aplicar estilo (excepto si está activo)
    if (listingId && seenSet.has(listingId)) elDot.classList.add("seen");

    const icon = L.divIcon({
      className: "",
      html: elDot,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const m = L.marker([p.lat, p.lng], { icon }).addTo(markersLayer);
    if (listingId) markerById.set(listingId, m);

    m.on("click", () => {
      if (areaState.isDrawing) return;

      // desactivar anterior
      if (activeMarker && activeMarker._icon) {
        activeMarker._icon.querySelector(".dot")?.classList.remove("active");
      }

      activeMarker = m;
      m._icon.querySelector(".dot")?.classList.add("active");

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

  // RPC de supabase (mismo endpoint que ya usabas)
  async function rpcSearchMapPoints(bounds, filters) {
    // Regla dormitorios:
    // - eq: exactamente X
    // - gte: mínimo X
    // Como tu RPC anterior solo tenía p_bedrooms_min, añadimos p_bedrooms_mode.
    // Si tu función RPC no lo soporta todavía, ignora p_bedrooms_mode (no rompe el fetch).
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

      // construidos (puede ser null si room)
      p_built_min: filters.builtMin,
      p_built_max: filters.builtMax,

      p_outdoor_type: filters.outdoorType,
      p_orientations: filters.orientations,

      p_energy_choice: filters.energyChoice,

      p_build_periods: filters.buildPeriods,

      p_parking_types: filters.parkingTypes,
      p_storage_types: filters.storageTypes,

      p_accessibility: filters.accessibility,

      p_bedrooms_min: filters.bedroomsVal,
      p_bedrooms_mode: filters.bedroomsMode,  // nuevo (si RPC lo soporta)
      p_bathrooms_min: filters.bathroomsMin
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

  // Debounce recarga
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
    }, 250);
  }

  // Ordenación del listado (por defecto: fecha publicación más reciente arriba)
  let sortKey = "listed_at_desc";

  function sortRows(rows){
    const copy = rows.slice();

    const num = (x)=> (x == null ? null : Number(x));
    const dateMs = (iso)=> {
      const d = iso ? new Date(iso) : null;
      const t = d && !isNaN(d.getTime()) ? d.getTime() : null;
      return t;
    };

    copy.sort((a,b)=>{
      if (sortKey === "listed_at_desc") {
        const ta = dateMs(a.listed_at), tb = dateMs(b.listed_at);
        return (tb ?? -Infinity) - (ta ?? -Infinity);
      }
      if (sortKey === "listed_at_asc") {
        const ta = dateMs(a.listed_at), tb = dateMs(b.listed_at);
        return (ta ?? Infinity) - (tb ?? Infinity);
      }
      if (sortKey === "useful_asc") {
        return (num(a.useful_area_m2) ?? Infinity) - (num(b.useful_area_m2) ?? Infinity);
      }
      if (sortKey === "useful_desc") {
        return (num(b.useful_area_m2) ?? -Infinity) - (num(a.useful_area_m2) ?? -Infinity);
      }
      if (sortKey === "price_desc") {
        return (num(b.price_eur) ?? -Infinity) - (num(a.price_eur) ?? -Infinity);
      }
      if (sortKey === "price_asc") {
        return (num(a.price_eur) ?? Infinity) - (num(b.price_eur) ?? Infinity);
      }
      return 0;
    });

    return copy;
  }

  // Pintar listado lateral derecho
  function renderList(rows){
    if (!listMount) return;
    listMount.innerHTML = "";

    const sorted = sortRows(rows);

    const frag = document.createDocumentFragment();
    sorted.forEach(p=>{
      const id = String(p.listing_id || "");
      const title = buildAddressTop(p);
      const sub = buildAddressBottom(p);
      const price = (p.price_eur != null) ? euro(p.price_eur) : "—";
      const facts = `${p.useful_area_m2 ?? "—"} m² · ${p.property_type ?? "—"}`;
      const agency = p.agency_name || "—";

      const img = p.main_photo_url
        ? el("img",{class:"lImg", src:p.main_photo_url, alt:""})
        : el("div",{class:"lImgPh", text:"Foto"});

      const card = el("div",{class:"lCard","data-id":id},[
        el("div",{class:"lGrid"},[
          img,
          el("div",{},[
            el("div",{class:"lTitle", text:title}),
            el("div",{class:"lSub", text:sub}),
            el("div",{class:"lPrice", text:price}),
            el("div",{class:"lFacts", text:facts}),
            el("div",{class:"lAgency", text:agency}),
          ])
        ])
      ]);

      // Hover: resalta marcador (sin click)
      card.addEventListener("mouseenter", ()=>{
        const m = markerById.get(id);
        if (m && m._icon) m._icon.querySelector(".dot")?.classList.add("hovered");
      });
      card.addEventListener("mouseleave", ()=>{
        const m = markerById.get(id);
        if (m && m._icon) m._icon.querySelector(".dot")?.classList.remove("hovered");
      });

      // Click: abrir directamente la ficha
      card.addEventListener("click", ()=>{
        markSeen(id);
        window.location.href = `listing.html?id=${encodeURIComponent(id)}`;
      });

      frag.appendChild(card);
    });

    listMount.appendChild(frag);
  }

  // Cargar puntos
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

    currentRows = Array.isArray(rows) ? rows.slice() : [];

    clearMarkers();
    currentRows.forEach(addPoint);

    renderList(currentRows);

    setStatus(`Anuncios: ${currentRows.length} | zoom ${z} | modo=${f.mode}`);
  }

  // Geocoding ciudad inicial (si existe)
  async function geocodeCity(city) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  }

  // Breadcrumb “Comunidad / Ciudad / Zona” (simplificado sin APIs de pago)
  // - Comunidad: a partir de state (si viene)
  // - Ciudad: del query param city si existe; si no, de reverse geocode
  // - Zona: barrio / suburb (si viene)
  async function updateAreaCrumb(){
    if (!areaCrumbEl) return;
    const c = map.getCenter();
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(c.lat)}&lon=${encodeURIComponent(c.lng)}&zoom=14&addressdetails=1`;
    try{
      const res = await fetch(url);
      if (!res.ok) throw new Error("reverse fail");
      const data = await res.json();
      const a = data.address || {};
      const region = a.state || a.region || a.province || "—";
      const city = a.city || a.town || a.village || a.municipality || (getParams().city || "—");
      const zone = a.suburb || a.neighbourhood || a.quarter || a.hamlet || "—";
      areaCrumbEl.textContent = `${region} / ${city} / ${zone}`;
    } catch {
      const city = getParams().city || "—";
      areaCrumbEl.textContent = `— / ${city} / —`;
    }
  }

  // Toggling columnas + fix “mapa en blanco”
  function safeInvalidate(){
    try { map.invalidateSize(true); } catch {}
  }

  function notifyLayoutChange(){
    // Para evitar el “mapa en blanco”: invalidamos en 2 frames.
    requestAnimationFrame(()=>{
      safeInvalidate();
      requestAnimationFrame(()=> safeInvalidate());
    });
  }

  // Botón: ocultar/mostrar filtros (corregido)
  toggleFiltersBtn?.addEventListener("click", ()=>{
    const isHidden = document.body.classList.toggle("filtersHidden");
    toggleFiltersBtn.textContent = isHidden ? "Mostrar filtros" : "Ocultar filtros";
    notifyLayoutChange();
    scheduleReload();
  });

  // Botón: ocultar/mostrar listado (ya funcionaba)
  toggleListBtn?.addEventListener("click", ()=>{
    const isHidden = document.body.classList.toggle("listHidden");
    toggleListBtn.textContent = isHidden ? "Mostrar listado" : "Ocultar listado";
    notifyLayoutChange();
    scheduleReload();
  });

  // Botón: limpiar filtros global (mantiene disponibilidad)
  clearFiltersBtn?.addEventListener("click", ()=>{
    if (window.__bhFilters?.clearAllExceptAvailability) {
      window.__bhFilters.clearAllExceptAvailability();
    }
  });

  // Ordenar por: menú + opciones ampliadas
  function closeSortMenu(){
    sortMenu?.classList.remove("open");
    if (sortMenu) sortMenu.setAttribute("aria-hidden","true");
  }
  function openSortMenu(){
    if (!sortMenu) return;
    sortMenu.classList.add("open");
    sortMenu.setAttribute("aria-hidden","false");
  }
  sortBtn?.addEventListener("click", (e)=>{
    e.stopPropagation();
    if (sortMenu?.classList.contains("open")) closeSortMenu();
    else openSortMenu();
  });
  window.addEventListener("click", ()=> closeSortMenu());

  function buildSortMenu(){
    if (!sortMenu) return;
    sortMenu.innerHTML = "";

    const items = [
      { k:"listed_at_desc", t:"Fecha de publicación: más reciente a más antigua" },
      { k:"listed_at_asc",  t:"Fecha de publicación: más antigua a más reciente" },
      { k:"useful_asc",     t:"Tamaño: menor a mayor" },
      { k:"useful_desc",    t:"Tamaño: mayor a menor" },
      { k:"price_desc",     t:"Precio: mayor a menor" },
      { k:"price_asc",      t:"Precio: menor a mayor" },
    ];

    items.forEach(it=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sortOpt";
      b.textContent = it.t;
      b.addEventListener("click", ()=>{
        sortKey = it.k;
        closeSortMenu();
        renderList(currentRows);
      });
      sortMenu.appendChild(b);
    });
  }
  buildSortMenu();

  // El botón “Ordenar por” solo si listado visible (CSS ya lo oculta con .listHidden)
  // Aquí no hace falta más.

  // Eventos mapa -> recarga
  map.on("moveend", ()=>{ scheduleReload(); updateAreaCrumb(); });
  map.on("zoomend", ()=>{ scheduleReload(); updateAreaCrumb(); });

  // Cuando cambian filtros (evento emitido por bh-map-filters.js)
  window.addEventListener("bh:filters-changed", () => {
    scheduleReload();
  });

  // Mini search del header (si lo mantienes)
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

      setStatus("Buscando ciudad...");
      const center = await geocodeCity(city);
      if (center) map.setView(center, 13);
      scheduleReload();
      updateAreaCrumb();
    });
  }

  function wireHeaderNav(){
    const fav = document.getElementById("navFavoritos");
    const login = document.getElementById("navLogin");
    if (fav) fav.addEventListener("click", (e) => { e.preventDefault(); alert("MVP: Favoritos (requiere registro)."); });
    if (login) login.addEventListener("click", (e) => { e.preventDefault(); alert("MVP: Iniciar sesión."); });
  }

  // ---------------------------
  // CONTROLES: Sol + Áreas + Localización
  // ---------------------------

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
    if (areaState.tempLine) areaState.tempLine.addLatLng(latlng);

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
    clearActiveMarker();
  });

  // --- Sol (reutiliza tu implementación original, compactada) ---
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

  function drawSunPolar(svg, centerLatLng, dateISO, minutes){
    const V = 1120, cx = V/2, cy = V/2, R = 450;
    svg.setAttribute("viewBox", `0 0 ${V} ${V}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgClear(svg);

    svg.appendChild(svgEl("circle", { cx, cy, r: R, fill:"rgba(255,255,255,0)", stroke:"rgba(0,0,0,0.35)", "stroke-width":"3" }));

    [0,90,180,270].forEach(a=>{
      const p = polarXY(cx, cy, R, a, 0);
      svg.appendChild(svgEl("line", { x1:cx,y1:cy,x2:p.x,y2:p.y, stroke:"rgba(0,0,0,0.20)","stroke-width":"2" }));
    });

    const curDate = buildDateObj(dateISO, minutes);
    const cur = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, curDate);
    const meta = { isDay: cur.altDeg > 0, bearingDeg: cur.bearingDeg, altDeg: cur.altDeg };

    const p = polarXY(cx, cy, R, cur.bearingDeg, cur.altDeg);
    svg.appendChild(svgEl("line", { x1:cx,y1:cy,x2:p.x,y2:p.y, stroke:"rgba(255, 196, 50, 0.86)","stroke-width":"8","stroke-linecap":"round" }));
    svg.appendChild(svgEl("circle", { cx:p.x, cy:p.y, r: 20, fill: meta.isDay ? "rgba(255, 120, 60, 0.95)" : "rgba(165,165,165,0.86)", stroke:"rgba(255, 196, 50, 0.98)","stroke-width":"7" }));

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
    sunOverlayLabelEl.textContent = `${minutesToHHMM(mins)} · ${meta.isDay ? "día" : "noche"} · ${card} · ${Math.round(meta.bearingDeg)}° · alt ${Math.round(meta.altDeg)}°`;
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

  // Control: Localización (encima del sol)
  const LocationControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function(){
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const btn = L.DomUtil.create("div", "qBtn", container);
      btn.title = "Ir a mi ubicación";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v3"></path><path d="M12 19v3"></path>
          <path d="M2 12h3"></path><path d="M19 12h3"></path>
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 5a7 7 0 1 0 7 7"></path>
        </svg>
      `;

      btn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          alert("Tu navegador no permite geolocalización.");
          return;
        }
        setStatus("Localizando...");
        navigator.geolocation.getCurrentPosition(
          (pos)=>{
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat,lng], 14);
            scheduleReload();
            updateAreaCrumb();
          },
          ()=>{
            alert("No se pudo obtener tu ubicación.");
            scheduleReload();
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });

      return container;
    }
  });

  // Control: Sol
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
        btn.classList.toggle("disabled", !ok);
        btn.title = ok ? "Sol" : `Acércate para activar (zoom ${ZOOM_SOL_MIN}+)`;
        if (!ok && sunEnabled) {
          btn.classList.remove("active");
          sunEnabled = false;
          updateSunOverlay();
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
        btn.classList.toggle("active", next);
        sunEnabled = next;
        updateSunOverlay();
      });

      map.on("zoomend", setBtnEnabled);
      setBtnEnabled();

      areaState.sunBtnForceOff = forceOff;

      return container;
    }
  });

  // Control: Áreas
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2l4 8-4 12-4-12 4-8z"></path>
          <path d="M12 10l8 2-8 2-8-2 8-2z"></path>
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 17c3-6 6-6 9 0s6 6 9 0"></path>
          <path d="M3 7c3 6 6 6 9 0s6-6 9 0"></path>
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

  // Añadir controles en orden: Localización (arriba), Sol, Áreas
  map.addControl(new LocationControl());
  map.addControl(new SunControl());
  map.addControl(new AreasControl());

  // ---------------------------
  // Init
  // ---------------------------
  (async function init(){
    try {
      wireHeaderMiniSearch();
      wireHeaderNav();

      if (initialParams.city) {
        const center = await geocodeCity(initialParams.city);
        if (center) map.setView(center, 13);
      }

      // Primera carga
      await loadPointsForCurrentView();
      await updateAreaCrumb();

      // Fix de render inicial por si el layout tarda
      notifyLayoutChange();
      setTimeout(()=> notifyLayoutChange(), 250);
      setTimeout(()=> notifyLayoutChange(), 650);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setStatus(`Error: ${msg}`);
      console.error(e);
    }
  })();
}