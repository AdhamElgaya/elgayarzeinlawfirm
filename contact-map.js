/**
 * Branch map coordinates — edit latitude & longitude for each office below.
 */

const BRANCH_CAIRO_LAT = 30.03598711400953;
const BRANCH_CAIRO_LNG = 31.33479067055226;
const BRANCH_ALEX_LAT = 31.2541633103334;
const BRANCH_ALEX_LNG = 29.9752725381945;

(function initContactMap() {
  const el = document.getElementById("contact-map");
  if (!el || typeof L === "undefined") return;

  const markers = [];

  const branches = [
    { lat: BRANCH_CAIRO_LAT, lng: BRANCH_CAIRO_LNG, titleKey: "contact.branch.cairo", titleAr: "مكتب القاهرة" },
    { lat: BRANCH_ALEX_LAT, lng: BRANCH_ALEX_LNG, titleKey: "contact.branch.alex", titleAr: "مكتب الإسكندرية" },
  ];

  function branchTitle(branch) {
    return window.GZ_I18N?.t(branch.titleKey) || branch.titleAr;
  }

  const map = L.map(el, {
    scrollWheelZoom: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const latLngs = [];
  branches.forEach((b) => {
    latLngs.push([b.lat, b.lng]);
    const marker = L.marker([b.lat, b.lng]).addTo(map).bindPopup(branchTitle(b));
    markers.push({ marker, branch: b });
  });

  if (latLngs.length === 1) {
    map.setView(latLngs[0], 16);
  } else {
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, {
      padding: [44, 44],
      maxZoom: 11,
    });
  }

  function fit() {
    map.invalidateSize();
  }

  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => setTimeout(fit, 250));

  const reveal = el.closest(".reveal");
  if (reveal) {
    const syncWhenVisible = () => {
      if (reveal.classList.contains("visible")) {
        setTimeout(fit, 120);
      }
    };
    syncWhenVisible();
    const mo = new MutationObserver(syncWhenVisible);
    mo.observe(reveal, { attributes: true, attributeFilter: ["class"] });
  }

  window.addEventListener("gz:languagechange", () => {
    markers.forEach(({ marker, branch }) => {
      marker.setPopupContent(branchTitle(branch));
    });
  });

  setTimeout(fit, 450);
})();
