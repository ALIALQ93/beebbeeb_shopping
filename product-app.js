// Product page: load product by ?id=... from Supabase and render.
(function () {
  var __usdRate = null;
  var __selectedColor = null;
  var __selectedAge = null;
  var __variantStock = {}; // color -> age -> stock

  function getParam(name) {
    try {
      return new URL(location.href).searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

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

  function updateCartCount() {
    var cart = getCart();
    var count = cart.reduce(function (sum, x) {
      return sum + (x.qty || 0);
    }, 0);
    var badge = document.querySelector(
      'span.absolute.top-1.right-1.bg-error, span.absolute.top-0.right-0.bg-error'
    );
    if (badge) badge.textContent = String(count);
  }

  function addToCart(p) {
    var colors = Array.isArray(p.colors) ? p.colors.filter(Boolean) : [];
    var ages = Array.isArray(p.age_ranges) ? p.age_ranges.filter(Boolean) : [];
    var needColor = colors.length > 0;
    var needAge = ages.length > 0;

    var chosenColor = needColor ? (__selectedColor || (colors.length === 1 ? colors[0] : null)) : null;
    var chosenAge = needAge ? (__selectedAge || (ages.length === 1 ? ages[0] : null)) : null;
    if (needAge && !chosenAge) {
      var am = document.getElementById("bb-age-msg");
      if (am) am.textContent = "اختر المقاس/العمر أولاً.";
      return false;
    }
    if (needColor && !chosenColor) {
      var cm = document.getElementById("bb-color-msg");
      if (cm) cm.textContent = "اختر اللون أولاً.";
      return false;
    }

    var cart = getCart();
    var existing = cart.find(function (x) {
      return (
        x.product_id === p.id &&
        (x.color || null) === (chosenColor || null) &&
        (x.age_range || null) === (chosenAge || null)
      );
    });
    var maxStock = Number(p.stock);
    if (needColor && needAge) {
      var a = (__variantStock[chosenColor] || {})[chosenAge];
      maxStock = Number(a);
    }
    if (existing) {
      if (Number.isFinite(maxStock) && maxStock >= 0 && existing.qty >= maxStock) return false;
      existing.qty += 1;
    }
    else
      cart.push({
        product_id: p.id,
        title: p.title,
        color: chosenColor,
        age_range: chosenAge,
        base_price_iqd: p.price_iqd,
        discount_percent: Number(p.discount_percent || 0),
        price_iqd: Number(p.final_price_iqd || p.price_iqd),
        image_url: p.image_url || "",
        stock: Number.isFinite(maxStock) ? maxStock : null,
        qty: 1,
      });
    setCart(cart);
    updateCartCount();
    return true;
  }

  function renderAgeOptions(ages) {
    var host = document.getElementById("bb-age-options");
    var msg = document.getElementById("bb-age-msg");
    var sel = document.getElementById("bb-age-selected");
    if (msg) msg.textContent = "";
    if (!host) return;
    var list = Array.isArray(ages) ? ages.filter(Boolean) : [];
    if (!list.length) {
      host.innerHTML = '<span class="text-xs text-on-surface-variant">—</span>';
      return;
    }
    if (list.length === 1) __selectedAge = list[0];
    host.innerHTML = list
      .map(function (a) {
        var active = __selectedAge === a;
        return (
          '<button type="button" data-bb-age="' +
          String(a).replace(/"/g, "&quot;") +
          '" class="px-4 py-2 rounded-full border-2 ' +
          (active
            ? "border-primary bg-primary text-white"
            : "border-outline-variant hover:border-primary-container text-on-surface-variant") +
          ' font-bold text-sm transition-all">' +
          String(a) +
          "</button>"
        );
      })
      .join("");
    if (sel) sel.textContent = __selectedAge ? ("المختار: " + __selectedAge) : "";
  }

  function renderColorOptions(colors) {
    var host = document.getElementById("bb-color-options");
    var msg = document.getElementById("bb-color-msg");
    var sel = document.getElementById("bb-color-selected");
    if (msg) msg.textContent = "";
    if (!host) return;
    var list = Array.isArray(colors) ? colors.filter(Boolean) : [];
    if (!list.length) {
      host.innerHTML = '<span class="text-xs text-on-surface-variant">—</span>';
      return;
    }
    if (list.length === 1) __selectedColor = list[0];
    host.innerHTML = list
      .map(function (c) {
        var st = null;
        if (__selectedAge) {
          st = Number((__variantStock[c] || {})[__selectedAge]);
        }
        var disabled = Number.isFinite(st) ? st <= 0 : false;
        var active = __selectedColor === c;
        return (
          '<button type="button" data-bb-color="' +
          String(c).replace(/"/g, "&quot;") +
          '" class="px-4 py-2 rounded-full border-2 ' +
          (active
            ? "border-primary bg-primary text-white"
            : "border-outline-variant hover:border-primary-container text-on-surface-variant") +
          " font-bold text-sm transition-all " +
          (disabled ? "opacity-50 cursor-not-allowed" : "") +
          '">' +
          String(c) +
          (Number.isFinite(st)
            ? ' <span class="text-xs opacity-80">(' + String(st) + ")</span>"
            : "") +
          "</button>"
        );
      })
      .join("");
    if (sel) sel.textContent = __selectedColor ? ("المختار: " + __selectedColor) : "";
  }

  async function boot() {
    updateCartCount();

    var id = getParam("id");
    if (!id) return;
    if (!window.BB || !window.BB.getSupabase) return;

    var sb;
    try {
      sb = await window.BB.getSupabase();
    } catch {
      return; // config modal shown by auth.js
    }

    var res = await sb
      .from("products")
      .select("id,title,title_en,description,price_iqd,discount_percent,stock,colors,age_ranges,image_url,active")
      .eq("id", id)
      .maybeSingle();

    if (res.error || !res.data) {
      console.warn(res.error || "Product not found");
      return;
    }

    var p = res.data;
    if (p.active === false) {
      console.warn("Product is inactive");
      return;
    }
    var dp = Number(p.discount_percent || 0);
    if (dp > 0) p.final_price_iqd = Math.max(0, Math.round(Number(p.price_iqd || 0) * (100 - dp) / 100));
    var titleEl = document.getElementById("bb-product-title");
    var titleEnEl = document.getElementById("bb-product-title-en");
    var priceEl = document.getElementById("bb-product-price");
    var descEl = document.getElementById("bb-product-desc");
    var imgEl = document.getElementById("bb-product-image");
    if (titleEl) titleEl.textContent = p.title || "";
    var bc = document.getElementById("bb-breadcrumb-title");
    if (bc) bc.textContent = p.title || "";
    if (titleEnEl) titleEnEl.textContent = p.title_en || "";
    if (priceEl) {
      var now = p.final_price_iqd != null ? p.final_price_iqd : p.price_iqd;
      var rate = await getUsdRate(sb);
      var usd = fmtUSDFromIQD(now, rate);
      priceEl.textContent = fmtIQD(now) + (usd ? " · " + usd + " USD" : "");
    }
    if (descEl) descEl.textContent = p.description || descEl.textContent || "";
    if (imgEl && p.image_url) imgEl.src = p.image_url;
    if (imgEl && !p.image_url) {
      imgEl.removeAttribute("src");
      imgEl.style.background = "#f3ecec";
    }

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
          logoutBtn.addEventListener("click", function () {
            if (window.BB && window.BB.customerLogout) window.BB.customerLogout();
            location.href = "home.html";
          });
        }
      }
    } catch (e0) {}

    // Load variant stock (if any colors+ages are defined)
    __selectedColor = null;
    __selectedAge = null;
    __variantStock = {};
    if (Array.isArray(p.colors) && p.colors.length && Array.isArray(p.age_ranges) && p.age_ranges.length) {
      var cs = await sb
        .from("product_variant_stock")
        .select("color,age_range,stock")
        .eq("product_id", p.id);
      if (!cs.error) {
        (cs.data || []).forEach(function (r) {
          __variantStock[r.color] = __variantStock[r.color] || {};
          __variantStock[r.color][r.age_range] = Number(r.stock || 0);
        });
      }
      renderAgeOptions(p.age_ranges);
      renderColorOptions(p.colors);
    } else {
      renderAgeOptions(p.age_ranges || []);
      renderColorOptions([]);
    }

    document.addEventListener("click", function (e) {
      var aBtn = e.target && e.target.closest ? e.target.closest("button[data-bb-age]") : null;
      if (aBtn) {
        var a = aBtn.getAttribute("data-bb-age") || "";
        if (!a) return;
        __selectedAge = a;
        // reset color selection if now invalid
        if (__selectedColor && Number((__variantStock[__selectedColor] || {})[__selectedAge]) <= 0) {
          __selectedColor = null;
        }
        renderAgeOptions(p.age_ranges);
        renderColorOptions(p.colors);
        return;
      }
      var btn = e.target && e.target.closest ? e.target.closest("button[data-bb-color]") : null;
      if (!btn) return;
      var c = btn.getAttribute("data-bb-color") || "";
      if (!c) return;
      if (!__selectedAge) return;
      var st = Number((__variantStock[c] || {})[__selectedAge]);
      if (Number.isFinite(st) && st <= 0) return;
      __selectedColor = c;
      renderColorOptions(p.colors);
    });

    var addBtn = document.getElementById("bb-product-add");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var ok = addToCart(p);
        if (ok) {
          // return customer to products section
          location.href = "home.html#bb-new-arrivals";
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (e) {
      console.warn(e);
    });
  });
})();

