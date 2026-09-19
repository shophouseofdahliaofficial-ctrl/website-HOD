# Razorpay Setup for Online Payments (Checkout)

This guide covers how to enable **Online Payment** at checkout so customers are redirected to the Razorpay gateway when they choose "Online Payment" and click "Place Order".

---

## 1. Razorpay Account and Keys

1. **Sign up** at [https://razorpay.com](https://razorpay.com) and complete KYC.
2. **Dashboard** → **Settings** → **API Keys**.
3. Generate **Key ID** and **Key Secret** (use **Test** keys for development).
4. Copy:
   - `RAZORPAY_KEY_ID` (starts with `rzp_test_` or `rzp_live_`)
   - `RAZORPAY_KEY_SECRET`

---

## 2. Backend Environment Variables

In `milko-backend/.env` add:

```bash
RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="your_key_secret_here"
```

Optional (for webhook; recommended in production):

```bash
RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"
```

Restart the backend after changing `.env`.

---

## 3. Flow (No Webhook)

- User selects **Online Payment** → clicks **Place Order**.
- Backend creates an order with `payment_status: pending` and a **Razorpay order**.
- Frontend opens the **Razorpay Checkout** (modal).
- User pays on Razorpay.
- Frontend receives `razorpay_payment_id` and `razorpay_order_id` and calls **`POST /api/orders/verify-payment`**.
- Backend verifies the payment with Razorpay and sets `payment_status: paid`.
- User is redirected to **Orders**.

This works without a webhook. The webhook is a backup in case the user closes the tab before verify-payment is called.

---

## 4. Webhook (Optional, Recommended for Production)

The webhook marks orders as paid when Razorpay sends `payment.captured`, even if the user never hits verify-payment (e.g. closed browser).

### 4.1 Expose your backend to the internet

Razorpay must reach `https://your-domain.com/api/webhooks/razorpay`. In development use:

- [ngrok](https://ngrok.com): `ngrok http 3001` → use the `https://xxxx.ngrok.io` URL.
- Or deploy the backend and use its public URL.

### 4.2 Create the webhook in Razorpay

1. **Dashboard** → **Settings** → **Webhooks** → **+ Add New Webhook**.
2. **URL**: `https://your-domain.com/api/webhooks/razorpay`  
   (local: `https://xxxx.ngrok.io/api/webhooks/razorpay`).
3. **Events**: enable at least:
   - `payment.captured`
   - `payment.failed` (optional, for logging)
4. Copy the **Webhook Secret** and set:

```bash
RAZORPAY_WEBHOOK_SECRET="whsec_xxxxxxxxxxxx"
```

5. Restart the backend.

### 4.3 Webhook and raw body

The `/api/webhooks/razorpay` route is already set up to receive **raw body** for signature verification. No extra backend change is needed if your Express app is configured as in this project.

---

## 5. Database

The `orders` table gets a `razorpay_order_id` column automatically on first order create (via the order model’s `ensureOrdersSchema`). No manual migration is required.

---

## 6. Test Mode

- Use **Test** keys (`rzp_test_...`) and Razorpay’s [test cards](https://razorpay.com/docs/payments/payments/test-card-details/) (e.g. `4111 1111 1111 1111`).
- In Test mode, Razorpay still sends webhooks if the webhook URL is reachable (e.g. via ngrok).

---

## 7. Production Checklist

- [ ] Use **Live** API keys (`rzp_live_...`).
- [ ] Set `RAZORPAY_WEBHOOK_SECRET` and create a **Live** webhook for `payment.captured` (and optionally `payment.failed`).
- [ ] Ensure the backend URL for the webhook is **HTTPS** and correctly routed to `POST /api/webhooks/razorpay`.
- [ ] Complete Razorpay KYC and activate Live mode.

---

## 8. Troubleshooting

| Issue | What to check |
|-------|----------------|
| "Online payment is not available" | `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`, backend restarted. |
| Checkout opens then fails | Browser console and Network tab; confirm `order_id` and `key` in the Razorpay options. |
| "Payment verification failed" | Backend logs; Razorpay Dashboard → Payments to see if payment is `captured`. |
| Webhook not firing | URL reachable from internet (ngrok/public URL), HTTPS, and `payment.captured` selected. |
| Webhook 401 / signature error | `RAZORPAY_WEBHOOK_SECRET` matches the value shown in Razorpay for that webhook. |
