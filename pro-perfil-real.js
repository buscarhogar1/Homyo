/* HOMYO · Perfil de la inmobiliaria con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ini(n) { return String(n || "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "·"; }

  var fields = $$("[data-a]");
  fields.forEach(function (f) { f.value = ""; f.disabled = true; });
  $("#pfDocs").classList.add("hmHidden");
  $("#pfTeam").innerHTML = ""; $("#pfTeamTxt").textContent = "Cargando…";
  $("#pfLogo").textContent = "";
  var save = $("#pfSave"); save.disabled = true;
  var zones = [], logoUrl = null, logoBlob = null, agency = null, dirty = false;

  function renderZones() {
    $("#pfZones").innerHTML = zones.map(function (z, i) { return '<span class="chip">' + esc(z) + ' <span class="x" data-i="' + i + '" role="button" aria-label="Quitar ' + esc(z) + '">×</span></span>'; }).join("") +
      '<span class="chip chipAdd" id="pfZoneAdd" role="button">+ Añadir zona</span>';
  }
  $("#pfZones").addEventListener("click", function (e) {
    var x = e.target.closest(".x");
    if (x) { zones.splice(+x.dataset.i, 1); dirty = true; renderZones(); return; }
    var add = e.target.closest("#pfZoneAdd");
    if (!add) return;
    add.outerHTML = '<input class="input" id="pfZoneIn" placeholder="Barrio o municipio" style="width:190px;padding:6px 12px;border-radius:999px;font-size:13px" />';
    var inp = $("#pfZoneIn"); inp.focus();
    var commit = function () { var v = inp.value.trim(); if (v && zones.indexOf(v) < 0) { zones.push(v); dirty = true; } renderZones(); };
    inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); commit(); } else if (ev.key === "Escape") renderZones(); });
    inp.addEventListener("blur", commit);
  });
  function setLogo(url) {
    var b = $("#pfLogo");
    if (url) b.innerHTML = '<img src="' + esc(url) + '" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit" />';
    else b.textContent = ini(agency && agency.name);
  }
  $("#pfLogoBtn").addEventListener("click", function () { $("#pfLogoIn").click(); });
  $("#pfLogoIn").addEventListener("change", function () {
    var f = this.files[0]; this.value = "";
    if (!f) return;
    if (f.size > 5 * 1048576) { window.homyoToast("El logo pesa demasiado (máx. 5 MB)"); return; }
    logoBlob = f; dirty = true; setLogo(URL.createObjectURL(f));
  });
  document.addEventListener("input", function (e) { if (e.target.closest && e.target.closest("[data-a]")) dirty = true; });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  H.ready.then(function (ctx) {
    agency = ctx.agency || {};
    fields.forEach(function (f) {
      var v = agency[f.dataset.a];
      if (f.dataset.a === "phone" && v) v = String(v).replace(/^\+34\s*/, "");
      f.value = v == null ? "" : v; f.disabled = false;
    });
    zones = (agency.zones || []).slice(); renderZones();
    logoUrl = agency.logo_url || null; setLogo(logoUrl);
    save.disabled = false;
    $(".pageLede").textContent = "Estos datos definen la ficha pública de " + (agency.name || "tu inmobiliaria") + " en Homyo.";
    if (!H.isAgencyAdmin()) {
      fields.forEach(function (f) { f.disabled = true; });
      save.classList.add("hmHidden"); $("#pfLogoBtn").classList.add("hmHidden");
      $$("#pfZones .x, #pfZoneAdd").forEach(function (x) { x.remove(); });
      $(".pageLede").insertAdjacentHTML("afterend", '<p class="pageLede" style="color:var(--granate);margin-top:6px">Solo un administrador de la inmobiliaria puede editar estos datos.</p>');
    }
    return H.sb.rpc("my_agency_team").then(function (r) {
      var T = r.data || [];
      $("#pfTeam").innerHTML = T.slice(0, 5).map(function (m) { return '<span class="av" title="' + esc(m.full_name || m.email) + '">' + ini(m.full_name || m.email) + '</span>'; }).join("");
      $("#pfTeamTxt").textContent = r.error ? "Falta ejecutar supabase/05-perfil-equipo.sql" : T.length === 1 ? "Solo tú tienes acceso por ahora." : T.length + " usuarios con acceso.";
    });
  }).catch(function (e) { window.homyoToast("No se ha podido cargar el perfil: " + (e.message || "error")); });

  save.addEventListener("click", async function () {
    var name = $('[data-a="name"]').value.trim();
    if (!name) { window.homyoToast("El nombre comercial es obligatorio"); $('[data-a="name"]').focus(); return; }
    var mail = $('[data-a="email"]').value.trim();
    if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { window.homyoToast("El email público no es válido"); $('[data-a="email"]').focus(); return; }
    save.disabled = true; save.textContent = "Guardando…";
    try {
      var row = {};
      fields.forEach(function (f) { var v = f.value.trim(); row[f.dataset.a] = v || null; });
      if (row.phone) row.phone = "+34 " + row.phone.replace(/^\+34\s*/, "");
      if (row.website && !/^https?:\/\//i.test(row.website)) row.website = "https://" + row.website;
      row.zones = zones;
      if (logoBlob) {
        var ext = (logoBlob.type.split("/")[1] || "png").replace("svg+xml", "svg");
        var path = agency.id + "/logo-" + Date.now().toString(36) + "." + ext;
        var st = H.sb.storage.from("agency-logos");
        var up = await st.upload(path, logoBlob, { contentType: logoBlob.type, upsert: true });
        if (up.error) throw up.error;
        row.logo_url = st.getPublicUrl(path).data.publicUrl;
      }
      var r = await H.sb.from("agencies").update(row).eq("id", agency.id).select().maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) throw new Error("Supabase no ha permitido guardar. Revisa que hayas ejecutado 02-permisos.sql.");
      Object.assign(agency, r.data); logoBlob = null; dirty = false;
      $$(".sbAgencyName,[data-hm-agency]").forEach(function (el) { el.textContent = agency.name; });
      window.homyoToast("Perfil guardado");
    } catch (e) {
      var m = (e && e.message) || "error";
      if (/api_number|zones/.test(m)) m = "Falta ejecutar supabase/05-perfil-equipo.sql en Supabase.";
      window.homyoToast("No se ha podido guardar: " + m);
    }
    save.disabled = false; save.textContent = "Guardar cambios";
  });
})();
