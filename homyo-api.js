/* =========================================================
   HOMYO · Datos reales (Supabase) para Pro y Admin
   Requiere homyo-mode.js. Solo se usa en modo real.
   ========================================================= */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H) return;

  var MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var TYPE = { flat: "Piso", piso: "Piso", apartment: "Apartamento", apartamento: "Apartamento", attic: "Ático", atico: "Ático", penthouse: "Ático", duplex: "Dúplex", house: "Casa", casa: "Casa", chalet: "Chalet", villa: "Chalet", studio: "Estudio", estudio: "Estudio", loft: "Loft", room: "Habitación", habitacion: "Habitación", "casa o chalet": "Chalet", "casa adosada": "Casa adosada" };

  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function fmtDate(d) { if (!d) return "—"; d = new Date(d); return d.getDate() + " " + MES[d.getMonth()] + " " + d.getFullYear(); }
  function ago(d) {
    if (!d) return "—";
    var m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 2) return "Ahora mismo";
    if (m < 60) return "Hace " + m + " min";
    var h = Math.round(m / 60); if (h < 24) return "Hace " + h + " h";
    var dd = Math.round(h / 24); return dd === 1 ? "Hace 1 día" : "Hace " + dd + " días";
  }
  function daysSince(d) { return d ? (Date.now() - new Date(d).getTime()) / 864e5 : 0; }
  function eur(n) { return n == null ? "—" : Number(n).toLocaleString("es-ES") + " €"; }

  function op(mode) {
    var m = norm(mode);
    if (/room|habitac/.test(m)) return "habitacion";
    if (/rent|alquil|lease/.test(m)) return "alquiler";
    return "venta";
  }
  function state(l) {
    var s = norm(l.status), a = norm(l.availability_internal_status);
    if (/draft|borrador/.test(s)) return "draft";
    if (/review|pending|revision/.test(s)) return "review";
    if (/reject|rechaz/.test(s)) return "rej";
    if (/unpub|withdraw|retir|closed|archiv|sold|rented|inactive|expired/.test(s) || l.unpublished_at || l.closed_at) return "off";
    if (/warn|stale|due/.test(a)) return "upd";
    if (daysSince(l.availability_confirmed_at || l.listed_at) > ((H.RULES && H.RULES.availability_days) || 60)) return "upd";
    return "pub";
  }
  function addrOf(p) {
    p = p || {};
    var street = [p.street_name, p.street_number].filter(Boolean).join(" ");
    var a = p.address_display || street || p.title || "Vivienda sin dirección";
    var t = TYPE[norm(p.property_type)];
    return t ? t + " · " + a : a;
  }

  /* Viviendas de MI inmobiliaria, ya listas para pintar en pro-viviendas */
  H.proListings = async function () {
    var ctx = await H.ready;
    await H.settings();
    var RU = H.RULES;
    var c = H.sb, agencyId = ctx.agency.id;
    var r = await c.from("listings")
      .select("*, property:properties(*)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });
    if (r.error) throw r.error;
    var rows = r.data || [];
    var ids = rows.map(function (l) { return l.id; });
    var media = {}, contacts = {};
    if (ids.length) {
      var res = await Promise.all([
        c.from("listing_media").select("listing_id,media_type").in("listing_id", ids),
        c.from("listing_contact_events").select("listing_id").in("listing_id", ids)
      ]);
      (res[0].data || []).forEach(function (m) {
        var k = media[m.listing_id] || (media[m.listing_id] = { photos: 0, plan: 0 });
        if (/plan|floor/.test(norm(m.media_type))) k.plan++; else k.photos++;
      });
      (res[1].data || []).forEach(function (e) { contacts[e.listing_id] = (contacts[e.listing_id] || 0) + 1; });
    }
    return rows.map(function (l) {
      var p = l.property || {}, o = op(l.listing_mode), st = state(l), md = media[l.id] || { photos: 0, plan: 0 };
      if (l.main_photo_url && !md.photos) md.photos = 1;
      var miss = [];
      if (RU.require_plan !== false && !md.plan) miss.push("plano");
      if (RU.require_cert !== false && !l.energy_label && !/exempt|exent|pending|tramit/.test(norm(l.energy_label_status || p.energy_label_status))) miss.push("cert");
      var minPh = RU.min_photos || 6;
      if (md.photos < minPh) miss.push("fotos"); else if (md.photos < minPh + 4) miss.push("fotos10");
      if (!p.cadastre_ref) miss.push("ref");
      if (st === "upd") miss.push("upd");
      var upd = st === "off" ? "Retirada " + ago(l.unpublished_at || l.closed_at).toLowerCase() : ago(l.availability_confirmed_at || l.created_at);
      return {
        id: l.id, op: o, st: st, miss: miss,
        addr: addrOf(p), zone: p.neighborhood || p.city || "—", ref: p.cadastre_ref || "—",
        price: l.price_eur == null ? "—" : eur(l.price_eur) + (o === "venta" ? "" : "/mes"),
        m2: p.useful_area_m2 ? p.useful_area_m2 + " m²" : "—",
        pub: l.listed_at ? fmtDate(l.listed_at) : "—", upd: upd,
        note: st === "rej" && l.closing_reason ? l.closing_reason : "",
        c: contacts[l.id] || 0, photo: l.main_photo_url || "", raw: l
      };
    });
  };

  /* Eventos diarios de MIS anuncios (vista my_listing_events_daily) desde hace `days` días */
  H.proDaily = async function (days) {
    await H.ready;
    var since = new Date(Date.now() - days * 864e5).toISOString();
    var r = await H.sb.from("my_listing_events_daily").select("day,listing_id,event_type,events").gte("day", since);
    if (r.error) throw r.error;
    return r.data || [];
  };
  /* Últimos contactos (teléfono mostrado) en mis anuncios */
  H.proRecentContacts = async function (ids, n) {
    await H.ready;
    if (!ids.length) return [];
    var r = await H.sb.from("listing_contact_events").select("listing_id,created_at").in("listing_id", ids).order("created_at", { ascending: false }).limit(n || 5);
    if (r.error) throw r.error;
    return r.data || [];
  };

  /* ===== ADMIN · Moderación: anuncios publicados sin revisar desde su publicación ===== */
  H.adminModeration = async function () {
    await H.ready;
    await H.settings();
    var c = H.sb;
    var res = await Promise.all([
      c.from("listings").select("*, property:properties(*), agency:agencies(id,name)").eq("status", "published"),
      c.from("listing_reviews").select("listing_id,decision,reviewed_at").order("reviewed_at", { ascending: false })
    ]);
    if (res[0].error) throw res[0].error;
    if (res[1].error) throw res[1].error;
    var last = {}, today = new Date(); today.setHours(0, 0, 0, 0);
    var doneToday = 0;
    (res[1].data || []).forEach(function (r) {
      if (!last[r.listing_id]) last[r.listing_id] = r;
      if (new Date(r.reviewed_at) >= today) doneToday++;
    });
    var all = res[0].data || [];
    var refCount = {};
    all.forEach(function (l) { var ref = l.property && l.property.cadastre_ref; if (ref) refCount[ref] = (refCount[ref] || 0) + 1; });
    var pend = all.filter(function (l) {
      var r = last[l.id], since = l.listed_at || l.created_at;
      return !r || new Date(r.reviewed_at) < new Date(since);
    });
    var ids = pend.map(function (l) { return l.id; }), media = {};
    if (ids.length) {
      var m = await c.from("listing_media").select("listing_id,media_type,url,sort_order").in("listing_id", ids).order("sort_order");
      (m.data || []).forEach(function (x) { (media[x.listing_id] || (media[x.listing_id] = [])).push(x); });
    }
    var items = pend.map(function (l) {
      var p = l.property || {}, o = op(l.listing_mode), md = media[l.id] || [];
      var photos = md.filter(function (x) { return x.media_type === "photo"; }).map(function (x) { return x.url; });
      var plans = md.filter(function (x) { return x.media_type === "floorplan"; }).map(function (x) { return x.url; });
      if (!photos.length && l.main_photo_url) photos = [l.main_photo_url];
      var lbl = l.energy_label || p.energy_label, lst = l.energy_label_status || p.energy_label_status;
      var ficha = [];
      if (!p.useful_area_m2) ficha.push("superficie útil");
      if (o !== "habitacion") { if (!p.bedrooms) ficha.push("dormitorios"); if (!p.bathrooms) ficha.push("baños"); }
      if (!p.outdoor_space_type) ficha.push("exterior");
      if (!p.parking_type) ficha.push("parking");
      if (!p.storage_type) ficha.push("trastero");
      var m2 = p.useful_area_m2 || 0, pr = l.price_eur || 0;
      return {
        id: l.id, agency_id: l.agency_id,
        t: addrOf(p).replace(" · ", " en "), ag: (l.agency && l.agency.name) || "Sin agencia", city: p.city || "—",
        op: { venta: "Venta", alquiler: "Alquiler", habitacion: "Habitación" }[o],
        m2: m2 || "—", price: pr ? eur(pr) + (o === "venta" ? "" : "/mes") : "—",
        ppm: m2 && pr ? (o === "venta" ? Math.round(pr / m2).toLocaleString("es-ES") : (pr / m2).toFixed(1).replace(".", ",")) + (o === "venta" ? " €/m²" : " €/m²") : "—",
        ref: p.cadastre_ref || "sin ref. catastral",
        wait: Math.max(1, Math.round((Date.now() - new Date(l.listed_at || l.created_at).getTime()) / 60000)),
        plano: plans.length > 0, fotos: photos.length,
        cert: lbl ? "ok" : lst === "pending" ? "tramite" : "no", certL: lbl || "",
        datos: !!p.cadastre_ref, ficha: ficha,
        dup: !!(p.cadastre_ref && refCount[p.cadastre_ref] > 1),
        photos: photos, plans: plans
      };
    });
    return { items: items, doneToday: doneToday };
  };
  H.adminReview = function (id, decision, reasons, message) {
    return rpc("admin_review_listing", { p_listing_id: id, p_decision: decision, p_reasons: reasons || [], p_message: message || null });
  };

  /* ===== ADMIN · Resumen general ===== */
  H.adminOverview = async function () {
    await H.ready;
    var c = H.sb;
    var res = await Promise.all([
      c.from("agencies").select("id,name,city,status,created_at").order("created_at", { ascending: false }),
      c.from("listings").select("id,status,listed_at,created_at,unpublished_at,energy_label,energy_label_status,main_photo_url,agency_id,property:properties(city,address_display,street_name,street_number,title,property_type,cadastre_ref)"),
      c.from("profiles").select("id", { count: "exact", head: true }).not("agency_id", "is", null),
      c.rpc("admin_list_users"),
      c.from("listing_reviews").select("listing_id,decision,reviewed_at").order("reviewed_at", { ascending: false }).limit(20)
    ]);
    for (var i = 0; i < 2; i++) if (res[i].error) throw res[i].error;
    return {
      agencies: res[0].data || [], listings: res[1].data || [],
      pros: res[2].count || 0, users: res[3].error ? null : (res[3].data || []),
      reviews: res[4].error ? [] : (res[4].data || [])
    };
  };
  /* Eventos diarios de toda la plataforma desde hace `days` días */
  H.adminDaily = async function (days) {
    await H.ready;
    var since = new Date(Date.now() - days * 864e5).toISOString(), out = [], from = 0, page = 1000;
    for (;;) {
      var r = await H.sb.from("listing_events_daily_admin").select("day,listing_id,event_type,events").gte("day", since).range(from, from + page - 1);
      if (r.error) throw r.error;
      out = out.concat(r.data || []);
      if (!r.data || r.data.length < page || out.length >= 20000) break;
      from += page;
    }
    return out;
  };
  H.adminTopListings = async function (n) {
    await H.ready;
    var r = await H.sb.from("admin_dashboard_listings").select("listing_id,property_title,address_display,city,agency_name,views_30d,reveal_phone_30d,click_email_30d").order("views_30d", { ascending: false }).limit(n || 5);
    if (r.error) throw r.error;
    return r.data || [];
  };
  H.setBadge = function (href, n) {
    var a = document.querySelector('.sbItem[href="' + href + '"]'); if (!a) return;
    var b = a.querySelector(".sbBadge");
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("span"); b.className = "sbBadge"; a.appendChild(b); }
    b.textContent = n;
  };
  H.addrOf = addrOf;

  /* Una vivienda mía con todo lo necesario para editarla o revisarla */
  H.proListing = async function (id) {
    await H.ready;
    var c = H.sb;
    var res = await Promise.all([
      c.from("listings").select("*, property:properties(*)").eq("id", id).maybeSingle(),
      c.from("listing_media").select("id,media_type,url,sort_order").eq("listing_id", id).order("sort_order"),
      c.from("listing_reviews").select("decision,reasons,message,reviewed_at").eq("listing_id", id).order("reviewed_at", { ascending: false }).limit(1)
    ]);
    if (res[0].error) throw res[0].error;
    if (!res[0].data) throw new Error("No encontramos esta vivienda en tu cuenta.");
    var l = res[0].data, md = res[1].data || [];
    return {
      listing: l, property: l.property || {}, details: l.details || {},
      photos: md.filter(function (m) { return m.media_type === "photo"; }),
      plans: md.filter(function (m) { return m.media_type === "floorplan"; }),
      review: (res[2].data || [])[0] || null,
      op: op(l.listing_mode), state: state(l), addr: addrOf(l.property)
    };
  };

  /* ===== PRO · Notificaciones calculadas con datos reales ===== */
  function nKey() { return "homyo_pro_nread:" + ((H.ctx && H.ctx.user && H.ctx.user.id) || ""); }
  function nRead() { try { return JSON.parse(localStorage.getItem(nKey()) || "[]"); } catch (e) { return []; } }
  H.notifMark = function (ids) {
    var s = nRead(); ids.forEach(function (i) { if (s.indexOf(i) < 0) s.push(i); });
    try { localStorage.setItem(nKey(), JSON.stringify(s.slice(-600))); } catch (e) {}
  };
  H.proNotifs = async function () {
    var ctx = await H.ready, c = H.sb, uid = ctx.user.id;
    var res = await Promise.all([
      H.proListings(),
      c.from("conversations").select("id,buyer_name,buyer_email,listing_snapshot,last_message_at,agency_unread").gt("agency_unread", 0).order("last_message_at", { ascending: false }).limit(30),
      c.rpc("my_agency_team")
    ]);
    var L = res[0], byId = {}; L.forEach(function (d) { byId[d.id] = d; });
    var ids = L.map(function (d) { return d.id; });
    var rv = ids.length ? await c.from("listing_reviews").select("listing_id,decision,message,reviewed_at").in("listing_id", ids).gte("reviewed_at", new Date(Date.now() - 30 * 864e5).toISOString()).order("reviewed_at", { ascending: false }) : { data: [] };
    var N = [], mine = function (d) { return H.canEdit(d.raw); }, short = function (d) { return d.addr.replace(" · ", " en "); };
    ((res[1] && res[1].data) || []).forEach(function (cv) {
      var nm = cv.buyer_name || cv.buyer_email || "Un interesado", s = cv.listing_snapshot || {};
      N.push({ id: "msg:" + cv.id + ":" + cv.last_message_at, cat: "contactos", tone: "ok", ic: "contactos", t: cv.agency_unread > 1 ? cv.agency_unread + " mensajes nuevos de " + nm : "Nuevo mensaje de " + nm, d: (s.address || "Vivienda") + " · respóndele desde Contactos.", at: cv.last_message_at, href: "pro-contactos.html?lead=" + cv.id });
    });
    var seen = {};
    ((rv && rv.data) || []).forEach(function (r) {
      if (seen[r.listing_id]) return; seen[r.listing_id] = 1;
      var d = byId[r.listing_id]; if (!d) return;
      if (r.decision === "rejected" && d.raw.status === "draft") N.push({ id: "rej:" + r.listing_id + ":" + r.reviewed_at, cat: "viviendas", tone: "dangerp", ic: "revision", t: "Anuncio rechazado en revisión", d: short(d) + (r.message ? " — " + String(r.message).split("\n").filter(function (x) { return /^•/.test(x); }).join(" ").replace(/•\s*/g, "").slice(0, 160) : ""), at: r.reviewed_at, href: "pro-revision-calidad.html?id=" + d.id });
      else if (r.decision !== "rejected") N.push({ id: "ok:" + r.listing_id + ":" + r.reviewed_at, cat: "viviendas", tone: "ok", ic: "revision", t: "Anuncio revisado y aprobado", d: short(d) + " cumple el estándar de calidad de Homyo.", at: r.reviewed_at, href: "pro-revision-calidad.html?id=" + d.id });
    });
    L.filter(mine).forEach(function (d) {
      var l = d.raw;
      if (d.st === "upd") N.push({ id: "upd:" + d.id + ":" + (l.availability_confirmed_at || l.listed_at), cat: "viviendas", tone: "warnp", ic: "viviendas", t: "Falta confirmar disponibilidad", d: short(d) + " lleva más de " + ((H.RULES && H.RULES.availability_days) || 60) + " días sin confirmar. Si no lo haces, dejará de mostrarse.", at: new Date(new Date(l.availability_confirmed_at || l.listed_at).getTime() + ((H.RULES && H.RULES.availability_days) || 60) * 864e5).toISOString(), href: "pro-viviendas.html?f=upd" });
      if (d.st === "draft" && Date.now() - new Date(l.created_at).getTime() > 3 * 864e5) N.push({ id: "draft:" + d.id, cat: "viviendas", tone: "neutral", ic: "subir", t: "Borrador sin terminar", d: short(d) + " — aún no está publicado.", at: new Date(new Date(l.created_at).getTime() + 3 * 864e5).toISOString(), href: "pro-revision-calidad.html?id=" + d.id });
      if ((d.st === "pub" || d.st === "upd") && d.miss.indexOf("cert") > -1) N.push({ id: "cert:" + d.id, cat: "viviendas", tone: "infop", ic: "subir", t: "Falta el certificado energético", d: short(d) + " — la ley obliga a mostrar la calificación.", at: l.listed_at || l.created_at, href: "pro-subir-vivienda.html?id=" + d.id });
    });
    if (ctx.role === "admin") ((res[2] && res[2].data) || []).forEach(function (m) {
      if (m.id !== uid && m.created_at && Date.now() - new Date(m.created_at).getTime() < 14 * 864e5) N.push({ id: "team:" + m.id, cat: "equipo", tone: "ok", ic: "equipo", t: (m.full_name || m.email) + " se ha unido al equipo", d: "Ya tiene acceso a la cuenta profesional.", at: m.created_at, href: "pro-equipo.html" });
    });
    var read = nRead();
    var pf = (ctx.user.user_metadata && ctx.user.user_metadata.notif_prefs) || {};
    N = N.filter(function (x) {
      var k = x.cat === "contactos" ? "contactos" : /^(rej|ok):/.test(x.id) ? "revision" : /^(upd|draft|cert):/.test(x.id) ? "calidad" : null;
      return !k || pf[k] !== false;
    });
    N.forEach(function (x) { x.unread = read.indexOf(x.id) < 0; x.when = H.fmt.ago(x.at); });
    return N.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
  };

  /* ===== Reglas de la plataforma (Admin · Ajustes) ===== */
  H.RULES_DEFAULT = { require_plan: true, require_cert: true, min_photos: 6, block_duplicates: true, availability_days: 60, req_common: true, req_buy: true, req_rent: true, req_room: true, price_month: 6.99, founder_months: 3, no_leads: true, shortcut: true };
  H.RULES = Object.assign({}, H.RULES_DEFAULT);
  var rulesP = null;
  H.settings = function () {
    if (!rulesP) rulesP = Promise.resolve(H.ready).then(function () { return H.sb.from("platform_settings").select("rules,updated_at").eq("id", 1).maybeSingle(); })
      .then(function (r) { if (r && !r.error && r.data) { Object.assign(H.RULES, r.data.rules || {}); H.RULES_AT = r.data.updated_at; } return H.RULES; })
      .catch(function () { return H.RULES; });
    return rulesP;
  };
  H.saveSettings = async function (patch) {
    await H.ready;
    var next = Object.assign({}, H.RULES, patch);
    var r = await H.sb.from("platform_settings").update({ rules: next, updated_at: new Date().toISOString(), updated_by: H.ctx && H.ctx.user && H.ctx.user.id }).eq("id", 1).select("id");
    if (r.error) throw r.error;
    if (!r.data || !r.data.length) throw new Error("platform_settings sin fila: ejecuta supabase/11-ajustes-incidencias.sql");
    Object.assign(H.RULES, next);
    try { localStorage.setItem("homyo_rule_shortcut", next.shortcut === false ? "off" : "on"); } catch (e) {}
    return H.RULES;
  };

  async function rpc(fn, args) {
    await H.ready;
    var r = await H.sb.rpc(fn, args);
    if (r.error) throw r.error;
    return r.data;
  }
  H.proConfirm = function (id) { return rpc("confirm_listing_availability", { p_listing_id: id }); };
  H.proPublish = function (id) { return rpc("publish_listing", { p_listing_id: id }); };
  // reason: sold | not_sold | rented | not_rented · price obligatorio si sold/rented
  H.proUnpublish = function (id, reason, price) { return rpc("unpublish_listing", { p_listing_id: id, p_closing_reason: reason, p_closing_price_eur: price == null ? null : price }); };

  H.fmt = { date: fmtDate, ago: ago, eur: eur };
})();
