/* HOMYO · Admin · Profesionales, ficha, Usuarios y Solicitudes con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var page = (window.ADMIN_PAGE || {}).active;
  var isDetail = /admin-profesional-detalle/.test(location.pathname);
  if (["profesionales", "usuarios", "solicitudes"].indexOf(page) < 0) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ini(n) { return String(n || "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "·"; }
  function n(x) { return Number(x || 0).toLocaleString("es-ES"); }
  function svg(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  var FLAT = '<path d="M5 12h14"/>', UP = '<path d="m6 14 6-6 6 6"/>';
  function kpi(label, value, foot, up) { return '<div class="kpi"><p class="kpiLabel">' + label + '</p><p class="kpiValue">' + value + '</p><span class="kpiFoot ' + (up ? "up" : "flat") + '">' + svg(up ? UP : FLAT) + '<span>' + foot + '</span></span></div>'; }
  var ST = { approved: ["ok", "Verificada"], pending: ["warnp", "Pendiente"], needs_docs: ["warnp", "Falta documentación"], rejected: ["dangerp", "Rechazada"], suspended: ["dangerp", "Suspendida"] };
  function stPill(s) { var x = ST[s || "approved"] || ST.approved; return '<span class="pill ' + x[0] + '"><span class="dot"></span>' + x[1] + '</span>'; }
  function since(days) { return Date.now() - days * 864e5; }
  function csv(name, head, rows) {
    var q = function (v) { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var txt = "\ufeff" + [head].concat(rows).map(function (r) { return r.map(q).join(";"); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = name + ".csv"; document.body.appendChild(a); a.click(); a.remove();
  }
  var main = $(".proMain");
  var head = $(".pageHead", main);
  function clear(keepHead) {
    Array.prototype.forEach.call(main.children, function (el) { if (!(keepHead && el === head) && !el.classList.contains("hmBar")) el.classList.add("hmHidden"); });
  }
  function box(html) { var d = document.createElement("div"); d.className = "hmReal"; d.innerHTML = html; main.appendChild(d); return d; }
  function fail(e) { box('<p class="muted" style="padding:24px 0">No se han podido cargar los datos: ' + esc((e && e.message) || "error") + '</p>'); }

  async function base() {
    await H.ready;
    var c = H.sb;
    var r = await Promise.all([
      c.from("agencies").select("*").order("created_at", { ascending: false }),
      c.from("listings").select("id,agency_id,status,price_eur,listed_at,listing_mode,property:properties(address_display,title,city,useful_area_m2)"),
      c.rpc("admin_list_users"),
      c.from("admin_dashboard_agencies").select("agency_id,views_30d,reveal_phone_30d,click_email_30d"),
      c.from("conversations").select("id,user_id,agency_id,created_at")
    ]);
    if (r[0].error) throw r[0].error;
    var stats = {}; (r[3].data || []).forEach(function (s) { stats[s.agency_id] = s; });
    return { agencies: r[0].data || [], listings: r[1].data || [], users: r[2].data || [], stats: stats, convs: r[4].error ? [] : (r[4].data || []) };
  }
  function members(D, id) { return D.users.filter(function (u) { return u.agency_id === id; }); }
  function contacts30(D, id) { var s = D.stats[id]; return s ? (Number(s.reveal_phone_30d) || 0) + (Number(s.click_email_30d) || 0) : 0; }
  function lastAct(us) { var t = us.map(function (u) { return u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0; }); var m = Math.max.apply(null, t.concat([0])); return m ? new Date(m) : null; }

  /* ================= PROFESIONALES (directorio) ================= */
  if (page === "profesionales" && !isDetail) {
    clear(true);
    $(".pageHeadActions", head).innerHTML = '<a class="btn ghost" href="admin-solicitudes.html" id="hmSolBtn">Solicitudes</a><button class="btn primary" type="button" id="hmCsv">Exportar CSV</button>';
    var root = box('<p class="muted">Cargando inmobiliarias…</p>');
    base().then(function (D) {
      var A = D.agencies.map(function (a) {
        var us = members(D, a.id), pub = D.listings.filter(function (l) { return l.agency_id === a.id && l.status === "published"; }).length;
        return { a: a, us: us, pub: pub, c30: contacts30(D, a.id), last: lastAct(us), st: a.status || "approved" };
      });
      var ok = A.filter(function (x) { return x.st === "approved"; }), pend = A.filter(function (x) { return x.st === "pending" || x.st === "needs_docs"; }), susp = A.filter(function (x) { return x.st === "suspended"; });
      var m0 = new Date(); m0 = new Date(m0.getFullYear(), m0.getMonth(), 1);
      var newM = ok.filter(function (x) { return new Date(x.a.created_at) >= m0; }).length;
      var pros = D.users.filter(function (u) { return u.agency_id; }).length;
      $("#hmSolBtn").textContent = "Solicitudes (" + pend.length + ")";
      var filter = "all", q = "";
      root.innerHTML =
        '<section class="grid c4" style="margin-bottom:24px;">' +
          kpi("Inmobiliarias verificadas", n(ok.length), newM ? "+" + newM + " este mes" : "Sin altas este mes", !!newM) +
          kpi("Agentes (usuarios pro)", n(pros), ok.length ? (pros / Math.max(1, A.length)).toFixed(1).replace(".", ",") + " por agencia" : "—") +
          kpi("Pendientes de alta", n(pend.length), pend.length ? "Revisa las solicitudes" : "Nada pendiente") +
          kpi("Suspendidas", n(susp.length), "Sin acceso a Pro") +
        '</section>' +
        '<div class="tableTop"><label class="searchMini">' + svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>') + '<input type="text" placeholder="Buscar por nombre, CIF o ciudad…" id="hmQ" /></label><span class="grow"></span>' +
        '<div class="filterChips" id="hmF"><button class="fchip isOn" data-f="all">Todas</button><button class="fchip" data-f="approved">Verificadas</button><button class="fchip" data-f="pend">Pendientes</button><button class="fchip" data-f="suspended">Suspendidas</button></div></div>' +
        '<div class="tableWrap"><table class="proTable stack"><thead><tr><th>Inmobiliaria</th><th>Estado</th><th class="right">Anuncios</th><th class="right">Agentes</th><th class="right">Contactos 30 d</th><th>Última actividad</th><th></th></tr></thead><tbody id="hmBody"></tbody></table></div>';
      function draw() {
        var nq = q.toLowerCase();
        var rows = A.filter(function (x) {
          var okF = filter === "all" || (filter === "pend" ? (x.st === "pending" || x.st === "needs_docs") : x.st === filter);
          return okF && (!nq || [x.a.name, x.a.legal_name, x.a.cif, x.a.city].join(" ").toLowerCase().indexOf(nq) > -1);
        });
        $("#hmBody").innerHTML = rows.length ? rows.map(function (x) {
          var a = x.a;
          return '<tr><td data-th="Inmobiliaria"><div class="tName"><span class="avatar sm">' + esc(ini(a.name)) + '</span><span><span class="tn1">' + esc(a.name) + '</span><span class="tn2">' + esc([a.city, a.cif].filter(Boolean).join(" · ") || "—") + '</span></span></div></td>' +
            '<td data-th="Estado">' + stPill(x.st) + '</td><td data-th="Anuncios" class="right num">' + n(x.pub) + '</td><td data-th="Agentes" class="right num">' + n(x.us.length) + '</td><td data-th="Contactos 30 d" class="right num">' + n(x.c30) + '</td>' +
            '<td data-th="Última actividad">' + (x.last ? H.fmt.ago(x.last) : "Nunca") + '</td><td class="noLabel"><a class="btn ghost sm" href="admin-profesional-detalle.html?id=' + a.id + '">Ficha</a></td></tr>';
        }).join("") : '<tr class="noRows"><td colspan="7">' + (A.length ? "Ninguna inmobiliaria coincide." : "Todavía no hay inmobiliarias.") + '</td></tr>';
      }
      draw();
      $("#hmQ").addEventListener("input", function () { q = this.value.trim(); draw(); });
      $("#hmF").addEventListener("click", function (e) { var b = e.target.closest(".fchip"); if (!b) return; $$("#hmF .fchip").forEach(function (x) { x.classList.toggle("isOn", x === b); }); filter = b.dataset.f; draw(); });
      $("#hmCsv").addEventListener("click", function () {
        csv("homyo-inmobiliarias", ["Nombre", "Razón social", "CIF", "Ciudad", "Email", "Teléfono", "Estado", "Anuncios publicados", "Agentes", "Contactos 30 d", "Alta"],
          A.map(function (x) { var a = x.a; return [a.name, a.legal_name, a.cif, a.city, a.email, a.phone, (ST[x.st] || ST.approved)[1], x.pub, x.us.length, x.c30, (a.created_at || "").slice(0, 10)]; }));
      });
    }).catch(function (e) { root.remove(); fail(e); });
  }

  /* ================= FICHA DE UNA INMOBILIARIA ================= */
  if (isDetail) {
    var id = new URLSearchParams(location.search).get("id");
    clear(false);
    var back = $('a.btnLink[href="admin-profesionales.html"]', main); if (back) back.classList.remove("hmHidden");
    if (!id) { box('<p class="muted" style="padding:24px 0">Abre una inmobiliaria desde el <a href="admin-profesionales.html">directorio</a>.</p>'); return; }
    var rootD = box('<p class="muted">Cargando ficha…</p>');
    Promise.all([base(), H.ready.then(function () { return H.sb.from("admin_dashboard_listings").select("listing_id,status,price_eur,property_title,address_display,city,views_30d,reveal_phone_30d,click_email_30d").eq("agency_id", id); })]).then(function (r) {
      var D = r[0], LS = (r[1] && r[1].data) || [];
      var a = D.agencies.filter(function (x) { return x.id === id; })[0];
      if (!a) { rootD.innerHTML = '<p class="muted">No existe esa inmobiliaria.</p>'; return; }
      var us = members(D, a.id), st = a.status || "approved", s = D.stats[a.id] || {};
      var pubN = D.listings.filter(function (l) { return l.agency_id === a.id && l.status === "published"; }).length;
      var allL = D.listings.filter(function (l) { return l.agency_id === a.id; });
      var tb = document.querySelector(".tbTitle"); if (tb) tb.textContent = a.name;
      var ROLE = { agent: "Agente", editor: "Agente", viewer: "Solo lectura" };
      function render() {
        st = a.status || "approved";
        rootD.innerHTML =
          '<div class="card" style="padding:0;overflow:hidden;margin-bottom:22px;"><div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:26px 28px;">' +
            '<span class="avatar lg" style="font-size:22px;">' + (a.logo_url ? '<img src="' + esc(a.logo_url) + '" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit" />' : esc(ini(a.name))) + '</span>' +
            '<div style="min-width:0;flex:1 1 auto;"><div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap;"><h1 style="margin:0;font-family:\'Raleway\';font-weight:300;font-size:28px;color:var(--granate);letter-spacing:-.4px;">' + esc(a.name) + '</h1>' + stPill(st) + '</div>' +
            '<p style="margin:6px 0 0;font-size:13.5px;color:var(--muted);">' + esc([a.legal_name, a.cif ? "CIF " + a.cif : "", a.city, "Alta el " + H.fmt.date(a.created_at)].filter(Boolean).join(" · ")) + '</p></div>' +
            '<div class="pageHeadActions">' + (st === "suspended" ? '<button class="btn primary" type="button" id="hmReact">Reactivar</button>' : st === "approved" ? '<button class="btn danger" type="button" id="hmSusp">Suspender</button>' : '<a class="btn primary" href="admin-solicitudes.html">Revisar solicitud</a>') + '</div>' +
          '</div></div>' +
          '<section class="grid c4" style="margin-bottom:22px;">' +
            kpi("Anuncios activos", n(pubN), n(allL.length) + " en total") +
            kpi("Contactos (30 d)", n(contacts30(D, a.id)), "Teléfono mostrado y emails") +
            kpi("Visualizaciones (30 d)", n(s.views_30d), "Fichas vistas") +
            kpi("Equipo", n(us.length), us.length === 1 ? "1 usuario" : n(us.length) + " usuarios") +
          '</section>' +
          '<div class="twoColWide"><div class="stack-sm" style="gap:22px;">' +
            '<div class="card"><p class="cardLabel">Anuncios de la agencia</p><div class="tableWrap" style="margin-top:6px;"><table class="proTable"><thead><tr><th>Vivienda</th><th>Estado</th><th class="right">Visitas 30 d</th><th class="right">Contactos 30 d</th></tr></thead><tbody>' +
              (LS.length ? LS.sort(function (x, y) { return (Number(y.views_30d) || 0) - (Number(x.views_30d) || 0); }).map(function (l) {
                return '<tr><td><a class="strong" href="listing.html?id=' + l.listing_id + '" target="_blank" rel="noopener" style="color:inherit">' + esc(l.address_display || l.property_title || "Vivienda") + '</a><br><span class="muted" style="font-size:12px;">' + esc([l.city, l.price_eur ? H.fmt.eur(l.price_eur) : ""].filter(Boolean).join(" · ")) + '</span></td><td>' + (l.status === "published" ? '<span class="pill ok">Publicado</span>' : l.status === "draft" ? '<span class="pill neutral">Borrador</span>' : '<span class="pill neutral">Retirado</span>') + '</td><td class="right num">' + n(l.views_30d) + '</td><td class="right num">' + n((Number(l.reveal_phone_30d) || 0) + (Number(l.click_email_30d) || 0)) + '</td></tr>';
              }).join("") : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px">Sin anuncios todavía.</td></tr>') +
            '</tbody></table></div></div>' +
          '</div><div class="stack-sm" style="gap:22px;">' +
            '<div class="card"><p class="cardLabel">Datos de contacto</p><dl class="kv">' +
              [["Email", a.email], ["Teléfono", a.phone], ["Web", a.website], ["Oficina", [a.address, a.postcode, a.city].filter(Boolean).join(", ")], ["Nº API", a.api_number], ["Zonas", (a.zones || []).join(", ")]].map(function (kv) { return '<dt>' + kv[0] + '</dt><dd>' + esc(kv[1] || "—") + '</dd>'; }).join("") +
            '</dl>' + (a.review_notes ? '<p class="fieldHint" style="margin-top:10px">Nota de revisión: ' + esc(a.review_notes) + '</p>' : '') + '</div>' +
            '<div class="card"><p class="cardLabel">Equipo</p>' + (us.length ? us.map(function (u) {
              return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--lineSoft)"><span class="avatar sm">' + esc(ini(u.full_name || u.email)) + '</span><span style="flex:1 1 auto;min-width:0"><span class="strong" style="display:block;font-size:13.5px">' + esc(u.full_name || u.email) + '</span><span class="muted" style="font-size:12px">' + esc(u.email) + ' · ' + (ROLE[u.role] || "Administrador") + '</span></span><span class="muted" style="font-size:11.5px;white-space:nowrap">' + (u.last_sign_in_at ? H.fmt.ago(u.last_sign_in_at) : "Nunca") + '</span></div>';
            }).join("") : '<p class="muted" style="margin:0;font-size:13px">Nadie tiene acceso todavía.</p>') + '</div>' +
          '</div></div>';
        var sb = $("#hmSusp"), rb = $("#hmReact");
        if (sb) sb.onclick = function () { setStatus("suspended", "¿Suspender " + a.name + "?", "Su equipo dejará de poder entrar en Pro. Sus anuncios siguen como están hasta que decidas.", "Suspender", true); };
        if (rb) rb.onclick = function () { setStatus("approved", "¿Reactivar " + a.name + "?", "Su equipo podrá volver a entrar en Pro.", "Reactivar", false); };
      }
      function setStatus(to, t, body, ok, danger) {
        window.homyoConfirm({ title: t, body: body, ok: ok, danger: danger }).then(function (go) {
          if (!go) return;
          H.sb.from("agencies").update({ status: to, reviewed_at: new Date().toISOString() }).eq("id", a.id).then(function (r) {
            if (r.error) { window.homyoToast("No se ha podido cambiar: " + r.error.message); return; }
            a.status = to; render(); window.homyoToast(to === "suspended" ? "Inmobiliaria suspendida" : "Inmobiliaria reactivada");
            if (window.homyoAudit) homyoAudit("Profesionales", to === "suspended" ? "Suspendió una inmobiliaria" : "Reactivó una inmobiliaria", a.name);
          });
        });
      }
      render();
    }).catch(function (e) { rootD.remove(); fail(e); });
  }

  /* ================= USUARIOS PARTICULARES ================= */
  if (page === "usuarios") {
    clear(true);
    $(".pageHeadActions", head).innerHTML = '<button class="btn primary" type="button" id="hmCsv">Exportar CSV</button>';
    var rootU = box('<p class="muted">Cargando usuarios…</p>');
    Promise.all([base(), H.ready.then(function () { return Promise.all([H.sb.from("favorites").select("user_id"), H.sb.from("saved_searches").select("user_id")]); })]).then(function (r) {
      var D = r[0], fav = {}, srch = {}, conv = {};
      ((r[1][0] && r[1][0].data) || []).forEach(function (x) { fav[x.user_id] = (fav[x.user_id] || 0) + 1; });
      ((r[1][1] && r[1][1].data) || []).forEach(function (x) { srch[x.user_id] = (srch[x.user_id] || 0) + 1; });
      D.convs.forEach(function (x) { conv[x.user_id] = (conv[x.user_id] || 0) + 1; });
      var U = D.users.filter(function (u) { return !u.agency_id && u.role !== "platform_admin"; }).map(function (u) {
        var isNew = new Date(u.created_at).getTime() >= since(7), act = u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= since(30);
        return { u: u, f: fav[u.id] || 0, s: srch[u.id] || 0, c: conv[u.id] || 0, st: isNew ? "new" : act ? "act" : "idle" };
      });
      var m0 = new Date(); m0 = new Date(m0.getFullYear(), m0.getMonth(), 1);
      var w7 = U.filter(function (x) { return x.st === "new"; }).length, act = U.filter(function (x) { return x.u.last_sign_in_at && new Date(x.u.last_sign_in_at).getTime() >= since(30); }).length;
      var withS = U.filter(function (x) { return x.s; }).length, convM = D.convs.filter(function (x) { return new Date(x.created_at) >= m0; }).length;
      var PILL = { new: '<span class="pill infop"><span class="dot"></span>Nuevo</span>', act: '<span class="pill ok"><span class="dot"></span>Activo</span>', idle: '<span class="pill neutral"><span class="dot"></span>Inactivo</span>' };
      var filter = "all", q = "";
      rootU.innerHTML =
        '<section class="grid c4" style="margin-bottom:24px;">' +
          kpi("Usuarios registrados", n(U.length), w7 ? "+" + n(w7) + " esta semana" : "Ninguno nuevo esta semana", !!w7) +
          kpi("Activos (30 días)", n(act), U.length ? Math.round(act / U.length * 100) + " % del total" : "—") +
          kpi("Con alertas activas", n(withS), "búsquedas guardadas") +
          kpi("Contactos enviados (mes)", n(convM), "conversaciones nuevas") +
        '</section>' +
        '<div class="tableTop"><label class="searchMini">' + svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>') + '<input type="text" placeholder="Buscar por nombre o email…" id="hmQ" /></label><span class="grow"></span>' +
        '<div class="filterChips" id="hmF"><button class="fchip isOn" data-f="all">Todos</button><button class="fchip" data-f="act">Activos</button><button class="fchip" data-f="new">Nuevos</button><button class="fchip" data-f="idle">Inactivos</button></div></div>' +
        '<div class="tableWrap"><table class="proTable stack"><thead><tr><th>Usuario</th><th>Alta</th><th class="right">Favoritos</th><th class="right">Búsquedas</th><th class="right">Contactos</th><th>Última conexión</th><th>Estado</th></tr></thead><tbody id="hmBody"></tbody></table></div>';
      function draw() {
        var nq = q.toLowerCase();
        var rows = U.filter(function (x) { return (filter === "all" || x.st === filter) && (!nq || ((x.u.full_name || "") + " " + x.u.email).toLowerCase().indexOf(nq) > -1); }).slice(0, 500);
        $("#hmBody").innerHTML = rows.length ? rows.map(function (x) {
          var u = x.u;
          return '<tr><td data-th="Usuario"><div class="tName"><span class="avatar user round sm">' + esc(ini(u.full_name || u.email)) + '</span><span><span class="tn1">' + esc(u.full_name || u.email) + '</span><span class="tn2">' + esc(u.email) + '</span></span></div></td>' +
            '<td data-th="Alta">' + H.fmt.date(u.created_at) + '</td><td data-th="Favoritos" class="right num">' + n(x.f) + '</td><td data-th="Búsquedas" class="right num">' + n(x.s) + '</td><td data-th="Contactos" class="right num">' + n(x.c) + '</td>' +
            '<td data-th="Última conexión">' + (u.last_sign_in_at ? H.fmt.ago(u.last_sign_in_at) : "Nunca") + '</td><td data-th="Estado">' + PILL[x.st] + '</td></tr>';
        }).join("") : '<tr class="noRows"><td colspan="7">' + (U.length ? "Ningún usuario coincide." : "Todavía no hay usuarios registrados.") + '</td></tr>';
      }
      draw();
      $("#hmQ").addEventListener("input", function () { q = this.value.trim(); draw(); });
      $("#hmF").addEventListener("click", function (e) { var b = e.target.closest(".fchip"); if (!b) return; $$("#hmF .fchip").forEach(function (x) { x.classList.toggle("isOn", x === b); }); filter = b.dataset.f; draw(); });
      $("#hmCsv").addEventListener("click", function () {
        csv("homyo-usuarios", ["Nombre", "Email", "Alta", "Última conexión", "Favoritos", "Búsquedas", "Contactos"],
          U.map(function (x) { return [x.u.full_name, x.u.email, (x.u.created_at || "").slice(0, 10), (x.u.last_sign_in_at || "").slice(0, 10), x.f, x.s, x.c]; }));
      });
    }).catch(function (e) { rootU.remove(); fail(e); });
  }

  /* ================= SOLICITUDES DE ALTA ================= */
  if (page === "solicitudes") {
    clear(true);
    var rootS = box('<p class="muted">Cargando solicitudes…</p>');
    var sel = null, D = null;
    function pending() { return D.agencies.filter(function (a) { return a.status === "pending" || a.status === "needs_docs"; }).sort(function (x, y) { return new Date(x.created_at) - new Date(y.created_at); }); }
    function drawS() {
      var P = pending();
      H.setBadge && H.setBadge("admin-solicitudes.html", P.length);
      if (!P.length) {
        rootS.innerHTML = '<div class="emptyState"><h3>No hay solicitudes pendientes</h3><p>Cuando una inmobiliaria pida el alta aparecerá aquí para que revises sus datos antes de darle acceso.</p></div>';
        return;
      }
      if (!P.some(function (a) { return a.id === sel; })) sel = P[0].id;
      var a = P.filter(function (x) { return x.id === sel; })[0], us = members(D, a.id);
      rootS.innerHTML =
        '<div class="splitView"><div class="listPane"><div class="lpHead"><h3>Pendientes · ' + P.length + '</h3></div>' +
          P.map(function (x) { return '<a class="lpItem' + (x.id === sel ? " isOn" : "") + '" data-sel="' + x.id + '" href="#"><span class="avatar sm">' + esc(ini(x.name)) + '</span><span><span class="li1">' + esc(x.name) + '</span><span class="li2">' + esc([x.city, x.cif].filter(Boolean).join(" · ") || "Sin datos fiscales") + (x.status === "needs_docs" ? " · falta documentación" : "") + '</span></span><span class="liWhen">' + H.fmt.ago(x.created_at).replace(/^Hace /, "") + '</span></a>'; }).join("") +
        '</div><div class="stack-sm" style="gap:18px;">' +
          '<div class="card"><div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px;"><span class="avatar lg">' + esc(ini(a.name)) + '</span><div style="flex:1 1 auto;min-width:0;"><h2 style="margin:0;font-family:\'Raleway\';font-weight:500;font-size:22px;color:var(--ink);">' + esc(a.legal_name || a.name) + '</h2><p style="margin:4px 0 0;font-size:13px;color:var(--muted);">' + esc([a.city, a.cif ? "CIF " + a.cif : "", "Solicitud recibida " + H.fmt.ago(a.created_at).toLowerCase()].filter(Boolean).join(" · ")) + '</p></div>' + stPill(a.status) + '</div>' +
            '<dl class="kv">' + [["Nombre comercial", a.name], ["Responsable", us.map(function (u) { return (u.full_name ? u.full_name + " · " : "") + u.email; }).join(", ")], ["Email", a.email], ["Teléfono", a.phone], ["Nº API", a.api_number], ["Web", a.website], ["Oficina", [a.address, a.postcode, a.city].filter(Boolean).join(", ")]].map(function (kv) { return '<dt>' + kv[0] + '</dt><dd>' + esc(kv[1] || "—") + '</dd>'; }).join("") + '</dl>' +
            (a.review_notes ? '<p class="fieldHint" style="margin-top:12px">Última nota: ' + esc(a.review_notes) + '</p>' : '') + '</div>' +
          (function () { var app = a.application || {}, rp = app.responsible || {}, docs = a.docs || [], L = { cif: "CIF", merc: "Registro Mercantil", dni: "DNI / NIE del responsable", poderes: "Poderes / autorización" };
            return '<div class="card"><p class="cardLabel">Responsable y registro</p><dl class="kv">' + [["Nombre", [rp.name, rp.surname].filter(Boolean).join(" ")], ["DNI / NIE", rp.dni], ["Cargo", rp.role], ["Teléfono", rp.phone], ["Forma jurídica", app.legal_form], ["Constitución", app.incorporation_date], ["Registro autonómico", app.regional_register && app.regional_register.applies === "yes" ? [app.regional_register.ccaa, app.regional_register.number].filter(Boolean).join(" · ") : "No aplica"]].map(function (kv) { return '<dt>' + kv[0] + '</dt><dd>' + esc(kv[1] || "—") + '</dd>'; }).join("") + '</dl></div>' +
              '<div class="card"><p class="cardLabel">Documentación aportada</p>' + (docs.length ? docs.map(function (d) { return '<div class="docRow"><span><span class="dn">' + esc(L[d.kind] || d.kind) + '</span><br><span class="dm">' + esc(d.name) + ' · ' + H.fmt.ago(d.uploaded_at).toLowerCase() + '</span></span><button class="btn ghost sm" type="button" data-doc="' + esc(d.path) + '">Ver</button></div>'; }).join("") : '<p class="muted" style="margin:0;font-size:13px">Todavía no ha subido documentos. Puedes pedírselos con «Pedir documentación».</p>') + '</div>'; })() +
          '<div class="card" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="btn primary" type="button" data-act="approved">Aprobar alta</button><button class="btn ghost" type="button" data-act="needs_docs">Pedir documentación</button><button class="btn danger" type="button" data-act="rejected">Rechazar</button></div>' +
        '</div></div>';
    }
    rootS.addEventListener("click", function (e) {
      var it = e.target.closest(".lpItem"); if (it) { e.preventDefault(); sel = it.dataset.sel; drawS(); return; }
      var dv = e.target.closest("[data-doc]"); if (dv) { H.sb.storage.from("agency-docs").createSignedUrl(dv.dataset.doc, 300).then(function (r) { if (r.error) { window.homyoToast("No se ha podido abrir: " + r.error.message); return; } window.open(r.data.signedUrl, "_blank", "noopener"); }); return; }
      var b = e.target.closest("[data-act]"); if (!b) return;
      var a = D.agencies.filter(function (x) { return x.id === sel; })[0], to = b.dataset.act;
      var cfg = {
        approved: { title: "¿Aprobar a " + a.name + "?", body: "Su equipo podrá entrar en Pro y publicar viviendas.", ok: "Aprobar" },
        needs_docs: { title: "Pedir documentación", body: "Indica qué falta. La inmobiliaria lo verá al entrar en su cuenta.", ok: "Enviar", input: true },
        rejected: { title: "¿Rechazar a " + a.name + "?", body: "No podrá acceder a Pro. Indica el motivo.", ok: "Rechazar", danger: true, input: true }
      }[to];
      var ask = cfg.input ? function () { var v = window.prompt(cfg.body, a.review_notes || ""); return Promise.resolve(v === null ? false : { note: v.trim() }); } : function () { return window.homyoConfirm(cfg).then(function (ok) { return ok ? { note: null } : false; }); };
      ask().then(function (r) {
        if (!r) return;
        var row = { status: to, reviewed_at: new Date().toISOString() }; if (r.note != null) row.review_notes = r.note || null;
        H.sb.from("agencies").update(row).eq("id", a.id).then(function (res) {
          if (res.error) { window.homyoToast("No se ha podido guardar: " + res.error.message); return; }
          Object.assign(a, row); drawS();
          window.homyoToast(to === "approved" ? "Alta aprobada · " + a.name : to === "rejected" ? "Solicitud rechazada" : "Documentación pedida");
          if (window.homyoAudit) homyoAudit("Altas", to === "approved" ? "Aprobó un alta" : to === "rejected" ? "Rechazó un alta" : "Pidió documentación", a.name);
        });
      });
    });
    base().then(function (d) { D = d; drawS(); }).catch(function (e) { rootS.remove(); fail(e); });
  }
})();
