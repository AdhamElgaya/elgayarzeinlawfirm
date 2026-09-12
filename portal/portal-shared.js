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
  let caseSectionSelect;
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
  let sections = [];
  let clients = [];
  let assigneeNames = {};
  let isAdminUser = false;
  let isAdminOnly = false;
  let isSectionManager = false;
  let isSubsectionLead = false;
  let canCreateTasks = false;
  let canAssignTaskToOthers = false;
  let caseInboxMode = new URLSearchParams(window.location.search).get("inbox") === "1" ? "inbox" : "all";
  let libraryPickerTarget = null;
  let libraryPickerItems = [];
  let libraryPickerTotal = 0;
  let libraryPickerOffset = 0;
  let libraryPickerLoading = false;
  const LIBRARY_PAGE_SIZE = 25;
  let dashboardUser = null;
  let dashboardData = null;
  let archivedCases = [];
  let taskDateMode = "today";
  let taskScopeMode = "mine";
  let selectedTaskDate = Portal.formatDateInput(new Date());

  function badge(status) {
    const valid = ["active", "finished", "open", "done", "missed", "archived"];
    if (!valid.includes(status)) return "";
    const cls =
      status === "active"
        ? "portal-badge--active"
        : status === "finished" || status === "done"
          ? "portal-badge--finished"
          : status === "missed"
            ? "portal-badge--missed"
            : "portal-badge--open";
    return `<span class="portal-badge ${cls}">${Portal.statusLabel(status)}</span>`;
  }

  function showMoreBtn(action, id) {
    return `<button type="button" class="portal-link-btn" data-action="${action}" data-id="${Portal.escapeHtml(id)}">عرض</button>`;
  }

  function infoIconBtn(action, id, label = "التفاصيل") {
    return `<button type="button" class="portal-quick-btn portal-quick-btn--info" data-action="${action}" data-id="${Portal.escapeHtml(id)}" title="${Portal.escapeHtml(label)}" aria-label="${Portal.escapeHtml(label)}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6" stroke-linecap="round" />
        <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
      </svg>
    </button>`;
  }

  function taskQuickActions(task) {
    if (task.status === "missed") {
      return `<div class="portal-quick-actions">${infoIconBtn("show-task", task.id)}</div>`;
    }
    const checkActive = task.status === "done" ? " is-active" : "";
    const missActive = task.status === "open" ? " is-active" : "";
    return `<div class="portal-quick-actions">
      <button type="button" class="portal-quick-btn portal-quick-btn--done${checkActive}" data-action="task-done" data-id="${Portal.escapeHtml(task.id)}" title="مكتملة" aria-label="مكتملة">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <path d="M5 12.5l5 5L19 7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button type="button" class="portal-quick-btn portal-quick-btn--open${missActive}" data-action="task-incomplete" data-id="${Portal.escapeHtml(task.id)}" title="غير مكتملة" aria-label="غير مكتملة">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
        </svg>
      </button>
      ${infoIconBtn("show-task", task.id)}
    </div>`;
  }

  function renderWelcome(user) {
    if (!welcomeText) return;
    welcomeText.textContent = `${Portal.t("portal.dashboard.welcome", "مرحباً،")} ${user.name}`;
  }

  function renderStats(stats) {
    if (!statsGrid) return;
    const items = [
      [Portal.t("portal.dashboard.stat.activeCases", "قضايا جارية"), stats.activeCases],
      [Portal.t("portal.dashboard.stat.finishedCases", "قضايا موقوفة"), stats.finishedCases],
      [Portal.t("portal.dashboard.stat.archivedCases", "قضايا محفوظة"), stats.archivedCases],
      [Portal.t("portal.dashboard.stat.openTasks", "مهام مفتوحة"), stats.openTasks],
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
      const haystack = [client.name, client.phone || "", client.email || "", client.address || "", caseTitles]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  function caseSectionLabel(c) {
    if (c?.section_name) return c.section_name;
    if (c?.section_id) return c.section_id;
    return "صندوق الوارد";
  }

  function isStaffInboxCase(c) {
    return Boolean(isAdminUser && c && !c.section_id && c.status !== "archived");
  }

  function assignSectionBtn(id) {
    return `<button type="button" class="btn" data-action="assign-case-section" data-id="${Portal.escapeHtml(id)}">تعيين إلى الأقسام</button>`;
  }

  function setEditCaseDialogMode(assignSection) {
    const dialog = document.getElementById("editCaseDialog");
    const form = document.getElementById("editCaseForm");
    const titleEl = dialog?.querySelector("h2");
    const submitBtn = dialog?.querySelector('button[type="submit"]');
    if (form) form.dataset.assignSection = assignSection ? "1" : "";
    if (titleEl) titleEl.textContent = assignSection ? "تعيين إلى الأقسام" : "تعديل القضية";
    if (submitBtn) submitBtn.textContent = assignSection ? "تعيين" : "حفظ التعديلات";
  }

  function filterCases(rows) {
    let filtered = [...rows];
    if (pageType === "cases" && isAdminUser && caseInboxMode === "inbox") {
      filtered = filtered.filter((c) => !c.section_id);
    }
    const q = normalizeSearch(casesSearch?.value);
    if (!q) return filtered;
    return filtered.filter((c) => {
      const lawyer = assigneeNames[c.assigned_to] || "";
      const haystack = [
        c.case_number,
        c.opponent_name,
        c.title,
        c.client_name || "",
        caseSectionLabel(c),
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

    if ((isAdminUser || isSectionManager || isSubsectionLead) && pageType === "tasks" && taskScopeMode === "mine" && dashboardUser?.id) {
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
        (client) => `<li class="portal-list-item" data-action="show-client" data-id="${Portal.escapeHtml(client.id)}">
          <div class="portal-list-item__row">
            <div class="portal-list-item__content">
              <div class="portal-list-item__head">
                <strong>${Portal.escapeHtml(client.name)}</strong>
              </div>
              ${
                [client.phone, client.email]
                  .filter(Boolean)
                  .map((value) => `<span class="portal-list-item__meta">${Portal.escapeHtml(value)}</span>`)
                  .join("")
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
          : normalizeSearch(casesSearch?.value)
            ? "لا توجد نتائج مطابقة للبحث."
            : caseInboxMode === "inbox"
              ? "لا توجد قضايا في صندوق الوارد."
              : Portal.t("portal.dashboard.noCases", "لا توجد قضايا معينة بعد.");
      listEl.innerHTML = emptyState(emptyMsg);
      return;
    }
    const assigned = Portal.t("portal.dashboard.assignedTo", "معيّنة إلى:");
    listEl.innerHTML = rows
      .map((c) => {
        const assigneeLine =
          (isAdminUser || isSectionManager) && c.assigned_to && (assigneeNames[c.assigned_to] || c.lawyer_name)
            ? `${assigned} ${Portal.escapeHtml(assigneeNames[c.assigned_to] || c.lawyer_name)}`
            : "";
        const sectionLine = `القسم: ${Portal.escapeHtml([caseSectionLabel(c), c.subsection_name].filter(Boolean).join(" — "))}`;
        const clientLine = c.client_name ? `الموكل: ${Portal.escapeHtml(c.client_name)}` : "";
        const opponentLine = c.opponent_name ? `الخصم: ${Portal.escapeHtml(c.opponent_name)}` : "";
        const numberLine = c.case_number ? Portal.escapeHtml(c.case_number) : Portal.escapeHtml(c.title);
        return `<li class="portal-list-item" data-action="show-case" data-id="${Portal.escapeHtml(c.id)}">
          <div class="portal-list-item__row">
            <div class="portal-list-item__content">
              <div class="portal-list-item__head">
                <strong>${numberLine}</strong>
                ${badge(c.status)}
              </div>
              ${opponentLine ? `<span class="portal-list-item__assignee">${opponentLine}</span>` : ""}
              ${clientLine ? `<span class="portal-list-item__assignee">${clientLine}</span>` : ""}
              ${sectionLine ? `<span class="portal-list-item__assignee">${sectionLine}</span>` : ""}
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
          ((isAdminUser || isSectionManager || isSubsectionLead) && taskScopeMode === "mine"));
      const emptyMsg = hasFilters
        ? "لا توجد مهام مطابقة للبحث أو التاريخ المحدد."
        : Portal.t("portal.dashboard.noTasks", "لا توجد مهام بعد.");
      listEl.innerHTML = emptyState(emptyMsg);
      return;
    }
    const due = Portal.t("portal.dashboard.due", "موعد:");
    listEl.innerHTML = rows
      .map((t) => {
        const assignmentLine = taskAssignmentHtml(t);
        const assigneeLine = assignmentLine || "";
        const statusClass =
          t.status === "done"
            ? "portal-list-item--done"
            : t.status === "missed"
              ? "portal-list-item--missed"
              : "portal-list-item--open";
        return `<li class="portal-list-item ${statusClass}" data-action="show-task" data-id="${Portal.escapeHtml(t.id)}">
          <div class="portal-list-item__row">
            <div class="portal-list-item__content">
              <div class="portal-list-item__head">
                <strong>${Portal.escapeHtml(t.title)}</strong>
                ${badge(t.status)}
              </div>
              ${assigneeLine ? `<span class="portal-list-item__assignee">${assigneeLine}</span>` : ""}
              <span class="portal-list-item__meta">${Portal.escapeHtml(t.case_title)}${t.due_at ? ` — ${due} ${Portal.formatTaskDue(t.due_at)}` : ""}</span>
            </div>
            ${taskQuickActions(t)}
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

  function knownSections() {
    return sections.length
      ? sections
      : [
          { id: "section-1", name: "قسم 1" },
          { id: "section-2", name: "قسم 2" },
          { id: "section-3", name: "قسم 3" },
          { id: "section-4", name: "قسم 4" },
        ];
  }

  function subsectionsForSection(sectionId) {
    const row = knownSections().find((item) => item.id === sectionId);
    if (row?.subsections?.length) return row.subsections;
    if (["section-1", "section-2", "section-3", "section-4"].includes(sectionId)) {
      return [
        { id: "civil", name: "مدني" },
        { id: "criminal", name: "جنائي" },
        { id: "personal_status", name: "أحوال شخصية" },
        { id: "commercial", name: "تجاري" },
      ];
    }
    return [];
  }

  function fillSubsectionSelect(select, sectionId, selectedId = "") {
    if (!select) return;
    const rows = subsectionsForSection(sectionId);
    select.innerHTML =
      `<option value="">اختر القسم الفرعي</option>` +
      rows
        .map((item) => {
          const selected = selectedId === item.id ? " selected" : "";
          return `<option value="${Portal.escapeHtml(item.id)}"${selected}>${Portal.escapeHtml(item.name)}</option>`;
        })
        .join("");
    if (selectedId) select.value = selectedId;
  }

  function syncSubsectionField(sectionSelect, field, select, selectedId = "", sectionIdOverride = "") {
    const sectionId = sectionIdOverride || sectionSelect?.value || "";
    const rows = subsectionsForSection(sectionId);
    if (field) field.hidden = !rows.length;
    if (select) {
      select.required = Boolean(rows.length);
      fillSubsectionSelect(select, sectionId, rows.length ? selectedId : "");
    }
  }

  function fillSectionSelectOptions(select, selectedId = null, { requireSection = false } = {}) {
    if (!select) return;
    const rows = knownSections();
    const inboxSelected = !requireSection && !selectedId;
    const placeholder = requireSection
      ? `<option value="">اختر القسم</option>`
      : `<option value=""${inboxSelected ? " selected" : ""}>صندوق الوارد</option>`;
    select.required = requireSection;
    select.innerHTML =
      placeholder +
      rows
        .map((section) => {
          const selected = selectedId === section.id ? " selected" : "";
          const managerName = section.manager?.name ? ` — ${section.manager.name}` : " — بدون مدير";
          return `<option value="${Portal.escapeHtml(section.id)}"${selected}>${Portal.escapeHtml(section.name)}${Portal.escapeHtml(managerName)}</option>`;
        })
        .join("");
    if (requireSection && selectedId) select.value = selectedId;
  }

  function isSelfAssignee(id) {
    return Boolean(id && dashboardUser?.id && String(id) === String(dashboardUser.id));
  }

  function assigneeOptionText(user) {
    const role = Portal.roleLabel(user?.role || dashboardUser?.role || "lawyer");
    if (isSelfAssignee(user?.id)) return `لنفسي — ${role}`;
    return `${user.name} — ${role}`;
  }

  function fillAssigneeSelectOptions(select, selectedId = null) {
    if (!select) return;
    select.innerHTML = assignees
      .map((u) => {
        const selected = selectedId === u.id ? " selected" : "";
        return `<option value="${u.id}"${selected}>${Portal.escapeHtml(assigneeOptionText(u))}</option>`;
      })
      .join("");

    if (selectedId && ![...select.options].some((option) => option.value === selectedId)) {
      const name = isSelfAssignee(selectedId) ? "لنفسي" : assigneeNames[selectedId];
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

  function taskAssigneesForCase(caseId) {
    if (!isSubsectionLead) return assignees;
    const caseRow = (dashboardData?.cases || []).find((item) => item.id === caseId);
    if (!caseRow?.subsection_id) return [];
    return assignees.filter(
      (user) =>
        user.subsection_id === caseRow.subsection_id &&
        (!user.section_id || user.section_id === caseRow.section_id)
    );
  }

  function fillTaskAssigneeSelect(select, selectedId = null, caseId = null) {
    if (!select) return;
    const source = isSubsectionLead ? taskAssigneesForCase(caseId || taskCaseSelect?.value) : assignees;
    const selfId = dashboardUser?.id || "";
    const selfOption = selfId
      ? `<option value="${Portal.escapeHtml(selfId)}">${Portal.escapeHtml(
          assigneeOptionText({ id: selfId, role: dashboardUser.role })
        )}</option>`
      : "";
    const teamOptions = source
      .filter((u) => u.id !== selfId)
      .map((u) => `<option value="${u.id}">${Portal.escapeHtml(assigneeOptionText(u))}</option>`)
      .join("");
    select.innerHTML = `<option value="" disabled${selectedId ? "" : " selected"}>اختر المعيّن</option>${selfOption}${teamOptions}`;

    const targetId = selectedId || null;
    if (!targetId) return;

    if (![...select.options].some((option) => option.value === targetId)) {
      const label = isSelfAssignee(targetId) ? "لنفسي" : assigneeNames[targetId] || "معيّن سابق";
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${Portal.escapeHtml(targetId)}">${Portal.escapeHtml(label)}</option>`
      );
    }
    select.value = targetId;
  }

  function syncTaskAssigneeFromCase(caseId) {
    if ((!isAdminUser && !isSubsectionLead) || !taskAssigneeSelect || !caseId) return;
    if (isSubsectionLead) {
      fillTaskAssigneeSelect(taskAssigneeSelect, null, caseId);
      return;
    }
    const caseRow = (dashboardData?.cases || []).find((item) => item.id === caseId);
    if (!caseRow?.section_id) return;
    const manager = assignees.find((user) => user.section_id === caseRow.section_id);
    if (manager) fillTaskAssigneeSelect(taskAssigneeSelect, manager.id);
  }

  function fillTaskAssigneeFilter() {
    if ((!isAdminUser && !isSectionManager && !isSubsectionLead) || !taskAssigneeFilter) return;
    taskAssigneeFilter.innerHTML =
      `<option value="">الكل</option>` +
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
    try {
      if (isAdminUser || isSectionManager) {
        const sectionData = await Portal.request("/sections");
        sections = sectionData.sections || [];
        for (const section of sections) {
          if (section.manager?.id) assigneeNames[section.manager.id] = section.manager.name;
          for (const member of section.members || []) {
            assigneeNames[member.id] = member.name;
          }
        }
      }
    } catch {
      sections = [];
    }
    if (isAdminUser) {
      fillSectionSelectOptions(caseSectionSelect);
      fillSectionSelectOptions(document.getElementById("editCaseSectionSelect"));
      fillLibrarySectionAccess();
      fillTaskAssigneeSelect(taskAssigneeSelect);
      fillTaskAssigneeFilter();
    }
    if (isSectionManager) {
      fillAssigneeSelectOptions(document.getElementById("editCaseAssigneeSelect"));
      fillTaskAssigneeSelect(taskAssigneeSelect);
      fillTaskAssigneeFilter();
    }
    if (isSubsectionLead) {
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

  function clientDocumentRow(label, doc) {
    if (!doc?.id || !(doc.filename || doc.url)) {
      return detailRow(label, "—");
    }
    return `<div class="portal-detail-row portal-detail-row--file"><span>${label}</span><strong><ul class="portal-task-attachment-list">${renderTaskAttachmentListItem(doc)}</ul></strong></div>`;
  }

  function taskAssignmentHtml(task) {
    const name =
      ((isAdminUser || isSectionManager) && task.assigned_to && assigneeNames[task.assigned_to]) ||
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
    if (isAdminUser && !isAdminOnly) return;
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
              ${isAdminOnly ? deleteBtn("delete-client", client.id) : ""}
              <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeDetailBtn">إغلاق</button>
            </div>
          </div>
          ${detailRow("الهاتف", client.phone ? Portal.escapeHtml(client.phone) : "—")}
          ${detailRow(
            "البريد الإلكتروني",
            client.email
              ? `<a href="mailto:${Portal.escapeHtml(client.email)}" dir="ltr">${Portal.escapeHtml(client.email)}</a>`
              : "—"
          )}
          ${detailRow("العنوان", client.address ? Portal.escapeHtml(client.address) : "—")}
          ${clientDocumentRow("صورة التوكيل", client.poa_document)}
          ${clientDocumentRow("صورة البطاقة", client.id_document)}
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

  function safeExternalUrl(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    try {
      const parsed = new URL(value, window.location.origin);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function attachmentHref(item) {
    const api = typeof Portal.apiRoot === "function" ? Portal.apiRoot() : "/api";
    if (item?.filename && item?.id) return `${api}/dashboard/attachments/${encodeURIComponent(item.id)}`;
    return safeExternalUrl(item?.url);
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
      const type =
        blob.type && blob.type !== "application/octet-stream" ? blob.type : guessedType;
      const downloadName = originalName || filename || label || "attachment";
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

      if (type === "text/plain" || type.startsWith("text/")) {
        attachmentPreviewBody.innerHTML = `<pre class="portal-preview-text">${Portal.escapeHtml(await blob.text())}</pre>`;
        return;
      }

      const downloadHref = Portal.escapeHtml(previewObjectUrl);
      const officeHint = isOfficeAttachment(type, originalName, filename, label)
        ? "ملفات Word وExcel لا تُعرض داخل المتصفح."
        : "هذا النوع من الملفات لا يُعرض داخل المتصفح.";
      attachmentPreviewBody.innerHTML = `<div class="portal-preview-fallback">
        <p class="portal-alert">${officeHint} يمكنك تنزيله لفتحه على جهازك.</p>
        <a class="btn" href="${downloadHref}" download="${Portal.escapeHtml(downloadName)}">تنزيل المرفق</a>
      </div>`;
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
          <input type="file" class="portal-attachment-file-input" accept="${Portal.UPLOAD_ACCEPT || ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt"}" />
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
      const canEdit = isAdminUser || isSectionManager || c.assigned_to === dashboardUser?.id;
      const canDeleteAttachments = isAdminOnly;
      const canManageLibrary = isAdminUser || isSectionManager;
      const canEditCaseInfo = (isAdminOnly || isSectionManager) && c.status !== "archived";
      const canArchiveCase = isAdminUser && c.status !== "archived";
      const latest = c.latest_task;
      const latestHtml = latest
        ? `<div class="portal-detail-situation portal-detail-situation--${
            latest.status === "done" ? "done" : latest.status === "missed" ? "missed" : "open"
          }">
            <strong>الوضع الحالي (آخر مهمة)</strong>
            <p>${Portal.escapeHtml(latest.title)} — ${Portal.statusLabel(latest.status)}</p>
            ${latest.due_at ? `<span class="portal-list-item__meta">مستحق: ${Portal.formatTaskDue(latest.due_at)}</span>` : ""}
          </div>`
        : `<p class="portal-detail-empty">لا توجد مهام بعد لهذه القضية.</p>`;
      const attachments = c.attachments || [];
      detailDialogBody.innerHTML = `
          <div class="portal-detail" data-case-id="${c.id}" data-section-id="${Portal.escapeHtml(c.section_id || "")}">
          <div class="portal-detail-head">
            <h2>${Portal.escapeHtml(c.case_number || c.title)}</h2>
            <div class="portal-detail-head-actions">
              ${canEditCaseInfo ? editBtn("edit-case", c.id) : ""}
              ${canArchiveCase ? archiveBtn("archive-case", c.id) : ""}
              ${!canEdit ? `<button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeDetailBtn">إغلاق</button>` : ""}
            </div>
          </div>
          ${isStaffInboxCase(c) ? `<div class="portal-detail-cta">${assignSectionBtn(c.id)}</div>` : ""}
          ${detailRow("الموكل", c.client?.name ? Portal.escapeHtml(c.client.name) : "—")}
          ${detailRow("الخصم", c.opponent_name ? Portal.escapeHtml(c.opponent_name) : "—")}
          ${detailRow("القسم", Portal.escapeHtml(caseSectionLabel(c)))}
          ${c.subsection_name ? detailRow("القسم الفرعي", Portal.escapeHtml(c.subsection_name)) : ""}
          ${detailRow("المسؤول الحالي", c.lawyer?.name ? `${Portal.escapeHtml(c.lawyer.name)} (${Portal.roleLabel(c.lawyer.role)})` : "—")}
          ${detailRow("الحالة", Portal.statusLabel(c.status))}
          <h3 class="portal-detail-subtitle">الوضع الحالي</h3>
          ${latestHtml}
          <h3 class="portal-detail-subtitle">مستجدات القضيه</h3>
          ${
            canEdit
              ? `<textarea id="caseNotesInput" class="portal-detail-notes" rows="4" placeholder="أضف مستجدات عن القضية...">${Portal.escapeHtml(c.notes || "")}</textarea>`
              : `<p class="portal-detail-text">${c.notes ? Portal.escapeHtml(c.notes) : "لا توجد مستجدات."}</p>`
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
                    ${canManageLibrary ? `<button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="addAttachmentBtn">إضافة مرفق</button>` : ""}
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

  async function openEditCaseDialog(caseId, { assignSection = false } = {}) {
    if (!isAdminUser && !isSectionManager) return;
    if (!isAdminOnly && !isSectionManager && !assignSection) return;
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
      form.dataset.sectionId = c.section_id || "";
      const titleInput = document.getElementById("editCaseTitle");
      const opponentInput = document.getElementById("editCaseOpponent");
      const numberInput = document.getElementById("editCaseNumber");
      const opponentField = document.getElementById("editCaseOpponentField");
      const numberField = document.getElementById("editCaseNumberField");
      const titleField = document.getElementById("editCaseTitleField");
      if (titleInput) titleInput.value = c.title || "";
      if (opponentInput) opponentInput.value = c.opponent_name || "";
      if (numberInput) numberInput.value = c.case_number || "";
      fillClientSelectOptions(document.getElementById("editCaseClientSelect"), c.client?.id);
      const sectionField = document.getElementById("editCaseSectionField");
      const lawyerField = document.getElementById("editCaseLawyerField");
      const clientSelect = document.getElementById("editCaseClientSelect");
      const statusEl = document.getElementById("editCaseStatus");
      if (isSectionManager && !isAdminUser) {
        if (sectionField) sectionField.hidden = true;
        if (lawyerField) lawyerField.hidden = false;
        fillAssigneeSelectOptions(document.getElementById("editCaseAssigneeSelect"), c.assigned_to);
        syncSubsectionField(
          null,
          document.getElementById("editCaseSubsectionField"),
          document.getElementById("editCaseSubsectionSelect"),
          c.subsection_id || "",
          c.section_id
        );
        if (titleField) titleField.hidden = false;
        if (titleInput) {
          titleInput.disabled = true;
          titleInput.required = false;
        }
        if (opponentField) opponentField.hidden = true;
        if (numberField) numberField.hidden = true;
        if (opponentInput) {
          opponentInput.required = false;
          opponentInput.disabled = true;
        }
        if (numberInput) {
          numberInput.required = false;
          numberInput.disabled = true;
        }
        if (clientSelect) clientSelect.disabled = true;
        if (statusEl) statusEl.disabled = false;
      } else {
        const clientField = document.getElementById("editCaseClientField");
        const statusField = document.getElementById("editCaseStatusField");
        if (clientField) clientField.hidden = false;
        if (statusField) statusField.hidden = false;
        if (sectionField) sectionField.hidden = false;
        if (lawyerField) lawyerField.hidden = true;
        fillSectionSelectOptions(document.getElementById("editCaseSectionSelect"), c.section_id);
        const editSubField = document.getElementById("editCaseSubsectionField");
        if (editSubField) editSubField.hidden = true;
        const editSubSelect = document.getElementById("editCaseSubsectionSelect");
        if (editSubSelect) editSubSelect.required = false;
        if (titleField) titleField.hidden = true;
        if (titleInput) {
          titleInput.disabled = true;
          titleInput.required = false;
        }
        if (opponentField) opponentField.hidden = false;
        if (numberField) numberField.hidden = false;
        if (opponentInput) {
          opponentInput.required = true;
          opponentInput.disabled = false;
        }
        if (numberInput) {
          numberInput.required = true;
          numberInput.disabled = false;
        }
        if (clientSelect) clientSelect.disabled = false;
        if (statusEl) statusEl.disabled = false;
      }
      if (statusEl) statusEl.value = c.status === "finished" ? "finished" : "active";

      const assignSectionOnly = Boolean(assignSection && !isAdminOnly && isStaffInboxCase(c));
      if (assignSectionOnly) {
        const clientField = document.getElementById("editCaseClientField");
        const statusField = document.getElementById("editCaseStatusField");
        if (clientField) clientField.hidden = true;
        if (statusField) statusField.hidden = true;
        if (titleField) titleField.hidden = true;
        if (opponentField) opponentField.hidden = true;
        if (numberField) numberField.hidden = true;
        if (lawyerField) lawyerField.hidden = true;
        const editSubField = document.getElementById("editCaseSubsectionField");
        if (editSubField) editSubField.hidden = true;
        if (sectionField) sectionField.hidden = false;
        if (clientSelect) {
          clientSelect.required = false;
          clientSelect.disabled = true;
        }
        if (opponentInput) {
          opponentInput.required = false;
          opponentInput.disabled = true;
        }
        if (numberInput) {
          numberInput.required = false;
          numberInput.disabled = true;
        }
        if (statusEl) statusEl.disabled = true;
        fillSectionSelectOptions(document.getElementById("editCaseSectionSelect"), c.section_id, {
          requireSection: true,
        });
      }

      setEditCaseDialogMode(assignSection && isStaffInboxCase(c));
      dialog.showModal();
      if (assignSection && isStaffInboxCase(c)) {
        document.getElementById("editCaseSectionSelect")?.focus();
      }
    } catch (error) {
      Portal.showToast(error.message, "error");
    }
  }

  async function openEditTaskDialog(taskId) {
    if (!isAdminUser && !isSectionManager && !isSubsectionLead) return;
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
      if (isSectionManager && !isAdminUser && t.status !== "open") {
        Portal.showToast("يمكن إعادة تعيين المهام غير المكتملة فقط.", "error");
        return;
      }
      document.getElementById("editTaskId").value = t.id;
      document.getElementById("editTaskCaseTitle").textContent = t.case_title || "—";
      document.getElementById("editTaskTitle").value = t.title;
      const assigneeLabel = document.getElementById("editTaskAssigneeLabel");
      if (assigneeLabel) {
        assigneeLabel.textContent =
          (isSectionManager && !isAdminUser) || isSubsectionLead ? "تعيين للمحامي" : "تعيين إلى مدير القسم";
      }
      fillTaskAssigneeSelect(document.getElementById("editTaskAssigneeSelect"), t.assigned_to, t.case_id);
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
      const canDeleteTask = isAdminOnly || (!isAdminUser && t.assigned_to === dashboardUser?.id);
      const canEditTask = isAdminUser || (isSectionManager && t.status === "open") || (isSubsectionLead && t.status === "open");
      const canChangeTaskStatus = isAdminUser || isSectionManager || t.assigned_to === dashboardUser?.id;
      const taskAttachments = (t.attachments || []).filter(isSavedAttachment);
      const attachmentsHtml = taskAttachments.length
        ? `<ul class="portal-task-attachment-list">${taskAttachments.map((a) => renderTaskAttachmentListItem(a)).join("")}</ul>`
        : `<p class="portal-detail-empty">لا توجد مرفقات مرتبطة بهذه المهمة.</p>`;
      detailDialogBody.innerHTML = `
        <div class="portal-detail" data-task-id="${t.id}">
          <div class="portal-detail-head">
            <h2>${Portal.escapeHtml(t.title)}</h2>
            <div class="portal-detail-head-actions">
              ${canEditTask ? editBtn("edit-task", t.id) : ""}
              ${canDeleteTask ? deleteBtn("delete-task", t.id) : ""}
              <button type="button" class="portal-btn-ghost portal-btn-ghost--sm" id="closeDetailBtn">إغلاق</button>
            </div>
          </div>
          ${detailRow("القضية", Portal.escapeHtml(t.case_title || "—"))}
          ${detailRow("معيّنة إلى", taskAssignmentHtml(t) || "—")}
          ${detailRow("الحالة", Portal.statusLabel(t.status))}
          ${
            t.incomplete_reason && (t.status === "open" || t.status === "missed")
              ? detailRow("سبب عدم الاكتمال", Portal.escapeHtml(t.incomplete_reason))
              : ""
          }
          ${detailRow("موعد المهمة", t.due_at ? Portal.formatTaskDue(t.due_at) : "—")}
          <h3 class="portal-detail-subtitle">مرفقات المهمة</h3>
          ${attachmentsHtml}
          ${
            canChangeTaskStatus && t.status !== "missed"
              ? `<div class="portal-detail-actions portal-detail-actions--status">
            <button type="button" class="portal-status-btn portal-status-btn--done" data-status="done">مكتملة</button>
            <button type="button" class="portal-status-btn portal-status-btn--open" data-status="open">غير مكتملة</button>
          </div>`
              : ""
          }
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

  let incompleteReasonTaskId = "";
  let incompleteReasonOpenDetail = true;

  function setupIncompleteReasonDialog() {
    const dialog = document.getElementById("incompleteReasonDialog");
    const form = document.getElementById("incompleteReasonForm");
    const input = document.getElementById("incompleteReasonInput");
    const alertEl = document.getElementById("incompleteReasonAlert");
    const cancelBtn = document.getElementById("incompleteReasonCancel");
    if (!dialog || !form || dialog.dataset.bound) return;
    dialog.dataset.bound = "1";

    cancelBtn?.addEventListener("click", () => {
      incompleteReasonTaskId = "";
      dialog.close();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const reason = String(input?.value || "").trim();
      if (!reason) {
        Portal.showAlert(alertEl, "السبب مطلوب.");
        return;
      }
      const taskId = incompleteReasonTaskId;
      incompleteReasonTaskId = "";
      dialog.close();
      if (taskId) await updateTaskStatus(taskId, "open", reason, { openDetail: incompleteReasonOpenDetail });
    });
  }

  function askIncompleteReason(taskId, { openDetail = true } = {}) {
    setupIncompleteReasonDialog();
    const dialog = document.getElementById("incompleteReasonDialog");
    const form = document.getElementById("incompleteReasonForm");
    const alertEl = document.getElementById("incompleteReasonAlert");
    if (!dialog || !form) return;
    incompleteReasonTaskId = taskId;
    incompleteReasonOpenDetail = openDetail;
    Portal.hideAlert(alertEl);
    form.reset();
    dialog.showModal();
  }

  async function updateTaskStatus(taskId, status, incompleteReason = "", { openDetail = true } = {}) {
    const alertEl = document.getElementById("taskDetailAlert");
    Portal.hideAlert(alertEl);
    try {
      const body = { status };
      if (status === "open") body.incomplete_reason = incompleteReason;
      await Portal.request(`/dashboard/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      dashboardData = await Portal.request("/dashboard/summary");
      renderPage();
      const openId = detailDialogBody?.querySelector("[data-task-id]")?.dataset.taskId;
      if (openDetail || (detailDialog?.open && openId === taskId)) {
        await openTaskDetail(taskId);
      }
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

      if (Portal.isBlockedUploadFile?.(pendingFile)) {
        throw new Error(Portal.ZIP_REJECT_MESSAGE || "لا يمكن رفع ملفات ZIP.");
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

  function askFileAddConfirm(fileName) {
    const titleEl = confirmDeleteDialog.querySelector("h2");
    const previousTitle = titleEl?.textContent;
    const previousOkLabel = confirmDeleteOk.textContent;
    const previousOkClass = confirmDeleteOk.className;

    if (titleEl) titleEl.textContent = "تأكيد إضافة الملف";
    confirmDeleteMessage.textContent = `هل أنت متأكد أنك تريد إضافة ${fileName}؟`;
    confirmDeleteOk.textContent = "إضافة";
    confirmDeleteOk.className = "btn";

    return new Promise((resolve) => {
      const keepParentOpen = (event) => event.preventDefault();
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
        confirmDeleteDialog.removeEventListener("cancel", onCancel);
        addClientDialog?.removeEventListener("cancel", keepParentOpen);
        if (titleEl && previousTitle) titleEl.textContent = previousTitle;
        confirmDeleteOk.textContent = previousOkLabel;
        confirmDeleteOk.className = previousOkClass;
        confirmDeleteDialog.close();
      };
      confirmDeleteCancel.addEventListener("click", onCancel);
      confirmDeleteOk.addEventListener("click", onOk);
      confirmDeleteDialog.addEventListener("cancel", onCancel);
      addClientDialog?.addEventListener("cancel", keepParentOpen);
      confirmDeleteDialog.showModal();
    });
  }

  function syncClientFilePicker(input) {
    const wrap = input.closest(".portal-client-file");
    const nameEl = wrap?.querySelector(".portal-client-file__name");
    const clearBtn = wrap?.querySelector(".portal-client-file__clear");
    const file = input.files?.[0];
    if (nameEl) nameEl.textContent = file?.name || "لم يُختر ملف";
    wrap?.classList.toggle("has-file", Boolean(file));
    wrap?.classList.toggle("is-locked", Boolean(file) && !isAdminOnly);
    if (clearBtn) clearBtn.hidden = !(isAdminOnly && file);
  }

  function resetClientFileNames() {
    addClientForm?.querySelectorAll(".portal-client-file__input").forEach((input) => {
      input.value = "";
      syncClientFilePicker(input);
    });
  }

  function setupClientControls() {
    if (!isAdminUser) return;
    if (addClientBtn) addClientBtn.hidden = false;

    addClientForm?.querySelectorAll(".portal-client-file__input").forEach((input) => {
      if (input.dataset.bound) return;
      input.dataset.bound = "1";
      const wrap = input.closest(".portal-client-file");
      const clearBtn = wrap?.querySelector(".portal-client-file__clear");
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) {
          syncClientFilePicker(input);
          return;
        }
        if (!isAdminOnly) {
          const ok = await askFileAddConfirm(file.name);
          if (!ok) {
            input.value = "";
            syncClientFilePicker(input);
            return;
          }
        }
        syncClientFilePicker(input);
      });
      clearBtn?.addEventListener("click", () => {
        if (!isAdminOnly) return;
        input.value = "";
        syncClientFilePicker(input);
      });
    });

    addClientBtn?.addEventListener("click", () => {
      Portal.hideAlert(addClientAlert);
      addClientForm.reset();
      resetClientFileNames();
      addClientDialog.showModal();
    });

    document.getElementById("cancelClientBtn")?.addEventListener("click", () => addClientDialog.close());

    addClientForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      Portal.hideAlert(addClientAlert);
      const fd = new FormData(addClientForm);
      const submitBtn = addClientForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await Portal.upload("/admin/clients", fd);
        addClientDialog.close();
        await refresh();
      } catch (error) {
        Portal.showAlert(addClientAlert, error.message);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function sectionDisplayName(id) {
    const row = knownSections().find((item) => item.id === id);
    return row?.name || id || "";
  }

  function fillLibrarySectionAccess() {
    const field = document.getElementById("librarySectionAccess");
    if (!field) return;
    field.hidden = true;
    field.innerHTML = knownSections()
      .map(
        (section) =>
          `<label class="portal-check"><input type="checkbox" name="section_ids" value="${Portal.escapeHtml(section.id)}" /> <span>${Portal.escapeHtml(section.name)}</span></label>`
      )
      .join("");
  }

  function libraryPickerDialog() {
    return document.getElementById("libraryPickerDialog");
  }

  function currentCaseAttachmentIds() {
    if (!libraryPickerTarget) return [];
    return [...libraryPickerTarget.querySelectorAll("[data-attachment-id]")].map((row) => row.dataset.attachmentId);
  }

  function resetLibraryUploadForm(form) {
    if (!form) return;
    form.hidden = true;
    form.reset();
    const nameEl = document.getElementById("libraryUploadFileName");
    if (nameEl) nameEl.textContent = "لم يُختر ملف";
  }

  function setLibraryPickerMode(mode) {
    const uploading = mode === "upload";
    const uploadForm = document.getElementById("libraryUploadForm");
    const scrollEl = document.getElementById("libraryPickerScroll");
    const footer = document.getElementById("libraryPickerFooter");
    const addBtn = document.getElementById("libraryAddNewBtn");
    const title = document.getElementById("libraryPickerTitle");
    if (uploadForm) uploadForm.hidden = !uploading;
    if (scrollEl) scrollEl.hidden = uploading;
    if (footer) footer.hidden = uploading;
    if (addBtn) addBtn.hidden = uploading;
    if (title) title.textContent = uploading ? "ملف جديد" : "اختر ملفاً";
  }

  function attachLibraryItem(item) {
    if (!libraryPickerTarget || !item?.id) return;
    if (currentCaseAttachmentIds().includes(item.id)) return;
    libraryPickerTarget.insertAdjacentHTML("beforeend", savedAttachmentRow(item, true));
  }

  async function loadLibraryPage({ reset = false } = {}) {
    if (libraryPickerLoading) return;
    if (!reset && libraryPickerTotal && libraryPickerOffset >= libraryPickerTotal) return;
    libraryPickerLoading = true;
    try {
      const offset = reset ? 0 : libraryPickerOffset;
      const data = await Portal.request(
        `/library-attachments?offset=${encodeURIComponent(offset)}&limit=${LIBRARY_PAGE_SIZE}`
      );
      const rows = data.attachments || [];
      libraryPickerTotal = Number(data.total || 0);
      if (reset) {
        libraryPickerItems = rows;
        libraryPickerOffset = rows.length;
      } else {
        const seen = new Set(libraryPickerItems.map((item) => item.id));
        for (const row of rows) {
          if (!seen.has(row.id)) libraryPickerItems.push(row);
        }
        libraryPickerOffset = libraryPickerItems.length;
      }
      const sentinel = document.getElementById("libraryPickerSentinel");
      if (sentinel) sentinel.hidden = libraryPickerOffset >= libraryPickerTotal;
    } finally {
      libraryPickerLoading = false;
    }
  }

  function renderLibraryPickerTable() {
    const body = document.getElementById("libraryPickerBody");
    if (!body) return;
    if (!libraryPickerItems.length) {
      body.innerHTML = `<li class="portal-empty">لا توجد ملفات. اضغط «ملف جديد».</li>`;
      return;
    }
    const onCase = new Set(currentCaseAttachmentIds());
    body.innerHTML = libraryPickerItems
      .map((item) => {
        const added = onCase.has(item.id);
        return `<li class="portal-list-item${added ? " is-picked" : ""}" data-row-id="${Portal.escapeHtml(item.id)}">
          <div class="portal-list-item__row">
            <div class="portal-list-item__content">
              <strong>${Portal.escapeHtml(item.label || "ملف")}</strong>
            </div>
            <span class="portal-link-btn" aria-hidden="true">${added ? "مضاف" : "اختيار"}</span>
          </div>
        </li>`;
      })
      .join("");
  }

  async function openLibraryPicker(listEl, sectionId) {
    const dialog = libraryPickerDialog();
    const alertEl = document.getElementById("libraryPickerAlert");
    if (!dialog || !listEl) return;
    libraryPickerTarget = listEl;
    Portal.hideAlert(alertEl);
    resetLibraryUploadForm(document.getElementById("libraryUploadForm"));
    setLibraryPickerMode("pick");
    try {
      await loadLibraryPage({ reset: true });
      renderLibraryPickerTable();
      dialog.showModal();
    } catch (error) {
      Portal.showAlert(alertEl, error.message || "تعذر تحميل المرفقات.");
      dialog.showModal();
    }
  }

  function setupLibraryPicker() {
    const dialog = libraryPickerDialog();
    if (!dialog || dialog.dataset.bound) return;
    dialog.dataset.bound = "1";

    const uploadForm = document.getElementById("libraryUploadForm");
    fillLibrarySectionAccess();

    const fileInput = document.getElementById("libraryUploadFile");
    const fileName = document.getElementById("libraryUploadFileName");
    fileInput?.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (fileName) fileName.textContent = file?.name || "لم يُختر ملف";
      const labelInput = uploadForm?.querySelector('input[name="label"]');
      if (labelInput && !labelInput.value.trim() && file?.name) {
        labelInput.value = file.name.replace(/\.[^.]+$/, "");
      }
    });

    const scrollEl = document.getElementById("libraryPickerScroll");
    const sentinel = document.getElementById("libraryPickerSentinel");
    if (scrollEl && sentinel && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        async (entries) => {
          if (!dialog.open || !entries.some((entry) => entry.isIntersecting)) return;
          await loadLibraryPage();
          renderLibraryPickerTable();
        },
        { root: scrollEl, rootMargin: "80px" }
      );
      observer.observe(sentinel);
    } else {
      scrollEl?.addEventListener("scroll", async () => {
        if (!dialog.open || libraryPickerLoading) return;
        if (scrollEl.scrollTop + scrollEl.clientHeight < scrollEl.scrollHeight - 80) return;
        await loadLibraryPage();
        renderLibraryPickerTable();
      });
    }

    document.getElementById("libraryAddNewBtn")?.addEventListener("click", () => {
      if (!uploadForm) return;
      uploadForm.reset();
      if (fileName) fileName.textContent = "لم يُختر ملف";
      if (isAdminUser) {
        fillLibrarySectionAccess();
        const sectionId = caseSectionSelect?.value || libraryPickerTarget?.dataset.sectionId || "";
        uploadForm.querySelectorAll('input[name="section_ids"]').forEach((input) => {
          input.checked = !sectionId || input.value === sectionId;
        });
      }
      setLibraryPickerMode("upload");
    });

    document.getElementById("cancelLibraryUploadBtn")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resetLibraryUploadForm(uploadForm);
      setLibraryPickerMode("pick");
    });

    document.getElementById("cancelLibraryPickerBtn")?.addEventListener("click", () => dialog.close());

    uploadForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const alertEl = document.getElementById("libraryPickerAlert");
      Portal.hideAlert(alertEl);
      const fd = new FormData(uploadForm);
      const label = String(fd.get("label") || "").trim();
      const file = fd.get("file");
      if (!label || !file || (file instanceof File && !file.size && !file.name)) {
        Portal.showAlert(alertEl, "اختر ملفاً.");
        return;
      }
      if (file instanceof File && Portal.isBlockedUploadFile?.(file)) {
        Portal.showAlert(alertEl, Portal.ZIP_REJECT_MESSAGE || "لا يمكن رفع ملفات ZIP.");
        return;
      }
      const uploadFd = new FormData();
      uploadFd.append("label", label);
      uploadFd.append("file", file);
      if (isAdminUser) {
        const ids = [...uploadForm.querySelectorAll('input[name="section_ids"]:checked')].map((el) => el.value);
        uploadFd.append("section_ids", JSON.stringify(ids));
      }
      try {
        const data = await Portal.upload("/library-attachments", uploadFd);
        if (data.attachment) attachLibraryItem(data.attachment);
        dialog.close();
        Portal.showToast("تم رفع الملف.", "success");
      } catch (error) {
        Portal.showAlert(alertEl, error.message);
      }
    });

    dialog.addEventListener("click", (event) => {
      if (!event.target.closest("#libraryPickerBody")) return;
      const row = event.target.closest("[data-row-id]");
      if (!row) return;
      const item = libraryPickerItems.find((entry) => entry.id === row.dataset.rowId);
      if (!item) return;
      attachLibraryItem(item);
      dialog.close();
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
      fillSectionSelectOptions(caseSectionSelect);
      fillClientSelect();
      const addSubField = document.getElementById("caseSubsectionField");
      const addSubSelect = document.getElementById("caseSubsectionSelect");
      if (addSubField) addSubField.hidden = true;
      if (addSubSelect) {
        addSubSelect.required = false;
        addSubSelect.value = "";
      }
      addCaseDialog.showModal();
    });

    document.getElementById("cancelCaseBtn")?.addEventListener("click", () => addCaseDialog?.close());

    document.getElementById("addCaseAttachmentBtn")?.addEventListener("click", () => {
      const list = document.getElementById("addCaseAttachmentsList");
      const sectionId = caseSectionSelect?.value || "";
      if (list) list.dataset.sectionId = sectionId;
      openLibraryPicker(list, sectionId);
    });

    addCaseForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      Portal.hideAlert(addCaseAlert);
      const fd = new FormData(addCaseForm);
      if (!fd.get("client_id")) {
        Portal.showAlert(addCaseAlert, "أضف موكلاً أولاً.");
        return;
      }
      const sectionId = String(fd.get("section_id") || "");

      const submitBtn = document.getElementById("saveAddCaseBtn");
      const attachmentsRoot = document.getElementById("addCaseAttachmentsList");
      const notes = document.getElementById("addCaseNotesInput")?.value?.trim() || "";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "جاري الإنشاء...";
      }

      try {
        const opponentName = String(fd.get("opponent_name") || "").trim();
        const caseNumber = String(fd.get("case_number") || "").trim();
        if (!opponentName || !caseNumber) {
          Portal.showAlert(addCaseAlert, "اسم الخصم ورقم القضية مطلوبان.");
          return;
        }
        const data = await Portal.request("/admin/cases", {
          method: "POST",
          body: JSON.stringify({
            opponent_name: opponentName,
            case_number: caseNumber,
            client_id: fd.get("client_id"),
            section_id: sectionId,
            notes,
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
        Portal.showToast(data.message || "تم إنشاء القضية.", "success");
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
    if (isSectionManager) {
      el.textContent = taskScopeMode === "all" ? "مهام القسم" : "مهامي";
      return;
    }
    if (isSubsectionLead) {
      el.textContent = taskScopeMode === "all" ? "مهام القسم الفرعي" : "مهامي";
      return;
    }
    el.textContent = Portal.t("portal.dashboard.tasks", "مهامي");
  }

  function setupTaskScopeControls() {
    if ((!isAdminUser && !isSectionManager && !isSubsectionLead) || !taskScopeGroup) return;
    taskScopeGroup.hidden = false;
    if (taskAssigneeFilterWrap) taskAssigneeFilterWrap.hidden = false;

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

  async function openAddTaskDialog(preset = {}) {
    if (!canCreateTasks || !addTaskDialog || !addTaskForm) return;
    Portal.hideAlert(addTaskAlert);
    addTaskForm.reset();
    const isCalendarEvent = pageType === "calendar";
    addTaskForm.dataset.dueAt = preset.dueAt || "";
    const label = document.getElementById("taskAssigneeLabel");
    if (label) {
      label.textContent =
        (isSectionManager && !isAdminUser) || isSubsectionLead ? "تعيين للمحامي" : "تعيين إلى مدير القسم";
    }
    const hideAssignee = isCalendarEvent || !canAssignTaskToOthers;
    if (canAssignTaskToOthers && !isCalendarEvent) fillTaskAssigneeSelect(taskAssigneeSelect);
    if (taskAssigneeField) taskAssigneeField.hidden = hideAssignee;
    if (taskAssigneeSelect) {
      taskAssigneeSelect.disabled = hideAssignee;
      if (!hideAssignee) taskAssigneeSelect.setAttribute("required", "");
      else taskAssigneeSelect.removeAttribute("required");
    }
    const dueDateField = document.getElementById("taskDueDateField");
    const dueTimeField = document.getElementById("taskDueTimeField");
    if (dueDateField) dueDateField.hidden = isCalendarEvent;
    if (dueTimeField) dueTimeField.hidden = false;
    fillCaseSelect();
    await renderTaskCaseAttachmentPicks(taskCaseSelect?.value);
    if (!isCalendarEvent) syncTaskAssigneeFromCase(taskCaseSelect?.value);
    const dueInput = addTaskForm.querySelector('[name="due_at"]');
    if (dueInput && preset.dueAt) dueInput.value = preset.dueAt;
    const heading = addTaskForm.querySelector("h2");
    if (heading) heading.textContent = isCalendarEvent ? "إضافة حدث" : "إضافة مهمة";
    const submitBtn = addTaskForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = isCalendarEvent ? "إضافة الحدث" : "إنشاء المهمة";
    addTaskDialog.showModal();
  }

  function setupTaskControls() {
    if (addTaskBtn) addTaskBtn.hidden = !canCreateTasks;
    if (taskAssigneeField) {
      taskAssigneeField.hidden = !canAssignTaskToOthers;
    }
    if (taskAssigneeSelect) {
      taskAssigneeSelect.disabled = !canAssignTaskToOthers;
      if (canAssignTaskToOthers) taskAssigneeSelect.setAttribute("required", "");
      else taskAssigneeSelect.removeAttribute("required");
    }

    addTaskBtn?.addEventListener("click", async () => {
      if (!canCreateTasks) return;
      const dueAt =
        pageType === "calendar" && typeof window.CalendarPage?.getSelectedDate === "function"
          ? window.CalendarPage.getSelectedDate()
          : "";
      await openAddTaskDialog({ dueAt });
    });

    taskCaseSelect?.addEventListener("change", () => {
      renderTaskCaseAttachmentPicks(taskCaseSelect.value);
      syncTaskAssigneeFromCase(taskCaseSelect.value);
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
      const isCalendarEvent = pageType === "calendar";
      const title = String(fd.get("title") || "").trim();
      if (!title) {
        Portal.showAlert(addTaskAlert, "عنوان المهمة مطلوب.");
        return;
      }
      const dueDate = isCalendarEvent
        ? addTaskForm.dataset.dueAt ||
          (typeof window.CalendarPage?.getSelectedDate === "function" ? window.CalendarPage.getSelectedDate() : "")
        : fd.get("due_at");
      const dueTime = fd.get("due_time");
      const body = {
        case_id: fd.get("case_id"),
        title,
        due_at: Portal.buildDueAt(dueDate, dueTime),
        attachments: [...addTaskForm.querySelectorAll('input[name="task_attachment_ids"]:checked')].map(
          (el) => el.value
        ),
        assigned_to: dashboardUser?.id || "",
      };
      if (canAssignTaskToOthers && !isCalendarEvent && fd.get("assigned_to")) {
        body.assigned_to = fd.get("assigned_to");
      }
      if (!body.assigned_to) {
        Portal.showAlert(addTaskAlert, "تعذر تحديد الحساب المعيّن. حدّث الصفحة وحاول مرة أخرى.");
        return;
      }
      if (dueTime && !body.due_at) {
        Portal.showAlert(addTaskAlert, "موعد المهمة غير صالح. تحقق من التاريخ والوقت.");
        return;
      }
      const submitBtn = addTaskForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const endpoint = isAdminUser ? "/admin/tasks" : "/dashboard/tasks";
        await Portal.request(endpoint, { method: "POST", body: JSON.stringify(body) });
        addTaskDialog.close();
        Portal.showToast(isCalendarEvent ? "تم إضافة الحدث." : "تم إنشاء المهمة.", "success");
        await refresh();
      } catch (error) {
        Portal.showAlert(addTaskAlert, error.message);
        Portal.showToast(error.message, "error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  let editCaseControlsBound = false;

  function setupEditCaseControls() {
    if ((!isAdminUser && !isSectionManager) || editCaseControlsBound) return;
    editCaseControlsBound = true;

    document.body.addEventListener("click", (event) => {
      if (event.target.closest("#cancelEditCaseBtn")) {
        setEditCaseDialogMode(false);
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
      const opponentName = String(fd.get("opponent_name") || "").trim();
      const caseNumber = String(fd.get("case_number") || "").trim();
      const clientId = String(fd.get("client_id") || "");
      const assignedTo = String(fd.get("assigned_to") || "");
      const sectionId = String(fd.get("section_id") || "");
      const subsectionId = String(fd.get("subsection_id") || "");
      const status = String(fd.get("status") || "active");
      const caseSectionId = form.dataset.sectionId || sectionId;
      if (!caseId) return;
      const assignSectionOnly = form.dataset.assignSection === "1" && !isAdminOnly;
      const validSectionIds = new Set(knownSections().map((item) => item.id));
      if (assignSectionOnly) {
        if (!validSectionIds.has(sectionId)) {
          Portal.showAlert(alertEl, "يجب اختيار القسم.");
          return;
        }
      } else if (isAdminUser && (!opponentName || !caseNumber)) {
        Portal.showAlert(alertEl, "اسم الخصم ورقم القضية مطلوبان.");
        return;
      }
      if (!assignSectionOnly && isAdminUser && !clientId) {
        Portal.showAlert(alertEl, "يجب اختيار موكل.");
        return;
      }
      if (!assignSectionOnly && isSectionManager && !isAdminUser && subsectionsForSection(caseSectionId).length && !subsectionId) {
        Portal.showAlert(alertEl, "يجب اختيار القسم الفرعي.");
        return;
      }

      const selectedAssignee = assignees.find((user) => user.id === assignedTo);
      const assignLawyer = isSectionManager && !isAdminUser && selectedAssignee?.role === "lawyer";
      const body = assignSectionOnly
        ? { section_id: sectionId }
        : isSectionManager && !isAdminUser
          ? {
              status,
              ...(assignLawyer ? { assigned_to: assignedTo } : {}),
              ...(subsectionsForSection(caseSectionId).length ? { subsection_id: subsectionId } : {}),
            }
          : { opponent_name: opponentName, case_number: caseNumber, client_id: clientId, section_id: sectionId, status };

      if (submitBtn) submitBtn.disabled = true;
      try {
        await Portal.request(`/dashboard/cases/${caseId}`, { method: "PATCH", body: JSON.stringify(body) });
        setEditCaseDialogMode(false);
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
      Portal.showAlert(alertEl, isSubsectionLead || (isSectionManager && !isAdminUser) ? "يجب اختيار محامٍ من القسم." : "يجب اختيار مدير القسم.");
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
    if ((!isAdminUser && !isSectionManager && !isSubsectionLead) || editTaskControlsBound) return;
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
        const sectionId = detailDialogBody.querySelector("[data-case-id]")?.dataset.sectionId || "";
        if (list) list.dataset.sectionId = sectionId;
        openLibraryPicker(list, sectionId);
        return;
      }

      const attachmentRemove = event.target.closest(".portal-attachment-remove");
      if (attachmentRemove) {
        const row = attachmentRemove.closest(".portal-attachment-row");
        const isSaved = row?.classList.contains("portal-attachment-row--saved");
        if (isSaved && !isAdminOnly) return;
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
        if (!taskId) return;
        if (statusBtn.dataset.status === "open") askIncompleteReason(taskId);
        else updateTaskStatus(taskId, statusBtn.dataset.status);
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

      if (action === "edit-case" || action === "assign-case-section") {
        event.preventDefault();
        event.stopPropagation();
        if (action === "edit-case" && !isAdminOnly && !isSectionManager) return;
        detailDialog.close();
        await openEditCaseDialog(id, { assignSection: action === "assign-case-section" });
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
        if (isAdminUser && !isAdminOnly) return;
        const type = action.replace("delete-", "");
        await deleteEntity(type, id);
        return;
      }

      if (action === "task-done") {
        event.preventDefault();
        await updateTaskStatus(id, "done", "", { openDetail: false });
        return;
      }
      if (action === "task-incomplete") {
        event.preventDefault();
        askIncompleteReason(id, { openDetail: false });
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
    if (isAdminUser && caseInboxMode === "inbox") {
      el.textContent = "صندوق الوارد";
      return;
    }
    el.textContent = isAdminUser
      ? Portal.t("portal.dashboard.officeCases", "قضايا المكتب")
      : isSectionManager
        ? "قضايا القسم"
        : Portal.t("portal.dashboard.cases", "قضاياي");
  }

  function setupCaseInboxFilter() {
    const group = document.getElementById("casesInboxGroup");
    if (!isAdminUser || pageType !== "cases" || !group) return;
    group.hidden = false;
    const setMode = (mode) => {
      caseInboxMode = mode === "inbox" ? "inbox" : "all";
      group.querySelectorAll("[data-inbox]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.inbox === caseInboxMode);
      });
      const url = new URL(window.location.href);
      if (caseInboxMode === "inbox") url.searchParams.set("inbox", "1");
      else url.searchParams.delete("inbox");
      history.replaceState({}, "", url.pathname + url.search);
      updateCasesPanelTitle();
      renderPage();
    };
    group.querySelectorAll("[data-inbox]").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.inbox));
    });
    setMode(caseInboxMode);
  }

  function renderHome() {
    if (!dashboardUser || !dashboardData) return;
    renderWelcome(dashboardUser);
    renderStats(dashboardData.stats);

    const homeCasesTitle = document.getElementById("homeCasesTitle");
    if (homeCasesTitle) {
      homeCasesTitle.textContent = isAdminUser ? "أحدث القضايا" : isSectionManager ? "أحدث قضايا القسم" : "أحدث قضاياي";
    }

    const homeClientsPanel = document.getElementById("homeClientsPanel");
    if (isAdminUser && homeClientsPanel) {
      homeClientsPanel.hidden = false;
      renderClients(dashboardData.clients.slice(0, PREVIEW_LIMIT), document.getElementById("homeClientsList"));
    }

    renderCases(dashboardData.cases.slice(0, PREVIEW_LIMIT), document.getElementById("homeCasesList"));
    renderTasks(dashboardData.tasks.slice(0, PREVIEW_LIMIT), document.getElementById("homeTasksList"));

    const inboxPanel = document.getElementById("homeInboxPanel");
    const inboxText = document.getElementById("homeInboxText");
    const inboxLink = document.getElementById("homeInboxLink");
    const inboxTitle = inboxPanel?.querySelector("h2");
    const inbox = dashboardData.inbox;
    if (inboxPanel) {
      const showAdminInbox = Boolean(isAdminUser && inbox?.kind === "admin");
      const showSectionInbox = Boolean(isSectionManager && inbox?.section_id);
      inboxPanel.hidden = !showAdminInbox && !showSectionInbox;
      if (showAdminInbox) {
        const inboxCases = (dashboardData.cases || []).filter((item) => isStaffInboxCase(item));
        const count = Number(inbox.count || inboxCases.length || 0);
        if (inboxTitle) inboxTitle.textContent = "صندوق الوارد";
        if (inboxText) {
          inboxText.textContent = count
            ? `${Portal.formatNumber(count)} قضية بانتظار التوزيع.`
            : "لا قضايا جديدة.";
        }
        if (inboxLink) inboxLink.href = "cases.html?inbox=1";
        const inboxList = document.getElementById("homeInboxList");
        if (inboxList) {
          inboxList.hidden = !inboxCases.length;
          if (inboxCases.length) renderCases(inboxCases.slice(0, PREVIEW_LIMIT), inboxList);
          else inboxList.innerHTML = "";
        }
      } else if (showSectionInbox) {
        const inboxList = document.getElementById("homeInboxList");
        if (inboxList) {
          inboxList.hidden = true;
          inboxList.innerHTML = "";
        }
        const count = Number(inbox.count || 0);
        if (inboxTitle) inboxTitle.textContent = "صندوق القضايا الجديدة";
        if (inboxText) {
          inboxText.textContent = count
            ? `${Portal.formatNumber(count)} قضية جديدة.`
            : "لا قضايا جديدة.";
        }
        if (inboxLink) {
          inboxLink.href = `/portal/section?id=${encodeURIComponent(inbox.section_id)}&ss=uncategorized`;
        }
      }
    }
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
      return;
    }

    if (pageType === "calendar") {
      window.CalendarPage?.sync?.(dashboardData);
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
    caseSectionSelect = document.getElementById("caseSectionSelect");
    caseClientSelect = document.getElementById("caseClientSelect");
    taskAssigneeSelect = document.getElementById("taskAssigneeSelect");
    editTaskAssigneeSelect = document.getElementById("editTaskAssigneeSelect");
    taskAssigneeField = document.getElementById("taskAssigneeField");
    taskCaseSelect = document.getElementById("taskCaseSelect");
    setupIncompleteReasonDialog();
  }

  async function ensureDialogs() {
    if (document.getElementById("detailDialog")) {
      bindDialogRefs();
      return;
    }
    try {
      const res = await fetch("dialogs.fragment.html?v=30");
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
      script.src = "portal-push.js?v=2";
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
    if (typeof PortalNav !== "undefined" && PortalNav.initChangePasswordDialog) {
      PortalNav.initChangePasswordDialog();
    }

    const user = await Portal.requireAuth();
    if (!user) return;

    dashboardUser = user;
    isAdminUser = user.role === "admin" || user.role === "assistant";
    isAdminOnly = user.role === "admin";
    isSectionManager = user.role === "section_manager";
    isSubsectionLead = user.role === "lawyer" && Array.isArray(user.led_subsections) && user.led_subsections.length > 0;
    canCreateTasks = isAdminUser || isSectionManager || user.role === "lawyer";
    canAssignTaskToOthers = isSectionManager || isSubsectionLead;

    if (pageType === "clients" && !isAdminUser) {
      window.location.href = "home.html";
      return;
    }

    if (pageType === "archived" && !isAdminUser) {
      window.location.href = "home.html";
      return;
    }

    PortalNav.init(user);

    if (isAdminUser || isSectionManager) setupLibraryPicker();

    if (isAdminUser) {
      if (adminNavLinks) adminNavLinks.hidden = false;
      await loadAssignees();

      if (pageType === "clients") setupClientControls();
      if (pageType === "cases") {
        setupCaseControls();
        setupCaseInboxFilter();
      }
    } else if (isSectionManager) {
      await loadAssignees();
    } else if (isSubsectionLead) {
      await loadAssignees();
    } else if (user.role === "lawyer") {
      assigneeNames = { [user.id]: user.name };
    }

    if (pageType === "tasks" || pageType === "calendar") setupTaskControls();
    if (pageType === "tasks" && (isAdminUser || isSectionManager || isSubsectionLead)) setupTaskScopeControls();
    if (isAdminUser || isSectionManager) {
      setupEditCaseControls();
    }
    if (isAdminUser || isSectionManager || isSubsectionLead) {
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
      if (document.getElementById("pushNotifyPanel")) {
        await PortalPush.initUi("pushNotifyPanel", { role: user.role });
      }
    } catch {
      /* push optional */
    }

    return dashboardUser;
  }

  window.addEventListener("gz:languagechange", renderPage);

  return {
    boot,
    refresh,
    renderPage,
    getState: () => ({ user: dashboardUser, data: dashboardData }),
  };
})();
