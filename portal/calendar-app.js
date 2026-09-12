const CalendarPage = (() => {
  const WEEKDAYS = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];
  const gridEl = document.getElementById("calendarGrid");
  const listEl = document.getElementById("calendarDayList");
  const monthLabel = document.getElementById("calendarMonthLabel");
  const dayTitle = document.getElementById("calendarDayTitle");
  const leadEl = document.getElementById("calendarLead");
  const alertEl = document.getElementById("calendarAlert");
  const scopeGroup = document.getElementById("calendarScopeGroup");

  let user = null;
  let tasks = [];
  let scope = "mine";
  let canScope = false;
  let started = false;
  let cursor = new Date();
  let selectedDate = Portal.formatDateInput(new Date());

  function dueDatePart(value) {
    if (!value) return "";
    const s = String(value);
    return s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function padDay(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function filteredTasks() {
    if (!user) return [];
    let rows = tasks.slice();
    if (scope === "mine") rows = rows.filter((task) => task.assigned_to === user.id);
    else if (scope === "team") rows = rows.filter((task) => task.assigned_to && task.assigned_to !== user.id);
    rows.sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")));
    return rows;
  }

  function tasksOn(dateStr) {
    return filteredTasks().filter((task) => dueDatePart(task.due_at) === dateStr);
  }

  function renderGrid() {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    if (monthLabel) {
      monthLabel.textContent = cursor.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
    }
    const first = new Date(year, month, 1);
    const startIndex = (first.getDay() + 1) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = Portal.formatDateInput(new Date());
    const cells = [];
    for (const label of WEEKDAYS) {
      cells.push(`<span class="portal-calendar-dow">${label}</span>`);
    }
    for (let i = 0; i < startIndex; i += 1) {
      cells.push('<span class="portal-calendar-cell is-empty"></span>');
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = padDay(year, month, day);
      const count = tasksOn(dateStr).length;
      const classes = [
        "portal-calendar-cell",
        dateStr === today ? "is-today" : "",
        dateStr === selectedDate ? "is-selected" : "",
        count ? "has-tasks" : "",
      ]
        .filter(Boolean)
        .join(" ");
      cells.push(
        `<button type="button" class="${classes}" data-cal-day="${dateStr}" aria-label="${day}${count ? ` — ${Portal.formatNumber(count)} مهام` : ""}">
          <strong>${day}</strong>
          ${count ? `<span class="portal-calendar-mark" aria-hidden="true"></span>` : ""}
        </button>`
      );
    }
    if (gridEl) gridEl.innerHTML = cells.join("");
  }

  function renderDayList() {
    const rows = selectedDate
      ? tasksOn(selectedDate)
      : filteredTasks().filter((task) => !task.due_at);
    if (dayTitle) {
      dayTitle.textContent = selectedDate
        ? `مهام ${Portal.formatDate(`${selectedDate}T12:00:00`)}`
        : "مهام بلا موعد";
    }
    if (!listEl) return;
    if (!rows.length) {
      listEl.innerHTML = `<li class="portal-empty">لا توجد مهام في هذا اليوم.</li>`;
      return;
    }
    listEl.innerHTML = rows
      .map((task) => {
        const when = task.due_at ? Portal.formatTaskDue(task.due_at) : "بدون موعد";
        return `<li class="portal-list-item" data-action="show-task" data-id="${Portal.escapeHtml(task.id)}">
          <div class="portal-list-item__row">
            <div class="portal-list-item__content">
              <div class="portal-list-item__head">
                <strong>${Portal.escapeHtml(task.title)}</strong>
                <span class="portal-badge ${
                  task.status === "done"
                    ? "portal-badge--finished"
                    : task.status === "missed"
                      ? "portal-badge--missed"
                      : "portal-badge--open"
                }">${Portal.statusLabel(task.status)}</span>
              </div>
              <span class="portal-list-item__meta">${Portal.escapeHtml(task.case_title || "—")} · ${Portal.escapeHtml(task.assignee_name || "—")} · ${when}</span>
            </div>
            <button type="button" class="portal-quick-btn portal-quick-btn--info" data-action="show-task" data-id="${Portal.escapeHtml(task.id)}" title="التفاصيل" aria-label="التفاصيل">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v6" stroke-linecap="round" />
                <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>
        </li>`;
      })
      .join("");
  }

  function render() {
    renderGrid();
    renderDayList();
  }

  function setupScope() {
    const isStaff = user.role === "admin" || user.role === "assistant";
    const isManager = user.role === "section_manager";
    const isLead = user.role === "lawyer" && Array.isArray(user.led_subsections) && user.led_subsections.length > 0;
    canScope = isStaff || isManager || isLead;
    if (!scopeGroup) return;
    scopeGroup.hidden = !canScope;
    if (!canScope) {
      scope = "mine";
      return;
    }
    const teamBtn = document.getElementById("calendarTeamBtn");
    if (teamBtn) {
      teamBtn.textContent = isManager ? "مهام المحامين" : isLead ? "مهام القسم الفرعي" : "مهام الفريق";
    }
    if (leadEl) {
      leadEl.textContent = "أجنده المكتب";
    }
    scopeGroup.querySelectorAll("[data-scope]").forEach((btn) => {
      btn.addEventListener("click", () => {
        scope = btn.dataset.scope;
        scopeGroup.querySelectorAll("[data-scope]").forEach((item) => {
          item.classList.toggle("is-active", item === btn);
        });
        render();
      });
    });
  }

  function sync(data) {
    tasks = data?.tasks || [];
    if (started && user) render();
  }

  function getSelectedDate() {
    return selectedDate;
  }

  async function start() {
    if (started) {
      const state = window.PortalDash?.getState?.();
      if (state?.data) sync(state.data);
      return;
    }
    user = await Portal.requireAuth();
    if (!user) return;
    PortalNav.init(user);
    started = true;
    setupScope();
    if (!canScope && leadEl) {
      leadEl.textContent = "أجنده المكتب";
    }
    const today = Portal.formatDateInput(new Date());
    selectedDate = today;
    cursor = new Date(`${today}T12:00:00`);
    const state = window.PortalDash?.getState?.();
    if (state?.data?.tasks) {
      tasks = state.data.tasks;
    } else {
      try {
        const data = await Portal.request("/dashboard/summary");
        tasks = data.tasks || [];
      } catch (error) {
        Portal.showAlert(alertEl, error.message);
      }
    }
    document.getElementById("calendarPrev")?.addEventListener("click", () => {
      cursor.setMonth(cursor.getMonth() - 1);
      render();
    });
    document.getElementById("calendarNext")?.addEventListener("click", () => {
      cursor.setMonth(cursor.getMonth() + 1);
      render();
    });
    gridEl?.addEventListener("click", (event) => {
      const cell = event.target.closest("[data-cal-day]");
      if (!cell) return;
      selectedDate = cell.dataset.calDay;
      render();
    });
    render();
  }

  start();
  window.CalendarPage = { start, sync, getSelectedDate, monthKey };
  return window.CalendarPage;
})();
