const SectionsApp = (() => {
  const grid = document.getElementById("sectionsGrid");
  const alertEl = document.getElementById("sectionsAlert");
  const leadEl = document.getElementById("sectionsLead");
  let currentUser = null;
  let sections = [];

  function isDesktopHover() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  function statCell(value, label) {
    return `<td>
      <strong>${Portal.formatNumber(value || 0)}</strong>
      <span>${label}</span>
    </td>`;
  }

  function casePreviewRows(section, rows = section.preview_cases || []) {
    if (!rows.length) {
      return `<tr class="portal-section-board__empty"><td colspan="3">لا توجد قضايا هنا بعد.</td></tr>`;
    }
    return rows
      .map(
        (item) => `<tr class="portal-section-board__case" data-open-case="${Portal.escapeHtml(item.id)}" data-section="${Portal.escapeHtml(section.id)}" tabindex="0">
          <td>
            <strong>${Portal.escapeHtml(item.title)}</strong>
            <span>${Portal.escapeHtml(item.client_name || "بدون موكل")}</span>
          </td>
          <td>${Portal.escapeHtml(item.lawyer_name || "مدير القسم")}</td>
          <td>${Portal.statusLabel(item.status)}</td>
        </tr>`
      )
      .join("");
  }

  function subsectionPreview(section) {
    const groups = section.subsections || [];
    if (!groups.length) return "";
    const counts = groups
      .map((group) => {
        const n = (section.preview_cases || []).filter((item) => item.subsection_id === group.id).length;
        return `<span>${Portal.escapeHtml(group.name)} <strong>${Portal.formatNumber(n)}</strong></span>`;
      })
      .join("");
    return `<div class="portal-section-board__subs">${counts}</div>`;
  }

  function previewTables(section) {
    const groups = section.subsections || [];
    if (!groups.length) {
      return `<table class="portal-section-table portal-section-table--cases">
            <thead>
              <tr>
                <th>القضية</th>
                <th>المسؤول</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>${casePreviewRows(section)}</tbody>
          </table>`;
    }
    return groups
      .map((group) => {
        const rows = (section.preview_cases || []).filter((item) => item.subsection_id === group.id);
        return `<h4 class="portal-subsection__title">${Portal.escapeHtml(group.name)} <span>${Portal.formatNumber(rows.length)}</span></h4>
          <table class="portal-section-table portal-section-table--cases">
            <thead>
              <tr>
                <th>القضية</th>
                <th>المسؤول</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>${casePreviewRows(section, rows)}</tbody>
          </table>`;
      })
      .join("");
  }

  function renderBoard(section) {
    const stats = section.stats || { cases: 0, lawyers: 0, tasks_done: 0, tasks_open: 0 };
    const managerName = section.manager?.name || "غير معيّن";
    return `<article class="portal-section-board" data-section-id="${Portal.escapeHtml(section.id)}">
      <header class="portal-section-board__head">
        <div>
          <h2>${Portal.escapeHtml(section.name)}</h2>
          <p>مدير القسم: <strong>${Portal.escapeHtml(managerName)}</strong></p>
          ${subsectionPreview(section)}
        </div>
        <a class="portal-btn-sm portal-section-board__open" href="/portal/section?id=${encodeURIComponent(section.id)}" data-section="${Portal.escapeHtml(section.id)}">فتح القسم</a>
      </header>
      <table class="portal-section-table">
        <thead>
          <tr>
            <th>القضايا</th>
            <th>المحامون</th>
            <th>مهام مكتملة</th>
            <th>مهام غير مكتملة</th>
          </tr>
        </thead>
        <tbody>
          <tr class="portal-section-board__summary">
            ${statCell(stats.cases, "قضية")}
            ${statCell(stats.lawyers, "محامٍ")}
            ${statCell(stats.tasks_done, "منجزة")}
            ${statCell(stats.tasks_open, "قيد الانتظار")}
          </tr>
        </tbody>
      </table>
      <div class="portal-section-board__details">
        <div class="portal-section-board__details-inner">
          <h3>القضايا</h3>
          ${previewTables(section)}
        </div>
      </div>
    </article>`;
  }

  function render() {
    if (!grid) return;
    if (!sections.length) {
      grid.innerHTML =
        '<p class="portal-detail-empty">لا توجد أقسام للعرض. إن لم تكن مدير قسم بعد، اطلب من المدير تعيينك.</p>';
      return;
    }
    grid.innerHTML = sections.map(renderBoard).join("");
  }

  function rememberSection(sectionId, caseId) {
    try {
      if (sectionId) sessionStorage.setItem("gz_portal_section_id", sectionId);
      if (caseId) sessionStorage.setItem("gz_portal_section_case", caseId);
    } catch {
      /* ignore */
    }
  }

  function openSection(sectionId, caseId) {
    if (!sectionId) return;
    rememberSection(sectionId, caseId);
    const params = new URLSearchParams({ id: sectionId });
    if (caseId) params.set("case", caseId);
    window.location.assign(`/portal/section?${params.toString()}`);
  }

  async function load() {
    Portal.hideAlert(alertEl);
    const data = await Portal.request("/sections");
    sections = data.sections || [];
    render();
  }

  async function boot() {
    const user = await Portal.requireAuth();
    if (!user) return;
    currentUser = user;
    if (!["admin", "assistant", "section_manager"].includes(user.role)) {
      window.location.href = "home.html";
      return;
    }
    if (user.role === "section_manager") {
      const managedId = user.managed_section?.id;
      if (managedId) {
        window.location.replace(`section.html?id=${encodeURIComponent(managedId)}`);
        return;
      }
      try {
        const data = await Portal.request("/sections");
        const first = (data.sections || [])[0];
        if (first?.id) {
          window.location.replace(`section.html?id=${encodeURIComponent(first.id)}`);
          return;
        }
      } catch {
        /* fall through to empty overview */
      }
    }
    PortalNav.init(user);
    if (leadEl) {
      leadEl.textContent = "مرّر أو اضغط على الجدول لعرض القضايا، ثم اضغط «فتح القسم».";
    }

    grid?.addEventListener(
      "click",
      (event) => {
        const openBtn = event.target.closest(".portal-section-board__open");
        if (openBtn) {
          const sectionId = openBtn.getAttribute("data-section") || "";
          rememberSection(sectionId);
          return;
        }

        const caseRow = event.target.closest("[data-open-case]");
        if (caseRow) {
          event.preventDefault();
          event.stopPropagation();
          openSection(caseRow.dataset.section, caseRow.dataset.openCase);
          return;
        }

        if (isDesktopHover()) return;

        const board = event.target.closest(".portal-section-board");
        if (!board) return;
        event.preventDefault();
        board.classList.toggle("is-expanded");
        board.setAttribute("aria-expanded", board.classList.contains("is-expanded") ? "true" : "false");
      },
      true
    );

    try {
      await load();
    } catch (error) {
      Portal.showAlert(alertEl, error.message || "تعذر تحميل الأقسام.");
    }
  }

  boot();
  return { boot, load };
})();
