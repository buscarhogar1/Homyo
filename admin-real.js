/* HOMYO · Admin con datos reales (Panel y Estadísticas). Solo modo real. */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var page = (window.ADMIN_PAGE || {}).active;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function svg(p, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  function n(x) { return Number(x || 0).toLocaleString("es-ES"); }
  function big(x) { return x >= 10000 ? (x / 1000).toFixed(1).replace(".", ",") + '<span class="u">K</span>' : n(x); }
  function pctTxt(a, b) { if (!b) return null; var p = Math.round((a - b) / b * 100); return p; }
  var UP = '<path d="m6 14 6-6 6 6"/>', DOWN = '<path d="m6 10 6 6 6-6"/>', FLAT = '<path d="M5 12h14"/>';
  function kpi(el, label, value, p, txt) {
    if (label) $(".kpiLabel", el).textContent = label;
    $(".kpiValue", el).innerHTML = value;
    var cls = p == null || p === 0 ? "flat" : p > 0 ? "up" : "down", f = $(".kpiFoot", el);
    f.className = "kpiFoot " + cls;
    f.innerHTML = svg(cls === "up" ? UP : cls === "down" ? DOWN : FLAT, 2.2) + "<span>" + txt + "</span>";
  }
  function since(days) { return Date.now() - days * 864e5; }
  function isContact(t) { return t === "click_reveal_phone" || t === "click_email"; }
  function loading() {
    $$(".kpi").forEach(function (k) { $(".kpiValue", k).textContent = "—"; $(".kpiFoot", k).innerHTML = "<span>Cargando…</span>"; });
  }
  function fail(e) { window.homyoToast && homyoToast("No se han podido cargar los datos: " + ((e && e.message) || "error")); }

  /* ================= PANEL ================= */
  if (page === "panel") {
    loading();
    $$(".statMini .n").forEach(function (x) { x.textContent = "—"; });
    $(".actList").innerHTML = '<li><span></span><div class="actBody"><p>Cargando actividad…</p></div><span></span></li>';
    $$(".adminHeroPills .pill").forEach(function (p) { p.textContent = "…"; });
    $(".adminHeroDate").lastChild.textContent = "";

    Promise.all([H.ready, H.adminOverview(), H.adminModeration().catch(function () { return null; }), H.adminDaily(30).catch(function () { return []; })]).then(function (r) {
      var ctx = r[0], o = r[1], mod = r[2], daily = r[3];
      var p = ctx.profile || {}, nm = p.full_name || (ctx.user && ctx.user.email) || "dirección";
      $(".adminHeroBody h1 strong").textContent = nm.split(/[\s@]/)[0];
      $(".adminHeroLogo").textContent = nm.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
      var last = ctx.user && ctx.user.last_sign_in_at;
      $(".adminHeroDate").lastChild.textContent = last ? "Última conexión: " + H.fmt.ago(last).toLowerCase() : "";

      var ag = o.agencies, L = o.listings;
      var m0 = new Date(); m0 = new Date(m0.getFullYear(), m0.getMonth(), 1).getTime();
      var approved = ag.filter(function (a) { return !a.status || a.status === "approved"; });
      var pendingAg = ag.filter(function (a) { return a.status === "pending" || a.status === "needs_docs"; });
      var pub = L.filter(function (l) { return l.status === "published"; });
      var pub7 = pub.filter(function (l) { return l.listed_at && new Date(l.listed_at).getTime() >= since(7); }).length;
      var newAg = approved.filter(function (a) { return new Date(a.created_at).getTime() >= m0; }).length;
      var queue = mod ? mod.items : [];
      var over12 = queue.filter(function (i) { return i.wait >= 720; }).length;

      $$(".adminHeroPills .pill")[0].textContent = n(approved.length) + (approved.length === 1 ? " inmobiliaria verificada" : " inmobiliarias verificadas");
      var todo = pendingAg.length + queue.length;
      $$(".adminHeroPills .pill")[1].textContent = todo ? n(todo) + " pendientes de tu acción" : "Nada pendiente";

      var K = $$(".kpi");
      kpi(K[0], null, n(approved.length), newAg || null, newAg ? "+" + newAg + " este mes" : "Sin altas nuevas este mes");
      kpi(K[1], null, n(pub.length), pub7 || null, pub7 ? "+" + n(pub7) + " esta semana" : "Ninguno nuevo esta semana");
      var v30 = 0, c30 = 0;
      daily.forEach(function (d) { if (d.event_type === "view_detail") v30 += Number(d.events) || 0; else if (isContact(d.event_type)) c30 += Number(d.events) || 0; });
      K[2].classList.remove("biz");
      kpi(K[2], "Fichas vistas · 30 días", big(v30), null, n(c30) + " contactos · " + (v30 ? (c30 / v30 * 100).toFixed(1).replace(".", ",") : "0") + " %");
      if (o.users) {
        var u7 = o.users.filter(function (u) { return new Date(u.created_at).getTime() >= since(7); }).length;
        kpi(K[3], null, big(o.users.length), u7 || null, u7 ? "+" + n(u7) + " esta semana" : "Ninguno nuevo esta semana");
      } else kpi(K[3], null, "—", null, "Falta ejecutar 02-permisos.sql");

      // Requiere tu acción
      var calls = $$(".sectionHead + .stack-sm .callout");
      if (pendingAg.length) {
        $("h4", calls[0]).textContent = pendingAg.length === 1 ? "1 solicitud de alta esperando aprobación" : pendingAg.length + " solicitudes de alta esperando aprobación";
        var names = pendingAg.slice(0, 2).map(function (a) { return esc(a.name) + (a.city ? " (" + esc(a.city) + ")" : ""); }).join(", ");
        $("p", calls[0]).innerHTML = names + (pendingAg.length > 2 ? " y " + (pendingAg.length - 2) + " más" : "") + ".";
      } else calls[0].classList.add("hmHidden");
      if (queue.length) {
        $("h4", calls[1]).textContent = queue.length === 1 ? "1 anuncio sin revisar" : queue.length + " anuncios sin revisar";
        $("p", calls[1]).textContent = over12 ? (over12 === 1 ? "1 lleva" : over12 + " llevan") + " más de 12 h publicado sin revisión." : "Todos llevan menos de 12 h publicados.";
      } else calls[1].classList.add("hmHidden");
      calls[2].classList.add("hmHidden");
      if (!pendingAg.length && !queue.length) calls[0].parentNode.insertAdjacentHTML("beforeend", '<div class="callout infoc"><span class="cIc">' + svg('<path d="M20 6 9 17l-5-5"/>', 2.2) + '</span><div><h4>Todo al día</h4><p>No hay altas ni anuncios pendientes de revisión.</p></div></div>');

      // Estado de la plataforma
      var S = $$(".statRow .statMini");
      $(".n", S[0]).textContent = n(approved.length);
      $(".n", S[1]).textContent = n(o.pros);
      $(".n", S[2]).textContent = n(pub.length);
      $(".n", S[3]).textContent = n(pendingAg.length); S[3].classList.toggle("alert", !!pendingAg.length);
      $(".n", S[4]).textContent = mod ? n(queue.length) : "—"; S[4].classList.toggle("alert", !!queue.length);
      $(".l", S[4]).textContent = "Sin revisar";
      S[5].classList.add("hmHidden");
      $(".statRow").style.gridTemplateColumns = "repeat(auto-fit,minmax(150px,1fr))";
      H.setBadge("admin-anuncios.html", queue.length);
      H.setBadge("admin-solicitudes.html", pendingAg.length);

      // Accesos: facturación aún no conectada
      $$(".quick").forEach(function (q) { if (/facturacion/.test(q.getAttribute("href"))) q.classList.add("hmHidden"); });
      $(".quickGrid").style.gridTemplateColumns = "repeat(auto-fit,minmax(240px,1fr))";

      // Actividad reciente
      var agName = {}; ag.forEach(function (a) { agName[a.id] = a.name; });
      var lById = {}; L.forEach(function (l) { lById[l.id] = l; });
      var A = [];
      ag.slice(0, 10).forEach(function (a) { A.push({ t: a.created_at, tone: ["var(--infoSoft)", "var(--info)"], ic: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', h: a.status === "pending" || a.status === "needs_docs" ? "Nueva solicitud de alta" : "Nueva inmobiliaria", p: "<b>" + esc(a.name) + "</b>" + (a.city ? " · " + esc(a.city) : "") }); });
      pub.forEach(function (l) { if (l.listed_at) A.push({ t: l.listed_at, tone: ["var(--goodSoft)", "var(--good)"], ic: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', h: "Anuncio publicado", p: esc(H.addrOf(l.property)) + " · <b>" + esc(agName[l.agency_id] || "") + "</b>" }); });
      o.reviews.forEach(function (rv) { var l = lById[rv.listing_id]; A.push({ t: rv.reviewed_at, tone: rv.decision === "rejected" ? ["var(--dangerSoft)", "var(--danger)"] : ["var(--goodSoft)", "var(--good)"], ic: rv.decision === "rejected" ? '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>' : '<path d="M20 6 9 17l-5-5"/>', h: rv.decision === "rejected" ? "Anuncio rechazado en moderación" : "Anuncio aprobado en moderación", p: l ? esc(H.addrOf(l.property)) + " · <b>" + esc(agName[l.agency_id] || "") + "</b>" : "" }); });
      if (o.users) o.users.slice(0, 10).forEach(function (u) { if (!u.agency_id) A.push({ t: u.created_at, tone: ["var(--cardWarm)", "var(--granate)"], ic: '<circle cx="9" cy="8" r="3.2"/><path d="M2.6 20c1.1-3.4 11.7-3.4 12.8 0"/>', h: "Nuevo usuario registrado", p: esc(u.email || "") }); });
      A.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
      A = A.slice(0, 6);
      $(".actList").innerHTML = A.length ? A.map(function (a) {
        return '<li><span class="actIc" style="background:' + a.tone[0] + ';color:' + a.tone[1] + '">' + svg(a.ic) + '</span><div class="actBody"><h5>' + a.h + '</h5><p>' + a.p + '</p></div><span class="actWhen">' + H.fmt.ago(a.t) + '</span></li>';
      }).join("") : '<li style="display:block"><p class="muted" style="margin:0;font-size:13px">Todavía no hay actividad en la plataforma.</p></li>';

      // Salud del negocio
      var rows = $$(".perfBar > div");
      rows[0].classList.add("hmHidden"); rows[3].classList.add("hmHidden");
      var withCert = pub.filter(function (l) { return l.energy_label || l.energy_label_status === "pending"; }).length;
      var withRef = pub.filter(function (l) { return l.property && l.property.cadastre_ref; }).length;
      function setRow(row, label, a, b) {
        var spans = $$(".pl > span", row);
        spans[0].textContent = label;
        spans[1].textContent = b ? Math.round(a / b * 100) + " %" : "—";
        $(".track span", row).style.width = (b ? Math.round(a / b * 100) : 0) + "%";
      }
      setRow(rows[1], "Anuncios con certificado energético", withCert, pub.length);
      setRow(rows[2], mod ? "Anuncios revisados" : "Anuncios con referencia catastral", mod ? pub.length - queue.length : withRef, pub.length);
      $(".perfBar").closest(".card").querySelector(".cardLabel").textContent = "Calidad del inventario";
    }).catch(fail);
  }

  /* ================= ESTADÍSTICAS ================= */
  if (page === "estadisticas") {
    var MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    var RANGE = { "30": 30, "90": 90, ano: 365 };
    var cache = {}, base = null;
    loading();
    $(".barChart").innerHTML = '<p class="muted" style="margin:auto;font-size:13px">Cargando…</p>';
    $(".chartLegend").innerHTML = '<span><i class="g"></i>Fichas vistas</span><span><i class="d"></i>Contactos</span>';
    var cityBox = $(".twoColWide .card div[style*='flex-direction:column']");
    cityBox.innerHTML = '<p class="muted" style="margin:0;font-size:13px">Cargando…</p>';
    var funnel = $(".timeline");
    $(".proTable tbody").innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">Cargando…</td></tr>';

    function draw(days) {
      var key = String(days);
      var p = cache[key] || (cache[key] = H.adminDaily(days * 2));
      return p.then(function (daily) {
        var cut = since(days), cutPrev = since(days * 2);
        var s = { v: 0, vp: 0, c: 0, cp: 0 };
        daily.forEach(function (d) {
          var t = new Date(d.day).getTime(), e = Number(d.events) || 0;
          if (d.event_type === "view_detail") { if (t >= cut) s.v += e; else if (t >= cutPrev) s.vp += e; }
          else if (isContact(d.event_type)) { if (t >= cut) s.c += e; else if (t >= cutPrev) s.cp += e; }
        });
        var lbl = days === 365 ? "12 meses" : days + " d";
        var K = $$(".kpi"), pv = pctTxt(s.v, s.vp), pc = pctTxt(s.c, s.cp);
        kpi(K[0], "Fichas vistas (" + lbl + ")", big(s.v), pv, pv == null ? "Sin periodo anterior" : (pv > 0 ? "+" : "") + pv + " % vs. periodo anterior");
        kpi(K[1], "Contactos generados", big(s.c), pc, pc == null ? "Teléfono mostrado y emails" : (pc > 0 ? "+" : "") + pc + " % vs. periodo anterior");
        var rate = s.v ? s.c / s.v * 100 : 0, rateP = s.vp ? s.cp / s.vp * 100 : 0;
        kpi(K[2], "Tasa de contacto media", s.v ? rate.toFixed(1).replace(".", ",") + '<span class="u">%</span>' : "—", s.vp ? (rate > rateP ? 1 : rate < rateP ? -1 : 0) : null, s.vp ? "Antes: " + rateP.toFixed(1).replace(".", ",") + " %" : "Contactos / fichas vistas");
        if (base && base.users) {
          var u = base.users.filter(function (x) { return new Date(x.created_at).getTime() >= cut; }).length;
          var up = base.users.filter(function (x) { var t = new Date(x.created_at).getTime(); return t >= cutPrev && t < cut; }).length;
          var pu = pctTxt(u, up);
          kpi(K[3], "Nuevos usuarios (" + lbl + ")", n(u), pu, pu == null ? "Registros en Homyo" : (pu > 0 ? "+" : "") + pu + " % vs. periodo anterior");
        }

        // Gráfico por mes (o por semana en 30 días)
        var buckets = [], now = new Date();
        if (days <= 30) {
          for (var w = 3; w >= 0; w--) { var end = since(w * 7), start = since((w + 1) * 7); buckets.push({ l: "Sem " + (4 - w), a: start, b: end, v: 0, c: 0 }); }
        } else {
          var months = days === 365 ? 12 : 3;
          for (var m = months - 1; m >= 0; m--) { var d0 = new Date(now.getFullYear(), now.getMonth() - m, 1), d1 = new Date(now.getFullYear(), now.getMonth() - m + 1, 1); buckets.push({ l: MES[d0.getMonth()], a: d0.getTime(), b: d1.getTime(), v: 0, c: 0 }); }
        }
        daily.forEach(function (d) {
          var t = new Date(d.day).getTime(), e = Number(d.events) || 0;
          buckets.forEach(function (b) { if (t >= b.a && t < b.b) { if (d.event_type === "view_detail") b.v += e; else if (isContact(d.event_type)) b.c += e; } });
        });
        var mv = Math.max.apply(null, buckets.map(function (b) { return b.v; }).concat([1]));
        var mc = Math.max.apply(null, buckets.map(function (b) { return b.c; }).concat([1]));
        $(".chartLegend").innerHTML = '<span><i class="g"></i>Fichas vistas</span><span><i class="d"></i>Contactos (escala propia)</span>';
        $(".barChart").innerHTML = buckets.map(function (b) {
          return '<div class="col"><div style="display:flex;gap:4px;align-items:flex-end;width:100%;max-width:54px;height:100%;">' +
            '<div class="bar" title="' + n(b.v) + ' fichas vistas" style="height:' + Math.max(1, b.v / mv * 100) + '%"></div>' +
            '<div class="bar alt" title="' + n(b.c) + ' contactos" style="height:' + Math.max(1, b.c / mc * 100) + '%"></div></div><span class="cl">' + b.l + '</span></div>';
        }).join("");
        $(".card .cardLabel.mt0").textContent = days <= 30 ? "Fichas vistas y contactos por semana" : "Fichas vistas y contactos por mes";

        // Embudo
        funnel.innerHTML =
          '<li class="done"><span class="tdot"></span><h5>' + n(s.v) + ' fichas de vivienda vistas</h5><p>Aperturas de anuncio en el periodo</p></li>' +
          '<li class="now"><span class="tdot"></span><h5>' + n(s.c) + ' contactos a inmobiliarias</h5><p>' + (s.v ? rate.toFixed(1).replace(".", ",") + " % de las fichas vistas · " : "") + 'objetivo del negocio</p></li>';
        funnel.closest(".card").querySelector(".cardLabel").textContent = "Embudo de conversión (" + (days === 365 ? "12 meses" : days + " días") + ")";
      });
    }

    Promise.all([H.ready, H.adminOverview(), H.adminTopListings(5).catch(function () { return []; })]).then(function (r) {
      base = r[1];
      var pub = base.listings.filter(function (l) { return l.status === "published"; });
      var by = {};
      pub.forEach(function (l) { var c = (l.property && l.property.city) || "Sin ciudad"; by[c] = (by[c] || 0) + 1; });
      var cities = Object.keys(by).map(function (k) { return [k, by[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
      var max = cities.length ? cities[0][1] : 1;
      cityBox.innerHTML = cities.length ? cities.map(function (c) {
        return '<div><div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px;"><span style="color:var(--ink2)">' + esc(c[0]) + '</span><span class="num" style="font-family:\'Raleway\';font-weight:600;">' + n(c[1]) + (c[1] === 1 ? " anuncio" : " anuncios") + '</span></div><div class="track"><span style="width:' + Math.round(c[1] / max * 100) + '%"></span></div></div>';
      }).join("") : '<p class="muted" style="margin:0;font-size:13px">Aún no hay anuncios publicados.</p>';
      var T = r[2];
      $(".proTable tbody").innerHTML = T.length ? T.map(function (t) {
        var v = Number(t.views_30d) || 0, c = (Number(t.reveal_phone_30d) || 0) + (Number(t.click_email_30d) || 0);
        return '<tr><td data-th="Vivienda" class="strong"><a href="listing.html?id=' + t.listing_id + '" target="_blank" rel="noopener" style="color:inherit">' + esc(t.address_display || t.property_title || "Vivienda") + '</a>' + (t.city ? '<div class="muted" style="font-size:12px;font-weight:400">' + esc(t.city) + '</div>' : '') + '</td><td data-th="Inmobiliaria">' + esc(t.agency_name || "—") + '</td><td data-th="Visitas" class="right num">' + n(v) + '</td><td data-th="Contactos" class="right num">' + n(c) + '</td><td data-th="Conversión" class="right"><span class="pill ' + (v && c / v >= 0.03 ? "ok" : "neutral") + '">' + (v ? (c / v * 100).toFixed(1).replace(".", ",") + " %" : "—") + '</span></td></tr>';
      }).join("") : '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">Todavía no hay visitas registradas.</td></tr>';
      $(".sectionHead h2").textContent = "Anuncios con mejor rendimiento · 30 días";
      var on = $("#rangeSeg .isOn");
      return draw(RANGE[on ? on.dataset.r : "90"]);
    }).catch(fail);

    $("#rangeSeg").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      draw(RANGE[b.dataset.r]).catch(fail);
    });
  }
})();
