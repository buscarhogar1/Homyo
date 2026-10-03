/* HOMYO · Equipo de la inmobiliaria con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ini(n) { return String(n || "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "·"; }
  var ROLE = { agency_admin: "Administrador", agent: "Agente", viewer: "Solo lectura" };
  var FROM_LABEL = { "Administrador": "agency_admin", "Agente": "agent", "Solo lectura": "viewer" };
  function roleKey(r) { return r === "editor" ? "agent" : ROLE[r] ? r : "agency_admin"; }
  var EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';

  var body = $("#eqBody"), pend = $("#eqPend");
  body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">Cargando equipo…</td></tr>';
  pend.innerHTML = "";
  var me = null, isAdmin = false, team = [], invites = [];

  function when(d) { return d ? H.fmt.ago(d) : "Nunca ha entrado"; }
  function render() {
    body.innerHTML = team.map(function (m) {
      var k = roleKey(m.role), mine = me && m.id === me.id;
      var acts = mine ? '<span class="muted" style="font-size:12px;">Tú</span>' : isAdmin ? '<div class="rowActions"><button class="iconBtn" type="button" title="Cambiar rol" data-role="' + m.id + '">' + EDIT + '</button><button class="iconBtn" type="button" title="Quitar del equipo" data-del="' + m.id + '">' + DEL + '</button></div>' : '';
      return '<tr><td class="noLabel"><div class="memCell"><span class="memAv">' + ini(m.full_name || m.email) + '</span><span><span class="mn">' + esc(m.full_name || m.email) + '</span><div class="me">' + esc(m.email || "") + '</div></span></div></td>' +
        '<td data-th="Rol">' + (k === "agency_admin" ? '<span class="pill solid" style="background:var(--granate);color:#fff;">' + ROLE[k] + '</span>' : '<span class="pill neutral">' + ROLE[k] + '</span>') + '</td>' +
        '<td data-th="Última actividad">' + when(m.last_sign_in_at) + '</td>' +
        '<td data-th="Estado"><span class="pill ok"><span class="dot"></span>Activo</span></td>' +
        '<td class="noLabel">' + acts + '</td></tr>';
    }).join("");
    $("#eqPendHead").classList.toggle("hide", !invites.length);
    pend.innerHTML = invites.map(function (i) {
      return '<div class="pendItem"><span class="pe"><b>' + esc(i.email) + '</b> · invitado como ' + ROLE[roleKey(i.role)] + ' · ' + H.fmt.ago(i.created_at).toLowerCase() + '</span><span class="pill warnp"><span class="dot"></span>Pendiente</span>' +
        (isAdmin ? '<div class="rowActions"><button class="btn danger sm" type="button" data-cancel="' + i.id + '">Cancelar</button></div>' : '<span></span>') + '</div>';
    }).join("");
    var solo = team.length <= 1 && !invites.length;
    $("#viewSolo").classList.toggle("hide", !solo);
    $("#viewTeam").classList.toggle("hide", solo);
    var cr = $(".tbCrumb"); if (cr) cr.innerHTML = '<span data-hm-agency>' + esc((H.ctx.agency || {}).name || "") + '</span> · ' + team.length + (team.length === 1 ? " miembro" : " miembros");
    var inv = $("#eqInvite"); inv.closest(".card").classList.toggle("hmHidden", !isAdmin);
    $("#invitar").classList.toggle("hmHidden", !isAdmin);
    var hb = document.querySelector('.pageHeadActions a[href="#invitar"]'); if (hb) hb.classList.toggle("hmHidden", !isAdmin);
  }

  function load() {
    return H.ready.then(function (ctx) {
      me = ctx.user;
      return Promise.all([H.sb.rpc("my_agency_team"), H.sb.rpc("my_agency_is_admin"), H.sb.from("agency_invites").select("id,email,role,created_at").is("accepted_at", null).order("created_at", { ascending: false })]);
    }).then(function (r) {
      if (r[0].error) throw r[0].error;
      team = r[0].data || [];
      isAdmin = r[1].error ? true : !!r[1].data;
      invites = r[2].error ? [] : (r[2].data || []);
      if (r[1].error || r[2].error) window.homyoToast("Falta ejecutar supabase/05-perfil-equipo.sql para gestionar el equipo");
      render();
    }).catch(function (e) {
      body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">No se ha podido cargar el equipo (' + esc((e && e.message) || "error") + ').</td></tr>';
    });
  }
  load();

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-role],[data-del],[data-cancel]"); if (!b) return;
    if (b.dataset.role) {
      var m = team.filter(function (x) { return x.id === b.dataset.role; })[0];
      window.homyoConfirm({ title: "Cambiar rol", body: (m.full_name || m.email) + " tendrá los permisos del rol que elijas.", ok: "Guardar", field: { label: "Rol", options: ["Agente", "Solo lectura", "Administrador"] } }).then(function (lbl) {
        if (!lbl) return;
        H.sb.rpc("agency_set_member_role", { p_user_id: m.id, p_role: FROM_LABEL[lbl] }).then(function (r) {
          if (r.error) throw r.error;
          m.role = FROM_LABEL[lbl]; render(); window.homyoToast("Rol actualizado · " + lbl);
        }).catch(function (err) { window.homyoToast("No se ha podido cambiar: " + err.message); });
      });
    } else if (b.dataset.del) {
      var d = team.filter(function (x) { return x.id === b.dataset.del; })[0];
      window.homyoConfirm({ title: "¿Quitar del equipo?", body: (d.full_name || d.email) + " dejará de tener acceso a la cuenta profesional. Sus viviendas siguen siendo de la inmobiliaria.", ok: "Quitar", danger: true }).then(function (ok) {
        if (!ok) return;
        H.sb.rpc("agency_remove_member", { p_user_id: d.id }).then(function (r) {
          if (r.error) throw r.error;
          team = team.filter(function (x) { return x.id !== d.id; }); render(); window.homyoToast("Quitado del equipo");
        }).catch(function (err) { window.homyoToast("No se ha podido quitar: " + err.message); });
      });
    } else if (b.dataset.cancel) {
      H.sb.from("agency_invites").delete().eq("id", b.dataset.cancel).then(function (r) {
        if (r.error) { window.homyoToast("No se ha podido cancelar: " + r.error.message); return; }
        invites = invites.filter(function (x) { return x.id !== b.dataset.cancel; }); render(); window.homyoToast("Invitación cancelada");
      });
    }
  });

  $("#eqInvite").addEventListener("submit", function () {
    var email = $("#eqEmail").value.trim().toLowerCase(), role = FROM_LABEL[$("#eqRole").value] || "agent";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { window.homyoToast("Escribe un email válido"); $("#eqEmail").focus(); return; }
    if (team.some(function (m) { return (m.email || "").toLowerCase() === email; })) { window.homyoToast("Esa persona ya está en tu equipo"); return; }
    var btn = $("#eqInvite button"); btn.disabled = true; btn.textContent = "Enviando…";
    var redirectTo = new URL("pro-invitacion.html", location.href).href;
    function done(row, body) {
      btn.disabled = false; btn.textContent = "Enviar invitación";
      if (row) { invites.unshift(row); $("#eqEmail").value = ""; render(); }
      window.homyoConfirm({ title: row ? "Invitación enviada" : "No se ha podido invitar", body: body, ok: "Entendido", cancel: "Cerrar" });
    }
    function manual() {
      // Sin la función de envío instalada: se guarda la invitación y se avisa a mano
      H.sb.from("agency_invites").insert({ agency_id: H.ctx.agency.id, email: email, role: role }).select().maybeSingle().then(function (r) {
        if (r.error) return done(null, r.error.code === "23505" ? "Ya hay una invitación abierta para ese email." : r.error.message);
        done(r.data, "La invitación está guardada, pero no se ha podido enviar el email (falta instalar la función invite-agency-member en Supabase). Pídele a " + email + " que entre en el acceso profesional con ese email: se unirá automáticamente como " + ROLE[role] + ".");
      });
    }
    H.sb.functions.invoke("invite-agency-member", { body: { email: email, role: role, redirectTo: redirectTo } }).then(function (r) {
      var d = r.data || {};
      if (r.error && !d.error) {
        var st = r.error.context && r.error.context.status;
        if (!st || st === 404) return manual();
        return r.error.context && r.error.context.json ? r.error.context.json().then(function (j) { done(null, (j && j.error) || r.error.message); }, function () { done(null, r.error.message); }) : done(null, r.error.message);
      }
      if (d.error) return done(null, d.error);
      if (d.existing) return done(d.invite, email + " ya tiene cuenta en Homyo. No hace falta email: en cuanto inicie sesión en el acceso profesional se unirá a tu inmobiliaria como " + ROLE[role] + ".");
      if (d.emailError) return done(d.invite, "La invitación está guardada, pero el email no ha salido (" + d.emailError + "). Si se repite, puede ser el límite de emails por hora de Supabase. Pídele que entre en el acceso profesional con ese email.");
      done(d.invite, "Hemos enviado un email a " + email + " con un enlace para crear su contraseña. Al entrar formará parte del equipo como " + ROLE[role] + ".");
    }).catch(manual);
  });
})();
