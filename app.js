(function () {
  "use strict";

  const config = window.JUBIELEE_STOREFRONT_CONFIG || {};
  const API_BASE = String(config.apiBaseUrl || "").replace(/\/+$/, "");

  const state = {
    categories: [],
    products: [],
    productById: new Map(),
    category: "",
    search: "",
    sort: "",
    page: 1,
    lastPage: 1,
    cart: loadJson("jubielee_store_cart", []),
    user: loadJson("jubielee_store_user", null),
    authToken: localStorage.getItem("jubielee_store_auth_token") || "",
    loginStep: "credentials",
    onboardingToken: "",
    lastOrder: loadJson("jubielee_store_last_order", null)
  };

  const elements = {
    overlay: document.getElementById("overlay"),
    categoryChips: document.getElementById("categoryChips"),
    catalogMessage: document.getElementById("catalogMessage"),
    productGrid: document.getElementById("productGrid"),
    cartCount: document.getElementById("cartCount"),
    cartDrawer: document.getElementById("cartDrawer"),
    cartItems: document.getElementById("cartItems"),
    cartSubtotal: document.getElementById("cartSubtotal"),
    cartCurrencyNotice: document.getElementById("cartCurrencyNotice"),
    accountButton: document.getElementById("accountButton"),
    productModal: document.getElementById("productModal"),
    productModalContent: document.getElementById("productModalContent"),
    loginModal: document.getElementById("loginModal"),
    checkoutModal: document.getElementById("checkoutModal"),
    orderModal: document.getElementById("orderModal"),
    orderModalContent: document.getElementById("orderModalContent"),
    trackModal: document.getElementById("trackModal"),
    toast: document.getElementById("toast")
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      localStorage.removeItem(key);
      return fallback;
    }
  }

  function saveCart() {
    localStorage.setItem("jubielee_store_cart", JSON.stringify(state.cart));
    updateCartCount();
  }

  function saveLogin(user) {
    state.user = user || null;
    state.authToken = user ? (user.auth_token || user.authToken || "") : "";

    if (state.user) {
      localStorage.setItem("jubielee_store_user", JSON.stringify(state.user));
      localStorage.setItem("jubielee_store_auth_token", state.authToken);
    } else {
      localStorage.removeItem("jubielee_store_user");
      localStorage.removeItem("jubielee_store_auth_token");
    }

    renderAccount();
  }

  async function api(endpoint, options) {
    const opts = options || {};
    const headers = Object.assign({
      "Accept": "application/json"
    }, opts.headers || {});

    if (opts.body && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (opts.auth && state.authToken) {
      headers["Auth-Token"] = state.authToken;
    }

    const response = await fetch(API_BASE + "/" + endpoint.replace(/^\/+/, ""), {
      method: opts.method || "GET",
      headers,
      body: opts.body instanceof FormData
        ? opts.body
        : (opts.body ? JSON.stringify(opts.body) : undefined)
    });

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("The store server returned an unreadable response.");
    }

    if (!response.ok || String(payload.status) === "0") {
      const error = new Error(payload.msg || "Store request failed.");
      error.payload = payload;
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(currency, amount) {
    const number = Number(amount || 0);
    return `${String(currency || "").toUpperCase()} ${Number.isFinite(number) ? number.toFixed(2) : "0.00"}`;
  }

  function getUserName() {
    if (!state.user) return "";
    return state.user.name ||
      state.user.full_name ||
      [state.user.fname, state.user.lname].filter(Boolean).join(" ") ||
      state.user.username ||
      state.user.email ||
      "Jubielee User";
  }

  function renderAccount() {
    if (state.user) {
      const firstName = getUserName().split(/\s+/)[0] || "Account";
      elements.accountButton.textContent = firstName;
      elements.accountButton.title = "Click to sign out";
    } else {
      elements.accountButton.textContent = "Sign in";
      elements.accountButton.title = "Sign in to Jubielee";
    }
  }

  function toast(message) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      elements.toast.hidden = true;
    }, 2600);
  }

  function openLayer(id) {
    const element = document.getElementById(id);
    if (!element) return;

    elements.overlay.hidden = false;
    element.classList.add("open");
    element.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLayer(id) {
    const element = document.getElementById(id);
    if (!element) return;

    element.classList.remove("open");
    element.setAttribute("aria-hidden", "true");

    const anyOpen = document.querySelector(".drawer.open, .modal.open");
    if (!anyOpen) {
      elements.overlay.hidden = true;
      document.body.style.overflow = "";
    }
  }

  function closeAllLayers() {
    document.querySelectorAll(".drawer.open, .modal.open").forEach((element) => {
      element.classList.remove("open");
      element.setAttribute("aria-hidden", "true");
    });
    elements.overlay.hidden = true;
    document.body.style.overflow = "";
  }

  async function loadCategories() {
    try {
      const result = await api("store/categories");
      state.categories = Array.isArray(result.data) ? result.data : [];
      renderCategories();
    } catch (error) {
      elements.categoryChips.innerHTML = "";
    }
  }

  function renderCategories() {
    const categories = [
      { name: "All", slug: "" },
      ...state.categories.filter((category) => Number(category.active_products_count || 0) > 0)
    ];

    elements.categoryChips.innerHTML = categories.map((category) => `
      <button class="category-chip ${state.category === category.slug ? "active" : ""}"
              type="button"
              data-category="${escapeHtml(category.slug)}">
        ${escapeHtml(category.name)}
      </button>
    `).join("");
  }

  async function loadProducts() {
    elements.catalogMessage.textContent = "Loading products…";
    elements.catalogMessage.hidden = false;
    elements.productGrid.innerHTML = "";

    const params = new URLSearchParams({
      page: String(state.page),
      per_page: String(config.productsPerPage || 24)
    });

    if (state.category) params.set("category", state.category);
    if (state.search) params.set("q", state.search);
    if (state.sort) params.set("sort", state.sort);

    try {
      const result = await api("store/products?" + params.toString());
      state.products = Array.isArray(result.data) ? result.data : [];
      state.lastPage = Math.max(1, Number(result.meta && result.meta.last_page || 1));
      state.productById.clear();
      state.products.forEach((product) => state.productById.set(Number(product.id), product));
      renderProducts();
      renderPagination();
    } catch (error) {
      elements.catalogMessage.textContent = error.message;
      renderPagination();
    }
  }

  function firstMedia(product) {
    return product && Array.isArray(product.media) && product.media.length
      ? product.media[0]
      : null;
  }

  function renderProducts() {
    if (!state.products.length) {
      elements.catalogMessage.hidden = false;
      elements.catalogMessage.textContent = state.search
        ? `No products found for “${state.search}”.`
        : "No products are available in this category yet.";
      return;
    }

    elements.catalogMessage.hidden = true;

    elements.productGrid.innerHTML = state.products.map((product) => {
      const media = firstMedia(product);
      const available = Number(product.available_quantity || 0);
      const low = Boolean(product.is_low_stock);
      const initial = escapeHtml(String(product.name || "J").charAt(0).toUpperCase());

      return `
        <article class="product-card">
          <button class="product-media" type="button" data-view-product="${Number(product.id)}">
            ${media && media.type === "image"
              ? `<img src="${escapeHtml(media.url)}" alt="${escapeHtml(product.name)}" loading="lazy">`
              : `<span class="product-placeholder">${initial}</span>`}
            ${product.is_featured ? `<span class="product-badge">Featured</span>` : ""}
          </button>
          <div class="product-body">
            <span class="product-category">${escapeHtml(product.category ? product.category.name : "Jubielee")}</span>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="product-description">${escapeHtml(product.short_description || "View the product for complete details.")}</p>
            <div class="product-price-row">
              <span class="product-price">${money(product.currency, product.price)}</span>
              ${product.compare_at_price
                ? `<span class="compare-price">${money(product.currency, product.compare_at_price)}</span>`
                : ""}
            </div>
            <div class="product-actions">
              <button class="add-cart-button direct-buy-button"
                      type="button"
                      data-buy-product="${Number(product.id)}"
                      ${available < 1 ? "disabled" : ""}>
                ${available < 1 ? "Out of stock" : "Buy Now"}
              </button>

              <button class="add-cart-button assisted-purchase-button"
                      type="button"
                      data-add-product="${Number(product.id)}"
                      ${available < 1 ? "disabled" : ""}>
                Speak with someone
              </button>

              <button class="view-button"
                      type="button"
                      data-view-product="${Number(product.id)}"
                      aria-label="View ${escapeHtml(product.name)}">→</button>
            </div>
            <div class="stock-note ${low ? "low" : ""}">
              ${available < 1
                ? "Currently unavailable"
                : (low ? `Only ${available} available` : `${available} available`)}
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderPagination() {
    document.getElementById("pageIndicator").textContent =
      `Page ${state.page} of ${state.lastPage}`;
    document.getElementById("previousPageButton").disabled = state.page <= 1;
    document.getElementById("nextPageButton").disabled = state.page >= state.lastPage;
  }

  async function openProduct(productId) {
    let product = state.productById.get(Number(productId));

    openLayer("productModal");
    elements.productModalContent.innerHTML = `<div class="empty-state">Loading product…</div>`;

    try {
      const slug = product && product.slug;
      if (!slug) throw new Error("Product is unavailable.");

      const result = await api("store/products/" + encodeURIComponent(slug));
      product = result.data;
      state.productById.set(Number(product.id), product);
      renderProductDetail(product);
    } catch (error) {
      elements.productModalContent.innerHTML =
        `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderProductDetail(product) {
    const media = Array.isArray(product.media) ? product.media : [];
    const available = Number(product.available_quantity || 0);
    const first = media[0] || null;

    elements.productModalContent.innerHTML = `
      <div class="product-detail">
        <div>
          <div id="productGalleryMain" class="product-gallery-main">
            ${renderLargeMedia(first, product)}
          </div>
          <div class="product-thumbnails">
            ${media.map((item, index) => `
              <button class="product-thumbnail ${index === 0 ? "active" : ""}"
                      type="button"
                      data-media-index="${index}">
                ${item.type === "video"
                  ? `<video muted preload="metadata"><source src="${escapeHtml(item.url)}" type="${escapeHtml(item.mime_type || "video/mp4")}"></video>`
                  : `<img src="${escapeHtml(item.url)}" alt="">`}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="product-detail-copy">
          <span class="section-kicker">${escapeHtml(product.category ? product.category.name : "Jubielee")}</span>
          <h2>${escapeHtml(product.name)}</h2>
          <div class="product-detail-price">${money(product.currency, product.price)}</div>
          ${product.compare_at_price
            ? `<div class="compare-price">${money(product.currency, product.compare_at_price)}</div>`
            : ""}
          <p class="stock-note ${product.is_low_stock ? "low" : ""}">
            ${available > 0 ? `${available} available` : "Currently out of stock"}
          </p>
          <div class="product-detail-description">${escapeHtml(product.description || product.short_description || "")}</div>
          <div class="detail-buy-row">
            <input id="detailQuantity"
                   type="number"
                   min="1"
                   max="${Math.max(1, available)}"
                   value="1"
                   aria-label="Quantity">

            <div class="detail-buy-actions">
              <button id="detailBuyNowButton"
                      class="primary-button"
                      type="button"
                      ${available < 1 ? "disabled" : ""}>
                Buy Now
              </button>

              <button id="detailAddButton"
                      class="primary-button"
                      type="button"
                      ${available < 1 ? "disabled" : ""}>
                Speak with someone
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const thumbnails = elements.productModalContent.querySelectorAll("[data-media-index]");
    thumbnails.forEach((button) => {
      button.addEventListener("click", () => {
        thumbnails.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        const item = media[Number(button.dataset.mediaIndex)];
        document.getElementById("productGalleryMain").innerHTML = renderLargeMedia(item, product);
      });
    });

    const buyNowButton =
      document.getElementById("detailBuyNowButton");

    if (buyNowButton) {
      buyNowButton.addEventListener("click", () => {
        const quantity = Math.max(
          1,
          Number(
            document.getElementById("detailQuantity").value || 1
          )
        );

        buyProductNow(product, quantity);
      });
    }

    const addButton =
      document.getElementById("detailAddButton");

    if (addButton) {
      addButton.addEventListener("click", () => {
        const quantity = Math.max(
          1,
          Number(
            document.getElementById("detailQuantity").value || 1
          )
        );

        openAssistedPurchase(product, quantity);
      });
    }
  }

  function renderLargeMedia(media, product) {
    if (!media) {
      return `<span class="product-placeholder">${escapeHtml(String(product.name || "J").charAt(0))}</span>`;
    }

    if (media.type === "video") {
      return `<video controls playsinline preload="metadata">
        <source src="${escapeHtml(media.url)}" type="${escapeHtml(media.mime_type || "video/mp4")}">
      </video>`;
    }

    return `<img src="${escapeHtml(media.url)}" alt="${escapeHtml(product.name)}">`;
  }

  function openAssistedPurchase(product, quantity) {

    if (!product || Number(product.available_quantity || 0) < 1) {

      toast("This product is currently unavailable.");

      return;

    }


    const media = firstMedia(product);

    const available = Number(product.available_quantity || 0);


    const selectedQuantity = Math.min(

      available,

      Math.max(1, Number(quantity || 1))

    );


    const params = new URLSearchParams({

      product_id: String(product.id || ""),

      product_name: String(product.name || ""),

      price: String(product.price || ""),

      currency: String(product.currency || "DOP"),

      quantity: String(selectedQuantity),

      available_quantity: String(available),

      language:

        localStorage.getItem("jubielee_store_language") || "es",

      product_url:

        window.location.origin +

        "/?product=" +

        encodeURIComponent(

          product.slug || product.id || ""

        )

    });


    if (media && media.type === "image" && media.url) {

      params.set("image", String(media.url));

    }


    window.location.assign(

      "https://pwa.jubielee.com/store/?" +

      params.toString()

    );

  }


  function buyProductNow(product, quantity) {
    if (!product || Number(product.available_quantity || 0) < 1) {
      toast("This product is currently unavailable.");
      return;
    }

    state.cart = [];
    saveCart();

    addToCart(product, quantity);

    closeLayer("productModal");
    closeLayer("cartDrawer");

    openCheckout();
  }


  function addToCart(product, quantity) {
    if (!product || Number(product.available_quantity || 0) < 1) {
      toast("This product is out of stock.");
      return;
    }

    const existing = state.cart.find((item) => Number(item.id) === Number(product.id));
    const desired = (existing ? Number(existing.quantity) : 0) + Number(quantity || 1);
    const max = Number(product.available_quantity || 0);

    if (desired > max) {
      toast(`Only ${max} of this product are available.`);
      return;
    }

    const media = firstMedia(product);
    const cartItem = {
      id: Number(product.id),
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
      currency: product.currency,
      available_quantity: max,
      image: media && media.type === "image" ? media.url : "",
      quantity: desired
    };

    if (existing) {
      Object.assign(existing, cartItem);
    } else {
      state.cart.push(cartItem);
    }

    saveCart();
    renderCart();
    toast("Added to JubieCart.");
  }

  function updateCartCount() {
    const count = state.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    elements.cartCount.textContent = String(count);
  }

  function cartCurrencies() {
    return [...new Set(state.cart.map((item) => String(item.currency || "").toUpperCase()))];
  }

  function cartSubtotal() {
    return state.cart.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
  }

  function renderCart() {
    updateCartCount();

    if (!state.cart.length) {
      elements.cartItems.innerHTML = `
        <div class="empty-state">
          <div class="product-placeholder" style="margin:0 auto 16px;">J</div>
          Your JubieCart is empty.
        </div>
      `;
      elements.cartSubtotal.textContent = "—";
      elements.cartCurrencyNotice.textContent = "";
      document.getElementById("checkoutButton").disabled = true;
      return;
    }

    elements.cartItems.innerHTML = state.cart.map((item) => `
      <div class="cart-item">
        <div class="cart-item-image">
          ${item.image
            ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
            : `<span class="product-placeholder" style="width:100%;height:100%;border-radius:0;">${escapeHtml(String(item.name).charAt(0))}</span>`}
        </div>
        <div>
          <h4>${escapeHtml(item.name)}</h4>
          <p>${money(item.currency, item.price)}</p>
          <div class="quantity-control">
            <button type="button" data-cart-decrease="${item.id}">−</button>
            <strong>${Number(item.quantity)}</strong>
            <button type="button" data-cart-increase="${item.id}">+</button>
          </div>
        </div>
        <button class="remove-button" type="button" data-cart-remove="${item.id}">Remove</button>
      </div>
    `).join("");

    const currencies = cartCurrencies();
    elements.cartSubtotal.textContent = currencies.length === 1
      ? money(currencies[0], cartSubtotal())
      : "Mixed currencies";
    elements.cartCurrencyNotice.textContent = currencies.length > 1
      ? "Products with different currencies must be ordered separately."
      : "";
    document.getElementById("checkoutButton").disabled = currencies.length !== 1;
  }

  function changeCartQuantity(productId, direction) {
    const item = state.cart.find((entry) => Number(entry.id) === Number(productId));
    if (!item) return;

    const next = Number(item.quantity) + direction;
    if (next < 1) {
      state.cart = state.cart.filter((entry) => Number(entry.id) !== Number(productId));
    } else if (next <= Number(item.available_quantity || 0)) {
      item.quantity = next;
    } else {
      toast(`Only ${item.available_quantity} available.`);
    }

    saveCart();
    renderCart();
  }

  function removeCartItem(productId) {
    state.cart = state.cart.filter((entry) => Number(entry.id) !== Number(productId));
    saveCart();
    renderCart();
  }

  function setLoginStep(step) {
    state.loginStep = step;

    const credentials = document.getElementById("loginCredentials");
    const accountChoice = document.getElementById("loginAccountChoice");
    const otpFields = document.getElementById("loginOtpFields");
    const consentFields = document.getElementById("loginConsentFields");
    const submitButton = document.getElementById("loginSubmitButton");
    const title = document.getElementById("loginTitle");
    const description = document.getElementById("loginDescription");

    credentials.hidden = true;
    accountChoice.hidden = true;
    otpFields.hidden = true;
    consentFields.hidden = true;
    submitButton.hidden = false;

    if (step === "credentials") {
      credentials.hidden = false;
      submitButton.textContent = "Continue";
      title.textContent = "Sign in to Jubielee";
      description.textContent =
        "Enter the email and phone number connected to your Jubielee account.";
      return;
    }

    if (step === "account_choice") {
      accountChoice.hidden = false;
      submitButton.hidden = true;
      title.textContent = "Continue with Jubielee";
      description.textContent =
        "Choose whether to shop as a guest or create a Jubielee account.";
      return;
    }

    if (step === "existing_otp") {
      otpFields.hidden = false;
      submitButton.textContent = "Verify code";
      title.textContent = "Verify your Jubielee account";
      description.textContent =
        "Enter the 6-digit code sent to your email.";
      return;
    }

    if (step === "signup_otp") {
      otpFields.hidden = false;
      submitButton.textContent = "Verify code";
      title.textContent = "Verify your email";
      description.textContent =
        "Enter the 6-digit code sent to your email.";
      return;
    }

    if (step === "consent") {
      consentFields.hidden = false;
      submitButton.textContent = "Continue to identity verification";
      title.textContent = "Identity verification";
      description.textContent =
        "Identity verification is required before your Jubielee account is created.";
    }
  }

  function openLogin() {
    state.onboardingToken = "";
    setLoginStep("credentials");

    const message = document.getElementById("loginMessage");
    message.classList.remove("success");
    message.textContent = "";

    document.getElementById("loginOtp").value = "";
    document.getElementById("identityConsent").checked = false;

    openLayer("loginModal");
  }

  async function beginNewAccount() {
    const message = document.getElementById("loginMessage");
    const createButton = document.getElementById("createAccountButton");
    const guestButton = document.getElementById("continueGuestButton");

    createButton.disabled = true;
    guestButton.disabled = true;
    message.textContent = "";

    try {
      const result = await api("identity/onboarding/start", {
        method: "POST",
        body: {
          email: state.loginEmail,
          phone: state.loginPhone,
          phone_code: state.loginPhoneCode,
          user_type: "individual",
          signup_source: "storefront",
          deviceType: "storefront",
          fcm_token: "",
          voip_token: ""
        }
      });

      if (result.flow !== "new_account" || !result.onboarding_token) {
        throw new Error(
          result.msg || "Unable to start Jubielee account registration."
        );
      }

      state.onboardingToken = result.onboarding_token;
      setLoginStep("signup_otp");

      message.classList.add("success");
      message.textContent = "Code sent to your email.";

      document.getElementById("loginOtp").value = "";
      document.getElementById("loginOtp").focus();
    } catch (error) {
      message.classList.remove("success");
      message.textContent = error.message;
    } finally {
      createButton.disabled = false;
      guestButton.disabled = false;
    }
  }

  function continueAsGuest() {
    state.onboardingToken = "";
    closeLayer("loginModal");
    prefillCheckout();

    toast(
      "Continuing as guest. Jubielee Wallet payment requires an account."
    );
  }

  async function submitLogin(event) {
    event.preventDefault();

    const message = document.getElementById("loginMessage");
    const button = document.getElementById("loginSubmitButton");

    message.textContent = "";
    message.classList.remove("success");
    button.disabled = true;

    try {
      if (state.loginStep === "credentials") {
        state.loginEmail =
          document.getElementById("loginEmail").value.trim();

        state.loginPhone =
          document.getElementById("loginPhone").value.trim();

        state.loginPhoneCode =
          document.getElementById("loginPhoneCode").value;

        if (!state.loginEmail || !state.loginPhone) {
          throw new Error("Email and phone number are required.");
        }

        const accountCheck = await api(
          "identity/onboarding/check-account",
          {
            method: "POST",
            body: {
              email: state.loginEmail,
              phone: state.loginPhone,
              phone_code: state.loginPhoneCode
            }
          }
        );

        if (accountCheck.flow === "account_mismatch") {
          throw new Error(
            accountCheck.msg ||
            "Email and phone do not match the existing account."
          );
        }

        if (accountCheck.flow === "existing_user") {
          await api("email_login", {
            method: "POST",
            body: {
              email: state.loginEmail,
              phone: state.loginPhone,
              phone_code: state.loginPhoneCode,
              fcm_token: "",
              voip_token: "",
              deviceType: "storefront",
              ip_address: ""
            }
          });

          setLoginStep("existing_otp");

          message.classList.add("success");
          message.textContent = "Code sent to your email.";

          document.getElementById("loginOtp").value = "";
          document.getElementById("loginOtp").focus();
          return;
        }

        if (accountCheck.flow === "new_account") {
          setLoginStep("account_choice");
          return;
        }

        throw new Error(
          "Unable to determine Jubielee account status."
        );
      }

      if (state.loginStep === "existing_otp") {
        const otp =
          document.getElementById("loginOtp").value.trim();

        if (otp.length !== 6) {
          throw new Error("Enter the full 6-digit code.");
        }

        const result = await api("email_verify", {
          method: "POST",
          body: {
            email: state.loginEmail,
            otp_code: otp
          }
        });

        if (!result.data) {
          throw new Error(
            "Jubielee did not return the user account."
          );
        }

        saveLogin(result.data);
        closeLayer("loginModal");
        prefillCheckout();
        toast("Signed in to Jubielee.");
        return;
      }

      if (state.loginStep === "signup_otp") {
        const otp =
          document.getElementById("loginOtp").value.trim();

        if (otp.length !== 6) {
          throw new Error("Enter the full 6-digit code.");
        }

        if (!state.onboardingToken) {
          throw new Error(
            "Registration session missing. Please start again."
          );
        }

        await api("identity/onboarding/verify-contact", {
          method: "POST",
          body: {
            onboarding_token: state.onboardingToken,
            otp_code: otp
          }
        });

        setLoginStep("consent");

        message.classList.add("success");
        message.textContent =
          "Email verified. Review the identity verification consent.";
        return;
      }

      if (state.loginStep === "consent") {
        if (!document.getElementById("identityConsent").checked) {
          throw new Error(
            "Please provide consent to continue with identity verification."
          );
        }

        const result = await api(
          "identity/onboarding/start-verification",
          {
            method: "POST",
            body: {
              onboarding_token: state.onboardingToken,
              consent: true,
              language: (
                document.documentElement.lang || "en"
              ).slice(0, 2)
            }
          }
        );

        if (!result.verification_url) {
          throw new Error(
            "Identity verification did not return a verification page."
          );
        }

        localStorage.setItem(
          "jubielee_store_onboarding_token",
          state.onboardingToken
        );

        window.location.assign(result.verification_url);
      }
    } catch (error) {
      message.classList.remove("success");
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function resumeIdentityOnboarding() {
    const token = localStorage.getItem(
      "jubielee_store_onboarding_token"
    );

    if (!token) return;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      let result;

      try {
        result = await api("identity/onboarding/status", {
          method: "POST",
          body: {
            onboarding_token: token
          }
        });
      } catch (error) {
        if (error.status === 404 || error.status === 410) {
          localStorage.removeItem(
            "jubielee_store_onboarding_token"
          );
        }
        return;
      }

      if (result.completed && result.data) {
        localStorage.removeItem(
          "jubielee_store_onboarding_token"
        );

        state.onboardingToken = "";

        saveLogin(result.data);
        prefillCheckout();

        toast(
          "Identity verified. Your Jubielee account is ready."
        );
        return;
      }

      const providerStatus = String(
        result.verification_status || ""
      ).toLowerCase();

      if (
        providerStatus === "declined" ||
        providerStatus === "abandoned" ||
        providerStatus === "expired" ||
        providerStatus === "kyc expired" ||
        result.flow === "expired"
      ) {
        localStorage.removeItem(
          "jubielee_store_onboarding_token"
        );

        toast(
          "Identity verification was not completed or approved."
        );
        return;
      }

      if (providerStatus === "in review") {
        toast(
          "Your identity verification is under review."
        );
        return;
      }

      if (attempt < 3) {
        await wait(1500);
      }
    }

    toast(
      "Identity verification was received. Jubielee is finalizing your account."
    );
  }

  function signOut() {
    saveLogin(null);
    toast("Signed out.");
  }

  function openCheckout() {
    if (!state.cart.length || cartCurrencies().length !== 1) return;

    closeLayer("cartDrawer");
    prefillCheckout();
    renderCheckoutSummary();
    updateCheckoutPaymentButton();
    openLayer("checkoutModal");
  }

  function prefillCheckout() {
    const user = state.user || {};
    document.getElementById("checkoutName").value =
      user.name || user.full_name || [user.fname, user.lname].filter(Boolean).join(" ") || "";
    document.getElementById("checkoutEmail").value = user.email || "";
    document.getElementById("checkoutPhone").value = user.mobile || "";

    const walletChoice = document.getElementById("walletPaymentChoice");
    const walletInput = walletChoice.querySelector("input");
    const walletText = document.getElementById("walletPaymentText");

    if (state.user && state.authToken) {
      walletChoice.classList.remove("disabled");
      walletInput.disabled = false;
      walletText.textContent = user.wallet_balance != null
        ? `Available: ${money(user.currency || "USD", user.wallet_balance)}`
        : "Pay directly from your Jubielee Wallet.";
    } else {
      walletChoice.classList.add("disabled");
      walletInput.disabled = true;
      walletText.textContent = "Sign in to use Wallet payment.";
      if (walletInput.checked) {
        document.querySelector('input[name="payment_method"][value="external_card"]').checked = true;
      }
    }
  }

  function renderCheckoutSummary() {
    const currency = cartCurrencies()[0] || "";
    const rows = state.cart.map((item) => `
      <div class="summary-row">
        <span>${escapeHtml(item.name)} × ${Number(item.quantity)}</span>
        <strong>${money(item.currency, Number(item.price) * Number(item.quantity))}</strong>
      </div>
    `).join("");

    document.getElementById("checkoutSummary").innerHTML = `
      ${rows}
      <div class="summary-row summary-total">
        <span>Total</span>
        <strong>${money(currency, cartSubtotal())}</strong>
      </div>
    `;
  }

  function checkoutButtonText() {
    const selected = document.querySelector(
      'input[name="payment_method"]:checked'
    );

    const method = selected ? selected.value : "";

    switch (method) {
      case "external_card":
        return "Continue to secure payment";
      case "wallet":
        return "Pay with Jubielee Account";
      case "zelle":
        return "Reserve order and view Zelle instructions";
      case "bank_transfer":
        return "Reserve order and view bank instructions";
      default:
        return "Complete purchase";
    }
  }

  function updateCheckoutPaymentButton() {
    const button = document.getElementById("placeOrderButton");

    if (button && !button.disabled) {
      button.textContent = checkoutButtonText();
    }
  }

  // JUBIELEE_STORE_BANK_TRANSFER_ROUTING_V1
  function syncBankTransferFields() {
    const fields = document.getElementById("bankTransferFields");
    const sender = document.getElementById("checkoutSenderBank");
    const selected = document.querySelector(
      'input[name="payment_method"]:checked'
    );

    const isBankTransfer =
      selected && selected.value === "bank_transfer";

    if (fields) {
      fields.hidden = !isBankTransfer;
    }

    if (sender) {
      sender.required = Boolean(isBankTransfer);
    }
  }

  async function placeOrder(event) {
    event.preventDefault();

    const button = document.getElementById("placeOrderButton");
    const message = document.getElementById("checkoutMessage");
    const paymentInput = document.querySelector('input[name="payment_method"]:checked');
    const shippingInput = document.querySelector('input[name="shipping_method"]:checked');
    const senderBankInput = document.getElementById("checkoutSenderBank");

    message.textContent = "";

    if (!paymentInput) {
      message.textContent = "Choose a payment method.";
      return;
    }

    if (paymentInput.value === "wallet" && !state.authToken) {
      message.textContent = "Sign in before paying with your Wallet.";
      return;
    }

    if (
      paymentInput.value === "bank_transfer" &&
      (!senderBankInput || !senderBankInput.value)
    ) {
      message.textContent = "Choose the bank you will send the transfer from.";
      return;
    }

    const customerName = document.getElementById("checkoutName").value.trim();
    const customerEmail = document.getElementById("checkoutEmail").value.trim();
    const customerPhone = document.getElementById("checkoutPhone").value.trim();

    if (!customerName || (!customerEmail && !customerPhone)) {
      message.textContent = "Name and either email or phone are required.";
      return;
    }

    if (shippingInput && shippingInput.value === "delivery") {
      const address = document.getElementById("checkoutAddress").value.trim();
      const city = document.getElementById("checkoutCity").value.trim();
      const country = document.getElementById("checkoutCountry").value.trim();

      if (!address || !city || !country) {
        message.textContent = "Delivery address, city, and country are required.";
        return;
      }
    }

    const payload = {
      items: state.cart.map((item) => ({
        product_id: Number(item.id),
        quantity: Number(item.quantity)
      })),
      payment_method: paymentInput.value,
      sender_bank:
        paymentInput.value === "bank_transfer" && senderBankInput
          ? senderBankInput.value
          : null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      shipping_method: shippingInput ? shippingInput.value : "pickup",
      shipping_address: shippingInput && shippingInput.value === "delivery"
        ? {
            address: document.getElementById("checkoutAddress").value.trim(),
            city: document.getElementById("checkoutCity").value.trim(),
            country: document.getElementById("checkoutCountry").value.trim()
          }
        : null,
      customer_notes: document.getElementById("checkoutNotes").value.trim()
    };

    var securePaymentWindow = null;

    if (paymentInput.value === "external_card") {
      securePaymentWindow = window.open(
        "about:blank",
        "jubieleeSecureCard",
        "width=760,height=920,scrollbars=yes,resizable=yes"
      );

      if (securePaymentWindow) {
        securePaymentWindow.document.write(
          "<!doctype html><title>Jubielee Secure Payment</title>" +
          "<p style=\"font-family:Arial;padding:30px\">" +
          "Preparing your secure payment page…</p>"
        );
      }
    }

    button.disabled = true;
    button.textContent = "Creating order…";

    try {
      const result = await api("store/checkout", {
        method: "POST",
        body: payload,
        auth: Boolean(state.authToken)
      });

      state.lastOrder = result.data;
      localStorage.setItem("jubielee_store_last_order", JSON.stringify(state.lastOrder));
      state.cart = [];
      saveCart();
      renderCart();
      closeLayer("checkoutModal");

      if (
        paymentInput.value === "external_card" &&
        state.lastOrder.external_payment_url
      ) {
        if (
          securePaymentWindow &&
          !securePaymentWindow.closed
        ) {
          securePaymentWindow.location.replace(
            state.lastOrder.external_payment_url
          );
          securePaymentWindow.focus();
        } else {
          window.location.assign(
            state.lastOrder.external_payment_url
          );
          return;
        }

        showOrder(state.lastOrder);
        return;
      }

      // JUBIELEE_STORE_PAYMENT_CONTINUITY_V1
      if (
        ["bank_transfer", "zelle"].includes(paymentInput.value) &&
        state.lastOrder &&
        state.lastOrder.checkout_token
      ) {
        window.location.assign(
          "payment.html?token=" +
            encodeURIComponent(state.lastOrder.checkout_token)
        );
        return;
      }

      showOrder(state.lastOrder);
    } catch (error) {
      if (
        securePaymentWindow &&
        !securePaymentWindow.closed
      ) {
        securePaymentWindow.close();
      }

      message.textContent = error.message;
      if (error.status === 401 && paymentInput.value === "wallet") {
        saveLogin(null);
      }
    } finally {
      button.disabled = false;
      updateCheckoutPaymentButton();
    }
  }

  function bankTransferReceivingHtml(order) {
    if (
      !order ||
      order.payment_method !== "bank_transfer" ||
      !order.receiving_bank
    ) {
      return "";
    }

    const bank = order.receiving_bank;

    return `
      <div class="order-card" style="margin-top:14px;">
        <h3 style="margin-top:0;">Bank transfer instructions</h3>

        <div>
          <span>Amount to transfer</span>
          <strong>${money(bank.currency, bank.amount)}</strong>
        </div>

        <div>
          <span>Bank</span>
          <strong>${escapeHtml(bank.bank_name || "—")}</strong>
        </div>

        <div>
          <span>Account holder</span>
          <strong>${escapeHtml(bank.account_holder || "GOING A2B EIRL")}</strong>
        </div>

        <div>
          <span>RNC</span>
          <strong>${escapeHtml(bank.rnc || "132-09324-2")}</strong>
        </div>

        <div>
          <span>Account type</span>
          <strong>${escapeHtml(bank.account_type_label || "—")}</strong>
        </div>

        <div>
          <span>Account number</span>
          <strong>${escapeHtml(bank.account_number || "—")}</strong>
        </div>

        <div>
          <span>Currency</span>
          <strong>${escapeHtml(bank.currency || "—")}</strong>
        </div>

        <div>
          <span>Payment reference</span>
          <strong>${escapeHtml(bank.reference || order.payment_reference || "—")}</strong>
        </div>

        ${
          bank.used_fallback
            ? `<p class="muted" style="margin-bottom:0;margin-top:10px;">
                 Your selected sending bank is being routed to the BanReservas
                 Going a2b receiving account.
               </p>`
            : ""
        }
      </div>
    `;
  }

  function showOrder(order) {
    const paid = order.payment_status === "paid";
    const statusLabel = String(order.status || "").replaceAll("_", " ");

    elements.orderModalContent.innerHTML = `
      <div class="order-success-icon">${paid ? "✓" : "!"}</div>
      <span class="section-kicker">${paid ? "Payment confirmed" : "Order reserved"}</span>
      <h2>${paid ? "Your order is being prepared." : "Complete your payment."}</h2>
      <p class="muted">${escapeHtml(order.payment_instructions || "")}</p>

      ${bankTransferReceivingHtml(order)}

      <div class="order-card">
        <div><span>Order</span><strong>${escapeHtml(order.order_number)}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(statusLabel)}</strong></div>
        <div><span>Payment</span><strong>${escapeHtml(String(order.payment_status).replaceAll("_", " "))}</strong></div>
        <div><span>Reference</span><strong>${escapeHtml(order.payment_reference || "—")}</strong></div>
        <div><span>Total</span><strong>${money(order.currency, order.total_amount)}</strong></div>
        ${order.reserved_until
          ? `<div><span>Reserved until</span><strong>${escapeHtml(new Date(order.reserved_until).toLocaleString())}</strong></div>`
          : ""}
      </div>
${order.external_payment_url &&
          !paid &&
          order.payment_method !== "external_card"
        ? `<a class="primary-button full-width" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:14px;"
              href="${escapeHtml(order.external_payment_url)}"
              target="_blank"
              rel="noopener">Continue to payment</a>`
        : ""}

      ${!paid && ["zelle", "bank_transfer"].includes(order.payment_method)
        ? `<form id="paymentProofForm" class="payment-proof-form">
             <label>Upload payment receipt
               <input id="paymentProofFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required>
             </label>
             <small>${order.payment_proof_received
               ? `A receipt was submitted${order.payment_proof_submitted_at ? ` on ${escapeHtml(new Date(order.payment_proof_submitted_at).toLocaleString())}` : ""}. Uploading again replaces it.`
               : "Receipt upload supports JPG, PNG, WEBP, or PDF up to 15 MB."}</small>
             <p id="paymentProofMessage" class="form-message"></p>
             <button id="paymentProofButton" class="secondary-button full-width" type="submit">
               ${order.payment_proof_received ? "Replace receipt" : "Submit receipt"}
             </button>
           </form>`
        : ""}

      <button id="refreshOrderButton" class="ghost-button full-width" style="margin-top:12px;" type="button">
        Refresh order status
      </button>
    `;

    openLayer("orderModal");

    const proofForm = document.getElementById("paymentProofForm");
    if (proofForm) {
      proofForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const fileInput = document.getElementById("paymentProofFile");
        const message = document.getElementById("paymentProofMessage");
        const button = document.getElementById("paymentProofButton");
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;

        message.textContent = "";
        if (!file) {
          message.textContent = "Choose the receipt file first.";
          return;
        }
        if (file.size > 15 * 1024 * 1024) {
          message.textContent = "The receipt cannot be larger than 15 MB.";
          return;
        }

        const formData = new FormData();
        formData.append("proof", file);
        button.disabled = true;
        button.textContent = "Uploading receipt…";

        try {
          const result = await api(
            "store/orders/" + encodeURIComponent(order.checkout_token) + "/payment-proof",
            { method: "POST", body: formData }
          );
          state.lastOrder = result.data;
          localStorage.setItem("jubielee_store_last_order", JSON.stringify(state.lastOrder));
          toast("Receipt submitted for verification.");
          showOrder(state.lastOrder);
        } catch (error) {
          message.textContent = error.message;
        } finally {
          button.disabled = false;
          button.textContent = order.payment_proof_received ? "Replace receipt" : "Submit receipt";
        }
      });
    }

    document.getElementById("refreshOrderButton").addEventListener("click", async () => {
      try {
        const result = await api("store/orders/" + encodeURIComponent(order.checkout_token));
        state.lastOrder = result.data;
        localStorage.setItem("jubielee_store_last_order", JSON.stringify(state.lastOrder));
        showOrder(state.lastOrder);
      } catch (error) {
        toast(error.message);
      }
    });
  }

  async function trackOrder(event) {
    event.preventDefault();
    const token = document.getElementById("trackOrderToken").value.trim();
    const message = document.getElementById("trackOrderMessage");
    message.textContent = "";

    try {
      const result = await api("store/orders/" + encodeURIComponent(token));
      closeLayer("trackModal");
      showOrder(result.data);
    } catch (error) {
      message.textContent = error.message;
    }
  }

  function bindEvents() {
    document.getElementById("shopNowButton").addEventListener("click", () => {
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("searchForm").addEventListener("submit", (event) => {
      event.preventDefault();
      state.search = document.getElementById("searchInput").value.trim();
      state.page = 1;
      loadProducts();
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("sortSelect").addEventListener("change", (event) => {
      state.sort = event.target.value;
      state.page = 1;
      loadProducts();
    });

    elements.categoryChips.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      state.category = button.dataset.category || "";
      state.page = 1;
      renderCategories();
      loadProducts();
    });

    elements.productGrid.addEventListener("click", (event) => {
      const buyButton =
        event.target.closest("[data-buy-product]");

      const addButton =
        event.target.closest("[data-add-product]");

      const viewButton =
        event.target.closest("[data-view-product]");

      if (buyButton) {
        const product = state.productById.get(
          Number(buyButton.dataset.buyProduct)
        );

        buyProductNow(product, 1);
      } else if (addButton) {
        const product = state.productById.get(
          Number(addButton.dataset.addProduct)
        );

        openAssistedPurchase(product, 1);
      } else if (viewButton) {
        openProduct(Number(viewButton.dataset.viewProduct));
      }
    });

    document.getElementById("previousPageButton").addEventListener("click", () => {
      if (state.page > 1) {
        state.page--;
        loadProducts();
        document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
      }
    });

    document.getElementById("nextPageButton").addEventListener("click", () => {
      if (state.page < state.lastPage) {
        state.page++;
        loadProducts();
        document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
      }
    });

    document.getElementById("cartButton").addEventListener("click", () => {
      renderCart();
      openLayer("cartDrawer");
    });

    elements.cartItems.addEventListener("click", (event) => {
      const decrease = event.target.closest("[data-cart-decrease]");
      const increase = event.target.closest("[data-cart-increase]");
      const remove = event.target.closest("[data-cart-remove]");

      if (decrease) changeCartQuantity(decrease.dataset.cartDecrease, -1);
      if (increase) changeCartQuantity(increase.dataset.cartIncrease, 1);
      if (remove) removeCartItem(remove.dataset.cartRemove);
    });

    document.getElementById("checkoutButton").addEventListener("click", openCheckout);
    document.getElementById("loginForm").addEventListener("submit", submitLogin);
    document.getElementById("createAccountButton").addEventListener("click", beginNewAccount);
    document.getElementById("continueGuestButton").addEventListener("click", continueAsGuest);
    document.getElementById("checkoutForm").addEventListener("submit", placeOrder);

    document
      .querySelectorAll('input[name="payment_method"]')
      .forEach((input) => {
        input.addEventListener("change", syncBankTransferFields);
      });

    syncBankTransferFields();
    document.getElementById("trackOrderForm").addEventListener("submit", trackOrder);

    elements.accountButton.addEventListener("click", () => {
      if (state.user) {
        if (confirm(`Sign out ${getUserName()}?`)) signOut();
      } else {
        openLogin();
      }
    });

    document.getElementById("trackOrderButton").addEventListener("click", () => {
      document.getElementById("trackOrderToken").value =
        state.lastOrder && state.lastOrder.checkout_token || "";
      openLayer("trackModal");
    });

    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeLayer(button.dataset.close));
    });

    elements.overlay.addEventListener("click", closeAllLayers);

    document.querySelectorAll('input[name="shipping_method"]').forEach((input) => {
      input.addEventListener("change", () => {
        document.getElementById("deliveryFields").hidden = input.value !== "delivery" || !input.checked;
      });
    });

    document.querySelectorAll('input[name="payment_method"]').forEach((input) => {
      input.addEventListener("change", () => {
        if (input.value === "wallet" && input.checked && !state.authToken) {
          input.checked = false;
          document.querySelector('input[name="payment_method"][value="external_card"]').checked = true;
          openLogin();
        }

        updateCheckoutPaymentButton();
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAllLayers();
    });
  }

  async function renderPendingPaymentResume() {
    var existing = document.getElementById(
      "jubieleePendingPaymentResume"
    );

    if (existing) {
      existing.remove();
    }

    var candidate = state.lastOrder;

    if (!candidate || !candidate.checkout_token) {
      return;
    }

    try {
      var result = await api(
        "store/orders/" +
          encodeURIComponent(candidate.checkout_token)
      );

      var order = result.data || null;

      if (!order) {
        return;
      }

      state.lastOrder = order;

      localStorage.setItem(
        "jubielee_store_last_order",
        JSON.stringify(order)
      );

      var isPending =
        order.status === "awaiting_payment" &&
        order.payment_status === "awaiting_payment" &&
        ["bank_transfer", "zelle"].includes(order.payment_method);

      if (!isPending) {
        return;
      }

      var banner = document.createElement("div");
      banner.id = "jubieleePendingPaymentResume";
      banner.style.position = "fixed";
      banner.style.left = "14px";
      banner.style.right = "14px";
      banner.style.bottom = "14px";
      banner.style.zIndex = "9999";
      banner.style.maxWidth = "720px";
      banner.style.margin = "0 auto";
      banner.style.background = "#ffffff";
      banner.style.borderRadius = "18px";
      banner.style.padding = "14px";
      banner.style.boxShadow =
        "0 12px 40px rgba(0,0,0,.20)";

      var statusText = order.payment_proof_received
        ? "Receipt submitted — awaiting Jubielee verification."
        : "This order is still waiting for payment.";

      banner.innerHTML =
        '<div style="font-weight:700;margin-bottom:4px;">' +
          "Pending JubieStore payment" +
        "</div>" +
        '<div style="font-size:14px;margin-bottom:10px;">' +
          escapeHtml(order.order_number || "") +
          " • " +
          escapeHtml(
            money(order.currency, order.total_amount)
          ) +
          "<br>" +
          escapeHtml(statusText) +
        "</div>" +
        '<button id="resumeJubieleePaymentButton" ' +
          'class="primary-button full-width" type="button">' +
          "Resume Payment / Upload Receipt" +
        "</button>";

      document.body.appendChild(banner);

      document
        .getElementById("resumeJubieleePaymentButton")
        .addEventListener("click", function () {
          window.location.assign(
            "payment.html?token=" +
              encodeURIComponent(order.checkout_token)
          );
        });
    } catch (error) {
      // A stale local order must never block normal shopping.
    }
  }

  async function init() {
    bindEvents();
    renderAccount();
    renderCart();
    updateCartCount();
    await Promise.all([loadCategories(), loadProducts()]);
    await resumeIdentityOnboarding();
    await renderPendingPaymentResume();
  }

  init();
})();
