// Admin shipping: manage public.shipping_rates
(function () {
  function setMsg(t) {
    var el = document.getElementById("bb-ship-msg");
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

  function fmtIQD(n) {
    try {
      return new Intl.NumberFormat("en-US").format(Number(n || 0));
    } catch {
      return String(n || 0);
    }
  }

  async function load() {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();
    var r = await sb.from("shipping_rates").select("city,fee_iqd").order("city", { ascending: true }).limit(1000);
    if (r.error) throw r.error;
    var host = document.getElementById("bb-ship-rows");
    if (!host) return;
    host.innerHTML = (r.data || [])
      .map(function (row) {
        return (
          '<tr class="border-t border-slate-100">' +
          '<td class="px-4 py-3 font-bold">' +
          escapeHtml(row.city) +
          "</td>" +
          '<td class="px-4 py-3 text-right font-semibold">' +
          fmtIQD(row.fee_iqd) +
          "</td>" +
          '<td class="px-4 py-3 text-right">' +
          '<button data-del="' +
          escapeHtml(row.city) +
          '" class="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-bold hover:bg-slate-50">Delete</button>' +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  async function save() {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();
    var city = (document.getElementById("bb-ship-city")?.value || "").trim();
    var fee = Number(document.getElementById("bb-ship-fee")?.value || "0");
    if (!city) {
      setMsg("City is required.");
      return;
    }
    if (!isFinite(fee) || fee < 0) {
      setMsg("Fee must be >= 0.");
      return;
    }
    var u = await sb.from("shipping_rates").upsert({ city: city, fee_iqd: Math.round(fee), updated_at: new Date().toISOString() });
    if (u.error) throw u.error;
    await load();
  }

  async function del(city) {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();
    var ok = confirm("Delete shipping rate for: " + city + " ?");
    if (!ok) return;
    var d = await sb.from("shipping_rates").delete().eq("city", city);
    if (d.error) throw d.error;
    await load();
  }

  function bind() {
    // Populate city list from cities.js (same as checkout)
    try {
      var sel = document.getElementById("bb-ship-city");
      if (sel && sel.options && sel.options.length === 0) {
        var list = (window.BB_CITIES || []).slice();
        sel.innerHTML =
          '<option value="">اختر المحافظة/المدينة...</option>' +
          list
            .map(function (c) {
              return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>";
            })
            .join("");
      }
    } catch (e) {}

    var refresh = document.getElementById("bb-ship-refresh");
    if (refresh) refresh.addEventListener("click", function () { load().catch(function (e) { setMsg(e.message || String(e)); }); });
    var saveBtn = document.getElementById("bb-ship-save");
    if (saveBtn) saveBtn.addEventListener("click", function () { save().catch(function (e) { setMsg(e.message || String(e)); }); });
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button[data-del]") : null;
      if (!btn) return;
      var c = btn.getAttribute("data-del") || "";
      if (!c) return;
      del(c).catch(function (err) {
        setMsg(err.message || String(err));
      });
    });

    var logout = document.getElementById("bb-logout");
    if (logout) {
      logout.addEventListener("click", function () {
        if (window.BB && window.BB.adminLogout) window.BB.adminLogout();
        location.href = "admin-login.html?return=admin-shipping.html";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.BB) return;
    bind();
    load().catch(function (e) {
      setMsg(e.message || String(e));
    });
  });
})();

