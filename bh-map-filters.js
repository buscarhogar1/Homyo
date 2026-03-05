/*
  bh-map-filters.js

  Reglas:
  - No hay filtro “Ciudad”.
  - No hay botones “Aplicar” ni “Limpiar”: el mapa se actualiza al cambiar cualquier filtro.
  - Cada filtro tiene una “X” para vaciarlo; si el filtro está activo, la X se pone roja.
  - Inputs numéricos:
    - sin flechas (type="text" + inputmode="numeric")
    - sugerencias mientras escribes (lista de valores típicos)
*/

function el(tag, attrs, children) {
  const n = document.createElement("div");
  const real = document.createElement(tag);
  // trick: keep previous behavior of attribute setting
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (k === "class") real.className = v;
    else if (k === "text") real.textContent = v;
    else if (k === "html") real.innerHTML = v;
    else real.setAttribute(k, v);
  }
  if (children) {
    for (const c of children) {
      if (c == null) continue;
      real.appendChild(c);
    }
  }
  return real;
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

    usefulMin: intOrNull(u.searchParams.get("useful_min")),
    usefulMax: intOrNull(u.searchParams.get("useful_max")),

    builtMin: intOrNull(u.searchParams.get("built_min")),
    builtMax: intOrNull(u.searchParams.get("built_max")),

    bedroomsMin: intOrNull(u.searchParams.get("bedrooms_min")),
    bedroomsEq: intOrNull(u.searchParams.get("bedrooms_eq")), // (opcional, futuro)
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
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) u.searchParams.delete(key);
  else u.searchParams.set(key, String(value));
  history.replaceState(null, "", u.toString());
}

function fireFiltersChanged() {
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

/* Sugerencias para inputs numéricos */
const SUGGEST = {
  price: [50000, 80000, 100000, 120000, 150000, 180000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 750000, 1000000],
  area: [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200],
  beds: [1, 2, 3, 4, 5, 6],
  baths: [1, 2, 3, 4, 5]
};

function pickSuggestion(list, typedInt) {
  if (!Number.isFinite(typedInt)) return null;
  const sorted = (list || []).slice().sort((a,b)=>a-b);
  for (const v of sorted) if (v >= typedInt) return v;
  return null;
}

/* Bloque de filtro “tarjeta” */
function filterBlock({ title, isActiveFn, onClear, contentEl }) {
  const dot = el("div", { class: "fDot" });
  const titleEl = el("div", { class: "fTitleText", text: title });

  const clearBtn = el("button", { class: "fClearBtn", type: "button", "aria-label": "Limpiar", text: "×" });
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClear?.();
  });

  const head = el("div", { class: "fHead" }, [
    el("div", { class: "fTitle" }, [dot, titleEl]),
    clearBtn
  ]);

  const blk = el("div", { class: "fBlock" }, [
    head,
    contentEl
  ]);

  function refresh() {
    const active = !!isActiveFn?.();
    blk.classList.toggle("active", active);
    clearBtn.classList.toggle("active", active);
  }

  return { el: blk, refresh };
}

/* ======= UI helpers ======= */

function numericRange({ placeholderA, placeholderB, initialA, initialB, suggestList, onChange }) {
  const a = el("input", { class: "fInp", type: "text", inputmode: "numeric", placeholder: placeholderA, value: initialA == null ? "" : String(initialA) });
  const b = el("input", { class: "fInp", type: "text", inputmode: "numeric", placeholder: placeholderB, value: initialB == null ? "" : String(initialB) });

  const sugA = el("div", { class: "fSuggest" });
  const sugB = el("div", { class: "fSuggest" });

  function sanitize(inp){
    const v = inp.value.replace(/[^0-9]/g, "");
    if (v !== inp.value) inp.value = v;
  }

  function updateSuggest(inp, sug){
    const n = intOrNull(inp.value);
    const pick = pickSuggestion(suggestList, n);
    if (pick == null || (n != null && pick === n)) {
      sug.textContent = "";
      sug.style.display = "none";
      return;
    }
    sug.textContent = String(pick);
    sug.style.display = "block";
  }

  function emit(){
    const min = intOrNull(a.value);
    const max = intOrNull(b.value);
    onChange?.(min, max);
  }

  [a,b].forEach((inp, idx) => {
    const sug = idx===0 ? sugA : sugB;
    inp.addEventListener("input", () => {
      sanitize(inp);
      updateSuggest(inp, sug);
      emit();
    });
    inp.addEventListener("focus", () => updateSuggest(inp, sug));
    inp.addEventListener("blur", () => { sug.textContent=""; sug.style.display="none"; });
  });

  const row = el("div", { class: "fRow2" }, [
    el("div", { class: "fInpWrap" }, [a, sugA]),
    el("div", { class: "fInpWrap" }, [b, sugB])
  ]);

  const body = el("div", { class: "fBody" }, [row]);

  // inicial
  updateSuggest(a, sugA);
  updateSuggest(b, sugB);

  return { el: body, a, b };
}

function selectOne({ options, initial, onChange, placeholder }) {
  const sel = el("select", { class: "fSel" });
  const firstText = placeholder ?? "Sin preferencia";
  sel.appendChild(el("option", { value: "", text: firstText }));
  for (const [v, t] of options) sel.appendChild(el("option", { value: v, text: t }));
  sel.value = initial ?? "";
  sel.addEventListener("change", () => onChange?.(sel.value));
  return sel;
}

function radioGroup({ name, options, initial, onChange }) {
  const wrap = el("div", { class: "fRadioList" });
  options.forEach(([v, label]) => {
    const id = `${name}_${v || "none"}`;
    const inp = el("input", { type: "radio", name, id, value: v });
    if ((initial ?? "") === (v ?? "")) inp.checked = true;
    inp.addEventListener("change", () => {
      if (inp.checked) onChange?.(v);
    });

    const line = el("label", { class: "fRadioLine", for: id }, [
      inp,
      el("span", { class: "fRadioText", text: label })
    ]);

    wrap.appendChild(line);
  });
  return wrap;
}

function multiChecklist({ name, options, initialValues, onChange }) {
  const set = new Set((initialValues || []).map(String));
  const wrap = el("div", { class: "fCheckList" });

  function emit() {
    onChange?.(Array.from(set));
  }

  options.forEach(([v, label]) => {
    const id = `${name}_${v}`;
    const inp = el("input", { type: "checkbox", id, value: v });
    if (set.has(String(v))) inp.checked = true;

    inp.addEventListener("change", () => {
      const key = String(v);
      if (inp.checked) set.add(key);
      else set.delete(key);
      emit();
    });

    const line = el("label", { class: "fCheckLine", for: id }, [
      inp,
      el("span", { class: "fCheckText", text: label })
    ]);

    wrap.appendChild(line);
  });

  return { el: wrap, get: () => Array.from(set), set: (vals) => {
    set.clear();
    (vals || []).forEach(x => set.add(String(x)));
    // re-sync DOM
    wrap.querySelectorAll("input[type=checkbox]").forEach(chk => {
      chk.checked = set.has(String(chk.value));
    });
  }};
}

/* ======= Init ======= */

export function initFiltersBar({ mountId }) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const p = getParamsFromURL();

  const root = el("div", { class: "filtersRoot" });
  mount.innerHTML = "";
  mount.appendChild(root);

  const blocks = [];

  function refreshAll() {
    blocks.forEach(b => b.refresh());
  }

  // 1) Tipo de oferta
  {
    const sel = selectOne({
      placeholder: "Selecciona",
      options: [
        ["buy", "Comprar"],
        ["rent", "Alquilar"],
        ["room", "Habitación"],
        ["new_build", "Obra nueva"],
        ["all", "Todas"]
      ],
      initial: p.mode,
      onChange: (v) => {
        setURLParam("mode", v || "buy");
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [sel]);

    const blk = filterBlock({
      title: "Tipo de oferta",
      isActiveFn: () => true,
      onClear: () => { /* no-op */ },
      contentEl: body
    });

    // El tipo de oferta no se “limpia” (siempre hay uno)
    blk.el.querySelector(".fClearBtn")?.setAttribute("disabled","true");
    blk.el.querySelector(".fClearBtn")?.classList.remove("active");

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 2) Precio mínimo / máximo
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
      isActiveFn: () => (intOrNull(range.el.querySelectorAll("input")[0].value) != null || intOrNull(range.el.querySelectorAll("input")[1].value) != null),
      onClear: () => {
        const ins = range.el.querySelectorAll("input");
        ins[0].value = "";
        ins[1].value = "";
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

  // 3) Metros cuadrados útiles
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
      isActiveFn: () => (intOrNull(range.el.querySelectorAll("input")[0].value) != null || intOrNull(range.el.querySelectorAll("input")[1].value) != null),
      onClear: () => {
        const ins = range.el.querySelectorAll("input");
        ins[0].value = "";
        ins[1].value = "";
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

  // 4) Metros cuadrados construidos (no aparece en habitaciones)
  if (p.mode !== "room") {
    const range = numericRange({
      placeholderA: "Desde (m²)",
      placeholderB: "Hasta (m²)",
      initialA: p.builtMin,
      initialB: p.builtMax,
      suggestList: SUGGEST.area,
      onChange: (min, max) => {
        setURLParam("built_min", min);
        setURLParam("built_max", max);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const blk = filterBlock({
      title: "Superficie construida",
      isActiveFn: () => (intOrNull(range.el.querySelectorAll("input")[0].value) != null || intOrNull(range.el.querySelectorAll("input")[1].value) != null),
      onClear: () => {
        const ins = range.el.querySelectorAll("input");
        ins[0].value = "";
        ins[1].value = "";
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
    // si venimos con built_min/built_max en URL y estamos en room, los limpiamos para coherencia
    if (getParamsFromURL().builtMin != null || getParamsFromURL().builtMax != null) {
      setURLParam("built_min", null);
      setURLParam("built_max", null);
      fireFiltersChanged();
    }
  }

  // 5) Número de dormitorios
  {
    // UI: 1,2,3,4 y 1+,2+,3+,4+.
    // Hoy, el backend usa bedrooms_min. Guardamos también bedrooms_eq (futuro), sin romper nada.
    const sel = selectOne({
      placeholder: "Sin preferencia",
      options: [
        ["1", "1"],
        ["2", "2"],
        ["3", "3"],
        ["4", "4"],
        ["1+", "1+"],
        ["2+", "2+"],
        ["3+", "3+"],
        ["4+", "4+"]
      ],
      initial: (p.bedroomsEq != null ? String(p.bedroomsEq) : (p.bedroomsMin != null ? String(p.bedroomsMin) + "+" : "")),
      onChange: (v) => {
        if (!v) {
          setURLParam("bedrooms_min", null);
          setURLParam("bedrooms_eq", null);
        } else if (v.endsWith("+")) {
          setURLParam("bedrooms_min", intOrNull(v));
          setURLParam("bedrooms_eq", null);
        } else {
          const eq = intOrNull(v);
          setURLParam("bedrooms_eq", eq);
          setURLParam("bedrooms_min", eq); // fallback razonable mientras el backend no soporte eq
        }
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [sel]);

    const blk = filterBlock({
      title: "Dormitorios",
      isActiveFn: () => {
        const pp = getParamsFromURL();
        return pp.bedroomsMin != null || pp.bedroomsEq != null;
      },
      onClear: () => {
        sel.value = "";
        setURLParam("bedrooms_min", null);
        setURLParam("bedrooms_eq", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 6) Número de baños (mínimo)
  {
    const sel = selectOne({
      placeholder: "Sin preferencia",
      options: [["1","1"],["2","2"],["3","3"],["4","4"],["5","5"]],
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

  // 7) Espacio exterior (selección única)
  {
    const sel = selectOne({
      placeholder: "Selecciona",
      options: [
        ["balcon", "Balcón"],
        ["terraza", "Terraza"],
        ["jardin", "Jardín"],
        ["patio", "Patio"]
      ],
      initial: p.outdoorType ?? "",
      onChange: (v) => {
        setURLParam("outdoor_type", v || null);
        // si se quita, también quitamos orientaciones
        if (!v) setURLParam("orientations", null);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [sel]);

    const blk = filterBlock({
      title: "Espacio exterior",
      isActiveFn: () => (getParamsFromURL().outdoorType != null),
      onClear: () => {
        sel.value = "";
        setURLParam("outdoor_type", null);
        setURLParam("orientations", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 8) Orientación del espacio exterior (multi, solo si hay espacio exterior)
  {
    const pp = getParamsFromURL();
    if (pp.outdoorType != null) {
      const chk = multiChecklist({
        name: "orient",
        options: [["N","N"],["NE","NE"],["E","E"],["SE","SE"],["S","S"],["SW","SW"],["W","W"],["NW","NW"]],
        initialValues: pp.orientations,
        onChange: (vals) => {
          setURLParam("orientations", toCSV(vals));
          fireFiltersChanged();
          refreshAll();
        }
      });

      const body = el("div", { class: "fBody" }, [chk.el]);

      const blk = filterBlock({
        title: "Orientación del espacio exterior",
        isActiveFn: () => (getParamsFromURL().orientations.length > 0),
        onClear: () => {
          chk.set([]);
          setURLParam("orientations", null);
          fireFiltersChanged();
          refreshAll();
        },
        contentEl: body
      });

      blocks.push(blk);
      root.appendChild(blk.el);
    } else {
      // coherencia: si no hay outdoor_type, no mantenemos orientaciones en URL
      if ((pp.orientations || []).length) setURLParam("orientations", null);
    }
  }

  // 9) Periodo de construcción (multi)
  {
    const chk = multiChecklist({
      name: "buildp",
      options: [
        ["pre_1950", "Antes de 1950"],
        ["1950_1960", "1950–1960"],
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
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [chk.el]);

    const blk = filterBlock({
      title: "Periodo de construcción",
      isActiveFn: () => (getParamsFromURL().buildPeriods.length > 0),
      onClear: () => {
        chk.set([]);
        setURLParam("build_periods", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 10) Accesibilidad (multi, AND)
  {
    const chk = multiChecklist({
      name: "acc",
      options: [
        ["ascensor", "Ascensor"],
        ["movilidad_reducida", "Adaptado a movilidad reducida"]
      ],
      initialValues: p.accessibility,
      onChange: (vals) => {
        setURLParam("accessibility", toCSV(vals));
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [chk.el]);

    const blk = filterBlock({
      title: "Accesibilidad",
      isActiveFn: () => (getParamsFromURL().accessibility.length > 0),
      onClear: () => {
        chk.set([]);
        setURLParam("accessibility", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 11) Parking (multi)
  {
    const chk = multiChecklist({
      name: "park",
      options: [
        ["incluido", "Incluido"],
        ["opcional", "Opcional"],
        ["no_disponible", "No disponible"]
      ],
      initialValues: p.parkingTypes,
      onChange: (vals) => {
        setURLParam("parking", toCSV(vals));
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [chk.el]);

    const blk = filterBlock({
      title: "Parking",
      isActiveFn: () => (getParamsFromURL().parkingTypes.length > 0),
      onClear: () => {
        chk.set([]);
        setURLParam("parking", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 12) Trastero (multi)
  {
    const chk = multiChecklist({
      name: "stor",
      options: [
        ["incluido", "Incluido"],
        ["no_incluido", "No incluido"]
      ],
      initialValues: p.storageTypes,
      onChange: (vals) => {
        setURLParam("storage", toCSV(vals));
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [chk.el]);

    const blk = filterBlock({
      title: "Trastero",
      isActiveFn: () => (getParamsFromURL().storageTypes.length > 0),
      onClear: () => {
        chk.set([]);
        setURLParam("storage", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 13) Certificado energético (opción única)
  {
    const sel = selectOne({
      placeholder: "Sin preferencia",
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
      initial: p.energyChoice ?? "",
      onChange: (v) => {
        setURLParam("energy", v || null);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [sel]);

    const blk = filterBlock({
      title: "Certificado energético",
      isActiveFn: () => (getParamsFromURL().energyChoice != null),
      onClear: () => {
        sel.value = "";
        setURLParam("energy", null);
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 14) Ofertado desde (fecha publicación)
  {
    const rg = radioGroup({
      name: "since_days",
      options: [
        ["", "Sin preferencia"],
        ["1", "24 h"],
        ["5", "5 días"],
        ["10", "10 días"],
        ["30", "30 días"]
      ],
      initial: (p.listedSinceDays == null ? "" : String(p.listedSinceDays)),
      onChange: (v) => {
        setURLParam("since_days", intOrNull(v));
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [rg]);

    const blk = filterBlock({
      title: "Ofertado desde",
      isActiveFn: () => (getParamsFromURL().listedSinceDays != null),
      onClear: () => {
        setURLParam("since_days", null);
        // re-check "Sin preferencia"
        body.querySelectorAll("input[type=radio]").forEach(r => {
          r.checked = (r.value === "");
        });
        fireFiltersChanged();
        refreshAll();
      },
      contentEl: body
    });

    blocks.push(blk);
    root.appendChild(blk.el);
  }

  // 15) Disponibilidad
  {
    const sel = selectOne({
      placeholder: "Sin preferencia",
      options: [
        ["available", "Disponible"],
        ["reserved", "Reservado"],
        ["rented", "Alquilado"],
        ["sold", "Vendido"]
      ],
      initial: p.availability ?? "",
      onChange: (v) => {
        setURLParam("availability", v || null);
        fireFiltersChanged();
        refreshAll();
      }
    });

    const body = el("div", { class: "fBody" }, [sel]);

    const blk = filterBlock({
      title: "Disponibilidad",
      isActiveFn: () => (getParamsFromURL().availability != null),
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

  refreshAll();
}
