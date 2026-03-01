function el(tag, attrs, children) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (v == null) continue;
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

function textOrNull(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function csvFromSet(set) {
  const arr = Array.from(set || []);
  return arr.length ? arr.join(",") : null;
}

function setFromCsv(csv) {
  if (!csv) return new Set();
  return new Set(
    String(csv)
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  );
}

function getUrlParams() {
  const u = new URL(window.location.href);
  return u.searchParams;
}

function writeUrlParams(patch) {
  const u = new URL(window.location.href);
  const sp = u.searchParams;

  for (const [k, v] of Object.entries(patch || {})) {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) sp.delete(k);
    else sp.set(k, String(v));
  }

  history.replaceState(null, "", u.toString());
}

function notifyChanged() {
  window.dispatchEvent(new CustomEvent("bh:filters-changed"));
}

function makeSection(title, buildBodyFn) {
  const dot = el("div", { class: "fDot", "aria-hidden": "true" });
  const titleEl = el("div", { class: "fTitle", text: title });
  const clearBtn = el("button", { class: "fClear", type: "button" }, [el("span", { text: "×" })]);

  const head = el("div", { class: "fHead" }, [
    el("div", { class: "fTitleWrap" }, [dot, titleEl]),
    clearBtn
  ]);

  const body = el("div", { class: "fBody" });
  const sec = el("div", { class: "fSection" }, [head, body]);

  const api = {
    root: sec,
    body,
    setActive(isOn) {
      dot.classList.toggle("on", !!isOn);
      clearBtn.disabled = !isOn;
    },
    onClear(fn) {
      clearBtn.addEventListener("click", () => fn && fn());
    }
  };

  buildBodyFn(api);
  return api;
}

function makeRadioList(options, name) {
  const wrap = el("div", { class: "fList" });
  const inputs = [];

  options.forEach(opt => {
    const id = `${name}_${opt.value}`;
    const input = el("input", { type: "radio", name, id, value: opt.value });
    const label = el("label", { for: id, text: opt.label });
    wrap.appendChild(el("div", { class: "fOpt" }, [input, label]));
    inputs.push(input);
  });

  return { wrap, inputs };
}

function makeCheckboxList(options) {
  const wrap = el("div", { class: "fList" });
  const inputs = [];

  options.forEach(opt => {
    const id = `cb_${opt.value}_${Math.random().toString(16).slice(2)}`;
    const input = el("input", { type: "checkbox", id, value: opt.value });
    const label = el("label", { for: id, text: opt.label });
    wrap.appendChild(el("div", { class: "fOpt" }, [input, label]));
    inputs.push(input);
  });

  return { wrap, inputs };
}

export function initFiltersBar({ mountId } = {}) {
  const mount = document.getElementById(mountId || "filtersColMount");
  if (!mount) return;

  const sp = getUrlParams();

  function refreshActiveMarkers(sections) {
    sections.forEach(s => s.refresh && s.refresh());
  }

  function onAnyChange() {
    notifyChanged();
    window.dispatchEvent(new CustomEvent("bh:layout-resize"));
  }

  mount.innerHTML = "";

  const sections = [];

  // Precio (min/max)
  {
    const sec = makeSection("Precio", (api) => {
      const min = el("input", { class: "fInput", type: "number", inputmode: "numeric", placeholder: "Min €" });
      const max = el("input", { class: "fInput", type: "number", inputmode: "numeric", placeholder: "Max €" });

      min.value = sp.get("price_min") || "";
      max.value = sp.get("price_max") || "";

      const apply = () => {
        writeUrlParams({
          price_min: intOrNull(min.value),
          price_max: intOrNull(max.value)
        });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      min.addEventListener("input", apply);
      max.addEventListener("input", apply);

      api.body.appendChild(el("div", { class: "fRow2" }, [min, max]));

      api.onClear(() => {
        min.value = "";
        max.value = "";
        writeUrlParams({ price_min: null, price_max: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => {
        const on = !!(intOrNull(min.value) != null || intOrNull(max.value) != null);
        api.setActive(on);
      };
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // Ofertado desde (since_days) -> radio
  {
    const options = [
      { value: "", label: "Sin preferencia" },
      { value: "0", label: "Hoy" },
      { value: "3", label: "3 días" },
      { value: "5", label: "5 días" },
      { value: "10", label: "10 días" },
      { value: "30", label: "30 días" }
    ];

    const sec = makeSection("Ofertado desde", (api) => {
      const { wrap, inputs } = makeRadioList(options, "since_days");
      const current = sp.get("since_days") || "";
      inputs.forEach(i => { if (i.value === current) i.checked = true; });

      const apply = () => {
        const chosen = inputs.find(i => i.checked)?.value ?? "";
        writeUrlParams({ since_days: chosen ? intOrNull(chosen) : null });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      inputs.forEach(i => i.addEventListener("change", apply));
      api.body.appendChild(wrap);

      api.onClear(() => {
        inputs.forEach(i => (i.checked = i.value === ""));
        writeUrlParams({ since_days: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => {
        const v = inputs.find(i => i.checked)?.value ?? "";
        api.setActive(!!v);
      };
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // Disponibilidad (availability) -> single select (si luego lo quieres multi, se cambia aquí)
  {
    const sec = makeSection("Disponibilidad", (api) => {
      const sel = el("select", { class: "fSelect" });
      [
        ["", "Sin preferencia"],
        ["published", "Disponible"],
        ["negotiation", "En negociación"],
        ["sold", "Vendido"]
      ].forEach(([v, t]) => sel.appendChild(el("option", { value: v, text: t })));

      sel.value = sp.get("availability") || "";

      const apply = () => {
        writeUrlParams({ availability: sel.value || null });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      sel.addEventListener("change", apply);
      api.body.appendChild(sel);

      api.onClear(() => {
        sel.value = "";
        writeUrlParams({ availability: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(!!(sel.value));
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // Superficie útil (useful_min/max)
  {
    const sec = makeSection("Superficie útil", (api) => {
      const min = el("input", { class: "fInput", type: "number", inputmode: "numeric", placeholder: "Desde (m²)" });
      const max = el("input", { class: "fInput", type: "number", inputmode: "numeric", placeholder: "Hasta (m²)" });

      min.value = sp.get("useful_min") || "";
      max.value = sp.get("useful_max") || "";

      const apply = () => {
        writeUrlParams({
          useful_min: intOrNull(min.value),
          useful_max: intOrNull(max.value)
        });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      min.addEventListener("input", apply);
      max.addEventListener("input", apply);

      api.body.appendChild(el("div", { class: "fRow2" }, [min, max]));

      api.onClear(() => {
        min.value = "";
        max.value = "";
        writeUrlParams({ useful_min: null, useful_max: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(!!(intOrNull(min.value) != null || intOrNull(max.value) != null));
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // Superficie construida (built_min/max)  (nota: tus params se llaman built_min/built_max aunque aquí sea m²)
  {
    const sec = makeSection("Superficie construida", (api) => {
      const min = el("input", { class: "fInput", type: "number", inputmode: "numeric", placeholder: "Desde (m²)" });
      const max = el("input", { class: "fInput", type: "number", inputmode: "numeric", placeholder: "Hasta (m²)" });

      min.value = sp.get("built_min") || "";
      max.value = sp.get("built_max") || "";

      const apply = () => {
        writeUrlParams({
          built_min: intOrNull(min.value),
          built_max: intOrNull(max.value)
        });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      min.addEventListener("input", apply);
      max.addEventListener("input", apply);

      api.body.appendChild(el("div", { class: "fRow2" }, [min, max]));

      api.onClear(() => {
        min.value = "";
        max.value = "";
        writeUrlParams({ built_min: null, built_max: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(!!(intOrNull(min.value) != null || intOrNull(max.value) != null));
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // Dormitorios (bedrooms_min) -> select
  {
    const sec = makeSection("Dormitorios", (api) => {
      const sel = el("select", { class: "fSelect" });
      [
        ["", "Sin preferencia"],
        ["0", "0+"],
        ["1", "1+"],
        ["2", "2+"],
        ["3", "3+"],
        ["4", "4+"],
        ["5", "5+"],
        ["6", "6+"]
      ].forEach(([v,t]) => sel.appendChild(el("option", { value: v, text: t })));

      sel.value = sp.get("bedrooms_min") || "";

      const apply = () => {
        writeUrlParams({ bedrooms_min: sel.value ? intOrNull(sel.value) : null });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      sel.addEventListener("change", apply);
      api.body.appendChild(sel);

      api.onClear(() => {
        sel.value = "";
        writeUrlParams({ bedrooms_min: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(!!sel.value);
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // Baños (bathrooms_min) -> select
  {
    const sec = makeSection("Baños", (api) => {
      const sel = el("select", { class: "fSelect" });
      [
        ["", "Sin preferencia"],
        ["1", "1+"],
        ["2", "2+"],
        ["3", "3+"],
        ["4", "4+"]
      ].forEach(([v,t]) => sel.appendChild(el("option", { value: v, text: t })));

      sel.value = sp.get("bathrooms_min") || "";

      const apply = () => {
        writeUrlParams({ bathrooms_min: sel.value ? intOrNull(sel.value) : null });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      sel.addEventListener("change", apply);
      api.body.appendChild(sel);

      api.onClear(() => {
        sel.value = "";
        writeUrlParams({ bathrooms_min: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(!!sel.value);
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // Exterior (outdoor_type) -> select
  {
    const sec = makeSection("Exterior", (api) => {
      const sel = el("select", { class: "fSelect" });
      [
        ["", "Sin preferencia"],
        ["balcony", "Balcón"],
        ["terrace", "Terraza"],
        ["garden", "Jardín"],
        ["none", "Sin exterior"]
      ].forEach(([v,t]) => sel.appendChild(el("option", { value: v, text: t })));

      sel.value = sp.get("outdoor_type") || "";

      const apply = () => {
        writeUrlParams({ outdoor_type: sel.value || null });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      sel.addEventListener("change", apply);
      api.body.appendChild(sel);

      api.onClear(() => {
        sel.value = "";
        writeUrlParams({ outdoor_type: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(!!sel.value);
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // Orientación (orientations) -> multi csv
  {
    const opts = [
      { value: "N", label: "N" },
      { value: "NE", label: "NE" },
      { value: "E", label: "E" },
      { value: "SE", label: "SE" },
      { value: "S", label: "S" },
      { value: "SO", label: "SO" },
      { value: "O", label: "O" },
      { value: "NO", label: "NO" }
    ];

    const sec = makeSection("Orientación", (api) => {
      const chosen = setFromCsv(sp.get("orientations"));
      const { wrap, inputs } = makeCheckboxList(opts);

      inputs.forEach(i => { if (chosen.has(i.value)) i.checked = true; });

      const apply = () => {
        const set = new Set(inputs.filter(i => i.checked).map(i => i.value));
        writeUrlParams({ orientations: csvFromSet(set) });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      inputs.forEach(i => i.addEventListener("change", apply));
      api.body.appendChild(wrap);

      api.onClear(() => {
        inputs.forEach(i => (i.checked = false));
        writeUrlParams({ orientations: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(inputs.some(i => i.checked));
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // Energía (energy)
  {
    const sec = makeSection("Energía", (api) => {
      const sel = el("select", { class: "fSelect" });
      [
        ["", "Sin preferencia"],
        ["A", "A"],
        ["B", "B"],
        ["C", "C"],
        ["D", "D"],
        ["E", "E"],
        ["F", "F"],
        ["G", "G"],
        ["pending", "Pendiente"]
      ].forEach(([v,t]) => sel.appendChild(el("option", { value: v, text: t })));

      sel.value = sp.get("energy") || "";

      const apply = () => {
        writeUrlParams({ energy: sel.value || null });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      sel.addEventListener("change", apply);
      api.body.appendChild(sel);

      api.onClear(() => {
        sel.value = "";
        writeUrlParams({ energy: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(!!sel.value);
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // build_periods (csv multi)
  {
    const opts = [
      { value: "pre_1950", label: "Antes de 1950" },
      { value: "1950_1979", label: "1950–1979" },
      { value: "1980_1999", label: "1980–1999" },
      { value: "2000_2009", label: "2000–2009" },
      { value: "2010_2019", label: "2010–2019" },
      { value: "2020_plus", label: "2020+" }
    ];

    const sec = makeSection("Periodo construcción", (api) => {
      const chosen = setFromCsv(sp.get("build_periods"));
      const { wrap, inputs } = makeCheckboxList(opts);
      inputs.forEach(i => { if (chosen.has(i.value)) i.checked = true; });

      const apply = () => {
        const set = new Set(inputs.filter(i => i.checked).map(i => i.value));
        writeUrlParams({ build_periods: csvFromSet(set) });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      inputs.forEach(i => i.addEventListener("change", apply));
      api.body.appendChild(wrap);

      api.onClear(() => {
        inputs.forEach(i => (i.checked = false));
        writeUrlParams({ build_periods: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(inputs.some(i => i.checked));
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // parking (csv multi)
  {
    const opts = [
      { value: "garage", label: "Garaje" },
      { value: "covered", label: "Cubierto" },
      { value: "street", label: "En calle" },
      { value: "none", label: "Sin parking" }
    ];

    const sec = makeSection("Parking", (api) => {
      const chosen = setFromCsv(sp.get("parking"));
      const { wrap, inputs } = makeCheckboxList(opts);
      inputs.forEach(i => { if (chosen.has(i.value)) i.checked = true; });

      const apply = () => {
        const set = new Set(inputs.filter(i => i.checked).map(i => i.value));
        writeUrlParams({ parking: csvFromSet(set) });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      inputs.forEach(i => i.addEventListener("change", apply));
      api.body.appendChild(wrap);

      api.onClear(() => {
        inputs.forEach(i => (i.checked = false));
        writeUrlParams({ parking: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(inputs.some(i => i.checked));
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // storage (csv multi)
  {
    const opts = [
      { value: "storage_room", label: "Trastero" },
      { value: "basement", label: "Sótano" },
      { value: "none", label: "Sin trastero" }
    ];

    const sec = makeSection("Trastero", (api) => {
      const chosen = setFromCsv(sp.get("storage"));
      const { wrap, inputs } = makeCheckboxList(opts);
      inputs.forEach(i => { if (chosen.has(i.value)) i.checked = true; });

      const apply = () => {
        const set = new Set(inputs.filter(i => i.checked).map(i => i.value));
        writeUrlParams({ storage: csvFromSet(set) });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      inputs.forEach(i => i.addEventListener("change", apply));
      api.body.appendChild(wrap);

      api.onClear(() => {
        inputs.forEach(i => (i.checked = false));
        writeUrlParams({ storage: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(inputs.some(i => i.checked));
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  // accessibility (csv multi)
  {
    const opts = [
      { value: "lift", label: "Ascensor" },
      { value: "wheelchair", label: "Accesible silla ruedas" },
      { value: "no_steps", label: "Sin escalones" }
    ];

    const sec = makeSection("Accesibilidad", (api) => {
      const chosen = setFromCsv(sp.get("accessibility"));
      const { wrap, inputs } = makeCheckboxList(opts);
      inputs.forEach(i => { if (chosen.has(i.value)) i.checked = true; });

      const apply = () => {
        const set = new Set(inputs.filter(i => i.checked).map(i => i.value));
        writeUrlParams({ accessibility: csvFromSet(set) });
        refreshActiveMarkers(sections);
        onAnyChange();
      };

      inputs.forEach(i => i.addEventListener("change", apply));
      api.body.appendChild(wrap);

      api.onClear(() => {
        inputs.forEach(i => (i.checked = false));
        writeUrlParams({ accessibility: null });
        refreshActiveMarkers(sections);
        onAnyChange();
      });

      api.refresh = () => api.setActive(inputs.some(i => i.checked));
      api.refresh();
    });

    mount.appendChild(sec.root);
    sections.push(sec);
  }

  window.dispatchEvent(new CustomEvent("bh:layout-resize"));
}
