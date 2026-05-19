// Admin content: edit home hero strings in app_settings + upload hero image
(function () {
  function setMsg(t) {
    var el = document.getElementById("bb-content-msg");
    if (el) el.textContent = t || "";
  }

  async function readSettings(sb, keys) {
    var r = await sb.from("app_settings").select("key,value").in("key", keys);
    if (r.error) throw r.error;
    var map = {};
    (r.data || []).forEach(function (row) {
      map[row.key] = row.value || "";
    });
    return map;
  }

  async function upsertSetting(sb, key, value) {
    return await sb
      .from("app_settings")
      .upsert({ key: key, value: value || "", updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  async function load() {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();
    var keys = [
      "home_hero_badge_ar",
      "home_hero_badge_en",
      "home_hero_title_html_ar",
      "home_hero_title_html_en",
      "home_hero_subtitle_ar",
      "home_hero_subtitle_en",
      "home_hero_cta1_ar",
      "home_hero_cta1_en",
      "home_hero_cta2_ar",
      "home_hero_cta2_en",
      "home_hero_image_url",
      "contact_address_ar",
      "contact_address_en",
      "contact_phone",
      "contact_email",
      "help_title_ar",
      "help_title_en",
      "help_subtitle_ar",
      "help_subtitle_en",
      "help_whatsapp_url",
      "help_call_phone",
      "callmebot_enabled",
      "callmebot_phone",
      "callmebot_apikey",
      "callmebot_signal_enabled",
      "callmebot_signal_phone",
      "callmebot_signal_apikey",
    ];
    var map = await readSettings(sb, keys);
    (document.getElementById("bb-hero-badge-ar") || {}).value = map.home_hero_badge_ar || "";
    (document.getElementById("bb-hero-badge-en") || {}).value = map.home_hero_badge_en || "";
    (document.getElementById("bb-hero-title-ar") || {}).value = map.home_hero_title_html_ar || "";
    (document.getElementById("bb-hero-title-en") || {}).value = map.home_hero_title_html_en || "";
    (document.getElementById("bb-hero-sub-ar") || {}).value = map.home_hero_subtitle_ar || "";
    (document.getElementById("bb-hero-sub-en") || {}).value = map.home_hero_subtitle_en || "";
    (document.getElementById("bb-hero-cta1-ar") || {}).value = map.home_hero_cta1_ar || "";
    (document.getElementById("bb-hero-cta1-en") || {}).value = map.home_hero_cta1_en || "";
    (document.getElementById("bb-hero-cta2-ar") || {}).value = map.home_hero_cta2_ar || "";
    (document.getElementById("bb-hero-cta2-en") || {}).value = map.home_hero_cta2_en || "";
    (document.getElementById("bb-hero-img-url") || {}).value = map.home_hero_image_url || "";
    (document.getElementById("bb-contact-address-ar") || {}).value = map.contact_address_ar || "";
    (document.getElementById("bb-contact-address-en") || {}).value = map.contact_address_en || "";
    (document.getElementById("bb-contact-phone") || {}).value = map.contact_phone || "";
    (document.getElementById("bb-contact-email") || {}).value = map.contact_email || "";
    (document.getElementById("bb-help-title-ar") || {}).value = map.help_title_ar || "";
    (document.getElementById("bb-help-title-en") || {}).value = map.help_title_en || "";
    (document.getElementById("bb-help-sub-ar") || {}).value = map.help_subtitle_ar || "";
    (document.getElementById("bb-help-sub-en") || {}).value = map.help_subtitle_en || "";
    (document.getElementById("bb-help-whatsapp") || {}).value = map.help_whatsapp_url || "";
    (document.getElementById("bb-help-call") || {}).value = map.help_call_phone || "";
    var enabledEl = document.getElementById("bb-callmebot-enabled");
    if (enabledEl) {
      var en = map.callmebot_enabled || "0";
      enabledEl.checked = en === "1" || en === "true" || en === "yes" || en === "on";
    }
    (document.getElementById("bb-callmebot-phone") || {}).value = map.callmebot_phone || "";
    (document.getElementById("bb-callmebot-apikey") || {}).value = map.callmebot_apikey || "";
    var signalEnabledEl = document.getElementById("bb-callmebot-signal-enabled");
    if (signalEnabledEl) {
      var sen = map.callmebot_signal_enabled || "0";
      signalEnabledEl.checked = sen === "1" || sen === "true" || sen === "yes" || sen === "on";
    }
    (document.getElementById("bb-callmebot-signal-phone") || {}).value = map.callmebot_signal_phone || "";
    (document.getElementById("bb-callmebot-signal-apikey") || {}).value = map.callmebot_signal_apikey || "";
  }

  async function save() {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();

    var rows = [
      { key: "home_hero_badge_ar", el: "bb-hero-badge-ar" },
      { key: "home_hero_badge_en", el: "bb-hero-badge-en" },
      { key: "home_hero_title_html_ar", el: "bb-hero-title-ar" },
      { key: "home_hero_title_html_en", el: "bb-hero-title-en" },
      { key: "home_hero_subtitle_ar", el: "bb-hero-sub-ar" },
      { key: "home_hero_subtitle_en", el: "bb-hero-sub-en" },
      { key: "home_hero_cta1_ar", el: "bb-hero-cta1-ar" },
      { key: "home_hero_cta1_en", el: "bb-hero-cta1-en" },
      { key: "home_hero_cta2_ar", el: "bb-hero-cta2-ar" },
      { key: "home_hero_cta2_en", el: "bb-hero-cta2-en" },
      { key: "home_hero_image_url", el: "bb-hero-img-url" },
      { key: "contact_address_ar", el: "bb-contact-address-ar" },
      { key: "contact_address_en", el: "bb-contact-address-en" },
      { key: "contact_phone", el: "bb-contact-phone" },
      { key: "contact_email", el: "bb-contact-email" },
      { key: "help_title_ar", el: "bb-help-title-ar" },
      { key: "help_title_en", el: "bb-help-title-en" },
      { key: "help_subtitle_ar", el: "bb-help-sub-ar" },
      { key: "help_subtitle_en", el: "bb-help-sub-en" },
      { key: "help_whatsapp_url", el: "bb-help-whatsapp" },
      { key: "help_call_phone", el: "bb-help-call" },
    ];

    var enabledEl = document.getElementById("bb-callmebot-enabled");
    var signalEnabledEl = document.getElementById("bb-callmebot-signal-enabled");
    var callmebotRows = [
      { key: "callmebot_enabled", value: enabledEl && enabledEl.checked ? "1" : "0" },
      { key: "callmebot_phone", el: "bb-callmebot-phone" },
      { key: "callmebot_apikey", el: "bb-callmebot-apikey" },
      { key: "callmebot_signal_enabled", value: signalEnabledEl && signalEnabledEl.checked ? "1" : "0" },
      { key: "callmebot_signal_phone", el: "bb-callmebot-signal-phone" },
      { key: "callmebot_signal_apikey", el: "bb-callmebot-signal-apikey" },
    ];
    for (var c = 0; c < callmebotRows.length; c++) {
      var row = callmebotRows[c];
      var val = row.el
        ? (document.getElementById(row.el)?.value || "").trim()
        : row.value;
      var cu = await upsertSetting(sb, row.key, val);
      if (cu.error) throw cu.error;
    }

    for (var i = 0; i < rows.length; i++) {
      var val = (document.getElementById(rows[i].el)?.value || "").trim();
      var u = await upsertSetting(sb, rows[i].key, val);
      if (u.error) throw u.error;
    }
    setMsg("Saved.");
  }

  async function uploadHeroImage() {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();
    var file = document.getElementById("bb-hero-img-file")?.files?.[0];
    if (!file) {
      setMsg("Choose an image file first.");
      return;
    }
    var ext = (file.name.split(".").pop() || "png").toLowerCase();
    var path = "home/hero-" + Date.now() + "." + ext;
    var contentType = (file && file.type) ? file.type : "";
    if (!contentType) {
      if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
      else if (ext === "png") contentType = "image/png";
      else if (ext === "webp") contentType = "image/webp";
      else if (ext === "gif") contentType = "image/gif";
      else contentType = "application/octet-stream";
    }

    var up = await sb.storage.from("site-assets").upload(path, file, {
      upsert: false,
      contentType: contentType,
      cacheControl: "3600",
    });
    if (up.error) {
      // Show full storage error to the admin for quick diagnosis
      setMsg("Upload failed: " + (up.error.message || JSON.stringify(up.error)));
      throw up.error;
    }
    var pub = sb.storage.from("site-assets").getPublicUrl(path);
    var url = pub && pub.data ? pub.data.publicUrl : "";
    if (!url) throw new Error("Failed to get public URL.");
    var urlEl = document.getElementById("bb-hero-img-url");
    if (urlEl) urlEl.value = url;
    setMsg("Uploaded.");
  }

  async function testCallMeBot(channel) {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();
    var r = await sb.rpc("admin_test_order_notify", { p_channel: channel || "whatsapp" });
    if (r.error) throw r.error;
    setMsg(r.data || "Test sent.");
  }

  function bind() {
    var saveBtn = document.getElementById("bb-content-save");
    if (saveBtn) saveBtn.addEventListener("click", function () { save().catch(function (e) { setMsg(e.message || String(e)); }); });
    var reloadBtn = document.getElementById("bb-content-reload");
    if (reloadBtn) reloadBtn.addEventListener("click", function () { load().catch(function (e) { setMsg(e.message || String(e)); }); });
    var uploadBtn = document.getElementById("bb-hero-img-upload");
    if (uploadBtn) uploadBtn.addEventListener("click", function () { uploadHeroImage().catch(function (e) { setMsg(e.message || String(e)); }); });
    var testBtn = document.getElementById("bb-callmebot-test");
    if (testBtn) {
      testBtn.addEventListener("click", function () {
        save()
          .then(function () { return testCallMeBot("whatsapp"); })
          .catch(function (e) { setMsg(e.message || String(e)); });
      });
    }
    var signalTestBtn = document.getElementById("bb-callmebot-signal-test");
    if (signalTestBtn) {
      signalTestBtn.addEventListener("click", function () {
        save()
          .then(function () { return testCallMeBot("signal"); })
          .catch(function (e) { setMsg(e.message || String(e)); });
      });
    }

    var logout = document.getElementById("bb-logout");
    if (logout) {
      logout.addEventListener("click", function () {
        if (window.BB && window.BB.adminLogout) window.BB.adminLogout();
        location.href = "admin-login.html?return=admin-content.html";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.BB) return;
    bind();
    load().catch(function (e) {
      setMsg(e.message || String(e));
    });
  });
})();

