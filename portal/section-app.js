const SectionPage = (() => {
  const alertEl = document.getElementById("sectionAlert");
  const titleEl = document.getElementById("sectionTitle");
  const leadEl = document.getElementById("sectionLead");
  const casesMount = document.getElementById("sectionCasesMount");
  const casePanel = document.getElementById("sectionCaseDetail");
  const placeholder = document.getElementById("sectionCasePlaceholder");
  const teamPanel = document.getElementById("sectionTeamPanel");
  let sectionId = "";
  let currentUser = null;
  let canEditTeam = false;
  let canDeleteTeam = false;
  let canAssignLeads = false;
  let canUpload = false;
  let section = null;
  let candidates = { managers: [], lawyers: [] };
  let cases = [];
  let selectedId = "";
  let openSubsectionId = "";
  let previewObjectUrl = null;
  const UNCATEGORIZED_ID = "uncategorized";

  function normalizeSectionId(id) {
    const raw = String(id || "").trim();
    if (raw === "administrative") return "section-1";
    if (raw === "executive") return "section-2";
    return raw;
  }

  function resolveSectionId() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalizeSectionId(params.get("id"));
    if (fromQuery) return fromQuery;

    const pathMatch = window.location.pathname.match(/\/section(?:\.html)?\/([^/?#]+)/i);
    if (pathMatch?.[1] && !/\.html$/i.test(pathMatch[1])) {
      return normalizeSectionId(decodeURIComponent(pathMatch[1]));
    }

    const fromHash = normalizeSectionId(new URLSearchParams(window.location.hash.replace(/^#/, "")).get("id"));
    if (fromHash) return fromHash;

    try {
      return normalizeSectionId(sessionStorage.getItem("gz_portal_section_id"));
    } catch {
      return "";
    }
  }

  function selectedCase() {
    return cases.find((item) => item.id === selectedId) || null;
  }

  function managerOptions() {
    const options = ['<option value="">اختر مدير القسم...</option>'];
    for (const user of candidates.managers || []) {
      options.push(
        `<option value="${Portal.escapeHtml(user.id)}">${Portal.escapeHtml(user.name)} — ${Portal.roleLabel(user.role)}</option>`
      );
    }
    return options.join("");
  }

  function ledSubsectionFor(member) {
    return (section?.subsections || []).find((group) => group.lead?.id === member.id) || null;
  }

  function memberRoleLabel(member) {
    const led = ledSubsectionFor(member);
    if (led) return `مدير قسم (${led.name})`;
    return Portal.roleLabel(member.role);
  }

  function memberSubsectionControl(member) {
    const groups = section?.subsections || [];
    if (!groups.length || member.role !== "lawyer") return "";
    if (!canAssignLeads) return "";
    const led = ledSubsectionFor(member);
    const selectedId = led?.id || member.subsection_id || "";
    return `<select class="portal-member-ss" data-member-ss="${Portal.escapeHtml(member.id)}" aria-label="تعيين إلى قسم فرعي">
      <option value="">تعيين إلى قسم فرعي</option>
      ${groups
        .map((group) => {
          const selected = group.id === selectedId ? " selected" : "";
          const label = group.lead?.id === member.id ? `مدير قسم (${group.name})` : group.name;
          return `<option value="${Portal.escapeHtml(group.id)}"${selected}>${Portal.escapeHtml(label)}</option>`;
        })
        .join("")}
    </select>`;
  }

  function lawyerAddOptions() {
    const taken = new Set((section?.members || []).map((member) => member.id));
    const available = (candidates.lawyers || []).filter((user) => !user.section_id && !taken.has(user.id));
    if (!available.length) return '<option value="">لا يوجد محامون متاحون</option>';
    return (
      '<option value="">إضافة محامٍ...</option>' +
      available.map((user) => `<option value="${Portal.escapeHtml(user.id)}">${Portal.escapeHtml(user.name)}</option>`).join("")
    );
  }

  function renderTeam() {
    if (!teamPanel) return;
    teamPanel.hidden = false;
    const members = section?.members || [];
    const memberRows = members.length
      ? members
          .map(
            (member) => `<li class="portal-member-row">
              <span><strong>${Portal.escapeHtml(member.name)}</strong><em>${Portal.escapeHtml(memberRoleLabel(member))}${
                !ledSubsectionFor(member) && member.subsection_name && !canAssignLeads
                  ? ` · ${Portal.escapeHtml(member.subsection_name)}`
                  : ""
              }</em></span>
              ${memberSubsectionControl(member)}
              ${
                canDeleteTeam
                  ? `<button type="button" class="portal-btn-danger portal-btn-danger--sm" data-remove-member="${Portal.escapeHtml(member.id)}">إزالة</button>`
                  : ""
              }
            </li>`
          )
          .join("")
      : '<li class="portal-member-empty">لا يوجد محامون في هذا القسم بعد.</li>';

    teamPanel.innerHTML = `
      <div class="portal-panel-head"><h2>فريق القسم</h2></div>
      <div class="portal-detail-row"><span>مدير القسم</span><strong>${section?.manager ? Portal.escapeHtml(section.manager.name) : "غير معيّن"}</strong></div>
      ${
        canEditTeam && !section?.manager
          ? `<div class="portal-section-team-controls">
              <label><span>تعيين مدير القسم</span><select id="sectionManagerSelect">${managerOptions()}</select></label>
            </div>`
          : ""
      }
      <h3 class="portal-detail-subtitle">محامو القسم</h3>
      <ul class="portal-member-list">${memberRows}</ul>
      ${
        canEditTeam
          ? `<div class="portal-section-team-controls">
              <label><span>إضافة محامٍ</span><select id="sectionAddLawyer">${lawyerAddOptions()}</select></label>
            </div>`
          : ""
      }`;
  }

  function hasSubsectionBoxes() {
    return Boolean(section?.subsections?.length);
  }

  function subsectionBoxes() {
    const groups = section?.subsections || [];
    const used = new Set(groups.map((group) => group.id));
    const defined = groups.map((group) => ({
      id: group.id,
      name: group.name,
      lead: group.lead || null,
      inbox: false,
      rows: cases.filter((item) => item.subsection_id === group.id),
    }));
    return [
      {
        id: UNCATEGORIZED_ID,
        name: "صندوق القضايا الجديدة",
        lead: null,
        inbox: true,
        rows: cases.filter((item) => !used.has(item.subsection_id)),
      },
      ...defined,
    ];
  }

  function openBox() {
    return subsectionBoxes().find((box) => box.id === openSubsectionId) || null;
  }

  function subsectionOfCase(item) {
    if (!item) return "";
    const used = new Set((section?.subsections || []).map((group) => group.id));
    return used.has(item.subsection_id) ? item.subsection_id : UNCATEGORIZED_ID;
  }

  function sectionLawyers() {
    return (section?.members || []).filter((member) => member.role === "lawyer");
  }

  function leadSelectHtml(subsectionId, selectedId = "") {
    const lawyers = sectionLawyers();
    const options = ['<option value="">بدون مسؤول</option>'].concat(
      lawyers.map((user) => {
        const selected = user.id === selectedId ? " selected" : "";
        return `<option value="${Portal.escapeHtml(user.id)}"${selected}>${Portal.escapeHtml(user.name)}</option>`;
      })
    );
    return `<label class="portal-ss-card__lead" data-ss-lead-wrap>
      <span>المسؤول</span>
      <select data-ss-lead="${Portal.escapeHtml(subsectionId)}">${options.join("")}</select>
    </label>`;
  }

  function leadReadHtml(lead) {
    return `<p class="portal-ss-card__lead-name">المسؤول: <strong>${Portal.escapeHtml(lead?.name || "غير معيّن")}</strong></p>`;
  }

  function leadControlHtml(box) {
    if (!box || box.id === UNCATEGORIZED_ID) return "";
    if (canAssignLeads) return leadSelectHtml(box.id, box.lead?.id || "");
    return leadReadHtml(box.lead);
  }

  function openTaskCount(rows) {
    return rows.reduce(
      (count, item) => count + (item.tasks || []).filter((task) => task.status === "open").length,
      0
    );
  }

  function syncWorkspaceMode() {
    const workspace = document.querySelector(".portal-section-workspace");
    workspace?.classList.toggle("is-boxes", hasSubsectionBoxes() && !openSubsectionId);
  }

  function renderCasesHeading() {
    const heading = document.getElementById("sectionCasesHeading");
    const backBtn = document.getElementById("sectionBackToBoxes");
    if (heading) {
      if (hasSubsectionBoxes() && !openSubsectionId) heading.textContent = "الأقسام الفرعية";
      else heading.textContent = openBox()?.name || "قضايا القسم";
    }
    if (backBtn) backBtn.hidden = !(hasSubsectionBoxes() && openSubsectionId);
  }

  function writeSectionUrl() {
    const next = new URL(window.location.href);
    if (openSubsectionId) next.searchParams.set("ss", openSubsectionId);
    else next.searchParams.delete("ss");
    if (selectedId) next.searchParams.set("case", selectedId);
    else next.searchParams.delete("case");
    history.replaceState({}, "", next);
  }

  async function saveSubsectionLead(subsectionId, userId) {
    if (!subsectionId) return;
    try {
      await Portal.request(`/sections/${encodeURIComponent(sectionId)}/subsections/${encodeURIComponent(subsectionId)}/lead`, {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId || "" }),
      });
      Portal.showToast("تم تحديث مسؤول القسم الفرعي.", "success");
      await reload();
    } catch (error) {
      Portal.showAlert(alertEl, error.message);
      await reload();
    }
  }

  function setOpenSubsection(id, pushUrl = true) {
    openSubsectionId = id || "";
    if (selectedId) {
      const item = selectedCase();
      if (!item || (openSubsectionId && subsectionOfCase(item) !== openSubsectionId)) {
        selectedId = "";
      }
    }
    if (pushUrl) writeSectionUrl();
    renderCases();
    renderCaseDetail();
  }

  function isInboxView() {
    return hasSubsectionBoxes() && openSubsectionId === UNCATEGORIZED_ID;
  }

  function subsectionAssignSelect(caseId) {
    const groups = section?.subsections || [];
    return `<select data-assign-ss="${Portal.escapeHtml(caseId)}" aria-label="تعيين إلى قسم فرعي">
      <option value="">تعيين إلى قسم فرعي</option>
      ${groups
        .map((group) => `<option value="${Portal.escapeHtml(group.id)}">${Portal.escapeHtml(group.name)}</option>`)
        .join("")}
    </select>`;
  }

  function caseResponsible(item) {
    if (item?.subsection_id) {
      const group = (section?.subsections || []).find((row) => row.id === item.subsection_id);
      if (group?.lead?.name) {
        return { name: group.lead.name, role: group.lead.role || "lawyer" };
      }
      if (item.lawyer_name && item.lawyer_role === "lawyer") {
        return { name: item.lawyer_name, role: item.lawyer_role };
      }
      return { name: null, role: null };
    }
    return { name: item?.lawyer_name || null, role: item?.lawyer_role || null };
  }

  function caseResponsibleLabel(item) {
    const person = caseResponsible(item);
    if (!person.name) return "غير معيّن";
    return person.role ? `${person.name} (${Portal.roleLabel(person.role)})` : person.name;
  }

  function caseRowHtml(item) {
    const active = item.id === selectedId ? " is-active" : "";
    const classifyCell =
      canAssignLeads && isInboxView()
        ? `<td class="portal-ss-assign" data-ss-assign-wrap>${subsectionAssignSelect(item.id)}</td>`
        : "";
    return `<tr class="portal-section-board__case${active}" data-case-id="${Portal.escapeHtml(item.id)}" tabindex="0">
      <td><strong>${Portal.escapeHtml(item.title)}</strong></td>
      <td>${Portal.escapeHtml(item.client_name || "—")}</td>
      <td>${Portal.escapeHtml(caseResponsible(item).name || "غير معيّن")}</td>
      <td>${Portal.statusLabel(item.status)}</td>
      ${classifyCell}
    </tr>`;
  }

  function casesTableHtml(rows, emptyMessage) {
    const showAssign = canAssignLeads && isInboxView();
    const cols = showAssign ? 5 : 4;
    const body = rows.length
      ? rows.map(caseRowHtml).join("")
      : `<tr class="portal-section-board__empty"><td colspan="${cols}">${emptyMessage}</td></tr>`;
    return `<div class="portal-table-wrap">
      <table class="portal-section-table portal-section-table--cases">
        <thead>
          <tr>
            <th>القضية</th>
            <th>الموكل</th>
            <th>المسؤول</th>
            <th>الحالة</th>
            ${showAssign ? "<th>تعيين</th>" : ""}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
  }

  function renderCases() {
    if (!casesMount) return;
    renderCasesHeading();
    syncWorkspaceMode();
    if (!hasSubsectionBoxes()) {
      casesMount.innerHTML = casesTableHtml(cases, "لا توجد قضايا في هذا القسم بعد.");
      return;
    }
    if (!openSubsectionId) {
      casesMount.innerHTML = `<div class="portal-ss-grid">${subsectionBoxes()
        .map((box) => {
          const openTasks = openTaskCount(box.rows);
          return `<div class="portal-ss-card${box.inbox ? " portal-ss-card--inbox" : ""}" data-open-ss="${Portal.escapeHtml(box.id)}" tabindex="0" role="button">
            ${box.inbox ? '<p class="portal-ss-card__tag">وارد</p>' : ""}
            <h3>${Portal.escapeHtml(box.name)}</h3>
            <p class="portal-ss-card__stats">
              <span><strong>${Portal.formatNumber(box.rows.length)}</strong> قضايا</span>
              ${
                box.inbox
                  ? ""
                  : `<span><strong>${Portal.formatNumber(openTasks)}</strong> مهام قيد العمل</span>`
              }
            </p>
            ${leadControlHtml(box)}
          </div>`;
        })
        .join("")}</div>`;
      return;
    }
    const box = openBox();
    casesMount.innerHTML = casesTableHtml(
      box?.rows || [],
      isInboxView() ? "لا توجد قضايا جديدة في الصندوق." : "لا توجد قضايا في هذا القسم الفرعي بعد."
    );
  }

  function attachmentHref(item) {
    if (item?.filename && item?.id) return `${Portal.apiRoot()}/dashboard/attachments/${encodeURIComponent(item.id)}`;
    if (item?.url) return item.url;
    if (item?.id) return `${Portal.apiRoot()}/dashboard/attachments/${encodeURIComponent(item.id)}`;
    return "";
  }

  function attachmentViewHref(item) {
    const href = attachmentHref(item);
    return href ? `${href}?view=1` : "";
  }

  function guessAttachmentMime(mimeType, ...names) {
    const mime = String(mimeType || "").trim().toLowerCase();
    if (mime && mime !== "application/octet-stream") return mime;
    const combined = names.filter(Boolean).join(" ").toLowerCase();
    if (combined.includes(".pdf")) return "application/pdf";
    if (/\.png/.test(combined)) return "image/png";
    if (/\.jpe?g/.test(combined)) return "image/jpeg";
    if (/\.gif/.test(combined)) return "image/gif";
    if (/\.webp/.test(combined)) return "image/webp";
    if (/\.docx$/.test(combined)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (/\.doc$/.test(combined)) return "application/msword";
    if (/\.xlsx$/.test(combined)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (/\.xls$/.test(combined)) return "application/vnd.ms-excel";
    if (/\.txt$/.test(combined)) return "text/plain";
    return mime || "application/octet-stream";
  }

  function previewFetchCredentials() {
    return typeof Portal.apiCredentials === "function" ? Portal.apiCredentials() : "same-origin";
  }

  function isOfficeAttachment(type, ...names) {
    const mime = String(type || "").toLowerCase();
    const combined = names.filter(Boolean).join(" ").toLowerCase();
    return (
      mime.includes("word") ||
      mime.includes("msword") ||
      mime.includes("excel") ||
      mime.includes("spreadsheet") ||
      /\.(docx?|xlsx?)$/i.test(combined)
    );
  }

  function revokePreviewObjectUrl() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  async function openAttachmentPreview(viewUrl, mimeType, label, originalName = "", filename = "") {
    const dialog = document.getElementById("attachmentPreviewDialog");
    const body = document.getElementById("attachmentPreviewBody");
    const title = document.getElementById("attachmentPreviewTitle");
    if (!viewUrl || !dialog || !body || !title) return;

    title.textContent = label || "معاينة المرفق";
    body.innerHTML = `<p class="portal-detail-loading">جاري تحميل المعاينة...</p>`;
    dialog.showModal();

    const guessedType = guessAttachmentMime(mimeType, originalName, filename, label);
    try {
      const res = await fetch(viewUrl, { credentials: previewFetchCredentials() });
      if (!res.ok) {
        let message = "تعذر فتح المرفق.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          /* ignore non-JSON errors */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const type = blob.type && blob.type !== "application/octet-stream" ? blob.type : guessedType;
      const downloadName = originalName || filename || label || "attachment";
      revokePreviewObjectUrl();
      previewObjectUrl = URL.createObjectURL(new Blob([blob], { type }));
      if (type.startsWith("image/")) {
        body.innerHTML = `<img class="portal-preview-image" src="${previewObjectUrl}" alt="${Portal.escapeHtml(label || "مرفق")}" />`;
        return;
      }
      if (type === "application/pdf") {
        body.innerHTML = `<iframe class="portal-preview-frame" src="${previewObjectUrl}" title="${Portal.escapeHtml(label || "مرفق")}"></iframe>`;
        return;
      }
      if (type === "text/plain" || type.startsWith("text/")) {
        body.innerHTML = `<pre class="portal-preview-text">${Portal.escapeHtml(await blob.text())}</pre>`;
        return;
      }
      const officeHint = isOfficeAttachment(type, originalName, filename, label)
        ? "ملفات Word وExcel لا تُعرض داخل المتصفح."
        : "هذا النوع من الملفات لا يُعرض داخل المتصفح.";
      body.innerHTML = `<div class="portal-preview-fallback">
        <p class="portal-alert">${officeHint} يمكنك تنزيله لفتحه على جهازك.</p>
        <a class="btn" href="${Portal.escapeHtml(previewObjectUrl)}" download="${Portal.escapeHtml(downloadName)}">تنزيل المرفق</a>
      </div>`;
    } catch (error) {
      body.innerHTML = `<p class="portal-alert portal-alert--error">${Portal.escapeHtml(error.message)}</p>`;
    }
  }

  function savedAttachmentRow(item) {
    const href = attachmentHref(item);
    const viewHref = attachmentViewHref(item);
    const label = item.label || item.originalName || item.filename || "مرفق";
    const mimeType = item.mimeType || "";
    const originalName = item.originalName || "";
    const filename = item.filename || "";
    const canView = Boolean(viewHref && item.filename);
    return `<div class="portal-attachment-row portal-attachment-row--saved">
      <div class="portal-attachment-saved-info">
        <strong>${Portal.escapeHtml(label)}</strong>
      </div>
      <div class="portal-attachment-saved-actions">
        ${
          canView
            ? `<button type="button" class="portal-attachment-view-btn" data-action="view-attachment" data-view-url="${Portal.escapeHtml(viewHref)}" data-mime-type="${Portal.escapeHtml(mimeType)}" data-original-name="${Portal.escapeHtml(originalName)}" data-filename="${Portal.escapeHtml(filename)}" data-label="${Portal.escapeHtml(label)}" aria-label="عرض ${Portal.escapeHtml(label)}">معاينة</button>`
            : ""
        }
        ${
          href
            ? `<a class="portal-attachment-download-link" href="${Portal.escapeHtml(href)}" target="_blank" rel="noopener">تنزيل</a>`
            : ""
        }
      </div>
    </div>`;
  }

  function timelineHtml(tasks) {
    if (!tasks.length) {
      return '<p class="portal-detail-empty">لا توجد مهام بعد لهذه القضية.</p>';
    }
    return `<ol class="portal-timeline">${tasks
      .map((task) => {
        const when = task.due_at || task.assigned_at || task.created_at;
        const waiting = task.waiting_for
          ? `بانتظار إنجاز «${Portal.escapeHtml(task.waiting_for.title)}»${
              task.waiting_for.due_at ? ` · ${Portal.formatTaskDue(task.waiting_for.due_at)}` : ""
            }`
          : task.status === "missed"
            ? "فائتة"
            : task.status === "open"
              ? "جاهزة للعمل"
              : "أُنجزت";
        const caseLine = task.case_title
          ? `<span class="portal-timeline__meta">${Portal.escapeHtml(task.case_title)}</span>`
          : "";
        const selectAttr = task.case_id ? ` data-select-case="${Portal.escapeHtml(task.case_id)}" tabindex="0"` : "";
        const itemClass =
          task.status === "done" ? "is-done" : task.status === "missed" ? "is-missed" : "is-open";
        return `<li class="portal-timeline__item ${itemClass}"${selectAttr}>
          <span class="portal-timeline__dot" aria-hidden="true"></span>
          <div class="portal-timeline__body">
            <strong>${Portal.escapeHtml(task.title)}</strong>
            ${caseLine}
            <span class="portal-timeline__meta">${Portal.escapeHtml(task.assignee_name || "غير معيّن")} · ${when ? Portal.formatTaskDue(when) : "بدون موعد"}</span>
            <span class="portal-timeline__wait">${waiting}</span>
          </div>
        </li>`;
      })
      .join("")}</ol>`;
  }

  function subsectionTasksHtml(rows) {
    const tasks = [];
    for (const item of rows) {
      for (const task of item.tasks || []) {
        tasks.push({ ...task, case_id: item.id, case_title: item.title });
      }
    }
    if (!tasks.length) return '<p class="portal-detail-empty">لا توجد مهام في هذا القسم الفرعي بعد.</p>';
    return timelineHtml(tasks);
  }

  function renderSubsectionOverview() {
    const box = openBox();
    if (!box) return;
    placeholder.hidden = true;
    casePanel.hidden = false;
    const openTasks = openTaskCount(box.rows);
    casePanel.innerHTML = `
      <div class="portal-detail-head">
        <h2>${Portal.escapeHtml(box.name)}</h2>
      </div>
      ${
        box.inbox
          ? `<p class="portal-detail-empty">${
              canAssignLeads
                ? "عيّن كل قضية واردة إلى قسم فرعي لنقلها من الصندوق."
                : "هذه القضايا بانتظار تصنيف مدير القسم."
            }</p>`
          : box.id !== UNCATEGORIZED_ID
            ? canAssignLeads
              ? leadSelectHtml(box.id, box.lead?.id || "")
              : `<div class="portal-detail-row"><span>المسؤول</span><strong>${Portal.escapeHtml(box.lead?.name || "غير معيّن")}</strong></div>`
            : ""
      }
      ${box.inbox ? "" : `<div class="portal-detail-row"><span>القضايا</span><strong>${Portal.formatNumber(box.rows.length)}</strong></div>`}
      ${box.inbox ? "" : `<div class="portal-detail-row"><span>مهام قيد العمل</span><strong>${Portal.formatNumber(openTasks)}</strong></div>`}
      ${
        box.inbox
          ? ""
          : `<p class="portal-detail-empty">اختر قضية من الجدول لعرض بياناتها ومرفقاتها ومسار المهام.</p>`
      }`;
  }

  function renderCaseDetail() {
    const item = selectedCase();
    if (!casePanel || !placeholder) return;
    if (hasSubsectionBoxes() && !openSubsectionId) {
      placeholder.hidden = true;
      casePanel.hidden = true;
      casePanel.innerHTML = "";
      return;
    }
    if (!item) {
      if (openSubsectionId) {
        renderSubsectionOverview();
        return;
      }
      placeholder.hidden = false;
      casePanel.hidden = true;
      casePanel.innerHTML = "";
      return;
    }
    placeholder.hidden = true;
    casePanel.hidden = false;
    const attachments = (item.attachments || []).filter((file) => file && (file.id || file.filename));
    casePanel.innerHTML = `
      <div class="portal-detail-head">
        <h2>${Portal.escapeHtml(item.title)}</h2>
        <div class="portal-detail-head-actions">
          <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeCasePreviewBtn">إغلاق</button>
        </div>
      </div>
      <div class="portal-detail-row"><span>الموكل</span><strong>${Portal.escapeHtml(item.client_name || "—")}${item.client_phone ? ` · ${Portal.escapeHtml(item.client_phone)}` : ""}</strong></div>
      ${
        canAssignLeads && subsectionOfCase(item) === UNCATEGORIZED_ID
          ? `<div class="portal-detail-row"><span>تعيين إلى</span>${subsectionAssignSelect(item.id)}</div>`
          : (section?.subsections || []).length
            ? `<div class="portal-detail-row"><span>القسم الفرعي</span><strong>${Portal.escapeHtml(item.subsection_name || "—")}</strong></div>`
            : ""
      }
      <div class="portal-detail-row"><span>المسؤول</span><strong>${Portal.escapeHtml(caseResponsibleLabel(item))}</strong></div>
      <div class="portal-detail-row"><span>الحالة</span><strong>${Portal.statusLabel(item.status)}</strong></div>
      <h3 class="portal-detail-subtitle">ملاحظات</h3>
      <p class="portal-detail-text">${item.notes ? Portal.escapeHtml(item.notes) : "لا توجد ملاحظات."}</p>
      <h3 class="portal-detail-subtitle">المرفقات</h3>
      <div class="portal-attachments" id="sectionAttachmentsList">
        ${attachments.length ? attachments.map(savedAttachmentRow).join("") : '<p class="portal-detail-empty">لا توجد مرفقات.</p>'}
      </div>
      ${
        canUpload
          ? `<form class="portal-section-upload" id="sectionUploadForm">
              <label><span>اسم المرفق</span><input type="text" name="label" required /></label>
              <label><span>الملف</span><input type="file" name="file" required accept="${Portal.escapeHtml(Portal.UPLOAD_ACCEPT || ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt")}" /></label>
              <button class="btn" type="submit">رفع مرفق</button>
            </form>`
          : ""
      }
      <div id="sectionCaseAlert" class="portal-alert portal-alert--error" hidden></div>
      <h3 class="portal-detail-subtitle">مسار المهام</h3>
      ${timelineHtml(item.tasks || [])}`;
  }

  async function assignCaseToSubsection(caseId, subsectionId) {
    if (!caseId || !subsectionId) return;
    try {
      await Portal.request(`/dashboard/cases/${encodeURIComponent(caseId)}`, {
        method: "PATCH",
        body: JSON.stringify({ subsection_id: subsectionId }),
      });
      Portal.showToast("تم تعيين القضية إلى القسم الفرعي.", "success");
      selectedId = "";
      await reload();
    } catch (error) {
      Portal.showAlert(alertEl, error.message);
    }
  }

  function setSelected(caseId, pushUrl = true) {
    selectedId = caseId || "";
    if (selectedId && hasSubsectionBoxes()) {
      const item = selectedCase();
      if (item) openSubsectionId = subsectionOfCase(item);
    }
    if (pushUrl) writeSectionUrl();
    renderCases();
    renderCaseDetail();
  }

  async function reload() {
    const data = await Portal.request(`/sections/${encodeURIComponent(sectionId)}`);
    section = data.section;
    cases = data.cases || [];
    candidates = data.candidates || { managers: [], lawyers: [] };
    canEditTeam = Boolean(section?.can_edit);
    canDeleteTeam = Boolean(section?.can_delete);
    canAssignLeads = Boolean(section?.can_assign_leads);
    if (titleEl) titleEl.textContent = section?.name || "القسم";
    if (leadEl) {
      const stats = section?.stats;
      leadEl.textContent = stats
        ? `${Portal.formatNumber(stats.cases)} قضايا · ${Portal.formatNumber(stats.lawyers)} محامين · ${Portal.formatNumber(stats.tasks_open)} مهام قيد العمل`
        : "قضايا القسم ومسار المهام.";
    }
    if (selectedId && !cases.some((item) => item.id === selectedId)) selectedId = "";
    if (hasSubsectionBoxes()) {
      const valid = new Set(subsectionBoxes().map((box) => box.id));
      if (openSubsectionId && !valid.has(openSubsectionId)) openSubsectionId = "";
      if (!openSubsectionId) {
        const fromQuery = new URLSearchParams(window.location.search).get("ss") || "";
        if (fromQuery && valid.has(fromQuery)) openSubsectionId = fromQuery;
        else if (selectedId) openSubsectionId = subsectionOfCase(selectedCase());
      }
    } else {
      openSubsectionId = "";
    }
    renderTeam();
    renderCases();
    renderCaseDetail();
  }

  async function boot() {
    const user = await Portal.requireAuth();
    if (!user) return;
    currentUser = user;
    if (!["admin", "assistant", "section_manager"].includes(user.role)) {
      window.location.href = "home.html";
      return;
    }
    const back = document.getElementById("sectionBackToList");
    if (back) back.hidden = user.role === "section_manager";
    sectionId = resolveSectionId();
    selectedId = new URLSearchParams(window.location.search).get("case") || "";
    if (!sectionId) {
      try {
        const list = await Portal.request("/sections");
        const first = (list.sections || [])[0];
        if (first?.id) sectionId = first.id;
      } catch {
        /* keep empty */
      }
    }
    if (!sectionId) {
      Portal.showAlert(alertEl, "لم يتم تحديد القسم. ارجع إلى الأقسام وافتح القسم من الزر.");
      return;
    }
    try {
      sessionStorage.setItem("gz_portal_section_id", sectionId);
    } catch {
      /* ignore */
    }
    const next = new URL(window.location.href);
    if (next.searchParams.get("id") !== sectionId) {
      next.searchParams.set("id", sectionId);
      history.replaceState({}, "", next);
    }
    canUpload = user.role === "admin" || user.role === "assistant" || user.role === "section_manager";
    PortalNav.init(user);

    const previewDialog = document.getElementById("attachmentPreviewDialog");
    document.getElementById("closeAttachmentPreviewBtn")?.addEventListener("click", () => {
      previewDialog?.close();
    });
    previewDialog?.addEventListener("close", () => {
      revokePreviewObjectUrl();
      const body = document.getElementById("attachmentPreviewBody");
      if (body) body.innerHTML = "";
    });
    document.body.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action='view-attachment']");
      if (!btn) return;
      event.preventDefault();
      openAttachmentPreview(
        btn.dataset.viewUrl,
        btn.dataset.mimeType,
        btn.dataset.label,
        btn.dataset.originalName,
        btn.dataset.filename
      );
    });

    casesMount?.addEventListener("click", (event) => {
      if (event.target.closest("[data-ss-lead-wrap], [data-ss-assign-wrap], select, label")) return;
      const ssCard = event.target.closest("[data-open-ss]");
      if (ssCard) {
        setOpenSubsection(ssCard.dataset.openSs);
        return;
      }
      const row = event.target.closest("[data-case-id]");
      if (row) setSelected(row.dataset.caseId);
    });
    casesMount?.addEventListener("keydown", (event) => {
      if (event.target.closest("select")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      const ssCard = event.target.closest("[data-open-ss]");
      if (ssCard) {
        event.preventDefault();
        setOpenSubsection(ssCard.dataset.openSs);
        return;
      }
      const row = event.target.closest("[data-case-id]");
      if (!row) return;
      event.preventDefault();
      setSelected(row.dataset.caseId);
    });
    casesMount?.addEventListener("change", async (event) => {
      const assignSelect = event.target.closest("[data-assign-ss]");
      if (assignSelect) {
        event.stopPropagation();
        await assignCaseToSubsection(assignSelect.dataset.assignSs, assignSelect.value);
        return;
      }
      const leadSelect = event.target.closest("[data-ss-lead]");
      if (!leadSelect) return;
      event.stopPropagation();
      await saveSubsectionLead(leadSelect.dataset.ssLead, leadSelect.value);
    });
    document.getElementById("sectionBackToBoxes")?.addEventListener("click", () => {
      setOpenSubsection("");
    });
    casePanel?.addEventListener("click", (event) => {
      if (event.target.closest("#closeCasePreviewBtn")) {
        setSelected("");
        return;
      }
      const taskRow = event.target.closest("[data-select-case]");
      if (taskRow) setSelected(taskRow.dataset.selectCase);
    });
    casePanel?.addEventListener("change", async (event) => {
      const assignSelect = event.target.closest("[data-assign-ss]");
      if (assignSelect) {
        await assignCaseToSubsection(assignSelect.dataset.assignSs, assignSelect.value);
        return;
      }
      const leadSelect = event.target.closest("[data-ss-lead]");
      if (!leadSelect) return;
      await saveSubsectionLead(leadSelect.dataset.ssLead, leadSelect.value);
    });

    teamPanel?.addEventListener("change", async (event) => {
      const managerSelect = event.target.closest("#sectionManagerSelect");
      if (managerSelect) {
        if (!managerSelect.value) return;
        try {
          await Portal.request(`/sections/${sectionId}/manager`, {
            method: "PATCH",
            body: JSON.stringify({ manager_id: managerSelect.value }),
          });
          Portal.showToast("تم تعيين مدير القسم.", "success");
          await reload();
        } catch (error) {
          Portal.showAlert(alertEl, error.message);
        }
        return;
      }
      const addSelect = event.target.closest("#sectionAddLawyer");
      if (addSelect?.value) {
        try {
          await Portal.request(`/sections/${sectionId}/members`, {
            method: "POST",
            body: JSON.stringify({ user_id: addSelect.value }),
          });
          Portal.showToast("تم إضافة المحامي.", "success");
          await reload();
        } catch (error) {
          Portal.showAlert(alertEl, error.message);
        }
        return;
      }
      const ssSelect = event.target.closest("[data-member-ss]");
      if (ssSelect) {
        try {
          await Portal.request(
            `/sections/${encodeURIComponent(sectionId)}/members/${encodeURIComponent(ssSelect.dataset.memberSs)}/subsection`,
            {
              method: "PATCH",
              body: JSON.stringify({ subsection_id: ssSelect.value || "" }),
            }
          );
          Portal.showToast(
            ssSelect.value ? "تم تعيين المحامي إلى القسم الفرعي." : "تم إلغاء تعيين القسم الفرعي.",
            "success"
          );
          await reload();
        } catch (error) {
          Portal.showAlert(alertEl, error.message);
          await reload();
        }
      }
    });

    teamPanel?.addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-remove-member]");
      if (!btn || !canDeleteTeam) return;
      try {
        await Portal.request(`/sections/${sectionId}/members/${btn.dataset.removeMember}`, { method: "DELETE" });
        Portal.showToast("تم إزالة المحامي.", "success");
        await reload();
      } catch (error) {
        Portal.showAlert(alertEl, error.message);
      }
    });

    document.body.addEventListener("submit", async (event) => {
      const form = event.target.closest("#sectionUploadForm");
      if (!form) return;
      event.preventDefault();
      const item = selectedCase();
      const caseAlert = document.getElementById("sectionCaseAlert");
      if (!item) return;
      const fd = new FormData(form);
      const file = fd.get("file");
      const label = String(fd.get("label") || "").trim();
      if (!file || !label) {
        Portal.showAlert(caseAlert, "اسم المرفق والملف مطلوبان.");
        return;
      }
      if (file instanceof File && Portal.isBlockedUploadFile?.(file)) {
        Portal.showAlert(caseAlert, Portal.ZIP_REJECT_MESSAGE || "لا يمكن رفع ملفات ZIP.");
        return;
      }
      try {
        const uploadFd = new FormData();
        uploadFd.append("file", file);
        uploadFd.append("label", label);
        const uploaded = await Portal.upload(`/dashboard/cases/${item.id}/attachments`, uploadFd);
        const attachments = [...(item.attachments || []), uploaded.attachment];
        await Portal.request(`/dashboard/cases/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ attachments }),
        });
        Portal.showToast("تم رفع المرفق.", "success");
        await reload();
        setSelected(item.id, false);
      } catch (error) {
        Portal.showAlert(caseAlert, error.message);
      }
    });

    try {
      await reload();
    } catch (error) {
      Portal.showAlert(alertEl, error.message || "تعذر تحميل القسم.");
    }
  }

  boot();
  return { boot };
})();
