/* =========================================================
   HOMYO · Atajo secreto al entorno de administración
   Se incluye en páginas públicas (index, map, listing). No añade
   NINGÚN elemento visible: solo escucha un acceso oculto.

   Dos formas de entrar (solo las conoce la dirección):
     1) Teclear la palabra clave   h o m y o   seguida (fuera de
        cualquier campo de texto), en menos de 1,5 s entre teclas.
     2) Combinación  Ctrl/Cmd + Shift + H.
   Ambas llevan a admin-gate.html (pantalla de contraseña).
   ========================================================= */
(function () {
  "use strict";

  var SECRET = "homyo";
  var GATE = "admin-gate.html";
  var buffer = "";
  var lastTime = 0;
  var RESET_MS = 1500;
  var enabled = true;
  try { enabled = localStorage.getItem("homyo_rule_shortcut") !== "off"; } catch (e) {}
  try {
    fetch("https://dpusnylssfjnksbieimj.supabase.co/rest/v1/platform_settings?id=eq.1&select=rules", { headers: { apikey: "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j[0] || !j[0].rules) return;
        enabled = j[0].rules.shortcut !== false;
        try { localStorage.setItem("homyo_rule_shortcut", enabled ? "on" : "off"); } catch (e) {}
      }, function () {});
  } catch (e) {}

  function inField(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }

  function go() {
    buffer = "";
    window.location.href = GATE;
  }

  document.addEventListener("keydown", function (e) {
    if (!enabled) return;
    // Combo Ctrl/Cmd + Shift + H
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "H" || e.key === "h")) {
      e.preventDefault();
      go();
      return;
    }

    // Secuencia tecleada (ignorada si se está escribiendo en un campo)
    if (inField(document.activeElement)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = (e.key || "").toLowerCase();
    if (k.length !== 1 || !/[a-z]/.test(k)) return;

    var now = Date.now();
    if (now - lastTime > RESET_MS) buffer = "";
    lastTime = now;

    buffer += k;
    if (buffer.length > SECRET.length) buffer = buffer.slice(-SECRET.length);
    if (buffer === SECRET) go();
  });
})();
