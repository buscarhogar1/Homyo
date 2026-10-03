/* HOMYO · Contactos de Pro con mensajes reales (solo modo real) */
(function () {
  "use strict";
  var H = window.HOMYO;
  if (!H || H.mode !== "real") return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ini(n) { return String(n || "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "·"; }
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  var I_MAIL = '<path d="M22 6 12 13 2 6"/><rect x="2" y="5" width="20" height="14" rx="2"/>';
  var I_TEL = '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>';
  var I_SEND = '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/>';
  var STAGES = [{ id: "new", t: "Nuevo", cls: "ok" }, { id: "replied", t: "Respondido", cls: "infop" }, { id: "visit", t: "Visita", cls: "gold" }, { id: "closed", t: "Cerrado", cls: "neutral" }];
  var DAYS = { mon: "lunes", tue: "martes", wed: "miércoles", thu: "jueves", fri: "viernes", sat: "sábado", sun: "domingo" };
  var PER = { morning: "mañana", afternoon: "tarde", evening: "tarde-noche" };
  var API = null, canReply = false, drafts = {};

  var css = document.createElement("style");
  css.textContent = ".hmThread{display:flex;flex-direction:column;gap:10px;margin:0 0 4px}.hmMsg{max-width:86%;padding:11px 14px;border-radius:12px;font-size:14px;line-height:1.55;white-space:pre-line;text-wrap:pretty}.hmMsg.in{align-self:flex-start;background:var(--bg);border:1px solid var(--line);color:var(--ink2)}.hmMsg.out{align-self:flex-end;background:var(--cardWarm);border:1px solid rgba(196,150,42,.35);color:var(--ink)}.hmMsg .who{display:block;font-size:11px;font-weight:600;color:var(--muted);margin-bottom:3px}.hmMsg.visit{border-style:dashed}.hmCompose{display:flex;flex-direction:column;gap:8px;margin-top:16px}.hmCompose textarea{min-height:92px;resize:vertical}.hmCompose .row{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap}.hmVisit{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}.hmVisit input{max-width:240px}";
  document.head.appendChild(css);
  // Sin datos reales todavía para el pipeline: se mantiene, pero los tiempos los calculamos
  function hoursSince(d) { return Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 36e5)); }

  function mapConv(c) {
    var msgs = (c.messages || []).slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    var buyerMsgs = msgs.filter(function (m) { return m.sender === "buyer"; });
    var lastBuyer = buyerMsgs.length ? buyerMsgs[buyerMsgs.length - 1].created_at : c.created_at;
    var s = c.listing_snapshot || {}, name = c.buyer_name || c.buyer_email || "Interesado";
    var price = s.price_eur ? H.fmt.eur(s.price_eur) + (s.listing_mode === "rent" || s.listing_mode === "room" ? "/mes" : "") : "";
    return {
      id: c.id, listing_id: c.listing_id, name: name, init: ini(name), email: c.buyer_email || "", tel: c.buyer_phone || "",
      prop: s.address || "Vivienda", zone: [s.neighborhood || s.city, price].filter(Boolean).join(" · "), photo: s.main_photo_url || "",
      h: hoursSince(c.status === "new" ? lastBuyer : c.last_message_at), st: c.status, visit: c.visit_label || "",
      msg: (buyerMsgs[0] && buyerMsgs[0].body) || "", messages: msgs, unread: c.agency_unread, created_at: c.created_at
    };
  }

  function visitTxt(v) {
    if (!v) return "";
    var p = [];
    if (v.days && v.days.length) p.push(v.days.map(function (d) { return DAYS[d] || d; }).join(", "));
    if (v.periods && v.periods.length) p.push("por la " + v.periods.map(function (x) { return PER[x] || x; }).join(" o "));
    if (v.slots && v.slots.length) p.push("(" + v.slots.join(", ") + ")");
    return "Solicita visita: " + (p.join(" ") || "sin preferencia") + (v.notes ? ". " + v.notes : "");
  }

  function detail(l, box) {
    if (!l) { box.innerHTML = '<div class="leadEmpty" style="padding:60px 20px;">' + (API ? "Selecciona un contacto." : "Cargando…") + '</div>'; return; }
    var cur = STAGES.map(function (s) { return s.id; }).indexOf(l.st);
    var thread = l.messages.map(function (m) {
      var out = m.sender === "agency", who = out ? (m.author_name || "Tu inmobiliaria") : (m.sender === "system" ? "Homyo" : l.name);
      var body = m.kind === "visit_request" ? visitTxt(m.visit) : m.body;
      return '<div class="hmMsg ' + (out ? "out" : "in") + (m.kind === "visit_request" ? " visit" : "") + '"><span class="who">' + esc(who) + ' · ' + H.fmt.ago(m.created_at).toLowerCase() + '</span>' + esc(body) + '</div>';
    }).join("");
    var pill = '<span class="pill ' + STAGES[cur].cls + '"><span class="dot"></span>' + STAGES[cur].t + '</span>';
    box.innerHTML =
      '<div class="dHead"><div class="dPerson"><span class="av">' + esc(l.init) + '</span><div><h2>' + esc(l.name) + '</h2><div class="sub">' + pill + (l.st === "new" ? '<span class="pill ' + (l.h >= 12 ? "warnp" : "neutral") + '">Sin responder · ' + l.h + ' h</span>' : '') + (l.st === "visit" && l.visit ? '<span class="pill neutral">Visita · ' + esc(l.visit) + '</span>' : '') + '</div></div></div>' +
      (l.email || l.tel ? '<div class="dContacts">' + (l.tel ? '<a href="tel:' + esc(l.tel.replace(/\s/g, "")) + '">' + ic(I_TEL) + esc(l.tel) + '</a>' : '') + (l.email ? '<a href="mailto:' + esc(l.email) + '">' + ic(I_MAIL) + esc(l.email) + '</a>' : '') + '</div>' : '') + '</div>' +
      '<div class="dBody"><div class="dProp"><span class="th"' + (l.photo ? ' style="background:url(\'' + String(l.photo).replace(/'/g, "%27") + '\') center/cover"' : '') + '></span><div><h4>' + esc(l.prop) + '</h4><p>' + esc(l.zone) + ' · primer mensaje ' + H.fmt.ago(l.created_at).toLowerCase() + '</p></div></div>' +
      '<p class="dLabel">Conversación</p><div class="hmThread">' + thread + '</div>' +
      (canReply
        ? '<form class="hmCompose" id="hmCompose"><textarea class="input" id="hmReply" maxlength="2000" placeholder="Escribe tu respuesta. ' + esc(l.name.split(" ")[0]) + ' la verá en su cuenta de Homyo."></textarea><div class="row"><span class="muted" style="font-size:12px">La respuesta llega a su bandeja de Homyo.</span><button class="btn primary" type="submit">' + ic(I_SEND) + 'Enviar respuesta</button></div></form>'
        : '<p class="muted" style="font-size:13px;margin-top:14px">Tu rol es de solo lectura: no puedes responder.</p>') +
      '<div class="stepper" role="group" aria-label="Estado del contacto">' + STAGES.map(function (s, i) { return '<button class="step' + (i === cur ? " isOn" : i < cur ? " isPast" : "") + '" type="button" data-stage="' + s.id + '"' + (canReply ? '' : ' disabled') + '><span class="bar"></span>' + s.t + '</button>'; }).join("") + '</div>' +
      (l.st === "visit" && canReply ? '<div class="hmVisit"><input class="input" id="hmVisitIn" placeholder="Ej. jueves 18:30" value="' + esc(l.visit) + '" /><button class="btn ghost sm" type="button" id="hmVisitSave">Guardar visita</button></div>' : '') +
      '<div class="directNote">' + ic('<path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/>') + '<span>Contacto directo con el interesado. Homyo no intermedia ni revende este dato.</span></div></div>';
    var ta = $("#hmReply");
    if (ta) {
      ta.value = drafts[l.id] || "";
      ta.addEventListener("input", function () { drafts[l.id] = ta.value; });
      $("#hmCompose").addEventListener("submit", function (e) {
        e.preventDefault();
        var body = ta.value.trim(); if (!body) return;
        var btn = $("#hmCompose button"); btn.disabled = true;
        H.sb.rpc("agency_reply", { p_conv: l.id, p_body: body }).then(function (r) {
          if (r.error) { btn.disabled = false; window.homyoToast("No se ha podido enviar: " + r.error.message); return; }
          drafts[l.id] = "";
          window.homyoToast("Respuesta enviada a " + l.name);
          load();
        });
      });
    }
    var vs = $("#hmVisitSave");
    if (vs) vs.addEventListener("click", function () {
      var v = $("#hmVisitIn").value.trim();
      H.sb.rpc("agency_set_conversation", { p_conv: l.id, p_status: "visit", p_visit_label: v }).then(function (r) {
        if (r.error) { window.homyoToast("No se ha podido guardar: " + r.error.message); return; }
        l.visit = v; window.homyoToast("Visita guardada"); API.render();
      });
    });
    if (l.unread && canReply) { l.unread = 0; H.sb.rpc("agency_set_conversation", { p_conv: l.id }); }
  }

  function setStage(l, st, rerender) {
    if (!canReply) return;
    var prev = l.st; l.st = st; rerender();
    H.sb.rpc("agency_set_conversation", { p_conv: l.id, p_status: st }).then(function (r) {
      if (r.error) { l.st = prev; rerender(); window.homyoToast("No se ha podido cambiar: " + r.error.message); return; }
      window.homyoToast(l.name + " · " + STAGES.filter(function (s) { return s.id === st; })[0].t);
    });
  }

  function metrics(rows) {
    var m0 = new Date(); m0 = new Date(m0.getFullYear(), m0.getMonth(), 1);
    $("#hdMonth").textContent = rows.filter(function (l) { return new Date(l.created_at) >= m0; }).length + " este mes";
    var d30 = Date.now() - 30 * 864e5, times = [];
    rows.forEach(function (l) {
      var fb = l.messages.filter(function (m) { return m.sender === "buyer"; })[0], fa = l.messages.filter(function (m) { return m.sender === "agency"; })[0];
      if (fb && new Date(fb.created_at).getTime() >= d30 && fa) times.push((new Date(fa.created_at) - new Date(fb.created_at)) / 6e4);
    });
    if (!times.length) { $("#mAvg").textContent = "—"; $("#mPct").textContent = "—"; return; }
    var avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
    $("#mAvg").innerHTML = avg >= 60 ? Math.floor(avg / 60) + "<small>h</small> " + Math.round(avg % 60) + "<small>min</small>" : Math.max(1, Math.round(avg)) + "<small>min</small>";
    $("#mPct").innerHTML = Math.round(times.filter(function (t) { return t < 1440; }).length / times.length * 100) + "<small>%</small>";
  }

  function load() {
    return H.ready.then(function () {
      return H.sb.from("conversations").select("*,messages(id,sender,author_name,kind,body,visit,created_at)").order("last_message_at", { ascending: false });
    }).then(function (r) {
      if (r.error) throw r.error;
      var rows = (r.data || []).map(mapConv);
      API.set(rows);
      $("#viewLeads").classList.toggle("hide", !rows.length);
      $("#viewEmpty").classList.toggle("hide", !!rows.length);
      metrics(rows);
      API.render();
    }).catch(function (e) {
      API.set([]); API.render();
      var m = (e && e.message) || "error";
      $("#leadItems").innerHTML = '<div class="leadEmpty">' + (/conversations/.test(m) ? "Falta ejecutar supabase/07-mensajes.sql en Supabase." : "No se han podido cargar los contactos (" + esc(m) + ").") + '</div>';
    });
  }

  window.HM_CT = {
    detail: detail, setStage: setStage,
    init: function (api) {
      API = api;
      canReply = H.ctx ? H.ctx.role !== "viewer" : true;
      H.ready.then(function (ctx) { canReply = ctx.role !== "viewer"; });
      var cr = document.querySelector(".tbCrumb");
      H.ready.then(function (ctx) { if (cr) cr.innerHTML = '<span data-hm-agency>' + esc(ctx.agency.name || "") + '</span> · ' + (ctx.role === "agent" ? "Contactos de tus viviendas" : "Bandeja de contactos"); });
      load();
      setInterval(function () { if (!document.hidden) load(); }, 30000);
    }
  };
})();
