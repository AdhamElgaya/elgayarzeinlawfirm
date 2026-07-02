const PortalNav = (() => {
  function init(user) {
    const page = document.body.dataset.portalPage || "";
    const isAdmin = user?.role === "admin" || user?.role === "assistant";
    const isAdminOnly = user?.role === "admin";

    document.querySelectorAll("[data-admin-only]").forEach((el) => {
      const show = isAdminOnly;
      el.hidden = !show;
      el.style.display = show ? "" : "none";
      el.setAttribute("aria-hidden", show ? "false" : "true");
    });

    if (isAdmin) {
      document.body.classList.add("portal-admin-nav");
    }
    document.body.classList.add("portal-drawer-nav");

    document.querySelectorAll(".portal-nav-link[data-nav]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.nav === page);
    });

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

    toggle?.addEventListener("click", () => {
      setOpen(!document.body.classList.contains("portal-nav-open"));
    });

    backdrop?.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });

    document.querySelectorAll(".portal-header-nav__links a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    logoutBtn?.addEventListener("click", async () => {
      try {
        await Portal.request("/auth/logout", { method: "POST" });
      } catch {
        /* ignore */
      }
      window.location.href = "/portal/login.html";
    });

    const changePasswordBtn = document.getElementById("changePasswordBtn");
    changePasswordBtn?.addEventListener("click", () => {
      const dialog = document.getElementById("changePasswordDialog");
      if (dialog) dialog.showModal();
    });
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
