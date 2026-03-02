// bh-map-filters.js
// - Renderiza la columna de filtros (sin botón aplicar)
// - Cada cambio actualiza la URL y dispara bh:filters-changed
// - Soporta "Limpiar filtros" con bh:filters-clear (mantiene disponibilidad)

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

function makeDatalist(id, options) {
  const dl = el("datalist", { id });
  (options || []).forEach((v) => {
    dl.appendChild(el("option", { value: String(v) }));
  });
  return dl;
}

function getUrlParams() {
  const u = new URL(window.location.href);
  const sp = u.searchParams;

  const toInt = (k) => {
    const v = sp.get(k);
    if (v == null || v === "") return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  const toText = (k) => {
    const v = (sp.get(k) || "").trim();
    return v ? v : null;
  };

  return {
    // city se mantiene en URL para el backend, pero no hay input de ciudad aquí
    city: (sp.get("city") || "").trim(),
    mode: (sp.get("mode") || "buy").trim(),

    priceMin: toInt("price_min"),
    priceMax: toInt("price_max"),

    listedSinceDays: toInt("since_days"),

    // disponibilidad: por defecto "available"
    availability: toText("availability") || "available",

    usefulMin: toInt("useful_min"),
    usefulMax: toInt("useful_max"),

    builtMin: toInt("built_min"),
    builtMax: toInt("built_max"),

    bedroomsMin: toInt("bedrooms_min"),
    bathroomsMin: toInt("bathrooms_min"),

    energyChoice: toText("energy")
  };
}

function setUrlFromState(next) {
  const u = new URL(window.location.href);
  const sp = u.searchParams;

  // Mantener city y mode
  if (next.city != null) sp.set("city", next.city);
  if (next.mode != null) sp.set("mode", next.mode);

  const setInt = (k, v) => {
    if (v == null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  };
  const setText = (k, v) => {
    if (!v) sp.delete(k);
    else sp.set(k, String(v));
  };

  setInt("price_min", next.priceMin);
  setInt("price_max", next.priceMax);

  setInt("since_days", next.listedSinceDays);

  // disponibilidad siempre existe (por defecto available)
  setText("availability", next.availability || "available");

  setInt("useful_min", next.usefulMin);
  setInt("useful_max", next.usefulMax);

  setInt("built_min", next.builtMin);
  setInt("built_max", next.builtMax);

  setInt("bedrooms_min", next.bedroomsMin);
  setInt("bathrooms_min", next.bathroomsMin);

  setText("energy", next.energyChoice);

  history.replaceState(null, "", u.toString());
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

function openDatalistHint(inputEl) {
  // Truco suave: focus + dispatch input para que el navegador sugiera datalist
  // No todos los navegadores abren el desplegable siempre, pero mejora el comportamiento.
  try {
    inputEl.focus();
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  } catch {}
}

function filterBox(title, contentEl, clearBtn) {
  // Caja estilo “antes” (título arriba, contenido debajo, X a la derecha)
  const head = el("div", { class: "bhFHead" }, [
    el("div", { class: "bhFTitle", text: title }),
    clearBtn
  ]);

  const box = el("div", { class: "bhFBox" }, [
    head,
    el("div", { class: "bhFBody" }, [contentEl])
  ]);

  return box;
}

export function initFiltersBar({ mountId }) {
  const container = document.getElementById(mountId);
  if (!container) return;

  const initial = getUrlParams();

  // Sugerencias (puedes ajustar)
  const SUGGEST = {
    price: [50000, 75000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 350000, 400000, 500000, 750000, 1000000],
    area: [30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 250, 300],
    year: [1950, 1960, 1970, 1980, 1990, 2000, 2005, 2010, 2015, 2020, 2022, 2023, 2024, 2025],
    rooms: [0,1,2,3,4,5,6],
    baths: [1,2,3,4]
  };

  // Datalists
  const dlPrice = makeDatalist("dlPrice", SUGGEST.price);
  const dlArea = makeDatalist("dlArea", SUGGEST.area);
  const dlYear = makeDatalist("dlYear", SUGGEST.year);
  const dlRooms = makeDatalist("dlRooms", SUGGEST.rooms);
  const dlBaths = makeDatalist("dlBaths", SUGGEST.baths);

  // Inputs (type=number, sin flechas por CSS)
  const priceMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Min €",
    value: initial.priceMin ?? "",
    list: "dlPrice",
    class: "bhNum"
  });
  const priceMax = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Max €",
    value: initial.priceMax ?? "",
    list: "dlPrice",
    class: "bhNum"
  });

  const usefulMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Desde (m²)",
    value: initial.usefulMin ?? "",
    list: "dlArea",
    class: "bhNum"
  });
  const usefulMax = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Hasta (m²)",
    value: initial.usefulMax ?? "",
    list: "dlArea",
    class: "bhNum"
  });

  const builtMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Año min",
    value: initial.builtMin ?? "",
    list: "dlYear",
    class: "bhNum"
  });
  const builtMax = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Año max",
    value: initial.builtMax ?? "",
    list: "dlYear",
    class: "bhNum"
  });

  const bedMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Hab. min",
    value: initial.bedroomsMin ?? "",
    list: "dlRooms",
    class: "bhNum"
  });

  const bathMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Baños min",
    value: initial.bathroomsMin ?? "",
    list: "dlBaths",
    class: "bhNum"
  });

  // Offered since (radio)
  const sinceOptions = [
    { v: null, label: "Sin preferencia" },
    { v: 0, label: "Hoy" },
    { v: 3, label: "3 días" },
    { v: 5, label: "5 días" },
    { v: 10, label: "10 días" },
    { v: 30, label: "30 días" }
  ];

  function radio(name, checked, label) {
    const inp = el("input", { type: "radio", name });
    inp.checked = !!checked;
    const wrap = el("label", { class: "bhRadioRow" }, [
      inp,
      el("span", { text: label })
    ]);
    return { wrap, inp };
  }

  const sinceGroupEl = el("div", { class: "bhRadioGroup" });
  const sinceRadios = [];
  sinceOptions.forEach((o, idx) => {
    const checked = (initial.listedSinceDays == null && o.v == null) || (initial.listedSinceDays === o.v);
    const { wrap, inp } = radio("since_days", checked, o.label);
    sinceGroupEl.appendChild(wrap);
    sinceRadios.push({ inp, v: o.v });
  });

  // Availability (select)
  const availabilitySel = el("select", { class: "bhSelect" });
  [
    ["available", "Disponible"],
    ["negotiation", "En negociación"],
    ["sold", "Vendido"]
  ].forEach(([v, t]) => availabilitySel.appendChild(el("option", { value: v, text: t })));
  availabilitySel.value = initial.availability || "available";

  // Energy (select)
  const energySel = el("select", { class: "bhSelect" });
  [
    ["", "Energía: cualquiera"],
    ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"], ["G", "G"],
    ["pending", "Pendiente"]
  ].forEach(([v, t]) => energySel.appendChild(el("option", { value: v, text: t })));
  energySel.value = initial.energyChoice || "";

  // Estado interno actual (lo que se reflejará en la URL)
  const state = {
    city: initial.city || "",
    mode: initial.mode || "buy",

    priceMin: initial.priceMin,
    priceMax: initial.priceMax,

    listedSinceDays: initial.listedSinceDays,

    availability: initial.availability || "available",

    usefulMin: initial.usefulMin,
    usefulMax: initial.usefulMax,

    builtMin: initial.builtMin,
    builtMax: initial.builtMax,

    bedroomsMin: initial.bedroomsMin,
    bathroomsMin: initial.bathroomsMin,

    energyChoice: initial.energyChoice
  };

  function isFilterActive(key) {
    // Para pintar la X en rojo cuando el filtro tenga valor
    if (key === "price") return state.priceMin != null || state.priceMax != null;
    if (key === "since") return state.listedSinceDays != null;
    if (key === "availability") return (state.availability || "available") !== "available";
    if (key === "useful") return state.usefulMin != null || state.usefulMax != null;
    if (key === "built") return state.builtMin != null || state.builtMax != null;
    if (key === "beds") return state.bedroomsMin != null;
    if (key === "baths") return state.bathroomsMin != null;
    if (key === "energy") return !!state.energyChoice;
    return false;
  }

  function makeClearX(key, onClear) {
    const btn = el("button", { type: "button", class: "bhXBtn", text: "×" });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      onClear();
      applyNow();
    });
    btn.refresh = () => {
      btn.classList.toggle("active", isFilterActive(key));
    };
    return btn;
  }

  function applyNow() {
    setUrlFromState(state);
    // refresca X rojas
    clearBtns.forEach(b => b.refresh && b.refresh());
  }

  // Controles UI por filtro
  const clearBtns = [];

  // Precio
  const priceRow = el("div", { class: "bhRow2" }, [priceMin, priceMax]);
  const priceX = makeClearX("price", () => {
    priceMin.value = "";
    priceMax.value = "";
    state.priceMin = null;
    state.priceMax = null;
  });
  clearBtns.push(priceX);

  // Offered since
  const sinceX = makeClearX("since", () => {
    state.listedSinceDays = null;
    // marcar "Sin preferencia"
    sinceRadios.forEach(r => { r.inp.checked = (r.v == null); });
  });
  clearBtns.push(sinceX);

  // Availability
  const availX = makeClearX("availability", () => {
    // Si el usuario borra disponibilidad, lo volvemos a default available
    state.availability = "available";
    availabilitySel.value = "available";
  });
  clearBtns.push(availX);

  // Superficie útil
  const usefulRow = el("div", { class: "bhRow2" }, [usefulMin, usefulMax]);
  const usefulX = makeClearX("useful", () => {
    usefulMin.value = "";
    usefulMax.value = "";
    state.usefulMin = null;
    state.usefulMax = null;
  });
  clearBtns.push(usefulX);

  // Construida (si la usas por año, puedes cambiarlo; aquí dejamos builtMin/Max como año)
  const builtRow = el("div", { class: "bhRow2" }, [builtMin, builtMax]);
  const builtX = makeClearX("built", () => {
    builtMin.value = "";
    builtMax.value = "";
    state.builtMin = null;
    state.builtMax = null;
  });
  clearBtns.push(builtX);

  // Dormitorios
  const bedsRow = el("div", { class: "bhRow1" }, [bedMin]);
  const bedsX = makeClearX("beds", () => {
    bedMin.value = "";
    state.bedroomsMin = null;
  });
  clearBtns.push(bedsX);

  // Baños
  const bathsRow = el("div", { class: "bhRow1" }, [bathMin]);
  const bathsX = makeClearX("baths", () => {
    bathMin.value = "";
    state.bathroomsMin = null;
  });
  clearBtns.push(bathsX);

  // Energía
  const energyRow = el("div", { class: "bhRow1" }, [energySel]);
  const energyX = makeClearX("energy", () => {
    energySel.value = "";
    state.energyChoice = null;
  });
  clearBtns.push(energyX);

  // Listeners “live”
  function onNumChange(inputEl, key, which) {
    const v = intOrNull(inputEl.value);
    state[key] = v;
    applyNow();
  }

  // Sugerencias: abrir al foco y al empezar a escribir
  [
    priceMin, priceMax, usefulMin, usefulMax, builtMin, builtMax, bedMin, bathMin
  ].forEach((inp) => {
    inp.addEventListener("focus", () => openDatalistHint(inp));
    inp.addEventListener("input", () => openDatalistHint(inp));
  });

  priceMin.addEventListener("input", () => onNumChange(priceMin, "priceMin"));
  priceMax.addEventListener("input", () => onNumChange(priceMax, "priceMax"));

  usefulMin.addEventListener("input", () => onNumChange(usefulMin, "usefulMin"));
  usefulMax.addEventListener("input", () => onNumChange(usefulMax, "usefulMax"));

  builtMin.addEventListener("input", () => onNumChange(builtMin, "builtMin"));
  builtMax.addEventListener("input", () => onNumChange(builtMax, "builtMax"));

  bedMin.addEventListener("input", () => onNumChange(bedMin, "bedroomsMin"));
  bathMin.addEventListener("input", () => onNumChange(bathMin, "bathroomsMin"));

  sinceRadios.forEach(r => {
    r.inp.addEventListener("change", () => {
      if (!r.inp.checked) return;
      state.listedSinceDays = (r.v == null) ? null : r.v;
      applyNow();
    });
  });

  availabilitySel.addEventListener("change", () => {
    state.availability = availabilitySel.value || "available";
    applyNow();
  });

  energySel.addEventListener("change", () => {
    state.energyChoice = energySel.value || null;
    applyNow();
  });

  // Limpieza global (pero disponibilidad se mantiene)
  window.addEventListener("bh:filters-clear", () => {
    // Guardar disponibilidad actual (y si está vacía, default)
    const keepAvailability = state.availability || "available";

    // Reset
    priceMin.value = "";
    priceMax.value = "";
    state.priceMin = null;
    state.priceMax = null;

    state.listedSinceDays = null;
    sinceRadios.forEach(r => { r.inp.checked = (r.v == null); });

    usefulMin.value = "";
    usefulMax.value = "";
    state.usefulMin = null;
    state.usefulMax = null;

    builtMin.value = "";
    builtMax.value = "";
    state.builtMin = null;
    state.builtMax = null;

    bedMin.value = "";
    state.bedroomsMin = null;

    bathMin.value = "";
    state.bathroomsMin = null;

    energySel.value = "";
    state.energyChoice = null;

    // Restituir disponibilidad
    state.availability = keepAvailability;
    availabilitySel.value = keepAvailability;

    applyNow();
  });

  // Montaje DOM
  container.innerHTML = "";
  container.appendChild(dlPrice);
  container.appendChild(dlArea);
  container.appendChild(dlYear);
  container.appendChild(dlRooms);
  container.appendChild(dlBaths);

  // CSS de estos bloques vive en bh-map-core (por simplicidad) o en tu CSS compartido.
  // Aquí montamos la estructura.
  container.appendChild(filterBox("Precio", priceRow, priceX));
  container.appendChild(filterBox("Ofertado desde", sinceGroupEl, sinceX));
  container.appendChild(filterBox("Disponibilidad", availabilitySel, availX));
  container.appendChild(filterBox("Superficie útil", usefulRow, usefulX));
  container.appendChild(filterBox("Año construcción", builtRow, builtX));
  container.appendChild(filterBox("Dormitorios", bedsRow, bedsX));
  container.appendChild(filterBox("Baños", bathsRow, bathsX));
  container.appendChild(filterBox("Energía", energyRow, energyX));

  // Estado visual inicial de X
  clearBtns.forEach(b => b.refresh && b.refresh());

  // Asegura que la URL tenga availability por defecto (si no estaba)
  // y dispara una primera carga consistente
  setUrlFromState(state);
}