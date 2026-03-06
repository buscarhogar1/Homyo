
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
      Math.ceil(base / 50) * 50,
      Math.ceil((base + 100) / 50) * 50,
      Math.ceil((base + 200) / 50) * 50,
      Math.ceil((base + 300) / 50) * 50,
      Math.ceil((base + 500) / 50) * 50
    ];
    const uniq = [...new Set(pool.filter(v => v > 0 && v <= 3000))].sort((a, b) => a - b);
    return uniq.slice(0, 4);
  }

  let base;
  if (rawDigits.length === 1) base = typed * 100000;
  else if (rawDigits.length === 2) base = typed * 1000;
  else base = typed;

  const pool = [
    base,
    Math.ceil((base + 20000) / 1000) * 1000,
    Math.ceil((base + 50000) / 1000) * 1000,
    Math.ceil((base + 100000) / 1000) * 1000,
    Math.ceil((base + 200000) / 1000) * 1000,
    Math.ceil((base + 500000) / 1000) * 1000,
    2000000
  ];
  const uniq = [...new Set(pool.filter(v => v > 0 && v <= 2000000))].sort((a, b) => a - b);
  return uniq.slice(0, 4);
}

function getAreaSuggestions(rawDigits) {
  if (!rawDigits) return getAreaDefaultSuggestions();
  const typed = parseInt(rawDigits, 10);
  if (!Number.isFinite(typed)) return getAreaDefaultSuggestions();

  let base;
  if (rawDigits.length === 1) base = typed * 10;
  else base = typed;

  const pool = [
    base,
    base + 5,
    base + 10,
    base + 15,
    base + 20,
    base + 30,
    base + 50
  ];
  const uniq = [...new Set(pool.filter(v => v > 0))].sort((a, b) => a - b);
  return uniq.slice(0, 4);
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

function selectOneControl({ options, initial, onChange }) {
  const body = el("div", { class: "fBody" });
  const col = el("div", { class: "fOptCol" });
  const name = `f_${Math.random().toString(36).slice(2, 9)}`;

  options.forEach(([value, label]) => {
    const id = `${name}_${String(value || "empty").replace(/[^a-z0-9_-]/gi, "_")}`;
    const input = el("input", { type: "radio", name, id, value: value ?? "" });
    if ((initial ?? "") === (value ?? "")) input.checked = true;
    input.addEventListener("change", () => {
      if (input.checked) onChange?.(value || null);
    });

    const row = el("label", { class: "fOptLine", for: id }, [
      input,
      el("span", { class: "fOptText", text: label })
    ]);

    col.appendChild(row);
  });

  body.appendChild(col);
  return { el: body, clear: () => {
    col.querySelectorAll("input[type=radio]").forEach(r => { r.checked = false; });
    onChange?.(null);
  }};
}

function multiSelectControl({ options, initialValues, onChange }) {
  const body = el("div", { class: "fBody" });
  const col = el("div", { class: "fOptCol" });
  const selected = new Set((initialValues || []).map(String));
  const name = `m_${Math.random().toString(36).slice(2, 9)}`;

  function emit() {
    onChange?.(Array.from(selected));
  }

  options.forEach(([value, label]) => {
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
  });

  body.appendChild(col);
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

  /* 1. Precio mínimo / máximo */
  {
    const c = numericRangeControl({
      type: "price",
      initialMin: p.priceMin,
      initialMax: p.priceMax,
      placeholderMin: "Precio mínimo",
      placeholderMax: "Precio máximo",
      onChange: (min, max) => {
        setURLParam("price_min", min);
        setURLParam("price_max", max);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Precio mínimo / máximo",
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
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 2. Metros cuadrados útiles interiores */
  {
    const c = numericRangeControl({
      type: "area",
      initialMin: p.usefulMin,
      initialMax: p.usefulMax,
      placeholderMin: "Útiles mínimos (m²)",
      placeholderMax: "Útiles máximos (m²)",
      onChange: (min, max) => {
        setURLParam("useful_min", min);
        setURLParam("useful_max", max);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Metros cuadrados útiles interiores",
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
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 3. Periodo de construcción */
  {
    const c = multiSelectControl({
      options: [
        ["pre1960", "Antes de 1960"],
        ["1960_1970", "1960–1970"],
        ["1970_1980", "1970–1980"],
        ["1980_1990", "1980–1990"],
        ["1990_2000", "1990–2000"],
        ["2000_2010", "2000–2010"],
        ["2010_2020", "2010–2020"],
        ["2020_plus", "2020+"]
      ],
      initialValues: p.buildPeriods,
      onChange: (vals) => {
        setURLParam("build_periods", toCSV(vals));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Periodo de construcción",
      isActiveFn: () => getParamsFromURL().buildPeriods.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("build_periods", null);
        touch();
      },
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 4. Ofertado desde */
  {
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

    const blk = filterBlock({
      title: "Ofertado desde (fecha de publicación)",
      isActiveFn: () => getParamsFromURL().sinceDays != null,
      onClear: () => {
        c.clear();
        setURLParam("since_days", null);
        touch();
      },
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 5. Número mínimo de dormitorios */
  {
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

    const blk = filterBlock({
      title: "Número mínimo de dormitorios",
      isActiveFn: () => getParamsFromURL().bedroomsMin != null,
      onClear: () => {
        c.clear();
        setURLParam("bedrooms_min", null);
        touch();
      },
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 6. Número de baños */
  {
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

    const blk = filterBlock({
      title: "Número de baños",
      isActiveFn: () => getParamsFromURL().bathroomsMin != null,
      onClear: () => {
        c.clear();
        setURLParam("bathrooms_min", null);
        touch();
      },
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 7. Metros cuadrados construidos totales */
  if (mode !== "room") {
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

    const blk = filterBlock({
      title: "Metros cuadrados construidos totales",
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
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 8. Espacio exterior */
  let outdoorControl = null;
  {
    outdoorControl = multiSelectControl({
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

    const blk = filterBlock({
      title: "Espacio exterior",
      isActiveFn: () => getParamsFromURL().outdoorTypes.length > 0,
      onClear: () => {
        outdoorControl.setValues([]);
        setURLParam("outdoor_type", null);
        setURLParam("orientations", null);
        touch();
      },
      contentEl: outdoorControl.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 9. Orientación del balcón */
  {
    const c = multiSelectControl({
      options: [
        ["N", "N"],
        ["S", "S"],
        ["E", "E"],
        ["O", "O"]
      ],
      initialValues: p.orientations,
      onChange: (vals) => {
        setURLParam("orientations", toCSV(vals));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Orientación del balcón",
      isActiveFn: () => getParamsFromURL().orientations.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("orientations", null);
        touch();
      },
      isVisibleFn: () => getParamsFromURL().outdoorTypes.length > 0,
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 10. Accesibilidad */
  {
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

    const blk = filterBlock({
      title: "Accesibilidad",
      isActiveFn: () => getParamsFromURL().accessibility.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("accessibility", null);
        touch();
      },
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 11. Parking */
  {
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

    const blk = filterBlock({
      title: "Parking",
      isActiveFn: () => getParamsFromURL().parkingTypes.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("parking", null);
        touch();
      },
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 12. Trastero */
  {
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

    const blk = filterBlock({
      title: "Trastero",
      isActiveFn: () => getParamsFromURL().storageTypes.length > 0,
      onClear: () => {
        c.setValues([]);
        setURLParam("storage", null);
        touch();
      },
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 13. Mínimo certificado energético */
  {
    const c = selectOneControl({
      options: [
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
      ],
      initial: p.energyChoice,
      onChange: (val) => {
        setURLParam("energy", val);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Mínimo certificado energético",
      isActiveFn: () => !!getParamsFromURL().energyChoice,
      onClear: () => {
        c.clear();
        setURLParam("energy", null);
        touch();
      },
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 14. Disponibilidad */
  {
    const c = selectOneControl({
      options: [
        ["available", "Disponible"],
        ["negotiation", "Ofertado / en negociación"],
        ["sold", "Alquilado / vendido"]
      ],
      initial: p.availability,
      onChange: (val) => {
        setURLParam("availability", val);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Disponibilidad",
      isActiveFn: () => !!getParamsFromURL().availability,
      onClear: () => {
        c.clear();
        setURLParam("availability", null);
        touch();
      },
      contentEl: c.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  mount.innerHTML = "";
  mount.appendChild(root);
  refreshAll();
}
