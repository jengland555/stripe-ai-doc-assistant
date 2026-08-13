---
title: "Stripe Payment Intents Lifecycle & Integration"
slug: "/docs/payment-intents"
description: "A complete guide to managing payment lifecycles, Strong Customer Authentication (SCA), and 3D Secure with the Payment Intents API."
tags: ["payments", "payment-intents", "checkout", "3ds", "sca"]
---

# Payment Intents API

The **Payment Intents API** is the foundational building block for accepting payments on Stripe. It tracks the lifecycle of a customer checkout from payment attempt to successful capture, automatically handling dynamic payment steps such as 3D Secure authentication (SCA).

## Payment Intent Lifecycle & Statuses

A `PaymentIntent` transitions through distinct states as the customer proceeds through checkout:

```
[requires_payment_method] ──► [requires_confirmation] ──► [requires_action] (e.g., 3DS)
                                                                 │
                                                                 ▼
[succeeded] ◄───────────────────────────────────────────── [processing]
```

### Key Status Values
* **`requires_payment_method`**: The PaymentIntent was created, but no payment details have been attached yet.
* **`requires_confirmation`**: The payment method has been attached and is ready to be confirmed by your backend or client.
* **`requires_action`**: The customer's bank requires extra verification (e.g., entering an SMS code for 3D Secure).
* **`processing`**: The payment is currently being processed by the payment network.
* **`succeeded`**: Funds have been successfully authorized and captured.
* **`canceled`**: The payment attempt was abandoned or explicitly canceled.

---

## Creating a Payment Intent

Create a `PaymentIntent` on your backend server as soon as the customer arrives at your checkout page.

### Required Parameters
1. **`amount`**: An integer representing the payment amount in the **smallest currency unit** (e.g., `2000` for $20.00 USD, `1000` for ¥1,000 JPY).
2. **`currency`**: Three-letter ISO currency code in lowercase (e.g., `"usd"`, `"eur"`, `"gbp"`).
3. **`automatic_payment_methods`**: Setting `{"enabled": true}` enables Apple Pay, Google Pay, Klarna, and cards dynamically.

### Example Backend Implementation (Node.js)
```javascript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post('/create-payment-intent', async (req, res) => {
  const { items } = req.body;

  // Calculate order total securely on your backend (never trust client amounts)
  const amount = calculateOrderAmount(items);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      order_id: 'order_98765',
    },
  });

  // Return the client secret to the frontend
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});
```

---

## Confirming Payment on the Frontend (Stripe.js)

Once the backend creates the `PaymentIntent`, pass the `client_secret` to your frontend to collect and confirm payment details with Stripe Elements.

```javascript
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: 'https://example.com/checkout/success',
  },
});

if (error) {
  // Show error to customer (e.g. card declined)
  console.error(error.message);
} else {
  // Customer is redirected to return_url
}
```

---

## Handling Currency Zero-Decimal Exceptions

Most currencies require specifying amounts in cents (e.g., 100 cents = $1.00 USD). However, certain currencies are **zero-decimal**:
* **Japanese Yen (JPY)**: `amount: 1000` equals ¥1,000.
* **South Korean Won (KRW)**: `amount: 5000` equals ₩5,000.

> **Caution**: Passing `amount: 100` for USD charges $1.00. Passing `amount: 100` for JPY charges ¥100.
