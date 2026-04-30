// Admin: sales summaries by day.
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function setMsg(t) {
    var el = $("bb-sales-msg");
    if (el) el.textContent = t || "";
  }

  function fmtIQD(n) {
    try {
      return new Intl.NumberFormat("en-US").format(Number(n || 0)) + " IQD";
    } catch {
      return String(n || 0) + " IQD";
    }
  }

  function toDateInputValue(d) {
    var pad = function (x) {
      return String(x).padStart(2, "0");
    };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function ymdFromTs(ts) {
    try {
      var d = new Date(ts);
      return toDateInputValue(d);
    } catch {
      return "";
    }
  }

  async function boot() {
    if (!window.BB || !window.BB.requireAdmin) return;
    var ok = await window.BB.requireAdmin();
    if (!ok) return;
    var sb = await window.BB.getSupabase();

    var fromEl = $("bb-sales-from");
    var toEl = $("bb-sales-to");
    var rowsPending = $("bb-sales-rows-pending");
    var rowsConfirmed = $("bb-sales-rows-confirmed");
    var rowsDelivering = $("bb-sales-rows-delivering");
    var rowsCompleted = $("bb-sales-rows-completed");
    var rowsCancelled = $("bb-sales-rows-cancelled");

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

    function normStatus(s) {
      var st0 = String(s || "pending").toLowerCase();
      if (st0 === "done") return "completed";
      if (st0 === "canceled") return "cancelled";
      return st0 || "pending";
    }

    function renderTable(rowsEl, countElId, list) {
      if (!rowsEl) return;
      var countEl = $(countElId);
      if (countEl) countEl.textContent = (list || []).length ? (list.length + " orders") : "0";
      if (!list || !list.length) {
        rowsEl.innerHTML =
          '<tr><td class="px-4 py-6 text-center text-slate-500" colspan="5">No orders.</td></tr>';
        return;
      }
      rowsEl.innerHTML = list
        .map(function (o) {
          var when = o.created_at ? new Date(o.created_at).toLocaleString() : "—";
          return (
            '<tr class="border-b border-slate-100">' +
            '<td class="px-4 py-3 font-mono text-xs">' +
            escapeHtml(String(o.id || "").slice(0, 8)) +
            "…</td>" +
            '<td class="px-4 py-3">' +
            escapeHtml(o.shipping_name || "") +
            "</td>" +
            '<td class="px-4 py-3">' +
            escapeHtml(o.shipping_city || "") +
            "</td>" +
            '<td class="px-4 py-3 text-right font-semibold">' +
            fmtIQD(o.total) +
            "</td>" +
            '<td class="px-4 py-3 text-xs text-slate-500">' +
            escapeHtml(when) +
            "</td>" +
            "</tr>"
          );
        })
        .join("");
    }

    // defaults: last 30 days
    var today = new Date();
    var from = new Date();
    from.setDate(today.getDate() - 30);
    if (fromEl && !fromEl.value) fromEl.value = toDateInputValue(from);
    if (toEl && !toEl.value) toEl.value = toDateInputValue(today);

    async function load() {
      setMsg("");
      if (!rowsPending || !rowsConfirmed || !rowsDelivering || !rowsCompleted || !rowsCancelled) return;

      var fromVal = fromEl && fromEl.value ? fromEl.value : "";
      var toVal = toEl && toEl.value ? toEl.value : "";
      if (!fromVal || !toVal) {
        setMsg("اختر تاريخ البداية والنهاية.");
        return;
      }

      // Query by created_at if available; otherwise fall back to id ordering (less accurate).
      var q = sb
        .from("orders")
        .select("id,status,total,created_at,shipping_name,shipping_city")
        .gte("created_at", fromVal + "T00:00:00Z")
        .lte("created_at", toVal + "T23:59:59Z")
        .order("created_at", { ascending: true })
        .limit(2000);

      var res = await q;
      if (res.error) {
        // fallback: try without created_at filters
        res = await sb
          .from("orders")
          .select("id,status,total,created_at,shipping_name,shipping_city")
          .order("id", { ascending: true })
          .limit(2000);
      }
      if (res.error) {
        setMsg(res.error.message);
        return;
      }

      var data = res.data || [];
      var buckets = {
        pending: [],
        confirmed: [],
        delivering: [],
        completed: [],
        cancelled: [],
      };
      var totals = { completed: 0, pending: 0, cancelled: 0, all: 0 };

      data.forEach(function (o) {
        var t = Number(o.total || 0);
        var st = normStatus(o.status);
        if (!buckets[st]) st = "pending";
        buckets[st].push(o);

        if (st === "completed") {
          totals.completed += t;
        } else if (st === "cancelled") {
          totals.cancelled += t;
        } else {
          // treat pending+confirmed+delivering as "pending" total card
          totals.pending += t;
        }
        totals.all += t;
      });

      $("bb-sales-total-completed").textContent = fmtIQD(totals.completed);
      $("bb-sales-total-pending").textContent = fmtIQD(totals.pending);
      $("bb-sales-total-cancelled").textContent = fmtIQD(totals.cancelled);
      $("bb-sales-total-all").textContent = fmtIQD(totals.all);

      // newest first in each table
      Object.keys(buckets).forEach(function (k) {
        buckets[k].sort(function (a, b) {
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
      });

      renderTable(rowsPending, "bb-sales-count-pending", buckets.pending);
      renderTable(rowsConfirmed, "bb-sales-count-confirmed", buckets.confirmed);
      renderTable(rowsDelivering, "bb-sales-count-delivering", buckets.delivering);
      renderTable(rowsCompleted, "bb-sales-count-completed", buckets.completed);
      renderTable(rowsCancelled, "bb-sales-count-cancelled", buckets.cancelled);
    }

    var refresh = $("bb-sales-refresh");
    if (refresh) refresh.addEventListener("click", load);

    var logout = $("bb-logout");
    if (logout) {
      logout.addEventListener("click", function () {
        if (window.BB && window.BB.logout) window.BB.logout();
      });
    }

    load();
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (e) {
      console.warn(e);
      setMsg("Unexpected error.");
    });
  });
})();

