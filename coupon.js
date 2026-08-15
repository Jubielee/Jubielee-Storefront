(function () {
  "use strict";

  var config = window.JUBIELEE_STOREFRONT_CONFIG || {};
  var API_BASE = String(config.apiBaseUrl || "").replace(/\/+$/, "");
  var activeCoupon = null;

  function money(currency, amount) {
    var number = Number(amount || 0);
    return String(currency || "").toUpperCase() + " " +
      (Number.isFinite(number) ? number.toFixed(2) : "0.00");
  }

  function cartItems() {
    try {
      var cart = JSON.parse(localStorage.getItem("jubielee_store_cart") || "[]");
      return Array.isArray(cart) ? cart.map(function (item) {
        return {
          product_id: Number(item.id),
          quantity: Number(item.quantity)
        };
      }).filter(function (item) {
        return item.product_id > 0 && item.quantity > 0;
      }) : [];
    } catch (error) {
      return [];
    }
  }

  async function request(endpoint, options) {
    var opts = options || {};
    var headers = Object.assign({
      "Accept": "application/json",
      "Content-Type": "application/json"
    }, opts.headers || {});

    var authToken = localStorage.getItem("jubielee_store_auth_token") || "";
    if (authToken) {
      headers["Auth-Token"] = authToken;
    }

    var response = await fetch(API_BASE + "/" + endpoint.replace(/^\/+/, ""), {
      method: opts.method || "POST",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });

    var payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("The store server returned an unreadable response.");
    }

    if (!response.ok || String(payload.status) === "0") {
      var failure = new Error(payload.msg || "Coupon request failed.");
      failure.status = response.status;
      failure.payload = payload;
      throw failure;
    }

    return payload;
  }

  function buildCouponPanel() {
    var summary = document.getElementById("checkoutSummary");
    if (!summary || document.getElementById("jubieCouponPanel")) return;

    var panel = document.createElement("div");
    panel.id = "jubieCouponPanel";
    panel.style.cssText = [
      "margin:16px 0 12px",
      "padding:14px",
      "border:1px solid #cfe2d7",
      "border-radius:14px",
      "background:#f6fbf8"
    ].join(";");

    panel.innerHTML = [
      '<label for="jubieCouponCode" style="display:block;font-weight:800;margin-bottom:7px;">Coupon or prize code</label>',
      '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;">',
      '<input id="jubieCouponCode" type="text" maxlength="80" autocomplete="off" placeholder="Enter code" style="text-transform:uppercase;min-width:0;">',
      '<button id="jubieApplyCoupon" type="button" class="ghost-button">Apply</button>',
      '</div>',
      '<div id="jubieCouponMessage" style="margin-top:9px;font-size:14px;line-height:1.4;"></div>',
      '<div id="jubieCouponTotals" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid #dbe8e0;"></div>'
    ].join("");

    summary.parentNode.insertBefore(panel, summary);

    var input = document.getElementById("jubieCouponCode");
    var apply = document.getElementById("jubieApplyCoupon");

    input.addEventListener("input", function () {
      var current = String(input.value || "").trim().toUpperCase();
      if (!activeCoupon || current !== String(activeCoupon.code || "").toUpperCase()) {
        activeCoupon = null;
        renderCoupon(null);
      }
    });

    apply.addEventListener("click", applyCoupon);
  }

  function renderCoupon(data, error) {
    var message = document.getElementById("jubieCouponMessage");
    var totals = document.getElementById("jubieCouponTotals");
    var button = document.getElementById("placeOrderButton");

    if (!message || !totals) return;

    if (error) {
      message.style.color = "#a32319";
      message.textContent = error;
      totals.style.display = "none";
      totals.innerHTML = "";
      return;
    }

    if (!data) {
      message.textContent = "";
      totals.style.display = "none";
      totals.innerHTML = "";
      return;
    }

    message.style.color = "#087c45";
    message.textContent = data.fully_covered
      ? "Coupon accepted. This order is fully covered."
      : "Coupon accepted. Pay only the remaining balance.";

    totals.style.display = "block";
    totals.innerHTML = [
      '<div style="display:flex;justify-content:space-between;gap:12px;"><span>Coupon</span><strong>-' + money(data.currency, data.discount_amount) + '</strong></div>',
      '<div style="display:flex;justify-content:space-between;gap:12px;margin-top:5px;"><span>Remaining</span><strong>' + money(data.currency, data.total_amount) + '</strong></div>'
    ].join("");

    if (button) {
      button.textContent = data.fully_covered
        ? "Redeem coupon — no payment due"
        : "Pay remaining " + money(data.currency, data.total_amount);
    }
  }

  async function applyCoupon() {
    var input = document.getElementById("jubieCouponCode");
    var apply = document.getElementById("jubieApplyCoupon");
    var code = String(input && input.value || "").trim().toUpperCase();
    var items = cartItems();

    activeCoupon = null;
    renderCoupon(null);

    if (!code) {
      renderCoupon(null, "Enter a coupon code.");
      return;
    }
    if (!items.length) {
      renderCoupon(null, "Your cart is empty.");
      return;
    }

    apply.disabled = true;
    apply.textContent = "Checking…";

    try {
      var result = await request("store/coupons/validate", {
        body: { coupon_code: code, items: items }
      });
      activeCoupon = result.data || null;
      renderCoupon(activeCoupon);
    } catch (error) {
      renderCoupon(null, error.message || "Coupon could not be applied.");
    } finally {
      apply.disabled = false;
      apply.textContent = "Apply";
    }
  }

  function selectedValue(name) {
    var input = document.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : "";
  }

  function collectCheckoutPayload() {
    var paymentMethod = selectedValue("payment_method");
    var shippingMethod = selectedValue("shipping_method") || "pickup";
    var senderBank = document.getElementById("checkoutSenderBank");
    var name = document.getElementById("checkoutName").value.trim();
    var email = document.getElementById("checkoutEmail").value.trim();
    var phone = document.getElementById("checkoutPhone").value.trim();

    if (!name || (!email && !phone)) {
      throw new Error("Name and either email or phone are required.");
    }

    var shippingAddress = null;
    if (shippingMethod === "delivery") {
      var address = document.getElementById("checkoutAddress").value.trim();
      var city = document.getElementById("checkoutCity").value.trim();
      var country = document.getElementById("checkoutCountry").value.trim();
      if (!address || !city || !country) {
        throw new Error("Delivery address, city, and country are required.");
      }
      shippingAddress = { address: address, city: city, country: country };
    }

    if (!activeCoupon.fully_covered && !paymentMethod) {
      throw new Error("Choose a payment method for the remaining balance.");
    }

    if (!activeCoupon.fully_covered && paymentMethod === "wallet" &&
        !(localStorage.getItem("jubielee_store_auth_token") || "")) {
      throw new Error("Sign in before paying the remaining balance with your Wallet.");
    }

    if (!activeCoupon.fully_covered && paymentMethod === "bank_transfer" &&
        (!senderBank || !senderBank.value)) {
      throw new Error("Choose the bank you will send the remaining balance from.");
    }

    return {
      items: cartItems(),
      coupon_code: String(activeCoupon.code || "").toUpperCase(),
      payment_method: paymentMethod || "external_card",
      sender_bank: paymentMethod === "bank_transfer" && senderBank ? senderBank.value : null,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      shipping_method: shippingMethod,
      shipping_address: shippingAddress,
      customer_notes: document.getElementById("checkoutNotes").value.trim()
    };
  }

  async function couponCheckout(event) {
    if (!activeCoupon) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    var message = document.getElementById("checkoutMessage");
    var button = document.getElementById("placeOrderButton");
    var paymentMethod = selectedValue("payment_method");
    var securePaymentWindow = null;

    message.textContent = "";

    try {
      var payload = collectCheckoutPayload();

      if (!activeCoupon.fully_covered && paymentMethod === "external_card") {
        securePaymentWindow = window.open(
          "about:blank",
          "jubieleeSecureCard",
          "width=760,height=920,scrollbars=yes,resizable=yes"
        );
        if (securePaymentWindow) {
          securePaymentWindow.document.write(
            '<!doctype html><title>Jubielee Secure Payment</title><p style="font-family:Arial;padding:30px">Preparing your secure payment page…</p>'
          );
        }
      }

      button.disabled = true;
      button.textContent = activeCoupon.fully_covered ? "Redeeming coupon…" : "Creating discounted order…";

      var result = await request("store/checkout/coupon", { body: payload });
      var order = result.data;

      localStorage.setItem("jubielee_store_last_order", JSON.stringify(order));
      localStorage.setItem("jubielee_store_cart", "[]");

      if (!activeCoupon.fully_covered && paymentMethod === "external_card" && order.external_payment_url) {
        if (securePaymentWindow && !securePaymentWindow.closed) {
          securePaymentWindow.location.replace(order.external_payment_url);
          securePaymentWindow.focus();
        } else {
          window.location.assign(order.external_payment_url);
          return;
        }
      } else if (securePaymentWindow && !securePaymentWindow.closed) {
        securePaymentWindow.close();
      }

      if (order && order.checkout_token) {
        window.location.assign("payment.html?token=" + encodeURIComponent(order.checkout_token));
        return;
      }

      window.location.reload();
    } catch (error) {
      if (securePaymentWindow && !securePaymentWindow.closed) {
        securePaymentWindow.close();
      }
      message.textContent = error.message || "The coupon order could not be created.";
      button.disabled = false;
      renderCoupon(activeCoupon);
    }
  }

  function init() {
    var form = document.getElementById("checkoutForm");
    if (!form) return;

    buildCouponPanel();

    // Capture phase is intentional: when a valid coupon is active, this
    // intercepts the normal checkout handler before it can create a full-price
    // order or open a card window.
    form.addEventListener("submit", couponCheckout, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
