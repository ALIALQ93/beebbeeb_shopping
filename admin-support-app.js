// Admin: list and close password reset requests.
(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>\"']/g, function (c) {
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

  async function boot() {
    if (!window.BB || !window.BB.requireAdmin) return;
    var ok = await window.BB.requireAdmin();
    if (!ok) return;
    var sb = await window.BB.getSupabase();

    var tbody = document.getElementById("bb-support-rows");
    var msg = document.getElementById("bb-support-msg");
    function setMsg(t) {
      if (msg) msg.textContent = t || "";
    }

    async function load() {
      setMsg("");
      var res = await sb
        .from("password_reset_requests")
        .select("id,full_name,phone,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (res.error) {
        setMsg(res.error.message);
        return;
      }
      tbody.innerHTML = "";
      (res.data || []).forEach(function (r) {
        var tr = document.createElement("tr");
        tr.className = "border-b border-teal-50";
        var when = r.created_at
          ? new Date(r.created_at).toLocaleString("ar-IQ")
          : "—";
        var isOpen = String(r.status || "") === "open";
        tr.innerHTML =
          '<td class="px-4 py-3">' +
          escapeHtml(r.full_name || "") +
          "</td>" +
          '<td class="px-4 py-3 font-mono" dir="ltr">' +
          escapeHtml(r.phone || "") +
          "</td>" +
          '<td class="px-4 py-3">' +
          escapeHtml(r.status || "") +
          "</td>" +
          '<td class="px-4 py-3 text-slate-500">' +
          escapeHtml(when) +
          "</td>" +
          '<td class="px-4 py-3">' +
          (isOpen
            ? '<button data-bb-close="' +
              r.id +
              '" class="px-3 py-1.5 rounded-full bg-teal-700 text-white font-bold text-xs hover:opacity-90">تمت المعالجة</button>'
            : '<span class="text-slate-400 text-xs">—</span>') +
          "</td>";
        tbody.appendChild(tr);
      });

      if (!(res.data || []).length) {
        var empty = document.createElement("tr");
        empty.innerHTML =
          '<td class="px-4 py-10 text-center text-slate-500" colspan="5">لا توجد طلبات.</td>';
        tbody.appendChild(empty);
      }
    }

    document.addEventListener("click", async function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest("button");
      if (!btn) return;
      var id = btn.getAttribute("data-bb-close");
      if (!id) return;
      var upd = await sb
        .from("password_reset_requests")
        .update({ status: "closed", handled_at: new Date().toISOString() })
        .eq("id", Number(id));
      if (upd.error) {
        setMsg(upd.error.message);
        return;
      }
      load();
    });

    var refresh = document.getElementById("bb-support-refresh");
    if (refresh) refresh.addEventListener("click", load);

    load();
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function () {});
  });
})();

