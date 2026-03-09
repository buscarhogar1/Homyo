// Layout común: header + footer + modal auth
// Uso: initLayout({ showMiniSearch: true|false })

function getSiteRoot() {
  return "./";
}

function getBaseUrlFromRoot(root) {
  return window.location.origin + root;
}

function renderHeader({ showMiniSearch, root }) {
  const mini = showMiniSearch ? `
    <form class="miniSearch" id="miniSearchForm" autocomplete="off" aria-label="Búsqueda rápida">
      <input id="miniQ" placeholder="Buscar..." aria-label="Buscar rápido" />
      <button type="submit" title="Buscar" aria-label="Buscar">
        <svg class="miniIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M21 21l-4.3-4.3"></path>
        </svg>
      </button>
    </form>
  ` : "";

  return `
    <header class="topbar">
      <div class="topbarInner">
        <a class="brand" href="${root}">
          <div class="logoMark" aria-label="Logo">
            <span>BH</span>
          </div>
        </a>

        ${mini}

        <div class="rightGroup" aria-label="Acciones">
          <a href="#" id="navFavoritos">Favoritos</a>

          <a href="#" id="navLogin">Iniciar sesión</a>

          <div id="navUserArea" class="navUserArea bh-hidden" aria-label="Usuario conectado">
            <button type="button" id="navAccountBtn" class="navUserBtn">
              <span id="navUserAvatar" class="navAvatar" aria-hidden="true">U</span>
              <span id="navUserLabel">Mi cuenta</span>
            </button>

            <button type="button" id="navLogoutBtn" class="navLogoutBtn">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderFooter({ root }) {
  const year = new Date().getFullYear();

  return `
    <footer class="footer">
      <div class="footerInner">
        <div class="footerLine2">
          <span>© ${year} Buscar Hogar</span>
          <span class="footerSep">·</span>
          <a href="${root}terminos.html">Términos de uso</a>
          <span class="footerSep">·</span>
          <a href="${root}privacidad.html">Política de privacidad</a>
          <span class="footerSep">·</span>
          <a href="${root}cookies.html">Política de cookies</a>
        </div>
      </div>
    </footer>
  `;
}

function renderAuthModal({ root }) {
  return `
    <div id="authOverlay" class="overlay" aria-hidden="true">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bhAuthTitle">
        <button class="close" id="closeAuth" aria-label="Cerrar">×</button>

        <div class="bh-brand">Buscar Hogar</div>
        <h2 id="bhAuthTitle" class="bh-title">Inicia sesión o regístrate</h2>
        <p class="bh-subtitle">Acceso solo para usuarios.</p>

        <div class="bh-actions">
          <div id="authStepStart">
            <button type="button" class="bh-btn gBtn" id="googleBtn">
              <svg class="gIcon" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.9l5.9-5.9C34.3 3.5 29.5 1.5 24 1.5 14.6 1.5 6.5 6.9 2.6 14.7l6.9 5.4C11.4 13.9 17.2 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h12.5c-.3 2-1.8 5.1-5.1 7.1l7.8 6C43.9 36.9 46.1 31.2 46.1 24.5z"/>
                <path fill="#4A90E2" d="M9.5 28.1c-0.5-1.5-0.8-3.1-0.8-4.8s.3-3.3.8-4.8l-6.9-5.4C1.6 16.2 1 19.1 1 22.1c0 3 0.6 5.9 1.6 8.5l6.9-5.4z"/>
                <path fill="#FBBC05" d="M24 46.5c5.5 0 10.3-1.8 13.8-4.9l-7.8-6c-2.1 1.4-4.9 2.4-8 2.4-6.8 0-12.6-4.4-14.7-10.6l-6.9 5.4C6.5 41.1 14.6 46.5 24 46.5z"/>
              </svg>
              Continuar con Google
            </button>

            <div class="bh-divider"><span>o</span></div>

            <input id="emailInput" class="bh-input" type="email" autocomplete="email" placeholder="Email" />
            <button type="button" class="bh-btn bh-primary" id="emailContinueBtn">Continuar con email</button>

            <div class="bh-msg bh-hidden" id="authMsgStart" role="status" aria-live="polite"></div>
          </div>

          <div id="authStepPassword" class="bh-hidden">
            <div class="bh-msg" id="pwHeader"></div>
            <input id="pwInput" class="bh-input" type="password" autocomplete="current-password" placeholder="Contraseña" />
            <button type="button" class="bh-btn bh-primary" id="pwLoginBtn">Entrar</button>

            <div class="bh-msg bh-hidden" id="authMsgPw" role="status" aria-live="polite"></div>

            <div class="bh-msg bh-hidden" id="forgotPwRow" style="margin-top:8px;">
              <button type="button" class="bh-linkbtn" id="forgotPwBtn">¿Olvidaste la contraseña?</button>
            </div>

            <div class="bh-msg bh-hidden" id="forgotPwMsg" role="status" aria-live="polite"></div>

            <div class="bh-msg" style="margin-top:12px;">
              <button type="button" class="bh-linkbtn" id="goRegisterBtn">No tengo cuenta, registrarme</button>
              <span> · </span>
              <button type="button" class="bh-linkbtn" id="backStartFromPwBtn">Volver</button>
            </div>
          </div>

          <div id="authStepRegister" class="bh-hidden">
            <div class="bh-msg" id="regHeader"></div>

            <div id="regFormWrap">
              <input id="regName" class="bh-input" type="text" autocomplete="name" placeholder="Nombre" />
              <input id="regPassword" class="bh-input" type="password" autocomplete="new-password" placeholder="Contraseña (mín. 8)" />
              <button type="button" class="bh-btn bh-primary" id="regCreateBtn">Crear cuenta</button>
            </div>

            <div class="bh-msg bh-hidden" id="authMsgReg" role="status" aria-live="polite"></div>

            <div class="bh-msg" id="regBackRow" style="margin-top:12px;">
              <button type="button" class="bh-linkbtn" id="backStartFromRegBtn">Volver</button>
            </div>

            <div class="bh-msg bh-hidden" id="regLoginRow" style="margin-top:12px;">
              <button type="button" class="bh-linkbtn" id="regGoLoginBtn">Iniciar sesión</button>
            </div>
          </div>

          <div class="bh-probox">
            <div class="bh-proline"></div>
            <div class="bh-protext">
              Profesional inmobiliario:
              <a href="#">accede aquí</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initLayout(opts = {}) {
  const { showMiniSearch = false } = opts;

  const root = getSiteRoot();
  const headerMount = document.getElementById("bhHeader");
  const footerMount = document.getElementById("bhFooter");

  if (!headerMount || !footerMount) {
    throw new Error("Faltan contenedores bhHeader o bhFooter en la página.");
  }

  headerMount.innerHTML = renderHeader({ showMiniSearch, root });
  footerMount.innerHTML = renderFooter({ root });

  if (!document.getElementById("authOverlay")) {
    document.body.insertAdjacentHTML("beforeend", renderAuthModal({ root }));
  }

  const BASE_URL = getBaseUrlFromRoot(root);
  window.BH_SITE_ROOT = root;
  window.BH_BASE_URL = BASE_URL;
  window.BH_CALLBACK_URL = BASE_URL + "callback.html";

  const miniSearchForm = document.getElementById("miniSearchForm");
  if (miniSearchForm) {
    miniSearchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const miniQ = document.getElementById("miniQ");
      const city = (miniQ?.value || "").trim();
      if (!city) return;

      if (typeof window.BH_goToMap === "function") {
        window.BH_goToMap(city);
        return;
      }

      const q = document.getElementById("q");
      if (q) q.value = city;
    });
  }
}
