// Supabase + Auth glue for static pages (no secrets).
// Stores Supabase URL + anon key in localStorage (device-local).
(function () {
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "class") n.className = attrs[k];
        else if (k === "html") n.innerHTML = attrs[k];
        else n.setAttribute(k, attrs[k]);
      }
    }
    return n;
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (e) {
      return "";
    }
  }
  function storageSet(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
  }

  // -------- Language (AR/EN) --------
  function getLang() {
    var v = storageGet("bb_lang").toLowerCase();
    return v === "en" ? "en" : "ar";
  }
  function setLang(lang) {
    var v = String(lang || "").toLowerCase() === "en" ? "en" : "ar";
    storageSet("bb_lang", v);
  }

  function applyLang() {
    var lang = getLang();
    var root = document.documentElement;
    if (root) {
      root.lang = lang;
      root.dir = lang === "en" ? "ltr" : "rtl";
    }

    // Swap text content for elements that declare both languages.
    var nodes = Array.from(document.querySelectorAll("[data-i18n-ar][data-i18n-en]"));
    nodes.forEach(function (n) {
      var t = lang === "en" ? n.getAttribute("data-i18n-en") : n.getAttribute("data-i18n-ar");
      if (t != null) n.textContent = t;
    });

    // Swap innerHTML for rich text (admin-controlled).
    var htmlNodes = Array.from(document.querySelectorAll("[data-i18n-html-ar][data-i18n-html-en]"));
    htmlNodes.forEach(function (n) {
      var t =
        lang === "en"
          ? n.getAttribute("data-i18n-html-en")
          : n.getAttribute("data-i18n-html-ar");
      if (t != null) n.innerHTML = t;
    });
    // Swap placeholders when present.
    var ph = Array.from(document.querySelectorAll("[data-i18n-placeholder-ar][data-i18n-placeholder-en]"));
    ph.forEach(function (n) {
      var t =
        lang === "en"
          ? n.getAttribute("data-i18n-placeholder-en")
          : n.getAttribute("data-i18n-placeholder-ar");
      if (t != null) n.setAttribute("placeholder", t);
    });
  }

  function wireLangSelect() {
    var sel = document.querySelector("[data-bb-lang-select]");
    if (!sel) return;
    try {
      sel.value = getLang();
    } catch (e) {}
    sel.addEventListener("change", function () {
      setLang(sel.value);
      applyLang();
      // Reload to allow page-specific scripts to re-render if needed.
      location.reload();
    });
  }

  function getConfig() {
    // Prefer baked-in config (option 1) so customers never see a prompt.
    var bakedUrl =
      typeof window.BB_SUPABASE_URL === "string" ? window.BB_SUPABASE_URL : "";
    var bakedAnon =
      typeof window.BB_SUPABASE_ANON_KEY === "string"
        ? window.BB_SUPABASE_ANON_KEY
        : "";

    return {
      url: bakedUrl.trim() || storageGet("BB_SUPABASE_URL"),
      anon: bakedAnon.trim() || storageGet("BB_SUPABASE_ANON_KEY"),
    };
  }

  function showConfigModal() {
    var overlay = el("div", { class: "bb-overlay" });
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;";
    var card = el("div");
    card.style.cssText =
      "max-width:560px;width:100%;background:#fff;border-radius:16px;padding:16px 16px 12px;";

    card.appendChild(el("h3", { html: "إعداد Supabase" }));
    card.appendChild(
      el("p", {
        html: 'الصق <b>Project URL</b> و <b>anon public key</b> من Supabase → Settings → API. <span style="color:#ba1a1a;font-weight:700">(لا تضع أي secret key)</span>',
      })
    );

    var url = el("input");
    url.placeholder = "Project URL";
    url.style.cssText =
      "width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:10px;margin:10px 0;";

    var anon = el("textarea");
    anon.placeholder = "anon public key (JWT يبدأ غالبًا بـ eyJ...)";
    anon.rows = 4;
    anon.style.cssText =
      "width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:10px;";

    var row = el("div");
    row.style.cssText = "display:flex;gap:10px;margin-top:12px;";

    var save = el("button", { html: "حفظ" });
    save.style.cssText =
      "flex:1;background:#146a5c;color:#fff;border:0;border-radius:10px;padding:10px 12px;font-weight:800;cursor:pointer;";

    var cancel = el("button", { html: "لاحقًا" });
    cancel.style.cssText =
      "flex:1;background:#eee;color:#111;border:0;border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer;";

    row.appendChild(save);
    row.appendChild(cancel);

    card.appendChild(url);
    card.appendChild(anon);
    card.appendChild(row);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    cancel.onclick = function () {
      overlay.remove();
    };
    save.onclick = function () {
      if (!url.value.trim() || !anon.value.trim()) return;
      storageSet("BB_SUPABASE_URL", url.value.trim());
      storageSet("BB_SUPABASE_ANON_KEY", anon.value.trim());
      overlay.remove();
      location.reload();
    };
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function getSupabase() {
    var cfg = getConfig();
    if (!cfg.url || !cfg.anon) {
      showConfigModal();
      throw new Error("Missing Supabase config");
    }
    if (!window.supabase || !window.supabase.createClient) {
      await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    }
    window.__bb_supabase =
      window.__bb_supabase || window.supabase.createClient(cfg.url, cfg.anon);
    return window.__bb_supabase;
  }

  function pageName() {
    return (location.pathname.split(/\\\\|\//).pop() || "").toLowerCase();
  }

  async function requireLogin(returnTo) {
    // Customer login WITHOUT Supabase Auth:
    // We store a customer session token in localStorage and validate it via RPC.
    try {
      var tok = storageGet("bb_customer_token");
      if (!tok) throw new Error("missing token");
      var sb = await getSupabase();
      var me = await sb.rpc("customer_me", { p_token: tok });
      if (me.error || !me.data || !me.data.length) throw new Error("invalid token");
      return true;
    } catch (e) {
      location.href =
        "login.html?return=" +
        encodeURIComponent(returnTo || pageName() || "home.html");
      return false;
    }
  }

  async function getCustomer() {
    // Returns {customer_id, full_name, phone} or null
    try {
      if (window.__bb_customer && window.__bb_customer.customer_id) return window.__bb_customer;
      var tok = storageGet("bb_customer_token");
      if (!tok) return null;
      var sb = await getSupabase();
      var me = await sb.rpc("customer_me", { p_token: tok });
      var row = me && me.data && me.data.length ? me.data[0] : null;
      window.__bb_customer = row || null;
      return row || null;
    } catch (e) {
      return null;
    }
  }

  function customerLogout() {
    try {
      localStorage.removeItem("bb_customer_token");
    } catch (e) {}
    window.__bb_customer = null;
  }

  async function requireAdmin(returnTo) {
    var sb = await getSupabase();
    var u = await sb.auth.getUser();
    if (!u.data || !u.data.user) {
      var dest = returnTo || pageName() || "admin.html";
      location.href =
        "admin-login.html?return=" + encodeURIComponent(dest);
      return false;
    }
    var prof = await sb
      .from("profiles")
      .select("is_admin")
      .eq("id", u.data.user.id)
      .maybeSingle();
    if (prof.error) console.warn(prof.error);
    if (!prof.data || prof.data.is_admin !== true) {
      alert("ليس لديك صلاحية Admin");
      location.href = "home.html";
      return false;
    }
    return true;
  }

  function getReturnParam() {
    try {
      return new URL(location.href).searchParams.get("return") || "";
    } catch (e) {
      return "";
    }
  }

  function defaultAfterLogin() {
    // If we are on the admin login page, default back to admin dashboard.
    var p = pageName();
    if (p === "admin-login.html") return "admin.html";
    return "home.html";
  }

  async function wireLogin() {
    var p = pageName();
    var fullName = document.getElementById("full_name");
    var phone = document.getElementById("phone");
    var email = document.getElementById("email");
    var password = document.getElementById("password");
    var msg =
      document.getElementById("loginMsg") ||
      document.getElementById("signupMsg") ||
      document.getElementById("forgotMsg");
    function setMsg(t) {
      if (msg) msg.textContent = t || "";
    }

    function normPhone(v) {
      // Accept Iraqi numbers; user can type 07xxxxxxxxx.
      var x = String(v || "").trim().replace(/\s+/g, "");
      if (!x) return "";
      if (x.startsWith("+")) return x;
      if (x.startsWith("00")) return "+" + x.slice(2);
      if (x.startsWith("0")) return "+964" + x.slice(1);
      if (x.startsWith("964")) return "+" + x;
      return x;
    }

    function isValidPhone(v) {
      // Minimal check for Iraqi mobile: +9647XXXXXXXXX (9 digits after 7)
      var x = normPhone(v);
      return /^\+9647\d{9}$/.test(x);
    }

    function phoneToEmail(v) {
      var x = normPhone(v);
      // Unique, email-shaped identifier; customer never sees it.
      // Must be a valid email domain (include a dot).
      return x.replace(/^\+/, "") + "@phone.beebbeeb.local";
    }

    // Customer login via phone + password (NO Supabase Auth).
    if (p === "login.html") {
      var form = document.getElementById("loginForm");
      if (!form) return;
      var sbc = await getSupabase();

      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        setMsg("");
        var phoneRaw = ((phone && phone.value) || "").trim();
        var pw = ((password && password.value) || "").trim();
        if (!isValidPhone(phoneRaw)) {
          setMsg("رقم الهاتف غير صحيح. مثال: 07XXXXXXXXX");
          return;
        }
        if (!pw || pw.length < 6) {
          setMsg("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
          return;
        }
        var res = await sbc.rpc("customer_login", {
          p_phone: phoneRaw,
          p_password: pw,
        });
        if (res.error) {
          setMsg("فشل الدخول: " + res.error.message);
          return;
        }
        try {
          storageSet("bb_customer_token", String(res.data || ""));
        } catch (e0) {}
        var r = getReturnParam();
        location.href = r ? r : "home.html";
      });

      var goSignup = document.getElementById("goSignup");
      if (goSignup) {
        goSignup.addEventListener("click", function () {
          var r = getReturnParam();
          location.href = "signup.html" + (r ? "?return=" + encodeURIComponent(r) : "");
        });
      }
      var goForgot = document.getElementById("goForgot");
      if (goForgot) {
        goForgot.addEventListener("click", function () {
          location.href = "forgot-password.html";
        });
      }

      return;
    }

    // Customer signup page (phone + password, plus name)
    if (p === "signup.html") {
      var form2 = document.getElementById("signupForm");
      if (!form2) return;
      var sbc2 = await getSupabase();
      form2.addEventListener("submit", async function (e) {
        e.preventDefault();
        setMsg("");
        var nameVal = ((fullName && fullName.value) || "").trim();
        var phoneRaw = ((phone && phone.value) || "").trim();
        var pw = ((password && password.value) || "").trim();
        if (!nameVal) {
          setMsg("اكتب الاسم");
          return;
        }
        if (!isValidPhone(phoneRaw)) {
          setMsg("رقم الهاتف غير صحيح. مثال: 07XXXXXXXXX");
          return;
        }
        if (!pw || pw.length < 6) {
          setMsg("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
          return;
        }
        var res2 = await sbc2.rpc("customer_signup", {
          p_full_name: nameVal,
          p_phone: phoneRaw,
          p_password: pw,
        });
        if (res2.error) {
          var m2 = String(res2.error.message || "");
          setMsg("فشل إنشاء الحساب: " + m2);
          return;
        }
        // Auto-login after signup
        try {
          storageSet("bb_customer_token", String(res2.data || ""));
        } catch (e1) {}
        var r2 = getReturnParam();
        location.href = r2 ? r2 : "home.html";
      });

      var goLogin = document.getElementById("goLogin");
      if (goLogin) {
        goLogin.addEventListener("click", function () {
          var r = getReturnParam();
          location.href = "login.html" + (r ? "?return=" + encodeURIComponent(r) : "");
        });
      }
      return;
    }

    // Customer forgot password request page
    if (p === "forgot-password.html") {
      var form3 = document.getElementById("forgotForm");
      if (!form3) return;
      var sbc3 = await getSupabase();
      form3.addEventListener("submit", async function (e) {
        e.preventDefault();
        setMsg("");
        var nameVal = ((fullName && fullName.value) || "").trim();
        var phoneRaw = ((phone && phone.value) || "").trim();
        if (!nameVal) {
          setMsg("اكتب الاسم");
          return;
        }
        if (!isValidPhone(phoneRaw)) {
          setMsg("رقم الهاتف غير صحيح. مثال: 07XXXXXXXXX");
          return;
        }
        var ins = await sbc3.from("password_reset_requests").insert({
          full_name: nameVal,
          phone: normPhone(phoneRaw),
          note: "Customer requested password reset (manual via WhatsApp).",
        });
        if (ins.error) {
          setMsg("تعذر إرسال الطلب: " + ins.error.message);
          return;
        }
        setMsg("تم إرسال طلب للإدارة. سيتم التواصل معك على واتساب.");
      });

      var goLogin2 = document.getElementById("goLogin");
      if (goLogin2) goLogin2.addEventListener("click", function () { location.href = "login.html"; });
      return;
    }

    // Admin login (Supabase email/password).
    var formA = document.getElementById("loginForm");
    if (!formA) return;
    var sb = await getSupabase();

    async function upsertProfile(user) {
      if (!user) return;
      var nameVal = ((fullName && fullName.value) || "").trim();
      var phoneVal = ((phone && phone.value) || "").trim();
      // Only write if user provided something.
      if (!nameVal && !phoneVal) return;
      var payload = { id: user.id };
      if (nameVal) payload.full_name = nameVal;
      if (phoneVal) payload.phone = phoneVal;
      var res = await sb.from("profiles").upsert(payload, { onConflict: "id" });
      if (res.error) console.warn("profiles upsert failed", res.error);
    }

    formA.addEventListener("submit", async function (e) {
      e.preventDefault();
      setMsg("");
      var em = ((email && email.value) || "").trim();
      var pw = ((password && password.value) || "").trim();
      if (!em || !pw) {
        setMsg("اكتب الإيميل وكلمة المرور");
        return;
      }
      var res = await sb.auth.signInWithPassword({ email: em, password: pw });
      if (res.error) {
        setMsg(res.error.message);
        return;
      }
      // Save optional profile fields for customer account.
      try {
        var u = await sb.auth.getUser();
        await upsertProfile(u.data && u.data.user);
      } catch (e2) {}
      var r = getReturnParam();
      location.href = r ? r : defaultAfterLogin();
    });

    var signupBtn = document.getElementById("signupBtn");
    if (signupBtn) {
      signupBtn.addEventListener("click", async function () {
        setMsg("");
        var em = ((email && email.value) || "").trim();
        var pw = ((password && password.value) || "").trim();
        if (!em || !pw) {
          setMsg("اكتب الإيميل وكلمة المرور");
          return;
        }
        var res = await sb.auth.signUp({
          email: em,
          password: pw,
          options: {
            data: {
              full_name: ((fullName && fullName.value) || "").trim() || null,
              phone: ((phone && phone.value) || "").trim() || null,
            },
          },
        });
        if (res.error) {
          setMsg(res.error.message);
          return;
        }
        // If email confirmation is disabled, we might have an active session.
        if (res.data && res.data.user) {
          try {
            await upsertProfile(res.data.user);
          } catch (e3) {}
        }
        setMsg(
          "تم إنشاء الحساب. إذا كان مطلوب تأكيد إيميل، راجع بريدك ثم سجّل دخول."
        );
      });
    }
  }

  async function wireLogoutButtons() {
    var btn = document.querySelector("[data-bb-logout]");
    if (!btn) return;
    var sb = await getSupabase();
    btn.addEventListener("click", async function () {
      // Logout for both admin auth + customer token
      try {
        await sb.auth.signOut();
      } catch (e) {}
      customerLogout();
      location.href = "home.html";
    });
  }

  async function adminLogout() {
    try {
      var sb = await getSupabase();
      try {
        await sb.auth.signOut();
      } catch (e) {}
    } catch (e) {}
    customerLogout();
  }

  async function wireGuards() {
    var p = pageName();
    if (p === "checkout.html") await requireLogin("checkout.html");
    if (p === "my-orders.html") await requireLogin("my-orders.html");
    if (p === "admin.html") await requireAdmin("admin.html");
    if (p === "inventory.html") await requireAdmin("inventory.html");
    if (p === "admin-orders.html") await requireAdmin("admin-orders.html");
    if (p === "admin-support.html") await requireAdmin("admin-support.html");
  }

  async function wireAddToCartGuard() {
    document.addEventListener(
      "click",
      async function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var btn = t.closest("button");
        if (!btn) return;
        var txt = (btn.innerText || "").replace(/\s+/g, " ").trim();
        if (
          txt.indexOf("إضافة للسلة") === -1 &&
          txt.indexOf("إضافة إلى السلة") === -1
        )
          return;
        var ok = await requireLogin("home.html");
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );
  }

  window.BB = window.BB || {};
  window.BB.getSupabase = getSupabase;
  window.BB.requireAdmin = requireAdmin;
  window.BB.requireLogin = requireLogin;
  window.BB.getCustomer = getCustomer;
  window.BB.customerLogout = customerLogout;
  window.BB.getLang = getLang;
  window.BB.setLang = setLang;
  window.BB.applyLang = applyLang;
  window.BB.adminLogout = adminLogout;
  // Backward-compat alias used by some admin pages
  window.BB.logout = adminLogout;

  document.addEventListener("DOMContentLoaded", function () {
    applyLang();
    wireLangSelect();
    wireLogin().catch(function () {});
    wireLogoutButtons().catch(function () {});
    wireGuards().catch(function () {});
    wireAddToCartGuard().catch(function () {});
  });
})();
