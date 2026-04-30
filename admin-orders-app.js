// Admin: list recent orders (requires profiles.is_admin + RLS).
(function () {
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

  function fmtIQD(n) {
    try {
      return new Intl.NumberFormat("en-US").format(Number(n || 0)) + " IQD";
    } catch {
      return String(n || 0) + " IQD";
    }
  }

  function safeText(s) {
    return String(s == null ? "" : s);
  }

  function buildPrintHtml(payload) {
    var o = payload.order || {};
    var items = payload.items || [];

    var rows = items
      .map(function (it) {
        var lineTotal = Number(it.unit_price_iqd || 0) * Number(it.qty || 0);
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(it.title || it.product_id || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(it.color || "") +
          "</td>" +
          "<td>" +
          escapeHtml(it.age_range || "") +
          "</td>" +
          "<td style='text-align:center'>" +
          escapeHtml(String(it.qty || 0)) +
          "</td>" +
          "<td style='text-align:right'>" +
          escapeHtml(fmtIQD(lineTotal)) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    var created = o.created_at ? new Date(o.created_at).toLocaleString("ar-IQ") : "";
    var ship = Number(o.shipping_fee_iqd || 0);
    var subtotal = Math.max(0, Number(o.total || 0) - ship);

    return (
      "<!doctype html>" +
        "<html lang='ar' dir='rtl'><head><meta charset='utf-8' />" +
        "<meta name='viewport' content='width=device-width, initial-scale=1' />" +
        "<title>Print Order</title>" +
        "<style>" +
        "body{font-family:Arial, sans-serif; margin:24px; color:#111;} " +
        "h1{margin:0 0 8px;} .muted{color:#555; font-size:12px;} " +
        ".box{border:1px solid #ddd; border-radius:12px; padding:12px; margin:12px 0;} " +
        "table{width:100%; border-collapse:collapse; margin-top:10px;} " +
        "th,td{border-bottom:1px solid #eee; padding:8px; font-size:13px;} " +
        "th{background:#f7f7f7; text-align:right;} " +
        ".tot{font-weight:700; font-size:16px;}" +
        "@media print{button{display:none;} body{margin:0;}}" +
        "</style></head><body>" +
        "<button onclick='window.print()' style='padding:8px 12px;border:1px solid #ddd;border-radius:10px;background:#fff;cursor:pointer;font-weight:700'>طباعة</button>" +
        "<h1>طلب</h1>" +
        "<div class='muted'>رقم الطلب: <span dir='ltr'>" +
        escapeHtml(safeText(o.id)) +
        "</span> • " +
        escapeHtml(created) +
        "</div>" +
        "<div class='box'>" +
        "<div><b>الحالة:</b> " +
        escapeHtml(safeText(o.status)) +
        "</div>" +
        "<div><b>الزبون:</b> " +
        escapeHtml(safeText(o.shipping_name)) +
        "</div>" +
        "<div><b>الهاتف:</b> <span dir='ltr'>" +
        escapeHtml(safeText(o.shipping_phone)) +
        "</span></div>" +
        "<div><b>المدينة:</b> " +
        escapeHtml(safeText(o.shipping_city)) +
        "</div>" +
        "<div><b>العنوان:</b> " +
        escapeHtml(safeText(o.shipping_address)) +
        "</div>" +
        "</div>" +
        "<div class='box'>" +
        "<b>المحتويات</b>" +
        "<table><thead><tr>" +
        "<th>المنتج</th><th>اللون</th><th>العمر/المقاس</th><th style='text-align:center'>الكمية</th><th style='text-align:right'>الإجمالي</th>" +
        "</tr></thead><tbody>" +
        rows +
        "</tbody></table>" +
        "<div style='margin-top:10px; text-align:left' class='muted'>المجموع الفرعي: " +
        escapeHtml(fmtIQD(subtotal)) +
        "</div>" +
        "<div style='margin-top:6px; text-align:left' class='muted'>الشحن: " +
        escapeHtml(fmtIQD(ship)) +
        "</div>" +
        "<div style='margin-top:8px; text-align:left' class='tot'>الإجمالي: " +
        escapeHtml(fmtIQD(o.total || 0)) +
        "</div>" +
        "</div>" +
        "</body></html>"
    );
  }

  function ensurePrintMount() {
    var root = document.getElementById("bb-print-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "bb-print-root";
      document.body.appendChild(root);
    }
    var style = document.getElementById("bb-print-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "bb-print-style";
      style.textContent =
        "@media screen { #bb-print-root { display:none; } } " +
        "@media print { body > *:not(#bb-print-root) { display:none !important; } #bb-print-root { display:block; } }";
      document.head.appendChild(style);
    }
    return root;
  }

  function printInPlace(payload) {
    var root = ensurePrintMount();
    // Put only the printable body into the mount (not full html doc)
    var o = payload.order || {};
    var items = payload.items || [];
    var created = o.created_at ? new Date(o.created_at).toLocaleString("ar-IQ") : "";
    var ship = Number(o.shipping_fee_iqd || 0);
    var subtotal = Math.max(0, Number(o.total || 0) - ship);
    var orderShort = String(o.id || "").slice(0, 8);
    var rows = items
      .map(function (it) {
        var unit = Number(it.unit_price_iqd || 0);
        var lineTotal = Number(it.unit_price_iqd || 0) * Number(it.qty || 0);
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(it.title || it.product_id || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(it.color || "") +
          "</td>" +
          "<td>" +
          escapeHtml(it.age_range || "") +
          "</td>" +
          "<td class='c'>" +
          escapeHtml(String(it.qty || 0)) +
          "</td>" +
          "<td class='r'>" +
          escapeHtml(fmtIQD(unit)) +
          "</td>" +
          "<td class='r'>" +
          escapeHtml(fmtIQD(lineTotal)) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    root.innerHTML =
      "<style>" +
      "@page { size: A4; margin: 14mm; }" +
      ".p{font-family: Arial, sans-serif; color:#111;}" +
      ".hdr{display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding-bottom:10px; border-bottom:2px solid #146a5c;}" +
      ".brand{font-weight:900; font-size:22px; color:#146a5c;}" +
      ".tag{margin-top:6px; font-size:12px; color:#444;}" +
      ".meta{font-size:12px; color:#444; text-align:left;}" +
      ".meta .k{color:#666; font-weight:700;}" +
      ".pill{display:inline-block; padding:4px 10px; border-radius:999px; background:#e6f4f1; color:#0d4f45; font-weight:800; font-size:12px;}" +
      ".grid{display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:12px;}" +
      ".box{border:1px solid #e5e7eb; border-radius:14px; padding:10px 12px;}" +
      ".ttl{font-weight:900; font-size:13px; color:#111; margin:0 0 6px;}" +
      ".row{display:flex; gap:10px; margin:4px 0; font-size:12px;}" +
      ".row .k{min-width:72px; color:#666; font-weight:700;}" +
      ".row .v{color:#111;}" +
      "table{width:100%; border-collapse:separate; border-spacing:0; margin-top:10px; overflow:hidden; border:1px solid #e5e7eb; border-radius:14px;}" +
      "thead th{background:#f8fafc; color:#334155; font-size:12px; text-align:right; padding:10px 10px; border-bottom:1px solid #e5e7eb;}" +
      "tbody td{font-size:12px; padding:10px 10px; border-bottom:1px solid #f1f5f9; vertical-align:top;}" +
      "tbody tr:nth-child(even) td{background:#fcfcfd;}" +
      "tbody tr:last-child td{border-bottom:none;}" +
      ".r{text-align:left; white-space:nowrap;}" +
      ".c{text-align:center;}" +
      ".sum{display:flex; justify-content:flex-end; margin-top:10px;}" +
      ".sumBox{min-width:260px; border:1px solid #e5e7eb; border-radius:14px; padding:10px 12px;}" +
      ".sumRow{display:flex; justify-content:space-between; gap:12px; font-size:12px; color:#334155; margin:6px 0;}" +
      ".sumRow b{color:#111;}" +
      ".sumTot{margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1; font-weight:900; font-size:14px;}" +
      ".ft{margin-top:10px; font-size:11px; color:#64748b; display:flex; justify-content:space-between; gap:12px;}" +
      "</style>" +
      "<div class='p'>" +
      "<div class='hdr'>" +
      "<div>" +
      "<div class='brand'>BeebBeeb Shopping</div>" +
      "<div class='tag'>وصل/فاتورة طلب</div>" +
      "</div>" +
      "<div class='meta'>" +
      "<div><span class='k'>الطلب:</span> <span dir='ltr'>" +
      escapeHtml(safeText(o.id)) +
      "</span></div>" +
      "<div><span class='k'>تاريخ:</span> " +
      escapeHtml(created) +
      "</div>" +
      "<div style='margin-top:6px'><span class='pill'>الحالة: " +
      escapeHtml(safeText(o.status)) +
      "</span></div>" +
      "</div>" +
      "</div>" +
      "<div class='grid'>" +
      "<div class='box'>" +
      "<div class='ttl'>معلومات الزبون</div>" +
      "<div class='row'><div class='k'>الاسم</div><div class='v'>" +
      escapeHtml(safeText(o.shipping_name)) +
      "</div></div>" +
      "<div class='row'><div class='k'>الهاتف</div><div class='v' dir='ltr'>" +
      escapeHtml(safeText(o.shipping_phone)) +
      "</div></div>" +
      "</div>" +
      "<div class='box'>" +
      "<div class='ttl'>الشحن</div>" +
      "<div class='row'><div class='k'>المدينة</div><div class='v'>" +
      escapeHtml(safeText(o.shipping_city)) +
      "</div></div>" +
      "<div class='row'><div class='k'>العنوان</div><div class='v'>" +
      escapeHtml(safeText(o.shipping_address)) +
      "</div></div>" +
      "</div>" +
      "</div>" +
      "<div class='box' style='margin-top:10px'>" +
      "<div class='ttl'>محتويات الطلب</div>" +
      "<table>" +
      "<thead><tr>" +
      "<th>المنتج</th><th>اللون</th><th>العمر/المقاس</th><th class='c'>الكمية</th><th class='r'>سعر الوحدة</th><th class='r'>الإجمالي</th>" +
      "</tr></thead>" +
      "<tbody>" +
      (rows || "<tr><td colspan='6' class='c'>—</td></tr>") +
      "</tbody></table>" +
      "<div class='sum'><div class='sumBox'>" +
      "<div class='sumRow'><span>المجموع الفرعي</span><b>" +
      escapeHtml(fmtIQD(subtotal)) +
      "</b></div>" +
      "<div class='sumRow'><span>الشحن</span><b>" +
      escapeHtml(fmtIQD(ship)) +
      "</b></div>" +
      "<div class='sumRow sumTot'><span>الإجمالي</span><span>" +
      escapeHtml(fmtIQD(o.total || 0)) +
      "</span></div>" +
      "</div></div>" +
      "</div>" +
      "<div class='ft'>" +
      "<div>رقم مختصر: <span dir='ltr'>" +
      escapeHtml(orderShort) +
      "</span></div>" +
      "<div>تمت الطباعة من لوحة الإدارة</div>" +
      "</div>" +
      "</div>";

    function cleanup() {
      try {
        root.innerHTML = "";
      } catch (e) {}
      window.removeEventListener("afterprint", cleanup);
    }
    window.addEventListener("afterprint", cleanup);
    setTimeout(function () {
      try {
        window.print();
      } catch (e) {
        cleanup();
      }
    }, 50);
  }

  async function fetchOrderForPrint(sb, orderId) {
    var or = await sb
      .from("orders")
      .select("id,status,total,currency,shipping_name,shipping_phone,shipping_city,shipping_address,shipping_fee_iqd,created_at")
      .eq("id", orderId)
      .maybeSingle();
    if (or.error) throw or.error;
    if (!or.data) throw new Error("Order not found");

    var ir = await sb
      .from("order_items")
      .select("product_id,color,age_range,qty,unit_price_iqd")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (ir.error) throw ir.error;

    var ids = Array.from(
      new Set((ir.data || []).map(function (x) { return x.product_id; }).filter(Boolean))
    );
    var titles = {};
    if (ids.length) {
      var pr = await sb.from("products").select("id,title").in("id", ids);
      if (!pr.error) {
        (pr.data || []).forEach(function (p) {
          titles[p.id] = p.title || "";
        });
      }
    }

    var items = (ir.data || []).map(function (it) {
      return {
        product_id: it.product_id,
        title: titles[it.product_id] || "",
        color: it.color,
        age_range: it.age_range,
        qty: it.qty,
        unit_price_iqd: it.unit_price_iqd,
      };
    });

    return { order: or.data, items: items };
  }

  async function boot() {
    if (!window.BB || !window.BB.requireAdmin) return;
    var ok = await window.BB.requireAdmin();
    if (!ok) return;
    var sb = await window.BB.getSupabase();
    var tbody = document.getElementById("bb-admin-order-rows");
    var msg = document.getElementById("bb-admin-orders-msg");
    if (!tbody) return;

    async function load() {
      if (msg) msg.textContent = "";
      var res = await sb
        .from("orders")
        .select(
          "id,status,total,currency,shipping_name,shipping_phone,shipping_city,created_at,inventory_applied"
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (res.error) {
        res = await sb
          .from("orders")
          .select(
            "id,status,total,currency,shipping_name,shipping_phone,shipping_city,inventory_applied"
          )
          .order("id", { ascending: false })
          .limit(100);
      }
      if (res.error) {
        if (msg) msg.textContent = res.error.message;
        return;
      }
      tbody.innerHTML = "";
      function normStatus(s) {
        var st0 = String(s || "pending").toLowerCase();
        if (st0 === "done") return "completed";
        if (st0 === "canceled") return "cancelled";
        return st0 || "pending";
      }

      var STATUS_ORDER = ["pending", "confirmed", "delivering", "completed", "cancelled"];
      var STATUS_LABEL = {
        pending: "قيد المراجعة",
        confirmed: "تم التثبيت",
        delivering: "قيد التوصيل",
        completed: "مكتمل",
        cancelled: "ملغي",
      };

      function allowedNext(cur) {
        var c = normStatus(cur);
        var i = STATUS_ORDER.indexOf(c);
        if (i < 0) i = 0;
        var tail = STATUS_ORDER.slice(i);
        // Do not allow cancelling after completion (forward-only business rule)
        if (c === "completed") return ["completed"];
        if (c === "cancelled") return ["cancelled"];
        return tail;
      }

      function statusSelectHtml(orderId, curStatus) {
        var cur = normStatus(curStatus);
        var opts = allowedNext(cur)
          .map(function (s) {
            var sel = s === cur ? " selected" : "";
            return '<option value="' + s + '"' + sel + ">" + (STATUS_LABEL[s] || s) + "</option>";
          })
          .join("");
        return (
          '<select data-act="set_status" data-id="' +
          escapeHtml(orderId) +
          '" data-cur="' +
          escapeHtml(cur) +
          '" class="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold">' +
          opts +
          "</select>"
        );
      }

      (res.data || []).forEach(function (r) {
        var tr = document.createElement("tr");
        tr.className = "border-b border-slate-100";
        var when = r.created_at
          ? new Date(r.created_at).toLocaleString()
          : "—";
        var st = normStatus(r.status || "");
        var inv = r.inventory_applied ? "✓" : "";
        tr.innerHTML =
          '<td class="px-4 py-3 font-mono text-sm">' +
          escapeHtml(String(r.id || "").slice(0, 8)) +
          "…</td>" +
          '<td class="px-4 py-3">' +
          escapeHtml(r.status || "") +
          (inv ? ' <span class="text-xs text-slate-400">(' + inv + ")</span>" : "") +
          "</td>" +
          '<td class="px-4 py-3">' +
          escapeHtml(r.shipping_name || "") +
          "</td>" +
          '<td class="px-4 py-3 font-mono text-sm" dir="ltr">' +
          escapeHtml(r.shipping_phone || "") +
          "</td>" +
          '<td class="px-4 py-3">' +
          escapeHtml(r.shipping_city || "") +
          "</td>" +
          '<td class="px-4 py-3 text-right font-semibold">' +
          fmtIQD(r.total) +
          "</td>" +
          '<td class="px-4 py-3 text-sm text-slate-500">' +
          escapeHtml(when) +
          "</td>" +
          '<td class="px-4 py-3">' +
          '<div class="flex flex-wrap gap-2">' +
          '<button data-act="print" data-id="' + escapeHtml(r.id) + '" class="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold">Print</button>' +
          statusSelectHtml(r.id, st) +
          "</div>" +
          "</td>";
        tbody.appendChild(tr);
      });
      if (!(res.data || []).length) {
        var empty = document.createElement("tr");
        empty.innerHTML =
          '<td class="px-4 py-8 text-center text-slate-500" colspan="8">No orders yet.</td>';
        tbody.appendChild(empty);
      }
    }

    load();
    var refresh = document.getElementById("bb-admin-orders-refresh");
    if (refresh) refresh.addEventListener("click", load);

    document.addEventListener("click", async function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button[data-act]") : null;
      if (!btn) return;
      var id = btn.getAttribute("data-id");
      var act = btn.getAttribute("data-act");
      if (!id || !act) return;
      if (msg) msg.textContent = "";
      btn.disabled = true;
      try {
        if (act === "print") {
          var payload = await fetchOrderForPrint(sb, id);
          printInPlace(payload);
          return;
        }
        // status changes are handled by the select (change event)
      } catch (err) {
        if (msg) msg.textContent = err.message || String(err);
      } finally {
        btn.disabled = false;
      }
    });

    document.addEventListener("change", async function (e) {
      var sel =
        e.target && e.target.closest
          ? e.target.closest('select[data-act="set_status"]')
          : null;
      if (!sel) return;
      var id = sel.getAttribute("data-id");
      var cur = (sel.getAttribute("data-cur") || "pending").toLowerCase();
      var next = (sel.value || "").toLowerCase();
      if (!id || !next) return;

      // Forward-only: prevent selecting previous statuses
      var STATUS_ORDER = ["pending", "confirmed", "delivering", "completed", "cancelled"];
      var iCur = STATUS_ORDER.indexOf(cur);
      var iNext = STATUS_ORDER.indexOf(next);
      if (iCur < 0) iCur = 0;
      if (iNext < 0) iNext = 0;
      if (iNext < iCur) {
        sel.value = cur;
        return;
      }
      if (cur === "completed" || cur === "cancelled") {
        sel.value = cur;
        return;
      }
      if (cur === "completed" && next !== "completed") {
        sel.value = cur;
        return;
      }
      if (cur === "delivering" && next === "confirmed") {
        sel.value = cur;
        return;
      }

      if (msg) msg.textContent = "";
      sel.disabled = true;
      try {
        if (next === "cancelled") {
          var rr = await sb.rpc("revert_order_inventory", { p_order_id: id });
          if (rr.error) throw rr.error;
        } else if (next === "confirmed") {
          var rr2 = await sb.rpc("apply_order_inventory", { p_order_id: id });
          if (rr2.error) throw rr2.error;
          var ur2 = await sb
            .from("orders")
            .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
            .eq("id", id);
          if (ur2.error) {
            if ((ur2.error.message || "").toLowerCase().indexOf("confirmed_at") !== -1) {
              var ur3 = await sb.from("orders").update({ status: "confirmed" }).eq("id", id);
              if (ur3.error) throw ur3.error;
            } else {
              throw ur2.error;
            }
          }
        } else {
          var ur = await sb.from("orders").update({ status: next }).eq("id", id);
          if (ur.error) throw ur.error;
        }
        await load();
      } catch (err) {
        sel.value = cur;
        if (msg) msg.textContent = err.message || String(err);
      } finally {
        sel.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
