/* HOMYO · Pro · Ajustes y Soporte con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var page = (window.PRO_PAGE || {}).active;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(m) { if (window.homyoToast) window.homyoToast(m); }

  /* ================= AJUSTES ================= */
  if (page === "ajustes") {
    // Lo que todavía no funciona de verdad se oculta en modo real
    ["email", "dispo"].forEach(function (id) { var s = document.getElementById(id); if (s) s.classList.add("hmHidden"); var a = $('#setNav a[href="#' + id + '"]'); if (a) a.classList.add("hmHidden"); });
    var sec = $("#seguridad"); $$(".toggleRow", sec).forEach(function (r) { r.classList.add("hmHidden"); });
    var notif = $("#notif"); var fact = $$(".toggleRow", notif)[3]; if (fact) fact.classList.add("hmHidden");
    $(".sub", notif).textContent = "Elige qué avisos quieres ver en la campana y en el centro de notificaciones.";
    var cu = $("#cuenta"), ins = $$(".input", cu), save = $("button.btn.primary", cu);
    var fName = ins[0], fMail = ins[1], fTel = ins[2], fLang = ins[3];
    ins.forEach(function (i) { i.value = ""; i.disabled = true; });
    fLang.closest(".field").classList.add("hmHidden");
    var pwBtn = $("button", sec);
    var tg = $$('.toggleRow input[type="checkbox"]', notif), KEYS = ["contactos", "revision", "calidad"];

    H.ready.then(function (ctx) {
      var u = ctx.user, md = u.user_metadata || {}, prefs = md.notif_prefs || {};
      fName.value = (ctx.profile && ctx.profile.full_name) || md.full_name || "";
      fMail.value = u.email || ""; fTel.value = md.phone || "";
      [fName, fMail, fTel].forEach(function (i) { i.disabled = false; });
      tg.slice(0, 3).forEach(function (cb, i) { cb.checked = prefs[KEYS[i]] !== false; });
      if (u.new_email) $(".sub", cu).insertAdjacentHTML("afterend", '<p class="fieldHint" style="color:var(--granate)">Cambio de email pendiente: confirma el enlace enviado a ' + esc(u.new_email) + '.</p>');

      save.addEventListener("click", async function () {
        var name = fName.value.trim(), mail = fMail.value.trim().toLowerCase(), tel = fTel.value.trim();
        if (!name) { toast("Escribe tu nombre"); fName.focus(); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { toast("El email no es válido"); fMail.focus(); return; }
        save.disabled = true; save.textContent = "Guardando…";
        try {
          var upd = { data: { full_name: name, phone: tel } };
          var mailChanged = mail !== (u.email || "").toLowerCase();
          if (mailChanged) upd.email = mail;
          var r = await H.sb.auth.updateUser(upd, mailChanged ? { emailRedirectTo: new URL("cuenta-inmobiliaria.html", location.href).href } : undefined);
          if (r.error) throw r.error;
          var p = await H.sb.from("profiles").update({ full_name: name }).eq("id", u.id);
          if (p.error) throw p.error;
          u = r.data.user || u;
          toast(mailChanged ? "Te hemos enviado un enlace a " + mail + " para confirmar el cambio" : "Datos guardados");
        } catch (e) { toast("No se ha podido guardar: " + (e.message || "error")); }
        save.disabled = false; save.textContent = "Guardar";
      });

      tg.slice(0, 3).forEach(function (cb) {
        cb.addEventListener("change", function () {
          var p = {}; tg.slice(0, 3).forEach(function (x, i) { p[KEYS[i]] = x.checked; });
          H.sb.auth.updateUser({ data: { notif_prefs: p } }).then(function (r) { toast(r.error ? "No se ha podido guardar" : "Preferencias guardadas"); });
        });
      });

      pwBtn.addEventListener("click", function () {
        var w = document.createElement("div"); w.className = "hDlg";
        w.innerHTML = '<div class="hDlgBox" role="dialog" aria-modal="true" aria-labelledby="pwT"><h3 id="pwT">Cambiar contraseña</h3><p class="hDlgP">Mínimo 10 caracteres.</p>' +
          '<label class="hDlgF"><span>Nueva contraseña</span><input class="input" type="password" id="pw1" autocomplete="new-password" /></label>' +
          '<label class="hDlgF"><span>Repite la contraseña</span><input class="input" type="password" id="pw2" autocomplete="new-password" /></label>' +
          '<p class="hDlgP" id="pwErr" style="color:var(--danger);display:none"></p>' +
          '<div class="hDlgA"><button class="btn ghost sm" type="button" data-r="0">Cancelar</button><button class="btn primary sm" type="button" data-r="1">Cambiar contraseña</button></div></div>';
        document.body.appendChild(w); $("#pw1", w).focus();
        function err(t) { var e = $("#pwErr", w); e.textContent = t; e.style.display = ""; }
        w.addEventListener("click", function (e) {
          var b = e.target.closest("[data-r]"); if (!b && e.target !== w) return;
          if (!b || b.dataset.r === "0") { w.remove(); return; }
          var a = $("#pw1", w).value, c = $("#pw2", w).value;
          if (a.length < 10) return err("La contraseña debe tener al menos 10 caracteres.");
          if (a !== c) return err("Las contraseñas no coinciden.");
          b.disabled = true;
          H.sb.auth.updateUser({ password: a }).then(function (r) {
            b.disabled = false;
            if (r.error) return err(/reauth|nonce/i.test(r.error.message) ? "Por seguridad, cierra sesión y vuelve a entrar antes de cambiar la contraseña." : /same|different/i.test(r.error.message) ? "La nueva contraseña debe ser distinta de la actual." : r.error.message);
            w.remove(); toast("Contraseña cambiada");
          });
        });
      });

      $("#baja button").addEventListener("click", function () {
        if (ctx.role !== "admin") { toast("Solo un administrador puede pedir la baja de la cuenta"); return; }
        window.homyoConfirm({ title: "¿Solicitar la baja?", body: "Enviaremos la solicitud al equipo de Homyo, que te contactará para confirmarla. Hasta entonces tu cuenta sigue activa.", ok: "Enviar solicitud", danger: true }).then(function (ok) {
          if (!ok) return;
          H.sb.rpc("support_open", { p_subject: "Solicitud de baja de la cuenta", p_category: "baja", p_body: "Solicito la baja de la cuenta profesional de " + (ctx.agency.name || "") + "." }).then(function (r) {
            if (r.error) { toast(/support_open/.test(r.error.message) ? "Falta ejecutar supabase/09-soporte.sql" : "No se ha podido enviar: " + r.error.message); return; }
            toast("Solicitud enviada · la verás en Soporte");
          });
        });
      });
    });
  }

  /* ================= SOPORTE ================= */
  if (page === "soporte") {
    var CATS = { estandar: "Estándar de publicación", vivienda: "Una vivienda concreta", cuenta: "Mi cuenta o equipo", facturacion: "Facturación", baja: "Baja de la cuenta", otro: "Otro" };
    var ST = { open: ["warnp", "Esperando respuesta"], answered: ["ok", "Respondida"], closed: ["neutral", "Cerrada"] };
    var aside = $(".twoCol aside");
    aside.innerHTML = '<div class="card"><p class="cardLabel">Abrir una consulta</p><form id="supForm" class="stack-sm" style="gap:12px">' +
      '<label class="field"><span class="fieldLabel">Tema</span><select class="input" id="supCat">' + Object.keys(CATS).filter(function (k) { return k !== "baja"; }).map(function (k) { return '<option value="' + k + '">' + CATS[k] + '</option>'; }).join("") + '</select></label>' +
      '<label class="field"><span class="fieldLabel">Asunto</span><input class="input" id="supSub" maxlength="120" placeholder="Ej. No puedo subir el plano" /></label>' +
      '<label class="field"><span class="fieldLabel">Mensaje</span><textarea class="input" id="supBody" maxlength="3000" style="min-height:120px" placeholder="Cuéntanos qué necesitas. Si es sobre una vivienda, indica su dirección o referencia."></textarea></label>' +
      '<button class="btn primary block" type="submit">Enviar consulta</button></form>' +
      '<p class="fieldHint" style="margin-top:10px">Te responde el equipo de Homyo aquí mismo, normalmente en menos de 24 h laborables.</p></div>' +
      '<div class="card"><p class="cardLabel">Tus consultas</p><div id="supList"><p class="muted" style="margin:0;font-size:13px">Cargando…</p></div></div>';
    var list = [], open = null;
    function load() {
      return H.ready.then(function () { return H.sb.from("support_threads").select("id,subject,category,status,user_unread,created_at,last_message_at,support_messages(id,sender,author_name,body,created_at)").order("last_message_at", { ascending: false }); })
        .then(function (r) {
          if (r.error) { $("#supList").innerHTML = '<p class="muted" style="margin:0;font-size:13px">' + (/support_threads/.test(r.error.message) ? "Falta ejecutar supabase/09-soporte.sql." : esc(r.error.message)) + '</p>'; return; }
          list = r.data || []; draw();
        });
    }
    function draw() {
      $("#supList").innerHTML = list.length ? list.map(function (t) {
        var s = ST[t.status] || ST.open, isOpen = open === t.id;
        var msgs = (t.support_messages || []).slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        return '<div style="border-top:1px solid var(--lineSoft);padding:12px 0"><button type="button" data-open="' + t.id + '" style="all:unset;cursor:pointer;display:flex;gap:10px;align-items:flex-start;width:100%"><span style="flex:1 1 auto;min-width:0"><span class="strong" style="display:block;font-size:13.5px">' + esc(t.subject) + (t.user_unread ? ' <span class="pill ok sm">Nueva respuesta</span>' : '') + '</span><span class="muted" style="font-size:12px">' + (CATS[t.category] || "Otro") + ' · ' + H.fmt.ago(t.last_message_at) + '</span></span><span class="pill ' + s[0] + '">' + s[1] + '</span></button>' +
          (isOpen ? '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' + msgs.map(function (m) {
            var me = m.sender === "user";
            return '<div style="align-self:' + (me ? "flex-end" : "flex-start") + ';max-width:90%;padding:10px 12px;border-radius:10px;font-size:13.5px;line-height:1.5;white-space:pre-line;background:' + (me ? "var(--cardWarm)" : "var(--bg)") + ';border:1px solid var(--line)"><span style="display:block;font-size:11px;font-weight:600;color:var(--muted);margin-bottom:2px">' + esc(me ? "Tú" : (m.author_name || "Equipo Homyo")) + ' · ' + H.fmt.ago(m.created_at).toLowerCase() + '</span>' + esc(m.body) + '</div>';
          }).join("") + (t.status !== "closed" ? '<form data-reply="' + t.id + '" style="display:flex;flex-direction:column;gap:8px"><textarea class="input" style="min-height:70px" placeholder="Responder…"></textarea><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost sm" type="button" data-close="' + t.id + '">Cerrar consulta</button><button class="btn primary sm" type="submit">Enviar</button></div></form>' : '') + '</div>' : '') + '</div>';
      }).join("") : '<p class="muted" style="margin:0;font-size:13px">Todavía no has abierto ninguna consulta.</p>';
    }
    aside.addEventListener("click", function (e) {
      var o = e.target.closest("[data-open]");
      if (o) { open = open === o.dataset.open ? null : o.dataset.open; draw(); var t = list.filter(function (x) { return x.id === open; })[0]; if (t && t.user_unread) { t.user_unread = 0; H.sb.rpc("support_set", { p_thread: t.id }); } return; }
      var c = e.target.closest("[data-close]");
      if (c) H.sb.rpc("support_set", { p_thread: c.dataset.close, p_status: "closed" }).then(function (r) { if (r.error) toast(r.error.message); else { toast("Consulta cerrada"); load(); } });
    });
    aside.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (f.id === "supForm") {
        var sub = $("#supSub").value.trim(), body = $("#supBody").value.trim();
        if (!sub || !body) { toast("Escribe el asunto y el mensaje"); return; }
        var b = $("button", f); b.disabled = true;
        H.sb.rpc("support_open", { p_subject: sub, p_category: $("#supCat").value, p_body: body }).then(function (r) {
          b.disabled = false;
          if (r.error) { toast(/support_open/.test(r.error.message) ? "Falta ejecutar supabase/09-soporte.sql" : "No se ha podido enviar: " + r.error.message); return; }
          f.reset(); open = r.data; toast("Consulta enviada al equipo de Homyo"); load();
        });
      } else if (f.dataset.reply) {
        var ta = $("textarea", f), v = ta.value.trim(); if (!v) return;
        H.sb.rpc("support_reply", { p_thread: f.dataset.reply, p_body: v }).then(function (r) { if (r.error) toast("No se ha podido enviar: " + r.error.message); else load(); });
      }
    });
    load();
    setInterval(function () { if (!document.hidden && !document.activeElement.closest("form")) load(); }, 30000);
  }
})();
