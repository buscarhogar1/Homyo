/* =========================================================
   HOMYO · Modo demo / real para los entornos Pro y Admin
   - demo: datos de ejemplo, se puede avanzar sin completar nada, no toca Supabase.
   - real: sesión de Supabase; solo se muestra información real.
   Credenciales demo (válidas en Pro y Admin): demo@homyo.es / homyo2026
   Se carga ANTES de pro-shell.js / admin-shell.js.
   ========================================================= */
(function () {
  "use strict";
  var SB_URL = "https://dpusnylssfjnksbieimj.supabase.co";
  var SB_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";
  var DEMO = { email: "demo@homyo.es", password: "homyo2026" };
  var CFG = {
    admin: { key: "homyo_admin_mode", store: "session", login: "admin-gate.html", home: "admin-panel.html" },
    pro: { key: "homyo_pro_mode", store: "local", login: "cuenta-inmobiliaria.html", home: "pro-panel.html", pending: "pro-cuenta-pendiente.html" }
  };
  var H = window.HOMYO = { DEMO_EMAIL: DEMO.email, mode: null, area: null, ctx: null, sb: null };

  function store(a) { try { return CFG[a].store === "session" ? sessionStorage : localStorage; } catch (e) { return null; } }
  function getMode(a) {
    var m = null;
    try {
      m = store(a).getItem(CFG[a].key);
      if (!m && a === "admin" && sessionStorage.getItem("homyo_admin_session") === "ok") m = "demo";
    } catch (e) {}
    return m === "demo" || m === "real" ? m : null;
  }
  function setMode(a, m) {
    try {
      if (m) store(a).setItem(CFG[a].key, m); else store(a).removeItem(CFG[a].key);
      if (a === "admin") sessionStorage.removeItem("homyo_admin_session");
    } catch (e) {}
  }

  var clientP = null;
  function client() {
    if (!clientP) clientP = import("https://esm.sh/@supabase/supabase-js@2").then(function (m) { return m.createClient(SB_URL, SB_KEY); });
    return clientP;
  }

  function esMsg(err) {
    var m = (err && err.message) || "";
    if (/invalid login/i.test(m)) return "Email o contraseña incorrectos.";
    if (/not confirmed/i.test(m)) return "Confirma tu email antes de entrar (revisa tu bandeja de entrada).";
    if (/fetch|network/i.test(m)) return "No hay conexión con el servidor. Inténtalo de nuevo.";
    return m || "No se ha podido iniciar sesión.";
  }

  var PENDING = { pending: "revision", needs_docs: "falta", rejected: "rechazada", suspended: "rechazada" };
  async function loadCtx(a, c, user) {
    var pr = await c.from("profiles").select("id,agency_id,role,full_name").eq("id", user.id).maybeSingle();
    var profile = pr.data || null;
    if (a === "admin") {
      var r = await c.rpc("is_platform_admin");
      if (r.error || !r.data) return { error: "Esta cuenta no tiene permisos de administración." };
      return { user: user, profile: profile };
    }
    if (!profile || !profile.agency_id) {
      var inv = await c.rpc("accept_my_invite");
      if (!inv.error && inv.data) {
        pr = await c.from("profiles").select("id,agency_id,role,full_name").eq("id", user.id).maybeSingle();
        profile = pr.data || null;
      }
    }
    if (!profile || !profile.agency_id) return { user: user, profile: profile, pending: "revision" };
    var ag = await c.from("agencies").select("*").eq("id", profile.agency_id).maybeSingle();
    var agency = ag.data || null;
    if (!agency) return { user: user, profile: profile, pending: "revision" };
    if (agency.status && agency.status !== "approved") return { user: user, profile: profile, agency: agency, pending: PENDING[agency.status] || "revision" };
    var rr = profile.role;
    return { user: user, profile: profile, agency: agency, role: rr === "agent" || rr === "editor" ? "agent" : rr === "viewer" ? "viewer" : "admin" };
  }

  // Páginas Pro restringidas por rol (el resto: todos)
  var PAGE_ROLES = { "pro-subir-vivienda.html": ["admin", "agent"], "pro-facturacion.html": ["admin"], "pro-pago.html": ["admin"] };
  H.canEdit = function (listing) {
    var x = H.ctx; if (!x || H.mode !== "real") return true;
    if (x.role === "admin") return true;
    return x.role === "agent" && !!listing && listing.assigned_to === x.user.id;
  };
  H.canCreate = function () { return !H.ctx || H.ctx.role !== "viewer"; };
  H.isAgencyAdmin = function () { return !H.ctx || H.ctx.role === "admin"; };
  H.ROLE_LABEL = { admin: "Administrador", agent: "Agente", viewer: "Solo lectura" };

  H.getMode = getMode;
  H.client = client;
  H.enterDemo = function (a) { setMode(a, "demo"); };
  H.enterReal = function (a) { setMode(a, "real"); };

  H.login = async function (a, email, pw) {
    email = (email || "").trim().toLowerCase();
    if (email === DEMO.email && pw === DEMO.password) { setMode(a, "demo"); return { mode: "demo" }; }
    if (!email || !pw) throw new Error("Escribe tu email y tu contraseña.");
    var c = await client();
    var r = await c.auth.signInWithPassword({ email: email, password: pw });
    if (r.error) throw new Error(esMsg(r.error));
    var ctx = await loadCtx(a, c, r.data.user);
    if (ctx.error) { await c.auth.signOut(); throw new Error(ctx.error); }
    setMode(a, "real");
    return { mode: "real", ctx: ctx };
  };

  H.logout = async function (a) {
    var m = getMode(a);
    setMode(a, null);
    if (m === "real") { try { var c = await client(); await c.auth.signOut(); } catch (e) {} }
    location.replace(CFG[a].login);
  };

  var readyResolve;
  H.ready = new Promise(function (r) { readyResolve = r; });

  function fatal() {
    document.documentElement.classList.remove("hmWait");
    var show = function () {
      var d = document.createElement("div");
      d.className = "hmFatal";
      d.innerHTML = "<b>No se ha podido conectar con Homyo.</b> Revisa tu conexión y recarga la página.";
      document.body.appendChild(d);
    };
    if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
  }

  H.guard = function (a) {
    var m = getMode(a);
    if (!m && a === "pro") {
      try {
        var imp = sessionStorage.getItem("homyo_impersonate") === "1" || /[?&]ver_como=1/.test(location.search);
        if (imp && getMode("admin")) m = "demo";
      } catch (e) {}
    }
    if (!m) { location.replace(CFG[a].login); return null; }
    H.mode = m; H.area = a;
    document.documentElement.setAttribute("data-hm-mode", m);
    if (m === "demo") { readyResolve(null); return m; }
    document.documentElement.classList.add("hmWait");
    (async function () {
      try {
        var c = await client();
        var s = await c.auth.getSession();
        var user = s.data && s.data.session && s.data.session.user;
        if (!user) { setMode(a, null); location.replace(CFG[a].login); return; }
        var ctx = await loadCtx(a, c, user);
        if (ctx.error) { await H.logout(a); return; }
        if (ctx.pending && a === "pro") { location.replace(CFG.pro.pending + "?estado=" + ctx.pending); return; }
        H.ctx = ctx; H.sb = c;
        if (a === "pro" && ctx.role) {
          document.documentElement.setAttribute("data-hm-role", ctx.role);
          var page = (location.pathname.split("/").pop() || "").toLowerCase();
          var allow = PAGE_ROLES[page];
          if (allow && allow.indexOf(ctx.role) < 0) {
            var block = function () {
              var main = document.querySelector(".proMain"); if (!main) return;
              Array.prototype.forEach.call(main.children, function (el) { el.classList.add("hmHidden"); });
              main.insertAdjacentHTML("beforeend", '<section class="hmEmpty"><span class="hmEmptyIc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span><h2>No tienes permiso para esta sección</h2><p>Tu rol en la inmobiliaria es <b>' + H.ROLE_LABEL[ctx.role] + '</b>. Si necesitas acceso, pídeselo a un administrador de tu equipo.</p><p><a href="pro-panel.html">Volver al panel</a></p></section>');
            };
            if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", block); else block();
            ctx.blocked = true;
          }
        }
        document.documentElement.classList.remove("hmWait");
        readyResolve(ctx);
        document.dispatchEvent(new CustomEvent("homyo:ready", { detail: ctx }));
      } catch (e) { fatal(); }
    })();
    return m;
  };

  H.mountBar = function (a) {
    if (H.mode !== "demo" || document.body.classList.contains("isImp")) return;
    var c = document.querySelector(".proContent");
    if (!c || c.querySelector(".hmBar")) return;
    c.insertAdjacentHTML("afterbegin", '<div class="hmBar" role="status"><span><b>Modo demo</b> · Datos de ejemplo. Puedes avanzar sin completar nada y no se guarda nada real.</span><button type="button" id="hmExit">Salir del demo</button></div>');
    document.getElementById("hmExit").addEventListener("click", function () { H.logout(a); });
  };

  H.mountPending = function (cfg) {
    if (H.mode !== "real" || (cfg && cfg.live)) return;
    var main = document.querySelector(".proMain");
    if (!main) return;
    Array.prototype.forEach.call(main.children, function (el) { el.classList.add("hmHidden"); });
    main.insertAdjacentHTML("beforeend",
      '<section class="hmEmpty" data-screen-label="Sección sin conectar">' +
      '<span class="hmEmptyIc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><path d="M8 12h8"/></svg></span>' +
      '<h2>Esta sección aún no está conectada</h2>' +
      '<p>En tu cuenta real solo mostramos información real. Esta pantalla todavía no lee tus datos de Homyo, así que la ocultamos para no enseñarte ejemplos.</p>' +
      '<p class="hmEmptyNote">Mientras tanto, puedes revisarla con datos de ejemplo entrando en modo demo.</p>' +
      '</section>');
  };

  var css = document.createElement("style");
  css.id = "homyo-mode-css";
  css.textContent =
    "html.hmWait body{visibility:hidden}" +
    "[data-hm-mode=real] .demoSwitch{display:none!important}" +
    "[data-hm-role=agent] .sbItem[href='pro-facturacion.html'],[data-hm-role=viewer] .sbItem[href='pro-facturacion.html'],[data-hm-role=viewer] .sbItem[href='pro-subir-vivienda.html'],[data-hm-role=viewer] a.btn[href^='pro-subir-vivienda.html']{display:none!important}" +
    ".hmHidden{display:none!important}" +
    ".hmBar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:var(--cardWarm,#fbf5e9);border-bottom:1px solid rgba(196,150,42,.35);color:var(--ink2,#4a4640);padding:9px 24px;font-size:13px;line-height:1.4}" +
    ".hmBar b{color:var(--granate,#8C1F2D);font-weight:700}" +
    ".hmBar button{appearance:none;cursor:pointer;white-space:nowrap;flex-shrink:0;background:#fff;border:1px solid var(--line,#ece6db);border-radius:999px;padding:6px 13px;font:600 12px/1 system-ui,sans-serif;color:var(--granate,#8C1F2D)}" +
    ".hmBar button:hover{border-color:var(--granate,#8C1F2D)}" +
    ".hmEmpty{max-width:540px;margin:64px auto;padding:40px 32px;text-align:center;background:#fff;border:1px solid var(--line,#ece6db);border-radius:var(--rad,6px);display:flex;flex-direction:column;align-items:center;gap:12px}" +
    ".hmEmptyIc{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:var(--cardWarm,#fbf5e9);border:1px solid rgba(196,150,42,.3);color:var(--granate,#8C1F2D)}" +
    ".hmEmptyIc svg{width:24px;height:24px}" +
    ".hmEmpty h2{margin:6px 0 0;font-family:'Raleway',sans-serif;font-size:22px;font-weight:500;color:var(--granate,#8C1F2D)}" +
    ".hmEmpty p{margin:0;font-size:14.5px;line-height:1.55;color:var(--ink2,#4a4640);text-wrap:pretty}" +
    ".hmEmpty .hmEmptyNote{font-size:13px;color:var(--muted,#8a857d)}" +
    ".popEmpty{padding:28px 20px;text-align:center;font-size:13px;color:var(--muted,#8a857d)}" +
    ".hmFatal{position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:999;background:#fff;border:1px solid var(--line,#ece6db);border-radius:6px;padding:12px 18px;font-size:13.5px;color:var(--ink,#1d1a17);box-shadow:0 18px 50px rgba(29,26,23,.16)}";
  (document.head || document.documentElement).appendChild(css);
})();
