/* Homyo · Búsqueda de referencia catastral en tiempo real (Sede Electrónica del Catastro, servicios OVC públicos) */
(function () {
  var B = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/";
  // Referencias ya publicadas en Homyo (en producción: consulta a nuestra base de datos)
  var PUBLISHED = { "1854602VK4715S0008HT": "Calle Serrano 95", "0857803VK4705F0001XB": "Calle Sagasta 20" };
  function dupHtml() { return '<div class="callout dangerc" style="margin-top:14px"><span class="cIc">' + IW + '</span><div><h4>Esta vivienda ya está publicada en Homyo</h4><p>Otro profesional tiene un anuncio activo con esta referencia. No se puede crear un duplicado.</p></div><a class="btn ghost sm cAct" href="pro-soporte.html">Reclamar vivienda</a></div>'; }
  var TV = { CL:"Calle", AV:"Avenida", PZ:"Plaza", PS:"Paseo", CR:"Carretera", CM:"Camino", RD:"Ronda", TR:"Travesía", GL:"Glorieta", UR:"Urbanización", BO:"Barrio", PJ:"Pasaje", CJ:"Callejón", PG:"Polígono", CU:"Cuesta", AL:"Alameda", BL:"Bulevar", LG:"Lugar", PQ:"Parque", SD:"Senda", RB:"Rambla", VR:"Vereda", CA:"Cañada", PT:"Partida", DS:"Diseminado", CO:"Colonia", AR:"Arroyo", PR:"Prolongación", RU:"Rúa", ES:"Escalinata" };
  var PT = { EN:"Entreplanta", AT:"Ático", SM:"Semisótano", BJ:"Bajo", PR:"Principal", SS:"Sótano", OD:"", "+1":"" };
  var PU = { DR:"Dcha.", IZ:"Izda.", CT:"Centro", DE:"Dcha.", IQ:"Izda." };
  var ICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>';
  var IW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 9v4"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>';

  function $(id) { return document.getElementById(id); }
  function arr(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]; }); }
  function up(s) { return String(s || "").toUpperCase().replace(/Ñ/g, "\u0001").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0001/g, "Ñ").trim(); }
  var LOW = { DE:1, DEL:1, LA:1, LAS:1, LOS:1, EL:1, Y:1, I:1, A:1, EN:1, D:1, L:1 };
  function tc(s) { return String(s || "").toLowerCase().split(/(\s+|-|\/|\(|\))/).map(function (w, i) { return (i && LOW[w.toUpperCase()]) ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(""); }
  function qs(o) { return Object.keys(o).map(function (k) { return k + "=" + encodeURIComponent(o[k] == null ? "" : o[k]); }).join("&"); }
  function api(m, o) {
    return fetch(B + m + "?" + qs(o || {})).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { return j[Object.keys(j)[0]] || {}; });
  }
  function errs(r) { return arr(r.lerr).map(function (e) { e = e.err || e; return { cod: String(e.cod), des: e.des }; }); }
  function rc20(rc) { return (rc.pc1 || "") + (rc.pc2 || "") + (rc.car || "") + (rc.cc1 || "") + (rc.cc2 || ""); }
  function fmtRc(s) { return s.length === 20 ? s.slice(0, 7) + " " + s.slice(7, 14) + " " + s.slice(14, 18) + " " + s.slice(18) : s; }
  function tvName(tv) { return TV[tv] || tc(tv || ""); }
  function ptLabel(p) {
    if (p == null || p === "") return "";
    if (/^-?\d+$/.test(p)) { var n = parseInt(p, 10); return n < 0 ? "Sótano " + (-n) : n === 0 ? "Bajo" : "Planta " + n; }
    return PT[p] != null ? PT[p] : "Planta " + p;
  }
  function puLabel(p) {
    p = String(p == null ? "" : p).trim().replace(/^0+(?=.)/, "");
    if (!p || p === "0") return "";
    if (PU[p]) return PU[p];
    return /^[0-9A-Z]{1,3}$/.test(p) ? "Pta. " + p : "";
  }
  function puRaw(p) { p = String(p == null ? "" : p).trim().replace(/^0+(?=.)/, ""); return (!p || p === "0") ? "" : (PU[p] || p); }
  function ptShort(p) {
    if (p == null || p === "") return "";
    if (/^-?\d+$/.test(p)) { var n = parseInt(p, 10); return n < 0 ? "Sótano " + (-n) : n === 0 ? "Bajo" : n + "º"; }
    return PT[p] || "";
  }
  function locOf(dt) {
    var lous = dt && dt.locs && dt.locs.lous;
    var u = lous && lous.lourb;
    if (u) {
      var d = u.dir || {}, li = u.loint || {};
      var num = d.pnp ? String(parseInt(d.pnp, 10)) + (d.plp ? d.plp : "") : "";
      var parts = [];
      if (li.bq) parts.push("Bloque " + li.bq);
      if (li.es && li.es !== "T" && li.es !== "1") parts.push("Esc. " + li.es);
      var pt = ptLabel(li.pt), pu = puLabel(li.pu);
      if (pt) parts.push(pt);
      if (pu) parts.push(pu);
      return { street: (tvName(d.tv) + " " + tc(d.nv) + (num ? " " + num : "")).trim(), unit: parts.join(" · "), unitShort: [ptShort(li.pt), puRaw(li.pu)].filter(Boolean).join(" ") , pt: li.pt, cp: u.dp || "", mun: tc(dt.nm || ""), prov: tc(dt.np || "") };
    }
    var r = dt && dt.locs && dt.locs.lors && dt.locs.lors.lorus;
    if (r) {
      var cpp = r.cpp || {};
      return { street: (cpp.cpo ? "Polígono " + cpp.cpo + ", parcela " + cpp.cpa : "") + (r.npa ? " · " + tc(r.npa) : ""), unit: "", unitShort: "", cp: "", mun: tc(dt.nm || ""), prov: tc(dt.np || "") };
    }
    return { street: "", unit: "", unitShort: "", cp: "", mun: tc((dt && dt.nm) || ""), prov: tc((dt && dt.np) || "") };
  }
  function ptSort(p) { if (/^-?\d+$/.test(p || "")) return parseInt(p, 10); return ({ SM:-0.5, BJ:0, EN:0.5, PR:0.7, AT:99 })[p] != null ? ({ SM:-0.5, BJ:0, EN:0.5, PR:0.7, AT:99 })[p] : 50; }

  /* ---------- autocomplete ---------- */
  function suggest(input, fetcher, onPick) {
    var box = document.createElement("div"); box.className = "ctSug hide"; input.parentNode.appendChild(box);
    var t, items = [], idx = -1, seq = 0;
    function close() { box.classList.add("hide"); idx = -1; }
    function render() {
      if (!items.length) { close(); return; }
      box.innerHTML = items.map(function (it, i) { return '<button type="button" data-i="' + i + '" class="' + (i === idx ? "on" : "") + '">' + esc(it.label) + (it.sub ? '<span>' + esc(it.sub) + '</span>' : "") + '</button>'; }).join("");
      box.classList.remove("hide");
    }
    function pick(i) { var it = items[i]; if (!it) return; input.value = it.label; close(); onPick(it); }
    input.addEventListener("input", function () {
      onPick(null, true);
      clearTimeout(t);
      var v = input.value, my = ++seq;
      t = setTimeout(function () {
        var p = fetcher(v);
        if (!p) { items = []; render(); return; }
        box.innerHTML = '<div class="ctSugInfo">Buscando en Catastro…</div>'; box.classList.remove("hide");
        p.then(function (res) { if (my !== seq) return; items = res; idx = res.length ? 0 : -1; if (!res.length) { box.innerHTML = '<div class="ctSugInfo">Sin coincidencias</div>'; box.classList.remove("hide"); } else render(); })
         .catch(function () { if (my !== seq) return; box.innerHTML = '<div class="ctSugInfo">No se pudo conectar con el Catastro</div>'; box.classList.remove("hide"); });
      }, 260);
    });
    input.addEventListener("keydown", function (e) {
      if (box.classList.contains("hide")) return;
      if (e.key === "ArrowDown") { idx = Math.min(items.length - 1, idx + 1); render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(0, idx - 1); render(); e.preventDefault(); }
      else if (e.key === "Enter") { if (idx > -1) { pick(idx); e.preventDefault(); } }
      else if (e.key === "Escape") close();
    });
    box.addEventListener("mousedown", function (e) { var b = e.target.closest("button"); if (b) { e.preventDefault(); pick(+b.getAttribute("data-i")); } });
    input.addEventListener("blur", function () { setTimeout(close, 120); });
  }

  /* ---------- state + UI ---------- */
  var S = { prov: "", mun: "", via: null, units: null, ctx: "" };
  function msg(kind, html) {
    var m = $("ctMsg");
    if (!kind) { m.className = "hide"; m.innerHTML = ""; return; }
    m.className = "ctMsg " + kind; m.innerHTML = html;
  }
  function busy(btn, on, label) {
    if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="ctSpin"></span>' + (label || "Consultando…"); }
    else { btn.disabled = false; if (btn.dataset.l) btn.innerHTML = btn.dataset.l; }
  }
  function refreshGo() {
    $("ctVia").disabled = !S.mun;
    $("ctNum").disabled = !S.via;
    $("ctGo").disabled = !(S.mun && S.via && $("ctNum").value.trim());
  }

  function loadProvinces() {
    var sel = $("ctProv");
    api("ObtenerProvincias").then(function (r) {
      var list = arr(r.provinciero && r.provinciero.prov);
      sel.innerHTML = '<option value="">Selecciona…</option>' + list.map(function (p) { return '<option value="' + esc(p.np) + '">' + esc(tc(p.np)) + '</option>'; }).join("");
      sel.value = "MADRID"; S.prov = sel.value;
    }).catch(function () {
      sel.innerHTML = '<option value="">No disponible</option>';
      msg("warn", "No hemos podido conectar con el Catastro. Puedes introducir la referencia a mano en «Ya la tengo».");
    });
    sel.addEventListener("change", function () { S.prov = sel.value; S.mun = ""; S.via = null; $("ctMun").value = ""; $("ctVia").value = ""; clearOut(); refreshGo(); });
  }

  function stripType(v) { return up(v).replace(/^(C\/|CALLE|C\.|AVDA\.?|AVENIDA|AV\.?|PLAZA|PZA\.?|PASEO|PS\.?|CARRETERA|CTRA\.?|CAMINO|RONDA|TRAVESIA|GLORIETA|PASAJE)\s+/, "").replace(/^(DE|DEL|DE LA|DE LOS|DE LAS)\s+/, ""); }

  function clearOut() { S.units = null; $("ctOut").innerHTML = ""; msg(); }

  function search() {
    var num = $("ctNum").value.trim().replace(/\D/g, "");
    if (!num) return;
    var btn = $("ctGo"); busy(btn, true, "Consultando Catastro…"); clearOut();
    S.ctx = S.via.label + " " + num;
    api("Consulta_DNPLOC", { Provincia: S.prov, Municipio: S.mun, Sigla: S.via.tv, Calle: S.via.nv, Numero: num, Bloque: "", Escalera: "", Planta: "", Puerta: "" })
      .then(function (r) { busy(btn, false); handle(r, num); })
      .catch(function () { busy(btn, false); netErr(); });
  }
  function netErr() { msg("warn", "No hemos podido conectar con la Sede del Catastro. Inténtalo de nuevo en unos segundos o introduce la referencia a mano en «Ya la tengo»."); }

  function handle(r, num) {
    var e = errs(r);
    if (e.length) {
      var d = e[0].des ? e[0].des.charAt(0) + e[0].des.slice(1).toLowerCase() : "No hay resultados";
      msg("warn", "<strong>" + esc(d) + ".</strong> Revisa los datos o introduce la referencia a mano.");
      if (e[0].cod === "43" && S.via) nearby(num);
      return;
    }
    if (r.bico && r.bico.bi) { showFound(r.bico.bi, false); return; }
    var list = arr(r.lrcdnp && r.lrcdnp.rcdnp);
    if (list.length === 1) { pickUnit(list[0], false); return; }
    if (list.length) { S.units = list; showUnits(); return; }
    msg("warn", "El Catastro no ha devuelto ningún inmueble para esta dirección.");
  }

  function nearby(num) {
    api("ObtenerNumerero", { Provincia: S.prov, Municipio: S.mun, TipoVia: S.via.tv, NomVia: S.via.nv, Numero: num }).then(function (r) {
      var ns = arr(r.numerero && r.numerero.nump).map(function (n) { return n.num && n.num.pnp; }).filter(Boolean);
      ns = ns.filter(function (n, i) { return ns.indexOf(n) === i; }).slice(0, 8);
      if (!ns.length) return;
      $("ctMsg").insertAdjacentHTML("beforeend", '<div class="ctNear"><span>Números que sí existen:</span>' + ns.map(function (n) { return '<button type="button" data-n="' + esc(n) + '">' + esc(parseInt(n, 10)) + '</button>'; }).join("") + '</div>');
      $("ctMsg").querySelectorAll("[data-n]").forEach(function (b) { b.onclick = function () { $("ctNum").value = parseInt(b.getAttribute("data-n"), 10); refreshGo(); search(); }; });
    }).catch(function () {});
  }

  function showUnits() {
    var list = S.units.slice();
    var hasRes = list.some(function (u) { return u.debi && /resid/i.test(u.debi.luso); });
    var onlyRes = hasRes && list.some(function (u) { return !(u.debi && /resid/i.test(u.debi.luso)); });
    list.sort(function (a, b) {
      var ra = a.debi && /resid/i.test(a.debi.luso) ? 0 : 1, rb = b.debi && /resid/i.test(b.debi.luso) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      var la = (a.dt.locs.lous.lourb || {}).loint || {}, lb = (b.dt.locs.lous.lourb || {}).loint || {};
      return (ptSort(la.pt) - ptSort(lb.pt)) || puRaw(la.pu).localeCompare(puRaw(lb.pu), "es", { numeric: true });
    });
    var out = $("ctOut");
    out.innerHTML = '<div class="ctUnits"><div class="ctUHead"><div><strong>' + list.length + ' inmuebles</strong> en ' + esc(S.ctx) + '<span class="ctUSub">Elige el que vas a anunciar</span></div><div class="ctUTools">' +
      (onlyRes ? '<label class="ctOnly"><input type="checkbox" id="ctOnlyRes" checked /> Solo viviendas</label>' : "") +
      (list.length > 6 ? '<input class="input ctFilter" id="ctFilter" placeholder="Filtrar: planta, puerta…" />' : "") +
      '</div></div><div class="ctURows" id="ctURows"></div></div>';
    function draw() {
      var f = $("ctFilter") ? up($("ctFilter").value) : "", or = $("ctOnlyRes") && $("ctOnlyRes").checked;
      var rows = list.filter(function (u) {
        var res = u.debi && /resid/i.test(u.debi.luso);
        if (or && !res) return false;
        if (!f) return true;
        return up(locOf(u.dt).unit + " " + (u.debi && u.debi.luso)).indexOf(f) > -1 || up(locOf(u.dt).unitShort).indexOf(f) > -1;
      });
      $("ctURows").innerHTML = rows.length ? rows.map(function (u) {
        var l = locOf(u.dt), d = u.debi || {}, res = /resid/i.test(d.luso || "");
        return '<button type="button" class="ctURow" data-rc="' + rc20(u.rc) + '"><span class="ctUName">' + esc(l.unit || "Inmueble completo") + '</span><span class="ctUUse">' + (res ? esc(d.luso) : '<span class="pill neutral">' + esc(d.luso || "—") + '</span>') + '</span><span class="ctUSfc">' + (d.sfc ? esc(d.sfc) + ' m²' : "") + '</span><span class="ctUGo">Elegir</span></button>';
      }).join("") : '<div class="ctUEmpty">Ningún inmueble coincide con el filtro.</div>';
      $("ctURows").querySelectorAll(".ctURow").forEach(function (b) {
        b.onclick = function () { var rc = b.getAttribute("data-rc"); var u = list.filter(function (x) { return rc20(x.rc) === rc; })[0]; pickUnit(u, true, b); };
      });
    }
    if ($("ctFilter")) $("ctFilter").addEventListener("input", draw);
    if ($("ctOnlyRes")) $("ctOnlyRes").addEventListener("change", draw);
    draw();
  }

  function pickUnit(u, fromList, rowBtn) {
    var rc = rc20(u.rc);
    if (rowBtn) { rowBtn.classList.add("loading"); rowBtn.querySelector(".ctUGo").innerHTML = '<span class="ctSpin"></span>'; }
    api("Consulta_DNPRC", { Provincia: "", Municipio: "", RefCat: rc }).then(function (r) {
      if (r.bico && r.bico.bi) showFound(r.bico.bi, fromList); else showFound({ idbi: { rc: u.rc }, dt: u.dt, debi: u.debi }, fromList);
    }).catch(function () { showFound({ idbi: { rc: u.rc }, dt: u.dt, debi: u.debi }, fromList); });
  }

  function showFound(bi, fromList) {
    msg();
    var rc = rc20(bi.idbi.rc), l = locOf(bi.dt), d = bi.debi || {};
    var dup = PUBLISHED[rc];
    var addr = l.street + (l.unit ? ", " + l.unit : "");
    var place = [l.cp, l.mun].filter(Boolean).join(" ") + (l.prov && l.prov !== l.mun ? " (" + l.prov + ")" : "");
    var facts = [d.luso ? "Uso " + d.luso.toLowerCase() : "", d.sfc ? d.sfc + " m² construidos" : "", d.ant ? "Construido en " + d.ant : ""].filter(Boolean);
    $("ctOut").innerHTML = '<div class="ctFound' + (dup ? " dup" : "") + '">' +
      '<div class="ctFTop"><span class="ctFKick">' + (dup ? "Referencia encontrada" : ICK + " Referencia encontrada en Catastro") + '</span>' + (fromList ? '<button type="button" class="ctLink" id="ctBack">Elegir otra</button>' : "") + '</div>' +
      '<div class="ctRc">' + esc(fmtRc(rc)) + '</div>' +
      '<div class="ctAddr">' + esc(addr) + (place ? '<span>' + esc(place) + '</span>' : "") + '</div>' +
      (facts.length ? '<div class="ctFacts">' + facts.map(function (f) { return '<span class="pill neutral">' + esc(f) + '</span>'; }).join("") + '</div>' : "") +
      (dup ? dupHtml()
           : '<div class="ctFAct"><button type="button" class="btn primary" id="ctUse">Usar esta referencia</button><span class="ctFNote">Rellenaremos la dirección, el barrio, la planta y el año de construcción.</span></div>') +
      '</div>';
    if ($("ctBack")) $("ctBack").onclick = showUnits;
    if ($("ctUse")) $("ctUse").onclick = function () { apply(rc, l, d, true); };
  }

  function flash(el, v) { if (!el || v == null || v === "") return; el.value = v; el.classList.remove("ctFilled"); void el.offsetWidth; el.classList.add("ctFilled"); }

  function zone(rc) {
    var f = $("f-barrio"), box = $("barrioOpts"); if (!f) return;
    f.placeholder = "Buscando barrio…"; if (box) box.innerHTML = "";
    var C = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json/Consulta_CPMRC?" + qs({ Provincia: "", Municipio: "", SRS: "EPSG:4326", RefCat: rc.slice(0, 14) });
    fetch(C).then(function (r) { return r.json(); }).then(function (j) {
      var c = arr(j.Consulta_CPMRCResult && j.Consulta_CPMRCResult.coordenadas && j.Consulta_CPMRCResult.coordenadas.coord)[0];
      if (!c || !c.geo) throw 0;
      return fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=es&lat=" + c.geo.ycen + "&lon=" + c.geo.xcen).then(function (r) { return r.json(); });
    }).then(function (g) {
      var a = (g && g.address) || {};
      var opts = [a.quarter, a.neighbourhood, a.suburb, a.city_district, a.village, a.hamlet, a.town].filter(function (x, i, s) { return x && s.indexOf(x) === i; });
      f.placeholder = "Chamberí";
      if (!opts.length) return;
      if (!f.value) flash(f, opts[0]);
      if (box && opts.length > 1) {
        box.innerHTML = '<span>También:</span>' + opts.map(function (o) { return '<button type="button" class="' + (o === f.value ? "isOn" : "") + '">' + esc(o) + '</button>'; }).join("");
        box.querySelectorAll("button").forEach(function (b) { b.onclick = function () { flash(f, b.textContent); box.querySelectorAll("button").forEach(function (x) { x.classList.toggle("isOn", x === b); }); }; });
      }
    }).catch(function () { f.placeholder = "Chamberí"; });
  }

  function apply(rc, l, d, verified) {
    if (PUBLISHED[rc]) { msg(); $("ctOut").innerHTML = '<div class="ctFound dup"><div class="ctRc">' + esc(fmtRc(rc)) + '</div>' + dupHtml() + '</div>'; return; }
    if (l) {
      flash($("f-dir"), l.street + (l.unitShort ? ", " + l.unitShort : ""));
      flash($("f-mun"), l.mun);
      if (d && d.ant) flash($("f-anio"), d.ant);
      if (l.pt != null && /^-?\d+$/.test(l.pt)) { var n = parseInt(l.pt, 10); flash($("f-planta"), n === 0 ? "Bajo" : n < 0 ? "Sótano " + (-n) : n + "ª"); }
      else if (l.pt && PT[l.pt]) flash($("f-planta"), PT[l.pt]);
      if (d && d.sfc && $("f-built")) flash($("f-built"), d.sfc);
      var h = $("sfcCat");
      if (h && d && d.sfc) { h.innerHTML = "Catastro indica <strong>" + esc(d.sfc) + " m² construidos</strong> (incluyen muros y zonas comunes). La útil suele ser un 15–25 % menor."; h.classList.remove("hide"); }
    }
    var ck = $("ckRc"); if (ck) ck.textContent = rc + (verified ? " · verificada en Catastro · sin duplicados" : " · pendiente de revisión manual");
    window.HOMYO_RC = { rc: rc, verified: verified };
    if (verified) { var fb = $("f-barrio"); if (fb) fb.value = ""; zone(rc); }
    $("ctFinder").classList.add("hide"); $("ctManual").classList.add("hide"); $("ctMode").classList.add("hide"); $("ctFoot").classList.add("hide");
    $("ctOut").innerHTML = ""; msg();
    var lk = $("ctLocked"); lk.classList.remove("hide");
    lk.innerHTML = '<div class="ctLock"><div><div class="ctRc sm">' + esc(fmtRc(rc)) + '</div>' + (l && l.street ? '<div class="ctLockAddr">' + esc(l.street + (l.unit ? ", " + l.unit : "")) + '</div>' : "") + '</div>' +
      (verified ? '<span class="pill ok">' + ICK + ' Verificada en Catastro</span>' : '<span class="pill warnp">Revisión manual</span>') +
      '<button type="button" class="ctLink" id="ctChange">Cambiar</button></div>';
    $("ctChange").onclick = function () { lk.classList.add("hide"); $("ctMode").classList.remove("hide"); $("ctFoot").classList.remove("hide"); setMode(S.mode || "dir"); window.HOMYO_RC = null; };
  }

  function validateManual() {
    var raw = up($("catastral").value).replace(/[\s.\-]/g, "");
    $("catastral").value = raw;
    if (!/^[0-9A-Z]{14}$|^[0-9A-Z]{20}$/.test(raw)) { msg("warn", "La referencia catastral tiene <strong>20 caracteres</strong> (o 14 si es la de la finca completa). Revisa que esté completa."); return; }
    clearOut();
    if (raw.length === 20 && PUBLISHED[raw]) { $("ctOut").innerHTML = '<div class="ctFound dup"><div class="ctRc">' + esc(fmtRc(raw)) + '</div><div class="ctAddr">' + esc(PUBLISHED[raw]) + '</div>' + dupHtml() + '</div>'; return; }
    var btn = $("valBtn"); busy(btn, true, "Validando…");
    S.ctx = "la finca " + raw.slice(0, 14);
    api("Consulta_DNPRC", { Provincia: "", Municipio: "", RefCat: raw }).then(function (r) {
      busy(btn, false);
      var e = errs(r);
      if (e.length) {
        msg("warn", "<strong>No aparece en el Catastro estatal.</strong> Si la vivienda está en País Vasco o Navarra es normal (catastro foral): la revisará el equipo de Homyo antes de publicar." + '<div class="ctNear"><button type="button" id="ctManualOk">Continuar sin verificar</button></div>');
        $("ctManualOk").onclick = function () { apply(raw, null, null, false); };
        return;
      }
      if (r.bico && r.bico.bi) { showFound(r.bico.bi, false); return; }
      var list = arr(r.lrcdnp && r.lrcdnp.rcdnp);
      if (list.length) { S.units = list; showUnits(); }
    }).catch(function () { busy(btn, false); netErr(); });
  }

  function setMode(m) {
    S.mode = m;
    $("ctMode").querySelectorAll("button").forEach(function (b) { b.classList.toggle("isOn", b.getAttribute("data-m") === m); });
    $("ctFinder").classList.toggle("hide", m !== "dir");
    $("ctManual").classList.toggle("hide", m !== "rc");
    clearOut();
  }

  function init() {
    if (!$("ctFinder")) return;
    loadProvinces();
    $("ctMode").querySelectorAll("button").forEach(function (b) { b.onclick = function () { setMode(b.getAttribute("data-m")); }; });
    suggest($("ctMun"), function (v) {
      if (!S.prov || up(v).length < 2) return null;
      return api("ObtenerMunicipios", { Provincia: S.prov, Municipio: up(v) }).then(function (r) {
        var q = up(v);
        var list = arr(r.municipiero && r.municipiero.muni).map(function (m) { return { label: tc(m.nm), value: m.nm }; });
        function rank(x) { return x.value === q ? 0 : x.value.indexOf(q) === 0 ? 1 : 2; }
        list.sort(function (a, b) { return (rank(a) - rank(b)) || a.value.length - b.value.length || a.value.localeCompare(b.value); });
        return list.slice(0, 12);
      });
    }, function (it, typing) {
      if (typing) { S.mun = ""; S.via = null; $("ctVia").value = ""; refreshGo(); return; }
      S.mun = it.value; refreshGo(); $("ctVia").focus();
    });
    suggest($("ctVia"), function (v) {
      var q = stripType(v);
      if (!S.mun || q.length < 3) return null;
      return api("ObtenerCallejero", { Provincia: S.prov, Municipio: S.mun, TipoVia: "", NomVia: q }).then(function (r) {
        var list = arr(r.callejero && r.callejero.calle).map(function (c) { return { label: tvName(c.dir.tv) + " " + tc(c.dir.nv), tv: c.dir.tv, nv: c.dir.nv }; });
        list.sort(function (a, b) { var as = a.nv.indexOf(q) === 0 ? 0 : 1, bs = b.nv.indexOf(q) === 0 ? 0 : 1; return (as - bs) || a.nv.length - b.nv.length; });
        return list.slice(0, 12);
      });
    }, function (it, typing) {
      if (typing) { S.via = null; refreshGo(); return; }
      S.via = it; refreshGo(); $("ctNum").focus();
    });
    $("ctNum").addEventListener("input", refreshGo);
    $("ctNum").addEventListener("keydown", function (e) { if (e.key === "Enter" && !$("ctGo").disabled) search(); });
    $("ctGo").onclick = search;
    $("valBtn").onclick = validateManual;
    $("catastral").addEventListener("keydown", function (e) { if (e.key === "Enter") validateManual(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
