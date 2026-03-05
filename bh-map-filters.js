/*
  bh-map-filters.js

  Implementación basada en la definición funcional de filtros.
  Reglas clave:
  - En el mapa NO existe el filtro "Tipo de oferta". El modo viene de la portada (mode en URL).
  - No hay botones “Aplicar” ni “Limpiar”: el mapa se actualiza al cambiar cualquier filtro.
  - Cada filtro tiene una “×” para vaciarlo; si el filtro está activo, la × se marca como activa.
  - Tipo 1 (rango numérico): inputs min/max + dropdown dinámico de sugerencias (máx 4).
    - El dropdown aparece al hacer foco y se actualiza al escribir.
    - El usuario puede seleccionar una sugerencia o escribir cualquier valor manualmente.
    - Si min > max, se intercambian automáticamente.
  - Las opciones de selección (única o múltiple) se muestran SIEMPRE en columna (una opción por línea).
*/

function h(tag, attrs, children) {
  const n = document.createElement(tag);
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k === "value") n.value = v;
    else n.setAttribute(k, v);
  }
  (children || []).forEach(c => { if (c) n.appendChild(c); });
  return n;
}

function toInt(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
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

function setURLParam(key, value) {
  const u = new URL(window.location.href);
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) u.searchParams.delete(key);
  else u.searchParams.set(key, String(value));
  history.replaceState(null, "", u.toString());
}

function fireFiltersChanged() {
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

function getMode() {
  const u = new URL(window.location.href);
  const mode = (u.searchParams.get("mode") || "buy").trim().toLowerCase();
  const allowed = ["buy","rent","room","new_build","all"];
  return allowed.includes(mode) ? mode : "buy";
}

/* =====================
   Sugerencias (Tipo 1)
   ===================== */

const PRICE_LADDER_BUY = [
  0, 50000, 75000, 100000, 125000, 150000, 175000, 200000, 250000, 300000,
  350000, 400000, 450000, 500000, 600000, 750000, 1000000, 1250000, 1500000, 1750000, 2000000
];

const PRICE_LADDER_RENT = [
  0, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 2300, 2500, 2800, 3000
];

const AREA_LADDER = [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200];

function scaleTypedForPrice(n) {
  if (n == null) return null;
  if (n < 10) return n * 100000;      // "2" -> 200.000
  if (n < 100) return n * 1000;       // "75" -> 75.000
  return n;                            // "120000" -> 120.000
}

function scaleTypedForArea(n) {
  if (n == null) return null;
  if (n < 20) return n * 10;          // "7" -> 70
  return n;
}

function nextSuggestionsFromLadder(ladder, target, maxCount) {
  const list = ladder.slice().sort((a,b)=>a-b);
  if (target == null) {
    // sin teclear: primeras (sin 0)
    return list.filter(x => x !== 0).slice(0, maxCount);
  }
  const idx = Math.max(0, list.findIndex(x => x >= target));
  const start = (idx === -1) ? list.length - 1 : idx;
  const out = [];
  for (let i = start; i < list.length && out.length < maxCount; i++) {
    if (list[i] === 0) continue;
    out.push(list[i]);
  }
  // Si no hay suficientes hacia arriba, completamos hacia abajo (cercanas)
  for (let i = start - 1; i >= 0 && out.length < maxCount; i--) {
    if (list[i] === 0) continue;
    out.push(list[i]);
  }
  // orden ascendente
  out.sort((a,b)=>a-b);
  return out.slice(0, maxCount);
}

function formatMoney(n) {
  // Sin símbolo fijo para evitar conflictos de formato; UI ya pone "€" en placeholders
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* =====================
   Bloque de filtro
   ===================== */

function filterBlock({ title, isActiveFn, onClear, contentEl }) {
  const dot = h("div", { class: "fDot" });
  const titleEl = h("div", { class: "fTitleText", text: title });

  const clearBtn = h("button", { class: "fClearBtn", type: "button", "aria-label": "Limpiar", text: "×" });
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClear?.();
  });

  const head = h("div", { class: "fHead" }, [
    h("div", { class: "fTitle" }, [dot, titleEl]),
    clearBtn
  ]);

  const blk = h("div", { class: "fBlock" }, [ head, contentEl ]);

  function refresh() {
    const active = !!isActiveFn?.();
    blk.classList.toggle("active", active);
    clearBtn.classList.toggle("active", active);
  }

  return { el: blk, refresh };
}

/* =====================
   Controles UI
   ===================== */

function numericRangeDropdown({ kind, placeholderMin, placeholderMax, initialMin, initialMax, onChange }) {
  const wrap = h("div", { class: "fBody" });

  const row = h("div", { class: "fRow2" });
  const minWrap = h("div", { class: "fInpWrap" });
  const maxWrap = h("div", { class: "fInpWrap" });

  const minInp = h("input", { class: "fInp", type: "text", inputmode: "numeric", placeholder: placeholderMin, value: initialMin == null ? "" : String(initialMin) });
  const maxInp = h("input", { class: "fInp", type: "text", inputmode: "numeric", placeholder: placeholderMax, value: initialMax == null ? "" : String(initialMax) });

  const minDrop = h("div", { class: "fDrop bh-hidden" });
  const maxDrop = h("div", { class: "fDrop bh-hidden" });

  minWrap.appendChild(minInp);
  minWrap.appendChild(minDrop);

  maxWrap.appendChild(maxInp);
  maxWrap.appendChild(maxDrop);

  row.appendChild(minWrap);
  row.appendChild(maxWrap);
  wrap.appendChild(row);

  const mode = getMode();

  function ladder() {
    if (kind === "price") return (mode === "rent") ? PRICE_LADDER_RENT : PRICE_LADDER_BUY;
    return AREA_LADDER;
  }

  function sanitize(inp) {
    const v = inp.value.replace(/[^0-9]/g, "");
    if (v !== inp.value) inp.value = v;
  }

  function computeSuggestions(rawInt) {
    const maxCount = 4;
    if (kind === "price") {
      const target = scaleTypedForPrice(rawInt);
      return nextSuggestionsFromLadder(ladder(), target, maxCount);
    }
    const target = scaleTypedForArea(rawInt);
    return nextSuggestionsFromLadder(ladder(), target, maxCount);
  }

  function renderDrop(drop, values, onPick, fmt) {
    drop.innerHTML = "";
    values.forEach(v => {
      const btn = h("button", { class: "fDropItem", type: "button", text: fmt(v) });
      btn.addEventListener("mousedown", (e) => {
        // mousedown para evitar que blur cierre antes del click
        e.preventDefault();
        onPick(v);
      });
      drop.appendChild(btn);
    });
    drop.classList.toggle("bh-hidden", values.length === 0);
  }

  function closeAllDrops() {
    minDrop.classList.add("bh-hidden");
    maxDrop.classList.add("bh-hidden");
  }

  function fmt(v) {
    if (kind === "price") return `${formatMoney(v)} €`;
    return `${v}`;
  }

  function emitAndFixSwap() {
    let min = toInt(minInp.value);
    let max = toInt(maxInp.value);

    // Regla: si min>max, se intercambian automáticamente
    if (min != null && max != null && min > max) {
      const tmp = min;
      min = max;
      max = tmp;
      minInp.value = String(min);
      maxInp.value = String(max);
    }

    onChange?.(min, max);
  }

  function openAndUpdate(inp, drop) {
    sanitize(inp);
    const rawInt = toInt(inp.value);
    const values = computeSuggestions(rawInt);
    renderDrop(drop, values, (picked) => {
      inp.value = String(picked);
      closeAllDrops();
      emitAndFixSwap();
    }, fmt);
    drop.classList.remove("bh-hidden");
  }

  function hook(inp, drop) {
    inp.addEventListener("focus", () => openAndUpdate(inp, drop));
    inp.addEventListener("input", () => {
      openAndUpdate(inp, drop);
      emitAndFixSwap();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllDrops();
    });
    inp.addEventListener("blur", () => {
      // delay para permitir click en sugerencia
      setTimeout(() => drop.classList.add("bh-hidden"), 120);
    });
  }

  hook(minInp, minDrop);
  hook(maxInp, maxDrop);

  // click fuera: cerrar
  document.addEventListener("mousedown", (e) => {
    if (!wrap.contains(e.target)) closeAllDrops();
  });

  // Emit inicial (por si hay valores ya en URL)
  emitAndFixSwap();

  return { el: wrap, minInp, maxInp };
}

function selectOneColumn({ options, initial, onChange, placeholder }) {
  const wrap = h("div", { class: "fBody" });
  const sel = h("select", { class: "fSel" });
  sel.appendChild(h("option", { value: "", text: placeholder ?? "Sin preferencia" }));
  options.forEach(([v, t]) => sel.appendChild(h("option", { value: v, text: t })));
  sel.value = initial ?? "";
  sel.addEventListener("change", () => onChange?.(sel.value || null));
  wrap.appendChild(sel);
  return { el: wrap, sel };
}

function radioGroupColumn({ name, options, initial, onChange }) {
  const wrap = h("div", { class: "fBody" });
  const list = h("div", { class: "fOptCol" });
  options.forEach(([v, label]) => {
    const id = `${name}_${String(v).replace(/[^a-z0-9_]/gi,"_")}`;
    const inp = h("input", { type: "radio", name, id, value: v });
    if ((initial ?? "") === (v ?? "")) inp.checked = true;
    inp.addEventListener("change", () => { if (inp.checked) onChange?.(v || null); });

    const line = h("label", { class: "fOptLine", for: id }, [
      inp,
      h("span", { class: "fOptText", text: label })
    ]);

    list.appendChild(line);
  });
  wrap.appendChild(list);
  return { el: wrap, get: () => {
    const checked = list.querySelector("input[type=radio]:checked");
    return checked ? (checked.value || null) : null;
  }};
}

function multiChecklistColumn({ name, options, initialValues, onChange }) {
  const wrap = h("div", { class: "fBody" });
  const list = h("div", { class: "fOptCol" });
  const set = new Set((initialValues || []).map(String));

  function emit() {
    onChange?.(Array.from(set));
  }

  options.forEach(([v, label]) => {
    const id = `${name}_${String(v).replace(/[^a-z0-9_]/gi,"_")}`;
    const inp = h("input", { type: "checkbox", id, value: v });
    if (set.has(String(v))) inp.checked = true;

    inp.addEventListener("change", () => {
      const key = String(v);
      if (inp.checked) set.add(key);
      else set.delete(key);
      emit();
    });

    const line = h("label", { class: "fOptLine", for: id }, [
      inp,
      h("span", { class: "fOptText", text: label })
    ]);

    list.appendChild(line);
  });

  wrap.appendChild(list);
  return { el: wrap, get: () => Array.from(set), set: (vals) => {
    set.clear();
    (vals || []).forEach(x => set.add(String(x)));
    list.querySelectorAll("input[type=checkbox]").forEach(chk => chk.checked = set.has(String(chk.value)));
    emit();
  }};
}

/* =====================
   Init
   ===================== */

export function initFiltersBar({ mountId }) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const u = new URL(window.location.href);

  const p = {
    priceMin: toInt(u.searchParams.get("price_min")),
    priceMax: toInt(u.searchParams.get("price_max")),
    usefulMin: toInt(u.searchParams.get("useful_min")),
    usefulMax: toInt(u.searchParams.get("useful_max")),
    builtMin: toInt(u.searchParams.get("built_min")),
    builtMax: toInt(u.searchParams.get("built_max")),

    sinceDays: toInt(u.searchParams.get("since_days")),
    bedroomsMin: toInt(u.searchParams.get("bedrooms_min")),
    bathroomsMin: toInt(u.searchParams.get("bathrooms_min")),

    buildPeriods: fromCSV(u.searchParams.get("build_periods")),
    outdoorTypes: fromCSV(u.searchParams.get("outdoor_type")), // mantenemos el nombre por compatibilidad; ahora admite CSV
    orientations: fromCSV(u.searchParams.get("orientations")),
    accessibility: fromCSV(u.searchParams.get("accessibility")),
    parking: fromCSV(u.searchParams.get("parking")),
    storage: fromCSV(u.searchParams.get("storage")),
    energyMin: (u.searchParams.get("energy") || "").trim() || null, // se interpreta como mínimo aceptado
    availability: (u.searchParams.get("availability") || "").trim() || null
  };

  const root = h("div", { class: "filtersRoot" });
  mount.innerHTML = "";
  mount.appendChild(root);

  const blocks = [];
  const mode = getMode();

  function refreshAll() { blocks.forEach(b => b.refresh()); }

  function setCsvParam(key, arr) {
    const csv = toCSV(arr);
    setURLParam(key, csv);
  }

  /* 1. Precio mínimo / máximo (Tipo 1) */
  {
    const range = numericRangeDropdown({
      kind: "price",
      placeholderMin: "Min €",
      placeholderMax: "Max €",
      initialMin: p.priceMin,
      initialMax: p.priceMax,
      onChange: (min, max) => {
        setURLParam("price_min", min);
        setURLParam("price_max", max);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Precio mínimo / máximo",
      isActiveFn: () => (toInt(range.minInp.value) != null || toInt(range.maxInp.value) != null),
      onClear: () => {
        range.minInp.value = "";
        range.maxInp.value = "";
        setURLParam("price_min", null);
        setURLParam("price_max", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: range.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 2. Metros cuadrados útiles interiores (Tipo 1) */
  {
    const range = numericRangeDropdown({
      kind: "area",
      placeholderMin: "Mín (m²)",
      placeholderMax: "Máx (m²)",
      initialMin: p.usefulMin,
      initialMax: p.usefulMax,
      onChange: (min, max) => {
        setURLParam("useful_min", min);
        setURLParam("useful_max", max);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Metros cuadrados útiles interiores",
      isActiveFn: () => (toInt(range.minInp.value) != null || toInt(range.maxInp.value) != null),
      onClear: () => {
        range.minInp.value = "";
        range.maxInp.value = "";
        setURLParam("useful_min", null);
        setURLParam("useful_max", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: range.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 3. Periodo de construcción (Tipo 3, múltiple) */
  {
    const chk = multiChecklistColumn({
      name: "build_periods",
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
        setCsvParam("build_periods", vals);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Periodo de construcción",
      isActiveFn: () => chk.get().length > 0,
      onClear: () => {
        chk.set([]);
        setURLParam("build_periods", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: chk.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 4. Ofertado desde (fecha de publicación) (Tipo 2, única) */
  {
    const rg = radioGroupColumn({
      name: "since_days",
      options: [
        ["", "Sin preferencia"],
        ["1", "Últimas 24 horas"],
        ["5", "Últimos 5 días"],
        ["10", "Últimos 10 días"],
        ["30", "Últimos 30 días"],
        ["60", "Últimos 60 días"]
      ],
      initial: (p.sinceDays == null ? "" : String(p.sinceDays)),
      onChange: (v) => {
        setURLParam("since_days", toInt(v));
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Ofertado desde (fecha de publicación)",
      isActiveFn: () => (toInt(new URL(window.location.href).searchParams.get("since_days")) != null),
      onClear: () => {
        setURLParam("since_days", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: rg.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 5. Número mínimo de dormitorios (Tipo 2, valor mínimo) */
  {
    const sel = selectOneColumn({
      placeholder: "Sin preferencia",
      options: [["1","1+"],["2","2+"],["3","3+"],["4","4+"]],
      initial: (p.bedroomsMin == null ? "" : String(p.bedroomsMin)),
      onChange: (v) => {
        setURLParam("bedrooms_min", toInt(v));
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Número mínimo de dormitorios",
      isActiveFn: () => (toInt(new URL(window.location.href).searchParams.get("bedrooms_min")) != null),
      onClear: () => {
        sel.sel.value = "";
        setURLParam("bedrooms_min", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: sel.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 6. Número de baños (Tipo 2, valor mínimo) */
  {
    const sel = selectOneColumn({
      placeholder: "Sin preferencia",
      options: [["1","1"],["2","2"],["3","3"],["4","4"],["5","5"]],
      initial: (p.bathroomsMin == null ? "" : String(p.bathroomsMin)),
      onChange: (v) => {
        setURLParam("bathrooms_min", toInt(v));
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Número de baños",
      isActiveFn: () => (toInt(new URL(window.location.href).searchParams.get("bathrooms_min")) != null),
      onClear: () => {
        sel.sel.value = "";
        setURLParam("bathrooms_min", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: sel.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 7. Metros cuadrados construidos totales (Tipo 1) - no aparece en habitación */
  if (mode !== "room") {
    const range = numericRangeDropdown({
      kind: "area",
      placeholderMin: "Mín (m²)",
      placeholderMax: "Máx (m²)",
      initialMin: p.builtMin,
      initialMax: p.builtMax,
      onChange: (min, max) => {
        setURLParam("built_min", min);
        setURLParam("built_max", max);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Metros cuadrados construidos totales",
      isActiveFn: () => (toInt(range.minInp.value) != null || toInt(range.maxInp.value) != null),
      onClear: () => {
        range.minInp.value = "";
        range.maxInp.value = "";
        setURLParam("built_min", null);
        setURLParam("built_max", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: range.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  } else {
    // coherencia: si venimos con valores en URL, los quitamos al estar en habitación
    if (p.builtMin != null || p.builtMax != null) {
      setURLParam("built_min", null);
      setURLParam("built_max", null);
      fireFiltersChanged();
    }
  }

  /* 8. Espacio exterior (Tipo 3, múltiple) */
  {
    const chk = multiChecklistColumn({
      name: "outdoor_type",
      options: [
        ["balcon", "Balcón"],
        ["terraza", "Terraza"],
        ["jardin", "Jardín"],
        ["patio", "Patio"]
      ],
      initialValues: p.outdoorTypes,
      onChange: (vals) => {
        setCsvParam("outdoor_type", vals); // compat: mismo nombre, ahora admite CSV
        // Si se queda vacío, limpiamos orientaciones (no deberían aplicar sin exterior)
        if (!vals.length) {
          setURLParam("orientations", null);
        }
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Espacio exterior",
      isActiveFn: () => chk.get().length > 0,
      onClear: () => {
        chk.set([]);
        setURLParam("outdoor_type", null);
        setURLParam("orientations", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: chk.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 9. Orientación del balcón (Tipo 3, múltiple) - solo si hay espacio exterior seleccionado */
  {
    const chk = multiChecklistColumn({
      name: "orientations",
      options: [
        ["N", "N"],
        ["S", "S"],
        ["E", "E"],
        ["O", "O"]
      ],
      initialValues: p.orientations,
      onChange: (vals) => {
        setCsvParam("orientations", vals);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Orientación del balcón",
      isActiveFn: () => chk.get().length > 0,
      onClear: () => {
        chk.set([]);
        setURLParam("orientations", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: chk.el
    });

    // Visibilidad condicionada
    const shouldShow = () => {
      const outs = fromCSV(new URL(window.location.href).searchParams.get("outdoor_type"));
      return outs.length > 0;
    };

    const origRefresh = blk.refresh;
    blk.refresh = () => {
      origRefresh();
      blk.el.classList.toggle("bh-hidden", !shouldShow());
      if (!shouldShow() && chk.get().length) {
        chk.set([]);
        setURLParam("orientations", null);
        fireFiltersChanged();
      }
    };

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 10. Accesibilidad (Tipo 3, múltiple; lógica AND en backend) */
  {
    const chk = multiChecklistColumn({
      name: "accessibility",
      options: [
        ["ascensor", "Ascensor"],
        ["movilidad_reducida", "Adaptado a movilidad reducida"]
      ],
      initialValues: p.accessibility,
      onChange: (vals) => {
        setCsvParam("accessibility", vals);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Accesibilidad",
      isActiveFn: () => chk.get().length > 0,
      onClear: () => {
        chk.set([]);
        setURLParam("accessibility", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: chk.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 11. Parking (Tipo 3, múltiple) */
  {
    const chk = multiChecklistColumn({
      name: "parking",
      options: [
        ["incluido", "Incluido"],
        ["opcional", "Opcional"],
        ["no", "No disponible"]
      ],
      initialValues: p.parking,
      onChange: (vals) => {
        setCsvParam("parking", vals);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Parking",
      isActiveFn: () => chk.get().length > 0,
      onClear: () => {
        chk.set([]);
        setURLParam("parking", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: chk.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 12. Trastero (Tipo 3, múltiple) */
  {
    const chk = multiChecklistColumn({
      name: "storage",
      options: [
        ["si", "Incluido"],
        ["no", "No incluido"]
      ],
      initialValues: p.storage,
      onChange: (vals) => {
        setCsvParam("storage", vals);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Trastero",
      isActiveFn: () => chk.get().length > 0,
      onClear: () => {
        chk.set([]);
        setURLParam("storage", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: chk.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 13. Mínimo certificado energético (Tipo 2, única) */
  {
    const sel = selectOneColumn({
      placeholder: "Sin preferencia",
      options: [
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
        ["G", "G"],
        ["pending", "Pendiente"]
      ],
      initial: p.energyMin || "",
      onChange: (v) => {
        setURLParam("energy", v);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Mínimo certificado energético",
      isActiveFn: () => {
        const val = (new URL(window.location.href).searchParams.get("energy") || "").trim();
        return !!val;
      },
      onClear: () => {
        sel.sel.value = "";
        setURLParam("energy", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: sel.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  /* 14. Disponibilidad (Tipo 2, única) */
  {
    const sel = selectOneColumn({
      placeholder: "Sin preferencia",
      options: [
        ["available", "Disponible"],
        ["negotiation", "Ofertado / en negociación"],
        ["sold", "Alquilado / vendido"]
      ],
      initial: p.availability || "",
      onChange: (v) => {
        setURLParam("availability", v);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Disponibilidad",
      isActiveFn: () => {
        const val = (new URL(window.location.href).searchParams.get("availability") || "").trim();
        return !!val;
      },
      onClear: () => {
        sel.sel.value = "";
        setURLParam("availability", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: sel.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // Refresh inicial (incluye ocultar/mostrar del filtro 9 si procede)
  refreshAll();
}
