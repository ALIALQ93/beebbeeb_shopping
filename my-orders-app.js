// Customer: list own orders via RPC + custom session token.
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
    if (!window.BB || !window.BB.getSupabase) return;
    var sb = await window.BB.getSupabase();
    var tok = "";
    try {
      tok = localStorage.getItem("bb_customer_token") || "";
    } catch (e0) {}
    if (!tok) return;

    // Customer session pill
    try {
      if (window.BB && window.BB.getCustomer) {
        var me0 = await window.BB.getCustomer();
        var pill = document.getElementById("bb-customer-pill");
        var logoutBtn = document.getElementById("bb-customer-logout");
        if (me0 && me0.full_name) {
          if (pill) {
            pill.textContent = me0.full_name;
            pill.href = "my-orders.html";
          }
          if (logoutBtn) logoutBtn.classList.remove("hidden");
        }
        if (logoutBtn) {
          logoutBtn.addEventListener("click", function () {
            if (window.BB && window.BB.customerLogout) window.BB.customerLogout();
            location.href = "home.html";
          });
        }
      }
    } catch (e0) {}

    var tbody = document.getElementById("bb-my-order-rows");
    var msg = document.getElementById("bb-my-orders-msg");
    if (!tbody) return;

    if (msg) msg.textContent = "";
    var res = await sb.rpc("customer_list_orders", { p_token: tok });

    if (res.error) {
      if (msg) msg.textContent = res.error.message;
      return;
    }

    tbody.innerHTML = "";
    (res.data || []).forEach(function (r) {
      var tr = document.createElement("tr");
      tr.className = "border-b border-teal-50";
      var when = r.created_at
        ? new Date(r.created_at).toLocaleString("ar-IQ")
        : "—";
      tr.innerHTML =
        '<td class="px-4 py-3 font-mono text-sm">' +
        escapeHtml(String(r.id)) +
        "</td>" +
        '<td class="px-4 py-3">' +
        escapeHtml(r.status || "") +
        "</td>" +
        '<td class="px-4 py-3">' +
        escapeHtml(r.shipping_name || "") +
        "</td>" +
        '<td class="px-4 py-3 text-right font-semibold">' +
        fmtIQD(r.total) +
        "</td>" +
        '<td class="px-4 py-3 text-sm text-slate-500">' +
        escapeHtml(when) +
        "</td>";
      tbody.appendChild(tr);
    });

    if (!(res.data || []).length) {
      var empty = document.createElement("tr");
      empty.innerHTML =
        '<td class="px-4 py-8 text-center text-slate-500" colspan="5">لا توجد طلبات بعد. <a class="text-teal-600 underline font-bold" href="home.html">تسوق الآن</a></td>';
      tbody.appendChild(empty);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
