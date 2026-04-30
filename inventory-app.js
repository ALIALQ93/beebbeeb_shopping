// Inventory page: admin-only per-color stock management for products.
(function () {
  var COLOR_CHOICES = [
    "Mint",
    "Pink",
    "Cream",
    "Sky",
    "Beige",
    "Navy",
    "Black",
    "White",
    "Red",
    "Blue",
    "Green",
    "Yellow",
    "Orange",
    "Purple",
    "Gray",
    "Brown",
  ];
  var AGE_CHOICES = [
    "0-3M",
    "3-6M",
    "6-12M",
    "12-18M",
    "18-24M",
    "2-3Y",
    "3-4Y",
    "4-5Y",
    "5-6Y",
    "6-7Y",
    "7-8Y",
    "8-12Y",
  ];
  function $(id) {
    return document.getElementById(id);
  }

  function setMsg(t) {
    var el = $("bb-inv-msg");
    if (el) el.textContent = t || "";
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

  function rowHtml(p, colorsObj) {
    var colors = colorsObj || {}; // color -> age -> stock
    var keys = Object.keys(colors);
    var sum = keys.reduce(function (s, k) {
      var ages = colors[k] || {};
      return s + Object.keys(ages).reduce(function (ss, a) { return ss + Number(ages[a] || 0); }, 0);
    }, 0);
    var badge =
      sum <= 0
        ? '<span class="text-xs font-bold text-error">OUT</span>'
        : sum <= 10
          ? '<span class="text-xs font-bold text-orange-600">LOW</span>'
          : '<span class="text-xs font-bold text-primary">OK</span>';

    var colorsText = keys.length
      ? keys
          .sort()
          .map(function (k) {
            var ages = colors[k] || {};
            var agesKeys = Object.keys(ages || {}).sort();
            var t = agesKeys.reduce(function (ss, a) { return ss + Number(ages[a] || 0); }, 0);
            var breakdown = agesKeys
              .filter(function (a) { return Number(ages[a] || 0) > 0; })
              .map(function (a) { return a + ":" + String(ages[a] || 0); })
              .join(", ");
            return k + ":" + String(t) + (breakdown ? " (" + breakdown + ")" : "");
          })
          .join("  |  ")
      : "—";

    // Color select for adjustment: existing colors OR from products.colors if provided
    var options = "";
    var list = Array.isArray(p.colors) ? p.colors : keys;
    var uniq = {};
    list.forEach(function (c) { if (c) uniq[c] = true; });
    Object.keys(uniq).sort().forEach(function (c) {
      options += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>";
    });
    if (!options) options = '<option value="">(no colors)</option>';

    var newColorOptions =
      '<option value="">New color…</option>' +
      COLOR_CHOICES.map(function (c) {
        return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>";
      }).join("");

    // Always show the full standard age list (plus any custom ages on product)
    var ages = AGE_CHOICES.slice();
    if (Array.isArray(p.age_ranges)) {
      p.age_ranges
        .filter(Boolean)
        .forEach(function (a) {
          if (ages.indexOf(a) === -1) ages.push(a);
        });
    }
    var ageOptions = ages.length
      ? '<option value="">Age…</option>' +
        ages
          .slice()
          .sort()
          .map(function (a) {
            return '<option value="' + escapeHtml(a) + '">' + escapeHtml(a) + "</option>";
          })
          .join("")
      : '<option value="">(no ages)</option>';

    return (
      '<tr data-id="' +
      escapeHtml(p.id) +
      '">' +
      '<td class="px-4 py-3">' +
      '<div class="flex items-center gap-3">' +
      (p.image_url
        ? '<img alt="" src="' +
          escapeHtml(p.image_url) +
          '" class="w-12 h-12 rounded-xl object-cover border border-outline-variant/40" />'
        : '<div class="w-12 h-12 rounded-xl bg-surface-container-low border border-outline-variant/40 flex items-center justify-center text-outline text-xs">No</div>') +
      '<div>' +
      '<div class="font-semibold">' +
      escapeHtml(p.title || "Untitled") +
      '</div><div class="text-xs text-outline">ID: ' +
      escapeHtml(p.id) +
      "</div></div></div></td>" +
      '<td class="px-4 py-3 text-right">' +
      '<div class="flex items-center justify-end gap-2">' +
      badge +
      '<div class="font-black">' + escapeHtml(String(sum)) + "</div>" +
      "</div>" +
      '<div class="mt-1 text-xs text-outline font-mono leading-relaxed">' + escapeHtml(colorsText) + "</div>" +
      "</td>" +
      '<td class="px-4 py-3 text-right">' +
      '<div class="flex flex-col items-end gap-2">' +
      '<div class="flex items-center justify-end gap-2">' +
      '<select data-color class="bg-surface-container-low rounded-lg px-3 py-2 text-sm border border-outline-variant/40">' +
      options +
      "</select>" +
      '<select data-age class="bg-surface-container-low rounded-lg px-3 py-2 text-sm border border-outline-variant/40">' +
      ageOptions +
      "</select>" +
      '<button data-add="-10" class="px-3 py-2 rounded-full border border-outline-variant/60 hover:bg-surface-container-low text-sm font-bold">-10</button>' +
      '<button data-add="-5" class="px-3 py-2 rounded-full border border-outline-variant/60 hover:bg-surface-container-low text-sm font-bold">-5</button>' +
      '<button data-add="-1" class="px-3 py-2 rounded-full border border-outline-variant/60 hover:bg-surface-container-low text-sm font-bold">-1</button>' +
      '<button data-add="1" class="px-3 py-2 rounded-full border border-outline-variant/60 hover:bg-surface-container-low text-sm font-bold">+1</button>' +
      '<button data-add="5" class="px-3 py-2 rounded-full border border-outline-variant/60 hover:bg-surface-container-low text-sm font-bold">+5</button>' +
      '<button data-add="10" class="px-3 py-2 rounded-full border border-outline-variant/60 hover:bg-surface-container-low text-sm font-bold">+10</button>' +
      "</div>" +
      '<div class="flex items-center justify-end gap-2">' +
      '<select data-new-color class="w-32 bg-surface-container-low rounded-lg px-3 py-2 text-sm border border-outline-variant/40">' +
      newColorOptions +
      "</select>" +
      '<select data-new-age class="w-32 bg-surface-container-low rounded-lg px-3 py-2 text-sm border border-outline-variant/40">' +
      ageOptions +
      "</select>" +
      '<input data-new-qty type="number" min="0" value="0" class="w-20 text-right bg-surface-container-low rounded-lg px-3 py-2 text-sm border border-outline-variant/40" />' +
      '<button data-add-new class="px-3 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90">Add</button>' +
      "</div>" +
      "</div>" +
      "</td>" +
      "</tr>"
    );
  }

  async function loadAndRender(sb) {
    setMsg("");
    var res = await sb
      .from("products")
      .select("id,title,image_url,colors,age_ranges,active,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (res.error) {
      // Fallback if created_at doesn't exist or isn't selectable.
      res = await sb
        .from("products")
        .select("id,title,image_url,colors,age_ranges,active")
        .order("id", { ascending: false })
        .limit(200);
    }
    if (res.error) {
      setMsg(res.error.message);
      return [];
    }

    var items = res.data || [];
    // load per-variant stock for all items
    var ids = items.map(function (x) { return x.id; }).filter(Boolean);
    var stockMap = {}; // product_id -> color -> age -> stock
    if (ids.length) {
      var vs = await sb
        .from("product_variant_stock")
        .select("product_id,color,age_range,stock")
        .in("product_id", ids);
      if (vs.error) {
        setMsg(vs.error.message);
        return [];
      }
      (vs.data || []).forEach(function (r) {
        stockMap[r.product_id] = stockMap[r.product_id] || {};
        stockMap[r.product_id][r.color] = stockMap[r.product_id][r.color] || {};
        stockMap[r.product_id][r.color][r.age_range] = Number(r.stock || 0);
      });
    }

    var totals = items.map(function (x) {
      var o = stockMap[x.id] || {};
      return Object.keys(o).reduce(function (s, c) {
        var ages = o[c] || {};
        return s + Object.keys(ages).reduce(function (ss, a) { return ss + Number(ages[a] || 0); }, 0);
      }, 0);
    });
    $("bb-stat-total").textContent = String(items.length);
    $("bb-stat-low").textContent = String(totals.filter(function (n) { return n > 0 && n <= 10; }).length);
    $("bb-stat-out").textContent = String(totals.filter(function (n) { return n <= 0; }).length);

    var q = ($("bb-inv-search") && $("bb-inv-search").value || "").trim().toLowerCase();
    var filtered = q
      ? items.filter(function (x) {
          return String(x.title || "").toLowerCase().indexOf(q) !== -1;
        })
      : items;

    var tbody = $("bb-inv-rows");
    if (tbody) tbody.innerHTML = filtered.map(function (p) { return rowHtml(p, stockMap[p.id] || {}); }).join("");
    return items;
  }

  async function addStock(sb, id, color, ageRange, delta) {
    setMsg("");
    if (!color) {
      setMsg("اختر لونًا أولاً");
      return false;
    }
    if (!ageRange) {
      setMsg("اختر المقاس/العمر أولاً");
      return false;
    }
    var res = await sb.rpc("adjust_variant_stock", {
      p_product_id: id,
      p_color: color,
      p_age_range: ageRange,
      p_delta: Number(delta || 0),
    });
    if (res.error) {
      var e = res.error;
      var extra = "";
      if (e && (e.code || e.details || e.hint)) {
        extra =
          " (" +
          [e.code ? "code=" + e.code : "", e.details ? e.details : "", e.hint ? e.hint : ""]
            .filter(Boolean)
            .join(" · ") +
          ")";
      }
      setMsg((e && e.message ? e.message : "فشل تحديث المخزون") + extra);
      return false;
    }
    // Best-effort: append new color/age to products arrays so they appear on product page too
    try {
      var pr = await sb.from("products").select("colors,age_ranges").eq("id", id).maybeSingle();
      if (!pr.error) {
        var cur = Array.isArray(pr.data && pr.data.colors) ? pr.data.colors.filter(Boolean) : [];
        var ages = Array.isArray(pr.data && pr.data.age_ranges) ? pr.data.age_ranges.filter(Boolean) : [];
        var changed = false;
        if (cur.indexOf(color) === -1) {
          cur.push(color);
          changed = true;
        }
        if (ages.indexOf(ageRange) === -1) {
          ages.push(ageRange);
          changed = true;
        }
        if (changed) {
          await sb.from("products").update({ colors: cur, age_ranges: ages }).eq("id", id);
        }
      }
    } catch (e) {}
    return true;
  }

  async function boot() {
    if (!window.BB || !window.BB.requireAdmin) return;
    var ok = await window.BB.requireAdmin();
    if (!ok) return;

    var sb = await window.BB.getSupabase();
    var items = await loadAndRender(sb);

    var refresh = $("bb-inv-refresh");
    if (refresh) {
      refresh.addEventListener("click", function () {
        loadAndRender(sb).then(function (x) {
          items = x || items;
        });
      });
    }

    var search = $("bb-inv-search");
    if (search) {
      search.addEventListener("input", function () {
        // Re-render from cached list for responsiveness
        var q = search.value.trim().toLowerCase();
        var filtered = q
          ? (items || []).filter(function (x) {
              return String(x.title || "").toLowerCase().indexOf(q) !== -1;
            })
          : (items || []);
        var tbody = $("bb-inv-rows");
        if (tbody) tbody.innerHTML = filtered.map(rowHtml).join("");
      });
    }

    document.addEventListener("click", async function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest("button");
      var tr = t.closest("tr[data-id]");
      if (!tr) return;
      var id = tr.getAttribute("data-id");
      var sel = tr.querySelector("select[data-color]");
      var color = sel ? sel.value : "";
      var aSel = tr.querySelector("select[data-age]");
      var ageRange = aSel ? aSel.value : "";

      if (btn && btn.hasAttribute("data-add")) {
        var delta = Number(btn.getAttribute("data-add") || "0");
        if (delta < 0) {
          if (!confirm("خفض المخزون؟")) return;
        }
        btn.disabled = true;
        var ok2 = await addStock(sb, id, color, ageRange, delta);
        btn.disabled = false;
        if (ok2) items = await loadAndRender(sb);
      }

      if (btn && btn.hasAttribute("data-add-new")) {
        var cIn = tr.querySelector("select[data-new-color]");
        var aIn = tr.querySelector("select[data-new-age]");
        var qIn = tr.querySelector("input[data-new-qty]");
        var newColor = (cIn && cIn.value ? cIn.value : "").trim();
        var newAge = (aIn && aIn.value ? aIn.value : "").trim();
        var newQty = Math.max(0, Number(qIn && qIn.value ? qIn.value : 0));
        if (!newColor) {
          setMsg("اختر اللون الجديد.");
          return;
        }
        if (!newAge) {
          setMsg("اختر المقاس/العمر.");
          return;
        }
        btn.disabled = true;
        var ok3 = await addStock(sb, id, newColor, newAge, newQty);
        btn.disabled = false;
        if (ok3) {
          if (cIn) cIn.value = "";
          if (aIn) aIn.value = "";
          if (qIn) qIn.value = "0";
          items = await loadAndRender(sb);
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (e) {
      console.warn(e);
      setMsg("Unexpected error.");
    });
  });
})();

