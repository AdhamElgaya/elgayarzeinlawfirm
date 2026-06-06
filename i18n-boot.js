(function () {
  const LANG_COOKIE = "gz-lang";
  const CHOSEN_COOKIE = "gz-lang-chosen";
  const COOKIE_DAYS = 365;

  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    const maxAge = days * 24 * 60 * 60;
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax";
  }

  try {
    const lsLang = localStorage.getItem(LANG_COOKIE);
    const lsChosen = localStorage.getItem(CHOSEN_COOKIE);
    if (lsLang && !getCookie(LANG_COOKIE)) {
      setCookie(LANG_COOKIE, lsLang, COOKIE_DAYS);
    }
    if ((lsChosen || lsLang) && !getCookie(CHOSEN_COOKIE)) {
      setCookie(CHOSEN_COOKIE, "1", COOKIE_DAYS);
    }
  } catch {
    /* ignore */
  }

  const chosen = getCookie(CHOSEN_COOKIE);
  const lang = getCookie(LANG_COOKIE);
  if (chosen && lang === "en") {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }

  window.GZ_I18N_BOOT = {
    getCookie,
    setCookie,
    COOKIE_DAYS,
    LANG_COOKIE,
    CHOSEN_COOKIE,
  };
})();
