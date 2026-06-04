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
  var SESSION_KEY = "homyo_admin_session";
  function isAuthed() {
    try { return sessionStorage.getItem(SESSION_KEY) === "ok"; } catch (e) { return false; }
  }
  // Las páginas del shell exigen sesión. El gate marca window.ADMIN_GATE = true.
  if (!window.ADMIN_GATE && !isAuthed()) {
    window.location.replace("admin-gate.html");
    return;
  }
  window.adminLogout = function () {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    window.location.replace("admin-gate.html");
  };

  /* ---------- IDENTIDAD DEL JEFE ---------- */
  var BOSS = { name: "Dirección Homyo", initials: "DH", role: "Administrador general", email: "direccion@homyo.es" };
  window.ADMIN_BOSS = BOSS;

  /* ---------- DATOS DEMO GLOBALES (coherentes con el entorno pro) ---------- */
  var DATA = {
    counts: {
      solicitudes: 4,      // altas de inmobiliaria pendientes
      anuncios: 9,         // anuncios en cola de moderación
      mensajes: 6,         // mensajes de soporte sin leer
      incidencias: 3
    },
    kpis: {
      inmobiliarias: 128,
      profesionales: 412,
      usuarios: 18420,
      anunciosActivos: 3964,
      mrr: 27718,          // ingresos recurrentes mensuales (€)
      mrrPrev: 25210
    }
  };
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
    equipo: '<circle cx="9" cy="8" r="3.2"/><path d="M2.6 20c1.1-3.4 11.7-3.4 12.8 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.4c2.4 0 4.8 1.4 5.4 3"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
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
    { id: "equipo", label: "Equipo Homyo", href: "admin-equipo.html" },
    { id: "ajustes", label: "Ajustes", href: "admin-ajustes.html" }
  ];

  var NOTIFS = [
    { ic: "solicitudes", tone: "infop", unread: true, t: "Nueva solicitud de alta", d: "Nidos del Sur Gestión Inmobiliaria (Sevilla) ha solicitado acceso. Documentación adjunta.", when: "Hace 12 min", href: "admin-solicitudes.html" },
    { ic: "anuncios", tone: "warnp", unread: true, t: "Anuncio marca el límite de revisión", d: "Ático en Calle Ferraz 12 (Áurea Inmobiliaria) lleva 14 h en cola de moderación.", when: "Hace 40 min", href: "admin-anuncios.html" },
    { ic: "incidencias", tone: "dangerp", unread: true, t: "Posible anuncio duplicado reportado", d: "Un usuario ha reportado un piso en Calle Goya con la misma referencia que otra agencia.", when: "Hace 2 h", href: "admin-incidencias.html" },
    { ic: "facturacion", tone: "ok", unread: true, t: "Cobro mensual ejecutado", d: "Se han cobrado 412 suscripciones de vivienda. 7 pagos han fallado y requieren revisión.", when: "Hoy, 06:00", href: "admin-facturacion.html" },
    { ic: "mensajes", tone: "infop", unread: false, t: "Mensaje de soporte sin responder", d: "Inmobiliaria Vega pregunta por el certificado energético obligatorio.", when: "Ayer", href: "admin-mensajes.html" },
    { ic: "usuarios", tone: "neutral", unread: false, t: "Pico de registros de usuarios", d: "+318 usuarios nuevos esta semana, un 22 % más que la media.", when: "Hace 2 días", href: "admin-estadisticas.html" }
  ];

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
      '<span class="dot"></span></button>' +
      '<button class="tbIconBtn" id="tbLogout" aria-label="Cerrar sesión" title="Cerrar sesión">' + svg("logout", 1.8) + '</button>' +
      '</div>';
  }

  function buildPopover() {
    var items = NOTIFS.map(function (n) {
      var c = toneColor(n.tone);
      return '<a class="popItem' + (n.unread ? ' unread' : '') + '" href="' + n.href + '">' +
        '<span class="pIc" style="background:' + c[0] + ';color:' + c[1] + '">' + svg(n.ic, 1.8) + '</span>' +
        '<span><h5>' + n.t + '</h5><p>' + n.d + '</p><span class="when">' + n.when + '</span></span>' +
        '</a>';
    }).join("");
    return '<div class="popover" id="proPopover">' +
      '<div class="popHead"><h4>Notificaciones</h4>' +
      '<a class="btnLink" href="admin-alertas.html">Ver todas</a></div>' +
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
        if (confirm("¿Cerrar la sesión del entorno de administración?")) window.adminLogout();
      });
    }

    var content = document.querySelector(".proContent");
    if (content) content.insertAdjacentHTML("beforeend", buildPopover());
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
