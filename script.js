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
  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  menuBtn.addEventListener("click", () => {
    setOpen(!nav.classList.contains("open"));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      setOpen(false);
    });
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

const bookingForm = document.querySelector(".booking-form");
if (bookingForm) {
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    alert("تم استلام طلبك بنجاح. سنقوم بالتواصل معك قريباً.");
    bookingForm.reset();
  });
}

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
