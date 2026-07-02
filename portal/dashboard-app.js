(() => {
  const welcomeText = document.getElementById("welcomeText");
  const statsGrid = document.getElementById("statsGrid");
  const casesList = document.getElementById("casesList");
  const tasksList = document.getElementById("tasksList");
  const adminLink = document.getElementById("adminLink");
  const adminNavLinks = document.getElementById("adminNavLinks");
  const portalNavToggle = document.getElementById("portalNavToggle");
  const portalNavBackdrop = document.getElementById("portalNavBackdrop");
  const logoutBtn = document.getElementById("logoutBtn");
  const addCaseBtn = document.getElementById("addCaseBtn");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const addClientBtn = document.getElementById("addClientBtn");
  const clientsPanel = document.getElementById("clientsPanel");
  const clientsList = document.getElementById("clientsList");
  const addCaseDialog = document.getElementById("addCaseDialog");
  const addTaskDialog = document.getElementById("addTaskDialog");
  const addClientDialog = document.getElementById("addClientDialog");
  const detailDialog = document.getElementById("detailDialog");
  const detailDialogBody = document.getElementById("detailDialogBody");
  const confirmDeleteDialog = document.getElementById("confirmDeleteDialog");
  const confirmDeleteMessage = document.getElementById("confirmDeleteMessage");
  const confirmDeleteCancel = document.getElementById("confirmDeleteCancel");
  const confirmDeleteOk = document.getElementById("confirmDeleteOk");
  const addCaseForm = document.getElementById("addCaseForm");
  const addTaskForm = document.getElementById("addTaskForm");
  const addClientForm = document.getElementById("addClientForm");
  const addCaseAlert = document.getElementById("addCaseAlert");
  const addTaskAlert = document.getElementById("addTaskAlert");
  const addClientAlert = document.getElementById("addClientAlert");
  const caseAssigneeSelect = document.getElementById("caseAssigneeSelect");
  const caseClientSelect = document.getElementById("caseClientSelect");
  const taskAssigneeSelect = document.getElementById("taskAssigneeSelect");
  const taskAssigneeField = document.getElementById("taskAssigneeField");
  const taskCaseSelect = document.getElementById("taskCaseSelect");
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

  let assignees = [];
  let clients = [];
  let assigneeNames = {};
  let isAdminUser = false;
  let dashboardUser = null;
  let dashboardData = null;
  let taskDateMode = "today";
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
    welcomeText.textContent = `${Portal.t("portal.dashboard.welcome", "مرحباً،")} ${user.name} (${Portal.roleLabel(user.role)})`;
  }

  function renderStats(stats) {
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

  function renderClients(clientRows) {
    const rows = filterClients(clientRows);
    if (!rows.length) {
      clientsList.innerHTML = emptyState(
        clientRows.length ? "لا توجد نتائج مطابقة للبحث." : "لا يوجد موكلون بعد. أضف موكلاً أولاً."
      );
      return;
    }
    clientsList.innerHTML = rows
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

  function renderCases(cases) {
    const rows = filterCases(cases);
    if (!rows.length) {
      casesList.innerHTML = emptyState(
        cases.length
          ? "لا توجد نتائج مطابقة للبحث."
          : Portal.t("portal.dashboard.noCases", "لا توجد قضايا معينة بعد.")
      );
      return;
    }
    const assigned = Portal.t("portal.dashboard.assignedTo", "معيّنة إلى:");
    casesList.innerHTML = rows
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

  function renderTasks(tasks) {
    const rows = filterTasks(tasks);
    if (!rows.length) {
      const emptyMsg =
        tasks.length && (taskDateMode === "today" || tasksSearch?.value || taskStatusFilter?.value)
          ? "لا توجد مهام مطابقة للبحث أو التاريخ المحدد."
          : Portal.t("portal.dashboard.noTasks", "لا توجد مهام بعد.");
      tasksList.innerHTML = emptyState(emptyMsg);
      return;
    }
    const due = Portal.t("portal.dashboard.due", "مستحق:");
    const assigned = Portal.t("portal.dashboard.assignedTo", "معيّنة إلى:");
    tasksList.innerHTML = rows
      .map((t) => {
        const assigneeName =
          (isAdminUser && t.assigned_to && assigneeNames[t.assigned_to]) ||
          t.assignee_name ||
          "";
        const assigneeLine = assigneeName ? `${assigned} ${Portal.escapeHtml(assigneeName)}` : "";
        const statusClass = t.status === "done" ? "portal-list-item--done" : "portal-list-item--open";
        return `<li class="portal-list-item ${statusClass}">
          <div class="portal-list-item__row">
            <div class="portal-list-item__content">
              <div class="portal-list-item__head">
                <strong>${Portal.escapeHtml(t.title)}</strong>
                ${badge(t.status)}
              </div>
              ${assigneeLine ? `<span class="portal-list-item__assignee">${assigneeLine}</span>` : ""}
              <span class="portal-list-item__meta">${Portal.escapeHtml(t.case_title)}${t.due_at ? ` — ${due} ${Portal.formatDate(t.due_at)}` : ""}</span>
            </div>
            ${showMoreBtn("show-task", t.id)}
          </div>
        </li>`;
      })
      .join("");
  }

  function fillClientSelect() {
    if (!clients.length) {
      caseClientSelect.innerHTML = '<option value="">لا يوجد موكلون — أضف موكلاً أولاً</option>';
      caseClientSelect.disabled = true;
      return;
    }
    caseClientSelect.disabled = false;
    caseClientSelect.innerHTML = clients
      .map((c) => `<option value="${c.id}">${Portal.escapeHtml(c.name)}</option>`)
      .join("");
  }

  function fillAssigneeSelect(select) {
    if (!select) return;
    select.innerHTML = assignees
      .map(
        (u) =>
          `<option value="${u.id}">${Portal.escapeHtml(u.name)} — ${Portal.roleLabel(u.role)}</option>`
      )
      .join("");
  }

  function fillTaskAssigneeSelect(select, selectedId = null) {
    if (!select) return;
    const selfOption =
      isAdminUser && dashboardUser?.id
        ? `<option value="${Portal.escapeHtml(dashboardUser.id)}">لنفسي</option>`
        : "";
    const teamOptions = assignees
      .map(
        (u) =>
          `<option value="${u.id}">${Portal.escapeHtml(u.name)} — ${Portal.roleLabel(u.role)}</option>`
      )
      .join("");
    select.innerHTML = `<option value="" disabled${selectedId ? "" : " selected"}>اختر المعيّن</option>${selfOption}${teamOptions}`;
    if (selectedId) {
      select.value = selectedId;
    }
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

  function deleteBtn(action, id, label = "حذف") {
    return `<button type="button" class="portal-btn-danger" data-action="${action}" data-id="${id}">${label}</button>`;
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
      await refreshDashboard();
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
      await refreshDashboard();
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
          <div class="portal-detail-head">
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

  function attachmentRow(item, index) {
    return `<div class="portal-attachment-row" data-index="${index}">
      <input type="text" class="portal-attachment-label" placeholder="اسم المرفق" value="${Portal.escapeHtml(item.label || "")}" />
      <input type="url" class="portal-attachment-url" dir="ltr" placeholder="https://..." value="${Portal.escapeHtml(item.url || "")}" />
      <button type="button" class="portal-btn-ghost portal-btn-ghost--sm portal-attachment-remove">إزالة</button>
    </div>`;
  }

  async function openCaseDetail(caseId) {
    detailDialogBody.innerHTML = `<p class="portal-detail-loading">جاري التحميل...</p>`;
    detailDialog.showModal();
    try {
      const data = await Portal.request(`/dashboard/cases/${caseId}`);
      const c = data.case;
      const canEdit = isAdminUser || c.assigned_to === dashboardUser?.id;
      const canArchiveCase = isAdminUser && c.status !== "archived";
      const latest = c.latest_task;
      const latestHtml = latest
        ? `<div class="portal-detail-situation portal-detail-situation--${latest.status === "done" ? "done" : "open"}">
            <strong>الوضع الحالي (آخر مهمة)</strong>
            <p>${Portal.escapeHtml(latest.title)} — ${Portal.statusLabel(latest.status)}</p>
            ${latest.due_at ? `<span class="portal-list-item__meta">مستحق: ${Portal.formatDate(latest.due_at)}</span>` : ""}
          </div>`
        : `<p class="portal-detail-empty">لا توجد مهام بعد لهذه القضية.</p>`;
      const attachments = c.attachments || [];
      detailDialogBody.innerHTML = `
        <div class="portal-detail" data-case-id="${c.id}">
          <div class="portal-detail-head">
            <h2>${Portal.escapeHtml(c.title)}</h2>
            <div class="portal-detail-head-actions">
              <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeDetailBtn">إغلاق</button>
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
            ${attachments.map((item, i) => attachmentRow(item, i)).join("")}
          </div>
          ${
            canEdit
              ? `<div class="portal-detail-actions portal-detail-actions--case">
                  ${canArchiveCase ? archiveBtn("archive-case", c.id) : ""}
                  <div class="portal-detail-actions__end">
                    <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="addAttachmentBtn">إضافة مرفق</button>
                    <button type="button" class="btn" id="saveCaseBtn">حفظ</button>
                  </div>
                </div>`
              : attachments.length
                ? `<ul class="portal-detail-links">${attachments
                    .map(
                      (a) =>
                        `<li>${a.url ? `<a href="${Portal.escapeHtml(a.url)}" target="_blank" rel="noopener">${Portal.escapeHtml(a.label)}</a>` : Portal.escapeHtml(a.label)}</li>`
                    )
                    .join("")}</ul>`
                : `<p class="portal-detail-empty">لا توجد مرفقات.</p>`
          }
          <div id="caseDetailAlert" class="portal-alert portal-alert--error" hidden></div>
        </div>`;
    } catch (error) {
      detailDialogBody.innerHTML = `<p class="portal-alert portal-alert--error">${Portal.escapeHtml(error.message)}</p>`;
    }
  }

  async function openTaskDetail(taskId) {
    detailDialogBody.innerHTML = `<p class="portal-detail-loading">جاري التحميل...</p>`;
    detailDialog.showModal();
    try {
      const data = await Portal.request(`/dashboard/tasks/${taskId}`);
      const t = data.task;
      const canDeleteTask = isAdminUser || t.assigned_to === dashboardUser?.id;
      detailDialogBody.innerHTML = `
        <div class="portal-detail" data-task-id="${t.id}">
          <div class="portal-detail-head">
            <h2>${Portal.escapeHtml(t.title)}</h2>
            <div class="portal-detail-head-actions">
              ${canDeleteTask ? deleteBtn("delete-task", t.id) : ""}
              <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeDetailBtn">إغلاق</button>
            </div>
          </div>
          ${detailRow("القضية", Portal.escapeHtml(t.case_title || "—"))}
          ${detailRow("معيّنة إلى", t.assignee_name ? Portal.escapeHtml(t.assignee_name) : "—")}
          ${detailRow("الحالة", Portal.statusLabel(t.status))}
          ${detailRow("تاريخ الاستحقاق", t.due_at ? Portal.formatDate(t.due_at) : "—")}
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
      renderDashboard();
    } catch (error) {
      Portal.showAlert(alertEl, error.message);
    }
  }

  async function saveCaseDetail(caseId) {
    const alertEl = document.getElementById("caseDetailAlert");
    Portal.hideAlert(alertEl);
    const notes = document.getElementById("caseNotesInput")?.value || "";
    const attachments = [...detailDialogBody.querySelectorAll(".portal-attachment-row")].map((row) => ({
      label: row.querySelector(".portal-attachment-label")?.value || "",
      url: row.querySelector(".portal-attachment-url")?.value || "",
    }));
    try {
      await Portal.request(`/dashboard/cases/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify({ notes, attachments }),
      });
      dashboardData = await Portal.request("/dashboard/summary");
      renderDashboard();
      Portal.hideAlert(alertEl);
      Portal.showToast("تم الحفظ.", "success");
    } catch (error) {
      Portal.showAlert(alertEl, error.message);
    }
  }

  function setupAdminControls() {
    addCaseBtn.hidden = false;
    addClientBtn.hidden = false;
    clientsPanel.hidden = false;

    addClientBtn.addEventListener("click", () => {
      Portal.hideAlert(addClientAlert);
      addClientForm.reset();
      addClientDialog.showModal();
    });

    addCaseBtn.addEventListener("click", () => {
      Portal.hideAlert(addCaseAlert);
      addCaseForm.reset();
      fillAssigneeSelect(caseAssigneeSelect);
      fillClientSelect();
      addCaseDialog.showModal();
    });

    document.getElementById("cancelClientBtn").addEventListener("click", () => addClientDialog.close());

    addClientForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      Portal.hideAlert(addClientAlert);
      const fd = new FormData(addClientForm);
      try {
        await Portal.request("/admin/clients", {
          method: "POST",
          body: JSON.stringify({ name: fd.get("name"), phone: fd.get("phone") }),
        });
        addClientDialog.close();
        await refreshDashboard();
      } catch (error) {
        Portal.showAlert(addClientAlert, error.message);
      }
    });

    addCaseForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      Portal.hideAlert(addCaseAlert);
      const fd = new FormData(addCaseForm);
      if (!fd.get("client_id")) {
        Portal.showAlert(addCaseAlert, "أضف موكلاً أولاً.");
        return;
      }
      try {
        await Portal.request("/admin/cases", {
          method: "POST",
          body: JSON.stringify({
            title: fd.get("title"),
            client_id: fd.get("client_id"),
            assigned_to: fd.get("assigned_to"),
          }),
        });
        addCaseDialog.close();
        await refreshDashboard();
      } catch (error) {
        Portal.showAlert(addCaseAlert, error.message);
      }
    });
  }

  function setupTaskControls() {
    addTaskBtn.hidden = false;
    if (taskAssigneeField) {
      taskAssigneeField.hidden = !isAdminUser;
    }
    if (!isAdminUser && taskAssigneeSelect) {
      taskAssigneeSelect.removeAttribute("required");
    }

    addTaskBtn.addEventListener("click", () => {
      Portal.hideAlert(addTaskAlert);
      addTaskForm.reset();
      if (isAdminUser) fillTaskAssigneeSelect(taskAssigneeSelect);
      fillCaseSelect();
      addTaskDialog.showModal();
    });

    document.getElementById("cancelTaskBtn").addEventListener("click", () => addTaskDialog.close());
    document.getElementById("cancelCaseBtn")?.addEventListener("click", () => addCaseDialog.close());

    addTaskForm.addEventListener("submit", async (event) => {
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
        due_at: fd.get("due_at") || null,
      };
      if (isAdminUser) {
        body.assigned_to = fd.get("assigned_to");
      }
      try {
        const endpoint = isAdminUser ? "/admin/tasks" : "/dashboard/tasks";
        await Portal.request(endpoint, { method: "POST", body: JSON.stringify(body) });
        addTaskDialog.close();
        await refreshDashboard();
      } catch (error) {
        Portal.showAlert(addTaskAlert, error.message);
      }
    });
  }

  function setupSearchControls() {
    [clientsSearch, casesSearch, tasksSearch, taskStatusFilter, taskAssigneeFilter].forEach((el) => {
      el?.addEventListener("input", renderDashboard);
      el?.addEventListener("change", renderDashboard);
    });

    if (!taskDateInput) return;

    taskDateInput.value = selectedTaskDate;

    taskDateToday?.addEventListener("click", () => {
      taskDateMode = "today";
      selectedTaskDate = Portal.formatDateInput(new Date());
      taskDateInput.value = selectedTaskDate;
      taskDateToday.classList.add("is-active");
      taskShowAllBtn?.classList.remove("is-active");
      renderDashboard();
    });

    taskShowAllBtn?.addEventListener("click", () => {
      taskDateMode = "all";
      taskShowAllBtn.classList.add("is-active");
      taskDateToday?.classList.remove("is-active");
      renderDashboard();
    });

    taskDateInput?.addEventListener("change", () => {
      taskDateMode = "today";
      selectedTaskDate = taskDateInput.value;
      taskDateToday?.classList.add("is-active");
      taskShowAllBtn?.classList.remove("is-active");
      renderDashboard();
    });

    taskDatePrev?.addEventListener("click", () => {
      const d = new Date(selectedTaskDate);
      d.setDate(d.getDate() - 1);
      selectedTaskDate = Portal.formatDateInput(d);
      taskDateInput.value = selectedTaskDate;
      taskDateMode = "today";
      renderDashboard();
    });

    taskDateNext?.addEventListener("click", () => {
      const d = new Date(selectedTaskDate);
      d.setDate(d.getDate() + 1);
      selectedTaskDate = Portal.formatDateInput(d);
      taskDateInput.value = selectedTaskDate;
      taskDateMode = "today";
      renderDashboard();
    });

    taskDateToday?.classList.add("is-active");
  }

  function setupListActions() {
    document.body.addEventListener("click", async (event) => {
      if (event.target.closest("#closeDetailBtn")) {
        detailDialog.close();
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
        list.insertAdjacentHTML("beforeend", attachmentRow({ label: "", url: "" }, index));
        return;
      }

      const attachmentRemove = event.target.closest(".portal-attachment-remove");
      if (attachmentRemove) {
        attachmentRemove.closest(".portal-attachment-row")?.remove();
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

      if (action === "archive-case") {
        event.preventDefault();
        event.stopPropagation();
        await archiveCaseEntity(id);
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

  async function refreshDashboard() {
    dashboardData = await Portal.request("/dashboard/summary");
    renderDashboard();
  }

  function updateCasesPanelTitle() {
    const el = document.getElementById("casesPanelTitle");
    if (!el) return;
    el.textContent = isAdminUser
      ? Portal.t("portal.dashboard.officeCases", "قضايا المكتب")
      : Portal.t("portal.dashboard.cases", "قضاياي");
  }

  function renderDashboard() {
    if (!dashboardUser || !dashboardData) return;
    renderWelcome(dashboardUser);
    renderStats(dashboardData.stats);
    updateCasesPanelTitle();
    if (isAdminUser) syncClientsFromDashboard();
    renderCases(dashboardData.cases);
    renderTasks(dashboardData.tasks);
  }

  function setPortalNavOpen(open) {
    document.body.classList.toggle("portal-nav-open", open);
    if (portalNavToggle) {
      portalNavToggle.setAttribute("aria-expanded", String(open));
      portalNavToggle.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
    }
    if (portalNavBackdrop) portalNavBackdrop.hidden = !open;
  }

  function closePortalNav() {
    setPortalNavOpen(false);
  }

  function setupHeaderNav() {
    portalNavToggle?.addEventListener("click", () => {
      setPortalNavOpen(!document.body.classList.contains("portal-nav-open"));
    });

    portalNavBackdrop?.addEventListener("click", closePortalNav);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePortalNav();
    });

    adminNavLinks?.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = document.getElementById(link.getAttribute("href").slice(1));
        adminNavLinks.querySelectorAll(".portal-nav-link").forEach((el) => el.classList.remove("is-active"));
        link.classList.add("is-active");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          closePortalNav();
        }
      });
    });
  }

  async function boot() {
    const user = await Portal.requireAuth();
    if (!user) return;

    dashboardUser = user;
    isAdminUser = user.role === "admin" || user.role === "assistant";

    if (isAdminUser) {
      document.body.classList.add("portal-admin-nav");
      adminNavLinks.hidden = false;
      portalNavToggle.hidden = false;
      await loadAssignees();
      setupAdminControls();
      if (taskAssigneeFilterWrap) taskAssigneeFilterWrap.hidden = false;
    } else if (user.role === "lawyer") {
      assigneeNames = { [user.id]: user.name };
    }

    setupTaskControls();
    setupSearchControls();
    setupListActions();
    setupHeaderNav();

    await refreshDashboard();
  }

  window.addEventListener("gz:languagechange", renderDashboard);

  logoutBtn.addEventListener("click", async () => {
    try {
      await Portal.request("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    window.location.href = "/portal/login.html";
  });

  boot();
})();
