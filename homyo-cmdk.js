/* HOMYO · Buscador global (⌘K / Ctrl+K / "/")
   Lee window.HOMYO_CMDK_ITEMS = [{ g, t, s, k, href, quick }] */
(function () {
  "use strict";
  var items = window.HOMYO_CMDK_ITEMS || [], ov, inp, list, sel = 0, flat = [];
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var GORDER = {};
  items.forEach(function (it) { if (!(it.g in GORDER)) GORDER[it.g] = Object.keys(GORDER).length; });

  function build() {
    ov = document.createElement("div");
    ov.className = "cmdk";
    ov.innerHTML = '<div class="cmdkBox" role="dialog" aria-modal="true" aria-label="Buscar">' +
      '<div class="cmdkIn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>' +
      '<input type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(document.querySelector(".tbSearch input") ? document.querySelector(".tbSearch input").placeholder : "Buscar…") + '" aria-label="Buscar" /><kbd>Esc</kbd></div>' +
      '<div class="cmdkList" role="listbox"></div>' +
      '<div class="cmdkFoot"><span><kbd>↑</kbd><kbd>↓</kbd> moverte</span><span><kbd>↵</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span></div></div>';
    document.body.appendChild(ov);
    inp = ov.querySelector("input");
    list = ov.querySelector(".cmdkList");
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    inp.addEventListener("input", function () { sel = 0; render(); });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(flat.length - 1, sel + 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); go(flat[sel]); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    list.addEventListener("click", function (e) { var a = e.target.closest(".cmdkItem"); if (a) { e.preventDefault(); go(flat[+a.getAttribute("data-i")]); } });
    list.addEventListener("mousemove", function (e) { var a = e.target.closest(".cmdkItem"); if (a) { var i = +a.getAttribute("data-i"); if (i !== sel) { sel = i; mark(); } } });
  }
  function search(q) {
    var n = norm(q).trim();
    if (!n) return items.filter(function (it) { return it.quick; });
    var toks = n.split(/\s+/);
    return items.map(function (it) {
      var h = norm(it.t + " " + (it.s || "") + " " + (it.k || "") + " " + it.g);
      if (!toks.every(function (t) { return h.indexOf(t) > -1; })) return null;
      return { it: it, sc: norm(it.t).indexOf(toks[0]) === 0 ? 0 : norm(it.t).indexOf(toks[0]) > -1 ? 1 : 2 };
    }).filter(Boolean).sort(function (a, b) { return (GORDER[a.it.g] - GORDER[b.it.g]) || (a.sc - b.sc); }).map(function (x) { return x.it; }).slice(0, 30);
  }
  function render() {
    flat = search(inp.value);
    if (!flat.length) { list.innerHTML = '<div class="cmdkEmpty">Sin resultados para «' + esc(inp.value) + '»</div>'; return; }
    var html = "", g = null;
    flat.forEach(function (it, i) {
      if (it.g !== g) { g = it.g; html += '<div class="cmdkGroup">' + esc(g) + '</div>'; }
      html += '<a class="cmdkItem" role="option" data-i="' + i + '" href="' + it.href + '"><span class="cmdkT">' + esc(it.t) + '</span>' + (it.s ? '<span class="cmdkS">' + esc(it.s) + '</span>' : '<span class="cmdkS"></span>') + '<span class="cmdkGo">↵</span></a>';
    });
    list.innerHTML = html;
    mark();
  }
  function mark() {
    var els = list.querySelectorAll(".cmdkItem");
    els.forEach(function (el, i) { el.classList.toggle("isSel", i === sel); el.setAttribute("aria-selected", i === sel ? "true" : "false"); });
    var cur = els[sel];
    if (cur) {
      var top = cur.offsetTop, bot = top + cur.offsetHeight;
      if (top < list.scrollTop + 28) list.scrollTop = Math.max(0, top - 28);
      else if (bot > list.scrollTop + list.clientHeight) list.scrollTop = bot - list.clientHeight + 6;
    }
  }
  function go(it) { if (it) { close(); window.location.href = it.href; } }
  function open() {
    if (!ov) build();
    ov.classList.add("isOpen");
    inp.value = ""; sel = 0; render();
    setTimeout(function () { inp.focus(); }, 0);
  }
  function close() { if (ov) ov.classList.remove("isOpen"); }

  var ti = document.querySelector(".tbSearch input"), lab = document.querySelector(".tbSearch");
  if (ti) {
    ti.readOnly = true;
    ti.addEventListener("focus", function () { ti.blur(); open(); });
  }
  if (lab) {
    lab.addEventListener("click", function (e) { e.preventDefault(); open(); });
    lab.insertAdjacentHTML("beforeend", '<kbd class="tbKbd">' + (isMac ? "⌘K" : "Ctrl K") + '</kbd>');
  }
  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase(), typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (ov && ov.classList.contains("isOpen")) close(); else open(); }
    else if (e.key === "/" && !typing) { e.preventDefault(); open(); }
  });
  window.homyoCmdk = { open: open, close: close };
})();
