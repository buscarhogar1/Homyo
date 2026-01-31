// bh-map-sun.js
(function () {
  window.BHMap = window.BHMap || {};
  const BHMap = window.BHMap;

  const map = BHMap.map;
  if (!map) return;

  const sunOverlayEl = document.getElementById("sunOverlay");
  const sunOverlayLabelEl = document.getElementById("sunOverlayLabel");
  const sunPolarOverlaySvg = document.getElementById("sunPolarOverlay");

  const sunTimebarEl = document.getElementById("sunTimebar");
  const sunDateDockEl = document.getElementById("sunDateDock");
  const sunHoursRowEl = document.getElementById("sunHoursRow");
  const sunTrackEl = document.getElementById("sunTrack");
  const sunRangeEl = document.getElementById("sunRange");
  const sunDateEl = document.getElementById("sunDate");
  const sunNowBtn = document.getElementById("sunNowBtn");

  const ZOOM_SOL_MIN = 14;
  let sunEnabled = false;
  const sunState = { dateISO: null, minutes: null, sunriseMin: null, sunsetMin: null };

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours()*60 + d.getMinutes();
  }

  function minutesToHHMM(mins) {
    const h = Math.floor(mins/60);
    const m = mins % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }

  function rad2deg(r){ return r * 180 / Math.PI; }

  function sunBearingAndAltDeg(lat, lng, dateObj){
    const pos = SunCalc.getPosition(dateObj, lat, lng);
    const azDeg = rad2deg(pos.azimuth);
    const bearingDeg = (180 + azDeg + 360) % 360;
    const altDeg = rad2deg(pos.altitude);
    return { bearingDeg, altDeg };
  }

  function bearingToCardinal(deg){
    const dirs = ["N","NE","E","SE","S","SO","O","NO"];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  }

  function buildDateObj(iso, minutes) {
    const [y,m,d] = iso.split("-").map(x => parseInt(x,10));
    const hh = Math.floor(minutes/60);
    const mm = minutes % 60;
    return new Date(y, (m-1), d, hh, mm, 0, 0);
  }

  function addDaysISO(iso, deltaDays){
    const [y,m,d] = iso.split("-").map(x => parseInt(x,10));
    const dt = new Date(y, m-1, d, 12, 0, 0, 0);
    dt.setDate(dt.getDate() + deltaDays);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const dd = String(dt.getDate()).padStart(2,"0");
    return `${yy}-${mm}-${dd}`;
  }

  function svgClear(el){ while (el.firstChild) el.removeChild(el.firstChild); }
  function svgEl(name, attrs){
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (attrs) for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  function polarXY(cx, cy, R, bearingDeg, altDeg){
    const altClamped = Math.max(-24, Math.min(90, altDeg));
    const r = ((90 - altClamped) / 90) * R;
    const t = bearingDeg * Math.PI / 180;
    const x = cx + r * Math.sin(t);
    const y = cy - r * Math.cos(t);
    return { x, y };
  }

  function arcPath(cx, cy, r, a0Deg, a1Deg){
    const a0 = (a0Deg - 90) * Math.PI/180;
    const a1 = (a1Deg - 90) * Math.PI/180;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    let da = ((a1Deg - a0Deg) % 360 + 360) % 360;
    const large = da > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function drawSunPolar(svg, centerLatLng, dateISO, minutes){
    const V = 1120;
    const cx = V/2;
    const cy = V/2;
    const R = 450;

    svg.setAttribute("viewBox", `0 0 ${V} ${V}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgClear(svg);

    svg.appendChild(svgEl("circle", {
      cx, cy, r: R,
      fill: "rgba(255,255,255,0.00)",
      stroke: "rgba(0,0,0,0.35)",
      "stroke-width": "3"
    }));

    const axes = [
      { a:0,   label:"N", x: cx,         y: cy - R - 22, anchor:"middle" },
      { a:90,  label:"E", x: cx + R + 22, y: cy + 12,    anchor:"start"  },
      { a:180, label:"S", x: cx,         y: cy + R + 42, anchor:"middle" },
      { a:270, label:"O", x: cx - R - 22, y: cy + 12,    anchor:"end"    },
    ];

    [0,90,180,270].forEach(a=>{
      const p = polarXY(cx, cy, R, a, 0);
      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: p.x, y2: p.y,
        stroke: "rgba(0,0,0,0.20)",
        "stroke-width": "2"
      }));
    });

    axes.forEach(o=>{
      const t = svgEl("text", {
        x: o.x,
        y: o.y,
        "text-anchor": o.anchor,
        "font-size": "34",
        fill: "rgba(0,0,0,0.45)"
      });
      t.textContent = o.label;
      svg.appendChild(t);
    });

    const dayNoon = buildDateObj(dateISO, 12*60);
    const times = SunCalc.getTimes(dayNoon, centerLatLng.lat, centerLatLng.lng);
    const sunrise = times.sunrise;
    const sunset = times.sunset;

    let haveSunTimes = false;

    if (sunrise instanceof Date && !isNaN(sunrise.getTime()) && sunset instanceof Date && !isNaN(sunset.getTime())) {
      const sr = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, sunrise);
      const ss = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, sunset);

      const sunriseBearing = sr.bearingDeg;
      const sunsetBearing = ss.bearingDeg;
      haveSunTimes = true;

      const d1 = arcPath(cx, cy, R, sunriseBearing, sunsetBearing);

      svg.appendChild(svgEl("path", {
        d: `${d1} L ${cx} ${cy} Z`,
        fill: "rgba(255, 196, 50, 0.14)",
        stroke: "none"
      }));

      svg.appendChild(svgEl("path", {
        d: d1,
        fill: "none",
        stroke: "rgba(255, 140, 0, 0.65)",
        "stroke-width": "6",
        "stroke-linecap": "round"
      }));

      const srPt = polarXY(cx, cy, R, sunriseBearing, 0);
      const ssPt = polarXY(cx, cy, R, sunsetBearing, 0);

      const riseSetStroke = "rgba(255, 140, 0, 0.85)";

      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: srPt.x, y2: srPt.y,
        stroke: riseSetStroke,
        "stroke-width": "6",
        "stroke-linecap": "round"
      }));

      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: ssPt.x, y2: ssPt.y,
        stroke: riseSetStroke,
        "stroke-width": "6",
        "stroke-linecap": "round"
      }));

      [srPt, ssPt].forEach(pt=>{
        svg.appendChild(svgEl("circle", {
          cx: pt.x, cy: pt.y, r: 12,
          fill: "rgba(0,0,0,0.22)"
        }));
      });
    }

    const curDate = buildDateObj(dateISO, minutes);
    const cur = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, curDate);

    const meta = { isDay: cur.altDeg > 0, bearingDeg: cur.bearingDeg, altDeg: cur.altDeg };

    const sunR = Math.round(18 * 1.15);
    const sunStroke = Math.round(6 * 1.15);

    const sunRingYellow = "rgba(255, 196, 50, 0.98)";
    const sunLineYellow = "rgba(255, 196, 50, 0.86)";

    if (!meta.isDay && haveSunTimes) {
      const nextISO = addDaysISO(dateISO, 1);
      const nextNoon = buildDateObj(nextISO, 12*60);
      const timesNext = SunCalc.getTimes(nextNoon, centerLatLng.lat, centerLatLng.lng);
      const sunriseNext = timesNext.sunrise;

      if (sunset instanceof Date && sunriseNext instanceof Date && !isNaN(sunriseNext.getTime())) {
        const ptsN = [];
        const stepMin = 10;

        for (let tt = sunset.getTime(); tt <= sunriseNext.getTime(); tt += stepMin*60*1000) {
          const d = new Date(tt);
          const pa = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, d);
          if (pa.altDeg <= 0) ptsN.push(polarXY(cx, cy, R, pa.bearingDeg, pa.altDeg));
        }

        if (ptsN.length >= 2) {
          const dAttrN = ptsN.map((p,i)=> `${i===0?"M":"L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
          svg.appendChild(svgEl("path", {
            d: dAttrN,
            fill: "none",
            stroke: "rgba(140,140,140,0.55)",
            "stroke-width": "6",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }));
        }
      }
    }

    if (meta.isDay) {
      if (haveSunTimes) {
        const pts = [];
        const stepMin = 6;
        const start = sunrise.getTime();
        const end = sunset.getTime();
        for (let tt = start; tt <= end; tt += stepMin*60*1000) {
          const d = new Date(tt);
          const pa = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, d);
          if (pa.altDeg >= 0) pts.push(polarXY(cx, cy, R, pa.bearingDeg, pa.altDeg));
        }
        if (pts.length >= 2) {
          const dAttr = pts.map((p,i)=> `${i===0?"M":"L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
          svg.appendChild(svgEl("path", {
            d: dAttr,
            fill: "none",
            stroke: "rgba(255, 140, 0, 0.88)",
            "stroke-width": "8",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }));
        }
      }

      const p = polarXY(cx, cy, R, cur.bearingDeg, cur.altDeg);

      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: p.x, y2: p.y,
        stroke: sunLineYellow,
        "stroke-width": "8",
        "stroke-linecap": "round"
      }));

      svg.appendChild(svgEl("circle", {
        cx: p.x, cy: p.y, r: sunR,
        fill: "rgba(255, 120, 60, 0.95)",
        stroke: sunRingYellow,
        "stroke-width": String(sunStroke)
      }));
    } else {
      const p = polarXY(cx, cy, R, cur.bearingDeg, cur.altDeg);

      svg.appendChild(svgEl("circle", {
        cx: p.x, cy: p.y, r: sunR,
        fill: "rgba(165,165,165,0.86)",
        stroke: sunRingYellow,
        "stroke-width": String(sunStroke)
      }));
    }

    return meta;
  }

  function minutesOfDate(d){
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  }

  function updateDaylightBand(){
    const c = map.getCenter();
    const iso = sunState.dateISO || todayISO();
    const noon = buildDateObj(iso, 12*60);
    const times = SunCalc.getTimes(noon, c.lat, c.lng);

    const sr = minutesOfDate(times.sunrise);
    const ss = minutesOfDate(times.sunset);

    sunState.sunriseMin = sr;
    sunState.sunsetMin = ss;

    const srPct = (sr == null) ? 0 : Math.max(0, Math.min(100, (sr / 1439) * 100));
    const ssPct = (ss == null) ? 0 : Math.max(0, Math.min(100, (ss / 1439) * 100));

    sunTrackEl.style.setProperty("--sr", `${srPct.toFixed(3)}%`);
    sunTrackEl.style.setProperty("--ss", `${ssPct.toFixed(3)}%`);
  }

  function updateSunOverlay(){
    const ok = sunEnabled && map.getZoom() >= ZOOM_SOL_MIN;

    sunOverlayEl.style.display = ok ? "block" : "none";
    sunTimebarEl.style.display = ok ? "block" : "none";
    sunDateDockEl.style.display = ok ? "block" : "none";

    if (!ok) return;

    const c = map.getCenter();
    const iso = sunState.dateISO || todayISO();
    const mins = (sunState.minutes != null) ? sunState.minutes : nowMinutes();

    updateDaylightBand();

    const meta = drawSunPolar(sunPolarOverlaySvg, c, iso, mins);

    const card = bearingToCardinal(meta.bearingDeg);
    if (meta.isDay) {
      sunOverlayLabelEl.textContent = `${minutesToHHMM(mins)} · ${card} · ${Math.round(meta.bearingDeg)}° · alt ${Math.round(meta.altDeg)}°`;
    } else {
      sunOverlayLabelEl.textContent = `${minutesToHHMM(mins)} · noche · ${card} · ${Math.round(meta.bearingDeg)}° · alt ${Math.round(meta.altDeg)}°`;
    }
  }

  function setSunEnabled(next){
    sunEnabled = next;
    updateSunOverlay();
  }

  function initHoursRow(){
    const frag = document.createDocumentFragment();
    for (let h = 0; h < 24; h++) {
      const s = document.createElement("span");
      s.textContent = String(h).padStart(2,"0");
      frag.appendChild(s);
    }
    sunHoursRowEl.innerHTML = "";
    sunHoursRowEl.appendChild(frag);
  }

  function preventMapDragOn(el){
    el.addEventListener("mousedown", (e) => e.stopPropagation());
    el.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    el.addEventListener("click", (e) => e.stopPropagation());
  }

  initHoursRow();
  preventMapDragOn(sunTimebarEl);
  preventMapDragOn(sunDateDockEl);

  sunState.dateISO = todayISO();
  sunState.minutes = nowMinutes();

  sunDateEl.value = sunState.dateISO;
  sunRangeEl.value = String(sunState.minutes);

  sunRangeEl.addEventListener("input", () => {
    sunState.minutes = parseInt(sunRangeEl.value, 10);
    updateSunOverlay();
  });

  sunDateEl.addEventListener("change", () => {
    sunState.dateISO = sunDateEl.value || todayISO();
    updateSunOverlay();
  });

  sunNowBtn.addEventListener("click", () => {
    sunState.dateISO = todayISO();
    sunState.minutes = nowMinutes();
    sunDateEl.value = sunState.dateISO;
    sunRangeEl.value = String(sunState.minutes);
    updateSunOverlay();
  });

  const SunControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const btn = L.DomUtil.create("div", "qBtn", container);
      btn.id = "sunBtn";
      btn.title = "Sol";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path><path d="M12 20v2"></path>
          <path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path>
          <path d="M2 12h2"></path><path d="M20 12h2"></path>
          <path d="M4.93 19.07l1.41-1.41"></path><path d="M17.66 6.34l1.41-1.41"></path>
        </svg>
      `;

      function setBtnEnabled() {
        const ok = map.getZoom() >= ZOOM_SOL_MIN;
        btn.classList.toggle("disabled", !ok);
        btn.title = ok ? "Sol" : `Acércate para activar (zoom ${ZOOM_SOL_MIN}+)`;
        if (!ok && sunEnabled) {
          btn.classList.remove("active");
          setSunEnabled(false);
        } else {
          updateSunOverlay();
        }
      }

      function forceOff(){
        if (sunEnabled) {
          sunEnabled = false;
          btn.classList.remove("active");
          updateSunOverlay();
        }
      }

      btn.addEventListener("click", () => {
        const ok = map.getZoom() >= ZOOM_SOL_MIN;
        if (!ok) return;

        if (BHMap.areas && BHMap.areas.isDrawing && BHMap.areas.isDrawing()) {
          if (BHMap.areas.cancelDrawing) BHMap.areas.cancelDrawing();
        }

        const next = !sunEnabled;
        btn.classList.toggle("active", next);
        setSunEnabled(next);
      });

      map.on("zoomend", setBtnEnabled);
      setBtnEnabled();

      BHMap.sun = BHMap.sun || {};
      BHMap.sun.forceOff = forceOff;

      return container;
    }
  });

  map.addControl(new SunControl());

  map.on("moveend", () => { if (sunEnabled) updateSunOverlay(); });
  map.on("zoomend", () => { if (sunEnabled) updateSunOverlay(); });
  window.addEventListener("resize", () => { if (sunEnabled) updateSunOverlay(); });

  BHMap.sun = BHMap.sun || {};
  BHMap.sun.isEnabled = () => !!sunEnabled;
})();
