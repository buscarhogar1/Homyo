function el(tag, attrs, children) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
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

function group(labelText, ...controls) {
  return el("div", { class: "fGroup" }, [
    el("div", { class: "fLabel", text: labelText }),
    ...controls
  ]);
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

function toInt(v) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function readInitialFromURL() {
  const u = new URL(window.location.href);
  return {
    city: (u.searchParams.get("city") || "").trim(),

    priceMin: toInt(u.searchParams.get("price_min")),
    priceMax: toInt(u.searchParams.get("price_max")),

    listedSinceDays: toInt(u.searchParams.get("since_days")),
    availability: (u.searchParams.get("availability") || "").trim() || null,

    usefulMin: toInt(u.searchParams.get("useful_min")),
    usefulMax: toInt(u.searchParams.get("useful_max")),

    builtMin: toInt(u.searchParams.get("built_min")),
    builtMax: toInt(u.searchParams.get("built_max")),

    bedroomsMin: toInt(u.searchParams.get("bedrooms_min")),
    bathroomsMin: toInt(u.searchParams.get("bathrooms_min")),

    outdoorType: (u.searchParams.get("outdoor_type") || "").trim() || null,
    orientations: (u.searchParams.get("orientations") || "").trim() || null,

    energyChoice: (u.searchParams.get("energy") || "").trim() || null,

    buildPeriods: (u.searchParams.get("build_periods") || "").trim() || null,
    parkingTypes: (u.searchParams.get("parking") || "").trim() || null,
    storageTypes: (u.searchParams.get("storage") || "").trim() || null,
    accessibility: (u.searchParams.get("accessibility") || "").trim() || null
  };
}

function setOrDeleteParam(u, key, val) {
  if (val == null || val === "") u.searchParams.delete(key);
  else u.searchParams.set(key, String(val));
}

function normalizeMinMax(a, b) {
  if (a == null || b == null) return { min: a, max: b };
  if (a <= b) return { min: a, max: b };
  return { min: b, max: a };
}

function emitFiltersChanged() {
  window.dispatchEvent(new Event("bh:filters-changed"));
}

export function initFiltersBar({ mountId, container, getInitial, onApply, onClear } = {}) {
  let mountEl = container;

  if (!mountEl && mountId) {
    mountEl = document.getElementById(mountId);
  }
  if (!mountEl) {
    throw new Error("initFiltersBar: falta mountId o container");
  }

  // Estado inicial: URL + callback (si existe)
  const initialFromURL = readInitialFromURL();
  const initialFromCallback = getInitial ? (getInitial() || {}) : {};
  const initial = { ...initialFromURL, ...initialFromCallback };

  // Sugerencias (MVP; luego las adaptamos por mode si quieres)
  const SUGGEST = {
    price: [300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 3500, 4000, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 750000, 1000000],
    useful: [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200],
    built: [30, 40, 50, 60, 75, 90, 100, 110, 130, 150, 200],
    beds: [1, 2, 3, 4],
    baths: [1, 2, 3, 4, 5]
  };

  const dlPrice = makeDatalist("dlPrice", SUGGEST.price);
  const dlUseful = makeDatalist("dlUseful", SUGGEST.useful);
  const dlBuilt = makeDatalist("dlBuilt", SUGGEST.built);
  const dlBeds = makeDatalist("dlBeds", SUGGEST.beds);
  const dlBaths = makeDatalist("dlBaths", SUGGEST.baths);

  // Inputs
  const cityInp = el("input", {
    type: "text",
    placeholder: "Murcia",
    value: initial.city || ""
  });

  const priceMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "€ min",
    value: initial.priceMin ?? "",
    list: "dlPrice"
  });
  const priceMax = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "€ max",
    value: initial.priceMax ?? "",
    list: "dlPrice"
  });

  const sinceSel = el("select");
  [
    ["", "Cualquiera"],
    ["1", "Últimas 24 horas"],
    ["5", "Últimos 5 días"],
    ["10", "Últimos 10 días"],
    ["30", "Últimos 30 días"],
    ["60", "Últimos 60 días"]
  ].forEach(([v, t]) => sinceSel.appendChild(el("option", { value: v, text: t })));
  sinceSel.value = (initial.listedSinceDays != null) ? String(initial.listedSinceDays) : "";

  const availSel = el("select");
  [
    ["", "Publicados (MVP)"],
    ["available", "Disponible"],
    ["negotiation", "Ofertado / en negociación"],
    ["closed", "Alquilado / vendido"]
  ].forEach(([v, t]) => availSel.appendChild(el("option", { value: v, text: t })));
  availSel.value = initial.availability || "";

  const usefulMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "m² útiles min",
    value: initial.usefulMin ?? "",
    list: "dlUseful"
  });
  const usefulMax = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "m² útiles max",
    value: initial.usefulMax ?? "",
    list: "dlUseful"
  });

  const builtMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "m² const. min",
    value: initial.builtMin ?? "",
    list: "dlBuilt"
  });
  const builtMax = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "m² const. max",
    value: initial.builtMax ?? "",
    list: "dlBuilt"
  });

  const bedSel = el("select");
  [
    ["", "Cualquiera"],
    ["1", "1"],
    ["2", "2"],
    ["3", "3"],
    ["4", "4"],
    ["1+", "1+"],
    ["2+", "2+"],
    ["3+", "3+"],
    ["4+", "4+"]
  ].forEach(([v, t]) => bedSel.appendChild(el("option", { value: v, text: t })));

  // URL actual solo guarda bedrooms_min (mínimo). Para el MVP:
  // - si elige "X" guardamos X
  // - si elige "X+" guardamos X
  // (la diferencia exacto vs mínimo la afinamos cuando lo implementes en backend)
  if (initial.bedroomsMin != null) bedSel.value = String(initial.bedroomsMin);

  const bathMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Baños min",
    value: initial.bathroomsMin ?? "",
    list: "dlBaths"
  });

  const outdoorSel = el("select");
  [
    ["", "Exterior: cualquiera"],
    ["balcony", "Balcón"],
    ["terrace", "Terraza"],
    ["garden", "Jardín"],
    ["patio", "Patio"]
  ].forEach(([v, t]) => outdoorSel.appendChild(el("option", { value: v, text: t })));
  outdoorSel.value = initial.outdoorType || "";

  const orientInp = el("input", {
    type: "text",
    placeholder: "Orientación (ej: N,SE)",
    value: initial.orientations || ""
  });

  const energySel = el("select");
  [
    ["", "Energía: cualquiera"],
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
  ].forEach(([v, t]) => energySel.appendChild(el("option", { value: v, text: t })));
  energySel.value = initial.energyChoice || "";

  const applyBtn = el("button", { class: "fBtn fBtnPrimary", type: "button", text: "Aplicar" });
  const clearBtn = el("button", { class: "fBtn", type: "button", text: "Limpiar" });

  function readNow() {
    const pMin = intOrNull(priceMin.value);
    const pMax = intOrNull(priceMax.value);
    const p = normalizeMinMax(pMin, pMax);

    const uMin = intOrNull(usefulMin.value);
    const uMax = intOrNull(usefulMax.value);
    const u = normalizeMinMax(uMin, uMax);

    const bMin = intOrNull(builtMin.value);
    const bMax = intOrNull(builtMax.value);
    const b = normalizeMinMax(bMin, bMax);

    let bedsVal = (bedSel.value || "").trim();
    let bedroomsMin = null;
    if (bedsVal) {
      bedroomsMin = parseInt(bedsVal.replace("+", ""), 10);
      if (!Number.isFinite(bedroomsMin)) bedroomsMin = null;
    }

    const bathsVal = intOrNull(bathMin.value);
    const sinceDays = intOrNull(sinceSel.value);

    // Orientaciones: normalizamos a CSV "N,NE,E..." (lo que tu core ya entiende)
    const orRaw = (orientInp.value || "").trim();
    const orCsv = orRaw
      ? orRaw
          .split(",")
          .map(s => s.trim().toUpperCase())
          .filter(Boolean)
          .join(",")
      : null;

    return {
      city: cityInp.value.trim(),

      priceMin: p.min,
      priceMax: p.max,

      listedSinceDays: sinceDays,
      availability: (availSel.value || "").trim() || null,

      usefulMin: u.min,
      usefulMax: u.max,

      builtMin: b.min,
      builtMax: b.max,

      bedroomsMin,
      bathroomsMin: bathsVal,

      outdoorType: (outdoorSel.value || "").trim() || null,
      orientations: orCsv,

      energyChoice: (energySel.value || "").trim() || null
    };
  }

  function applyToURL(next) {
    const u = new URL(window.location.href);

    // city se permite cambiar aquí (pero mode NO se toca)
    if (next.city) u.searchParams.set("city", next.city);
    else u.searchParams.delete("city");

    setOrDeleteParam(u, "price_min", next.priceMin);
    setOrDeleteParam(u, "price_max", next.priceMax);

    setOrDeleteParam(u, "since_days", next.listedSinceDays);
    setOrDeleteParam(u, "availability", next.availability);

    setOrDeleteParam(u, "useful_min", next.usefulMin);
    setOrDeleteParam(u, "useful_max", next.usefulMax);

    setOrDeleteParam(u, "built_min", next.builtMin);
    setOrDeleteParam(u, "built_max", next.builtMax);

    setOrDeleteParam(u, "bedrooms_min", next.bedroomsMin);
    setOrDeleteParam(u, "bathrooms_min", next.bathroomsMin);

    setOrDeleteParam(u, "outdoor_type", next.outdoorType);
    setOrDeleteParam(u, "orientations", next.orientations);

    setOrDeleteParam(u, "energy", next.energyChoice);

    history.replaceState(null, "", u.toString());
  }

  applyBtn.addEventListener("click", async () => {
    const next = readNow();
    applyToURL(next);

    if (onApply) await onApply(next);
    emitFiltersChanged();
  });

  clearBtn.addEventListener("click", async () => {
    priceMin.value = "";
    priceMax.value = "";
    sinceSel.value = "";
    availSel.value = "";
    usefulMin.value = "";
    usefulMax.value = "";
    builtMin.value = "";
    builtMax.value = "";
    bedSel.value = "";
    bathMin.value = "";
    outdoorSel.value = "";
    orientInp.value = "";
    energySel.value = "";

    const u = new URL(window.location.href);

    // Mantener city y mode; limpiar solo filtros
    [
      "price_min", "price_max",
      "since_days", "availability",
      "useful_min", "useful_max",
      "built_min", "built_max",
      "bedrooms_min", "bathrooms_min",
      "outdoor_type", "orientations",
      "energy",
      "build_periods", "parking", "storage", "accessibility"
    ].forEach(k => u.searchParams.delete(k));

    history.replaceState(null, "", u.toString());

    if (onClear) await onClear();
    emitFiltersChanged();
  });

  mountEl.innerHTML = "";

  // Datlists deben estar en el DOM
  mountEl.appendChild(dlPrice);
  mountEl.appendChild(dlUseful);
  mountEl.appendChild(dlBuilt);
  mountEl.appendChild(dlBeds);
  mountEl.appendChild(dlBaths);

  // Grupos en una línea (el layout lo controla el CSS de .bhFiltersBar)
  mountEl.appendChild(group("Ciudad", cityInp));
  mountEl.appendChild(group("Precio", priceMin, priceMax));
  mountEl.appendChild(group("Ofertado desde", sinceSel));
  mountEl.appendChild(group("Disponibilidad", availSel));
  mountEl.appendChild(group("Útiles", usefulMin, usefulMax));
  mountEl.appendChild(group("Construidos", builtMin, builtMax));
  mountEl.appendChild(group("Dormitorios", bedSel));
  mountEl.appendChild(group("Baños", bathMin));
  mountEl.appendChild(group("Exterior", outdoorSel));
  mountEl.appendChild(group("Orientación", orientInp));
  mountEl.appendChild(group("Energía", energySel));
  mountEl.appendChild(el("div", { class: "fBtns" }, [applyBtn, clearBtn]));

  return { readNow };
}
