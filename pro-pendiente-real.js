/* HOMYO · Estado real de la solicitud de alta (pro-cuenta-pendiente.html) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.getMode("pro") !== "real") return;
  var $ = function (s) { return document.querySelector(s); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var bar = document.querySelector(".demoBar"); if (bar) bar.remove();
  var card = $("#stCard"); card.style.visibility = "hidden";
  var out = document.querySelector('.regTop .right a'); if (out) out.addEventListener("click", function (e) { e.preventDefault(); H.logout("pro"); });
  var DOCS = [["cif", "Tarjeta de identificación fiscal (CIF)", "Documento de Hacienda con el CIF de la empresa (o NIF si eres autónomo)."], ["dni", "DNI / NIE del responsable", "Por las dos caras."], ["merc", "Nota simple del Registro Mercantil", "Solo si te la hemos pedido o no has podido verificarla automáticamente."], ["poderes", "Escritura de poderes o autorización", "Solo si el responsable no es administrador de la empresa."]];
  var IC = {
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>',
    bang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 7v6"/><circle cx="12" cy="17" r=".8" fill="currentColor"/></svg>'
  };
  var SUPPORT = "contacto.html?tipo=inmobiliaria";

  (async function () {
    var c = await H.client();
    var s = (await c.auth.getSession()).data.session;
    if (!s) { location.replace("cuenta-inmobiliaria.html"); return; }
    var pr = await c.from("profiles").select("agency_id").eq("id", s.user.id).maybeSingle();
    var agId = pr.data && pr.data.agency_id;
    var ag = agId ? (await c.from("agencies").select("*").eq("id", agId).maybeSingle()).data : null;
    if (ag && (ag.status === "approved" || !ag.status)) { location.replace("pro-panel.html"); return; }
    var ref = "HMY-" + String(agId || s.user.id).slice(0, 8).toUpperCase();
    var st = !ag ? "none" : ag.status;
    var docs = (ag && ag.docs) || [];
    function has(k) { return docs.some(function (d) { return d.kind === k; }); }
    var T = {
      none: { tone: "warn", ic: IC.clock, kick: "Sin solicitud", title: "Tu cuenta no tiene <strong>inmobiliaria</strong>", sub: "Has iniciado sesión con " + esc(s.user.email) + ", pero no hay ninguna solicitud de alta asociada. Si te han invitado a un equipo, pide a su administrador que vuelva a enviarte la invitación.", pill: ["neutral", "Sin solicitud"] },
      pending: { tone: "warn", ic: IC.clock, kick: "En revisión", title: "Tu solicitud se está <strong>revisando</strong>", sub: "Nuestro equipo revisa los datos de <strong>" + esc(ag && ag.name) + "</strong>. Te avisaremos por email en 24 a 48 horas laborables.", pill: ["warnp", "Estado: en revisión"] },
      needs_docs: { tone: "action", ic: IC.doc, kick: "Acción necesaria", title: "Necesitamos <strong>más documentación</strong>", sub: "La revisión está en pausa hasta que subas lo que falta. En cuanto lo recibamos, seguimos.", pill: ["dangerp", "Estado: falta documentación"] },
      rejected: { tone: "bad", ic: IC.x, kick: "Solicitud no aprobada", title: "No hemos podido <strong>aprobar tu cuenta</strong>", sub: "Hemos revisado tu solicitud y no podemos activar la cuenta profesional con los datos actuales.", pill: ["neutral", "Estado: rechazada"] },
      suspended: { tone: "bad", ic: IC.x, kick: "Cuenta suspendida", title: "Tu cuenta está <strong>suspendida</strong>", sub: "El acceso a Homyo Pro de <strong>" + esc(ag && ag.name) + "</strong> está en pausa. Escríbenos para resolverlo.", pill: ["dangerp", "Estado: suspendida"] }
    }[st] || {};
    card.className = "stCard tone-" + T.tone;
    $("#stIc").innerHTML = T.ic; $("#stKick").textContent = T.kick; $("#stTitle").innerHTML = T.title; $("#stSub").innerHTML = T.sub;
    $("#stMeta").innerHTML = '<span class="pill ' + T.pill[0] + '"><span class="dot"></span>' + T.pill[1] + '</span><span class="pill neutral">Ref. ' + ref + '</span>' + (ag ? '<span class="pill neutral">Enviada ' + H.fmt.ago(ag.created_at).toLowerCase() + '</span>' : '');
    var tr = { pending: ["done", "done", "cur", ""], needs_docs: ["done", "done", "blocked", ""], rejected: ["done", "done", "stop", ""], suspended: ["done", "done", "done", "stop"], none: ["", "", "", ""] }[st];
    $("#track").innerHTML = ["Recibida", "Datos comprobados", "Revisión del equipo", "Activada"].map(function (l, i) {
      var k = tr[i], icn = k === "done" ? IC.ok : k === "blocked" ? IC.bang : k === "stop" ? IC.x : '<span class="n">' + (i + 1) + '</span>';
      return '<div class="tNode ' + k + '"><span class="c">' + icn + '</span><span class="l">' + l + '</span><span class="t">' + (i === 0 && ag ? H.fmt.date(ag.created_at) : i === 2 && ag && ag.reviewed_at ? H.fmt.date(ag.reviewed_at) : "") + '</span></div>';
    }).join("");
    var note = ag && ag.review_notes ? '<div class="reason"><b>Nota del equipo de verificación</b>' + esc(ag.review_notes) + '</div>' : "";
    var canUpload = ag && (st === "pending" || st === "needs_docs");
    var up = canUpload ? DOCS.map(function (d) {
      var ok = has(d[0]);
      return '<div class="upRow' + (ok ? " isDone" : "") + '" data-kind="' + d[0] + '"><div><h4>' + d[1] + '</h4><p>' + d[2] + ' PDF, JPG o PNG · máx. 10 MB</p><span class="file">' + (ok ? esc(docs.filter(function (x) { return x.kind === d[0]; })[0].name) + " · subido" : "") + '</span></div><button type="button" class="btn ' + (ok ? "ghost" : "primary") + ' sm" data-up="' + d[0] + '">' + (ok ? "Cambiar" : "Subir archivo") + '</button></div>';
    }).join("") : "";
    $("#panel").innerHTML = st === "needs_docs" ? '<div class="panel action"><h3>Lo que falta</h3>' + (note || "<p>Sube la documentación que te hemos pedido.</p>") + up + '</div>'
      : st === "pending" ? (up ? '<div class="panel"><h3>Documentación</h3><p>Si aún no la has subido, añádela aquí para agilizar la revisión.</p>' + up + '</div>' : '')
      : (st === "rejected" || st === "suspended") && note ? '<div class="panel bad"><h3>Motivo</h3>' + note + '</div>' : "";
    $("#checks").innerHTML = ag ? [["Empresa", (ag.legal_name || ag.name) + (ag.cif ? " · CIF " + ag.cif : ""), "ok", "Recibido"]].concat(DOCS.slice(0, 2).map(function (d) { return [d[1], has(d[0]) ? "Aportado" : "Pendiente de subir", has(d[0]) ? "ok" : "miss", has(d[0]) ? "Aportado" : "Falta"]; })).map(function (r) {
      return '<li class="s-' + r[2] + '"><span class="ic">' + (r[2] === "ok" ? IC.ok : IC.bang) + '</span><div><div class="k">' + esc(r[0]) + '</div><div class="d">' + esc(r[1]) + '</div></div><span class="s">' + r[3] + '</span></li>';
    }).join("") : "";
    $("#stActions").innerHTML = (st === "rejected" ? '<a class="btn ghost" href="' + SUPPORT + '">Pedir nueva revisión</a>' : '<a class="btn ghost" href="index.html">Volver al inicio</a>') + '<a class="btn primary" href="' + SUPPORT + '&ref=' + ref + '">Contactar con soporte</a>';
    $("#stNote").innerHTML = st === "pending" ? "No necesitas hacer nada más. Si falta algo, te lo pediremos aquí y por email." : st === "needs_docs" ? "Al subir un documento, la revisión se reanuda automáticamente." : "";
    card.style.visibility = "";

    $("#panel").addEventListener("click", function (e) {
      var b = e.target.closest("[data-up]"); if (!b) return;
      var inp = document.createElement("input"); inp.type = "file"; inp.accept = ".pdf,.jpg,.jpeg,.png";
      inp.onchange = async function () {
        var f = inp.files[0]; if (!f) return;
        if (f.size > 10 * 1048576) { alert("El archivo pesa más de 10 MB."); return; }
        b.disabled = true; b.textContent = "Subiendo…";
        var kind = b.dataset.up, m = /\.([a-z0-9]+)$/i.exec(f.name), path = agId + "/" + kind + "-" + Date.now().toString(36) + "." + (m ? m[1].toLowerCase() : "pdf");
        var u = await c.storage.from("agency-docs").upload(path, f, { contentType: f.type || undefined, upsert: true });
        var r = u.error ? u : await c.rpc("agency_add_doc", { p_kind: kind, p_name: f.name, p_path: path });
        if (r.error) { b.disabled = false; b.textContent = "Subir archivo"; alert("No se ha podido subir: " + r.error.message); return; }
        location.reload();
      };
      inp.click();
    });
  })().catch(function () { card.style.visibility = ""; });
})();
