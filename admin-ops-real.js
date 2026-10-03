/* HOMYO · Admin · Incidencias, Alertas, Auditoría y Equipo Homyo con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H) return;
  if (/admin-incidencia-detalle/.test(location.pathname)) return;
  if (H.mode !== "real") return;
  var page = (window.ADMIN_PAGE || {}).active;
  if (["incidencias", "alertas", "auditoria", "equipo"].indexOf(page) < 0) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ini(n) { return String(n || "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "·"; }
  function n(x) { return Number(x || 0).toLocaleString("es-ES"); }
  function svg(p, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  function kpi(l, v, f) { return '<div class="kpi"><p class="kpiLabel">' + l + '</p><p class="kpiValue">' + v + '</p><span class="kpiFoot flat">' + svg('<path d="M5 12h14"/>', 2.2) + '<span>' + f + '</span></span></div>'; }
  function toast(m) { if (window.homyoToast) window.homyoToast(m); }
  function missing(e, file) { var m = (e && e.message) || ""; return /relation|does not exist|schema cache|function/i.test(m) ? "Falta ejecutar supabase/" + file + " en Supabase." : "No se han podido cargar los datos: " + m; }
  var main = $(".proMain"), head = $(".pageHead", main);
  Array.prototype.forEach.call(main.children, function (el) { if (el !== head) el.classList.add("hmHidden"); });
  var root = document.createElement("div"); main.appendChild(root);
  root.innerHTML = '<p class="muted">Cargando…</p>';
  var acts = head && $(".pageHeadActions", head);

  /* ================= INCIDENCIAS (formulario de contacto) ================= */
  if (page === "incidencias") {
    if (acts) acts.innerHTML = "";
    var REPORT = /report|problema con un anuncio|anuncio/i;
    var ST = { open: ["warnp", "Abierta"], resolved: ["ok", "Resuelta"], dismissed: ["neutral", "Descartada"] };
    var R = [], sel = new URLSearchParams(location.search).get("id"), filter = "open", kind = "all", LST = {};
    function isReport(r) { return !!r.listing_id || REPORT.test(r.topic || ""); }
    function draw() {
      var V = R.filter(function (r) { return (filter === "all" || r.status === filter) && (kind === "all" || (kind === "rep" ? isReport(r) : !isReport(r))); });
      if (!V.some(function (r) { return r.id === sel; })) sel = V.length ? V[0].id : null;
      var open = R.filter(function (r) { return r.status === "open"; }), m0 = new Date(); m0 = new Date(m0.getFullYear(), m0.getMonth(), 1);
      H.setBadge && H.setBadge("admin-incidencias.html", open.filter(isReport).length);
      var r = R.filter(function (x) { return x.id === sel; })[0], L = r && r.listing_id ? LST[r.listing_id] : null;
      root.innerHTML =
        '<section class="grid c4" style="margin-bottom:22px;">' + kpi("Reportes abiertos", n(open.filter(isReport).length), "anuncios reportados") + kpi("Mensajes web abiertos", n(open.filter(function (x) { return !isReport(x); }).length), "formulario de contacto") +
          kpi("Resueltas (mes)", n(R.filter(function (x) { return x.status === "resolved" && x.resolved_at && new Date(x.resolved_at) >= m0; }).length), "este mes") + kpi("Total recibidas", n(R.length), "desde el inicio") + '</section>' +
        '<div class="tableTop"><div class="filterChips" id="ixK"><button class="fchip' + (kind === "all" ? " isOn" : "") + '" data-k="all">Todo</button><button class="fchip' + (kind === "rep" ? " isOn" : "") + '" data-k="rep">Reportes de anuncios</button><button class="fchip' + (kind === "msg" ? " isOn" : "") + '" data-k="msg">Mensajes web</button></div><span class="grow"></span>' +
          '<div class="filterChips" id="ixF"><button class="fchip' + (filter === "open" ? " isOn" : "") + '" data-f="open">Abiertas</button><button class="fchip' + (filter === "resolved" ? " isOn" : "") + '" data-f="resolved">Resueltas</button><button class="fchip' + (filter === "all" ? " isOn" : "") + '" data-f="all">Todas</button></div></div>' +
        '<div class="splitView"><div class="listPane"><div class="lpHead"><h3>' + V.length + (V.length === 1 ? " elemento" : " elementos") + '</h3></div>' +
          (V.length ? V.map(function (x) { return '<a class="lpItem' + (x.id === sel ? " isOn" : "") + (x.status === "open" ? " unread" : "") + '" href="#" data-sel="' + x.id + '"><span class="avatar sm">' + esc(ini(x.name || x.email)) + '</span><span><span class="li1">' + esc(x.topic || "Mensaje") + '</span><span class="li2">' + esc((x.name || x.email) + (x.listing_id && LST[x.listing_id] ? " · " + LST[x.listing_id].t : "")) + '</span></span><span class="liWhen">' + H.fmt.ago(x.created_at).replace(/^Hace /, "") + '</span></a>'; }).join("") : '<p class="muted" style="padding:16px;font-size:13px">Nada por aquí.</p>') +
        '</div><div class="stack-sm" style="gap:16px;">' + (r ?
          '<div class="card"><div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px"><div style="flex:1 1 auto;min-width:0"><h2 style="margin:0 0 4px;font-family:\'Raleway\';font-weight:500;font-size:20px;color:var(--ink)">' + esc(r.topic || "Mensaje") + '</h2><p style="margin:0;font-size:13px;color:var(--muted)">' + (r.kind === "inmobiliaria" ? "Formulario profesional" : "Formulario de usuario") + ' · ' + H.fmt.date(r.created_at) + '</p></div><span class="pill ' + ST[r.status][0] + '"><span class="dot"></span>' + ST[r.status][1] + '</span></div>' +
            '<dl class="kv">' + [["Nombre", r.name], ["Email", r.email], ["Teléfono", r.phone], ["Inmobiliaria", r.agency], ["Ciudad", r.city]].filter(function (k) { return k[1]; }).map(function (k) { return '<dt>' + k[0] + '</dt><dd>' + esc(k[1]) + '</dd>'; }).join("") + '</dl>' +
            '<p class="dLabel" style="margin:14px 0 6px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)">Mensaje</p><div style="white-space:pre-line;font-size:14px;line-height:1.6;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:14px 16px">' + esc(r.message) + '</div>' +
            (r.admin_note ? '<p class="fieldHint" style="margin-top:10px">Nota interna: ' + esc(r.admin_note) + '</p>' : '') + '</div>' +
          (L ? '<div class="card"><p class="cardLabel">Anuncio reportado</p><p style="margin:0 0 4px" class="strong">' + esc(L.t) + '</p><p class="muted" style="margin:0 0 12px;font-size:13px">' + esc(L.ag) + ' · ' + (L.status === "published" ? "Publicado" : L.status === "draft" ? "Borrador" : "Retirado") + '</p><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn ghost sm" href="listing.html?id=' + r.listing_id + '" target="_blank" rel="noopener">Ver anuncio</a>' + (L.status === "published" ? '<button class="btn danger sm" type="button" data-unpub="' + r.listing_id + '">Despublicar (vuelve a borrador)</button>' : '') + '</div></div>' : '') +
          '<div class="card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><a class="btn primary" href="admin-incidencia-detalle.html?id=' + r.id + '">Abrir ficha</a><a class="btn ghost" href="mailto:' + esc(r.email) + '?subject=' + encodeURIComponent("Re: " + (r.topic || "tu mensaje a Homyo")) + '">Responder por email</a>' +
            (r.status === "open" ? '<button class="btn primary" type="button" data-st="resolved">Marcar resuelta</button><button class="btn ghost" type="button" data-st="dismissed">Descartar</button>' : '<button class="btn ghost" type="button" data-st="open">Reabrir</button>') + '</div>'
          : '<div class="card"><p class="muted" style="margin:0">Selecciona un elemento.</p></div>') + '</div></div>';
    }
    root.addEventListener("click", function (e) {
      var it = e.target.closest("[data-sel]"); if (it) { e.preventDefault(); sel = it.dataset.sel; draw(); return; }
      var k = e.target.closest("#ixK [data-k]"); if (k) { kind = k.dataset.k; draw(); return; }
      var f = e.target.closest("#ixF [data-f]"); if (f) { filter = f.dataset.f; draw(); return; }
      var s = e.target.closest("[data-st]");
      if (s) {
        var r = R.filter(function (x) { return x.id === sel; })[0], to = s.dataset.st;
        var note = to === "open" ? r.admin_note : window.prompt("Nota interna (opcional):", r.admin_note || "");
        if (note === null) return;
        var row = { status: to, admin_note: note || null, resolved_at: to === "open" ? null : new Date().toISOString() };
        H.sb.from("contact_requests").update(row).eq("id", r.id).then(function (res) {
          if (res.error) { toast("No se ha podido guardar: " + res.error.message); return; }
          Object.assign(r, row); draw(); toast(to === "resolved" ? "Marcada como resuelta" : to === "dismissed" ? "Descartada" : "Reabierta");
          if (window.homyoAudit) homyoAudit("Incidencias", to === "resolved" ? "Resolvió una incidencia" : to === "dismissed" ? "Descartó una incidencia" : "Reabrió una incidencia", (r.topic || "") + " · " + (r.email || ""));
        });
        return;
      }
      var u = e.target.closest("[data-unpub]");
      if (u) {
        var id = u.dataset.unpub;
        window.homyoConfirm({ title: "¿Despublicar este anuncio?", body: "Volverá a borrador y la inmobiliaria verá el motivo en su revisión de calidad.", ok: "Despublicar", danger: true }).then(function (ok) {
          if (!ok) return;
          var r2 = R.filter(function (x) { return x.id === sel; })[0];
          H.adminReview(id, "rejected", ["reporte"], "Hemos retirado temporalmente el anuncio tras un reporte: " + (r2.topic || "") + ". Revísalo y vuelve a publicarlo cuando esté corregido.").then(function () {
            LST[id].status = "draft"; draw(); toast("Anuncio despublicado");
            if (window.homyoAudit) homyoAudit("Incidencias", "Despublicó un anuncio reportado", LST[id].t);
          }).catch(function (er) { toast("No se ha podido: " + er.message); });
        });
      }
    });
    H.ready.then(function () { return H.sb.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(500); }).then(function (r) {
      if (r.error) throw r.error;
      R = r.data || [];
      var ids = R.map(function (x) { return x.listing_id; }).filter(Boolean);
      if (!ids.length) return;
      return H.sb.from("listings").select("id,status,agency:agencies(name),property:properties(*)").in("id", ids).then(function (l) {
        (l.data || []).forEach(function (x) { LST[x.id] = { t: H.addrOf(x.property), ag: (x.agency && x.agency.name) || "", status: x.status }; });
      });
    }).then(draw).catch(function (e) { root.innerHTML = '<p class="muted">' + esc(missing(e, "10-operacion-admin.sql")) + '</p>'; });
  }

  /* ================= ALERTAS (calculadas) ================= */
  if (page === "alertas") {
    if (acts) acts.innerHTML = "";
    var TONE = { warn: ["var(--warnSoft)", "var(--warn)"], bad: ["var(--dangerSoft)", "var(--danger)"], info: ["var(--infoSoft)", "var(--info)"], ok: ["var(--goodSoft)", "var(--good)"] };
    Promise.all([H.ready, H.adminOverview(), H.adminModeration().catch(function () { return null; }),
      H.ready.then(function () { return Promise.all([H.sb.from("support_threads").select("id,subject,status,last_message_at,created_at").eq("status", "open"), H.sb.from("contact_requests").select("id,topic,listing_id,status,created_at").eq("status", "open"), H.sb.from("availability_manager_view").select("listing_id,agency_name,warning_due_date,auto_unpublish_date,status").eq("status", "published")]); })
    ]).then(function (r) {
      var o = r[1], mod = r[2], sup = (r[3][0].data || []), con = (r[3][1].data || []), av = (r[3][2].data || []);
      var A = [], now = Date.now(), h = function (d) { return (now - new Date(d).getTime()) / 36e5; };
      o.agencies.filter(function (a) { return a.status === "pending" || a.status === "needs_docs"; }).forEach(function (a) {
        A.push({ g: "Altas", tone: h(a.created_at) > 48 ? "bad" : "info", t: (a.status === "needs_docs" ? "Esperando documentación · " : "Nueva solicitud de alta · ") + a.name, d: (a.city ? a.city + " · " : "") + "recibida " + H.fmt.ago(a.created_at).toLowerCase() + (h(a.created_at) > 48 ? " · supera las 48 h" : ""), at: a.created_at, href: "admin-solicitudes.html" });
      });
      if (mod) mod.items.filter(function (i) { return i.wait >= 720; }).forEach(function (i) { A.push({ g: "Moderación", tone: "warn", t: "Anuncio sin revisar más de 12 h", d: i.t + " (" + i.ag + ") · " + Math.round(i.wait / 60) + " h publicado", at: new Date(now - i.wait * 6e4).toISOString(), href: "admin-anuncios.html" }); });
      if (mod) mod.items.filter(function (i) { return i.dup; }).forEach(function (i) { A.push({ g: "Moderación", tone: "bad", t: "Posible anuncio duplicado", d: i.t + " · misma referencia catastral que otro anuncio", at: new Date(now - i.wait * 6e4).toISOString(), href: "admin-anuncios.html" }); });
      con.forEach(function (c) { A.push({ g: "Incidencias", tone: c.listing_id || /report/i.test(c.topic || "") ? "bad" : "info", t: (c.listing_id || /report/i.test(c.topic || "") ? "Anuncio reportado · " : "Mensaje web · ") + (c.topic || "Sin asunto"), d: "Recibido " + H.fmt.ago(c.created_at).toLowerCase(), at: c.created_at, href: "admin-incidencias.html?id=" + c.id }); });
      sup.forEach(function (s) { A.push({ g: "Soporte", tone: h(s.last_message_at) > 24 ? "warn" : "info", t: "Consulta sin responder · " + s.subject, d: "Último mensaje " + H.fmt.ago(s.last_message_at).toLowerCase(), at: s.last_message_at, href: "admin-mensajes.html" }); });
      av.filter(function (x) { return x.auto_unpublish_date && new Date(x.auto_unpublish_date).getTime() - now < 7 * 864e5; }).forEach(function (x) { A.push({ g: "Disponibilidad", tone: "warn", t: "Anuncio a punto de despublicarse", d: (x.agency_name || "") + " · se despublica " + H.fmt.date(x.auto_unpublish_date) + " si no confirma disponibilidad", at: x.warning_due_date || x.auto_unpublish_date, href: "admin-profesionales.html" }); });
      A.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
      var G = ["Todo"].concat(["Altas", "Moderación", "Incidencias", "Soporte", "Disponibilidad"].filter(function (g) { return A.some(function (x) { return x.g === g; }); })), cur = "Todo";
      function draw() {
        var V = A.filter(function (x) { return cur === "Todo" || x.g === cur; });
        root.innerHTML = '<div class="filterChips" id="alF" style="margin-bottom:16px">' + G.map(function (g) { return '<button class="fchip' + (g === cur ? " isOn" : "") + '" data-g="' + g + '">' + g + (g === "Todo" ? "" : " " + A.filter(function (x) { return x.g === g; }).length) + '</button>'; }).join("") + '</div>' +
          (V.length ? '<div class="stack-sm">' + V.map(function (x) { var c = TONE[x.tone]; return '<a class="card" href="' + x.href + '" style="display:flex;gap:14px;align-items:center;text-decoration:none;color:inherit;padding:16px 20px"><span style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;background:' + c[0] + ';color:' + c[1] + '">' + svg(x.tone === "bad" ? '<path d="M12 9v4"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>' : '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 1.5"/>') + '</span><span style="flex:1 1 auto;min-width:0"><span class="strong" style="display:block">' + esc(x.t) + '</span><span class="muted" style="font-size:13px">' + esc(x.d) + '</span></span><span class="pill neutral">' + x.g + '</span></a>'; }).join("") + '</div>'
            : '<div class="emptyState"><h3>Todo al día</h3><p>No hay nada que requiera tu atención ahora mismo.</p></div>');
      }
      root.addEventListener("click", function (e) { var b = e.target.closest("#alF [data-g]"); if (b) { cur = b.dataset.g; draw(); } });
      draw();
      H.setBadge && H.setBadge("admin-alertas.html", A.length);
    }).catch(function (e) { root.innerHTML = '<p class="muted">' + esc(missing(e, "10-operacion-admin.sql")) + '</p>'; });
  }

  /* ================= AUDITORÍA ================= */
  if (page === "auditoria") {
    var rows = [], qa = "";
    if (acts) acts.innerHTML = '<button class="btn primary" type="button" id="auCsv">Exportar CSV</button>';
    function drawA() {
      var nq = qa.toLowerCase(), V = rows.filter(function (r) { return !nq || [r.actor_name, r.category, r.action, r.target].join(" ").toLowerCase().indexOf(nq) > -1; });
      root.innerHTML = '<div class="tableTop"><label class="searchMini">' + svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', 2) + '<input type="text" id="auQ" placeholder="Buscar por persona, acción o elemento…" value="' + esc(qa) + '" /></label></div>' +
        '<div class="tableWrap"><table class="proTable stack"><thead><tr><th>Cuándo</th><th>Quién</th><th>Área</th><th>Acción</th><th>Elemento</th></tr></thead><tbody>' +
        (V.length ? V.map(function (r) { return '<tr><td data-th="Cuándo">' + H.fmt.date(r.at) + ' · ' + new Date(r.at).toTimeString().slice(0, 5) + '</td><td data-th="Quién">' + esc(r.actor_name || "—") + '</td><td data-th="Área"><span class="pill neutral">' + esc(r.category || "—") + '</span></td><td data-th="Acción" class="strong">' + esc(r.action) + '</td><td data-th="Elemento">' + esc(r.target || "—") + '</td></tr>'; }).join("") : '<tr class="noRows"><td colspan="5">' + (rows.length ? "Nada coincide con la búsqueda." : "Todavía no hay actividad registrada.") + '</td></tr>') +
        '</tbody></table></div><p class="muted" style="font-size:12.5px;margin-top:12px">Se registran las acciones del equipo en moderación, altas, profesionales, incidencias y equipo. El registro no se puede editar ni borrar.</p>';
      var i = $("#auQ"); i.addEventListener("input", function () { qa = i.value; var p = i.selectionStart; drawA(); var j = $("#auQ"); j.focus(); j.setSelectionRange(p, p); });
    }
    H.ready.then(function () { return H.sb.from("admin_audit").select("*").order("at", { ascending: false }).limit(1000); }).then(function (r) {
      if (r.error) throw r.error; rows = r.data || []; drawA();
      $("#auCsv").addEventListener("click", function () {
        var q2 = function (v) { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
        var txt = "\ufeff" + [["Fecha", "Quién", "Área", "Acción", "Elemento"]].concat(rows.map(function (x) { return [x.at, x.actor_name, x.category, x.action, x.target]; })).map(function (l) { return l.map(q2).join(";"); }).join("\n");
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = "homyo-auditoria.csv"; document.body.appendChild(a); a.click(); a.remove();
      });
    }).catch(function (e) { root.innerHTML = '<p class="muted">' + esc(missing(e, "10-operacion-admin.sql")) + '</p>'; });
  }

  /* ================= EQUIPO HOMYO ================= */
  if (page === "equipo") {
    if (acts) acts.innerHTML = "";
    function loadE() {
      return H.ready.then(function () { return H.sb.rpc("admin_list_users"); }).then(function (r) {
        if (r.error) throw r.error;
        var me = H.ctx.user.id, T = (r.data || []).filter(function (u) { return u.role === "platform_admin"; });
        root.innerHTML = '<div class="tableWrap"><table class="proTable stack"><thead><tr><th>Persona</th><th>Rol</th><th>Último acceso</th><th></th></tr></thead><tbody>' +
          T.map(function (u) { return '<tr><td data-th="Persona"><div class="tName"><span class="avatar sm">' + esc(ini(u.full_name || u.email)) + '</span><span><span class="tn1">' + esc(u.full_name || u.email) + (u.id === me ? " (tú)" : "") + '</span><span class="tn2">' + esc(u.email) + '</span></span></div></td><td data-th="Rol"><span class="pill solid" style="background:var(--granate);color:#fff">Administrador</span></td><td data-th="Último acceso">' + (u.last_sign_in_at ? H.fmt.ago(u.last_sign_in_at) : "Nunca") + '</td><td class="noLabel">' + (u.id === me ? '' : '<button class="btn ghost sm" type="button" data-rm="' + esc(u.email) + '">Quitar acceso</button>') + '</td></tr>'; }).join("") +
          '</tbody></table></div>' +
          '<div class="sectionHead"><h2>Dar acceso de administrador</h2></div><div class="card"><form id="eqF" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><label class="field" style="flex:1 1 260px"><span class="fieldLabel">Email de su cuenta en Homyo</span><input class="input" id="eqMail" type="email" placeholder="nombre@homyo.es" /></label><button class="btn primary" type="submit">Dar acceso</button></form>' +
          '<p class="fieldHint" style="margin-top:10px">La persona tiene que haberse registrado antes en Homyo con ese email. Tendrá acceso total al entorno de administración. De momento hay un único rol interno.</p></div>';
      }).catch(function (e) { root.innerHTML = '<p class="muted">' + esc(missing(e, "10-operacion-admin.sql")) + '</p>'; });
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-rm]"); if (!b) return;
      window.homyoConfirm({ title: "¿Quitar el acceso?", body: b.dataset.rm + " dejará de poder entrar en Admin.", ok: "Quitar acceso", danger: true }).then(function (ok) {
        if (!ok) return;
        H.sb.rpc("admin_set_platform_admin", { p_email: b.dataset.rm, p_on: false }).then(function (r) { if (r.error) toast(r.error.message); else { toast("Acceso retirado"); loadE(); } });
      });
    });
    root.addEventListener("submit", function (e) {
      e.preventDefault();
      var m = $("#eqMail").value.trim(); if (!m) return;
      H.sb.rpc("admin_set_platform_admin", { p_email: m, p_on: true }).then(function (r) { if (r.error) toast(r.error.message); else { toast("Acceso concedido a " + m); loadE(); } });
    });
    loadE();
  }
})();
