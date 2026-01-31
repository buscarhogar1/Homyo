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

export function initFiltersBar({ container, getInitial, onApply, onClear }) {
  const initial = getInitial ? getInitial() : {};

  // Sugerencias (ajústalas cuando tengas la definición final)
  const SUGGEST = {
    price: [300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 3500, 4000, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 750000, 1000000],
    useful: [30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 250, 300],
    year: [1950, 1960, 1970, 1980, 1990, 2000, 2005, 2010, 2015, 2020, 2022, 2023, 2024, 2025],
    beds: [0, 1, 2, 3, 4, 5, 6],
    baths: [1, 2, 3, 4]
  };

  const dlPrice = makeDatalist("dlPrice", SUGGEST.price);
  const dlUseful = makeDatalist("dlUseful", SUGGEST.useful);
  const dlYear = makeDatalist("dlYear", SUGGEST.year);
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

  const usefulMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "m² min",
    value: initial.usefulMin ?? "",
    list: "dlUseful"
  });
  const usefulMax = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "m² max",
    value: initial.usefulMax ?? "",
    list: "dlUseful"
  });

  const builtMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Año min",
    value: initial.builtMin ?? "",
    list: "dlYear"
  });
  const builtMax = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Año max",
    value: initial.builtMax ?? "",
    list: "dlYear"
  });

  const bedMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Hab. min",
    value: initial.bedroomsMin ?? "",
    list: "dlBeds"
  });

  const bathMin = el("input", {
    type: "number",
    inputmode: "numeric",
    placeholder: "Baños min",
    value: initial.bathroomsMin ?? "",
    list: "dlBaths"
  });

  const energySel = el("select");
  [
    ["", "Energía: cualquiera"],
    ["A", "A"],
    ["B", "B"],
    ["C", "C"],
    ["D", "D"],
    ["E", "E"],
    ["F", "F"],
    ["G", "G"],
    ["pending", "Pendiente"]
  ].forEach(([v, t]) => energySel.appendChild(el("option", { value: v, text: t })));
  energySel.value = initial.energyChoice || "";

  const applyBtn = el("button", { class: "fBtn fBtnPrimary", type: "button", text: "Aplicar" });
  const clearBtn = el("button", { class: "fBtn", type: "button", text: "Limpiar" });

  function read() {
    return {
      // no tocamos mode aquí: viene de la URL y map-main.js lo preserva
      city: cityInp.value.trim(),

      priceMin: intOrNull(priceMin.value),
      priceMax: intOrNull(priceMax.value),

      usefulMin: intOrNull(usefulMin.value),
      usefulMax: intOrNull(usefulMax.value),

      builtMin: intOrNull(builtMin.value),
      builtMax: intOrNull(builtMax.value),

      bedroomsMin: intOrNull(bedMin.value),
      bathroomsMin: intOrNull(bathMin.value),

      energyChoice: energySel.value || null
    };
  }

  applyBtn.addEventListener("click", async () => {
    const next = read();
    if (onApply) await onApply(next);
  });

  clearBtn.addEventListener("click", async () => {
    // No resetea city ni mode (city puede venir de URL y mode es intocable)
    priceMin.value = "";
    priceMax.value = "";
    usefulMin.value = "";
    usefulMax.value = "";
    builtMin.value = "";
    builtMax.value = "";
    bedMin.value = "";
    bathMin.value = "";
    energySel.value = "";

    if (onClear) await onClear();
  });

  container.innerHTML = "";

  // Datlists deben estar en el DOM para que funcionen
  container.appendChild(dlPrice);
  container.appendChild(dlUseful);
  container.appendChild(dlYear);
  container.appendChild(dlBeds);
  container.appendChild(dlBaths);

  container.appendChild(group("Ciudad", cityInp));
  container.appendChild(group("Precio", priceMin, priceMax));
  container.appendChild(group("Útiles", usefulMin, usefulMax));
  container.appendChild(group("Año", builtMin, builtMax));
  container.appendChild(group("Hab/Baños", bedMin, bathMin));
  container.appendChild(group("Energía", energySel));
  container.appendChild(el("div", { class: "fBtns" }, [applyBtn, clearBtn]));

  return {
    readNow: read
  };
}
