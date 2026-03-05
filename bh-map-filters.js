/*
  bh-map-filters.js

  Implementación según “Definición de filtros” (30-01-2026 / actualizado):
  - Sin botones “Aplicar / Limpiar”: el mapa se actualiza al cambiar.
  - Cada bloque tiene una X para vaciar el filtro.
  - Tipo 1 (rango numérico): dropdown con sugerencias dinámicas (aparece al enfocar y se actualiza al escribir).
  - Si mínimo > máximo: se intercambian automáticamente.

  Nota (límite actual del backend en este repo):
  - Dormitorios: el documento contempla “bedrooms = X” y “bedrooms >= X”.
    En el código actual del mapa solo se envía bedrooms_min (>=). Esta UI usa el modo mínimo (X+).
*/

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
  (children || []).forEach((c) => c != null && n.appendChild(c));
  return n;
}

function intOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function toCSV(arr) {
  if (!arr || !arr.length) return null;
  return arr.join(",");
}

function fromCSV(s) {
  if (!s) return [];
  return String(s).split(",").map(x => x.trim()).filter(Boolean);
}

function getParamsFromURL() {
  const u = new URL(window.location.href);

  let mode = (u.searchParams.get("mode") || "").trim().toLowerCase();
  if (!mode) mode = "buy";
  const allowed = ["buy","rent","room","new_build","all"];
  if (!allowed.includes(mode)) mode = "buy";

  return {
    mode,

    priceMin: intOrNull(u.searchParams.get("price_min")),
    priceMax: intOrNull(u.searchParams.get("price_max")),

    usefulMin: intOrNull(u.searchParams.get("useful_min")),
    usefulMax: intOrNull(u.searchParams.get("useful_max")),

    builtMin: intOrNull(u.searchParams.get("built_min")),
    builtMax: intOrNull(u.searchParams.get("built_max")),

    bedroomsMin: intOrNull(u.searchParams.get("bedrooms_min")),
    bathroomsMin: intOrNull(u.searchParams.get("bathrooms_min")),

    outdoorType: (u.searchParams.get("outdoor_type") || "").trim() || null,
    orientations: fromCSV(u.searchParams.get("orientations")),

    buildPeriods: fromCSV(u.searchParams.get("build_periods")),
    accessibility: fromCSV(u.searchParams.get("accessibility")),
    parkingTypes: fromCSV(u.searchParams.get("parking")),
    storageTypes: fromCSV(u.searchParams.get("storage")),

    energyChoice: (u.searchParams.get("energy") || "").trim() || null,

    listedSinceDays: intOrNull(u.searchParams.get("since_days")),
    availability: (u.searchParams.get("availability") || "").trim() || null
  };
}

function setURLParam(key, value) {
  const u = new URL(window.location.href);
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
    u.searchParams.delete(key);
  } else {
    u.searchParams.set(key, String(value));
  }
  history.replaceState(null, "", u.toString());
}

function fireFiltersChanged() {
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

function euro(n) {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} €`;
  }
}

/* ---------------------------
   Tipo 1: dropdown sugerencias
--------------------------- */

function uniqueSorted(nums) {
  const s = new Set(nums.filter((n) => Number.isFinite(n)));
  return Array.from(s).sort((a, b) => a - b);
}

// “2” -> 200.000 (compra), “75” -> 75.000, alquiler “2” -> 2.000
function normalizeTypedPriceBase(digits, mode) {
  const typedInt = intOrNull(digits);
  if (typedInt == null) return null;

  if (mode === "rent") {
    if (digits.length === 1) return typedInt * 1000;
    return typedInt;
  }

  if (digits.length === 1) return typedInt * 100000;
  if (digits.length === 2) return typedInt * 1000;
  return typedInt;
}

function suggestPrice(digits, mode) {
  const base = normalizeTypedPriceBase(digits, mode);

  const max = (mode === "rent") ? 3000 : 2000000;

  if (base == null) {
    return mode === "rent"
      ? [700, 900, 1100, 1300, 1500, 1800, 2000, 2500, 3000]
      : [0, 50000, 75000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 500000, 2000000];
  }

  let step;
  if (mode === "rent") step = (base < 1000) ? 100 : (base < 2000) ? 200 : 250;
  else step = (base < 100000) ? 25000 : (base < 500000) ? 50000 : 100000;

  const out = [base];
  for (let i = 1; i <= 6; i++) out.push(base + step * i);

  if (mode === "rent") out.push(3000);
  else out.push(2000000);

  return uniqueSorted(out.map(v => Math.min(Math.max(0, v), max)));
}

function suggestArea() {
  return [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200];
}

function suggestBuilt() {
  // El documento no fija escalones; usamos los mismos que útiles para consistencia.
  return [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200];
}

function closeAnyOpenDropdown(root) {
  root.querySelectorAll(".fDrop").forEach((d) => (d.style.display = "none"));
}

function makeDropdownForInput({ root, inputEl, getValuesFn, formatFn, onPick }) {
  const wrap = el("div", { class: "fDropWrap" }, [inputEl]);
  const drop = el("div", { class: "fDrop", role: "listbox" });
  wrap.appendChild(drop);

  function render(values) {
    drop.innerHTML = "";
    values.forEach((v) => {
      const b = el("button", { class: "fDropItem", type: "button", text: formatFn(v) });
      b.addEventListener("click", () => onPick(v));
      drop.appendChild(b);
    });
  }

  function open() {
    closeAnyOpenDropdown(root);
    render(getValuesFn());
    drop.style.display = "block";
  }

  function refresh() {
    if (drop.style.display !== "block") return;
    render(getValuesFn());
  }

  function close() {
    drop.style.display = "none";
  }

  inputEl.addEventListener("focus", open);
  inputEl.addEventListener("input", refresh);

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) close();
  });

  return { wrap, close };
}

function maybeSwapMinMax(aEl, bEl) {
  const av = intOrNull(aEl.value);
  const bv = intOrNull(bEl.value);
  if (av != null && bv != null && av > bv) {
    aEl.value = String(bv);
    bEl.value = String(av);
    return [bv, av];
  }
  return [av, bv];
}

function numericRange({ root, placeholderA, placeholderB, initialA, initialB, getSuggestions, formatPicked, onChange }) {
  const a = el("input", { class: "fInp", type: "text", inputmode: "numeric", placeholder: placeholderA, value: initialA ?? "" });
  const b = el("input", { class: "fInp", type: "text", inputmode: "numeric", placeholder: placeholderB, value: initialB ?? "" });

  const fmt = formatPicked || ((v) => String(v));

  const ddA = makeDropdownForInput({
    root,
    inputEl: a,
    getValuesFn: () => getSuggestions(String(a.value || "")),
    formatFn: fmt,
    onPick: (v) => {
      a.value = String(v);
      ddA.close();
      emit();
    }
  });

  const ddB = makeDropdownForInput({
    root,
    inputEl: b,
    getValuesFn: () => getSuggestions(String(b.value || "")),
    formatFn: fmt,
    onPick: (v) => {
      b.value = String(v);
      ddB.close();
      emit();
    }
  });

  function emit() {
    const [min, max] = maybeSwapMinMax(a, b);
    onChange && onChange(min, max);
  }

  a.addEventListener("input", emit);
  b.addEventListener("input", emit);

  const row = el("div", { class: "fRow2" }, [ddA.wrap, ddB.wrap]);
  const wrap = el("div", { class: "fBody" }, [row]);

  return { el: wrap, a, b };
}

/* ---------------------------
   Tipo 2 y 3: selects y multi
--------------------------- */

function selectOne({ options, initial, onChange }) {
  const sel = el("select", { class: "fSel" });
  options.forEach(([v, t]) => sel.appendChild(el("option", { value: v, text: t })));
  sel.value = initial ?? "";
  sel.addEventListener("change", () => {
    const v = sel.value || "";
    onChange && onChange(v ? v : null);
  });
  return sel;
}

function checkboxGroup({ options, initialValues, onChange, logicLabel }) {
  const current = new Set((initialValues || []).map(String));
  const wrap = el("div", { class: "fBody" });

  if (logicLabel) wrap.appendChild(el("div", { class: "fSuggest", text: logicLabel }));

  options.forEach(({ value, label }) => {
    const id = `cb_${value}_${Math.random().toString(16).slice(2)}`;
    const inp = el("input", { type: "checkbox", id, value });
    inp.checked = current.has(String(value));

    inp.addEventListener("change", () => {
      if (inp.checked) current.add(String(value));
      else current.delete(String(value));
      onChange && onChange(Array.from(current));
    });

    wrap.appendChild(el("label", { class: "fRadio", for: id }, [
      inp,
      el("span", { class: "fRadioLabel", text: label })
    ]));
  });

  function setValues(values) {
    current.clear();
    (values || []).forEach((v) => current.add(String(v)));
    wrap.querySelectorAll('input[type="checkbox"]').forEach((c) => {
      c.checked = current.has(String(c.value));
    });
  }

  return { el: wrap, setValues };
}

function filterBlock({ title, isActiveFn, onClear, contentEl }) {
  const dot = el("div", { class: "fDot" });
  const titleEl = el("div", { class: "fTitleText", text: title });

  const clearBtn = el("button", { class: "fClearBtn", type: "button", text: "×", "aria-label": "Quitar filtro" });
  clearBtn.addEventListener("click", () => onClear && onClear());

  const head = el("div", { class: "fHead" }, [
    el("div", { class: "fTitle" }, [dot, titleEl]),
    clearBtn
  ]);

  const wrap = el("div", { class: "fBlock" }, [head, contentEl]);

  function refresh() {
    const active = !!(isActiveFn && isActiveFn());
    wrap.classList.toggle("active", active);
    clearBtn.classList.toggle("active", active);
  }

  return { el: wrap, refresh };
}

export function initFiltersBar({ mountId }) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const root = el("div", { class: "filtersRoot" });
  const blocks = [];

  function refreshAll() {
    blocks.forEach((b) => b.refresh());
  }

  function touch() {
    fireFiltersChanged();
    refreshAll();
  }

  const p0 = getParamsFromURL();

  // 2. Precio mínimo / máximo
  {
    const range = numericRange({
      root,
      placeholderA: "Mín €",
      placeholderB: "Máx €",
      initialA: p0.priceMin,
      initialB: p0.priceMax,
      getSuggestions: (typed) => {
        const digits = String(typed || "").replace(/\D/g, "");
        return suggestPrice(digits, p0.mode === "rent" ? "rent" : "buy");
      },
      formatPicked: euro,
      onChange: (min, max) => {
        setURLParam("price_min", min);
        setURLParam("price_max", max);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Precio mínimo / máximo",
      isActiveFn: () => {
        const p = getParamsFromURL();
        return p.priceMin != null || p.priceMax != null;
      },
      onClear: () => {
        range.a.value = "";
        range.b.value = "";
        setURLParam("price_min", null);
        setURLParam("price_max", null);
        touch();
      },
      contentEl: range.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 3. Metros cuadrados útiles
  {
    const p = getParamsFromURL();
    const range = numericRange({
      root,
      placeholderA: "Mín (m²)",
      placeholderB: "Máx (m²)",
      initialA: p.usefulMin,
      initialB: p.usefulMax,
      getSuggestions: () => suggestArea(),
      onChange: (min, max) => {
        setURLParam("useful_min", min);
        setURLParam("useful_max", max);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Metros cuadrados útiles",
      isActiveFn: () => {
        const pp = getParamsFromURL();
        return pp.usefulMin != null || pp.usefulMax != null;
      },
      onClear: () => {
        range.a.value = "";
        range.b.value = "";
        setURLParam("useful_min", null);
        setURLParam("useful_max", null);
        touch();
      },
      contentEl: range.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 4. Metros cuadrados construidos (no aparece en habitación)
  if (p0.mode !== "room") {
    const p = getParamsFromURL();
    const range = numericRange({
      root,
      placeholderA: "Mín (m²)",
      placeholderB: "Máx (m²)",
      initialA: p.builtMin,
      initialB: p.builtMax,
      getSuggestions: () => suggestBuilt(),
      onChange: (min, max) => {
        setURLParam("built_min", min);
        setURLParam("built_max", max);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Metros cuadrados construidos",
      isActiveFn: () => {
        const pp = getParamsFromURL();
        return pp.builtMin != null || pp.builtMax != null;
      },
      onClear: () => {
        range.a.value = "";
        range.b.value = "";
        setURLParam("built_min", null);
        setURLParam("built_max", null);
        touch();
      },
      contentEl: range.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 5. Número de dormitorios (mínimo)
  {
    const p = getParamsFromURL();
    const sel = selectOne({
      options: [
        ["", "Sin preferencia"],
        ["1", "1+"],
        ["2", "2+"],
        ["3", "3+"],
        ["4", "4+"]
      ],
      initial: (p.bedroomsMin == null ? "" : String(p.bedroomsMin)),
      onChange: (v) => {
        setURLParam("bedrooms_min", intOrNull(v));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Número de dormitorios",
      isActiveFn: () => (getParamsFromURL().bedroomsMin != null),
      onClear: () => {
        sel.value = "";
        setURLParam("bedrooms_min", null);
        touch();
      },
      contentEl: el("div", { class: "fBody" }, [sel])
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 6. Número de baños (mínimo) (1..5)
  {
    const p = getParamsFromURL();
    const sel = selectOne({
      options: [
        ["", "Sin preferencia"],
        ["1", "1"],
        ["2", "2"],
        ["3", "3"],
        ["4", "4"],
        ["5", "5"]
      ],
      initial: (p.bathroomsMin == null ? "" : String(p.bathroomsMin)),
      onChange: (v) => {
        setURLParam("bathrooms_min", intOrNull(v));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Número de baños",
      isActiveFn: () => (getParamsFromURL().bathroomsMin != null),
      onClear: () => {
        sel.value = "";
        setURLParam("bathrooms_min", null);
        touch();
      },
      contentEl: el("div", { class: "fBody" }, [sel])
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 7. Outdoor space (espacio exterior)
  {
    const p = getParamsFromURL();
    const sel = selectOne({
      options: [
        ["", "Sin preferencia"],
        ["balcon", "Balcón"],
        ["terraza", "Terraza"],
        ["jardin", "Jardín"],
        ["patio", "Patio"]
      ],
      initial: p.outdoorType || "",
      onChange: (v) => {
        setURLParam("outdoor_type", v);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Outdoor space (espacio exterior)",
      isActiveFn: () => !!getParamsFromURL().outdoorType,
      onClear: () => {
        sel.value = "";
        setURLParam("outdoor_type", null);
        touch();
      },
      contentEl: el("div", { class: "fBody" }, [sel])
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 8. Orientación del balcón (OR)
  {
    const p = getParamsFromURL();
    const grp = checkboxGroup({
      options: [
        { value: "N", label: "N" },
        { value: "NE", label: "NE" },
        { value: "E", label: "E" },
        { value: "SE", label: "SE" },
        { value: "S", label: "S" },
        { value: "SW", label: "SW" },
        { value: "W", label: "W" },
        { value: "NW", label: "NW" }
      ],
      initialValues: p.orientations,
      logicLabel: "Coincide cualquiera (OR)",
      onChange: (vals) => {
        setURLParam("orientations", toCSV(vals));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Orientación del balcón",
      isActiveFn: () => getParamsFromURL().orientations.length > 0,
      onClear: () => {
        grp.setValues([]);
        setURLParam("orientations", null);
        touch();
      },
      contentEl: grp.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 9. Periodo de construcción (OR)
  {
    const p = getParamsFromURL();
    const grp = checkboxGroup({
      options: [
        { value: "pre_1950", label: "Anterior a 1950" },
        { value: "1950_1999", label: "1950–1999" },
        { value: "2000_plus", label: "2000 en adelante" }
      ],
      initialValues: p.buildPeriods,
      logicLabel: "Coincide cualquiera (OR)",
      onChange: (vals) => {
        setURLParam("build_periods", toCSV(vals));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Periodo de construcción",
      isActiveFn: () => getParamsFromURL().buildPeriods.length > 0,
      onClear: () => {
        grp.setValues([]);
        setURLParam("build_periods", null);
        touch();
      },
      contentEl: grp.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 10. Accesibilidad (AND)
  {
    const p = getParamsFromURL();
    const grp = checkboxGroup({
      options: [
        { value: "ascensor", label: "Ascensor" },
        { value: "movilidad_reducida", label: "Adaptado a movilidad reducida" }
      ],
      initialValues: p.accessibility,
      logicLabel: "Debe cumplir todas (AND)",
      onChange: (vals) => {
        setURLParam("accessibility", toCSV(vals));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Accesibilidad",
      isActiveFn: () => getParamsFromURL().accessibility.length > 0,
      onClear: () => {
        grp.setValues([]);
        setURLParam("accessibility", null);
        touch();
      },
      contentEl: grp.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 11. Parking (OR)
  {
    const p = getParamsFromURL();
    const grp = checkboxGroup({
      options: [
        { value: "incluido", label: "Incluido" },
        { value: "opcional", label: "Opcional" },
        { value: "no_disponible", label: "No disponible" }
      ],
      initialValues: p.parkingTypes,
      logicLabel: "Coincide cualquiera (OR)",
      onChange: (vals) => {
        setURLParam("parking", toCSV(vals));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Parking",
      isActiveFn: () => getParamsFromURL().parkingTypes.length > 0,
      onClear: () => {
        grp.setValues([]);
        setURLParam("parking", null);
        touch();
      },
      contentEl: grp.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 12. Trastero (OR)
  {
    const p = getParamsFromURL();
    const grp = checkboxGroup({
      options: [
        { value: "incluido", label: "Incluido" },
        { value: "no_incluido", label: "No incluido" }
      ],
      initialValues: p.storageTypes,
      logicLabel: "Coincide cualquiera (OR)",
      onChange: (vals) => {
        setURLParam("storage", toCSV(vals));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Trastero",
      isActiveFn: () => getParamsFromURL().storageTypes.length > 0,
      onClear: () => {
        grp.setValues([]);
        setURLParam("storage", null);
        touch();
      },
      contentEl: grp.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 13. Energy label (certificado energético)
  {
    const p = getParamsFromURL();
    const sel = selectOne({
      options: [
        ["", "Sin preferencia"],
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
      initial: p.energyChoice || "",
      onChange: (v) => {
        setURLParam("energy", v);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Energy label (certificado energético)",
      isActiveFn: () => !!getParamsFromURL().energyChoice,
      onClear: () => {
        sel.value = "";
        setURLParam("energy", null);
        touch();
      },
      contentEl: el("div", { class: "fBody" }, [sel])
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 14. Ofertado desde (fecha de publicación)
  {
    const p = getParamsFromURL();
    const sel = selectOne({
      options: [
        ["", "Sin preferencia"],
        ["1", "Últimas 24 horas"],
        ["5", "Últimos 5 días"],
        ["10", "Últimos 10 días"],
        ["30", "Últimos 30 días"],
        ["60", "Últimos 60 días"]
      ],
      initial: (p.listedSinceDays == null ? "" : String(p.listedSinceDays)),
      onChange: (v) => {
        setURLParam("since_days", intOrNull(v));
        touch();
      }
    });

    const blk = filterBlock({
      title: "Ofertado desde",
      isActiveFn: () => (getParamsFromURL().listedSinceDays != null),
      onClear: () => {
        sel.value = "";
        setURLParam("since_days", null);
        touch();
      },
      contentEl: el("div", { class: "fBody" }, [sel])
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 15. Disponibilidad
  {
    const p = getParamsFromURL();
    const sel = selectOne({
      options: [
        ["", "Sin preferencia"],
        ["available", "Disponible"],
        ["negotiation", "Ofertado / en negociación"],
        ["sold", "Alquilado / vendido"]
      ],
      initial: p.availability || "",
      onChange: (v) => {
        setURLParam("availability", v);
        touch();
      }
    });

    const blk = filterBlock({
      title: "Disponibilidad",
      isActiveFn: () => !!getParamsFromURL().availability,
      onClear: () => {
        sel.value = "";
        setURLParam("availability", null);
        touch();
      },
      contentEl: el("div", { class: "fBody" }, [sel])
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  mount.innerHTML = "";
  mount.appendChild(root);

  blocks.forEach((b) => b.refresh());
}
