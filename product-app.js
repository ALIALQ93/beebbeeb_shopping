// Product page: load product by ?id=... from Supabase and render.
(function () {
  var __usdRate = null;
  var __selectedColor = null;
  var __colorStock = {}; // color -> stock

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
    // If product has colors, require selection when multiple
    var needed = colors.length > 0;
    var chosen = needed ? (__selectedColor || (colors.length === 1 ? colors[0] : null)) : null;
    if (needed && !chosen) {
      var m = document.getElementById("bb-color-msg");
      if (m) m.textContent = "اختر اللون أولاً.";
      return;
    }

    var cart = getCart();
    var existing = cart.find(function (x) {
      return x.product_id === p.id && (x.color || null) === (chosen || null);
    });
    var maxStock = needed ? Number(__colorStock[chosen]) : Number(p.stock);
    if (existing) {
      if (Number.isFinite(maxStock) && maxStock >= 0 && existing.qty >= maxStock) return;
      existing.qty += 1;
    }
    else
      cart.push({
        product_id: p.id,
        title: p.title,
        color: chosen,
        base_price_iqd: p.price_iqd,
        discount_percent: Number(p.discount_percent || 0),
        price_iqd: Number(p.final_price_iqd || p.price_iqd),
        image_url: p.image_url || "",
        stock: Number.isFinite(maxStock) ? maxStock : null,
        qty: 1,
      });
    setCart(cart);
    updateCartCount();
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
        var st = Number(__colorStock[c]);
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
          (Number.isFinite(st) ? ' <span class="text-xs opacity-80">(' + String(st) + ")</span>" : "") +
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
      .select("id,title,title_en,description,price_iqd,discount_percent,stock,colors,image_url,active")
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
    if (titleEnEl) titleEnEl.textContent = p.title_en || "";
    if (priceEl) {
      var now = p.final_price_iqd != null ? p.final_price_iqd : p.price_iqd;
      var rate = await getUsdRate(sb);
      var usd = fmtUSDFromIQD(now, rate);
      priceEl.textContent = fmtIQD(now) + (usd ? " · " + usd + " USD" : "");
    }
    if (descEl) descEl.textContent = p.description || descEl.textContent || "";
    if (imgEl && p.image_url) imgEl.src = p.image_url;

    // Load per-color stock (if any colors are defined)
    __selectedColor = null;
    __colorStock = {};
    if (Array.isArray(p.colors) && p.colors.length) {
      var cs = await sb
        .from("product_color_stock")
        .select("color,stock")
        .eq("product_id", p.id);
      if (!cs.error) {
        (cs.data || []).forEach(function (r) {
          __colorStock[r.color] = Number(r.stock || 0);
        });
      }
      renderColorOptions(p.colors);
    } else {
      renderColorOptions([]);
    }

    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button[data-bb-color]") : null;
      if (!btn) return;
      var c = btn.getAttribute("data-bb-color") || "";
      if (!c) return;
      var st = Number(__colorStock[c]);
      if (Number.isFinite(st) && st <= 0) return;
      __selectedColor = c;
      renderColorOptions(p.colors);
    });

    var addBtn = document.getElementById("bb-product-add");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        addToCart(p);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (e) {
      console.warn(e);
    });
  });
})();

