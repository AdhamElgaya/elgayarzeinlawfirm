/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  إحداثيات الفروع — ضع خط العرض والطول لكل فرع هنا
 *  MAP COORDINATES — put latitude & longitude for each branch below
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  خط العرض = latitude (الرقم الأول عادةً من الخرائط)
 *  خط الطول = longitude (الثاني)
 *
 *  من Google Maps: انقر يمين النقطة → نسخ الإحداثيات
 *  من OpenStreetMap: كليك يمين → Show address / الإحداثيات في الشريط
 *
 *  عدّل الأرقام فقط تحت كل فرع. نص النافذة المنبثقة عند الضغط على الدبوس:
 *  غيّر BRANCH_*_TITLE حسب الرغبة.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* فرع القاهرة — Cairo branch */
const BRANCH_CAIRO_LAT = 30.03598711400953;
const BRANCH_CAIRO_LNG = 31.33479067055226;
const BRANCH_CAIRO_TITLE = "مكتب القاهرة";

/* فرع الإسكندرية — Alexandria branch */
const BRANCH_ALEX_LAT = 31.2541633103334;
const BRANCH_ALEX_LNG = 29.9752725381945;
const BRANCH_ALEX_TITLE = "مكتب الإسكندرية";

(function initContactMap() {
  const el = document.getElementById("contact-map");
  if (!el || typeof L === "undefined") return;

  const branches = [
    { lat: BRANCH_CAIRO_LAT, lng: BRANCH_CAIRO_LNG, title: BRANCH_CAIRO_TITLE },
    { lat: BRANCH_ALEX_LAT, lng: BRANCH_ALEX_LNG, title: BRANCH_ALEX_TITLE },
  ];

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
    L.marker([b.lat, b.lng]).addTo(map).bindPopup(b.title);
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

  setTimeout(fit, 450);
})();
