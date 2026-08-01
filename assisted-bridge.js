(function () {
  "use strict";

  let lastProductId = "";

  function readText(scope, selector) {
    const element = scope && scope.querySelector(selector);
    return element ? element.textContent.trim() : "";
  }

  function openPurchase(button) {
    const card = button.closest(".product-card");
    const detail = button.closest(".product-detail");
    const scope = card || detail || document;

    const id =
      button.dataset.addProduct ||
      lastProductId ||
      "";

    const name =
      readText(scope, "h3") ||
      readText(scope, "h2");

    const priceText =
      readText(scope, ".product-price") ||
      readText(scope, ".product-detail-price");

    const priceMatch = priceText.match(
      /\b([A-Z]{3})\s*([\d,]+(?:\.\d{1,2})?)/i
    );

    const imageElement = scope.querySelector("img");

    const quantityElement =
      document.getElementById("detailQuantity");

    const quantity = Math.max(
      1,
      Number(
        quantityElement
          ? quantityElement.value
          : 1
      )
    );

    if (!name) {
      window.alert(
        "We could not identify the selected product."
      );
      return;
    }

    const params = new URLSearchParams({
      product_id: id,
      product_name: name,
      price: priceMatch
        ? priceMatch[2].replace(/,/g, "")
        : "",
      currency: priceMatch
        ? priceMatch[1].toUpperCase()
        : "DOP",
      quantity: String(quantity),
      language:
        localStorage.getItem(
          "jubielee_store_language"
        ) || "es",
      product_url: window.location.href
    });

    if (imageElement && imageElement.src) {
      params.set("image", imageElement.src);
    }

    window.location.assign(
      "https://pwa.jubielee.com/store/?" +
      params.toString()
    );
  }

  function refreshStorefront() {
    document
      .querySelectorAll("[data-add-product]")
      .forEach(function (button) {
        if (!button.disabled) {
          button.textContent =
            "Speak with someone";
        }
      });

    const detailButton =
      document.getElementById("detailAddButton");

    if (detailButton && !detailButton.disabled) {
      detailButton.textContent =
        "Speak with someone";
    }

    const cartButton =
      document.getElementById("cartButton");

    const accountButton =
      document.getElementById("accountButton");

    if (cartButton) {
      cartButton.hidden = true;
    }

    if (accountButton) {
      accountButton.hidden = true;
    }

    const heroTitle =
      document.querySelector(".hero h1");

    if (heroTitle) {
      heroTitle.textContent =
        "Find it. Select it. Confirm it.";
    }
  }

  document.addEventListener(
    "click",
    function (event) {
      const viewButton =
        event.target.closest(
          "[data-view-product]"
        );

      if (viewButton) {
        lastProductId =
          viewButton.dataset.viewProduct || "";
      }

      const buyButton =
        event.target.closest(
          "[data-add-product], #detailAddButton"
        );

      if (!buyButton || buyButton.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      openPurchase(buyButton);
    },
    true
  );

  new MutationObserver(
    refreshStorefront
  ).observe(document.body, {
    childList: true,
    subtree: true
  });

  refreshStorefront();
})();
