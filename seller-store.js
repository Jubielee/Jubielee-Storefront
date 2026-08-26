(function () {
  "use strict";

  const config = window.JUBIELEE_STOREFRONT_CONFIG || {};
  const API_BASE = String(config.apiBaseUrl || "").replace(/\/+$/, "");
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("store") || "";

  const nameNode = document.getElementById("publicStoreName");
  const messageNode = document.getElementById("publicStoreMessage");
  const productsNode = document.getElementById("publicStoreProducts");
  const toastNode = document.getElementById("sellerToast");
  let products = [];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(currency, amount) {
    return `${String(currency || "").toUpperCase()} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function toast(message) {
    toastNode.textContent = message;
    toastNode.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { toastNode.hidden = true; }, 2600);
  }

  function firstImage(product) {
    const media = product.primary_media || product.primaryMedia || null;
    if (media && (media.media_type === "image" || media.type === "image")) {
      return media.url || "";
    }
    if (Array.isArray(product.media)) {
      const image = product.media.find((item) => (item.type || item.media_type) === "image");
      return image ? (image.url || "") : "";
    }
    return "";
  }

  function available(product) {
    if (product.available_quantity != null) return Number(product.available_quantity || 0);
    return Math.max(0, Number(product.stock_quantity || 0) - Number(product.reserved_quantity || 0));
  }

  function addToCart(product) {
    if (!product || available(product) < 1) {
      toast("This product is currently unavailable.");
      return;
    }

    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem("jubielee_store_cart") || "[]");
      if (!Array.isArray(cart)) cart = [];
    } catch (error) {
      cart = [];
    }

    const existing = cart.find((item) => Number(item.id) === Number(product.id));
    const nextQuantity = (existing ? Number(existing.quantity || 0) : 0) + 1;
    const max = available(product);

    if (nextQuantity > max) {
      toast(`Only ${max} available.`);
      return;
    }

    const item = {
      id: Number(product.id),
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
      currency: product.currency,
      available_quantity: max,
      image: firstImage(product),
      quantity: nextQuantity
    };

    if (existing) Object.assign(existing, item);
    else cart.push(item);

    localStorage.setItem("jubielee_store_cart", JSON.stringify(cart));
    toast("Added to JubieCart.");
  }

  function buyNow(product) {
    if (!product || available(product) < 1) {
      toast("This product is currently unavailable.");
      return;
    }

    localStorage.setItem("jubielee_store_cart", JSON.stringify([{
      id: Number(product.id),
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
      currency: product.currency,
      available_quantity: available(product),
      image: firstImage(product),
      quantity: 1
    }]));

    window.location.assign("index.html#catalog");
  }

  function render() {
    if (!products.length) {
      messageNode.hidden = false;
      messageNode.textContent = "This seller does not have any live products yet.";
      productsNode.innerHTML = "";
      return;
    }

    messageNode.hidden = true;
    productsNode.innerHTML = products.map((product) => {
      const image = firstImage(product);
      const stock = available(product);
      return `
        <article class="public-store-product">
          <div class="public-store-media">
            ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}">` : `<span class="public-store-placeholder">${escapeHtml(String(product.name || "J").charAt(0))}</span>`}
          </div>
          <div class="public-store-copy">
            <h2>${escapeHtml(product.name)}</h2>
            <div class="public-store-price">${money(product.currency, product.price)}</div>
            <p>${escapeHtml(product.short_description || product.description || "")}</p>
            <div class="public-store-stock">${stock > 0 ? `${stock} available` : "Out of stock"}</div>
            <div class="seller-actions">
              <button class="seller-button" type="button" data-buy="${Number(product.id)}" ${stock < 1 ? "disabled" : ""}>Buy Now</button>
              <button class="seller-button secondary" type="button" data-cart="${Number(product.id)}" ${stock < 1 ? "disabled" : ""}>Add to JubieCart</button>
            </div>
          </div>
        </article>`;
    }).join("");
  }

  async function load() {
    if (!slug) {
      messageNode.textContent = "Seller store was not specified.";
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/store/sellers/${encodeURIComponent(slug)}`, {
        headers: { "Accept": "application/json" }
      });
      const payload = await response.json();
      if (!response.ok || String(payload.status) === "0") {
        throw new Error(payload.msg || "Seller store could not be loaded.");
      }

      const data = payload.data || {};
      nameNode.textContent = data.seller && data.seller.store_name ? data.seller.store_name : "Seller Store";
      document.title = `${nameNode.textContent} | Jubielee Store`;
      const paginator = data.products || {};
      products = Array.isArray(paginator.data) ? paginator.data : [];
      render();
    } catch (error) {
      messageNode.hidden = false;
      messageNode.textContent = error.message;
    }
  }

  productsNode.addEventListener("click", (event) => {
    const buy = event.target.closest("[data-buy]");
    const cart = event.target.closest("[data-cart]");
    if (buy) {
      buyNow(products.find((product) => Number(product.id) === Number(buy.getAttribute("data-buy"))));
    } else if (cart) {
      addToCart(products.find((product) => Number(product.id) === Number(cart.getAttribute("data-cart"))));
    }
  });

  load();
})();
