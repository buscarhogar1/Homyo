
/*
  bh-map-filters.js
  Implementación de filtros para Map según la definición funcional del producto.
*/

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k === "value") n.value = v;
    else n.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === "string") n.appendChild(document.createTextNode(c));
    else n.appendChild(c);
  }
  return n;
}

function intOrNull(v) {
  const s = String(v ?? "").replace(/[^\d]/g, "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function fromCSV(s) {
  if (!s) return [];
  return String(s).split(",").map(x => x.trim()).filter(Boolean);
}

function toCSV(arr) {
  if (!arr || !arr.length) return null;
  return arr.join(",");
}

function getMode() {
  const u = new URL(window.location.href);
  const mode = (u.searchParams.get("mode") || "buy").trim().toLowerCase();
  const allowed = ["buy", "rent", "room", "new_build", "all"];
  return allowed.includes(mode) ? mode : "buy";
}

function getParamsFromURL() {
  const u = new URL(window.location.href);
  return {
    priceMin: intOrNull(u.searchParams.get("price_min")),
    priceMax: intOrNull(u.searchParams.get("price_max")),
    usefulMin: intOrNull(u.searchParams.get("useful_min")),
    usefulMax: intOrNull(u.searchParams.get("useful_max")),
    builtMin: intOrNull(u.searchParams.get("built_min")),
    builtMax: intOrNull(u.searchParams.get("built_max")),
    buildPeriods: fromCSV(u.searchParams.get("build_periods")),
    sinceDays: intOrNull(u.searchParams.get("since_days")),
    bedroomsMin: intOrNull(u.searchParams.get("bedrooms_min")),
    bathroomsMin: intOrNull(u.searchParams.get("bathrooms_min")),
    outdoorTypes: fromCSV(u.searchParams.get("outdoor_type")),
    orientations: fromCSV(u.searchParams.get("orientations")),
    accessibility: fromCSV(u.searchParams.get("accessibility")),
    parkingTypes: fromCSV(u.searchParams.get("parking")),
    storageTypes: fromCSV(u.searchParams.get("storage")),
    energyChoice: (u.searchParams.get("energy") || "").trim() || null,
    availability: (u.searchParams.get("availability") || "").trim() || null,

    /* ---- Alquiler de vivienda completa ---- */
    rentTypes: fromCSV(u.searchParams.get("rent_type")),
    equipment: fromCSV(u.searchParams.get("equipment")),
    rentConditions: fromCSV(u.searchParams.get("rent_conditions")),
    pets: (u.searchParams.get("pets") || "").trim() || null,

    /* ---- Alquiler de habitación ---- */
    roomIncludes: fromCSV(u.searchParams.get("room_includes")),
    roomTypes: fromCSV(u.searchParams.get("room_type")),
    roomStay: (u.searchParams.get("room_stay") || "").trim() || null,
    household: fromCSV(u.searchParams.get("household")),
    flatmates: fromCSV(u.searchParams.get("flatmates")),
    coexistence: fromCSV(u.searchParams.get("coexistence")),
    roomAmenities: fromCSV(u.searchParams.get("room_amenities")),
    advertiser: fromCSV(u.searchParams.get("advertiser")),
  };
}

function setURLParam(key, value) {
  const u = new URL(window.location.href);
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) u.searchParams.delete(key);
  else u.searchParams.set(key, String(value));
  history.replaceState(null, "", u.toString());
}

function fireFiltersChanged() {
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

function formatInt(v) {
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function filterBlock({ title, isActiveFn, onClear, contentEl, isVisibleFn }) {
  const dot = el("div", { class: "fDot" });
  const titleEl = el("div", { class: "fTitleText", text: title });
  const clearBtn = el("button", { class: "fClearBtn", type: "button", "aria-label": "Limpiar filtro", text: "×" });

  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClear?.();
  });

  const head = el("div", { class: "fHead" }, [
    el("div", { class: "fTitle" }, [dot, titleEl]),
    clearBtn
  ]);

  const blk = el("div", { class: "fBlock" }, [head, contentEl]);

  function refresh() {
    const active = !!isActiveFn?.();
    blk.classList.toggle("active", active);
    clearBtn.classList.toggle("active", active);

    if (isVisibleFn) {
      blk.classList.toggle("bh-hidden", !isVisibleFn());
    }
  }

  return { el: blk, refresh };
}

/* ========= SUGERENCIAS DINÁMICAS ========= */

function getPriceDefaultSuggestions(mode) {
  if (mode === "rent" || mode === "room") return [500, 700, 900, 1200];
  return [150000, 200000, 250000, 300000];
}

function getAreaDefaultSuggestions() {
  return [50, 75, 90, 110];
}

function getPriceSuggestions(rawDigits, mode) {
  if (!rawDigits) return getPriceDefaultSuggestions(mode);

  const typed = parseInt(rawDigits, 10);
  if (!Number.isFinite(typed)) return getPriceDefaultSuggestions(mode);

  if (mode === "rent" || mode === "room") {
    let base;
    if (rawDigits.length === 1) base = typed * 100;
    else if (rawDigits.length === 2) base = typed * 10;
    else base = typed;

    const pool = [
      base,
      Math.ceil((base + 50) / 50) * 50,
      Math.ceil((base + 100) / 50) * 50,
      Math.ceil((base + 200) / 50) * 50
    ];
    return [...new Set(pool.filter(v => v > 0 && v <= 3000))].sort((a, b) => a - b).slice(0, 4);
  }

  let base;
  if (rawDigits.length === 1) base = typed * 100000;
  else if (rawDigits.length <= 3) base = typed * 1000;
  else base = typed;

  const step = base < 300000 ? 5000 : base < 1000000 ? 10000 : 50000;
  const pool = [
    base,
    Math.ceil((base + step) / 1000) * 1000,
    Math.ceil((base + step * 4) / 1000) * 1000,
    Math.ceil((base + step * 9) / 1000) * 1000
  ];

  return [...new Set(pool.filter(v => v > 0 && v <= 2000000))].sort((a, b) => a - b).slice(0, 4);
}

function getAreaSuggestions(rawDigits) {
  if (!rawDigits) return getAreaDefaultSuggestions();

  const typed = parseInt(rawDigits, 10);
  if (!Number.isFinite(typed)) return getAreaDefaultSuggestions();

  let base;
  if (rawDigits.length === 1) base = typed * 10;
  else base = typed;

  const step = base < 100 ? 5 : base < 200 ? 10 : 25;
  const pool = [
    base,
    base + step,
    base + step * 2,
    base + step * 4
  ];
  return [...new Set(pool.filter(v => v > 0))].sort((a, b) => a - b).slice(0, 4);
}

function numericRangeControl({ type, initialMin, initialMax, placeholderMin, placeholderMax, onChange }) {
  const wrap = el("div", { class: "fBody" });
  const stack = el("div", { class: "fInpStack" });

  const minWrap = el("div", { class: "fInpWrap" });
  const maxWrap = el("div", { class: "fInpWrap" });

  const minInput = el("input", {
    class: "fInp",
    type: "text",
    inputmode: "numeric",
    placeholder: placeholderMin,
    value: initialMin == null ? "" : String(initialMin)
  });
  const maxInput = el("input", {
    class: "fInp",
    type: "text",
    inputmode: "numeric",
    placeholder: placeholderMax,
    value: initialMax == null ? "" : String(initialMax)
  });

  const minDrop = el("div", { class: "fDrop bh-hidden" });
  const maxDrop = el("div", { class: "fDrop bh-hidden" });

  minWrap.appendChild(minInput);
  minWrap.appendChild(minDrop);
  maxWrap.appendChild(maxInput);
  maxWrap.appendChild(maxDrop);

  stack.appendChild(minWrap);
  stack.appendChild(maxWrap);
  wrap.appendChild(stack);

  function closeAll() {
    minDrop.classList.add("bh-hidden");
    maxDrop.classList.add("bh-hidden");
  }

  function sanitize(input) {
    const raw = input.value.replace(/[^\d]/g, "");
    if (raw !== input.value) input.value = raw;
    return raw;
  }

  function emit() {
    let min = intOrNull(minInput.value);
    let max = intOrNull(maxInput.value);

    if (min != null && max != null && min > max) {
      const tmp = min;
      min = max;
      max = tmp;
      minInput.value = String(min);
      maxInput.value = String(max);
    }

    onChange?.(min, max);
  }

  function fillDrop(drop, values, onPick) {
    drop.innerHTML = "";
    values.slice(0, 4).forEach(v => {
      const btn = el("button", {
        class: "fDropItem",
        type: "button",
        text: type === "price" ? `${formatInt(v)} €` : `${v} m²`
      });
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        onPick(v);
      });
      drop.appendChild(btn);
    });
    drop.classList.toggle("bh-hidden", values.length === 0);
  }

  function suggestionsFor(raw) {
    const mode = getMode();
    if (type === "price") return getPriceSuggestions(raw, mode);
    return getAreaSuggestions(raw);
  }

  function bind(input, drop) {
    input.addEventListener("focus", () => {
      closeAll();
      const raw = sanitize(input);
      fillDrop(drop, suggestionsFor(raw), (picked) => {
        input.value = String(picked);
        closeAll();
        emit();
      });
      drop.classList.remove("bh-hidden");
    });

    input.addEventListener("input", () => {
      closeAll();
      const raw = sanitize(input);
      fillDrop(drop, suggestionsFor(raw), (picked) => {
        input.value = String(picked);
        closeAll();
        emit();
      });
      drop.classList.remove("bh-hidden");
      emit();
    });

    input.addEventListener("blur", () => {
      setTimeout(() => drop.classList.add("bh-hidden"), 120);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
  }

  bind(minInput, minDrop);
  bind(maxInput, maxDrop);

  document.addEventListener("mousedown", (e) => {
    if (!wrap.contains(e.target)) closeAll();
  });

  return { el: wrap, minInput, maxInput };
}

function selectOneControl({ options, initial, onChange, collapseAfter }) {
  const body = el("div", { class: "fBody" });
  const col = el("div", { class: "fOptCol" });
  const name = `f_${Math.random().toString(36).slice(2, 9)}`;

  const extraRows = [];
  let selectedIndex = -1;

  options.forEach(([value, label], idx) => {
    const id = `${name}_${String(value || "empty").replace(/[^a-z0-9_-]/gi, "_")}`;
    const input = el("input", { type: "radio", name, id, value: value ?? "" });
    if ((initial ?? "") === (value ?? "")) {
      input.checked = true;
      selectedIndex = idx;
    }
    input.addEventListener("change", () => {
      if (input.checked) onChange?.(value || null);
    });

    const row = el("label", { class: "fOptLine", for: id }, [
      input,
      el("span", { class: "fOptText", text: label })
    ]);

    col.appendChild(row);

    if (collapseAfter != null && idx >= collapseAfter) extraRows.push(row);
  });

  body.appendChild(col);

  // "Ver más / Ver menos" toggle when the list is long
  let toggle = null;
  if (collapseAfter != null && extraRows.length > 0) {
    let expanded = false;
    toggle = el("button", { type: "button", class: "fMoreToggle" });

    const setState = (open) => {
      expanded = open;
      extraRows.forEach(r => { r.classList.toggle("fOptHidden", !open); });
      toggle.textContent = open
        ? "Ver menos"
        : `Ver ${extraRows.length} más`;
    };

    toggle.addEventListener("click", () => setState(!expanded));

    // Auto-expand if the active selection is hidden inside the extra rows
    setState(selectedIndex >= collapseAfter);
    body.appendChild(toggle);
  }

  return { el: body, clear: () => {
    col.querySelectorAll("input[type=radio]").forEach(r => { r.checked = false; });
    onChange?.(null);
  }};
}

function multiSelectControl({ options, initialValues, onChange, collapseAfter }) {
  const body = el("div", { class: "fBody" });
  const col = el("div", { class: "fOptCol" });
  const selected = new Set((initialValues || []).map(String));
  const name = `m_${Math.random().toString(36).slice(2, 9)}`;

  const extraRows = [];
  let hasHiddenSelection = false;

  function emit() {
    onChange?.(Array.from(selected));
  }

  options.forEach(([value, label], idx) => {
    const id = `${name}_${String(value).replace(/[^a-z0-9_-]/gi, "_")}`;
    const input = el("input", { type: "checkbox", id, value });
    if (selected.has(String(value))) input.checked = true;

    input.addEventListener("change", () => {
      if (input.checked) selected.add(String(value));
      else selected.delete(String(value));
      emit();
    });

    const row = el("label", { class: "fOptLine", for: id }, [
      input,
      el("span", { class: "fOptText", text: label })
    ]);

    col.appendChild(row);

    if (collapseAfter != null && idx >= collapseAfter) {
      extraRows.push(row);
      if (selected.has(String(value))) hasHiddenSelection = true;
    }
  });

  body.appendChild(col);

  // "Ver más / Ver menos" toggle when the list is long
  if (collapseAfter != null && extraRows.length > 0) {
    let expanded = false;
    const toggle = el("button", { type: "button", class: "fMoreToggle" });

    const setState = (open) => {
      expanded = open;
      extraRows.forEach(r => { r.classList.toggle("fOptHidden", !open); });
      toggle.textContent = open ? "Ver menos" : `Ver ${extraRows.length} más`;
    };

    toggle.addEventListener("click", () => setState(!expanded));

    // Auto-expand if any active selection is hidden inside the extra rows
    setState(hasHiddenSelection);
    body.appendChild(toggle);
  }
  return {
    el: body,
    getValues: () => Array.from(selected),
    setValues: (vals) => {
      selected.clear();
      (vals || []).forEach(v => selected.add(String(v)));
      col.querySelectorAll("input[type=checkbox]").forEach(input => {
        input.checked = selected.has(String(input.value));
      });
      emit();
    }
  };
}

/* Selector de operación (modo): Comprar / Obra nueva / Alquilar / Habitación.
   Permite cambiar el tipo de búsqueda sin volver a la página de inicio. */
function modeSwitchControl({ initial, onChange }) {
  const body = el("div", { class: "fBody modeSwitchBody" });
  const grid = el("div", { class: "modeSwitch" });

  const options = [
    ["buy", "Comprar"],
    ["rent", "Alquilar"],
    ["room", "Habitación"]
  ];

  const btns = [];
  options.forEach(([value, label]) => {
    const btn = el("button", {
      class: "modeSwitchBtn",
      type: "button",
      "data-mode": value,
      text: label
    });
    if ((initial || "buy") === value) {
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
    }
    btn.addEventListener("click", () => {
      if (btn.classList.contains("active")) return;
      btns.forEach(b => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      onChange?.(value);
    });
    btns.push(btn);
    grid.appendChild(btn);
  });

  body.appendChild(grid);
  return { el: body };
}

export function initFiltersBar({ mountId }) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const p = getParamsFromURL();
  const mode = getMode();

  const root = el("div", { class: "filtersRoot" });
  const blocks = [];

  function refreshAll() {
    blocks.forEach(b => b.refresh());
  }

  function touch() {
    fireFiltersChanged();
    refreshAll();
  }

  /* 0. Operación: Comprar / Obra nueva / Alquilar / Habitación.
     Va siempre la primera, para cambiar el tipo de búsqueda sin volver al inicio. */
  {
    const c = modeSwitchControl({
      initial: mode,
      onChange: (newMode) => {
        setURLParam("mode", newMode);
        // Reconstruimos la barra: el modo afecta a sugerencias de precio y a
        // qué filtros se muestran (p. ej. m² construidos no aplica a habitación).
        initFiltersBar({ mountId });
        fireFiltersChanged();
      }
    });

    const blk = el("div", { class: "fBlock modeBlock active noTitle" }, [
      c.el
    ]);

    root.appendChild(blk);
  }

  /* Helper: registra y monta un bloque en orden. */
  function add(blk) {
    blocks.push(blk);
    root.appendChild(blk.el);
    return blk;
  }

  const isRental = (mode === "rent" || mode === "room");

  /* ============================================================
     BUILDERS — cada uno crea un bloque de filtro y lo devuelve.
     La barra se ENSAMBLA por modo más abajo, de forma que
     comprar / obra nueva, alquilar y habitación muestren
     conjuntos de filtros distintos.
     ============================================================ */

  // --- Precio (al mes en alquiler/habitación) ---
  function buildPrice() {
    const c = numericRangeControl({
      type: "price",
      initialMin: p.priceMin,
      initialMax: p.priceMax,
      placeholderMin: isRental ? "Mínimo al mes" : "Precio mínimo",
      placeholderMax: isRental ? "Máximo al mes" : "Precio máximo",
      onChange: (min, max) => {
        setURLParam("price_min", min);
        setURLParam("price_max", max);
        touch();
      }
    });
    return add(filterBlock({
      title: isRental ? "Precio al mes" : "Precio",
      isActiveFn: () => {
        const x = getParamsFromURL();
        return x.priceMin != null || x.priceMax != null;
      },
      onClear: () => {
        c.minInput.value = "";
        c.maxInput.value = "";
        setURLParam("price_min", null);
        setURLParam("price_max", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- m² útiles interiores ---
  function buildUseful() {
    const c = numericRangeControl({
      type: "area",
      initialMin: p.usefulMin,
      initialMax: p.usefulMax,
      placeholderMin: mode === "room" ? "Habitación mín. (m²)" : "Útiles mínimos (m²)",
      placeholderMax: mode === "room" ? "Habitación máx. (m²)" : "Útiles máximos (m²)",
      onChange: (min, max) => {
        setURLParam("useful_min", min);
        setURLParam("useful_max", max);
        touch();
      }
    });
    return add(filterBlock({
      title: mode === "room" ? "m² útiles habitación" : "m² útiles interiores",
      isActiveFn: () => {
        const x = getParamsFromURL();
        return x.usefulMin != null || x.usefulMax != null;
      },
      onClear: () => {
        c.minInput.value = "";
        c.maxInput.value = "";
        setURLParam("useful_min", null);
        setURLParam("useful_max", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Periodo de construcción ---
  function buildBuildPeriods() {
    const c = multiSelectControl({
      options: [
        ["new_build", "Obra nueva"],
        ["2020_plus", "2020+"],
        ["2010_2020", "2010–2020"],
        ["2000_2010", "2000–2010"],
        ["1990_2000", "1990–2000"],
        ["1980_1990", "1980–1990"],
        ["1970_1980", "1970–1980"],
        ["1960_1970", "1960–1970"],
        ["1950_1960", "1950–1960"],
        ["1940_1950", "1940–1950"],
        ["pre1940", "Antes de 1940"]
      ],
      initialValues: p.buildPeriods,
      collapseAfter: 5,
      onChange: (vals) => {
        setURLParam("build_periods", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Construcción",
      isActiveFn: () => getParamsFromURL().buildPeriods.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("build_periods", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Publicación / ofertado desde ---
  function buildSince() {
    const c = selectOneControl({
      options: [
        ["1", "Últimas 24 horas"],
        ["5", "Últimos 5 días"],
        ["10", "Últimos 10 días"],
        ["30", "Últimos 30 días"],
        ["60", "Últimos 60 días"]
      ],
      initial: p.sinceDays == null ? null : String(p.sinceDays),
      onChange: (val) => {
        setURLParam("since_days", intOrNull(val));
        touch();
      }
    });
    return add(filterBlock({
      title: "Publicación",
      isActiveFn: () => getParamsFromURL().sinceDays != null,
      onClear: () => {
        c.clear();
        setURLParam("since_days", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Dormitorios ---
  function buildBedrooms() {
    const c = selectOneControl({
      options: [
        ["1", "1+"],
        ["2", "2+"],
        ["3", "3+"],
        ["4", "4+"]
      ],
      initial: p.bedroomsMin == null ? null : String(p.bedroomsMin),
      onChange: (val) => {
        setURLParam("bedrooms_min", intOrNull(val));
        touch();
      }
    });
    return add(filterBlock({
      title: "Dormitorios",
      isActiveFn: () => getParamsFromURL().bedroomsMin != null,
      onClear: () => {
        c.clear();
        setURLParam("bedrooms_min", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Baños (del inmueble / del piso compartido) ---
  function buildBathrooms() {
    const c = selectOneControl({
      options: [
        ["1", "1"],
        ["2", "2"],
        ["3", "3"],
        ["4", "4"],
        ["5", "5"]
      ],
      initial: p.bathroomsMin == null ? null : String(p.bathroomsMin),
      onChange: (val) => {
        setURLParam("bathrooms_min", intOrNull(val));
        touch();
      }
    });
    return add(filterBlock({
      title: mode === "room" ? "Baños del piso" : "Baños",
      isActiveFn: () => getParamsFromURL().bathroomsMin != null,
      onClear: () => {
        c.clear();
        setURLParam("bathrooms_min", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- m² construidos totales ---
  function buildBuilt() {
    const c = numericRangeControl({
      type: "area",
      initialMin: p.builtMin,
      initialMax: p.builtMax,
      placeholderMin: "Construidos mínimos (m²)",
      placeholderMax: "Construidos máximos (m²)",
      onChange: (min, max) => {
        setURLParam("built_min", min);
        setURLParam("built_max", max);
        touch();
      }
    });
    return add(filterBlock({
      title: "m² construidos totales",
      isActiveFn: () => {
        const x = getParamsFromURL();
        return x.builtMin != null || x.builtMax != null;
      },
      onClear: () => {
        c.minInput.value = "";
        c.maxInput.value = "";
        setURLParam("built_min", null);
        setURLParam("built_max", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Espacio exterior (+ orientación dependiente) ---
  function buildOutdoor() {
    const outdoorControl = multiSelectControl({
      options: [
        ["balcon", "Balcón"],
        ["terraza", "Terraza"],
        ["jardin", "Jardín"],
        ["patio", "Patio"]
      ],
      initialValues: p.outdoorTypes,
      onChange: (vals) => {
        setURLParam("outdoor_type", toCSV(vals));
        if (!vals.length) setURLParam("orientations", null);
        touch();
      }
    });
    add(filterBlock({
      title: "Espacio exterior",
      isActiveFn: () => getParamsFromURL().outdoorTypes.length > 0,
      onClear: () => {
        outdoorControl.setValues([]);
        setURLParam("outdoor_type", null);
        setURLParam("orientations", null);
        touch();
      },
      contentEl: outdoorControl.el
    }));

    const orient = multiSelectControl({
      options: [["N", "N"], ["S", "S"], ["E", "E"], ["O", "O"]],
      initialValues: p.orientations,
      onChange: (vals) => {
        setURLParam("orientations", toCSV(vals));
        touch();
      }
    });
    add(filterBlock({
      title: "Orientación del balcón",
      isActiveFn: () => getParamsFromURL().orientations.length > 0,
      onClear: () => {
        orient.setValues([]);
        setURLParam("orientations", null);
        touch();
      },
      isVisibleFn: () => getParamsFromURL().outdoorTypes.length > 0,
      contentEl: orient.el
    }));
  }

  // --- Accesibilidad ---
  function buildAccessibility() {
    const c = multiSelectControl({
      options: [
        ["ascensor", "Ascensor"],
        ["movilidad_reducida", "Adaptado a movilidad reducida"]
      ],
      initialValues: p.accessibility,
      onChange: (vals) => {
        setURLParam("accessibility", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Accesibilidad",
      isActiveFn: () => getParamsFromURL().accessibility.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("accessibility", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Parking ---
  function buildParking() {
    const c = multiSelectControl({
      options: [
        ["incluido", "Incluido"],
        ["opcional", "Opcional"],
        ["no_disponible", "No disponible"]
      ],
      initialValues: p.parkingTypes,
      onChange: (vals) => {
        setURLParam("parking", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Parking",
      isActiveFn: () => getParamsFromURL().parkingTypes.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("parking", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Trastero ---
  function buildStorage() {
    const c = multiSelectControl({
      options: [
        ["incluido", "Incluido"],
        ["no_incluido", "No incluido"]
      ],
      initialValues: p.storageTypes,
      onChange: (vals) => {
        setURLParam("storage", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Trastero",
      isActiveFn: () => getParamsFromURL().storageTypes.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("storage", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Certificado energético ---
  function buildEnergy() {
    const c = selectOneControl({
      options: [
        ["pending", "Pendiente"],
        ["A++", "> A++"],
        ["A+", "> A+"],
        ["A", "> A"],
        ["B", "> B"],
        ["C", "> C"],
        ["D", "> D"],
        ["E", "> E"],
        ["F", "> F"],
        ["G", "> G"]
      ],
      initial: p.energyChoice,
      collapseAfter: 5,
      onChange: (val) => {
        setURLParam("energy", val);
        touch();
      }
    });
    return add(filterBlock({
      title: "Certificado energético",
      isActiveFn: () => !!getParamsFromURL().energyChoice,
      onClear: () => {
        c.clear();
        setURLParam("energy", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Disponibilidad (compra / alquiler de vivienda) ---
  function buildAvailability() {
    const c = selectOneControl({
      options: [
        ["available", "Disponible"],
        ["negotiation", "Ofertado / en negociación"],
        ["sold", isRental ? "Alquilado" : "Vendido"]
      ],
      initial: p.availability,
      onChange: (val) => {
        setURLParam("availability", val);
        touch();
      }
    });
    return add(filterBlock({
      title: "Disponibilidad",
      isActiveFn: () => !!getParamsFromURL().availability,
      onClear: () => {
        c.clear();
        setURLParam("availability", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  /* ============================================================
     ALQUILER DE VIVIENDA COMPLETA — filtros propios
     ============================================================ */

  // --- Tipo de alquiler ---
  function buildRentType() {
    const c = multiSelectControl({
      options: [
        ["larga", "Larga estancia"],
        ["temporal", "Temporal / por meses"],
        ["estudiantes", "Para estudiantes"],
        ["opcion_compra", "Con opción a compra"]
      ],
      initialValues: p.rentTypes,
      onChange: (vals) => {
        setURLParam("rent_type", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Tipo de alquiler",
      isActiveFn: () => getParamsFromURL().rentTypes.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("rent_type", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Equipamiento ---
  function buildEquipment() {
    const c = multiSelectControl({
      options: [
        ["amueblado", "Amueblado"],
        ["sin_amueblar", "Sin amueblar"],
        ["cocina_equipada", "Cocina equipada"],
        ["electrodomesticos", "Electrodomésticos"],
        ["calefaccion", "Calefacción"],
        ["aire", "Aire acondicionado"],
        ["armarios", "Armarios empotrados"]
      ],
      initialValues: p.equipment,
      collapseAfter: 5,
      onChange: (vals) => {
        setURLParam("equipment", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Equipamiento",
      isActiveFn: () => getParamsFromURL().equipment.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("equipment", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Condiciones económicas ---
  function buildRentConditions() {
    const c = multiSelectControl({
      options: [
        ["gastos_incluidos", "Gastos incluidos"],
        ["comunidad_incluida", "Comunidad incluida"],
        ["sin_aval", "Sin aval"],
        ["fianza_reducida", "Fianza reducida"],
        ["sin_honorarios", "Sin honorarios de agencia"]
      ],
      initialValues: p.rentConditions,
      onChange: (vals) => {
        setURLParam("rent_conditions", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Condiciones económicas",
      isActiveFn: () => getParamsFromURL().rentConditions.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("rent_conditions", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Mascotas ---
  function buildPets() {
    const c = selectOneControl({
      options: [
        ["yes", "Admite mascotas"],
        ["no", "No admite mascotas"]
      ],
      initial: p.pets,
      onChange: (val) => {
        setURLParam("pets", val);
        touch();
      }
    });
    return add(filterBlock({
      title: "Mascotas",
      isActiveFn: () => !!getParamsFromURL().pets,
      onClear: () => {
        c.clear();
        setURLParam("pets", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  /* ============================================================
     ALQUILER DE HABITACIÓN — inmueble + convivencia + perfil
     ============================================================ */

  // --- El precio incluye ---
  function buildRoomIncludes() {
    const c = multiSelectControl({
      options: [
        ["gastos", "Gastos incluidos"],
        ["suministros", "Suministros (luz, agua, gas)"],
        ["internet", "Internet incluido"],
        ["limpieza", "Limpieza incluida"]
      ],
      initialValues: p.roomIncludes,
      onChange: (vals) => {
        setURLParam("room_includes", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "El precio incluye",
      isActiveFn: () => getParamsFromURL().roomIncludes.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("room_includes", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Tipo de habitación ---
  function buildRoomType() {
    const c = multiSelectControl({
      options: [
        ["individual", "Individual"],
        ["doble", "Doble"],
        ["dos_camas", "Con dos camas"],
        ["sin_cama", "Sin cama"],
        ["amueblada", "Amueblada"],
        ["exterior", "Exterior / ventana a la calle"],
        ["bano_privado", "Baño privado"],
        ["balcon", "Con balcón"],
        ["escritorio", "Con escritorio"],
        ["armario", "Con armario"]
      ],
      initialValues: p.roomTypes,
      collapseAfter: 5,
      onChange: (vals) => {
        setURLParam("room_type", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Tipo de habitación",
      isActiveFn: () => getParamsFromURL().roomTypes.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("room_type", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Estancia / disponibilidad ---
  function buildRoomStay() {
    const c = selectOneControl({
      options: [
        ["now", "Disponible ahora"],
        ["larga", "Larga estancia"],
        ["temporal", "Temporal / por meses"],
        ["reserva_online", "Con reserva online"]
      ],
      initial: p.roomStay,
      onChange: (val) => {
        setURLParam("room_stay", val);
        touch();
      }
    });
    return add(filterBlock({
      title: "Estancia",
      isActiveFn: () => !!getParamsFromURL().roomStay,
      onClear: () => {
        c.clear();
        setURLParam("room_stay", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Vivienda compartida ---
  function buildHousehold() {
    const c = multiSelectControl({
      options: [
        ["mixto", "Piso mixto"],
        ["solo_chicas", "Solo chicas"],
        ["solo_chicos", "Solo chicos"],
        ["propietario_dentro", "Propietario vive en el piso"],
        ["propietario_fuera", "Propietario no vive en el piso"]
      ],
      initialValues: p.household,
      onChange: (vals) => {
        setURLParam("household", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Vivienda compartida",
      isActiveFn: () => getParamsFromURL().household.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("household", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Perfil de los compañeros ---
  function buildFlatmates() {
    const c = multiSelectControl({
      options: [
        ["estudiantes", "Estudiantes"],
        ["trabajadores", "Trabajadores"],
        ["jovenes", "Ambiente joven (18–30)"],
        ["profesional", "Ambiente profesional"],
        ["tranquilo", "Ambiente tranquilo"]
      ],
      initialValues: p.flatmates,
      onChange: (vals) => {
        setURLParam("flatmates", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Perfil de compañeros",
      isActiveFn: () => getParamsFromURL().flatmates.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("flatmates", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Convivencia ---
  function buildCoexistence() {
    const c = multiSelectControl({
      options: [
        ["fumar", "Se puede fumar"],
        ["no_fumar", "No fumadores"],
        ["mascotas", "Se aceptan mascotas"],
        ["parejas", "Se aceptan parejas"],
        ["menores", "Se aceptan menores"],
        ["lgtb", "LGTB friendly"],
        ["limpieza", "Limpieza / turnos incluidos"]
      ],
      initialValues: p.coexistence,
      collapseAfter: 5,
      onChange: (vals) => {
        setURLParam("coexistence", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Convivencia",
      isActiveFn: () => getParamsFromURL().coexistence.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("coexistence", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Características del piso ---
  function buildRoomAmenities() {
    const c = multiSelectControl({
      options: [
        ["ascensor", "Ascensor"],
        ["aire", "Aire acondicionado"],
        ["calefaccion", "Calefacción"],
        ["terraza", "Terraza / zonas comunes"],
        ["cocina", "Cocina equipada"],
        ["lavadora", "Lavadora"],
        ["lavavajillas", "Lavavajillas"],
        ["internet", "Internet / wifi"],
        ["salon", "Salón compartido"]
      ],
      initialValues: p.roomAmenities,
      collapseAfter: 5,
      onChange: (vals) => {
        setURLParam("room_amenities", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Características del piso",
      isActiveFn: () => getParamsFromURL().roomAmenities.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("room_amenities", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  // --- Anunciante ---
  function buildAdvertiser() {
    const c = multiSelectControl({
      options: [
        ["particular", "Particular"],
        ["companero", "Compañero de piso"],
        ["propietario", "Propietario"],
        ["agencia", "Agencia"]
      ],
      initialValues: p.advertiser,
      onChange: (vals) => {
        setURLParam("advertiser", toCSV(vals));
        touch();
      }
    });
    return add(filterBlock({
      title: "Anunciante",
      isActiveFn: () => getParamsFromURL().advertiser.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("advertiser", null);
        touch();
      },
      contentEl: c.el
    }));
  }

  /* ============================================================
     ENSAMBLAJE POR MODO
     ============================================================ */
  if (mode === "rent") {
    // Alquiler de vivienda completa: inmobiliario + condiciones de alquiler
    buildPrice();
    buildRentType();
    buildUseful();
    buildBedrooms();
    buildBathrooms();
    buildEquipment();
    buildRentConditions();
    buildPets();
    buildOutdoor();
    buildAccessibility();
    buildParking();
    buildStorage();
    buildEnergy();
    buildSince();
    buildAvailability();
  } else if (mode === "room") {
    // Alquiler de habitación: habitación + convivencia + perfil compatible
    buildPrice();
    buildRoomIncludes();
    buildRoomType();
    buildRoomStay();
    buildHousehold();
    buildFlatmates();
    buildCoexistence();
    buildRoomAmenities();
    buildUseful();
    buildBathrooms();
    buildSince();
  } else {
    // Comprar / Obra nueva / Todas: filtros de venta (sin cambios)
    buildPrice();
    buildUseful();
    buildBuildPeriods();
    buildSince();
    buildBedrooms();
    buildBathrooms();
    buildBuilt();
    buildOutdoor();
    buildAccessibility();
    buildParking();
    buildStorage();
    buildEnergy();
    buildAvailability();
  }

  mount.innerHTML = "";
  mount.appendChild(root);
  refreshAll();
}


export function clearAllFilters({ mountId } = {}) {
  const u = new URL(window.location.href);
  [
    "price_min", "price_max",
    "useful_min", "useful_max",
    "built_min", "built_max",
    "build_periods",
    "since_days",
    "bedrooms_min",
    "bathrooms_min",
    "outdoor_type",
    "orientations",
    "accessibility",
    "parking",
    "storage",
    "energy",
    "availability",
    "rent_type",
    "equipment",
    "rent_conditions",
    "pets",
    "room_includes",
    "room_type",
    "room_stay",
    "household",
    "flatmates",
    "coexistence",
    "room_amenities",
    "advertiser"
  ].forEach((k) => u.searchParams.delete(k));

  history.replaceState(null, "", u.toString());

  if (mountId) {
    initFiltersBar({ mountId });
  }

  fireFiltersChanged();
}
