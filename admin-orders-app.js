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
      (res.data || []).forEach(function (r) {
        var tr = document.createElement("tr");
        tr.className = "border-b border-slate-100";
        var when = r.created_at
          ? new Date(r.created_at).toLocaleString()
          : "—";
        var st = (r.status || "").toLowerCase();
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
          '<button data-act="complete" data-id="' + escapeHtml(r.id) + '" class="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold">Complete</button>' +
          '<button data-act="cancel" data-id="' + escapeHtml(r.id) + '" class="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold">Cancel</button>' +
          '<button data-act="pending" data-id="' + escapeHtml(r.id) + '" class="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold">Pending</button>' +
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
        if (act === "cancel") {
          // Revert inventory (if applied) + set status cancelled (function sets status)
          var rr = await sb.rpc("revert_order_inventory", { p_order_id: id });
          if (rr.error) throw rr.error;
        } else {
          // update status only
          var nextStatus = act === "complete" ? "completed" : "pending";
          var ur = await sb.from("orders").update({ status: nextStatus }).eq("id", id);
          if (ur.error) throw ur.error;
        }
        await load();
      } catch (err) {
        if (msg) msg.textContent = err.message || String(err);
      } finally {
        btn.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
