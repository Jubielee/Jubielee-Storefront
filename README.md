# Jubielee Storefront

A standalone customer-facing storefront for Jubielee. It is intentionally
separate from `Jubielee-PWA`.

## Included

- Public product/category browsing
- Search, sorting, product details, images, and videos
- Persistent `JubieCart`
- Guest checkout for outside-app payment
- Jubielee email OTP login
- Jubielee Wallet checkout when logged in
- Pickup or delivery details
- Order confirmation and status refresh
- Private order-token tracking
- Customer payment-receipt upload for outside payments
- Responsive desktop and mobile layout

## Configuration

Edit `config.js`:

```js
window.JUBIELEE_STOREFRONT_CONFIG = {
  storeName: "Jubielee Store",
  apiBaseUrl: "https://prod.jubielee.com/api",
  supportUrl: "https://pwa.jubielee.com/",
  productsPerPage: 24
};
```

## Local preview

No build step is required.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deployment

Point a separate domain such as `store.jubielee.com` to this folder. Example
Nginx configuration is included in `nginx.conf`.

The backend must have the store migration, controllers, route files, and
`RouteServiceProvider` update installed.

## Payment rule

Outside payment creates an order and reserves inventory. It does **not** mark
the order paid. An admin or an approved processor webhook must verify actual
receipt before fulfillment.

`payment.html` is a safe placeholder handoff page and never marks an order paid. Set the backend environment
variable below to the approved card processor URL when ready:

```dotenv
JUBIELEE_STORE_EXTERNAL_PAYMENT_URL=https://approved-payment-page.example/checkout
JUBIELEE_STOREFRONT_URL=https://store.jubielee.com
JUBIELEE_STORE_RESERVATION_MINUTES=60
JUBIELEE_STORE_ADMIN_IDS=
```

Set `JUBIELEE_STORE_ADMIN_IDS` to a comma-separated list of admin IDs to limit
catalog/order access to selected administrators. Leave it blank to allow all
authenticated admins.
