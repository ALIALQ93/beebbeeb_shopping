// Admin offers: edit products.discount_percent
(function () {
  function fmtIQD(n) {
    try {
      return new Intl.NumberFormat("en-US").format(Number(n || 0));
    } catch {
      return String(n || 0);
    }
  }

  function setMsg(t) {
    var el = document.getElementById("bb-offers-msg");
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

  function row(p) {
    var price = Number(p.price_iqd || 0);
    var disc = Number(p.discount_percent || 0);
    var final = Math.round(price * (1 - Math.max(0, Math.min(100, disc)) / 100));
    return (
      '<tr class="border-t border-slate-100">' +
      '<td class="px-4 py-3">' +
      '<div class="font-bold">' +
      escapeHtml(p.title || "—") +
      "</div>" +
      '<div class="text-xs text-slate-500">' +
      escapeHtml(p.id) +
      "</div>" +
      "</td>" +
      '<td class="px-4 py-3 text-right font-semibold">' +
      fmtIQD(price) +
      "</td>" +
      '<td class="px-4 py-3 text-right">' +
      '<input data-disc="' +
      escapeHtml(p.id) +
      '" type="number" min="0" max="100" class="w-24 px-2 py-1 rounded-md border border-slate-200 text-right" value="' +
      escapeHtml(String(disc || 0)) +
      '" />' +
      "</td>" +
      '<td class="px-4 py-3 text-right font-semibold">' +
      fmtIQD(final) +
      "</td>" +
      '<td class="px-4 py-3 text-right">' +
      '<button data-save="' +
      escapeHtml(p.id) +
      '" class="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-bold hover:opacity-90">Save</button>' +
      "</td>" +
      "</tr>"
    );
  }

  async function load() {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();

    var q = (document.getElementById("bb-offers-q")?.value || "").trim().toLowerCase();
    var r = await sb
      .from("products")
      .select("id,title,price_iqd,discount_percent")
      .order("created_at", { ascending: false })
      .limit(500);

    if (r.error) throw r.error;
    var rows = (r.data || []).filter(function (p) {
      if (!q) return true;
      return String(p.title || "").toLowerCase().indexOf(q) !== -1 || String(p.id || "").toLowerCase().indexOf(q) !== -1;
    });

    var host = document.getElementById("bb-offers-rows");
    if (host) host.innerHTML = rows.map(row).join("");
  }

  async function saveDiscount(productId) {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();

    var inp = document.querySelector('input[data-disc="' + CSS.escape(productId) + '"]');
    var disc = Number(inp ? inp.value : 0);
    if (!isFinite(disc) || disc < 0 || disc > 100) {
      setMsg("Discount must be between 0 and 100.");
      return;
    }

    var u = await sb.from("products").update({ discount_percent: disc }).eq("id", productId);
    if (u.error) throw u.error;
    await load();
  }

  function bind() {
    var refresh = document.getElementById("bb-offers-refresh");
    if (refresh) refresh.addEventListener("click", function () { load().catch(function (e) { setMsg(e.message || String(e)); }); });

    var q = document.getElementById("bb-offers-q");
    if (q) q.addEventListener("input", function () { load().catch(function () {}); });

    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;
      var id = btn.getAttribute("data-save");
      if (!id) return;
      saveDiscount(id).catch(function (err) {
        setMsg(err.message || String(err));
      });
    });

    var logout = document.getElementById("bb-logout");
    if (logout) {
      logout.addEventListener("click", function () {
        if (window.BB && window.BB.adminLogout) window.BB.adminLogout();
        location.href = "admin-login.html?return=admin-offers.html";
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

