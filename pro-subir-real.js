/* HOMYO · Subir vivienda con datos reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var RU = H.RULES || {};
  function applyRules() {
    var base = (RU.min_photos || 6) - 1;
    window.photoMin = function () { return base + dormCount(); };
    try { window.phMin = window.photoMin(); var t = document.getElementById("phMinTxt"); if (t) t.textContent = window.phMin + " fotografías"; } catch (e) {}
    if (typeof refreshPublish === "function") refreshPublish();
  }
  if (H.settings) H.settings().then(applyRules);
  function op() { var r = $('input[name="op"]:checked'); return r ? r.value : "buy"; }
  function shown(el) {
    for (var e = el; e && e !== document.body; e = e.parentElement) {
      if (e.classList && e.classList.contains("hide")) return false;
      var o = e.getAttribute && e.getAttribute("data-only");
      if (o && o.split(/\s+/).indexOf(op()) < 0) return false;
    }
    return true;
  }
  function val(k) { var el = $$('[data-k="' + k + '"]').filter(shown)[0]; return el ? el.value.trim() : ""; }
  function int(s) { var n = parseInt(String(s || "").replace(/\D/g, ""), 10); return isNaN(n) ? null : n; }
  function dec(s) { var n = parseFloat(String(s || "").replace(",", ".")); return isNaN(n) ? null : n; }
  function clamp(n, a, b) { return n == null ? null : Math.max(a, Math.min(b, n)); }

  var css = document.createElement("style");
  css.textContent = ".field.hmErr .input,.field.hmErr .seg,.field.hmErr .chipSet{border-color:var(--danger)!important}.field.hmErr .chipSet{border:1px solid;border-radius:6px;padding:6px}.hmErrMsg{margin:6px 0 0;font-size:12px;color:var(--danger);font-weight:600}.hmSaveNote{font-size:12.5px;color:var(--ink2)}";
  document.head.appendChild(css);

  // Ajustes de la UI en modo real
  var fake = $("#fakePlano"); if (fake) fake.remove();
  $$(".wzFoot .hint").forEach(function (h) { if (/borrador se guarda autom/.test(h.textContent)) h.textContent = "Puedes guardar como borrador en el último paso."; });
  var pubBtn = $("#publishBtn");
  pubBtn.textContent = "Publicar vivienda";
  pubBtn.insertAdjacentHTML("beforebegin", '<button type="button" class="btn ghost" id="draftBtn">Guardar borrador</button>');
  var draftBtn = $("#draftBtn");

  /* ---------- Validación ---------- */
  function clearErr(f) { f.classList.remove("hmErr"); var m = $(".hmErrMsg", f); if (m) m.remove(); }
  function setErr(f, msg) { clearErr(f); f.classList.add("hmErr"); f.insertAdjacentHTML("beforeend", '<p class="hmErrMsg">' + msg + '</p>'); }
  document.addEventListener("input", function (e) { var f = e.target.closest && e.target.closest(".field.hmErr"); if (f) clearErr(f); });
  document.addEventListener("click", function (e) { var f = e.target.closest && e.target.closest(".field.hmErr"); if (f && e.target.closest("button,label,input")) setTimeout(function () { clearErr(f); }, 0); });

  function fieldOk(f) {
    if ($("#ctFinder", f)) return window.HOMYO_RC ? true : "Busca o valida la referencia catastral.";
    if ($(".opCards", f)) return true;
    var seg = $(".ynSeg", f); if (seg) return $("button.isOn", seg) ? true : "Elige una opción.";
    if ($(".chipSet", f)) return $$('input[type="checkbox"]', f).some(function (i) { return i.checked; }) ? true : "Marca al menos una opción.";
    var ins = $$("input,select,textarea", f).filter(function (i) { return i.type !== "checkbox" && i.type !== "radio" && shown(i); });
    if (!ins.length) return true;
    return ins.some(function (i) { return i.value.trim(); }) ? true : "Este dato es obligatorio.";
  }
  function validatePanel(n) {
    var p = $('.wzPanel[data-panel="' + n + '"]'), bad = [];
    $$(".field", p).forEach(function (f) {
      clearErr(f);
      if (!shown(f)) return;
      var req = $(".fieldLabel .req", f).filter(shown)[0]; if (!req) return;
      var onlyEl = f.closest("[data-only]"), rk = onlyEl ? { buy: "req_buy", rent: "req_rent", room: "req_room" }[op()] : "req_common";
      if (RU[rk] === false) return;
      var t = req.textContent.toLowerCase();
      if (/marca lo que/.test(t)) return;
      if (/si hay exterior/.test(t) && !$$('input[name="ext"]').some(function (i) { return i.checked; })) return;
      var r = fieldOk(f);
      if (r !== true) { setErr(f, r); bad.push(f); }
    });
    return bad;
  }
  var dupChecked = {};
  function checkDup(rc) {
    if (RU.block_duplicates === false) { dupChecked[rc] = false; return Promise.resolve(false); }
    if (dupChecked[rc] != null) return Promise.resolve(dupChecked[rc]);
    return H.ready.then(function () { return H.sb.rpc("cadastre_ref_in_use", { p_cadastre_ref: rc }); }).then(function (r) {
      if (r.error) return false; // sin la función (04 sin ejecutar): no bloquea
      dupChecked[rc] = !!r.data; return dupChecked[rc];
    });
  }
  function dupBlock() {
    var f = $("#ctFinder").closest(".field");
    setErr(f, "Esta referencia catastral ya está publicada por otra agencia en Homyo. No se puede crear un anuncio duplicado.");
  }
  window.HOMYO_GATE = function (from, to) {
    for (var n = from; n < to; n++) {
      if (n > 3) break; // plano, fotos y certificado bloquean solo al publicar
      var bad = validatePanel(n);
      if (bad.length) {
        if (n !== from) goStep(n);
        setTimeout(function () { var r = bad[0].getBoundingClientRect(); window.scrollBy({ top: r.top - 120, behavior: "smooth" }); }, 30);
        window.homyoToast && homyoToast(bad.length === 1 ? "Falta 1 dato obligatorio" : "Faltan " + bad.length + " datos obligatorios");
        return false;
      }
      if (n === 1 && window.HOMYO_RC) {
        var rc = window.HOMYO_RC.rc;
        if (dupChecked[rc] == null) { checkDup(rc).then(function (d) { if (d) dupBlock(); else goStep(to); }); return false; }
        if (dupChecked[rc]) { dupBlock(); return false; }
      }
    }
    return true;
  };

  /* ---------- Revisión final con datos reales ---------- */
  var OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>';
  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  function ck(ok, title, txt, block) {
    return '<li class="' + (ok ? "ck-ok" : block ? "ck-block" : "ck-warn") + '" data-hmck><span class="ckBox">' + (ok ? OK : X) + '</span><div class="ckBody"><h5>' + title + '</h5><p>' + esc(txt) + '</p></div><span class="ckTag">' + (ok ? "Correcto" : block ? "Bloqueante" : "Pendiente") + '</span></li>';
  }
  function certOk() { return !!$("#f-eLetra").value && !!$("#f-cLetra").value; }
  function buildChecklist() {
    var D = collect(), list = $(".ckList");
    $$("li", list).forEach(function (li) { if (li.id !== "ckPlano" && li.id !== "ckFotos") li.remove(); });
    var o = op(), h = [];
    var bad = [1, 2, 3].reduce(function (s, n) { var p = $('.wzPanel[data-panel="' + n + '"]'); return s + $$(".field.hmErr", p).length; }, 0);
    var reqC = RU.req_common !== false, reqO = RU[{ buy: "req_buy", rent: "req_rent", room: "req_room" }[o]] !== false;
    h.push(ck(!!window.HOMYO_RC, "Referencia catastral", window.HOMYO_RC ? window.HOMYO_RC.rc + (window.HOMYO_RC.verified ? " · verificada en Catastro" : " · revisión manual") : "Sin referencia (paso 1)", reqC));
    h.push(ck(!!D.price, o === "buy" ? "Precio definido" : "Renta definida", D.price ? D.price.toLocaleString("es-ES") + " €" + (o === "buy" ? "" : "/mes") : "Falta el precio (paso 2)", reqC));
    h.push(ck(!!D.useful, o === "room" ? "Superficie de la habitación" : "Superficie útil interior", D.useful ? D.useful + " m²" + (D.built ? " útiles · " + D.built + " m² construidos" : "") : "Falta la superficie (paso 2)", reqO));
    if (o !== "room") h.push(ck(!!(D.bedrooms != null && D.bathrooms), "Dormitorios y baños", (D.bedrooms != null ? D.bedrooms + " dormitorios" : "—") + " · " + (D.bathrooms ? D.bathrooms + " baños" : "—"), reqO));
    h.push(ck(certOk(), "Certificado energético", certOk() ? "Consumo " + $("#f-eLetra").value + " · emisiones " + $("#f-cLetra").value : "Faltan las letras (paso 6)", RU.require_cert !== false));
    var desc = D.description["Resumen de la vivienda"];
    h.push(ck(!!desc, "Descripción", desc ? desc.slice(0, 80) + (desc.length > 80 ? "…" : "") : "Recomendado: escribe al menos el resumen (paso 7)", false));
    $("#ckPlano").insertAdjacentHTML("beforebegin", h.join(""));
    if (bad) $("#ckPlano").insertAdjacentHTML("beforebegin", ck(false, "Datos obligatorios", "Revisa los pasos 1 a 3", true));
    refreshPublish();
  }
  var origRefresh = window.refreshPublish;
  window.refreshPublish = refreshPublish = function () {
    origRefresh();
    if (RU.require_plan === false) { var lp = $("#ckPlano"); if (lp && lp.classList.contains("ck-block")) { lp.className = "ck-warn"; var tg = $(".ckTag", lp); if (tg) tg.textContent = "Recomendado"; var pp = $(".ckBody p", lp); if (pp) pp.textContent = "Opcional: el plano ayuda a recibir más contactos"; } }
    var blocks = $(".ckList li.ck-block").length;
    var bn = $("#blockNote"); if (bn && !blocks) bn.classList.add("hide");
    var ok = !blocks && $("#dispoCheck").checked;
    pubBtn.disabled = !ok || busy;
    draftBtn.disabled = busy;
    if (!busy) $("#footHint").textContent = ok ? "Todo listo. Se publicará en Homyo." : blocks ? (blocks === 1 ? "1 requisito bloqueante pendiente." : blocks + " requisitos bloqueantes pendientes.") : "Confirma la disponibilidad para publicar.";
  };
  new MutationObserver(function () { if ($('.wzPanel[data-panel="8"]').classList.contains("active")) buildChecklist(); })
    .observe($('.wzPanel[data-panel="8"]'), { attributes: true, attributeFilter: ["class"] });

  /* ---------- Recoger los datos del formulario ---------- */
  function collect() {
    var o = op(), picks = {}, chips = {}, description = {};
    $$(".ynSeg").filter(shown).forEach(function (s) { var b = $("button.isOn", s); if (b) picks[s.dataset.pick] = b.textContent.trim(); });
    $$('.chipSet input[type="checkbox"]').filter(shown).forEach(function (i) { if (i.checked) (chips[i.name] || (chips[i.name] = [])).push(i.closest("label").textContent.trim()); });
    var none = $('input[name="extNone"]'); if (none && none.checked && shown(none)) chips.ext = ["Sin espacio exterior"];
    $$(".descBlock").forEach(function (b) { var v = $("textarea", b).value.trim(); if (v) description[$(".bt", b).textContent.trim()] = v; });
    var dorm = int($("#f-dorm").value);
    return {
      op: o, cond: val("cond"), ptype: val("ptype"),
      address: $("#f-dir").value.trim(), city: $("#f-mun").value.trim(), hood: $("#f-barrio").value.trim(),
      price: int(val("price")), useful: int(val("useful")), built: o === "room" ? null : int($("#f-built").value),
      bedrooms: o === "room" ? null : dorm, bathrooms: int(val("baths")), year: int($("#f-anio").value), floor: $("#f-planta").value.trim(),
      picks: picks, chips: chips, description: description,
      extra: { common_m2: int(val("common")), ext_m2: int(val("extm2")), park_price: int(val("park_price")), stor_price: int(val("stor_price")), deposit_months: dec(val("deposit")), available_from: val("avail_from") || null, min_stay_months: int(val("min_stay")), energy_kwh: dec(val("kwh")), co2_kg: dec(val("co2")), emissions_letter: $("#f-cLetra").value || null }
    };
  }
  var EXT = { "Terraza": "terraza", "Jardín": "jardin", "Patio": "patio", "Balcón": "balcon" };
  var ORI = { Norte: "N", Sur: "S", Este: "E", Oeste: "O" };
  var PARK = { "Incluida": "incluido", "Opcional": "opcional", "No disponible": "no_disponible" };
  function propertyRow(D, id, geo) {
    var ext = D.chips.ext || [], outdoor = null;
    if (ext[0] === "Sin espacio exterior") outdoor = "none";
    else ["Terraza", "Jardín", "Patio", "Balcón"].some(function (k) { if (ext.indexOf(k) > -1) { outdoor = EXT[k]; return true; } });
    var acc = [];
    if (D.picks.asc === "Sí") acc.push("ascensor");
    if (D.picks.pmr === "Sí") acc.push("movilidad_reducida");
    var letter = $("#f-eLetra").value || null;
    var prov = $("#ctProv"), provTxt = prov && prov.selectedIndex > -1 ? prov.options[prov.selectedIndex].text : "";
    return {
      id: id, title: (D.ptype || "Vivienda") + (D.address ? " en " + D.address : ""),
      cadastre_ref: window.HOMYO_RC ? window.HOMYO_RC.rc : null, source: window.HOMYO_RC && window.HOMYO_RC.verified ? "catastro" : "manual",
      address_display: D.address || null, city: D.city || null, neighborhood: D.hood || null,
      province: /cargando|selecciona/i.test(provTxt) ? null : provTxt || null, country: "España",
      lat: geo ? geo.lat : null, lng: geo ? geo.lng : null,
      property_type: D.ptype || null, useful_area_m2: D.useful, built_area_m2: D.built,
      bedrooms: D.bedrooms ? clamp(D.bedrooms, 1, 6) : null, bathrooms: D.bathrooms ? clamp(D.bathrooms, 1, 5) : null,
      built_year: D.year, floor: D.floor || null,
      outdoor_space_type: D.op === "room" ? null : outdoor,
      outdoor_orientation: (D.chips.ori || []).map(function (k) { return ORI[k]; }).filter(Boolean),
      parking_type: D.op === "room" ? null : PARK[D.picks.park] || null,
      storage_type: D.op === "room" ? null : D.picks.stor ? ({ "Incluido": "incluido", "Opcional": "opcional" })[D.picks.stor] || "no_incluido" : null,
      accessibility_features: acc,
      energy_label: letter, energy_label_status: letter ? "provided" : null
    };
  }
  function geoFor(rc) {
    if (!rc) return Promise.resolve(null);
    var u = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json/Consulta_CPMRC?Provincia=&Municipio=&SRS=EPSG:4326&RefCat=" + encodeURIComponent(rc.slice(0, 14));
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      var c = j.Consulta_CPMRCResult && j.Consulta_CPMRCResult.coordenadas && j.Consulta_CPMRCResult.coordenadas.coord;
      c = Array.isArray(c) ? c[0] : c;
      return c && c.geo ? { lat: +c.geo.ycen, lng: +c.geo.xcen } : null;
    }).catch(function () { return null; });
  }

  /* ---------- Guardar / publicar ---------- */
  var busy = false;
  function status(t) { $("#footHint").textContent = t; }
  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }); }
  function blobOf(url) { return fetch(url).then(function (r) { return r.blob(); }); }
  function extOf(b) { return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" })[b.type] || "bin"; }
  async function upload(path, blob) {
    var st = H.sb.storage.from("listing-media");
    var r = await st.upload(path, blob, { contentType: blob.type || undefined, upsert: true });
    if (r.error) throw new Error("No se ha podido subir un archivo: " + r.error.message);
    return st.getPublicUrl(path).data.publicUrl;
  }
  function friendly(e) {
    var m = (e && e.message) || String(e || "");
    if (/row-level security|permission denied/i.test(m)) return "Supabase no permite guardar todavía. Ejecuta supabase/04-subir-vivienda.sql y vuelve a intentarlo.";
    if (/bucket not found/i.test(m)) return "Falta el almacenamiento de fotos. Ejecuta supabase/02-permisos.sql.";
    return m || "Error desconocido";
  }

  async function save(publish) {
    if (busy) return;
    for (var n = 1; n <= 3; n++) { if (validatePanel(n).length) { goStep(n); window.HOMYO_GATE(n, n + 1); return; } }
    var D = collect(), ctx = await H.ready, agencyId = ctx.agency.id;
    if (window.HOMYO_RC && (!EDIT || window.HOMYO_RC.rc !== EDIT.property.cadastre_ref) && await checkDup(window.HOMYO_RC.rc)) { goStep(1); dupBlock(); return; }
    busy = true; pubBtn.disabled = draftBtn.disabled = true;
    var listingId = EDIT ? EDIT.listing.id : uuid(), propId = EDIT ? EDIT.listing.property_id : uuid(), c = H.sb;
    try {
      var rcNow = window.HOMYO_RC && window.HOMYO_RC.rc, rcOld = EDIT && EDIT.property.cadastre_ref;
      var geo = null;
      if (!EDIT || rcNow !== rcOld || EDIT.property.lat == null) { status("Localizando la vivienda…"); geo = await geoFor(rcNow); }
      status("Guardando la ficha…");
      var prow = propertyRow(D, propId, geo);
      if (EDIT && propId) {
        delete prow.id;
        if (!geo) { delete prow.lat; delete prow.lng; }
        var pu = await c.from("properties").update(prow).eq("id", propId);
        if (pu.error) throw pu.error;
      } else {
        var pr = await c.from("properties").insert(prow);
        if (pr.error) {
          if (pr.error.code === "23505" && window.HOMYO_RC) {
            var s = await c.rpc("search_property_by_cadastre_ref", { p_cadastre_ref: window.HOMYO_RC.rc });
            var row = Array.isArray(s.data) ? s.data[0] : s.data;
            if (!row || !(row.id || row.property_id)) throw pr.error;
            propId = row.id || row.property_id;
          } else throw pr.error;
        }
      }
      var letter = $("#f-eLetra").value || null;
      var details = Object.assign({}, EDIT ? EDIT.details : {}, { condition: D.cond || null, description: D.description, options: D.picks, features: D.chips });
      Object.keys(D.extra).forEach(function (k) { if (D.extra[k] != null) details[k] = D.extra[k]; else delete details[k]; });
      var lrow = {
        property_id: propId, price_eur: D.price, listing_mode: D.op === "buy" && D.cond === "Obra nueva" ? "new_build" : D.op,
        energy_label: letter, energy_label_status: letter ? "provided" : null, details: details
      };
      var lr = EDIT
        ? await c.from("listings").update(lrow).eq("id", listingId)
        : await c.from("listings").insert(Object.assign({ id: listingId, agency_id: agencyId, status: "draft", availability: "available" }, lrow));
      if (lr.error) throw lr.error;

      // Archivos (los que ya estaban en Supabase se reutilizan; solo se suben los nuevos)
      var photos = $$("#photoGrid [data-photo].has img").map(function (i) { return i.src; });
      var planoEl = $("#planoPrev img, #planoPrev iframe"), certEl = $("#certPrev iframe");
      var isNew = function (u) { return /^blob:/.test(u); };
      var total = photos.filter(isNew).length + (planoEl && isNew(planoEl.src) ? 1 : 0) + (certEl && isNew(certEl.src) ? 1 : 0), done = 0, media = [], main = null;
      var base = agencyId + "/" + listingId + "/", stamp = Date.now().toString(36);
      for (var i = 0; i < photos.length; i++) {
        var url = photos[i];
        if (isNew(url)) {
          status("Subiendo archivos " + (++done) + " de " + total + "…");
          var b = await blobOf(url);
          url = await upload(base + "foto-" + stamp + "-" + String(i + 1).padStart(2, "0") + "." + extOf(b), b);
        }
        if (!i) main = url;
        media.push({ listing_id: listingId, media_type: "photo", url: url, sort_order: i });
      }
      if (planoEl) {
        var purl = planoEl.src.split("#")[0];
        if (isNew(purl)) { status("Subiendo archivos " + (++done) + " de " + total + "…"); var pb = await blobOf(purl); purl = await upload(base + "plano-" + stamp + "." + extOf(pb), pb); }
        media.push({ listing_id: listingId, media_type: "floorplan", url: purl, sort_order: 0 });
      }
      if (certEl) {
        var curl = certEl.src.split("#")[0];
        if (isNew(curl)) { status("Subiendo archivos " + (++done) + " de " + total + "…"); var cb = await blobOf(curl); curl = await upload(base + "certificado-energetico-" + stamp + ".pdf", cb); }
        details.energy_certificate_url = curl;
      } else delete details.energy_certificate_url;
      if (EDIT) { var dr = await c.from("listing_media").delete().eq("listing_id", listingId); if (dr.error) throw dr.error; }
      if (media.length) { var mr = await c.from("listing_media").insert(media); if (mr.error) throw mr.error; }
      var ur = await c.from("listings").update({ main_photo_url: main, details: details }).eq("id", listingId);
      if (ur.error) throw ur.error;
      var wasPublished = EDIT && EDIT.listing.status === "published";
      if (wasPublished) {
        try { sessionStorage.setItem("homyo_pro_flash", "Cambios guardados · la vivienda sigue publicada"); } catch (e) {}
        location.href = "pro-viviendas.html"; return;
      }

      if (publish) {
        status("Publicando…");
        var p = await c.rpc("publish_listing", { p_listing_id: listingId });
        if (p.error) {
          busy = false; refreshPublish();
          window.homyoConfirm({ title: "Guardada como borrador", body: "La vivienda se ha guardado, pero Supabase no ha permitido publicarla: " + friendly(p.error) + " Puedes completarla y publicarla desde Mis viviendas.", ok: "Ir a Mis viviendas", cancel: "Quedarme aquí" })
            .then(function (go) { if (go) location.href = "pro-viviendas.html"; });
          return;
        }
      }
      try { sessionStorage.setItem("homyo_pro_flash", publish ? "Vivienda publicada en Homyo" : "Borrador guardado"); } catch (e) {}
      location.href = "pro-viviendas.html";
    } catch (e) {
      busy = false; refreshPublish();
      status("No se ha guardado.");
      window.homyoConfirm({ title: "No se ha podido guardar", body: friendly(e), ok: "Entendido", cancel: "Cerrar" });
    }
  }
  // El listener original de publishBtn no hace nada en modo real
  pubBtn.addEventListener("click", function () { save(true); });
  draftBtn.addEventListener("click", function () { save(false); });
  refreshPublish();

  /* ---------- Editar una vivienda existente (?id=) ---------- */
  var EDIT = null;
  var editId = new URLSearchParams(location.search).get("id");
  if (editId) loadEdit(editId);

  function setSel(sel, v) { if (!sel || v == null) return; sel.value = v; if (sel.value !== String(v)) { var o = Array.prototype.find.call(sel.options, function (x) { return x.text === v; }); if (o) sel.value = o.value; } }
  function setVal(el, v) { if (el && v != null && v !== "") { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); } }
  function setValK(k, v) { $$('[data-k="' + k + '"]').filter(shown).forEach(function (el) { setVal(el, v); }); }
  function lockRc(rc, verified) {
    window.HOMYO_RC = { rc: rc, verified: verified };
    ["ctFinder", "ctManual", "ctMode", "ctFoot"].forEach(function (id) { $("#" + id).classList.add("hide"); });
    var lk = $("#ctLocked"); lk.classList.remove("hide");
    lk.innerHTML = '<div class="ctFound" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span class="ctRc ctMono">' + esc(rc) + '</span>' + (verified ? '<span class="pill ok">Verificada en Catastro</span>' : '<span class="pill warnp">Revisión manual</span>') + '<button type="button" class="ctLink btnLink" id="hmRcChange">Cambiar</button></div>';
    $("#hmRcChange").onclick = function () { lk.classList.add("hide"); window.HOMYO_RC = null; ["ctMode", "ctFoot"].forEach(function (id) { $("#" + id).classList.remove("hide"); }); var on = $("#ctMode .isOn"); if (on) on.click(); else $("#ctFinder").classList.remove("hide"); };
    var ckr = $("#ckRc"); if (ckr) ckr.textContent = rc;
  }
  function showFile(prevId, dzId, url, kind, name, onDel) {
    var prev = $("#" + prevId), dz = $("#" + dzId);
    dz.style.display = "none"; prev.classList.remove("hide");
    prev.innerHTML = '<div class="dzPrevBody">' + (kind === "img" ? '<img src="' + esc(url) + '" alt="" />' : '<iframe src="' + esc(url) + '#toolbar=0&view=FitH" title="Vista previa"></iframe>') + '</div><div class="dzPrevBar"><span class="nm">' + esc(name) + '</span><span class="sz">Guardado en Homyo</span><span class="acts"><button type="button" data-a="del">Quitar</button></span></div>';
    $('[data-a="del"]', prev).onclick = function () { prev.classList.add("hide"); prev.innerHTML = ""; dz.style.display = ""; if (onDel) onDel(); };
  }
  async function loadEdit(id) {
    $$(".wzPanel").forEach(function (p) { p.style.opacity = ".5"; p.style.pointerEvents = "none"; });
    try {
      var E = await H.proListing(id), l = E.listing, p = E.property, d = E.details, o = { venta: "buy", alquiler: "rent", habitacion: "room" }[E.op];
      EDIT = E;
      if (!H.canEdit(l)) {
        pubBtn.classList.add("hmHidden"); draftBtn.classList.add("hmHidden");
        $('.wzPanel[data-panel="1"]').insertAdjacentHTML("afterbegin", '<div class="callout warnc" style="margin-bottom:18px"><span class="cIc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span><div><h4>Solo lectura</h4><p>Esta vivienda tiene otro responsable. Solo él o un administrador pueden guardar cambios.</p></div></div>');
      }
      var t = document.querySelector(".tbTitle"); if (t) t.textContent = "Editar vivienda";
      var cr = document.querySelector(".tbCrumb"); if (cr) cr.textContent = "Viviendas · " + E.addr;
      var oc = $('.opCard input[value="' + o + '"]'); if (oc) { oc.checked = true; oc.closest(".opCard").click(); }
      if (p.cadastre_ref) lockRc(p.cadastre_ref, p.source === "catastro");
      setVal($("#f-dir"), p.address_display); setVal($("#f-mun"), p.city); setVal($("#f-barrio"), p.neighborhood);
      setSel($('[data-k="ptype"]'), p.property_type);
      setSel($('[data-k="cond"]'), d.condition || (l.listing_mode === "new_build" ? "Obra nueva" : null));
      setValK("price", l.price_eur); setValK("useful", p.useful_area_m2); setVal($("#f-built"), p.built_area_m2);
      setVal($("#f-dorm"), p.bedrooms); setValK("baths", p.bathrooms); setVal($("#f-anio"), p.built_year); setVal($("#f-planta"), p.floor);
      setValK("common", d.common_m2); setValK("extm2", d.ext_m2); setValK("deposit", d.deposit_months); setValK("avail_from", d.available_from); setValK("min_stay", d.min_stay_months);
      setValK("kwh", d.energy_kwh); setValK("co2", d.co2_kg);
      setSel($("#f-eLetra"), l.energy_label || p.energy_label); setSel($("#f-cLetra"), d.emissions_letter);
      var picks = d.options || {};
      if (!picks.asc && p.accessibility_features) picks.asc = p.accessibility_features.indexOf("ascensor") > -1 ? "Sí" : "No";
      if (!picks.pmr && p.accessibility_features) picks.pmr = p.accessibility_features.indexOf("movilidad_reducida") > -1 ? "Sí" : "No";
      if (!picks.park && p.parking_type) picks.park = { incluido: "Incluida", opcional: "Opcional", no_disponible: "No disponible" }[p.parking_type];
      if (!picks.stor && p.storage_type) picks.stor = { incluido: "Incluido", opcional: "Opcional", no_incluido: "No disponible" }[p.storage_type];
      Object.keys(picks).forEach(function (k) { var b = $$('.ynSeg[data-pick="' + k + '"] button').filter(function (x) { return x.textContent.trim() === picks[k]; })[0]; if (b) b.click(); });
      setValK("park_price", d.park_price); setValK("stor_price", d.stor_price);
      var feats = d.features || {};
      if (!feats.ext && p.outdoor_space_type) feats.ext = p.outdoor_space_type === "none" ? ["Sin espacio exterior"] : [{ terraza: "Terraza", jardin: "Jardín", patio: "Patio", balcon: "Balcón" }[p.outdoor_space_type]];
      if (!feats.ori && p.outdoor_orientation) feats.ori = p.outdoor_orientation.map(function (k) { return { N: "Norte", S: "Sur", E: "Este", O: "Oeste" }[k]; }).filter(Boolean);
      Object.keys(feats).forEach(function (name) {
        (feats[name] || []).forEach(function (lbl) {
          if (name === "ext" && lbl === "Sin espacio exterior") { var n = $('input[name="extNone"]'); if (n && !n.checked) n.click(); return; }
          $$('input[name="' + name + '"]').forEach(function (i) { if (i.closest("label").textContent.trim() === lbl && !i.checked) i.click(); });
        });
      });
      var desc = d.description || {};
      $$(".descBlock").forEach(function (b) { var v = desc[$(".bt", b).textContent.trim()]; if (v) $("textarea", b).value = v; });
      E.photos.forEach(function (m, i) {
        var s = slots().filter(function (x) { return !x.classList.contains("has"); })[0] || newExtraSlot();
        fillSlot(s, m.url, "Foto " + (i + 1));
      });
      refreshPhotos();
      if (E.plans[0]) { var pu = E.plans[0].url; showFile("planoPrev", "dzPlano", pu, /\.pdf($|\?)/i.test(pu) ? "pdf" : "img", "Plano en planta", unmarkPlano); markPlanoDone("Plano guardado"); }
      if (d.energy_certificate_url) showFile("certPrev", "dzCert", d.energy_certificate_url, "pdf", "Certificado energético");
      if (l.status === "published") { pubBtn.classList.add("hmHidden"); draftBtn.textContent = "Guardar cambios"; draftBtn.className = "btn primary"; }
      if (E.review && E.review.decision === "rejected" && l.status === "draft") {
        $('.wzPanel[data-panel="1"]').insertAdjacentHTML("afterbegin", '<div class="callout dangerc" style="margin-bottom:18px"><span class="cIc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg></span><div><h4>Homyo rechazó esta vivienda</h4><p style="white-space:pre-line">' + esc(E.review.message || "Revisa los requisitos de calidad.") + '</p></div></div>');
      }
    } catch (e) {
      window.homyoConfirm({ title: "No se ha podido abrir la vivienda", body: friendly(e), ok: "Ir a Mis viviendas", cancel: "Cerrar" }).then(function (go) { if (go) location.href = "pro-viviendas.html"; });
    }
    $$(".wzPanel").forEach(function (p) { p.style.opacity = ""; p.style.pointerEvents = ""; });
    refreshPublish();
  }
})();
