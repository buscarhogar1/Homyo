/* HOMYO · Admin · Ficha de una incidencia con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var id = new URLSearchParams(location.search).get("id");
  var main = document.getElementById("incMain");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ini(n) { return String(n || "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "·"; }
  function svg(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  function toast(m) { if (window.homyoToast) homyoToast(m); }
  var I_BACK = '<path d="M15 18l-6-6 6-6"/>', I_MSG = '<path d="M22 6 12 13 2 6"/><rect x="2" y="5" width="20" height="14" rx="2"/>', I_OK = '<path d="M20 6 9 17l-5-5"/>';
  var back = '<a class="btnLink" href="admin-incidencias.html" style="margin-bottom:18px;">' + svg(I_BACK) + 'Volver a incidencias</a>';
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) { main.innerHTML = back + '<div class="card"><p class="muted" style="margin:0">Abre una incidencia desde la <a href="admin-incidencias.html">lista</a>.</p></div>'; return; }
  main.innerHTML = back + '<p class="muted">Cargando incidencia…</p>';

  var R, L = null, ADM = [], me = "";
  var REPORT = /report|problema con un anuncio|anuncio/i;
  var ST = { open: ["warnp", "Abierta"], progress: ["infop", "En curso"], resolved: ["ok", "Resuelta"], dismissed: ["neutral", "Descartada"] };
  function stKey() { return R.status === "open" ? (R.assigned_to ? "progress" : "open") : R.status; }
  var outcomeSel = null;

  function outcomes() {
    var o = [{ id: "resolved", label: "Marcar como resuelta", desc: "Se ha atendido. Queda cerrada en el historial." }];
    if (L && L.status === "published") o.unshift({ id: "unpublish", label: "Despublicar el anuncio", desc: "Vuelve a borrador. La inmobiliaria verá el motivo en su revisión de calidad." });
    o.push({ id: "dismissed", label: "Descartar", desc: "El reporte no procede o es spam." });
    return o;
  }
  function kv(rows) { return '<dl class="kv">' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join("") + '</dl>'; }

  function render() {
    var closed = R.status === "resolved" || R.status === "dismissed", isRep = !!R.listing_id || REPORT.test(R.topic || ""), k = ST[stKey()];
    var O = outcomes(); if (!outcomeSel || !O.some(function (o) { return o.id === outcomeSel; })) outcomeSel = O[0].id;
    var tl = (R.log || []).slice().reverse().concat([{ t: "Recibida", d: (R.kind === "inmobiliaria" ? "Formulario profesional" : "Formulario de usuario") + " · " + esc(R.name || R.email), at: R.created_at }]);
    var agMail = L && L.agency && L.agency.email;
    document.title = (R.topic || "Incidencia") + " · Homyo Admin";
    var tb = document.querySelector(".tbTitle"); if (tb) tb.textContent = R.topic || "Incidencia";
    main.innerHTML = back +
      '<div class="card" style="padding:0;overflow:hidden;margin-bottom:22px;"><div class="incHead"><div style="min-width:0;flex:1 1 320px;">' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;"><span class="incId">#' + R.id.slice(0, 8).toUpperCase() + '</span><span class="pill neutral">' + (isRep ? "Reporte de anuncio" : "Mensaje web") + '</span><span class="pill ' + k[0] + '"><span class="dot"></span>' + k[1] + '</span></div>' +
        '<h1>' + esc(R.topic || "Mensaje") + '</h1><p class="incMeta">Recibida ' + H.fmt.ago(R.created_at).toLowerCase() + ' · ' + (R.assigned_name ? "asignada a " + esc(R.assigned_name) : "sin asignar") + '</p></div>' +
        '<div class="pageHeadActions">' + (L && L.agency_id ? '<a class="btn ghost" href="admin-profesional-detalle.html?id=' + L.agency_id + '">Ver agencia</a>' : '') +
          (agMail ? '<a class="btn ghost" href="mailto:' + esc(agMail) + '?subject=' + encodeURIComponent("Homyo · reporte sobre " + (L.t || "tu anuncio")) + '" data-log="Contacto con la agencia por email">' + svg(I_MSG) + 'Contactar agencia</a>' : '') +
          '<a class="btn ghost" href="mailto:' + esc(R.email) + '?subject=' + encodeURIComponent("Re: " + (R.topic || "tu mensaje a Homyo")) + '" data-log="Respuesta al remitente por email">' + svg(I_MSG) + 'Responder</a>' +
          (closed ? '<button class="btn ghost" type="button" data-act="reopen">Reabrir</button>' : !R.assigned_to ? '<button class="btn primary" type="button" data-act="take">Asumir</button>' : '') +
        '</div></div></div>' +
      (closed ? '<div class="callout okc" style="margin-bottom:22px;"><span class="cIc">' + svg(I_OK) + '</span><div><h4>Incidencia ' + k[1].toLowerCase() + '</h4><p>' + esc(R.admin_note || "Cerrada por el equipo de Homyo.") + (R.resolved_at ? " · " + H.fmt.date(R.resolved_at) : "") + '</p></div></div>' : '') +
      '<div class="twoColWide"><div class="stack-sm" style="gap:22px;">' +
        '<div class="card"><p class="cardLabel">Qué se ha recibido</p><div class="quote" style="white-space:pre-line">' + esc(R.message) + '</div><div class="quoteBy"><span class="avatar" style="width:28px;height:28px;font-size:11px;">' + esc(ini(R.name || R.email)) + '</span>' + esc(R.name || "Sin nombre") + ' · ' + esc(R.email) + '</div></div>' +
        '<div class="card"><p class="cardLabel">Historial y notas internas</p><ul class="timeline" style="margin-top:8px;">' + tl.map(function (h, i) { return '<li class="' + (i === 0 && !closed ? "now" : "done") + '"><span class="tdot"></span><h5>' + esc(h.t) + '</h5><p>' + (h.at === R.created_at && h.t === "Recibida" ? h.d : esc(h.d || "")) + ' · ' + H.fmt.ago(h.at).toLowerCase() + '</p></li>'; }).join("") + '</ul>' +
          '<div class="noteRow"><textarea class="input" id="incNote" maxlength="1500" placeholder="Añadir nota interna (solo la ve el equipo de Homyo)"></textarea><button class="btn ghost" type="button" data-act="note">Añadir</button></div></div>' +
      '</div><div class="stack-sm" style="gap:22px;">' +
        '<div class="card"><p class="cardLabel">Resolución</p>' + (closed
          ? '<p style="font-size:14px;color:var(--ink2);margin:6px 0 0;">Decisión: <strong>' + esc(R.outcome === "unpublish" ? "Anuncio despublicado" : k[1]) + '</strong>.</p>'
          : '<div class="outcomes">' + O.map(function (o) { return '<button class="outcome' + (o.id === outcomeSel ? " isOn" : "") + '" type="button" data-outcome="' + o.id + '"><span class="r"></span><div><strong>' + o.label + '</strong><span>' + o.desc + '</span></div></button>'; }).join("") + '</div>' +
            '<textarea class="input" id="incRes" style="margin:14px 0;min-height:70px" maxlength="1000" placeholder="Nota de cierre (opcional)">' + esc(R.admin_note || "") + '</textarea><button class="btn primary block" type="button" data-act="resolve">Aplicar decisión</button>' +
            '<p class="fieldHint" style="margin-top:10px">Homyo todavía no envía emails automáticos: usa «Responder» para avisar al remitente.</p>') + '</div>' +
        (L ? '<div class="card"><p class="cardLabel">Anuncio afectado</p><div class="ph" style="border-radius:var(--rad);margin:6px 0 12px;aspect-ratio:16/9;' + (L.photo ? "background:url('" + String(L.photo).replace(/'/g, "%27") + "') center/cover;" : "") + '">' + (L.photo ? "" : "sin foto") + '</div>' +
          kv([["Vivienda", '<a href="listing.html?id=' + R.listing_id + '" target="_blank" rel="noopener">' + esc(L.t) + '</a>'], ["Ref. catastral", esc(L.ref)], ["Precio", esc(L.price)], ["Estado", L.status === "published" ? "Publicado" : L.status === "draft" ? "Borrador" : "Retirado"]]) + '</div>' : '') +
        (L && L.agency ? '<div class="card"><p class="cardLabel">Agencia</p>' + kv([["Nombre", esc(L.agency.name)], ["CIF", esc(L.agency.cif)], ["Email", esc(L.agency.email)], ["Teléfono", esc(L.agency.phone)], ["Ciudad", esc(L.agency.city)]]) + '</div>' : '') +
        (!L && (R.phone || R.agency || R.city) ? '<div class="card"><p class="cardLabel">Datos del remitente</p>' + kv([["Teléfono", esc(R.phone)], ["Inmobiliaria", esc(R.agency)], ["Ciudad", esc(R.city)]]) + '</div>' : '') +
        '<div class="card"><p class="cardLabel">Asignación</p><select class="input" id="incAssign"' + (closed ? " disabled" : "") + '><option value="">Sin asignar</option>' + ADM.map(function (a) { return '<option value="' + a.id + '"' + (a.id === R.assigned_to ? " selected" : "") + '>' + esc(a.name) + '</option>'; }).join("") + '</select></div>' +
      '</div></div>';
  }

  function save(row, entry, msg) {
    if (entry) row.log = (R.log || []).concat([{ t: entry.t, d: entry.d || me, at: new Date().toISOString(), by: me }]);
    return H.sb.from("contact_requests").update(row).eq("id", R.id).then(function (r) {
      if (r.error) { toast("No se ha podido guardar: " + r.error.message); return false; }
      Object.assign(R, row); render(); if (msg) toast(msg); return true;
    });
  }
  function audit(a) { if (window.homyoAudit) homyoAudit("Incidencias", a, (R.topic || "") + " · " + (R.email || "")); }

  main.addEventListener("click", function (e) {
    var o = e.target.closest("[data-outcome]"); if (o) { outcomeSel = o.dataset.outcome; render(); return; }
    var lg = e.target.closest("[data-log]"); if (lg) { save({}, { t: lg.dataset.log }); return; }
    var b = e.target.closest("[data-act]"); if (!b) return;
    var a = b.dataset.act, uid = H.ctx && H.ctx.user && H.ctx.user.id;
    if (a === "take") save({ assigned_to: uid, assigned_name: me }, { t: "Asumida por " + me }, "Asignada a ti").then(function (ok) { if (ok) audit("Asumió una incidencia"); });
    if (a === "note") { var v = document.getElementById("incNote").value.trim(); if (!v) return; save({}, { t: "Nota interna", d: v + " — " + me }, "Nota añadida"); }
    if (a === "reopen") save({ status: "open", resolved_at: null, outcome: null }, { t: "Reabierta" }, "Incidencia reabierta").then(function (ok) { if (ok) audit("Reabrió una incidencia"); });
    if (a === "resolve") {
      var note = document.getElementById("incRes").value.trim() || null, oc = outcomeSel;
      var done = function () {
        var st = oc === "dismissed" ? "dismissed" : "resolved";
        return save({ status: st, outcome: oc, admin_note: note, resolved_at: new Date().toISOString() }, { t: oc === "unpublish" ? "Anuncio despublicado y resuelta" : st === "dismissed" ? "Descartada" : "Resuelta" }, oc === "dismissed" ? "Reporte descartado" : "Incidencia resuelta")
          .then(function (ok) { if (ok) { audit(oc === "unpublish" ? "Despublicó un anuncio reportado" : oc === "dismissed" ? "Descartó una incidencia" : "Resolvió una incidencia"); window.scrollTo({ top: 0, behavior: "smooth" }); } });
      };
      if (oc !== "unpublish") { done(); return; }
      window.homyoConfirm({ title: "¿Despublicar este anuncio?", body: "Volverá a borrador y la inmobiliaria verá el motivo en su revisión de calidad.", ok: "Despublicar", danger: true }).then(function (go) {
        if (!go) return;
        H.adminReview(R.listing_id, "rejected", ["reporte"], "Hemos retirado temporalmente el anuncio tras un reporte: " + (R.topic || "") + (note ? ". " + note : "") + ". Revísalo y vuelve a publicarlo cuando esté corregido.")
          .then(function () { L.status = "draft"; done(); })
          .catch(function (er) { toast("No se ha podido despublicar: " + er.message); });
      });
    }
  });
  main.addEventListener("change", function (e) {
    if (e.target.id !== "incAssign") return;
    var v = e.target.value, a = ADM.filter(function (x) { return x.id === v; })[0];
    save({ assigned_to: v || null, assigned_name: a ? a.name : null }, { t: a ? "Asignada a " + a.name : "Sin asignar" }, a ? "Asignada a " + a.name : "Sin asignar");
  });

  H.ready.then(function (ctx) {
    me = (ctx.profile && ctx.profile.full_name) || (ctx.user && ctx.user.email) || "Equipo Homyo";
    return Promise.all([H.sb.from("contact_requests").select("*").eq("id", id).maybeSingle(), H.sb.rpc("admin_list_users")]);
  }).then(function (r) {
    if (r[0].error) throw r[0].error;
    R = r[0].data;
    if (!R) { main.innerHTML = back + '<div class="card"><p class="muted" style="margin:0">Esta incidencia no existe o se ha borrado.</p></div>'; return; }
    R.log = Array.isArray(R.log) ? R.log : [];
    ADM = ((r[1] && r[1].data) || []).filter(function (u) { return u.role === "platform_admin"; }).map(function (u) { return { id: u.id, name: u.full_name || u.email }; });
    if (!R.listing_id) { render(); return; }
    return H.sb.from("listings").select("id,status,price_eur,listing_mode,main_photo_url,agency_id,property:properties(*),agency:agencies(id,name,cif,email,phone,city)").eq("id", R.listing_id).maybeSingle().then(function (x) {
      var l = x.data;
      if (l) { var p = l.property || {}; L = { status: l.status, agency_id: l.agency_id, agency: l.agency, photo: l.main_photo_url, t: H.addrOf(p).replace(" · ", " en "), ref: p.cadastre_ref || "—", price: l.price_eur ? H.fmt.eur(l.price_eur) + (/rent|room|alquiler|habit/i.test(l.listing_mode || "") ? "/mes" : "") : "—" }; }
      render();
    });
  }).catch(function (e) {
    var m = (e && e.message) || "error";
    main.innerHTML = back + '<div class="card"><p class="muted" style="margin:0">' + (/assigned|log|outcome|column/i.test(m) ? "Falta ejecutar supabase/11-ajustes-incidencias.sql en Supabase." : "No se ha podido cargar: " + esc(m)) + '</p></div>';
  });
})();
