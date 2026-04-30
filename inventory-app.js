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
    var colors = colorsObj || {};
    var keys = Object.keys(colors);
    var sum = keys.reduce(function (s, k) { return s + Number(colors[k] || 0); }, 0);
    var badge =
      sum <= 0
        ? '<span class="text-xs font-bold text-error">OUT</span>'
        : sum <= 10
          ? '<span class="text-xs font-bold text-orange-600">LOW</span>'
          : '<span class="text-xs font-bold text-primary">OK</span>';

    var colorsText = keys.length
      ? keys.sort().map(function (k) { return k + ":" + String(colors[k] || 0); }).join("  ")
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

    return (
      '<tr data-id="' +
      escapeHtml(p.id) +
      '">' +
      '<td class="px-4 py-3">' +
      '<div class="font-semibold">' +
      escapeHtml(p.title || "Untitled") +
      '</div><div class="text-xs text-outline">ID: ' +
      escapeHtml(p.id) +
      "</div></td>" +
      '<td class="px-4 py-3 text-right font-mono text-xs">' +
      badge +
      '<div class="mt-1">' + escapeHtml(colorsText) + "</div>" +
      "</td>" +
      '<td class="px-4 py-3 text-right">' +
      '<div class="flex flex-col items-end gap-2">' +
      '<div class="flex items-center justify-end gap-2">' +
      '<select data-color class="bg-surface-container-low rounded-lg px-3 py-2 text-sm border border-outline-variant/40">' +
      options +
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
      .select("id,title,colors,active,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (res.error) {
      // Fallback if created_at doesn't exist or isn't selectable.
      res = await sb
        .from("products")
        .select("id,title,colors,active")
        .order("id", { ascending: false })
        .limit(200);
    }
    if (res.error) {
      setMsg(res.error.message);
      return [];
    }

    var items = res.data || [];
    // load per-color stock for all items
    var ids = items.map(function (x) { return x.id; }).filter(Boolean);
    var stockMap = {};
    if (ids.length) {
      var vs = await sb
        .from("product_color_stock")
        .select("product_id,color,stock")
        .in("product_id", ids);
      if (vs.error) {
        setMsg(vs.error.message);
        return [];
      }
      (vs.data || []).forEach(function (r) {
        stockMap[r.product_id] = stockMap[r.product_id] || {};
        stockMap[r.product_id][r.color] = Number(r.stock || 0);
      });
    }

    var totals = items.map(function (x) {
      var o = stockMap[x.id] || {};
      return Object.keys(o).reduce(function (s, k) { return s + Number(o[k] || 0); }, 0);
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

  async function addStock(sb, id, color, delta) {
    setMsg("");
    if (!color) {
      setMsg("اختر لونًا أولاً");
      return false;
    }
    var res = await sb.rpc("adjust_color_stock", {
      p_product_id: id,
      p_color: color,
      p_delta: Number(delta || 0),
    });
    if (res.error) {
      setMsg(res.error.message);
      return false;
    }
    // Best-effort: append new color to products.colors so it appears on product page too
    try {
      var pr = await sb.from("products").select("colors").eq("id", id).maybeSingle();
      if (!pr.error) {
        var cur = Array.isArray(pr.data && pr.data.colors) ? pr.data.colors.filter(Boolean) : [];
        if (cur.indexOf(color) === -1) {
          cur.push(color);
          await sb.from("products").update({ colors: cur }).eq("id", id);
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
      var tr = t.closest("tr[data-id]");
      if (!tr) return;
      var id = tr.getAttribute("data-id");
      var sel = tr.querySelector("select[data-color]");
      var color = sel ? sel.value : "";

      if (t.hasAttribute("data-add")) {
        var delta = Number(t.getAttribute("data-add") || "0");
        if (delta < 0) {
          if (!confirm("خفض المخزون؟")) return;
        }
        t.disabled = true;
        var ok2 = await addStock(sb, id, color, delta);
        t.disabled = false;
        if (ok2) items = await loadAndRender(sb);
      }

      if (t.hasAttribute("data-add-new")) {
        var cIn = tr.querySelector("select[data-new-color]");
        var qIn = tr.querySelector("input[data-new-qty]");
        var newColor = (cIn && cIn.value ? cIn.value : "").trim();
        var newQty = Math.max(0, Number(qIn && qIn.value ? qIn.value : 0));
        if (!newColor) {
          setMsg("اختر اللون الجديد.");
          return;
        }
        t.disabled = true;
        var ok3 = await addStock(sb, id, newColor, newQty);
        t.disabled = false;
        if (ok3) {
          if (cIn) cIn.value = "";
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

