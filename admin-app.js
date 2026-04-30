// Minimal Admin CRUD for products (requires profiles.is_admin = true).
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

  async function boot() {
    if (!window.BB || !window.BB.requireAdmin) return;
    var ok = await window.BB.requireAdmin("admin.html");
    if (!ok) return;
    var sb = await window.BB.getSupabase();
    var BUCKET = "product-images";
    var SETTINGS_KEY = "usd_iqd_rate";

    var COLORS = [
      { v: "Mint", hex: "#86D2C1" },
      { v: "Pink", hex: "#FFD1DC" },
      { v: "Cream", hex: "#FFF4E0" },
      { v: "Sky", hex: "#BDDEFE" },
      { v: "Beige", hex: "#E8E1E1" },
      { v: "Navy", hex: "#294964" },
      { v: "Black", hex: "#111111" },
      { v: "White", hex: "#FFFFFF" },
      { v: "Red", hex: "#EF4444" },
      { v: "Blue", hex: "#3B82F6" },
      { v: "Green", hex: "#22C55E" },
      { v: "Yellow", hex: "#FACC15" },
      { v: "Orange", hex: "#F97316" },
      { v: "Purple", hex: "#A855F7" },
      { v: "Gray", hex: "#9CA3AF" },
      { v: "Brown", hex: "#92400E" },
    ];
    var AGE_RANGES = ["0-3M", "3-6M", "6-12M", "12-18M", "18-24M", "2-3Y", "3-4Y", "4-5Y", "5-6Y", "6-7Y", "7-8Y", "8-12Y"];

    function clampInt(n, min, max) {
      var x = parseInt(String(n || "0"), 10);
      if (!Number.isFinite(x)) x = 0;
      if (typeof min === "number") x = Math.max(min, x);
      if (typeof max === "number") x = Math.min(max, x);
      return x;
    }

    function fmtUSDFromIQD(iqd, rate) {
      var r = Number(rate || 0);
      if (!Number.isFinite(r) || r <= 0) return "";
      var usd = Number(iqd || 0) / r;
      if (!Number.isFinite(usd)) return "";
      return "$" + usd.toFixed(2);
    }

    var mount =
      document.getElementById("bb-admin-products") || document.body;
    var host = document.createElement("div");
    host.style.cssText = "max-width:1100px;margin:0 auto;padding:0 0 12px;";
    host.innerHTML =
      "<style>" +
      "@media (max-width: 980px) {" +
      "  #bbProdForm{grid-template-columns:1fr 1fr !important;}" +
      "  #bbProdForm textarea,#bbProdForm input[id='bb-prod-image'],#bbProdForm input[id='bb-prod-file']{grid-column:1 / span 2 !important;}" +
      "}" +
      "@media (max-width: 640px) {" +
      "  #bb-prod-modal{padding:10px !important; align-items:stretch !important;}" +
      "  #bb-prod-modal > div{max-width:100% !important;}" +
      "  #bbProdForm{grid-template-columns:1fr !important;}" +
      "  #bbProdForm textarea,#bbProdForm input[id='bb-prod-image'],#bbProdForm input[id='bb-prod-file']{grid-column:1 / span 1 !important;}" +
      "  #bb-prod-modal-body{max-height:calc(100vh - 90px) !important; overflow:auto !important;}" +
      "}" +
      "</style>" +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">' +
      '<h2 style="font-weight:900;margin:0">المنتجات</h2>' +
      '<div style="display:flex;gap:10px;align-items:center">' +
      '<button id="bb-open-new-product" type="button" style="background:#42617d;color:#fff;border:0;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer">إضافة منتج</button>' +
      '<button data-bb-logout style="background:#146a5c;color:#fff;border:0;border-radius:10px;padding:10px 12px;font-weight:800;cursor:pointer">Logout</button>' +
      "</div>" +
      "</div>" +
      '<div style="background:#fff;border:1px solid #e8e1e1;border-radius:14px;padding:12px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
      '<div style="font-weight:800">سعر الصرف</div>' +
      '<div style="color:#3f4946;font-size:12px">IQD لكل 1 USD</div>' +
      '<input id="bb-usd-rate" type="number" min="1" step="1" style="padding:10px 12px;border:1px solid #bec9c5;border-radius:10px;width:160px" placeholder="مثال: 1300" dir="ltr">' +
      '<button id="bb-usd-save" type="button" style="background:#146a5c;color:#fff;border:0;border-radius:10px;padding:10px 12px;font-weight:800;cursor:pointer">حفظ</button>' +
      '<span id="bb-usd-msg" style="font-size:12px;color:#3f4946"></span>' +
      "</div>" +
      '<div id="bbAdminMsg" style="margin:6px 0 10px;font-size:13px;color:#ba1a1a;min-height:18px"></div>' +
      '<div style="background:#fff;border:1px solid #e8e1e1;border-radius:14px;overflow:auto">' +
      '<table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="background:#f3ecec">' +
      '<th style="text-align:left;padding:10px">Image</th>' +
      '<th style="text-align:left;padding:10px">Title</th>' +
      '<th style="text-align:right;padding:10px">IQD</th>' +
      '<th style="text-align:right;padding:10px">USD</th>' +
      '<th style="text-align:right;padding:10px">Stock</th>' +
      '<th style="text-align:right;padding:10px">Colors</th>' +
      '<th style="text-align:right;padding:10px">Active</th>' +
      '<th style="text-align:right;padding:10px">Actions</th>' +
      '</tr></thead><tbody id="bbProdRows"></tbody></table></div>' +
      // Modal
      '<div id="bb-prod-modal" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:99999;padding:16px">' +
      '<div style="width:100%;max-width:920px;background:#fff;border-radius:16px;border:1px solid #e8e1e1;overflow:hidden">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:#f9f2f2">' +
      '<div style="font-weight:900" id="bb-modal-title">إضافة منتج</div>' +
      '<button id="bb-modal-close" type="button" style="background:#eee;border:0;border-radius:10px;padding:8px 10px;font-weight:900;cursor:pointer">✕</button>' +
      "</div>" +
      '<div id="bb-prod-modal-body" style="padding:12px 14px;max-height:calc(100vh - 140px);overflow:auto">' +
      '<form id="bbProdForm" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px;align-items:start">' +
      '<input id="bb-prod-title" name="title" placeholder="العنوان" style="padding:10px 12px;border:1px solid #bec9c5;border-radius:10px" required>' +
      '<input id="bb-prod-title-en" name="title_en" placeholder="English name (اختياري)" style="padding:10px 12px;border:1px solid #bec9c5;border-radius:10px" dir="ltr">' +
      '<input id="bb-prod-price" name="price_iqd" placeholder="السعر (IQD)" type="number" style="padding:10px 12px;border:1px solid #bec9c5;border-radius:10px" required>' +
      '<input id="bb-prod-stock" name="stock" placeholder="المخزون (محسوب من الألوان)" type="number" style="padding:10px 12px;border:1px solid #bec9c5;border-radius:10px;background:#f3ecec" value="0" readonly>' +
      '<input id="bb-prod-discount" name="discount_percent" placeholder="خصم % (اختياري)" type="number" min="0" max="90" style="padding:10px 12px;border:1px solid #bec9c5;border-radius:10px" value="0">' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
      '<button id="bb-edit-cancel" type="button" style="background:#eee;color:#111;border:0;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer;display:none">إلغاء</button>' +
      '<button id="bb-prod-submit" type="submit" style="background:#42617d;color:#fff;border:0;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer">إضافة</button>' +
      "</div>" +
      '<textarea id="bb-prod-desc" name="description" placeholder="وصف مختصر (اختياري)" rows="2" style="grid-column:1 / span 4;padding:10px 12px;border:1px solid #bec9c5;border-radius:10px"></textarea>' +
      '<input id="bb-prod-image" name="image_url" placeholder="رابط صورة (اختياري)" style="grid-column:1 / span 4;padding:10px 12px;border:1px solid #bec9c5;border-radius:10px" dir="ltr">' +
      '<input id="bb-prod-file" name="image_file" type="file" accept="image/*" style="grid-column:1 / span 4;padding:10px 12px;border:1px dashed #bec9c5;border-radius:10px;background:#fafafa">' +
      '<div style="grid-column:1 / span 4;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:2px">' +
      '<div style="border:1px solid #e8e1e1;border-radius:12px;padding:10px">' +
      '<div style="font-weight:900;margin-bottom:8px">الألوان</div>' +
      '<div id="bb-colors" style="display:flex;flex-wrap:wrap;gap:8px"></div>' +
      "</div>" +
      '<div style="border:1px solid #e8e1e1;border-radius:12px;padding:10px">' +
      '<div style="font-weight:900;margin-bottom:8px">الأعمار/المقاسات</div>' +
      '<div id="bb-ages" style="display:flex;flex-wrap:wrap;gap:8px;max-height:160px;overflow:auto"></div>' +
      "</div>" +
      "</div>" +
      "</form>" +
      "</div>" +
      "</div>" +
      "</div>";

    mount.appendChild(host);

    function renderOptions() {
      var cHost = document.getElementById("bb-colors");
      if (cHost) {
        cHost.innerHTML = COLORS.map(function (c) {
          return (
            '<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid #bec9c5;border-radius:999px;cursor:pointer;background:#fff">' +
            '<input type="checkbox" name="colors" value="' +
            escapeHtml(c.v) +
            '"/>' +
            '<span style="width:14px;height:14px;border-radius:999px;background:' +
            escapeHtml(c.hex) +
            ';border:1px solid rgba(0,0,0,.12)"></span>' +
            "<span>" +
            escapeHtml(c.v) +
            "</span>" +
            "</label>"
          );
        }).join("");
      }

      var aHost = document.getElementById("bb-ages");
      if (aHost) {
        aHost.innerHTML = AGE_RANGES.map(function (a) {
          return (
            '<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid #bec9c5;border-radius:999px;cursor:pointer;background:#fff">' +
            '<input type="checkbox" name="age_ranges" value="' +
            escapeHtml(a) +
            '"/>' +
            "<span>" +
            escapeHtml(a) +
            "</span>" +
            "</label>"
          );
        }).join("");
      }
    }

    var msg = host.querySelector("#bbAdminMsg");
    function setMsg(t) {
      if (msg) msg.textContent = t || "";
    }

    renderOptions();

    var editId = null;
    var submitBtn = null;
    var usdRate = null;
    var origVariantStock = {}; // key: color||age -> stock (used in edit mode)

    function setEditMode(id) {
      editId = id || null;
      submitBtn = submitBtn || document.getElementById("bb-prod-submit");
      if (submitBtn) submitBtn.textContent = editId ? "حفظ التعديلات" : "إضافة";
      var cancel = document.getElementById("bb-edit-cancel");
      if (cancel) cancel.style.display = editId ? "inline-block" : "none";
      var title = document.getElementById("bb-modal-title");
      if (title) title.textContent = editId ? "تعديل المنتج" : "إضافة منتج";
    }

    function clearForm() {
      var formEl = host.querySelector("#bbProdForm");
      if (formEl) formEl.reset();
      // clear checkboxes
      Array.from(host.querySelectorAll('input[name="colors"], input[name="age_ranges"]')).forEach(function (x) {
        x.checked = false;
      });
      setEditMode(null);
    }

    function ensureCancelButton() {
      var btn = document.getElementById("bb-edit-cancel");
      if (!btn) return;
      btn.addEventListener("click", function () {
        clearForm();
        setMsg("");
        closeModal();
      });
    }

    ensureCancelButton();

    function modalEl() {
      return document.getElementById("bb-prod-modal");
    }

    function openModal() {
      var m = modalEl();
      if (m) m.style.display = "flex";
      try {
        var t = document.getElementById("bb-prod-title");
        if (t) t.focus();
      } catch (e) {}
    }

    function closeModal() {
      var m = modalEl();
      if (m) m.style.display = "none";
    }

    // Open create modal
    try {
      var openBtn = document.getElementById("bb-open-new-product");
      if (openBtn) {
        openBtn.addEventListener("click", function () {
          setMsg("");
          clearForm();
          openModal();
        });
      }
      var xBtn = document.getElementById("bb-modal-close");
      if (xBtn) xBtn.addEventListener("click", function () { closeModal(); });
      var m = modalEl();
      if (m) {
        m.addEventListener("click", function (e) {
          if (e.target === m) closeModal();
        });
      }
    } catch (e5) {}

    async function loadUsdRate() {
      try {
        var r = await sb.from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
        if (r.error) return;
        var el = document.getElementById("bb-usd-rate");
        if (r.data && r.data.value) {
          usdRate = Number(r.data.value);
          if (el) el.value = String(r.data.value);
        }
      } catch (e) {}
    }

    async function saveUsdRate() {
      var el = document.getElementById("bb-usd-rate");
      var out = document.getElementById("bb-usd-msg");
      if (!el) return;
      var n = parseInt(String(el.value || "0"), 10);
      if (!Number.isFinite(n) || n <= 0) {
        if (out) out.textContent = "رقم غير صحيح";
        return;
      }
      if (out) out.textContent = "جارِ الحفظ...";
      var res = await sb
        .from("app_settings")
        .upsert({ key: SETTINGS_KEY, value: String(n), updated_at: new Date().toISOString() });
      if (res.error) {
        if (out) out.textContent = res.error.message;
        return;
      }
      usdRate = Number(n);
      if (out) out.textContent = "تم الحفظ";
      // refresh table so USD column updates
      await load();
    }

    async function load() {
      setMsg("");
      var res = await sb
        .from("products")
        .select("id,title,image_url,price_iqd,discount_percent,stock,active,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (res.error) {
        // Fallback if created_at isn't available/selectable
        res = await sb
          .from("products")
          .select("id,title,image_url,price_iqd,discount_percent,stock,active")
          .order("id", { ascending: false })
          .limit(50);
      }
      if (res.error) {
        setMsg(res.error.message);
        return;
      }

      var products = res.data || [];
      // Fetch variant stock for these products
      var ids = products.map(function (p) { return p.id; }).filter(Boolean);
      var stockMap = {};
      if (ids.length) {
        var vs = await sb
          .from("product_variant_stock")
          .select("product_id,color,age_range,stock")
          .in("product_id", ids);
        if (!vs.error) {
          (vs.data || []).forEach(function (r) {
            stockMap[r.product_id] = stockMap[r.product_id] || {};
            stockMap[r.product_id][r.color] =
              Number(stockMap[r.product_id][r.color] || 0) + Number(r.stock || 0);
          });
        }
      }

      var tbody = host.querySelector("#bbProdRows");
      tbody.innerHTML = "";
      products.forEach(function (p) {
        var tr = document.createElement("tr");
        var dp = clampInt(p.discount_percent, 0, 90);
        var base = Number(p.price_iqd || 0);
        var finalIQD = dp > 0 ? Math.max(0, Math.round(base * (100 - dp) / 100)) : base;
        var usd = fmtUSDFromIQD(finalIQD, usdRate);
        var colorsObj = stockMap[p.id] || {};
        var colorsText = Object.keys(colorsObj).length
          ? Object.keys(colorsObj)
              .sort()
              .map(function (k) {
                return k + ":" + String(colorsObj[k] || 0);
              })
              .join("  ")
          : "—";
        tr.innerHTML =
          '<td style="padding:10px;border-top:1px solid #eee;width:60px">' +
          (p.image_url
            ? '<img alt="" src="' +
              escapeHtml(p.image_url) +
              '" style="width:44px;height:44px;object-fit:cover;border-radius:12px;border:1px solid rgba(0,0,0,.08)" />'
            : '<div style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:#f3ecec;display:flex;align-items:center;justify-content:center;font-size:11px;color:#6f7976">No</div>') +
          "</td>" +
          '<td style="padding:10px;border-top:1px solid #eee">' +
          escapeHtml(p.title || "") +
          "</td>" +
          '<td style="padding:10px;border-top:1px solid #eee;text-align:right">' +
          escapeHtml(String(finalIQD)) +
          "</td>" +
          '<td style="padding:10px;border-top:1px solid #eee;text-align:right;font-family:ui-monospace,Consolas,monospace" dir="ltr">' +
          escapeHtml(usd || "") +
          "</td>" +
          '<td style="padding:10px;border-top:1px solid #eee;text-align:right">' +
          (p.stock ?? "") +
          "</td>" +
          '<td style="padding:10px;border-top:1px solid #eee;text-align:right;font-family:ui-monospace,Consolas,monospace;white-space:nowrap">' +
          escapeHtml(colorsText) +
          "</td>" +
          '<td style="padding:10px;border-top:1px solid #eee;text-align:right">' +
          (p.active ? "true" : "false") +
          "</td>" +
          '<td style="padding:10px;border-top:1px solid #eee;text-align:right;white-space:nowrap">' +
          '<button data-act="edit" data-id="' +
          p.id +
          '" style="margin-left:8px;background:#42617d;color:#fff;border:0;border-radius:10px;padding:6px 10px;font-weight:800;cursor:pointer">Edit</button>' +
          '<button data-act="toggle" data-id="' +
          p.id +
          '" style="margin-left:8px;background:#146a5c;color:#fff;border:0;border-radius:10px;padding:6px 10px;font-weight:800;cursor:pointer">Toggle</button>' +
          '<button data-act="del" data-id="' +
          p.id +
          '" style="background:#ba1a1a;color:#fff;border:0;border-radius:10px;padding:6px 10px;font-weight:800;cursor:pointer">Delete</button>' +
          "</td>";
        tbody.appendChild(tr);
      });
    }

    async function loadProductIntoForm(id) {
      setMsg("");
      var res = await sb
        .from("products")
        .select("id,title,title_en,price_iqd,stock,discount_percent,description,image_url,colors,age_ranges,active")
        .eq("id", id)
        .maybeSingle();
      if (res.error || !res.data) {
        setMsg(res.error ? res.error.message : "لم يتم العثور على المنتج");
        return;
      }
      var p = res.data;
      document.getElementById("bb-prod-title").value = p.title || "";
      var ten = document.getElementById("bb-prod-title-en");
      if (ten) ten.value = p.title_en || "";
      document.getElementById("bb-prod-price").value = String(p.price_iqd ?? "");
      document.getElementById("bb-prod-stock").value = String(p.stock ?? 0);
      var d = document.getElementById("bb-prod-discount");
      if (d) d.value = String(p.discount_percent ?? 0);
      var desc = document.getElementById("bb-prod-desc");
      if (desc) desc.value = p.description || "";
      var img = document.getElementById("bb-prod-image");
      if (img) img.value = p.image_url || "";
      // checkboxes
      var cs = Array.isArray(p.colors) ? p.colors : [];
      var as = Array.isArray(p.age_ranges) ? p.age_ranges : [];
      Array.from(host.querySelectorAll('input[name="colors"]')).forEach(function (x) {
        x.checked = cs.indexOf(x.value) !== -1;
      });
      Array.from(host.querySelectorAll('input[name="age_ranges"]')).forEach(function (x) {
        x.checked = as.indexOf(x.value) !== -1;
      });

      // Load variant stock quantities (color + age_range)
      var vs = await sb
        .from("product_variant_stock")
        .select("color,age_range,stock")
        .eq("product_id", id);
      var vmap = {};
      if (!vs.error) {
        (vs.data || []).forEach(function (r) {
          vmap[String(r.color) + "||" + String(r.age_range)] = clampInt(r.stock, 0);
        });
      }
      origVariantStock = vmap;
      renderColorQty(vmap);

      setEditMode(p.id);
      openModal();
    }

    // (Kept name for compatibility) Renders variant stock matrix.
    function renderColorQty(existing) {
      var wrap = document.getElementById("bb-colors");
      if (!wrap) return;
      var blockId = "bb-color-qty";
      var old = document.getElementById(blockId);
      if (old) old.remove();
      var box = document.createElement("div");
      box.id = blockId;
      box.style.cssText =
        "width:100%;margin-top:10px;border-top:1px dashed #e8e1e1;padding-top:10px;display:flex;flex-direction:column;gap:10px";

      var selectedColors = Array.from(host.querySelectorAll('input[name="colors"]'))
        .filter(function (x) { return x.checked; })
        .map(function (x) { return x.value; });
      var selectedAges = Array.from(host.querySelectorAll('input[name="age_ranges"]'))
        .filter(function (x) { return x.checked; })
        .map(function (x) { return x.value; });

      if (!selectedColors.length || !selectedAges.length) {
        box.innerHTML =
          '<div style="color:#3f4946;font-size:12px">اختر لونًا + عمر/مقاس لعرض جدول الكميات.</div>';
        wrap.parentNode.appendChild(box);
        return;
      }
      var isEdit = !!editId;
      box.innerHTML =
        (isEdit
          ? '<div style="color:#3f4946;font-size:12px">في التعديل: لا يمكن إنقاص/تغيير الرصيد الحالي، فقط إضافة (+) على مستوى (اللون + العمر).</div>'
          : '<div style="color:#3f4946;font-size:12px">حدد الكمية المبدئية لكل (لون + عمر).</div>') +
        '<div style="overflow:auto;border:1px solid #e8e1e1;border-radius:12px">' +
        '<table style="width:100%;border-collapse:collapse;min-width:720px">' +
        '<thead><tr style="background:#f9f2f2">' +
        '<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #eee">Color \\ Age</th>' +
        selectedAges
          .slice()
          .sort()
          .map(function (a) {
            return '<th style="text-align:center;padding:8px 10px;border-bottom:1px solid #eee">' + escapeHtml(a) + "</th>";
          })
          .join("") +
        "</tr></thead><tbody>" +
        selectedColors
          .slice()
          .sort()
          .map(function (c) {
            return (
              "<tr>" +
              '<td style="padding:8px 10px;border-top:1px solid #eee;font-weight:900">' +
              escapeHtml(c) +
              "</td>" +
              selectedAges
                .slice()
                .sort()
                .map(function (a) {
                  var key = String(c) + "||" + String(a);
                  var val = clampInt(existing && existing[key] != null ? existing[key] : 0, 0);
                  return (
                    '<td style="padding:8px 10px;border-top:1px solid #eee;text-align:center">' +
                    '<div style="display:flex;align-items:center;justify-content:center;gap:6px">' +
                    '<input data-variant-qty="' +
                    escapeHtml(key) +
                    '" type="number" min="0" value="' +
                    escapeHtml(String(val)) +
                    '" style="width:96px;text-align:center;padding:8px 10px;border-radius:10px;border:1px solid #bec9c5' +
                    (isEdit ? ';background:#f3ecec' : "") +
                    '" ' +
                    (isEdit ? "readonly" : "") +
                    " />" +
                    (isEdit
                      ? '<button type="button" data-vinc="1" data-vkey="' +
                        escapeHtml(key) +
                        '" style="padding:6px 10px;border-radius:10px;border:1px solid #bec9c5;background:#fff;cursor:pointer">+1</button>' +
                        '<button type="button" data-vinc="5" data-vkey="' +
                        escapeHtml(key) +
                        '" style="padding:6px 10px;border-radius:10px;border:1px solid #bec9c5;background:#fff;cursor:pointer">+5</button>'
                      : "") +
                    "</div></td>"
                  );
                })
                .join("") +
              "</tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";

      wrap.parentNode.appendChild(box);
    }

    // Keep qty controls in sync with selected colors/ages
    document.addEventListener(
      "change",
      function (e) {
        var t = e.target;
        if (!t || (t.name !== "colors" && t.name !== "age_ranges")) return;
        if (!modalEl() || modalEl().style.display !== "flex") return;
        renderColorQty({});
      },
      true
    );

    host.addEventListener("click", async function (e) {
      var b = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!b) return;
      var act = b.getAttribute("data-act");
      var id = b.getAttribute("data-id");
      // Variant + buttons in edit mode
      if (b.hasAttribute("data-vinc")) {
        if (!editId) return;
        var k = b.getAttribute("data-vkey") || "";
        var inc = clampInt(b.getAttribute("data-vinc"), 0);
        if (!k) return;
        var parts = k.split("||");
        var color2 = parts[0] || "";
        var age2 = parts[1] || "";
        b.disabled = true;
        var rpc3 = await sb.rpc("adjust_variant_stock", {
          p_product_id: editId,
          p_color: color2,
          p_age_range: age2,
          p_delta: inc,
        });
        b.disabled = false;
        if (rpc3.error) {
          setMsg("فشل إضافة رصيد: " + rpc3.error.message);
          return;
        }
        await loadProductIntoForm(editId);
        return;
      }

      if (!act || !id) return;

      if (act === "edit") {
        await loadProductIntoForm(id);
        return;
      }

      if (act === "del") {
        if (!confirm("حذف المنتج؟ إذا كان مرتبطًا بطلبات سابقة سيتم تعطيله بدل الحذف.")) return;

        // Best effort: remove variant stock rows first (FK cascade should handle this if present).
        try {
          await sb.from("product_variant_stock").delete().eq("product_id", id);
        } catch (e0) {}

        var del = await sb.from("products").delete().eq("id", id);
        if (del.error) {
          // Common: product referenced by order_items (FK restrict) -> disable instead.
          var msgTxt = String(del.error.message || "");
          if (msgTxt.toLowerCase().indexOf("foreign key") !== -1 || msgTxt.indexOf("23503") !== -1) {
            var dis = await sb.from("products").update({ active: false }).eq("id", id);
            if (dis.error) {
              setMsg("تعذر حذف المنتج وتعذر تعطيله: " + dis.error.message);
              return;
            }
            setMsg("لا يمكن حذف المنتج لأنه مرتبط بطلبات. تم تعطيله (active=false) بدلًا من ذلك.");
            await load();
            return;
          }
          setMsg(del.error.message);
          return;
        }
        setMsg("تم حذف المنتج.");
        await load();
      }

      if (act === "toggle") {
        var cur = await sb
          .from("products")
          .select("active")
          .eq("id", id)
          .maybeSingle();
        if (cur.error) {
          setMsg(cur.error.message);
          return;
        }
        var nextActive = cur.data ? !cur.data.active : true;
        var up = await sb.from("products").update({ active: nextActive }).eq("id", id);
        if (up.error) {
          setMsg(up.error.message);
          return;
        }
        await load();
      }
    });

    var form = host.querySelector("#bbProdForm");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      setMsg("");
      function safeExt(name) {
        var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
        var ext = m ? m[1] : "jpg";
        if (["jpg", "jpeg", "png", "webp", "gif"].indexOf(ext) === -1) return "jpg";
        return ext === "jpeg" ? "jpg" : ext;
      }
      async function uploadImageIfAny() {
        var fileInput = document.getElementById("bb-prod-file");
        if (!fileInput || !fileInput.files || !fileInput.files[0]) return "";
        var f = fileInput.files[0];
        // 6MB limit to avoid huge uploads from browser
        if (f.size && f.size > 6 * 1024 * 1024) {
          setMsg("الصورة كبيرة جدًا (أقصى حد 6MB).");
          return null;
        }
        var ext = safeExt(f.name);
        var path =
          "products/" +
          Date.now() +
          "-" +
          Math.random().toString(16).slice(2) +
          "." +
          ext;
        var up = await sb.storage.from(BUCKET).upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type || undefined,
        });
        if (up.error) {
          setMsg("فشل رفع الصورة: " + up.error.message);
          return null;
        }
        var pub = sb.storage.from(BUCKET).getPublicUrl(path);
        return (pub && pub.data && pub.data.publicUrl) || "";
      }
      var fd = new FormData(form);
      var title = String(fd.get("title") || "").trim();
      var title_en = String(fd.get("title_en") || "").trim();
      var price_iqd = parseInt(String(fd.get("price_iqd") || "0"), 10);
      var stock = parseInt(String(fd.get("stock") || "0"), 10);
      var discount_percent = parseInt(String(fd.get("discount_percent") || "0"), 10);
      var description = String(fd.get("description") || "").trim();
      var image_url = String(fd.get("image_url") || "").trim();
      var colors = fd.getAll("colors").map(function (x) { return String(x || "").trim(); }).filter(Boolean);
      var age_ranges = fd.getAll("age_ranges").map(function (x) { return String(x || "").trim(); }).filter(Boolean);
      if (!title) return;
      if (!Number.isFinite(discount_percent) || discount_percent < 0) discount_percent = 0;
      if (discount_percent > 90) discount_percent = 90;

      // If admin selected a local file, upload to Supabase Storage and use the URL.
      var uploaded = await uploadImageIfAny();
      if (uploaded === null) return;
      if (uploaded) image_url = uploaded;

      var payload = { title: title, price_iqd: price_iqd, stock: stock, active: true };
      if (title_en) payload.title_en = title_en;
      payload.discount_percent = discount_percent;
      if (description) payload.description = description;
      if (image_url) payload.image_url = image_url;
      payload.colors = colors;
      payload.age_ranges = age_ranges;

      // Per-variant stock quantities (color + age_range). Sum becomes products.stock.
      var qtySum = 0;
      var variantQty = {}; // key: color||age -> qty
      colors.forEach(function (c) {
        age_ranges.forEach(function (a) {
          var key = String(c) + "||" + String(a);
          var inp = host.querySelector('[data-variant-qty="' + key + '"]');
          var q = clampInt(inp ? inp.value : 0, 0);
          variantQty[key] = q;
          qtySum += q;
        });
      });
      payload.stock = qtySum;

      if (editId) {
        // do not force active=true on edit
        delete payload.active;
        // In edit mode: do NOT overwrite stock quantities here. Use +/- buttons (RPC) to adjust variants.
        delete payload.stock;
        var up = await sb.from("products").update(payload).eq("id", editId);
        if (up.error) {
          setMsg(up.error.message);
          return;
        }

        clearForm();
      } else {
        var ins = await sb.from("products").insert(payload).select("id").single();
        if (ins.error) {
          setMsg(ins.error.message);
          return;
        }
        var newId = ins.data && ins.data.id;
        if (newId) {
          var rows2 = Object.keys(variantQty).map(function (k) {
            var parts = k.split("||");
            return {
              product_id: newId,
              color: parts[0],
              age_range: parts[1],
              stock: variantQty[k],
              updated_at: new Date().toISOString(),
            };
          });
          if (rows2.length) {
            var ups2 = await sb
              .from("product_variant_stock")
              .upsert(rows2, { onConflict: "product_id,color,age_range" });
            if (ups2.error) {
              setMsg("تم إنشاء المنتج لكن فشل حفظ كميات المخزون: " + ups2.error.message);
              return;
            }
          }
        }
        form.reset();
        // clear checkboxes
        Array.from(host.querySelectorAll('input[name="colors"], input[name="age_ranges"]')).forEach(function (x) {
          x.checked = false;
        });
      }
      await load();
      closeModal();
    });

    await loadUsdRate();
    await load();
    try {
      var s = document.getElementById("bb-usd-save");
      if (s) s.addEventListener("click", saveUsdRate);
    } catch (e4) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (e) {
      console.warn(e);
    });
  });
})();

