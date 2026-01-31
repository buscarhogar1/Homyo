// bh-map-areas.js
(function () {
  window.BHMap = window.BHMap || {};
  const BHMap = window.BHMap;

  const map = BHMap.map;
  if (!map) return;

  const areaHintEl = document.getElementById("areaHint");
  const areaHintTextEl = document.getElementById("areaHintText");

  const MAX_AREAS = 5;

  const areasLayer = L.layerGroup().addTo(map);

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

    lastHint: ""
  };

  function setAreaHintVisible(visible, text){
    areaHintEl.style.display = visible ? "block" : "none";
    areaHintEl.setAttribute("aria-hidden", visible ? "false" : "true");
    if (typeof text === "string") {
      areaHintTextEl.textContent = text;
      areaState.lastHint = text;
    }
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
    if (BHMap.setMarkersVisible) BHMap.setMarkersVisible(true);
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

    if (!options.silentUI && areaState.refreshAreasUI) areaState.refreshAreasUI();
    if (BHMap.scheduleReload) BHMap.scheduleReload();
  }

  function removeAreasByType(type){
    const ids = areaState.polys.filter(a => a.type === type).map(a => a.id);
    ids.forEach(id => removeAreaById(id, { silentUI: true }));
    if (areaState.refreshAreasUI) areaState.refreshAreasUI();
    if (BHMap.scheduleReload) BHMap.scheduleReload();
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

    if (BHMap.sun && BHMap.sun.forceOff) BHMap.sun.forceOff();

    if (BHMap.card && BHMap.card.close) BHMap.card.close();
    clearTempDrawing();

    areaState.isDrawing = true;
    areaState.drawingMode = mode;
    if (BHMap.setMarkersVisible) BHMap.setMarkersVisible(false);

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
      if (BHMap.scheduleReload) BHMap.scheduleReload();
      return;
    }

    addAreaPolygon(pts, "points");

    cancelCurrentDrawing();
    if (BHMap.scheduleReload) BHMap.scheduleReload();
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
      if (BHMap.scheduleReload) BHMap.scheduleReload();
      return;
    }

    addAreaPolygon(simplifiedLL, "freehand");

    cancelCurrentDrawing();
    if (BHMap.scheduleReload) BHMap.scheduleReload();
  }

  function handleMapClick(e){
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

  BHMap.areas = {
    isDrawing: () => !!areaState.isDrawing,
    handleMapClick: handleMapClick,
    filterRows: (rows) => rows.filter(isInsideAnyArea),
    getLastHint: () => areaState.lastHint || "",
    cancelDrawing: cancelCurrentDrawing
  };
})();
