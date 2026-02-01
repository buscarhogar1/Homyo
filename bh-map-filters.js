function el(tag, attrs, children) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
  }
  (children || []).forEach((c) => {
    if (c == null) return;
    n.appendChild(c);
  });
  return n;
}

function intOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function textOrNull(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function readURL() {
  const u = new URL(window.location.href);
  const sp = u.searchParams;

  // Nota: ciudad NO se edita aquí (viene de la URL / buscador del header)
  return {
    priceMin: intOrNull(sp.get("price_min")),
    priceMax: intOrNull(sp.get("price_max")),

    listedSinceDays: intOrNull(sp.get("since_days")),
    availability: textOrNull(sp.get("availability")),

    usefulMin: intOrNull(sp.get("useful_min")),
    usefulMax: intOrNull(sp.get("useful_max")),

    builtMin: intOrNull(sp.get("built_min")),
    builtMax: intOrNull(sp.get("built_max")),

    outdoorType: textOrNull(sp.get("outdoor_type")),

    bedroomsMin: intOrNull(sp.get("bedrooms_min")),
    bathroomsMin: intOrNull(sp.get("bathrooms_min")),

    energyChoice: textOrNull(sp.get("energy")),

    orientations: (sp.get("orientations") || "").split(",").map(s => s.trim()).filter(Boolean),
    buildPeriods: (sp.get("build_periods") || "").split(",").map(s => s.trim()).filter(Boolean),
    parkingTypes: (sp.get("parking") || "").split(",").map(s => s.trim()).filter(Boolean),
    storageTypes: (sp.get("storage") || "").split(",").map(s => s.trim()).filter(Boolean),
    accessibility: (sp.get("accessibility") || "").split(",").map(s => s.trim()).filter(Boolean),
  };
}

function writeURL(next) {
  const u = new URL(window.location.href);
  const sp = u.searchParams;

  function setInt(key, val) {
    if (val == null || val === "") sp.delete(key);
    else sp.set(key, String(val));
  }

  function setText(key, val) {
    if (!val) sp.delete(key);
    else sp.set(key, String(val));
  }

  function setCSV(key, arr) {
    const a = Array.isArray(arr) ? arr.filter(Boolean) : [];
    if (!a.length) sp.delete(key);
    else sp.set(key, a.join(","));
  }

  setInt("price_min", next.priceMin);
  setInt("price_max", next.priceMax);

  setInt("since_days", next.listedSinceDays);
  setText("availability", next.availability);

  setInt("useful_min", next.usefulMin);
  setInt("useful_max", next.usefulMax);

  setInt("built_min", next.builtMin);
  setInt("built_max", next.builtMax);

  setText("outdoor_type", next.outdoorType);

  setInt("bedrooms_min", next.bedroomsMin);
  setInt("bathrooms_min", next.bathroomsMin);

  setText("energy", next.energyChoice);

  setCSV("orientations", next.orientations);
  setCSV("build_periods", next.buildPeriods);
  setCSV("parking", next.parkingTypes);
  setCSV("storage", next.storageTypes);
  setCSV("accessibility", next.accessibility);

  history.replaceState(null, "", u.toString());
}

function dispatchChanged() {
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

function isActiveValue(v) {
  if (Array.isArray(v)) return v.length > 0;
  return v != null && String(v).trim() !== "";
}

function section(title, { onClear, isActive }, bodyNodes) {
  const dot = el("span", { class: "bhFActiveDot", "aria-hidden": "true" });
  const titleEl = el("div", { class: "bhFTitle", text: title });

  const clearBtn = el("button", {
    class: "bhFClearBtn",
    type: "button",
    "aria-label": `Limpiar filtro: ${title}`,
    text: "×"
  });

  function refreshActive() {
    const active = !!isActive();
    wrap.classList.toggle("isActive", active);
    clearBtn.setAttribute("aria-disabled", active ? "false" : "true");
  }

  clearBtn.addEventListener("click", () => {
    if (clearBtn.getAttribute("aria-disabled") === "true") return;
    onClear();
    refreshActive();
    dispatchChanged();
  });

  const head = el("div", { class: "bhFTitleRow" }, [
    el("div", { class: "bhFTitleLeft" }, [dot, titleEl]),
    clearBtn
  ]);

  const wrap = el("section", { class: "bhFSection" }, [head, ...bodyNodes]);
  refreshActive();

  return { node: wrap, refreshActive };
}

/* UI helpers: radio list + checkbox list */
function radioList(options, getValue, setValue) {
  const list = el("div", { class: "bhFList" });

  function makeRow(opt) {
    const mark = el("span", { class: "bhFMark" }, [el("span", { class: "bhFMarkDot" })]);
    const label = el("div", { class: "bhFOptionLabel", text: opt.label });

    const row = el("div", { class: "bhFOption", role: "radio", tabindex: "0" }, [mark, label]);

    function sync() {
      const on = getValue() === opt.value;
      row.classList.toggle("isOn", on);
      row.setAttribute("aria-checked", on ? "true" : "false");
    }

    function choose() {
      setValue(opt.value);
      syncAll();
      dispatchChanged();
    }

    row.addEventListener("click", choose);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });

    row._sync = sync;
    return row;
  }

  const rows = options.map(makeRow);
  rows.forEach(r => list.appendChild(r));

  function syncAll() { rows.forEach(r => r._sync()); }
  syncAll();

  return { node: list, sync: syncAll };
}

function checkList(options, getArr, setArr) {
  const list = el("div", { class: "bhFList" });

  const tickSvg = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>
  `;

  function toggle(val) {
    const cur = new Set(getArr());
    if (cur.has(val)) cur.delete(val);
    else cur.add(val);
    setArr(Array.from(cur));
  }

  function makeRow(opt) {
    const box = el("span", { class: "bhFCheck", html: tickSvg });
    const label = el("div", { class: "bhFOptionLabel", text: opt.label });
    const row = el("div", { class: "bhFOption", role: "checkbox", tabindex: "0" }, [box, label]);

    function sync() {
      const on = getArr().includes(opt.value);
      row.classList.toggle("isOn", on);
      row.setAttribute("aria-checked", on ? "true" : "false");
    }

    function act() {
      toggle(opt.value);
      syncAll();
      dispatchChanged();
    }

    row.addEventListener("click", act);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        act();
      }
    });

    row._sync = sync;
    return row;
  }

  const rows = options.map(makeRow);
  rows.forEach(r => list.appendChild(r));

  function syncAll() { rows.forEach(r => r._sync()); }
  syncAll();

  return { node: list, sync: syncAll };
}

/* Export */
export function initFiltersBar({ mountId }) {
  const container = document.getElementById(mountId);
  if (!container) return;

  const mode = (new URL(window.location.href).searchParams.get("mode") || "buy").toLowerCase();
  const state = readURL();

  function commit() {
    writeURL(state);
    dispatchChanged();
    refreshAllActive();
  }

  const refreshers = [];

  function refreshAllActive() {
    refreshers.forEach(fn => fn());
  }

  // 1) Precio (tipo 1)
  const priceMinInp = el("input", { class: "bhFInput", type: "number", inputmode: "numeric", placeholder: "Min €", value: state.priceMin ?? "" });
  const priceMaxInp = el("input", { class: "bhFInput", type: "number", inputmode: "numeric", placeholder: "Max €", value: state.priceMax ?? "" });

  const priceSec = section("Precio", {
    isActive: () => isActiveValue(state.priceMin) || isActiveValue(state.priceMax),
    onClear: () => {
      state.priceMin = null; state.priceMax = null;
      priceMinInp.value = ""; priceMaxInp.value = "";
      writeURL(state);
    }
  }, [
    el("div", { class: "bhFRange" }, [priceMinInp, priceMaxInp])
  ]);
  refreshers.push(priceSec.refreshActive);

  [priceMinInp, priceMaxInp].forEach(inp => {
    inp.addEventListener("input", () => {
      state.priceMin = intOrNull(priceMinInp.value);
      state.priceMax = intOrNull(priceMaxInp.value);
      commit();
    });
  });

  // 2) Ofertado desde (tipo 2)
  const offeredOptions = [
    { label: "Sin preferencia", value: null },
    { label: "Hoy", value: 0 },
    { label: "3 días", value: 3 },
    { label: "5 días", value: 5 },
    { label: "10 días", value: 10 },
    { label: "30 días", value: 30 }
  ];

  const offered = radioList(
    offeredOptions.map(o => ({ label: o.label, value: o.value })),
    () => (state.listedSinceDays == null ? null : state.listedSinceDays),
    (v) => { state.listedSinceDays = (v == null ? null : parseInt(String(v), 10)); writeURL(state); }
  );

  const offeredSec = section("Ofertado desde", {
    isActive: () => state.listedSinceDays != null,
    onClear: () => {
      state.listedSinceDays = null;
      offered.sync();
      writeURL(state);
    }
  }, [offered.node]);
  refreshers.push(offeredSec.refreshActive);

  // 3) Disponibilidad (tipo 2)
  const availOptions = [
    { label: "Sin preferencia", value: null },
    { label: "Disponible", value: "available" },
    { label: "En negociación", value: "in_negotiation" },
    { label: "Vendido", value: "sold" }
  ];

  const availability = radioList(
    availOptions,
    () => (state.availability || null),
    (v) => { state.availability = v; writeURL(state); }
  );

  const availabilitySec = section("Disponibilidad", {
    isActive: () => !!state.availability,
    onClear: () => {
      state.availability = null;
      availability.sync();
      writeURL(state);
    }
  }, [availability.node]);
  refreshers.push(availabilitySec.refreshActive);

  // 4) Superficie útil (tipo 1)
  const usefulMinInp = el("input", { class: "bhFInput", type: "number", inputmode: "numeric", placeholder: "Desde (m²)", value: state.usefulMin ?? "" });
  const usefulMaxInp = el("input", { class: "bhFInput", type: "number", inputmode: "numeric", placeholder: "Hasta (m²)", value: state.usefulMax ?? "" });

  const usefulSec = section("Superficie útil", {
    isActive: () => isActiveValue(state.usefulMin) || isActiveValue(state.usefulMax),
    onClear: () => {
      state.usefulMin = null; state.usefulMax = null;
      usefulMinInp.value = ""; usefulMaxInp.value = "";
      writeURL(state);
    }
  }, [
    el("div", { class: "bhFRange" }, [usefulMinInp, usefulMaxInp])
  ]);
  refreshers.push(usefulSec.refreshActive);

  [usefulMinInp, usefulMaxInp].forEach(inp => {
    inp.addEventListener("input", () => {
      state.usefulMin = intOrNull(usefulMinInp.value);
      state.usefulMax = intOrNull(usefulMaxInp.value);
      commit();
    });
  });

  // 5) Superficie construida (tipo 1) — no aplica a habitaciones
  const builtMinInp = el("input", { class: "bhFInput", type: "number", inputmode: "numeric", placeholder: "Desde (m²)", value: state.builtMin ?? "" });
  const builtMaxInp = el("input", { class: "bhFInput", type: "number", inputmode: "numeric", placeholder: "Hasta (m²)", value: state.builtMax ?? "" });

  const builtSec = section("Superficie construida", {
    isActive: () => isActiveValue(state.builtMin) || isActiveValue(state.builtMax),
    onClear: () => {
      state.builtMin = null; state.builtMax = null;
      builtMinInp.value = ""; builtMaxInp.value = "";
      writeURL(state);
    }
  }, [
    el("div", { class: "bhFRange" }, [builtMinInp, builtMaxInp])
  ]);
  refreshers.push(builtSec.refreshActive);

  [builtMinInp, builtMaxInp].forEach(inp => {
    inp.addEventListener("input", () => {
      state.builtMin = intOrNull(builtMinInp.value);
      state.builtMax = intOrNull(builtMaxInp.value);
      commit();
    });
  });

  // 6) Exterior (tipo 2)
  const outdoorSel = el("select", { class: "bhFSelect" }, [
    el("option", { value: "", text: "Sin preferencia" }),
    el("option", { value: "balcony", text: "Balcón" }),
    el("option", { value: "terrace", text: "Terraza" }),
    el("option", { value: "garden", text: "Jardín" }),
    el("option", { value: "patio", text: "Patio" })
  ]);
  outdoorSel.value = state.outdoorType || "";

  const outdoorSec = section("Exterior", {
    isActive: () => !!state.outdoorType,
    onClear: () => {
      state.outdoorType = null;
      outdoorSel.value = "";
      writeURL(state);
    }
  }, [outdoorSel]);
  refreshers.push(outdoorSec.refreshActive);

  outdoorSel.addEventListener("change", () => {
    state.outdoorType = outdoorSel.value || null;
    commit();
  });

  // 7) Dormitorios (tipo 2 con opciones mixtas)
  const bedsSel = el("select", { class: "bhFSelect" }, [
    el("option", { value: "", text: "Sin preferencia" }),
    el("option", { value: "1", text: "1+" }),
    el("option", { value: "2", text: "2+" }),
    el("option", { value: "3", text: "3+" }),
    el("option", { value: "4", text: "4+" })
  ]);
  bedsSel.value = (state.bedroomsMin != null) ? String(state.bedroomsMin) : "";

  const bedsSec = section("Dormitorios", {
    isActive: () => state.bedroomsMin != null,
    onClear: () => {
      state.bedroomsMin = null;
      bedsSel.value = "";
      writeURL(state);
    }
  }, [bedsSel]);
  refreshers.push(bedsSec.refreshActive);

  bedsSel.addEventListener("change", () => {
    state.bedroomsMin = intOrNull(bedsSel.value);
    commit();
  });

  // 8) Baños (tipo 2, mínimo)
  const bathsSel = el("select", { class: "bhFSelect" }, [
    el("option", { value: "", text: "Sin preferencia" }),
    el("option", { value: "1", text: "1+" }),
    el("option", { value: "2", text: "2+" }),
    el("option", { value: "3", text: "3+" }),
    el("option", { value: "4", text: "4+" })
  ]);
  bathsSel.value = (state.bathroomsMin != null) ? String(state.bathroomsMin) : "";

  const bathsSec = section("Baños", {
    isActive: () => state.bathroomsMin != null,
    onClear: () => {
      state.bathroomsMin = null;
      bathsSel.value = "";
      writeURL(state);
    }
  }, [bathsSel]);
  refreshers.push(bathsSec.refreshActive);

  bathsSel.addEventListener("change", () => {
    state.bathroomsMin = intOrNull(bathsSel.value);
    commit();
  });

  // 9) Energía (tipo 2)
  const energySel = el("select", { class: "bhFSelect" }, [
    el("option", { value: "", text: "Sin preferencia" }),
    el("option", { value: "A+++++", text: "A+++++" }),
    el("option", { value: "A++++", text: "A++++" }),
    el("option", { value: "A+++", text: "A+++" }),
    el("option", { value: "A++", text: "A++" }),
    el("option", { value: "A+", text: "A+" }),
    el("option", { value: "A", text: "A" }),
    el("option", { value: "B", text: "B" }),
    el("option", { value: "C", text: "C" }),
    el("option", { value: "D", text: "D" }),
    el("option", { value: "E", text: "E" }),
    el("option", { value: "F", text: "F" }),
    el("option", { value: "G", text: "G" }),
    el("option", { value: "pending", text: "Pendiente" })
  ]);
  energySel.value = state.energyChoice || "";

  const energySec = section("Energía", {
    isActive: () => !!state.energyChoice,
    onClear: () => {
      state.energyChoice = null;
      energySel.value = "";
      writeURL(state);
    }
  }, [energySel]);
  refreshers.push(energySec.refreshActive);

  energySel.addEventListener("change", () => {
    state.energyChoice = energySel.value || null;
    commit();
  });

  // 10) Orientación (tipo 3, multi)
  const orient = checkList(
    [
      { label: "N", value: "N" },
      { label: "NE", value: "NE" },
      { label: "E", value: "E" },
      { label: "SE", value: "SE" },
      { label: "S", value: "S" },
      { label: "SO", value: "SO" },
      { label: "O", value: "O" },
      { label: "NO", value: "NO" }
    ],
    () => state.orientations || [],
    (arr) => { state.orientations = arr; writeURL(state); }
  );

  const orientSec = section("Orientación", {
    isActive: () => (state.orientations || []).length > 0,
    onClear: () => {
      state.orientations = [];
      orient.sync();
      writeURL(state);
    }
  }, [orient.node]);
  refreshers.push(orientSec.refreshActive);

  // 11) Periodo construcción (tipo 3, multi)
  const buildPeriods = checkList(
    [
      { label: "Antes de 1900", value: "pre_1900" },
      { label: "1900-1929", value: "1900_1929" },
      { label: "1930-1949", value: "1930_1949" },
      { label: "1950-1969", value: "1950_1969" },
      { label: "1970-1989", value: "1970_1989" },
      { label: "1990-2009", value: "1990_2009" },
      { label: "2010-2019", value: "2010_2019" },
      { label: "2020+", value: "2020_plus" }
    ],
    () => state.buildPeriods || [],
    (arr) => { state.buildPeriods = arr; writeURL(state); }
  );

  const buildPeriodsSec = section("Periodo construcción", {
    isActive: () => (state.buildPeriods || []).length > 0,
    onClear: () => {
      state.buildPeriods = [];
      buildPeriods.sync();
      writeURL(state);
    }
  }, [buildPeriods.node]);
  refreshers.push(buildPeriodsSec.refreshActive);

  // 12) Parking (tipo 3, multi)
  const parking = checkList(
    [
      { label: "Garaje", value: "garage" },
      { label: "Plaza cubierta", value: "covered_spot" },
      { label: "Plaza al aire libre", value: "outdoor_spot" }
    ],
    () => state.parkingTypes || [],
    (arr) => { state.parkingTypes = arr; writeURL(state); }
  );

  const parkingSec = section("Parking", {
    isActive: () => (state.parkingTypes || []).length > 0,
    onClear: () => {
      state.parkingTypes = [];
      parking.sync();
      writeURL(state);
    }
  }, [parking.node]);
  refreshers.push(parkingSec.refreshActive);

  // 13) Trastero (tipo 3, multi)
  const storage = checkList(
    [
      { label: "Incluido", value: "included" },
      { label: "No incluido", value: "not_included" }
    ],
    () => state.storageTypes || [],
    (arr) => { state.storageTypes = arr; writeURL(state); }
  );

  const storageSec = section("Trastero", {
    isActive: () => (state.storageTypes || []).length > 0,
    onClear: () => {
      state.storageTypes = [];
      storage.sync();
      writeURL(state);
    }
  }, [storage.node]);
  refreshers.push(storageSec.refreshActive);

  // 14) Accesibilidad (tipo 3, multi)
  const access = checkList(
    [
      { label: "Ascensor", value: "elevator" },
      { label: "Sin escaleras", value: "no_stairs" },
      { label: "Acceso PMR", value: "wheelchair" }
    ],
    () => state.accessibility || [],
    (arr) => { state.accessibility = arr; writeURL(state); }
  );

  const accessSec = section("Accesibilidad", {
    isActive: () => (state.accessibility || []).length > 0,
    onClear: () => {
      state.accessibility = [];
      access.sync();
      writeURL(state);
    }
  }, [access.node]);
  refreshers.push(accessSec.refreshActive);

  // Montaje final
  container.innerHTML = "";
  container.appendChild(priceSec.node);
  container.appendChild(offeredSec.node);
  container.appendChild(availabilitySec.node);
  container.appendChild(usefulSec.node);

  if (mode !== "room") {
    container.appendChild(builtSec.node);
  }

  container.appendChild(bedsSec.node);
  container.appendChild(bathsSec.node);
  container.appendChild(outdoorSec.node);
  container.appendChild(orientSec.node);
  container.appendChild(energySec.node);
  container.appendChild(buildPeriodsSec.node);
  container.appendChild(parkingSec.node);
  container.appendChild(storageSec.node);
  container.appendChild(accessSec.node);

  // Disparo inicial para que el mapa pinte con lo que haya en la URL
  refreshAllActive();
  dispatchChanged();
}

