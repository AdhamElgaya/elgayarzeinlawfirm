const menuBtn = document.querySelector(".menu-btn");
const nav = document.querySelector(".main-nav");

document.body.classList.add("page-enter");
requestAnimationFrame(() => {
  document.body.classList.remove("page-enter");
});

window.addEventListener("pageshow", () => {
  document.body.classList.remove("page-exit");
});

if (menuBtn && nav) {
  const backdrop = document.createElement("div");
  backdrop.className = "nav-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  document.body.appendChild(backdrop);

  const syncMobileHeaderHeight = () => {
    const header = document.querySelector(".site-header");
    if (!header || !window.matchMedia("(max-width: 760px)").matches) return;
    document.documentElement.style.setProperty(
      "--mobile-header-height",
      `${Math.round(header.getBoundingClientRect().height)}px`
    );
  };

  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    backdrop.classList.toggle("nav-backdrop--visible", open);
    document.body.classList.toggle("nav-open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  menuBtn.addEventListener("click", () => {
    syncMobileHeaderHeight();
    setOpen(!nav.classList.contains("open"));
  });

  backdrop.addEventListener("click", () => {
    setOpen(false);
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      setOpen(false);
    });
  });

  const onViewportChange = () => {
    if (!window.matchMedia("(max-width: 760px)").matches) {
      setOpen(false);
    }
    syncMobileHeaderHeight();
  };

  window.addEventListener("resize", onViewportChange);
  window.addEventListener("orientationchange", onViewportChange);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("open")) {
      setOpen(false);
    }
  });
}

const revealItems = document.querySelectorAll(".reveal");
/* Tall sections (services grid, team page) can be far taller than the viewport.
   Ratio = visibleHeight / sectionHeight stays below ~0.18 until almost scrolled past,
   so threshold 0.18 never fired → sections stayed opacity:0 on mobile. */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0, rootMargin: "48px 0px 48px 0px" }
);

revealItems.forEach((item) => observer.observe(item));

const internalLinks = document.querySelectorAll("a[href]");
internalLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");
    if (!href) return;
    if (link.target === "_blank") return;
    if (href.startsWith("#")) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (href.startsWith("http://") || href.startsWith("https://")) return;

    event.preventDefault();
    document.body.classList.add("page-exit");
    setTimeout(() => {
      window.location.href = href;
    }, 220);
  });
});
