function renderFooter() {
  const year = new Date().getFullYear();

  return `
    <footer class="footer">
      <div class="footerInner">
        <div class="footerLine1">
          Inventario limpio, sin duplicados, sin anuncios zombis.
        </div>

        <div class="footerLine2">
          <span>© ${year} Buscar Hogar</span>
          <span class="footerSep">·</span>
          <a href="./legal/terminos.html">Términos de uso</a>
          <span class="footerSep">·</span>
          <a href="./legal/privacidad.html">Política de privacidad</a>
          <span class="footerSep">·</span>
          <a href="./legal/cookies.html">Política de cookies</a>
        </div>
      </div>
    </footer>
  `;
}
