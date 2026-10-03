/* =========================================================
   HOMYO · ADMIN — shell interno compartido
   - Guard de sesión: si no se ha pasado el gate, redirige.
   - Inyecta sidebar (oscuro) + topbar + popover de notificaciones.
   - Datos demo coherentes con el entorno profesional (Áurea, etc).
   Cada página declara window.ADMIN_PAGE antes de cargar el script:
     { active:'panel', title:'Panel', crumb:'Vista general' }
   Estructura mínima de la página (idéntica al entorno pro):
     <body class="adminTheme">
     <div class="proLayout">
       <aside class="proSidebar" id="proSidebar"></aside>
       <div class="sbScrim" id="sbScrim"></div>
       <div class="proContent">
         <header class="proTopbar" id="proTopbar"></header>
         <main class="proMain"> ... </main>
       </div></div>
   ========================================================= */
(function () {
  "use strict";

  /* ---------- GUARD DE SESIÓN ---------- */
  // Modo demo/real (homyo-mode.js). Sin modo válido → admin-gate.html.
  var H = window.HOMYO;
  var MODE = window.ADMIN_GATE ? "demo" : (H ? H.guard("admin") : null);
  if (!MODE) { if (!H) window.location.replace("admin-gate.html"); return; }
  var REAL = MODE === "real";
  window.adminLogout = function () {
    if (H) H.logout("admin"); else window.location.replace("admin-gate.html");
  };

  /* ---------- IDENTIDAD DEL JEFE ---------- */
  var BOSS = REAL ? { name: "", initials: "", role: "Administrador", email: "" } : { name: "Dirección Homyo", initials: "DH", role: "Administrador general", email: "direccion@homyo.es" };
  window.ADMIN_BOSS = BOSS;

  /* ---------- DATOS DEMO GLOBALES (coherentes con el entorno pro) ---------- */
  var DATA = {
    counts: {
      solicitudes: 4,      // altas de inmobiliaria pendientes
      anuncios: 9,         // anuncios en cola de moderación
      mensajes: 3,         // mensajes de soporte sin leer
      incidencias: 3
    },
    kpis: {
      inmobiliarias: 128,
      profesionales: 412,
      usuarios: 18420,
      anunciosActivos: 3964,
      mrr: 27708,          // ingresos recurrentes mensuales (€)
      mrrPrev: 25210
    }
  };
  if (REAL) DATA = { counts: { solicitudes: 0, anuncios: 0, mensajes: 0, incidencias: 0 }, kpis: {} };
  window.ADMIN_DATA = DATA;

  /* ---------- ICONOS ---------- */
  var ICONS = {
    panel: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9.5h14V10"/><path d="M10 19.5V14h4v5.5"/>',
    solicitudes: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 14l2 2 4-4"/>',
    profesionales: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M10 21V13h4v8"/>',
    anuncios: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    usuarios: '<circle cx="9" cy="8" r="3.2"/><path d="M2.6 20c1.1-3.4 11.7-3.4 12.8 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.4c2.4 0 4.8 1.4 5.4 3"/>',
    mensajes: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    incidencias: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    alertas: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    facturacion: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    estadisticas: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    equipo: '<path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    auditoria: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'
  };
  function svg(name, sw) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + '</svg>';
  }
  window.adminIcon = svg;

  var NAV = [
    { group: "Operación" },
    { id: "panel", label: "Panel", href: "admin-panel.html" },
    { id: "solicitudes", label: "Solicitudes de alta", href: "admin-solicitudes.html", badge: DATA.counts.solicitudes },
    { id: "anuncios", label: "Moderación de anuncios", href: "admin-anuncios.html", badge: DATA.counts.anuncios },
    { id: "mensajes", label: "Mensajes y soporte", href: "admin-mensajes.html", badge: DATA.counts.mensajes },
    { id: "incidencias", label: "Incidencias", href: "admin-incidencias.html", badge: DATA.counts.incidencias },
    { group: "Cuentas" },
    { id: "profesionales", label: "Profesionales", href: "admin-profesionales.html" },
    { id: "usuarios", label: "Usuarios", href: "admin-usuarios.html" },
    { group: "Negocio" },
    { id: "facturacion", label: "Facturación e ingresos", href: "admin-facturacion.html" },
    { id: "estadisticas", label: "Estadísticas", href: "admin-estadisticas.html" },
    { group: "Plataforma" },
    { id: "alertas", label: "Alertas del sistema", href: "admin-alertas.html" },
    { id: "auditoria", label: "Registro de actividad", href: "admin-auditoria.html" },
    { id: "equipo", label: "Equipo Homyo", href: "admin-equipo.html" },
    { id: "ajustes", label: "Ajustes", href: "admin-ajustes.html" }
  ];

  var NOTIFS = [
    { ic: "solicitudes", tone: "infop", unread: true, t: "Nueva solicitud de alta", d: "Nidos del Sur Gestión Inmobiliaria (Sevilla) ha solicitado acceso. Documentación adjunta.", when: "Hace 12 min", href: "admin-solicitudes.html" },
    { ic: "anuncios", tone: "warnp", unread: true, t: "Anuncio marca el límite de revisión", d: "Piso en Calle Colón 8 (Ribera Homes) lleva 14 h en cola de moderación.", when: "Hace 40 min", href: "admin-anuncios.html" },
    { ic: "incidencias", tone: "dangerp", unread: true, t: "Posible anuncio duplicado reportado", d: "Un usuario ha reportado un piso en Calle Sagasta 20 con la misma referencia que otra agencia.", when: "Hace 2 h", href: "admin-incidencias.html" },
    { ic: "facturacion", tone: "ok", unread: true, t: "Cobro mensual ejecutado", d: "Se han emitido 124 facturas. 3 cobros han fallado y requieren revisión.", when: "Hoy, 06:00", href: "admin-facturacion.html" },
    { ic: "mensajes", tone: "infop", unread: false, t: "Mensaje de soporte sin responder", d: "Inmobiliaria Vega pregunta por el certificado energético obligatorio.", when: "Ayer", href: "admin-mensajes.html" },
    { ic: "usuarios", tone: "neutral", unread: false, t: "Pico de registros de usuarios", d: "+318 usuarios nuevos esta semana, un 22 % más que la media.", when: "Hace 2 días", href: "admin-estadisticas.html" }
  ];
  if (REAL) NOTIFS = [];

  var READ_KEY = "homyo_admin_notifs_read";
  var readSet = [];
  try { readSet = JSON.parse(localStorage.getItem(READ_KEY) || "[]"); } catch (e) {}
  NOTIFS.forEach(function (n, i) { if (readSet.indexOf(i) > -1) n.unread = false; });
  function unreadCount() { return NOTIFS.filter(function (n) { return n.unread; }).length; }
  function markRead(i) {
    NOTIFS[i].unread = false;
    if (readSet.indexOf(i) < 0) readSet.push(i);
    try { localStorage.setItem(READ_KEY, JSON.stringify(readSet)); } catch (e) {}
  }
  function refreshBell() {
    var c = unreadCount();
    var el = document.getElementById("tbBellCnt");
    if (el) { el.textContent = c > 9 ? "9+" : c; el.style.display = c ? "" : "none"; }
    var b = document.getElementById("tbBell");
    if (b) b.setAttribute("aria-label", c ? "Notificaciones, " + c + " sin leer" : "Notificaciones");
    var m = document.getElementById("popMarkAll");
    if (m) m.style.visibility = c ? "" : "hidden";
    document.querySelectorAll("#proPopover .popItem").forEach(function (a) {
      a.classList.toggle("unread", !!NOTIFS[+a.getAttribute("data-i")].unread);
    });
  }
  function bindNotifs() {
    var pop = document.getElementById("proPopover");
    if (!pop) return;
    pop.addEventListener("click", function (e) {
      var it = e.target.closest(".popItem");
      if (it) { markRead(+it.getAttribute("data-i")); refreshBell(); }
      if (e.target.closest("#popMarkAll")) {
        e.preventDefault();
        NOTIFS.forEach(function (n, i) { markRead(i); });
        refreshBell();
      }
    });
    refreshBell();
  }

  var MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  var DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  function fillDates() {
    var now = new Date();
    document.querySelectorAll("[data-date='today']").forEach(function (el) {
      var s = DIAS[now.getDay()] + ", " + now.getDate() + " de " + MESES[now.getMonth()];
      el.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    });
    document.querySelectorAll("[data-month]").forEach(function (el) {
      var d = new Date(now.getFullYear(), now.getMonth() + (+el.getAttribute("data-month") || 0), 1);
      var m = MESES[d.getMonth()];
      el.textContent = el.getAttribute("data-fmt") === "short" ? m.slice(0, 3) : m;
    });
    document.querySelectorAll("[data-greet]").forEach(function (el) {
      var h = now.getHours();
      el.textContent = h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
    });
  }

  window.homyoToast = function (msg, undo) {
    var t = document.getElementById("homyoToast");
    if (!t) { t = document.createElement("div"); t.id = "homyoToast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = '<span></span>' + (undo ? '<button type="button">Deshacer</button>' : '');
    t.firstChild.textContent = msg;
    if (undo) t.querySelector("button").onclick = function () { t.classList.remove("isOn"); undo(); };
    t.classList.add("isOn");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("isOn"); }, 5000);
  };

  function buildCmdkItems() {
    if (REAL) { var P = []; NAV.forEach(function (n) { if (n.id) P.push({ g:"Páginas", t:n.label, href:n.href, quick:1 }); }); return P; }
    var A = [
      { g:"Acciones", t:"Moderar anuncios en cola", s:DATA.counts.anuncios + " pendientes", href:"admin-anuncios.html", quick:1, k:"revisar calidad" },
      { g:"Acciones", t:"Revisar solicitudes de alta", s:DATA.counts.solicitudes + " pendientes", href:"admin-solicitudes.html", quick:1, k:"aprobar inmobiliaria" },
      { g:"Acciones", t:"Ver cobros fallidos", s:"3 impagos · 97,86 €", href:"admin-facturacion.html", quick:1, k:"impago reintentar" },
      { g:"Acciones", t:"Responder mensajes de soporte", s:DATA.counts.mensajes + " sin leer", href:"admin-mensajes.html", k:"ayuda" }
    ];
    NAV.forEach(function (n) { if (n.id) A.push({ g:"Páginas", t:n.label, href:n.href, quick:1 }); });
    [
      ["Áurea Inmobiliaria","Madrid · 18 viviendas · fundadora"],["Domus Capital","Madrid · 41 viviendas"],["Ribera Homes","Valencia · 34 viviendas"],
      ["Hogar y Terrazas","Madrid · 27 viviendas"],["Casa Norte Gestión","Bilbao · 21 viviendas"],["Nido Urbano","Fundadora"],
      ["Llaves del Faro","A Coruña · 1 cobro fallido"],["Pisos Marina","Impago · 3 intentos"],["Costa Brava Homes","Girona · 1 cobro fallido"]
    ].forEach(function (x) { A.push({ g:"Inmobiliarias", t:x[0], s:x[1], href:"admin-profesional-detalle.html", k:"agencia profesional" }); });
    [["Nidos del Sur Gestión Inmobiliaria","Sevilla · solicitud de alta"],["Alquiler Claro","Valencia · solicitud de alta"]].forEach(function (x) { A.push({ g:"Inmobiliarias", t:x[0], s:x[1], href:"admin-solicitudes.html", k:"alta pendiente" }); });
    [
      ["Piso en Calle Colón 8","Ribera Homes · 14 h en cola"],["Casa adosada en Getxo","Casa Norte Gestión · falta plano"],["Piso en Calle Sagasta 20","Hogar y Terrazas · posible duplicado"],
      ["Estudio en Calle Fuencarral 120","Áurea Inmobiliaria"],["Chalet con jardín, Aravaca","Domus Capital · certificado en trámite"],["Habitación en Calle Sueca 14","Alquiler Claro"],
      ["Piso en Calle Real 40","Llaves del Faro"],["Bajo con patio en Carrer de Sant Antoni","Costa Brava Homes"],["Loft en Calle Ercilla 30","Casa Norte Gestión"]
    ].forEach(function (x) { A.push({ g:"Anuncios en moderación", t:x[0], s:x[1], href:"admin-anuncios.html", k:"anuncio vivienda" }); });
    [["HOM-2026-0412","Domus Capital · 286,59 €"],["HOM-2026-0411","Ribera Homes · 237,66 €"],["HOM-2026-0410","Hogar y Terrazas · 188,73 €"],["HOM-2026-0409","Casa Norte Gestión · 146,79 €"],["HOM-2026-0408","Áurea Inmobiliaria · bonificada"],["HOM-2026-0407","Pisos Marina · impagada"]]
      .forEach(function (x) { A.push({ g:"Facturas", t:x[0], s:x[1], href:"admin-facturacion.html", k:"factura" }); });
    return A;
  }
  function loadCmdk() {
    window.HOMYO_CMDK_ITEMS = buildCmdkItems();
    var cs = document.createElement("script"); cs.src = "homyo-cmdk.js"; document.body.appendChild(cs);
  }

  window.homyoConfirm = function (o) {
    return new Promise(function (resolve) {
      var w = document.createElement("div"); w.className = "hDlg";
      w.innerHTML = '<div class="hDlgBox" role="alertdialog" aria-modal="true" aria-labelledby="hDlgT"><h3 id="hDlgT"></h3><p class="hDlgP"></p>' +
        (o.field ? '<label class="hDlgF"><span></span><select class="input"></select></label>' : '') +
        '<div class="hDlgA"><button class="btn ghost sm" type="button" data-r="0"></button><button class="btn ' + (o.danger ? "danger" : "primary") + ' sm" type="button" data-r="1"></button></div></div>';
      w.querySelector("h3").textContent = o.title || "";
      w.querySelector(".hDlgP").textContent = o.body || "";
      w.querySelector('[data-r="0"]').textContent = o.cancel || "Cancelar";
      w.querySelector('[data-r="1"]').textContent = o.ok || "Confirmar";
      var sel = w.querySelector("select");
      if (o.field) { w.querySelector(".hDlgF span").textContent = o.field.label; o.field.options.forEach(function (x) { var op = document.createElement("option"); op.textContent = x; sel.appendChild(op); }); }
      document.body.appendChild(w);
      var prev = document.activeElement;
      function done(v) { document.removeEventListener("keydown", key, true); var val = sel ? sel.value : true; w.remove(); if (prev && prev.focus) prev.focus(); resolve(v ? val : false); }
      function key(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); } else if (e.key === "Enter" && e.target.tagName !== "SELECT") { e.preventDefault(); e.stopPropagation(); done(true); } }
      document.addEventListener("keydown", key, true);
      w.addEventListener("click", function (e) { var b = e.target.closest("[data-r]"); if (b) done(b.getAttribute("data-r") === "1"); else if (e.target === w) done(false); });
      setTimeout(function () { w.querySelector('[data-r="1"]').focus(); }, 0);
    });
  };
  window.homyoFounder = (function () {
    var n = new Date(), t = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var end = new Date(t.getFullYear(), t.getMonth(), 18);
    if (t.getDate() > 18) end = new Date(t.getFullYear(), t.getMonth() + 1, 18);
    function add(d, m, days) { return new Date(d.getFullYear(), d.getMonth() + (m || 0), d.getDate() + (days || 0)); }
    function fmt(d, s) {
      var m = MESES[d.getMonth()];
      if (s === "long") return d.getDate() + " de " + m + " de " + d.getFullYear();
      if (s === "dmlong") return d.getDate() + " de " + m;
      if (s === "dm") return d.getDate() + " " + m.slice(0, 3);
      if (s === "month") return m.charAt(0).toUpperCase() + m.slice(1) + " " + d.getFullYear();
      if (s === "monthname") return m;
      return d.getDate() + " " + m.slice(0, 3) + " " + d.getFullYear();
    }
    return { today: t, end: end, start: add(end, -3), charge: new Date(end.getFullYear(), end.getMonth() + 1, 1), grace: add(end, 0, 7), cupoEnd: add(end, 6), descEnd: add(end, 3), daysLeft: Math.round((end - t) / 864e5), add: add, fmt: fmt };
  })();
  function fillFounder() {
    var F = window.homyoFounder;
    document.querySelectorAll("[data-founder]").forEach(function (el) {
      var k = el.getAttribute("data-founder");
      el.textContent = k === "left" ? F.daysLeft : F.fmt(F[k], el.getAttribute("data-fmt") || "short");
    });
  }

  var AUDIT_KEY = "homyo_admin_audit";
  window.homyoAudit = function (cat, act, target) {
    if (REAL && H && H.sb) { H.sb.from("admin_audit").insert({ actor_id: H.ctx.user.id, actor_name: BOSS.name || H.ctx.user.email, category: cat, action: act, target: target || "" }).then(function () {}); return; }
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); } catch (e) {}
    arr.unshift({ at: Date.now(), who: BOSS.name, cat: cat, act: act, target: target || "" });
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(arr.slice(0, 300))); } catch (e) {}
  };

  function toneColor(t) {
    return ({
      ok: ["var(--goodSoft)", "var(--good)"],
      warnp: ["var(--warnSoft)", "var(--warn)"],
      dangerp: ["var(--dangerSoft)", "var(--danger)"],
      infop: ["var(--infoSoft)", "var(--info)"],
      neutral: ["var(--lineSoft)", "var(--ink2)"]
    })[t] || ["var(--cardWarm)", "var(--granate)"];
  }

  function buildSidebar(active) {
    var html = '';
    html += '<div class="sbBrand">' +
      '<a class="sbBrandMark" href="admin-panel.html">H<span class="brandO">O</span>MY<span class="brandO">O</span></a>' +
      '<span class="sbBrandTag">Admin</span>' +
      '</div>';
    html += '<nav class="sbNav">';
    NAV.forEach(function (it) {
      if (it.group) { html += '<div class="sbGroupLabel">' + it.group + '</div>'; return; }
      var badge = it.badge ? '<span class="sbBadge">' + it.badge + '</span>' : '';
      html += '<a class="sbItem' + (it.id === active ? ' isActive' : '') + '" href="' + it.href + '">' +
        svg(it.id) + '<span>' + it.label + '</span>' + badge + '</a>';
    });
    html += '</nav>';
    html += '<div class="sbFoot">' +
      '<a class="sbAgency" href="admin-equipo.html">' +
      '<span class="sbAgencyLogo">' + BOSS.initials + '</span>' +
      '<span><span class="sbAgencyName">' + BOSS.name + '</span>' +
      '<span class="sbAgencyMeta"><span class="dotok"></span>' + BOSS.role + '</span></span>' +
      '</a></div>';
    return html;
  }

  function buildTopbar(cfg) {
    var crumb = cfg.crumb || "Vista general";
    return '' +
      '<button class="tbBurger" id="tbBurger" aria-label="Abrir menú"></button>' +
      '<div><div class="tbTitle">' + (cfg.title || "") + '</div>' +
      '<div class="tbCrumb">' + crumb + '</div></div>' +
      '<div class="tbRight">' +
      '<span class="tbEnv"><span class="lk"></span>Entorno interno</span>' +
      '<label class="tbSearch">' + svg("search", 2) +
      '<input type="text" placeholder="Buscar inmobiliaria, anuncio, usuario, referencia…" aria-label="Buscar" /></label>' +
      '<button class="tbIconBtn" id="tbBell" aria-label="Notificaciones">' + svg("bell", 1.8) +
      '<span class="cnt" id="tbBellCnt"></span></button>' +
      '<button class="tbIconBtn" id="tbLogout" aria-label="Cerrar sesión" title="Cerrar sesión">' + svg("logout", 1.8) + '</button>' +
      '</div>';
  }

  function buildPopover() {
    var items = NOTIFS.map(function (n, i) {
      var c = toneColor(n.tone);
      return '<a class="popItem' + (n.unread ? ' unread' : '') + '" data-i="' + i + '" href="' + n.href + '">' +
        '<span class="pIc" style="background:' + c[0] + ';color:' + c[1] + '">' + svg(n.ic, 1.8) + '</span>' +
        '<span><h5>' + n.t + '</h5><p>' + n.d + '</p><span class="when">' + n.when + '</span></span>' +
        '</a>';
    }).join("") || '<div class="popEmpty">No hay notificaciones.</div>';
    return '<div class="popover" id="proPopover">' +
      '<div class="popHead"><h4>Notificaciones</h4>' +
      '<button class="btnLink" id="popMarkAll" type="button">Marcar todo como leído</button></div>' +
      '<div class="popList">' + items + '</div>' +
      '<div class="popFoot"><a class="btnLink" href="admin-alertas.html">Centro de alertas</a></div>' +
      '</div>';
  }

  function burgerIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>';
  }

  function init() {
    var cfg = window.ADMIN_PAGE || {};
    var sidebar = document.getElementById("proSidebar");
    var topbar = document.getElementById("proTopbar");
    if (sidebar) sidebar.innerHTML = buildSidebar(cfg.active);
    if (topbar) {
      topbar.innerHTML = buildTopbar(cfg);
      var burger = topbar.querySelector("#tbBurger");
      if (burger) burger.innerHTML = burgerIcon();
      var logout = topbar.querySelector("#tbLogout");
      if (logout) logout.addEventListener("click", function () {
        window.homyoConfirm({ title: "¿Cerrar sesión?", body: "Saldrás del entorno de administración en este navegador. Tendrás que volver a introducir la clave de acceso.", ok: "Cerrar sesión", danger: true }).then(function (ok) { if (ok) window.adminLogout(); });
      });
    }

    var content = document.querySelector(".proContent");
    if (content) content.insertAdjacentHTML("beforeend", buildPopover());
    bindNotifs();
    fillDates();
    loadCmdk();
    fillFounder();
    if (H) {
      H.mountBar("admin");
      H.mountPending(cfg);
      H.ready.then(function (ctx) {
        if (!ctx) return;
        var p = ctx.profile || {}, u = ctx.user || {};
        var nm = p.full_name || u.email || "Administrador";
        BOSS.name = nm; BOSS.email = u.email || "";
        BOSS.initials = nm.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
        document.querySelectorAll(".sbAgencyName").forEach(function (el) { el.textContent = nm; });
        document.querySelectorAll(".sbAgencyLogo").forEach(function (el) { el.textContent = BOSS.initials; });
      });
    }
    var pop = document.getElementById("proPopover");
    var bell = document.getElementById("tbBell");
    if (bell && pop) {
      bell.addEventListener("click", function (e) { e.stopPropagation(); pop.classList.toggle("isOpen"); });
      document.addEventListener("click", function (e) { if (!pop.contains(e.target) && e.target !== bell) pop.classList.remove("isOpen"); });
    }

    var burger = document.getElementById("tbBurger");
    var scrim = document.getElementById("sbScrim");
    function openSb() { document.body.classList.add("sbOpen"); }
    function closeSb() { document.body.classList.remove("sbOpen"); }
    if (burger) burger.addEventListener("click", openSb);
    if (scrim) scrim.addEventListener("click", closeSb);
    if (sidebar) sidebar.addEventListener("click", function (e) { if (e.target.closest(".sbItem")) closeSb(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSb(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
