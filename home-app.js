// Home page: fetch active products from Supabase and render into "New Arrivals".
(function () {
  var __usdRate = null;
  var AGE_CHOICES = ["0-3M","3-6M","6-12M","12-18M","18-24M","2-3Y","3-4Y","4-5Y","5-6Y","6-7Y","7-8Y","8-12Y"];

  function fmtIQD(n) {
    try {
      return new Intl.NumberFormat("en-US").format(Number(n || 0)) + " IQD";
    } catch {
      return String(n || 0) + " IQD";
    }
  }

  function fmtUSDFromIQD(iqd, rate) {
    var r = Number(rate || 0);
    if (!Number.isFinite(r) || r <= 0) return "";
    var usd = Number(iqd || 0) / r;
    if (!Number.isFinite(usd)) return "";
    return "$" + usd.toFixed(2);
  }

  async function getUsdRate(sb) {
    if (__usdRate != null) return __usdRate;
    try {
      var cached = localStorage.getItem("bb_usd_rate");
      if (cached) __usdRate = Number(cached);
    } catch (e) {}
    try {
      var res = await sb
        .from("app_settings")
        .select("value")
        .eq("key", "usd_iqd_rate")
        .maybeSingle();
      if (!res.error && res.data && res.data.value) {
        __usdRate = Number(res.data.value);
        try {
          localStorage.setItem("bb_usd_rate", String(__usdRate));
        } catch (e2) {}
      }
    } catch (e3) {}
    return __usdRate;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c] || c
      );
    });
  }

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem("bb_cart") || "[]");
    } catch {
      return [];
    }
  }

  function setCart(items) {
    try {
      localStorage.setItem("bb_cart", JSON.stringify(items || []));
    } catch {}
  }

  function addToCart(product) {
    var colors = Array.isArray(product.colors) ? product.colors.filter(Boolean) : [];
    var ages = Array.isArray(product.age_ranges) ? product.age_ranges.filter(Boolean) : [];
    // If product has multiple variants, force user to pick on product page
    if (colors.length > 1 || ages.length > 1) {
      location.href = "product.html?id=" + encodeURIComponent(product.id);
      return;
    }
    var chosenColor = colors.length === 1 ? colors[0] : null;
    var chosenAge = ages.length === 1 ? ages[0] : null;

    var cart = getCart();
    var existing = cart.find(function (x) {
      return (
        x.product_id === product.id &&
        (x.color || null) === (chosenColor || null) &&
        (x.age_range || null) === (chosenAge || null)
      );
    });
    var maxStock = Number(product.stock);
    if (existing) {
      if (Number.isFinite(maxStock) && maxStock >= 0 && existing.qty >= maxStock) return;
      existing.qty += 1;
    }
    else
      cart.push({
        product_id: product.id,
        title: product.title,
        color: chosenColor,
        age_range: chosenAge,
        base_price_iqd: product.price_iqd,
        discount_percent: Number(product.discount_percent || 0),
        price_iqd: Number(product.final_price_iqd || product.price_iqd),
        image_url: product.image_url || "",
        stock: Number.isFinite(maxStock) ? maxStock : null,
        qty: 1,
      });
    setCart(cart);
    updateCartCount();
  }

  function updateCartCount() {
    var cart = getCart();
    var count = cart.reduce(function (sum, x) {
      return sum + (x.qty || 0);
    }, 0);

    // First match: header cart badge in this template
    var badge = document.querySelector(
      'span.absolute.top-1.right-1.bg-error, span.absolute.top-0.right-0.bg-error'
    );
    if (badge) badge.textContent = String(count);
  }

  function cardSmall(p) {
    var img = p.image_url
      ? '<img alt="' +
        escapeHtml(p.title || "Product") +
        '" class="w-full h-full object-cover transition-transform group-hover:scale-105" src="' +
        escapeHtml(p.image_url) +
        '"/>' 
      : '<div class="w-full h-full bg-surface-container flex items-center justify-center text-outline text-sm">No image</div>';

    var href = "product.html?id=" + encodeURIComponent(p.id);
    var priceNow = p.final_price_iqd != null ? p.final_price_iqd : p.price_iqd;
    var priceHtml =
      Number(p.discount_percent || 0) > 0
        ? '<span style="text-decoration:line-through;opacity:.55;font-size:12px;margin-inline-start:6px">' +
          escapeHtml(fmtIQD(p.price_iqd)) +
          "</span>" +
          '<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-error-container/30 text-error">-' +
          escapeHtml(String(p.discount_percent)) +
          "%</span>"
        : "";

    var usd = fmtUSDFromIQD(priceNow, p.__usdRate);
    var titleEn = (p.title_en || "").trim();
    var lang = (window.BB && window.BB.getLang) ? window.BB.getLang() : "ar";
    var addTxt = lang === "en" ? "Add to cart" : "إضافة للسلة";
    return (
      '<div class="bg-white rounded-[2rem] p-3 border border-teal-50 puffy-shadow group">' +
      '<a href="' +
      escapeHtml(href) +
      '" class="block">' +
      '<div class="aspect-square rounded-[1.5rem] overflow-hidden mb-3">' +
      img +
      "</div>" +
      '<h4 class="font-body-base font-semibold text-on-surface">' +
      escapeHtml(p.title || "منتج") +
      "</h4>" +
      (titleEn
        ? '<div class="text-xs text-on-surface-variant" dir="ltr">' +
          escapeHtml(titleEn) +
          "</div>"
        : "") +
      "</a>" +
      '<p class="font-price-tag text-primary text-sm mt-1">' +
      escapeHtml(fmtIQD(priceNow)) +
      priceHtml +
      "</p>" +
      (usd
        ? '<p class="text-xs text-on-surface-variant" dir="ltr">' +
          escapeHtml(usd) +
          " USD</p>"
        : "") +
      '<button data-bb-add-to-cart="' +
      escapeHtml(p.id) +
      '" class="w-full mt-3 py-2 bg-secondary-container text-on-secondary-container rounded-xl text-xs font-bold hover:bg-secondary transition-colors">' +
      escapeHtml(addTxt) +
      "</button>" +
      "</div>"
    );
  }

  function cardFeature(p) {
    var img = p.image_url
      ? '<img alt="' +
        escapeHtml(p.title || "Product") +
        '" class="w-full h-full object-cover" src="' +
        escapeHtml(p.image_url) +
        '"/>' 
      : '<div class="w-full h-full bg-surface-container flex items-center justify-center text-outline text-sm">No image</div>';

    var href = "product.html?id=" + encodeURIComponent(p.id);
    var priceNow = p.final_price_iqd != null ? p.final_price_iqd : p.price_iqd;
    var priceHtml =
      Number(p.discount_percent || 0) > 0
        ? '<span style="text-decoration:line-through;opacity:.55;font-size:12px;margin-inline-start:8px">' +
          escapeHtml(fmtIQD(p.price_iqd)) +
          "</span>" +
          '<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-error-container/30 text-error">-' +
          escapeHtml(String(p.discount_percent)) +
          "%</span>"
        : "";

    var usd = fmtUSDFromIQD(priceNow, p.__usdRate);
    var titleEn = (p.title_en || "").trim();
    var lang = (window.BB && window.BB.getLang) ? window.BB.getLang() : "ar";
    var addTxt = lang === "en" ? "Add to cart" : "إضافة للسلة";
    return (
      '<div class="md:col-span-2 md:row-span-2 bg-white rounded-[2rem] p-4 border border-teal-50 puffy-shadow flex flex-col">' +
      '<a href="' +
      escapeHtml(href) +
      '" class="relative flex-1 rounded-[1.5rem] overflow-hidden mb-4 block">' +
      img +
      "</a>" +
      '<div class="px-2 pb-2">' +
      '<a href="' +
      escapeHtml(href) +
      '" class="block">' +
      '<h3 class="font-headline-md text-headline-md text-on-surface mb-1">' +
      escapeHtml(p.title || "منتج") +
      "</h3>" +
      (titleEn
        ? '<div class="text-xs text-on-surface-variant mb-2" dir="ltr">' +
          escapeHtml(titleEn) +
          "</div>"
        : "") +
      "</a>" +
      '<div class="flex items-center gap-2 mb-4">' +
      '<span class="font-price-tag text-price-tag text-primary">' +
      escapeHtml(fmtIQD(priceNow)) +
      "</span>" +
      priceHtml +
      "</div>" +
      (usd
        ? '<div class="text-xs text-on-surface-variant mb-2" dir="ltr">' +
          escapeHtml(usd) +
          " USD</div>"
        : "") +
      '<button data-bb-add-to-cart="' +
      escapeHtml(p.id) +
      '" class="w-full mt-3 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-colors">' +
      escapeHtml(addTxt) +
      "</button>" +
      "</div>" +
      "</div>"
    );
  }

  async function boot() {
    updateCartCount();

    var grid = document.getElementById("bb-new-arrivals");
    if (!grid) return;

    if (!window.BB || !window.BB.getSupabase) return;

    var sb;
    try {
      sb = await window.BB.getSupabase();
    } catch {
      return; // config modal shown by auth.js
    }

    var res = await sb
      .from("products")
      .select("id,title,title_en,price_iqd,discount_percent,stock,colors,age_ranges,image_url,active,created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(9);
    if (res.error) {
      // Fallback if created_at isn't available/selectable
      res = await sb
        .from("products")
        .select("id,title,title_en,price_iqd,discount_percent,stock,colors,age_ranges,image_url,active")
        .eq("active", true)
        .order("id", { ascending: false })
        .limit(9);
    }

    if (res.error) {
      grid.innerHTML =
        '<div class="bg-white rounded-[2rem] p-6 border border-teal-50 puffy-shadow text-center text-error">' +
        escapeHtml(res.error.message) +
        "</div>";
      return;
    }

    var products = res.data || [];
    var rate = await getUsdRate(sb);

    // Customer session pill
    try {
      if (window.BB && window.BB.getCustomer) {
        var me = await window.BB.getCustomer();
        var pill = document.getElementById("bb-customer-pill");
        var logoutBtn = document.getElementById("bb-customer-logout");
        if (me && me.full_name) {
          if (pill) {
            pill.textContent = me.full_name;
            pill.href = "my-orders.html";
            pill.classList.remove("hidden");
          }
          if (logoutBtn) logoutBtn.classList.remove("hidden");
        } else {
          if (pill) pill.classList.remove("hidden");
        }
        if (logoutBtn) {
          try {
            if (window.BB && window.BB.applyLang) window.BB.applyLang();
          } catch (e00) {}
          logoutBtn.addEventListener("click", function () {
            if (window.BB && window.BB.customerLogout) window.BB.customerLogout();
            location.reload();
          });
        }
      }
    } catch (e0) {}

    // Age filter (exact options like product card)
    var ageFilter = "";
    try {
      ageFilter = (new URL(location.href).searchParams.get("age") || "").trim();
    } catch (e1) {}

    // Render age filter buttons
    try {
      var host = document.getElementById("bb-age-filter");
      var clear = document.getElementById("bb-age-clear");
      if (host) {
        var lang = (window.BB && window.BB.getLang) ? window.BB.getLang() : "ar";
        var allTxt = lang === "en" ? "All" : "الكل";
        host.innerHTML =
          '<a href="home.html#bb-new-arrivals" class="px-4 py-2 rounded-full border-2 ' +
          (!ageFilter ? "border-primary bg-primary text-white" : "border-outline-variant hover:border-primary-container text-on-surface-variant") +
          ' font-bold text-sm transition-all">' + allTxt + "</a>" +
          AGE_CHOICES.map(function (a) {
            var active = ageFilter === a;
            return (
              '<a href="home.html?age=' +
              encodeURIComponent(a) +
              '#bb-new-arrivals" class="px-4 py-2 rounded-full border-2 ' +
              (active
                ? "border-primary bg-primary text-white"
                : "border-outline-variant hover:border-primary-container text-on-surface-variant") +
              ' font-bold text-sm transition-all" dir="ltr">' +
              a +
              "</a>"
            );
          }).join("");
      }
      if (clear) {
        if (ageFilter) clear.classList.remove("hidden");
        else clear.classList.add("hidden");
      }
    } catch (e2) {}

    function matchesAge(p) {
      if (!ageFilter) return true;
      var ages = Array.isArray(p.age_ranges) ? p.age_ranges : [];
      if (!ages.length) return true;
      return ages.indexOf(ageFilter) !== -1;
    }
    products = products.filter(matchesAge);
    if (products.length === 0) {
      grid.innerHTML =
        '<div class="bg-white rounded-[2rem] p-6 border border-teal-50 puffy-shadow text-center text-on-surface-variant">لا توجد منتجات بعد. أضف منتجات من صفحة Admin.</div>';
      return;
    }

    var html = "";
    products.forEach(function (p, idx) {
      var dp = Number(p.discount_percent || 0);
      if (dp > 0) p.final_price_iqd = Math.max(0, Math.round(Number(p.price_iqd || 0) * (100 - dp) / 100));
      p.__usdRate = rate;
      html += idx === 0 ? cardFeature(p) : cardSmall(p);
    });
    grid.innerHTML = html;

    grid.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;
      var id = btn.getAttribute("data-bb-add-to-cart");
      if (!id) return;
      var p = products.find(function (x) {
        return x.id === id;
      });
      if (!p) return;
      addToCart(p);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (e) {
      console.warn(e);
    });
  });
})();

