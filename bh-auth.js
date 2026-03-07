import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function $(id){ return document.getElementById(id); }

function getUserDisplayName(user) {
  const fullName = String(user?.user_metadata?.full_name || "").trim();
  if (fullName) return fullName;

  const email = String(user?.email || "").trim();
  if (!email) return "Mi cuenta";

  return email.split("@")[0] || "Mi cuenta";
}

function getUserInitial(user) {
  const display = getUserDisplayName(user).trim();
  const initial = display.charAt(0).toUpperCase();
  return initial || "U";
}

function updateHeaderAuthState(session) {
  const navLogin = $("navLogin");
  const navUserArea = $("navUserArea");
  const navUserAvatar = $("navUserAvatar");
  const navUserLabel = $("navUserLabel");

  const user = session?.user || null;

  if (!navLogin || !navUserArea || !navUserAvatar || !navUserLabel) return;

  if (!user) {
    navLogin.classList.remove("bh-hidden");
    navUserArea.classList.add("bh-hidden");
    navUserAvatar.textContent = "U";
    navUserLabel.textContent = "Mi cuenta";
    document.body.classList.remove("bh-authenticated");
    window.BH_AUTH_SESSION = null;
    window.dispatchEvent(new CustomEvent("bh:auth-changed", { detail: { session: null } }));
    return;
  }

  navLogin.classList.add("bh-hidden");
  navUserArea.classList.remove("bh-hidden");
  navUserAvatar.textContent = getUserInitial(user);
  navUserLabel.textContent = getUserDisplayName(user);

  document.body.classList.add("bh-authenticated");
  window.BH_AUTH_SESSION = session;
  window.dispatchEvent(new CustomEvent("bh:auth-changed", { detail: { session } }));
}

export function initAuth() {
  const overlay = $("authOverlay");
  const navLogin = $("navLogin");
  const navAccountBtn = $("navAccountBtn");
  const navLogoutBtn = $("navLogoutBtn");
  const closeAuth = $("closeAuth");

  if (!overlay || !navLogin || !closeAuth) {
    throw new Error("Auth: faltan nodos del modal o el link navLogin.");
  }

  const stepStart = $("authStepStart");
  const stepPw = $("authStepPassword");
  const stepReg = $("authStepRegister");

  const emailInput = $("emailInput");
  const emailContinueBtn = $("emailContinueBtn");

  const authMsgStart = $("authMsgStart");
  const authMsgPw = $("authMsgPw");
  const authMsgReg = $("authMsgReg");

  const pwHeader = $("pwHeader");
  const pwInput = $("pwInput");
  const pwLoginBtn = $("pwLoginBtn");
  const forgotPwBtn = $("forgotPwBtn");
  const forgotPwRow = $("forgotPwRow");
  const forgotPwMsg = $("forgotPwMsg");

  const regHeader = $("regHeader");
  const regName = $("regName");
  const regPassword = $("regPassword");
  const regCreateBtn = $("regCreateBtn");
  const regFormWrap = $("regFormWrap");
  const regBackRow = $("regBackRow");
  const regLoginRow = $("regLoginRow");
  const regGoLoginBtn = $("regGoLoginBtn");

  const goRegisterBtn = $("goRegisterBtn");
  const backStartFromPwBtn = $("backStartFromPwBtn");
  const backStartFromRegBtn = $("backStartFromRegBtn");

  const googleBtn = $("googleBtn");

  let pendingEmail = "";

  function show(el){ if (el) el.classList.remove("bh-hidden"); }
  function hide(el){ if (el) el.classList.add("bh-hidden"); }

  function setMsg(el, text){
    if(!el) return;
    if(!text){
      el.textContent = "";
      el.classList.add("bh-hidden");
      return;
    }
    el.textContent = text;
    el.classList.remove("bh-hidden");
  }

  function setBusy(isBusy){
    [googleBtn, emailContinueBtn, pwLoginBtn, regCreateBtn].forEach((b) => {
      if (b) b.disabled = isBusy;
    });
  }

  function resetRegisterView(){
    show(regFormWrap);
    show(regBackRow);
    hide(regLoginRow);
  }

  function resetPasswordRecoveryView(){
    hide(forgotPwRow);
    setMsg(forgotPwMsg, "");
  }

  function showRegisterSuccess(){
    hide(regFormWrap);
    hide(regBackRow);
    show(regLoginRow);
  }

  function goStart(){
    show(stepStart); hide(stepPw); hide(stepReg);
    setMsg(authMsgStart, "");
    setMsg(authMsgPw, "");
    setMsg(authMsgReg, "");
    pendingEmail = "";
    pwInput.value = "";
    regName.value = "";
    regPassword.value = "";
    resetRegisterView();
    resetPasswordRecoveryView();
    emailInput.focus();
  }

  function goPassword(email){
    hide(stepStart); show(stepPw); hide(stepReg);
    setMsg(authMsgStart, "");
    setMsg(authMsgPw, "");
    setMsg(authMsgReg, "");
    resetRegisterView();
    resetPasswordRecoveryView();
    pendingEmail = email;
    pwHeader.textContent = `Email: ${email}`;
    pwInput.value = "";
    pwInput.focus();
  }

  function goRegister(email){
    hide(stepStart); hide(stepPw); show(stepReg);
    setMsg(authMsgStart, "");
    setMsg(authMsgPw, "");
    setMsg(authMsgReg, "");
    resetRegisterView();
    resetPasswordRecoveryView();
    pendingEmail = email;
    regHeader.textContent = `Crear cuenta con: ${email}`;
    regName.focus();
  }

  function openAuth(){
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
    goStart();
  }

  function closeAuthModal(){
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
    navLogin.focus();
  }

  navLogin.addEventListener("click",(e)=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    openAuth();
  });

  closeAuth.addEventListener("click", closeAuthModal);
  overlay.addEventListener("click",(e)=>{ if(e.target === overlay) closeAuthModal(); });
  document.addEventListener("keydown",(e)=>{ if(overlay.classList.contains("open") && e.key === "Escape") closeAuthModal(); });

  $("navFavoritos")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    alert("MVP: Favoritos (requiere registro).");
  });

  navAccountBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    alert("MVP: Mi cuenta.");
  });

  navLogoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      updateHeaderAuthState(null);
    } catch (err) {
      console.error(err);
      alert("No se pudo cerrar la sesión.");
    }
  });

  async function oauth(provider){
    try{
      setBusy(true);
      setMsg(authMsgStart, "");
      localStorage.setItem("bh_return_url", window.location.href);

      const redirectTo = window.BH_CALLBACK_URL || (window.location.origin + "/auth/callback.html");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo }
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch(e){
      setMsg(authMsgStart, "No se pudo iniciar sesión. Revisa que Google esté activado en Supabase y que exista auth/callback.html.");
      console.error(e);
      setBusy(false);
    }
  }

  googleBtn.addEventListener("click", ()=> oauth("google"));

  async function checkEmailExists(email){
    try{
      const { data, error } = await supabase.functions.invoke("check-email", {
        body: { email }
      });

      if (error) throw error;
      if (!data || typeof data.exists !== "boolean") throw new Error("Bad response");
      return { ok:true, exists: data.exists };
    } catch(_e){
      return { ok:false, exists:false };
    }
  }

  emailContinueBtn.addEventListener("click", async () => {
    const email = (emailInput.value || "").trim().toLowerCase();
    if (!email) { setMsg(authMsgStart, "Escribe un email."); return; }

    setBusy(true);
    setMsg(authMsgStart, "");

    const r = await checkEmailExists(email);

    if (r.ok){
      setBusy(false);
      if (r.exists) goPassword(email);
      else goRegister(email);
      return;
    }

    setBusy(false);
    goPassword(email);
    setMsg(authMsgPw, "Si no tienes cuenta, pulsa “No tengo cuenta, registrarme”. Para detección automática, hay que crear la Edge Function check-email.");
  });

  goRegisterBtn.addEventListener("click", () => {
    const email = pendingEmail || (emailInput.value || "").trim().toLowerCase();
    if (!email) { goStart(); return; }
    goRegister(email);
  });

  backStartFromPwBtn.addEventListener("click", goStart);
  backStartFromRegBtn.addEventListener("click", goStart);
  regGoLoginBtn.addEventListener("click", () => {
    if (!pendingEmail) {
      goStart();
      return;
    }
    goPassword(pendingEmail);
  });

  forgotPwBtn?.addEventListener("click", async () => {
    const email = pendingEmail || (emailInput.value || "").trim().toLowerCase();
    if (!email) {
      setMsg(forgotPwMsg, "Primero escribe tu email.");
      return;
    }

    try {
      setBusy(true);
      setMsg(forgotPwMsg, "");

      const redirectTo = (window.BH_BASE_URL || window.location.origin + "/") + "auth/reset-password.html";

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) throw error;

      setMsg(forgotPwMsg, "Te hemos enviado un correo para cambiar la contraseña.");
    } catch (e) {
      setMsg(forgotPwMsg, "No se pudo enviar el correo de recuperación. Inténtalo de nuevo.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  });

  pwLoginBtn.addEventListener("click", async () => {
    const email = pendingEmail;
    const password = pwInput.value || "";
    if (!email) { goStart(); return; }
    if (!password) { setMsg(authMsgPw, "Escribe tu contraseña."); return; }

    try{
      setBusy(true);
      setMsg(authMsgPw, "");

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      updateHeaderAuthState(data?.session || null);
      setMsg(authMsgPw, "Sesión iniciada.");
      setTimeout(() => closeAuthModal(), 400);
    } catch(e){
      setMsg(authMsgPw, "No se pudo iniciar sesión. Revisa email y contraseña.");
      show(forgotPwRow);
      console.error(e);
    } finally {
      setBusy(false);
    }
  });

  regCreateBtn.addEventListener("click", async () => {
    const email = pendingEmail;
    const name = (regName.value || "").trim();
    const password = regPassword.value || "";

    if (!email) { goStart(); return; }
    if (!name) { setMsg(authMsgReg, "Escribe tu nombre."); return; }
    if (password.length < 8) { setMsg(authMsgReg, "La contraseña debe tener al menos 8 caracteres."); return; }

    try{
      setBusy(true);
      setMsg(authMsgReg, "");

      const redirectTo = window.BH_CALLBACK_URL || (window.location.origin + "/auth/callback.html");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: name }
        }
      });

      if (error){
        const msg = String(error.message || "");
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")){
          setBusy(false);
          goPassword(email);
          setMsg(authMsgPw, "Ese email ya está registrado. Entra con tu contraseña.");
          return;
        }
        throw error;
      }

      const needsConfirm = !data?.session;

      if (needsConfirm){
        showRegisterSuccess();
        regHeader.textContent = "Cuenta creada";
        setMsg(authMsgReg, "Te hemos enviado un correo para confirmar el email. Después podrás iniciar sesión.");
      } else {
        updateHeaderAuthState(data.session);
        setMsg(authMsgReg, "Cuenta creada y sesión iniciada.");
        setTimeout(() => closeAuthModal(), 500);
      }

    } catch(e){
      setMsg(authMsgReg, "No se pudo crear la cuenta. Revisa el email o prueba otra contraseña.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  });

  emailInput.addEventListener("keydown",(e)=>{ if(e.key==="Enter") emailContinueBtn.click(); });
  pwInput.addEventListener("keydown",(e)=>{ if(e.key==="Enter") pwLoginBtn.click(); });
  regPassword.addEventListener("keydown",(e)=>{ if(e.key==="Enter") regCreateBtn.click(); });

  supabase.auth.getSession().then(({ data }) => {
    updateHeaderAuthState(data?.session || null);
  }).catch((err) => {
    console.error(err);
    updateHeaderAuthState(null);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    updateHeaderAuthState(session || null);
  });
}
