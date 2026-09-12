const Portal = (() => {
  function apiRoot() {
    const base = window.PORTAL_API_BASE || "/api";
    return base.replace(/\/$/, "");
  }

  function usingExternalApi() {
    return apiRoot().startsWith("http");
  }

  function apiCredentials() {
    return apiRoot().startsWith("http") ? "include" : "same-origin";
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const hasBody = options.body !== undefined && options.body !== null;
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (hasBody && !isFormData && !headers["Content-Type"] && !headers["content-type"]) {
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
      if (data?.error) {
        throw new Error(data.error);
      }
      if (res.status === 404) {
        throw new Error(
          usingExternalApi()
            ? "Portal API not available on the backend server."
            : "مسار API غير موجود. تأكد أن النطاق مربوط بنشر Cloudflare Pages الصحيح."
        );
      }
      if (res.status === 502 || res.status === 503) {
        throw new Error("تعذر الاتصال بالخادم (Railway). انتظر دقيقة ثم أعد المحاولة.");
      }
      if (res.status >= 500) {
        throw new Error(`خطأ في الخادم (${res.status}). تحقق من سجلات Railway ثم أعد المحاولة.`);
      }
      throw new Error(`Request failed (${res.status}).`);
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

  function safePortalNext(raw) {
    const value = String(raw || "").trim();
    if (!value.startsWith("/portal/")) return "";
    if (value.includes("\\") || value.includes("//") || value.includes("://")) return "";
    const [pathname, query = ""] = value.split("?");
    if (!/^\/portal\/[a-z0-9.-]+\.html$/i.test(pathname)) return "";
    if (pathname.toLowerCase() === "/portal/login.html") return "";
    if (query && !/^[a-zA-Z0-9_=&%.-]+$/.test(query)) return "";
    return query ? `${pathname}?${query}` : pathname;
  }

  function currentPortalNext() {
    return safePortalNext(`${window.location.pathname}${window.location.search || ""}`);
  }

  function loginUrlWithNext(redirectTo = "/portal/login.html") {
    const next = currentPortalNext();
    const login = new URL(redirectTo, window.location.origin);
    login.search = "";
    if (next) login.searchParams.set("next", next);
    return `${login.pathname}${login.search}`;
  }

  async function requireAuth(redirectTo = "/portal/login.html") {
    const data = await getMe();
    if (!data.authenticated) {
      window.location.replace(loginUrlWithNext(redirectTo));
      return null;
    }
    document.body.classList.add("is-authed");
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
        const params = new URLSearchParams(window.location.search);
        window.location.replace(safePortalNext(params.get("next")) || target);
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
    return Number(value).toLocaleString("en-US", { useGrouping: false });
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(locale(), {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function hasDueTime(iso) {
    return Boolean(iso && String(iso).includes("T"));
  }

  function buildDueAt(dateValue, timeValue) {
    const date = String(dateValue || "").trim();
    if (!date) return null;
    const time = String(timeValue || "").trim();
    if (!time) return date;
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const parsed = new Date(y, m - 1, d, hh, mm, 0, 0);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  function formatTimeInput(iso) {
    if (!hasDueTime(iso)) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function formatDateTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString(locale(), {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatTaskDue(iso) {
    if (!iso) return "";
    return hasDueTime(iso) ? formatDateTime(iso) : formatDate(iso);
  }

  function formatAssignmentStamp(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${day}/${month}/${year} ${time}`;
  }

  function roleLabel(role) {
    const labels = {
      admin: "مدير",
      lawyer: "محامي",
      assistant: "مساعد",
      section_manager: "مدير قسم",
    };
    return t(`portal.role.${role}`, labels[role] || role);
  }

  function statusLabel(status) {
    const labels = {
      active: "متداوله",
      finished: "موقوفه",
      open: "مفتوحة",
      done: "منجزة",
      missed: "فائتة",
      archived: "محفوظه",
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
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function isBlockedUploadFile(file) {
    if (!file) return false;
    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();
    return (
      name.endsWith(".zip") ||
      name.endsWith(".zipx") ||
      name.includes(".zip.") ||
      type.includes("zip")
    );
  }

  const UPLOAD_ACCEPT =
    ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,application/pdf,image/png,image/jpeg,image/gif,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";
  const ZIP_REJECT_MESSAGE = "لا يمكن رفع ملفات ZIP.";

  document.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
    const file = input.files?.[0];
    if (!file || !isBlockedUploadFile(file)) return;
    input.value = "";
    const nameEl = document.getElementById("libraryUploadFileName");
    if (nameEl && input.id === "libraryUploadFile") nameEl.textContent = "لم يُختر ملف";
    const draftName = input.closest(".portal-attachment-file-wrap")?.querySelector(".portal-attachment-file-name");
    if (draftName) draftName.textContent = "لم يُرفَع ملف بعد";
    showToast(ZIP_REJECT_MESSAGE, "error");
  });

  const THEME_KEY = "gz-portal-theme";
  const THEME_COLOR_DARK = "#0f172a";
  const THEME_COLOR_LIGHT = "#f3eee6";

  function isPortalPath() {
    return /(?:^|\/)portal(?:\/|$)/.test(location.pathname) || document.body?.classList.contains("portal-page");
  }

  function getTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  function applyTheme(theme) {
    if (!isPortalPath()) return;
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? THEME_COLOR_LIGHT : THEME_COLOR_DARK);
  }

  function setTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
  }

  function syncThemeToggle(group, theme) {
    if (!group) return;
    group.querySelectorAll("[data-theme]").forEach((btn) => {
      const on = btn.dataset.theme === theme;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function initThemeToggle(root = document) {
    const groups = root?.matches?.("[data-theme-toggle]")
      ? [root]
      : Array.from((root || document).querySelectorAll("[data-theme-toggle]"));
    const theme = getTheme();
    applyTheme(theme);
    groups.forEach((group) => {
      syncThemeToggle(group, theme);
      if (group.dataset.bound) return;
      group.dataset.bound = "1";
      group.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-theme]");
        if (!btn || !group.contains(btn)) return;
        setTheme(btn.dataset.theme);
        syncThemeToggle(group, getTheme());
      });
    });
  }

  initThemeToggle();

  function isStandaloneDisplay() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function ensurePwaMeta() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/portal/manifest.json";
      document.head.appendChild(link);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = getTheme() === "light" ? THEME_COLOR_LIGHT : THEME_COLOR_DARK;
      document.head.appendChild(meta);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement("link");
      icon.rel = "apple-touch-icon";
      icon.href = "/assets/sign_trans.png?v=2";
      document.head.appendChild(icon);
    }
  }

  function registerPortalServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/portal/sw.js", { scope: "/portal/" }).catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }

  function bindStandaloneLinks() {
    if (!isStandaloneDisplay()) return;
    document.documentElement.classList.add("portal-standalone");
    document.querySelectorAll('.portal-brand[href*="index.html"]').forEach((el) => {
      el.setAttribute("href", "/portal/home.html");
    });
    document.querySelectorAll(".portal-muted-link").forEach((el) => {
      el.hidden = true;
    });
  }

  function unlockScreenOrientation() {
    try {
      if (screen.orientation && typeof screen.orientation.unlock === "function") {
        screen.orientation.unlock();
      }
    } catch {
      /* iOS / unsupported browsers ignore unlock */
    }
  }

  function syncViewportOrientation() {
    const landscape =
      window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight;
    const touchUi = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const compactNav = landscape && touchUi;
    document.documentElement.classList.toggle("portal-landscape", landscape);
    document.documentElement.classList.toggle("portal-compact-nav", compactNav);
    document.body?.classList.toggle("portal-landscape", landscape);
    document.body?.classList.toggle("portal-compact-nav", compactNav);
    document.documentElement.dataset.orientation = landscape ? "landscape" : "portrait";
    if (!compactNav) {
      document.body?.classList.remove("portal-nav-open");
    }
  }

  function initOrientationSupport() {
    unlockScreenOrientation();
    syncViewportOrientation();
    const refresh = () => {
      unlockScreenOrientation();
      syncViewportOrientation();
    };
    window.addEventListener("orientationchange", () => setTimeout(refresh, 120));
    window.addEventListener("resize", syncViewportOrientation);
    window.matchMedia("(orientation: landscape)").addEventListener?.("change", syncViewportOrientation);
  }

  function initPwa() {
    ensurePwaMeta();
    bindStandaloneLinks();
    registerPortalServiceWorker();
    initOrientationSupport();
  }

  initPwa();

  return {
    request,
    upload,
    apiRoot,
    apiCredentials,
    showAlert,
    hideAlert,
    showToast,
    getMe,
    requireAuth,
    redirectIfAuthed,
    safePortalNext,
    initPasswordToggles,
    getTheme,
    setTheme,
    applyTheme,
    initThemeToggle,
    t,
    formatNumber,
    formatDate,
    formatDateTime,
    formatTaskDue,
    formatAssignmentStamp,
    formatTimeInput,
    buildDueAt,
    hasDueTime,
    roleLabel,
    statusLabel,
    accountStatusLabel,
    escapeHtml,
    displayId,
    formatDateInput,
    sameCalendarDay,
    isBlockedUploadFile,
    UPLOAD_ACCEPT,
    ZIP_REJECT_MESSAGE,
  };
})();
