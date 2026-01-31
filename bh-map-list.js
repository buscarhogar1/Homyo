// bh-map-list.js
(function () {
  window.BHMap = window.BHMap || {};
  const BHMap = window.BHMap;

  // Todavía no hay UI del listado definida: de momento no hace nada.
  // Cuando lo definas, este módulo renderizará en #bhList y reaccionará a update(rows).

  const listEl = document.getElementById("bhList");

  function update(rows) {
    // placeholder silencioso
    // si más adelante activas el listado, aquí renderizas
    // listEl.style.display = "block";
    // listEl.innerHTML = ...
  }

  BHMap.list = { update };
})();
