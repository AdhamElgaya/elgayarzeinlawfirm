(function () {
  const root = document.querySelector("[data-gallery-root]");
  const lightbox = document.getElementById("gallery-lightbox");
  if (!root || !lightbox) return;

  const imgEl = lightbox.querySelector(".gallery-lightbox-img");
  const captionEl = lightbox.querySelector(".gallery-lightbox-caption");
  const closeBtn = lightbox.querySelector(".gallery-lightbox-close");
  const backdrop = lightbox.querySelector(".gallery-lightbox-backdrop");

  const mqMobile = window.matchMedia("(max-width: 760px)");
  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let typingTimer = null;
  let revealTimer = null;
  let typeStartTimer = null;
  let gpuTransitionHandler = null;

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

  syncAria();
})();
