const PortalNav = (() => {
  function init(user) {
    const page = document.body.dataset.portalPage || "";
    const isAdmin = user?.role === "admin";

    document.querySelectorAll("[data-admin-only]").forEach((el) => {
      const show = isAdmin;
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
  }

  return { init };
})();
