const PortalNav = (() => {
  const NAV_ICONS = {
    home: '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />',
    clients: '<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M3.5 20v-1.2A4.3 4.3 0 0 1 7.8 14.5h2.4" /><path d="M16.5 11a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" /><path d="M15 14.5h1.4A4.1 4.1 0 0 1 20.5 18.6V20" />',
    cases: '<path d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" /><path d="M5 7h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" /><path d="M9 12h6" />',
    archived: '<path d="M4 6.5h16v3H4v-3Z" /><path d="M6 9.5v9h12v-9" /><path d="M10 13h4" />',
    tasks: '<path d="M9 7h11M9 12h11M9 17h11" /><path d="M4.5 7l1.2 1.2L7.8 6M4.5 12l1.2 1.2L7.8 11M4.5 17l1.2 1.2L7.8 16" />',
    calendar: '<path d="M6 4.5v3M18 4.5v3M4.5 8.5h15" /><path d="M5 6.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1Z" /><path d="M8 12h3M13 12h3M8 16h3" />',
    attachments: '<path d="M15.5 7.5l-7.2 7.2a2.4 2.4 0 1 0 3.4 3.4l7.6-7.6a3.6 3.6 0 0 0-5.1-5.1L6.6 12.8" />',
    sections: '<path d="M5 9.5V20h14V9.5" /><path d="M3.5 9.5h17L12 3.5 3.5 9.5Z" /><path d="M10 20v-6h4v6" />',
    admin: '<path d="M12 12.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" /><path d="M5 20v-1.1A5.5 5.5 0 0 1 10.5 13.5h3A5.5 5.5 0 0 1 19 18.9V20" /><path d="M18.5 7.5v3M20 9h-3" />',
    profile: '<path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M5 20v-1.2A5.5 5.5 0 0 1 10.5 13.4h3A5.5 5.5 0 0 1 19 18.8V20" />',
  };

  function decorateNavIcons() {
    document.querySelectorAll(".portal-nav-link[data-nav]").forEach((link) => {
      if (link.querySelector(".portal-nav-icon")) return;
      const icon = NAV_ICONS[link.dataset.nav];
      if (!icon) return;
      const mark = document.createElement("span");
      mark.className = "portal-nav-icon";
      mark.setAttribute("aria-hidden", "true");
      mark.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
      link.prepend(mark);
    });
  }

  function init(user) {
    const page = document.body.dataset.portalPage || "";
    const isAdmin = user?.role === "admin" || user?.role === "assistant";
    const isAdminOnly = user?.role === "admin";
    const showSectionsNav = user?.role === "admin" || user?.role === "assistant" || user?.role === "section_manager";
    const showProfile = Boolean(user) && user.role !== "admin" && user.role !== "assistant";

    document.querySelectorAll("[data-admin-only]").forEach((el) => {
      const show = isAdmin;
      el.hidden = !show;
      el.style.display = show ? "" : "none";
      el.setAttribute("aria-hidden", show ? "false" : "true");
    });

    document.querySelectorAll("[data-sections-nav]").forEach((el) => {
      el.hidden = !showSectionsNav;
      el.style.display = showSectionsNav ? "" : "none";
      el.setAttribute("aria-hidden", showSectionsNav ? "false" : "true");
      if (
        el.tagName === "A" &&
        user?.role === "section_manager" &&
        user.managed_section?.id
      ) {
        el.setAttribute("href", `section.html?id=${encodeURIComponent(user.managed_section.id)}`);
      }
    });

    const showAttachmentsNav =
      user?.role === "admin" ||
      user?.role === "assistant" ||
      user?.role === "section_manager" ||
      (user?.role === "lawyer" && Array.isArray(user.led_subsections) && user.led_subsections.length > 0);
    document.querySelectorAll("[data-attachments-nav]").forEach((el) => {
      el.hidden = !showAttachmentsNav;
      el.style.display = showAttachmentsNav ? "" : "none";
      el.setAttribute("aria-hidden", showAttachmentsNav ? "false" : "true");
    });

    const navLinks = document.getElementById("adminNavLinks");
    if (navLinks && !navLinks.querySelector('[data-nav="calendar"]')) {
      const calendarLink = document.createElement("a");
      calendarLink.className = "portal-nav-link";
      calendarLink.href = "calendar.html";
      calendarLink.dataset.nav = "calendar";
      calendarLink.textContent = "الأجنده";
      const tasksLink = navLinks.querySelector('[data-nav="tasks"]');
      if (tasksLink) tasksLink.after(calendarLink);
      else navLinks.append(calendarLink);
    }

    const profileNavLink = document.getElementById("profileNavLink");
    if (profileNavLink) {
      profileNavLink.hidden = !showProfile;
      profileNavLink.style.display = showProfile ? "" : "none";
      profileNavLink.setAttribute("aria-hidden", showProfile ? "false" : "true");
    }

    if (isAdmin) {
      document.body.classList.add("portal-admin-nav");
    }
    document.body.classList.add("portal-drawer-nav");

    document.querySelectorAll(".portal-nav-link[data-nav]").forEach((link) => {
      const nav = link.dataset.nav;
      link.classList.toggle("is-active", nav === page || (page === "section" && nav === "sections"));
    });
    decorateNavIcons();

    const toggle = document.getElementById("portalNavToggle");
    const backdrop = document.getElementById("portalNavBackdrop");
    const logoutBtn = document.getElementById("logoutBtn");

    if (toggle) toggle.hidden = false;

    function setOpen(open) {
      document.body.classList.toggle("portal-nav-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
      }
      if (backdrop) backdrop.hidden = !open;
    }

    if (!toggle?.dataset.navBound) {
      if (toggle) toggle.dataset.navBound = "1";
      toggle?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(!document.body.classList.contains("portal-nav-open"));
      });
      backdrop?.addEventListener("click", () => setOpen(false));
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setOpen(false);
      });
      document.querySelectorAll(".portal-header-nav__links a").forEach((link) => {
        link.addEventListener("click", () => setOpen(false));
      });
      window.addEventListener("orientationchange", () => {
        setOpen(false);
        setTimeout(syncHeaderHeight, 180);
      });
    }

    if (logoutBtn && !logoutBtn.dataset.navBound) {
      logoutBtn.dataset.navBound = "1";
      logoutBtn.addEventListener("click", async () => {
        try {
          await Portal.request("/auth/logout", { method: "POST" });
        } catch {
          /* ignore */
        }
        window.location.href = "/portal/login.html";
      });
    }

    function syncHeaderHeight() {
      const header = document.querySelector(".portal-header");
      if (!header) return;
      document.documentElement.style.setProperty("--portal-header-height", `${header.offsetHeight}px`);
    }
    syncHeaderHeight();
    if (!window.__portalHeaderResizeBound) {
      window.__portalHeaderResizeBound = true;
      window.addEventListener("resize", syncHeaderHeight);
    }
  }

  function initChangePasswordDialog() {
    const dialog = document.getElementById("changePasswordDialog");
    const form = document.getElementById("changePasswordForm");
    const alert = document.getElementById("changePasswordAlert");
    const cancelBtn = document.getElementById("cancelChangePasswordBtn");

    if (!dialog || !form) return;

    Portal.initPasswordToggles(form);

    cancelBtn?.addEventListener("click", () => {
      dialog.close();
      form.reset();
      if (alert) alert.hidden = true;
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (alert) alert.hidden = true;

      const fd = new FormData(form);
      const currentPassword = String(fd.get("currentPassword") || "");
      const newPassword = String(fd.get("newPassword") || "");
      const confirmPassword = String(fd.get("confirmPassword") || "");

      if (!currentPassword || !newPassword || !confirmPassword) {
        Portal.showAlert(alert, "جميع الحقول مطلوبة.");
        return;
      }

      if (newPassword.length < 8) {
        Portal.showAlert(alert, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
        return;
      }

      if (newPassword !== confirmPassword) {
        Portal.showAlert(alert, "كلمتا المرور غير متطابقتين.");
        return;
      }

      try {
        const result = await Portal.request("/auth/change-password", {
          method: "POST",
          body: { currentPassword, newPassword, confirmPassword },
        });
        Portal.showToast(result.message || "تم تغيير كلمة المرور بنجاح.", "success", 3000);
        dialog.close();
        form.reset();
        setTimeout(() => {
          window.location.href = "/portal/login.html";
        }, 1000);
      } catch (error) {
        Portal.showAlert(alert, error.message || "تعذر تغيير كلمة المرور.");
      }
    });
  }

  return { init, initChangePasswordDialog };
})();
