/**
 * Writes booking form submissions to Cloud Firestore (client SDK only).
 * Collection: bookingRequests
 */
(function () {
  const TOAST_VISIBLE_MS = 5000;
  const TOAST_EXIT_MS = 400;

  const ICON_SUCCESS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#6aaf6a" stroke-width="1.65"/><path d="M8 12.35 10.55 15 16 9.35" stroke="#a8e6a8" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const ICON_ERROR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#c07070" stroke-width="1.65"/><path d="M9 9 15 15M15 9 9 15" stroke="#f0b8b8" stroke-width="1.85" stroke-linecap="round"/></svg>`;

  const form = document.querySelector(".booking-form");
  if (!form) return;

  const toastEl = document.getElementById("booking-toast");
  let toastHideTimer = null;
  let toastExitTimer = null;

  function hideToastImmediately() {
    clearTimeout(toastHideTimer);
    clearTimeout(toastExitTimer);
    toastHideTimer = null;
    toastExitTimer = null;
    if (!toastEl) return;
    toastEl.hidden = true;
    toastEl.classList.remove(
      "booking-toast--visible",
      "booking-toast--leaving",
      "booking-toast--success",
      "booking-toast--error"
    );
  }

  function showToast(type, message) {
    if (!toastEl) return;
    const iconWrap = toastEl.querySelector(".booking-toast-icon");
    const msgEl = toastEl.querySelector(".booking-toast-msg");
    if (!iconWrap || !msgEl) return;

    hideToastImmediately();

    toastEl.hidden = false;
    iconWrap.innerHTML = type === "success" ? ICON_SUCCESS : ICON_ERROR;
    msgEl.textContent = message;
    toastEl.classList.remove("booking-toast--success", "booking-toast--error");
    toastEl.classList.add(type === "success" ? "booking-toast--success" : "booking-toast--error");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toastEl.classList.add("booking-toast--visible");
      });
    });

    toastHideTimer = setTimeout(() => {
      toastEl.classList.remove("booking-toast--visible");
      toastEl.classList.add("booking-toast--leaving");

      toastExitTimer = setTimeout(() => {
        toastEl.hidden = true;
        toastEl.classList.remove("booking-toast--leaving", "booking-toast--success", "booking-toast--error");
        toastExitTimer = null;
      }, TOAST_EXIT_MS);

      toastHideTimer = null;
    }, TOAST_VISIBLE_MS);
  }

  const cfg = window.__GZ_FIREBASE_CONFIG__;
  const configured =
    cfg &&
    cfg.apiKey &&
    typeof cfg.apiKey === "string" &&
    !/^YOUR_/i.test(cfg.apiKey.trim()) &&
    cfg.projectId &&
    !/^YOUR_/i.test(String(cfg.projectId).trim());

  if (!configured || typeof firebase === "undefined") {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      showToast(
        "error",
        "لم يتم ضبط Firebase بعد. افتح ملف firebase-config.js وأدخل بيانات مشروعك من Firebase Console، ثم فعّل Firestore."
      );
    });
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(cfg);
  }
  const db = firebase.firestore();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideToastImmediately();

    const submitBtn = form.querySelector('button[type="submit"]');
    const name = form.querySelector("#name")?.value?.trim() ?? "";
    const phone = form.querySelector("#phone")?.value?.trim() ?? "";
    const email = form.querySelector("#email")?.value?.trim() ?? "";
    const contactMethod = form.querySelector("#service")?.value?.trim() ?? "";
    const message = form.querySelector("#message")?.value?.trim() ?? "";

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    try {
      await db.collection("bookingRequests").add({
        name,
        phone,
        email,
        contactMethod,
        message,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        source: "booking.html",
      });
      showToast("success", "تم استلام طلبك بنجاح. سنقوم بالتواصل معك قريباً.");
      form.reset();
    } catch (err) {
      console.error(err);
      showToast(
        "error",
        "تعذر إرسال الطلب. تحقق من اتصال الإنترنت، من إعداد firebase-config.js، ومن قواعد Firestore ثم أعد المحاولة."
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });
})();

/*
 * --- Firestore rules (Console → Firestore → Rules) — starter example ---
 * createdAt is set by the client as serverTimestamp(); rules see it on create.
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /bookingRequests/{id} {
 *       allow create: if request.resource.data.name is string
 *         && request.resource.data.name.size() > 0
 *         && request.resource.data.name.size() < 300
 *         && request.resource.data.phone is string
 *         && request.resource.data.phone.size() < 80
 *         && request.resource.data.email is string
 *         && request.resource.data.email.size() < 320
 *         && request.resource.data.contactMethod is string
 *         && request.resource.data.contactMethod.size() < 120
 *         && request.resource.data.message is string
 *         && request.resource.data.message.size() < 8000
 *         && request.resource.data.source == 'booking.html';
 *       allow read, update, delete: if false;
 *     }
 *   }
 * }
 *
 * For testing only (spam risk): allow create: if true;
 */
