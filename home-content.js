// Home page content from app_settings (badge/title/subtitle + hero image)
(function () {
  function waitForBB(maxMs) {
    var start = Date.now();
    return new Promise(function (resolve) {
      (function tick() {
        if (window.BB && typeof window.BB.getSupabase === "function") return resolve(true);
        if (Date.now() - start > (maxMs || 3000)) return resolve(false);
        setTimeout(tick, 60);
      })();
    });
  }

  async function load() {
    var ok = await waitForBB(4000);
    if (!ok) return;
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
    ];
    var r = await sb.from("app_settings").select("key,value").in("key", keys);
    if (r.error) return;
    var map = {};
    (r.data || []).forEach(function (row) {
      map[row.key] = row.value || "";
    });

    var badge = document.getElementById("bb-hero-badge");
    if (badge) {
      if (map.home_hero_badge_ar) badge.setAttribute("data-i18n-ar", map.home_hero_badge_ar);
      if (map.home_hero_badge_en) badge.setAttribute("data-i18n-en", map.home_hero_badge_en);
    }
    var title = document.getElementById("bb-hero-title");
    if (title) {
      if (map.home_hero_title_html_ar) title.setAttribute("data-i18n-html-ar", map.home_hero_title_html_ar);
      if (map.home_hero_title_html_en) title.setAttribute("data-i18n-html-en", map.home_hero_title_html_en);
    }
    var sub = document.getElementById("bb-hero-subtitle");
    if (sub) {
      if (map.home_hero_subtitle_ar) sub.setAttribute("data-i18n-ar", map.home_hero_subtitle_ar);
      if (map.home_hero_subtitle_en) sub.setAttribute("data-i18n-en", map.home_hero_subtitle_en);
    }
    var cta1 = document.getElementById("bb-hero-cta1");
    if (cta1) {
      if (map.home_hero_cta1_ar) cta1.setAttribute("data-i18n-ar", map.home_hero_cta1_ar);
      if (map.home_hero_cta1_en) cta1.setAttribute("data-i18n-en", map.home_hero_cta1_en);
    }
    var cta2 = document.getElementById("bb-hero-cta2");
    if (cta2) {
      if (map.home_hero_cta2_ar) cta2.setAttribute("data-i18n-ar", map.home_hero_cta2_ar);
      if (map.home_hero_cta2_en) cta2.setAttribute("data-i18n-en", map.home_hero_cta2_en);
    }

    var img = document.getElementById("bb-hero-img");
    if (img && map.home_hero_image_url) {
      img.src = map.home_hero_image_url;
    }

    var addr = document.getElementById("bb-contact-address");
    if (addr) {
      if (map.contact_address_ar) addr.setAttribute("data-i18n-ar", map.contact_address_ar);
      if (map.contact_address_en) addr.setAttribute("data-i18n-en", map.contact_address_en);
    }
    var phone = document.getElementById("bb-contact-phone");
    if (phone && map.contact_phone) {
      phone.textContent = map.contact_phone;
      phone.href = "tel:" + String(map.contact_phone).replace(/\s+/g, "");
    }
    var email = document.getElementById("bb-contact-email");
    if (email && map.contact_email) {
      email.textContent = map.contact_email;
      email.href = "mailto:" + String(map.contact_email).trim();
    }

    var helpTitle = document.getElementById("bb-help-title");
    if (helpTitle) {
      if (map.help_title_ar) helpTitle.setAttribute("data-i18n-ar", map.help_title_ar);
      if (map.help_title_en) helpTitle.setAttribute("data-i18n-en", map.help_title_en);
    }
    var helpSub = document.getElementById("bb-help-sub");
    if (helpSub) {
      if (map.help_subtitle_ar) helpSub.setAttribute("data-i18n-ar", map.help_subtitle_ar);
      if (map.help_subtitle_en) helpSub.setAttribute("data-i18n-en", map.help_subtitle_en);
    }
    var wa = document.getElementById("bb-help-cta");
    if (wa && map.help_whatsapp_url) {
      wa.href = map.help_whatsapp_url;
    }
    var call = document.getElementById("bb-help-call");
    if (call && map.help_call_phone) {
      var raw = String(map.help_call_phone).trim().replace(/\s+/g, "");
      call.href = raw ? ("tel:" + raw) : call.href;
    }

    if (window.BB && window.BB.applyLang) window.BB.applyLang();
  }

  document.addEventListener("DOMContentLoaded", function () {
    load().catch(function () {});
  });
})();

