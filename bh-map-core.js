/* =========================================================
   bh-map-core.js (COMPLETO)
   Objetivo:
   - Render mapa + marcadores + tarjeta
   - Controles: sol, localización, dibujo por puntos, dibujo libre (según definición) 2
   - Columnas: ocultar/mostrar filtros y listado SIN romper el mapa (invalidateSize)
   - Listado: hover resalta marcador, click abre ficha
   - RPC: reintentos si PGRST202 (firma de función no coincide)
   - Filtros según Definicion de filtros 3
   ========================================================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
const SUPABASE_ANON_KEY = "REEMPLAZA_ESTO_POR_TU_ANON_KEY"; // <-- deja tu key real aquí

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

  // filtros (según definición)
  filters: {
    priceMin: "",
    priceMax: "",
    listedSince: "", // 24h, 5d, 10d, 30d, 60d
    availability: "available", // por defecto "Disponible" 4
    usefulMin: "",
    usefulMax: "",
    builtMin: "",
    builtMax: "",
    outdoorSpace: "", // balcony/terrace/garden/patio
    buildPeriod: ""  // según tu definición ampliada
  },

  points: [], // anuncios (para mapa+listado)
};

function getUrlParams(){
  const sp = new URLSearchParams(location.search);
  const city = (sp.get("city") || "").trim();
  const mode = (sp.get("mode") || "buy").trim();
  return { city, mode };
}

/* ---------------------------
   Layout: ocultar/mostrar columnas
   (IMPORTANTE: siempre invalidateSize del mapa tras cambios)
--------------------------- */
function applyLayout(){
  const shell = $("#mapShell");
  shell.classList.toggle("filtersHidden", state.filtersHidden);
  shell.classList.toggle("listHidden", state.listHidden);

  $("#filtersCol").classList.toggle("bh-hidden", state.filtersHidden);
  $("#listCol").classList.toggle("bh-hidden", state.listHidden);

  // Botones texto
  $("#toggleFiltersBtn").textContent = state.filtersHidden ? "Mostrar filtros" : "Ocultar filtros";
  $("#toggleListBtn").textContent = state.listHidden ? "Mostrar listado" : "Ocultar listado";

  // “Ordenar por” solo si listado visible
  $("#sortWrap").classList.toggle("bh-hidden", state.listHidden);

  // Cambia columnas del grid según visibilidad
  const sideW = getComputedStyle(document.documentElement).getPropertyValue("--sideW").trim() || "260px";
  const topRow = document.querySelector(".topRow");
  const mainGrid = document.querySelector(".mainGrid");

  const left = state.filtersHidden ? "0px" : sideW;
  const right = state.listHidden ? "0px" : sideW;

  topRow.style.gridTemplateColumns = `${left} 1fr ${right}`;
  mainGrid.style.gridTemplateColumns = `${left} 1fr ${right}`;

  // Si una columna está oculta, mantenemos su celda pero a 0 (para evitar saltos raros)
  // y ocultamos contenido con bh-hidden arriba.

  requestAnimationFrame(() => {
    // Leaflet: si el contenedor cambia tamaño, hay que invalidar
    if (window.__bh_map) {
      setTimeout(() => window.__bh_map.invalidateSize(true), 60);
    }
  });
}

/* ---------------------------
   Breadcrumb: “Comunidad / Ciudad / Zona”
   Se actualiza con reverse geocode (Nominatim) según centro del mapa.
   (Esto depende de internet; si falla, se deja el texto de city)
--------------------------- */
let crumbAbort = null;
async function updateCrumbFromMapCenter(map){
  const center = map.getCenter();
  const lat = center.lat;
  const lon = center.lng;

  // Cancelar petición anterior
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
    // fallback silencioso
    $("#crumbText").textContent = state.city || "—";
  }
}

/* ---------------------------
   Filtros: render
   - Inputs numéricos con sugerencias (dropdown)
   - “Limpiar filtros”: resetea todo EXCEPTO availability (queda “Disponible”) 5
--------------------------- */
function suggestListForPrice(mode){
  // escalones redondos, ajustados a compra/alquiler 6
  if (mode === "rent") return [300,400,500,600,700,800,900,1000,1200,1500,1800,2000,2500,3000];
  return [50000,80000,100000,120000,150000,180000,200000,250000,300000,350000,400000,450000,500000,650000,800000,1000000,1250000,1500000,2000000];
}
function suggestListForUseful(){
  return [30,40,50,60,75,90,100,110,130,150,200];
}

function renderFilters(){
  const root = $("#filtersRoot");
  root.innerHTML = "";

  // Helper: bloque
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

  // Helper: input con sugerencias
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
    const openMenu = () => {
      menu.classList.remove("bh-hidden");
    };

    // pintar items
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

  // 1) Precio
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

    // si min>max, intercambia (definición) 7
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

  // 2) Ofertado desde (fecha publicación)
  {
    const applied = !!state.filters.listedSince;
    const { wrap, body } = block("Ofertado desde", applied, () => {
      state.filters.listedSince = "";
      renderFilters