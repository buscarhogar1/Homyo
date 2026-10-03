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

  var H = window.HOMYO;
  var MODE = H ? H.guard("pro") : "demo";
  if (!MODE) return;
  var REAL = MODE === "real";

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
  if (REAL) AGENCY = { name: "", legal: "", initials: "", city: "", plan: "", counts: {} };
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
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
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
    { ic: "subir", tone: "infop", unread: false, t: "Certificado energético pendiente", d: "Habitación en Calle Argumosa 22 — el plazo para aportar el certificado vence en 9 días.", when: "Hace 2 días", href: "pro-viviendas.html" },
    { ic: "viviendas", tone: "neutral", unread: false, t: "Una vivienda vuelve a estar disponible", d: "Otra agencia ha retirado un inmueble en Calle Castelló 30. Ya puedes publicarlo.", when: "Hace 4 días", href: "pro-viviendas.html" }
  ];
  if (REAL) NOTIFS = [];

  var READ_KEY = "homyo_pro_notifs_read";
  var readSet = [];
  try { readSet = JSON.parse(localStorage.getItem(READ_KEY) || "[]"); } catch (e) {}
  NOTIFS.forEach(function (n, i) { if (readSet.indexOf(i) > -1) n.unread = false; });
  function unreadCount() { return NOTIFS.filter(function (n) { return n.unread; }).length; }
  function markRead(i) {
    NOTIFS[i].unread = false;
    if (REAL) { if (H && NOTIFS[i].id) H.notifMark([NOTIFS[i].id]); return; }
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
    var A = [
      { g:"Acciones", t:"Subir vivienda", s:"Asistente paso a paso", href:"pro-subir-vivienda.html", quick:1, k:"nueva anuncio publicar" },
      { g:"Acciones", t:"Confirmar disponibilidad", s:"Viviendas con más de 60 días sin actualizar", href:"pro-viviendas.html?f=upd", quick:1 },
      { g:"Acciones", t:"Responder contactos nuevos", s:"Bandeja de contactos", href:"pro-contactos.html?f=new", quick:1, k:"leads interesados" },
      { g:"Acciones", t:"Invitar a un agente", s:"Equipo", href:"pro-equipo.html", k:"usuario miembro" },
      { g:"Acciones", t:"Descargar facturas", s:"Facturación", href:"pro-facturacion.html", k:"pdf recibo pago" },
      { g:"Acciones", t:"Hablar con soporte", s:"Ayuda", href:"pro-soporte.html", k:"ayuda duda" }
    ];
    NAV.forEach(function (n) { if (n.id) A.push({ g:"Páginas", t:n.label, href:n.href, quick:1 }); });
    if (REAL) return A;
    [
      ["Ático · Calle Ferraz 12","Moncloa · Publicada · 620.000 €","9872023VH5797S0001WX"],
      ["Piso reformado · Calle Velázquez 80","Salamanca · Publicada · 485.000 €","0145702VK4704N0009MQ"],
      ["Dúplex · Calle Goya 41","Salamanca · Rechazada · falta plano","3201914VK4730S0007BD"],
      ["Piso · Calle Hortaleza 88","Centro · Borrador",""],
      ["Estudio · Calle Fuencarral 120","Chamberí · Pendiente de revisión · 1.150 €/mes","7781204VK4778S0003KJ"],
      ["Chalet · Av. de Europa 9, Pozuelo","Pozuelo · Necesita actualización · 890.000 €","5512903VK2851S0001AB"],
      ["Piso · Calle Princesa 31","Argüelles · Necesita actualización · 455.000 €","9765104VK3796N0018FS"],
      ["Piso · Calle Ibiza 12","Retiro · Necesita actualización · 410.000 €","1347809VK4714N0022HD"],
      ["Piso exterior · Calle Bravo Murillo 200","Tetuán · Publicada · 298.000 €","6634012VK4763N0021CD"],
      ["Piso · Calle Alcalá 211","Salamanca · Retirada","3477301VK4737N0012LP"],
      ["Piso amueblado · Calle Príncipe de Vergara 150","Chamartín · Publicada · 2.100 €/mes","2290415VK4729S0014RT"],
      ["Habitación exterior · Calle Toledo 60","La Latina · Publicada · 520 €/mes","8123006VK4782S0006PL"],
      ["Habitación con baño · Calle Argumosa 22","Lavapiés · Publicada · 610 €/mes","8019813VK4781N0003GS"]
    ].forEach(function (v) { A.push({ g:"Viviendas", t:v[0], s:v[1] + (v[2] ? " · " + v[2] : ""), k:v[2], href:"pro-viviendas.html?q=" + encodeURIComponent(v[2] || v[0].split("· ")[1]) }); });
    [
      [1,"Lucía Bravo","Ático · Calle Ferraz 12"],[2,"Daniel Ortega","Chalet · Av. de Europa 9"],[6,"Pablo Ruiz","Habitación · Calle Toledo 60"],
      [7,"Elena Marín","Piso · Príncipe de Vergara 150"],[8,"Andrés Vidal","Piso · Bravo Murillo 200"],[3,"María Fernández","Piso · Calle Velázquez 80"],
      [4,"Jorge Alonso","Piso · Bravo Murillo 200"],[5,"Sara Giménez","Piso · Príncipe de Vergara 150"]
    ].forEach(function (l) { A.push({ g:"Contactos", t:l[1], s:l[2], href:"pro-contactos.html?lead=" + l[0], k:"contacto lead" }); });
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
        (o.input ? '<label class="hDlgF hDlgIn"><span></span><input class="input" type="number" min="1" inputmode="numeric" /></label>' : '') +
        '<div class="hDlgA"><button class="btn ghost sm" type="button" data-r="0"></button><button class="btn ' + (o.danger ? "danger" : "primary") + ' sm" type="button" data-r="1"></button></div></div>';
      w.querySelector("h3").textContent = o.title || "";
      w.querySelector(".hDlgP").textContent = o.body || "";
      w.querySelector('[data-r="0"]').textContent = o.cancel || "Cancelar";
      w.querySelector('[data-r="1"]').textContent = o.ok || "Confirmar";
      var sel = w.querySelector("select");
      if (o.field) { w.querySelector(".hDlgF span").textContent = o.field.label; o.field.options.forEach(function (x) { var op = document.createElement("option"); op.textContent = x; sel.appendChild(op); }); }
      var inp = w.querySelector(".hDlgIn input");
      if (inp) {
        w.querySelector(".hDlgIn span").textContent = o.input.label;
        inp.placeholder = o.input.placeholder || "";
        var syncIn = function () { w.querySelector(".hDlgIn").style.display = !o.input.showFor || (sel && o.input.showFor.indexOf(sel.value) > -1) ? "" : "none"; };
        if (sel) sel.addEventListener("change", syncIn);
        syncIn();
      }
      document.body.appendChild(w);
      var prev = document.activeElement;
      function done(v) { document.removeEventListener("keydown", key, true); var val = sel ? sel.value : true; if (inp) val = { choice: val, input: inp.value }; w.remove(); if (prev && prev.focus) prev.focus(); resolve(v ? val : false); }
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

  var IMP_KEY = "homyo_impersonate", imp = false;
  try {
    if (new URLSearchParams(location.search).get("ver_como") === "1") sessionStorage.setItem(IMP_KEY, "1");
    imp = sessionStorage.getItem(IMP_KEY) === "1";
  } catch (e) {}
  function setupImpersonation() {
    if (!imp) return;
    document.body.classList.add("isImp");
    var c = document.querySelector(".proContent");
    if (c) c.insertAdjacentHTML("afterbegin", '<div class="impBar" role="status"><span><b>Modo lectura</b> · Estás viendo la cuenta de ' + AGENCY.name + ' como equipo Homyo. No puedes hacer cambios.</span><a href="admin-profesional-detalle.html" id="impExit">Salir</a></div>');
    var ex = document.getElementById("impExit");
    if (ex) ex.addEventListener("click", function () { try { sessionStorage.removeItem(IMP_KEY); } catch (e) {} });
    var BLOCK = "button.btn, a.btn[href^='mailto'], a.btn[href^='tel'], .dContacts a, button.iconBtn, [data-confirm], [data-cupo], [data-inline], [data-stage], .tkCheck, .markBtn, input[type=submit]";
    document.addEventListener("click", function (e) {
      var t = e.target.closest(BLOCK);
      if (!t || t.closest(".impBar, .demoSwitch, .cmdk, .proTopbar, .popover, .hDlg, .toast")) return;
      e.preventDefault(); e.stopPropagation();
      if (window.homyoToast) window.homyoToast("Modo lectura · no puedes hacer cambios en esta cuenta");
    }, true);
    document.addEventListener("dragstart", function (e) { e.preventDefault(); }, true);
  }

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
      '<span><span class="sbAgencyName">' + AGENCY.name + '</span></span>' +
      '</a></div>';
    return html;
  }

  function buildTopbar(cfg) {
    var crumb = cfg.crumb || AGENCY.name + " · " + AGENCY.city;
    if (REAL) crumb = crumb.replace("Áurea Inmobiliaria", '<span data-hm-agency></span>');
    return '' +
      '<button class="tbBurger" id="tbBurger" aria-label="Abrir menú">' + svg("panel", 2) +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"></svg></button>' +
      '<div><div class="tbTitle">' + (cfg.title || "") + '</div>' +
      '<div class="tbCrumb">' + crumb + '</div></div>' +
      '<div class="tbRight">' +
      '<label class="tbSearch">' + svg("search", 2) +
      '<input type="text" placeholder="Buscar vivienda, contacto, referencia…" aria-label="Buscar" /></label>' +
      '<button class="tbIconBtn" id="tbBell" aria-label="Notificaciones">' + svg("bell", 1.8) +
      '<span class="cnt" id="tbBellCnt"></span></button>' +
      '<button class="tbIconBtn" id="tbLogout" aria-label="Cerrar sesión" title="Cerrar sesión">' + svg("logout", 1.8) + '</button>' +
      '</div>';
  }

  function popItems() {
    var e = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    return NOTIFS.map(function (n, i) {
      var c = toneColor(n.tone);
      return '<a class="popItem' + (n.unread ? ' unread' : '') + '" data-i="' + i + '" href="' + n.href + '">' +
        '<span class="pIc" style="background:' + c[0] + ';color:' + c[1] + '">' + svg(n.ic, 1.8) + '</span>' +
        '<span><h5>' + (REAL ? e(n.t) : n.t) + '</h5><p>' + (REAL ? e(n.d) : n.d) + '</p><span class="when">' + n.when + '</span></span>' +
        '</a>';
    }).join("") || '<div class="popEmpty">' + (REAL && !NOTIFS_LOADED ? "Cargando…" : "No tienes notificaciones.") + '</div>';
  }
  var NOTIFS_LOADED = false;
  function buildPopover() {
    var items = popItems();
    return '<div class="popover" id="proPopover">' +
      '<div class="popHead"><h4>Notificaciones</h4>' +
      '<button class="btnLink" id="popMarkAll" type="button">Marcar todo como leído</button></div>' +
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
      var logout = topbar.querySelector("#tbLogout");
      if (logout) logout.addEventListener("click", function () {
        window.homyoConfirm({ title: "¿Cerrar sesión?", body: REAL ? "Saldrás de tu cuenta profesional en este navegador." : "Saldrás del modo demo.", ok: "Cerrar sesión", danger: true }).then(function (ok) { if (ok && H) H.logout("pro"); });
      });
    }

    // notifications popover
    var content = document.querySelector(".proContent");
    if (content) content.insertAdjacentHTML("beforeend", buildPopover());
    bindNotifs();
    fillDates();
    loadCmdk();
    fillFounder();
    setupImpersonation();
    if (H) {
      H.mountBar("pro");
      H.mountPending(cfg);
      H.ready.then(function (ctx) {
        if (!ctx) return;
        if (H.proNotifs) H.proNotifs().then(function (list) {
          NOTIFS = list.slice(0, 8); NOTIFS_LOADED = true;
          var pl = document.querySelector("#proPopover .popList"); if (pl) pl.innerHTML = popItems();
          var all = list.filter(function (n) { return n.unread; }).length;
          refreshBell();
          var el = document.getElementById("tbBellCnt"); if (el && all > 0) { el.textContent = all > 9 ? "9+" : all; el.style.display = ""; }
          var nb = document.querySelector('.sbItem[href="pro-contactos.html"]');
          var nMsg = list.filter(function (n) { return n.cat === "contactos"; }).length;
          if (nb && H.setBadge) H.setBadge("pro-contactos.html", nMsg);
        }).catch(function () { NOTIFS_LOADED = true; var pl = document.querySelector("#proPopover .popList"); if (pl) pl.innerHTML = popItems(); });
        var ag = ctx.agency || {};
        var nm = ag.name || "Tu inmobiliaria";
        var ini = nm.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
        AGENCY.name = nm; AGENCY.initials = ini; AGENCY.city = ag.city || "";
        document.querySelectorAll(".sbAgencyName,[data-hm-agency]").forEach(function (el) { el.textContent = nm; });
        document.querySelectorAll(".sbAgencyLogo").forEach(function (el) { el.textContent = ini; });
      });
    }
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
    if (!REAL && Array.isArray(cfg.states) && cfg.states.length) buildDemoSwitch(cfg);
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
