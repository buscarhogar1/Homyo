// bh-auth.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Ajusta aquí si cambias de proyecto
const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function $(id){ return document.getElementById(id); }

export function initAuth() {
  const overlay = $("authOverlay");
  const navLogin = $("navLogin");
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

  const regHeader = $("regHeader");
  const regName = $("regName");
  const regPassword = $("regPassword");
  const regCreateBtn = $("regCreateBtn");
  const regFormFields = $("regFormFields");
  const regFooterActions = $("regFooterActions");

  const goRegisterBtn = $("goRegisterBtn");
  const backStartFromPwBtn = $("backStartFromPwBtn");
  const backStartFromRegBtn = $("backStartFromRegBtn");

  const googleBtn = $("googleBtn");

  let pendingEmail = "";

  function show(el){ el?.classList.remove("bh-hidden"); }
  function hide(el){ el?.classList.add("bh-hidden"); }

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

  function showRegisterForm(){
    show(regFormFields);
    show(regFooterActions);
  }

  function hideRegisterForm(){
    hide(regFormFields);
    hide(regFooterActions);
  }

  function goStart(){
    show(stepStart); hide(stepPw); hide(stepReg);
    showRegisterForm();
    setMsg(authMsgStart, "");
    setMsg(authMsgPw, "");
    setMsg(authMsgReg, "");
    pendingEmail = "";
    pwInput.value = "";
    regName.value = "";
    regPassword.value = "";
    emailInput.focus();
  }

  function goPassword(email){
    hide(stepStart); show(stepPw); hide(stepReg);
    showRegisterForm();
    setMsg(authMsgStart, "");
    setMsg(authMsgPw, "");
    setMsg(authMsgReg, "");
    pendingEmail = email;
    pwHeader.textContent = `Email: ${email}`;
    pwInput.value = "";
    pwInput.focus();
  }

  function goRegister(email){
    hide(stepStart); hide(stepPw); show(stepReg);
    showRegisterForm();
    setMsg(authMsgStart, "");
    setMsg(authMsgPw, "");
    setMsg(authMsgReg, "");
    pendingEmail = email;
    regHeader.textContent = `Crear cuenta con: ${email}`;
    regName.focus();
  }

  function showRegisterSuccess(message){
    hideRegisterForm();
    setMsg(authMsgReg, message);
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

  navLogin.addEventListener("click",(e)=>{ e.preventDefault(); openAuth(); });
  closeAuth.addEventListener("click", closeAuthModal);
  overlay.addEventListener("click",(e)=>{ if(e.target === overlay) closeAuthModal(); });
  document.addEventListener("keydown",(e)=>{ if(overlay.classList.contains("open") && e.key === "Escape") closeAuthModal(); });

  $("navFavoritos")?.addEventListener("click", (e) => {
    e.preventDefault();
    alert("MVP: Favoritos (requiere registro).");
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
    } catch(e){
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

  pwLoginBtn.addEventListener("click", async () => {
    const email = pendingEmail;
    const password = pwInput.value || "";
    if (!email) { goStart(); return; }
    if (!password) { setMsg(authMsgPw, "Escribe tu contraseña."); return; }

    try{
      setBusy(true);
      setMsg(authMsgPw, "");

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      setMsg(authMsgPw, "Sesión iniciada.");
      setTimeout(() => closeAuthModal(), 400);
    } catch(e){
      setMsg(authMsgPw, "No se pudo iniciar sesión. Revisa email y contraseña.");
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
        showRegisterSuccess("Cuenta creada. Te hemos enviado un correo para confirmar el email. Después podrás iniciar sesión.");
      } else {
        showRegisterSuccess("Cuenta creada y sesión iniciada.");
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
}
