/* HOMYO · Registro profesional real: crea la cuenta y la solicitud de alta en Supabase.
   Demo: con el email demo@homyo.es se simula el envío como antes. */
(function () {
  "use strict";
  var H = window.HOMYO;
  var DOC_LABEL = { cif: "Tarjeta de identificación fiscal (CIF)", merc: "Nota simple del Registro Mercantil", dni: "DNI / NIE del responsable", poderes: "Escritura de poderes o autorización" };
  function v(id) { var el = document.getElementById(id); return el ? String(el.value || "").trim() : ""; }
  function radio(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function ext(f) { var m = /\.([a-z0-9]+)$/i.exec(f.name || ""); return m ? m[1].toLowerCase() : "pdf"; }

  async function uploadDocs(c, agencyId) {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".uploadRow[data-upload]")).filter(function (r) { return r._file; });
    var done = 0;
    for (var i = 0; i < rows.length; i++) {
      var kind = rows[i].dataset.upload, f = rows[i]._file;
      var path = agencyId + "/" + kind + "-" + Date.now().toString(36) + "." + ext(f);
      var up = await c.storage.from("agency-docs").upload(path, f, { contentType: f.type || undefined, upsert: true });
      if (up.error) continue;
      var r = await c.rpc("agency_add_doc", { p_kind: kind, p_name: f.name, p_path: path });
      if (!r.error) done++;
    }
    return { uploaded: done, total: rows.length };
  }

  window.HOMYO_REG = {
    DOC_LABEL: DOC_LABEL,
    uploadDocs: uploadDocs,
    isDemo: function () { return v("fRespEmail").toLowerCase() === (H && H.DEMO_EMAIL); },
    submit: async function () {
      if (!H) throw new Error("No se ha podido conectar con Homyo.");
      var c = await H.client();
      var email = v("fRespEmail").toLowerCase(), pw = v("fPass"), cif = v("fCif").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (pw.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");
      var dup = await c.rpc("cif_in_use", { p_cif: cif });
      if (!dup.error && dup.data) throw new Error("Ya hay una inmobiliaria con ese CIF en Homyo. Si es la tuya, pide acceso a su administrador o escríbenos desde Contacto.");
      var app = {
        entity: radio("entity"), cif: cif, company_name: v("fCompanyName"), legal_form: v("fLegalForm"), incorporation_date: v("fIncDate") || null,
        address: v("fAddress"), postcode: v("fPostal"), city: v("fCity"), province: v("fProvince"),
        brand_name: v("fBrandName"), phone: v("fPhone"), website: v("fWeb"),
        responsible: { name: v("fRespName"), surname: v("fRespSurname"), dni: v("fRespDni").toUpperCase(), role: v("fRespRole"), phone: v("fRespPhone"), email: email },
        regional_register: { applies: radio("regAuto"), ccaa: v("fRegCcaa"), number: v("fRegNumber") },
        api_number: v("fApi"),
        accepts_comms: !!(document.getElementById("legalComms") || {}).checked,
        docs_selected: Array.prototype.slice.call(document.querySelectorAll(".uploadRow[data-upload]")).filter(function (r) { return r._file; }).map(function (r) { return r.dataset.upload; })
      };
      var r = await c.auth.signUp({
        email: email, password: pw,
        options: { emailRedirectTo: new URL("cuenta-inmobiliaria.html", location.href).href, data: { full_name: (app.responsible.name + " " + app.responsible.surname).trim(), agency_application: app } }
      });
      if (r.error) {
        var m = r.error.message || "";
        if (/already|registered/i.test(m)) throw new Error("Ya existe una cuenta con ese email. Inicia sesión desde el acceso profesional.");
        if (/CIF/i.test(m)) throw new Error("Ya hay una inmobiliaria con ese CIF en Homyo.");
        if (/database error/i.test(m)) throw new Error("No se ha podido crear la solicitud. Si se repite, avisa a soporte (puede faltar ejecutar 08-alta-inmobiliarias.sql).");
        if (/rate|seconds/i.test(m)) throw new Error("Demasiados intentos seguidos. Espera un minuto y vuelve a probar.");
        throw new Error(m);
      }
      var user = r.data && r.data.user;
      if (user && Array.isArray(user.identities) && !user.identities.length) throw new Error("Ya existe una cuenta con ese email. Inicia sesión desde el acceso profesional.");
      var out = { ref: "HMY-" + String(user ? user.id : "").slice(0, 8).toUpperCase(), needConfirm: !r.data.session, docs: { uploaded: 0, total: app.docs_selected.length } };
      if (r.data.session) {
        var pr = await c.from("profiles").select("agency_id").eq("id", user.id).maybeSingle();
        var ag = pr.data && pr.data.agency_id;
        if (ag) { out.ref = "HMY-" + String(ag).slice(0, 8).toUpperCase(); out.docs = await uploadDocs(c, ag); }
        H.enterReal("pro");
      }
      return out;
    }
  };
})();
