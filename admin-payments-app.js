// Admin payments: edit app_settings keys for payment methods
(function () {
  function setMsg(t) {
    var el = document.getElementById("bb-payments-msg");
    if (el) el.textContent = t || "";
  }

  async function load() {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();

    var keys = ["payment_zain_phone", "payment_zain_qr_url", "payment_card_transfer_code"];
    var r = await sb.from("app_settings").select("key,value").in("key", keys);
    if (r.error) throw r.error;
    var map = {};
    (r.data || []).forEach(function (row) {
      map[row.key] = row.value || "";
    });

    var zPhone = document.getElementById("bb-zain-phone");
    var zQr = document.getElementById("bb-zain-qr");
    var cCode = document.getElementById("bb-card-code");
    if (zPhone) zPhone.value = map.payment_zain_phone || "";
    if (zQr) zQr.value = map.payment_zain_qr_url || "";
    if (cCode) cCode.value = map.payment_card_transfer_code || "";
  }

  async function save() {
    setMsg("");
    await window.BB.requireAdmin();
    var sb = await window.BB.getSupabase();

    var zPhone = (document.getElementById("bb-zain-phone")?.value || "").trim();
    var zQr = (document.getElementById("bb-zain-qr")?.value || "").trim();
    var cCode = (document.getElementById("bb-card-code")?.value || "").trim();

    var rows = [
      { key: "payment_zain_phone", value: zPhone },
      { key: "payment_zain_qr_url", value: zQr },
      { key: "payment_card_transfer_code", value: cCode },
    ];

    for (var i = 0; i < rows.length; i++) {
      var u = await sb
        .from("app_settings")
        .upsert({ key: rows[i].key, value: rows[i].value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (u.error) throw u.error;
    }

    setMsg("Saved.");
  }

  function bind() {
    var saveBtn = document.getElementById("bb-payments-save");
    if (saveBtn) saveBtn.addEventListener("click", function () { save().catch(function (e) { setMsg(e.message || String(e)); }); });

    var reloadBtn = document.getElementById("bb-payments-reload");
    if (reloadBtn) reloadBtn.addEventListener("click", function () { load().catch(function (e) { setMsg(e.message || String(e)); }); });

    var logout = document.getElementById("bb-logout");
    if (logout) {
      logout.addEventListener("click", function () {
        if (window.BB && window.BB.adminLogout) window.BB.adminLogout();
        location.href = "admin-login.html?return=admin-payments.html";
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

