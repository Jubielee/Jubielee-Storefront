(function () {
  "use strict";

  const config = window.JUBIELEE_STOREFRONT_CONFIG || {};
  const API_BASE = String(config.apiBaseUrl || "").replace(/\/+$/, "");

  const state = {
    user: loadJson("jubielee_store_user", null),
    authToken: localStorage.getItem("jubielee_store_auth_token") || "",
    loginStep: "credentials",
    loginEmail: "",
    loginPhone: "",
    loginPhoneCode: "1",
    seller: null,
    balances: [],
    categories: [],
    products: [],
    stats: {},
    recentSales: []
  };

  const el = {
    loginView: document.getElementById("sellerLoginView"),
    enrollmentView: document.getElementById("sellerEnrollmentView"),
    dashboardView: document.getElementById("sellerDashboardView"),
    signOut: document.getElementById("sellerSignOut"),
    loginForm: document.getElementById("sellerLoginForm"),
    loginCredentials: document.getElementById("sellerLoginCredentials"),
    loginOtpWrap: document.getElementById("sellerLoginOtpWrap"),
    loginSubmit: document.getElementById("sellerLoginSubmit"),
    loginMessage: document.getElementById("sellerLoginMessage"),
    enrollmentForm: document.getElementById("sellerEnrollmentForm"),
    enrollmentMessage: document.getElementById("sellerEnrollmentMessage"),
    storeName: document.getElementById("sellerStoreName"),
    publicStoreLink: document.getElementById("sellerPublicStoreLink"),
    stats: document.getElementById("sellerStats"),
    balances: document.getElementById("sellerBalances"),
    recentSales: document.getElementById("sellerRecentSales"),
    products: document.getElementById("sellerProducts"),
    ledger: document.getElementById("sellerLedger"),
    payouts: document.getElementById("sellerPayouts"),
    toast: document.getElementById("sellerToast"),
    modalBackdrop: document.getElementById("sellerProductModalBackdrop")
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveLogin(user) {
    state.user = user || null;
    state.authToken = user ? (user.auth_token || user.authToken || "") : "";

    if (state.user && state.authToken) {
      localStorage.setItem("jubielee_store_user", JSON.stringify(state.user));
      localStorage.setItem("jubielee_store_auth_token", state.authToken);
    } else {
      localStorage.removeItem("jubielee_store_user");
      localStorage.removeItem("jubielee_store_auth_token");
    }
  }

  async function api(endpoint, options) {
    const opts = options || {};
    const headers = Object.assign({ "Accept": "application/json" }, opts.headers || {});

    if (opts.auth && state.authToken) {
      headers["Auth-Token"] = state.authToken;
    }

    if (opts.body && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
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
      throw makeError("The JubieStore server returned an unreadable response.", response.status);
    }

    if (!response.ok || String(payload.status) === "0") {
      const error = makeError(payload.msg || "JubieStore request failed.", response.status);
      error.payload = payload;
      if (response.status === 401 && opts.auth) {
        saveLogin(null);
      }
      throw error;
    }

    return payload;
  }

  function makeError(message, status) {
    const error = new Error(message);
    error.status = status || 0;
    return error;
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
    return `${String(currency || "").toUpperCase()} ${Number.isFinite(number) ? number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
  }

  function dateLabel(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.toast.hidden = true; }, 3200);
  }

  function showOnly(view) {
    [el.loginView, el.enrollmentView, el.dashboardView].forEach((item) => {
      if (item) item.hidden = item !== view;
    });
    el.signOut.hidden = view === el.loginView;
  }

  function setMessage(node, message, success) {
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("success", Boolean(success));
  }

  function setLoginStep(step) {
    state.loginStep = step;
    const otp = step === "otp";
    el.loginCredentials.hidden = otp;
    el.loginOtpWrap.hidden = !otp;
    el.loginSubmit.textContent = otp ? "Verify code" : "Continue";
    setMessage(el.loginMessage, "");
  }

  async function submitLogin(event) {
    event.preventDefault();
    el.loginSubmit.disabled = true;
    setMessage(el.loginMessage, "");

    try {
      if (state.loginStep === "credentials") {
        state.loginEmail = document.getElementById("sellerLoginEmail").value.trim();
        state.loginPhone = document.getElementById("sellerLoginPhone").value.trim();
        state.loginPhoneCode = document.getElementById("sellerLoginPhoneCode").value;

        if (!state.loginEmail || !state.loginPhone) {
          throw new Error("Email and phone number are required.");
        }

        const check = await api("identity/onboarding/check-account", {
          method: "POST",
          body: {
            email: state.loginEmail,
            phone: state.loginPhone,
            phone_code: state.loginPhoneCode
          }
        });

        if (check.flow !== "existing_user") {
          throw new Error(
            check.flow === "account_mismatch"
              ? (check.msg || "Email and phone do not match the existing Jubielee account.")
              : "A Jubielee account is required before opening a seller account. Use the main Store sign-in to create one first."
          );
        }

        await api("email_login", {
          method: "POST",
          body: {
            email: state.loginEmail,
            phone: state.loginPhone,
            phone_code: state.loginPhoneCode,
            fcm_token: "",
            voip_token: "",
            deviceType: "storefront_seller",
            ip_address: ""
          }
        });

        setLoginStep("otp");
        setMessage(el.loginMessage, "Code sent to your email.", true);
        document.getElementById("sellerLoginOtp").focus();
        return;
      }

      const otp = document.getElementById("sellerLoginOtp").value.trim();
      if (otp.length !== 6) {
        throw new Error("Enter the full 6-digit code.");
      }

      const result = await api("email_verify", {
        method: "POST",
        body: { email: state.loginEmail, otp_code: otp }
      });

      if (!result.data) {
        throw new Error("Jubielee did not return your account after verification.");
      }

      saveLogin(result.data);
      toast("Signed in to Jubielee.");
      await loadSellerState();
    } catch (error) {
      setMessage(el.loginMessage, error.message);
    } finally {
      el.loginSubmit.disabled = false;
    }
  }

  async function loadSellerState() {
    if (!state.authToken) {
      setLoginStep("credentials");
      showOnly(el.loginView);
      return;
    }

    try {
      const result = await api("store/seller/dashboard", { auth: true });
      state.seller = result.data.seller;
      state.balances = Array.isArray(result.data.balances) ? result.data.balances : [];
      state.stats = result.data.stats || {};
      state.recentSales = Array.isArray(result.data.recent_sales) ? result.data.recent_sales : [];
      showOnly(el.dashboardView);
      renderDashboard();
      await Promise.all([loadProducts(), loadCategories(), loadLedger(), loadPayouts()]);
    } catch (error) {
      if (error.status === 401) {
        setLoginStep("credentials");
        showOnly(el.loginView);
        return;
      }

      if (error.status === 403 && /seller account first/i.test(error.message)) {
        showOnly(el.enrollmentView);
        const user = state.user || {};
        const suggested = user.username || [user.fname, user.lname].filter(Boolean).join(" ");
        if (suggested) document.getElementById("sellerEnrollmentName").value = suggested;
        return;
      }

      showOnly(el.loginView);
      setMessage(el.loginMessage, error.message);
    }
  }

  async function enrollSeller(event) {
    event.preventDefault();
    const name = document.getElementById("sellerEnrollmentName").value.trim();
    if (!name) return;
    const button = event.submitter || el.enrollmentForm.querySelector("button[type=submit]");
    button.disabled = true;
    setMessage(el.enrollmentMessage, "");

    try {
      await api("store/seller/enroll", {
        method: "POST",
        auth: true,
        body: { store_name: name }
      });
      toast("Seller account created.");
      await loadSellerState();
    } catch (error) {
      setMessage(el.enrollmentMessage, error.message);
    } finally {
      button.disabled = false;
    }
  }

  function renderDashboard() {
    if (!state.seller) return;
    el.storeName.textContent = state.seller.store_name || "Your JubieStore";
    el.publicStoreLink.href = "seller-store.html?store=" + encodeURIComponent(state.seller.slug || "");

    const stats = [
      ["Products", state.stats.products || 0],
      ["Live products", state.stats.live_products || 0],
      ["Awaiting approval", state.stats.pending_products || 0],
      ["Completed payouts", state.stats.completed_payouts || 0]
    ];

    el.stats.innerHTML = stats.map(([label, value]) => `
      <div class="seller-stat"><span class="label">${escapeHtml(label)}</span><strong class="value">${Number(value).toLocaleString()}</strong></div>
    `).join("");

    renderBalances();
    renderRecentSales();
    renderSettings();
  }

  function renderBalances() {
    if (!state.balances.length) {
      el.balances.innerHTML = '<div class="seller-empty">Your first paid seller order will create a Store Balance automatically.</div>';
      return;
    }

    el.balances.innerHTML = state.balances.map((balance) => `
      <div class="seller-balance-card">
        <div class="currency">${escapeHtml(balance.currency)}</div>
        <div class="amount">${money(balance.currency, balance.available_balance)}</div>
        <div class="meta">
          Lifetime sales: ${money(balance.currency, balance.lifetime_sales)}<br>
          Jubielee commission: ${money(balance.currency, balance.lifetime_commission)}<br>
          Lifetime net: ${money(balance.currency, balance.lifetime_net)}
        </div>
        <button class="seller-button secondary small" type="button" data-payout-balance="${escapeHtml(balance.currency)}" data-payout-max="${Number(balance.available_balance || 0)}" style="margin-top:12px">Send to Wallet</button>
      </div>
    `).join("");
  }

  function renderRecentSales() {
    if (!state.recentSales.length) {
      el.recentSales.innerHTML = '<div class="seller-empty">No seller sales yet.</div>';
      return;
    }

    el.recentSales.innerHTML = `
      <table class="seller-table"><thead><tr><th>Sale</th><th>Amount</th><th>Balance after</th><th>Date</th></tr></thead><tbody>
      ${state.recentSales.map((row) => `
        <tr><td><strong>${escapeHtml(row.reference)}</strong></td><td>${money(row.currency, row.amount)}</td><td>${money(row.currency, row.balance_after)}</td><td>${escapeHtml(dateLabel(row.created_at))}</td></tr>
      `).join("")}
      </tbody></table>
    `;
  }

  function renderSettings() {
    const seller = state.seller || {};
    document.getElementById("sellerSettingsStoreName").value = seller.store_name || "";
    document.getElementById("sellerSettlementMode").value = seller.settlement_mode || "store_balance";
    document.getElementById("sellerSalesAlerts").checked = Boolean(seller.sales_alerts_enabled);
    document.getElementById("sellerLowStockAlerts").checked = Boolean(seller.low_stock_alerts_enabled);

    const commission = seller.commission || {};
    document.getElementById("sellerCommissionDisplay").textContent = commission.type === "fixed"
      ? `${commission.value || 0} fixed fee`
      : `${commission.value || 0}%`;
    document.getElementById("sellerPublishDisplay").textContent = seller.auto_publish
      ? "Products publish automatically"
      : "Jubielee approval required";
  }

  async function loadCategories() {
    if (!state.authToken) return;
    try {
      const result = await api("store/seller/categories", { auth: true });
      state.categories = Array.isArray(result.data) ? result.data : [];
      const select = document.getElementById("sellerProductCategory");
      select.innerHTML = '<option value="">Uncategorized</option>' + state.categories.map((category) =>
        `<option value="${Number(category.id)}">${escapeHtml(category.name)}</option>`
      ).join("");
    } catch (error) {
      console.error(error);
    }
  }

  async function loadProducts() {
    if (!state.authToken) return;
    try {
      const result = await api("store/seller/products?per_page=50", { auth: true });
      const paginator = result.data || {};
      state.products = Array.isArray(paginator.data) ? paginator.data : [];
      renderProducts();
    } catch (error) {
      el.products.innerHTML = `<div class="seller-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderProducts() {
    if (!state.products.length) {
      el.products.innerHTML = '<div class="seller-empty">No products yet. Add your first product.</div>';
      return;
    }

    el.products.innerHTML = `
      <table class="seller-table">
        <thead><tr><th>Product</th><th>Price</th><th>Inventory</th><th>Approval</th><th>Storefront</th><th></th></tr></thead>
        <tbody>${state.products.map((product) => {
          const available = Math.max(0, Number(product.stock_quantity || 0) - Number(product.reserved_quantity || 0));
          const approval = String(product.approval_status || "approved");
          return `
            <tr>
              <td><div class="product-title">${escapeHtml(product.name)}</div><div class="sub">${escapeHtml(product.sku || "No SKU")}</div></td>
              <td>${money(product.currency, product.price)}</td>
              <td>${available} available<div class="sub">${Number(product.reserved_quantity || 0)} reserved</div></td>
              <td><span class="seller-badge ${escapeHtml(approval)}">${escapeHtml(approval)}</span></td>
              <td><span class="seller-badge ${product.is_active ? "active" : ""}">${product.is_active ? "Live" : (product.seller_published ? "Waiting" : "Hidden")}</span></td>
              <td class="actions">
                <button class="seller-button secondary small" type="button" data-edit-product="${Number(product.id)}">Edit</button>
                <button class="seller-button secondary small" type="button" data-stock-product="${Number(product.id)}">Stock</button>
                ${product.seller_published ? `<button class="seller-button danger small" type="button" data-hide-product="${Number(product.id)}">Hide</button>` : ""}
              </td>
            </tr>`;
        }).join("")}</tbody>
      </table>
    `;
  }

  function openProductModal(product) {
    const editing = Boolean(product);
    document.getElementById("sellerProductModalTitle").textContent = editing ? "Edit Product" : "Add Product";
    document.getElementById("sellerProductId").value = editing ? product.id : "";
    document.getElementById("sellerProductName").value = editing ? (product.name || "") : "";
    document.getElementById("sellerProductCategory").value = editing ? (product.category_id || "") : "";
    document.getElementById("sellerProductSku").value = editing ? (product.sku || "") : "";
    document.getElementById("sellerProductShortDescription").value = editing ? (product.short_description || "") : "";
    document.getElementById("sellerProductDescription").value = editing ? (product.description || "") : "";
    document.getElementById("sellerProductCurrency").value = editing ? (product.currency || "USD") : "USD";
    document.getElementById("sellerProductPrice").value = editing ? (product.price || "") : "";
    document.getElementById("sellerProductComparePrice").value = editing ? (product.compare_at_price || "") : "";
    document.getElementById("sellerProductStock").value = "0";
    document.getElementById("sellerProductLowStock").value = editing ? Number(product.low_stock_threshold || 5) : 5;
    document.getElementById("sellerProductPublished").checked = editing ? Boolean(product.seller_published) : true;
    document.getElementById("sellerProductWallet").checked = editing ? Boolean(product.allow_wallet_payment) : true;
    document.getElementById("sellerProductExternal").checked = editing ? Boolean(product.allow_external_payment) : true;
    document.getElementById("sellerProductImages").value = "";
    document.getElementById("sellerProductVideos").value = "";
    document.getElementById("sellerInitialStockField").hidden = editing;
    setMessage(document.getElementById("sellerProductMessage"), "");
    el.modalBackdrop.hidden = false;
  }

  function closeProductModal() {
    el.modalBackdrop.hidden = true;
  }

  async function saveProduct(event) {
    event.preventDefault();
    const id = document.getElementById("sellerProductId").value;
    const button = document.getElementById("sellerProductSave");
    const message = document.getElementById("sellerProductMessage");
    button.disabled = true;
    setMessage(message, "");

    const form = new FormData();
    form.append("name", document.getElementById("sellerProductName").value.trim());
    form.append("category_id", document.getElementById("sellerProductCategory").value);
    form.append("sku", document.getElementById("sellerProductSku").value.trim());
    form.append("short_description", document.getElementById("sellerProductShortDescription").value.trim());
    form.append("description", document.getElementById("sellerProductDescription").value.trim());
    form.append("currency", document.getElementById("sellerProductCurrency").value);
    form.append("price", document.getElementById("sellerProductPrice").value);
    form.append("compare_at_price", document.getElementById("sellerProductComparePrice").value);
    form.append("low_stock_threshold", document.getElementById("sellerProductLowStock").value || "5");
    form.append("seller_published", document.getElementById("sellerProductPublished").checked ? "1" : "0");
    form.append("allow_wallet_payment", document.getElementById("sellerProductWallet").checked ? "1" : "0");
    form.append("allow_external_payment", document.getElementById("sellerProductExternal").checked ? "1" : "0");
    if (!id) form.append("initial_stock", document.getElementById("sellerProductStock").value || "0");

    Array.from(document.getElementById("sellerProductImages").files || []).forEach((file) => form.append("images[]", file));
    Array.from(document.getElementById("sellerProductVideos").files || []).forEach((file) => form.append("videos[]", file));

    try {
      const result = await api(id ? `store/seller/products/${id}` : "store/seller/products", {
        method: "POST",
        auth: true,
        body: form
      });
      setMessage(message, result.msg || "Product saved.", true);
      toast(result.msg || "Product saved.");
      await loadProducts();
      await loadSellerState();
      closeProductModal();
      activateTab("products");
    } catch (error) {
      setMessage(message, error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function adjustInventory(productId) {
    const product = state.products.find((item) => Number(item.id) === Number(productId));
    if (!product) return;
    const adjustment = window.prompt(`Adjust inventory for ${product.name}. Use a positive number to add or a negative number to remove.`);
    if (adjustment === null) return;
    if (!/^-?\d+$/.test(adjustment) || Number(adjustment) === 0) {
      toast("Enter a non-zero whole number.");
      return;
    }
    const note = window.prompt("Reason for this inventory adjustment:");
    if (!note || !note.trim()) return;

    try {
      await api(`store/seller/products/${productId}/inventory`, {
        method: "POST",
        auth: true,
        body: { adjustment: Number(adjustment), note: note.trim() }
      });
      toast("Inventory updated.");
      await loadProducts();
    } catch (error) {
      toast(error.message);
    }
  }

  async function hideProduct(productId) {
    if (!window.confirm("Hide this product from your storefront?")) return;
    try {
      await api(`store/seller/products/${productId}/archive`, { method: "POST", auth: true, body: {} });
      toast("Product hidden.");
      await loadProducts();
    } catch (error) {
      toast(error.message);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const message = document.getElementById("sellerSettingsMessage");
    const button = event.submitter || event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    setMessage(message, "");

    try {
      const result = await api("store/seller/settings", {
        method: "POST",
        auth: true,
        body: {
          store_name: document.getElementById("sellerSettingsStoreName").value.trim(),
          settlement_mode: document.getElementById("sellerSettlementMode").value,
          sales_alerts_enabled: document.getElementById("sellerSalesAlerts").checked,
          low_stock_alerts_enabled: document.getElementById("sellerLowStockAlerts").checked
        }
      });
      state.seller = result.data;
      renderDashboard();
      setMessage(message, "Settings saved.", true);
      toast("Seller settings saved.");
    } catch (error) {
      setMessage(message, error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function createPayout(event) {
    event.preventDefault();
    const message = document.getElementById("sellerPayoutMessage");
    const button = event.submitter || event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    setMessage(message, "");

    try {
      const result = await api("store/seller/payouts", {
        method: "POST",
        auth: true,
        body: {
          currency: document.getElementById("sellerPayoutCurrency").value,
          amount: document.getElementById("sellerPayoutAmount").value
        }
      });
      if (state.user && result.data && result.data.wallet_balance_after != null) {
        state.user.wallet_balance = result.data.wallet_balance_after;
        saveLogin(state.user);
      }
      document.getElementById("sellerPayoutAmount").value = "";
      setMessage(message, result.msg || "Payout completed.", true);
      toast(result.msg || "Payout completed.");
      await loadSellerState();
      activateTab("money");
    } catch (error) {
      setMessage(message, error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function saveBalanceAlert(event) {
    event.preventDefault();
    const message = document.getElementById("sellerAlertMessage");
    const button = event.submitter || event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    setMessage(message, "");

    try {
      await api("store/seller/balance-alert", {
        method: "POST",
        auth: true,
        body: {
          currency: document.getElementById("sellerAlertCurrency").value,
          threshold_amount: document.getElementById("sellerAlertAmount").value,
          enabled: document.getElementById("sellerAlertEnabled").checked
        }
      });
      setMessage(message, "Balance alert saved.", true);
      toast("Balance alert saved.");
    } catch (error) {
      setMessage(message, error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function loadLedger() {
    if (!state.authToken) return;
    try {
      const result = await api("store/seller/ledger", { auth: true });
      const rows = result.data && Array.isArray(result.data.data) ? result.data.data : [];
      if (!rows.length) {
        el.ledger.innerHTML = '<div class="seller-empty">No Store Balance activity yet.</div>';
        return;
      }
      el.ledger.innerHTML = `
        <table class="seller-table"><thead><tr><th>Type</th><th>Reference</th><th>Direction</th><th>Amount</th><th>Balance after</th><th>Date</th></tr></thead><tbody>
        ${rows.map((row) => `
          <tr><td>${escapeHtml(String(row.entry_type || "").replaceAll("_", " "))}</td><td>${escapeHtml(row.reference || "")}</td><td>${row.direction === "in" ? "+" : "−"}</td><td>${money(row.currency, row.amount)}</td><td>${money(row.currency, row.balance_after)}</td><td>${escapeHtml(dateLabel(row.created_at))}</td></tr>
        `).join("")}
        </tbody></table>`;
    } catch (error) {
      el.ledger.innerHTML = `<div class="seller-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadPayouts() {
    if (!state.authToken) return;
    try {
      const result = await api("store/seller/payouts", { auth: true });
      const rows = result.data && Array.isArray(result.data.data) ? result.data.data : [];
      if (!rows.length) {
        el.payouts.innerHTML = '<div class="seller-empty">No Store payouts yet.</div>';
        return;
      }
      el.payouts.innerHTML = `
        <table class="seller-table"><thead><tr><th>Reference</th><th>Amount</th><th>Source</th><th>Status</th><th>Completed</th></tr></thead><tbody>
        ${rows.map((row) => `
          <tr><td>${escapeHtml(row.reference || "")}</td><td>${money(row.currency, row.amount)}</td><td>${escapeHtml(String(row.source || "").replaceAll("_", " "))}</td><td><span class="seller-badge ${escapeHtml(row.status || "")}">${escapeHtml(row.status || "")}</span></td><td>${escapeHtml(dateLabel(row.completed_at || row.created_at))}</td></tr>
        `).join("")}
        </tbody></table>`;
    } catch (error) {
      el.payouts.innerHTML = `<div class="seller-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  function activateTab(name) {
    document.querySelectorAll("[data-seller-tab]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-seller-tab") === name);
    });
    document.querySelectorAll("[data-seller-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-seller-panel") !== name;
    });
    if (name === "money") {
      loadLedger();
      loadPayouts();
    }
  }

  function signOut() {
    saveLogin(null);
    state.seller = null;
    state.products = [];
    state.balances = [];
    setLoginStep("credentials");
    showOnly(el.loginView);
    toast("Signed out.");
  }

  document.querySelectorAll("[data-seller-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.getAttribute("data-seller-tab")));
  });

  el.loginForm.addEventListener("submit", submitLogin);
  el.enrollmentForm.addEventListener("submit", enrollSeller);
  el.signOut.addEventListener("click", signOut);
  document.getElementById("sellerSettingsForm").addEventListener("submit", saveSettings);
  document.getElementById("sellerPayoutForm").addEventListener("submit", createPayout);
  document.getElementById("sellerBalanceAlertForm").addEventListener("submit", saveBalanceAlert);
  document.getElementById("sellerProductForm").addEventListener("submit", saveProduct);
  document.getElementById("sellerAddProduct").addEventListener("click", () => openProductModal(null));
  document.getElementById("sellerProductModalClose").addEventListener("click", closeProductModal);
  document.getElementById("sellerProductCancel").addEventListener("click", closeProductModal);
  document.getElementById("sellerRefreshLedger").addEventListener("click", loadLedger);

  el.modalBackdrop.addEventListener("click", (event) => {
    if (event.target === el.modalBackdrop) closeProductModal();
  });

  el.products.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-product]");
    const stock = event.target.closest("[data-stock-product]");
    const hide = event.target.closest("[data-hide-product]");
    if (edit) {
      const product = state.products.find((item) => Number(item.id) === Number(edit.getAttribute("data-edit-product")));
      if (product) openProductModal(product);
    } else if (stock) {
      adjustInventory(stock.getAttribute("data-stock-product"));
    } else if (hide) {
      hideProduct(hide.getAttribute("data-hide-product"));
    }
  });

  el.balances.addEventListener("click", (event) => {
    const button = event.target.closest("[data-payout-balance]");
    if (!button) return;
    activateTab("money");
    document.getElementById("sellerPayoutCurrency").value = button.getAttribute("data-payout-balance");
    document.getElementById("sellerPayoutAmount").value = button.getAttribute("data-payout-max") || "";
    document.getElementById("sellerPayoutAmount").focus();
  });

  loadSellerState();
})();
