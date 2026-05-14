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

    var mount =
      document.getElementById("bb-admin-products") || document.body;
    var host = document.createElement("div");
    host.style.cssText = "max-width:1100px;margin:0 auto;padding:0 0 12px;";
    host.innerHTML =
      "<style>" +
      "#bb-prod-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(29,27,27,.42);backdrop-filter:blur(4px);opacity:0;transition:opacity .22s ease}" +
      "#bb-prod-modal.bb-modal-open{display:flex;opacity:1}" +
      "#bb-prod-modal.bb-modal-closing{opacity:0}" +
      ".bb-modal-panel{width:100%;max-width:min(1040px,96vw);max-height:min(92vh,920px);background:#fff;border-radius:20px;border:1px solid #e8e1e1;box-shadow:0 24px 64px rgba(20,106,92,.18);display:flex;flex-direction:column;overflow:hidden;transform:translateY(16px) scale(.98);opacity:0;transition:transform .24s ease,opacity .24s ease}" +
      "#bb-prod-modal.bb-modal-open .bb-modal-panel{transform:translateY(0) scale(1);opacity:1}" +
      "#bb-prod-modal.bb-modal-closing .bb-modal-panel{transform:translateY(10px) scale(.985);opacity:0}" +
      ".bb-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:linear-gradient(180deg,#f9f2f2 0%,#fff 100%);border-bottom:1px solid #ede7e6;flex-shrink:0}" +
      ".bb-modal-head h3{margin:0;font-size:18px;font-weight:900;color:#1d1b1b}" +
      ".bb-modal-head p{margin:4px 0 0;font-size:12px;color:#6f7976}" +
      ".bb-modal-close{width:40px;height:40px;border:0;border-radius:12px;background:#f3ecec;color:#3f4946;font-size:18px;font-weight:900;cursor:pointer;transition:background .15s ease,transform .15s ease}" +
      ".bb-modal-close:hover{background:#e8e1e1;transform:scale(1.04)}" +
      "#bb-prod-modal-body{padding:18px 20px 8px;overflow:auto;flex:1;min-height:0;scroll-behavior:smooth}" +
      ".bb-form-section{margin-bottom:18px;padding:14px 16px;border:1px solid #ede7e6;border-radius:16px;background:#fff}" +
      ".bb-form-section-title{margin:0 0 12px;font-size:13px;font-weight:900;color:#146a5c;letter-spacing:.02em}" +
      ".bb-form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}" +
      ".bb-field{display:flex;flex-direction:column;gap:6px;min-width:0}" +
      ".bb-field-span2{grid-column:span 2}" +
      ".bb-field-span4{grid-column:1 / -1}" +
      ".bb-field label{font-size:12px;font-weight:800;color:#3f4946}" +
      ".bb-field input,.bb-field textarea{width:100%;padding:11px 12px;border:1px solid #bec9c5;border-radius:12px;background:#fff;font:inherit;transition:border-color .15s ease,box-shadow .15s ease}" +
      ".bb-field input:focus,.bb-field textarea:focus{outline:none;border-color:#86d2c1;box-shadow:0 0 0 3px rgba(134,210,193,.28)}" +
      ".bb-field input[readonly]{background:#f3ecec;color:#6f7976}" +
      ".bb-chip-grid{display:flex;flex-wrap:wrap;gap:8px;max-height:220px;overflow:auto;padding:2px}" +
      ".bb-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1.5px solid #bec9c5;border-radius:999px;background:#fff;cursor:pointer;user-select:none;transition:all .15s ease}" +
      ".bb-chip:hover{border-color:#86d2c1;background:#f7fffc}" +
      ".bb-chip input{position:absolute;opacity:0;pointer-events:none}" +
      ".bb-chip.bb-chip--on{border-color:#146a5c;background:#e8f7f3;box-shadow:0 0 0 2px rgba(20,106,92,.12)}" +
      ".bb-chip-swatch{width:14px;height:14px;border-radius:999px;border:1px solid rgba(0,0,0,.12);flex-shrink:0}" +
      ".bb-image-drop{grid-column:1 / -1;border:1.5px dashed #bec9c5;border-radius:16px;padding:16px;background:#fafafa;transition:border-color .15s ease,background .15s ease}" +
      ".bb-image-drop.bb-drop-active{border-color:#146a5c;background:#f2fbf8}" +
      ".bb-image-drop-inner{display:grid;grid-template-columns:140px 1fr;gap:14px;align-items:center}" +
      "#bb-prod-image-preview{width:140px;height:140px;border-radius:14px;object-fit:cover;border:1px solid #e8e1e1;background:#f3ecec}" +
      ".bb-image-placeholder{width:140px;height:140px;border-radius:14px;border:1px dashed #bec9c5;background:#fff;display:flex;align-items:center;justify-content:center;color:#6f7976;font-size:12px;text-align:center;padding:10px}" +
      ".bb-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 20px 18px;border-top:1px solid #ede7e6;background:#fff;flex-shrink:0}" +
      ".bb-btn{padding:11px 16px;border:0;border-radius:12px;font-weight:900;cursor:pointer;transition:transform .12s ease,opacity .12s ease,box-shadow .12s ease}" +
      ".bb-btn:active{transform:scale(.98)}" +
      ".bb-btn-primary{background:#42617d;color:#fff;box-shadow:0 8px 20px rgba(66,97,125,.22)}" +
      ".bb-btn-primary:hover{opacity:.94}" +
      ".bb-btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}" +
      ".bb-btn-secondary{background:#f3ecec;color:#1d1b1b}" +
      ".bb-btn-secondary:hover{background:#e8e1e1}" +
      "@media (max-width: 980px) {" +
      "  .bb-form-grid{grid-template-columns:1fr 1fr}" +
      "  .bb-field-span2,.bb-field-span4{grid-column:1 / -1}" +
      "  .bb-image-drop-inner{grid-template-columns:1fr}" +
      "}" +
      "@media (max-width: 640px) {" +
      "  #bb-prod-modal{padding:10px;align-items:stretch}" +
      "  .bb-modal-panel{max-width:100%;max-height:calc(100vh - 20px);border-radius:16px}" +
      "  .bb-form-grid{grid-template-columns:1fr}" +
      "  #bb-prod-modal-body{padding:14px 14px 6px}" +
      "  .bb-modal-foot{padding:12px 14px 14px}" +
      "}" +
      "</style>" +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">' +
      '<h2 style="font-weight:900;margin:0">المنتجات</h2>' +
      '<div style="display:flex;gap:10px;align-items:center">' +
      '<button id="bb-open-new-product" type="button" style="background:#42617d;color:#fff;border:0;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer">إضافة منتج</button>' +
      '<button data-bb-logout style="background:#146a5c;color:#fff;border:0;border-radius:10px;padding:10px 12px;font-weight:800;cursor:pointer">Logout</button>' +
      "</div>" +
      "</div>" +
      '<div id="bbAdminMsg" style="margin:6px 0 10px;font-size:13px;color:#ba1a1a;min-height:18px"></div>' +
      '<div style="background:#fff;border:1px solid #e8e1e1;border-radius:14px;overflow:auto">' +
      '<table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="background:#f3ecec">' +
      '<th style="text-align:left;padding:10px">Image</th>' +
      '<th style="text-align:left;padding:10px">Title</th>' +
      '<th style="text-align:right;padding:10px">IQD</th>' +
      '<th style="text-align:right;padding:10px">Stock</th>' +
      '<th style="text-align:right;padding:10px">Colors</th>' +
      '<th style="text-align:right;padding:10px">Active</th>' +
      '<th style="text-align:right;padding:10px">Actions</th>' +
      '</tr></thead><tbody id="bbProdRows"></tbody></table></div>' +
      // Modal
      '<div id="bb-prod-modal" role="dialog" aria-modal="true" aria-labelledby="bb-modal-title">' +
      '<div class="bb-modal-panel">' +
      '<div class="bb-modal-head">' +
      '<div><h3 id="bb-modal-title">إضافة منتج</h3><p>املأ التفاصيل ثم احفظ المنتج في المتجر</p></div>' +
      '<button id="bb-modal-close" type="button" class="bb-modal-close" aria-label="إغلاق">✕</button>' +
      "</div>" +
      '<div id="bb-prod-modal-body">' +
      '<form id="bbProdForm">' +
      '<section class="bb-form-section">' +
      '<h4 class="bb-form-section-title">معلومات أساسية</h4>' +
      '<div class="bb-form-grid">' +
      '<div class="bb-field bb-field-span2"><label for="bb-prod-title">العنوان</label><input id="bb-prod-title" name="title" placeholder="مثال: بلوزة قطنية" required></div>' +
      '<div class="bb-field bb-field-span2"><label for="bb-prod-title-en">الاسم بالإنجليزية (اختياري)</label><input id="bb-prod-title-en" name="title_en" placeholder="English name" dir="ltr"></div>' +
      '<div class="bb-field"><label for="bb-prod-price">السعر (IQD)</label><input id="bb-prod-price" name="price_iqd" type="number" min="0" placeholder="25000" required></div>' +
      '<div class="bb-field"><label for="bb-prod-discount">خصم %</label><input id="bb-prod-discount" name="discount_percent" type="number" min="0" max="90" value="0"></div>' +
      '<div class="bb-field"><label for="bb-prod-stock">المخزون الكلي</label><input id="bb-prod-stock" name="stock" type="number" value="0" readonly></div>' +
      "</div></section>" +
      '<section class="bb-form-section"><h4 class="bb-form-section-title">الوصف</h4>' +
      '<div class="bb-field"><label for="bb-prod-desc">وصف مختصر</label><textarea id="bb-prod-desc" name="description" rows="3" placeholder="تفاصيل المنتج للزبائن"></textarea></div></section>' +
      '<section class="bb-form-section"><h4 class="bb-form-section-title">الصورة</h4>' +
      '<div class="bb-image-drop" id="bb-image-drop">' +
      '<div class="bb-image-drop-inner">' +
      '<div id="bb-image-preview-host"><div class="bb-image-placeholder">معاينة<br/>الصورة</div></div>' +
      '<div class="bb-field"><label for="bb-prod-image">رابط الصورة</label><input id="bb-prod-image" name="image_url" placeholder="https://..." dir="ltr">' +
      '<label for="bb-prod-file" style="margin-top:10px">أو ارفع صورة</label><input id="bb-prod-file" name="image_file" type="file" accept="image/*"></div>' +
      "</div></div></section>" +
      '<section class="bb-form-section"><h4 class="bb-form-section-title">الألوان والمقاسات</h4>' +
      '<div class="bb-form-grid">' +
      '<div class="bb-field bb-field-span2"><label>الألوان</label><div id="bb-colors" class="bb-chip-grid"></div></div>' +
      '<div class="bb-field bb-field-span2"><label>الأعمار / المقاسات</label><div id="bb-ages" class="bb-chip-grid"></div>' +
      "</div></section>" +
      "</form></div>" +
      '<div class="bb-modal-foot">' +
      '<button id="bb-edit-cancel" type="button" class="bb-btn bb-btn-secondary" style="display:none">إلغاء</button>' +
      '<button id="bb-prod-submit" type="submit" form="bbProdForm" class="bb-btn bb-btn-primary">إضافة</button>' +
      "</div></div></div>";
    mount.appendChild(host);

    function renderOptions() {
      var cHost = document.getElementById("bb-colors");
      if (cHost) {
        cHost.innerHTML = COLORS.map(function (c) {
          return (
            '<label class="bb-chip">' +
            '<input type="checkbox" name="colors" value="' +
            escapeHtml(c.v) +
            '"/>' +
            '<span class="bb-chip-swatch" style="background:' +
            escapeHtml(c.hex) +
            '"></span>' +
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
            '<label class="bb-chip">' +
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
      syncChipStates();
    }

    function syncChipStates() {
      Array.from(host.querySelectorAll(".bb-chip")).forEach(function (chip) {
        var input = chip.querySelector("input");
        if (!input) return;
        if (input.checked) chip.classList.add("bb-chip--on");
        else chip.classList.remove("bb-chip--on");
      });
    }

    var previewObjectUrl = null;
    function setImagePreview(src) {
      var hostPreview = document.getElementById("bb-image-preview-host");
      if (!hostPreview) return;
      if (!src) {
        hostPreview.innerHTML = '<div class="bb-image-placeholder">معاينة<br/>الصورة</div>';
        return;
      }
      hostPreview.innerHTML =
        '<img id="bb-prod-image-preview" alt="" src="' +
        escapeHtml(src) +
        '" style="width:140px;height:140px;border-radius:14px;object-fit:cover;border:1px solid #e8e1e1;background:#f3ecec" />';
    }

    function resetImagePreview() {
      if (previewObjectUrl) {
        try {
          URL.revokeObjectURL(previewObjectUrl);
        } catch (e0) {}
        previewObjectUrl = null;
      }
      setImagePreview("");
    }

    function wireImageInteractions() {
      var urlInput = document.getElementById("bb-prod-image");
      var fileInput = document.getElementById("bb-prod-file");
      var drop = document.getElementById("bb-image-drop");
      if (urlInput) {
        urlInput.addEventListener("input", function () {
          var v = String(urlInput.value || "").trim();
          if (v) setImagePreview(v);
          else if (!fileInput || !fileInput.files || !fileInput.files[0]) resetImagePreview();
        });
      }
      if (fileInput) {
        fileInput.addEventListener("change", function () {
          var f = fileInput.files && fileInput.files[0];
          if (!f) return;
          if (previewObjectUrl) {
            try {
              URL.revokeObjectURL(previewObjectUrl);
            } catch (e1) {}
          }
          previewObjectUrl = URL.createObjectURL(f);
          setImagePreview(previewObjectUrl);
        });
      }
      if (drop) {
        ["dragenter", "dragover"].forEach(function (ev) {
          drop.addEventListener(ev, function (e) {
            e.preventDefault();
            drop.classList.add("bb-drop-active");
          });
        });
        ["dragleave", "drop"].forEach(function (ev) {
          drop.addEventListener(ev, function (e) {
            e.preventDefault();
            drop.classList.remove("bb-drop-active");
          });
        });
        drop.addEventListener("drop", function (e) {
          var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (!f || !fileInput) return;
          try {
            fileInput.files = e.dataTransfer.files;
          } catch (e2) {}
          fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }
    }

    var msg = host.querySelector("#bbAdminMsg");
    function setMsg(t) {
      if (msg) msg.textContent = t || "";
    }

    renderOptions();
    wireImageInteractions();

    host.addEventListener("change", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.name === "colors" || t.name === "age_ranges") syncChipStates();
    });

    var editId = null;
    var submitBtn = null;
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
      Array.from(host.querySelectorAll('input[name="colors"], input[name="age_ranges"]')).forEach(function (x) {
        x.checked = false;
      });
      syncChipStates();
      resetImagePreview();
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

    function isModalOpen() {
      var m = modalEl();
      return !!(m && m.classList.contains("bb-modal-open"));
    }

    function openModal() {
      var m = modalEl();
      if (!m) return;
      m.style.display = "flex";
      m.classList.remove("bb-modal-closing");
      requestAnimationFrame(function () {
        m.classList.add("bb-modal-open");
      });
      try {
        document.body.style.overflow = "hidden";
      } catch (e0) {}
      try {
        var t = document.getElementById("bb-prod-title");
        if (t) setTimeout(function () { t.focus(); }, 120);
      } catch (e) {}
    }

    function closeModal() {
      var m = modalEl();
      if (!m || !isModalOpen()) {
        if (m) {
          m.style.display = "none";
          m.classList.remove("bb-modal-open", "bb-modal-closing");
        }
        try {
          document.body.style.overflow = "";
        } catch (e1) {}
        return;
      }
      m.classList.add("bb-modal-closing");
      m.classList.remove("bb-modal-open");
      setTimeout(function () {
        m.style.display = "none";
        m.classList.remove("bb-modal-closing");
        try {
          document.body.style.overflow = "";
        } catch (e2) {}
      }, 220);
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
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && isModalOpen()) closeModal();
      });
    } catch (e5) {}

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
      if (p.image_url) setImagePreview(p.image_url);
      else resetImagePreview();
      // checkboxes
      var cs = Array.isArray(p.colors) ? p.colors : [];
      var as = Array.isArray(p.age_ranges) ? p.age_ranges : [];
      Array.from(host.querySelectorAll('input[name="colors"]')).forEach(function (x) {
        x.checked = cs.indexOf(x.value) !== -1;
      });
      Array.from(host.querySelectorAll('input[name="age_ranges"]')).forEach(function (x) {
        x.checked = as.indexOf(x.value) !== -1;
      });
      syncChipStates();

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
        if (!isModalOpen()) return;
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
      var submitBtnEl = document.getElementById("bb-prod-submit");
      if (submitBtnEl) submitBtnEl.disabled = true;
      try {
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
        syncChipStates();
        resetImagePreview();
      }
      await load();
      closeModal();
      } finally {
        if (submitBtnEl) submitBtnEl.disabled = false;
      }
    });

    await load();
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (e) {
      console.warn(e);
    });
  });
})();

