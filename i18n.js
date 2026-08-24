(function () {
  const STORAGE_KEY = "gz-lang";
  const LANG_CHOSEN_KEY = "gz-lang-chosen";
  const SUPPORTED = ["ar", "en"];

  const globalBindings = [
    { sel: ".brand", key: "brand.aria", attr: "aria-label" },
    { sel: "#main-nav", key: "nav.aria", attr: "aria-label" },
    { sel: '#main-nav a[href="index.html"]', key: "nav.home" },
    { sel: '#main-nav a[href="updates.html"]', key: "nav.updates" },
    { sel: '#main-nav a[href="services.html"]', key: "nav.services" },
    { sel: '#main-nav a[href="partners.html"]', key: "nav.partners" },
    { sel: '#main-nav a[href="team.html"]', key: "nav.team" },
    { sel: '#main-nav a[href="booking.html"]', key: "nav.booking" },
    { sel: ".menu-btn", key: "menu.aria", attr: "aria-label" },
    { sel: ".footer-col-contact h3", key: "footer.contact.title" },
    { sel: ".footer-col-contact p", key: "footer.contact.intro" },
    { sel: '.footer-links a[href*="wa.me"]', key: "footer.whatsapp" },
    { sel: '.footer-links a[href="tel:+201507044556"]', key: "footer.phone" },
    { sel: '.footer-links a[href="tel:+2033584020"]', key: "footer.landline" },
    { sel: '.footer-links a[href^="mailto:"]', key: "footer.email" },
    {
      sel: '.footer-links a[href*="cid=11518553804730550997"]',
      key: "footer.cairo",
      attr: "aria-label",
      attrKey: "footer.cairoAria",
    },
    {
      sel: '.footer-links a[href*="cid=11518553804730550997"]',
      key: "footer.cairo",
    },
    {
      sel: '.footer-links a[href*="11tchff5gx"]',
      key: "footer.alex",
      attr: "aria-label",
      attrKey: "footer.alexAria",
    },
    {
      sel: '.footer-links a[href*="11tchff5gx"]',
      key: "footer.alex",
    },
    { sel: ".footer-col-pages h3", key: "footer.browse" },
    { sel: ".footer-site-nav", key: "footer.pagesAria", attr: "aria-label" },
    { sel: '.footer-site-nav a[href="index.html"]', key: "nav.homeFooter" },
    { sel: '.footer-site-nav a[href="updates.html"]', key: "nav.updates" },
    { sel: '.footer-site-nav a[href="services.html"]', key: "nav.services" },
    { sel: '.footer-site-nav a[href="partners.html"]', key: "nav.partners" },
    { sel: '.footer-site-nav a[href="team.html"]', key: "nav.team" },
    { sel: '.footer-site-nav a[href="gallery.html"]', key: "nav.gallery" },
    { sel: '.footer-site-nav a[href="booking.html"]', key: "nav.bookingFooter" },
    { sel: '.footer-site-nav a[href="contact.html"]', key: "nav.contact" },
    { sel: ".footer-lang-cookie-notice", key: "footer.langCookie" },
    { sel: '.footer-portal-nav a[href="/portal/login.html"]', key: "footer.portal.login" },
    { sel: ".footer-bottom p", key: "footer.copyright" },
    { sel: '.footer-social a[href*="facebook"]', key: "social.facebook", attr: "aria-label" },
    { sel: '.footer-social a[href*="instagram"]', key: "social.instagram", attr: "aria-label" },
  ];

  const pageBindings = {
    index: [
      { sel: "title", key: "page.index.title" },
      { sel: 'meta[name="description"]', key: "page.index.description", attr: "content" },
      { sel: ".hero .eyebrow", key: "index.hero.eyebrow" },
      { sel: ".hero h1", key: "index.hero.title" },
      { sel: '.hero-actions a[href="booking.html"]', key: "index.hero.book" },
      { sel: '.hero-actions a[href="services.html"]', key: "index.hero.services" },
      { sel: ".hero-card h3", key: "index.vision.title" },
      { sel: ".hero-card p", key: "index.vision.body" },
      { sel: ".hero-scroll-cue span:first-child", key: "index.scroll" },
      { sel: ".mission-head h2", key: "index.mission.title" },
      { sel: ".mission-head .lead", key: "index.mission.body" },
      { sel: "main > section:nth-child(3) .section-head h2", key: "index.services.title" },
      { sel: ".service-card:nth-child(1) h3", key: "index.svc.civil.title" },
      { sel: ".service-card:nth-child(1) img", key: "index.svc.civil.title", attr: "alt" },
      { sel: ".service-card:nth-child(2) h3", key: "index.svc.criminal.title" },
      { sel: ".service-card:nth-child(2) img", key: "index.svc.criminal.title", attr: "alt" },
      { sel: ".service-card:nth-child(3) h3", key: "index.svc.family.title" },
      { sel: ".service-card:nth-child(3) img", key: "index.svc.family.title", attr: "alt" },
      { sel: ".service-card:nth-child(4) h3", key: "index.svc.familyForeign.title" },
      { sel: ".service-card:nth-child(4) img", key: "index.svc.familyForeign.title", attr: "alt" },
      { sel: ".service-card:nth-child(5) h3", key: "index.svc.labor.title" },
      { sel: ".service-card:nth-child(5) img", key: "index.svc.labor.title", attr: "alt" },
      { sel: ".service-card:nth-child(6) h3", key: "index.svc.corporate.title" },
      { sel: ".service-card:nth-child(6) img", key: "index.svc.corporate.title", attr: "alt" },
      { sel: ".service-card:nth-child(7) h3", key: "index.svc.commercial.title" },
      { sel: ".service-card:nth-child(7) img", key: "index.svc.commercial.title", attr: "alt" },
      { sel: ".service-card:nth-child(8) h3", key: "index.svc.tax.title" },
      { sel: ".service-card:nth-child(8) img", key: "index.svc.tax.title", attr: "alt" },
      { sel: ".service-card:nth-child(9) h3", key: "index.svc.admin.title" },
      { sel: ".service-card:nth-child(9) img", key: "index.svc.admin.title", attr: "alt" },
    ],
    services: [
      { sel: "title", key: "page.services.title" },
      { sel: ".section-head h2", key: "services.head.title" },
      { sel: ".section-head p", key: "services.head.body" },
    ],
    partners: [
      { sel: "title", key: "page.partners.title" },
      { sel: ".section-head h2", key: "partners.head.title" },
      { sel: ".section-head p", key: "partners.head.body" },
    ],
    updates: [
      { sel: "title", key: "page.updates.title" },
      { sel: ".section-head h2", key: "updates.head.title" },
      { sel: ".section-head p", key: "updates.head.body" },
    ],
    booking: [
      { sel: "title", key: "page.booking.title" },
      { sel: ".section-head h2", key: "booking.head.title" },
      { sel: ".section-head p", key: "booking.head.body" },
    ],
    contact: [
      { sel: "title", key: "page.contact.title" },
      { sel: ".section-head h2", key: "contact.head.title" },
      { sel: ".section-head p", key: "contact.head.body" },
    ],
    gallery: [
      { sel: "title", key: "page.gallery.title" },
      { sel: 'meta[name="description"]', key: "page.gallery.description", attr: "content" },
      { sel: ".section-head h2", key: "gallery.head.title" },
      { sel: ".section-head p", key: "gallery.head.body" },
      { sel: "#gallery-lightbox", key: "gallery.lightbox.aria", attr: "aria-label" },
      { sel: ".gallery-lightbox-close", key: "gallery.lightbox.close", attr: "aria-label" },
      { sel: ".gallery-lightbox-zoom-hint", key: "gallery.lightbox.zoom" },
      { sel: "#contact-map", key: "contact.map.aria", attr: "aria-label" },
    ],
    team: [
      { sel: "title", key: "page.team.title" },
      { sel: ".section-head h2", key: "team.head.title" },
      { sel: ".section-head p", key: "team.head.body" },
    ],
    "team-member": [
      { sel: "title", key: "page.teamMember.title" },
    ],
    "portal-login": [
      { sel: "title", key: "page.portal.login.title" },
      { sel: "h1", key: "portal.login.title" },
      { sel: ".portal-lead", key: "portal.login.lead" },
      { sel: 'label span[data-i18n="portal.field.username"]', key: "portal.field.username" },
      { sel: 'label span[data-i18n="portal.field.password"]', key: "portal.field.password" },
      { sel: 'button[type="submit"]', key: "portal.login.submit" },
      { sel: '.portal-brand [data-i18n="portal.brand.title"]', key: "portal.brand.title" },
      { sel: '.portal-brand [data-i18n="portal.brand.portal"]', key: "portal.brand.portal" },
    ],
    "portal-dashboard": [
      { sel: "title", key: "page.portal.dashboard.title" },
      { sel: "h1", key: "portal.dashboard.title" },
      { sel: ".portal-panel:nth-of-type(2) h2", key: "portal.dashboard.tasks" },
      { sel: '.portal-brand [data-i18n="portal.brand.title"]', key: "portal.brand.title" },
      { sel: '.portal-brand [data-i18n="portal.brand.portal"]', key: "portal.brand.portal" },
      { sel: "#logoutBtn", key: "portal.logout" },
      { sel: "#adminLink", key: "portal.admin.link" },
    ],
    "portal-admin": [
      { sel: '.portal-brand [data-i18n="portal.brand.title"]', key: "portal.brand.title" },
      { sel: '.portal-brand [data-i18n="portal.brand.admin"]', key: "portal.brand.admin" },
      { sel: '.portal-back-link [data-i18n="portal.back"]', key: "portal.back" },
    ],
  };

  const defaults = new WeakMap();
  let currentLang = "ar";
  const COOKIE_DAYS = 365;

  function getCookie(name) {
    if (window.GZ_I18N_BOOT?.getCookie) {
      return window.GZ_I18N_BOOT.getCookie(name);
    }
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value) {
    if (window.GZ_I18N_BOOT?.setCookie) {
      window.GZ_I18N_BOOT.setCookie(name, value, COOKIE_DAYS);
      return;
    }
    const maxAge = COOKIE_DAYS * 24 * 60 * 60;
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax";
  }

  function migrateFromLocalStorage() {
    try {
      const lsLang = localStorage.getItem(STORAGE_KEY);
      const lsChosen = localStorage.getItem(LANG_CHOSEN_KEY);
      if (lsLang && SUPPORTED.includes(lsLang) && !getCookie(STORAGE_KEY)) {
        setCookie(STORAGE_KEY, lsLang);
      }
      if ((lsChosen || lsLang) && !getCookie(LANG_CHOSEN_KEY)) {
        setCookie(LANG_CHOSEN_KEY, "1");
      }
    } catch {
      /* ignore */
    }
  }

  function getStoredLang() {
    migrateFromLocalStorage();
    const stored = getCookie(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : "ar";
  }

  function t(key) {
    if (currentLang === "ar") return null;
    const dict = window.GZ_I18N_EN || {};
    return dict[key] ?? null;
  }

  function rememberDefault(el, field) {
    const map = defaults.get(el) || {};
    if (map[field] === undefined) {
      if (field === "text") {
        map.text = el.tagName === "INPUT" || el.tagName === "TEXTAREA" ? el.value : el.textContent;
      } else if (field === "html") {
        map.html = el.innerHTML;
      } else {
        map[field] = el.getAttribute(field) ?? "";
      }
      defaults.set(el, map);
    }
    return map[field];
  }

  function applyValue(el, binding, lang) {
    const field = binding.attr || "text";
    const key = binding.attrKey && lang === "en" ? binding.attrKey : binding.key;

    if (lang === "ar") {
      const original = rememberDefault(el, field);
      if (field === "text") {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.value = original;
        else el.textContent = original;
      } else if (field === "html") {
        el.innerHTML = original;
      } else {
        el.setAttribute(field, original);
      }
      return;
    }

    const value = t(key);
    if (value == null) return;

    rememberDefault(el, field);
    if (field === "text") {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.value = value;
      else el.textContent = value;
    } else if (field === "html") {
      el.innerHTML = value;
    } else {
      el.setAttribute(field, value);
    }
  }

  function applyListBindings(cardIndex, prefix, itemCount) {
    const page = document.body.dataset.page;
    if (!page) return [];
    const bindings = [];
    for (let i = 1; i <= itemCount; i += 1) {
      bindings.push({
        sel: `.service-card:nth-child(${cardIndex}) li:nth-child(${i})`,
        key: `${prefix}.i${i}`,
      });
    }
    return bindings;
  }

  function getActiveBindings() {
    const page = document.body.dataset.page || "";
    const extra = [];

    if (page === "index") {
      extra.push(...applyListBindings(1, "index.svc.civil", 8));
      extra.push(...applyListBindings(2, "index.svc.criminal", 9));
      extra.push(...applyListBindings(3, "index.svc.family", 8));
      extra.push(...applyListBindings(4, "index.svc.familyForeign", 3));
      extra.push(...applyListBindings(5, "index.svc.labor", 7));
      extra.push(...applyListBindings(6, "index.svc.corporate", 7));
      extra.push(...applyListBindings(7, "index.svc.commercial", 7));
      extra.push(...applyListBindings(8, "index.svc.tax", 7));
      extra.push(...applyListBindings(9, "index.svc.admin", 5));
    }

    if (page === "services") {
      for (let i = 1; i <= 8; i += 1) {
        extra.push({ sel: `.service-card:nth-child(${i}) h3`, key: `services.card${i}.title` });
        extra.push({ sel: `.service-card:nth-child(${i}) p`, key: `services.card${i}.body` });
      }
    }

    if (page === "partners") {
      for (let i = 1; i <= 3; i += 1) {
        extra.push({ sel: `.partner:nth-child(${i}) img`, key: `partners.card${i}.alt`, attr: "alt" });
        extra.push({ sel: `.partner:nth-child(${i}) h3`, key: `partners.card${i}.title` });
        extra.push({ sel: `.partner:nth-child(${i}) p`, key: `partners.card${i}.body` });
      }
    }

    if (page === "updates") {
      extra.push({ sel: ".update-card img", key: "updates.card1.alt", attr: "alt" });
      extra.push({ sel: ".update-date", key: "updates.card1.date" });
      extra.push({ sel: ".update-card-body h3", key: "updates.card1.title" });
      extra.push({ sel: ".update-card-body p:not(.update-date)", key: "updates.card1.body" });
    }

    if (page === "booking") {
      extra.push({ sel: 'label[for="name"]', key: "booking.form.name" });
      extra.push({ sel: 'label[for="phone"]', key: "booking.form.phone" });
      extra.push({ sel: 'label[for="email"]', key: "booking.form.email" });
      extra.push({ sel: 'label[for="service"]', key: "booking.form.method" });
      extra.push({ sel: 'label[for="message"]', key: "booking.form.subject" });
      extra.push({ sel: "#message", key: "booking.form.placeholder", attr: "placeholder" });
      extra.push({ sel: '#service option[value=""]', key: "booking.form.select" });
      extra.push({ sel: '#service option:nth-child(2)', key: "booking.form.emailOpt" });
      extra.push({ sel: '#service option:nth-child(3)', key: "booking.form.phoneOpt" });
      extra.push({ sel: '#service option:nth-child(4)', key: "booking.form.whatsappOpt" });
      extra.push({ sel: '.booking-form button[type="submit"]', key: "booking.form.submit" });
    }

    if (page === "contact") {
      extra.push({ sel: ".contact-channel-card:nth-child(1) .contact-channel-cta", key: "contact.callNow" });
      extra.push({ sel: ".contact-channel-card:nth-child(2) .contact-channel-cta", key: "contact.message" });
      extra.push({ sel: ".contact-channel-card:nth-child(3) .contact-channel-cta", key: "contact.sendEmail" });
      extra.push({ sel: ".contact-location-entry:nth-child(1) h3", key: "contact.cairo.title" });
      extra.push({ sel: ".contact-location-entry:nth-child(1) .contact-location-address", key: "contact.cairo.address" });
      extra.push({ sel: ".contact-location-entry:nth-child(2) h3", key: "contact.alex.title" });
      extra.push({ sel: ".contact-location-entry:nth-child(2) .contact-location-address", key: "contact.alex.address" });
      extra.push({ sel: ".contact-hours-card h3", key: "contact.hours.title" });
      extra.push({ sel: ".contact-map-head h3", key: "contact.map.title" });
      const days = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
      days.forEach((day, idx) => {
        extra.push({ sel: `.work-hours-list li:nth-child(${idx + 1}) .work-hours-day`, key: `contact.days.${day}` });
        if (day === "fri") {
          extra.push({ sel: ".work-hours-list li:nth-child(7) .work-hours-closed", key: "contact.hours.closed" });
        } else if (day === "thu") {
          extra.push({ sel: ".work-hours-list li:nth-child(6) .work-hours-slot", key: "contact.hours.slotMorning", attr: "html", html: true });
        } else {
          extra.push({ sel: `.work-hours-list li:nth-child(${idx + 1}) .work-hours-slot`, key: "contact.hours.slot", attr: "html", html: true });
        }
      });
    }

    if (page === "gallery") {
      extra.push({ sel: ".gallery-item:nth-child(1) .gallery-item-caption", key: "gallery.cap1" });
      for (let i = 2; i <= 22; i += 1) {
        extra.push({ sel: `.gallery-item:nth-child(${i}) .gallery-item-caption`, key: "gallery.capEvents" });
        extra.push({ sel: `.gallery-item:nth-child(${i})`, key: "gallery.itemAria", attr: "aria-label" });
        extra.push({ sel: `.gallery-item:nth-child(${i}) img`, key: "gallery.imgAlt", attr: "alt" });
      }
      extra.push({ sel: ".gallery-item:nth-child(1)", key: "gallery.itemAria", attr: "aria-label" });
      extra.push({ sel: ".gallery-item:nth-child(1) img", key: "gallery.imgAlt", attr: "alt" });
    }

    if (page === "team") {
      const members = [
        "mostafa-zain",
        "mahmoud-elgayar",
        "fahima-ahmed-alkomary",
        "mahmoud-ahmed-emam",
        "ibrahim-ali-aref",
        "ahmed-badran",
        "noha-mohamed-elsayed",
        "nassar-metwaly-nassar",
        "wesam-talal",
        "mohamed-ahmed-daghidy",
        "mohamed-abdelhafiz",
        "mohamed-shaheen",
        "abdulaziz-elgayar",
        "ahmed-ibrahim-elkhediwy",
        "mohamed-magdy",
        "mai-hanafy",
        "habiba",
        "aya-mostafa-zain",
        "adham-elgayar",
      ];
      members.forEach((id, idx) => {
        const n = idx + 1;
        extra.push({ sel: `.team-brief-card:nth-child(${n}) h3`, key: `team.${id}.name` });
        extra.push({ sel: `.team-brief-card:nth-child(${n}) p`, key: `team.${id}.roleCard` });
        extra.push({ sel: `.team-brief-card:nth-child(${n}) .team-more-btn`, key: "team.more" });
        extra.push({ sel: `.team-brief-card:nth-child(${n}) img`, key: `team.${id}.name`, attr: "alt" });
      });
    }

    return [...globalBindings, ...(pageBindings[page] || []), ...extra];
  }

  function applyBindings(lang) {
    getActiveBindings().forEach((binding) => {
      document.querySelectorAll(binding.sel).forEach((el) => {
        if (binding.html) {
          const field = binding.attr || "html";
          if (lang === "ar") {
            el.innerHTML = rememberDefault(el, field);
          } else {
            const value = t(binding.key);
            if (value != null) {
              rememberDefault(el, field);
              el.innerHTML = value;
            }
          }
          return;
        }
        applyValue(el, binding, lang);
      });
    });
  }

  function setDocumentLang(lang) {
    const html = document.documentElement;
    const dir = lang === "ar" ? "rtl" : "ltr";
    html.lang = lang;
    html.dir = dir;
    document.body.classList.toggle("lang-en", lang === "en");
    document.body.classList.toggle("lang-ar", lang === "ar");
    document.querySelectorAll(".gallery-lightbox-zoom-hint, .gallery-lightbox-caption").forEach((el) => {
      el.lang = lang;
      el.dir = dir;
    });
  }

  function hasChosenLanguage() {
    migrateFromLocalStorage();
    if (getCookie(LANG_CHOSEN_KEY)) return true;
    if (getCookie(STORAGE_KEY)) {
      markLanguageChosen();
      return true;
    }
    return false;
  }

  function markLanguageChosen() {
    setCookie(LANG_CHOSEN_KEY, "1");
  }

  function updateSwitcher() {
    document.querySelectorAll(".lang-switch-option").forEach((btn) => {
      const active = btn.dataset.lang === currentLang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function injectFooterSwitcher() {
    const socialCol = document.querySelector(".footer-col-social");
    if (!socialCol || socialCol.querySelector(".footer-lang-switch")) return;

    const wrap = document.createElement("div");
    wrap.className = "footer-lang-switch";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Language switcher");

    const arBtn = document.createElement("button");
    arBtn.type = "button";
    arBtn.className = "lang-switch-option";
    arBtn.dataset.lang = "ar";
    arBtn.textContent = "العربية";

    const enBtn = document.createElement("button");
    enBtn.type = "button";
    enBtn.className = "lang-switch-option";
    enBtn.dataset.lang = "en";
    enBtn.textContent = "English";

    const notice = document.createElement("p");
    notice.className = "footer-lang-cookie-notice";
    notice.textContent =
      "نستخدم ملفات تعريف الارتباط (الكوكيز) لحفظ اختيارك للغة.";

    wrap.append(arBtn, enBtn);

    const social = socialCol.querySelector(".footer-social");
    if (social) {
      socialCol.insertBefore(notice, social);
      socialCol.insertBefore(wrap, notice);
    } else {
      socialCol.append(wrap, notice);
    }

    wrap.addEventListener("click", (event) => {
      const btn = event.target.closest(".lang-switch-option");
      if (!btn) return;
      setLanguage(btn.dataset.lang);
    });
  }

  function injectFooterPortalLinks() {
    const socialCol = document.querySelector(".footer-col-social");
    if (!socialCol || socialCol.querySelector(".footer-portal-nav")) return;

    const nav = document.createElement("nav");
    nav.className = "footer-portal-nav";
    nav.setAttribute("aria-label", "Lawyer portal");

    const loginLink = document.createElement("a");
    loginLink.href = "/portal/login.html";
    loginLink.setAttribute("data-i18n", "footer.portal.login");
    loginLink.textContent = "تسجيل الدخول";

    nav.append(loginLink);

    const social = socialCol.querySelector(".footer-social");
    if (social) {
      socialCol.insertBefore(nav, social);
    } else {
      socialCol.appendChild(nav);
    }
  }

  function injectLanguagePicker() {
    if (document.getElementById("lang-picker")) return;

    const picker = document.createElement("div");
    picker.id = "lang-picker";
    picker.className = "lang-picker";
    picker.hidden = true;
    picker.innerHTML = `
      <div class="lang-picker-backdrop" aria-hidden="true"></div>
      <div class="lang-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="lang-picker-title">
        <p id="lang-picker-title" class="lang-picker-title">Please choose your language</p>
        <p class="lang-picker-title lang-picker-title--ar" dir="rtl" lang="ar">برجاء اختيار اللغة</p>
        <div class="lang-picker-actions">
          <button type="button" class="lang-picker-btn" data-lang="ar">العربية</button>
          <button type="button" class="lang-picker-btn" data-lang="en">English</button>
        </div>
        <p class="lang-picker-notice">We use cookies to remember your language preference.</p>
        <p class="lang-picker-notice lang-picker-notice--ar" dir="rtl" lang="ar">نستخدم ملفات تعريف الارتباط (الكوكيز) لحفظ اختيارك للغة.</p>
      </div>
    `;
    document.body.appendChild(picker);

    picker.addEventListener("click", (event) => {
      const btn = event.target.closest(".lang-picker-btn");
      if (!btn) return;
      chooseLanguage(btn.dataset.lang);
    });
  }

  function showLanguagePicker() {
    const picker = document.getElementById("lang-picker");
    if (!picker) return;
    picker.hidden = false;
    document.body.classList.add("lang-picker-open");
  }

  function hideLanguagePicker() {
    const picker = document.getElementById("lang-picker");
    if (!picker) return;
    picker.hidden = true;
    document.body.classList.remove("lang-picker-open");
  }

  function getEnScriptSrc() {
    const boot = document.querySelector('script[src*="i18n-boot.js"]');
    if (boot) {
      return boot.getAttribute("src").replace("i18n-boot.js", "i18n-en.js");
    }
    return "i18n-en.js";
  }

  let enLoadPromise = null;
  function ensureEnDictionary() {
    if (window.GZ_I18N_EN) return Promise.resolve();
    if (enLoadPromise) return enLoadPromise;
    enLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = getEnScriptSrc();
      script.onload = resolve;
      script.onerror = () => {
        enLoadPromise = null;
        reject(new Error("Failed to load English translations"));
      };
      document.head.appendChild(script);
    });
    return enLoadPromise;
  }

  function applyLanguage(lang) {
    currentLang = lang;
    setCookie(STORAGE_KEY, lang);
    markLanguageChosen();
    setDocumentLang(lang);
    applyBindings(lang);
    updateSwitcher();
    window.dispatchEvent(new CustomEvent("gz:languagechange", { detail: { lang } }));
  }

  function chooseLanguage(lang) {
    markLanguageChosen();
    setLanguage(lang);
    hideLanguagePicker();
  }

  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang)) lang = "ar";
    if (lang === "en") {
      ensureEnDictionary().then(() => applyLanguage(lang)).catch(() => applyLanguage(lang));
      return;
    }
    applyLanguage(lang);
  }

  window.GZ_I18N = {
    t(key) {
      if (currentLang === "ar") return null;
      return t(key);
    },
    getLanguage() {
      return currentLang;
    },
    setLanguage,
    applyBindings,
  };

  function init() {
    injectLanguagePicker();
    injectFooterSwitcher();
    injectFooterPortalLinks();

    const chosen = hasChosenLanguage();
    currentLang = chosen ? getStoredLang() : "ar";

    const finishInit = () => {
      setDocumentLang(currentLang);
      applyBindings(currentLang);
      updateSwitcher();

      if (!chosen) {
        showLanguagePicker();
      }

      window.GZ_I18N._ready = true;
      window.dispatchEvent(new CustomEvent("gz:i18nready", { detail: { lang: currentLang } }));
    };

    if (currentLang === "en") {
      ensureEnDictionary().then(finishInit).catch(finishInit);
      return;
    }
    finishInit();
  }

  window.GZ_I18N._ready = false;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
