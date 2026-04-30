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
    // In template: <div class="divide-y divide-teal-50"> ... items ...
    var h2 = findCartTitleEl();
    if (!h2) return null;
    var section = h2.closest("section");
    if (!section) return null;
    return section.querySelector(".divide-y");
  }

  function setSummary(subtotal, shipping, total) {
    // Replace known summary numbers in the template.
    var spans = Array.from(document.querySelectorAll("span"));
    spans.forEach(function (s) {
      var t = (s.textContent || "").trim();
      if (t === "60,000 IQD") s.textContent = fmtIQD(subtotal);
    });

    // Best-effort: update the big total number (text-3xl font-black text-primary)
    var big = document.querySelector("span.text-3xl.font-black.text-primary");
    if (big) big.textContent = fmtIQD(total);
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

    return (
      '<div class="py-6 flex flex-col md:flex-row gap-6" data-bb-item="' +
      escapeHtml(item.product_id) +
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
      escapeHtml(item.product_id) +
      '"><span class="material-symbols-outlined">delete</span></button>' +
      "</div>" +
      '<div class="flex justify-between items-end mt-4">' +
      '<div class="flex items-center border border-outline-variant/30 rounded-xl px-2 py-1 bg-surface-container-low">' +
      '<button class="w-8 h-8 flex items-center justify-center text-primary font-bold" data-bb-dec="' +
      escapeHtml(item.product_id) +
      '">-</button>' +
      '<span class="px-4 font-bold">' +
      String(item.qty || 1) +
      "</span>" +
      '<button class="w-8 h-8 flex items-center justify-center text-primary font-bold" data-bb-inc="' +
      escapeHtml(item.product_id) +
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
    var shipping = cart.length ? 5000 : 0;
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
    var u = await sb.auth.getUser();
    if (!u.data || !u.data.user) {
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
    var shipping = cart.length ? 5000 : 0;
    var total = sub + shipping;

    // 1) Create order
    var orderRes = await sb
      .from("orders")
      .insert({
        user_id: u.data.user.id,
        status: "pending",
        currency: "IQD",
        subtotal: sub,
        shipping_fee: shipping,
        total: total,
        shipping_name: name,
        shipping_phone: phone,
        shipping_city: city,
        shipping_address: address,
      })
      .select("id")
      .single();

    if (orderRes.error) {
      setMsg("فشل إنشاء الطلب: " + orderRes.error.message);
      return;
    }

    var orderId = orderRes.data.id;

    // 2) Create order items
    // Require color when present
    var missingColor = cart.find(function (it) {
      return !!(it && it.product_id && (it.color === null || it.color === undefined || it.color === ""));
    });
    if (missingColor) {
      setMsg("الرجاء اختيار لون لكل منتج قبل تثبيت الطلب (افتح صفحة المنتج واختر اللون).");
      return;
    }

    var itemsPayload = cart.map(function (it) {
      return {
        order_id: orderId,
        product_id: it.product_id,
        qty: Number(it.qty || 1),
        unit_price_iqd: Number(it.price_iqd || 0),
        color: it.color || null,
      };
    });

    var itemsRes = await sb.from("order_items").insert(itemsPayload);
    if (itemsRes.error) {
      setMsg("تم إنشاء الطلب لكن فشل حفظ العناصر: " + itemsRes.error.message);
      return;
    }

    // 3) Apply inventory now (decrease stock)
    var invRes = await sb.rpc("apply_order_inventory", { p_order_id: orderId });
    if (invRes.error) {
      setMsg("تم إنشاء الطلب لكن فشل خصم المخزون: " + invRes.error.message);
      return;
    }

    // Success: clear cart
    setCart([]);
    render();
    alert("تم إنشاء الطلب بنجاح. رقم الطلب: " + orderId);
  }

  function mutateQty(id, delta) {
    var cart = getCart();
    var it = cart.find(function (x) {
      return x.product_id === id;
    });
    if (!it) return;
    var next = Math.max(1, Number(it.qty || 1) + delta);
    var maxStock = Number(it.stock);
    if (Number.isFinite(maxStock) && maxStock >= 0) next = Math.min(next, maxStock);
    it.qty = next;
    setCart(cart);
    render();
  }

  function removeItem(id) {
    var cart = getCart().filter(function (x) {
      return x.product_id !== id;
    });
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
  }

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    render();
  });
})();

