/* =========================================================
   bh-map-core.js (COMPLETO)
   - Incluye tu Supabase key
   - Periodo de construcción: antes de 1950, luego 1950-1960 ... hasta 2010-2020, y 2020+
   ========================================================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------------------------
   Utilidades UI
--------------------------- */
const $ = (sel) => document.querySelector(sel);

function showStatus(text){
  const el = $("#mapStatus");
  el.textContent = text;
  el.classList.remove("bh-hidden");
}
function hideStatus(){
  $("#mapStatus").classList.add("bh-hidden");
}

function euro(n){
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("es-ES") + " €";
}
function m2(n){
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("es-ES")} m²`;
}

/* ---------------------------
   Estado global
--------------------------- */
const state = {
  mode: "buy",
  city: "",
  filtersHidden: false,
  listHidden: false,
  sort: "date_desc",
  hoveredId: null,
  selectedId: null,

  // filtros
  filters: {
    priceMin: "",
    priceMax: "",
    listedSince: "", // 24h, 5d, 10d, 30d, 60d
    availability: "available", // por defecto "Disponible"
    usefulMin: "",
    usefulMax: "",
    builtMin: "",
    builtMax: "",
    outdoorSpace: "", // balcony/terrace/garden/patio
    buildPeriod: ""  // antes1950, 1950-1960, ... 2020+
  },

  points: [],
};

function getUrlParams(){
  const sp = new URLSearchParams(location.search);
  const city = (sp.get("city") || "").trim();
  const mode = (sp.get("mode") || "buy").trim();
  return { city, mode };
}

/* ---------------------------
   Layout: ocultar/mostrar columnas
--------------------------- */
function applyLayout(){
  const shell = $("#mapShell");
  shell.classList.toggle("filtersHidden", state.filtersHidden);
  shell.classList.toggle("listHidden", state.listHidden);

  $("#filtersCol").classList.toggle("bh-hidden", state.filtersHidden);
  $("#listCol").classList.toggle("bh-hidden", state.listHidden);

  $("#toggleFiltersBtn").textContent = state.filtersHidden ? "Mostrar filtros" : "Ocultar filtros";
  $("#toggleListBtn").textContent = state.listHidden ? "Mostrar listado" : "Ocultar listado";

  // “Ordenar por” solo si listado visible
  $("#sortWrap").classList.toggle("bh-hidden", state.listHidden);

  const sideW = getComputedStyle(document.documentElement).getPropertyValue("--sideW").trim() || "260px";
  const topRow = document.querySelector(".topRow");
  const mainGrid = document.querySelector(".mainGrid");

  const left = state.filtersHidden ? "0px" : sideW;
  const right = state.listHidden ? "0px" : sideW;

  topRow.style.gridTemplateColumns = `${left} 1fr ${right}`;
  mainGrid.style.gridTemplateColumns = `${left} 1fr ${right}`;

  requestAnimationFrame(() => {
    if (window.__bh_map) {
      setTimeout(() => window.__bh_map.invalidateSize(true), 60);
    }
  });
}

/* ---------------------------
   Breadcrumb: reverse geocode según centro
--------------------------- */
let crumbAbort = null;
async function updateCrumbFromMapCenter(map){
  const center = map.getCenter();
  const lat = center.lat;
  const lon = center.lng;

  if (crumbAbort) crumbAbort.abort();
  crumbAbort = new AbortController();

  try{
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=12&addressdetails=1`;
    const res = await fetch(url, { signal: crumbAbort.signal, headers: { "Accept":"application/json" } });
    if (!res.ok) throw new Error("reverse geocode failed");
    const data = await res.json();

    const a = data.address || {};
    const region = a.state || a.region || a.county || "";
    const city = a.city || a.town || a.village || a.municipality || state.city || "";
    const zone = a.suburb || a.neighbourhood || a.hamlet || a.quarter || a.city_district || "";

    const parts = [region, city, zone].filter(Boolean);
    $("#crumbText").textContent = parts.length ? parts.join(" / ") : (state.city || "—");
  }catch(e){
    $("#crumbText").textContent = state.city || "—";
  }
}

/* ---------------------------
   Filtros: render
--------------------------- */
function suggestListForPrice(mode){
  if (mode === "rent") return [300,400,500,600,700,800,900,1000,1200,1500,1800,2000,2500,3000];
  return [50000,80000,100000,120000,150000,180000,200000,250000,300000,350000,400000,450000,500000,650000,800000,1000000,1250000,1500000,2000000];
}
function suggestListForUseful(){
  return [30,40,50,60,75,90,100,110,130,150,200];
}

function buildConstructionPeriodOptions(){
  // antes de 1950
  // luego 1950-1960, 1960-1970, ... 2010-2020, y 2020+
  const opts = [];
  opts.push({ k:"", t:"Sin preferencia" });
  opts.push({ k:"pre1950", t:"Antes de 1950" });

  for (let y = 1950; y <= 2010; y += 10){
    const y2 = y + 10;
    opts.push({ k:`${y}_${y2}`, t:`${y}-${y2}` });
  }

  opts.push({ k:"2020_plus", t:"2020+" });
  return opts;
}

function renderFilters(){
  const root = $("#filtersRoot");
  root.innerHTML = "";

  const block = (title, applied, onClear) => {
    const wrap = document.createElement("div");
    wrap.className = "fBlock";

    const head = document.createElement("div");
    head.className = "fHead";

    const dot = document.createElement("div");
    dot.className = "fDot";

    const t = document.createElement("div");
    t.className = "fTitle";
    t.textContent = title;

    const x = document.createElement("button");
    x.className = "fClear" + (applied ? " applied" : "");
    x.type = "button";
    x.textContent = "×";
    x.addEventListener("click", () => onClear());

    head.append(dot, t, x);

    const body = document.createElement("div");
    body.className = "fBody";

    wrap.append(head, body);
    return { wrap, body };
  };

  const numericWithSuggest = ({ placeholder, value, onChange, suggestions }) => {
    const w = document.createElement("div");
    w.className = "suggestWrap";

    const inp = document.createElement("input");
    inp.className = "fInput";
    inp.inputMode = "numeric";
    inp.placeholder = placeholder;
    inp.value = value ?? "";

    const menu = document.createElement("div");
    menu.className = "suggestMenu bh-hidden";

    const closeMenu = () => menu.classList.add("bh-hidden");
    const openMenu = () => menu.classList.remove("bh-hidden");

    const drawItems = (filterText="") => {
      menu.innerHTML = "";
      const s = (suggestions || []).filter(n => String(n).includes(filterText));
      s.slice(0, 30).forEach(n => {
        const it = document.createElement("div");
        it.className = "suggestItem";
        it.textContent = String(n);
        it.addEventListener("click", () => {
          inp.value = String(n);
          onChange(String(n));
          closeMenu();
          triggerSearch();
        });
        menu.append(it);
      });
      if (!menu.childNodes.length){
        const it = document.createElement("div");
        it.className = "suggestItem";
        it.textContent = "Sin sugerencias";
        it.style.cursor = "default";
        it.style.color = "rgba(0,0,0,.5)";
        menu.append(it);
      }
    };

    drawItems("");

    inp.addEventListener("focus", () => {
      drawItems(inp.value.trim());
      openMenu();
    });
    inp.addEventListener("input", () => {
      const v = inp.value.replace(/[^\d]/g, "");
      inp.value = v;
      onChange(v);
      drawItems(v);
      openMenu();
    });
    inp.addEventListener("blur", () => setTimeout(closeMenu, 150));

    w.append(inp, menu);
    return w;
  };

  // Precio
  {
    const applied = !!(state.filters.priceMin || state.filters.priceMax);
    const { wrap, body } = block("Precio", applied, () => {
      state.filters.priceMin = "";
      state.filters.priceMax = "";
      renderFilters();
      triggerSearch();
    });

    const row = document.createElement("div");
    row.className = "fTwo";

    const sug = suggestListForPrice(state.mode);

    const min = numericWithSuggest({
      placeholder:"Min €",
      value: state.filters.priceMin,
      suggestions: sug,
      onChange:(v)=>{ state.filters.priceMin = v; }
    });
    const max = numericWithSuggest({
      placeholder:"Max €",
      value: state.filters.priceMax,
      suggestions: sug,
      onChange:(v)=>{ state.filters.priceMax = v; }
    });

    row.append(min, max);
    body.append(row);

    const normalize = () => {
      const a = Number(state.filters.priceMin || 0);
      const b = Number(state.filters.priceMax || 0);
      if (a && b && a > b){
        const tmp = state.filters.priceMin;
        state.filters.priceMin = state.filters.priceMax;
        state.filters.priceMax = tmp;
        renderFilters();
      }
    };
    row.addEventListener("change", () => { normalize(); triggerSearch(); });

    root.append(wrap);
  }

  // Ofertado desde
  {
    const applied = !!state.filters.listedSince;
    const { wrap, body } = block("Ofertado desde", applied, () => {
      state.filters.listedSince = "";
      renderFilters();
      triggerSearch();
    });

    const opts = [
      { k:"24h", t:"Últimas 24 horas" },
      { k:"5d",  t:"Últimos 5 días" },
      { k:"10d", t:"Últimos 10 días" },
      { k:"30d", t:"Últimos 30 días" },
      { k:"60d", t:"Últimos 60 días" },
    ];

    opts.forEach(o=>{
      const row = document.createElement("div");
      row.className = "fRadRow";
      const r = document.createElement("input");
      r.type="radio";
      r.name="listedSince";
      r.checked = state.filters.listedSince === o.k;
      r.addEventListener("change", ()=>{
        state.filters.listedSince = o.k;
        renderFilters();
        triggerSearch();
      });
      const lab = document.createElement("label");
      lab.textContent = o.t;
      row.append(r, lab);
      body.append(row);
    });

    root.append(wrap);
  }

  // Periodo de construcción (cerrado como pediste)
  {
    const applied = !!state.filters.buildPeriod;
    const { wrap, body } = block("Periodo de construcción", applied, () => {
      state.filters.buildPeriod = "";
      renderFilters();
      triggerSearch();
    });

    const sel = document.createElement("select");
    sel.className = "fSelect";

    const opts = buildConstructionPeriodOptions();
    opts.forEach(o=>{
      const op = document.createElement("option");
      op.value = o.k;
      op.textContent = o.t;
      sel.append(op);
    });

    sel.value = state.filters.buildPeriod;
    sel.addEventListener("change", ()=>{
      state.filters.buildPeriod = sel.value;
      renderFilters();
      triggerSearch();
    });

    body.append(sel);
    root.append(wrap);
  }

  // Disponibilidad (por defecto “Disponible”)
  {
    const applied = state.filters.availability !== "available";
    const { wrap, body } = block("Disponibilidad", applied, () => {
      state.filters.availability = "available";
      renderFilters();
      triggerSearch();
    });

    const sel = document.createElement("select");
    sel.className = "fSelect";
    [
      { k:"available", t:"Disponible" },
      { k:"negotiation", t:"Ofertado / en negociación" },
      { k:"closed", t:"Alquilado / vendido" }
    ].forEach(o=>{
      const op = document.createElement("option");
      op.value = o.k;
      op.textContent = o.t;
      sel.append(op);
    });
    sel.value = state.filters.availability;
    sel.addEventListener("change", ()=>{
      state.filters.availability = sel.value;
      renderFilters();
      triggerSearch();
    });
    body.append(sel);
    root.append(wrap);
  }

  // Superficie útil
  {
    const applied = !!(state.filters.usefulMin || state.filters.usefulMax);
    const { wrap, body } = block("Superficie útil", applied, () => {
      state.filters.usefulMin = "";
      state.filters.usefulMax = "";
      renderFilters();
      triggerSearch();
    });

    const row = document.createElement("div");
    row.className = "fTwo";

    const sug = suggestListForUseful();
    const min = numericWithSuggest({
      placeholder:"Desde (m²)",
      value: state.filters.usefulMin,
      suggestions: sug,
      onChange:(v)=>{ state.filters.usefulMin = v; }
    });
    const max = numericWithSuggest({
      placeholder:"Hasta (m²)",
      value: state.filters.usefulMax,
      suggestions: sug,
      onChange:(v)=>{ state.filters.usefulMax = v; }
    });
    row.append(min, max);
    body.append(row);
    row.addEventListener("change", ()=> triggerSearch());
    root.append(wrap);
  }

  // Superficie construida (si no es habitación)
  if (state.mode !== "room"){
    const applied = !!(state.filters.builtMin || state.filters.builtMax);
    const { wrap, body } = block("Superficie construida", applied, () => {
      state.filters.builtMin = "";
      state.filters.builtMax = "";
      renderFilters();
      triggerSearch();
    });

    const row = document.createElement("div");
    row.className = "fTwo";

    const sug = suggestListForUseful();
    const min = numericWithSuggest({
      placeholder:"Desde (m²)",
      value: state.filters.builtMin,
      suggestions: sug,
      onChange:(v)=>{ state.filters.builtMin = v; }
    });
    const max = numericWithSuggest({
      placeholder:"Hasta (m²)",
      value: state.filters.builtMax,
      suggestions: sug,
      onChange:(v)=>{ state.filters.builtMax = v; }
    });
    row.append(min, max);
    body.append(row);
    row.addEventListener("change", ()=> triggerSearch());
    root.append(wrap);
  }

  // Espacio exterior
  {
    const applied = !!state.filters.outdoorSpace;
    const { wrap, body } = block("Espacio exterior", applied, () => {
      state.filters.outdoorSpace = "";
      renderFilters();
      triggerSearch();
    });

    const opts = [
      { k:"", t:"Sin preferencia" },
      { k:"balcony", t:"Balcón" },
      { k:"terrace", t:"Terraza" },
      { k:"garden", t:"Jardín" },
      { k:"patio", t:"Patio" },
    ];

    const sel = document.createElement("select");
    sel.className = "fSelect";
    opts.forEach(o=>{
      const op = document.createElement("option");
      op.value = o.k;
      op.textContent = o.t;
      sel.append(op);
    });
    sel.value = state.filters.outdoorSpace;
    sel.addEventListener("change", ()=>{
      state.filters.outdoorSpace = sel.value;
      renderFilters();
      triggerSearch();
    });
    body.append(sel);
    root.append(wrap);
  }
}

/* Limpiar filtros: resetea todo excepto disponibilidad */
function clearAllFilters(){
  state.filters.priceMin = "";
  state.filters.priceMax = "";
  state.filters.listedSince = "";
  state.filters.usefulMin = "";
  state.filters.usefulMax = "";
  state.filters.builtMin = "";
  state.filters.builtMax = "";
  state.filters.outdoorSpace = "";
  state.filters.buildPeriod = "";
  renderFilters();
  triggerSearch();
}

/* ---------------------------
   Ordenación
--------------------------- */
function applySort(arr){
  const a = [...arr];
  const s = state.sort;

  const num = (v) => (v == null ? null : Number(v));
  const dt = (v) => (v ? new Date(v).getTime() : 0);

  if (s === "date_desc") a.sort((x,y)=> dt(y.listed_at) - dt(x.listed_at));
  if (s === "date_asc")  a.sort((x,y)=> dt(x.listed_at) - dt(y.listed_at));
  if (s === "price_desc") a.sort((x,y)=> (num(y.price_eur)||0) - (num(x.price_eur)||0));
  if (s === "price_asc")  a.sort((x,y)=> (num(x.price_eur)||0) - (num(y.price_eur)||0));

  const size = (o) => num(o.useful_area_m2 ?? o.built_area_m2) || 0;
  if (s === "size_asc")  a.sort((x,y)=> size(x) - size(y));
  if (s === "size_desc") a.sort((x,y)=> size(y) - size(x));

  return a;
}

/* ---------------------------
   Listado
--------------------------- */
function renderList(){
  const root = $("#listRoot");
  root.innerHTML = "";

  const items = applySort(state.points);

  items.forEach(p=>{
    const card = document.createElement("div");
    card.className = "listCard";
    card.dataset.id = p.id;

    card.addEventListener("mouseenter", ()=>{
      state.hoveredId = p.id;
      updateMarkerStyles();
    });
    card.addEventListener("mouseleave", ()=>{
      state.hoveredId = null;
      updateMarkerStyles();
    });

    card.addEventListener("click", ()=>{
      selectListing(p.id, { panTo:true });
    });

    const th = document.createElement("div");
    th.className = "listThumb";
    if (p.photo_url){
      const img = document.createElement("img");
      img.src = p.photo_url;
      img.alt = "";
      th.innerHTML = "";
      th.append(img);
    }else{
      th.textContent = "Foto";
    }

    const info = document.createElement("div");

    const title = document.createElement("div");
    title.className = "listTitle";
    title.textContent = p.title ?? "—";

    const sub = document.createElement("div");
    sub.className = "listSub";
    sub.textContent = (p.postcode && p.city) ? `${p.postcode} ${p.city}` : (p.city ?? "—");

    const price = document.createElement("div");
    price.className = "listPrice";
    price.textContent = euro(p.price_eur);

    const facts = document.createElement("div");
    facts.className = "listFacts";
    const u = p.useful_area_m2 != null ? `${m2(p.useful_area_m2)} ·` : "";
    const type = p.home_type ?? "—";
    facts.textContent = `${u} ${type}`.trim();

    const ag = document.createElement("div");
    ag.className = "listAgency";
    ag.textContent = p.agency_name ?? "—";

    info.append(title, sub, price, facts, ag);

    card.append(th, info);
    root.append(card);
  });

  if (!items.length){
    const empty = document.createElement("div");
    empty.style.padding = "10px";
    empty.style.color = "rgba(0,0,0,.6)";
    empty.textContent = "No hay anuncios en esta zona con los filtros actuales.";
    root.append(empty);
  }
}

/* ---------------------------
   Mapa + marcadores
--------------------------- */
let markersById = new Map();

function markerHtml(kind){
  const base = document.createElement("div");
  base.style.width = "16px";
  base.style.height = "16px";
  base.style.borderRadius = "999px";
  base.style.boxShadow = "0 6px 16px rgba(0,0,0,.18)";

  if (kind === "selected"){
    base.style.background = "#1a73e8";
    base.style.border = "3px solid white";
  } else if (kind === "seen"){
    base.style.background = "white";
    base.style.border = "3px solid #f59e0b";
  } else if (kind === "hover"){
    base.style.background = "#f59e0b";
    base.style.border = "3px solid rgba(26,115,232,.6)";
  } else {
    base.style.background = "#f59e0b";
    base.style.border = "3px solid white";
  }
  return base.outerHTML;
}

function isSeen(id){
  try{
    const raw = localStorage.getItem("bh_seen_ids") || "[]";
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.includes(id);
  }catch{ return false; }
}
function markSeen(id){
  try{
    const raw = localStorage.getItem("bh_seen_ids") || "[]";
    const arr = JSON.parse(raw);
    const next = Array.isArray(arr) ? arr : [];
    if (!next.includes(id)) next.push(id);
    localStorage.setItem("bh_seen_ids", JSON.stringify(next));
  }catch{}
}

function updateMarkerStyles(){
  for (const [id, m] of markersById.entries()){
    const selected = state.selectedId === id;
    const hovered = state.hoveredId === id;
    const seen = isSeen(id);

    let kind = "normal";
    if (selected) kind = "selected";
    else if (hovered) kind = "hover";
    else if (seen) kind = "seen";

    m.setIcon(L.divIcon({
      className: "bh-pin",
      html: markerHtml(kind),
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    }));
  }
}

function clearSelection(){
  state.selectedId = null;
  $("#mapCardHost").innerHTML = "";
  updateMarkerStyles();
}

function renderMapCard(p){
  const host = $("#mapCardHost");
  host.innerHTML = "";

  const card = document.createElement("div");
  card.style.pointerEvents = "auto";
  card.style.background = "rgba(255,255,255,.96)";
  card.style.border = "1px solid rgba(0,0,0,.10)";
  card.style.borderRadius = "22px";
  card.style.boxShadow = "0 18px 45px rgba(0,0,0,.18)";
  card.style.display = "grid";
  card.style.gridTemplateColumns = "240px 1fr";
  card.style.overflow = "hidden";

  const left = document.createElement("div");
  left.style.height = "140px";
  left.style.background = "rgba(0,0,0,.06)";
  left.style.position = "relative";

  if (p.photo_url){
    const img = document.createElement("img");
    img.src = p.photo_url;
    img.alt = "";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    left.append(img);
  }

  const right = document.createElement("div");
  right.style.padding = "14px 16px";
  right.style.display = "flex";
  right.style.flexDirection = "column";
  right.style.gap = "6px";

  const row1 = document.createElement("div");
  row1.style.display = "flex";
  row1.style.alignItems = "flex-start";
  row1.style.gap = "10px";

  const title = document.createElement("div");
  title.style.fontSize = "28px";
  title.style.fontWeight = "900";
  title.style.color = "#1a73e8";
  title.style.lineHeight = "1.1";
  title.textContent = p.title ?? "—";

  const actions = document.createElement("div");
  actions.style.marginLeft = "auto";
  actions.style.display = "flex";
  actions.style.gap = "10px";

  const fav = document.createElement("button");
  fav.type = "button";
  fav.textContent = "♡";
  fav.style.width = "44px";
  fav.style.height = "44px";
  fav.style.borderRadius = "999px";
  fav.style.border = "1px solid rgba(0,0,0,.2)";
  fav.style.background = "#fff";
  fav.style.cursor = "pointer";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.style.width = "56px";
  close.style.height = "44px";
  close.style.borderRadius = "16px";
  close.style.border = "0";
  close.style.background = "#1a73e8";
  close.style.color = "#fff";
  close.style.fontSize = "22px";
  close.style.cursor = "pointer";
  close.addEventListener("click", ()=>{
    clearSelection();
  });

  actions.append(fav, close);

  row1.append(title, actions);

  const loc = document.createElement("div");
  loc.style.fontSize = "22px";
  loc.style.fontWeight = "700";
  loc.textContent = (p.postcode && p.city) ? `${p.postcode} ${p.city}` : (p.city ?? "—");

  const price = document.createElement("div");
  price.style.fontSize = "30px";
  price.style.fontWeight = "950";
  price.textContent = euro(p.price_eur);

  const facts = document.createElement("div");
  facts.style.display = "flex";
  facts.style.gap = "18px";
  facts.style.flexWrap = "wrap";
  facts.style.fontSize = "20px";
  facts.style.color = "rgba(0,0,0,.75)";
  facts.textContent = `${m2(p.useful_area_m2)} útiles  ·  ${p.home_type ?? "—"}`;

  const agency = document.createElement("div");
  agency.style.fontSize = "22px";
  agency.style.color = "#1a73e8";
  agency.textContent = p.agency_name ?? "—";

  right.append(row1, loc, price, facts, agency);

  card.append(left, right);
  host.append(card);
}

function selectListing(id, { panTo } = { panTo:true }){
  const p = state.points.find(x => x.id === id);
  if (!p) return;

  state.selectedId = id;
  markSeen(id);
  updateMarkerStyles();
  renderMapCard(p);

  openListing(p);

  if (panTo && window.__bh_map){
    window.__bh_map.panTo([p.lat, p.lng], { animate:true, duration:0.4 });
  }
}

function openListing(p){
  try{ sessionStorage.setItem("bh_last_map_url", location.href); }catch{}
  location.href = `./listing.html?id=${encodeURIComponent(p.id)}`;
}

/* ---------------------------
   RPC: fetch puntos con fallback si PGRST202
--------------------------- */
function buildRpcPayload(map){
  const b = map.getBounds();

  const payload = {
    p_city: state.city || null,
    p_mode: state.mode,

    p_sw_lat: b.getSouthWest().lat,
    p_sw_lng: b.getSouthWest().lng,
    p_ne_lat: b.getNorthEast().lat,
    p_ne_lng: b.getNorthEast().lng,

    p_price_min: state.filters.priceMin ? Number(state.filters.priceMin) : null,
    p_price_max: state.filters.priceMax ? Number(state.filters.priceMax) : null,

    p_listed_since: state.filters.listedSince || null,
    p_availability: state.filters.availability || null,

    p_useful_min: state.filters.usefulMin ? Number(state.filters.usefulMin) : null,
    p_useful_max: state.filters.usefulMax ? Number(state.filters.usefulMax) : null,

    p_built_min: state.filters.builtMin ? Number(state.filters.builtMin) : null,
    p_built_max: state.filters.builtMax ? Number(state.filters.builtMax) : null,

    p_outdoor_space_type: state.filters.outdoorSpace || null,
    p_build_period: state.filters.buildPeriod || null
  };

  for (const k of Object.keys(payload)){
    if (payload[k] == null || payload[k] === "") delete payload[k];
  }
  return payload;
}

async function rpcWithFallback(fnName, payload){
  let { data, error } = await supabase.rpc(fnName, payload);
  if (!error) return { data, used:"full" };

  const msg = (error?.message || "") + " " + (error?.details || "");
  const code = error?.code || "";
  const isSignature = code === "PGRST202" || msg.includes("PGRST202") || msg.includes("Searched for the function");

  if (!isSignature){
    return { data:null, error };
  }

  const minimal = {};
  for (const k of ["p_city","p_mode","p_sw_lat","p_sw_lng","p_ne_lat","p_ne_lng"]){
    if (payload[k] != null) minimal[k] = payload[k];
  }

  ({ data, error } = await supabase.rpc(fnName, minimal));
  if (!error) return { data, used:"minimal", warn: msg };

  const ultra = {};
  for (const k of ["p_sw_lat","p_sw_lng","p_ne_lat","p_ne_lng"]){
    if (payload[k] != null) ultra[k] = payload[k];
  }
  ({ data, error } = await supabase.rpc(fnName, ultra));
  if (!error) return { data, used:"ultra", warn: msg };

  return { data:null, error };
}

function applyLocalFilters(items){
  let out = [...items];

  const n = (v) => (v == null ? null : Number(v));

  const pmin = n(state.filters.priceMin);
  const pmax = n(state.filters.priceMax);
  if (pmin != null) out = out.filter(x => n(x.price_eur) == null ? false : n(x.price_eur) >= pmin);
  if (pmax != null) out = out.filter(x => n(x.price_eur) == null ? false : n(x.price_eur) <= pmax);

  const umin = n(state.filters.usefulMin);
  const umax = n(state.filters.usefulMax);
  if (umin != null) out = out.filter(x => n(x.useful_area_m2) == null ? false : n(x.useful_area_m2) >= umin);
  if (umax != null) out = out.filter(x => n(x.useful_area_m2) == null ? false : n(x.useful_area_m2) <= umax);

  const bmin = n(state.filters.builtMin);
  const bmax = n(state.filters.builtMax);
  if (state.mode !== "room"){
    if (bmin != null) out = out.filter(x => n(x.built_area_m2) == null ? false : n(x.built_area_m2) >= bmin);
    if (bmax != null) out = out.filter(x => n(x.built_area_m2) == null ? false : n(x.built_area_m2) <= bmax);
  }

  if (state.filters.outdoorSpace){
    out = out.filter(x => (x.outdoor_space_type || "") === state.filters.outdoorSpace);
  }

  if (state.filters.availability){
    out = out.filter(x => (x.availability || "available") === state.filters.availability);
  }

  if (state.filters.listedSince){
    const now = Date.now();
    const cut = (() => {
      if (state.filters.listedSince === "24h") return now - 24*3600*1000;
      if (state.filters.listedSince === "5d") return now - 5*24*3600*1000;
      if (state.filters.listedSince === "10d") return now - 10*24*3600*1000;
      if (state.filters.listedSince === "30d") return now - 30*24*3600*1000;
      if (state.filters.listedSince === "60d") return now - 60*24*3600*1000;
      return null;
    })();
    if (cut){
      out = out.filter(x => {
        const t = x.listed_at ? new Date(x.listed_at).getTime() : 0;
        return t >= cut;
      });
    }
  }

  // buildPeriod: aquí se aplica cuando tengas el campo real (year_built, etc.)
  return out;
}

async function loadPointsForView(map){
  showStatus("Cargando anuncios…");

  const payload = buildRpcPayload(map);
  const res = await rpcWithFallback("search_map_points_filtered", payload);

  if (res.error){
    showStatus(`Error: ${res.error.code || ""} ${res.error.message || "No se pudo cargar"}`);
    state.points = [];
    renderList();
    clearMarkers();
    return;
  }

  if (res.warn){
    showStatus("Aviso: el backend rechazó algunos parámetros. Se aplican filtros localmente.");
    setTimeout(hideStatus, 2200);
  }else{
    hideStatus();
  }

  const raw = Array.isArray(res.data) ? res.data : [];

  const normalized = raw.map(x => ({
    id: x.id,
    lat: x.lat ?? x.latitude,
    lng: x.lng ?? x.longitude,

    title: x.title ?? x.address ?? "—",
    city: x.city ?? state.city ?? "—",
    postcode: x.postcode ?? "",
    price_eur: x.price_eur ?? x.price,
    useful_area_m2: x.useful_area_m2 ?? x.area_useful,
    built_area_m2: x.built_area_m2 ?? x.area_built,
    home_type: x.home_type ?? x.type ?? "—",
    agency_name: x.agency_name ?? x.agency ?? "—",
    photo_url: x.photo_url ?? x.cover_url ?? null,
    availability: x.availability ?? "available",
    outdoor_space_type: x.outdoor_space_type ?? "",
    listed_at: x.listed_at ?? x.published_at ?? null
  })).filter(x => typeof x.lat === "number" && typeof x.lng === "number");

  state.points = applyLocalFilters(normalized);

  renderList();
  rebuildMarkers(map);
}

function clearMarkers(){
  for (const m of markersById.values()){
    try{ m.remove(); }catch{}
  }
  markersById.clear();
}

function rebuildMarkers(map){
  clearMarkers();

  state.points.forEach(p=>{
    const m = L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        className: "bh-pin",
        html: markerHtml(isSeen(p.id) ? "seen" : "normal"),
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(map);

    m.on("click", ()=>{
      state.selectedId = p.id;
      markSeen(p.id);
      updateMarkerStyles();
      renderMapCard(p);
      openListing(p);
    });

    markersById.set(p.id, m);
  });

  updateMarkerStyles();
}

/* ---------------------------
   Controles extra
--------------------------- */
function addLocateControl(map){
  const Locate = L.Control.extend({
    options: { position: "topright" },
    onAdd(){
      const btn = L.DomUtil.create("button", "leaflet-bar");
      btn.type = "button";
      btn.title = "Mi ubicación";
      btn.style.width = "34px";
      btn.style.height = "34px";
      btn.style.background = "#fff";
      btn.style.cursor = "pointer";
      btn.innerHTML = "◎";
      L.DomEvent.disableClickPropagation(btn);
      btn.addEventListener("click", ()=>{
        if (!navigator.geolocation){
          alert("Geolocalización no disponible en este navegador.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos)=>{
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat,lng], 14, { animate:true });
          },
          ()=>{
            alert("No se pudo obtener tu ubicación.");
          },
          { enableHighAccuracy:true, timeout:8000 }
        );
      });
      return btn;
    }
  });
  map.addControl(new Locate());
}

function addDrawButtons(map){
  const Wrap = L.Control.extend({
    options: { position: "topright" },
    onAdd(){
      const box = L.DomUtil.create("div");
      box.style.display = "flex";
      box.style.flexDirection = "column";
      box.style.gap = "8px";
      box.style.marginTop = "88px";

      const mkBtn = (label, title) => {
        const b = L.DomUtil.create("button");
        b.type = "button";
        b.title = title;
        b.style.width = "44px";
        b.style.height = "44px";
        b.style.borderRadius = "14px";
        b.style.border = "1px solid rgba(0,0,0,.15)";
        b.style.background = "#fff";
        b.style.cursor = "pointer";
        b.style.fontSize = "18px";
        b.textContent = label;
        L.DomEvent.disableClickPropagation(b);
        return b;
      };

      const btnPoints = mkBtn("⬠", "Polígono por puntos");
      const btnFree = mkBtn("✎", "Dibujo libre");

      btnPoints.addEventListener("click", ()=>{
        alert("Modo polígono por puntos (UI restaurada). Conecta aquí tu lógica de dibujo.");
      });
      btnFree.addEventListener("click", ()=>{
        alert("Modo dibujo libre (UI restaurada). Conecta aquí tu lógica de dibujo.");
      });

      box.append(btnPoints, btnFree);
      return box;
    }
  });

  map.addControl(new Wrap());
}

/* ---------------------------
   Búsqueda
--------------------------- */
let searchTimer = null;
function triggerSearch(){
  if (!window.__bh_map) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=> loadPointsForView(window.__bh_map), 220);
}

/* ---------------------------
   Init
--------------------------- */
async function init(){
  const { city, mode } = getUrlParams();
  state.city = city;
  state.mode = mode || "buy";

  $("#favLink").addEventListener("click", (e)=>{
    e.preventDefault();
    alert("MVP: Favoritos (requiere registro).");
  });
  $("#loginLink").addEventListener("click", (e)=>{
    e.preventDefault();
    alert("MVP: login (pendiente de integrar aquí).");
  });
  $("#miniSearchForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const q = ($("#miniQ").value || "").trim();
    if (!q) return;
    const sp = new URLSearchParams(location.search);
    sp.set("city", q);
    sp.set("mode", state.mode);
    location.href = `./map.html?${sp.toString()}`;
  });

  $("#toggleFiltersBtn").addEventListener("click", ()=>{
    state.filtersHidden = !state.filtersHidden;
    applyLayout();
  });
  $("#toggleListBtn").addEventListener("click", ()=>{
    state.listHidden = !state.listHidden;
    applyLayout();
  });
  $("#clearFiltersBtn").addEventListener("click", ()=> clearAllFilters());

  $("#sortBtn").addEventListener("click", ()=>{
    $("#sortMenu").classList.toggle("bh-hidden");
  });
  document.addEventListener("click", (e)=>{
    const wrap = $("#sortWrap");
    if (!wrap.contains(e.target)) $("#sortMenu").classList.add("bh-hidden");
  });
  document.querySelectorAll(".sortItem").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.sort = btn.dataset.sort;
      $("#sortMenu").classList.add("bh-hidden");
      renderList();
    });
  });

  renderFilters();

  $("#crumbText").textContent = state.city ? `— / ${state.city} / —` : "—";

  const map = L.map("map", { zoomControl:true }).setView([37.9922, -1.1307], 12);
  window.__bh_map = map;

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  addLocateControl(map);
  addDrawButtons(map);

  let crumbT = null;
  const crumbKick = ()=>{
    clearTimeout(crumbT);
    crumbT = setTimeout(()=> updateCrumbFromMapCenter(map), 350);
  };
  map.on("moveend", crumbKick);
  crumbKick();

  map.on("moveend", ()=> triggerSearch());
  triggerSearch();

  applyLayout();
}

init();