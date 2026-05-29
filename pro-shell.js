/* =========================================================
   HOMYO · Entorno profesional — shell compartido
   Inyecta barra lateral + cabecera + notificaciones + cambiador de estados.
   Cada página declara window.PRO_PAGE antes de cargar este script:
     { active:'panel', title:'Panel', crumb:'Áurea Inmobiliaria',
       states:[{id,label,desc}], onState:(id)=>{} }
   Estructura mínima de la página:
     <aside class="proSidebar" id="proSidebar"></aside>
     <div class="sbScrim" id="sbScrim"></div>
     <div class="proContent">
       <header class="proTopbar" id="proTopbar"></header>
       <main class="proMain"> ... </main>
     </div>
   ========================================================= */
(function () {
  "use strict";

  // ---- Cuenta de ejemplo coherente para todo el sistema ----
  var AGENCY = {
    name: "Áurea Inmobiliaria",
    legal: "Áurea Gestión Inmobiliaria, S.L.",
    initials: "ÁI",
    city: "Madrid",
    plan: "Agencia fundadora",
    counts: {
      activas: 18,
      completar: 4,
      revision: 2,
      rechazadas: 1,
      actualizar: 3,
      contactosNuevos: 5,
      contactosMes: 47
    }
  };
  window.PRO_AGENCY = AGENCY;

  var ICONS = {
    panel: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9.5h14V10"/><path d="M10 19.5V14h4v5.5"/>',
    viviendas: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    subir: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    contactos: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    analisis: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    perfil: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M10 21V13h4v8"/>',
    equipo: '<circle cx="9" cy="8" r="3.2"/><path d="M2.6 20c1.1-3.4 11.7-3.4 12.8 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.4c2.4 0 4.8 1.4 5.4 3"/>',
    facturacion: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    soporte: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9.1a3 3 0 0 1 5.7 1c0 2-3 2.5-3 4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    revision: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'
  };
  function svg(name, sw) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + '</svg>';
  }
  window.proIcon = svg;

  var NAV = [
    { group: "Gestión" },
    { id: "panel", label: "Panel", href: "pro-panel.html" },
    { id: "viviendas", label: "Viviendas", href: "pro-viviendas.html" },
    { id: "subir", label: "Subir vivienda", href: "pro-subir-vivienda.html" },
    { id: "contactos", label: "Contactos", href: "pro-contactos.html", badge: AGENCY.counts.contactosNuevos },
    { id: "analisis", label: "Análisis", href: "pro-analisis.html" },
    { group: "Cuenta" },
    { id: "perfil", label: "Perfil", href: "pro-perfil.html" },
    { id: "equipo", label: "Equipo", href: "pro-equipo.html" },
    { id: "facturacion", label: "Facturación", href: "pro-facturacion.html" },
    { id: "ajustes", label: "Ajustes", href: "pro-ajustes.html" },
    { id: "soporte", label: "Soporte", href: "pro-soporte.html" }
  ];

  var NOTIFS = [
    { ic: "subir", tone: "warnp", unread: true, t: "Vivienda pendiente de completar", d: "Piso en Calle Hortaleza 88 — faltan fotografías y certificado energético.", when: "Hace 20 min", href: "pro-subir-vivienda.html" },
    { ic: "contactos", tone: "ok", unread: true, t: "Nueva solicitud de contacto", d: "Lucía Bravo está interesada en el Ático en Calle Ferraz.", when: "Hace 1 h", href: "pro-contactos.html" },
    { ic: "revision", tone: "dangerp", unread: true, t: "Anuncio rechazado por falta de plano", d: "Dúplex en Calle Goya — sube el plano en planta para volver a revisión.", when: "Hace 3 h", href: "pro-revision-calidad.html" },
    { ic: "viviendas", tone: "warnp", unread: true, t: "Falta confirmar disponibilidad", d: "3 viviendas llevan más de 60 días sin actualizar. Confirma que siguen disponibles.", when: "Ayer", href: "pro-viviendas.html" },
    { ic: "subir", tone: "infop", unread: false, t: "Certificado energético pendiente", d: "Chalet en Pozuelo — el plazo para aportar el certificado vence en 9 días.", when: "Hace 2 días", href: "pro-viviendas.html" },
    { ic: "viviendas", tone: "neutral", unread: false, t: "Una vivienda vuelve a estar disponible", d: "Otra agencia ha retirado un inmueble en Calle Alcalá. Ya puedes publicarlo.", when: "Hace 4 días", href: "pro-viviendas.html" }
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
      '<a class="sbBrandMark" href="pro-panel.html">H<span class="brandO">O</span>MY<span class="brandO">O</span></a>' +
      '<span class="sbBrandTag">Pro</span>' +
      '</div>';
    html += '<nav class="sbNav">';
    html += '<div class="sbCta"><a class="btn primary block sm" href="pro-subir-vivienda.html">' + svg("subir", 2.2) + ' Subir vivienda</a></div>';
    NAV.forEach(function (it) {
      if (it.group) { html += '<div class="sbGroupLabel">' + it.group + '</div>'; return; }
      var badge = it.badge ? '<span class="sbBadge">' + it.badge + '</span>' : '';
      html += '<a class="sbItem' + (it.id === active ? ' isActive' : '') + '" href="' + it.href + '">' +
        svg(it.id) + '<span>' + it.label + '</span>' + badge + '</a>';
    });
    html += '</nav>';
    html += '<div class="sbFoot">' +
      '<a class="sbAgency" href="pro-perfil.html">' +
      '<span class="sbAgencyLogo">' + AGENCY.initials + '</span>' +
      '<span><span class="sbAgencyName">' + AGENCY.name + '</span>' +
      '<span class="sbAgencyMeta"><span class="dotok"></span>Cuenta verificada</span></span>' +
      '</a></div>';
    return html;
  }

  function buildTopbar(cfg) {
    var crumb = cfg.crumb || AGENCY.name + " · " + AGENCY.city;
    return '' +
      '<button class="tbBurger" id="tbBurger" aria-label="Abrir menú">' + svg("panel", 2) +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"></svg></button>' +
      '<div><div class="tbTitle">' + (cfg.title || "") + '</div>' +
      '<div class="tbCrumb">' + crumb + '</div></div>' +
      '<div class="tbRight">' +
      '<label class="tbSearch">' + svg("search", 2) +
      '<input type="text" placeholder="Buscar vivienda, contacto, referencia…" aria-label="Buscar" /></label>' +
      '<button class="tbIconBtn" id="tbBell" aria-label="Notificaciones">' + svg("bell", 1.8) +
      '<span class="dot"></span></button>' +
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
      '<a class="btnLink" href="pro-notificaciones.html">Ver todas</a></div>' +
      '<div class="popList">' + items + '</div>' +
      '<div class="popFoot"><a class="btnLink" href="pro-notificaciones.html">Centro de notificaciones</a></div>' +
      '</div>';
  }

  function buildBurgerIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>';
  }

  function init() {
    var cfg = window.PRO_PAGE || {};
    var sidebar = document.getElementById("proSidebar");
    var topbar = document.getElementById("proTopbar");
    if (sidebar) sidebar.innerHTML = buildSidebar(cfg.active);
    if (topbar) {
      topbar.innerHTML = buildTopbar(cfg);
      var burger = topbar.querySelector("#tbBurger");
      if (burger) burger.innerHTML = buildBurgerIcon();
    }

    // notifications popover
    var content = document.querySelector(".proContent");
    if (content) content.insertAdjacentHTML("beforeend", buildPopover());
    var pop = document.getElementById("proPopover");
    var bell = document.getElementById("tbBell");
    if (bell && pop) {
      bell.addEventListener("click", function (e) {
        e.stopPropagation();
        pop.classList.toggle("isOpen");
      });
      document.addEventListener("click", function (e) {
        if (!pop.contains(e.target) && e.target !== bell) pop.classList.remove("isOpen");
      });
    }

    // mobile drawer
    var burger = document.getElementById("tbBurger");
    var scrim = document.getElementById("sbScrim");
    function openSb() { document.body.classList.add("sbOpen"); }
    function closeSb() { document.body.classList.remove("sbOpen"); }
    if (burger) burger.addEventListener("click", openSb);
    if (scrim) scrim.addEventListener("click", closeSb);
    if (sidebar) sidebar.addEventListener("click", function (e) {
      if (e.target.closest(".sbItem")) closeSb();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSb(); });

    // demo state switcher
    if (Array.isArray(cfg.states) && cfg.states.length) buildDemoSwitch(cfg);
  }

  function buildDemoSwitch(cfg) {
    var key = "homyo_pro_view_" + (cfg.active || "x");
    var saved = null;
    try { saved = localStorage.getItem(key); } catch (e) {}
    var current = saved && cfg.states.some(function (s) { return s.id === saved; }) ? saved : cfg.states[0].id;

    var wrap = document.createElement("div");
    wrap.className = "demoSwitch";
    wrap.innerHTML =
      '<button class="demoToggle" id="demoToggle">' + svg("sliders", 2) + 'Estado demo</button>' +
      '<div class="demoPanel" id="demoPanel">' +
      '<p class="dTitle">Estados de esta pantalla</p>' +
      '<p class="dSub">Vista de prototipo · cambia el contenido para revisar cada estado.</p>' +
      '<div class="demoOpts" id="demoOpts">' +
      cfg.states.map(function (s) {
        return '<button class="demoOpt' + (s.id === current ? ' isOn' : '') + '" data-state="' + s.id + '">' +
          '<span class="rdot"></span><span>' + s.label + '</span></button>';
      }).join("") +
      '</div></div>';
    document.body.appendChild(wrap);

    var toggle = wrap.querySelector("#demoToggle");
    var panel = wrap.querySelector("#demoPanel");
    toggle.addEventListener("click", function (e) { e.stopPropagation(); panel.classList.toggle("isOpen"); });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) panel.classList.remove("isOpen"); });

    function apply(id) {
      document.body.setAttribute("data-view", id);
      wrap.querySelectorAll(".demoOpt").forEach(function (b) {
        b.classList.toggle("isOn", b.getAttribute("data-state") === id);
      });
      try { localStorage.setItem(key, id); } catch (e) {}
      if (typeof cfg.onState === "function") cfg.onState(id);
    }
    wrap.querySelectorAll(".demoOpt").forEach(function (b) {
      b.addEventListener("click", function () { apply(b.getAttribute("data-state")); panel.classList.remove("isOpen"); });
    });
    apply(current);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
