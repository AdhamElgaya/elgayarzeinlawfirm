const PortalDash = (() => {
  const PREVIEW_LIMIT = 5;
  let pageType = "home";
  const welcomeText = document.getElementById("welcomeText");
  const statsGrid = document.getElementById("statsGrid");
  const casesList = document.getElementById("casesList");
  const tasksList = document.getElementById("tasksList");
  const adminLink = document.getElementById("adminLink");
  const adminNavLinks = document.getElementById("adminNavLinks");
  const addCaseBtn = document.getElementById("addCaseBtn");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const addClientBtn = document.getElementById("addClientBtn");
  const clientsPanel = document.getElementById("clientsPanel");
  const clientsList = document.getElementById("clientsList");
  let addCaseDialog;
  let addTaskDialog;
  let editTaskDialog;
  let editCaseDialog;
  let addClientDialog;
  let detailDialog;
  let detailDialogBody;
  let confirmDeleteDialog;
  let confirmDeleteMessage;
  let confirmDeleteCancel;
  let confirmDeleteOk;
  let attachmentPreviewDialog;
  let attachmentPreviewBody;
  let attachmentPreviewTitle;
  let previewObjectUrl = null;
  let addCaseForm;
  let addTaskForm;
  let editTaskForm;
  let editCaseForm;
  let addClientForm;
  let addCaseAlert;
  let addTaskAlert;
  let editTaskAlert;
  let editCaseAlert;
  let addClientAlert;
  let caseAssigneeSelect;
  let caseClientSelect;
  let taskAssigneeSelect;
  let editTaskAssigneeSelect;
  let taskAssigneeField;
  let taskCaseSelect;
  const clientsSearch = document.getElementById("clientsSearch");
  const casesSearch = document.getElementById("casesSearch");
  const tasksSearch = document.getElementById("tasksSearch");
  const taskStatusFilter = document.getElementById("taskStatusFilter");
  const taskAssigneeFilter = document.getElementById("taskAssigneeFilter");
  const taskAssigneeFilterWrap = document.getElementById("taskAssigneeFilterWrap");
  const taskDateInput = document.getElementById("taskDateInput");
  const taskDatePrev = document.getElementById("taskDatePrev");
  const taskDateNext = document.getElementById("taskDateNext");
  const taskDateToday = document.getElementById("taskDateToday");
  const taskShowAllBtn = document.getElementById("taskShowAllBtn");
  const taskScopeGroup = document.getElementById("taskScopeGroup");
  const taskScopeMineBtn = document.getElementById("taskScopeMineBtn");
  const taskScopeAllBtn = document.getElementById("taskScopeAllBtn");

  let assignees = [];
  let clients = [];
  let assigneeNames = {};
  let isAdminUser = false;
  let dashboardUser = null;
  let dashboardData = null;
  let archivedCases = [];
  let taskDateMode = "today";
  let taskScopeMode = "mine";
  let selectedTaskDate = Portal.formatDateInput(new Date());

  function badge(status) {
    const valid = ["active", "finished", "open", "done", "archived"];
    if (!valid.includes(status)) return "";
    const cls =
      status === "active"
        ? "portal-badge--active"
        : status === "finished" || status === "done"
          ? "portal-badge--finished"
          : "portal-badge--open";
    return `<span class="portal-badge ${cls}">${Portal.statusLabel(status)}</span>`;
  }

  function showMoreBtn(action, id) {
    return `<button type="button" class="portal-link-btn" data-action="${action}" data-id="${Portal.escapeHtml(id)}">عرض المزيد</button>`;
  }

  function renderWelcome(user) {
    if (!welcomeText) return;
    welcomeText.textContent = `${Portal.t("portal.dashboard.welcome", "مرحباً،")} ${user.name}`;
  }

  function renderStats(stats) {
    if (!statsGrid) return;
    const items = [
      [Portal.t("portal.dashboard.stat.activeCases", "قضايا نشطة"), stats.activeCases],
      [Portal.t("portal.dashboard.stat.finishedCases", "قضايا منتهية"), stats.finishedCases],
      [Portal.t("portal.dashboard.stat.openTasks", "مهام مفتوحة"), stats.openTasks],
      [Portal.t("portal.dashboard.stat.archivedCases", "قضايا مؤرشفة"), stats.archivedCases],
    ];
    statsGrid.innerHTML = items
      .map(
        ([label, value]) =>
          `<div class="portal-stat"><strong>${Portal.formatNumber(value)}</strong><span>${label}</span></div>`
      )
      .join("");
  }

  function emptyState(message) {
    return `<li class="portal-list-empty"><div class="portal-empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M4 8h16M4 8l1.5 10h13L20 8M9 12h6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <p>${message}</p>
    </div></li>`;
  }

  function normalizeSearch(value) {
    return String(value || "").trim().toLowerCase();
  }

  function filterClients(rows) {
    const q = normalizeSearch(clientsSearch?.value);
    if (!q) return rows;
    return rows.filter((client) => {
      const relatedCases = (dashboardData?.cases || []).filter((c) => c.client_id === client.id);
      const caseTitles = relatedCases.map((c) => c.title).join(" ");
      const haystack = [client.name, client.phone || "", caseTitles]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  function filterCases(rows) {
    const q = normalizeSearch(casesSearch?.value);
    if (!q) return rows;
    return rows.filter((c) => {
      const lawyer = assigneeNames[c.assigned_to] || "";
      const haystack = [
        c.title,
        c.client_name || "",
        lawyer,
        Portal.statusLabel(c.status),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  function filterTasks(rows) {
    let filtered = [...rows];

    if (isAdminUser && pageType === "tasks" && taskScopeMode === "mine" && dashboardUser?.id) {
      filtered = filtered.filter((t) => t.assigned_to === dashboardUser.id);
    }

    if (taskDateMode === "today") {
      filtered = filtered.filter((t) => {
        if (!t.due_at) return Portal.sameCalendarDay(t.created_at, selectedTaskDate);
        return Portal.sameCalendarDay(t.due_at, selectedTaskDate);
      });
    }

    const status = taskStatusFilter?.value || "";
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }

    const assignee = taskAssigneeFilter?.value || "";
    if (assignee) {
      filtered = filtered.filter((t) => t.assigned_to === assignee);
    }

    const q = normalizeSearch(tasksSearch?.value);
    if (q) {
      filtered = filtered.filter((t) => {
        const assigneeName = assigneeNames[t.assigned_to] || t.assignee_name || "";
        const haystack = [
          t.title,
          t.case_title || "",
          assigneeName,
          Portal.formatAssignmentStamp(t.assigned_at || t.created_at),
          Portal.statusLabel(t.status),
          t.due_at ? Portal.formatDateInput(t.due_at) : "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return filtered;
  }

  function renderClients(clientRows, listEl = clientsList) {
    if (!listEl) return;
    const rows = pageType === "clients" ? filterClients(clientRows) : clientRows;
    if (!rows.length) {
      listEl.innerHTML = emptyState(
        clientRows.length ? "لا توجد نتائج مطابقة للبحث." : "لا يوجد موكلون بعد. أضف موكلاً أولاً."
      );
      return;
    }
    listEl.innerHTML = rows
      .map(
        (client) => `<li class="portal-list-item">
          <div class="portal-list-item__row">
            <div class="portal-list-item__content">
              <div class="portal-list-item__head">
                <strong>${Portal.escapeHtml(client.name)}</strong>
              </div>
              ${
                client.phone
                  ? `<span class="portal-list-item__meta">${Portal.escapeHtml(client.phone)}</span>`
                  : ""
              }
            </div>
            ${showMoreBtn("show-client", client.id)}
          </div>
        </li>`
      )
      .join("");
  }

  function renderCases(cases, listEl = casesList) {
    if (!listEl) return;
    const usesCaseFilter = pageType === "cases" || pageType === "archived";
    const rows = usesCaseFilter ? filterCases(cases) : cases;
    if (!rows.length) {
      const emptyMsg =
        pageType === "archived"
          ? cases.length
            ? "لا توجد نتائج مطابقة للبحث."
            : "لا توجد قضايا مؤرشفة."
          : cases.length
            ? "لا توجد نتائج مطابقة للبحث."
            : Portal.t("portal.dashboard.noCases", "لا توجد قضايا معينة بعد.");
      listEl.innerHTML = emptyState(emptyMsg);
      return;
    }
    const assigned = Portal.t("portal.dashboard.assignedTo", "معيّنة إلى:");
    listEl.innerHTML = rows
      .map((c) => {
        const assigneeLine =
          isAdminUser && c.assigned_to && assigneeNames[c.assigned_to]
            ? `${assigned} ${Portal.escapeHtml(assigneeNames[c.assigned_to])}`
            : "";
        const clientLine = c.client_name ? `الموكل: ${Portal.escapeHtml(c.client_name)}` : "";
        return `<li class="portal-list-item">
          <div class="portal-list-item__row">
            <div class="portal-list-item__content">
              <div class="portal-list-item__head">
                <strong>${Portal.escapeHtml(c.title)}</strong>
                ${badge(c.status)}
              </div>
              ${clientLine ? `<span class="portal-list-item__assignee">${clientLine}</span>` : ""}
              ${assigneeLine ? `<span class="portal-list-item__assignee">${assigneeLine}</span>` : ""}
            </div>
            ${showMoreBtn("show-case", c.id)}
          </div>
        </li>`;
      })
      .join("");
  }

  function renderTasks(tasks, listEl = tasksList) {
    if (!listEl) return;
    const rows = pageType === "tasks" ? filterTasks(tasks) : tasks;
    if (!rows.length) {
      const hasFilters =
        pageType === "tasks" &&
        (taskDateMode === "today" ||
          tasksSearch?.value ||
          taskStatusFilter?.value ||
          taskAssigneeFilter?.value ||
          (isAdminUser && taskScopeMode === "mine"));
      const emptyMsg = hasFilters
        ? "لا توجد مهام مطابقة للبحث أو التاريخ المحدد."
        : Portal.t("portal.dashboard.noTasks", "لا توجد مهام بعد.");
      listEl.innerHTML = emptyState(emptyMsg);
      return;
    }
    const due = Portal.t("portal.dashboard.due", "مستحق:");
    const assigned = Portal.t("portal.dashboard.assignedTo", "معيّنة إلى:");
    listEl.innerHTML = rows
      .map((t) => {
        const assignmentLine = taskAssignmentHtml(t);
        const assigneeLine = assignmentLine ? `${assigned} ${assignmentLine}` : "";
        const statusClass = t.status === "done" ? "portal-list-item--done" : "portal-list-item--open";
        return `<li class="portal-list-item ${statusClass}">
          <div class="portal-list-item__row">
            <div class="portal-list-item__content">
              <div class="portal-list-item__head">
                <strong>${Portal.escapeHtml(t.title)}</strong>
                ${badge(t.status)}
              </div>
              ${assigneeLine ? `<span class="portal-list-item__assignee">${assigneeLine}</span>` : ""}
              <span class="portal-list-item__meta">${Portal.escapeHtml(t.case_title)}${t.due_at ? ` — ${due} ${Portal.formatTaskDue(t.due_at)}` : ""}</span>
            </div>
            ${showMoreBtn("show-task", t.id)}
          </div>
        </li>`;
      })
      .join("");
  }

  function fillClientSelectOptions(select, selectedId = null) {
    if (!select) return;
    if (!clients.length) {
      select.innerHTML = '<option value="">لا يوجد موكلون — أضف موكلاً أولاً</option>';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = clients
      .map((c) => {
        const selected = selectedId === c.id ? " selected" : "";
        return `<option value="${c.id}"${selected}>${Portal.escapeHtml(c.name)}</option>`;
      })
      .join("");
  }

  function fillClientSelect() {
    fillClientSelectOptions(caseClientSelect);
  }

  function fillAssigneeSelectOptions(select, selectedId = null) {
    if (!select) return;
    select.innerHTML = assignees
      .map((u) => {
        const selected = selectedId === u.id ? " selected" : "";
        return `<option value="${u.id}"${selected}>${Portal.escapeHtml(u.name)} — ${Portal.roleLabel(u.role)}</option>`;
      })
      .join("");

    if (selectedId && ![...select.options].some((option) => option.value === selectedId)) {
      const name = assigneeNames[selectedId];
      if (name) {
        const option = document.createElement("option");
        option.value = selectedId;
        option.textContent = name;
        option.selected = true;
        select.append(option);
      }
    }
  }

  function fillAssigneeSelect(select) {
    fillAssigneeSelectOptions(select);
  }

  function fillTaskAssigneeSelect(select, selectedId = null) {
    if (!select) return;
    const selfOption =
      dashboardUser?.id && isAdminUser
        ? `<option value="${Portal.escapeHtml(dashboardUser.id)}">لنفسي</option>`
        : "";
    const teamOptions = assignees
      .filter((u) => u.id !== dashboardUser?.id)
      .map(
        (u) =>
          `<option value="${u.id}">${Portal.escapeHtml(u.name)} — ${Portal.roleLabel(u.role)}</option>`
      )
      .join("");
    select.innerHTML = selfOption + teamOptions;

    const targetId = selectedId || (isAdminUser ? dashboardUser?.id : null);
    if (!targetId) return;

    if (![...select.options].some((option) => option.value === targetId)) {
      const label = assigneeNames[targetId] || "معيّن سابق";
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${Portal.escapeHtml(targetId)}">${Portal.escapeHtml(label)}</option>`
      );
    }
    select.value = targetId;
  }

  function fillTaskAssigneeFilter() {
    if (!isAdminUser || !taskAssigneeFilter) return;
    taskAssigneeFilter.innerHTML =
      `<option value="">كل المعيّنين</option>` +
      assignees
        .map((u) => `<option value="${u.id}">${Portal.escapeHtml(u.name)}</option>`)
        .join("");
  }

  function fillCaseSelect() {
    if (!taskCaseSelect) return;
    const cases = dashboardData?.cases || [];
    if (!cases.length) {
      taskCaseSelect.innerHTML = '<option value="">لا توجد قضايا بعد</option>';
      taskCaseSelect.disabled = true;
      return;
    }
    taskCaseSelect.disabled = false;
    taskCaseSelect.innerHTML = cases
      .map((c) => `<option value="${c.id}">${Portal.escapeHtml(c.title)}</option>`)
      .join("");
  }

  async function renderTaskCaseAttachmentPicks(caseId, options = {}) {
    const wrapId = options.wrapId || "taskCaseAttachmentsWrap";
    const listId = options.listId || "taskCaseAttachmentsList";
    const selectedIds = new Set(options.selectedIds || []);
    const checkboxName = options.checkboxName || "task_attachment_ids";
    const wrap = document.getElementById(wrapId);
    const list = document.getElementById(listId);
    if (!wrap || !list) return;

    if (!caseId) {
      wrap.hidden = true;
      list.innerHTML = "";
      return;
    }

    let attachments = [];
    try {
      const data = await Portal.request(`/dashboard/cases/${caseId}`);
      attachments = (data.case?.attachments || []).filter(isSavedAttachment);
    } catch {
      const localCase = (dashboardData?.cases || []).find((c) => c.id === caseId);
      attachments = (localCase?.attachments || []).filter(isSavedAttachment);
    }

    if (!attachments.length) {
      wrap.hidden = true;
      list.innerHTML = "";
      return;
    }

    wrap.hidden = false;
    list.innerHTML = attachments
      .map(
        (item) =>
          `<label class="portal-task-attachment-pick">
            <input type="checkbox" name="${Portal.escapeHtml(checkboxName)}" value="${Portal.escapeHtml(item.id)}"${selectedIds.has(item.id) ? " checked" : ""} />
            <span>${Portal.escapeHtml(item.label || item.originalName || item.filename || "مرفق")}</span>
          </label>`
      )
      .join("");
  }

  async function loadAssignees() {
    const path = isAdminUser ? "/admin/assignees" : "/dashboard/assignees";
    try {
      const data = await Portal.request(path);
      assignees = data.users || [];
    } catch {
      assignees = [];
    }
    assigneeNames = Object.fromEntries(assignees.map((u) => [u.id, u.name]));
    if (dashboardUser) {
      assigneeNames[dashboardUser.id] = dashboardUser.name;
    }
    if (isAdminUser) {
      fillAssigneeSelect(caseAssigneeSelect);
      fillTaskAssigneeSelect(taskAssigneeSelect);
      fillTaskAssigneeFilter();
    }
  }

  function syncClientsFromDashboard() {
    clients = dashboardData?.clients || [];
    fillClientSelect();
    if (isAdminUser) {
      renderClients(clients);
    }
  }

  function detailRow(label, value) {
    if (!value) return "";
    return `<div class="portal-detail-row"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function taskAssignmentHtml(task) {
    const name =
      (isAdminUser && task.assigned_to && assigneeNames[task.assigned_to]) ||
      task.assignee_name ||
      "";
    if (!name) return "";
    const when = Portal.formatAssignmentStamp(task.assigned_at || task.created_at);
    return when ? `${Portal.escapeHtml(name)} @ ${when}` : Portal.escapeHtml(name);
  }

  function deleteBtn(action, id, label = "حذف") {
    return `<button type="button" class="portal-btn-danger" data-action="${action}" data-id="${id}">${label}</button>`;
  }

  function editBtn(action, id, label = "تعديل") {
    return `<button type="button" class="portal-btn-ghost portal-btn-ghost--sm" data-action="${action}" data-id="${id}">${label}</button>`;
  }

  function archiveBtn(action, id, label = "أرشفة") {
    return `<button type="button" class="portal-btn-ghost portal-btn-ghost--sm portal-btn-archive" data-action="${action}" data-id="${id}">${label}</button>`;
  }

  function askDeleteConfirm(type) {
    const messages = {
      client: "سيتم حذف الموكل وجميع القضايا والمهمات المرتبطة به. هل تريد المتابعة؟",
      case: "سيتم حذف القضية وجميع المهام المرتبطة بها. هل تريد المتابعة؟",
      task: "هل أنت متأكد من حذف هذه المهمة؟",
    };
    confirmDeleteMessage.textContent = messages[type];
    return new Promise((resolve) => {
      const onCancel = () => {
        cleanup();
        resolve(false);
      };
      const onOk = () => {
        cleanup();
        resolve(true);
      };
      const cleanup = () => {
        confirmDeleteCancel.removeEventListener("click", onCancel);
        confirmDeleteOk.removeEventListener("click", onOk);
        confirmDeleteDialog.close();
      };
      confirmDeleteCancel.addEventListener("click", onCancel);
      confirmDeleteOk.addEventListener("click", onOk);
      confirmDeleteDialog.showModal();
    });
  }

  function askArchiveConfirm() {
    const titleEl = confirmDeleteDialog.querySelector("h2");
    const previousTitle = titleEl.textContent;
    const previousOkLabel = confirmDeleteOk.textContent;
    const previousOkClass = confirmDeleteOk.className;

    titleEl.textContent = "تأكيد الأرشفة";
    confirmDeleteMessage.textContent =
      "سيتم أرشفة القضية وإخفاؤها من القوائم النشطة. يمكنك الاطلاع على القضايا المؤرشفة من الإحصائيات لاحقاً. هل تريد المتابعة؟";
    confirmDeleteOk.textContent = "أرشفة";
    confirmDeleteOk.className = "btn";

    return new Promise((resolve) => {
      const onCancel = () => {
        cleanup();
        resolve(false);
      };
      const onOk = () => {
        cleanup();
        resolve(true);
      };
      const cleanup = () => {
        confirmDeleteCancel.removeEventListener("click", onCancel);
        confirmDeleteOk.removeEventListener("click", onOk);
        titleEl.textContent = previousTitle;
        confirmDeleteOk.textContent = previousOkLabel;
        confirmDeleteOk.className = previousOkClass;
        confirmDeleteDialog.close();
      };
      confirmDeleteCancel.addEventListener("click", onCancel);
      confirmDeleteOk.addEventListener("click", onOk);
      confirmDeleteDialog.showModal();
    });
  }

  async function archiveCaseEntity(id) {
    if (!id) return;
    const confirmed = await askArchiveConfirm();
    if (!confirmed) return;

    try {
      await Portal.request(`/dashboard/cases/${id}/archive`, { method: "POST" });
      detailDialog.close();
      await refresh();
    } catch (error) {
      const alertEl = document.getElementById("caseDetailAlert");
      if (alertEl) Portal.showAlert(alertEl, error.message);
      else window.alert(error.message);
    }
  }

  async function deleteEntity(type, id) {
    if (!id) return;
    const confirmed = await askDeleteConfirm(type);
    if (!confirmed) return;

    const endpoints = {
      client: `/admin/clients/${id}`,
      case: `/admin/cases/${id}`,
      task: `/dashboard/tasks/${id}`,
    };

    try {
      await Portal.request(endpoints[type], { method: "DELETE" });
      detailDialog.close();
      await refresh();
    } catch (error) {
      const alertId =
        type === "client" ? "clientDetailAlert" : type === "case" ? "caseDetailAlert" : "taskDetailAlert";
      const alertEl = document.getElementById(alertId);
      if (alertEl) Portal.showAlert(alertEl, error.message);
      else window.alert(error.message);
    }
  }

  async function openClientDetail(clientId) {
    detailDialogBody.innerHTML = `<p class="portal-detail-loading">جاري التحميل...</p>`;
    detailDialog.showModal();
    try {
      const data = await Portal.request(`/dashboard/clients/${clientId}`);
      const { client, cases } = data;
      const casesHtml = cases.length
        ? `<ul class="portal-detail-list">${cases
            .map(
              (c) =>
                `<li><button type="button" class="portal-inline-link" data-action="show-case" data-id="${c.id}">${Portal.escapeHtml(c.title)}</button> ${badge(c.status)}</li>`
            )
            .join("")}</ul>`
        : `<p class="portal-detail-empty">لا توجد قضايا مرتبطة بهذا الموكل.</p>`;
      detailDialogBody.innerHTML = `
        <div class="portal-detail" data-client-id="${client.id}">
          <div class="portal-detail-head portal-detail-head--client">
            <div class="portal-detail-title-block">
              <span class="portal-detail-label">اسم الموكل</span>
              <p class="portal-detail-name">${Portal.escapeHtml(client.name)}</p>
            </div>
            <div class="portal-detail-head-actions">
              ${deleteBtn("delete-client", client.id)}
              <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeDetailBtn">إغلاق</button>
            </div>
          </div>
          ${detailRow("الهاتف", client.phone ? Portal.escapeHtml(client.phone) : "—")}
          <h3 class="portal-detail-subtitle">القضايا المرتبطة</h3>
          ${casesHtml}
          <div id="clientDetailAlert" class="portal-alert portal-alert--error" hidden></div>
        </div>`;
    } catch (error) {
      detailDialogBody.innerHTML = `<p class="portal-alert portal-alert--error">${Portal.escapeHtml(error.message)}</p>`;
    }
  }

  function isSavedAttachment(item) {
    return Boolean(item?.id && (item.filename || item.url));
  }

  function attachmentHref(item) {
    const api = typeof Portal.apiRoot === "function" ? Portal.apiRoot() : "/api";
    if (item?.filename && item?.id) return `${api}/dashboard/attachments/${item.id}`;
    return item?.url || "";
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
    return mime || "application/octet-stream";
  }

  function revokePreviewObjectUrl() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  function renderTaskAttachmentListItem(item) {
    const href = attachmentHref(item);
    const viewHref = attachmentViewHref(item);
    const label = item.label || item.originalName || item.filename || "مرفق";
    const mimeType = item.mimeType || "";
    const originalName = item.originalName || "";
    const filename = item.filename || "";
    const canView = Boolean(viewHref && item.filename);

    return `<li class="portal-task-attachment-item">
      <span class="portal-task-attachment-item__label">${Portal.escapeHtml(label)}</span>
      <div class="portal-task-attachment-item__actions">
        ${
          canView
            ? `<button type="button" class="portal-attachment-view-btn" data-action="view-attachment" data-view-url="${Portal.escapeHtml(viewHref)}" data-mime-type="${Portal.escapeHtml(mimeType)}" data-original-name="${Portal.escapeHtml(originalName)}" data-filename="${Portal.escapeHtml(filename)}" data-label="${Portal.escapeHtml(label)}" aria-label="عرض ${Portal.escapeHtml(label)}">
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
    </li>`;
  }

  async function openAttachmentPreview(viewUrl, mimeType, label, originalName = "", filename = "") {
    if (!viewUrl || !attachmentPreviewDialog || !attachmentPreviewBody || !attachmentPreviewTitle) return;

    attachmentPreviewTitle.textContent = label || "معاينة المرفق";
    attachmentPreviewBody.innerHTML = `<p class="portal-detail-loading">جاري تحميل المعاينة...</p>`;
    attachmentPreviewDialog.showModal();

    const guessedType = guessAttachmentMime(mimeType, originalName, filename, label);

    try {
      const res = await fetch(viewUrl, { credentials: "same-origin" });
      if (!res.ok) throw new Error("تعذر فتح المرفق.");

      const blob = await res.blob();
      const type =
        blob.type && blob.type !== "application/octet-stream" ? blob.type : guessedType;
      revokePreviewObjectUrl();
      previewObjectUrl = URL.createObjectURL(new Blob([blob], { type }));

      if (type.startsWith("image/")) {
        attachmentPreviewBody.innerHTML = `<img class="portal-preview-image" src="${previewObjectUrl}" alt="${Portal.escapeHtml(label || "مرفق")}" />`;
        return;
      }

      if (type === "application/pdf") {
        attachmentPreviewBody.innerHTML = `<iframe class="portal-preview-frame" src="${previewObjectUrl}" title="${Portal.escapeHtml(label || "مرفق")}"></iframe>`;
        return;
      }

      attachmentPreviewDialog.close();
      window.open(previewObjectUrl, "_blank", "noopener");
    } catch (error) {
      attachmentPreviewBody.innerHTML = `<p class="portal-alert portal-alert--error">${Portal.escapeHtml(error.message)}</p>`;
    }
  }

  function setupAttachmentPreview() {
    document.getElementById("closeAttachmentPreviewBtn")?.addEventListener("click", () => {
      attachmentPreviewDialog?.close();
    });
    attachmentPreviewDialog?.addEventListener("close", () => {
      revokePreviewObjectUrl();
      if (attachmentPreviewBody) attachmentPreviewBody.innerHTML = "";
    });
  }

  function savedAttachmentRow(item, canDelete = true) {
    const href = attachmentHref(item);
    const viewHref = attachmentViewHref(item);
    const label = item.label || item.originalName || item.filename || "مرفق";
    const mimeType = item.mimeType || "";
    const originalName = item.originalName || "";
    const filename = item.filename || "";
    const canView = Boolean(viewHref && item.filename);

    return `<div class="portal-attachment-row portal-attachment-row--saved"
      data-attachment-id="${Portal.escapeHtml(item.id)}"
      data-label="${Portal.escapeHtml(item.label || "")}"
      data-filename="${Portal.escapeHtml(item.filename || "")}"
      data-original-name="${Portal.escapeHtml(item.originalName || "")}"
      data-mime-type="${Portal.escapeHtml(item.mimeType || "")}"
      data-size="${item.size ?? ""}"
      data-url="${Portal.escapeHtml(item.url || "")}">
      <div class="portal-attachment-saved-info">
        ${
          href
            ? `<a class="portal-attachment-saved-link" href="${Portal.escapeHtml(href)}" target="_blank" rel="noopener">${Portal.escapeHtml(label)}</a>`
            : `<span class="portal-attachment-saved-label">${Portal.escapeHtml(label)}</span>`
        }
      </div>
      <div class="portal-attachment-saved-actions">
        ${
          canView
            ? `<button type="button" class="portal-attachment-view-btn" data-action="view-attachment" data-view-url="${Portal.escapeHtml(viewHref)}" data-mime-type="${Portal.escapeHtml(mimeType)}" data-original-name="${Portal.escapeHtml(originalName)}" data-filename="${Portal.escapeHtml(filename)}" data-label="${Portal.escapeHtml(label)}" aria-label="عرض ${Portal.escapeHtml(label)}">
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
        ${
          canDelete
            ? `<button type="button" class="portal-btn-danger portal-attachment-remove" data-saved="1">حذف</button>`
            : ""
        }
      </div>
    </div>`;
  }

  function draftAttachmentRow(item = {}, index = 0) {
    const displayName = item.originalName || item.label || item.filename || "";

    return `<div class="portal-attachment-row portal-attachment-row--draft"
      data-index="${index}">
      <input type="text" class="portal-attachment-label" placeholder="اسم المرفق" value="${Portal.escapeHtml(item.label || "")}" />
      <div class="portal-attachment-file-wrap">
        <label class="portal-attachment-file-field">
          <span class="portal-attachment-file-btn">اختيار ملف</span>
          <input type="file" class="portal-attachment-file-input" />
        </label>
        <span class="portal-attachment-file-name">${displayName ? Portal.escapeHtml(displayName) : "لم يُرفَع ملف بعد"}</span>
      </div>
      <button type="button" class="portal-btn-ghost portal-btn-ghost--sm portal-attachment-remove">إزالة</button>
    </div>`;
  }

  function renderCaseAttachments(attachments = [], canDelete = isAdminUser) {
    const list = document.getElementById("caseAttachmentsList");
    if (!list) return;
    list.innerHTML = attachments.map((item) => savedAttachmentRow(item, canDelete)).join("");
  }

  async function openCaseDetail(caseId) {
    detailDialogBody.innerHTML = `<p class="portal-detail-loading">جاري التحميل...</p>`;
    detailDialog.showModal();
    try {
      const data = await Portal.request(`/dashboard/cases/${caseId}`);
      const c = data.case;
      const canEdit = isAdminUser || c.assigned_to === dashboardUser?.id;
      const canDeleteAttachments = isAdminUser;
      const canEditCaseInfo = isAdminUser && c.status !== "archived";
      const canArchiveCase = isAdminUser && c.status !== "archived";
      const latest = c.latest_task;
      const latestHtml = latest
        ? `<div class="portal-detail-situation portal-detail-situation--${latest.status === "done" ? "done" : "open"}">
            <strong>الوضع الحالي (آخر مهمة)</strong>
            <p>${Portal.escapeHtml(latest.title)} — ${Portal.statusLabel(latest.status)}</p>
            ${latest.due_at ? `<span class="portal-list-item__meta">مستحق: ${Portal.formatTaskDue(latest.due_at)}</span>` : ""}
          </div>`
        : `<p class="portal-detail-empty">لا توجد مهام بعد لهذه القضية.</p>`;
      const attachments = c.attachments || [];
      detailDialogBody.innerHTML = `
        <div class="portal-detail" data-case-id="${c.id}">
          <div class="portal-detail-head">
            <h2>${Portal.escapeHtml(c.title)}</h2>
            <div class="portal-detail-head-actions">
              ${canEditCaseInfo ? editBtn("edit-case", c.id) : ""}
              ${canArchiveCase ? archiveBtn("archive-case", c.id) : ""}
              ${!canEdit ? `<button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeDetailBtn">إغلاق</button>` : ""}
            </div>
          </div>
          ${detailRow("الموكل", c.client?.name ? Portal.escapeHtml(c.client.name) : "—")}
          ${detailRow("المحامي المسؤول", c.lawyer?.name ? `${Portal.escapeHtml(c.lawyer.name)} (${Portal.roleLabel(c.lawyer.role)})` : "—")}
          ${detailRow("الحالة", Portal.statusLabel(c.status))}
          <h3 class="portal-detail-subtitle">الوضع الحالي</h3>
          ${latestHtml}
          <h3 class="portal-detail-subtitle">ملاحظات القضية</h3>
          ${
            canEdit
              ? `<textarea id="caseNotesInput" class="portal-detail-notes" rows="4" placeholder="أضف ملاحظات عن القضية...">${Portal.escapeHtml(c.notes || "")}</textarea>`
              : `<p class="portal-detail-text">${c.notes ? Portal.escapeHtml(c.notes) : "لا توجد ملاحظات."}</p>`
          }
          <h3 class="portal-detail-subtitle">مرفقات القضية</h3>
          <div id="caseAttachmentsList" class="portal-attachments">
            ${attachments
              .filter(isSavedAttachment)
              .map((item) => savedAttachmentRow(item, canDeleteAttachments))
              .join("")}
          </div>
          ${
            canEdit
              ? `<div class="portal-detail-actions portal-detail-actions--case">
                  <div class="portal-detail-actions__end">
                    <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="addAttachmentBtn">إضافة مرفق</button>
                    <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeDetailBtn">إغلاق</button>
                    <button type="button" class="btn" id="saveCaseBtn">حفظ</button>
                  </div>
                </div>`
              : attachments.length
                ? `<ul class="portal-detail-links">${attachments
                    .map((a) => {
                      const href = attachmentHref(a);
                      return `<li>${href ? `<a href="${Portal.escapeHtml(href)}" target="_blank" rel="noopener">${Portal.escapeHtml(a.label || a.originalName || "مرفق")}</a>` : Portal.escapeHtml(a.label)}</li>`;
                    })
                    .join("")}</ul>`
                : `<p class="portal-detail-empty">لا توجد مرفقات.</p>`
          }
          <div id="caseDetailAlert" class="portal-alert portal-alert--error" hidden></div>
        </div>`;
    } catch (error) {
      detailDialogBody.innerHTML = `<p class="portal-alert portal-alert--error">${Portal.escapeHtml(error.message)}</p>`;
    }
  }

  async function openEditCaseDialog(caseId) {
    if (!isAdminUser) return;
    const dialog = document.getElementById("editCaseDialog");
    const form = document.getElementById("editCaseForm");
    if (!dialog || !form) {
      Portal.showToast("تعذر فتح نافذة التعديل. حدّث الصفحة.", "error");
      return;
    }
    const alertEl = document.getElementById("editCaseAlert");
    Portal.hideAlert(alertEl);
    try {
      const data = await Portal.request(`/dashboard/cases/${caseId}`);
      const c = data.case;
      if (c.status === "archived") {
        Portal.showToast("لا يمكن تعديل قضية مؤرشفة.", "error");
        return;
      }
      syncClientsFromDashboard();
      document.getElementById("editCaseId").value = c.id;
      document.getElementById("editCaseTitle").value = c.title;
      fillClientSelectOptions(document.getElementById("editCaseClientSelect"), c.client?.id);
      fillAssigneeSelectOptions(document.getElementById("editCaseAssigneeSelect"), c.assigned_to);
      const statusEl = document.getElementById("editCaseStatus");
      if (statusEl) statusEl.value = c.status === "finished" ? "finished" : "active";
      dialog.showModal();
    } catch (error) {
      Portal.showToast(error.message, "error");
    }
  }

  async function openEditTaskDialog(taskId) {
    if (!isAdminUser) return;
    const dialog = document.getElementById("editTaskDialog");
    const form = document.getElementById("editTaskForm");
    if (!dialog || !form) {
      Portal.showToast("تعذر فتح نافذة التعديل. حدّث الصفحة.", "error");
      return;
    }
    const alertEl = document.getElementById("editTaskAlert");
    Portal.hideAlert(alertEl);
    try {
      const data = await Portal.request(`/dashboard/tasks/${taskId}`);
      const t = data.task;
      document.getElementById("editTaskId").value = t.id;
      document.getElementById("editTaskCaseTitle").textContent = t.case_title || "—";
      document.getElementById("editTaskTitle").value = t.title;
      fillTaskAssigneeSelect(document.getElementById("editTaskAssigneeSelect"), t.assigned_to);
      document.getElementById("editTaskDueAt").value = t.due_at ? Portal.formatDateInput(t.due_at) : "";
      document.getElementById("editTaskDueTime").value = Portal.formatTimeInput(t.due_at);
      const selectedIds = (t.attachments || []).filter(isSavedAttachment).map((item) => item.id);
      await renderTaskCaseAttachmentPicks(t.case_id, {
        wrapId: "editTaskCaseAttachmentsWrap",
        listId: "editTaskCaseAttachmentsList",
        selectedIds,
        checkboxName: "edit_task_attachment_ids",
      });
      dialog.showModal();
    } catch (error) {
      Portal.showToast(error.message, "error");
    }
  }

  async function openTaskDetail(taskId) {
    detailDialogBody.innerHTML = `<p class="portal-detail-loading">جاري التحميل...</p>`;
    detailDialog.showModal();
    try {
      const data = await Portal.request(`/dashboard/tasks/${taskId}`);
      const t = data.task;
      const canDeleteTask = isAdminUser || t.assigned_to === dashboardUser?.id;
      const taskAttachments = (t.attachments || []).filter(isSavedAttachment);
      const attachmentsHtml = taskAttachments.length
        ? `<ul class="portal-task-attachment-list">${taskAttachments.map((a) => renderTaskAttachmentListItem(a)).join("")}</ul>`
        : `<p class="portal-detail-empty">لا توجد مرفقات مرتبطة بهذه المهمة.</p>`;
      detailDialogBody.innerHTML = `
        <div class="portal-detail" data-task-id="${t.id}">
          <div class="portal-detail-head">
            <h2>${Portal.escapeHtml(t.title)}</h2>
            <div class="portal-detail-head-actions">
              ${isAdminUser ? editBtn("edit-task", t.id) : ""}
              ${canDeleteTask ? deleteBtn("delete-task", t.id) : ""}
              <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeDetailBtn">إغلاق</button>
            </div>
          </div>
          ${detailRow("القضية", Portal.escapeHtml(t.case_title || "—"))}
          ${detailRow("معيّنة إلى", taskAssignmentHtml(t) || "—")}
          ${detailRow("الحالة", Portal.statusLabel(t.status))}
          ${detailRow("موعد المهمة", t.due_at ? Portal.formatTaskDue(t.due_at) : "—")}
          <h3 class="portal-detail-subtitle">مرفقات المهمة</h3>
          ${attachmentsHtml}
          <div class="portal-detail-actions portal-detail-actions--status">
            <button type="button" class="portal-status-btn portal-status-btn--done" data-status="done">مكتملة</button>
            <button type="button" class="portal-status-btn portal-status-btn--open" data-status="open">غير مكتملة</button>
          </div>
          <div id="taskDetailAlert" class="portal-alert portal-alert--error" hidden></div>
        </div>`;
      highlightTaskStatus(t.status);
    } catch (error) {
      detailDialogBody.innerHTML = `<p class="portal-alert portal-alert--error">${Portal.escapeHtml(error.message)}</p>`;
    }
  }

  function highlightTaskStatus(status) {
    detailDialogBody.querySelectorAll(".portal-status-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.status === status);
    });
  }

  async function updateTaskStatus(taskId, status) {
    const alertEl = document.getElementById("taskDetailAlert");
    Portal.hideAlert(alertEl);
    try {
      await Portal.request(`/dashboard/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      highlightTaskStatus(status);
      dashboardData = await Portal.request("/dashboard/summary");
      renderPage();
    } catch (error) {
      Portal.showAlert(alertEl, error.message);
    }
  }

  async function collectCaseAttachments(caseId, root = detailDialogBody) {
    const rows = [...(root || document).querySelectorAll(".portal-attachment-row")];
    const attachments = [];

    for (const row of rows) {
      if (row.classList.contains("portal-attachment-row--saved")) {
        const id = row.dataset.attachmentId;
        if (!id) continue;

        const item = {
          id,
          label: row.dataset.label || "",
        };
        if (row.dataset.filename) {
          item.filename = row.dataset.filename;
          if (row.dataset.originalName) item.originalName = row.dataset.originalName;
          if (row.dataset.mimeType) item.mimeType = row.dataset.mimeType;
          if (row.dataset.size) item.size = Number(row.dataset.size);
        }
        if (row.dataset.url) item.url = row.dataset.url;
        attachments.push(item);
        continue;
      }

      const label = row.querySelector(".portal-attachment-label")?.value?.trim() || "";
      const fileInput = row.querySelector(".portal-attachment-file-input");
      const pendingFile = fileInput?.files?.[0];

      if (!label && !pendingFile) continue;

      if (!label) {
        throw new Error("يرجى إدخال اسم لكل مرفق.");
      }

      if (!pendingFile) {
        throw new Error(`يرجى اختيار ملف للمرفق «${label}».`);
      }

      if (pendingFile) {
        const presign = await Portal.request(`/dashboard/cases/${caseId}/attachments/presign`, {
          method: "POST",
          body: JSON.stringify({
            originalName: pendingFile.name,
            mimeType: pendingFile.type || "application/octet-stream",
            size: pendingFile.size,
            label,
          }),
        });

        const uploadRes = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": pendingFile.type || "application/octet-stream",
          },
          body: pendingFile,
        });
        if (!uploadRes.ok) {
          throw new Error("تعذر رفع الملف مباشرة إلى التخزين.");
        }

        const data = await Portal.request(`/dashboard/cases/${caseId}/attachments/finalize`, {
          method: "POST",
          body: JSON.stringify({
            attachmentId: presign.attachmentId,
            key: presign.key,
            label,
            originalName: pendingFile.name,
            mimeType: pendingFile.type || "application/octet-stream",
            size: pendingFile.size,
          }),
        });
        attachments.push(data.attachment);
      }
    }

    return attachments;
  }

  async function saveCaseDetail(caseId, options = {}) {
    const { quiet = false } = options;
    const alertEl = document.getElementById("caseDetailAlert");
    const saveBtn = document.getElementById("saveCaseBtn");
    Portal.hideAlert(alertEl);
    const notes = document.getElementById("caseNotesInput")?.value || "";

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "جاري الحفظ...";
    }

    try {
      const attachments = await collectCaseAttachments(caseId);
      const result = await Portal.request(`/dashboard/cases/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify({ notes, attachments }),
      });
      renderCaseAttachments(result.case?.attachments || [], isAdminUser);
      dashboardData = await Portal.request("/dashboard/summary");
      if (pageType === "archived") {
        const archivedData = await Portal.request("/dashboard/archived");
        archivedCases = archivedData.cases;
      }
      renderPage();
      if (!quiet) {
        Portal.hideAlert(alertEl);
        Portal.showToast("تم الحفظ.", "success");
      }
    } catch (error) {
      Portal.showAlert(alertEl, error.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "حفظ";
      }
    }
  }

  function setupClientControls() {
    if (addClientBtn) addClientBtn.hidden = false;

    addClientBtn?.addEventListener("click", () => {
      Portal.hideAlert(addClientAlert);
      addClientForm.reset();
      addClientDialog.showModal();
    });

    document.getElementById("cancelClientBtn")?.addEventListener("click", () => addClientDialog.close());

    addClientForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      Portal.hideAlert(addClientAlert);
      const fd = new FormData(addClientForm);
      try {
        await Portal.request("/admin/clients", {
          method: "POST",
          body: JSON.stringify({ name: fd.get("name"), phone: fd.get("phone") }),
        });
        addClientDialog.close();
        await refresh();
      } catch (error) {
        Portal.showAlert(addClientAlert, error.message);
      }
    });
  }

  function setupCaseControls() {
    if (!isAdminUser) return;
    if (addCaseBtn) addCaseBtn.hidden = false;

    addCaseBtn?.addEventListener("click", () => {
      Portal.hideAlert(addCaseAlert);
      addCaseForm.reset();
      const attachmentsList = document.getElementById("addCaseAttachmentsList");
      if (attachmentsList) attachmentsList.innerHTML = "";
      clients = dashboardData?.clients || [];
      fillAssigneeSelect(caseAssigneeSelect);
      fillClientSelect();
      addCaseDialog.showModal();
    });

    document.getElementById("cancelCaseBtn")?.addEventListener("click", () => addCaseDialog.close());

    document.getElementById("addCaseAttachmentBtn")?.addEventListener("click", () => {
      const list = document.getElementById("addCaseAttachmentsList");
      if (!list) return;
      const index = list.querySelectorAll(".portal-attachment-row").length;
      list.insertAdjacentHTML("beforeend", draftAttachmentRow({}, index));
    });

    addCaseForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      Portal.hideAlert(addCaseAlert);
      const fd = new FormData(addCaseForm);
      if (!fd.get("client_id")) {
        Portal.showAlert(addCaseAlert, "أضف موكلاً أولاً.");
        return;
      }

      const submitBtn = document.getElementById("saveAddCaseBtn");
      const attachmentsRoot = document.getElementById("addCaseAttachmentsList");
      const notes = document.getElementById("addCaseNotesInput")?.value?.trim() || "";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "جاري الإنشاء...";
      }

      try {
        const data = await Portal.request("/admin/cases", {
          method: "POST",
          body: JSON.stringify({
            title: fd.get("title"),
            client_id: fd.get("client_id"),
            assigned_to: fd.get("assigned_to"),
          }),
        });
        const caseId = data.case?.id;
        if (caseId && (notes || attachmentsRoot?.querySelector(".portal-attachment-row"))) {
          const attachments = await collectCaseAttachments(caseId, attachmentsRoot);
          await Portal.request(`/dashboard/cases/${caseId}`, {
            method: "PATCH",
            body: JSON.stringify({ notes, attachments }),
          });
        }
        addCaseDialog.close();
        Portal.showToast("تم إنشاء القضية.", "success");
        await refresh();
      } catch (error) {
        Portal.showAlert(addCaseAlert, error.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "إنشاء القضية";
        }
      }
    });
  }

  function updateTasksPanelTitle() {
    const el = document.getElementById("tasksPanelTitle");
    if (!el || pageType !== "tasks") return;
    if (isAdminUser) {
      el.textContent = taskScopeMode === "all" ? "كل مهام المكتب" : "مهامي";
      return;
    }
    el.textContent = Portal.t("portal.dashboard.tasks", "مهامي");
  }

  function setupTaskScopeControls() {
    if (!isAdminUser || !taskScopeGroup) return;

    const setScope = (mode) => {
      taskScopeMode = mode;
      taskScopeMineBtn?.classList.toggle("is-active", mode === "mine");
      taskScopeAllBtn?.classList.toggle("is-active", mode === "all");
      updateTasksPanelTitle();
      renderPage();
    };

    taskScopeMineBtn?.addEventListener("click", () => setScope("mine"));
    taskScopeAllBtn?.addEventListener("click", () => setScope("all"));
    setScope(taskScopeMode);
  }

  function setupTaskControls() {
    if (addTaskBtn) addTaskBtn.hidden = !isAdminUser;
    if (taskAssigneeField) {
      taskAssigneeField.hidden = !isAdminUser;
    }
    if (!isAdminUser && taskAssigneeSelect) {
      taskAssigneeSelect.removeAttribute("required");
    }

    addTaskBtn?.addEventListener("click", async () => {
      if (!isAdminUser) return;
      Portal.hideAlert(addTaskAlert);
      addTaskForm.reset();
      if (isAdminUser) fillTaskAssigneeSelect(taskAssigneeSelect);
      fillCaseSelect();
      await renderTaskCaseAttachmentPicks(taskCaseSelect?.value);
      addTaskDialog.showModal();
    });

    taskCaseSelect?.addEventListener("change", () => {
      renderTaskCaseAttachmentPicks(taskCaseSelect.value);
    });

    document.getElementById("cancelTaskBtn")?.addEventListener("click", () => addTaskDialog?.close());

    addTaskForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      Portal.hideAlert(addTaskAlert);
      const fd = new FormData(addTaskForm);
      if (!fd.get("case_id")) {
        Portal.showAlert(addTaskAlert, "أنشئ قضية أولاً قبل إضافة مهمة.");
        return;
      }
      const body = {
        case_id: fd.get("case_id"),
        title: fd.get("title"),
        due_at: Portal.buildDueAt(fd.get("due_at"), fd.get("due_time")),
        attachments: [...addTaskForm.querySelectorAll('input[name="task_attachment_ids"]:checked')].map(
          (el) => el.value
        ),
      };
      if (fd.get("due_time") && !body.due_at) {
        Portal.showAlert(addTaskAlert, "موعد المهمة غير صالح. تحقق من التاريخ والوقت.");
        return;
      }
      if (isAdminUser) {
        body.assigned_to = fd.get("assigned_to");
      }
      try {
        const endpoint = isAdminUser ? "/admin/tasks" : "/dashboard/tasks";
        await Portal.request(endpoint, { method: "POST", body: JSON.stringify(body) });
        addTaskDialog.close();
        await refresh();
      } catch (error) {
        Portal.showAlert(addTaskAlert, error.message);
      }
    });
  }

  let editCaseControlsBound = false;

  function setupEditCaseControls() {
    if (!isAdminUser || editCaseControlsBound) return;
    editCaseControlsBound = true;

    document.body.addEventListener("click", (event) => {
      if (event.target.closest("#cancelEditCaseBtn")) {
        document.getElementById("editCaseDialog")?.close();
      }
    });

    document.body.addEventListener("submit", async (event) => {
      const form = event.target;
      if (form?.id !== "editCaseForm") return;
      event.preventDefault();

      const alertEl = document.getElementById("editCaseAlert");
      const dialog = document.getElementById("editCaseDialog");
      const submitBtn = form.querySelector('button[type="submit"]');
      Portal.hideAlert(alertEl);

      const fd = new FormData(form);
      const caseId = fd.get("case_id");
      const title = String(fd.get("title") || "").trim();
      const clientId = String(fd.get("client_id") || "");
      const assignedTo = String(fd.get("assigned_to") || "");
      const status = String(fd.get("status") || "active");
      if (!caseId) return;
      if (!title) {
        Portal.showAlert(alertEl, "عنوان القضية مطلوب.");
        return;
      }
      if (!clientId) {
        Portal.showAlert(alertEl, "يجب اختيار موكل.");
        return;
      }
      if (!assignedTo) {
        Portal.showAlert(alertEl, "يجب اختيار محامٍ أو مساعد.");
        return;
      }

      const body = { title, client_id: clientId, assigned_to: assignedTo, status };

      if (submitBtn) submitBtn.disabled = true;
      try {
        await Portal.request(`/dashboard/cases/${caseId}`, { method: "PATCH", body: JSON.stringify(body) });
        dialog?.close();
        Portal.showToast("تم الحفظ.", "success");
        await refresh();
        await openCaseDetail(caseId);
      } catch (error) {
        Portal.showAlert(alertEl, error.message);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  let editTaskControlsBound = false;

  async function saveEditTaskForm(form) {
    const alertEl = document.getElementById("editTaskAlert");
    const dialog = document.getElementById("editTaskDialog");
    const submitBtn = form.querySelector("#saveEditTaskBtn");
    Portal.hideAlert(alertEl);

    const fd = new FormData(form);
    const taskId = fd.get("task_id");
    const title = String(fd.get("title") || "").trim();
    const assignedTo = String(fd.get("assigned_to") || "");
    if (!taskId) {
      Portal.showAlert(alertEl, "تعذر تحديد المهمة.");
      return;
    }
    if (!title) {
      Portal.showAlert(alertEl, "عنوان المهمة مطلوب.");
      return;
    }
    if (!assignedTo) {
      Portal.showAlert(alertEl, "يجب اختيار محامٍ أو مساعد.");
      return;
    }

    const body = {
      title,
      assigned_to: assignedTo,
      due_at: Portal.buildDueAt(fd.get("due_at"), fd.get("due_time")),
      attachments: [...form.querySelectorAll('input[name="edit_task_attachment_ids"]:checked')].map((el) => el.value),
    };

    if (submitBtn) submitBtn.disabled = true;
    try {
      await Portal.request(`/dashboard/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(body) });
      dialog?.close();
      Portal.showToast("تم الحفظ");
      await refresh();
      await openTaskDetail(taskId);
    } catch (error) {
      Portal.showAlert(alertEl, error.message);
      Portal.showToast(error.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function setupEditTaskControls() {
    if (!isAdminUser || editTaskControlsBound) return;
    editTaskControlsBound = true;

    document.body.addEventListener("click", (event) => {
      if (event.target.closest("#cancelEditTaskBtn")) {
        document.getElementById("editTaskDialog")?.close();
      }
    });

    document.body.addEventListener("submit", async (event) => {
      const form = event.target;
      if (form?.id !== "editTaskForm") return;
      event.preventDefault();
      await saveEditTaskForm(form);
    });
  }

  function setupSearchControls() {
    [clientsSearch, casesSearch, tasksSearch, taskStatusFilter, taskAssigneeFilter].forEach((el) => {
      el?.addEventListener("input", renderPage);
      el?.addEventListener("change", renderPage);
    });

    if (!taskDateInput) return;

    taskDateInput.value = selectedTaskDate;

    taskDateToday?.addEventListener("click", () => {
      taskDateMode = "today";
      selectedTaskDate = Portal.formatDateInput(new Date());
      taskDateInput.value = selectedTaskDate;
      taskDateToday.classList.add("is-active");
      taskShowAllBtn?.classList.remove("is-active");
      renderPage();
    });

    taskShowAllBtn?.addEventListener("click", () => {
      taskDateMode = "all";
      taskShowAllBtn.classList.add("is-active");
      taskDateToday?.classList.remove("is-active");
      renderPage();
    });

    taskDateInput?.addEventListener("change", () => {
      taskDateMode = "today";
      selectedTaskDate = taskDateInput.value;
      taskDateToday?.classList.add("is-active");
      taskShowAllBtn?.classList.remove("is-active");
      renderPage();
    });

    taskDatePrev?.addEventListener("click", () => {
      const d = new Date(selectedTaskDate);
      d.setDate(d.getDate() - 1);
      selectedTaskDate = Portal.formatDateInput(d);
      taskDateInput.value = selectedTaskDate;
      taskDateMode = "today";
      renderPage();
    });

    taskDateNext?.addEventListener("click", () => {
      const d = new Date(selectedTaskDate);
      d.setDate(d.getDate() + 1);
      selectedTaskDate = Portal.formatDateInput(d);
      taskDateInput.value = selectedTaskDate;
      taskDateMode = "today";
      renderPage();
    });

    taskDateToday?.classList.add("is-active");
  }

  function setupListActions() {
    document.body.addEventListener("change", (event) => {
      const fileInput = event.target.closest(".portal-attachment-file-input");
      if (!fileInput?.files?.[0]) return;
      if (fileInput.closest(".portal-attachment-row--saved")) return;

      const row = fileInput.closest(".portal-attachment-row");
      const nameEl = row?.querySelector(".portal-attachment-file-name");
      const labelInput = row?.querySelector(".portal-attachment-label");
      const file = fileInput.files[0];
      if (nameEl) nameEl.textContent = file.name;
      if (labelInput && !labelInput.value.trim()) {
        labelInput.value = file.name;
      }
      row?.querySelector(".portal-attachment-download")?.remove();
      row?.removeAttribute("data-attachment-id");
      row?.removeAttribute("data-filename");
      row?.removeAttribute("data-url");
    });

    document.body.addEventListener("click", async (event) => {
      if (event.target.closest("#closeDetailBtn")) {
        detailDialog.close();
        return;
      }

      if (event.target.closest("#closeAttachmentPreviewBtn")) {
        attachmentPreviewDialog?.close();
        return;
      }

      if (event.target.closest("#saveCaseBtn")) {
        const caseId = detailDialogBody.querySelector("[data-case-id]")?.dataset.caseId;
        if (caseId) saveCaseDetail(caseId);
        return;
      }

      if (event.target.closest("#addAttachmentBtn")) {
        const list = document.getElementById("caseAttachmentsList");
        const index = list.querySelectorAll(".portal-attachment-row").length;
        list.insertAdjacentHTML("beforeend", draftAttachmentRow({}, index));
        return;
      }

      const attachmentRemove = event.target.closest(".portal-attachment-remove");
      if (attachmentRemove) {
        const row = attachmentRemove.closest(".portal-attachment-row");
        const isSaved = row?.classList.contains("portal-attachment-row--saved");
        row?.remove();
        if (isSaved) {
          const caseId = detailDialogBody.querySelector("[data-case-id]")?.dataset.caseId;
          if (caseId) await saveCaseDetail(caseId, { quiet: true });
        }
        return;
      }

      const statusBtn = event.target.closest(".portal-status-btn");
      if (statusBtn) {
        const taskId = detailDialogBody.querySelector("[data-task-id]")?.dataset.taskId;
        if (taskId) updateTaskStatus(taskId, statusBtn.dataset.status);
        return;
      }

      const btn = event.target.closest("[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === "view-attachment") {
        event.preventDefault();
        event.stopPropagation();
        await openAttachmentPreview(
          btn.dataset.viewUrl,
          btn.dataset.mimeType || "",
          btn.dataset.label || "",
          btn.dataset.originalName || "",
          btn.dataset.filename || ""
        );
        return;
      }

      if (action === "archive-case") {
        event.preventDefault();
        event.stopPropagation();
        await archiveCaseEntity(id);
        return;
      }

      if (action === "edit-case") {
        event.preventDefault();
        event.stopPropagation();
        detailDialog.close();
        await openEditCaseDialog(id);
        return;
      }

      if (action === "edit-task") {
        event.preventDefault();
        event.stopPropagation();
        detailDialog.close();
        await openEditTaskDialog(id);
        return;
      }

      if (action === "delete-client" || action === "delete-task") {
        event.preventDefault();
        event.stopPropagation();
        const type = action.replace("delete-", "");
        await deleteEntity(type, id);
        return;
      }

      if (action === "show-client") openClientDetail(id);
      if (action === "show-case") openCaseDetail(id);
      if (action === "show-task") openTaskDetail(id);
    });
  }

  async function refresh() {
    if (pageType === "archived") {
      const data = await Portal.request("/dashboard/archived");
      archivedCases = data.cases;
      renderPage();
      return;
    }
    dashboardData = await Portal.request("/dashboard/summary");
    if (isAdminUser) {
      syncClientsFromDashboard();
    }
    renderPage();
  }

  function updateCasesPanelTitle() {
    const el = document.getElementById("casesPanelTitle");
    if (!el) return;
    el.textContent = isAdminUser
      ? Portal.t("portal.dashboard.officeCases", "قضايا المكتب")
      : Portal.t("portal.dashboard.cases", "قضاياي");
  }

  function renderHome() {
    if (!dashboardUser || !dashboardData) return;
    renderWelcome(dashboardUser);
    renderStats(dashboardData.stats);

    const homeCasesTitle = document.getElementById("homeCasesTitle");
    if (homeCasesTitle) {
      homeCasesTitle.textContent = isAdminUser ? "أحدث القضايا" : "أحدث قضاياي";
    }

    const homeClientsPanel = document.getElementById("homeClientsPanel");
    if (isAdminUser && homeClientsPanel) {
      homeClientsPanel.hidden = false;
      renderClients(dashboardData.clients.slice(0, PREVIEW_LIMIT), document.getElementById("homeClientsList"));
    }

    renderCases(dashboardData.cases.slice(0, PREVIEW_LIMIT), document.getElementById("homeCasesList"));
    renderTasks(dashboardData.tasks.slice(0, PREVIEW_LIMIT), document.getElementById("homeTasksList"));
  }

  function renderPage() {
    if (!dashboardUser || !dashboardData) return;

    if (pageType === "home") {
      renderHome();
      return;
    }

    if (welcomeText) {
      renderWelcome(dashboardUser);
    }

    if (pageType === "clients" && isAdminUser) {
      clients = dashboardData.clients || [];
      renderClients(clients);
      return;
    }

    if (pageType === "cases") {
      updateCasesPanelTitle();
      renderCases(dashboardData.cases);
      return;
    }

    if (pageType === "archived") {
      const titleEl = document.getElementById("casesPanelTitle");
      if (titleEl) {
        titleEl.textContent = isAdminUser ? "القضايا المؤرشفة" : "قضاياي المؤرشفة";
      }
      renderCases(archivedCases);
      return;
    }

    if (pageType === "tasks") {
      updateTasksPanelTitle();
      renderTasks(dashboardData.tasks);
    }
  }

  function bindDialogRefs() {
    addCaseDialog = document.getElementById("addCaseDialog");
    addTaskDialog = document.getElementById("addTaskDialog");
    editTaskDialog = document.getElementById("editTaskDialog");
    editCaseDialog = document.getElementById("editCaseDialog");
    addClientDialog = document.getElementById("addClientDialog");
    detailDialog = document.getElementById("detailDialog");
    detailDialogBody = document.getElementById("detailDialogBody");
    confirmDeleteDialog = document.getElementById("confirmDeleteDialog");
    confirmDeleteMessage = document.getElementById("confirmDeleteMessage");
    confirmDeleteCancel = document.getElementById("confirmDeleteCancel");
    confirmDeleteOk = document.getElementById("confirmDeleteOk");
    attachmentPreviewDialog = document.getElementById("attachmentPreviewDialog");
    attachmentPreviewBody = document.getElementById("attachmentPreviewBody");
    attachmentPreviewTitle = document.getElementById("attachmentPreviewTitle");
    addCaseForm = document.getElementById("addCaseForm");
    addTaskForm = document.getElementById("addTaskForm");
    editTaskForm = document.getElementById("editTaskForm");
    editCaseForm = document.getElementById("editCaseForm");
    addClientForm = document.getElementById("addClientForm");
    addCaseAlert = document.getElementById("addCaseAlert");
    addTaskAlert = document.getElementById("addTaskAlert");
    editTaskAlert = document.getElementById("editTaskAlert");
    editCaseAlert = document.getElementById("editCaseAlert");
    addClientAlert = document.getElementById("addClientAlert");
    caseAssigneeSelect = document.getElementById("caseAssigneeSelect");
    caseClientSelect = document.getElementById("caseClientSelect");
    taskAssigneeSelect = document.getElementById("taskAssigneeSelect");
    editTaskAssigneeSelect = document.getElementById("editTaskAssigneeSelect");
    taskAssigneeField = document.getElementById("taskAssigneeField");
    taskCaseSelect = document.getElementById("taskCaseSelect");
  }

  async function ensureDialogs() {
    if (document.getElementById("detailDialog")) {
      bindDialogRefs();
      return;
    }
    try {
      const res = await fetch("dialogs.fragment.html");
      if (res.ok) {
        document.body.insertAdjacentHTML("beforeend", await res.text());
        bindDialogRefs();
      }
    } catch {
      /* ignore */
    }
  }

  async function ensurePortalPush() {
    if (window.PortalPush) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "portal-push.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load push module"));
      document.head.appendChild(script);
    });
  }

  async function openPendingTaskFromUrl() {
    const taskId = new URLSearchParams(window.location.search).get("task");
    if (!taskId) return;
    await openTaskDetail(taskId);
    history.replaceState({}, "", window.location.pathname);
  }

  function setupPushNavigation() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type !== "portal-open-url") return;
      const url = new URL(event.data.url, window.location.origin);
      const taskId = url.searchParams.get("task");
      if (taskId) {
        openTaskDetail(taskId);
        return;
      }
      window.location.href = url.pathname + url.search;
    });
  }

  async function boot(page = "home") {
    pageType = page;
    await ensureDialogs();

    const user = await Portal.requireAuth();
    if (!user) return;

    dashboardUser = user;
    isAdminUser = user.role === "admin";

    if (pageType === "clients" && !isAdminUser) {
      window.location.href = "home.html";
      return;
    }

    if (pageType === "archived" && !isAdminUser) {
      window.location.href = "home.html";
      return;
    }

    PortalNav.init(user);

    if (isAdminUser) {
      if (adminNavLinks) adminNavLinks.hidden = false;
      await loadAssignees();

      if (pageType === "clients") setupClientControls();
      if (pageType === "cases") setupCaseControls();
    } else if (user.role === "lawyer" || user.role === "assistant") {
      assigneeNames = { [user.id]: user.name };
    }

    if (pageType === "tasks") setupTaskControls();
    if (pageType === "tasks" && isAdminUser) setupTaskScopeControls();
    if (isAdminUser) {
      setupEditCaseControls();
      setupEditTaskControls();
    }
    if (pageType === "tasks") setupSearchControls();
    if (pageType === "cases" || pageType === "archived") setupSearchControls();
    if (pageType === "clients") setupSearchControls();

    setupListActions();
    setupAttachmentPreview();
    setupPushNavigation();

    await refresh();
    await openPendingTaskFromUrl();

    try {
      await ensurePortalPush();
      PortalPush.ensureManifest();
      PortalPush.registerServiceWorker();
      if (pageType === "home" || pageType === "tasks") {
        await PortalPush.initUi("pushNotifyPanel");
      }
    } catch {
      /* push optional */
    }
  }

  window.addEventListener("gz:languagechange", renderPage);

  return { boot, refresh, renderPage };
})();
