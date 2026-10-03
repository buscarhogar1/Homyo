/* HOMYO · Admin · Ajustes de la plataforma con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function toast(m) { if (window.homyoToast) homyoToast(m); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var cards = $$(".proMain .card");
  var qual = cards[0], ficha = cards[1], price = cards[2], sec = cards[3], data = cards[4];
  var qRows = $$(".setRow", qual), fRows = $$(".setRow", ficha);
  var M = [
    ["require_plan", $("input", qRows[0]), "bool"],
    ["require_cert", $("input", qRows[1]), "bool"],
    ["min_photos", $("input", qRows[2]), "int", 1, 30],
    ["block_duplicates", $("input", qRows[3]), "bool"],
    ["availability_days", $("input", qRows[4]), "int", 15, 365],
    ["req_common", $("input", fRows[0]), "bool"],
    ["req_buy", $("input", fRows[1]), "bool"],
    ["req_rent", $("input", fRows[2]), "bool"],
    ["req_room", $("input", fRows[3]), "bool"],
    ["price_month", $$("input", price)[0], "num", 0, 999],
    ["founder_months", $$("input", price)[1], "int", 0, 36],
    ["no_leads", $$("input", price)[2], "bool"]
  ];
  $("p", qRows[1]).textContent = "Sin las letras de consumo y emisiones, el anuncio no puede publicarse.";
  $("p", qRows[2]).textContent = "Mínimo para publicar con 1 dormitorio. Se suma 1 foto por cada dormitorio extra.";
  $("p", qRows[3]).textContent = "Avisa en el paso 1 si otra agencia ya tiene publicada esa referencia catastral. Aunque lo desactives, una misma vivienda nunca puede tener dos anuncios activos.";
  $("p", qRows[4]).textContent = "Días sin confirmar a partir de los que se pide confirmar. Si pasan 30 días más sin confirmar, el anuncio se retira solo.";
  price.insertAdjacentHTML("beforeend", '<p class="fieldHint" style="margin-top:12px">Se guardan ya, pero se aplicarán cuando conectemos los pagos con Stripe.</p>');

  // Seguridad: en modo real se entra con cuenta propia
  sec.innerHTML = '<p class="cardLabel" style="color:var(--granate)">Seguridad del acceso interno</p>' +
    '<div class="setRow"><div class="sx"><h4>Atajo de teclado de acceso</h4><p>Teclear <b>homyo</b> o Ctrl/Cmd+Shift+H en la web pública lleva al acceso de dirección.</p></div><label class="switch"><input type="checkbox" id="hmShortcut" /><span class="sl"></span></label></div>' +
    '<div class="setRow"><div class="sx"><h4>Acceso con cuenta propia</h4><p>En modo real cada persona entra con su email y contraseña de Homyo. Quién tiene acceso se gestiona en <a href="admin-equipo.html">Equipo Homyo</a>.</p></div><span class="pill ok"><span class="dot"></span>Activo</span></div>';
  M.push(["shortcut", $("#hmShortcut"), "bool"]);

  // Datos
  data.innerHTML = '<p class="cardLabel">Datos</p>' +
    '<div class="setRow" style="padding-top:6px;"><div class="sx"><h4>Copias de seguridad</h4><p>Las hace Supabase según tu plan (el plan gratuito no incluye copias diarias). Revísalo en Supabase → Database → Backups.</p></div></div>' +
    '<div class="setRow"><div class="sx"><h4>Exportar todos los datos</h4><p>Inmobiliarias, anuncios y usuarios en tres archivos CSV.</p></div><button class="btn ghost sm" type="button" id="hmExport">Exportar</button></div>';
  var danger = $(".proMain .callout.dangerc"); if (danger) danger.classList.add("hmHidden");
  var lede = $(".pageLede"); if (lede) lede.textContent = "Reglas del estándar de calidad, precios y acceso interno. Los cambios se guardan solos y se aplican al momento en Pro y en la moderación.";

  var meta = document.createElement("p");
  meta.className = "fieldHint"; meta.style.margin = "-6px 0 18px";
  $(".pageHead").insertAdjacentElement("afterend", meta);

  function fill(R) {
    M.forEach(function (m) {
      var v = R[m[0]];
      if (m[2] === "bool") m[1].checked = v !== false;
      else m[1].value = m[2] === "num" ? String(v).replace(".", ",") : v;
    });
  }
  function read(m) {
    if (m[2] === "bool") return m[1].checked;
    var n = parseFloat(String(m[1].value).replace(",", "."));
    if (isNaN(n)) return null;
    n = Math.max(m[3], Math.min(m[4], n));
    return m[2] === "int" ? Math.round(n) : Math.round(n * 100) / 100;
  }
  var LABEL = { require_plan: "Plano obligatorio", require_cert: "Certificado obligatorio", min_photos: "Mínimo de fotos", block_duplicates: "Bloquear duplicados", availability_days: "Aviso de disponibilidad", req_common: "Ficha mínima · común", req_buy: "Ficha mínima · venta", req_rent: "Ficha mínima · alquiler", req_room: "Ficha mínima · habitación", price_month: "Precio por vivienda", founder_months: "Periodo fundadora", no_leads: "Sin venta de leads", shortcut: "Atajo de teclado" };
  function stamp(at) { meta.textContent = at ? "Última modificación " + H.fmt.ago(at).toLowerCase() : ""; }

  M.forEach(function (m) {
    m[1].addEventListener("change", function () {
      var v = read(m);
      if (v == null) { fill(H.RULES); return; }
      var patch = {}; patch[m[0]] = v;
      var prev = H.RULES[m[0]];
      H.saveSettings(patch).then(function () {
        fill(H.RULES); stamp(new Date());
        toast(LABEL[m[0]] + " · guardado");
        if (window.homyoAudit) homyoAudit("Ajustes", "Cambió un ajuste", LABEL[m[0]] + ": " + (typeof prev === "boolean" ? (prev ? "sí" : "no") : prev) + " → " + (typeof v === "boolean" ? (v ? "sí" : "no") : v));
      }).catch(function (e) {
        fill(H.RULES);
        var msg = (e && e.message) || "error";
        toast(/platform_settings|relation/i.test(msg) ? "Falta ejecutar supabase/11-ajustes-incidencias.sql" : "No se ha podido guardar: " + msg);
      });
    });
  });

  function csv(name, head, rows) {
    var q = function (v) { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var txt = "\ufeff" + [head].concat(rows).map(function (r) { return r.map(q).join(";"); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = name + ".csv"; document.body.appendChild(a); a.click(); a.remove();
  }
  $("#hmExport").addEventListener("click", function () {
    var b = this; b.disabled = true; b.textContent = "Preparando…";
    H.ready.then(function () {
      return Promise.all([
        H.sb.from("agencies").select("*"),
        H.sb.from("listings").select("id,status,price_eur,listing_mode,listed_at,created_at,agency_id,energy_label,property:properties(cadastre_ref,address_display,city,neighborhood,property_type,useful_area_m2,bedrooms,bathrooms)"),
        H.sb.rpc("admin_list_users")
      ]);
    }).then(function (r) {
      var ag = r[0].data || [], ls = r[1].data || [], us = r[2].data || [], agN = {};
      ag.forEach(function (a) { agN[a.id] = a.name; });
      csv("homyo-inmobiliarias", ["ID", "Nombre", "Razón social", "CIF", "Email", "Teléfono", "Ciudad", "Estado", "Alta"], ag.map(function (a) { return [a.id, a.name, a.legal_name, a.cif, a.email, a.phone, a.city, a.status, (a.created_at || "").slice(0, 10)]; }));
      setTimeout(function () { csv("homyo-anuncios", ["ID", "Estado", "Operación", "Precio", "Inmobiliaria", "Ref. catastral", "Dirección", "Ciudad", "Barrio", "Tipo", "m² útiles", "Dormitorios", "Baños", "Certificado", "Publicado", "Creado"], ls.map(function (l) { var p = l.property || {}; return [l.id, l.status, l.listing_mode, l.price_eur, agN[l.agency_id], p.cadastre_ref, p.address_display, p.city, p.neighborhood, p.property_type, p.useful_area_m2, p.bedrooms, p.bathrooms, l.energy_label, (l.listed_at || "").slice(0, 10), (l.created_at || "").slice(0, 10)]; })); }, 400);
      setTimeout(function () { csv("homyo-usuarios", ["ID", "Email", "Nombre", "Rol", "Inmobiliaria", "Alta", "Última conexión"], us.map(function (u) { return [u.id, u.email, u.full_name, u.role, agN[u.agency_id] || "", (u.created_at || "").slice(0, 10), (u.last_sign_in_at || "").slice(0, 10)]; })); }, 800);
      if (window.homyoAudit) homyoAudit("Ajustes", "Exportó todos los datos", ag.length + " inmobiliarias · " + ls.length + " anuncios · " + us.length + " usuarios");
      toast("Descargando 3 archivos CSV");
    }).catch(function (e) { toast("No se ha podido exportar: " + ((e && e.message) || "error")); })
      .then(function () { b.disabled = false; b.textContent = "Exportar"; });
  });

  fill(H.RULES);
  H.settings().then(function (R) { fill(R); stamp(H.RULES_AT); });
})();
