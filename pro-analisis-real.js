/* HOMYO · Análisis de Pro con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function n(x) { return Number(x || 0).toLocaleString("es-ES"); }
  function big(x) { return x >= 10000 ? (x / 1000).toFixed(1).replace(".", ",") + '<span class="u">K</span>' : n(x); }
  function pct(x) { return (x * 100).toFixed(1).replace(".", ",") + " %"; }
  function svg(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + p + '</svg>'; }
  var UP = '<path d="m6 14 6-6 6 6"/>', DOWN = '<path d="m6 10 6 6 6-6"/>', FLAT = '<path d="M5 12h14"/>';
  var OP_LABEL = { venta: "Venta", alquiler: "Alquiler", habitacion: "Habitación" };
  var MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  var RANGES = [30, 90, 365], range = 30, op = "all", L = [], DAILY = [];
  var isC = function (t) { return t === "click_reveal_phone" || t === "click_email"; };

  function foot(el, cur, prev, txt) {
    var p = prev ? Math.round((cur - prev) / prev * 100) : null, cls = p == null || p === 0 ? "flat" : p > 0 ? "up" : "down";
    el.className = "kpiFoot " + cls;
    el.innerHTML = svg(cls === "up" ? UP : cls === "down" ? DOWN : FLAT) + "<span>" + (p == null ? txt : (p > 0 ? "+" : "") + p + " % vs. periodo anterior") + "</span>";
  }

  function render() {
    var cut = Date.now() - range * 864e5, cutPrev = Date.now() - range * 2 * 864e5;
    var inOp = function (d) { return op === "all" || d.op === op; };
    var LS = L.filter(inOp), ids = {}; LS.forEach(function (d) { ids[d.id] = d; });
    var per = {}, tot = { v: 0, c: 0, vp: 0, cp: 0 };
    DAILY.forEach(function (r) {
      if (!ids[r.listing_id]) return;
      var t = new Date(r.day).getTime(), e = Number(r.events) || 0, k = per[r.listing_id] || (per[r.listing_id] = { v: 0, c: 0 });
      if (r.event_type === "view_detail") { if (t >= cut) { tot.v += e; k.v += e; } else if (t >= cutPrev) tot.vp += e; }
      else if (isC(r.event_type)) { if (t >= cut) { tot.c += e; k.c += e; } else if (t >= cutPrev) tot.cp += e; }
    });
    var live = LS.filter(function (d) { return d.st === "pub" || d.st === "upd"; });
    var has = live.length > 0 || tot.v > 0;
    $("#viewData").classList.toggle("hide", !has);
    $("#viewNone").classList.toggle("hide", has);
    if (!has) return;

    var K = $$(".kpi");
    $('[data-kpi="views"]').innerHTML = big(tot.v); foot($(".kpiFoot", K[0]), tot.v, tot.vp, "Fichas vistas");
    $('[data-kpi="contacts"]').innerHTML = big(tot.c); foot($(".kpiFoot", K[1]), tot.c, tot.cp, "Teléfono mostrado y emails");
    var rate = tot.v ? tot.c / tot.v : 0, rateP = tot.vp ? tot.cp / tot.vp : 0;
    $('[data-kpi="rate"]').innerHTML = tot.v ? (rate * 100).toFixed(1).replace(".", ",") + '<span class="u">%</span>' : "—";
    var fr = $(".kpiFoot", K[2]); fr.className = "kpiFoot flat"; fr.innerHTML = svg(FLAT) + "<span>" + (tot.vp ? "Antes: " + pct(rateP) : "Contactos / visualizaciones") + "</span>";
    var perv = live.length ? Math.round(tot.v / live.length) : 0, pervP = live.length ? Math.round(tot.vp / live.length) : 0;
    $('[data-kpi="perv"]').innerHTML = n(perv); foot($(".kpiFoot", K[3]), perv, pervP, live.length + (live.length === 1 ? " vivienda activa" : " viviendas activas"));

    // Evolución
    var B = [], now = new Date();
    if (range === 365) for (var m = 11; m >= 0; m--) { var a = new Date(now.getFullYear(), now.getMonth() - m, 1), b = new Date(now.getFullYear(), now.getMonth() - m + 1, 1); B.push({ l: MES[a.getMonth()], a: +a, b: +b, v: 0, c: 0 }); }
    else { var w = Math.ceil(range / 7); for (var i = w - 1; i >= 0; i--) B.push({ l: "Sem " + (w - i), a: Date.now() - (i + 1) * 7 * 864e5, b: Date.now() - i * 7 * 864e5, v: 0, c: 0 }); }
    DAILY.forEach(function (r) {
      if (!ids[r.listing_id]) return;
      var t = new Date(r.day).getTime(), e = Number(r.events) || 0;
      B.forEach(function (k) { if (t >= k.a && t < k.b) { if (r.event_type === "view_detail") k.v += e; else if (isC(r.event_type)) k.c += e; } });
    });
    var mv = Math.max.apply(null, B.map(function (k) { return k.v; }).concat([1])), mc = Math.max.apply(null, B.map(function (k) { return k.c; }).concat([1]));
    $("#barChart").innerHTML = B.map(function (k) {
      return '<div class="barCol" title="' + n(k.v) + ' visualizaciones · ' + n(k.c) + ' contactos"><div class="barStack"><div class="barViews" style="height:' + Math.max(1, k.v / mv * 100) + '%"></div><div class="barLeads" style="height:' + Math.max(1, k.c / mc * 42) + '%"></div></div><span class="barLabel">' + k.l + '</span></div>';
    }).join("");
    $(".sectionHead h2").textContent = range === 365 ? "Evolución mensual" : "Evolución semanal";

    // Rankings
    var rows = live.map(function (d) { var k = per[d.id] || { v: 0, c: 0 }; return { d: d, v: k.v, c: k.c, r: k.v ? k.c / k.v : 0 }; });
    var avg = rows.reduce(function (s, x) { return s + x.v; }, 0) ? rows.reduce(function (s, x) { return s + x.c; }, 0) / rows.reduce(function (s, x) { return s + x.v; }, 0) : 0;
    var top = rows.slice().sort(function (a, b) { return b.v - a.v; }).slice(0, 4), maxV = top.length ? Math.max(1, top[0].v) : 1;
    function name(d) { var p = d.addr.split(" · "); return esc(d.addr) + (d.zone && d.zone !== "—" ? ' <span class="z">· ' + esc(d.zone) + '</span>' : ''); }
    var lists = $$(".rankList");
    lists[0].innerHTML = top.length ? top.map(function (x) { return '<li class="rankItem"><div class="rankTop"><span class="rankName">' + name(x.d) + '</span><span class="rankVal">' + n(x.v) + ' vis.</span></div><div class="rankTrack"><span style="width:' + Math.round(x.v / maxV * 100) + '%"></span></div><div class="miniMeta">' + n(x.c) + (x.c === 1 ? " contacto" : " contactos") + ' · tasa ' + pct(x.r) + '</div></li>'; }).join("") : '<li class="muted" style="font-size:13px">Sin visitas en este periodo.</li>';
    var old = rows.filter(function (x) { var l = x.d.raw.listed_at; return l && Date.now() - new Date(l).getTime() > 14 * 864e5; });
    var low = old.filter(function (x) { return x.v < (top[0] ? top[0].v * 0.35 : 1) || !x.c; }).sort(function (a, b) { return a.v - b.v; }).slice(0, 3);
    lists[1].innerHTML = low.length ? low.map(function (x) {
      var why = !x.c ? "0 contactos · revisa precio y fotos" : x.d.st === "upd" ? "sin confirmar disponibilidad" : x.d.miss.length ? "faltan: " + x.d.miss.length + " datos de calidad" : "tasa " + pct(x.r);
      return '<li class="rankItem"><div class="rankTop"><span class="rankName">' + name(x.d) + '</span><span class="rankVal">' + n(x.v) + ' vis.</span></div><div class="rankTrack low"><span style="width:' + Math.max(3, Math.round(x.v / maxV * 100)) + '%"></span></div><div class="miniMeta">' + esc(why) + '</div></li>';
    }).join("") : '<li class="muted" style="font-size:13px">Ninguna vivienda con bajo rendimiento. ¡Bien!</li>';

    // Comparativa
    $(".proTable tbody").innerHTML = rows.length ? rows.sort(function (a, b) { return b.v - a.v; }).map(function (x) {
      var vs = avg ? Math.round((x.r - avg) / avg * 100) : 0, cls = !x.v ? "neutral" : vs >= 10 ? "ok" : vs <= -50 ? "dangerp" : vs <= -10 ? "warnp" : "neutral";
      return '<tr data-op="' + x.d.op + '"><td class="noLabel"><span class="opTag ' + x.d.op + '">' + OP_LABEL[x.d.op] + '</span><a class="strong" href="pro-revision-calidad.html?id=' + x.d.id + '" style="color:inherit">' + esc(x.d.addr) + '</a></td><td data-th="Visualizaciones">' + n(x.v) + '</td><td data-th="Contactos">' + n(x.c) + '</td><td data-th="Tasa">' + (x.v ? pct(x.r) : "—") + '</td><td data-th="vs media"><span class="pill ' + cls + '">' + (x.v && avg ? (vs > 0 ? "+" : "") + vs + " %" : "—") + '</span></td></tr>';
    }).join("") : '<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">No hay viviendas publicadas con este filtro.</td></tr>';

    // Alertas
    var upd = LS.filter(function (d) { return d.st === "upd"; });
    var zero = rows.filter(function (x) { var l = x.d.raw.listed_at; return !x.c && l && Date.now() - new Date(l).getTime() > 60 * 864e5; });
    var A = [];
    if (upd.length) A.push('<div class="callout warnc"><span class="cIc">' + svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 1.5"/>') + '</span><div><h4>' + (upd.length === 1 ? "1 anuncio" : upd.length + " anuncios") + ' con más de 60 días sin confirmar</h4><p>Confirma la disponibilidad para mantenerlos publicados.</p></div><a class="btn ghost sm cAct" href="pro-viviendas.html?f=upd">Revisar</a></div>');
    zero.slice(0, 3).forEach(function (x) { A.push('<div class="callout warnc"><span class="cIc">' + svg('<path d="M12 9v4"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>') + '</span><div><h4>' + esc(x.d.addr) + ' no recibe contactos</h4><p>Lleva más de 60 días publicada sin contactos en este periodo. Revisa precio, fotos y descripción.</p></div><a class="btn ghost sm cAct" href="pro-revision-calidad.html?id=' + x.d.id + '">Ver anuncio</a></div>'); });
    var heads = $$(".sectionHead"), alertHead = heads[heads.length - 1];
    alertHead.classList.toggle("hide", !A.length);
    alertHead.nextElementSibling.innerHTML = A.join("");
    var cr = $(".tbCrumb"); if (cr && H.ctx) cr.innerHTML = '<span data-hm-agency>' + esc(H.ctx.agency.name || "") + '</span> · ' + (range === 365 ? "Último año" : "Últimos " + range + " días");
  }

  $$("#rangeSeg button").forEach(function (b, i) { b.addEventListener("click", function () { range = RANGES[i]; render(); }); });
  $$("#anOpSeg button").forEach(function (b) {
    b.addEventListener("click", function () { $$("#anOpSeg button").forEach(function (x) { x.classList.toggle("isOn", x === b); }); op = b.dataset.op; render(); });
  });
  $("#barChart").innerHTML = '<p class="muted" style="margin:auto;font-size:13px">Cargando…</p>';
  $$(".kpiValue").forEach(function (k) { k.textContent = "—"; });
  Promise.all([H.proListings(), H.proDaily(730)]).then(function (r) { L = r[0]; DAILY = r[1]; render(); })
    .catch(function (e) { window.homyoToast && homyoToast("No se han podido cargar las métricas: " + ((e && e.message) || "error")); });
})();
