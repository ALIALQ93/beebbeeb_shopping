// Checkout page: render cart from localStorage and compute totals (IQD).
(function () {
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

  function fmtIQD(n) {
    try {
      return new Intl.NumberFormat("en-US").format(Number(n || 0)) + " IQD";
    } catch {
      return String(n || 0) + " IQD";
    }
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

  function cartCount(cart) {
    return cart.reduce(function (sum, x) {
      return sum + (x.qty || 0);
    }, 0);
  }

  function subtotalIQD(cart) {
    return cart.reduce(function (sum, x) {
      return sum + (Number(x.price_iqd || 0) * Number(x.qty || 0));
    }, 0);
  }

  var __shipRates = null; // {city: fee_iqd}

  async function loadShippingRates() {
    if (__shipRates) return __shipRates;
    try {
      if (!window.BB || !window.BB.getSupabase) return (__shipRates = {});
      var sb = await window.BB.getSupabase();
      var r = await sb.from("shipping_rates").select("city,fee_iqd").limit(2000);
      if (r.error) return (__shipRates = {});
      var map = {};
      (r.data || []).forEach(function (row) {
        map[String(row.city || "").trim()] = Number(row.fee_iqd || 0);
      });
      __shipRates = map;
      return map;
    } catch (e) {
      __shipRates = {};
      return __shipRates;
    }
  }

  function getShippingFee(city) {
    var c = String(city || "").trim();
    if (!c) return 0;
    if (__shipRates && Object.prototype.hasOwnProperty.call(__shipRates, c)) {
      var v = Number(__shipRates[c]);
      return isFinite(v) && v >= 0 ? v : 0;
    }
    // fallback default if not configured
    return 5000;
  }

  function updateHeaderBadge(count) {
    var badge = document.querySelector(
      'span.absolute.top-1.right-1.bg-error, span.absolute.top-0.right-0.bg-error'
    );
    if (badge) badge.textContent = String(count);
  }

  function findCartTitleEl() {
    // the template has: محتويات السلة (3)
    var h2s = Array.from(document.querySelectorAll("h2"));
    return h2s.find(function (h) {
      return (h.textContent || "").indexOf("محتويات السلة") !== -1;
    });
  }

  function findCartContainer() {
    var byId = document.getElementById("bb-cart-items");
    if (byId) return byId;
    // In template: <div class="divide-y divide-teal-50"> ... items ...
    var h2 = findCartTitleEl();
    if (!h2) return null;
    var section = h2.closest("section");
    if (!section) return null;
    return section.querySelector(".divide-y");
  }

  function setSummary(subtotal, shipping, total) {
    var subEl = document.getElementById("bb-summary-subtotal");
    if (subEl) subEl.textContent = fmtIQD(subtotal);
    var shipEl = document.getElementById("bb-summary-shipping");
    if (shipEl) shipEl.textContent = fmtIQD(shipping);
    var totalEl = document.getElementById("bb-summary-total");
    if (totalEl) totalEl.textContent = fmtIQD(total);

    var usdEl = document.getElementById("bb-summary-usd");
    if (usdEl) {
      var rate = Number(localStorage.getItem("bb_usd_rate") || "0");
      if (rate > 0) {
        usdEl.textContent = "~$" + (total / rate).toFixed(2);
      } else {
        usdEl.textContent = "";
      }
    }
  }

  function itemRow(item) {
    var img =
      item.image_url && String(item.image_url).trim()
        ? '<img class="w-full h-full object-cover" alt="' +
          escapeHtml(item.title || "Product") +
          '" src="' +
          escapeHtml(item.image_url) +
          '"/>'
        : '<div class="w-full h-full flex items-center justify-center text-outline text-xs">No image</div>';

    var key = item.product_id + "||" + (item.color || "") + "||" + (item.age_range || "");
    return (
      '<div class="py-6 flex flex-col md:flex-row gap-6" data-bb-item="' +
      escapeHtml(key) +
      '">' +
      '<div class="w-24 h-24 rounded-2xl overflow-hidden bg-surface-variant flex-shrink-0">' +
      img +
      "</div>" +
      '<div class="flex-grow space-y-1">' +
      '<div class="flex justify-between">' +
      '<h3 class="text-body-base font-bold text-on-surface">' +
      escapeHtml(item.title || "منتج") +
      "</h3>" +
      '<button class="text-outline hover:text-error transition-colors" data-bb-del="' +
      escapeHtml(key) +
      '"><span class="material-symbols-outlined">delete</span></button>' +
      "</div>" +
      '<div class="text-sm text-outline">' +
      (item.age_range ? "المقاس/العمر: " + escapeHtml(item.age_range) : "") +
      (item.color ? (item.age_range ? " · " : "") + "اللون: " + escapeHtml(item.color) : "") +
      "</div>" +
      '<div class="flex justify-between items-end mt-4">' +
      '<div class="flex items-center border border-outline-variant/30 rounded-xl px-2 py-1 bg-surface-container-low">' +
      '<button class="w-8 h-8 flex items-center justify-center text-primary font-bold" data-bb-dec="' +
      escapeHtml(key) +
      '">-</button>' +
      '<span class="px-4 font-bold">' +
      String(item.qty || 1) +
      "</span>" +
      '<button class="w-8 h-8 flex items-center justify-center text-primary font-bold" data-bb-inc="' +
      escapeHtml(key) +
      '">+</button>' +
      "</div>" +
      '<div class="text-left">' +
      '<span class="text-price-tag font-price-tag text-primary">' +
      escapeHtml(fmtIQD(Number(item.price_iqd || 0) * Number(item.qty || 0))) +
      "</span>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function render() {
    var cart = getCart();
    updateHeaderBadge(cartCount(cart));

    var titleEl = findCartTitleEl();
    if (titleEl) titleEl.textContent = "محتويات السلة (" + cartCount(cart) + ")";

    var container = findCartContainer();
    if (container) {
      if (cart.length === 0) {
        container.innerHTML =
          '<div class="py-8 text-center text-on-surface-variant">سلتك فارغة. ارجع للرئيسية وأضف منتجات.</div>';
      } else {
        container.innerHTML = cart.map(itemRow).join("");
      }
    }

    var sub = subtotalIQD(cart);
    var city = (document.getElementById("bb-shipping-city")?.value || "").trim();
    var shipping = cart.length ? getShippingFee(city) : 0;
    var total = sub + shipping;
    setSummary(sub, shipping, total);
  }

  async function placeOrder() {
    var msg = document.getElementById("bb-checkout-msg");
    function setMsg(t) {
      if (msg) msg.textContent = t || "";
    }

    setMsg("");
    var cart = getCart();
    if (!cart.length) {
      setMsg("سلتك فارغة.");
      return;
    }

    if (!window.BB || !window.BB.getSupabase) {
      setMsg("Supabase غير مهيأ بعد.");
      return;
    }

    var sb;
    try {
      sb = await window.BB.getSupabase();
    } catch {
      // auth.js will show config modal
      setMsg("أدخل إعدادات Supabase أولًا.");
      return;
    }
    // Customer login WITHOUT Supabase Auth (token stored in localStorage)
    var tok = "";
    try {
      tok = localStorage.getItem("bb_customer_token") || "";
    } catch (e0) {}
    if (!tok) {
      location.href = "login.html?return=" + encodeURIComponent("checkout.html");
      return;
    }

    var name = (document.getElementById("bb-shipping-name")?.value || "").trim();
    var phone = (document.getElementById("bb-shipping-phone")?.value || "").trim();
    var city = (document.getElementById("bb-shipping-city")?.value || "").trim();
    var address = (document.getElementById("bb-shipping-address")?.value || "").trim();
    if (!name || !phone || !city || !address) {
      setMsg("رجاءً املأ معلومات الشحن كاملة.");
      return;
    }

    var sub = subtotalIQD(cart);
    var shipping = cart.length ? getShippingFee(city) : 0;
    var total = sub + shipping;

    // Require variant when present
    var missingVariant = cart.find(function (it) {
      return !!(
        it &&
        it.product_id &&
        ((it.color === null || it.color === undefined || it.color === "") ||
          (it.age_range === null || it.age_range === undefined || it.age_range === ""))
      );
    });
    if (missingVariant) {
      setMsg("الرجاء اختيار المقاس/العمر واللون لكل منتج قبل تثبيت الطلب.");
      return;
    }

    var itemsPayload = cart.map(function (it) {
      return {
        product_id: it.product_id,
        qty: Number(it.qty || 1),
        unit_price_iqd: Number(it.price_iqd || 0),
        color: it.color || null,
        age_range: it.age_range || null,
      };
    });

    // Create order via RPC (inserts order+items and applies inventory)
    var orderRes = await sb.rpc("customer_create_order", {
      p_token: tok,
      p_shipping_name: name,
      p_shipping_phone: phone,
      p_shipping_city: city,
      p_shipping_address: address,
      p_items: itemsPayload,
    });
    if (orderRes.error) {
      setMsg("فشل إنشاء الطلب: " + orderRes.error.message);
      return;
    }
    var orderId = orderRes.data;

    // Success: clear cart
    setCart([]);
    render();
    // Redirect back to home after success
    location.href = "home.html";
  }

  function parseKey(key) {
    var parts = String(key || "").split("||");
    return { product_id: parts[0] || "", color: parts[1] || "", age_range: parts[2] || "" };
  }

  function sameKey(it, keyObj) {
    return (
      String(it.product_id || "") === String(keyObj.product_id || "") &&
      String(it.color || "") === String(keyObj.color || "") &&
      String(it.age_range || "") === String(keyObj.age_range || "")
    );
  }

  function mutateQty(key, delta) {
    var cart = getCart();
    var k = parseKey(key);
    var it = cart.find(function (x) { return sameKey(x, k); });
    if (!it) return;
    var next = Math.max(1, Number(it.qty || 1) + delta);
    var maxStock = Number(it.stock);
    if (Number.isFinite(maxStock) && maxStock >= 0) next = Math.min(next, maxStock);
    it.qty = next;
    setCart(cart);
    render();
  }

  function removeItem(key) {
    var k = parseKey(key);
    var cart = getCart().filter(function (x) { return !sameKey(x, k); });
    setCart(cart);
    render();
  }

  function bind() {
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest("button");
      if (!btn) return;
      var id =
        btn.getAttribute("data-bb-inc") ||
        btn.getAttribute("data-bb-dec") ||
        btn.getAttribute("data-bb-del");
      if (!id) return;
      if (btn.hasAttribute("data-bb-inc")) mutateQty(id, +1);
      if (btn.hasAttribute("data-bb-dec")) mutateQty(id, -1);
      if (btn.hasAttribute("data-bb-del")) removeItem(id);
    });

    var place = document.getElementById("bb-place-order");
    if (place) {
      place.addEventListener("click", function (e) {
        e.preventDefault();
        placeOrder().catch(function (err) {
          console.warn(err);
          var msg = document.getElementById("bb-checkout-msg");
          if (msg) msg.textContent = "حدث خطأ غير متوقع أثناء إنشاء الطلب.";
        });
      });
    }

    var citySel = document.getElementById("bb-shipping-city");
    if (citySel) {
      citySel.addEventListener("change", function () {
        render();
      });
    }
  }

  async function loadPaymentSettings() {
    if (!window.BB || !window.BB.getSupabase) return null;
    var sb = await window.BB.getSupabase();
    var keys = ["payment_zain_phone", "payment_zain_qr_url", "payment_card_transfer_code"];
    var r = await sb.from("app_settings").select("key,value").in("key", keys);
    if (r.error) return null;
    var map = {};
    (r.data || []).forEach(function (row) {
      map[row.key] = row.value || "";
    });
    return map;
  }

  function applyPaymentUI(settings) {
    var s = settings || {};
    var zainOk = Boolean(String(s.payment_zain_phone || "").trim() || String(s.payment_zain_qr_url || "").trim());
    var cardOk = Boolean(String(s.payment_card_transfer_code || "").trim());

    function setDisabled(label, disabled) {
      if (!label) return;
      if (disabled) {
        label.classList.add("opacity-50");
        label.classList.add("pointer-events-none");
      } else {
        label.classList.remove("opacity-50");
        label.classList.remove("pointer-events-none");
      }
    }

    var zLabel = document.querySelector('label[data-bb-pay="zain"]');
    var cLabel = document.querySelector('label[data-bb-pay="card"]');
    setDisabled(zLabel, !zainOk);
    setDisabled(cLabel, !cardOk);

    var info = document.getElementById("bb-payment-info");
    function renderInfo(mode) {
      if (!info) return;
      if (mode === "zain") {
        if (!zainOk) {
          info.textContent = "زين كاش غير متوفرة حالياً.";
          return;
        }
        var parts = [];
        if (String(s.payment_zain_phone || "").trim()) parts.push("رقم: " + String(s.payment_zain_phone).trim());
        if (String(s.payment_zain_qr_url || "").trim())
          parts.push('QR: <a class="underline" target="_blank" href="' + escapeHtml(s.payment_zain_qr_url) + '">فتح</a>');
        info.innerHTML = parts.join(" · ");
        return;
      }
      if (mode === "card") {
        if (!cardOk) {
          info.textContent = "البطاقة/التحويل غير متوفرة حالياً.";
          return;
        }
        info.textContent = "رمز التحويل: " + String(s.payment_card_transfer_code || "").trim();
        return;
      }
      info.textContent = "";
    }

    document.querySelectorAll('input[name="payment"]').forEach(function (inp) {
      inp.addEventListener("change", function () {
        renderInfo(inp.value);
      });
    });
    renderInfo((document.querySelector('input[name="payment"]:checked') || {}).value || "cod");
  }

  document.addEventListener("DOMContentLoaded", function () {
    (async function () {
      try {
        // Show customer status + autofill shipping fields (no Supabase Auth)
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
            var nameEl = document.getElementById("bb-shipping-name");
            var phoneEl = document.getElementById("bb-shipping-phone");
            if (nameEl && !String(nameEl.value || "").trim()) nameEl.value = me.full_name || "";
            if (phoneEl && !String(phoneEl.value || "").trim()) phoneEl.value = me.phone || "";
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
      } catch (e) {}
      try {
        await loadShippingRates();
      } catch (e) {}
      try {
        var pay = await loadPaymentSettings();
        applyPaymentUI(pay);
      } catch (e) {}
      bind();
      render();
    })();
  });
})();

