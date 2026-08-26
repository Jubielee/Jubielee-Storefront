(function () {
  "use strict";

  const config = window.JUBIELEE_STOREFRONT_CONFIG || {};
  const API_BASE = String(config.apiBaseUrl || "").replace(/\/+$/, "");
  const ordersContainer = document.getElementById("sellerOrders");
  const refreshButton = document.getElementById("sellerRefreshOrders");
  const ordersTab = document.querySelector('[data-seller-tab="orders"]');

  if (!ordersContainer || !refreshButton || !ordersTab) {
    return;
  }

  let loading = false;
  let orders = [];

  function authToken() {
    return localStorage.getItem("jubielee_store_auth_token") || "";
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
    const value = Number(amount || 0);
    return `${String(currency || "").toUpperCase()} ${Number.isFinite(value)
      ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "0.00"}`;
  }

  function dateLabel(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function statusLabel(value) {
    return String(value || "pending")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  async function api(endpoint, options) {
    const token = authToken();
    if (!token) {
      throw new Error("Sign in to your Jubielee seller account first.");
    }

    const opts = options || {};
    const response = await fetch(API_BASE + "/" + endpoint.replace(/^\/+/, ""), {
      method: opts.method || "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Auth-Token": token
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("The seller order service returned an unreadable response.");
    }

    if (!response.ok || String(payload.status) === "0") {
      throw new Error(payload.msg || "Seller order request failed.");
    }

    return payload;
  }

  function addressLabel(order) {
    const address = order.shipping_address || {};
    const parts = [
      address.address,
      address.city,
      address.state,
      address.country,
      address.location
    ].filter(Boolean);

    return parts.join(", ") || "No delivery address provided";
  }

  function nextStatuses(current, shippingMethod) {
    const status = String(current || "pending");
    const pickup = String(shippingMethod || "pickup") === "pickup";

    if (status === "completed") return [];
    if (status === "ready_for_pickup") return ["completed"];
    if (status === "shipped") return ["completed"];
    if (status === "processing") {
      return pickup
        ? ["ready_for_pickup", "completed"]
        : ["shipped", "completed"];
    }

    return pickup
      ? ["processing", "ready_for_pickup", "completed"]
      : ["processing", "shipped", "completed"];
  }

  function renderItem(order, item) {
    const choices = nextStatuses(item.fulfillment_status, order.shipping_method);
    const net = item.seller_net_amount != null ? item.seller_net_amount : item.line_total;

    return `
      <div class="seller-order-item" data-order-item="${Number(item.id)}">
        <div class="seller-order-item-main">
          <div>
            <strong>${escapeHtml(item.product_name || "Product")}</strong>
            <div class="seller-muted">${escapeHtml(item.sku || "No SKU")} · Qty ${Number(item.quantity || 0)}</div>
          </div>
          <div style="text-align:right">
            <strong>${money(order.currency, item.line_total)}</strong>
            <div class="seller-muted">Your net: ${money(order.currency, net)}</div>
          </div>
        </div>

        <div class="seller-order-status-row">
          <span class="seller-badge ${escapeHtml(item.fulfillment_status || "pending")}">
            ${escapeHtml(statusLabel(item.fulfillment_status))}
          </span>
          ${item.fulfilled_at ? `<span class="seller-muted">Completed ${escapeHtml(dateLabel(item.fulfilled_at))}</span>` : ""}
        </div>

        ${item.fulfillment_note
          ? `<div class="seller-order-note">${escapeHtml(item.fulfillment_note)}</div>`
          : ""}

        ${choices.length
          ? `<div class="seller-order-actions">
              <select class="seller-order-status-select" data-status-select="${Number(item.id)}">
                <option value="">Update status…</option>
                ${choices.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</option>`).join("")}
              </select>
              <button class="seller-button secondary small" type="button"
                      data-update-order="${Number(order.id)}"
                      data-update-item="${Number(item.id)}">Save</button>
             </div>`
          : ""}
      </div>
    `;
  }

  function renderOrders() {
    if (!orders.length) {
      ordersContainer.innerHTML = '<div class="seller-empty">No paid seller orders are waiting for you.</div>';
      return;
    }

    ordersContainer.innerHTML = orders.map((order) => `
      <article class="seller-order-card">
        <div class="seller-order-head">
          <div>
            <div class="seller-eyebrow">${escapeHtml(order.order_number || "Order")}</div>
            <h3>${escapeHtml(order.customer_name || "Customer")}</h3>
            <div class="seller-muted">Paid ${escapeHtml(dateLabel(order.paid_at))}</div>
          </div>
          <div class="seller-order-contact">
            ${order.customer_phone ? `<div>${escapeHtml(order.customer_phone)}</div>` : ""}
            ${order.customer_email ? `<div>${escapeHtml(order.customer_email)}</div>` : ""}
          </div>
        </div>

        <div class="seller-order-delivery">
          <strong>${String(order.shipping_method || "pickup") === "delivery" ? "Delivery" : "Pickup"}</strong>
          <span>${escapeHtml(addressLabel(order))}</span>
          ${order.customer_notes ? `<div class="seller-order-note"><strong>Customer note:</strong> ${escapeHtml(order.customer_notes)}</div>` : ""}
        </div>

        <div class="seller-order-items">
          ${(Array.isArray(order.items) ? order.items : []).map((item) => renderItem(order, item)).join("")}
        </div>
      </article>
    `).join("");
  }

  async function loadOrders() {
    if (loading) return;
    loading = true;
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading…";
    ordersContainer.innerHTML = '<div class="seller-empty">Loading seller orders…</div>';

    try {
      const result = await api("store/seller/orders?per_page=50");
      const paginator = result.data || {};
      orders = Array.isArray(paginator.data) ? paginator.data : [];
      renderOrders();
    } catch (error) {
      ordersContainer.innerHTML = `<div class="seller-empty">${escapeHtml(error.message)}</div>`;
    } finally {
      loading = false;
      refreshButton.disabled = false;
      refreshButton.textContent = "Refresh";
    }
  }

  async function updateStatus(orderId, itemId, button) {
    const select = ordersContainer.querySelector(`[data-status-select="${Number(itemId)}"]`);
    const status = select ? select.value : "";
    if (!status) return;

    let note = "";
    if (status === "shipped") {
      note = window.prompt("Optional shipping/tracking note:") || "";
    } else if (status === "ready_for_pickup") {
      note = window.prompt("Optional pickup note for this item:") || "";
    }

    button.disabled = true;
    button.textContent = "Saving…";

    try {
      await api(`store/seller/orders/${Number(orderId)}/items/${Number(itemId)}/status`, {
        method: "POST",
        body: { status, note: note.trim() }
      });
      await loadOrders();
    } catch (error) {
      window.alert(error.message);
      button.disabled = false;
      button.textContent = "Save";
    }
  }

  ordersContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-update-order][data-update-item]");
    if (!button) return;
    updateStatus(
      button.getAttribute("data-update-order"),
      button.getAttribute("data-update-item"),
      button
    );
  });

  refreshButton.addEventListener("click", loadOrders);
  ordersTab.addEventListener("click", loadOrders);

  document.addEventListener("jubielee-seller-refresh-orders", loadOrders);
})();
