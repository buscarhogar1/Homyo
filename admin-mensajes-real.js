/* HOMYO · Admin · Mensajes y soporte con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ini(n) { return String(n || "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "·"; }
  var CATS = { estandar: "Estándar", vivienda: "Vivienda", cuenta: "Cuenta / equipo", facturacion: "Facturación", baja: "Baja", otro: "Otro" };
  var ST = { open: ["warnp", "Pendiente"], answered: ["ok", "Respondida"], closed: ["neutral", "Cerrada"] };
  var list = [], sel = null, filter = "open", drafts = {};
  var lp = $("#lpItems"), th = $("#thread");
  lp.innerHTML = '<p class="muted" style="padding:16px;font-size:13px">Cargando…</p>';
  th.innerHTML = "";
  $(".listPane .lpHead").innerHTML = '<h3 id="lpTitle">Bandeja</h3><div class="seg" id="hmSeg"><button type="button" data-f="open" class="isOn">Pendientes</button><button type="button" data-f="all">Todas</button></div>';

  function visible() { return list.filter(function (t) { return filter === "all" || t.status === "open"; }); }
  function draw() {
    var V = visible();
    H.setBadge && H.setBadge("admin-mensajes.html", list.filter(function (t) { return t.status === "open"; }).length);
    if (!V.some(function (t) { return t.id === sel; })) sel = V.length ? V[0].id : null;
    lp.innerHTML = V.length ? V.map(function (t) {
      return '<a class="lpItem' + (t.id === sel ? " isOn" : "") + (t.admin_unread ? " unread" : "") + '" href="#" data-sel="' + t.id + '"><span class="avatar sm">' + esc(ini(t.agency_name || t.author_name || t.email)) + '</span><span><span class="li1">' + esc(t.subject) + '</span><span class="li2">' + esc((t.agency_name || t.author_name || t.email) + " · " + (CATS[t.category] || "Otro")) + '</span></span><span class="liWhen">' + H.fmt.ago(t.last_message_at).replace(/^Hace /, "") + '</span></a>';
    }).join("") : '<p class="muted" style="padding:16px;font-size:13px">' + (filter === "open" ? "No hay consultas pendientes." : "Todavía no hay consultas.") + '</p>';
    var t = list.filter(function (x) { return x.id === sel; })[0];
    if (!t) { th.innerHTML = '<div class="leadEmpty" style="padding:60px 20px;text-align:center;color:var(--muted)">Selecciona una consulta.</div>'; return; }
    var msgs = (t.support_messages || []).slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    var s = ST[t.status] || ST.open;
    th.innerHTML =
      '<div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px"><div style="flex:1 1 auto;min-width:0"><h2 style="margin:0 0 4px;font-family:\'Raleway\';font-weight:500;font-size:20px;color:var(--ink)">' + esc(t.subject) + '</h2>' +
      '<p style="margin:0;font-size:13px;color:var(--muted)">' + esc([t.author_name, t.email].filter(Boolean).join(" · ")) + (t.agency_id ? ' · <a href="admin-profesional-detalle.html?id=' + t.agency_id + '">' + esc(t.agency_name || "Inmobiliaria") + '</a>' : '') + ' · ' + (CATS[t.category] || "Otro") + '</p></div><span class="pill ' + s[0] + '"><span class="dot"></span>' + s[1] + '</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:10px">' + msgs.map(function (m) {
        var us = m.sender === "homyo";
        return '<div style="align-self:' + (us ? "flex-end" : "flex-start") + ';max-width:86%;padding:11px 14px;border-radius:12px;font-size:14px;line-height:1.55;white-space:pre-line;background:' + (us ? "var(--cardWarm)" : "var(--bg)") + ';border:1px solid var(--line)"><span style="display:block;font-size:11px;font-weight:600;color:var(--muted);margin-bottom:3px">' + esc(m.author_name || (us ? "Equipo Homyo" : "Inmobiliaria")) + ' · ' + H.fmt.ago(m.created_at).toLowerCase() + '</span>' + esc(m.body) + '</div>';
      }).join("") + '</div>' +
      '<form id="hmRep" style="display:flex;flex-direction:column;gap:8px;margin-top:16px"><textarea class="input" id="hmTa" style="min-height:96px" placeholder="Responder como Equipo Homyo…"></textarea><div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap"><button class="btn ghost sm" type="button" id="hmClose">' + (t.status === "closed" ? "Reabrir" : "Cerrar consulta") + '</button><button class="btn primary sm" type="submit">Enviar respuesta</button></div></form>';
    var ta = $("#hmTa"); ta.value = drafts[t.id] || ""; ta.addEventListener("input", function () { drafts[t.id] = ta.value; });
    if (t.admin_unread) { t.admin_unread = 0; H.sb.rpc("support_set", { p_thread: t.id }); }
  }
  function load() {
    return H.ready.then(function () {
      return Promise.all([
        H.sb.from("support_threads").select("id,user_id,agency_id,email,author_name,subject,category,status,admin_unread,created_at,last_message_at,support_messages(id,sender,author_name,body,created_at)").order("last_message_at", { ascending: false }),
        H.sb.from("agencies").select("id,name")
      ]);
    }).then(function (r) {
      if (r[0].error) { lp.innerHTML = '<p class="muted" style="padding:16px;font-size:13px">' + (/support_threads/.test(r[0].error.message) ? "Falta ejecutar supabase/09-soporte.sql." : esc(r[0].error.message)) + '</p>'; return; }
      var an = {}; (r[1].data || []).forEach(function (a) { an[a.id] = a.name; });
      list = (r[0].data || []).map(function (t) { t.agency_name = an[t.agency_id] || ""; return t; });
      draw();
    });
  }
  document.addEventListener("click", function (e) {
    var it = e.target.closest("#lpItems .lpItem"); if (it) { e.preventDefault(); e.stopPropagation(); sel = it.dataset.sel; draw(); return; }
    var sg = e.target.closest("#hmSeg button"); if (sg) { e.stopPropagation(); filter = sg.dataset.f; document.querySelectorAll("#hmSeg button").forEach(function (b) { b.classList.toggle("isOn", b === sg); }); draw(); return; }
    if (e.target.closest("#hmClose")) {
      e.stopPropagation();
      var t = list.filter(function (x) { return x.id === sel; })[0]; if (!t) return;
      var to = t.status === "closed" ? "open" : "closed";
      H.sb.rpc("support_set", { p_thread: t.id, p_status: to }).then(function (r) { if (r.error) window.homyoToast(r.error.message); else { t.status = to; window.homyoToast(to === "closed" ? "Consulta cerrada" : "Consulta reabierta"); draw(); } });
    }
  }, true);
  document.addEventListener("submit", function (e) {
    if (e.target.id !== "hmRep") return;
    e.preventDefault(); e.stopPropagation();
    var v = $("#hmTa").value.trim(); if (!v) return;
    var b = $("#hmRep button[type=submit]"); b.disabled = true;
    H.sb.rpc("support_reply", { p_thread: sel, p_body: v }).then(function (r) {
      b.disabled = false;
      if (r.error) { window.homyoToast("No se ha podido enviar: " + r.error.message); return; }
      drafts[sel] = ""; window.homyoToast("Respuesta enviada"); load();
    });
  }, true);
  load();
  setInterval(function () { if (!document.hidden && !(document.activeElement && document.activeElement.id === "hmTa")) load(); }, 30000);
})();
