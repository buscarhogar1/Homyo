/* HOMYO · Panel Pro con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function svg(p, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(n) { return n >= 10000 ? (n / 1000).toFixed(1).replace(".", ",") + '<span class="u">K</span>' : Number(n).toLocaleString("es-ES"); }
  function pct(a, b) { return b ? Math.round((a - b) / b * 100) : null; }
  var UP = '<path d="m6 14 6-6 6 6"/>', DOWN = '<path d="m6 10 6 6 6-6"/>', FLAT = '<path d="M5 12h14"/>';
  function foot(el, p, txt) {
    var cls = p == null || p === 0 ? "flat" : p > 0 ? "up" : "down";
    el.className = "kpiFoot " + cls;
    el.innerHTML = svg(cls === "up" ? UP : cls === "down" ? DOWN : FLAT, 2.2) + "<span>" + txt + "</span>";
  }

  // Ocultar lo que aún no tiene datos reales
  $("#ncCard").classList.add("hmHidden");
  $$(".heroPills .pill").forEach(function (p) { p.classList.add("hmHidden"); });
  var kpis = $$(".kpi");
  kpis.forEach(function (k) { k.querySelector(".kpiValue").textContent = "—"; k.querySelector(".kpiFoot").innerHTML = "<span>Cargando…</span>"; });
  $$(".statMini .n").forEach(function (n) { n.textContent = "—"; });
  $("#tkList").innerHTML = '<li class="task"><span></span><span></span><div class="tkBody"><p>Cargando tareas…</p></div></li>';
  $(".actList").innerHTML = '<li><span></span><div class="actBody"><p>Cargando actividad…</p></div><span></span></li>';
  $$(".perfRow").forEach(function (r) { r.querySelector(".v").textContent = "—"; r.querySelector(".track span").style.width = "0"; });

  Promise.all([H.ready, H.proListings(), H.proDaily(60)]).then(function (res) {
    var ctx = res[0], L = res[1], daily = res[2];
    var ag = ctx.agency || {}, nm = ag.name || "tu inmobiliaria";

    // Hero
    $(".heroBody h1").innerHTML = "Hola, <strong>" + esc(nm) + "</strong>";
    $(".heroLogo").textContent = nm.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
    if (ag.logo_url) $(".heroLogo").innerHTML = '<img src="' + esc(ag.logo_url) + '" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit" />';
    var city = [ag.city, ag.province].filter(Boolean).join(" · ");
    if (city) $(".heroPills").insertAdjacentHTML("beforeend", '<span class="pill neutral">' + esc(city) + '</span>');
    var last = ctx.user && ctx.user.last_sign_in_at;
    $(".heroDate").innerHTML = '<span class="big" data-date="today">' + H.fmt.date(new Date()) + '</span>' + (last ? "Última conexión: " + H.fmt.ago(last).toLowerCase() : "");

    // Inventario
    var z = function () { return { total: 0, pub: 0, draft: 0, review: 0, rej: 0, upd: 0, off: 0 }; };
    var P = window.PANEL_OP;
    ["all", "venta", "alquiler", "habitacion"].forEach(function (k) { P[k] = z(); });
    L.forEach(function (d) { [P.all, P[d.op]].forEach(function (k) { k.total++; k[d.st]++; }); });
    $$("#panelOpSeg button").forEach(function (b) { b.querySelector(".c").textContent = P[b.dataset.op].total; });
    var on = $("#panelOpSeg .isOn"); if (on) on.click();

    // KPIs (vistas y contactos de listing_events)
    var now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1), m1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var d30 = Date.now() - 30 * 864e5;
    var s = { v30: 0, vPrev: 0, cM: 0, cPrevM: 0, c30: 0 };
    var dayOfMonth = now.getDate();
    daily.forEach(function (r) {
      var t = new Date(r.day).getTime(), n = Number(r.events) || 0;
      var isView = r.event_type === "view_detail", isC = r.event_type === "click_reveal_phone" || r.event_type === "click_email";
      if (isView) { if (t >= d30) s.v30 += n; else s.vPrev += n; }
      if (isC) {
        if (t >= d30) s.c30 += n;
        if (t >= m0.getTime()) s.cM += n;
        else if (t >= m1.getTime() && new Date(r.day).getDate() <= dayOfMonth) s.cPrevM += n;
      }
    });
    var active = P.all.pub + P.all.upd;
    kpis[0].querySelector(".kpiValue").textContent = active;
    foot(kpis[0].querySelector(".kpiFoot"), null, "Publicadas en Homyo");
    kpis[1].querySelector(".kpiValue").innerHTML = num(s.cM);
    var pc = pct(s.cM, s.cPrevM);
    foot(kpis[1].querySelector(".kpiFoot"), pc, pc == null ? "Teléfono mostrado y emails" : (pc > 0 ? "+" : "") + pc + " % vs. mismo periodo del mes anterior");
    kpis[2].querySelector(".kpiValue").innerHTML = num(s.v30);
    var pv = pct(s.v30, s.vPrev);
    foot(kpis[2].querySelector(".kpiFoot"), pv, pv == null ? "Últimos 30 días" : (pv > 0 ? "+" : "") + pv + " % vs. 30 días anteriores");
    kpis[3].querySelector(".kpiValue").innerHTML = s.v30 ? (s.c30 / s.v30 * 100).toFixed(1).replace(".", ",") + '<span class="u">%</span>' : "—";
    foot(kpis[3].querySelector(".kpiFoot"), null, "Contactos / visualizaciones · 30 días");

    // Rendimiento
    var live = L.filter(function (d) { return d.st === "pub" || d.st === "upd"; });
    var std = live.filter(function (d) { return !d.miss.some(function (k) { return k !== "upd"; }); }).length;
    var rows = $$(".perfRow");
    function perf(row, label, a, b) {
      row.querySelector(".k").textContent = label;
      row.querySelector(".v").textContent = b ? a + " / " + b : "—";
      row.querySelector(".track span").style.width = (b ? Math.round(a / b * 100) : 0) + "%";
    }
    perf(rows[0], "Anuncios que cumplen estándar", std, live.length);
    rows[1].classList.add("hmHidden");
    perf(rows[2], "Anuncios actualizados < 60 días", P.all.pub, live.length);

    // Tareas reales
    var TONE = { ok: ["var(--goodSoft)", "var(--good)"], warnp: ["var(--warnSoft)", "var(--warn)"], infop: ["var(--infoSoft)", "var(--info)"], neutral: ["var(--lineSoft)", "var(--ink2)"] };
    var IC = {
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 1.5"/>',
      doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/>',
      plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
      img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'
    };
    function names(arr) { var a = arr.map(function (d) { return esc(d.addr.split(" · ").pop()); }); return a.length > 2 ? a.slice(0, 2).join(", ") + " y " + (a.length - 2) + " más" : a.join(" y "); }
    var mine = L.filter(function (d) { return H.canEdit(d.raw); });
    var upd = mine.filter(function (d) { return d.st === "upd"; });
    var drafts = mine.filter(function (d) { return d.st === "draft"; });
    var mineLive = mine.filter(function (d) { return d.st === "pub" || d.st === "upd"; });
    var noCert = mineLive.filter(function (d) { return d.miss.indexOf("cert") > -1; });
    var noPlan = mineLive.filter(function (d) { return d.miss.indexOf("plano") > -1 || d.miss.indexOf("fotos") > -1; });
    var T = [];
    if (upd.length) T.push({ id: "disp", tone: "warnp", ic: "clock", t: upd.length === 1 ? "Confirmar disponibilidad de 1 vivienda" : "Confirmar disponibilidad de " + upd.length + " viviendas", d: names(upd) + " · más de 60 días sin confirmar.", pill: ["warnp", "Se ocultan si no confirmas"], inline: upd.length === 1 ? "Confirmar" : "Confirmar las " + upd.length, alt: ["Revisar", "pro-viviendas.html?f=upd"] });
    if (noCert.length) T.push({ tone: "infop", ic: "doc", t: "Aportar certificado energético", d: names(noCert) + " · obligatorio para seguir publicada.", act: ["Ver viviendas", "pro-viviendas.html"] });
    if (noPlan.length) T.push({ tone: "neutral", ic: "img", t: "Completar fotos o plano", d: names(noPlan) + " · mejora la calidad del anuncio.", act: ["Ver viviendas", "pro-viviendas.html"] });
    if (drafts.length) T.push({ tone: "neutral", ic: "plus", t: drafts.length === 1 ? "Terminar 1 borrador" : "Terminar " + drafts.length + " borradores", d: names(drafts) + " · aún no están publicados.", act: ["Continuar", "pro-viviendas.html?f=draft"] });
    function renderTasks() {
      $("#tkList").innerHTML = T.map(function (k) {
        var c = TONE[k.tone];
        var act = k.inline ? (k.alt ? '<a class="btnLink" href="' + k.alt[1] + '">' + k.alt[0] + '</a>' : '') + '<button class="btn primary sm" type="button" data-inline="' + k.id + '">' + k.inline + '</button>' : '<a class="btn ghost sm" href="' + k.act[1] + '">' + k.act[0] + '</a>';
        return '<li class="task"><span></span>' +
          '<span class="tkIc" style="background:' + c[0] + ';color:' + c[1] + '">' + svg(IC[k.ic]) + '</span>' +
          '<div class="tkBody"><h5>' + k.t + '</h5><p>' + k.d + '</p></div>' +
          (k.pill ? '<span class="pill ' + k.pill[0] + '">' + k.pill[1] + '</span>' : '<span></span>') +
          '<div class="tkAct">' + act + '</div></li>';
      }).join("");
      $(".tkCard").classList.toggle("allDone", !T.length);
      $("#tkProgTxt").textContent = T.length ? (T.length === 1 ? "1 pendiente" : T.length + " pendientes") : "Todo al día";
      $("#tkProgFill").parentNode.classList.add("hmHidden");
    }
    renderTasks();
    $("#tkList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-inline]"); if (!b) return;
      b.disabled = true;
      Promise.all(upd.map(function (d) { return H.proConfirm(d.id); })).then(function () {
        T = T.filter(function (k) { return k.id !== "disp"; }); renderTasks();
        window.homyoToast(upd.length === 1 ? "Disponibilidad confirmada" : upd.length + " viviendas confirmadas · siguen publicadas");
      }).catch(function (err) { b.disabled = false; window.homyoToast("No se ha podido confirmar: " + (err.message || "error")); });
    });

    // Actividad reciente
    var byId = {}; L.forEach(function (d) { byId[d.id] = d; });
    var A = [];
    L.forEach(function (d) {
      var l = d.raw;
      if (l.listed_at) A.push({ t: l.listed_at, tone: "ok", ic: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', h: "Vivienda publicada", p: esc(d.addr) });
      if (l.unpublished_at) A.push({ t: l.unpublished_at, tone: "neutral", ic: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>', h: "Vivienda retirada", p: esc(d.addr) });
      if (l.availability_confirmed_at) A.push({ t: l.availability_confirmed_at, tone: "warnp", ic: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 1.5"/>', h: "Disponibilidad confirmada", p: esc(d.addr) });
    });
    return H.proRecentContacts(L.map(function (d) { return d.id; }), 6).then(function (C) {
      C.forEach(function (c) { var d = byId[c.listing_id]; A.push({ t: c.created_at, tone: "ok", ic: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', h: "Alguien ha visto tu teléfono", p: d ? esc(d.addr) : "" }); });
      A.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
      A = A.slice(0, 5);
      var tone = { ok: ["var(--goodSoft)", "var(--good)"], warnp: ["var(--warnSoft)", "var(--warn)"], neutral: ["var(--lineSoft)", "var(--ink2)"] };
      $(".actList").innerHTML = A.length ? A.map(function (a) {
        return '<li><span class="actIc" style="background:' + tone[a.tone][0] + ';color:' + tone[a.tone][1] + '">' + svg(a.ic) + '</span>' +
          '<div class="actBody"><h5>' + a.h + '</h5><p>' + a.p + '</p></div><span class="actWhen">' + H.fmt.ago(a.t) + '</span></li>';
      }).join("") : '<li style="display:block"><p class="muted" style="margin:0;font-size:13px">Aún no hay actividad. Cuando publiques viviendas y recibas contactos aparecerán aquí.</p></li>';
    });
  }).catch(function (e) {
    window.homyoToast && window.homyoToast("No se han podido cargar tus datos: " + ((e && e.message) || "error"));
  });
})();
