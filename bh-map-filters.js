/*
  bh-map-filters.js

  Objetivos implementados aquí:
  - No hay filtro “Ciudad” (pedido).
  - No hay botones “Aplicar” ni “Limpiar”: el mapa se actualiza al cambiar cualquier filtro.
  - Cada filtro tiene una “X” para vaciarlo; si el filtro está activo, la X se pone roja.
  - Inputs numéricos:
    - sin flechas (usamos type="text" + inputmode="numeric")
    - mientras escribes mostramos una sugerencia (en base a una lista de valores típicos)
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

    listedSinceDays: intOrNull(u.searchParams.get("since_days")),
    availability: (u.searchParams.get("availability") || "").trim() || null,

    usefulMin: intOrNull(u.searchParams.get("useful_min")),
    usefulMax: intOrNull(u.searchParams.get("useful_max")),

    builtMin: intOrNull(u.searchParams.get("built_min")),
    builtMax: intOrNull(u.searchParams.get("built_max")),

    bedroomsMin: intOrNull(u.searchParams.get("bedrooms_min")),
    bathroomsMin: intOrNull(u.searchParams.get("bathrooms_min")),

    outdoorType: (u.searchParams.get("outdoor_type") || "").trim() || null,
    orientations: fromCSV(u.searchParams.get("orientations")),

    energyChoice: (u.searchParams.get("energy") || "").trim() || null,

    buildPeriods: fromCSV(u.searchParams.get("build_periods")),
    parkingTypes: fromCSV(u.searchParams.get("parking")),
    storageTypes: fromCSV(u.searchParams.get("storage")),
    accessibility: fromCSV(u.searchParams.get("accessibility"))
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

/* Sugerencias para inputs numéricos */
const SUGGEST = {
  price: [50000, 80000, 100000, 120000, 150000, 180000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 750000, 1000000],
  area: [30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 250, 300],
  year: [1950, 1960, 1970, 1980, 1990, 2000, 2005, 2010, 2015, 2020, 2022, 2023, 2024, 2025],
  beds: [0, 1, 2, 3, 4, 5, 6],
  baths: [1, 2, 3, 4]
};

/* Encuentra una sugerencia simple: el siguiente valor típico >= lo escrito */
function pickSuggestion(list, typedInt) {
  if (!Number.isFinite(typedInt)) return null;
  const sorted = (list || []).slice().sort((a,b)=>a-b);
  for (const v of sorted) if (v >= typedInt) return v;
  return null;
}

/* Crea un “bloque de filtro” con:
   - título
   - punto indicador (activo/inactivo)
   - botón X a la derecha del título
   - contenido (inputs)
*/
function filterBlock({ title, isActiveFn, onClear, contentEl }) {
  const dot = el("div", { class: "fDot" });
  const titleEl = el("div", { class: "fTitleText", text: title });

  const clearBtn = el("button", { class: "fClearBtn", type: "button", text: "×", "aria-label": "Quitar filtro" });

  clearBtn.addEventListener("click", () => {
    if (onClear) onClear();
  });

  const head = el("div", { class: "fHead" }, [
    el("div", { class: "fTitle" }, [dot, titleEl]),
    clearBtn
  ]);

  const wrap = el("div", { class: "fBlock" }, [
    head,
    contentEl
  ]);

  function refresh() {
    const active = !!(isActiveFn && isActiveFn());
    wrap.classList.toggle("active", active);
    // X roja si está activo (pedido)
    clearBtn.classList.toggle("active", active);
  }

  return { el: wrap, refresh };
}

/* Input numérico “sin flechas” + sugerencia mientras escribes */
function numericRange({ placeholderA, placeholderB, initialA, initialB, suggestList, onChange }) {
  const a = el("input", {
    class: "fInp",
    type: "text",
    inputmode: "numeric",
    placeholder: placeholderA,
    value: (initialA ?? "")
  });

  const b = el("input", {
    class: "fInp",
    type: "text",
    inputmode: "numeric",
    placeholder: placeholderB,
    value: (initialB ?? "")
  });

  const hint = el("div", { class: "fSuggest", text: "" });

  function updateSuggest() {
    const av = intOrNull(a.value);
    const bv = intOrNull(b.value);
    let msg = "";

    if (a === document.activeElement && av != null) {
      const s = pickSuggestion(suggestList, av);
      if (s != null && s !== av) msg = `Sugerencia: ${s}`;
    }
    if (b === document.activeElement && bv != null) {
      const s = pickSuggestion(suggestList, bv);
      if (s != null && s !== bv) msg = `Sugerencia: ${s}`;
    }

    hint.textContent = msg;
  }

  function emit() {
    if (onChange) onChange(intOrNull(a.value), intOrNull(b.value));
    updateSuggest();
  }

  a.addEventListener("input", emit);
  b.addEventListener("input", emit);
  a.addEventListener("focus", updateSuggest);
  b.addEventListener("focus", updateSuggest);
  a.addEventListener("blur", () => (hint.textContent = ""));
  b.addEventListener("blur", () => (hint.textContent = ""));

  const row = el("div", { class: "fRow2" }, [a, b]);
  const wrap = el("div", { class: "fBody" }, [row, hint]);

  return { el: wrap, a, b, hint };
}

function radioGroup({ name, options, initial, onChange }) {
  const wrap = el("div", { class: "fBody" });
  options.forEach(({ value, label }) => {
    const id = `${name}_${value || "any"}`;
    const inp = el("input", { type: "radio", name, id, value: value ?? "" });
    if ((initial ?? "") === (value ?? "")) inp.checked = true;

    inp.addEventListener("change", () => {
      if (!inp.checked) return;
      if (onChange) onChange(value ?? null);
    });

    const lab = el("label", { class: "fRadio", for: id }, [
      inp,
      el("span", { class: "fRadioLabel", text: label })
    ]);

    wrap.appendChild(lab);
  });
  return wrap;
}

function selectOne({ options, initial, onChange }) {
  const sel = el("select", { class: "fSel" });
  options.forEach(([v, t]) => sel.appendChild(el("option", { value: v, text: t })));
  sel.value = initial ?? "";
  sel.addEventListener("change", () => {
    const v = sel.value || "";
    if (onChange) onChange(v ? v : null);
  });
  return sel;
}

export function initFiltersBar({ mountId }) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const p = getParamsFromURL();

  // Contenedor con padding, para recuperar el estilo “mejor” (tarjetas separadas)
  const root = el("div", { class: "filtersRoot" });

  const blocks = [];

  // PRECIO (min/max)
  {
    const range = numericRange({
      placeholderA: "Min €",
      placeholderB: "Max €",
      initialA: p.priceMin,
      initialB: p.priceMax,
      suggestList: SUGGEST.price,
      onChange: (min, max) => {
        setURLParam("price_min", min);
        setURLParam("price_max", max);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Precio",
      isActiveFn: () => (intOrNull(range.a.value) != null || intOrNull(range.b.value) != null),
      onClear: () => {
        range.a.value = "";
        range.b.value = "";
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

  // OFERTADO DESDE (radio)
  {
    const opts = [
      { value: null, label: "Sin preferencia" },
      { value: 0, label: "Hoy" },
      { value: 3, label: "3 días" },
      { value: 5, label: "5 días" },
      { value: 10, label: "10 días" },
      { value: 30, label: "30 días" }
    ];

    const grp = radioGroup({
      name: "since_days",
      options: opts.map(o => ({ value: (o.value == null ? "" : String(o.value)), label: o.label })),
      initial: (p.listedSinceDays == null ? "" : String(p.listedSinceDays)),
      onChange: (v) => {
        const n = intOrNull(v);
        setURLParam("since_days", n);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Ofertado desde",
      isActiveFn: () => (getParamsFromURL().listedSinceDays != null),
      onClear: () => {
        setURLParam("since_days", null);
        // Marcar “Sin preferencia”
        grp.querySelectorAll('input[type="radio"]').forEach(r => {
          if (r.value === "") r.checked = true;
        });
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: grp
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // DISPONIBILIDAD (select)
  {
    const sel = selectOne({
      options: [
        ["", "Sin preferencia"],
        ["available", "Disponible"],
        ["negotiation", "En negociación"],
        ["sold", "Vendido"]
      ],
      initial: p.availability || "",
      onChange: (v) => {
        setURLParam("availability", v);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [sel]);

    const blk = filterBlock({
      title: "Disponibilidad",
      isActiveFn: () => !!getParamsFromURL().availability,
      onClear: () => {
        sel.value = "";
        setURLParam("availability", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // SUPERFICIE ÚTIL
  {
    const range = numericRange({
      placeholderA: "Desde (m²)",
      placeholderB: "Hasta (m²)",
      initialA: p.usefulMin,
      initialB: p.usefulMax,
      suggestList: SUGGEST.area,
      onChange: (min, max) => {
        setURLParam("useful_min", min);
        setURLParam("useful_max", max);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Superficie útil",
      isActiveFn: () => (intOrNull(range.a.value) != null || intOrNull(range.b.value) != null),
      onClear: () => {
        range.a.value = "";
        range.b.value = "";
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

  // SUPERFICIE CONSTRUIDA (si tu backend no filtra por esto, aquí solo refleja el UI)
  {
    const range = numericRange({
      placeholderA: "Desde (m²)",
      placeholderB: "Hasta (m²)",
      initialA: null,
      initialB: null,
      suggestList: SUGGEST.area,
      onChange: (min, max) => {
        // si más adelante lo conectas al backend: constru_min / constru_max, etc.
        setURLParam("built_area_min", min);
        setURLParam("built_area_max", max);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Superficie construida",
      isActiveFn: () => (getParamsFromURL().builtAreaMin != null || getParamsFromURL().builtAreaMax != null),
      onClear: () => {
        range.a.value = "";
        range.b.value = "";
        setURLParam("built_area_min", null);
        setURLParam("built_area_max", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: range.el
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // DORMITORIOS (mínimo)
  {
    const sel = selectOne({
      options: [
        ["", "Sin preferencia"],
        ["0", "0+"],
        ["1", "1+"],
        ["2", "2+"],
        ["3", "3+"],
        ["4", "4+"],
        ["5", "5+"],
        ["6", "6+"]
      ],
      initial: (p.bedroomsMin == null ? "" : String(p.bedroomsMin)),
      onChange: (v) => {
        setURLParam("bedrooms_min", intOrNull(v));
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [sel]);

    const blk = filterBlock({
      title: "Dormitorios",
      isActiveFn: () => (getParamsFromURL().bedroomsMin != null),
      onClear: () => {
        sel.value = "";
        setURLParam("bedrooms_min", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // BAÑOS (mínimo)
  {
    const sel = selectOne({
      options: [
        ["", "Sin preferencia"],
        ["1", "1+"],
        ["2", "2+"],
        ["3", "3+"],
        ["4", "4+"]
      ],
      initial: (p.bathroomsMin == null ? "" : String(p.bathroomsMin)),
      onChange: (v) => {
        setURLParam("bathrooms_min", intOrNull(v));
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [sel]);

    const blk = filterBlock({
      title: "Baños",
      isActiveFn: () => (getParamsFromURL().bathroomsMin != null),
      onClear: () => {
        sel.value = "";
        setURLParam("bathrooms_min", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  mount.innerHTML = "";
  mount.appendChild(root);

  function refreshAll() {
    blocks.forEach(b => b.refresh());
  }

  refreshAll();
}
