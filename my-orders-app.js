// Customer: list own orders (RLS should allow user_id = auth.uid()).
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
    var u = await sb.auth.getUser();
    if (!u.data || !u.data.user) return;

    var tbody = document.getElementById("bb-my-order-rows");
    var msg = document.getElementById("bb-my-orders-msg");
    if (!tbody) return;

    if (msg) msg.textContent = "";
    var res = await sb
      .from("orders")
      .select("id,status,total,shipping_name,created_at")
      .eq("user_id", u.data.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (res.error) {
      res = await sb
        .from("orders")
        .select("id,status,total,shipping_name")
        .eq("user_id", u.data.user.id)
        .order("id", { ascending: false })
        .limit(50);
    }

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
        "</td>" +
        '<td class="px-4 py-3"><a class="text-teal-600 font-bold underline" href="tracking.html">تتبع</a></td>';
      tbody.appendChild(tr);
    });

    if (!(res.data || []).length) {
      var empty = document.createElement("tr");
      empty.innerHTML =
        '<td class="px-4 py-8 text-center text-slate-500" colspan="6">لا توجد طلبات بعد. <a class="text-teal-600 underline font-bold" href="home.html">تسوق الآن</a></td>';
      tbody.appendChild(empty);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
