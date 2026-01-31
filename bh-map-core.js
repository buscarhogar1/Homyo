export function initMap(){
  const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

  const DEFAULT_CENTER = [37.9838, -1.1280];
  const DEFAULT_ZOOM = 13;

  const statusEl = document.getElementById("status");

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
  cardCloseBtn.addEventListener("click", closeCard);

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

  let map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  let markersLayer = L.layerGroup().addTo(map);
  let activeMarker = null;

  function clearMarkers() {
    markersLayer.clearLayers();
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

    m.on("click", () => {
      if (areaState.isDrawing) return;
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

  let freehandMoveHandler = null;
  let freehandUpHandler = null;
  let freehandLastSample = null;

  function startFreehand(e){
    if (!areaState.isDrawing || areaState.drawingMode !== "freehand") return;
    if (areaState.isFreehandActive) return;

    areaState.isFreehandActive = true;
    areaState.points = [];
    freehandLastSample = null;

    map.dragging.disable();

    const startLL = e.latlng;
    if (startLL) {
      areaState.points.push(startLL);
      freehandLastSample = { ll: startLL, t: Date.now() };
    }

    if (areaState.tempLine) { areasLayer.removeLayer(areaState.tempLine); areaState.tempLine = null; }
    if (areaState.tempLivePoly) { areasLayer.removeLayer(areaState.tempLivePoly); areaState.tempLivePoly = null; }

    areaState.tempLine = L.polyline([startLL], {
      color: "rgba(26,115,232,0.88)",
      weight: 3,
      opacity: 1
    }).addTo(areasLayer);

    freehandMoveHandler = (ev) => {
      if (!areaState.isFreehandActive) return;
      const ll = ev.latlng;
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
    };

    freehandUpHandler = () => {
      finishFreehand();
    };

    map.on("mousemove", freehandMoveHandler);
    map.on("mouseup", freehandUpHandler);

    map.on("touchmove", freehandMoveHandler);
    map.on("touchend", freehandUpHandler);
    map.on("touchcancel", freehandUpHandler);
  }

  function finishFreehand(){
    if (!areaState.isDrawing || areaState.drawingMode !== "freehand") return;

    map.off("mousemove", freehandMoveHandler);
    map.off("mouseup", freehandUpHandler);
    map.off("touchmove", freehandMoveHandler);
    map.off("touchend", freehandUpHandler);
    map.off("touchcancel", freehandUpHandler);

    freehandMoveHandler = null;
    freehandUpHandler = null;

    if (areaState.tempLine) { areasLayer.removeLayer(areaState.tempLine); areaState.tempLine = null; }

    map.dragging.enable();

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

  map.on("mousedown", (e) => {
    if (areaState.isDrawing && areaState.drawingMode === "freehand") {
      startFreehand(e);
    }
  });

  map.on("touchstart", (e) => {
    if (areaState.isDrawing && areaState.drawingMode === "freehand") {
      startFreehand(e);
    }
  });

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

    clearMarkers();
    filtered.forEach(addPoint);

    setStatus(`Anuncios: ${filtered.length} | zoom ${z} | modo=${f.mode}`);
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
    const consumed = handleMapClickForAreas(e);
    if (consumed) return;
    closeCard();
  });

  window.addEventListener("bh:filters-changed", () => {
    scheduleReload();
  });

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

      const srPt = polarXY(cx, cy, R, sunriseBearing, 0);
      const ssPt = polarXY(cx, cy, R, sunsetBearing, 0);

      const riseSetStroke = "rgba(255, 140, 0, 0.85)";

      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: srPt.x, y2: srPt.y,
        stroke: riseSetStroke,
        "stroke-width": "6",
        "stroke-linecap": "round"
      }));

      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: ssPt.x, y2: ssPt.y,
        stroke: riseSetStroke,
        "stroke-width": "6",
        "stroke-linecap": "round"
      }));

      [srPt, ssPt].forEach(pt=>{
        svg.appendChild(svgEl("circle", {
          cx: pt.x, cy: pt.y, r: 12,
          fill: "rgba(0,0,0,0.22)"
        }));
      });
    }

    const curDate = buildDateObj(dateISO, minutes);
    const cur = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, curDate);

    const meta = { isDay: cur.altDeg > 0, bearingDeg: cur.bearingDeg, altDeg: cur.altDeg };

    const sunR = Math.round(18 * 1.15);
    const sunStroke = Math.round(6 * 1.15);

    const sunRingYellow = "rgba(255, 196, 50, 0.98)";
    const sunLineYellow = "rgba(255, 196, 50, 0.86)";

    if (!meta.isDay && haveSunTimes) {
      const nextISO = addDaysISO(dateISO, 1);
      const nextNoon = buildDateObj(nextISO, 12*60);
      const timesNext = SunCalc.getTimes(nextNoon, centerLatLng.lat, centerLatLng.lng);
      const sunriseNext = timesNext.sunrise;

      if (sunset instanceof Date && sunriseNext instanceof Date && !isNaN(sunriseNext.getTime())) {
        const ptsN = [];
        const stepMin = 10;

        for (let tt = sunset.getTime(); tt <= sunriseNext.getTime(); tt += stepMin*60*1000) {
          const d = new Date(tt);
          const pa = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, d);
          if (pa.altDeg <= 0) ptsN.push(polarXY(cx, cy, R, pa.bearingDeg, pa.altDeg));
        }

        if (ptsN.length >= 2) {
          const dAttrN = ptsN.map((p,i)=> `${i===0?"M":"L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
          svg.appendChild(svgEl("path", {
            d: dAttrN,
            fill: "none",
            stroke: "rgba(140,140,140,0.55)",
            "stroke-width": "6",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }));
        }
      }
    }

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
  window.addEventListener("resize", () => { if (sunEnabled) updateSunOverlay(); });

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

  map.addControl(new AreasControl());

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
}
