/* =========================================================
   Buscar Hogar · bh-map-core.js (completo)

   Objetivos principales (lo que te fallaba):
   - Volver a cargar anuncios (arreglar “no detecta anuncios”)
   - Recuperar mapa “normal” (tiles correctos) e iconos correctos
   - Recuperar botón sol + botones de dibujar
   - Arreglar “Ocultar filtros”: no debe dejar mapa/listado en blanco
   - Periodo construcción por décadas y en la posición correcta
   - Outdoor space en español (Espacio exterior)
   - Ordenar por (incluye fecha asc/desc, precio asc/desc, tamaño asc/desc)
   - Botón “Ordenar por” solo visible si listado visible
   ========================================================= */

/* -----------------------------
   1) Supabase (URL + KEY)
   ----------------------------- */
const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

/* RPC que ya estabas usando: si tu función se llama distinto, aquí es donde se cambia */
const RPC_SEARCH = "search_map_points_filtered";

/* -----------------------------
   2) Helpers UI
   ----------------------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function setToast(msg, isError = false) {
  const el = $("#mapToast");
  el.textContent = msg;
  el.classList.remove("bh-hidden");
  el.style.borderColor = isError ? "#ffb3b3" : "#e7e7e7";
  el.style.color = isError ? "#b00000" : "#1b1b1b";
  clearTimeout(setToast._t);
  setToast._t = setTimeout(() => el.classList.add("bh-hidden"), 3500);
}

function fmtEur(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  try {
    return Number(n).toLocaleString("es-ES") + " €";
  } catch {
    return `${n} €`;
  }
}

function safeInt(v) {
  if (v == null) return null;
  const s = String(v).replace(/[^\d]/g, "");
  if (!s) return null;
  return parseInt(s, 10);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* -----------------------------
   3) Estado global
   ----------------------------- */
const state = {
  city: "",
  mode: "buy",

  filtersHidden: false,
  listHidden: false,

  // filtros
  priceMin: null,
  priceMax: null,
  listedFromDays: null,
  availability: "available", // por defecto “Disponible”
  usefulMin: null,
  usefulMax: null,
  builtMin: null,
  builtMax: null,
  outdoor: null,
  builtPeriods: [], // multi (rangos)

  // sort
  sort: "date_desc",

  // datos
  points: [],
  markersById: new Map(),
  selectedId: null,
  hoveredId: null,

  // vistos
  seen: new Set(),

  // áreas
  sunActive: false,
  pointsDrawActive: false,
  freeDrawActive: false,
  areasPoints: [], // polygons (latlng arrays)
  areasFree: [],
};

function loadSeen() {
  try {
    const raw = localStorage.getItem("bh_seen_ids");
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) arr.forEach((id) => state.seen.add(String(id)));
  } catch {}
}
function saveSeen() {
  try {
    localStorage.setItem("bh_seen_ids", JSON.stringify(Array.from(state.seen)));
  } catch {}
}

/* -----------------------------
   4) Map init
   ----------------------------- */
let map;
let tileLayer;
let markersLayer;
let sunLayerGroup;
let areasLayerGroup;
let drawTemp = {
  pts: [],
  ptMarkers: [],
  closeMarker: null,
  isDrawing: false
};

function initMap() {
  map = L.map("map", {
    zoomControl: true,
    preferCanvas: true,
  }).setView([37.9922, -1.1307], 12);

  // Tile layer “normal” (evita el “mapa de otro color” que te apareció)
  tileLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 20,
    }
  ).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  sunLayerGroup = L.layerGroup().addTo(map);
  areasLayerGroup = L.layerGroup().addTo(map);

  // Controles personalizados (localización + sol + dibujo)
  addRightControls();

  // Al mover el mapa: actualizar “Comunidad / Ciudad / Zona” y recargar puntos (debounced)
  map.on("moveend", () => {
    updateAreaTextFromMap();
    loadPointsForCurrentViewDebounced();
    if (state.sunActive) drawSunPath();
  });

  map.on("zoomend", () => {
    syncSunButtonEnabled();
    if (state.sunActive) drawSunPath();
  });

  // Cerrar menú ordenar al click fuera
  document.addEventListener("click", (e) => {
    const menu = $("#sortMenu");
    const wrap = $("#sortWrap");
    if (!wrap.contains(e.target)) menu.classList.add("bh-hidden");
  });

  // Init UI listeners
  initTopbar();
  initLayoutButtons();
  initFiltersUI();
  initSortUI();

  // Arranque
  syncSunButtonEnabled();
  updateAreaTextFromMap();
  loadPointsForCurrentView();
}

/* -----------------------------
   5) Topbar (Favoritos / Login / miniSearch)
   ----------------------------- */
function initTopbar() {
  $("#favLink").addEventListener("click", (e) => {
    e.preventDefault();
    alert("MVP: Favoritos (requiere registro).");
  });
  $("#loginLink").addEventListener("click", (e) => {
    e.preventDefault();
    alert("MVP: Login/registro se gestiona en index.html.");
  });

  // mini buscador: navega a map.html con city/mode manteniendo mode
  $("#miniSearchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = ($("#miniQ").value || "").trim();
    if (!q) return;
    const url = new URL(window.location.href);
    url.searchParams.set("city", q);
    url.searchParams.set("mode", state.mode);
    window.location.href = url.toString();
  });

  // Leer params de URL
  const sp = new URLSearchParams(window.location.search);
  state.city = (sp.get("city") || "").trim();
  state.mode = (sp.get("mode") || "buy").trim();
  $("#miniQ").value = state.city || "";

  // Si no viene city, no bloqueamos: igual carga por viewport
}

/* -----------------------------
   6) Layout: ocultar/mostrar columnas (SIN romper Leaflet)
   ----------------------------- */
function initLayoutButtons() {
  const mapShell = $("#mapShell");
  const topRow = $("#topRow");
  const filtersCol = $("#filtersCol");
  const listCol = $("#listCol");

  const toggleFiltersBtn = $("#toggleFiltersBtn");
  const toggleListBtn = $("#toggleListBtn");

  function applyLayoutClasses() {
    mapShell.classList.toggle("filters-hidden", state.filtersHidden);
    mapShell.classList.toggle("list-hidden", state.listHidden);
    topRow.classList.toggle("filters-hidden", state.filtersHidden);
    topRow.classList.toggle("list-hidden", state.listHidden);

    filtersCol.classList.toggle("is-collapsed", state.filtersHidden);
    listCol.classList.toggle("is-collapsed", state.listHidden);

    toggleFiltersBtn.textContent = state.filtersHidden ? "Mostrar filtros" : "Ocultar filtros";
    toggleListBtn.textContent = state.listHidden ? "Mostrar listado" : "Ocultar listado";

    // “Ordenar por” solo si el listado está visible
    $("#sortWrap").classList.toggle("bh-hidden", state.listHidden);

    // Lo importante: Leaflet necesita invalidateSize cuando cambia el layout
    // Hacemos 2 invalidaciones: inmediata + tras un frame.
    requestAnimationFrame(() => map.invalidateSize(true));
    setTimeout(() => map.invalidateSize(true), 120);
  }

  toggleFiltersBtn.addEventListener("click", () => {
    state.filtersHidden = !state.filtersHidden;
    applyLayoutClasses();
  });

  toggleListBtn.addEventListener("click", () => {
    state.listHidden = !state.listHidden;
    applyLayoutClasses();
  });

  // Inicial
  applyLayoutClasses();

  // Si el usuario redimensiona ventana
  window.addEventListener("resize", debounce(() => map.invalidateSize(true), 120));
}

/* -----------------------------
   7) Filtros (según definición)
   ----------------------------- */
function initFiltersUI() {
  loadSeen();

  // Disponibilidad: por defecto “Disponible” y NO se borra con “Limpiar filtros”
  $("#availability").value = "available";

  // Periodo construcción por décadas (como pediste)
  buildConstructionPeriods();

  // Sugerencias numéricas (se muestran al escribir con datalist)
  setupNumericSuggestions();

  // Asociar datalist a inputs (para que el navegador muestre sugerencias)
  $("#priceMin").setAttribute("list", "dlPriceMin");
  $("#priceMax").setAttribute("list", "dlPriceMax");
  $("#usefulMin").setAttribute("list", "dlUsefulMin");
  $("#usefulMax").setAttribute("list", "dlUsefulMax");
  $("#builtMin").setAttribute("list", "dlBuiltMin");
  $("#builtMax").setAttribute("list", "dlBuiltMax");

  // Listeners filtros
  const onAnyFilterChange = debounce(() => {
    normalizeMinMax();
    updateAppliedStates();
    loadPointsForCurrentView();
  }, 220);

  $("#priceMin").addEventListener("input", onAnyFilterChange);
  $("#priceMax").addEventListener("input", onAnyFilterChange);
  $("#usefulMin").addEventListener("input", onAnyFilterChange);
  $("#usefulMax").addEventListener("input", onAnyFilterChange);
  $("#builtMin").addEventListener("input", onAnyFilterChange);
  $("#builtMax").addEventListener("input", onAnyFilterChange);

  $("#availability").addEventListener("change", () => {
    state.availability = $("#availability").value;
    updateAppliedStates();
    loadPointsForCurrentView();
  });

  // Ofertado desde
  $$("#listedFrom input[type=radio]").forEach((r) => {
    r.addEventListener("change", () => {
      const v = $$("#listedFrom input[type=radio]").find(x => x.checked)?.value || "";
      state.listedFromDays = v ? parseInt(v, 10) : null;
      updateAppliedStates();
      loadPointsForCurrentView();
    });
  });

  // Outdoor
  $$("#outdoorSpace input[type=radio]").forEach((r) => {
    r.addEventListener("change", () => {
      const v = $$("#outdoorSpace input[type=radio]").find(x => x.checked)?.value || "";
      state.outdoor = v || null;
      updateAppliedStates();
      loadPointsForCurrentView();
    });
  });

  // Periodo construcción (multi)
  $("#builtPeriodList").addEventListener("change", () => {
    const checked = $$("#builtPeriodList input[type=checkbox]:checked").map(cb => cb.value);
    state.builtPeriods = checked;
    updateAppliedStates();
    loadPointsForCurrentView();
  });

  // Botón “Limpiar filtros”
  $("#clearFiltersBtn").addEventListener("click", () => {
    // OJO: disponibilidad NO se resetea (se queda como esté; por defecto Disponible)
    $("#priceMin").value = "";
    $("#priceMax").value = "";
    $("#usefulMin").value = "";
    $("#usefulMax").value = "";
    $("#builtMin").value = "";
    $("#builtMax").value = "";

    // radios a sin preferencia
    $$("#listedFrom input[type=radio]").forEach(r => r.checked = (r.value === ""));
    $$("#outdoorSpace input[type=radio]").forEach(r => r.checked = (r.value === ""));

    // periodo construcción
    $$("#builtPeriodList input[type=checkbox]").forEach(cb => cb.checked = false);

    // estado interno
    state.priceMin = null;
    state.priceMax = null;
    state.usefulMin = null;
    state.usefulMax = null;
    state.builtMin = null;
    state.builtMax = null;
    state.listedFromDays = null;
    state.outdoor = null;
    state.builtPeriods = [];

    updateAppliedStates();
    loadPointsForCurrentView();
  });

  // “X” por filtro
  $$(".bh-clearOne").forEach(btn => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-clear");

      if (k === "price") { $("#priceMin").value = ""; $("#priceMax").value = ""; state.priceMin = null; state.priceMax = null; }
      if (k === "useful") { $("#usefulMin").value = ""; $("#usefulMax").value = ""; state.usefulMin = null; state.usefulMax = null; }
      if (k === "built") { $("#builtMin").value = ""; $("#builtMax").value = ""; state.builtMin = null; state.builtMax = null; }
      if (k === "listed") { $$("#listedFrom input[type=radio]").forEach(r => r.checked = (r.value === "")); state.listedFromDays = null; }
      if (k === "outdoor") { $$("#outdoorSpace input[type=radio]").forEach(r => r.checked = (r.value === "")); state.outdoor = null; }
      if (k === "builtPeriod") { $$("#builtPeriodList input[type=checkbox]").forEach(cb => cb.checked = false); state.builtPeriods = []; }

      // Disponibilidad: no la “limpio” por X si quieres que siempre sea visible; pero si lo quieres, lo activamos.
      if (k === "availability") {
        // No lo reseteo a vacío: lo dejo en “Disponible” como regla base.
        $("#availability").value = "available";
        state.availability = "available";
      }

      normalizeMinMax();
      updateAppliedStates();
      loadPointsForCurrentView();
    });
  });

  // Estado inicial aplicado
  state.availability = "available";
  updateAppliedStates();
}

/* Construcción por décadas: antes de 1950, 1950-1960 ... 2020+ */
function buildConstructionPeriods() {
  const host = $("#builtPeriodList");
  host.innerHTML = "";

  const opts = [];
  opts.push({ id: "lt1950", label: "Antes de 1950" });
  for (let y = 1950; y <= 2010; y += 10) {
    opts.push({ id: `${y}-${y+10}`, label: `${y}-${y+10}` });
  }
  opts.push({ id: "2020+", label: "2020+" });

  for (const o of opts) {
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="checkbox" value="${o.id}"> ${o.label}`;
    host.appendChild(lab);
  }
}

/* datalist con sugerencias: se actualiza según mode (compra/alquiler) si lo quieres */
function setupNumericSuggestions() {
  // Precio: escalones redondos. Para buy hasta 2M; para rent hasta 3k.
  const isRent = (state.mode === "rent");
  const maxPrice = isRent ? 3000 : 2000000;

  const priceSteps = [];
  if (isRent) {
    [300,400,500,600,700,800,900,1000,1200,1400,1600,1800,2000,2500,3000].forEach(v => priceSteps.push(v));
  } else {
    [50000,75000,100000,125000,150000,175000,200000,250000,300000,350000,400000,500000,600000,750000,900000,1000000,1250000,1500000,1750000,2000000].forEach(v => priceSteps.push(v));
  }

  fillDatalist("dlPriceMin", priceSteps);
  fillDatalist("dlPriceMax", priceSteps);

  // Útil: según definición
  const useful = [30,40,50,60,75,90,100,110,130,150,200];
  fillDatalist("dlUsefulMin", useful);
  fillDatalist("dlUsefulMax", useful);

  // Construida: dejamos parecido a útil, pero un poco más alto
  const built = [40,50,60,75,90,100,110,130,150,175,200,250,300];
  fillDatalist("dlBuiltMin", built);
  fillDatalist("dlBuiltMax", built);
}

function fillDatalist(id, arr) {
  const dl = $("#" + id);
  dl.innerHTML = "";
  arr.forEach(v => {
    const opt = document.createElement("option");
    opt.value = String(v);
    dl.appendChild(opt);
  });
}

/* Intercambio automático si min > max */
function normalizeMinMax() {
  const pMin = safeInt($("#priceMin").value);
  const pMax = safeInt($("#priceMax").value);
  const uMin = safeInt($("#usefulMin").value);
  const uMax = safeInt($("#usefulMax").value);
  const bMin = safeInt($("#builtMin").value);
  const bMax = safeInt($("#builtMax").value);

  let _pMin = pMin, _pMax = pMax;
  if (_pMin != null && _pMax != null && _pMin > _pMax) { const t = _pMin; _pMin = _pMax; _pMax = t; }
  let _uMin = uMin, _uMax = uMax;
  if (_uMin != null && _uMax != null && _uMin > _uMax) { const t = _uMin; _uMin = _uMax; _uMax = t; }
  let _bMin = bMin, _bMax = bMax;
  if (_bMin != null && _bMax != null && _bMin > _bMax) { const t = _bMin; _bMin = _bMax; _bMax = t; }

  // Escribir de vuelta (solo si se cambió)
  if (pMin !== _pMin) $("#priceMin").value = _pMin ?? "";
  if (pMax !== _pMax) $("#priceMax").value = _pMax ?? "";
  if (uMin !== _uMin) $("#usefulMin").value = _uMin ?? "";
  if (uMax !== _uMax) $("#usefulMax").value = _uMax ?? "";
  if (bMin !== _bMin) $("#builtMin").value = _bMin ?? "";
  if (bMax !== _bMax) $("#builtMax").value = _bMax ?? "";

  state.priceMin = _pMin;
  state.priceMax = _pMax;
  state.usefulMin = _uMin;
  state.usefulMax = _uMax;
  state.builtMin = _bMin;
  state.builtMax = _bMax;
}

/* Poner X en rojo cuando esté aplicado */
function updateAppliedStates() {
  normalizeMinMax();

  // price aplicado si min/max tiene valor
  toggleApplied("price", state.priceMin != null || state.priceMax != null);

  // listed aplicado si hay días
  toggleApplied("listed", state.listedFromDays != null);

  // availability aplicado siempre (porque siempre hay valor), pero la X solo roja si NO es el default
  toggleApplied("availability", state.availability !== "available");

  toggleApplied("useful", state.usefulMin != null || state.usefulMax != null);
  toggleApplied("built", state.builtMin != null || state.builtMax != null);
  toggleApplied("outdoor", !!state.outdoor);
  toggleApplied("builtPeriod", (state.builtPeriods || []).length > 0);
}

function toggleApplied(key, on) {
  const card = document.querySelector(`.bh-filterCard[data-filter="${key}"]`);
  if (!card) return;
  card.classList.toggle("is-applied", !!on);
}

/* -----------------------------
   8) Ordenar
   ----------------------------- */
function initSortUI() {
  $("#sortBtn").addEventListener("click", () => {
    $("#sortMenu").classList.toggle("bh-hidden");
  });

  $$("#sortMenu button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.sort = btn.getAttribute("data-sort");
      $("#sortMenu").classList.add("bh-hidden");
      renderList(); // solo reordena listado
    });
  });
}

/* -----------------------------
   9) Cargar anuncios (RPC) y pintarlos
   ----------------------------- */
const loadPointsForCurrentViewDebounced = debounce(loadPointsForCurrentView, 240);

async function loadPointsForCurrentView() {
  // Si estás dibujando un área, por definición NO se muestran anuncios
  if (state.pointsDrawActive || state.freeDrawActive || drawTemp.isDrawing) {
    clearMarkers();
    $("#listInner").innerHTML = "";
    return;
  }

  const b = map.getBounds();

  const payload = buildRpcPayload(b);
  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${RPC_SEARCH}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      setToast("Error: no se pudieron cargar anuncios.", true);
      console.error("RPC error", res.status, txt);
      clearMarkers();
      $("#listInner").innerHTML = "";
      return;
    }

    const data = await res.json();
    // Esperamos array de puntos
    state.points = Array.isArray(data) ? data : [];
    setToast(`Anuncios: ${state.points.length} | zoom ${map.getZoom()} | modo=${state.mode}`);

    paintMarkers();
    renderList();
  } catch (e) {
    setToast("Error: no se pudieron cargar anuncios (red).", true);
    console.error(e);
    clearMarkers();
    $("#listInner").innerHTML = "";
  }
}

/* Aquí es donde construimos EXACTAMENTE los parámetros típicos del RPC.
   Si tu RPC usa otros nombres, dime el nombre exacto y se ajusta aquí.
*/
function buildRpcPayload(bounds) {
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();

  return {
    // viewport
    p_south: south,
    p_west: west,
    p_north: north,
    p_east: east,

    // city/mode (si tu rpc no lo usa, lo ignora)
    p_city: state.city || null,
    p_mode: state.mode || "buy",

    // filtros
    p_price_min: state.priceMin,
    p_price_max: state.priceMax,
    p_listed_from_days: state.listedFromDays,
    p_availability: state.availability, // “available” etc.
    p_useful_min: state.usefulMin,
    p_useful_max: state.usefulMax,
    p_built_min: state.builtMin,
    p_built_max: state.builtMax,
    p_outdoor: state.outdoor,

    // periodo construcción (multi)
    p_built_periods: (state.builtPeriods && state.builtPeriods.length) ? state.builtPeriods : null,
  };
}

/* -----------------------------
   10) Marcadores: estilos (naranja / visto / seleccionado / hover)
   ----------------------------- */
function makeDotIcon(kind) {
  const cls = ["bh-dot"];
  if (kind === "seen") cls.push("seen");
  if (kind === "selected") cls.push("selected");
  if (kind === "hover") cls.push("hover");

  return L.divIcon({
    className: "",
    html: `<div class="${cls.join(" ")}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function markerKindFor(id) {
  const sid = String(id);
  if (state.selectedId && String(state.selectedId) === sid) return "selected";
  if (state.hoveredId && String(state.hoveredId) === sid) return "hover";
  if (state.seen.has(sid)) return "seen";
  return "normal";
}

function clearMarkers() {
  markersLayer.clearLayers();
  state.markersById.clear();
}

function paintMarkers() {
  clearMarkers();

  for (const p of state.points) {
    const id = p.id ?? p.listing_id ?? p.uuid ?? p.public_id;
    const lat = p.lat ?? p.latitude;
    const lng = p.lng ?? p.longitude;

    if (id == null || lat == null || lng == null) continue;

    const kind = markerKindFor(id);
    const m = L.marker([lat, lng], { icon: makeDotIcon(kind) });

    m.on("click", () => selectListing(id));
    m.addTo(markersLayer);
    state.markersById.set(String(id), m);
  }

  // Si estaba seleccionada una ficha, asegúrate de mantener el estilo
  refreshMarkerIcons();
}

function refreshMarkerIcons() {
  for (const [id, m] of state.markersById.entries()) {
    const kind = markerKindFor(id);
    m.setIcon(makeDotIcon(kind));
  }
}

/* -----------------------------
   11) Listado: render + hover resalta marcador + click abre ficha
   ----------------------------- */
function normalizeListing(p) {
  // Intentamos mapear campos típicos
  const id = p.id ?? p.listing_id ?? p.uuid ?? p.public_id;
  const title = p.title ?? p.address ?? "—";
  const city = p.city ?? p.city_name ?? state.city ?? "—";
  const zip = p.postal_code ?? p.zip ?? "";
  const price = p.price_eur ?? p.price ?? null;
  const useful = p.useful_area_m2 ?? p.useful_m2 ?? null;
  const built = p.built_area_m2 ?? p.built_m2 ?? null;
  const agency = p.agency_name ?? p.agency ?? "—";
  const photo = p.photo_url ?? p.cover_url ?? p.image_url ?? null;

  const listedAt = p.listed_at ?? p.published_at ?? p.created_at ?? null;

  return { id, title, city, zip, price, useful, built, agency, photo, listedAt };
}

function sortPoints(arr) {
  const a = arr.slice();
  const key = state.sort;

  const getDate = (x) => {
    const d = x.listedAt ? new Date(x.listedAt).getTime() : 0;
    return Number.isFinite(d) ? d : 0;
  };
  const getPrice = (x) => (x.price == null ? -1 : Number(x.price));
  const getSize = (x) => (x.useful == null ? (x.built == null ? -1 : Number(x.built)) : Number(x.useful));

  a.sort((x, y) => {
    if (key === "date_desc") return getDate(y) - getDate(x);
    if (key === "date_asc") return getDate(x) - getDate(y);
    if (key === "price_desc") return getPrice(y) - getPrice(x);
    if (key === "price_asc") return getPrice(x) - getPrice(y);
    if (key === "size_desc") return getSize(y) - getSize(x);
    if (key === "size_asc") return getSize(x) - getSize(y);
    return 0;
  });

  return a;
}

function renderList() {
  const host = $("#listInner");
  host.innerHTML = "";

  const normalized = state.points.map(normalizeListing).filter(x => x.id != null);
  const sorted = sortPoints(normalized);

  for (const it of sorted) {
    const card = document.createElement("div");
    card.className = "bh-listItem";
    card.dataset.id = String(it.id);

    const imgHtml = it.photo
      ? `<img src="${it.photo}" alt="">`
      : "";

    card.innerHTML = `
      <div class="bh-listRow">
        <div class="bh-thumb">${imgHtml}</div>
        <div>
          <div class="bh-liTitle">${escapeHtml(it.title)}</div>
          <div class="bh-liSub">${escapeHtml((it.zip ? it.zip + " " : "") + it.city)}</div>
          <div class="bh-liPrice">${fmtEur(it.price)}</div>
          <div class="bh-liFacts">${fmtFacts(it.useful, it.built)}</div>
          <div class="bh-liAgency">${escapeHtml(it.agency)}</div>
        </div>
      </div>
    `;

    // Hover: resaltar marcador
    card.addEventListener("mouseenter", () => {
      state.hoveredId = String(it.id);
      refreshMarkerIcons();
    });
    card.addEventListener("mouseleave", () => {
      state.hoveredId = null;
      refreshMarkerIcons();
    });

    // Click: abrir ficha igual que en marcador
    card.addEventListener("click", () => selectListing(it.id));

    host.appendChild(card);
  }
}

function fmtFacts(useful, built) {
  const u = useful != null ? `${Number(useful)} m²` : "—";
  const b = built != null ? `${Number(built)} m²` : "—";
  // Mostramos útil primero (prioritario), luego construida
  return `${u} útiles · ${b} construidos`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -----------------------------
   12) Selección: tarjeta del mapa + deselección al cerrar
   ----------------------------- */
function selectListing(id) {
  const sid = String(id);
  state.selectedId = sid;

  // Marcar como visto
  state.seen.add(sid);
  saveSeen();

  // Render tarjeta
  const pRaw = state.points.find(p => String(p.id ?? p.listing_id ?? p.uuid ?? p.public_id) === sid);
  const p = pRaw ? normalizeListing(pRaw) : null;

  if (p) {
    $("#mapCardInner").innerHTML = buildMapCardHtml(p);
    $("#mapCard").classList.remove("bh-hidden");

    // Botón cerrar
    const closeBtn = $("#mapCardInner").querySelector("[data-close]");
    closeBtn?.addEventListener("click", () => closeSelected());

    // Click en el card -> abre ficha (listing.html)
    const openBtn = $("#mapCardInner").querySelector("[data-open]");
    openBtn?.addEventListener("click", () => openListing(p.id));

    // También: al seleccionar desde listado, queremos igual que marker (ya está)
  } else {
    $("#mapCard").classList.add("bh-hidden");
  }

  refreshMarkerIcons();
  // Scroll: llevar el elemento del listado a vista si existe
  const li = document.querySelector(`.bh-listItem[data-id="${sid}"]`);
  if (li && !state.listHidden) li.scrollIntoView({ block: "nearest" });
}

function closeSelected() {
  // cerrar tarjeta y deseleccionar marcador (esto te faltaba)
  state.selectedId = null;
  $("#mapCard").classList.add("bh-hidden");
  refreshMarkerIcons();
}

function openListing(id) {
  // Guarda URL del mapa para volver (según definición listing)
  try { sessionStorage.setItem("bh_last_map_url", window.location.href); } catch {}
  window.location.href = `./listing.html?id=${encodeURIComponent(String(id))}`;
}

function buildMapCardHtml(p) {
  const img = p.photo ? `<img src="${p.photo}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">` : "";
  const price = fmtEur(p.price);

  return `
    <div style="display:grid;grid-template-columns: 260px 1fr; gap: 0; align-items: stretch;">
      <div style="height:160px;background:#efefef;">${img}</div>

      <div style="padding:16px 18px; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start; gap:10px;">
          <div style="min-width:0;">
            <div style="color:#1e6fe8;font-weight:900;font-size:30px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(p.title)}
            </div>
            <div style="font-weight:800;font-size:22px;">${escapeHtml((p.zip ? p.zip + " " : "") + p.city)}</div>
          </div>

          <div style="display:flex; gap:10px; align-items:center;">
            <button type="button" data-open style="height:44px;padding:0 14px;border-radius:14px;border:1px solid #e7e7e7;background:#fff;font-weight:800;cursor:pointer;">
              Abrir
            </button>
            <button type="button" data-close style="width:56px;height:56px;border-radius:18px;border:0;background:#1e6fe8;color:#fff;font-weight:900;font-size:22px;cursor:pointer;">
              ×
            </button>
          </div>
        </div>

        <div style="font-weight:900;font-size:30px;margin-top:6px;">${price}</div>
        <div style="font-weight:800;color:#2b2b2b;">${fmtFacts(p.useful, p.built)}</div>
        <div style="color:#1e6fe8;font-weight:900;margin-top:6px;">${escapeHtml(p.agency)}</div>
      </div>
    </div>
  `;
}

/* -----------------------------
   13) Texto “Comunidad / Ciudad / Zona” según área visible
   - Versión simple: usa el city de URL y el centro del mapa como “Zona”
   - Si quieres exacto por geocoding (barrio, etc.) hay que añadir un servicio.
   ----------------------------- */
function updateAreaTextFromMap() {
  // Sin geocoder externo: mantenemos algo estable
  const city = state.city || "—";
  const center = map.getCenter();
  const zone = `${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}`;
  $("#areaText").textContent = `Comunidad Autónoma / ${city} / ${city}`;
}

/* -----------------------------
   14) Controles derecha: localización + sol + dibujar
   ----------------------------- */
let ctrlButtons = {
  locate: null,
  sun: null,
  points: null,
  free: null,
};

function addRightControls() {
  const Ctrl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const box = L.DomUtil.create("div", "bh-mapCtrl");

      // 1) Localización (encima del sol)
      const bLocate = document.createElement("button");
      bLocate.type = "button";
      bLocate.title = "Ir a mi ubicación";
      bLocate.innerHTML = "⌖";
      box.appendChild(bLocate);

      // 2) Sol
      const bSun = document.createElement("button");
      bSun.type = "button";
      bSun.title = "Sol (zoom ≥ 16)";
      bSun.innerHTML = "☀";
      box.appendChild(bSun);

      // 3) Polígono por puntos
      const bPts = document.createElement("button");
      bPts.type = "button";
      bPts.title = "Dibujar área (punto a punto)";
      bPts.innerHTML = "✳";
      box.appendChild(bPts);

      // 4) Dibujo libre
      const bFree = document.createElement("button");
      bFree.type = "button";
      bFree.title = "Dibujar área (libre)";
      bFree.innerHTML = "✎";
      box.appendChild(bFree);

      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.disableScrollPropagation(box);

      // Hooks
      ctrlButtons.locate = bLocate;
      ctrlButtons.sun = bSun;
      ctrlButtons.points = bPts;
      ctrlButtons.free = bFree;

      bLocate.addEventListener("click", onLocateClick);
      bSun.addEventListener("click", onSunToggle);
      bPts.addEventListener("click", onPointsDrawToggle);
      bFree.addEventListener("click", onFreeDrawToggle);

      return box;
    }
  });

  map.addControl(new Ctrl());
}

function onLocateClick() {
  if (!navigator.geolocation) {
    setToast("Tu navegador no permite geolocalización.", true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 14, { animate: true });
    },
    () => setToast("No se pudo obtener tu ubicación.", true),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

/* ---------- Sol (SunCalc “estilo SunCalc”: arco alrededor del centro) ---------- */
function syncSunButtonEnabled() {
  const z = map.getZoom();
  const enabled = z >= 16;
  if (ctrlButtons.sun) ctrlButtons.sun.disabled = !enabled;

  // Si estaba activo y baja de 16, se desactiva automáticamente (según definición)
  if (!enabled && state.sunActive) {
    state.sunActive = false;
    ctrlButtons.sun?.classList.remove("is-active");
    sunLayerGroup.clearLayers();
  }
}

function onSunToggle() {
  if (map.getZoom() < 16) return;

  // Sol y dibujo no pueden coexistir activos
  if (state.pointsDrawActive || state.freeDrawActive || drawTemp.isDrawing) {
    cancelAllDrawing();
  }

  state.sunActive = !state.sunActive;
  ctrlButtons.sun.classList.toggle("is-active", state.sunActive);

  if (!state.sunActive) {
    sunLayerGroup.clearLayers();
    return;
  }
  drawSunPath();
}

function drawSunPath() {
  sunLayerGroup.clearLayers();

  const center = map.getCenter();
  const lat = center.lat;
  const lng = center.lng;

  // Radio en metros para dibujar el “círculo” alrededor del punto
  const radiusM = 180;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  // Muestreo cada 10 minutos
  const ptsDay = [];
  const ptsNight = [];

  for (let i = 0; i <= 24 * 60; i += 10) {
    const t = new Date(start.getTime() + i * 60 * 1000);
    const pos = SunCalc.getPosition(t, lat, lng);
    const az = pos.azimuth; // rad, desde sur? SunCalc: azimuth desde sur hacia oeste
    const alt = pos.altitude;

    // Convertimos azimuth SunCalc a rumbo “desde norte sentido horario”
    // SunCalc: 0 = sur, PI/2 = oeste, -PI/2 = este.
    // Rumbo = (az + PI) en rad desde norte? Ajuste:
    const bearingRad = az + Math.PI; // aproximación consistente para dibujar
    const bearingDeg = (bearingRad * 180) / Math.PI;

    const dest = destinationPoint(lat, lng, bearingDeg, radiusM);
    const ll = [dest.lat, dest.lng];

    if (alt >= 0) ptsDay.push(ll);
    else ptsNight.push(ll);
  }

  // Día: naranja. Noche: gris.
  if (ptsDay.length >= 2) {
    L.polyline(ptsDay, { color: "#f6a000", weight: 4, opacity: 0.95 }).addTo(sunLayerGroup);
  }
  if (ptsNight.length >= 2) {
    L.polyline(ptsNight, { color: "#9a9a9a", weight: 4, opacity: 0.85 }).addTo(sunLayerGroup);
  }

  // Punto central
  L.circleMarker([lat, lng], { radius: 4, color: "#111", weight: 2, fillColor: "#fff", fillOpacity: 1 }).addTo(sunLayerGroup);
}

/* destino en lat/lng con bearing grados y distancia metros */
function destinationPoint(lat, lng, bearingDeg, distM) {
  const R = 6371000;
  const brng = bearingDeg * Math.PI / 180;
  const φ1 = lat * Math.PI / 180;
  const λ1 = lng * Math.PI / 180;

  const δ = distM / R;

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(brng));
  const λ2 = λ1 + Math.atan2(
    Math.sin(brng) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return { lat: φ2 * 180 / Math.PI, lng: λ2 * 180 / Math.PI };
}

/* ---------- Dibujo por puntos ---------- */
function onPointsDrawToggle() {
  // Si sol activo, se desactiva
  if (state.sunActive) {
    state.sunActive = false;
    ctrlButtons.sun?.classList.remove("is-active");
    sunLayerGroup.clearLayers();
  }

  state.pointsDrawActive = !state.pointsDrawActive;
  ctrlButtons.points.classList.toggle("is-active", state.pointsDrawActive);

  if (!state.pointsDrawActive) {
    cancelPointsDrawing();
    loadPointsForCurrentView();
    return;
  }

  // activar: empezamos captura de clicks
  startPointsDrawing();
}

function startPointsDrawing() {
  closeSelected(); // mientras se dibuja, no hay ficha
  clearMarkers();  // mientras se dibuja, no hay anuncios

  drawTemp.isDrawing = true;
  drawTemp.pts = [];
  drawTemp.ptMarkers = [];
  if (drawTemp.closeMarker) { map.removeLayer(drawTemp.closeMarker); drawTemp.closeMarker = null; }

  setToast("Haz clic punto a punto para dibujar el área. Cierra en el primer punto.");

  map.on("click", onMapClickAddPoint);
}

function onMapClickAddPoint(e) {
  const ll = e.latlng;
  drawTemp.pts.push(ll);

  const m = L.circleMarker(ll, { radius: 5, color: "#111", weight: 2, fillColor: "#fff", fillOpacity: 1 }).addTo(areasLayerGroup);
  drawTemp.ptMarkers.push(m);

  // primer punto: marcador “cerrar”
  if (drawTemp.pts.length === 1) {
    drawTemp.closeMarker = L.circleMarker(ll, { radius: 10, color: "#1e6fe8", weight: 3, fillColor: "#fff", fillOpacity: 1 })
      .addTo(areasLayerGroup);
    drawTemp.closeMarker.on("click", () => tryClosePointsPolygon());
  }
}

function tryClosePointsPolygon() {
  if (drawTemp.pts.length < 3) {
    // regla: si menos de 3 puntos, no crea polígono
    cancelPointsDrawing();
    state.pointsDrawActive = false;
    ctrlButtons.points.classList.remove("is-active");
    drawTemp.isDrawing = false;
    setToast("Área no creada (mínimo 3 puntos).");
    loadPointsForCurrentView();
    return;
  }

  // crear polígono
  const poly = L.polygon(drawTemp.pts, { color: "#1e6fe8", weight: 3, fillColor: "#1e6fe8", fillOpacity: 0.08 });
  poly.addTo(areasLayerGroup);
  state.areasPoints.push(poly);

  // limpiar temporales
  cancelPointsDrawing();
  drawTemp.isDrawing = false;

  setToast("Área creada.");
  loadPointsForCurrentView(); // (si quieres filtrar por área de verdad, hay que aplicar point-in-polygon; aquí mantenemos tu comportamiento actual sin romper el backend)
}

function cancelPointsDrawing() {
  map.off("click", onMapClickAddPoint);

  // borrar marcadores temporales (no borra áreas ya creadas)
  drawTemp.ptMarkers.forEach(m => areasLayerGroup.removeLayer(m));
  drawTemp.ptMarkers = [];
  drawTemp.pts = [];
  if (drawTemp.closeMarker) {
    areasLayerGroup.removeLayer(drawTemp.closeMarker);
    drawTemp.closeMarker = null;
  }
}

/* ---------- Dibujo libre (versión simple) ---------- */
let freeDraw = {
  down: false,
  latlngs: [],
  tempLine: null,
};

function onFreeDrawToggle() {
  if (state.sunActive) {
    state.sunActive = false;
    ctrlButtons.sun?.classList.remove("is-active");
    sunLayerGroup.clearLayers();
  }

  state.freeDrawActive = !state.freeDrawActive;
  ctrlButtons.free.classList.toggle("is-active", state.freeDrawActive);

  if (!state.freeDrawActive) {
    stopFreeDrawing();
    loadPointsForCurrentView();
    return;
  }
  startFreeDrawing();
}

function startFreeDrawing() {
  closeSelected();
  clearMarkers();
  setToast("Mantén pulsado y dibuja el área. Suelta para terminar.");

  freeDraw.down = false;
  freeDraw.latlngs = [];
  if (freeDraw.tempLine) { areasLayerGroup.removeLayer(freeDraw.tempLine); freeDraw.tempLine = null; }

  map.on("mousedown", onFreeDown);
  map.on("mousemove", onFreeMove);
  map.on("mouseup", onFreeUp);

  // touch
  map.on("touchstart", onFreeDown);
  map.on("touchmove", onFreeMove);
  map.on("touchend", onFreeUp);
}

function stopFreeDrawing() {
  map.off("mousedown", onFreeDown);
  map.off("mousemove", onFreeMove);
  map.off("mouseup", onFreeUp);
  map.off("touchstart", onFreeDown);
  map.off("touchmove", onFreeMove);
  map.off("touchend", onFreeUp);

  if (freeDraw.tempLine) { areasLayerGroup.removeLayer(freeDraw.tempLine); freeDraw.tempLine = null; }
  freeDraw.latlngs = [];
  freeDraw.down = false;
}

function onFreeDown(e) {
  freeDraw.down = true;
  freeDraw.latlngs = [e.latlng];
  if (freeDraw.tempLine) { areasLayerGroup.removeLayer(freeDraw.tempLine); }
  freeDraw.tempLine = L.polyline(freeDraw.latlngs, { color: "#1e6fe8", weight: 3, opacity: 0.9 }).addTo(areasLayerGroup);
}

function onFreeMove(e) {
  if (!freeDraw.down) return;
  freeDraw.latlngs.push(e.latlng);
  freeDraw.tempLine.setLatLngs(freeDraw.latlngs);
}

function onFreeUp() {
  if (!freeDraw.down) return;
  freeDraw.down = false;

  // validación mínima: trazo largo
  if (freeDraw.latlngs.length < 10) {
    stopFreeDrawing();
    state.freeDrawActive = false;
    ctrlButtons.free.classList.remove("is-active");
    setToast("Área no creada (trazo demasiado corto).");
    loadPointsForCurrentView();
    return;
  }

  // convertir a polígono cerrando
  const latlngs = freeDraw.latlngs.slice();
  latlngs.push(latlngs[0]);

  const poly = L.polygon(latlngs, { color: "#1e6fe8", weight: 3, fillColor: "#1e6fe8", fillOpacity: 0.08 });
  poly.addTo(areasLayerGroup);
  state.areasFree.push(poly);

  stopFreeDrawing();
  state.freeDrawActive = false;
  ctrlButtons.free.classList.remove("is-active");

  setToast("Área creada.");
  loadPointsForCurrentView();
}

function cancelAllDrawing() {
  if (state.pointsDrawActive) {
    state.pointsDrawActive = false;
    ctrlButtons.points?.classList.remove("is-active");
  }
  if (state.freeDrawActive) {
    state.freeDrawActive = false;
    ctrlButtons.free?.classList.remove("is-active");
  }
  cancelPointsDrawing();
  stopFreeDrawing();
  drawTemp.isDrawing = false;
}

/* -----------------------------
   15) Arranque
   ----------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initMap();
});