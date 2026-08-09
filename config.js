window.JUBIELEE_STOREFRONT_CONFIG = {
  storeName: "Jubielee Store",
  apiBaseUrl: "https://prod.jubielee.com/api",
  supportUrl: "https://pwa.jubielee.com/",
  productsPerPage: 24
};

(function () {
  "use strict";

  const STORAGE_KEY = "jubielee_store_referral";
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  function normalizeCode(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 20);
  }

  function loadReferral() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const saved = JSON.parse(raw);
      const code = normalizeCode(saved && saved.code);
      const capturedAt = Number(saved && saved.captured_at || 0);

      if (!code || !capturedAt || Date.now() - capturedAt > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return { code, captured_at: capturedAt };
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function captureIncomingReferral() {
    const params = new URLSearchParams(window.location.search || "");
    const incoming = normalizeCode(params.get("ref") || params.get("referral_code"));

    if (!incoming || loadReferral()) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      code: incoming,
      captured_at: Date.now()
    }));
  }

  captureIncomingReferral();

  if (typeof window.fetch !== "function") return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    let nextInit = init;
    const url = typeof input === "string" ? input : (input && input.url ? input.url : "");
    const isEmailLogin = /\/email_login(?:\?|$)/.test(url);
    const isStoreCheckout = /\/store\/checkout(?:\?|$)/.test(url);

    if ((isEmailLogin || isStoreCheckout) && init && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body);
        const referral = loadReferral();

        if (isEmailLogin) {
          body.signup_source = "storefront";
        }

        if (referral && referral.code) {
          body.referral_code = referral.code;
        }

        nextInit = Object.assign({}, init, {
          body: JSON.stringify(body)
        });
      } catch (error) {
        nextInit = init;
      }
    }

    const request = originalFetch(input, nextInit);

    if (isStoreCheckout) {
      request.then(function (response) {
        try {
          response.clone().json().then(function (payload) {
            if (String(payload && payload.status) === "1") {
              localStorage.removeItem(STORAGE_KEY);
            }
          }).catch(function () {});
        } catch (error) {}
      }).catch(function () {});
    }

    return request;
  };
})();
