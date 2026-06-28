const PortalPush = (() => {
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function isSupported() {
    return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  }

  function ensureManifest() {
    if (document.querySelector('link[rel="manifest"]')) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/portal/manifest.json";
    document.head.appendChild(link);
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      return await navigator.serviceWorker.register("/portal/sw.js", { scope: "/portal/" });
    } catch (error) {
      console.warn("Service worker registration failed:", error);
      return null;
    }
  }

  async function getRegistration() {
    if (!("serviceWorker" in navigator)) return null;
    return navigator.serviceWorker.getRegistration("/portal/");
  }

  async function subscribe() {
    if (!isSupported()) {
      throw new Error("المتصفح لا يدعم الإشعارات.");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("تم رفض إذن الإشعارات.");
    }

    const keyData = await Portal.request("/dashboard/push/vapid-key");
    if (!keyData.enabled || !keyData.publicKey) {
      throw new Error("الإشعارات غير مفعّلة على الخادم.");
    }

    const registration = (await getRegistration()) || (await registerServiceWorker());
    if (!registration) {
      throw new Error("تعذر تسجيل خدمة الإشعارات.");
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
    }

    await Portal.request("/dashboard/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    return true;
  }

  async function unsubscribe() {
    const registration = await getRegistration();
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await Portal.request("/dashboard/push/subscribe", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    });
  }

  async function initUi(containerId = "pushNotifyPanel") {
    const container = document.getElementById(containerId);
    if (!container) return;

    ensureManifest();

    if (!isSupported()) {
      container.hidden = true;
      return;
    }

    container.hidden = false;
    const permission = Notification.permission;
    const granted = permission === "granted";

    container.innerHTML = `
      <div class="portal-panel-head">
        <h2>الإشعارات</h2>
      </div>
      <p class="portal-lead portal-lead--compact">
        فعّل الإشعارات لتذكيرك بالمهام: قبل الموعد بـ 45 دقيقة إذا حدّدت وقتاً، أو الساعة 6:00 ص في يوم المهمة إذا كان التاريخ فقط.
        على iPhone: أضف الموقع إلى الشاشة الرئيسية ثم فعّل الإشعارات (iOS 16.4+).
      </p>
      <div class="portal-actions portal-actions--wrap">
        <button type="button" class="portal-btn-sm" id="pushEnableBtn" ${granted ? "hidden" : ""}>تفعيل الإشعارات</button>
        <button type="button" class="portal-btn-sm portal-btn-sm--muted" id="pushDisableBtn" ${granted ? "" : "hidden"}>إيقاف الإشعارات</button>
      </div>
    `;

    document.getElementById("pushEnableBtn")?.addEventListener("click", async () => {
      try {
        await subscribe();
        Portal.showToast("تم تفعيل الإشعارات.");
        await initUi(containerId);
      } catch (error) {
        Portal.showToast(error.message || "تعذر تفعيل الإشعارات.", "error");
      }
    });

    document.getElementById("pushDisableBtn")?.addEventListener("click", async () => {
      try {
        await unsubscribe();
        Portal.showToast("تم إيقاف الإشعارات.");
        await initUi(containerId);
      } catch (error) {
        Portal.showToast(error.message || "تعذر إيقاف الإشعارات.", "error");
      }
    });
  }

  return {
    isSupported,
    ensureManifest,
    registerServiceWorker,
    subscribe,
    unsubscribe,
    initUi,
  };
})();
