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

  function statusLabel(status) {
    if (String(status) === "open") return "مفتوح";
    if (String(status) === "closed") return "مغلق";
    return String(status || "—");
  }

  function statusClass(status) {
    if (String(status) === "open") return "bg-amber-100 text-amber-900";
    if (String(status) === "closed") return "bg-slate-100 text-slate-600";
    return "bg-slate-100 text-slate-600";
  }

  function waUrl(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    return "https://wa.me/" + digits;
  }

  async function boot() {
    if (!window.BB || !window.BB.requireAdmin) return;
    var ok = await window.BB.requireAdmin("admin-support.html");
    if (!ok) return;
    var sb = await window.BB.getSupabase();

    var tbody = document.getElementById("bb-support-rows");
    var msg = document.getElementById("bb-support-msg");
    var filter = "open";

    function setMsg(t, isError) {
      if (!msg) return;
      msg.textContent = t || "";
      msg.className = isError === false
        ? "text-sm text-teal-700 mb-3"
        : "text-sm text-red-600 mb-3";
    }

    function setFilter(next) {
      filter = next || "all";
      Array.from(document.querySelectorAll("[data-bb-support-filter]")).forEach(function (btn) {
        var active = btn.getAttribute("data-bb-support-filter") === filter;
        btn.className = active
          ? "px-4 py-2 rounded-full bg-teal-700 text-white font-bold text-sm"
          : "px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm text-slate-700";
      });
    }

    async function load() {
      if (!tbody) {
        setMsg("تعذر تحميل الجدول: عنصر القائمة غير موجود.");
        return;
      }
      setMsg("");
      var q = sb
        .from("password_reset_requests")
        .select("id,full_name,phone,note,status,created_at,handled_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter === "open" || filter === "closed") {
        q = q.eq("status", filter);
      }
      var res = await q;
      if (res.error) {
        setMsg(res.error.message);
        return;
      }

      tbody.innerHTML = "";
      var rows = res.data || [];
      rows.forEach(function (r) {
        var tr = document.createElement("tr");
        tr.className = "border-b border-teal-50";
        var when = r.created_at
          ? new Date(r.created_at).toLocaleString("ar-IQ")
          : "—";
        var isOpen = String(r.status || "") === "open";
        var phone = r.phone || "";
        var wa = waUrl(phone);
        var note = String(r.note || "").trim();
        tr.innerHTML =
          '<td class="px-4 py-3">' +
          '<div class="font-bold">' +
          escapeHtml(r.full_name || "") +
          "</div>" +
          (note
            ? '<div class="text-xs text-slate-500 mt-1">' + escapeHtml(note) + "</div>"
            : "") +
          "</td>" +
          '<td class="px-4 py-3 font-mono" dir="ltr">' +
          escapeHtml(phone) +
          (wa
            ? ' <a href="' +
              escapeHtml(wa) +
              '" target="_blank" rel="noopener" class="inline-block ms-2 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold">واتساب</a>'
            : "") +
          "</td>" +
          '<td class="px-4 py-3">' +
          '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-bold ' +
          statusClass(r.status) +
          '">' +
          escapeHtml(statusLabel(r.status)) +
          "</span>" +
          "</td>" +
          '<td class="px-4 py-3 text-slate-500">' +
          escapeHtml(when) +
          (r.handled_at
            ? '<div class="text-[11px] text-slate-400 mt-1">أُغلق: ' +
              escapeHtml(new Date(r.handled_at).toLocaleString("ar-IQ")) +
              "</div>"
            : "") +
          "</td>" +
          '<td class="px-4 py-3">' +
          (isOpen
            ? '<button data-bb-close="' +
              escapeHtml(String(r.id)) +
              '" class="px-3 py-1.5 rounded-full bg-teal-700 text-white font-bold text-xs hover:opacity-90">تمت المعالجة</button>'
            : '<span class="text-slate-400 text-xs">—</span>') +
          "</td>";
        tbody.appendChild(tr);
      });

      if (!rows.length) {
        var empty = document.createElement("tr");
        var emptyMsg =
          filter === "open"
            ? "لا توجد طلبات مفتوحة."
            : filter === "closed"
              ? "لا توجد طلبات مغلقة."
              : "لا توجد طلبات.";
        empty.innerHTML =
          '<td class="px-4 py-10 text-center text-slate-500" colspan="5">' +
          escapeHtml(emptyMsg) +
          "</td>";
        tbody.appendChild(empty);
      }
    }

    document.addEventListener("click", async function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var filterBtn = t.closest("[data-bb-support-filter]");
      if (filterBtn) {
        setFilter(filterBtn.getAttribute("data-bb-support-filter"));
        load();
        return;
      }

      var btn = t.closest("button");
      if (!btn) return;
      var id = btn.getAttribute("data-bb-close");
      if (!id) return;

      btn.disabled = true;
      var adminId = null;
      try {
        var u = await sb.auth.getUser();
        adminId = u && u.data && u.data.user ? u.data.user.id : null;
      } catch (e0) {}

      var payload = {
        status: "closed",
        handled_at: new Date().toISOString(),
      };
      if (adminId) payload.handled_by = adminId;

      var upd = await sb
        .from("password_reset_requests")
        .update(payload)
        .eq("id", id);
      btn.disabled = false;
      if (upd.error) {
        setMsg(upd.error.message);
        return;
      }
      setMsg("تم إغلاق الطلب.", false);
      load();
    });

    var refresh = document.getElementById("bb-support-refresh");
    if (refresh) refresh.addEventListener("click", load);

    setFilter("open");
    load();
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (e) {
      console.warn(e);
      var msg = document.getElementById("bb-support-msg");
      if (msg) msg.textContent = "تعذر تحميل صفحة الدعم.";
    });
  });
})();
