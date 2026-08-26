window.JUBIELEE_STOREFRONT_CONFIG = {
  storeName: "Jubielee Store",
  apiBaseUrl: "https://prod.jubielee.com/api",
  supportUrl: "https://pwa.jubielee.com/",
  productsPerPage: 24
};

(function () {
  "use strict";

  if (!document.getElementById("sellerOrders")) {
    return;
  }

  var style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "seller-orders.css?v=20260826-marketplace-1";
  document.head.appendChild(style);

  var script = document.createElement("script");
  script.src = "seller-orders.js?v=20260826-marketplace-1";
  script.defer = true;
  document.head.appendChild(script);
})();
