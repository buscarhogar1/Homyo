// Layout común: header + footer + modal auth
// Uso: initLayout({ showMiniSearch: true|false })

function getSiteRoot() {
  return "./";
}

function getBaseUrlFromRoot(root) {
  const base = new URL(root || "./", window.location.href);
  return base.href;
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
        <div class="leftGroup">
          <button type="button" class="menuBtn" id="navMenuBtn" aria-label="Más opciones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
              <path d="M4 7h16"></path>
              <path d="M4 12h16"></path>
              <path d="M4 17h16"></path>
            </svg>
          </button>
        </div>

        <div class="bhSideOverlay" id="bhSideOverlay"></div>

        <aside class="bhSideMenu" id="bhSideMenu" aria-hidden="true">
          <div class="bhSideMenuTop">
            <div class="bhSideMenuBrand">HOMYO</div>

            <button type="button" class="bhSideClose" id="bhSideClose" aria-label="Cerrar menú">
              ×
            </button>
          </div>

          <nav class="bhSideNav">
            <div class="bhSideSection">
              <div class="bhSideHeading" aria-hidden="true">Usuario</div>

              <a href="#" class="bhSideLink bhSideAnonOnly" data-bh-open-auth="login">
                Iniciar sesión
              </a>

              <a href="./account.html" class="bhSideLink bhSideAuthOnly">
                Cuenta
              </a>

              <a href="#" class="bhSideLink bhSideAnonOnly" data-bh-open-auth="register">
                Registrarse
              </a>

              <a href="./contacto.html?tipo=usuario" class="bhSideLink">
                Contacto
              </a>
            </div>

            <div class="bhSideSection">
              <div class="bhSideHeading" aria-hidden="true">Profesional inmobiliario</div>

              <a href="./cuenta-inmobiliaria.html" class="bhSideLink bhSideAnonOnly">
                Iniciar sesión
              </a>

              <a href="./cuenta-inmobiliaria.html" class="bhSideLink bhSideAuthOnly">
                Cuenta
              </a>

              <a href="./registro-inmobiliaria.html" class="bhSideLink bhSideAnonOnly">
                Registrarse
              </a>

              <a href="./contacto.html?tipo=inmobiliaria" class="bhSideLink">
                Contacto
              </a>
            </div>

            <div class="bhSideSection">
              <div class="bhSideHeading" aria-hidden="true">Información legal</div>

              <a href="./terminos.html" class="bhSideLink">
                Términos de uso
              </a>

              <a href="./privacidad.html" class="bhSideLink">
                Política de privacidad
              </a>

              <a href="./cookies.html" class="bhSideLink">
                Política de cookies
              </a>
            </div>
          </nav>

          <div class="bhSideFooter">
            © 2026 Homyo
          </div>
        </aside>

        <a class="brand" href="${root}" aria-label="Ir a inicio">
          <span class="brandText">HOMYO</span>
        </a>

        ${mini}

        <div class="rightGroup" aria-label="Acciones">
          <a href="#" id="navLogin" class="navActionLink">
            <span class="navActionIcon navActionIconSvg" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4.5 19.5c2.1-3.7 12.9-3.7 15 0"></path>
                <circle cx="18.1" cy="18.1" r="3.1"></circle>
                <path d="M16.9 16.9l2.4 2.4"></path>
              </svg>
            </span>
            <span class="navActionText">Cuenta</span>
          </a>

          <div id="navUserArea" class="navUserArea bh-hidden" aria-label="Usuario conectado">
            <button type="button" id="navAccountBtn" class="navUserBtn">
              <span id="navUserAvatar" class="navAvatar navAvatarSvg" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4"></circle>
                  <path d="M4.5 19.5c2.1-3.7 12.9-3.7 15 0"></path>
                </svg>
              </span>
              <span id="navUserLabel" class="navUserLabel">Cuenta</span>
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

  if (!headerMount) {
    throw new Error("Falta el contenedor bhHeader en la página.");
  }

  headerMount.innerHTML = renderHeader({ showMiniSearch, root });

  // El footer es opcional. En index.html se ha eliminado por decisión de diseño.
  if (footerMount) {
    footerMount.innerHTML = renderFooter({ root });
  }

  if (!document.getElementById("authOverlay")) {
    document.body.insertAdjacentHTML("beforeend", renderAuthModal({ root }));
  }

  const BASE_URL = getBaseUrlFromRoot(root);
  window.BH_SITE_ROOT = root;
  window.BH_BASE_URL = BASE_URL;
  window.BH_CALLBACK_URL = BASE_URL + "callback.html";


  const sideMenu = document.getElementById("bhSideMenu");
  const sideOverlay = document.getElementById("bhSideOverlay");
  const menuBtn = document.getElementById("navMenuBtn");
  const sideClose = document.getElementById("bhSideClose");

  function openSideMenu(){
    sideMenu?.classList.add("open");
    sideOverlay?.classList.add("open");
    document.body.classList.add("bhMenuOpen");
  }

  function closeSideMenu(){
    sideMenu?.classList.remove("open");
    sideOverlay?.classList.remove("open");
    document.body.classList.remove("bhMenuOpen");
  }

  menuBtn?.addEventListener("click", openSideMenu);
  sideClose?.addEventListener("click", closeSideMenu);
  sideOverlay?.addEventListener("click", closeSideMenu);

  // Auth-modal openers from inside the side menu (Iniciar sesión / Registrarse).
  sideMenu?.querySelectorAll("[data-bh-open-auth]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeSideMenu();
      const mode = el.getAttribute("data-bh-open-auth");
      const navLogin = document.getElementById("navLogin");
      navLogin?.click();
      if (mode === "register") {
        // Try to advance the auth modal into the register step if it exposes one.
        setTimeout(() => {
          const goRegister = document.getElementById("goRegisterBtn");
          goRegister?.click();
        }, 30);
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape"){
      closeSideMenu();
    }
  });

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


if (typeof window !== "undefined") window.initLayout = initLayout;
