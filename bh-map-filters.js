// bh-map-filters.js
(function () {
  window.BHMap = window.BHMap || {};
  const BHMap = window.BHMap;

  // Todavía no hay UI definida: de momento, solo devolvemos los params desde la URL
  // Cuando definas los filtros, este módulo será el que:
  // - renderice inputs en #bhFilters
  // - mantenga estado
  // - escriba querystring
  // - llame a BHMap.scheduleReload()

  BHMap.filters = {
    getParams: function () {
      return (BHMap.getParamsFromURL) ? BHMap.getParamsFromURL() : {};
    }
  };
})();
