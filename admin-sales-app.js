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
    var rowsEl = $("bb-sales-rows");

    // defaults: last 30 days
    var today = new Date();
    var from = new Date();
    from.setDate(today.getDate() - 30);
    if (fromEl && !fromEl.value) fromEl.value = toDateInputValue(from);
    if (toEl && !toEl.value) toEl.value = toDateInputValue(today);

    async function load() {
      setMsg("");
      if (!rowsEl) return;

      var fromVal = fromEl && fromEl.value ? fromEl.value : "";
      var toVal = toEl && toEl.value ? toEl.value : "";
      if (!fromVal || !toVal) {
        setMsg("اختر تاريخ البداية والنهاية.");
        return;
      }

      // Query by created_at if available; otherwise fall back to id ordering (less accurate).
      var q = sb
        .from("orders")
        .select("id,status,total,created_at")
        .gte("created_at", fromVal + "T00:00:00Z")
        .lte("created_at", toVal + "T23:59:59Z")
        .order("created_at", { ascending: true })
        .limit(2000);

      var res = await q;
      if (res.error) {
        // fallback: try without created_at filters
        res = await sb.from("orders").select("id,status,total,created_at").order("id", { ascending: true }).limit(2000);
      }
      if (res.error) {
        setMsg(res.error.message);
        return;
      }

      var data = res.data || [];
      var byDay = {}; // ymd -> {completed,pending,cancelled,total}
      var totals = { completed: 0, pending: 0, cancelled: 0, all: 0 };

      data.forEach(function (o) {
        var day = o.created_at ? ymdFromTs(o.created_at) : "unknown";
        byDay[day] = byDay[day] || { completed: 0, pending: 0, cancelled: 0, total: 0 };
        var t = Number(o.total || 0);
        var st = String(o.status || "pending").toLowerCase();
        if (st === "completed" || st === "done") {
          byDay[day].completed += t;
          totals.completed += t;
        } else if (st === "cancelled" || st === "canceled") {
          byDay[day].cancelled += t;
          totals.cancelled += t;
        } else {
          byDay[day].pending += t;
          totals.pending += t;
        }
        byDay[day].total += t;
        totals.all += t;
      });

      $("bb-sales-total-completed").textContent = fmtIQD(totals.completed);
      $("bb-sales-total-pending").textContent = fmtIQD(totals.pending);
      $("bb-sales-total-cancelled").textContent = fmtIQD(totals.cancelled);
      $("bb-sales-total-all").textContent = fmtIQD(totals.all);

      var days = Object.keys(byDay).sort();
      if (!days.length) {
        rowsEl.innerHTML =
          '<tr><td class="px-4 py-8 text-center text-slate-500" colspan="5">No data.</td></tr>';
        return;
      }

      rowsEl.innerHTML = days
        .map(function (d) {
          var r = byDay[d];
          return (
            "<tr class=\"border-b border-slate-100\">" +
            '<td class="px-4 py-3 font-mono text-xs">' +
            d +
            "</td>" +
            '<td class="px-4 py-3 text-right font-semibold">' +
            fmtIQD(r.completed) +
            "</td>" +
            '<td class="px-4 py-3 text-right font-semibold">' +
            fmtIQD(r.pending) +
            "</td>" +
            '<td class="px-4 py-3 text-right font-semibold">' +
            fmtIQD(r.cancelled) +
            "</td>" +
            '<td class="px-4 py-3 text-right font-black">' +
            fmtIQD(r.total) +
            "</td>" +
            "</tr>"
          );
        })
        .join("");
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

