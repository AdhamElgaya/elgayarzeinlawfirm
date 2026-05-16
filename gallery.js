(function () {
  const root = document.querySelector("[data-gallery-root]");
  const lightbox = document.getElementById("gallery-lightbox");
  if (!root || !lightbox) return;

  const imgEl = lightbox.querySelector(".gallery-lightbox-img");
  const captionEl = lightbox.querySelector(".gallery-lightbox-caption");
  const captionWrap = lightbox.querySelector(".gallery-lightbox-caption-wrap");
  const closeBtn = lightbox.querySelector(".gallery-lightbox-close");
  const backdrop = lightbox.querySelector(".gallery-lightbox-backdrop");
  const visualEl = lightbox.querySelector(".gallery-lightbox-visual");
  const zoomHintEl = lightbox.querySelector(".gallery-lightbox-zoom-hint");

  const mqMobile = window.matchMedia("(max-width: 760px)");
  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 3.5;
  const ZOOM_STEP = 0.1;

  let typingTimer = null;
  let revealTimer = null;
  let typeStartTimer = null;
  let zoomHintTimer = null;
  let gpuTransitionHandler = null;
  let userZoom = 1;
  let panX = 0;
  let panY = 0;

  function clearGpuTransition() {
    if (gpuTransitionHandler) {
      imgEl.removeEventListener("transitionend", gpuTransitionHandler);
      gpuTransitionHandler = null;
    }
    lightbox.classList.remove("gallery-lightbox--gpu");
  }

  function clearTimers() {
    if (typingTimer !== null) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
    if (revealTimer !== null) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    if (typeStartTimer !== null) {
      clearTimeout(typeStartTimer);
      typeStartTimer = null;
    }
    if (zoomHintTimer !== null) {
      clearTimeout(zoomHintTimer);
      zoomHintTimer = null;
    }
  }

  function dismissZoomHint() {
    lightbox.classList.add("gallery-lightbox--zoom-hint-dismissed");
    if (zoomHintEl) zoomHintEl.setAttribute("aria-hidden", "true");
    if (zoomHintTimer !== null) {
      clearTimeout(zoomHintTimer);
      zoomHintTimer = null;
    }
  }

  function resetZoomHint() {
    lightbox.classList.remove("gallery-lightbox--zoom-hint-dismissed");
    if (zoomHintEl) zoomHintEl.setAttribute("aria-hidden", "true");
    if (zoomHintTimer !== null) {
      clearTimeout(zoomHintTimer);
      zoomHintTimer = null;
    }
  }

  function scheduleZoomHint() {
    if (mqMobile.matches || !zoomHintEl) return;
    resetZoomHint();
    zoomHintEl.setAttribute("aria-hidden", "false");
    zoomHintTimer = window.setTimeout(dismissZoomHint, 5500);
  }

  function resetZoom() {
    userZoom = 1;
    panX = 0;
    panY = 0;
    lightbox.style.setProperty("--gallery-zoom", "1");
    lightbox.style.setProperty("--gallery-pan-x", "0px");
    lightbox.style.setProperty("--gallery-pan-y", "0px");
    lightbox.classList.remove("gallery-lightbox--zoomed", "gallery-lightbox--zoom-interactive");
    if (captionWrap) captionWrap.setAttribute("aria-hidden", "false");
    resetZoomHint();
  }

  function applyZoomTransform() {
    const isZoomed = userZoom > 1.02;
    lightbox.style.setProperty("--gallery-zoom", String(userZoom));
    lightbox.style.setProperty("--gallery-pan-x", `${panX}px`);
    lightbox.style.setProperty("--gallery-pan-y", `${panY}px`);
    lightbox.classList.toggle("gallery-lightbox--zoomed", isZoomed);
    if (captionWrap) captionWrap.setAttribute("aria-hidden", isZoomed ? "true" : "false");
  }

  function onLightboxWheel(e) {
    if (mqMobile.matches || lightbox.hidden || !lightbox.classList.contains("gallery-lightbox--revealed")) {
      return;
    }

    e.preventDefault();
    dismissZoomHint();
    lightbox.classList.add("gallery-lightbox--zoom-interactive");

    const direction = e.deltaY < 0 ? 1 : -1;
    const step = mqReduce.matches ? 0.2 : ZOOM_STEP;
    const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, userZoom + direction * step));

    if (nextZoom === userZoom) return;

    const rect = imgEl.getBoundingClientRect();
    const originX = e.clientX - rect.left - rect.width / 2;
    const originY = e.clientY - rect.top - rect.height / 2;
    const ratio = nextZoom / userZoom;

    panX = originX - (originX - panX) * ratio;
    panY = originY - (originY - panY) * ratio;
    userZoom = nextZoom;
    applyZoomTransform();
  }

  function syncAria() {
    root.querySelectorAll(".gallery-item").forEach((btn) => {
      if (mqMobile.matches) {
        btn.removeAttribute("aria-haspopup");
      } else {
        btn.setAttribute("aria-haspopup", "dialog");
      }
    });
  }

  function typeCaption(full) {
    if (!captionEl || !full) return;
    captionEl.textContent = "";
    const chunks = full.split(/(\s+)/);
    let i = 0;
    typingTimer = window.setInterval(() => {
      if (i >= chunks.length) {
        clearInterval(typingTimer);
        typingTimer = null;
        return;
      }
      captionEl.textContent += chunks[i];
      i++;
    }, 46);
  }

  function openFromItem(btn) {
    if (mqMobile.matches) return;

    const thumb = btn.querySelector(".gallery-item-media img");
    const cap = btn.querySelector(".gallery-item-caption");
    if (!thumb || !imgEl) return;

    clearTimers();
    clearGpuTransition();
    resetZoom();
    lightbox.classList.remove("gallery-lightbox--revealed");

    imgEl.src = thumb.currentSrc || thumb.src;
    imgEl.alt = thumb.alt || "";
    if (captionEl) captionEl.textContent = "";

    const captionText = cap ? cap.textContent.trim() : "";

    function afterPaint(callback) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
      });
    }

    function showAndAnimate() {
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      closeBtn.focus({ preventScroll: true });

      if (mqReduce.matches) {
        lightbox.classList.add("gallery-lightbox--revealed");
        if (captionEl) captionEl.textContent = captionText;
        scheduleZoomHint();
        return;
      }

      afterPaint(() => {
        revealTimer = window.setTimeout(() => {
          clearGpuTransition();
          lightbox.classList.add("gallery-lightbox--gpu");
          gpuTransitionHandler = (e) => {
            if (e.propertyName !== "transform") return;
            clearGpuTransition();
          };
          imgEl.addEventListener("transitionend", gpuTransitionHandler);
          lightbox.classList.add("gallery-lightbox--revealed");
          scheduleZoomHint();
          revealTimer = null;
        }, 260);
      });

      typeStartTimer = window.setTimeout(() => {
        typeCaption(captionText);
        typeStartTimer = null;
      }, 780);
    }

    if (typeof imgEl.decode === "function") {
      imgEl.decode().then(showAndAnimate).catch(showAndAnimate);
    } else {
      showAndAnimate();
    }
  }

  function close() {
    clearTimers();
    clearGpuTransition();
    resetZoom();
    lightbox.classList.remove("gallery-lightbox--revealed");
    lightbox.hidden = true;
    if (imgEl) {
      imgEl.src = "";
      imgEl.alt = "";
    }
    if (captionEl) captionEl.textContent = "";
    document.body.style.overflow = "";
  }

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".gallery-item");
    if (!btn || mqMobile.matches) return;
    openFromItem(btn);
  });

  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.hidden) close();
  });

  mqMobile.addEventListener("change", () => {
    syncAria();
    if (mqMobile.matches && !lightbox.hidden) close();
  });

  if (visualEl) {
    visualEl.addEventListener("wheel", onLightboxWheel, { passive: false });
  }

  resetZoom();
  syncAria();
})();
