const AttachmentsPage = (() => {
  const PAGE_SIZE = 30;
  const alertEl = document.getElementById("attachmentsAlert");
  const leadEl = document.getElementById("attachmentsLead");
  const bodyEl = document.getElementById("attachmentsBody");
  const scrollEl = document.getElementById("attachmentsScroll");
  const sentinel = document.getElementById("attachmentsSentinel");
  const searchEl = document.getElementById("attachmentsSearch");
  const previewDialog = document.getElementById("attachmentPreviewDialog");
  const previewTitle = document.getElementById("attachmentPreviewTitle");
  const previewBody = document.getElementById("attachmentPreviewBody");

  let items = [];
  let total = 0;
  let offset = 0;
  let loading = false;
  let query = "";
  let previewObjectUrl = null;
  let searchTimer = 0;

  function apiRoot() {
    return typeof Portal.apiRoot === "function" ? Portal.apiRoot() : "/api";
  }

  function credentials() {
    return typeof Portal.apiCredentials === "function" ? Portal.apiCredentials() : "same-origin";
  }

  function attachmentHref(item) {
    if (!item?.id) return "";
    return `${apiRoot()}/dashboard/attachments/${encodeURIComponent(item.id)}`;
  }

  function scopeText(scope) {
    return "ملفات المكتب";
  }

  function rowsHtml(rows) {
    return rows
      .map((item) => {
        const href = attachmentHref(item);
        const viewHref = href ? `${href}?view=1` : "";
        const sections = (item.section_names || []).join("، ") || "—";
        const caseTitle = item.case_title
          ? `${Portal.escapeHtml(item.case_title)}${item.subsection_name ? ` · ${Portal.escapeHtml(item.subsection_name)}` : ""}`
          : "—";
        const label = item.label || item.originalName || item.filename || "مرفق";
        return `<tr>
          <td><strong>${Portal.escapeHtml(label)}</strong></td>
          <td>${Portal.escapeHtml(sections)}</td>
          <td>${caseTitle}</td>
          <td>
            <div class="portal-attachment-actions">
              ${
                viewHref
                  ? `<button type="button" class="portal-attachment-view-btn" data-action="view-attachment" data-view-url="${Portal.escapeHtml(viewHref)}" data-mime-type="${Portal.escapeHtml(item.mimeType || "")}" data-original-name="${Portal.escapeHtml(item.originalName || "")}" data-filename="${Portal.escapeHtml(item.filename || "")}" data-label="${Portal.escapeHtml(label)}" title="معاينة" aria-label="معاينة ${Portal.escapeHtml(label)}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>`
                  : ""
              }
              ${
                href
                  ? `<a class="portal-attachment-download-link" href="${Portal.escapeHtml(href)}" title="تنزيل" aria-label="تنزيل ${Portal.escapeHtml(label)}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 4v10M8 10l4 4 4-4M5 20h14" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </a>`
                  : ""
              }
            </div>
          </td>
        </tr>`;
      })
      .join("");
  }

  function renderRows(newRows, reset) {
    if (!bodyEl) return;
    if (reset && !items.length) {
      bodyEl.innerHTML = `<tr class="portal-section-board__empty"><td colspan="4">لا توجد مرفقات.</td></tr>`;
      if (sentinel) sentinel.hidden = true;
      return;
    }
    const html = rowsHtml(reset ? items : newRows);
    if (reset) bodyEl.innerHTML = html;
    else bodyEl.insertAdjacentHTML("beforeend", html);
    if (sentinel) sentinel.hidden = offset >= total;
  }

  async function loadPage({ reset = false } = {}) {
    if (loading) return;
    if (!reset && total && offset >= total) return;
    loading = true;
    try {
      const nextOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        offset: String(nextOffset),
        limit: String(PAGE_SIZE),
      });
      if (query) params.set("q", query);
      const data = await Portal.request(`/library-attachments/catalog?${params.toString()}`);
      const rows = data.attachments || [];
      total = Number(data.total || 0);
      if (leadEl && data.scope) leadEl.textContent = scopeText(data.scope);
      if (reset) {
        items = rows;
        offset = rows.length;
        renderRows(rows, true);
      } else {
        const added = [];
        const seen = new Set(items.map((item) => item.id || item.filename));
        for (const row of rows) {
          const key = row.id || row.filename;
          if (key && !seen.has(key)) {
            items.push(row);
            added.push(row);
          }
        }
        offset = items.length;
        renderRows(added, false);
      }
    } catch (error) {
      Portal.showAlert(alertEl, error.message || "تعذر تحميل المرفقات.");
    } finally {
      loading = false;
    }
  }

  function guessMime(mimeType, ...names) {
    const mime = String(mimeType || "").trim().toLowerCase();
    if (mime && mime !== "application/octet-stream") return mime;
    const combined = names.filter(Boolean).join(" ").toLowerCase();
    if (combined.includes(".pdf")) return "application/pdf";
    if (/\.png/.test(combined)) return "image/png";
    if (/\.jpe?g/.test(combined)) return "image/jpeg";
    if (/\.gif/.test(combined)) return "image/gif";
    if (/\.webp/.test(combined)) return "image/webp";
    return mime || "application/octet-stream";
  }

  function revokePreview() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  async function openPreview(viewUrl, mimeType, label, originalName = "", filename = "") {
    if (!viewUrl || !previewDialog || !previewBody) return;
    previewTitle.textContent = label || "معاينة المرفق";
    previewBody.innerHTML = `<p class="portal-detail-loading">جاري تحميل المعاينة...</p>`;
    previewDialog.showModal();
    const guessedType = guessMime(mimeType, originalName, filename, label);
    try {
      const res = await fetch(viewUrl, { credentials: credentials() });
      if (!res.ok) throw new Error("تعذر فتح المرفق.");
      const blob = await res.blob();
      const type = blob.type && blob.type !== "application/octet-stream" ? blob.type : guessedType;
      revokePreview();
      previewObjectUrl = URL.createObjectURL(new Blob([blob], { type }));
      if (type.startsWith("image/")) {
        previewBody.innerHTML = `<img class="portal-preview-image" src="${previewObjectUrl}" alt="${Portal.escapeHtml(label || "مرفق")}" />`;
        return;
      }
      if (type === "application/pdf") {
        previewBody.innerHTML = `<iframe class="portal-preview-frame" src="${previewObjectUrl}" title="${Portal.escapeHtml(label || "مرفق")}"></iframe>`;
        return;
      }
      previewBody.innerHTML = `<div class="portal-preview-fallback">
        <p class="portal-alert">هذا النوع من الملفات لا يُعرض داخل المتصفح. يمكنك تنزيله لفتحه على جهازك.</p>
        <a class="btn" href="${Portal.escapeHtml(previewObjectUrl)}" download="${Portal.escapeHtml(originalName || filename || label || "attachment")}">تنزيل المرفق</a>
      </div>`;
    } catch (error) {
      previewBody.innerHTML = `<p class="portal-alert portal-alert--error">${Portal.escapeHtml(error.message)}</p>`;
    }
  }

  async function boot() {
    const user = await Portal.requireAuth();
    if (!user) return;
    const canView =
      user.role === "admin" ||
      user.role === "assistant" ||
      user.role === "section_manager" ||
      (user.role === "lawyer" && Array.isArray(user.led_subsections) && user.led_subsections.length > 0);
    if (!canView) {
      window.location.href = "home.html";
      return;
    }
    PortalNav.init(user);

    document.getElementById("closeAttachmentPreviewBtn")?.addEventListener("click", () => previewDialog?.close());
    previewDialog?.addEventListener("close", () => {
      revokePreview();
      if (previewBody) previewBody.innerHTML = "";
    });
    document.body.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action='view-attachment']");
      if (!btn) return;
      event.preventDefault();
      openPreview(
        btn.dataset.viewUrl,
        btn.dataset.mimeType,
        btn.dataset.label,
        btn.dataset.originalName,
        btn.dataset.filename
      );
    });
    searchEl?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        query = String(searchEl.value || "").trim();
        loadPage({ reset: true });
      }, 250);
    });
    if (scrollEl && sentinel && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) loadPage();
        },
        { root: scrollEl, rootMargin: "80px" }
      );
      observer.observe(sentinel);
    }
    await loadPage({ reset: true });
  }

  boot();
  return { boot };
})();
