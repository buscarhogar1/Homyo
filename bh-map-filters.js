// bh-map-filters.js
// Barra horizontal de filtros (scroll-x) + aplica filtros escribiendo en la URL
// y emitiendo el evento "bh:filters-changed" que bh-map-core.js ya escucha.

function el(tag, attrs, children) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "on") {
        for (const [evt, fn] of Object.entries(v || {})) n.addEventListener(evt, fn);
      } else n.setAttribute(k, String(v));
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
    border-bottom: 1px solid rgba(0,0,0,0.10);
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
  .bhFiltersBarInner::-webkit-scrollbar-thumb{ background: rgba(0,0,0,0.18); border-radius: 99px; }
  .bhFiltersBarInner::-webkit-scrollbar-track{ background: rgba(0,0,0,0.06); }

  .fPill{
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(0,0,0,0.14);
    border-radius: 999px;
    padding: 8px 10px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    min-height: 40px;
  }

  .fPillLabel{
    font-size: 12px;
    color: rgba(0,0,0,0.65);
    white-space: nowrap;
  }

  .fRow{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .fInp, .fSel{
    height: 30px;
    border-radius: 10px;
    border: 1px solid rgba(0,0,0,0.14);
    padding: 0 10px;
    font-size: 13px;
    outline: none;
    background: #fff;
    min-width: 88px;
  }

  .fInpSmall{ min-width: 72px; }
  .fInpWide{ min-width: 140px; }

  .fBtn{
    height: 32px;
    border-radius: 999px;
    border: 1px solid rgba(0,0,0,0.18);
    padding: 0 12px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
  }

  .fBtnPrimary{
    border-color: rgba(26,115,232,0.40);
    background: rgba(26,115,232,0.08);
  }

  .fBtn:active{ transform: translateY(1px); }

  details.fMulti{
    position: relative;
  }

  details.fMulti > summary{
    list-style: none;
    cursor: pointer;
    outline: none;
  }
  details.fMulti > summary::-webkit-details-marker{ display:none; }

  .fMultiMenu{
    position: absolute;
    top: 42px;
    left: 0;
    width: 260px;
    max-height: 280px;
    overflow: auto;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.14);
    border-radius: 14px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.16);
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
  .fMultiItem:hover{ background: rgba(0,0,0,0.04); }

  .fSep{
    width: 1px;
    height: 22px;
    background: rgba(0,0,0,0.10);
    margin: 0 2px;
  }

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

function csvOrNull(arr) {
  const a = (arr || []).map(String).map((s) => s.trim()).filter(Boolean);
  return a.length ? a.join(",") : null;
}

function toText(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
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
    city: (u.searchParams.get("city") || "").trim(),

    priceMin: intOrNull(u.searchParams.get("price_min")),
    priceMax: intOrNull(u.searchParams.get("price_max")),

    sinceDays: intOrNull(u.searchParams.get("since_days")),
    availability: toText(u.searchParams.get("availability")),

    usefulMin: intOrNull(u.searchParams.get("useful_min")),
    usefulMax: intOrNull(u.searchParams.get("useful_max")),

    builtMin: intOrNull(u.searchParams.get("built_min")),
    builtMax: intOrNull(u.searchParams.get("built_max")),

    bedrooms: toText(u.searchParams.get("bedrooms")), // "1","2","3","4","1+","2+","3+","4+"
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

  // Nunca tocamos mode aquí.
  // City sí la mantenemos porque la URL manda en el mapa.
  function setOrDel(key, value) {
    if (value == null || value === "") u.searchParams.delete(key);
    else u.searchParams.set(key, String(value));
  }

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
  const initial = new Set(
    String(initialCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const sumText = () => {
    if (!initial.size) return `${label}: cualquiera`;
    const arr = Array.from(initial);
    return `${label}: ${arr.join(",")}`;
  };

  const summaryBtn = el("button", { type: "button", class: "fBtn", text: sumText() });

  const items = options.map((opt) => {
    const id = `chk_${label}_${opt}`.replace(/\s+/g, "_");
    const chk = el("input", { type: "checkbox", id });
    chk.checked = initial.has(opt);

    chk.addEventListener("change", () => {
      if (chk.checked) initial.add(opt);
      else initial.delete(opt);

      summaryBtn.textContent = sumText();
      if (onAnyChange) onAnyChange();
    });

    const lab = el("label", { class: "fMultiItem", for: id }, [
      chk,
      el("span", { text: opt })
    ]);

    return lab;
  });

  const menu = el("div", { class: "fMultiMenu" }, items);

  const details = el("details", { class: "fMulti" }, [
    el("summary", {}, [summaryBtn]),
    menu
  ]);

  // cerrar si clic fuera
  document.addEventListener("click", (e) => {
    if (!details.open) return;
    if (details.contains(e.target)) return;
    details.open = false;
  });

  return {
    node: details,
    getCsv: () => csvOrNull(Array.from(initial)),
    setEnabled: (on) => {
      summaryBtn.disabled = !on;
      summaryBtn.style.opacity = on ? "1" : "0.45";
      summaryBtn.style.pointerEvents = on ? "auto" : "none";
    }
  };
}

export function initFiltersBar(opts = {}) {
  // Compatibilidad:
  // - map.html actual: initFiltersBar({ mountId: "filtersBarMount" })
  // - versión antigua: initFiltersBar({ container, getInitial, onApply, onClear })
  injectStylesOnce();

  const container =
    opts.container ||
    (opts.mountId ? document.getElementById(opts.mountId) : null);

  if (!container) return;

  const mode = getModeFromUrl();
  const initial = (opts.getInitial ? opts.getInitial() : getInitialFromUrl()) || {};

  // Sugerencias (según tu definición)
  // Precio depende del tipo de oferta, que viene de mode en URL y NO es editable aquí.
  // buy/new_build: hasta 2.000.000; rent/room: hasta 3.000 (aprox).
  const priceSuggest =
    (mode === "rent" || mode === "room")
      ? [300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 1800, 2000, 2500, 3000]
      : [50000, 75000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 750000, 1000000, 1250000, 1500000, 1750000, 2000000];

  const usefulSuggest = [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200];
  const builtSuggest = [40, 50, 60, 75, 90, 100, 120, 140, 160, 180, 200, 250, 300, 400];

  const dlPrice = makeDatalist("dlPrice", priceSuggest);
  const dlUseful = makeDatalist("dlUseful", usefulSuggest);
  const dlBuilt = makeDatalist("dlBuilt", builtSuggest);

  // Inputs base
  const cityInp = el("input", { class: "fInp fInpWide", type: "text", placeholder: "Ciudad", value: initial.city || "" });

  const priceMin = el("input", { class: "fInp", type: "number", inputmode: "numeric", placeholder: "€ min", value: initial.priceMin ?? "", list: "dlPrice" });
  const priceMax = el("input", { class: "fInp", type: "number", inputmode: "numeric", placeholder: "€ max", value: initial.priceMax ?? "", list: "dlPrice" });

  const sinceSel = el("select", { class: "fSel" });
  [
    ["", "Ofertado desde: cualquiera"],
    ["1", "24h"],
    ["5", "5 días"],
    ["10", "10 días"],
    ["30", "30 días"],
    ["60", "60 días"]
  ].forEach(([v, t]) => sinceSel.appendChild(el("option", { value: v, text: t })));
  sinceSel.value = (initial.sinceDays != null) ? String(initial.sinceDays) : "";

  const availSel = el("select", { class: "fSel" });
  [
    ["", "Disponibilidad: cualquiera"],
    // MVP: en el mapa solo publicados. Mantengo el selector para respetar tu definición,
    // pero la opción principal que quieres ahora es "Publicados (MVP)".
    ["published", "Publicados (MVP)"],
    ["available", "Disponible"],
    ["negotiating", "Ofertado / negociación"],
    ["closed", "Alquilado / vendido"]
  ].forEach(([v, t]) => availSel.appendChild(el("option", { value: v, text: t })));
  availSel.value = initial.availability || "";

  const usefulMin = el("input", { class: "fInp", type: "number", inputmode: "numeric", placeholder: "m² útiles min", value: initial.usefulMin ?? "", list: "dlUseful" });
  const usefulMax = el("input", { class: "fInp", type: "number", inputmode: "numeric", placeholder: "m² útiles max", value: initial.usefulMax ?? "", list: "dlUseful" });

  const builtMin = el("input", { class: "fInp", type: "number", inputmode: "numeric", placeholder: "m² const. min", value: initial.builtMin ?? "", list: "dlBuilt" });
  const builtMax = el("input", { class: "fInp", type: "number", inputmode: "numeric", placeholder: "m² const. max", value: initial.builtMax ?? "", list: "dlBuilt" });

  const bedsSel = el("select", { class: "fSel" });
  [
    ["", "Dormitorios: cualquiera"],
    ["1", "1"],
    ["2", "2"],
    ["3", "3"],
    ["4", "4"],
    ["1+", "1+"],
    ["2+", "2+"],
    ["3+", "3+"],
    ["4+", "4+"]
  ].forEach(([v, t]) => bedsSel.appendChild(el("option", { value: v, text: t })));
  bedsSel.value = initial.bedrooms || "";

  const bathSel = el("select", { class: "fSel" });
  [
    ["", "Baños: cualquiera"],
    ["1", "1+"],
    ["2", "2+"],
    ["3", "3+"],
    ["4", "4+"],
    ["5", "5+"]
  ].forEach(([v, t]) => bathSel.appendChild(el("option", { value: v, text: t })));
  bathSel.value = (initial.bathroomsMin != null) ? String(initial.bathroomsMin) : "";

  const outdoorSel = el("select", { class: "fSel" });
  [
    ["", "Exterior: cualquiera"],
    ["balcon", "Balcón"],
    ["terraza", "Terraza"],
    ["jardin", "Jardín"],
    ["patio", "Patio"]
  ].forEach(([v, t]) => outdoorSel.appendChild(el("option", { value: v, text: t })));
  outdoorSel.value = initial.outdoorType || "";

  // Energy label: pendiente + letras exactas (tu lista completa)
  const energySel = el("select", { class: "fSel" });
  [
    ["", "Energía: cualquiera"],
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

  // Multi: orientación (solo si hay exterior)
  const orientationsMulti = multiDetails(
    "Orientación",
    ["N","NE","E","SE","S","SW","W","NW"],
    initial.orientations,
    null
  );

  // Multi: periodo de construcción
  const buildPeriodsMulti = multiDetails(
    "Periodo",
    ["<1950", "1950-1999", "2000+"],
    initial.buildPeriods,
    null
  );

  // Multi: parking
  const parkingMulti = multiDetails(
    "Parking",
    ["incluido", "opcional", "no_disponible"],
    initial.parking,
    null
  );

  // Multi: trastero
  const storageMulti = multiDetails(
    "Trastero",
    ["incluido", "no_incluido"],
    initial.storage,
    null
  );

  // Multi: accesibilidad (aquí tu regla dice: si selecciona varias, debe cumplir todas.
  // Eso es lógica de backend; en UI lo recogemos como CSV.
  const accessibilityMulti = multiDetails(
    "Accesibilidad",
    ["ascensor", "pmr"],
    initial.accessibility,
    null
  );

  // Botones
  const applyBtn = el("button", { class: "fBtn fBtnPrimary", type: "button", text: "Aplicar" });
  const clearBtn = el("button", { class: "fBtn", type: "button", text: "Limpiar" });

  function isRoomMode() {
    return mode === "room";
  }

  function refreshConditionalVisibility() {
    // Construidos no aparece en habitación
    const builtPill = container.querySelector('[data-pill="built"]');
    if (builtPill) builtPill.style.display = isRoomMode() ? "none" : "inline-flex";

    // Orientación solo si hay outdoor space
    const hasOutdoor = !!(outdoorSel.value || "").trim();
    orientationsMulti.setEnabled(hasOutdoor);
  }

  function read() {
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

    // Dormitorios: exact vs plus
    // - "X+" -> bedrooms_min = X
    // - "X"  -> aplicamos también como min X (en backend será >=X). Exacto lo afinaremos luego.
    const beds = (bedsSel.value || "").trim();
    let bedroomsMin = null;
    if (beds) {
      const isPlus = beds.endsWith("+");
      const num = parseInt(isPlus ? beds.slice(0, -1) : beds, 10);
      if (Number.isFinite(num)) bedroomsMin = num;
    }

    return {
      city: cityInp.value.trim(),

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

  async function applyNow() {
    const v = read();

    // Escribimos a la URL con los nombres que bh-map-core.js ya lee
    setUrlParams({
      city: v.city || null,

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

    if (opts.onApply) await opts.onApply(v);

    emitChanged();
  }

  async function clearNow() {
    // No reseteamos mode. City: la dejo tal cual esté en input (si quieres que tampoco cambie, no la toco).
    priceMin.value = "";
    priceMax.value = "";

    sinceSel.value = "";
    availSel.value = "";

    usefulMin.value = "";
    usefulMax.value = "";

    builtMin.value = "";
    builtMax.value = "";

    bedsSel.value = "";
    bathSel.value = "";

    outdoorSel.value = "";
    energySel.value = "";

    // Multi: reset cerrando y reconstruyendo estado (más simple: recargar página no; aquí borramos URL y emitimos)
    setUrlParams({
      price_min: null,
      price_max: null,
      since_days: null,
      availability: null,
      useful_min: null,
      useful_max: null,
      built_min: null,
      built_max: null,
      bedrooms_min: null,
      bathrooms_min: null,
      outdoor_type: null,
      orientations: null,
      energy: null,
      build_periods: null,
      parking: null,
      storage: null,
      accessibility: null
    });

    if (opts.onClear) await opts.onClear();

    // Para que el UI de multi refleje el reset sin complicarnos,
    // volvemos a inicializar la barra completa.
    initFiltersBar({ ...opts, container });
    emitChanged();
  }

  applyBtn.addEventListener("click", applyNow);
  clearBtn.addEventListener("click", clearNow);

  // Auto-apply opcional por cambios en selects (mantenemos conservador: solo refresco de visibilidad)
  outdoorSel.addEventListener("change", refreshConditionalVisibility);

  // Render
  container.innerHTML = "";

  const wrap = el("div", { class: "bhFiltersBar" }, [
    el("div", { class: "bhFiltersBarInner" }, [])
  ]);

  const inner = wrap.firstChild;

  // Datalists tienen que estar en DOM
  inner.appendChild(dlPrice);
  inner.appendChild(dlUseful);
  inner.appendChild(dlBuilt);

  function pill(label, contentNode, dataKey) {
    const node = el("div", { class: "fPill", "data-pill": dataKey || "" }, [
      el("div", { class: "fPillLabel", text: label }),
      contentNode
    ]);
    return node;
  }

  inner.appendChild(pill("Ciudad", cityInp, "city"));

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

  inner.appendChild(el("div", { class: "fPill" }, [applyBtn, clearBtn]));

  container.appendChild(wrap);

  refreshConditionalVisibility();

  // API mínima por si la usas luego
  return {
    readNow: read,
    applyNow
  };
}
