/* HOMYO · Revisión de calidad de una vivienda con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var main = $(".proMain");
  var id = new URLSearchParams(location.search).get("id");
  if (!id) { location.replace("pro-viviendas.html"); return; }
  var back = $("a.btnLink", main);
  Array.prototype.forEach.call(main.children, function (el) { if (el !== back) el.classList.add("hmHidden"); });
  main.insertAdjacentHTML("beforeend", '<p class="muted" id="hmLoad" style="padding:30px 0">Cargando la vivienda…</p>');

  var IC = {
    block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>'
  };
  var ST = { pub: ["ok", "Publicada"], upd: ["warnp", "Necesita actualización"], draft: ["neutral", "Borrador"], off: ["neutral", "Retirada"], rej: ["dangerp", "Rechazada"] };

  H.proListing(id).then(function (E) {
    var l = E.listing, p = E.property, d = E.details, desc = d.description || {};
    var st = E.state;
    if (st === "draft" && E.review && E.review.decision === "rejected") st = "rej";
    var edit = "pro-subir-vivienda.html?id=" + l.id;
    var price = l.price_eur ? H.fmt.eur(l.price_eur) + (E.op === "venta" ? "" : "/mes") : "—";
    var minPh = E.op === "habitacion" ? 6 : 5 + Math.max(1, p.bedrooms || 1);
    var nPh = E.photos.length || (l.main_photo_url ? 1 : 0);
    var cert = l.energy_label || p.energy_label;
    var certPend = (l.energy_label_status || p.energy_label_status) === "pending";
    var R = { block: [], warn: [], ok: [] };
    function add(kind, t, txt, act) { R[kind].push({ t: t, p: txt, act: act }); }
    var fix = function (lbl) { return '<a class="btn ghost sm act" href="' + edit + '">' + lbl + '</a>'; };
    if (E.plans.length) add("ok", "Plano en planta", "Subido. Homyo revisa que siga el estándar visual.");
    else add("block", "Falta plano en planta", "El plano es obligatorio para publicar en Homyo. Súbelo en el paso 4 del asistente.", fix("Subir plano"));
    if (nPh >= minPh) add("ok", nPh + " fotografías subidas", "Por encima del mínimo de " + minPh + ".");
    else add("block", "Solo " + nPh + " de " + minPh + " fotografías", "Necesitas al menos una foto por dormitorio, además de fachada, salón, cocina, baño y exterior.", fix("Añadir fotos"));
    if (cert) add("ok", "Certificado energético", "Aportado · letra " + cert + (d.emissions_letter ? " · emisiones " + d.emissions_letter : "") + ".");
    else if (certPend) add("warn", "Certificado energético en trámite", "Se puede publicar con aviso al usuario hasta que lo aportes.");
    else add("block", "Falta certificado energético", "La ley exige mostrar la calificación energética en todo anuncio.", fix("Añadir certificado"));
    if (p.cadastre_ref) add("ok", "Referencia catastral", p.cadastre_ref + (p.source === "catastro" ? " · verificada en Catastro" : " · revisión manual"));
    else add("block", "Falta la referencia catastral", "Nos permite validar la vivienda y evitar duplicados.", fix("Añadirla"));
    if (l.price_eur) add("ok", "Precio definido", price + ".");
    else add("block", "Falta el precio", "No se puede publicar sin precio.", fix("Añadir precio"));
    if (p.useful_area_m2) add("ok", "Superficie útil declarada", p.useful_area_m2 + " m² útiles" + (p.built_area_m2 ? " · " + p.built_area_m2 + " m² construidos" : "") + (d.ext_m2 ? " · " + d.ext_m2 + " m² exterior aparte" : "") + ".");
    else add("block", "Falta la superficie útil", "Es uno de los datos que más filtran los compradores.", fix("Añadir superficie"));
    if (E.op !== "habitacion") {
      if (p.bedrooms && p.bathrooms) add("ok", "Dormitorios y baños", p.bedrooms + " dormitorios · " + p.bathrooms + " baños.");
      else add("warn", "Faltan dormitorios o baños", "Sin estos datos la vivienda no aparece al filtrar por ellos.", fix("Completar"));
      var miss = [];
      if (!p.outdoor_space_type) miss.push("exterior"); if (!p.parking_type) miss.push("parking"); if (!p.storage_type) miss.push("trastero");
      if (miss.length) add("warn", "Ficha incompleta", "Falta: " + miss.join(", ") + ". Son filtros del buscador.", fix("Completar"));
      else add("ok", "Ficha mínima completa", "Exterior, parking y trastero declarados.");
    }
    if (desc["Resumen de la vivienda"]) add("ok", "Descripción", "Resumen completo" + (desc["Distribución"] ? " y distribución." : "."));
    else add("warn", "Sin resumen de la vivienda", "Un resumen claro mejora el interés del anuncio.", fix("Escribir"));
    if (!desc["Entorno"]) add("warn", "Descripción del entorno vacía", "Añadir transporte y servicios cercanos ayuda a decidir.");
    if (st === "upd") add("warn", "Confirma que sigue disponible", "Lleva más de 60 días sin confirmar. Si no lo haces, dejará de mostrarse.", '<a class="btn ghost sm act" href="pro-viviendas.html?f=upd">Confirmar</a>');
    if (nPh >= minPh && nPh < 10) add("warn", "Pocas fotografías", "Los anuncios con 10 o más fotos generan más contactos.");

    var total = R.block.length + R.warn.length + R.ok.length;
    var score = Math.round((R.ok.length + R.warn.length * 0.5) / total * 100);
    var off = Math.round(264 * (1 - score / 100));
    var head = R.block.length ? "Aún no se puede publicar" : st === "pub" || st === "upd" ? "Anuncio publicado" : "Lista para publicar";
    var body = R.block.length
      ? "Tiene <strong>" + R.block.length + (R.block.length === 1 ? " requisito bloqueante" : " requisitos bloqueantes") + "</strong> sin resolver."
      : R.warn.length ? "Cumple el estándar. Hay " + R.warn.length + (R.warn.length === 1 ? " recomendación" : " recomendaciones") + " para mejorarla." : "Cumple todo el estándar de calidad de Homyo.";
    body += " La puntuación mide la integridad del anuncio, no su posición: en Homyo no se puede mejorar la visibilidad pagando.";
    function list(kind) {
      return R[kind].map(function (r) { return '<li class="reqItem ri-' + kind + '"><span class="ri">' + IC[kind] + '</span><div><h5>' + esc(r.t) + '</h5><p>' + esc(r.p) + '</p></div>' + (r.act || "") + '</li>'; }).join("");
    }
    function group(kind, title, bg, fg) {
      if (!R[kind].length) return "";
      return '<div class="groupTitle">' + title + ' <span class="gc" style="background:' + bg + ';color:' + fg + '">' + R[kind].length + '</span></div><ul class="reqList">' + list(kind) + '</ul>';
    }
    var mayEdit = H.canEdit(l);
    var canPublish = mayEdit && !R.block.length && l.status === "draft";
    var actions = (mayEdit ? '<a class="btn ghost" href="' + edit + '">Editar vivienda</a>' : '<span class="pill neutral">Solo lectura</span>') + (canPublish ? '<button class="btn primary" type="button" id="hmPub">Publicar</button>' : "");
    if (!mayEdit) Object.keys(R).forEach(function (k) { R[k].forEach(function (r) { r.act = ""; }); });
    var thumb = l.main_photo_url ? ' style="background:url(\'' + String(l.main_photo_url).replace(/'/g, "%27") + '\') center/cover"' : "";
    var rej = st === "rej" ? '<div class="callout dangerc" style="margin-bottom:22px"><span class="cIc">' + IC.block + '</span><div><h4>Homyo rechazó esta vivienda · ' + H.fmt.date(E.review.reviewed_at) + '</h4><p style="white-space:pre-line">' + esc(E.review.message || "Revisa los requisitos bloqueantes.") + '</p></div><a class="btn ghost sm cAct" href="' + edit + '">Corregir</a></div>' : "";
    var specs = [];
    if (p.useful_area_m2) specs.push('<span class="pvSpec"><b>' + p.useful_area_m2 + ' m²</b>útil interior</span>');
    if (d.ext_m2) specs.push('<span class="pvSpec"><b>' + d.ext_m2 + ' m²</b>exterior</span>');
    if (p.bedrooms) specs.push('<span class="pvSpec"><b>' + p.bedrooms + '</b>dorm.</span>');
    if (p.bathrooms) specs.push('<span class="pvSpec"><b>' + p.bathrooms + '</b>baños</span>');
    var zone = [p.neighborhood, p.city].filter(Boolean).join(", ");

    $("#hmLoad").remove();
    main.insertAdjacentHTML("beforeend",
      '<section class="card" style="margin-bottom:14px;"><div class="listHead"><span class="listThumb"' + thumb + '></span><div><p class="kicker" style="margin-bottom:8px;">Revisión de calidad</p><h2>' + esc(E.addr) + '</h2><div class="listMeta">' +
        '<span class="pill ' + ST[st][0] + '"><span class="dot"></span>' + ST[st][1] + '</span>' +
        (zone ? '<span class="pill neutral">' + esc(zone) + '</span>' : '') +
        (p.cadastre_ref ? '<span class="pill neutral">Ref. ' + esc(p.cadastre_ref) + '</span>' : '') +
        '<span class="pill neutral">' + price + '</span></div></div><div class="lhActions">' + actions + '</div></div></section>' +
      rej +
      '<section class="card warm" style="margin-bottom:26px;"><div class="scoreBand"><div class="ring"><svg width="96" height="96"><circle cx="48" cy="48" r="42" fill="none" stroke="var(--lineSoft)" stroke-width="8"/><circle cx="48" cy="48" r="42" fill="none" stroke="' + (R.block.length ? "var(--dorado)" : "var(--good)") + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="' + off + '"/></svg><span class="pct">' + score + '</span></div>' +
        '<div class="scoreBody"><h3>' + head + '</h3><p>' + body + '</p></div>' +
        '<div class="scoreLegend" style="flex-direction:column; gap:9px;"><span><span class="d" style="background:var(--danger)"></span>' + R.block.length + (R.block.length === 1 ? " bloqueante" : " bloqueantes") + '</span><span><span class="d" style="background:var(--warn)"></span>' + R.warn.length + (R.warn.length === 1 ? " recomendación" : " recomendaciones") + '</span><span><span class="d" style="background:var(--good)"></span>' + R.ok.length + (R.ok.length === 1 ? " correcto" : " correctos") + '</span></div></div></section>' +
      '<div class="twoCol"><div>' +
        group("block", "Requisitos bloqueantes", "var(--dangerSoft)", "var(--danger)") +
        group("warn", "Recomendaciones de mejora", "var(--warnSoft)", "var(--warn)") +
        group("ok", "Información completa", "var(--goodSoft)", "var(--good)") +
      '</div><div><div class="previewCard"><div class="pvHead"><span class="t">Vista previa pública</span>' + (l.status === "published" ? '<a class="btnLink" href="listing.html?id=' + l.id + '" target="_blank" rel="noopener">Abrir</a>' : '') + '</div>' +
        '<div class="pvImg"' + thumb + '><span class="badge pill solid" style="background:var(--granate);color:#fff;">' + ST[st][1] + '</span></div>' +
        '<div class="pvBody"><div class="pvPrice">' + price + '</div><div class="pvAddr">' + esc(E.addr.replace(" · ", " en ")) + (zone ? " · " + esc(zone) : "") + '</div>' +
        (specs.length ? '<div class="pvSpecs">' + specs.join("") + '</div>' : '') +
        (R.block.length ? '<div class="pvWatermark">' + IC.block.replace('stroke="currentColor"', 'stroke="var(--danger)" width="16" height="16"') + 'No visible para compradores hasta resolver los bloqueantes</div>' : '') +
      '</div></div></div></div>');
    var cr = $(".tbCrumb"); if (cr) cr.textContent = "Viviendas · " + E.addr;
    var pb = $("#hmPub");
    if (pb) pb.addEventListener("click", function () {
      pb.disabled = true; pb.textContent = "Publicando…";
      H.proPublish(l.id).then(function () {
        try { sessionStorage.setItem("homyo_pro_flash", "Vivienda publicada en Homyo"); } catch (e) {}
        location.href = "pro-viviendas.html";
      }).catch(function (e) { pb.disabled = false; pb.textContent = "Publicar"; window.homyoToast("No se ha podido publicar: " + (e.message || "error")); });
    });
  }).catch(function (e) {
    $("#hmLoad").textContent = "No se ha podido cargar la vivienda: " + ((e && e.message) || "error");
  });
})();
