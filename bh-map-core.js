// bh-map-filters.js
// Crea los filtros en el contenedor mountId (columna izquierda)
// y emite eventos para que el mapa recargue resultados en vivo.

function el(tag, attrs, children) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else n.setAttribute(k, v);
    }
  }
  if (children) {
    for (const c of children) {
      if (c == null) continue;
      n.appendChild(c);
    }
  }
  return n;
}

function intOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v){
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function makeDatalist(id, options) {
  const dl = el("datalist", { id });
  (options || []).forEach((v) => {
    dl.appendChild(el("option", { value: String(v) }));
  });
  return dl;
}

function dispatchFiltersChanged(){
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

/* UI helpers */
function makeSection(titleText, clearFn){
  const dot = el("div", { class: "fDot", "aria-hidden": "true" });
  const title = el("div", { class: "fTitle", text: titleText });
  const xBtn = el("button", { class: "fX", type: "button", text: "×", title: "Limpiar este filtro" });

  xBtn.addEventListener("click", () => {
    clearFn?.();
    dispatchFiltersChanged();
  });

  const head = el("div", { class: "fHead" }, [dot, title, xBtn]);
  const body = el("div", { class: "fBody" });

  const wrap = el("div", { class: "fSection" }, [head, body]);

  function setActive(isActive){
    wrap.classList.toggle("active", !!isActive);
    xBtn.classList.toggle("active", !!isActive);
  }

  return { wrap, body, setActive };
}

function inputNumberNoSpinner({ placeholder, value, listId }){
  const inp = el("input", {
    type: "text",
    inputmode: "numeric",
    placeholder: placeholder || "",
    value: value ?? "",
    list: listId || ""
  });

  // Solo dígitos
  inp.addEventListener("input", () => {
    inp.value = inp.value.replace(/[^\d]/g, "");
  });

  // Abrir sugerencias al escribir (en algunos navegadores hace falta focus)
  inp.addEventListener("focus", () => {
    try { inp.setAttribute("autocomplete", "off"); } catch {}
  });

  return inp;
}

function radioRow(name, value, label){
  const id = `${name}_${value || "none"}_${Math.random().toString(16).slice(2)}`;
  const r = el("input", { type:"radio", name, id, value: value ?? "" });
  const lab = el("label", { for: id, text: label });
  return el("div", { class:"fRow" }, [r, lab]);
}

function checkRow(value, label){
  const id = `ck_${value}_${Math.random().toString(16).slice(2)}`;
  const c = el("input", { type:"checkbox", id, value });
  const lab = el("label", { for: id, text: label });
  return el("div", { class:"fRow" }, [c, lab]);
}

/* API principal */
export function initFiltersBar({ mountId }) {
  const container = document.getElementById(mountId);
  if (!container) return;

  // Leer modo desde URL para aplicar reglas (p.ej. built area no aparece en rooms)
  const u = new URL(window.location.href);
  const mode = (u.searchParams.get("mode") || "buy").toLowerCase();

  // Sugerencias según definición :contentReference[oaicite:2]{index=2}
  const PRICE_BUY = [50000, 75000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 750000, 1000000, 1500000, 2000000];
  const PRICE_RENT = [300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 1800, 2000, 2500, 3000];

  const priceSuggest = (mode === "rent" || mode === "room") ? PRICE_RENT : PRICE_BUY;

  const usefulSuggest = [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200];
  const builtSuggest  = [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200, 250, 300];

  // Datalists (necesitan estar en DOM)
  const dlPrice = makeDatalist("dlPrice", priceSuggest);
  const dlUseful = makeDatalist("dlUseful", usefulSuggest);
  const dlBuilt = makeDatalist("dlBuilt", builtSuggest);

  // Estructura base
  container.innerHTML = "";
  container.appendChild(dlPrice);
  container.appendChild(dlUseful);
  container.appendChild(dlBuilt);

  // Estado interno actual (para “Limpiar filtros” desde fuera)
  const state = {
    priceMin: null,
    priceMax: null,

    listedSinceDays: null,          // “Ofertado desde”
    availability: "available",      // Default fijo

    usefulMin: null,
    usefulMax: null,

    builtMin: null,
    builtMax: null,

    outdoorType: null,

    bedroomsMode: null, // "eq" o "gte"
    bedroomsVal: null,

    bathroomsMin: null,

    energyChoice: null,

    orientations: [],

    buildPeriods: [],

    parkingTypes: [],
    storageTypes: [],
    accessibility: []
  };

  function writeParamsToUrl(){
    const url = new URL(window.location.href);

    // helper
    const setOrDel = (k, v) => {
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) url.searchParams.delete(k);
      else url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
    };

    // Precio (swap si min>max)
    let pmin = state.priceMin;
    let pmax = state.priceMax;
    if (pmin != null && pmax != null && pmin > pmax) {
      const tmp = pmin; pmin = pmax; pmax = tmp;
      state.priceMin = pmin; state.priceMax = pmax;
    }

    setOrDel("price_min", pmin);
    setOrDel("price_max", pmax);

    setOrDel("since_days", state.listedSinceDays);

    // disponibilidad (siempre existe, pero solo ponemos param si no es default)
    // Como default es “available”, podemos no escribirlo para no ensuciar URL.
    if (state.availability && state.availability !== "available") setOrDel("availability", state.availability);
    else url.searchParams.delete("availability");

    setOrDel("useful_min", state.usefulMin);
    setOrDel("useful_max", state.usefulMax);

    setOrDel("built_min", state.builtMin);
    setOrDel("built_max", state.builtMax);

    setOrDel("outdoor_type", state.outdoorType);

    // bedrooms: guardamos como bedrooms_min y bedrooms_mode
    // eq (exacto): bedrooms_mode=eq y bedrooms_min=X
    // gte (X+): bedrooms_mode=gte y bedrooms_min=X
    setOrDel("bedrooms_mode", state.bedroomsMode);
    setOrDel("bedrooms_min", state.bedroomsVal);

    setOrDel("bathrooms_min", state.bathroomsMin);

    setOrDel("energy", state.energyChoice);

    setOrDel("orientations", state.orientations);

    setOrDel("build_periods", state.buildPeriods);
    setOrDel("parking", state.parkingTypes);
    setOrDel("storage", state.storageTypes);
    setOrDel("accessibility", state.accessibility);

    history.replaceState(null, "", url.toString());
  }

  function updateAndDispatch(){
    writeParamsToUrl();
    dispatchFiltersChanged();
    refreshActives();
  }

  function refreshActives(){
    // Marca como “activo” si tiene algo seleccionado (y pone X roja)
    secPrice.setActive(state.priceMin != null || state.priceMax != null);
    secSince.setActive(state.listedSinceDays != null);
    // Disponibilidad: activo si NO está en default (available) o si el usuario lo cambió
    secAvail.setActive(state.availability !== "available");
    secUseful.setActive(state.usefulMin != null || state.usefulMax != null);
    if (secBuilt) secBuilt.setActive(state.builtMin != null || state.builtMax != null);
    secOutdoor.setActive(!!state.outdoorType);
    secBeds.setActive(state.bedroomsVal != null);
    secBaths.setActive(state.bathroomsMin != null);
    secEnergy.setActive(!!state.energyChoice);
    secOri.setActive(state.orientations.length > 0);
    secPeriod.setActive(state.buildPeriods.length > 0);
    secPark.setActive(state.parkingTypes.length > 0);
    secStore.setActive(state.storageTypes.length > 0);
    secAcc.setActive(state.accessibility.length > 0);

    // Orientación solo si hay outdoor seleccionado
    secOri.wrap.style.display = state.outdoorType ? "" : "none";
  }

  // Lee URL inicial
  (function readInitialFromUrl(){
    const url = new URL(window.location.href);
    const gi = (k)=> url.searchParams.get(k);
    const gInt = (k)=> intOrNull(gi(k));
    const gArr = (k)=> {
      const v = gi(k);
      if (!v) return [];
      return v.split(",").map(s=>s.trim()).filter(Boolean);
    };

    state.priceMin = gInt("price_min");
    state.priceMax = gInt("price_max");
    state.listedSinceDays = gInt("since_days");

    // disponibilidad default “available”
    state.availability = (gi("availability") || "available").trim() || "available";

    state.usefulMin = gInt("useful_min");
    state.usefulMax = gInt("useful_max");
    state.builtMin  = gInt("built_min");
    state.builtMax  = gInt("built_max");

    state.outdoorType = strOrNull(gi("outdoor_type"));

    state.bedroomsMode = strOrNull(gi("bedrooms_mode"));
    state.bedroomsVal = gInt("bedrooms_min");

    state.bathroomsMin = gInt("bathrooms_min");

    state.energyChoice = strOrNull(gi("energy"));

    state.orientations = gArr("orientations");
    state.buildPeriods = gArr("build_periods");
    state.parkingTypes = gArr("parking");
    state.storageTypes = gArr("storage");
    state.accessibility = gArr("accessibility");
  })();

  // 1) Precio
  const secPrice = makeSection("Precio", () => {
    state.priceMin = null; state.priceMax = null;
    inpPriceMin.value = ""; inpPriceMax.value = "";
  });

  const inpPriceMin = inputNumberNoSpinner({ placeholder: "Min €", value: state.priceMin ?? "", listId: "dlPrice" });
  const inpPriceMax = inputNumberNoSpinner({ placeholder: "Max €", value: state.priceMax ?? "", listId: "dlPrice" });

  inpPriceMin.addEventListener("input", () => { state.priceMin = intOrNull(inpPriceMin.value); updateAndDispatch(); });
  inpPriceMax.addEventListener("input", () => { state.priceMax = intOrNull(inpPriceMax.value); updateAndDispatch(); });

  secPrice.body.appendChild(el("div",{class:"fTwo"},[
    el("div",{class:"fField"},[inpPriceMin]),
    el("div",{class:"fField"},[inpPriceMax]),
  ]));

  // 2) Ofertado desde
  const secSince = makeSection("Ofertado desde", () => {
    state.listedSinceDays = null;
    sinceGroup.querySelectorAll("input[type=radio]").forEach(r=> r.checked = false);
    // dejaremos “sin preferencia” como no seleccionado en UI (y state null)
  });

  const sinceGroup = el("div",{class:"fGroup"});
  const sinceName = "since_days";
  const sinceOpts = [
    { v: 1,  t: "Últimas 24 horas" },
    { v: 5,  t: "Últimos 5 días" },
    { v: 10, t: "Últimos 10 días" },
    { v: 30, t: "Últimos 30 días" },
    { v: 60, t: "Últimos 60 días" }
  ];

  sinceOpts.forEach(o=>{
    const row = radioRow(sinceName, String(o.v), o.t);
    const r = row.querySelector("input");
    if (state.listedSinceDays === o.v) r.checked = true;
    r.addEventListener("change", ()=>{ state.listedSinceDays = o.v; updateAndDispatch(); });
    sinceGroup.appendChild(row);
  });
  secSince.body.appendChild(sinceGroup);

  // 3) Disponibilidad (default “disponible” y NO se limpia en limpiar-filtros global)
  const secAvail = makeSection("Disponibilidad", () => {
    // limpiar individual sí vuelve al default
    state.availability = "available";
    availSel.value = "available";
  });

  const availSel = el("select", { class:"fSelect" });
  [
    ["available", "Disponible"],
    ["negotiation", "Ofertado / en negociación"],
    ["sold", "Alquilado / vendido"]
  ].forEach(([v,t])=> availSel.appendChild(el("option",{value:v,text:t})));

  // default visible “Disponible”
  availSel.value = state.availability || "available";
  availSel.addEventListener("change", ()=>{
    state.availability = availSel.value || "available";
    updateAndDispatch();
  });
  secAvail.body.appendChild(el("div",{class:"fOne"},[availSel]));

  // 4) Útiles
  const secUseful = makeSection("Superficie útil", () => {
    state.usefulMin=null; state.usefulMax=null;
    inpUsefulMin.value=""; inpUsefulMax.value="";
  });

  const inpUsefulMin = inputNumberNoSpinner({ placeholder:"Desde (m²)", value: state.usefulMin ?? "", listId:"dlUseful" });
  const inpUsefulMax = inputNumberNoSpinner({ placeholder:"Hasta (m²)", value: state.usefulMax ?? "", listId:"dlUseful" });

  inpUsefulMin.addEventListener("input", ()=>{ state.usefulMin=intOrNull(inpUsefulMin.value); updateAndDispatch(); });
  inpUsefulMax.addEventListener("input", ()=>{ state.usefulMax=intOrNull(inpUsefulMax.value); updateAndDispatch(); });

  secUseful.body.appendChild(el("div",{class:"fTwo"},[
    el("div",{class:"fField"},[inpUsefulMin]),
    el("div",{class:"fField"},[inpUsefulMax]),
  ]));

  // 5) Construidos (no aparece cuando mode=room)
  let secBuilt = null;
  let inpBuiltMin = null;
  let inpBuiltMax = null;
  if (mode !== "room") {
    secBuilt = makeSection("Superficie construida", () => {
      state.builtMin=null; state.builtMax=null;
      inpBuiltMin.value=""; inpBuiltMax.value="";
    });

    inpBuiltMin = inputNumberNoSpinner({ placeholder:"Desde (m²)", value: state.builtMin ?? "", listId:"dlBuilt" });
    inpBuiltMax = inputNumberNoSpinner({ placeholder:"Hasta (m²)", value: state.builtMax ?? "", listId:"dlBuilt" });

    inpBuiltMin.addEventListener("input", ()=>{ state.builtMin=intOrNull(inpBuiltMin.value); updateAndDispatch(); });
    inpBuiltMax.addEventListener("input", ()=>{ state.builtMax=intOrNull(inpBuiltMax.value); updateAndDispatch(); });

    secBuilt.body.appendChild(el("div",{class:"fTwo"},[
      el("div",{class:"fField"},[inpBuiltMin]),
      el("div",{class:"fField"},[inpBuiltMax]),
    ]));
  }

  // 6) Outdoor space (opción única, sin “sin”)
  const secOutdoor = makeSection("Outdoor space", () => {
    state.outdoorType = null;
    outdoorSel.value = "";
    // también limpia orientaciones al quitar outdoor
    state.orientations = [];
    oriGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);
  });

  const outdoorSel = el("select", { class:"fSelect" });
  outdoorSel.appendChild(el("option",{value:"",text:"Selecciona..."}));
  [
    ["balcony","Balcón"],
    ["terrace","Terraza"],
    ["garden","Jardín"],
    ["patio","Patio"]
  ].forEach(([v,t])=> outdoorSel.appendChild(el("option",{value:v,text:t})));

  outdoorSel.value = state.outdoorType || "";
  outdoorSel.addEventListener("change", ()=>{
    state.outdoorType = outdoorSel.value || null;
    // regla: orientación solo aparece si hay outdoor
    if (!state.outdoorType) {
      state.orientations = [];
      oriGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);
    }
    updateAndDispatch();
  });
  secOutdoor.body.appendChild(el("div",{class:"fOne"},[outdoorSel]));

  // 7) Dormitorios (1,2,3,4 y 1+,2+,3+,4+)
  const secBeds = makeSection("Dormitorios", () => {
    state.bedroomsMode = null;
    state.bedroomsVal = null;
    bedsSel.value = "";
  });

  const bedsSel = el("select", { class:"fSelect" });
  bedsSel.appendChild(el("option",{value:"",text:"Sin preferencia"}));
  [
    ["eq:1","1"],
    ["eq:2","2"],
    ["eq:3","3"],
    ["eq:4","4"],
    ["gte:1","1+"],
    ["gte:2","2+"],
    ["gte:3","3+"],
    ["gte:4","4+"],
  ].forEach(([v,t])=> bedsSel.appendChild(el("option",{value:v,text:t})));

  if (state.bedroomsMode && state.bedroomsVal != null){
    bedsSel.value = `${state.bedroomsMode}:${state.bedroomsVal}`;
  } else {
    bedsSel.value = "";
  }

  bedsSel.addEventListener("change", ()=>{
    const v = bedsSel.value || "";
    if (!v) { state.bedroomsMode=null; state.bedroomsVal=null; updateAndDispatch(); return; }
    const [m,x] = v.split(":");
    state.bedroomsMode = m;
    state.bedroomsVal = intOrNull(x);
    updateAndDispatch();
  });
  secBeds.body.appendChild(el("div",{class:"fOne"},[bedsSel]));

  // 8) Baños (mínimo 1..5)
  const secBaths = makeSection("Baños", () => {
    state.bathroomsMin = null;
    bathsSel.value = "";
  });

  const bathsSel = el("select", { class:"fSelect" });
  bathsSel.appendChild(el("option",{value:"",text:"Sin preferencia"}));
  [1,2,3,4,5].forEach(n=> bathsSel.appendChild(el("option",{value:String(n),text:String(n)})));
  bathsSel.value = (state.bathroomsMin != null) ? String(state.bathroomsMin) : "";
  bathsSel.addEventListener("change", ()=>{
    state.bathroomsMin = intOrNull(bathsSel.value);
    updateAndDispatch();
  });
  secBaths.body.appendChild(el("div",{class:"fOne"},[bathsSel]));

  // 9) Energy label (opción única)
  const secEnergy = makeSection("Energía", () => {
    state.energyChoice = null;
    energySel.value = "";
  });

  const energySel = el("select", { class:"fSelect" });
  energySel.appendChild(el("option",{value:"",text:"Sin preferencia"}));
  [
    ["pending","Pendiente"],
    ["A+++++","A+++++"],
    ["A++++","A++++"],
    ["A+++","A+++"],
    ["A++","A++"],
    ["A+","A+"],
    ["A","A"],
    ["B","B"],
    ["C","C"],
    ["D","D"],
    ["E","E"],
    ["F","F"],
    ["G","G"],
  ].forEach(([v,t])=> energySel.appendChild(el("option",{value:v,text:t})));

  energySel.value = state.energyChoice || "";
  energySel.addEventListener("change", ()=>{
    state.energyChoice = energySel.value || null;
    updateAndDispatch();
  });
  secEnergy.body.appendChild(el("div",{class:"fOne"},[energySel]));

  // 10) Orientación (multi) solo si hay outdoor
  const secOri = makeSection("Orientación del balcón", () => {
    state.orientations = [];
    oriGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);
  });

  const oriGroup = el("div",{class:"fGroup"});
  const ORIS = ["N","NE","E","SE","S","SW","W","NW"];
  ORIS.forEach(o=>{
    const row = checkRow(o, o);
    const c = row.querySelector("input");
    c.checked = state.orientations.includes(o);
    c.addEventListener("change", ()=>{
      const set = new Set(state.orientations);
      if (c.checked) set.add(o); else set.delete(o);
      state.orientations = Array.from(set);
      updateAndDispatch();
    });
    oriGroup.appendChild(row);
  });
  secOri.body.appendChild(oriGroup);

  // 11) Periodo construcción (multi)
  const secPeriod = makeSection("Periodo de construcción", () => {
    state.buildPeriods = [];
    periodGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);
  });

  const periodGroup = el("div",{class:"fGroup"});
  const PERIODS = [
    ["pre1950","Anterior a 1950"],
    ["1950_1999","1950–1999"],
    ["2000plus","2000 en adelante"]
  ];
  PERIODS.forEach(([v,t])=>{
    const row = checkRow(v, t);
    const c = row.querySelector("input");
    c.checked = state.buildPeriods.includes(v);
    c.addEventListener("change", ()=>{
      const set = new Set(state.buildPeriods);
      if (c.checked) set.add(v); else set.delete(v);
      state.buildPeriods = Array.from(set);
      updateAndDispatch();
    });
    periodGroup.appendChild(row);
  });
  secPeriod.body.appendChild(periodGroup);

  // 12) Parking (multi)
  const secPark = makeSection("Parking", () => {
    state.parkingTypes = [];
    parkGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);
  });

  const parkGroup = el("div",{class:"fGroup"});
  [
    ["included","Incluido"],
    ["optional","Opcional"],
    ["none","No disponible"]
  ].forEach(([v,t])=>{
    const row = checkRow(v, t);
    const c = row.querySelector("input");
    c.checked = state.parkingTypes.includes(v);
    c.addEventListener("change", ()=>{
      const set = new Set(state.parkingTypes);
      if (c.checked) set.add(v); else set.delete(v);
      state.parkingTypes = Array.from(set);
      updateAndDispatch();
    });
    parkGroup.appendChild(row);
  });
  secPark.body.appendChild(parkGroup);

  // 13) Trastero (multi)
  const secStore = makeSection("Trastero", () => {
    state.storageTypes = [];
    storeGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);
  });

  const storeGroup = el("div",{class:"fGroup"});
  [
    ["included","Incluido"],
    ["not_included","No incluido"]
  ].forEach(([v,t])=>{
    const row = checkRow(v, t);
    const c = row.querySelector("input");
    c.checked = state.storageTypes.includes(v);
    c.addEventListener("change", ()=>{
      const set = new Set(state.storageTypes);
      if (c.checked) set.add(v); else set.delete(v);
      state.storageTypes = Array.from(set);
      updateAndDispatch();
    });
    storeGroup.appendChild(row);
  });
  secStore.body.appendChild(storeGroup);

  // 14) Accesibilidad (multi) -> si hay varias, debe cumplir todas (backend @>)
  const secAcc = makeSection("Accesibilidad", () => {
    state.accessibility = [];
    accGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);
  });

  const accGroup = el("div",{class:"fGroup"});
  [
    ["elevator","Ascensor"],
    ["reduced_mobility","Adaptado a movilidad reducida"]
  ].forEach(([v,t])=>{
    const row = checkRow(v, t);
    const c = row.querySelector("input");
    c.checked = state.accessibility.includes(v);
    c.addEventListener("change", ()=>{
      const set = new Set(state.accessibility);
      if (c.checked) set.add(v); else set.delete(v);
      state.accessibility = Array.from(set);
      updateAndDispatch();
    });
    accGroup.appendChild(row);
  });
  secAcc.body.appendChild(accGroup);

  // Montaje DOM en orden
  const all = [
    secPrice.wrap,
    secSince.wrap,
    secAvail.wrap,
    secUseful.wrap,
    secBuilt ? secBuilt.wrap : null,
    secOutdoor.wrap,
    secBeds.wrap,
    secBaths.wrap,
    secEnergy.wrap,
    secOri.wrap,
    secPeriod.wrap,
    secPark.wrap,
    secStore.wrap,
    secAcc.wrap
  ].filter(Boolean);

  all.forEach(n=> container.appendChild(n));

  // Estilos mínimos para la columna filtros (compacto + anterior “tarjeta”)
  // (Esto va aquí porque me pediste archivos completos, y no depender de otro CSS.)
  const style = document.createElement("style");
  style.textContent = `
    .fSection{
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,0.10);
      background: #fff;
      box-shadow: 0 10px 26px rgba(0,0,0,0.06);
      margin-bottom: 12px;
      overflow: hidden;
    }
    .fHead{
      display: grid;
      grid-template-columns: 18px 1fr 34px;
      align-items: center;
      gap: 10px;
      padding: 12px 12px 10px;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
    .fDot{
      width: 10px;
      height: 10px;
      border-radius: 999px;
      border: 2px solid rgba(26,115,232,0.85);
      background: transparent;
    }
    .fSection.active .fDot{
      background: rgba(26,115,232,0.92);
    }
    .fTitle{
      font-size: 16px;
      font-weight: 650;
      color: rgba(0,0,0,0.86);
    }
    .fX{
      width: 30px;
      height: 30px;
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.10);
      background: rgba(255,255,255,0.96);
      cursor: pointer;
      color: rgba(0,0,0,0.55);
      font-size: 18px;
      line-height: 1;
    }
    .fX.active{
      border-color: rgba(220,38,38,0.35);
      color: rgba(220,38,38,0.95);
    }
    .fBody{ padding: 10px 12px 12px; }
    .fTwo{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .fOne{ display: grid; grid-template-columns: 1fr; }
    .fField input{
      width: 100%;
      height: 44px;
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,0.14);
      padding: 0 14px;
      font-size: 14px;
      outline: none;
      background: #fff;
    }
    .fSelect{
      width: 100%;
      height: 44px;
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,0.14);
      padding: 0 12px;
      font-size: 14px;
      outline: none;
      background: #fff;
      color: rgba(0,0,0,0.86);
    }
    .fGroup{ display: grid; gap: 8px; }
    .fRow{
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 10px;
      align-items: center;
      padding: 4px 2px; /* interlineado más compacto */
    }
    .fRow label{
      font-size: 14px;
      color: rgba(0,0,0,0.78);
      cursor: pointer;
    }
    .fRow input{ width: 18px; height: 18px; }
  `;
  document.head.appendChild(style);

  // Exponer funciones para “Limpiar filtros” global desde bh-map-core.js
  // (no tocamos disponibilidad: se mantiene “available”)
  window.__bhFilters = {
    clearAllExceptAvailability: () => {
      state.priceMin=null; state.priceMax=null;
      inpPriceMin.value=""; inpPriceMax.value="";

      state.listedSinceDays=null;
      sinceGroup.querySelectorAll("input[type=radio]").forEach(r=> r.checked=false);

      state.usefulMin=null; state.usefulMax=null;
      inpUsefulMin.value=""; inpUsefulMax.value="";

      if (secBuilt) {
        state.builtMin=null; state.builtMax=null;
        inpBuiltMin.value=""; inpBuiltMax.value="";
      }

      state.outdoorType=null;
      outdoorSel.value="";
      state.orientations=[];
      oriGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);

      state.bedroomsMode=null; state.bedroomsVal=null;
      bedsSel.value="";

      state.bathroomsMin=null;
      bathsSel.value="";

      state.energyChoice=null;
      energySel.value="";

      state.buildPeriods=[];
      periodGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);

      state.parkingTypes=[];
      parkGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);

      state.storageTypes=[];
      storeGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);

      state.accessibility=[];
      accGroup.querySelectorAll("input[type=checkbox]").forEach(c=> c.checked=false);

      // disponibilidad NO se toca (state.availability se mantiene)
      updateAndDispatch();
    }
  };

  // Estado activo inicial y primer “dispatch” (para que el mapa lea default availability)
  refreshActives();
  updateAndDispatch();
}
