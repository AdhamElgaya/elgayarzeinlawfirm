const Portal = (() => {
  function apiRoot() {
    const base = window.PORTAL_API_BASE || "/api";
    return base.replace(/\/$/, "");
  }

  function apiCredentials() {
    return apiRoot().startsWith("http") ? "include" : "same-origin";
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const hasBody = options.body !== undefined && options.body !== null;
    if (hasBody && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${apiRoot()}${path}`, {
      credentials: apiCredentials(),
      headers,
      ...options,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.status === 401 && data && Object.prototype.hasOwnProperty.call(data, "authenticated")) {
      return data;
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          data?.error ||
            "Portal API not available. Stop npx serve and run npm start from the project folder instead."
        );
      }
      const message = data?.error || `Request failed (${res.status}).`;
      throw new Error(message);
    }

    return data;
  }

  function showAlert(el, message, type = "error") {
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.className = `portal-alert portal-alert--${type}`;
  }

  function hideAlert(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
  }

  let toastHideTimer = null;
  let toastCloseTimer = null;

  function ensureToast() {
    let toast = document.getElementById("portalToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "portalToast";
      toast.className = "portal-toast portal-toast--success";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      if ("showPopover" in toast) {
        toast.setAttribute("popover", "manual");
      }
      document.body.append(toast);
    }
    return toast;
  }

  function showToast(message, type = "success", duration = 2800) {
    const toast = ensureToast();
    if (toastHideTimer) clearTimeout(toastHideTimer);
    if (toastCloseTimer) clearTimeout(toastCloseTimer);

    toast.className = `portal-toast portal-toast--${type}`;
    toast.textContent = message;

    if (toast.hidePopover && toast.matches(":popover-open")) {
      toast.hidePopover();
    }

    if (toast.showPopover) {
      toast.showPopover();
    } else {
      toast.hidden = false;
    }

    toast.classList.remove("portal-toast--visible");
    requestAnimationFrame(() => {
      toast.classList.add("portal-toast--visible");
    });

    toastHideTimer = setTimeout(() => {
      toast.classList.remove("portal-toast--visible");
      toastCloseTimer = setTimeout(() => {
        if (toast.hidePopover && toast.matches(":popover-open")) {
          toast.hidePopover();
        } else {
          toast.hidden = true;
        }
      }, 320);
    }, duration);
  }

  async function getMe() {
    return request("/auth/me");
  }

  async function requireAuth(redirectTo = "/portal/login.html") {
    const data = await getMe();
    if (!data.authenticated) {
      window.location.href = redirectTo;
      return null;
    }
    return data.user;
  }

  async function upload(path, formData) {
    const res = await fetch(`${apiRoot()}${path}`, {
      credentials: apiCredentials(),
      method: "POST",
      body: formData,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const message = data?.error || `Request failed (${res.status}).`;
      throw new Error(message);
    }

    return data;
  }

  async function redirectIfAuthed(target = "/portal/home.html") {
    try {
      const data = await getMe();
      if (data.authenticated) {
        window.location.href = target;
      }
    } catch {
      /* not logged in or API unavailable — stay on login page */
    }
  }

  function passwordToggleIcon(visible) {
    if (visible) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58"/><path d="M9.88 5.1A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7.5a11.6 11.6 0 0 1-2.05 3.17M6.61 6.61A11.33 11.33 0 0 0 1 12.5C2.73 16.39 7 19.5 12 19.5a10.8 10.8 0 0 0 2.12-.21"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12.5C3.73 8.11 8 5 13 5s9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S3.73 16.89 2 12.5Z"/><circle cx="13" cy="12.5" r="3"/></svg>`;
  }

  function initPasswordToggles(root = document) {
    root.querySelectorAll(".portal-form input[type='password']").forEach((input) => {
      if (input.closest(".portal-password-field")) return;

      const field = document.createElement("span");
      field.className = "portal-password-field";
      input.parentNode.insertBefore(field, input);
      field.append(input);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "portal-password-toggle";
      toggle.setAttribute("aria-label", "إظهار كلمة المرور");
      toggle.setAttribute("aria-pressed", "false");
      toggle.innerHTML = passwordToggleIcon(false);

      toggle.addEventListener("click", () => {
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        toggle.setAttribute("aria-pressed", String(!visible));
        toggle.setAttribute("aria-label", visible ? "إظهار كلمة المرور" : "إخفاء كلمة المرور");
        toggle.innerHTML = passwordToggleIcon(!visible);
      });

      field.append(toggle);
    });
  }

  function locale() {
    return window.GZ_I18N?.getLanguage?.() === "en" ? "en" : "ar-EG";
  }

  function t(key, fallback) {
    return window.GZ_I18N?.t(key) ?? fallback;
  }

  function formatNumber(value) {
    return Number(value).toLocaleString(locale(), { useGrouping: false });
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(locale(), {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function roleLabel(role) {
    const labels = {
      admin: "مدير",
      lawyer: "محامي",
      assistant: "مساعد",
    };
    return t(`portal.role.${role}`, labels[role] || role);
  }

  function statusLabel(status) {
    const labels = {
      active: "نشطة",
      finished: "منتهية",
      open: "مفتوحة",
      done: "منجزة",
      archived: "مؤرشفة",
    };
    return t(`portal.status.${status}`, labels[status] || status);
  }

  function accountStatusLabel(status) {
    const labels = {
      active: "نشط",
      disabled: "معطل",
      invited: "مدعو",
    };
    return t(`portal.accountStatus.${status}`, labels[status] || status);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function displayId(id) {
    return String(id || "").slice(0, 8).toUpperCase();
  }

  function formatDateInput(isoOrDate) {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function sameCalendarDay(a, b) {
    if (!a || !b) return false;
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  }

  return {
    request,
    upload,
    apiRoot,
    showAlert,
    hideAlert,
    showToast,
    getMe,
    requireAuth,
    redirectIfAuthed,
    initPasswordToggles,
    t,
    formatNumber,
    formatDate,
    roleLabel,
    statusLabel,
    accountStatusLabel,
    escapeHtml,
    displayId,
    formatDateInput,
    sameCalendarDay,
  };
})();
