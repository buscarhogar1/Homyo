// bh-map-filters.js
// Sidebar derecha, estilo lista. Cada sección tiene:
// - indicador activo (punto)
// - X para resetear solo esa sección
// - auto-apply: escribe en URL y dispara bh:filters-changed

function el(tag, attrs, children) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, String(v));
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

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function toIntOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function setFromCsv(csv) {
  const s = String(csv ?? "").trim();
  if (!s) return new Set();
  return new Set(s.split(",").map(x => x.trim()).filter(Boolean));
}

function csvFromSet(set) {
  const arr = Array.from(set || []).filter(Boolean);
  return arr.length ? arr.join(",") : "";
}

function fireChanged() {
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

function writeParams(patch) {
  const u = new URL(window.location.href);
  const keep = new Set(["city", "mode"]);

  function setParam(key, val) {
    if (keep.has(key)) return;
    if (val == null || val === "") u.searchParams.delete(key);
    else u.searchParams.set(key, String(val));
  }

  for (const [k, v] of Object.entries(patch || {})) setParam(k, v);

  history.replaceState(null, "", u.toString());
}

function readInitial() {
  const u = new URL(window.location.href);
  return {
    sinceDays: toIntOrNull(u.searchParams.get("since_days")),
    availabilitySet: setFromCsv(u.searchParams.get("availability")), // multi
    usefulMin: toIntOrNull(u.searchParams.get("useful_min")),
    usefulMax: toIntOrNull(u.searchParams.get("useful_max"))
  };
}

function makeBlock(titleText) {
  const block = el("section", { class: "bhFilterBlock" });

  const xBtn = el("button", { class: "bhFilterX", type: "button", text: "×" });
  const head = el("div", { class: "bhFilterHead" });
  const dot = el("div", { class: "bhFilterDot", "aria-hidden": "true" });
  const title = el("h3", { class: "bhFilterTitle", text: titleText });

  head.appendChild(dot);
  head.appendChild(title);

  const body = el("div", { class: "bhFilterBody" });

  block.appendChild(xBtn);
  block.appendChild(head);
  block.appendChild(body);

  function setActive(isActive) {
    block.classList.toggle("isActive", !!isActive);
  }

  return { block, body, xBtn, setActive };
}

function makeRadio(name, value, checked) {
  const i = el("input", { type: "radio", name, value });
  if (checked) i.checked = true;
  return i;
}

function makeCheckbox(value, checked) {
  const i = el("input", { type: "checkbox", value });
  if (checked) i.checked = true;
  return i;
}

function makeOptRow(inputEl, labelText) {
  const txt = el("div", { class: "bhOptText", text: labelText });
  const row = el("label", { class: "bhOpt" }, [inputEl, txt]);
  return row;
}

export function initFiltersBar({ mountId = "filtersBarMount" } = {}) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const initial = readInitial();

  const panel = el("div", { class: "bhFiltersPanel" });

  // Auto apply (debounced)
  const applyNow = () => {
    // sinceDays
    const chosenSince = panel.querySelector('input[name="since_days"]:checked');
    const sinceVal = chosenSince ? chosenSince.value : "";
    const sinceDays = sinceVal ? parseInt(sinceVal, 10) : null;

    // availability multi
    const availChecks = panel.querySelectorAll('input[data-k="availability"]:checked');
    const availSet = new Set(Array.from(availChecks).map(i => i.value));

    // living area
    const usefulMin = toIntOrNull(panel.querySelector('input[data-k="useful_min"]')?.value);
    const usefulMax = toIntOrNull(panel.querySelector('input[data-k="useful_max"]')?.value);

    // swaps
    let uMin = usefulMin, uMax = usefulMax;
    if (uMin != null && uMax != null && uMin > uMax) {
      const t = uMin; uMin = uMax; uMax = t;
    }

    // escribir URL
    writeParams({
      since_days: sinceDays ?? "",
      availability: csvFromSet(availSet),
      useful_min: uMin ?? "",
      useful_max: uMax ?? ""
    });

    // activar marcadores
    blocks.offered.setActive(sinceDays != null);
    blocks.availability.setActive(availSet.size > 0);
    blocks.living.setActive((uMin != null) || (uMax != null));

    fireChanged();
  };

  const queueApply = debounce(applyNow, 150);

  const blocks = {
    offered: makeBlock("Offered since"),
    availability: makeBlock("Availability"),
    living: makeBlock("Living area")
  };

  // Offered since (radio)
  {
    const name = "since_days";
    const opts = [
      ["", "No preference"],
      ["1", "Today"],
      ["3", "3 days"],
      ["5", "5 days"],
      ["10", "10 days"],
      ["30", "30 days"]
    ];

    opts.forEach(([v, t]) => {
      const checked = (initial.sinceDays == null && v === "") || (initial.sinceDays != null && String(initial.sinceDays) === v);
      const inp = makeRadio(name, v, checked);
      const row = makeOptRow(inp, t);
      blocks.offered.body.appendChild(row);
      inp.addEventListener("change", queueApply);
    });

    blocks.offered.xBtn.addEventListener("click", () => {
      // reset a "No preference"
      const first = blocks.offered.body.querySelector(`input[name="${name}"][value=""]`);
      if (first) first.checked = true;
      queueApply();
    });
  }

  // Availability (checkbox multi)
  {
    const opts = [
      ["available", "Available"],
      ["negotiation", "In negotiation"],
      ["closed", "Sold"]
    ];

    opts.forEach(([v, t]) => {
      const checked = initial.availabilitySet.has(v);
      const inp = makeCheckbox(v, checked);
      inp.dataset.k = "availability";
      const row = makeOptRow(inp, t);
      blocks.availability.body.appendChild(row);
      inp.addEventListener("change", queueApply);
    });

    blocks.availability.xBtn.addEventListener("click", () => {
      blocks.availability.body.querySelectorAll('input[data-k="availability"]').forEach(i => { i.checked = false; });
      queueApply();
    });
  }

  // Living area (range)
  {
    const wrap = el("div", { class: "bhRange" });

    const minInp = el("input", {
      class: "bhInp",
      type: "number",
      inputmode: "numeric",
      placeholder: "By 0 m²",
      value: initial.usefulMin ?? ""
    });
    minInp.dataset.k = "useful_min";

    const maxInp = el("input", {
      class: "bhInp",
      type: "number",
      inputmode: "numeric",
      placeholder: "To No max m²",
      value: initial.usefulMax ?? ""
    });
    maxInp.dataset.k = "useful_max";

    wrap.appendChild(minInp);
    wrap.appendChild(maxInp);
    blocks.living.body.appendChild(wrap);

    minInp.addEventListener("input", queueApply);
    minInp.addEventListener("change", queueApply);
    maxInp.addEventListener("input", queueApply);
    maxInp.addEventListener("change", queueApply);

    blocks.living.xBtn.addEventListener("click", () => {
      minInp.value = "";
      maxInp.value = "";
      queueApply();
    });
  }

  panel.appendChild(blocks.offered.block);
  panel.appendChild(blocks.availability.block);
  panel.appendChild(blocks.living.block);

  mount.innerHTML = "";
  mount.appendChild(panel);

  // estado inicial + URL normalizada
  applyNow();

  return { };
}

