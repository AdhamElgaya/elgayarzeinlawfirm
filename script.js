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
  menuBtn.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
}

const revealItems = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.18 }
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
