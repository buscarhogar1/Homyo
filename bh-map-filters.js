function toInt(v) {
  if (v == null || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function readParamsFromURL() {
  const u = new URL(window.location.href);

  let mode = (u.searchParams.get("mode") || "").trim().toLowerCase();
  if (!mode) mode = "buy";
  const allowed = ["buy","rent","room","new_build","all"];
  if (!allowed.includes(mode)) mode = "buy";

  return {
    mode,
    priceMin: toInt(u.searchParams.get("price_min")),
    priceMax: toInt(u.searchParams.get("price_max")),
    usefulMin: toInt(u.searchParams.get("useful_min")),
    usefulMax: toInt(u.searchParams.get("useful_max")),
    builtMin: toInt(u.searchParams.get("built_min")),
    builtMax: toInt(u.searchParams.get("built_max")),
    bedroomsMin: toInt(u.searchParams.get("bedrooms_min")),
    listedSinceDays: toInt(u.searchParams.get("since_days"))
  };
}

function writeParamsToURL(patch) {
  const u = new URL(window.location.href);

  const setInt = (key, val) => {
    if (val == null || val === "") u.searchParams.delete(key);
    else u.searchParams.set(key, String(val));
  };

  const setText = (key, val) => {
    if (!val) u.searchParams.delete(key);
    else u.searchParams.set(key, String(val));
  };

  if ("mode" in patch) setText("mode", patch.mode);

  if ("priceMin" in patch) setInt("price_min", patch.priceMin);
  if ("priceMax" in patch) setInt("price_max", patch.priceMax);

  if ("usefulMin" in patch) setInt("useful_min", patch.usefulMin);
  if ("usefulMax" in patch) setInt("useful_max", patch.usefulMax);

  if ("builtMin" in patch) setInt("built_min", patch.builtMin);
  if ("builtMax" in patch) setInt("built_max", patch.builtMax);

  if ("bedroomsMin" in patch) setInt("bedrooms_min", patch.bedroomsMin);

  if ("listedSinceDays" in patch) setInt("since_days", patch.listedSinceDays);

  history.replaceState(null, "", u.toString());
}

function emitChanged() {
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

function clampMinMax(minVal, maxVal) {
  const a = (minVal == null) ? null : minVal;
  const b = (maxVal == null) ? null : maxVal;
  if (a == null || b == null) return { min: a, max: b };
  if (a <= b) return { min: a, max: b };
  return { min: b, max: a };
}

export function initFiltersBar(opts) {
  const mountId = (opts && opts.mountId) ? String(opts.mountId) : "filtersBarMount";
  const mount = document.getElementById(mountId);
  if (!mount) return;

  mount.innerHTML = `
    <div class="bhFiltersBar">
      <div class="bhFiltersInner">
        <div class="bhFiltersRow" id="bhFiltersRow">
          <div class="bhChipGroup" id="modeChips" aria-label="Operación">
            <div class="bhChip" data-mode="buy">Comprar</div>
            <div class="bhChip" data-mode="rent">Alquilar</div>
            <div class="bhChip" data-mode="room">Habitación</div>
            <div class="bhChip" data-mode="new_build">Obra nueva</div>
            <div class="bhChip" data-mode="all">Todo</div>
          </div>

          <div class="bhField" title="Precio">
            <div class="bhFieldLabel">Precio</div>
            <input class="bhInput" id="fPriceMin" inputmode="numeric" placeholder="min" />
            <input class="bhInput" id="fPriceMax" inputmode="numeric" placeholder="max" />
          </div>

          <div class="bhField" title="m² útiles interior">
            <div class="bhFieldLabel">Útiles</div>
            <input class="bhInput small" id="fUsefulMin" inputmode="numeric" placeholder="min" />
            <input class="bhInput small" id="fUsefulMax" inputmode="numeric" placeholder="max" />
          </div>

          <div class="bhField" title="Dormitorios mínimo">
            <div class="bhFieldLabel">Hab.</div>
            <input class="bhInput small" id="fBedsMin" inputmode="numeric" placeholder="mín" />
          </div>

          <div class="bhField" title="Año de construcción">
            <div class="bhFieldLabel">Año</div>
            <input class="bhInput small" id="fBuiltMin" inputmode="numeric" placeholder="min" />
            <input class="bhInput small" id="fBuiltMax" inputmode="numeric" placeholder="max" />
          </div>

          <div class="bhField" title="Publicado en los últimos X días">
            <div class="bhFieldLabel">Publicado</div>
            <input class="bhInput small" id="fSinceDays" inputmode="numeric" placeholder="días" />
          </div>

          <button class="bhBtn primary" id="btnMoreFilters" type="button">Más filtros</button>
          <button class="bhBtn" id="btnClearFilters" type="button">Limpiar</button>
        </div>

        <div class="bhPanel" id="morePanel">
          <div class="bhPanelNote">
            MVP: aquí meteremos los filtros secundarios (orientación, energía, exterior, parking, trastero, accesibilidad, etc.).
          </div>
        </div>
      </div>
    </div>
  `;

  const chips = Array.from(mount.querySelectorAll("#modeChips .bhChip"));
  const priceMinEl = mount.querySelector("#fPriceMin");
  const priceMaxEl = mount.querySelector("#fPriceMax");
  const usefulMinEl = mount.querySelector("#fUsefulMin");
  const usefulMaxEl = mount.querySelector("#fUsefulMax");
  const bedsMinEl = mount.querySelector("#fBedsMin");
  const builtMinEl = mount.querySelector("#fBuiltMin");
  const builtMaxEl = mount.querySelector("#fBuiltMax");
  const sinceDaysEl = mount.querySelector("#fSinceDays");
  const btnMore = mount.querySelector("#btnMoreFilters");
  const btnClear = mount.querySelector("#btnClearFilters");
  const panel = mount.querySelector("#morePanel");

  const applyToUI = () => {
    const p = readParamsFromURL();

    chips.forEach(ch => ch.classList.toggle("active", ch.dataset.mode === p.mode));

    priceMinEl.value = (p.priceMin == null) ? "" : String(p.priceMin);
    priceMaxEl.value = (p.priceMax == null) ? "" : String(p.priceMax);

    usefulMinEl.value = (p.usefulMin == null) ? "" : String(p.usefulMin);
    usefulMaxEl.value = (p.usefulMax == null) ? "" : String(p.usefulMax);

    bedsMinEl.value = (p.bedroomsMin == null) ? "" : String(p.bedroomsMin);

    builtMinEl.value = (p.builtMin == null) ? "" : String(p.builtMin);
    builtMaxEl.value = (p.builtMax == null) ? "" : String(p.builtMax);

    sinceDaysEl.value = (p.listedSinceDays == null) ? "" : String(p.listedSinceDays);
  };

  let t = null;
  const debouncedCommit = (patchBuilder) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      const patch = patchBuilder();
      writeParamsToURL(patch);
      emitChanged();
    }, 250);
  };

  chips.forEach(ch => {
    ch.addEventListener("click", () => {
      const mode = ch.dataset.mode || "buy";
      writeParamsToURL({ mode });
      applyToUI();
      emitChanged();
    });
  });

  const wireNum = (el, key) => {
    el.addEventListener("input", () => {
      debouncedCommit(() => {
        const v = toInt(el.value);
        return { [key]: v };
      });
    });
  };

  wireNum(priceMinEl, "priceMin");
  wireNum(priceMaxEl, "priceMax");
  wireNum(usefulMinEl, "usefulMin");
  wireNum(usefulMaxEl, "usefulMax");
  wireNum(bedsMinEl, "bedroomsMin");
  wireNum(builtMinEl, "builtMin");
  wireNum(builtMaxEl, "builtMax");
  wireNum(sinceDaysEl, "listedSinceDays");

  const normalizeMinMaxPairs = () => {
    const pMin = toInt(priceMinEl.value);
    const pMax = toInt(priceMaxEl.value);
    const uMin = toInt(usefulMinEl.value);
    const uMax = toInt(usefulMaxEl.value);
    const bMin = toInt(builtMinEl.value);
    const bMax = toInt(builtMaxEl.value);

    const pr = clampMinMax(pMin, pMax);
    const ur = clampMinMax(uMin, uMax);
    const br = clampMinMax(bMin, bMax);

    writeParamsToURL({
      priceMin: pr.min, priceMax: pr.max,
      usefulMin: ur.min, usefulMax: ur.max,
      builtMin: br.min, builtMax: br.max
    });

    applyToUI();
    emitChanged();
  };

  [priceMinEl, priceMaxEl, usefulMinEl, usefulMaxEl, builtMinEl, builtMaxEl].forEach(el => {
    el.addEventListener("blur", normalizeMinMaxPairs);
  });

  btnMore.addEventListener("click", () => {
    const open = panel.classList.toggle("open");
    btnMore.textContent = open ? "Menos filtros" : "Más filtros";
  });

  btnClear.addEventListener("click", () => {
    const u = new URL(window.location.href);
    const city = u.searchParams.get("city");

    u.searchParams.delete("mode");
    u.searchParams.delete("price_min");
    u.searchParams.delete("price_max");
    u.searchParams.delete("useful_min");
    u.searchParams.delete("useful_max");
    u.searchParams.delete("built_min");
    u.searchParams.delete("built_max");
    u.searchParams.delete("bedrooms_min");
    u.searchParams.delete("since_days");

    if (city) u.searchParams.set("city", city);

    history.replaceState(null, "", u.toString());
    applyToUI();
    emitChanged();
  });

  window.addEventListener("popstate", applyToUI);

  applyToUI();
}
