/* ============================================================
   Homyo · Gazetteer local de España para el autocompletado.
   Ofrece coincidencia instantánea por prefijo (como idealista /
   fotocasa / pisos.com), que Nominatim no resuelve bien.
   El buscador combina estos resultados (instantáneos) con los de
   Nominatim (long-tail + códigos postales).
   Cada entrada: [nombre, tipo, contexto, lat, lon, zoom]
   ============================================================ */
(function (global) {
  const C = "Comunidad", PR = "Provincia", MU = "Municipio",
        DI = "Distrito", BA = "Barrio";

  // [nombre, tipo, contexto, lat, lon, zoom]
  const DATA = [
    // ---- Comunidades autónomas ----
    ["Andalucía", C, "España", 37.5, -4.7, 8],
    ["Aragón", C, "España", 41.6, -0.9, 8],
    ["Principado de Asturias", C, "España", 43.3, -5.99, 9],
    ["Islas Baleares", C, "España", 39.6, 2.9, 9],
    ["Canarias", C, "España", 28.3, -16.5, 8],
    ["Cantabria", C, "España", 43.2, -3.9, 9],
    ["Castilla-La Mancha", C, "España", 39.5, -3.0, 8],
    ["Castilla y León", C, "España", 41.7, -4.7, 8],
    ["Cataluña", C, "España", 41.8, 1.5, 8],
    ["Comunidad Valenciana", C, "España", 39.5, -0.7, 8],
    ["Extremadura", C, "España", 39.2, -6.1, 8],
    ["Galicia", C, "España", 42.8, -8.0, 8],
    ["La Rioja", C, "España", 42.3, -2.5, 9],
    ["Comunidad de Madrid", C, "España", 40.4, -3.7, 9],
    ["Región de Murcia", C, "España", 38.0, -1.4, 9],
    ["Comunidad Foral de Navarra", C, "España", 42.7, -1.6, 9],
    ["País Vasco", C, "España", 43.0, -2.6, 9],

    // ---- Capitales de provincia / municipios principales ----
    ["A Coruña", MU, "Galicia", 43.36, -8.41, 12],
    ["Albacete", MU, "Castilla-La Mancha", 38.99, -1.86, 12],
    ["Alicante", MU, "Comunidad Valenciana", 38.35, -0.48, 12],
    ["Almería", MU, "Andalucía", 36.84, -2.46, 12],
    ["Ávila", MU, "Castilla y León", 40.66, -4.70, 12],
    ["Badajoz", MU, "Extremadura", 38.88, -6.97, 12],
    ["Barcelona", MU, "Cataluña", 41.39, 2.17, 12],
    ["Bilbao", MU, "Bizkaia · País Vasco", 43.26, -2.93, 12],
    ["Burgos", MU, "Castilla y León", 42.34, -3.70, 12],
    ["Cáceres", MU, "Extremadura", 39.48, -6.37, 12],
    ["Cádiz", MU, "Andalucía", 36.53, -6.29, 12],
    ["Castellón de la Plana", MU, "Comunidad Valenciana", 39.99, -0.04, 12],
    ["Ciudad Real", MU, "Castilla-La Mancha", 38.99, -3.93, 12],
    ["Córdoba", MU, "Andalucía", 37.89, -4.78, 12],
    ["Cuenca", MU, "Castilla-La Mancha", 40.07, -2.13, 12],
    ["Girona", MU, "Cataluña", 41.98, 2.82, 12],
    ["Granada", MU, "Andalucía", 37.18, -3.60, 12],
    ["Guadalajara", MU, "Castilla-La Mancha", 40.63, -3.16, 12],
    ["San Sebastián", MU, "Gipuzkoa · País Vasco", 43.32, -1.98, 12],
    ["Huelva", MU, "Andalucía", 37.26, -6.95, 12],
    ["Huesca", MU, "Aragón", 42.13, -0.41, 12],
    ["Jaén", MU, "Andalucía", 37.77, -3.79, 12],
    ["León", MU, "Castilla y León", 42.60, -5.57, 12],
    ["Lleida", MU, "Cataluña", 41.62, 0.62, 12],
    ["Logroño", MU, "La Rioja", 42.47, -2.45, 12],
    ["Lugo", MU, "Galicia", 43.01, -7.56, 12],
    ["Madrid", MU, "Comunidad de Madrid", 40.42, -3.70, 12],
    ["Málaga", MU, "Andalucía", 36.72, -4.42, 12],
    ["Murcia", MU, "Región de Murcia", 37.99, -1.13, 12],
    ["Ourense", MU, "Galicia", 42.34, -7.86, 12],
    ["Oviedo", MU, "Asturias", 43.36, -5.85, 12],
    ["Palencia", MU, "Castilla y León", 42.01, -4.53, 12],
    ["Las Palmas de Gran Canaria", MU, "Canarias", 28.12, -15.43, 12],
    ["Palma", MU, "Islas Baleares", 39.57, 2.65, 12],
    ["Pamplona", MU, "Navarra", 42.81, -1.64, 12],
    ["Pontevedra", MU, "Galicia", 42.43, -8.64, 12],
    ["Salamanca", MU, "Castilla y León", 40.97, -5.66, 12],
    ["Santander", MU, "Cantabria", 43.46, -3.81, 12],
    ["Santa Cruz de Tenerife", MU, "Canarias", 28.47, -16.25, 12],
    ["Segovia", MU, "Castilla y León", 40.95, -4.12, 12],
    ["Sevilla", MU, "Andalucía", 37.39, -5.99, 12],
    ["Soria", MU, "Castilla y León", 41.76, -2.46, 12],
    ["Tarragona", MU, "Cataluña", 41.12, 1.25, 12],
    ["Teruel", MU, "Aragón", 40.34, -1.11, 12],
    ["Toledo", MU, "Castilla-La Mancha", 39.86, -4.03, 12],
    ["Valencia", MU, "Comunidad Valenciana", 39.47, -0.38, 12],
    ["Valladolid", MU, "Castilla y León", 41.65, -4.72, 12],
    ["Vitoria-Gasteiz", MU, "Álava · País Vasco", 42.85, -2.67, 12],
    ["Zamora", MU, "Castilla y León", 41.50, -5.74, 12],
    ["Zaragoza", MU, "Aragón", 41.65, -0.89, 12],
    ["Ceuta", MU, "España", 35.89, -5.31, 13],
    ["Melilla", MU, "España", 35.29, -2.94, 13],

    // ---- Otros municipios grandes ----
    ["Vigo", MU, "Pontevedra · Galicia", 42.24, -8.72, 12],
    ["Gijón", MU, "Asturias", 43.53, -5.66, 12],
    ["L'Hospitalet de Llobregat", MU, "Barcelona · Cataluña", 41.36, 2.10, 13],
    ["Badalona", MU, "Barcelona · Cataluña", 41.45, 2.25, 13],
    ["Terrassa", MU, "Barcelona · Cataluña", 41.56, 2.01, 13],
    ["Sabadell", MU, "Barcelona · Cataluña", 41.55, 2.11, 13],
    ["Mataró", MU, "Barcelona · Cataluña", 41.54, 2.44, 13],
    ["Reus", MU, "Tarragona · Cataluña", 41.16, 1.11, 13],
    ["Sant Cugat del Vallès", MU, "Barcelona · Cataluña", 41.47, 2.08, 13],
    ["Santa Coloma de Gramenet", MU, "Barcelona · Cataluña", 41.45, 2.21, 13],
    ["Móstoles", MU, "Comunidad de Madrid", 40.32, -3.86, 13],
    ["Alcalá de Henares", MU, "Comunidad de Madrid", 40.48, -3.36, 13],
    ["Fuenlabrada", MU, "Comunidad de Madrid", 40.28, -3.79, 13],
    ["Leganés", MU, "Comunidad de Madrid", 40.33, -3.76, 13],
    ["Getafe", MU, "Comunidad de Madrid", 40.31, -3.73, 13],
    ["Alcorcón", MU, "Comunidad de Madrid", 40.35, -3.83, 13],
    ["Torrejón de Ardoz", MU, "Comunidad de Madrid", 40.46, -3.48, 13],
    ["Parla", MU, "Comunidad de Madrid", 40.24, -3.77, 13],
    ["Alcobendas", MU, "Comunidad de Madrid", 40.54, -3.64, 13],
    ["Las Rozas de Madrid", MU, "Comunidad de Madrid", 40.49, -3.87, 13],
    ["Pozuelo de Alarcón", MU, "Comunidad de Madrid", 40.43, -3.81, 13],
    ["Cartagena", MU, "Región de Murcia", 37.61, -0.99, 12],
    ["Elche", MU, "Alicante · Comunidad Valenciana", 38.27, -0.70, 12],
    ["Benidorm", MU, "Alicante · Comunidad Valenciana", 38.53, -0.13, 13],
    ["Torrevieja", MU, "Alicante · Comunidad Valenciana", 37.98, -0.68, 13],
    ["Jerez de la Frontera", MU, "Cádiz · Andalucía", 36.68, -6.14, 12],
    ["Marbella", MU, "Málaga · Andalucía", 36.51, -4.88, 13],
    ["Dos Hermanas", MU, "Sevilla · Andalucía", 37.28, -5.92, 13],

    // ---- Distritos de Madrid ----
    ["Centro", DI, "Madrid", 40.415, -3.703, 14],
    ["Arganzuela", DI, "Madrid", 40.40, -3.69, 14],
    ["Retiro", DI, "Madrid", 40.41, -3.68, 14],
    ["Salamanca", DI, "Madrid", 40.43, -3.68, 14],
    ["Chamartín", DI, "Madrid", 40.46, -3.68, 14],
    ["Tetuán", DI, "Madrid", 40.46, -3.70, 14],
    ["Chamberí", DI, "Madrid", 40.43, -3.70, 14],
    ["Fuencarral-El Pardo", DI, "Madrid", 40.48, -3.71, 13],
    ["Moncloa-Aravaca", DI, "Madrid", 40.43, -3.73, 13],
    ["Latina", DI, "Madrid", 40.40, -3.74, 14],
    ["Carabanchel", DI, "Madrid", 40.38, -3.74, 14],
    ["Usera", DI, "Madrid", 40.38, -3.71, 14],
    ["Puente de Vallecas", DI, "Madrid", 40.39, -3.66, 14],
    ["Ciudad Lineal", DI, "Madrid", 40.45, -3.65, 14],
    ["Hortaleza", DI, "Madrid", 40.47, -3.64, 13],
    ["Villaverde", DI, "Madrid", 40.34, -3.71, 14],
    ["San Blas-Canillejas", DI, "Madrid", 40.43, -3.61, 13],
    ["Barajas", DI, "Madrid", 40.47, -3.58, 13],

    // ---- Barrios populares de Madrid ----
    ["Malasaña", BA, "Centro · Madrid", 40.426, -3.704, 15],
    ["Chueca", BA, "Centro · Madrid", 40.422, -3.697, 15],
    ["Lavapiés", BA, "Centro · Madrid", 40.408, -3.700, 15],
    ["La Latina", BA, "Centro · Madrid", 40.411, -3.711, 15],
    ["Sol", BA, "Centro · Madrid", 40.417, -3.703, 15],
    ["Argüelles", BA, "Moncloa · Madrid", 40.430, -3.717, 15],
    ["Goya", BA, "Salamanca · Madrid", 40.425, -3.677, 15],
    ["Las Tablas", BA, "Fuencarral · Madrid", 40.500, -3.680, 15],

    // ---- Distritos y barrios de Barcelona ----
    ["Ciutat Vella", DI, "Barcelona", 41.38, 2.18, 14],
    ["Eixample", DI, "Barcelona", 41.39, 2.16, 14],
    ["Sants-Montjuïc", DI, "Barcelona", 41.37, 2.14, 14],
    ["Les Corts", DI, "Barcelona", 41.38, 2.13, 14],
    ["Sarrià-Sant Gervasi", DI, "Barcelona", 41.40, 2.13, 14],
    ["Gràcia", DI, "Barcelona", 41.40, 2.16, 14],
    ["Horta-Guinardó", DI, "Barcelona", 41.42, 2.16, 14],
    ["Nou Barris", DI, "Barcelona", 41.44, 2.18, 14],
    ["Sant Andreu", DI, "Barcelona", 41.43, 2.19, 14],
    ["Sant Martí", DI, "Barcelona", 41.41, 2.20, 14],
    ["La Barceloneta", BA, "Ciutat Vella · Barcelona", 41.38, 2.19, 15],
    ["El Poblenou", BA, "Sant Martí · Barcelona", 41.40, 2.20, 15],
    ["El Born", BA, "Ciutat Vella · Barcelona", 41.385, 2.182, 15],
    ["El Raval", BA, "Ciutat Vella · Barcelona", 41.38, 2.17, 15],
    ["Poble Sec", BA, "Sants-Montjuïc · Barcelona", 41.37, 2.16, 15],

    // ---- Barrios de Valencia / Sevilla ----
    ["Ruzafa", BA, "Valencia", 39.46, -0.37, 15],
    ["El Carmen", BA, "Ciutat Vella · Valencia", 39.48, -0.38, 15],
    ["Triana", BA, "Sevilla", 37.385, -6.01, 15],
    ["Nervión", BA, "Sevilla", 37.385, -5.97, 15]
  ];

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  // Pre-normaliza para acelerar.
  const INDEX = DATA.map(([n, t, p, lat, lon, z]) => ({
    label: n, type: t, context: p, lat, lon, zoom: z,
    _n: normalize(n)
  }));

  // Prioridad por tipo (lo más amplio primero al empatar).
  const RANK = { [C]: 0, [PR]: 1, [MU]: 2, [DI]: 3, [BA]: 4 };

  function search(query, limit) {
    const q = normalize(query);
    if (!q) return [];
    const starts = [];
    const contains = [];
    for (const e of INDEX) {
      const i = e._n.indexOf(q);
      if (i === 0) starts.push(e);
      else if (i > 0) contains.push(e);
    }
    const byRank = (a, b) =>
      (RANK[a.type] - RANK[b.type]) || a.label.localeCompare(b.label, "es");
    starts.sort(byRank);
    contains.sort(byRank);
    return starts.concat(contains).slice(0, limit || 6).map((e) => ({
      label: e.label, type: e.type, context: e.context,
      lat: e.lat, lon: e.lon, zoom: e.zoom
    }));
  }

  global.BH_GEO = { search, normalize };
})(window);
