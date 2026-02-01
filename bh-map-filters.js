// bh-map-filters.js
// Barra de filtros minimalista (scroll-x) en tarjetas 2 líneas:
//  - Línea 1: título
//  - Línea 2: control(es)
// Sin filtro ciudad
// Sin botones Aplicar / Limpiar
// Actualiza URL + emite "bh:filters-changed" al cambiar cualquier filtro

function el(tag, attrs, children) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, String(v));
    }
  }
  (children || []).forEach((c) => {
    if (c == null) return;
    n.appendChild(c);
  });
  return n;
}

function injectStylesOnce() {
  if (document.getElementById("bhFiltersBarStyles")) return;

  const css = `
  .bhFiltersBar{
    position: sticky;
    top: var(--headerH, 56px);
    z-index: 800;
    background: #fff;
    border-bottom: 1px solid rgba(0,0,0,0.08);
  }

  .bhFiltersBarInner{
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .bhFiltersBarInner::-webkit-scrollbar{ height: 8px; }
  .bhFiltersBarInner::-webkit-scrollbar-thumb{ background: rgba(0,0,0,0.16); border-radius: 99px; }
  .bhFiltersBarInner::-webkit-scrollbar-track{ background: rgba(0,0,0,0.05); }

  .fPill{
    flex: 0 0 auto;
    display: grid;
    grid-template-rows: auto auto;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid rgba(0,0,0,0.10);
    border-radius: 12px;
    background: #fff;
    min-height: 56px;
  }

  .fPillLabel{
    font-size: 12px;
    color: rgba(0,0,0,0.60);
    line-height: 1.1;
    white-space: nowrap;
  }

  .fRow{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .fInp, .fSel{
    height: 32px;
    border-radius: 10px;
    border: 1px solid rgba(0,0,0,0.10);
    padding: 0 10px;
    font-size: 13px;
    outline: none;
    background: #fff;
    min-width: 92px;
  }

  .fInpSmall{ min-width: 76px; }
  .fInpWide{ min-width: 140px; }

  .fSep{
    width: 1px;
    height: 18px;
    background: rgba(0,0,0,0.10);
    margin: 0 2px;
  }

  details.fMulti{
    position: relative;
  }

  details.fMulti > summary{
    list-style: none;
    cursor: pointer;
    outline: none;
  }
  details.fMulti > summary::-webkit-details-marker{ display:none; }

  .fMultiBtn{
    height: 32px;
    border-radius: 10px;
    border: 1px solid rgba(0,0,0,0.10);
    background: #fff;
    padding: 0 10px;
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
  }

  .fMultiMenu{
    position: absolute;
    top: 38px;
    left: 0;
    width: 260px;
    max-height: 280px;
    overflow: auto;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 12px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.12);
    padding: 10px;
    z-index: 1200;
  }

  .fMultiItem{
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 6px;
    border-radius: 10px;
  }
  .fMultiItem:hover{ background: rgba(0,0,0,0.03); }

  @media (max-width: 520px){
    .fMultiMenu{ width: 240px; }
    .fInpWide{ min-width: 120px; }
  }
  `;

  const style = document.createElement("style");
  style.id = "bhFiltersBarStyles";
  style.textContent = css;
  document.head.appendChild(style);
}

function intOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toText(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function csvOrNull(arr) {
  const a = (arr || []).map(String).map((s) => s.trim()).filter(Boolean);
  return a.length ? a.join(",") : null;
}

function makeDatalist(id, options) {
  const dl = el("datalist", { id });
  (options || []).forEach((v) => dl.appendChild(el("option", { value: String(v) })));
  return dl;
}

function getModeFromUrl() {
  const u = new URL(window.location.href);
  const m = (u.searchParams.get("mode") || "buy").trim().toLowerCase();
  return m || "buy";
}

function getInitialFromUrl() {
  const u = new URL(window.location.href);
  return {
    // city intencionadamente fuera

    priceMin: intOrNull(u.searchParams.get("price_min")),
    priceMax: intOrNull(u.searchParams.get("price_max")),

    sinceDays: intOrNull(u.searchParams.get("since_days")),
    availability: toText(u.searchParams.get("availability")),

    usefulMin: intOrNull(u.searchParams.get("useful_min")),
    usefulMax: intOrNull(u.searchParams.get("useful_max")),

    builtMin: intOrNull(u.searchParams.get("built_min")),
    builtMax: intOrNull(u.searchParams.get("built_max")),

    bedrooms: toText(u.searchParams.get("bedrooms")), // si lo usas en algún sitio futuro
    bedroomsMin: intOrNull(u.searchParams.get("bedrooms_min")),
    bathroomsMin: intOrNull(u.searchParams.get("bathrooms_min")),

    outdoorType: toText(u.searchParams.get("outdoor_type")),
    orientations: toText(u.searchParams.get("orientations")),

    energy: toText(u.searchParams.get("energy")),

    buildPeriods: toText(u.searchParams.get("build_periods")),

    parking: toText(u.searchParams.get("parking")),
    storage: toText(u.searchParams.get("storage")),
    accessibility: toText(u.searchParams.get("accessibility")),
  };
}

function setUrlParams(patch) {
  const u = new URL(window.location.href);

  function setOrDel(key, value) {
    if (value == null || value === "") u.searchParams.delete(key);
    else u.searchParams.set(key, String(value));
  }

  // Nunca tocamos mode ni city aquí.
  for (const [k, v] of Object.entries(patch || {})) setOrDel(k, v);

  history.replaceState(null, "", u.toString());
}

function emitChanged() {
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

function swapIfNeeded(minVal, maxVal) {
  const a = intOrNull(minVal);
  const b = intOrNull(maxVal);
  if (a == null || b == null) return { min: a, max: b, swapped: false };
  if (a <= b) return { min: a, max: b, swapped: false };
  return { min: b, max: a, swapped: true };
}

function multiDetails(label, options, initialCsv, onAnyChange) {
  const selected = new Set(
    String(initialCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const sumText = () => {
    if (!selected.size) return "Cualquiera";
    const arr = Array.from(selected);
    return arr.join(",");
  };

  const btn = el("button", { type: "button", class: "fMultiBtn", text: sumText() });

  const items = options.map((opt) => {
    const id = `chk_${label}_${opt}`.replace(/\s+/g, "_");
    const chk = el("input", { type: "checkbox", id });
    chk.checked = selected.has(opt);

    chk.addEventListener("change", () => {
      if (chk.checked) selected.add(opt);
      else selected.delete(opt);

      btn.textContent = sumText();
      if (onAnyChange) onAnyChange();
    });

    return el("label", { class: "fMultiItem", for: id }, [chk, el("span", { text: opt })]);
  });

  const menu = el("div", { class: "fMultiMenu" }, items);

  const details = el("details", { class: "fMulti" }, [
    el("summary", {}, [btn]),
    menu
  ]);

  document.addEventListener("click", (e) => {
    if (!details.open) return;
    if (details.contains(e.target)) return;
    details.open = false;
  });

  return {
    node: details,
    getCsv: () => csvOrNull(Array.from(selected)),
    setEnabled: (on) => {
      btn.disabled = !on;
      btn.style.opacity = on ? "1" : "0.45";
      btn.style.pointerEvents = on ? "auto" : "none";
      if (!on) details.open = false;
    },
    reset: () => {
      selected.clear();
      btn.textContent = sumText();
      // no actualizamos checks uno a uno; se reconstruye barra si lo necesitas más adelante
    }
  };
}

export function initFiltersBar(opts = {}) {
  injectStylesOnce();

  const container =
    opts.container ||
    (opts.mountId ? document.getElementById(opts.mountId) : null);

  if (!container) return;

  const mode = getModeFromUrl();
  const initial = (opts.getInitial ? opts.getInitial() : getInitialFromUrl()) || {};

  // Datalists / sugerencias (según mode)
  const priceSuggest =
    (mode === "rent" || mode === "room")
      ? [300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 1800, 2000, 2500, 3000]
      : [50000, 75000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 750000, 1000000, 1250000, 1500000, 1750000, 2000000];

  const usefulSuggest = [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200];
  const builtSuggest = [40, 50, 60, 75, 90, 100, 120, 140, 160, 180, 200, 250, 300, 400];

  const dlPrice = makeDatalist("dlPrice", priceSuggest);
  const dlUseful = makeDatalist("dlUseful", usefulSuggest);
  const dlBuilt = makeDatalist("dlBuilt", builtSuggest);

  // Controles
  const priceMin = el("input", {
    class: "fInp",
    type: "number",
    inputmode: "numeric",
    placeholder: "€ min",
    value: initial.priceMin ?? "",
    list: "dlPrice"
  });
  const priceMax = el("input", {
    class: "fInp",
    type: "number",
    inputmode: "numeric",
    placeholder: "€ max",
    value: initial.priceMax ?? "",
    list: "dlPrice"
  });

  const sinceSel = el("select", { class: "fSel" });
  [
    ["", "Cualquiera"],
    ["1", "24h"],
    ["5", "5 días"],
    ["10", "10 días"],
    ["30", "30 días"],
    ["60", "60 días"]
  ].forEach(([v, t]) => sinceSel.appendChild(el("option", { value: v, text: t })));
  sinceSel.value = (initial.sinceDays != null) ? String(initial.sinceDays) : "";

  const availSel = el("select", { class: "fSel" });
  [
    ["", "Cualquiera"],
    ["published", "Publicados (MVP)"],
    ["available", "Disponible"],
    ["negotiating", "Ofertado / negociación"],
    ["closed", "Alquilado / vendido"]
  ].forEach(([v, t]) => availSel.appendChild(el("option", { value: v, text: t })));
  availSel.value = initial.availability || "";

  const usefulMin = el("input", {
    class: "fInp",
    type: "number",
    inputmode: "numeric",
    placeholder: "m² min",
    value: initial.usefulMin ?? "",
    list: "dlUseful"
  });
  const usefulMax = el("input", {
    class: "fInp",
    type: "number",
    inputmode: "numeric",
    placeholder: "m² max",
    value: initial.usefulMax ?? "",
    list: "dlUseful"
  });

  const builtMin = el("input", {
    class: "fInp",
    type: "number",
    inputmode: "numeric",
    placeholder: "m² min",
    value: initial.builtMin ?? "",
    list: "dlBuilt"
  });
  const builtMax = el("input", {
    class: "fInp",
    type: "number",
    inputmode: "numeric",
    placeholder: "m² max",
    value: initial.builtMax ?? "",
    list: "dlBuilt"
  });

  const bedsSel = el("select", { class: "fSel" });
  [
    ["", "Cualquiera"],
    ["1", "1"],
    ["2", "2"],
    ["3", "3"],
    ["4", "4"],
    ["1+", "1+"],
    ["2+", "2+"],
    ["3+", "3+"],
    ["4+", "4+"]
  ].forEach(([v, t]) => bedsSel.appendChild(el("option", { value: v, text: t })));
  bedsSel.value = ""; // preferimos partir sin forzar; si ya hay bedrooms_min en URL lo respetamos abajo

  const bathSel = el("select", { class: "fSel" });
  [
    ["", "Cualquiera"],
    ["1", "1+"],
    ["2", "2+"],
    ["3", "3+"],
    ["4", "4+"],
    ["5", "5+"]
  ].forEach(([v, t]) => bathSel.appendChild(el("option", { value: v, text: t })));
  bathSel.value = (initial.bathroomsMin != null) ? String(initial.bathroomsMin) : "";

  const outdoorSel = el("select", { class: "fSel" });
  [
    ["", "Cualquiera"],
    ["balcon", "Balcón"],
    ["terraza", "Terraza"],
    ["jardin", "Jardín"],
    ["patio", "Patio"]
  ].forEach(([v, t]) => outdoorSel.appendChild(el("option", { value: v, text: t })));
  outdoorSel.value = initial.outdoorType || "";

  const energySel = el("select", { class: "fSel" });
  [
    ["", "Cualquiera"],
    ["pending", "Pendiente"],
    ["A+++++", "A+++++"],
    ["A++++", "A++++"],
    ["A+++", "A+++"],
    ["A++", "A++"],
    ["A+", "A+"],
    ["A", "A"],
    ["B", "B"],
    ["C", "C"],
    ["D", "D"],
    ["E", "E"],
    ["F", "F"],
    ["G", "G"]
  ].forEach(([v, t]) => energySel.appendChild(el("option", { value: v, text: t })));
  energySel.value = initial.energy || "";

  const orientationsMulti = multiDetails(
    "Orientación",
    ["N","NE","E","SE","S","SW","W","NW"],
    initial.orientations,
    null
  );

  const buildPeriodsMulti = multiDetails(
    "Periodo",
    ["<1950", "1950-1999", "2000+"],
    initial.buildPeriods,
    null
  );

  const parkingMulti = multiDetails(
    "Parking",
    ["incluido", "opcional", "no_disponible"],
    initial.parking,
    null
  );

  const storageMulti = multiDetails(
    "Trastero",
    ["incluido", "no_incluido"],
    initial.storage,
    null
  );

  const accessibilityMulti = multiDetails(
    "Accesibilidad",
    ["ascensor", "pmr"],
    initial.accessibility,
    null
  );

  // Si ya venía bedrooms_min por URL, reflejamos lo mejor posible en el selector:
  // - si es 1..4, ponemos "X+"
  if (initial.bedroomsMin != null) {
    const v = String(initial.bedroomsMin);
    if (["1","2","3","4"].includes(v)) bedsSel.value = v + "+";
  }

  function isRoomMode() {
    return mode === "room";
  }

  function refreshConditionalVisibility() {
    const builtPill = container.querySelector('[data-pill="built"]');
    if (builtPill) builtPill.style.display = isRoomMode() ? "none" : "grid";

    const hasOutdoor = !!(outdoorSel.value || "").trim();
    orientationsMulti.setEnabled(hasOutdoor);
  }

  function readNormalized() {
    // Reglas min/max: si min > max, intercambiar
    const pr = swapIfNeeded(priceMin.value, priceMax.value);
    if (pr.swapped) {
      priceMin.value = pr.min ?? "";
      priceMax.value = pr.max ?? "";
    }

    const uf = swapIfNeeded(usefulMin.value, usefulMax.value);
    if (uf.swapped) {
      usefulMin.value = uf.min ?? "";
      usefulMax.value = uf.max ?? "";
    }

    const bu = swapIfNeeded(builtMin.value, builtMax.value);
    if (bu.swapped) {
      builtMin.value = bu.min ?? "";
      builtMax.value = bu.max ?? "";
    }

    // Dormitorios: en el mapa solo tenemos bedrooms_min.
    // "X" y "X+" se traducen a bedrooms_min = X (>= X).
    const beds = (bedsSel.value || "").trim();
    let bedroomsMin = null;
    if (beds) {
      const isPlus = beds.endsWith("+");
      const num = parseInt(isPlus ? beds.slice(0, -1) : beds, 10);
      if (Number.isFinite(num)) bedroomsMin = num;
    }

    return {
      priceMin: pr.min,
      priceMax: pr.max,

      sinceDays: intOrNull(sinceSel.value),
      availability: toText(availSel.value),

      usefulMin: uf.min,
      usefulMax: uf.max,

      builtMin: isRoomMode() ? null : bu.min,
      builtMax: isRoomMode() ? null : bu.max,

      bedroomsMin,
      bathroomsMin: intOrNull(bathSel.value),

      outdoorType: toText(outdoorSel.value),
      orientations: orientationsMulti.getCsv(),

      energy: toText(energySel.value),

      buildPeriods: buildPeriodsMulti.getCsv(),

      parking: parkingMulti.getCsv(),
      storage: storageMulti.getCsv(),
      accessibility: accessibilityMulti.getCsv()
    };
  }

  // Auto-apply con debounce
  let autoTimer = null;
  function scheduleAutoApply() {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      const v = readNormalized();

      setUrlParams({
        // city intencionadamente fuera
        price_min: v.priceMin,
        price_max: v.priceMax,

        since_days: v.sinceDays,
        availability: v.availability,

        useful_min: v.usefulMin,
        useful_max: v.usefulMax,

        built_min: v.builtMin,
        built_max: v.builtMax,

        bedrooms_min: v.bedroomsMin,
        bathrooms_min: v.bathroomsMin,

        outdoor_type: v.outdoorType,
        orientations: v.orientations,

        energy: v.energy,

        build_periods: v.buildPeriods,

        parking: v.parking,
        storage: v.storage,
        accessibility: v.accessibility
      });

      emitChanged();
    }, 220);
  }

  // Bind auto-apply
  const autoOn = (node) => {
    node.addEventListener("change", scheduleAutoApply);
    node.addEventListener("input", scheduleAutoApply);
  };

  [priceMin, priceMax, sinceSel, availSel, usefulMin, usefulMax, builtMin, builtMax, bedsSel, bathSel, outdoorSel, energySel]
    .forEach(autoOn);

  // multi: al cambiar, llamamos a scheduleAutoApply
  const wrapMultiAuto = (multi) => {
    // Cuando el checkbox cambia, multiDetails ya actualiza; enganchamos click/change en el details
    multi.node.addEventListener("change", scheduleAutoApply);
    multi.node.addEventListener("click", () => {
      // click también por si el navegador no dispara change al marcar rápido
      setTimeout(scheduleAutoApply, 0);
    });
  };

  [orientationsMulti, buildPeriodsMulti, parkingMulti, storageMulti, accessibilityMulti].forEach(wrapMultiAuto);

  outdoorSel.addEventListener("change", refreshConditionalVisibility);

  // Render
  container.innerHTML = "";

  const wrap = el("div", { class: "bhFiltersBar" }, [
    el("div", { class: "bhFiltersBarInner" }, [])
  ]);

  const inner = wrap.firstChild;

  // Datalists
  inner.appendChild(dlPrice);
  inner.appendChild(dlUseful);
  inner.appendChild(dlBuilt);

  function pill(label, contentNode, dataKey) {
    return el("div", { class: "fPill", "data-pill": dataKey || "" }, [
      el("div", { class: "fPillLabel", text: label }),
      contentNode
    ]);
  }

  inner.appendChild(pill("Precio", el("div", { class: "fRow" }, [
    priceMin, el("span", { class: "fSep" }), priceMax
  ]), "price"));

  inner.appendChild(pill("Ofertado desde", sinceSel, "since"));
  inner.appendChild(pill("Disponibilidad", availSel, "availability"));

  inner.appendChild(pill("Útiles", el("div", { class: "fRow" }, [
    usefulMin, el("span", { class: "fSep" }), usefulMax
  ]), "useful"));

  inner.appendChild(pill("Construidos", el("div", { class: "fRow" }, [
    builtMin, el("span", { class: "fSep" }), builtMax
  ]), "built"));

  inner.appendChild(pill("Dormitorios", bedsSel, "beds"));
  inner.appendChild(pill("Baños", bathSel, "baths"));

  inner.appendChild(pill("Exterior", outdoorSel, "outdoor"));
  inner.appendChild(pill("Orientación", orientationsMulti.node, "orientations"));

  inner.appendChild(pill("Energía", energySel, "energy"));

  inner.appendChild(pill("Periodo", buildPeriodsMulti.node, "period"));
  inner.appendChild(pill("Parking", parkingMulti.node, "parking"));
  inner.appendChild(pill("Trastero", storageMulti.node, "storage"));
  inner.appendChild(pill("Accesibilidad", accessibilityMulti.node, "accessibility"));

  container.appendChild(wrap);

  refreshConditionalVisibility();

  // Aplicar al cargar si hay filtros ya en URL (para sincronizar mapa si el usuario vuelve atrás/adelante)
  // No tocamos nada, solo emitimos cambio si detectamos parámetros relevantes.
  // Esto evita que el mapa se quede sin refrescar en algunos navegadores.
  setTimeout(() => emitChanged(), 0);

  return {
    readNow: readNormalized
  };
}
