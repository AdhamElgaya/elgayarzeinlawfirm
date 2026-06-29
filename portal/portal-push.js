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
      const registration = await navigator.serviceWorker.register("/portal/sw.js", { scope: "/portal/" });
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.warn("Service worker registration failed:", error);
      return null;
    }
  }

  async function getRegistration() {
    if (!("serviceWorker" in navigator)) return null;
    const registration = await navigator.serviceWorker.getRegistration("/portal/");
    if (registration) {
      await navigator.serviceWorker.ready;
    }
    return registration;
  }

  async function getBrowserSubscription() {
    const registration = await getRegistration();
    if (!registration) return null;
    return registration.pushManager.getSubscription();
  }

  async function syncSubscriptionToServer() {
    if (!isSupported() || Notification.permission !== "granted") return false;
    const subscription = await getBrowserSubscription();
    if (!subscription) return false;
    await Portal.request("/dashboard/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    return true;
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

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await existing.unsubscribe();
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });

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

  async function sendTest() {
    const data = await Portal.request("/dashboard/push/test", { method: "POST" });
    return data.message || "تم إرسال إشعار الاختبار.";
  }

  async function initUi(containerId = "pushNotifyPanel", options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const userRole = options.role || "";
    const assigneeNote =
      userRole === "admin" ? " ستصلك التذكيرات للمهام المعيّنة لك فقط." : "";

    ensureManifest();
    await registerServiceWorker();

    if (!isSupported()) {
      container.hidden = false;
      container.innerHTML = `
        <div class="portal-panel-head">
          <h2>الإشعارات</h2>
        </div>
        <p class="portal-lead portal-lead--compact">
          هذا المتصفح لا يدعم إشعارات المهام. استخدم Chrome أو Edge على الكمبيوتر، أو على iPhone أضف الموقع إلى الشاشة الرئيسية ثم افتحه من هناك (iOS 16.4+).
        </p>
      `;
      return;
    }

    let serverEnabled = true;
    let serverStatus = { subscriptions: 0, registered: false };
    try {
      const keyData = await Portal.request("/dashboard/push/vapid-key");
      serverEnabled = Boolean(keyData.enabled && keyData.publicKey);
      if (serverEnabled) {
        serverStatus = await Portal.request("/dashboard/push/status");
      }
    } catch {
      serverEnabled = false;
    }

    if (!serverEnabled) {
      container.hidden = false;
      container.innerHTML = `
        <div class="portal-panel-head">
          <h2>الإشعارات</h2>
        </div>
        <p class="portal-lead portal-lead--compact">
          الإشعارات غير مفعّلة على الخادم. أضف مفاتيح VAPID على Railway ثم أعد النشر.
        </p>
      `;
      return;
    }

    const permission = Notification.permission;
    let browserSubscribed = false;
    if (permission === "granted") {
      try {
        await syncSubscriptionToServer();
        serverStatus = await Portal.request("/dashboard/push/status");
        browserSubscribed = Boolean(await getBrowserSubscription());
      } catch {
        browserSubscribed = Boolean(await getBrowserSubscription());
      }
    }

    container.hidden = false;

    if (permission === "denied") {
      container.innerHTML = `
        <div class="portal-panel-head">
          <h2>الإشعارات</h2>
        </div>
        <p class="portal-lead portal-lead--compact">
          تم حظر الإشعارات من إعدادات المتصفح. فعّلها من إعدادات الموقع ثم أعد تحميل الصفحة.
        </p>
      `;
      return;
    }

    const ready = permission === "granted" && browserSubscribed && serverStatus.registered;

    if (ready) {
      container.innerHTML = `
        <div class="portal-panel-head">
          <h2>الإشعارات</h2>
        </div>
        <p class="portal-lead portal-lead--compact">
          الإشعارات مفعّلة على هذا الجهاز (${serverStatus.subscriptions} جهاز مسجّل) — تذكير قبل الموعد بـ 45 دقيقة (أو الساعة 6:00 ص في يوم المهمة إذا كان التاريخ فقط).${assigneeNote}
        </p>
        <div class="portal-actions portal-actions--wrap">
          <button type="button" class="portal-btn-sm" id="pushTestBtn">إرسال إشعار تجريبي</button>
          <button type="button" class="portal-btn-sm portal-btn-sm--muted" id="pushDisableBtn">إيقاف الإشعارات</button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="portal-panel-head">
          <h2>الإشعارات</h2>
        </div>
        <p class="portal-lead portal-lead--compact">
          فعّل الإشعارات لتذكيرك بالمهام المعيّنة لك: قبل الموعد بـ 45 دقيقة إذا حدّدت وقتاً، أو الساعة 6:00 ص في يوم المهمة إذا كان التاريخ فقط.${assigneeNote}
          على iPhone: أضف الموقع إلى الشاشة الرئيسية ثم فعّل الإشعارات (iOS 16.4+).
        </p>
        <div class="portal-actions portal-actions--wrap">
          <button type="button" class="portal-btn-sm" id="pushEnableBtn">تفعيل الإشعارات</button>
        </div>
      `;
    }

    document.getElementById("pushEnableBtn")?.addEventListener("click", async () => {
      try {
        await subscribe();
        Portal.showToast("تم تفعيل الإشعارات.");
        await initUi(containerId, options);
      } catch (error) {
        Portal.showToast(error.message || "تعذر تفعيل الإشعارات.", "error");
      }
    });

    document.getElementById("pushTestBtn")?.addEventListener("click", async () => {
      const btn = document.getElementById("pushTestBtn");
      if (btn) btn.disabled = true;
      try {
        const message = await sendTest();
        Portal.showToast(message);
      } catch (error) {
        Portal.showToast(error.message || "تعذر إرسال الإشعار التجريبي.", "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    document.getElementById("pushDisableBtn")?.addEventListener("click", async () => {
      try {
        await unsubscribe();
        Portal.showToast("تم إيقاف الإشعارات.");
        await initUi(containerId, options);
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
    sendTest,
    syncSubscriptionToServer,
    initUi,
  };
})();
